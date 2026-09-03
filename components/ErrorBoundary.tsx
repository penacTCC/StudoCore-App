import { Component, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { HADES } from "@/constants/hades";
import { reportarErro } from "@/lib/sentry";

type Props = { children: ReactNode };
type State = { erro: Error | null };

// Rede de segurança global: sem isto, um erro de render em qualquer tela
// derruba o app inteiro pra uma tela branca travada, sem nenhum log — o pior
// cenário possível com testadores reais fora do ambiente de dev.
export class ErrorBoundary extends Component<Props, State> {
    state: State = { erro: null };

    static getDerivedStateFromError(erro: Error): State {
        return { erro };
    }

    componentDidCatch(erro: Error, info: { componentStack: string }) {
        reportarErro(erro, { componentStack: info.componentStack });
    }

    render() {
        if (!this.state.erro) return this.props.children;

        return (
            <View
                style={{
                    flex: 1,
                    backgroundColor: HADES.bg,
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 32,
                    gap: 12,
                }}
            >
                <Text style={{ color: HADES.text, fontSize: 20, fontWeight: "700", textAlign: "center" }}>
                    Algo deu errado
                </Text>
                <Text style={{ color: HADES.textMuted, fontSize: 14, textAlign: "center", lineHeight: 20 }}>
                    O app encontrou um erro inesperado. Tenta de novo — se continuar acontecendo, conta pra gente o que você estava fazendo.
                </Text>
                <Pressable
                    onPress={() => this.setState({ erro: null })}
                    style={{
                        marginTop: 12,
                        backgroundColor: HADES.accent,
                        paddingVertical: 12,
                        paddingHorizontal: 24,
                        borderRadius: 12,
                    }}
                >
                    <Text style={{ color: "#000", fontWeight: "700" }}>Tentar novamente</Text>
                </Pressable>
            </View>
        );
    }
}
