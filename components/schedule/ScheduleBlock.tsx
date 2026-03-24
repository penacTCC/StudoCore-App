import { TouchableOpacity, View, Text } from "react-native";
import { Trash2 } from "lucide-react-native";

export type ScheduleBlockData = {
    id: string;
    disciplina: string;
    topico: string;
    duracao: number; // em horas: 1 | 2 | 3 | 4
    cor: string;
};

type Props = {
    block: ScheduleBlockData;
    onPress: (block: ScheduleBlockData) => void;
    onRemove?: (block: ScheduleBlockData) => void;
};

export default function ScheduleBlock({ block, onPress, onRemove }: Props) {
    return (
        <TouchableOpacity
            onPress={() => onPress(block)}
            activeOpacity={0.8}
            style={{
                backgroundColor: block.cor,
                borderRadius: 14,
                padding: 12,
                marginBottom: 8,
                minHeight: 100,
                justifyContent: "space-between",
                shadowColor: block.cor,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.4,
                shadowRadius: 6,
                elevation: 4,
            }}
        >
            {/* Top row: Topic and Duration */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <Text
                    style={{ color: "#fff", fontSize: 16, fontWeight: "800", flex: 1, marginRight: 8, lineHeight: 22 }}
                    numberOfLines={2}
                >
                    {block.topico || "Sem tópico"}
                </Text>
                <View
                    style={{
                        backgroundColor: "rgba(0,0,0,0.28)",
                        borderRadius: 20,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                    }}
                >
                    <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>
                        {block.duracao}h
                    </Text>
                </View>
            </View>

            {/* Bottom row: Discipline and Trash */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 12 }}>
                <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: "600" }}>
                    {block.disciplina}
                </Text>
                {onRemove && (
                    <TouchableOpacity
                        onPress={(e) => {
                            e.stopPropagation();
                            onRemove(block);
                        }}
                        style={{ padding: 4 }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Trash2 size={18} color="rgba(255,255,255,0.8)" />
                    </TouchableOpacity>
                )}
            </View>
        </TouchableOpacity>
    );
}
