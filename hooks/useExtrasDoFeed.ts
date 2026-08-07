import { useMemo } from "react";
import { buscarParticipantesDasSalas } from "@/services/sessions";
import type { ParticipanteResumido } from "@/types/sala";
import { assinarCaminhosDeFoto } from "@/services/fotosSessao";
import { useDadosCache } from "@/hooks/useDadosCache";
import type { SessaoFocoRow } from "@/types/sessions";

const SEM_PARTICIPANTES: ParticipanteResumido[] = [];
const SEM_MAPA = new Map<string, never>();

/**
 * Completa o feed com o que não cabe na linha de `sessoes_foco`: quem participou de cada
 * sessão e a URL assinada da foto.
 *
 * As duas coisas vêm em lote, uma chamada para a lista inteira. Buscar por card faria um
 * feed de vinte sessões abrir vinte queries e vinte assinaturas de URL — e o realtime do
 * grupo refaz esse feed a cada pausa de qualquer colega.
 *
 * Falhar aqui não derruba nada: sem participantes o card mostra só o autor, sem URL ele
 * fica sem miniatura. Nenhum dos dois é obrigatório para o card fazer sentido.
 */
export function useExtrasDoFeed(sessoes: SessaoFocoRow[]) {
    /*
      Chaves em string para o efeito não reagir à identidade nova do array a cada render.

      A pilha de avatares é indexada pela SALA, não pela sessão: os participantes pertencem
      ao encontro, e uma sessão de estudo solo simplesmente não tem sala (ver a migration
      `20260806140000_salas_foco.sql`).
    */
    const chaveIds = useMemo(
        () =>
            [...new Set(sessoes.map((sessao) => sessao.sala_id).filter(Boolean) as string[])]
                .sort()
                .join(","),
        [sessoes]
    );
    const chaveFotos = useMemo(
        () =>
            [...new Set(sessoes.map((sessao) => sessao.foto_path).filter(Boolean) as string[])]
                .sort()
                .join(","),
        [sessoes]
    );

    /*
      As duas buscas entram no cache pela própria chave de conteúdo.

      Isso importa mais aqui do que numa tela comum: o realtime do grupo refaz o feed a cada
      pausa de qualquer colega, e antes cada refação re-assinava todas as URLs de foto de
      novo. Com a chave sendo a lista de caminhos, um feed que não mudou não gera trabalho
      nenhum — e o mesmo vale para voltar à home.
    */
    const { dados: participantesPorSessao } = useDadosCache(
        chaveIds ? `participantes-salas:${chaveIds}` : null,
        () => buscarParticipantesDasSalas(chaveIds.split(",")),
        { tempoFresco: 30_000 }
    );

    const { dados: urlPorPath } = useDadosCache(
        chaveFotos ? `fotos-assinadas:${chaveFotos}` : null,
        () => assinarCaminhosDeFoto(chaveFotos.split(",")),
        // URL assinada tem validade; renovar de minuto em minuto sobra folga de sobra.
        { tempoFresco: 60_000 }
    );

    return useMemo(
        () => ({
            participantesDe: (sessao: SessaoFocoRow) =>
                (sessao.sala_id ? (participantesPorSessao ?? SEM_MAPA).get(sessao.sala_id) : null) ??
                SEM_PARTICIPANTES,
            fotoDe: (sessao: SessaoFocoRow) =>
                sessao.foto_path ? (urlPorPath ?? SEM_MAPA).get(sessao.foto_path) ?? null : null,
        }),
        [participantesPorSessao, urlPorPath]
    );
}
