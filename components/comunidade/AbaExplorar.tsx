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
import { useAuth } from "@/hooks/useAuth";
import { useFeedComunidade } from "@/hooks/useFeedComunidade";
import { usePreferencias } from "@/hooks/usePreferencias";
import { useProfile } from "@/hooks/useProfile";
import { denunciar, importarPlano } from "@/services/comunidade";
import { confirm } from "@/services/confirm";
import { toast } from "@/services/toast";
import { abrirArquivoDoBucket } from "@/services/visualizarArquivo";
import type { FiltroComunidade, Publicacao } from "@/types/comunidade";

/**
 * Feed público da Comunidade: fotos de sessão, arquivos e planos no mesmo fluxo, com
 * scroll infinito.
 *
 * As três origens vêm do banco, cada uma pela RPC dela (ver services/comunidade.ts), e
 * todas aceitam as mesmas interações — curtir, comentar, denunciar, bloquear o autor.
 */
export default function AbaExplorar({ temGrupo }: { temGrupo: boolean }) {
    const [filtro, setFiltro] = useState<FiltroComunidade>("tudo");
    const [menuAberto, setMenuAberto] = useState<Publicacao | null>(null);
    const [comentariosDe, setComentariosDe] = useState<Publicacao | null>(null);
    // Id da publicação cuja ação demorada está em curso (baixar arquivo, importar plano).
    const [ocupada, setOcupada] = useState<string | null>(null);

    const { userId } = useAuth();
    const { profile } = useProfile(userId ?? "");
    const { prefs } = usePreferencias(userId);

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
        router.push({
            pathname: "/(modals)/member-profile",
            params: { userId: publicacao.autor.id, administrador: "false" },
        });
    }, []);

    const denunciarPublicacao = useCallback(async (publicacao: Publicacao) => {
        setMenuAberto(null);
        try {
            await denunciar({
                ref: { origem: publicacao.origem, referenciaId: publicacao.referenciaId },
            });
            toast.success("Denúncia enviada. Vamos analisar.");
        } catch {
            toast.error("Não deu para enviar a denúncia.");
        }
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
                    try {
                        await bloquear(publicacao.autor.id);
                        toast.success(`${publicacao.autor.nome} foi bloqueado.`);
                    } catch {
                        toast.error("Não deu para bloquear agora.");
                    }
                },
            });
        },
        [bloquear]
    );

    /**
     * Baixa o arquivo do bucket e entrega ao visualizador do sistema — o mesmo caminho do
     * Vault. O arquivo público continua atrás do download autenticado: o que `publico` abre
     * é o card no feed, não o bucket.
     */
    const baixarArquivo = useCallback(async (publicacao: Publicacao) => {
        if (publicacao.tipo !== "arquivo") return;
        if (!publicacao.storagePath) {
            toast.error("Esse arquivo não está mais disponível.");
            return;
        }

        setOcupada(publicacao.id);
        try {
            await abrirArquivoDoBucket(publicacao.storagePath);
        } finally {
            setOcupada(null);
        }
    }, []);

    /**
     * Importar é copiar: o plano vira um plano seu, sem agenda, e não muda mais junto com
     * o original. Confirmar antes porque o cronograma é da pessoa e ninguém espera que um
     * toque no feed acrescente coisa lá dentro.
     */
    const importar = useCallback((publicacao: Publicacao) => {
        if (publicacao.tipo !== "plano") return;

        confirm({
            title: `Importar "${publicacao.titulo}"?`,
            message:
                "Uma cópia vai para os seus planos, sem dias marcados. Você escolhe depois quando ela vale.",
            confirmText: "Importar",
            onConfirm: async () => {
                setOcupada(publicacao.id);
                try {
                    await importarPlano(publicacao.referenciaId);
                    toast.success("Plano copiado para os seus planos.");
                } catch {
                    toast.error("Não deu para importar esse plano.");
                } finally {
                    setOcupada(null);
                }
            },
        });
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
                ListEmptyComponent={
                    <ExplorarVazio
                        naoParticipa={!prefs.feedPublico}
                        onParticipar={() => router.push("/(modals)/settings")}
                    />
                }
                ListFooterComponent={carregandoMais ? <CarregandoMais /> : null}
                renderItem={({ item }) => (
                    <CardPublicacao
                        publicacao={item}
                        ocupado={ocupada === item.id}
                        onCurtir={() => curtir(item)}
                        onComentar={() => setComentariosDe(item)}
                        onAbrirMenu={() => setMenuAberto(item)}
                        onImportarPlano={() => importar(item)}
                        onBaixarArquivo={() => baixarArquivo(item)}
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
                publicacao={comentariosDe}
                eu={{
                    id: userId,
                    nome: profile?.nome_usuario ?? null,
                    foto: profile?.foto_usuario ?? null,
                }}
                onFechar={() => setComentariosDe(null)}
                onContagemMudou={(delta) => {
                    if (comentariosDe) ajustarContagemDeComentarios(comentariosDe.id, delta);
                }}
            />
        </View>
    );
}
