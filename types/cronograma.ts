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

/** Uma matéria do plano, resumida pro chip do card ("Matemática", cor azul). */
export type MateriaResumoPlano = { nome: string; cor: string };

/** O próximo bloco de estudo não concluído do plano, já resolvido pro card da aba Roadmaps. */
export type ProximoBlocoPlano = {
    materia: string;
    materiaCor: string;
    topico: string | null;
    /** "hoje, 19:00" / "amanhã, 08:00" / "qua, 07:30" — já formatado pro card. */
    quando: string;
};

export type Plano = {
    id: string;
    nome: string;
    cor: string;
    qtdBlocos: number;
    duracaoTotal: string;
    agenda: AgendaPlano;
    /** Compartilhado no Explorar da Comunidade. */
    publico: boolean;
    /**
     * Plano de um roadmap de grupo por IA (canônico do admin ou cópia de um membro).
     * Os blocos dele ganham o toggle de "concluído" que alimenta o progresso coletivo.
     */
    roadmapDeGrupo: boolean;
    /** Plano gerado por IA (roadmap pessoal ou de grupo). Usado pela aba Roadmaps do Vault. */
    geradoPorIA: boolean;
    /** Nome de quem publicou o plano original — só quando este plano veio de "Importar" na Comunidade. */
    importadoDeNome: string | null;
    /** Matérias distintas dos blocos de estudo, na ordem em que aparecem no dia. */
    materias: MateriaResumoPlano[];
    /** Quantos blocos de estudo (não descanso) o dono já marcou como concluídos. */
    blocosConcluidos: number;
    /** Total de blocos de estudo — denominador de `blocosConcluidos` (qtdBlocos inclui descanso). */
    blocosEstudoTotal: number;
    /**
     * Só calculado quando o plano está fixado em dias (`agenda.tipo === "fixado"`) e tem
     * blocos com `dia_semana` — a estrutura por dia de um roadmap. Um plano manual, sem
     * dia por bloco, não tem um "próximo" único pra destacar (o bloco vale todo dia da
     * agenda), então fica `null`.
     */
    proximoBloco: ProximoBlocoPlano | null;
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
    publico: boolean;
    created_at: string;
    /** Planos de roadmap de grupo — ver migration 20260811090000_roadmap_ia.sql. */
    origem_grupo_id: string | null;
    origem_roadmap_plano_id: string | null;
    /** Plano gerado por IA (roadmap pessoal ou de grupo) — ver migration 20260813000000. */
    gerado_por_ia: boolean;
    /** Autor original, só na cópia que comunidade_importar_plano cria — ver migration 20260813000000. */
    importado_de_usuario_id: string | null;
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
    /**
     * Dia da semana em que SÓ este bloco vale (0 = segunda ... 6 = domingo). NULL = vale em
     * todos os dias da agenda do plano — o comportamento de sempre. É o que preserva a
     * estrutura por dia de um roadmap por IA (ex.: Matemática na segunda, Física na quarta).
     */
    dia_semana: number | null;
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
    /**
     * Opt-in do feed público (Comunidade → Explorar). Desligado, as fotos de sessão não
     * saem do grupo, mesmo com a sessão pública — `sessaoPublicaPadrao` é consentimento
     * de grupo, não de feed aberto.
     */
    feedPublico: boolean;
};
