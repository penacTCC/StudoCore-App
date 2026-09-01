import { useMemo } from "react";
import { useDadosCache } from "@/hooks/useDadosCache";
import { buscarSessoesPeriodo, STATUS_SESSAO_FINALIZADA } from "@/services/sessions";
import { buscarGamificacao } from "@/services/gamificacao";
import { useMaterias } from "@/hooks/useMaterias";
import { calcularWrappedMensal } from "@/lib/analytics";
import { paraDataISO } from "@/utils/tempo";
import type { DadosWrapped } from "@/types/analytics";
import type { SessaoFocoRow } from "@/types/sessions";

function intervaloDoMes(ano: number, mes: number) {
    // O construtor de Date normaliza mes fora de 0-11 (ex.: -1 vira dezembro do ano
    // anterior), então isto também serve pra pegar o mês anterior sem lógica de virada.
    const inicio = new Date(ano, mes, 1);
    const fim = new Date(ano, mes + 1, 0);
    return { inicio: paraDataISO(inicio), fim: paraDataISO(fim) };
}

const finalizada = (s: SessaoFocoRow) => STATUS_SESSAO_FINALIZADA.includes(s.status);

/**
 * Números do "Wrapped de [mês]" (ver app/(modals)/wrapped-mensal.tsx) pro mês de
 * referência — por padrão o mês corrente de `dataReferencia` (o próprio chamador decide
 * se isso é "este mês" ou "o último mês fechado", passando a data certa).
 *
 * Busca as sessões finalizadas do mês e do mês anterior (só usado pra "vs. mês passado")
 * e delega toda a conta — horas, ofensiva, distribuição por matéria — pra
 * `calcularWrappedMensal`, que é pura e testável.
 */
export function useWrappedMensal(userId: string | null | undefined, dataReferencia: Date = new Date()) {
    const ano = dataReferencia.getFullYear();
    const mes = dataReferencia.getMonth();

    // Mesma fonte de cor por matéria usada no resto do app (perfil, planos, blocos) — ver
    // COR_MATERIA_PADRAO em lib/analytics.ts pro fallback de matéria sem registro aqui.
    const { materiasComCores } = useMaterias(userId ?? null);
    const corPorMateria = useMemo(
        () => Object.fromEntries(materiasComCores.map((m) => [m.nomeExibicao, m.cor])),
        [materiasComCores]
    );

    const { inicio, fim } = useMemo(() => intervaloDoMes(ano, mes), [ano, mes]);
    const { inicio: inicioAnterior, fim: fimAnterior } = useMemo(
        () => intervaloDoMes(ano, mes - 1),
        [ano, mes]
    );

    const { dados, carregando, erro, recarregar } = useDadosCache<{
        mes: SessaoFocoRow[];
        anterior: SessaoFocoRow[];
        melhorOfensivaGeral: number;
    }>(
        userId ? `wrapped-mensal:${userId}:${ano}-${mes}` : null,
        async () => {
            const [resMes, resAnterior, gamificacao] = await Promise.all([
                buscarSessoesPeriodo(userId!, inicio, fim),
                buscarSessoesPeriodo(userId!, inicioAnterior, fimAnterior),
                buscarGamificacao(userId!),
            ]);
            if (resMes.error) throw resMes.error;
            if (resAnterior.error) throw resAnterior.error;

            return {
                mes: (resMes.data ?? []).filter(finalizada),
                anterior: (resAnterior.data ?? []).filter(finalizada),
                melhorOfensivaGeral: gamificacao?.melhor_ofensiva ?? 0,
            };
        },
        { tempoFresco: 5 * 60_000 }
    );

    const wrapped = useMemo<DadosWrapped | null>(() => {
        if (!dados) return null;
        return calcularWrappedMensal(dados.mes, dados.anterior, {
            ano,
            mes,
            melhorOfensivaGeral: dados.melhorOfensivaGeral,
            corPorMateria,
        });
    }, [dados, ano, mes, corPorMateria]);

    return {
        wrapped,
        temSessoes: (dados?.mes.length ?? 0) > 0,
        loading: carregando,
        erro: dados ? null : erro,
        refresh: recarregar,
    };
}
