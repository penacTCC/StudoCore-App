export type TipoBloco = "estudo" | "descanso" | "outro";

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
    /** Offset em minutos a partir das 8h — a grade começa às 8h. */
    inicioMin: number;
    duracaoMin: number;
    rotulo: string;
    cor: string;
    tipo: TipoBloco;
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
    resumoDiaSeguinte: boolean;
    naoPerturbar: boolean;
    naoPerturbarInicio: string;
    naoPerturbarFim: string;
    somFimFoco: boolean;
    vibrar: boolean;
    manterTelaLigada: boolean;
    inicioSemana: "domingo" | "segunda";
    duracaoPadraoBlocoMin: number;
    duracaoPadraoDescansoMin: number;
    contarDescansoComoEstudado: boolean;
};
