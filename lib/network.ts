/**
 * Estado de conectividade compartilhado, no mesmo espírito do `lib/cache.ts`: um único
 * listener do NetInfo por processo, com o valor atual acessível tanto de forma síncrona
 * (`estaOnline()`, pra services que precisam decidir sem esperar um render) quanto reativa
 * (`assinar`, usado pelo `hooks/useNetworkStatus.ts`).
 *
 * "Online" aqui exige as duas coisas que o NetInfo expõe: `isConnected` (tem rádio/rede
 * associada) e `isInternetReachable` (essa rede realmente sai pra internet). Um Wi-Fi sem
 * internet (portal cativo, roteador sem link) marca `isConnected: true` e
 * `isInternetReachable: false` — contar só o primeiro esconderia exatamente o cenário que
 * o usuário reportou.
 */
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

let online = true;
let inicializado = false;
const observadores = new Set<(online: boolean) => void>();

function calcularOnline(estado: NetInfoState): boolean {
    // `isInternetReachable` começa `null` até o NetInfo confirmar; nesse meio tempo,
    // confiar em `isConnected` evita mostrar o aviso de "sem conexão" no instante do
    // app abrindo, antes da primeira checagem real terminar.
    if (estado.isInternetReachable === null) return estado.isConnected ?? true;
    return !!estado.isConnected && estado.isInternetReachable;
}

function aplicar(estado: NetInfoState) {
    const novo = calcularOnline(estado);
    if (novo === online) return;
    online = novo;
    observadores.forEach((notificar) => notificar(online));
}

function garantirInicializado() {
    if (inicializado) return;
    inicializado = true;
    NetInfo.fetch().then(aplicar);
    NetInfo.addEventListener(aplicar);
}

/** Leitura síncrona do estado atual — para código fora de componentes React. */
export function estaOnline(): boolean {
    garantirInicializado();
    return online;
}

/** Usado pelo `useNetworkStatus`; dispara `notificar` a cada mudança de online/offline. */
export function assinarConectividade(notificar: (online: boolean) => void): () => void {
    garantirInicializado();
    observadores.add(notificar);
    return () => observadores.delete(notificar);
}
