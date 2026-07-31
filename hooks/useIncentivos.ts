import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    buscarIncentivosDaSessao,
    enviarIncentivo,
    observarIncentivosDaSessao,
    removerIncentivo,
} from '@/services/incentivos';
import { useAuth } from '@/hooks/useAuth';
import type { Incentivo } from '@/types/incentivos';

/**
 * Controla a torcida ("Mandar força") de uma sessão pública.
 *
 * A torcida é por pessoa, não por sessão: quem está vendo pode mandar força para
 * qualquer participante que esteja focando ali. Por isso o hook carrega os incentivos da
 * sessão inteira de uma vez e expõe consultas por destinatário — assim uma lista com N
 * participantes não dispara N consultas nem N canais de realtime.
 */
export const useIncentivos = (sessaoId?: string | null) => {
    const { userId } = useAuth();
    const [incentivos, setIncentivos] = useState<Incentivo[]>([]);
    const [carregando, setCarregando] = useState(true);
    // Guarda para quem está indo uma requisição agora, para travar só aquele botão.
    const [enviandoPara, setEnviandoPara] = useState<string | null>(null);

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

    const euMandeiPara = useCallback(
        (destinatarioId: string) =>
            incentivos.some(
                (incentivo) =>
                    incentivo.destinatario_id === destinatarioId && incentivo.remetente_id === userId
            ),
        [incentivos, userId]
    );

    /** Quem pode receber minha força: qualquer participante que não seja eu. */
    const podeTorcerPor = useCallback(
        (destinatarioId?: string | null) => !!destinatarioId && !!userId && destinatarioId !== userId,
        [userId]
    );

    const alternarPara = useCallback(
        async (destinatarioId: string) => {
            if (!sessaoId || !podeTorcerPor(destinatarioId)) return;
            if (enviandoPara) return;

            setEnviandoPara(destinatarioId);

            const payload = {
                sessao_id: sessaoId,
                remetente_id: userId as string,
                destinatario_id: destinatarioId,
            };
            const jaMandei = euMandeiPara(destinatarioId);

            // Guarda a lista atual para conseguir voltar atrás se o servidor recusar.
            const estadoAnterior = incentivos;

            /*
              Atualização otimista: mexe na lista local ANTES da resposta do Supabase, para o
              contador reagir na hora em vez de esperar a ida e volta da rede. O item inserido
              é temporário (id "otimista-...") e some no recarregar() logo abaixo, quando chega
              o registro real com UUID e o JOIN de profiles.
            */
            if (jaMandei) {
                setIncentivos((atuais) =>
                    atuais.filter(
                        (incentivo) =>
                            !(incentivo.destinatario_id === destinatarioId && incentivo.remetente_id === userId)
                    )
                );
            } else {
                const otimista: Incentivo = {
                    id: `otimista-${userId}-${destinatarioId}`,
                    sessao_id: sessaoId,
                    remetente_id: userId as string,
                    destinatario_id: destinatarioId,
                    created_at: new Date().toISOString(),
                };
                setIncentivos((atuais) => [...atuais, otimista]);
            }

            const { error } = jaMandei ? await removerIncentivo(payload) : await enviarIncentivo(payload);

            if (error) {
                console.warn('Erro ao alternar incentivo:', error);
                // Deu errado: restaura a lista como estava antes do toque.
                setIncentivos(estadoAnterior);
            } else {
                await recarregar();
            }

            setEnviandoPara(null);
        },
        [sessaoId, userId, enviandoPara, euMandeiPara, incentivos, podeTorcerPor, recarregar]
    );

    return {
        incentivos,
        total: incentivos.length,
        torcedores,
        carregando,
        enviandoPara,
        contarPara,
        euMandeiPara,
        podeTorcerPor,
        alternarPara,
        recarregar,
    };
};
