import { useEffect, useState } from "react";
import {
    assinarNotificacoesNaoLidas,
    carregarNotificacoesNaoLidas,
    definirNotificacoesNaoLidas,
    obterNotificacoesNaoLidas,
    observarNotificacoes,
} from "@/services/notificacoes";

/**
 * Quantas notificações estão por ler — alimenta o badge da aba Comunidade e o sino.
 *
 * Conta a caixa INTEIRA (curtida, comentário, força, grupo), não só a Comunidade: desde a
 * migration 20260807240000 a caixa é do app todo. O badge continua na aba Comunidade
 * porque é de lá que se chega nela, pelo sino do cabeçalho.
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
 * Existe porque `useNotificacoesNaoLidas` abre um canal de Realtime e refaz a contagem no
 * banco a cada evento. Quem só quer desenhar o badge (o sino do cabeçalho) usa este e não
 * paga por isso de novo.
 */
export function useContagemDeNotificacoes() {
    const [contagem, setContagem] = useState(obterNotificacoesNaoLidas);
    useEffect(() => assinarNotificacoesNaoLidas(setContagem), []);
    return contagem;
}
