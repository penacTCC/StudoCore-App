// Edge Function que gera o quiz pós-sessão de foco com o Gemini 2.5 Flash Lite.
//
// Fica no servidor (e não no app) por dois motivos: a chave do Gemini nunca deve ir para o
// bundle do cliente, e o Supabase já verifica o JWT do usuário antes de deixar a requisição
// chegar aqui (não usar --no-verify-jwt no deploy), então só quem está logado no app consegue
// chamar essa função.
//
// Recebe sempre uma LISTA de matérias — uma sessão normal manda só uma; uma execução de
// plano com várias matérias (ver app/(tabs)/focus.tsx) manda todas de uma vez, e as
// questões (até `maxQuestoes`) saem distribuídas entre elas.
//
// Só `materia` é obrigatório. O `conteudo` pode vir vazio (sessão antiga, ou pomodoro
// iniciado antes do campo virar obrigatório) e nesse caso o quiz cobre o tema geral da
// matéria — antes isso derrubava a requisição em 400 e o app caía no quiz fixo de frações
// sem ninguém perceber.
//
// Deploy: `supabase functions deploy gerar-quiz-foco`
// Secret: `supabase secrets set GEMINI_API_KEY=<sua-chave>`

import { consumirCota, respostaDeCotaEsgotada } from "../_shared/cota.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/*
  Cascata em vez de um modelo fixo: o Google parou de liberar os modelos 2.5 para projetos
  novos (404 "no longer available to new users"), e como esta função tem fallback pro quiz
  fixo, a falha era silenciosa — o aluno recebia as questões de fração genéricas achando que
  eram da IA. Mesma lista da `analisar-anexo-sessao`.
*/
const MODELOS_GEMINI = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.5-flash"];
const MAX_QUESTOES_PADRAO = 10;
const MAX_QUESTOES_LIMITE = 15;

type MateriaRequisicao = {
  materia: string;
  /** Opcional: sem ele o quiz cobre o tema geral da matéria. */
  conteudo?: string | null;
  minutosEstudados?: number;
};

type CorpoRequisicao = {
  materias?: MateriaRequisicao[];
  maxQuestoes?: number;
  idade?: number | null;
  objetivo?: string | null;
  nivelEnsino?: string | null;
  ritmoEstudo?: string | null;
  dificuldade?: string | null;
};

// Schema de resposta estruturada do Gemini: garante JSON válido no formato esperado pelo
// app, sem depender de parsing frágil de texto livre.
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "INTEGER" },
          materia: { type: "STRING" },
          text: { type: "STRING" },
          options: {
            type: "ARRAY",
            items: { type: "STRING" },
          },
          correctAnswer: { type: "STRING" },
        },
        required: ["id", "materia", "text", "options", "correctAnswer"],
      },
    },
  },
  required: ["questions"],
};

/** Quantas questões cada matéria recebe: base igual pra todas, sobra pra quem estudou mais. */
function distribuirQuestoes(materias: MateriaRequisicao[], total: number) {
  const n = materias.length;
  const base = Math.floor(total / n);
  let sobra = total - base * n;

  const ordenadas = [...materias].sort(
    (a, b) => (b.minutosEstudados ?? 0) - (a.minutosEstudados ?? 0)
  );

  return ordenadas.map((materia) => {
    const extra = sobra > 0 ? 1 : 0;
    if (sobra > 0) sobra -= 1;
    return { ...materia, quantidade: base + extra };
  });
}

/** Monta o prompt em português com o contexto do aluno, calibrando dificuldade e linguagem. */
function montarPrompt(corpo: CorpoRequisicao, distribuicao: ReturnType<typeof distribuirQuestoes>) {
  const perfil: string[] = [];
  if (corpo.idade) perfil.push(`Idade: ${corpo.idade} anos`);
  if (corpo.nivelEnsino) perfil.push(`Nível de ensino: ${corpo.nivelEnsino}`);
  if (corpo.objetivo) perfil.push(`Objetivo de estudo: ${corpo.objetivo}`);
  if (corpo.ritmoEstudo) perfil.push(`Ritmo de estudo preferido: ${corpo.ritmoEstudo}`);
  if (corpo.dificuldade) perfil.push(`Dificuldade autodeclarada no assunto: ${corpo.dificuldade}`);

  const perfilTexto = perfil.length > 0
    ? `Perfil do aluno:\n${perfil.map((linha) => `- ${linha}`).join("\n")}`
    : "Nenhuma informação de perfil disponível — use um nível intermediário genérico.";

  const totalQuestoes = distribuicao.reduce((soma, item) => soma + item.quantidade, 0);

  /** Sem conteúdo específico o quiz cobre os temas centrais da matéria, em vez de falhar. */
  const descreverConteudo = (conteudo?: string | null) =>
    conteudo?.trim()
      ? `conteúdo estudado: ${conteudo.trim()}`
      : "sem conteúdo específico informado — cubra os temas centrais dessa matéria";

  const distribuicaoTexto = distribuicao
    .map((item) => `- ${item.quantidade} questões sobre "${item.materia}" (${descreverConteudo(item.conteudo)})`)
    .join("\n");

  const contextoMultiplasMaterias = distribuicao.length > 1
    ? `O aluno estudou várias matérias na mesma sessão. Distribua exatamente:\n${distribuicaoTexto}\n`
    : `Matéria: ${distribuicao[0].materia}\nConteúdo específico estudado: ${descreverConteudo(distribuicao[0].conteudo)}\n`;

  return `Você é um professor criando um quiz de fixação para um aluno que acabou de estudar.

${contextoMultiplasMaterias}
${perfilTexto}

Gere exatamente ${totalQuestoes} questões de múltipla escolha (4 opções cada, só uma correta),
respeitando a quantidade por matéria pedida acima, calibradas para o perfil do aluno:
linguagem e complexidade adequadas à idade e ao nível de ensino, dificuldade das questões
alinhada ao que o aluno disse sentir sobre o assunto (se disse ter dificuldade, questões
mais graduais; se disse que domina, questões mais desafiadoras). Responda em português do
Brasil.

Cada questão precisa ter: um "id" numérico sequencial a partir de 1, um campo "materia"
com o nome exato da matéria à qual ela pertence (igual ao texto informado acima), o texto
da pergunta em "text", um array "options" com exatamente 4 alternativas em texto puro (sem
prefixo tipo "A)"), e "correctAnswer" com o texto exato de uma das alternativas em "options".`;
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
    // Só a matéria é exigida: o conteúdo específico é um detalhe a mais no prompt, não um
    // pré-requisito pra existir quiz.
    const materias = (corpo.materias ?? []).filter((m) => m?.materia?.trim());

    if (materias.length === 0) {
      return new Response(
        JSON.stringify({ error: "Informe ao menos uma matéria em 'materias'." }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Cota depois da validacao: requisicao malformada nao gasta a cota do dia do aluno.
    const cota = await consumirCota(req, "quiz");
    if (cota && !cota.permitido) {
      return respostaDeCotaEsgotada("quiz", cota, CORS_HEADERS);
    }

    const maxQuestoes = Math.min(corpo.maxQuestoes ?? MAX_QUESTOES_PADRAO, MAX_QUESTOES_LIMITE);
    const distribuicao = distribuirQuestoes(materias, Math.max(maxQuestoes, materias.length));

    const chaveGemini = Deno.env.get("GEMINI_API_KEY");
    if (!chaveGemini) {
      console.error("GEMINI_API_KEY não configurada nos secrets da função.");
      return new Response(
        JSON.stringify({ error: "Serviço de geração de quiz não configurado." }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const corpoGemini = JSON.stringify({
      contents: [{ parts: [{ text: montarPrompt(corpo, distribuicao) }] }],
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
        console.log("Quiz gerado com o modelo", modelo);
        break;
      }

      ultimoErro = `${modelo} → ${tentativa.status}: ${(await tentativa.text()).slice(0, 250)}`;
      console.error("Erro do Gemini:", ultimoErro);
    }

    if (!respostaGemini) {
      return new Response(
        JSON.stringify({ error: "Não foi possível gerar o quiz agora.", detalhe: `Gemini ${ultimoErro}` }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const dadosGemini = await respostaGemini.json();
    const textoJson = extrairTexto(dadosGemini);

    if (!textoJson) {
      console.error("Resposta do Gemini sem conteúdo:", JSON.stringify(dadosGemini));
      /*
        O `detalhe` acompanha a resposta (como na `analisar-anexo-sessao`): é mensagem de
        erro da API, não segredo, e sem ela o app só consegue dizer "não deu" — o
        console.error daqui não é legível pela CLI nem pelo MCP.
      */
      return new Response(
        JSON.stringify({
          error: "O modelo não retornou um quiz válido.",
          detalhe: `Sem conteúdo. finishReason: ${dadosGemini?.candidates?.[0]?.finishReason ?? "?"}`,
        }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const quiz = JSON.parse(textoJson) as { questions?: unknown };
    if (!Array.isArray(quiz.questions) || quiz.questions.length === 0) {
      return new Response(
        JSON.stringify({
          error: "O modelo não retornou nenhuma questão.",
          detalhe: `JSON sem 'questions': ${textoJson.slice(0, 250)}`,
        }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ questions: quiz.questions }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro inesperado ao gerar quiz:", error);
    return new Response(
      JSON.stringify({
        error: "Erro inesperado ao gerar o quiz.",
        detalhe: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
