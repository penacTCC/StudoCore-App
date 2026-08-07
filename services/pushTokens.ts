import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "@/repositories/supabase";

/**
 * Registro do token de push (Expo) do aparelho.
 *
 * É o que permite a notificação do "mandar força" chegar com o app FECHADO: a Edge Function
 * `mandar-forca` lê este token com a service role key e chama a API do Expo, que entrega
 * via FCM (Android) / APNs (iOS).
 *
 * Requisitos que não estão no código: credencial FCM V1 subida no EAS
 * (`eas credentials`) e `android.googleServicesFile` no app.json. Sem isso o
 * `getExpoPushTokenAsync` falha — e é por isso que tudo aqui é best-effort: se não der
 * token, o app cai na notificação local via Realtime (ver services/notificacoesForca.ts),
 * que é o comportamento que existia antes.
 */

/** Canal Android das forças. Usado no push remoto e na notificação local, pra os dois
 * aparecerem igual (com som e como banner). */
export const CANAL_FORCAS = "forcas";

/*
  Guarda se este aparelho conseguiu registrar um token. Quem lê é a notificação local do
  Realtime: com push remoto funcionando, disparar a local também mostraria a MESMA força
  duas vezes pra quem estiver com o app aberto.
*/
let tokenDesteAparelho: string | null = null;

/** Há push remoto de pé neste aparelho? Se não, a notificação local é o plano B. */
export function temPushRemoto(): boolean {
    return tokenDesteAparelho !== null;
}

export async function garantirCanalDeForcas(): Promise<void> {
    if (Platform.OS !== "android") return;
    await Notifications.setNotificationChannelAsync(CANAL_FORCAS, {
        name: "Forças recebidas",
        importance: Notifications.AndroidImportance.HIGH,
    });
}

async function garantirPermissao(): Promise<boolean> {
    const atual = await Notifications.getPermissionsAsync();
    if (atual.status === "granted") return true;
    const pedido = await Notifications.requestPermissionsAsync();
    return pedido.status === "granted";
}

/**
 * Pega o token deste aparelho e salva em `push_tokens`. Chamado a cada abertura do app com
 * usuário logado: o token do Expo pode mudar (reinstalação, restore de backup, troca de
 * aparelho), então reescrever sempre é mais barato que descobrir quando mudou.
 */
export async function registrarTokenPush(userId: string): Promise<void> {
    try {
        if (!(await garantirPermissao())) return;
        await garantirCanalDeForcas();

        // Em build EAS o projectId vem do app.json; sem ele o Expo não sabe pra qual
        // projeto emitir o token e a chamada estoura.
        const projectId =
            Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
        if (!projectId) {
            console.warn("Push: projectId do EAS não encontrado — token não registrado.");
            return;
        }

        const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
        if (!token) return;

        const { error } = await supabase
            .from("push_tokens")
            .upsert(
                {
                    user_id: userId,
                    expo_push_token: token,
                    // O servidor roda em UTC e a janela de "não perturbar" é horário local.
                    // Sem isto a Edge Function não tem como saber que são 3h da manhã pra
                    // quem vai receber. Regravado a cada abertura, então acompanha viagem e
                    // horário de verão.
                    fuso_offset_min: new Date().getTimezoneOffset(),
                    updated_at: new Date().toISOString(),
                },
                { onConflict: "user_id" }
            );

        if (error) {
            console.warn("Push: erro ao salvar token:", error.message);
            return;
        }

        tokenDesteAparelho = token;
    } catch (erro) {
        // Emulador sem Play Services, credencial FCM ausente, permissão negada no sistema:
        // nada disso pode quebrar a abertura do app. Sem token, vale a notificação local.
        console.warn("Push: não foi possível registrar o token:", erro);
    }
}

/**
 * Apaga o token da conta que está saindo.
 *
 * Sem isso, o token deste aparelho continuaria colado na conta anterior: uma força mandada
 * pra ela apareceria na tela de quem logasse depois no mesmo aparelho.
 */
export async function removerTokenPush(userId: string): Promise<void> {
    tokenDesteAparelho = null;
    const { error } = await supabase.from("push_tokens").delete().eq("user_id", userId);
    if (error) console.warn("Push: erro ao remover token:", error.message);
}
