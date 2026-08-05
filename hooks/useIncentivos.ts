import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    buscarIncentivosDaSessao,
    mandarForca,
    observarIncentivosDaSessao,
} from '@/services/incentivos';
import { useAuth } from '@/hooks/useAuth';
import type { Incentivo } from '@/types/incentivos';

// Mesma regra da Edge Function `mandar-forca`: até 3 envios por (eu, destinatário) numa
// janela móvel de 15min. Manter os dois em sincronia é o que faz a UI não prometer um
// envio que o servidor vai recusar.
const JANELA_MS = 15 * 60 * 1000;
const LIMITE_ENVIOS = 3;

/**
 * Controla o "mandar força" de uma sessão pública.
 *
 * Não é mais um toggle (manda/desfaz): é um envio repetível, limitado a 3 vezes a cada
 * 15min por (eu, destinatário) — o cooldown de verdade é decidido pela Edge Function
 * `mandar-forca`; aqui só refletimos isso pra UI (botão desabilitado + contagem
 * regressiva) usando os incentivos já carregados, sem fetch extra.
 *
 * A torcida é por pessoa, não por sessão: quem está vendo pode mandar força para qualquer
 * participante que esteja focando ali. Por isso o hook carrega os incentivos da sessão
 * inteira de uma vez e expõe consultas por destinatário — assim uma lista com N
 * participantes não dispara N consultas nem N canais de realtime.
 */
export const useIncentivos = (sessaoId?: string | null) => {
    const { userId } = useAuth();
    const [incentivos, setIncentivos] = useState<Incentivo[]>([]);
    const [carregando, setCarregando] = useState(true);
    // Guarda para quem está indo uma requisição agora, para travar só aquele botão.
    const [enviandoPara, setEnviandoPara] = useState<string | null>(null);
    // Tick de 1s só pra recalcular a contagem regressiva do cooldown na tela.
    const [tick, setTick] = useState(0);

    const recarregar = useCallback(async () => {
        if (!sessaoId) {
            setIncentivos([]);
            setCarregando(false);
            return;
        }

        const { data, error } = await buscarIncentivosDaSessao(sessaoId);

        if (error) {
            console.warn('Erro ao carregar incentivos da sessão:', error);
        } else {
            setIncentivos(data);
        }

        setCarregando(false);
    }, [sessaoId]);

    useEffect(() => {
        setCarregando(true);
        recarregar();
    }, [recarregar]);

    // Mantém a torcida ao vivo enquanto a tela estiver aberta.
    useEffect(() => {
        if (!sessaoId) return;

        return observarIncentivosDaSessao(sessaoId, () => {
            // Recarrega a lista inteira porque o payload do realtime não traz o JOIN com
            // profiles, e a UI precisa do nome de quem torceu para montar a Torcida.
            recarregar();
        });
    }, [sessaoId, recarregar]);

    useEffect(() => {
        const id = setInterval(() => setTick((t) => t + 1), 1000);
        return () => clearInterval(id);
    }, []);

    /** Nomes de quem torceu nesta sessão, sem repetir quem torceu por mais de uma pessoa. */
    const torcedores = useMemo(() => {
        const porRemetente = new Map<string, string>();

        incentivos.forEach((incentivo) => {
            if (porRemetente.has(incentivo.remetente_id)) return;
            porRemetente.set(
                incentivo.remetente_id,
                incentivo.profiles?.nome_usuario || incentivo.profiles?.nome_real || 'Alguém'
            );
        });

        return [...porRemetente.values()];
    }, [incentivos]);

    const contarPara = useCallback(
        (destinatarioId: string) =>
            incentivos.filter((incentivo) => incentivo.destinatario_id === destinatarioId).length,
        [incentivos]
    );

    /** Quem pode receber minha força: qualquer participante que não seja eu. */
    const podeTorcerPor = useCallback(
        (destinatarioId?: string | null) => !!destinatarioId && !!userId && destinatarioId !== userId,
        [userId]
    );

    /** Minhas forças pra essa pessoa dentro da janela de 15min, da mais antiga pra mais nova. */
    const enviosNaJanela = useCallback(
        (destinatarioId: string) =>
            incentivos
                .filter((i) => i.remetente_id === userId && i.destinatario_id === destinatarioId)
                .filter((i) => Date.now() - new Date(i.created_at).getTime() < JANELA_MS)
                .sort((a, b) => a.created_at.localeCompare(b.created_at)),
        // `tick` não é usado no corpo — só força recalcular a cada segundo, pra que uma força
        // que saiu da janela libere o botão sozinho, sem precisar reabrir a tela.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [incentivos, userId, tick]
    );

    /** Quantas forças ainda posso mandar pra essa pessoa agora (0 = travado). */
    const enviosRestantes = useCallback(
        (destinatarioId: string) => Math.max(0, LIMITE_ENVIOS - enviosNaJanela(destinatarioId).length),
        [enviosNaJanela]
    );

    /**
     * Segundos até eu poder mandar força de novo pra essa pessoa (0 = liberado agora).
     * Só passa de 0 depois do 3º envio — aí conta até a mais antiga dos 3 sair da janela.
     */
    const cooldownRestante = useCallback(
        (destinatarioId: string) => {
            const recentes = enviosNaJanela(destinatarioId);
            if (recentes.length < LIMITE_ENVIOS) return 0;

            const maisAntiga = new Date(recentes[0].created_at).getTime();
            const restanteMs = maisAntiga + JANELA_MS - Date.now();
            return restanteMs > 0 ? Math.ceil(restanteMs / 1000) : 0;
        },
        [enviosNaJanela]
    );

    const enviarForca = useCallback(
        async (destinatarioId: string) => {
            if (!sessaoId || !podeTorcerPor(destinatarioId)) return;
            if (enviandoPara) return;
            if (cooldownRestante(destinatarioId) > 0) return;

            setEnviandoPara(destinatarioId);

            /*
              Atualização otimista: mostra a força enviada na hora, sem esperar a ida e volta
              da Edge Function. O item é temporário (id "otimista-...") e some no recarregar()
              logo abaixo, quando chega o registro real com UUID e o JOIN de profiles.
            */
            const otimista: Incentivo = {
                id: `otimista-${userId}-${destinatarioId}-${Date.now()}`,
                sessao_id: sessaoId,
                remetente_id: userId as string,
                destinatario_id: destinatarioId,
                created_at: new Date().toISOString(),
            };
            setIncentivos((atuais) => [...atuais, otimista]);

            const { error } = await mandarForca(sessaoId, destinatarioId);

            if (error) {
                console.warn('Erro ao mandar força:', error);
                // Deu errado (ou o servidor recusou o cooldown): desfaz o otimista.
                setIncentivos((atuais) => atuais.filter((i) => i.id !== otimista.id));
            } else {
                await recarregar();
            }

            setEnviandoPara(null);
        },
        [sessaoId, userId, enviandoPara, podeTorcerPor, cooldownRestante, recarregar]
    );

    return {
        incentivos,
        total: incentivos.length,
        torcedores,
        carregando,
        enviandoPara,
        contarPara,
        podeTorcerPor,
        enviosRestantes,
        cooldownRestante,
        enviarForca,
        recarregar,
    };
};
