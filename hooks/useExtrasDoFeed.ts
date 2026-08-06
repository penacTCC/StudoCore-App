import { useEffect, useMemo, useState } from "react";
import { buscarParticipantesDasSalas } from "@/services/sessions";
import type { ParticipanteResumido } from "@/types/sala";
import { assinarCaminhosDeFoto } from "@/services/fotosSessao";
import type { SessaoFocoRow } from "@/types/sessions";

const SEM_PARTICIPANTES: ParticipanteResumido[] = [];

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
    const [participantesPorSessao, setParticipantesPorSessao] = useState<
        Map<string, ParticipanteResumido[]>
    >(new Map());
    const [urlPorPath, setUrlPorPath] = useState<Map<string, string>>(new Map());

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

    useEffect(() => {
        let cancelado = false;
        const ids = chaveIds ? chaveIds.split(",") : [];

        if (ids.length === 0) {
            setParticipantesPorSessao(new Map());
            return;
        }

        buscarParticipantesDasSalas(ids).then((mapa) => {
            if (!cancelado) setParticipantesPorSessao(mapa);
        });

        return () => {
            cancelado = true;
        };
    }, [chaveIds]);

    useEffect(() => {
        let cancelado = false;
        const caminhos = chaveFotos ? chaveFotos.split(",") : [];

        if (caminhos.length === 0) {
            setUrlPorPath(new Map());
            return;
        }

        assinarCaminhosDeFoto(caminhos).then((mapa) => {
            if (!cancelado) setUrlPorPath(mapa);
        });

        return () => {
            cancelado = true;
        };
    }, [chaveFotos]);

    return useMemo(
        () => ({
            participantesDe: (sessao: SessaoFocoRow) =>
                (sessao.sala_id ? participantesPorSessao.get(sessao.sala_id) : null) ?? SEM_PARTICIPANTES,
            fotoDe: (sessao: SessaoFocoRow) =>
                sessao.foto_path ? urlPorPath.get(sessao.foto_path) ?? null : null,
        }),
        [participantesPorSessao, urlPorPath]
    );
}
