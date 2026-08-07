import { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft, UserX } from "lucide-react-native";

import Avatar from "@/components/ui/Avatar";
import { Skeleton, SkeletonCircle } from "@/components/ui/Skeleton";
import { HADES } from "@/constants/hades";
import { confirm } from "@/services/confirm";
import { desbloquearAutor, listarBloqueados, type AutorBloqueado } from "@/services/comunidade";
import { toast } from "@/services/toast";

/**
 * Contas bloqueadas no feed público.
 *
 * Existe porque bloquear sem desbloquear é uma porta que só fecha: a pessoa some do feed
 * e não há caminho de volta pela interface. As lojas exigem esse par, e um toque errado
 * no menu do card não pode ser definitivo.
 */
export default function ContasBloqueadasScreen() {
    const [bloqueados, setBloqueados] = useState<AutorBloqueado[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [atualizando, setAtualizando] = useState(false);

    const carregar = useCallback(async (modo: "inicial" | "refresh" = "inicial") => {
        if (modo === "refresh") setAtualizando(true);
        try {
            setBloqueados(await listarBloqueados());
        } catch {
            toast.error("Não deu para carregar sua lista.");
        } finally {
            setCarregando(false);
            setAtualizando(false);
        }
    }, []);

    useEffect(() => {
        carregar();
    }, [carregar]);

    const desbloquear = (autor: AutorBloqueado) => {
        confirm({
            title: `Desbloquear ${autor.nome}?`,
            message: "As publicações dessa pessoa voltam a aparecer no seu feed.",
            confirmText: "Desbloquear",
            onConfirm: async () => {
                // Some da lista na hora; volta se o servidor recusar.
                setBloqueados((atuais) => atuais.filter((item) => item.id !== autor.id));
                try {
                    await desbloquearAutor(autor.id);
                    toast.success(`${autor.nome} foi desbloqueado.`);
                } catch {
                    setBloqueados((atuais) => [autor, ...atuais]);
                    toast.error("Não deu para desbloquear agora.");
                }
            },
        });
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: HADES.settingsBg }} edges={["top"]}>
            <View
                style={{
                    paddingTop: 6,
                    paddingHorizontal: 20,
                    paddingBottom: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                }}
            >
                <TouchableOpacity
                    onPress={() => router.back()}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <ChevronLeft size={22} color={HADES.textSecondary} />
                </TouchableOpacity>
                <Text style={{ fontSize: 20, fontWeight: "700", color: HADES.text }}>
                    Contas bloqueadas
                </Text>
            </View>

            {carregando ? (
                <View style={{ paddingHorizontal: 20, gap: 12 }}>
                    {[0, 1, 2].map((i) => (
                        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                            <SkeletonCircle size={42} hades />
                            <Skeleton width={140} height={14} hades />
                        </View>
                    ))}
                </View>
            ) : (
                <FlatList
                    data={bloqueados}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
                    refreshControl={
                        <RefreshControl
                            refreshing={atualizando}
                            onRefresh={() => carregar("refresh")}
                            tintColor={HADES.accentSolid}
                        />
                    }
                    ListEmptyComponent={
                        <View style={{ alignItems: "center", paddingTop: 80, paddingHorizontal: 30 }}>
                            <UserX size={30} color={HADES.dot} />
                            <Text
                                style={{
                                    fontSize: 14,
                                    color: HADES.textMuted,
                                    marginTop: 14,
                                    textAlign: "center",
                                }}
                            >
                                Você não bloqueou ninguém.
                            </Text>
                            <Text
                                style={{
                                    fontSize: 12.5,
                                    color: HADES.textDim,
                                    marginTop: 6,
                                    textAlign: "center",
                                    lineHeight: 19,
                                }}
                            >
                                Dá para bloquear alguém pelo menu de uma publicação no Explorar.
                            </Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 12,
                                paddingVertical: 12,
                                borderBottomWidth: 1,
                                borderBottomColor: HADES.borderSettings,
                            }}
                        >
                            <Avatar foto={item.foto} nome={item.nome} size={42} />

                            <View style={{ flex: 1, minWidth: 0 }}>
                                <Text
                                    numberOfLines={1}
                                    style={{ fontSize: 14.5, fontWeight: "600", color: HADES.text }}
                                >
                                    {item.nome}
                                </Text>
                                <Text style={{ fontSize: 12, color: HADES.textFaint, marginTop: 2 }}>
                                    Bloqueado em {formatarData(item.bloqueadoEm)}
                                </Text>
                            </View>

                            <TouchableOpacity
                                onPress={() => desbloquear(item)}
                                activeOpacity={0.8}
                                style={{
                                    paddingHorizontal: 14,
                                    paddingVertical: 8,
                                    borderRadius: 9,
                                    backgroundColor: HADES.surfaceRaised,
                                    borderWidth: 1,
                                    borderColor: HADES.borderStrong,
                                }}
                            >
                                <Text style={{ fontSize: 12.5, fontWeight: "600", color: HADES.text }}>
                                    Desbloquear
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                />
            )}
        </SafeAreaView>
    );
}

function formatarData(iso: string): string {
    return new Date(iso).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}
