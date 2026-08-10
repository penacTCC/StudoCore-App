import { View, Text, Image, TouchableOpacity, ActivityIndicator } from "react-native";
import {
    Download,
    Ellipsis,
    Eye,
    FileText,
    Heart,
    Image as ImageIcon,
    MessageCircle,
} from "@/components/ui/icons";

import Avatar from "@/components/ui/Avatar";
import { HADES } from "@/constants/hades";
import type { Publicacao, TipoPublicacao } from "@/types/comunidade";

/**
 * Publicação do feed público. Um componente para os três tipos porque a moldura é a mesma —
 * autor, selo do tipo, menu e a barra de reações; só o miolo muda.
 *
 * Não é um card: o feed é uma coluna contínua, cada publicação separada da seguinte só por
 * uma linha. Empilhar cartões dentro de uma tela que já tem cabeçalho, escopo e filtros
 * criava molduras dentro de molduras; a foto e o anexo ficam maiores sem elas.
 */
export default function CardPublicacao({
    publicacao,
    onCurtir,
    onComentar,
    onAbrirMenu,
    onVerPlano,
    onBaixarArquivo,
    ocupado = false,
}: {
    publicacao: Publicacao;
    onCurtir: () => void;
    onComentar: () => void;
    onAbrirMenu: () => void;
    onVerPlano: () => void;
    onBaixarArquivo: () => void;
    /** Baixar leva segundos e sai do app; sem isso o toque parece perdido. */
    ocupado?: boolean;
}) {
    return (
        <View
            style={{
                flexDirection: "row",
                gap: 11,
                paddingHorizontal: 18,
                paddingTop: 15,
                paddingBottom: 12,
                borderBottomWidth: 1,
                borderBottomColor: "rgba(255,255,255,0.07)",
            }}
        >
            <Avatar foto={publicacao.autor.foto} nome={publicacao.autor.nome} size={36} />

            <View style={{ flex: 1, minWidth: 0 }}>
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        marginBottom: 7,
                    }}
                >
                    <Text
                        numberOfLines={1}
                        style={{
                            fontSize: 14.5,
                            fontWeight: "600",
                            color: "#fff",
                            letterSpacing: -0.1,
                            flexShrink: 1,
                        }}
                    >
                        {publicacao.autor.nome}
                    </Text>
                    <Text style={{ fontSize: 12.5, color: HADES.textFaint }}>
                        · {tempoRelativo(publicacao.criadoEm)}
                    </Text>

                    <Text
                        style={{
                            marginLeft: "auto",
                            fontSize: 10.5,
                            fontWeight: "700",
                            color: HADES.textFaint,
                            letterSpacing: 0.6,
                            textTransform: "uppercase",
                        }}
                    >
                        {ROTULO_DO_TIPO[publicacao.tipo]}
                    </Text>

                    <TouchableOpacity
                        onPress={onAbrirMenu}
                        activeOpacity={0.7}
                        hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                    >
                        <Ellipsis size={16} color={HADES.textDim} />
                    </TouchableOpacity>
                </View>

                {publicacao.tipo === "galeria" && (
                    <>
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 10,
                                marginBottom: 10,
                            }}
                        >
                            <Text
                                numberOfLines={1}
                                style={{
                                    fontSize: 13.5,
                                    fontWeight: "600",
                                    color: publicacao.materiaCor,
                                    flexShrink: 1,
                                }}
                            >
                                {publicacao.materia}
                            </Text>
                            <Text style={{ fontSize: 12.5, color: HADES.textFaint, fontWeight: "500" }}>
                                {formatarDuracao(publicacao.duracaoMinutos)} de sessão
                            </Text>
                        </View>
                        <FotoDaSessao url={publicacao.fotoUrl} />
                    </>
                )}

                {publicacao.tipo === "arquivo" && (
                    <>
                        {publicacao.materia && (
                            <Text
                                numberOfLines={1}
                                style={{
                                    fontSize: 13.5,
                                    fontWeight: "600",
                                    color: publicacao.materiaCor ?? HADES.textSecondary,
                                    marginBottom: 10,
                                }}
                            >
                                {publicacao.materia}
                            </Text>
                        )}

                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 12,
                                padding: 12,
                                borderWidth: 1,
                                borderColor: "rgba(255,255,255,0.1)",
                                borderRadius: 14,
                            }}
                        >
                            <View
                                style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 11,
                                    backgroundColor: "rgba(208,69,94,0.14)",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <FileText size={19} color="#d0455e" />
                            </View>
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <Text
                                    numberOfLines={1}
                                    style={{ fontSize: 13.5, fontWeight: "600", color: "#fff" }}
                                >
                                    {publicacao.nomeArquivo}
                                </Text>
                                <Text style={{ fontSize: 11.5, color: HADES.textFaint, marginTop: 2 }}>
                                    {descreverArquivo(publicacao.extensao, publicacao.tamanhoBytes)}
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={onBaixarArquivo}
                                disabled={ocupado}
                                activeOpacity={0.7}
                                hitSlop={{ top: 12, bottom: 12, left: 12, right: 8 }}
                            >
                                {ocupado ? (
                                    <ActivityIndicator size="small" color={HADES.textSecondary} />
                                ) : (
                                    <Download size={18} color={HADES.textSecondary} />
                                )}
                            </TouchableOpacity>
                        </View>
                    </>
                )}

                {publicacao.tipo === "plano" && (
                    <>
                        <Text
                            style={{
                                fontSize: 15.5,
                                fontWeight: "700",
                                color: "#fff",
                                letterSpacing: -0.2,
                            }}
                        >
                            {publicacao.titulo}
                        </Text>

                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 14,
                                marginTop: 6,
                            }}
                        >
                            <Text style={{ fontSize: 12.5, color: HADES.textMuted, fontWeight: "600" }}>
                                {publicacao.blocos} blocos
                            </Text>
                            <Text style={{ fontSize: 12.5, color: HADES.textMuted, fontWeight: "600" }}>
                                {formatarDuracao(publicacao.minutosTotais)} no total
                            </Text>
                        </View>

                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                            {publicacao.materias.map((materia) => (
                                <Text
                                    key={materia.nome}
                                    style={{
                                        fontSize: 11,
                                        fontWeight: "600",
                                        color: materia.cor,
                                        backgroundColor: `${materia.cor}1f`,
                                        borderRadius: 6,
                                        paddingHorizontal: 8,
                                        paddingVertical: 3,
                                        overflow: "hidden",
                                    }}
                                >
                                    {materia.nome}
                                </Text>
                            ))}
                            {publicacao.materiasExtras > 0 && (
                                <Text
                                    style={{
                                        fontSize: 11,
                                        fontWeight: "600",
                                        color: HADES.textMuted,
                                        backgroundColor: HADES.surfaceOverlay,
                                        borderRadius: 6,
                                        paddingHorizontal: 8,
                                        paddingVertical: 3,
                                        overflow: "hidden",
                                    }}
                                >
                                    +{publicacao.materiasExtras}
                                </Text>
                            )}
                        </View>

                        {/* Contornado e do tamanho do texto: sem a moldura do card em volta,
                            um botão preenchido de ponta a ponta pesaria mais que a foto da
                            publicação de cima.

                            Abre a prévia, não importa: o card mostra três matérias e um total,
                            e ninguém decide adotar o cronograma de outra pessoa com isso. É lá
                            que o "Importar" fica — por isso este não tem estado de carregando. */}
                        <TouchableOpacity
                            onPress={onVerPlano}
                            activeOpacity={0.85}
                            style={{
                                alignSelf: "flex-start",
                                height: 36,
                                paddingHorizontal: 14,
                                borderRadius: 10,
                                borderWidth: 1,
                                borderColor: "rgba(255,154,0,0.45)",
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 7,
                                marginTop: 12,
                            }}
                        >
                            <Eye size={15} color={HADES.accentSolid} />
                            <Text style={{ fontSize: 12.5, fontWeight: "700", color: HADES.accentSolid }}>
                                Ver blocos e importar
                            </Text>
                        </TouchableOpacity>
                    </>
                )}

                <View
                    style={{ flexDirection: "row", alignItems: "center", gap: 20, marginTop: 12 }}
                >
                    <Reacao
                        Icone={Heart}
                        valor={publicacao.curtidas}
                        ativo={publicacao.curtidoPorMim}
                        onPress={onCurtir}
                    />
                    <Reacao Icone={MessageCircle} valor={publicacao.comentarios} onPress={onComentar} />
                </View>
            </View>
        </View>
    );
}

const ROTULO_DO_TIPO: Record<TipoPublicacao, string> = {
    galeria: "Galeria",
    arquivo: "Arquivo",
    plano: "Plano",
};

function Reacao({
    Icone,
    valor,
    ativo,
    onPress,
}: {
    Icone: typeof Heart;
    valor: number;
    ativo?: boolean;
    onPress: () => void;
}) {
    const cor = ativo ? HADES.accentSolid : HADES.textMuted;
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 10 }}
            style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
        >
            <Icone size={16} color={cor} fill={ativo ? HADES.accentSolid : "transparent"} />
            <Text style={{ fontSize: 12.5, color: cor, fontWeight: "600" }}>{valor}</Text>
        </TouchableOpacity>
    );
}

/**
 * A foto da sessão só existe no bucket privado, servida por signed URL. A assinatura pode
 * falhar (expirou, o arquivo sumiu), e aí o card mostra a moldura vazia em vez de quebrar.
 */
function FotoDaSessao({ url }: { url: string | null }) {
    if (url) {
        return (
            <Image
                source={{ uri: url }}
                style={{ height: 180, borderRadius: 12, width: "100%" }}
                resizeMode="cover"
            />
        );
    }

    return (
        <View
            style={{
                height: 180,
                borderRadius: 12,
                backgroundColor: "#14151a",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.05)",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
            }}
        >
            <ImageIcon size={22} color={HADES.dot} />
            <Text style={{ fontSize: 11.5, color: HADES.textDim }}>foto da sessão</Text>
        </View>
    );
}

/** "35m", "2h", "ontem", "3 dias" — a escala curta que o card usa. */
export function tempoRelativo(iso: string): string {
    const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
    if (minutos < 1) return "agora";
    if (minutos < 60) return `${minutos}m`;

    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `${horas}h`;

    const dias = Math.floor(horas / 24);
    if (dias === 1) return "ontem";
    if (dias < 7) return `${dias} dias`;

    const semanas = Math.floor(dias / 7);
    return semanas === 1 ? "1 semana" : `${semanas} semanas`;
}

function formatarDuracao(minutos: number): string {
    const horas = Math.floor(minutos / 60);
    const resto = minutos % 60;
    if (horas === 0) return `${resto}m`;
    if (resto === 0) return `${horas}h`;
    return `${horas}h ${String(resto).padStart(2, "0")}m`;
}

/**
 * "PDF · 2,5 MB" — mas cada metade pode faltar: arquivo sem extensão no nome, e tamanho
 * só a partir de 20260807210000 (os anteriores nunca gravaram o peso).
 */
function descreverArquivo(extensao: string, bytes: number | null): string {
    const partes = [extensao, bytes === null ? "" : formatarTamanho(bytes)].filter(Boolean);
    return partes.join(" · ");
}

function formatarTamanho(bytes: number): string {
    const mb = bytes / 1_000_000;
    if (mb >= 1) return `${mb.toFixed(1).replace(".", ",")} MB`;
    return `${Math.round(bytes / 1000)} KB`;
}
