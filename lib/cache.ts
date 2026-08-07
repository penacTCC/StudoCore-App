/**
 * Cache stale-while-revalidate compartilhado entre telas.
 *
 * O problema que isto resolve: cada tela guardava o resultado da busca no próprio
 * `useState`, que nasce vazio a cada montagem. Voltar para uma aba visitada há cinco
 * segundos zerava tudo e mostrava skeleton de novo enquanto a rede respondia.
 *
 * Aqui o último resultado de cada chave fica em memória, fora do ciclo de vida dos
 * componentes. A tela renderiza o dado guardado na hora (sem skeleton) e a revalidação
 * acontece em segundo plano — o skeleton só aparece quando realmente não há nada.
 *
 * O cache é só de memória, de propósito: ele morre quando o app morre. A intenção é
 * cobrir a navegação dentro de uma sessão de uso, não persistir dado desatualizado
 * entre aberturas do app.
 */

/** Quanto tempo um dado é considerado novo o bastante para nem revalidar. */
export const TEMPO_FRESCO_PADRAO = 30_000;

/** Idade a partir da qual uma entrada sem ninguém observando pode ser descartada. */
const TEMPO_MAXIMO = 10 * 60_000;

/** Acima disto, uma gravação dispara a limpeza das entradas velhas e sem observadores. */
const LIMITE_ENTRADAS = 80;

/**
 * A partir de quanto tempo uma busca "em andamento" é dada como perdida.
 *
 * Fica acima do tempo limite das requisições (`lib/supabase.ts`), de propósito: no caminho
 * normal é o fetch que desiste primeiro e devolve um erro de verdade. Isto aqui é a rede de
 * segurança para a promise que não resolve nem rejeita por qualquer outro motivo — sem ela,
 * a chave ficava marcada como `buscando` para sempre e a tela nunca saía do skeleton.
 */
export const TEMPO_LIMITE_BUSCA = 30_000;

export type EstadoCache<T> = {
    dados: T | undefined;
    erro: unknown;
    /** Timestamp da última gravação bem-sucedida. 0 = nunca carregou. */
    gravadoEm: number;
    /** Há uma busca em andamento para esta chave. */
    buscando: boolean;
    /** Quando a busca em andamento começou. 0 quando não há busca. */
    buscandoDesde: number;
};

/**
 * Estado devolvido para chaves que nunca foram buscadas. É uma constante compartilhada
 * porque `useSyncExternalStore` exige que o snapshot seja estável entre renders — devolver
 * um objeto novo a cada chamada causaria loop infinito de render.
 */
const VAZIO: EstadoCache<never> = Object.freeze({
    dados: undefined,
    erro: null,
    gravadoEm: 0,
    buscando: false,
    buscandoDesde: 0,
});

const entradas = new Map<string, EstadoCache<unknown>>();
const observadores = new Map<string, Set<() => void>>();

/**
 * Buscas em andamento, por chave. Se três componentes pedirem a mesma chave no mesmo
 * instante, todos compartilham a mesma promise em vez de disparar três requisições.
 */
const emVoo = new Map<string, Promise<unknown>>();

/**
 * Contador por chave usado como trava contra race condition. Toda gravação carrega o
 * número da busca que a originou; se outra busca mais nova já começou, o resultado velho
 * é descartado em vez de sobrescrever o novo. Sem isto, uma resposta lenta disparada
 * antes podia chegar depois e reverter a tela para um dado antigo.
 */
const geracao = new Map<string, number>();

function avisar(chave: string) {
    const inscritos = observadores.get(chave);
    if (!inscritos) return;
    for (const notificar of inscritos) notificar();
}

function gravar<T>(chave: string, estado: EstadoCache<T>) {
    entradas.set(chave, estado as EstadoCache<unknown>);
    avisar(chave);
}

export function lerCache<T>(chave: string): EstadoCache<T> {
    return (entradas.get(chave) as EstadoCache<T> | undefined) ?? (VAZIO as EstadoCache<T>);
}

/**
 * Uma busca marcada como em andamento há tempo demais é tratada como perdida.
 * Ver `TEMPO_LIMITE_BUSCA`.
 */
export function buscaTravada(chave: string): boolean {
    const { buscando, buscandoDesde } = lerCache(chave);
    return buscando && Date.now() - buscandoDesde > TEMPO_LIMITE_BUSCA;
}

export function observarCache(chave: string, notificar: () => void): () => void {
    let inscritos = observadores.get(chave);
    if (!inscritos) {
        inscritos = new Set();
        observadores.set(chave, inscritos);
    }
    inscritos.add(notificar);

    return () => {
        inscritos!.delete(notificar);
        if (inscritos!.size === 0) observadores.delete(chave);
    };
}

/**
 * Descarta entradas velhas que ninguém está observando. Chamado nas gravações, e só
 * quando o cache passa do limite — a navegação normal nunca paga esse custo.
 */
function limpar() {
    if (entradas.size <= LIMITE_ENTRADAS) return;

    const agora = Date.now();
    for (const [chave, estado] of entradas) {
        if (observadores.has(chave)) continue;
        if (emVoo.has(chave)) continue;
        if (agora - estado.gravadoEm < TEMPO_MAXIMO) continue;
        entradas.delete(chave);
    }
}

/**
 * Executa a busca e grava o resultado, respeitando dedupe e a trava de geração.
 * Devolve a promise em andamento para quem quiser esperar (pull-to-refresh, por exemplo).
 */
export function buscarNoCache<T>(chave: string, buscar: () => Promise<T>): Promise<T> {
    // Uma busca dentro do prazo é reaproveitada; uma travada é abandonada e refeita.
    // Abandonar é seguro: a busca nova avança a geração, então o resultado da velha é
    // descartado se ainda chegar, e o `finally` dela compara identidade antes de mexer
    // no dedupe — não vai derrubar a substituta.
    const jaEmVoo = emVoo.get(chave) as Promise<T> | undefined;
    if (jaEmVoo && !buscaTravada(chave)) return jaEmVoo;

    const minhaGeracao = (geracao.get(chave) ?? 0) + 1;
    geracao.set(chave, minhaGeracao);

    const anterior = lerCache<T>(chave);
    gravar<T>(chave, { ...anterior, buscando: true, buscandoDesde: Date.now() });

    // A promise precisa se referenciar no `finally` para só limpar a si mesma; o objeto
    // intermediário existe porque a referência ainda não está atribuída ali dentro.
    const emAndamento: { promise?: Promise<T> } = {};

    emAndamento.promise = (async () => {
        try {
            const dados = await buscar();
            // Chegou tarde: outra busca mais nova já assumiu esta chave.
            if (geracao.get(chave) !== minhaGeracao) return dados;

            gravar<T>(chave, {
                dados,
                erro: null,
                gravadoEm: Date.now(),
                buscando: false,
                buscandoDesde: 0,
            });
            limpar();
            return dados;
        } catch (erro) {
            if (geracao.get(chave) === minhaGeracao) {
                // O dado anterior é preservado: uma falha de rede não deve esvaziar a tela.
                gravar<T>(chave, {
                    ...lerCache<T>(chave),
                    erro,
                    buscando: false,
                    buscandoDesde: 0,
                });
            }
            throw erro;
        } finally {
            if (emVoo.get(chave) === emAndamento.promise) emVoo.delete(chave);
        }
    })();

    emVoo.set(chave, emAndamento.promise);
    return emAndamento.promise;
}

/** Escreve um valor no cache sem passar pela rede (uso pós-mutação, atualização otimista). */
export function definirCache<T>(chave: string, dados: T) {
    geracao.set(chave, (geracao.get(chave) ?? 0) + 1);

    /*
      A busca em andamento (se houver) acabou de ser invalidada pela nova geração: o
      resultado dela será descartado na chegada. Tirá-la do dedupe aqui é o que garante que
      um `recarregar()` logo após a escrita comece uma busca de verdade — senão ele se
      juntaria a essa requisição condenada e a tela nunca receberia o dado novo do servidor.
    */
    emVoo.delete(chave);

    gravar<T>(chave, {
        dados,
        erro: null,
        gravadoEm: Date.now(),
        buscando: false,
        buscandoDesde: 0,
    });
}

/**
 * Preenche uma chave apenas se ela ainda estiver vazia, sem invalidar busca em andamento.
 *
 * Existe para dado que vem de uma fonte local mais lenta que a memória mas mais rápida que
 * a rede — o cache em disco da agenda, por exemplo. Diferente de `definirCache`, não
 * avança a geração: se a resposta da rede já chegou (ou chegar no meio do caminho), é ela
 * que vale, e a semente é descartada.
 */
export function semearCache<T>(chave: string, dados: T) {
    const anterior = lerCache<T>(chave);
    if (anterior.gravadoEm !== 0) return;
    gravar<T>(chave, {
        dados,
        erro: null,
        gravadoEm: Date.now(),
        // A busca em andamento (se houver) segue valendo, com o relógio dela intacto.
        buscando: anterior.buscando,
        buscandoDesde: anterior.buscandoDesde,
    });
}

/**
 * Marca chaves como vencidas para que a próxima montagem/foco revalide.
 * Sem argumento invalida tudo; com string, invalida toda chave que começa com ela
 * (`invalidarCache('perfil:')` derruba o perfil de todos os usuários em cache).
 */
export function invalidarCache(prefixo?: string) {
    for (const [chave, estado] of entradas) {
        if (prefixo && !chave.startsWith(prefixo)) continue;
        gravar(chave, { ...estado, gravadoEm: 0 });
    }
}

/** Remove entradas do cache por completo. Usado no logout, para não vazar dado entre contas. */
export function limparCache(prefixo?: string) {
    // As chaves vêm dos dois mapas: uma busca disparada e ainda sem resposta não tem entrada
    // em `entradas`, mas precisa igualmente sair do dedupe. Sem isso, a promise ficava órfã
    // em `emVoo` — a geração nova já a condenava a nunca gravar — e a próxima conta que
    // pedisse a mesma chave recebia essa promise morta e travava no skeleton.
    for (const chave of new Set([...entradas.keys(), ...emVoo.keys()])) {
        if (prefixo && !chave.startsWith(prefixo)) continue;
        entradas.delete(chave);
        emVoo.delete(chave);
        geracao.set(chave, (geracao.get(chave) ?? 0) + 1);
        avisar(chave);
    }
}
