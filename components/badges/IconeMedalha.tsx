import { Image, View } from "react-native";
import { Star } from "@/components/ui/icons";
import { BADGE_ICON_MAP, BADGE_IMAGE_MAP } from "@/constants/badgeIcons";

type Props = {
    /** id da medalha (constants/badges.ts) — usado pra achar a arte em PNG, quando existe */
    badgeId: string;
    /** nome do ícone Solar, usado como fallback quando a medalha não tem arte própria */
    icon: string;
    size: number;
    color: string;
    locked?: boolean;
};

/**
 * Algumas medalhas têm arte própria (PNG); as demais continuam com o ícone Solar colorido
 * pela cor do nível. A arte é renderizada um pouco maior porque preenche todo o quadrado.
 */
export default function IconeMedalha({ badgeId, icon, size, color, locked }: Props) {
    const arte = BADGE_IMAGE_MAP[badgeId];

    if (arte) {
        const lado = Math.round(size * 1.55);
        return (
            <Image
                source={arte}
                style={{ width: lado, height: lado, opacity: locked ? 0.35 : 1 }}
                resizeMode="contain"
            />
        );
    }

    const Icone = BADGE_ICON_MAP[icon] || Star;
    return <Icone size={size} color={color} />;
}

type TileProps = {
    badgeId: string;
    icon: string;
    /** lado do quadrado da medalha */
    size: number;
    color: string;
    locked?: boolean;
};

/**
 * Medalha em formato de "azulejo" grande, usada na galeria. A arte em PNG já vem com o
 * próprio quadrado arredondado, então ela ocupa o lado inteiro sem moldura extra; o
 * fallback em ícone ganha um quadrado tingido pela cor do nível para ficar do mesmo tamanho.
 */
export function IconeMedalhaTile({ badgeId, icon, size, color, locked }: TileProps) {
    const arte = BADGE_IMAGE_MAP[badgeId];
    const opacity = locked ? 0.32 : 1;

    if (arte) {
        return (
            <Image source={arte} style={{ width: size, height: size, opacity }} resizeMode="contain" />
        );
    }

    const Icone = BADGE_ICON_MAP[icon] || Star;
    return (
        <View
            style={{
                width: size,
                height: size,
                borderRadius: Math.round(size * 0.24),
                backgroundColor: `${color}1f`,
                borderWidth: 1.5,
                borderColor: `${color}4d`,
                alignItems: "center",
                justifyContent: "center",
                opacity,
            }}
        >
            <Icone size={Math.round(size * 0.46)} color={color} />
        </View>
    );
}
