/**
 * Regras de janela do Wrapped mensal — quando ele existe e quando pode ser visto.
 *
 * Compartilhado entre a tela (app/(modals)/wrapped-mensal.tsx), o hook de abertura
 * automática, o lembrete por push e o banner de entrada (perfil), pra não ter a regra
 * "só nos 3 primeiros dias" duplicada em lugares que podem sair de sincronia.
 */

/** Até que dia do mês o Wrapped do mês fechado fica acessível. */
export const DIAS_JANELA_WRAPPED = 3;

/**
 * Mês de referência do Wrapped: o último mês fechado, não o corrente — no dia 1 de
 * setembro o "Wrapped de Agosto" é o que faz sentido mostrar, já que setembro mal começou.
 * `new Date(ano, mesAtual - 1, 1)` é normalizado pelo próprio construtor (mês -1 vira
 * dezembro do ano anterior), então isso também cobre a virada de ano sem lógica extra.
 */
export function mesFechadoAnterior(agora: Date = new Date()): Date {
    return new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
}

/** Se hoje ainda está dentro da janela de acesso ao Wrapped do mês fechado. */
export function estaNaJanelaDoWrapped(agora: Date = new Date()): boolean {
    return agora.getDate() <= DIAS_JANELA_WRAPPED;
}
