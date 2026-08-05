import type { ItemFila } from "@/types/foco";

export type SessaoFocoInsert = {
    user_id: string;
    grupo_id?: string | null;
    disciplina: string;
    conteudo_especifico: string;
    tempo_minutos: number;
    questoes_respondidas: number;
    questoes_acertadas: number;
    /** Questões vindas de formulários externos anexados e já corrigidos (ver
     *  utils/estatisticasSessao.ts) — somadas às do quiz em qualquer exibição de desempenho. */
    questoes_externas?: number | null;
    acertos_externos?: number | null;
    is_public: boolean;
    status: string;
    ultimo_inicio: string | null;
    concluido_em: string | null;
    /** Preenchido quando a sessão começa a partir de um bloco da aba Hoje. */
    bloco_rotina_id?: string | null;
    bloco_plano_id?: string | null;
    /** Plano do qual essa matéria faz parte, quando a sessão veio de um bloco de plano. */
    plano_id?: string | null;
    /** Presente quando esta linha é uma das matérias de um encadeamento de plano com mais
     *  de uma matéria — todas as linhas da mesma execução compartilham o mesmo valor, pra
     *  o feed compilar numa única sessão (ver services/sessions.ts). */
    execucao_id?: string | null;
    /** "cronometro" | "pomodoro" — como esta sessão conta o tempo. */
    modo?: string | null;
    /** Cronograma publicado da sessão (focos e descansos), lido por todos os participantes
     *  para ficarem na mesma fase sem depender de aviso do anfitrião. */
    fila?: ItemFila[] | null;
    /** Instante em que o primeiro item da fila começou. */
    fila_inicio_em?: string | null;
};

export type SessaoFocoRow = {
    id: string;
    user_id: string;
    grupo_id?: string | null;
    disciplina: string;
    conteudo_especifico: string | null;
    tempo_minutos: number;
    questoes_respondidas: number;
    questoes_acertadas: number;
    /** Questões vindas de formulários externos anexados e já corrigidos (ver
     *  utils/estatisticasSessao.ts) — somadas às do quiz em qualquer exibição de desempenho. */
    questoes_externas?: number | null;
    acertos_externos?: number | null;
    is_public: boolean;
    status: string;
    data_sessao: string;
    created_at: string;
    bloco_rotina_id?: string | null;
    bloco_plano_id?: string | null;
    plano_id?: string | null;
    execucao_id?: string | null;
    modo?: string | null;
    fila?: ItemFila[] | null;
    fila_inicio_em?: string | null;
    concluido_em: string | null;
    ultimo_inicio: string | null;
    destaque?: boolean;
    materiasCompiladas?: number;
    // Vem do JOIN com profiles
    profiles?: {
        nome_real: string | null;
        nome_usuario: string | null;
        foto_usuario: string | null;
    };
};

// Interface compatível com a linha do Supabase + JOIN profiles
export type SessionCardItem = {
    id: string;
    user_id: string;
    grupo_id?: string | null;
    disciplina: string;
    conteudo_especifico: string | null;
    tempo_minutos: number;
    questoes_respondidas: number;
    questoes_acertadas: number;
    /** Questões vindas de formulários externos anexados e já corrigidos (ver
     *  utils/estatisticasSessao.ts) — somadas às do quiz em qualquer exibição de desempenho. */
    questoes_externas?: number | null;
    acertos_externos?: number | null;
    is_public: boolean;
    data_sessao: string;
    status: string;
    created_at: string;
    concluido_em: string | null;
    ultimo_inicio: string | null;
    execucao_id?: string | null;
    /** Origem da sessão no cronograma de quem a criou. Quem entra numa sessão em grupo
     *  olha estes campos para saber se as matérias já estão definidas pelo anfitrião. */
    bloco_rotina_id?: string | null;
    bloco_plano_id?: string | null;
    plano_id?: string | null;
    modo?: string | null;
    /** Cronograma compartilhado da sessão — é dele que os participantes derivam a fase
     *  atual do pomodoro em grupo (ver utils/pomodoroSequence.ts -> posicaoNaFila). */
    fila?: ItemFila[] | null;
    fila_inicio_em?: string | null;
    /** Presente só nos cards compilados pelo feed (várias matérias de uma mesma execução
     *  de plano viraram um card só) — número de matérias combinadas. */
    materiasCompiladas?: number;
    /** Marcado pelo feed quando a sessão passou dos 70% de acerto no quiz. Antes isso era
     *  um filtro que escondia todas as outras sessões do grupo (ver services/sessions.ts). */
    destaque?: boolean;
    profiles?: {
        nome_real: string | null;
        nome_usuario: string | null;
        foto_usuario: string | null;
    };
}

export type SessionCardProps = {
    session: SessionCardItem;
    colorIndex: number;
}

export type MemberSession = {
    sessao_id: string;
    membro_id: string;
    funcao: "anfitriao" | "membro";
    ultimo_inicio: string | null;
    tempo_segundos: number;
    status: "ativo" | "pausado" | "concluido";
    profiles?: {
        nome_usuario?: string | null;
        nome_real?: string | null;
        foto_usuario?: string | null;
    };
    sessoes_foco?: {
        disciplina?: string;
        conteudo_especifico?: string | null;
        tempo_minutos?: number;
        status?: string;
        concluido_em?: string | null;
        ultimo_inicio?: string | null;
    };
}