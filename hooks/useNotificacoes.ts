import { useCallback, useEffect, useRef, useState } from "react";

import { buscarNotificacoes, marcarNotificacoesLidas } from "@/services/notificacoesComunidade";
import type { Notificacao } from "@/types/notificacoes";

/**
 * Estado da caixa de notificações: primeira página, scroll infinito e pull to refresh.
 *
 * Não passa pelo cache de navegação — a caixa é curta, muda a cada curtida e é aberta de
 * propósito, não de passagem.
 *
 * Abrir a tela marca tudo como lido no servidor, mas a LISTA guarda o que estava por ler
 * na entrada: some o badge (que já cumpriu o papel dele) e continua dando para ver, na
 * tela, quais são as novidades desta visita.
 */
export function useNotificacoes() {
    const [itens, setItens] = useState<Notificacao[]>([]);
    const [cursor, setCursor] = useState<string | null>(null);
    const [carregando, setCarregando] = useState(true);
    const [atualizando, setAtualizando] = useState(false);
    const [carregandoMais, setCarregandoMais] = useState(false);
    const [erro, setErro] = useState<unknown>(null);

    // Ids que chegaram por ler na PRIMEIRA carga; é o que pinta o destaque da linha
    // mesmo depois de o servidor já ter marcado tudo como lido.
    const novas = useRef<Set<string>>(new Set());

    const carregarPrimeiraPagina = useCallback(async (modo: "inicial" | "refresh") => {
        if (modo === "inicial") setCarregando(true);
        else setAtualizando(true);
        setErro(null);

        try {
            const pagina = await buscarNotificacoes();
            pagina.itens.forEach((item) => {
                if (!item.lida) novas.current.add(item.id);
            });
            setItens(pagina.itens);
            setCursor(pagina.proximoCursor);

            // Só depois de a lista estar na mão: se a busca falhar, o badge tem de
            // continuar lá para a pessoa tentar de novo.
            marcarNotificacoesLidas();
        } catch (e) {
            setErro(e);
        } finally {
            setCarregando(false);
            setAtualizando(false);
        }
    }, []);

    useEffect(() => {
        carregarPrimeiraPagina("inicial");
    }, [carregarPrimeiraPagina]);

    const carregarMais = useCallback(async () => {
        if (!cursor || carregandoMais || carregando || atualizando) return;

        setCarregandoMais(true);
        try {
            const pagina = await buscarNotificacoes(cursor);
            setItens((atuais) => {
                const vistos = new Set(atuais.map((item) => item.id));
                return [...atuais, ...pagina.itens.filter((item) => !vistos.has(item.id))];
            });
            setCursor(pagina.proximoCursor);
        } catch {
            // Falha em página seguinte não derruba o que já está na tela.
        } finally {
            setCarregandoMais(false);
        }
    }, [cursor, carregandoMais, carregando, atualizando]);

    return {
        itens,
        naoLidaNaEntrada: (id: string) => novas.current.has(id),
        carregando,
        atualizando,
        carregandoMais,
        temMais: cursor !== null,
        erro,
        atualizar: useCallback(() => carregarPrimeiraPagina("refresh"), [carregarPrimeiraPagina]),
        tentarDeNovo: useCallback(() => carregarPrimeiraPagina("inicial"), [carregarPrimeiraPagina]),
        carregarMais,
    };
}
