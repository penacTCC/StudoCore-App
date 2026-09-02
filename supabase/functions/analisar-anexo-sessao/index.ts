// Edge Function que lê um PDF de questões anexado a uma sessão de estudo com o Gemini.
//
// Todos os modelos da cascata abaixo aceitam PDF como entrada. Apostar num modelo só foi o
// que quebrou a análise nas primeiras versões: os modelos 2.5 não são mais liberados para
// projetos novos e respondiam 404, sem plano B.
//
// Mesmos motivos da `gerar-quiz-foco` pra viver no servidor: a chave do Gemini não pode ir
// pro bundle do app, e o Supabase valida o JWT antes da requisição chegar aqui (não usar
// --no-verify-jwt no deploy).
//
// O app manda o arquivo em base64 e recebe de volta quantas questões o PDF tinha, um
// resumo curto, uma sugestão de próximo passo e — quando o próprio PDF trazia um gabarito —
// o gabarito extraído, que o app usa pra corrigir as respostas do aluno sem ele precisar
// marcar questão por questão.
//
// Só conta questões OBJETIVAS. Discursivas são ignoradas (e reportadas à parte em
// `questoesDiscursivas`) porque o app ainda não tem como corrigi-las — marcar
// certo/errado numa dissertativa seria autoavaliação, não correção.
//
// Deploy: `supabase functions deploy analisar-anexo-sessao`
// Secret: `supabase secrets set GEMINI_API_KEY=<sua-chave>` (o mesmo já usado pelo quiz)

import { consumirCota, respostaDeCotaEsgotada } from "../_shared/cota.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/*
  Tentados em ordem, caindo pro próximo quando a API recusa (404 de modelo indisponível pra
  chave, 403 de permissão, 429 de cota).

  Os modelos 2.5 saíram da lista: o Google parou de liberá-los para projetos novos e a API
  responde 404 "no longer available to new users" — foi exatamente o que derrubou a
  primeira versão desta função. A linha Flash-Lite é a escolha aqui porque tem a maior cota
  diária do free tier e dá conta de leitura estruturada de PDF; a Flash entra só como
  último recurso, já que sua cota diária é bem menor.
*/
const MODELOS_GEMINI = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.5-flash"];

/*
  O Gemini rejeita mimeType que ele não conhece com 400 na hora — e o DocumentPicker do
  Android manda `application/octet-stream` quando o provedor do arquivo não informa o tipo.
  Como aqui só entra lista de exercícios, qualquer coisa fora da lista vira PDF.
*/
const MIMES_ACEITOS = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

type CorpoRequisicao = {
  base64?: string;
  mimeType?: string;
  disciplina?: string;
  conteudo?: string | null;
};

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    questoesDetectadas: { type: "INTEGER" },
    questoesDiscursivas: { type: "INTEGER" },
    // Números das objetivas como aparecem no PDF. Numa lista mista, a 3ª objetiva pode ser
    // a questão 7 do documento — sem isso a grade de correção do app numeraria 1..N e
    // apontaria pra questão errada.
    numerosObjetivas: { type: "ARRAY", items: { type: "STRING" } },
    resumo: { type: "STRING" },
    proximoPasso: { type: "STRING" },
    temGabarito: { type: "BOOLEAN" },
    // Pares "número da questão" -> "alternativa correta". Formato de array porque o schema
    // do Gemini não tem mapa de chaves livres; o app remonta o objeto.
    gabarito: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          questao: { type: "STRING" },
          resposta: { type: "STRING" },
        },
        required: ["questao", "resposta"],
      },
    },
  },
  required: ["questoesDetectadas", "questoesDiscursivas", "resumo", "proximoPasso", "temGabarito"],
};

function montarPrompt(corpo: CorpoRequisicao) {
  const contexto = [
    corpo.disciplina ? `Matéria da sessão: ${corpo.disciplina}` : null,
    corpo.conteudo ? `Conteúdo estudado na sessão: ${corpo.conteudo}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `Você está analisando um formulário/lista de exercícios que um aluno anexou a uma
sessão de estudo no app.

${contexto || "Nenhum contexto adicional sobre a sessão foi informado."}

Analise o documento anexado e responda:

IMPORTANTE — considere APENAS questões de múltipla escolha / objetivas: aquelas que
oferecem alternativas para o aluno escolher (a), b), c)... / I, II, III / verdadeiro ou
falso / colunas para associar). Questões discursivas, dissertativas, "justifique",
"explique", "calcule e apresente o desenvolvimento" e afins devem ser IGNORADAS na
contagem, no gabarito e na numeração — o app ainda não sabe corrigir esse tipo.

1. "questoesDetectadas": quantas questões OBJETIVAS o documento contém. Ignore textos de
   apoio, capa, instruções, gabarito e todas as questões discursivas. Se não houver
   nenhuma questão objetiva, responda 0.

2. "questoesDiscursivas": quantas questões discursivas você ignorou. 0 se não houver
   nenhuma.

3. "numerosObjetivas": os números das questões objetivas exatamente como aparecem no
   documento, na ordem (ex: ["1","2","5","6"] se as questões 3 e 4 eram discursivas).

4. "resumo": uma frase curta (máximo 140 caracteres) descrevendo do que trata a lista —
   os tópicos cobertos.

5. "proximoPasso": uma sugestão prática e específica de próximo passo de estudo para esse
   aluno, com base nos tópicos da lista e no conteúdo que ele estudou. Uma ou duas frases,
   em tom direto (ex: "Revise X antes de tentar Y"). Não invente desempenho do aluno — você
   não sabe quantas ele acertou.

6. "temGabarito": true apenas se o documento contiver o gabarito/respostas das questões
   objetivas.

7. "gabarito": se e somente se "temGabarito" for true, liste cada questão OBJETIVA com sua
   resposta correta, usando o número da questão como está no documento (ex: questao "1",
   resposta "C" ou o texto da alternativa). Não inclua discursivas. Se não houver gabarito,
   devolva uma lista vazia.

Responda em português do Brasil.`;
}

/*
  Pega o JSON da resposta. Não dá pra assumir `parts[0]`: os modelos da linha 3 podem
  devolver blocos de raciocínio (`thought: true`) antes do conteúdo, e o primeiro part
  seria o pensamento em vez do JSON pedido.
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

    if (!corpo.base64) {
      return new Response(JSON.stringify({ error: "Arquivo não informado." }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const chaveGemini = Deno.env.get("GEMINI_API_KEY");
    if (!chaveGemini) {
      console.error("GEMINI_API_KEY não configurada nos secrets da função.");
      return new Response(JSON.stringify({ error: "Serviço de análise não configurado." }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Cota so depois de validar arquivo e chave: erro nosso nao consome cota do usuario.
    const cota = await consumirCota(req, "anexo");
    if (cota && !cota.permitido) {
      return respostaDeCotaEsgotada("anexo", cota, CORS_HEADERS);
    }

    const corpoGemini = JSON.stringify({
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType:
                  corpo.mimeType && MIMES_ACEITOS.includes(corpo.mimeType)
                    ? corpo.mimeType
                    : "application/pdf",
                data: corpo.base64,
              },
            },
            { text: montarPrompt(corpo) },
          ],
        },
      ],
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
        console.log("Anexo analisado com o modelo", modelo);
        break;
      }

      ultimoErro = `${modelo} → ${tentativa.status}: ${(await tentativa.text()).slice(0, 250)}`;
      console.error("Erro do Gemini:", ultimoErro);
    }

    if (!respostaGemini) {
      const detalhe = ultimoErro;

      /*
        O texto do Google vai junto na resposta (recortado). É mensagem de erro da API, não
        segredo — e sem ela o app só consegue dizer "não deu", já que o console.error daqui
        não é legível pela CLI nem pelo MCP.
      */
      return new Response(
        JSON.stringify({
          error: "Não foi possível analisar o arquivo agora.",
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
          error: "O modelo não retornou uma análise válida.",
          detalhe: `Sem conteúdo. finishReason: ${dadosGemini?.candidates?.[0]?.finishReason ?? "?"}`,
        }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const analise = JSON.parse(textoJson) as {
      questoesDetectadas?: number;
      questoesDiscursivas?: number;
      numerosObjetivas?: string[];
      resumo?: string;
      proximoPasso?: string;
      temGabarito?: boolean;
      gabarito?: { questao: string; resposta: string }[];
    };

    // Remonta a lista de pares como o mapa que o app guarda em `arquivos.gabarito_ia`.
    const gabarito =
      analise.temGabarito && Array.isArray(analise.gabarito) && analise.gabarito.length > 0
        ? Object.fromEntries(analise.gabarito.map((item) => [item.questao, item.resposta]))
        : null;

    return new Response(
      JSON.stringify({
        questoesDetectadas: analise.questoesDetectadas ?? 0,
        questoesDiscursivas: analise.questoesDiscursivas ?? 0,
        numerosObjetivas: Array.isArray(analise.numerosObjetivas) ? analise.numerosObjetivas : null,
        resumo: analise.resumo ?? null,
        proximoPasso: analise.proximoPasso ?? null,
        gabarito,
      }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (erro) {
    console.error("Erro inesperado na análise do anexo:", erro);
    return new Response(JSON.stringify({ error: "Erro inesperado ao analisar o arquivo." }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
