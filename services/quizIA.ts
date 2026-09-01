import { supabase } from "@/repositories/supabase";
import type { QuizIAParametros, QuizPergunta } from "@/types/quiz";
import type { AnaliseAnexo } from "@/types/anotacoes";

/** Lê o `detalhe`/`error` do corpo de um erro não-2xx do `functions.invoke` (ver comentário
 *  em `analisarAnexoSessao` logo abaixo — mesmo problema em todo `invoke` desta função). */
async function detalheDoErro(error: unknown): Promise<string | null> {
    try {
        const corpo = await (error as any)?.context?.json?.();
        return corpo?.detalhe ?? corpo?.error ?? null;
    } catch {
        return null;
    }
}

/**
 * Gera o quiz pós-sessão via Edge Function (`supabase/functions/gerar-quiz-foco`), que chama
 * o Gemini com o conteúdo estudado e o perfil do aluno (idade, objetivo, nível, ritmo,
 * dificuldade — coletados no onboarding). A chave do Gemini fica só no servidor.
 *
 * Quem chama deve sempre ter um fallback pronto: qualquer falha aqui (rede, IA fora do ar,
 * resposta malformada) não pode travar o encerramento da sessão de foco.
 */
export const gerarQuizIA = async (
    params: QuizIAParametros
): Promise<{ data: QuizPergunta[] | null; error: string | null }> => {
    const { data, error } = await supabase.functions.invoke("gerar-quiz-foco", {
        body: params,
    });

    if (error) {
        /*
          Mesmo tratamento do `analisarAnexoSessao` logo abaixo: `invoke` transforma qualquer
          resposta não-2xx num FunctionsHttpError cuja `message` é sempre genérica ("Edge
          Function returned a non-2xx status code"). O motivo real (400 de matéria faltando,
          502 do Gemini, chave ausente) só existe no corpo da resposta, guardado em `context`.
          Sem ler isso a falha era invisível — o aluno recebia o quiz fixo achando que era IA.
        */
        let detalhe: string | null = null;
        try {
            const corpo = await (error as any)?.context?.json?.();
            detalhe = corpo?.detalhe ?? corpo?.error ?? null;
        } catch {
            // Corpo não era JSON — segue com a mensagem genérica mesmo.
        }

        console.warn("Erro ao gerar quiz por IA:", detalhe ?? error);
        return { data: null, error: detalhe ?? error.message ?? "Erro ao gerar quiz." };
    }

    if (!data?.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
        console.warn("Quiz gerado por IA veio vazio ou em formato inesperado:", data);
        return { data: null, error: "Quiz vazio ou inválido." };
    }

    return { data: data.questions as QuizPergunta[], error: null };
};

/**
 * Lê um PDF de questões anexado a uma sessão via Edge Function
 * (`supabase/functions/analisar-anexo-sessao`), que manda o arquivo inteiro pro Gemini
 * como `inlineData`. Devolve quantas questões o arquivo tinha, um resumo e uma sugestão
 * de próximo passo — e o gabarito, quando o próprio PDF trazia um.
 *
 * Mesmo contrato do quiz: falha aqui não pode derrubar o upload. Quem chama trata `null`
 * mantendo o anexo salvo sem análise (ver services/anexosSessao.ts).
 */
export const analisarAnexoSessao = async (params: {
    base64: string;
    mimeType: string;
    disciplina: string;
    conteudo: string | null;
}): Promise<{ data: AnaliseAnexo | null; error: string | null }> => {
    const { data, error } = await supabase.functions.invoke("analisar-anexo-sessao", {
        body: params,
    });

    if (error) {
        /*
          `invoke` transforma qualquer resposta não-2xx num FunctionsHttpError cuja
          `message` é sempre genérica ("Edge Function returned a non-2xx status code"). O
          motivo real (ex.: o 400 do Gemini reclamando do mimeType) só existe no corpo da
          resposta, guardado em `context` — sem ler isso, a tela nunca consegue dizer o que
          houve, e o console.error da função não é acessível pela CLI nem pelo MCP.
        */
        let detalhe: string | null = null;
        try {
            const corpo = await (error as any)?.context?.json?.();
            detalhe = corpo?.detalhe ?? corpo?.error ?? null;
        } catch {
            // Corpo não era JSON — segue com a mensagem genérica mesmo.
        }

        console.warn("Erro ao analisar anexo por IA:", detalhe ?? error);
        return { data: null, error: detalhe ?? error.message ?? "Erro ao analisar o arquivo." };
    }

    if (!data || typeof data.questoesDetectadas !== "number") {
        console.warn("Análise de anexo veio em formato inesperado:", data);
        return { data: null, error: "Análise vazia ou inválida." };
    }

    return {
        data: {
            questoesDetectadas: data.questoesDetectadas,
            questoesDiscursivas: data.questoesDiscursivas ?? 0,
            numerosObjetivas: Array.isArray(data.numerosObjetivas) ? data.numerosObjetivas : null,
            resumo: data.resumo ?? null,
            proximoPasso: data.proximoPasso ?? null,
            gabarito: data.gabarito ?? null,
        },
        error: null,
    };
};

/**
 * Sobe o arquivo do anexo pra Gemini Files API (`supabase/functions/chat-anexo-sessao`,
 * ação "upload") e devolve a referência (`fileUri`) que o chat reusa nas mensagens
 * seguintes, sem reenviar o arquivo inteiro a cada pergunta. A referência vale por ~48h.
 */
export const subirAnexoParaChat = async (params: {
    base64: string;
    mimeType: string;
}): Promise<{ data: { fileUri: string; expiraEm: string | null } | null; error: string | null }> => {
    const { data, error } = await supabase.functions.invoke("chat-anexo-sessao", {
        body: { acao: "upload", ...params },
    });

    if (error) {
        const detalhe = await detalheDoErro(error);
        console.warn("Erro ao preparar anexo para o chat:", detalhe ?? error);
        return { data: null, error: detalhe ?? error.message ?? "Erro ao preparar o arquivo para o chat." };
    }

    if (!data?.fileUri) {
        console.warn("Upload do anexo pro chat veio sem fileUri:", data);
        return { data: null, error: "Não foi possível preparar o arquivo para o chat." };
    }

    return { data: { fileUri: data.fileUri, expiraEm: data.expiraEm ?? null }, error: null };
};

/**
 * Manda uma pergunta pro chat sobre o anexo (`chat-anexo-sessao`, ação "mensagem"), junto
 * do histórico da conversa e da referência do arquivo já hospedado (ver `subirAnexoParaChat`).
 */
export const perguntarSobreAnexo = async (params: {
    fileUri: string;
    mimeType: string;
    disciplina: string;
    conteudo: string | null;
    historico: { papel: "user" | "model"; texto: string }[];
    pergunta: string;
}): Promise<{ data: string | null; error: string | null }> => {
    const { data, error } = await supabase.functions.invoke("chat-anexo-sessao", {
        body: { acao: "mensagem", ...params },
    });

    if (error) {
        const detalhe = await detalheDoErro(error);
        console.warn("Erro ao perguntar sobre o anexo:", detalhe ?? error);
        return { data: null, error: detalhe ?? error.message ?? "Não foi possível responder agora." };
    }

    if (!data?.resposta) {
        console.warn("Resposta do chat do anexo veio vazia:", data);
        return { data: null, error: "Resposta vazia." };
    }

    return { data: data.resposta as string, error: null };
};
