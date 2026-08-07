import { useCallback, useRef, useSyncExternalStore } from 'react';
import { useFocusEffect } from 'expo-router';
import {
    buscaTravada,
    buscarNoCache,
    definirCache,
    lerCache,
    observarCache,
    semearCache,
    TEMPO_FRESCO_PADRAO,
} from '@/lib/cache';

type Opcoes = {
    /**
     * Por quanto tempo (ms) o dado guardado é considerado novo o bastante para nem
     * revalidar ao focar a tela. Aumente para dado que muda pouco (perfil, matérias),
     * diminua para dado vivo (feed, ranking).
     */
    tempoFresco?: number;
    /** Passe `false` para buscar só na montagem e não a cada foco da tela. */
    revalidarAoFocar?: boolean;
};

export type ResultadoCache<T> = {
    dados: T | undefined;
    /** Só é `true` no primeiro carregamento, quando não há nada em cache para mostrar. */
    carregando: boolean;
    /** Há uma revalidação em segundo plano com dado antigo já na tela. */
    revalidando: boolean;
    erro: unknown;
    /** Força uma busca ignorando o tempo fresco. Devolve a promise (útil no pull-to-refresh). */
    recarregar: () => Promise<T | undefined>;
    /** Sobrescreve o valor em cache localmente, sem ir à rede. */
    definir: (dados: T) => void;
    /** Preenche a chave só se ela ainda estiver vazia; a rede sempre tem a palavra final. */
    semear: (dados: T) => void;
};

/**
 * Lê uma chave do cache stale-while-revalidate e mantém a tela sincronizada com ela.
 *
 * O ganho de UX está na separação entre `carregando` e `revalidando`: renderize skeleton
 * só com `carregando`. Na segunda visita à tela o dado guardado aparece instantaneamente
 * e a busca acontece por trás.
 *
 * Passe `chave` nula enquanto as dependências não estiverem prontas (o `userId` ainda
 * chegando, por exemplo) — o hook fica inerte até haver chave.
 */
export function useDadosCache<T>(
    chave: string | null,
    buscar: () => Promise<T>,
    opcoes: Opcoes = {}
): ResultadoCache<T> {
    const { tempoFresco = TEMPO_FRESCO_PADRAO, revalidarAoFocar = true } = opcoes;

    // A função de busca costuma ser recriada a cada render da tela. Guardá-la numa ref
    // evita que isso vire um disparo de rede a cada render.
    const buscarRef = useRef(buscar);
    buscarRef.current = buscar;

    const inscrever = useCallback(
        (notificar: () => void) => (chave ? observarCache(chave, notificar) : () => {}),
        [chave]
    );

    const estado = useSyncExternalStore(
        inscrever,
        () => (chave ? lerCache<T>(chave) : VAZIO),
        () => (chave ? lerCache<T>(chave) : VAZIO)
    );

    const recarregar = useCallback(async () => {
        if (!chave) return undefined;
        return buscarNoCache<T>(chave, () => buscarRef.current());
    }, [chave]);

    useFocusEffect(
        useCallback(() => {
            if (!chave) return;

            const { gravadoEm, buscando } = lerCache<T>(chave);
            const naoTemNada = gravadoEm === 0;
            const venceu = Date.now() - gravadoEm > tempoFresco;

            // Sair daqui por causa de uma busca em andamento só faz sentido enquanto ela
            // ainda pode responder. Uma busca travada precisa ser insistida — é o que tira
            // a tela do skeleton quando a anterior se perdeu na rede.
            if (buscando && !buscaTravada(chave)) return;
            if (naoTemNada || (revalidarAoFocar && venceu)) {
                // A falha já fica registrada em `erro`; o catch aqui só evita rejeição solta.
                buscarNoCache<T>(chave, () => buscarRef.current()).catch(() => {});
            }
        }, [chave, tempoFresco, revalidarAoFocar])
    );

    const definir = useCallback(
        (dados: T) => {
            if (chave) definirCache(chave, dados);
        },
        [chave]
    );

    const semear = useCallback(
        (dados: T) => {
            if (chave) semearCache(chave, dados);
        },
        [chave]
    );

    const temDados = estado.gravadoEm > 0;

    return {
        dados: estado.dados,
        carregando: !temDados && (estado.buscando || (!!chave && !estado.erro)),
        revalidando: temDados && estado.buscando,
        erro: estado.erro,
        recarregar,
        definir,
        semear,
    };
}

const VAZIO = Object.freeze({
    dados: undefined,
    erro: null,
    gravadoEm: 0,
    buscando: false,
    buscandoDesde: 0,
}) as ReturnType<typeof lerCache<never>>;
