import { contarSessoesPendentes } from "@/services/sessions";

/**
 * Contador global de formulários de sessão em aberto.
 *
 * O badge mora na tab bar, que não é uma tela e não roda os hooks de sessão de ninguém.
 * Em vez de dar a ele uma busca própria a cada troca de aba, o número fica aqui e é
 * atualizado por quem já lê as sessões do usuário de qualquer jeito (o `useSessoesUsuario`
 * do Foco e do Análise). Assim, responder um formulário some com o badge na mesma hora
 * em que a tela recarrega.
 */

type Listener = (contagem: number) => void;

const listeners = new Set<Listener>();
let contagem = 0;

/** Chamado por quem já buscou as sessões do usuário e sabe quantas estão pendentes. */
export function definirFormulariosPendentes(valor: number) {
    if (valor === contagem) return;
    contagem = valor;
    listeners.forEach((listener) => listener(contagem));
}

export function obterFormulariosPendentes() {
    return contagem;
}

export function assinarFormulariosPendentes(listener: Listener) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/**
 * Busca a contagem no banco. Usado só na primeira carga da tab bar, antes de o usuário
 * abrir alguma tela que já traga as sessões.
 */
export async function carregarFormulariosPendentes(userId: string) {
    const { count, error } = await contarSessoesPendentes(userId);
    if (error) {
        console.error("Erro ao contar formulários pendentes:", error);
        return;
    }
    definirFormulariosPendentes(count ?? 0);
}
