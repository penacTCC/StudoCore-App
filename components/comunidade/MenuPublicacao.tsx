import { View, Text, Modal, Pressable, TouchableOpacity } from "react-native";
import { ChevronRight, Flag, User, UserX } from "@/components/ui/icons";

import Avatar from "@/components/ui/Avatar";
import { HADES } from "@/constants/hades";
import type { Publicacao } from "@/types/comunidade";

/**
 * Menu do "⋮" do card: ver perfil, denunciar e bloquear.
 *
 * Bloquear é a saída forte do feed público — depois dela nada daquele autor volta a
 * aparecer —, por isso vem sempre depois da denúncia e em vermelho.
 */
export default function MenuPublicacao({
    publicacao,
    onFechar,
    onVerPerfil,
    onDenunciar,
    onBloquear,
}: {
    /** `null` mantém a folha fechada. */
    publicacao: Publicacao | null;
    onFechar: () => void;
    onVerPerfil: (publicacao: Publicacao) => void;
    onDenunciar: (publicacao: Publicacao) => void;
    onBloquear: (publicacao: Publicacao) => void;
}) {
    return (
        <Modal visible={!!publicacao} transparent animationType="slide" onRequestClose={onFechar}>
            <Pressable
                style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}
                onPress={onFechar}
            >
                <Pressable
                    style={{
                        backgroundColor: "#101116",
                        borderTopLeftRadius: 24,
                        borderTopRightRadius: 24,
                        borderTopWidth: 1,
                        borderTopColor: HADES.borderStrong,
                        paddingHorizontal: 16,
                        paddingBottom: 28,
                    }}
                >
                    <View style={{ alignItems: "center", paddingTop: 10, paddingBottom: 6 }}>
                        <View
                            style={{ width: 38, height: 4, borderRadius: 3, backgroundColor: HADES.trackOff }}
                        />
                    </View>

                    {publicacao && (
                        <>
                            <View
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 11,
                                    paddingHorizontal: 6,
                                    paddingTop: 10,
                                    paddingBottom: 16,
                                    borderBottomWidth: 1,
                                    borderBottomColor: HADES.border,
                                }}
                            >
                                <Avatar
                                    foto={publicacao.autor.foto}
                                    nome={publicacao.autor.nome}
                                    size={34}
                                />
                                <View style={{ flex: 1, minWidth: 0 }}>
                                    <Text style={{ fontSize: 14, fontWeight: "600", color: "#fff" }}>
                                        Publicação de {publicacao.autor.nome}
                                    </Text>
                                    <Text
                                        numberOfLines={1}
                                        style={{ fontSize: 11.5, color: HADES.textFaint, marginTop: 1 }}
                                    >
                                        {resumoDaPublicacao(publicacao)}
                                    </Text>
                                </View>
                            </View>

                            <Acao
                                Icone={User}
                                titulo={`Ver perfil de ${publicacao.autor.nome}`}
                                comChevron
                                onPress={() => onVerPerfil(publicacao)}
                            />

                            <Acao
                                Icone={Flag}
                                titulo="Denunciar publicação"
                                descricao="Conteúdo impróprio, spam ou plágio"
                                separador
                                onPress={() => onDenunciar(publicacao)}
                            />

                            <Acao
                                Icone={UserX}
                                titulo={`Bloquear ${publicacao.autor.nome}`}
                                descricao="Você não verá mais nada publicado por essa pessoa"
                                separador
                                destrutivo
                                onPress={() => onBloquear(publicacao)}
                            />

                            <TouchableOpacity
                                onPress={onFechar}
                                activeOpacity={0.85}
                                style={{
                                    height: 50,
                                    borderRadius: 14,
                                    backgroundColor: "#16171c",
                                    borderWidth: 1,
                                    borderColor: "rgba(255,255,255,0.07)",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    marginTop: 10,
                                }}
                            >
                                <Text style={{ fontSize: 14.5, fontWeight: "600", color: HADES.textSecondary }}>
                                    Cancelar
                                </Text>
                            </TouchableOpacity>
                        </>
                    )}
                </Pressable>
            </Pressable>
        </Modal>
    );
}

function Acao({
    Icone,
    titulo,
    descricao,
    separador,
    destrutivo,
    comChevron,
    onPress,
}: {
    Icone: typeof User;
    titulo: string;
    descricao?: string;
    separador?: boolean;
    destrutivo?: boolean;
    comChevron?: boolean;
    onPress: () => void;
}) {
    const cor = destrutivo ? "#e04949" : "#fff";
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 13,
                paddingHorizontal: 6,
                paddingVertical: 16,
                borderTopWidth: separador ? 1 : 0,
                borderTopColor: "rgba(255,255,255,0.05)",
            }}
        >
            <View
                style={{
                    width: 38,
                    height: 38,
                    borderRadius: 11,
                    backgroundColor: destrutivo ? "rgba(224,73,73,0.12)" : HADES.surfaceOverlay,
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <Icone size={18} color={destrutivo ? "#e04949" : HADES.textSecondary} />
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 14.5, fontWeight: "600", color: cor }}>{titulo}</Text>
                {descricao && (
                    <Text style={{ fontSize: 11.5, color: HADES.textFaint, marginTop: 1 }}>{descricao}</Text>
                )}
            </View>

            {comChevron && <ChevronRight size={17} color={HADES.textDim} />}
        </TouchableOpacity>
    );
}

/** Segunda linha do cabeçalho do menu: diz de qual publicação se está falando. */
function resumoDaPublicacao(publicacao: Publicacao): string {
    switch (publicacao.tipo) {
        case "galeria":
            return `Foto de sessão · ${publicacao.materia}`;
        case "arquivo":
            return publicacao.nomeArquivo;
        case "plano":
            return publicacao.titulo;
    }
}
