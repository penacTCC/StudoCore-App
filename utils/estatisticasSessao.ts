import type { SessaoFocoRow, SessionCardItem } from "@/types/sessions";

/**
 * Questões de uma sessão vêm de duas fontes: o quiz pós-sessão gerado pela IA
 * (`questoes_respondidas`/`questoes_acertadas`) e os formulários externos anexados e
 * corrigidos pelo usuário (`questoes_externas`/`acertos_externos`).
 *
 * Elas ficam em colunas separadas pra tela de detalhes conseguir discriminar a origem
 * ("quiz: 8/10 · formulário: 24/28"), mas em qualquer lugar que mostre desempenho — a
 * faixa de stats, os cards do banco de dados, as Análises — o que vale é a soma: as duas
 * são questões que o aluno de fato respondeu.
 *
 * Anexo ainda não corrigido não entra em `questoes_externas` (ver
 * services/anexosSessao.ts -> recalcularQuestoesExternas), então nunca puxa a média
 * pra baixo antes do usuário informar como foi.
 */
type ComQuestoes = Pick<
    SessaoFocoRow | SessionCardItem,
    "questoes_respondidas" | "questoes_acertadas"
> & {
    questoes_externas?: number | null;
    acertos_externos?: number | null;
};

export const totalQuestoes = (sessao: ComQuestoes) =>
    (sessao.questoes_respondidas ?? 0) + (sessao.questoes_externas ?? 0);

export const totalAcertos = (sessao: ComQuestoes) =>
    (sessao.questoes_acertadas ?? 0) + (sessao.acertos_externos ?? 0);

/** Taxa de acerto em porcentagem inteira. Sem questões respondidas, devolve 0. */
export const taxaDeAcerto = (sessao: ComQuestoes) => {
    const respondidas = totalQuestoes(sessao);
    if (respondidas === 0) return 0;
    return Math.round((totalAcertos(sessao) / respondidas) * 100);
};
