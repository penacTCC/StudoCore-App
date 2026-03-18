import { View } from "react-native";

interface DragHandleProps {
    marginBottom?: number;
}

/**
 * Barra decorativa exibida no topo do bottom sheet nas telas de auth,
 * simulando um indicador de arrastar (drag handle).
 */
export default function DragHandle({ marginBottom = 26 }: DragHandleProps) {
    return (
        <View
            style={{
                width: 44,
                height: 4,
                backgroundColor: "rgba(255,255,255,0.15)",
                borderRadius: 2,
                alignSelf: "center",
                marginBottom,
            }}
        />
    );
}
