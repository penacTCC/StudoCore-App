import { useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

const PREFIXO_CHAVE = "@wrapped_mensal_auto_visto";

function chaveDoMes(userId: string, agora: Date) {
    return `${PREFIXO_CHAVE}:${userId}:${agora.getFullYear()}-${agora.getMonth()}`;
}

/**
 * Abre o Wrapped mensal sozinho na primeira vez que o app é aberto no dia 1 — quem não
 * tocar o push (ou estiver com o app fechado nele) ainda vê o resumo assim que voltar,
 * sem precisar procurar o banner do perfil (ver `estaNaJanelaDoWrapped` em
 * lib/wrappedMensal.ts pros dias 2 e 3, que ficam só com acesso manual).
 *
 * `pronto` é quem chama decide quando: precisa ser depois que o roteamento inicial já
 * pousou nas tabs (useRouteGuard), senão o `router.push` empilha sobre uma tela de auth.
 *
 * A trava por AsyncStorage é por mês+usuário, não por sessão do app: sem ela, reabrir o
 * app várias vezes no dia 1 abriria o modal de novo a cada vez.
 */
export function useAberturaAutomaticaWrapped(userId: string | null | undefined, pronto: boolean) {
    const jaTentou = useRef(false);

    useEffect(() => {
        if (!userId || !pronto || jaTentou.current) return;

        const agora = new Date();
        if (agora.getDate() !== 1) return;

        jaTentou.current = true;
        const chave = chaveDoMes(userId, agora);

        AsyncStorage.getItem(chave).then((visto) => {
            if (visto) return;
            AsyncStorage.setItem(chave, "true").catch(() => {});
            // Pequeno atraso pra deixar a navegação inicial (useRouteGuard) assentar antes
            // de empilhar o modal por cima.
            setTimeout(() => router.push("/(modals)/wrapped-mensal"), 600);
        });
    }, [userId, pronto]);
}
