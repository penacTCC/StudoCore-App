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
    /** Minutos de sobreposição com o bloco anterior. Ausente quando não há conflito. */
    sobrepoeMin?: number;
};

export type BlocoDoDia = Bloco & {
    status: StatusBloco;
    /** 0–100. Só usado quando status === "agora". */
    progresso?: number;
    restanteMin?: number;
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

export type BlocoSemana = {
    id: string;
    dia: number; // 0 = segunda
    /** Offset em minutos a partir das 8h — a grade começa às 8h. */
    inicioMin: number;
    duracaoMin: number;
    rotulo: string;
    cor: string;
};

export type AbaCronograma = "hoje" | "semana" | "planos";

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
    contarDescansoComoEstudado: false;
};
