/** Uma questão do quiz pós-sessão, gerada pela IA ou vinda do banco genérico de fallback. */
export type QuizPergunta = {
    id: number;
    text: string;
    options: string[];
    correctAnswer: string;
    /** Presente nas perguntas geradas por IA — de qual matéria da execução ela é. */
    materia?: string;
};

/** Uma matéria estudada, para a Edge Function distribuir questões entre elas. */
export type QuizIAMateria = {
    materia: string;
    /** Opcional: sem ele a Edge Function gera sobre os temas centrais da matéria. */
    conteudo?: string | null;
    /** Usado só quando há mais de uma matéria, pra dar mais questões a quem estudou mais. */
    minutosEstudados?: number;
};

/** Parâmetros de contexto enviados à Edge Function para calibrar o quiz gerado por IA. */
export type QuizIAParametros = {
    materias: QuizIAMateria[];
    /** Total de questões a gerar, dividido entre as matérias. Padrão: 10 (limite: 15). */
    maxQuestoes?: number;
    idade: number | null;
    objetivo: string | null;
    nivelEnsino: string | null;
    ritmoEstudo: string | null;
    dificuldade: string | null;
};
