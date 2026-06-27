import { useEffect, useState } from "react";

//Componentes do react native
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { Ionicons } from "@expo/vector-icons";

//Componentes do expo router
import { router, useLocalSearchParams } from "expo-router";
import * as Linking from 'expo-linking';
import * as Contacts from 'expo-contacts';

//Constantes
import { COLORS } from "@/constants/colors";

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
            if (status !== 'granted') {
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
        const cleaned = value.replace(/\D/g, '');
        return cleaned;
    };

    const handleSendInvite = async () => {
        if (zapNumber.trim().length === 11) {
            const phoneNumber = formatPhoneNumber(zapNumber);
            enviarConviteWhatsapp(phoneNumber);
        } else {
            Alert.alert("Número de telefone inválido");
        }
    }

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
    }

    return (
        <SafeAreaView className="flex-1 bg-navy-950" edges={["top"]}>
            {/* Header */}
            <View className="px-4 py-3 flex-row items-center justify-between border-b border-navy-800">
                <Text className="text-xl font-bold text-slate-200">Convites</Text>
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center"
                >
                    <X size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>

                {/* Invite Link Section */}
                <ShareLink inviteLink={inviteLink} />

                {/* Email Invite Section */}
                <View className="mb-6">
                    <Text className="text-sm text-slate-400 mb-3">Ou convide pelo WhatsApp</Text>
                    <View className="flex-row items-center gap-2">
                        <TextInput
                            value={zapNumber}
                            onChangeText={(value) => setZapNumber(formatPhoneNumber(value))}
                            maxLength={11}
                            placeholder="(15) 99123-4567"
                            placeholderTextColor={COLORS.textMuted}
                            autoCapitalize="none"
                            keyboardType="phone-pad"
                            className="flex-1 bg-navy-900 border border-navy-800 rounded-xl px-4 py-3 text-slate-200 text-base"
                        />
                        <TouchableOpacity
                            onPress={handleSendInvite}
                            className={`px-4 py-3 rounded-xl ${zapNumber.trim() ? "bg-brand-500" : "bg-navy-800"}`}
                        >
                            <Ionicons name="logo-whatsapp" size={18} color={zapNumber.trim() ? COLORS.white : COLORS.textMuted} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Contatos do telefone */}
                <View className="border-t border-navy-800 pt-6">
                    <Text className="text-sm font-medium text-slate-400 mb-4">Seus Contatos</Text>

                    {carregandoContatos && (
                        <ActivityIndicator color={COLORS.textMuted} />
                    )}

                    {!carregandoContatos && permissaoNegada && (
                        <Text className="text-sm text-slate-500">
                            Permita o acesso aos contatos nas configurações do app para convidar seus amigos.
                        </Text>
                    )}

                    {!carregandoContatos && !permissaoNegada && contatos.length > 0 && (
                        <View className="flex-row items-center bg-navy-900 border border-navy-800 rounded-xl px-3 mb-4">
                            <Ionicons name="search" size={16} color={COLORS.textMuted} />
                            <TextInput
                                value={buscaContato}
                                onChangeText={setBuscaContato}
                                placeholder="Buscar contato"
                                placeholderTextColor={COLORS.textMuted}
                                autoCapitalize="none"
                                className="flex-1 px-2 py-3 text-slate-200 text-sm"
                            />
                        </View>
                    )}

                    {!carregandoContatos && !permissaoNegada && contatos.length === 0 && (
                        <Text className="text-sm text-slate-500">Nenhum contato com telefone encontrado.</Text>
                    )}

                    {!carregandoContatos && !permissaoNegada && contatos.length > 0 && contatosFiltrados.length === 0 && (
                        <Text className="text-sm text-slate-500">Nenhum contato encontrado para "{buscaContato}".</Text>
                    )}

                    <View className="gap-2">
                        {contatosFiltrados.map((contato) => (
                            <View
                                key={contato.id}
                                className="flex-row items-center justify-between bg-navy-900 border border-navy-800 p-4 rounded-xl"
                            >
                                <View className="flex-row items-center flex-1 pr-2">
                                    {contato.foto ? (
                                        <Image source={{ uri: contato.foto }} className="w-9 h-9 rounded-full mr-3" />
                                    ) : (
                                        <View className="w-9 h-9 rounded-full bg-navy-800 items-center justify-center mr-3">
                                            <Text className="text-xs font-semibold text-slate-400">
                                                {contato.nome.charAt(0).toUpperCase()}
                                            </Text>
                                        </View>
                                    )}
                                    <Text className="text-sm text-slate-300 flex-1" numberOfLines={1}>
                                        {contato.nome}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => enviarConviteWhatsapp(contato.telefone)}
                                    className="w-8 h-8 rounded-full bg-brand-500 items-center justify-center"
                                >
                                    <Ionicons name="logo-whatsapp" size={16} color={COLORS.white} />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
