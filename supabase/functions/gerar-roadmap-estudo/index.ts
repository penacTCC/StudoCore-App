// Edge Function que monta um roadmap de estudos (um plano de `planos`/`planos_blocos`)
// a partir de um objetivo, com um PDF opcional (edital, ementa, lista de tópicos).
//
// Fica no servidor pelos mesmos dois motivos das outras: a chave do Gemini não pode ir pro
// bundle do app, e o Supabase já valida o JWT antes de a requisição chegar aqui (não usar
// --no-verify-jwt no deploy). Quem chama é sempre um usuário logado.
//
// Devolve uma PROPOSTA — nome do plano + lista de blocos (matéria, tópico, dia da semana e
// horário sugeridos, duração). Nada é gravado aqui: a materialização acontece no app,
// depois da revisão humana na prévia (`app/(modals)/roadmap-preview.tsx`). É a mesma
// divisão da `analisar-anexo-sessao`, que analisa e o app guarda.
//
// `escopo` não muda o prompt (a geração de blocos é a mesma); serve para o texto saber se
// o destinatário é a pessoa ou o grupo, e para log/rate-limit no futuro.
//
// Deploy: `supabase functions deploy gerar-roadmap-estudo`
// Secret: `supabase secrets set GEMINI_API_KEY=<sua-chave>` (a mesma já usada pelos outros)

import { consumirCota, respostaDeCotaEsgotada } from "../_shared/cota.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/*
  Mesma cascata da `analisar-anexo-sessao` e da `gerar-quiz-foco`: os modelos 2.5 não são
  mais liberados para projetos novos (404) e apostar num modelo só foi o que derrubou as
  primeiras versões daquelas funções. A Flash-Lite tem a maior cota diária do free tier e
  dá conta de gerar uma grade de estudo estruturada; a Flash entra como último recurso.
*/
const MODELOS_GEMINI = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.5-flash"];

const MIMES_ACEITOS = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

// Limites defensivos do que aceitamos do modelo — o app também valida ao materializar.
const MAX_BLOCOS = 30;
const MAX_NOME_LEN = 60;

type Escopo = "pessoal" | "grupo";

type ArquivoPayload = { base64: string; mimeType: string; nome: string };

type CorpoRequisicao = {
  /** @deprecated use `arquivos` para múltiplos materiais. */
  base64?: string;
  /** @deprecated use `arquivos` para múltiplos materiais. */
  mimeType?: string;
  /** Múltiplos materiais de estudo (edital, ementa, lista de exercícios). */
  arquivos?: ArquivoPayload[];
  objetivo: string;
  /** Contexto extra: nível de ensino, grupo etc. */
  contexto?: string | null;
  escopo?: Escopo;
  /** Restrições de disponibilidade do usuário. Ex: "Não consigo estudar sexta-feira, quinta só das 14h às 18h". */
  disponibilidade?: string;
};

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    nome: { type: "STRING" },
    // 1 frase confirmando o que entendeu do objetivo — o app mostra na prévia pra pessoa
    // validar que a IA entendeu certo antes de aceitar.
    resumoObjetivo: { type: "STRING" },
    blocos: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          diaSemana: { type: "INTEGER" }, // 0 = segunda ... 6 = domingo
          horaInicio: { type: "STRING" }, // "HH:MM"
          duracaoMin: { type: "INTEGER" },
          materia: { type: "STRING" },
          topico: { type: "STRING" },
        },
        required: ["diaSemana", "horaInicio", "duracaoMin", "materia", "topico"],
      },
    },
  },
  required: ["nome", "resumoObjetivo", "blocos"],
};

function paraMinutos(horaInicio: string): number {
  const [h, m] = horaInicio.split(":").map(Number);
  return h * 60 + m;
}

type BlocoSanitizado = {
  diaSemana: number;
  horaInicio: string;
  duracaoMin: number;
  materia: string;
  topico: string;
};

/**
 * Se dois blocos no mesmo dia se sobrepõem, mantém só o primeiro e remove os
 * que conflitam. A IA pode ignorar a regra de não-sobreposição — esse pós-
 * processamento garante que o app nunca receba blocos conflitantes.
 */
function removerConflitosPorDia(blocos: BlocoSanitizado[]): BlocoSanitizado[] {
  const porDia = new Map<number, BlocoSanitizado[]>();
  for (const b of blocos) {
    const lista = porDia.get(b.diaSemana) ?? [];
    lista.push(b);
    porDia.set(b.diaSemana, lista);
  }

  const resultado: BlocoSanitizado[] = [];
  for (const [, doDia] of porDia) {
    doDia.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
    const mantidos: BlocoSanitizado[] = [];
    for (const bloco of doDia) {
      const inicio = paraMinutos(bloco.horaInicio);
      const fim = inicio + bloco.duracaoMin;
      const conflita = mantidos.some((m) => {
        const mInicio = paraMinutos(m.horaInicio);
        const mFim = mInicio + m.duracaoMin;
        return Math.min(fim, mFim) - Math.max(inicio, mInicio) > 0;
      });
      if (!conflita) mantidos.push(bloco);
    }
    resultado.push(...mantidos);
  }
  return resultado;
}

function montarPrompt(corpo: CorpoRequisicao, temAnexos: boolean) {
  const escopo =
    corpo.escopo === "grupo"
      ? "um grupo de estudos (o plano vai valer para todo o grupo)"
      : "a pessoa (é o plano de estudos dela)";

  const contexto = corpo.contexto?.trim()
    ? `Contexto adicional:\n${corpo.contexto.trim()}`
    : "Nenhum contexto adicional foi informado.";

  const disponibilidade = corpo.disponibilidade?.trim()
    ? `\nDisponibilidade de estudos do usuário: ${corpo.disponibilidade.trim()}.`
    : "";

  const regraMaterias = temAnexos
    ? `\nREGRAS CRÍTICAS SOBRE MATÉRIAS (os materiais anexados SÃO a fonte única):
   - Use EXCLUSIVAMENTE as matérias e tópicos encontrados nos documentos anexados.
   - NÃO invente matérias que não estejam nos PDFs. Se o material é de Biologia e
     Química, o roadmap só pode ter blocos de Biologia e Química — nunca inclua
     Matemática, Português, História ou qualquer outra matéria ausente dos PDFs.
   - Extraia os tópicos diretamente do conteúdo dos documentos: capítulos, seções,
     listas de exercícios, temas mencionados.`
    : `\nMATÉRIAS:
   - O usuário pode ter listado matérias no objetivo. Se houver matérias explícitas
     no texto do objetivo, use-as. Caso contrário, sugira matérias coerentes com o
     objetivo informado.`;

  return `Você é um especialista em organização de estudos. Crie um roadmap de estudos para ${escopo},
a partir do objetivo informado. Responda em português do Brasil.

Objetivo do usuário:
${corpo.objetivo.trim()}

${contexto}
${disponibilidade}
${regraMaterias}

Regras para a proposta:

1. "nome": um nome curto e descritivo para o plano/roadmap (máximo ${MAX_NOME_LEN} caracteres),
   ex.: "Revisão ENEM 2026".

2. "resumoObjetivo": uma frase (máximo 160 caracteres) confirmando o que você entendeu do
   objetivo. Use o texto do próprio usuário quando possível.

3. "blocos": a grade de estudo em si. Regras:
   - Cada bloco tem matéria (nome livre, como o usuário falaria), tópico específico (o que
     estudar naquele bloco), dia da semana (0=segunda ... 6=domingo), horário de início
     ("HH:MM") e duração em minutos.
   - Distribua os blocos ao longo da semana de forma realista e sustentável: nada de dez
     blocos de estudo por dia. 1 a 4 blocos de estudo por dia, em média.
   - A duração de cada bloco entre 25 e 120 minutos, coerente com um ciclo de foco.
   - NUNCA coloque dois blocos no MESMO dia com horários que se sobreponham. Cada bloco
     em um mesmo dia deve começar depois que o anterior termina. Respeite os horários de
     início e duração para garantir que não haja conflitos no mesmo dia.
   - Se houver restrições de disponibilidade, respeite-as: não agende blocos em dias ou
     horários em que o usuário disse que não pode estudar.
   - Mantenha no máximo ${MAX_BLOCOS} blocos.

Responda apenas o JSON no schema pedido.`;
}

/*
  Pega o JSON da resposta. Não dá pra assumir `parts[0]`: os modelos da linha 3 podem
  devolver blocos de raciocínio (`thought: true`) antes do conteúdo.
*/
function extrairTexto(dadosGemini: unknown): string | null {
  const partes = (dadosGemini as any)?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(partes)) return null;

  const parte = partes.find((p: any) => !p?.thought && typeof p?.text === "string" && p.text.trim());
  return parte?.text ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const corpo = (await req.json()) as CorpoRequisicao;

    if (!corpo.objetivo?.trim()) {
      return new Response(JSON.stringify({ error: "Objetivo não informado." }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const chaveGemini = Deno.env.get("GEMINI_API_KEY");
    if (!chaveGemini) {
      console.error("GEMINI_API_KEY não configurada nos secrets da função.");
      return new Response(JSON.stringify({ error: "Serviço de IA não configurado." }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const cota = await consumirCota(req, "roadmap");
    if (cota && !cota.permitido) {
      return respostaDeCotaEsgotada("roadmap", cota, CORS_HEADERS);
    }

    const parts: unknown[] = [];

    const anexos = corpo.arquivos?.length
      ? corpo.arquivos
      : corpo.base64
        ? [{ base64: corpo.base64, mimeType: corpo.mimeType ?? "application/pdf" }]
        : [];

    for (const anexo of anexos) {
      parts.push({
        inlineData: {
          mimeType: anexo.mimeType && MIMES_ACEITOS.includes(anexo.mimeType)
            ? anexo.mimeType
            : "application/pdf",
          data: anexo.base64,
        },
      });
    }

    if (anexos.length > 1) {
      parts.push({
        text: `Os ${anexos.length} materiais anexados acima cobrem diferentes matérias. O roadmap deve ter blocos APENAS com as matérias e tópicos que aparecem nestes documentos. NÃO invente matérias extras.`,
      });
    }

    parts.push({ text: montarPrompt(corpo, anexos.length > 0) });

    const corpoGemini = JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    });

    let respostaGemini: Response | null = null;
    let ultimoErro = "";

    for (const modelo of MODELOS_GEMINI) {
      const tentativa = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": chaveGemini },
          body: corpoGemini,
        }
      );

      if (tentativa.ok) {
        respostaGemini = tentativa;
        console.log("Roadmap gerado com o modelo", modelo);
        break;
      }

      ultimoErro = `${modelo} → ${tentativa.status}: ${(await tentativa.text()).slice(0, 250)}`;
      console.error("Erro do Gemini:", ultimoErro);
    }

    if (!respostaGemini) {
      const detalhe = ultimoErro;

      /*
        O texto do Google vai junto na resposta (recortado). É mensagem de erro da API, não
        segredo — e sem ela o app só consegue dizer "não deu". Mesmo padrão da anexo-sessao.
      */
      return new Response(
        JSON.stringify({
          error: "Não foi possível gerar o roadmap agora.",
          detalhe: `Gemini ${detalhe}`,
        }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const dadosGemini = await respostaGemini.json();
    const textoJson = extrairTexto(dadosGemini);

    if (!textoJson) {
      console.error("Resposta do Gemini sem conteúdo:", JSON.stringify(dadosGemini));
      return new Response(
        JSON.stringify({
          error: "O modelo não retornou uma proposta válida.",
          detalhe: `Sem conteúdo. finishReason: ${dadosGemini?.candidates?.[0]?.finishReason ?? "?"}`,
        }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const proposta = JSON.parse(textoJson) as {
      nome?: string;
      resumoObjetivo?: string;
      blocos?: {
        diaSemana?: number;
        horaInicio?: string;
        duracaoMin?: number;
        materia?: string;
        topico?: string;
      }[];
    };

    const ehHoraValida = (h: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(h);

    const blocos = Array.isArray(proposta.blocos)
      ? proposta.blocos
          .map((b) => ({
            diaSemana:
              typeof b.diaSemana === "number" ? Math.min(6, Math.max(0, Math.round(b.diaSemana))) : 0,
            horaInicio: ehHoraValida(b.horaInicio ?? "") ? b.horaInicio : "08:00",
            duracaoMin:
              typeof b.duracaoMin === "number"
                ? Math.min(120, Math.max(25, Math.round(b.duracaoMin)))
                : 50,
            materia: (b.materia ?? "Estudo Geral").trim().slice(0, 40) || "Estudo Geral",
            topico: (b.topico ?? "").trim().slice(0, 120),
          }))
          .slice(0, MAX_BLOCOS)
      : [];

    if (blocos.length === 0) {
      return new Response(
        JSON.stringify({ error: "O modelo não retornou blocos de estudo." }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const blocosSemConflito = removerConflitosPorDia(blocos);

    return new Response(
      JSON.stringify({
        nome: (proposta.nome ?? "Meu roadmap de estudos").trim().slice(0, MAX_NOME_LEN),
        resumoObjetivo: (proposta.resumoObjetivo ?? "").trim().slice(0, 160),
        blocos: blocosSemConflito,
      }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (erro) {
    console.error("Erro inesperado ao gerar roadmap:", erro);
    return new Response(JSON.stringify({ error: "Erro inesperado ao gerar o roadmap." }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
