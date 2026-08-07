import { useEffect, useState } from "react";
import {
    assinarNotificacoesNaoLidas,
    carregarNotificacoesNaoLidas,
    definirNotificacoesNaoLidas,
    obterNotificacoesNaoLidas,
    observarNotificacoes,
} from "@/services/notificacoesComunidade";

/**
 * Quantas notificações do feed público estão por ler — alimenta o badge da aba Comunidade.
 *
 * Mesmo desenho do `useFormulariosPendentes`: o número vive num store fora do React,
 * porque a tab bar precisa dele sem estar dentro de nenhuma tela. A diferença é que aqui
 * ninguém mais lê essa tabela, então o hook busca na entrada e assina o Realtime para o
 * badge subir sozinho enquanto o app está aberto.
 */
export function useNotificacoesNaoLidas(userId: string | null | undefined) {
    const [contagem, setContagem] = useState(obterNotificacoesNaoLidas);

    useEffect(() => assinarNotificacoesNaoLidas(setContagem), []);

    useEffect(() => {
        if (!userId) {
            // Trocar de conta não pode deixar o badge da conta anterior na tela.
            definirNotificacoesNaoLidas(0);
            return;
        }

        carregarNotificacoesNaoLidas();
        return observarNotificacoes(userId, carregarNotificacoesNaoLidas);
    }, [userId]);

    return contagem;
}

/**
 * Só lê o número que o hook acima mantém.
 *
 * Existe porque `useNotificacoesNaoLidas` abre um canal de Realtime, e o supabase-js
 * reaproveita canal pelo nome: dois hooks com o mesmo `userId` estourariam ao assinar o
 * canal já assinado. Quem só quer desenhar o badge (o sino do cabeçalho) usa este.
 */
export function useContagemDeNotificacoes() {
    const [contagem, setContagem] = useState(obterNotificacoesNaoLidas);
    useEffect(() => assinarNotificacoesNaoLidas(setContagem), []);
    return contagem;
}
