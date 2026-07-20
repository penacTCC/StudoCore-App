import { useEffect, useState } from "react";

//Componentes do react native
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { Ionicons } from "@expo/vector-icons";

//Componentes do expo router
import { router, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import * as Contacts from "expo-contacts";

//Constantes
import { HADES } from "@/constants/hades";

//Componentes do projeto
import ShareLink from "@/components/ShareLink";
import { inserirCodigoConvite } from "@/services/grupos";

type Contato = {
    id: string;
    nome: string;
    telefone: string;
    foto?: string;
};

export default function InviteScreen() {
    const [zapNumber, setZapNumber] = useState("");
    const [contatos, setContatos] = useState<Contato[]>([]);
    const [carregandoContatos, setCarregandoContatos] = useState(true);
    const [permissaoNegada, setPermissaoNegada] = useState(false);
    const [buscaContato, setBuscaContato] = useState("");

    const { grupoId, grupoCode } = useLocalSearchParams();

    // Gera o link sempre a partir do grupoId (estável), nunca a partir do valor salvo
    // anteriormente — caso contrário, cada visita embrulha o link salvo em outro "studocore://".
    const inviteLink = `https://studocore-convite.netlify.app/join?groupId=${grupoId}`;

    //Insere o código de convite na tabela grupos (só escreve se ainda não estiver correto,
    //o que também corrige sozinho qualquer valor duplicado que já esteja salvo)
    useEffect(() => {
        if (grupoCode === inviteLink) return;
        inserirCodigoConvite(grupoId as string, inviteLink);
    }, []);

    //Busca os contatos do telefone que tenham número de telefone cadastrado
    useEffect(() => {
        (async () => {
            const { status } = await Contacts.requestPermissionsAsync();
            if (status !== "granted") {
                setPermissaoNegada(true);
                setCarregandoContatos(false);
                return;
            }

            const { data } = await Contacts.getContactsAsync({
                fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Image],
            });

            const lista: Contato[] = data
                .filter((c) => c.name && c.phoneNumbers && c.phoneNumbers.length > 0)
                .map((c) => ({
                    id: c.id ?? c.name!,
                    nome: c.name!,
                    telefone: c.phoneNumbers![0].number ?? "",
                    foto: c.image?.uri,
                }))
                .sort((a, b) => a.nome.localeCompare(b.nome));

            setContatos(lista);
            setCarregandoContatos(false);
        })();
    }, []);

    const contatosFiltrados = contatos.filter((contato) =>
        contato.nome.toLowerCase().includes(buscaContato.trim().toLowerCase())
    );

    //Formata o número de telefone
    const formatPhoneNumber = (value: string) => {
        // Remove todos os caracteres não numéricos
        const cleaned = value.replace(/\D/g, "");
        return cleaned;
    };

    const handleSendInvite = async () => {
        if (zapNumber.trim().length === 11) {
            const phoneNumber = formatPhoneNumber(zapNumber);
            enviarConviteWhatsapp(phoneNumber);
        } else {
            Alert.alert("Número de telefone inválido");
        }
    };

    //Abre o WhatsApp com a mensagem de convite já preenchida para o número informado.
    //Remove o DDI 55 caso já esteja presente no número do contato, para não duplicar.
    const enviarConviteWhatsapp = (numero: string) => {
        let digitos = formatPhoneNumber(numero);
        if (digitos.length > 11 && digitos.startsWith("55")) {
            digitos = digitos.slice(2);
        }

        if (digitos.length < 10) {
            Alert.alert("Número de telefone inválido");
            return;
        }

        const mensagem = `Venha estudar comigo no *StudoCore*!\n\n${inviteLink}`;
        const url = `https://wa.me/55${digitos}?text=${encodeURIComponent(mensagem)}`;
        Linking.openURL(url);
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: HADES.bg }} edges={["top"]}>
            {/* Header */}
            <View
                style={{
                    paddingTop: 6,
                    paddingHorizontal: 20,
                    paddingBottom: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <Text style={{ fontSize: 20, fontWeight: "700", color: HADES.text }}>Convites</Text>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        backgroundColor: HADES.surfaceRaised,
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <X size={18} color={HADES.textSecondary} />
                </TouchableOpacity>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 16 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Invite Link Section */}
                <ShareLink inviteLink={inviteLink} />

                {/* WhatsApp Invite Section */}
                <View style={{ marginBottom: 24 }}>
                    <Text style={{ fontSize: 14, color: HADES.textMuted, marginBottom: 12 }}>Ou convide pelo WhatsApp</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <TextInput
                            value={zapNumber}
                            onChangeText={(value) => setZapNumber(formatPhoneNumber(value))}
                            maxLength={11}
                            placeholder="(15) 99123-4567"
                            placeholderTextColor={HADES.textFaint}
                            autoCapitalize="none"
                            keyboardType="phone-pad"
                            style={{
                                flex: 1,
                                backgroundColor: HADES.surfaceRaised,
                                borderWidth: 1,
                                borderColor: HADES.border,
                                borderRadius: 13,
                                paddingHorizontal: 16,
                                paddingVertical: 13,
                                color: HADES.text,
                                fontSize: 15,
                            }}
                        />
                        <TouchableOpacity
                            onPress={handleSendInvite}
                            activeOpacity={0.85}
                            style={{
                                paddingHorizontal: 16,
                                paddingVertical: 13,
                                borderRadius: 13,
                                backgroundColor: zapNumber.trim() ? HADES.accentSolid : HADES.surfaceOverlay,
                            }}
                        >
                            <Ionicons name="logo-whatsapp" size={18} color={zapNumber.trim() ? "#000" : HADES.textFaint} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Contatos do telefone */}
                <View style={{ borderTopWidth: 1, borderTopColor: HADES.border, paddingTop: 20 }}>
                    <Text style={{ fontSize: 14, fontWeight: "500", color: HADES.textMuted, marginBottom: 16 }}>
                        Seus Contatos
                    </Text>

                    {carregandoContatos && <ActivityIndicator color={HADES.textMuted} />}

                    {!carregandoContatos && permissaoNegada && (
                        <Text style={{ fontSize: 14, color: HADES.textDim }}>
                            Permita o acesso aos contatos nas configurações do app para convidar seus amigos.
                        </Text>
                    )}

                    {!carregandoContatos && !permissaoNegada && contatos.length > 0 && (
                        <View
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                backgroundColor: HADES.surfaceRaised,
                                borderWidth: 1,
                                borderColor: HADES.border,
                                borderRadius: 13,
                                paddingHorizontal: 12,
                                marginBottom: 16,
                            }}
                        >
                            <Ionicons name="search" size={16} color={HADES.textFaint} />
                            <TextInput
                                value={buscaContato}
                                onChangeText={setBuscaContato}
                                placeholder="Buscar contato"
                                placeholderTextColor={HADES.textFaint}
                                autoCapitalize="none"
                                style={{ flex: 1, paddingHorizontal: 8, paddingVertical: 12, color: HADES.text, fontSize: 14 }}
                            />
                        </View>
                    )}

                    {!carregandoContatos && !permissaoNegada && contatos.length === 0 && (
                        <Text style={{ fontSize: 14, color: HADES.textDim }}>Nenhum contato com telefone encontrado.</Text>
                    )}

                    {!carregandoContatos && !permissaoNegada && contatos.length > 0 && contatosFiltrados.length === 0 && (
                        <Text style={{ fontSize: 14, color: HADES.textDim }}>
                            Nenhum contato encontrado para "{buscaContato}".
                        </Text>
                    )}

                    <View style={{ gap: 8 }}>
                        {contatosFiltrados.map((contato) => (
                            <View
                                key={contato.id}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    backgroundColor: HADES.surface,
                                    borderWidth: 1,
                                    borderColor: HADES.border,
                                    padding: 12,
                                    borderRadius: 14,
                                }}
                            >
                                <View style={{ flexDirection: "row", alignItems: "center", flex: 1, paddingRight: 8 }}>
                                    {contato.foto ? (
                                        <Image
                                            source={{ uri: contato.foto }}
                                            style={{ width: 36, height: 36, borderRadius: 18, marginRight: 12 }}
                                        />
                                    ) : (
                                        <View
                                            style={{
                                                width: 36,
                                                height: 36,
                                                borderRadius: 18,
                                                backgroundColor: HADES.surfaceOverlay,
                                                alignItems: "center",
                                                justifyContent: "center",
                                                marginRight: 12,
                                            }}
                                        >
                                            <Text style={{ fontSize: 12, fontWeight: "600", color: HADES.textMuted }}>
                                                {contato.nome.charAt(0).toUpperCase()}
                                            </Text>
                                        </View>
                                    )}
                                    <Text style={{ fontSize: 14, color: HADES.textSecondary, flex: 1 }} numberOfLines={1}>
                                        {contato.nome}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => enviarConviteWhatsapp(contato.telefone)}
                                    activeOpacity={0.85}
                                    style={{
                                        width: 34,
                                        height: 34,
                                        borderRadius: 17,
                                        backgroundColor: HADES.accentSolid,
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <Ionicons name="logo-whatsapp" size={16} color="#000" />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
