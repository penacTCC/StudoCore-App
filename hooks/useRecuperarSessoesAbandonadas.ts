import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { carregarSnapshotSessao } from "@/services/armazenamentoOffline";
import { fecharSessoesAbandonadas, sincronizarFinalizacoesPendentes } from "@/services/sessions";

/**
 * Fecha, ao abrir o app, as sessões de foco que ficaram penduradas de uma vez em que ele
 * morreu no meio do estudo (bateria, force stop, o sistema recuperando memória).
 *
 * Mora no `_layout` porque não depende de nenhuma tela: a pessoa pode reabrir o app na
 * Home, no Cofre ou no Cérebro e mesmo assim o rastro precisa ser limpo — o fantasma dela
 * aparece no feed do grupo dos outros, não no dela.
 *
 * A sessão que ESTE aparelho ainda está tocando é preservada: o snapshot local diz qual é
 * (ver services/armazenamentoOffline.ts), e ela é passada como exceção. Sem isso, abrir o
 * app com uma sessão restaurada em andamento a encerraria pelas costas do usuário.
 */
export const useRecuperarSessoesAbandonadas = (userId?: string | null) => {
    // Uma vez por usuário por execução: rodar de novo a cada render não acharia nada novo.
    const jaRodouPara = useRef<string | null>(null);

    useEffect(() => {
        if (!userId || jaRodouPara.current === userId) return;
        jaRodouPara.current = userId;

        const recuperar = async () => {
            const snapshot = await carregarSnapshotSessao();
            /*
              Só a própria linha de `sessoes_foco` entra na exceção. O `salaId` do snapshot
              não cabe aqui: desde a separação sala/registro pessoal ele identifica uma sala,
              não uma sessão, e a varredura de participações abandonadas já se protege
              sozinha (só fecha o que está sem batimento há mais de 15 min).
            */
            const emAndamento = [snapshot?.sessaoId].filter((id): id is string => !!id);

            await fecharSessoesAbandonadas(userId, emAndamento);
            // Reenvia finalizações que falharam por falha transitória (ver stopSession em focus.tsx).
            await sincronizarFinalizacoesPendentes();
        };

        recuperar();
    }, [userId]);

    /*
      O app ficar dias aberto em segundo plano é comum. Ao voltar do background também vale
      revisar: uma sessão pode ter sido abandonada em outro aparelho nesse meio-tempo.
    */
    useEffect(() => {
        if (!userId) return;

        const inscricao = AppState.addEventListener("change", async (estado) => {
            if (estado !== "active") return;

            const snapshot = await carregarSnapshotSessao();
            /*
              Só a própria linha de `sessoes_foco` entra na exceção. O `salaId` do snapshot
              não cabe aqui: desde a separação sala/registro pessoal ele identifica uma sala,
              não uma sessão, e a varredura de participações abandonadas já se protege
              sozinha (só fecha o que está sem batimento há mais de 15 min).
            */
            const emAndamento = [snapshot?.sessaoId].filter((id): id is string => !!id);

            await fecharSessoesAbandonadas(userId, emAndamento);
            // Reenvia finalizações que falharam por falha transitória (ver stopSession em focus.tsx).
            await sincronizarFinalizacoesPendentes();
        });

        return () => inscricao.remove();
    }, [userId]);
};
