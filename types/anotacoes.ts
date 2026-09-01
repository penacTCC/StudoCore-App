/**
 * Anotações que o usuário escreve sobre uma sessão de estudo — o que estudou, como
 * estava a concentração, o que ficou pendente e qual o próximo passo.
 *
 * Moram nas colunas `anotacao_*` de `sessoes_foco` (ver migration
 * 20260805120000_anotacoes_e_anexos_sessao.sql).
 */
export type AnotacoesSessao = {
    estudo: string;
    concentracao: string;
    pendente: string;
    proximoPasso: string;
};

export const ANOTACOES_VAZIAS: AnotacoesSessao = {
    estudo: "",
    concentracao: "",
    pendente: "",
    proximoPasso: "",
};

/** Metadados de cada campo, usados tanto pelo formulário quanto pela tela de detalhes. */
export const CAMPOS_ANOTACAO = [
    {
        chave: "estudo",
        rotulo: "O que estudou",
        placeholder: "Os tópicos e materiais que você passou nessa sessão...",
    },
    {
        chave: "concentracao",
        rotulo: "Concentração",
        placeholder: "Como foi seu foco? O que atrapalhou?",
    },
    {
        chave: "pendente",
        rotulo: "Ficou pendente",
        placeholder: "O que você não conseguiu terminar ou não entendeu...",
    },
    {
        chave: "proximoPasso",
        rotulo: "Próximo passo",
        placeholder: "Por onde continuar na próxima sessão...",
    },
] as const satisfies readonly { chave: keyof AnotacoesSessao; rotulo: string; placeholder: string }[];

export const temAnotacao = (anotacoes: AnotacoesSessao) =>
    CAMPOS_ANOTACAO.some(({ chave }) => anotacoes[chave].trim().length > 0);

/**
 * Correção de um formulário anexado: `{ "1": true, "2": false, ... }`, indexado pelo
 * número da questão. Guardar questão a questão (em vez de só o total) é o que vai
 * permitir alimentar o banco de erros depois.
 */
export type CorrecaoFormulario = Record<string, boolean>;

/** Um PDF de questões anexado a uma sessão, já com o que a IA extraiu dele. */
export type AnexoSessao = {
    id: string;
    sessao_id: string | null;
    user_id: string;
    titulo: string;
    disciplina: string;
    storage_path: string | null;
    backblaze_file_id: string | null;
    created_at: string;
    /** Só questões objetivas — discursivas são ignoradas pela análise. */
    questoes_detectadas: number | null;
    /** Quantas discursivas a IA ignorou (pra tela explicar o número menor). */
    questoes_discursivas: number | null;
    /** Números das objetivas como aparecem no PDF, ex: ["1","2","5"]. */
    numeros_objetivas: string[] | null;
    resumo_ia: string | null;
    proximo_passo_ia: string | null;
    /** Gabarito extraído do próprio PDF, quando o arquivo trazia um. */
    gabarito_ia: Record<string, string> | null;
    correcao: CorrecaoFormulario | null;
    acertos_informados: number | null;
    /** Referência do arquivo já hospedado na Gemini Files API, reusada pelo chat do anexo. */
    gemini_file_uri: string | null;
    /** Quando a referência acima expira (~48h do upload) — depois disso o chat reenvia o arquivo. */
    gemini_file_expira_em: string | null;
};

/** Uma mensagem da conversa do chat sobre um anexo (Premium). */
export type MensagemChatAnexo = {
    id: string;
    anexo_id: string;
    papel: "user" | "model";
    texto: string;
    created_at: string;
};

/** Resposta da Edge Function `analisar-anexo-sessao`. */
export type AnaliseAnexo = {
    questoesDetectadas: number;
    questoesDiscursivas: number;
    numerosObjetivas: string[] | null;
    resumo: string | null;
    proximoPasso: string | null;
    gabarito: Record<string, string> | null;
};

/** Um anexo só entra na taxa de acerto depois de corrigido (ver detalhes-sessao). */
export const anexoCorrigido = (anexo: AnexoSessao) =>
    anexo.acertos_informados !== null || (anexo.correcao !== null && Object.keys(anexo.correcao).length > 0);

/** Quantos acertos o anexo representa — da grade por questão ou do total informado. */
export const acertosDoAnexo = (anexo: AnexoSessao): number => {
    if (anexo.correcao && Object.keys(anexo.correcao).length > 0) {
        return Object.values(anexo.correcao).filter(Boolean).length;
    }
    return anexo.acertos_informados ?? 0;
};
