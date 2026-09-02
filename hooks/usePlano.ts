import { useCallback } from "react";

import { useDadosCache } from "@/hooks/useDadosCache";
import {
    buscarEstadoDoPlano,
    MENSAGEM_DE_LIMITE,
    type EstadoDoPlano,
    type LimitesDoPlano,
} from "@/services/assinatura";
import { paywallPro } from "@/services/paywall";

/**
 * Plano vigente + limites, para as telas que precisam ESCONDER ou TRAVAR algo.
 *
 * Diferente das cotas de IA e dos limites de criação — que são barrados no servidor — os
 * limites de leitura (histórico, análises, comparação de perfil, wrapped) são aplicados
 * aqui, no cliente. **Isso é um gate de produto, não uma fronteira de segurança:** os dados
 * são do próprio usuário e ele já tem permissão de lê-los; o que o plano controla é o que a
 * interface monta com eles. Quem quiser burlar consegue — e o custo disso é zero, porque
 * nada aqui gasta IA nem armazenamento.
 *
 * Enquanto o plano carrega, vale o Grátis (o fallback de `buscarEstadoDoPlano`): a tela
 * abre restrita e afrouxa, nunca o contrário — assim ninguém vê por um instante um gráfico
 * que vai sumir.
 */
export function usePlano() {
    const { dados, carregando, recarregar } = useDadosCache<EstadoDoPlano>(
        "plano:estado",
        buscarEstadoDoPlano,
        // Cota muda a cada uso de IA; nunca é fresca o bastante para pular a revalidação.
        { tempoFresco: 0 }
    );

    const limites = dados?.limites;
    const ehPro = dados?.plano === "pro";

    /** Avisa e leva para a tela de plano. Use no toque de um item travado. */
    const avisarLimite = useCallback((recurso: keyof typeof MENSAGEM_DE_LIMITE | string) => {
        const mensagem =
            MENSAGEM_DE_LIMITE[recurso as keyof typeof MENSAGEM_DE_LIMITE] ??
            "Esse recurso é exclusivo do plano Pro.";
        paywallPro.show({ recurso, mensagem });
    }, []);

    return {
        estado: dados,
        limites,
        ehPro,
        carregando,
        recarregar,
        avisarLimite,
    };
}

export type { LimitesDoPlano };
