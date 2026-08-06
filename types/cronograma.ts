export type TipoBloco = "estudo" | "descanso" | "outro";

/** Qual fonte colocou o bloco naquele dia (ver services/agenda.ts). */
export type OrigemBloco = "rotina" | "plano";

export type StatusBloco = "cumprido" | "parcial" | "furado" | "agora" | "futuro";

export type Bloco = {
    id: string;
    horaInicio: string; // "08:00"
    duracaoMin: number;
    tipo: TipoBloco;
    materia?: string;   
    topico?: string;
    cor?: string;
    notificar: boolean;
    /** Minutos de sobreposição com outro bloco. Ausente quando não há conflito. */
    sobrepoeMin?: number;
    /** Rótulo pronto do outro lado do conflito (matéria ou "Descanso"). Ausente quando não há conflito. */
    conflitaCom?: string;
};

/** Linha de rotina_semanal_blocos — chaves batem com as colunas da tabela. */
export type BlocoRotina = {
    id: string;
    usuario_id: string;
    dia_semana: number;
    hora_inicio: string; // "08:00"
    duracao_min: number;
    tipo: TipoBloco;
    materia_id: string | null;
    topico: string | null;
    notificar: boolean;
    antecedencia_min: number | null;
};

/** Payload de inserção — igual a BlocoRotina sem o id, que o Postgres gera. */
export type NovoBlocoRotina = Omit<BlocoRotina, "id">;

export type BlocoDoDia = Bloco & {
    status: StatusBloco;
    /** 0–100. Só usado quando status === "agora". */
    progresso?: number;
    restanteMin?: number;
    /** De onde esse bloco do dia veio — decide em qual FK gravar a sessão de foco. */
    origem?: "rotina" | "plano";
    /** Presente quando origem === "plano" — usado pra encadear a sessão pelos demais
     *  blocos do mesmo plano hoje (ver ItemFila em types/foco.ts). */
    planoId?: string;
};

export type AgendaPlano =
    | { tipo: "fixado"; dias: string[] }
    | { tipo: "data"; data: string }
    | { tipo: "nenhuma" };

export type Plano = {
    id: string;
    nome: string;
    cor: string;
    qtdBlocos: number;
    duracaoTotal: string;
    agenda: AgendaPlano;
};

/** Linha de `planos` — chaves batem com as colunas da tabela. */
export type PlanoRow = {
    id: string;
    usuario_id: string;
    nome: string;
    cor: string;
    agenda_tipo: "fixado" | "data" | "nenhuma";
    agenda_dias: number[] | null;
    agenda_data: string | null;
    created_at: string;
};

/** Resultado padronizado de operações do service de planos. */
export type ResultadoPlano = {
    sucesso: boolean;
    erro?: string;
    plano?: Plano;
};

/** Linha de planos_blocos — chaves batem com as colunas da tabela. */
export type BlocoPlano = {
    id: string;
    plano_id: string;
    hora_inicio: string; // "08:00"
    duracao_min: number;
    tipo: TipoBloco;
    materia_id: string | null;
    topico: string | null;
    notificar: boolean;
    antecedencia_min: number | null;
    /** Chave opaca compartilhada pelos blocos gerados de uma vez por uma sessão de pomodoros. NULL fora desse fluxo. */
    sessao_id: string | null;
};

/** Payload de inserção — igual a BlocoPlano sem o id, que o Postgres gera. */
export type NovoBlocoPlano = Omit<BlocoPlano, "id">;

export type BlocoSemana = {
    id: string;
    dia: number; // 0 = segunda
    /** Offset em minutos a partir do início da janela desenhada na grade. */
    inicioMin: number;
    duracaoMin: number;
    rotulo: string;
    cor: string;
    tipo: TipoBloco;
    /** De onde o bloco veio naquele dia. Bloco de plano não é editável na semana:
     *  ele pertence ao plano, não àquele dia. */
    origem: OrigemBloco;
};

export type AbaCronograma = "hoje" | "semana" | "planos";

export type VisualizacaoSemana = "calendario" | "blocos";

/** Bloco de estudo na visualização "Blocos" (lista por dia da semana). */
export type BlocoListaDia = {
    id: string;
    dia: number; // 0 = segunda
    materia: string;
    topico: string;
    horaInicio: string; // "18:30"
    duracaoRotulo: string;
    cor: string;
    tipo: TipoBloco;
    origem: OrigemBloco;
    /** Nome do plano que colocou esse bloco no dia. Só quando origem === "plano". */
    nomePlano?: string;
};

export type PreferenciasCronograma = {
    focoMin: number;
    descansoCurtoMin: number;
    descansoLongoMin: number;
    ciclosAteLongo: number;
    autoDescanso: boolean;
    autoFoco: boolean;
    notificacoesAtivas: boolean;
    antecedenciaMin: number;
    avisarFimDeFase: boolean;
    naoPerturbar: boolean;
    naoPerturbarInicio: string;
    naoPerturbarFim: string;
    /** Vale para todo o app: fim de fase do pomodoro e desbloqueio de medalha. */
    vibrar: boolean;
    manterTelaLigada: boolean;
    duracaoPadraoBlocoMin: number;
    duracaoPadraoDescansoMin: number;
    contarDescansoComoEstudado: boolean;
    /** Se ligado, o fim do quiz abre a etapa de anotações da sessão (pulável). */
    anotarAposQuiz: boolean;
    /** Se ligado, o fim da sessão oferece registrar uma foto do momento (pulável). */
    fotoAposSessao: boolean;
    /** Desligado, o usuário some do ranking dos grupos e da lista de quem está estudando. */
    aparecerNoRanking: boolean;
    /** Valor inicial do interruptor "sessão pública" ao montar uma sessão de foco. */
    sessaoPublicaPadrao: boolean;
};
