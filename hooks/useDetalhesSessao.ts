import { fetchSessionById } from "@/services/sessions";
import { buscarAnotacoes } from "@/services/anotacoes";
import { buscarAnexosDaSessao } from "@/services/anexosSessao";
import { useDadosCache } from "@/hooks/useDadosCache";
import { ANOTACOES_VAZIAS, type AnexoSessao } from "@/types/anotacoes";
import type { SessaoFocoRow } from "@/types/sessions";

const SEM_ANEXOS: AnexoSessao[] = [];

/**
 * Carrega tudo que a tela de detalhes da sessão precisa: a linha da sessão, as anotações e
 * os anexos.
 *
 * Relê ao ganhar foco (`tempoFresco: 0`) porque a edição de anotações e a correção de um
 * anexo acontecem em modais empilhados por cima — sem isso, voltar pra cá mostraria o texto
 * antigo. A diferença é que agora o conteúdo anterior fica na tela durante a releitura, em
 * vez de a tela voltar ao skeleton toda vez que um modal é fechado.
 */
export const useDetalhesSessao = (sessaoId: string | null | undefined) => {
    const { dados, carregando, erro, recarregar } = useDadosCache(
        sessaoId ? `detalhes-sessao:${sessaoId}` : null,
        async () => {
            const [resultadoSessao, anotacoesSalvas, anexosSalvos] = await Promise.all([
                fetchSessionById(sessaoId!),
                buscarAnotacoes(sessaoId!),
                buscarAnexosDaSessao(sessaoId!),
            ]);

            return {
                sessao: (resultadoSessao?.data as SessaoFocoRow | null) ?? null,
                anotacoes: anotacoesSalvas,
                anexos: anexosSalvos,
            };
        },
        { tempoFresco: 0 }
    );

    return {
        sessao: dados?.sessao ?? null,
        anotacoes: dados?.anotacoes ?? ANOTACOES_VAZIAS,
        anexos: dados?.anexos ?? SEM_ANEXOS,
        carregando,
        erro: dados ? null : erro,
        recarregar,
    };
};
