import { contarEstudandoAgora } from "@/services/onlineUsers";
import { useDadosCache } from "@/hooks/useDadosCache";

/**
 * Quantas pessoas estão estudando agora NO APP INTEIRO — só o número, para o card de
 * `browse-groups.tsx`.
 *
 * É uma contagem agregada cacheada, não uma sala de Presence: essa era a única leitura
 * que precisava do app inteiro (as outras telas só olham "quem do meu grupo está online",
 * ver hooks/useOnlineUsers.ts), e uma sala global de Presence para servir só uma contagem
 * era o principal ponto de custo O(N²) do app perto de 200 usuários simultâneos.
 */
export const useEstudandoAgora = () => {
    const { dados } = useDadosCache<number>("estudando-agora", contarEstudandoAgora, {
        tempoFresco: 30_000,
    });

    return dados ?? 0;
};
