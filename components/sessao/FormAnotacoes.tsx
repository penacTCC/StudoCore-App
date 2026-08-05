import { useRef, useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";

import { HADES } from "@/constants/hades";
import { CAMPOS_ANOTACAO, type AnotacoesSessao } from "@/types/anotacoes";

type Props = {
    anotacoes: AnotacoesSessao;
    aoMudar: (campo: keyof AnotacoesSessao, valor: string) => void;
    /** Desabilita os campos enquanto salva. */
    bloqueado?: boolean;
};

/**
 * Os quatro campos de anotação de uma sessão.
 *
 * Sem caixa, sem borda: só o rótulo e o texto, como uma folha de anotação. O campo tem a
 * mesma aparência do modo leitura em app/(modals)/detalhes-sessao.tsx de propósito —
 * entrar na edição não deve parecer trocar de tela, só ganhar um cursor.
 *
 * A afordância de "dá pra escrever aqui" fica na linha fininha embaixo do campo, que
 * acende no accent enquanto ele está em foco. A área toda da linha é tocável (não só o
 * texto), senão acertar um campo vazio de uma linha só vira mira.
 *
 * Usado em dois lugares: a etapa opcional no fim do quiz
 * (app/(modals)/focus-feedback.tsx) e, com autosave, dentro da própria tela de detalhes da
 * sessão (app/(modals)/detalhes-sessao.tsx) — lá não existe botão de salvar.
 */
export default function FormAnotacoes({ anotacoes, aoMudar, bloqueado = false }: Props) {
    const referencias = useRef<Record<string, TextInput | null>>({});
    const [emFoco, setEmFoco] = useState<string | null>(null);

    return (
        <View style={{ gap: 4 }}>
            {CAMPOS_ANOTACAO.map(({ chave, rotulo, placeholder }) => {
                const ativo = emFoco === chave;

                return (
                    <Pressable
                        key={chave}
                        onPress={() => referencias.current[chave]?.focus()}
                        disabled={bloqueado}
                        style={{ paddingTop: 18, paddingBottom: 12 }}
                    >
                        <Text
                            style={{
                                fontSize: 11.5,
                                fontWeight: "700",
                                letterSpacing: 0.8,
                                textTransform: "uppercase",
                                color: ativo ? HADES.accentSolid : HADES.textMuted,
                                marginBottom: 8,
                            }}
                        >
                            {rotulo}
                        </Text>

                        <TextInput
                            ref={(elemento) => {
                                referencias.current[chave] = elemento;
                            }}
                            value={anotacoes[chave]}
                            onChangeText={(texto) => aoMudar(chave, texto)}
                            onFocus={() => setEmFoco(chave)}
                            onBlur={() => setEmFoco((atual) => (atual === chave ? null : atual))}
                            editable={!bloqueado}
                            placeholder={placeholder}
                            placeholderTextColor={HADES.textDim}
                            multiline
                            scrollEnabled={false}
                            textAlignVertical="top"
                            style={{
                                // `padding: 0` é necessário: no Android o TextInput vem com um
                                // padding interno próprio que desalinharia o texto do rótulo.
                                padding: 0,
                                fontSize: 14,
                                lineHeight: 22,
                                color: HADES.text,
                                opacity: bloqueado ? 0.6 : 1,
                            }}
                        />

                        <View
                            style={{
                                height: 1,
                                marginTop: 12,
                                backgroundColor: ativo ? HADES.accentSolid : HADES.border,
                                opacity: ativo ? 0.55 : 1,
                            }}
                        />
                    </Pressable>
                );
            })}
        </View>
    );
}
