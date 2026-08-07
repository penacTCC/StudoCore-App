import { useCallback, useState } from "react";
import { View, FlatList, RefreshControl } from "react-native";
import { router } from "expo-router";

import CardPublicacao from "@/components/comunidade/CardPublicacao";
import ChipsFiltro from "@/components/comunidade/ChipsFiltro";
import MenuPublicacao from "@/components/comunidade/MenuPublicacao";
import SheetComentarios from "@/components/comunidade/SheetComentarios";
import {
    BannerSemGrupo,
    CarregandoMais,
    ExplorarComErro,
    ExplorarSkeleton,
    ExplorarVazio,
    FaixaRevalidando,
} from "@/components/comunidade/EstadosExplorar";
import { HADES } from "@/constants/hades";
import { useFeedComunidade } from "@/hooks/useFeedComunidade";
import { denunciar, importarPlanoPublicado } from "@/services/comunidade";
import { confirm } from "@/services/confirm";
import { toast } from "@/services/toast";
import type { FiltroComunidade, Publicacao } from "@/types/comunidade";

/**
 * Feed público da Comunidade: galeria, arquivos e planos de qualquer usuário, no mesmo
 * fluxo, com scroll infinito.
 *
 * O conteúdo ainda vem do mock em `services/comunidade` — a tela toda já está escrita
 * contra a interface que o feed real vai expor.
 */
export default function AbaExplorar({ temGrupo }: { temGrupo: boolean }) {
    const [filtro, setFiltro] = useState<FiltroComunidade>("tudo");
    const [menuAberto, setMenuAberto] = useState<Publicacao | null>(null);
    const [comentariosDe, setComentariosDe] = useState<Publicacao | null>(null);

    const {
        itens,
        carregando,
        atualizando,
        carregandoMais,
        erro,
        atualizar,
        tentarDeNovo,
        carregarMais,
        curtir,
        bloquear,
        ajustarContagemDeComentarios,
    } = useFeedComunidade(filtro);

    const abrirPerfil = useCallback((publicacao: Publicacao) => {
        setMenuAberto(null);
        // MOCK: os autores do feed não são usuários de verdade ainda, então a tela de
        // perfil não tem o que buscar. Vira `router.push("/(modals)/member-profile")`
        // quando o feed passar a vir do banco.
        toast.info(`Perfil de ${publicacao.autor.nome} chega junto com o feed real.`);
    }, []);

    const denunciarPublicacao = useCallback(async (publicacao: Publicacao) => {
        setMenuAberto(null);
        await denunciar({ tipo: "publicacao", id: publicacao.id });
        toast.success("Denúncia enviada. Vamos analisar.");
    }, []);

    const bloquearAutor = useCallback(
        (publicacao: Publicacao) => {
            setMenuAberto(null);
            confirm({
                title: `Bloquear ${publicacao.autor.nome}?`,
                message: "Nada publicado por essa pessoa vai aparecer no seu feed.",
                confirmText: "Bloquear",
                destructive: true,
                onConfirm: async () => {
                    await bloquear(publicacao.autor.id);
                    toast.success(`${publicacao.autor.nome} foi bloqueado.`);
                },
            });
        },
        [bloquear]
    );

    const importarPlano = useCallback(async (publicacao: Publicacao) => {
        if (publicacao.tipo !== "plano") return;
        await importarPlanoPublicado(publicacao.id);
        // MOCK: nada é gravado no cronograma ainda.
        toast.info("Importar plano ainda está em construção.");
    }, []);

    const baixarArquivo = useCallback(() => {
        // MOCK: os arquivos do feed não têm URL assinada ainda.
        toast.info("O download do feed público ainda está em construção.");
    }, []);

    const cabecalho = (
        <>
            {!temGrupo && <BannerSemGrupo onComecar={() => router.push("/(modals)/create-group")} />}
            <ChipsFiltro filtro={filtro} onSelecionar={setFiltro} />
            {atualizando && <FaixaRevalidando />}
        </>
    );

    // Só o primeiro carregamento troca a tela pelo esqueleto: trocar de filtro com lista
    // já na mão mantém o cabeçalho firme e substitui só o miolo.
    if (carregando && itens.length === 0 && !erro) {
        return (
            <View style={{ flex: 1 }}>
                {cabecalho}
                <ExplorarSkeleton />
            </View>
        );
    }

    if (erro && itens.length === 0) {
        return (
            <View style={{ flex: 1 }}>
                {cabecalho}
                <ExplorarComErro onTentarDeNovo={tentarDeNovo} />
            </View>
        );
    }

    return (
        <View style={{ flex: 1 }}>
            <FlatList
                data={itens}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={cabecalho}
                contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 20, gap: 12 }}
                showsVerticalScrollIndicator={false}
                // O cabeçalho tem margem própria e não deve herdar o padding lateral da lista.
                ListHeaderComponentStyle={{ marginHorizontal: -18 }}
                refreshControl={
                    <RefreshControl
                        refreshing={atualizando}
                        onRefresh={atualizar}
                        tintColor={HADES.accentSolid}
                    />
                }
                onEndReached={carregarMais}
                onEndReachedThreshold={0.4}
                ListEmptyComponent={<ExplorarVazio />}
                ListFooterComponent={carregandoMais ? <CarregandoMais /> : null}
                renderItem={({ item }) => (
                    <CardPublicacao
                        publicacao={item}
                        onCurtir={() => curtir(item.id)}
                        onComentar={() => setComentariosDe(item)}
                        onAbrirMenu={() => setMenuAberto(item)}
                        onImportarPlano={() => importarPlano(item)}
                        onBaixarArquivo={baixarArquivo}
                    />
                )}
            />

            <MenuPublicacao
                publicacao={menuAberto}
                onFechar={() => setMenuAberto(null)}
                onVerPerfil={abrirPerfil}
                onDenunciar={denunciarPublicacao}
                onBloquear={bloquearAutor}
            />

            <SheetComentarios
                publicacaoId={comentariosDe?.id ?? null}
                souDonoDaPublicacao={comentariosDe?.autor.id === "eu"}
                onFechar={() => setComentariosDe(null)}
                onContagemMudou={(delta) => {
                    if (comentariosDe) ajustarContagemDeComentarios(comentariosDe.id, delta);
                }}
            />
        </View>
    );
}
