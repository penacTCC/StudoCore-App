import { useCallback, useEffect, useRef, useState } from "react";

import { alternarCurtida, bloquearAutor, buscarFeedComunidade } from "@/services/comunidade";
import { toast } from "@/services/toast";
import type { FiltroComunidade, Publicacao } from "@/types/comunidade";

/**
 * Estado do feed público do Explorar: página inicial, scroll infinito, pull to refresh
 * e as mutações otimistas (curtir, bloquear).
 *
 * O feed é paginado por cursor e não passa pelo cache de navegação: o conteúdo é público
 * e muda o tempo todo, e guardar páginas soltas por filtro traria mais inconsistência do
 * que ganho. Trocar o filtro reinicia a lista.
 */
export function useFeedComunidade(filtro: FiltroComunidade) {
    const [itens, setItens] = useState<Publicacao[]>([]);
    const [cursor, setCursor] = useState<string | null>(null);
    const [carregando, setCarregando] = useState(true);
    const [atualizando, setAtualizando] = useState(false);
    const [carregandoMais, setCarregandoMais] = useState(false);
    const [erro, setErro] = useState<unknown>(null);

    // Cada busca carrega o filtro que a originou: uma resposta lenta do filtro anterior
    // não pode sobrescrever a lista do filtro atual.
    const filtroAtual = useRef(filtro);
    filtroAtual.current = filtro;

    const carregarPrimeiraPagina = useCallback(
        async (modo: "inicial" | "refresh") => {
            const filtroDaBusca = filtro;
            if (modo === "inicial") setCarregando(true);
            else setAtualizando(true);
            setErro(null);

            try {
                const pagina = await buscarFeedComunidade({ filtro: filtroDaBusca });
                if (filtroAtual.current !== filtroDaBusca) return;
                setItens(pagina.itens);
                setCursor(pagina.proximoCursor);
            } catch (e) {
                if (filtroAtual.current !== filtroDaBusca) return;
                setErro(e);
            } finally {
                if (filtroAtual.current === filtroDaBusca) {
                    setCarregando(false);
                    setAtualizando(false);
                }
            }
        },
        [filtro]
    );

    useEffect(() => {
        carregarPrimeiraPagina("inicial");
    }, [carregarPrimeiraPagina]);

    const carregarMais = useCallback(async () => {
        if (!cursor || carregandoMais || carregando || atualizando) return;

        const filtroDaBusca = filtroAtual.current;
        setCarregandoMais(true);
        try {
            const pagina = await buscarFeedComunidade({ filtro: filtroDaBusca, cursor });
            if (filtroAtual.current !== filtroDaBusca) return;
            // Uma publicação pode reaparecer se algo entrou no topo entre as páginas.
            setItens((atuais) => {
                const vistos = new Set(atuais.map((item) => item.id));
                return [...atuais, ...pagina.itens.filter((item) => !vistos.has(item.id))];
            });
            setCursor(pagina.proximoCursor);
        } catch {
            // Falha em página seguinte não derruba o que já está na tela; o próximo
            // fim de lista tenta de novo.
        } finally {
            setCarregandoMais(false);
        }
    }, [cursor, carregandoMais, carregando, atualizando]);

    const atualizar = useCallback(() => carregarPrimeiraPagina("refresh"), [carregarPrimeiraPagina]);
    const tentarDeNovo = useCallback(() => carregarPrimeiraPagina("inicial"), [carregarPrimeiraPagina]);

    /** Curtida otimista: o coração responde na hora e volta atrás se o servidor recusar. */
    const curtir = useCallback((publicacao: Publicacao) => {
        const anterior = { curtidoPorMim: publicacao.curtidoPorMim, curtidas: publicacao.curtidas };
        const passaACurtir = !publicacao.curtidoPorMim;

        setItens((atuais) =>
            atuais.map((item) =>
                item.id === publicacao.id
                    ? {
                          ...item,
                          curtidoPorMim: passaACurtir,
                          curtidas: Math.max(0, item.curtidas + (passaACurtir ? 1 : -1)),
                      }
                    : item
            )
        );

        alternarCurtida(
            { origem: publicacao.origem, referenciaId: publicacao.referenciaId },
            passaACurtir
        ).catch(() => {
            setItens((atuais) =>
                atuais.map((item) => (item.id === publicacao.id ? { ...item, ...anterior } : item))
            );
            toast.error("Não deu para registrar sua curtida.");
        });
    }, []);

    /** Some com tudo do autor na hora — é a promessa que o menu de bloqueio faz. */
    const bloquear = useCallback(async (autorId: string) => {
        setItens((atuais) => atuais.filter((item) => item.autor.id !== autorId));
        await bloquearAutor(autorId);
    }, []);

    /** Mantém a contagem do card em dia quando a folha de comentários muda o total. */
    const ajustarContagemDeComentarios = useCallback((publicacaoId: string, delta: number) => {
        setItens((atuais) =>
            atuais.map((item) =>
                item.id === publicacaoId
                    ? { ...item, comentarios: Math.max(0, item.comentarios + delta) }
                    : item
            )
        );
    }, []);

    return {
        itens,
        carregando,
        atualizando,
        carregandoMais,
        temMais: cursor !== null,
        erro,
        atualizar,
        tentarDeNovo,
        carregarMais,
        curtir,
        bloquear,
        ajustarContagemDeComentarios,
    };
}
