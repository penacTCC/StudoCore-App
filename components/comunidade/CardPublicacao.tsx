import { View, Text, Image, TouchableOpacity } from "react-native";
import {
    CalendarPlus,
    CalendarRange,
    Clock,
    Download,
    EllipsisVertical,
    FileText,
    Heart,
    Image as ImageIcon,
    LayoutGrid,
    MessageCircle,
    Timer,
} from "lucide-react-native";

import Avatar from "@/components/ui/Avatar";
import { HADES } from "@/constants/hades";
import type { Publicacao, TipoPublicacao } from "@/types/comunidade";

/**
 * Card do feed público. Um componente para os três tipos porque a moldura é a mesma —
 * autor, selo do tipo, menu e a barra de reações; só o miolo muda.
 */
export default function CardPublicacao({
    publicacao,
    onCurtir,
    onComentar,
    onAbrirMenu,
    onImportarPlano,
    onBaixarArquivo,
}: {
    publicacao: Publicacao;
    onCurtir: () => void;
    onComentar: () => void;
    onAbrirMenu: () => void;
    onImportarPlano: () => void;
    onBaixarArquivo: () => void;
}) {
    return (
        <View
            style={{
                backgroundColor: HADES.surface,
                borderWidth: 1,
                borderColor: HADES.border,
                borderRadius: 16,
                padding: 14,
            }}
        >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
                <Avatar foto={publicacao.autor.foto} nome={publicacao.autor.nome} size={32} />

                <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <Text
                        numberOfLines={1}
                        style={{ fontSize: 14, fontWeight: "600", color: "#fff", flexShrink: 1 }}
                    >
                        {publicacao.autor.nome}
                    </Text>
                    <Text style={{ fontSize: 12, color: HADES.textFaint }}>
                        · {tempoRelativo(publicacao.criadoEm)}
                    </Text>
                </View>

                <SeloDoTipo tipo={publicacao.tipo} />

                <TouchableOpacity
                    onPress={onAbrirMenu}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                >
                    <EllipsisVertical size={17} color={HADES.textDim} />
                </TouchableOpacity>
            </View>

            {publicacao.tipo === "galeria" && (
                <>
                    <FotoDaSessao url={publicacao.fotoUrl} />
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 11 }}>
                        <Text style={{ fontSize: 13.5, fontWeight: "600", color: publicacao.materiaCor }}>
                            {publicacao.materia}
                        </Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                            <Timer size={13} color={HADES.textFaint} />
                            <Text style={{ fontSize: 12.5, color: HADES.textMuted, fontWeight: "600" }}>
                                {formatarDuracao(publicacao.duracaoMinutos)} de sessão
                            </Text>
                        </View>
                    </View>
                </>
            )}

            {publicacao.tipo === "arquivo" && (
                <>
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 12,
                            marginTop: 12,
                            padding: 12,
                            backgroundColor: "#101116",
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.05)",
                            borderRadius: 12,
                        }}
                    >
                        <View
                            style={{
                                width: 42,
                                height: 42,
                                borderRadius: 11,
                                backgroundColor: "rgba(208,69,94,0.14)",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <FileText size={20} color="#d0455e" />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <Text
                                numberOfLines={1}
                                style={{ fontSize: 13.5, fontWeight: "600", color: "#fff" }}
                            >
                                {publicacao.nomeArquivo}
                            </Text>
                            <Text style={{ fontSize: 11.5, color: HADES.textFaint, marginTop: 2 }}>
                                {publicacao.extensao} · {formatarTamanho(publicacao.tamanhoBytes)}
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={onBaixarArquivo}
                            activeOpacity={0.8}
                            style={{
                                width: 34,
                                height: 34,
                                borderRadius: 17,
                                backgroundColor: HADES.surfaceOverlay,
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <Download size={16} color={HADES.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {publicacao.materia && (
                        <Text
                            style={{
                                fontSize: 13,
                                fontWeight: "600",
                                color: publicacao.materiaCor ?? HADES.textSecondary,
                                marginTop: 10,
                            }}
                        >
                            {publicacao.materia}
                        </Text>
                    )}
                </>
            )}

            {publicacao.tipo === "plano" && (
                <>
                    <Text
                        style={{
                            fontSize: 15.5,
                            fontWeight: "700",
                            color: "#fff",
                            marginTop: 11,
                            letterSpacing: -0.2,
                        }}
                    >
                        {publicacao.titulo}
                    </Text>

                    <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginTop: 7 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                            <LayoutGrid size={13} color={HADES.textFaint} />
                            <Text style={{ fontSize: 12.5, color: HADES.textMuted, fontWeight: "600" }}>
                                {publicacao.blocos} blocos
                            </Text>
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                            <Clock size={13} color={HADES.textFaint} />
                            <Text style={{ fontSize: 12.5, color: HADES.textMuted, fontWeight: "600" }}>
                                {publicacao.horasTotais}h no total
                            </Text>
                        </View>
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

                    <TouchableOpacity
                        onPress={onImportarPlano}
                        activeOpacity={0.85}
                        style={{
                            height: 40,
                            borderRadius: 11,
                            backgroundColor: "rgba(255,154,0,0.12)",
                            borderWidth: 1,
                            borderColor: "rgba(255,154,0,0.3)",
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 7,
                            marginTop: 12,
                        }}
                    >
                        <CalendarPlus size={15} color={HADES.accentSolid} />
                        <Text style={{ fontSize: 13, fontWeight: "700", color: HADES.accentSolid }}>
                            Importar para meu cronograma
                        </Text>
                    </TouchableOpacity>
                </>
            )}

            <View
                style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 18,
                    marginTop: 12,
                    paddingTop: 11,
                    borderTopWidth: 1,
                    borderTopColor: "rgba(255,255,255,0.05)",
                }}
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
    );
}

const SELOS: Record<TipoPublicacao, { rotulo: string; Icone: typeof ImageIcon }> = {
    galeria: { rotulo: "Galeria", Icone: ImageIcon },
    arquivo: { rotulo: "Arquivo", Icone: FileText },
    plano: { rotulo: "Plano", Icone: CalendarRange },
};

function SeloDoTipo({ tipo }: { tipo: TipoPublicacao }) {
    const { rotulo, Icone } = SELOS[tipo];
    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                backgroundColor: HADES.surfaceOverlay,
                borderRadius: 7,
                paddingHorizontal: 8,
                paddingVertical: 3,
            }}
        >
            <Icone size={11} color={HADES.textMuted} />
            <Text style={{ fontSize: 10.5, color: HADES.textMuted, fontWeight: "600" }}>{rotulo}</Text>
        </View>
    );
}

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
 * A foto da sessão só existe no bucket privado, servida por signed URL. Enquanto o feed
 * é mock não há URL nenhuma, então o card mostra a moldura vazia em vez de quebrar.
 */
function FotoDaSessao({ url }: { url: string | null }) {
    if (url) {
        return (
            <Image
                source={{ uri: url }}
                style={{ height: 172, borderRadius: 12, marginTop: 11, width: "100%" }}
                resizeMode="cover"
            />
        );
    }

    return (
        <View
            style={{
                height: 172,
                borderRadius: 12,
                marginTop: 11,
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

function formatarTamanho(bytes: number): string {
    const mb = bytes / 1_000_000;
    if (mb >= 1) return `${mb.toFixed(1).replace(".", ",")} MB`;
    return `${Math.round(bytes / 1000)} KB`;
}
