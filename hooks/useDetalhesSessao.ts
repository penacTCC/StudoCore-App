import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";

import { fetchSessionById } from "@/services/sessions";
import { buscarAnotacoes } from "@/services/anotacoes";
import { buscarAnexosDaSessao } from "@/services/anexosSessao";
import { ANOTACOES_VAZIAS, type AnexoSessao, type AnotacoesSessao } from "@/types/anotacoes";
import type { SessaoFocoRow } from "@/types/sessions";

/**
 * Carrega tudo que a tela de detalhes da sessão precisa: a linha da sessão, as anotações e
 * os anexos.
 *
 * Relê ao ganhar foco porque a edição de anotações e a correção de um anexo acontecem em
 * modais empilhados por cima — sem isso, voltar pra cá mostraria o texto antigo.
 */
export const useDetalhesSessao = (sessaoId: string | null | undefined) => {
    const [sessao, setSessao] = useState<SessaoFocoRow | null>(null);
    const [anotacoes, setAnotacoes] = useState<AnotacoesSessao>(ANOTACOES_VAZIAS);
    const [anexos, setAnexos] = useState<AnexoSessao[]>([]);
    const [carregando, setCarregando] = useState(true);

    const carregar = useCallback(async () => {
        if (!sessaoId) {
            setCarregando(false);
            return;
        }

        const [resultadoSessao, anotacoesSalvas, anexosSalvos] = await Promise.all([
            fetchSessionById(sessaoId),
            buscarAnotacoes(sessaoId),
            buscarAnexosDaSessao(sessaoId),
        ]);

        if (resultadoSessao?.data) setSessao(resultadoSessao.data as SessaoFocoRow);
        setAnotacoes(anotacoesSalvas);
        setAnexos(anexosSalvos);
        setCarregando(false);
    }, [sessaoId]);

    useEffect(() => {
        setCarregando(true);
    }, [sessaoId]);

    useFocusEffect(
        useCallback(() => {
            carregar();
        }, [carregar])
    );

    return { sessao, anotacoes, anexos, carregando, recarregar: carregar, setAnexos };
};
