import { supabase } from "@/repositories/supabase";

/**
 * Plano de assinatura do usuário e os limites que ele impõe.
 *
 * IMPORTANTE — este módulo NÃO autoriza nada. Tudo que custa dinheiro (IA e armazenamento)
 * é barrado no servidor: cota de IA em `consumir_cota_ia()` (chamada de dentro das Edge
 * Functions) e limites estruturais em triggers de `membros`/`planos`/`arquivos`. O que está
 * aqui serve só para a UI: desabilitar botão, mostrar "3 de 10 restantes" e abrir o paywall
 * antes de o usuário bater a cabeça no erro. Um cliente adulterado que ignore estas funções
 * continua barrado pelo banco.
 *
 * Migration: `supabase/migrations/20260902120000_planos_e_limites.sql`.
 * Tabela de planos: seção 8 do `docs/project-context.md`.
 */

/**
 * Onde a assinatura Pro é de fato comprada — o app nunca cobra nada, só linka pra cá.
 * TODO: trocar pelo domínio definitivo quando a página de planos do site for publicada.
 */
export const WEBSITE_PRICING_URL = "https://studocore.app/planos";

export type Plano = "gratis" | "pro";

/** `null` em qualquer limite numérico significa ILIMITADO; `0` significa bloqueado no plano. */
export type LimitesDoPlano = {
    plano: Plano;
    rotulo: string;
    gruposMax: number | null;
    membrosPorGrupoMax: number | null;
    salaFocoMax: number | null;
    planosMax: number | null;
    quizIaPorDia: number | null;
    anexosIaPorMes: number | null;
    roadmapIaPorMes: number | null;
    chatIaPorMes: number | null;
    duelosCriadosPorDia: number | null;
    comparacaoPerfilCompleta: boolean;
    /** Janela que o plano VISUALIZA. A sessão nunca é apagada — só deixa de aparecer. */
    historicoDias: number | null;
    analisesDias: number | null;
    wrappedMensal: boolean;
    armazenamentoBytes: number | null;
    arquivoBytesMax: number | null;
};

export type UsoDoPlano = {
    quizHoje: number;
    anexosNoMes: number;
    roadmapsNoMes: number;
    chatNoMes: number;
    gruposAdministrados: number;
    planos: number;
    armazenamentoBytes: number;
};

export type EstadoDoPlano = {
    plano: Plano;
    limites: LimitesDoPlano;
    uso: UsoDoPlano;
};

/** Recursos com cota de IA — os mesmos aceitos por `consumir_cota_ia(p_tipo)` no banco. */
export type RecursoIA = "quiz" | "anexo" | "roadmap" | "chat";

/**
 * Recursos limitados por trigger. O nome bate com o sufixo da mensagem
 * `LIMITE_PLANO:<recurso>` que o Postgres devolve, para o app traduzir o erro em paywall.
 */
export type RecursoLimitado =
    | "grupos"
    | "membros_por_grupo"
    | "planos"
    | "armazenamento"
    | "tamanho_do_arquivo";

const LIMITES_GRATIS_FALLBACK: LimitesDoPlano = {
    plano: "gratis",
    rotulo: "Grátis",
    gruposMax: 3,
    membrosPorGrupoMax: 5,
    salaFocoMax: 12,
    planosMax: 3,
    quizIaPorDia: 1,
    anexosIaPorMes: 2,
    roadmapIaPorMes: 1,
    chatIaPorMes: 0,
    duelosCriadosPorDia: 1,
    comparacaoPerfilCompleta: false,
    historicoDias: 30,
    analisesDias: 7,
    wrappedMensal: false,
    armazenamentoBytes: 300 * 1024 * 1024,
    arquivoBytesMax: 25 * 1024 * 1024,
};

/** Linha de `planos_limites` como vem do banco (snake_case). */
type LinhaLimites = {
    plano: string;
    rotulo: string;
    grupos_max: number | null;
    membros_por_grupo_max: number | null;
    sala_foco_max: number | null;
    planos_max: number | null;
    quiz_ia_por_dia: number | null;
    anexos_ia_por_mes: number | null;
    roadmap_ia_por_mes: number | null;
    chat_ia_por_mes: number | null;
    duelos_criados_por_dia: number | null;
    comparacao_perfil_completa: boolean;
    historico_dias: number | null;
    analises_dias: number | null;
    wrapped_mensal: boolean;
    armazenamento_bytes: number | null;
    arquivo_bytes_max: number | null;
};

const paraLimites = (linha: LinhaLimites): LimitesDoPlano => ({
    plano: linha.plano === "pro" ? "pro" : "gratis",
    rotulo: linha.rotulo,
    gruposMax: linha.grupos_max,
    membrosPorGrupoMax: linha.membros_por_grupo_max,
    salaFocoMax: linha.sala_foco_max,
    planosMax: linha.planos_max,
    quizIaPorDia: linha.quiz_ia_por_dia,
    anexosIaPorMes: linha.anexos_ia_por_mes,
    roadmapIaPorMes: linha.roadmap_ia_por_mes,
    chatIaPorMes: linha.chat_ia_por_mes,
    duelosCriadosPorDia: linha.duelos_criados_por_dia,
    comparacaoPerfilCompleta: linha.comparacao_perfil_completa,
    historicoDias: linha.historico_dias,
    analisesDias: linha.analises_dias,
    wrappedMensal: linha.wrapped_mensal,
    armazenamentoBytes: linha.armazenamento_bytes,
    arquivoBytesMax: linha.arquivo_bytes_max,
});

/**
 * Estado completo do plano (limites + uso atual) numa chamada só, via RPC `uso_do_plano`.
 *
 * Falha de rede cai no plano Grátis com uso zerado, e não em Pro: se o app não sabe o
 * plano, a UI mostra os limites mais restritos e o servidor decide de verdade quando a
 * ação acontecer. O contrário deixaria o botão habilitado para depois estourar erro.
 */
export const buscarEstadoDoPlano = async (): Promise<EstadoDoPlano> => {
    /*
      O try/catch é essencial, não defensivo à toa: quem chama isso está no meio de um
      upload ou de uma sessão de foco, e uma falha ao LER o plano não pode derrubar a ação.
      Quem barra de verdade é o servidor, então cair no Grátis aqui só deixa a UI mais
      restrita — nunca libera nada.
    */
    let data: unknown = null;
    let error: unknown = null;
    try {
        ({ data, error } = await supabase.rpc("uso_do_plano"));
    } catch (erro) {
        error = erro;
    }

    if (error || !data) {
        console.warn("Falha ao ler o plano do usuário, assumindo Grátis:", error);
        return {
            plano: "gratis",
            limites: LIMITES_GRATIS_FALLBACK,
            uso: {
                quizHoje: 0,
                anexosNoMes: 0,
                roadmapsNoMes: 0,
                chatNoMes: 0,
                gruposAdministrados: 0,
                planos: 0,
                armazenamentoBytes: 0,
            },
        };
    }

    const bruto = data as {
        plano: string;
        limites: LinhaLimites;
        uso: Record<string, number>;
    };

    return {
        plano: bruto.plano === "pro" ? "pro" : "gratis",
        limites: paraLimites(bruto.limites),
        uso: {
            quizHoje: bruto.uso.quiz_hoje ?? 0,
            anexosNoMes: bruto.uso.anexos_no_mes ?? 0,
            roadmapsNoMes: bruto.uso.roadmaps_no_mes ?? 0,
            chatNoMes: bruto.uso.chat_no_mes ?? 0,
            gruposAdministrados: bruto.uso.grupos ?? 0,
            planos: bruto.uso.planos ?? 0,
            armazenamentoBytes: bruto.uso.armazenamento_bytes ?? 0,
        },
    };
};

/**
 * Limites de um plano qualquer — usado pela tela de plano para descrever o Pro para quem
 * ainda está no Grátis. Lê `planos_limites` direto (a tabela é legível por qualquer usuário
 * logado: é informação de produto), então o texto do paywall nunca desencontra da tabela.
 */
export const buscarLimitesDePlano = async (plano: Plano): Promise<LimitesDoPlano | null> => {
    try {
        const { data, error } = await supabase
            .from("planos_limites")
            .select("*")
            .eq("plano", plano)
            .single();

        if (error || !data) return null;
        return paraLimites(data as LinhaLimites);
    } catch {
        return null;
    }
};

/** Só o nome do plano, para telas que não precisam do uso detalhado. */
export const buscarPlano = async (): Promise<Plano> => {
    const { data, error } = await supabase.rpc("plano_do_usuario");
    if (error) {
        console.warn("Falha ao ler o plano do usuário, assumindo Grátis:", error);
        return "gratis";
    }
    return data === "pro" ? "pro" : "gratis";
};

/** `true` quando o limite é ilimitado (`null`) ou ainda há saldo. */
export const dentroDoLimite = (usado: number, limite: number | null): boolean =>
    limite === null || usado < limite;

/** Quanto sobrou; `null` quando ilimitado. */
export const restante = (usado: number, limite: number | null): number | null =>
    limite === null ? null : Math.max(0, limite - usado);

/**
 * Traduz o erro do Postgres em recurso, para o app abrir o paywall certo em vez de
 * mostrar mensagem crua de banco. Os triggers da migration levantam `LIMITE_PLANO:<recurso>`.
 */
export const recursoDoErroDeLimite = (erro: unknown): RecursoLimitado | null => {
    const mensagem = (erro as { message?: string } | null)?.message ?? "";
    const encontrado = mensagem.match(/LIMITE_PLANO:(\w+)/)?.[1];
    return (encontrado as RecursoLimitado) ?? null;
};

/**
 * Traduz qualquer erro de limite — trigger do Postgres ou 429 de Edge Function — no texto
 * que a tela mostra. Devolve `null` quando o erro não é de limite, e aí quem chamou segue
 * com o tratamento normal.
 *
 * É assíncrona porque o motivo real de um erro de `functions.invoke` não está na
 * `message` (que é sempre genérica): está no corpo da resposta, guardado em `context`.
 */
export const mensagemDeLimite = async (erro: unknown): Promise<string | null> => {
    // Caminho 1: trigger do banco, com `LIMITE_PLANO:<recurso>` na mensagem.
    const recurso = recursoDoErroDeLimite(erro);
    if (recurso) return MENSAGEM_DE_LIMITE[recurso];

    // Caminho 2: Edge Function devolvendo 429 (ver supabase/functions/_shared/cota.ts).
    try {
        const corpo = await (erro as any)?.context?.json?.();
        if (corpo?.error === "LIMITE_PLANO" && corpo?.recurso) {
            return MENSAGEM_DE_LIMITE[corpo.recurso as RecursoIA] ?? corpo.detalhe ?? null;
        }
    } catch {
        // Corpo não era JSON — não é erro de limite.
    }

    return null;
};

/**
 * Limites de LEITURA — travados no cliente (ver `hooks/usePlano.ts`), não no servidor,
 * porque o dado é do próprio usuário e o que o plano controla é o que a interface monta.
 */
export type RecursoDeLeitura = "historico" | "analises" | "comparacao_perfil" | "wrapped";

/** Mensagem de paywall por recurso — texto único, para não divergir entre as telas. */
export const MENSAGEM_DE_LIMITE: Record<RecursoLimitado | RecursoIA | RecursoDeLeitura, string> = {
    historico: "O plano Grátis mostra os últimos 30 dias. Suas sessões antigas continuam salvas — o Pro reabre o histórico inteiro.",
    analises: "Análises de 30 dias e do ano são do Pro. No Grátis você acompanha os últimos 7 dias.",
    comparacao_perfil: "A comparação completa de perfis é do Pro.",
    wrapped: "O Wrapped mensal é exclusivo do Pro.",
    grupos: "Você chegou ao limite de grupos do plano Grátis. Assine o Pro para criar grupos ilimitados.",
    membros_por_grupo: "Este grupo atingiu o limite de membros. O administrador precisa do Pro para abrir mais vagas.",
    planos: "Você chegou ao limite de planos de estudo. Assine o Pro para criar quantos quiser.",
    armazenamento: "Seu espaço acabou. Apague algum arquivo ou assine o Pro para ampliar o Cofre.",
    tamanho_do_arquivo: "Esse arquivo é grande demais. O limite por arquivo é 25 MB.",
    quiz: "Você já usou o quiz por IA de hoje. Assine o Pro para gerar quantos quiser.",
    anexo: "Você usou todas as análises de anexo do mês. Assine o Pro para ter 50 por mês.",
    roadmap: "Você usou seus planos de estudo por IA do mês. Assine o Pro para gerar mais.",
    chat: "O chat com o anexo é exclusivo do Pro.",
};
