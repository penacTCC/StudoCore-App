import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    buscarIncentivosDaSala,
    buscarPerfilRemetenteDoIncentivo,
    mandarForca,
    observarIncentivosDaSala,
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
    /*
      `true` sem sessão e enquanto o canal de incentivos ainda não confirmou a inscrição.
      Mandar força antes disso não falha (a Edge Function grava do mesmo jeito), mas o INSERT
      pode não chegar de volta pelo realtime para ninguém na sala ainda inscrevendo — ver o
      mesmo raciocínio em `useParticipantesDaSala`.
    */
    const [pronto, setPronto] = useState(!sessaoId);
    // Tick de 1s só pra recalcular a contagem regressiva do cooldown na tela.
    const [tick, setTick] = useState(0);

    const recarregar = useCallback(async () => {
        if (!sessaoId) {
            setIncentivos([]);
            setCarregando(false);
            return;
        }

        const { data, error } = await buscarIncentivosDaSala(sessaoId);

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

    /*
      Funde o incentivo novo na lista em vez de recarregar a torcida inteira a cada envio —
      numa sessão com N pessoas vendo a tela, cada "mandar força" gerava N refetches
      completos. O payload do realtime não traz o JOIN com profiles, então busca só o
      perfil de quem mandou (uma consulta de 1 linha).
      Quando o incentivo é o meu próprio envio, substitui o item otimista já inserido em
      `enviarForca` em vez de duplicar.
    */
    const aplicarNovoIncentivo = useCallback(async (novo: Incentivo) => {
        const perfil = await buscarPerfilRemetenteDoIncentivo(novo.remetente_id);
        const comPerfil: Incentivo = { ...novo, profiles: perfil ?? undefined };

        setIncentivos((atuais) => {
            if (atuais.some((i) => i.id === comPerfil.id)) return atuais;

            const idxOtimista = atuais.findIndex(
                (i) =>
                    i.id.startsWith('otimista-') &&
                    i.remetente_id === comPerfil.remetente_id &&
                    i.destinatario_id === comPerfil.destinatario_id
            );

            if (idxOtimista !== -1) {
                const copia = [...atuais];
                copia[idxOtimista] = comPerfil;
                return copia;
            }

            return [...atuais, comPerfil];
        });
    }, []);

    // Mantém a torcida ao vivo enquanto a tela estiver aberta.
    useEffect(() => {
        setPronto(!sessaoId);
        if (!sessaoId) return;

        return observarIncentivosDaSala(sessaoId, aplicarNovoIncentivo, (status) => {
            if (status === "SUBSCRIBED") setPronto(true);
        });
    }, [sessaoId, aplicarNovoIncentivo]);

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

    /**
     * Quem pode receber minha força: qualquer participante que não seja eu, e só depois que
     * o canal de incentivos confirmar a inscrição (ver `pronto` acima). O botão de torcer
     * some enquanto isso — reaparece assim que a sala termina de se estabilizar.
     */
    const podeTorcerPor = useCallback(
        (destinatarioId?: string | null) => pronto && !!destinatarioId && !!userId && destinatarioId !== userId,
        [pronto, userId]
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
              da Edge Function. O item é temporário (id "otimista-...") e é substituído pelo
              registro real quando o INSERT chega pelo realtime (ver `aplicarNovoIncentivo`).
            */
            const otimista: Incentivo = {
                id: `otimista-${userId}-${destinatarioId}-${Date.now()}`,
                sessao_id: null,
                sala_id: sessaoId,
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
            }
            // No sucesso, o próprio remetente também está inscrito no realtime da sala e
            // recebe o INSERT de volta — `aplicarNovoIncentivo` substitui o otimista pelo
            // registro real, sem precisar de outro fetch aqui.

            setEnviandoPara(null);
        },
        [sessaoId, userId, enviandoPara, podeTorcerPor, cooldownRestante]
    );

    return {
        incentivos,
        total: incentivos.length,
        torcedores,
        carregando,
        pronto,
        enviandoPara,
        contarPara,
        podeTorcerPor,
        enviosRestantes,
        cooldownRestante,
        enviarForca,
        recarregar,
    };
};
