import { useSyncExternalStore } from 'react';
import { assinarConectividade, estaOnline } from '@/lib/network';

/** Reflete `lib/network.ts` num componente React; re-renderiza só quando o status muda. */
export function useNetworkStatus(): { online: boolean } {
    const online = useSyncExternalStore(assinarConectividade, estaOnline, estaOnline);
    return { online };
}
