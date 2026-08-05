import { useCallback, useEffect, useState } from 'react';
import { fetchSessionMembers, observarMembrosDaSessao } from '@/services/sessions';
import type { MemberSession } from '@/types/sessions';

/**
 * Mantém a lista de membros de uma sessão de foco em grupo sincronizada em tempo real.
 *
 * Antes, cada tela (foco ativo, colegas focando, prévia da sessão) buscava os membros uma
 * vez só no mount e ficava com a lista congelada até a tela ser recarregada — se um colega
 * pausasse ou terminasse, quem estava olhando só via a mudança saindo e voltando. Este hook
 * centraliza o fetch + a assinatura de realtime (`observarMembrosDaSessao`) que os três
 * lugares duplicavam.
 */
export const useSessionMembers = (sessaoId?: string | null) => {
    const [members, setMembers] = useState<MemberSession[]>([]);
    const [carregando, setCarregando] = useState(true);

    const recarregar = useCallback(async () => {
        if (!sessaoId) {
            setMembers([]);
            setCarregando(false);
            return;
        }

        const { data, error } = await fetchSessionMembers(sessaoId);
        if (error) {
            console.error('Erro ao carregar membros da sessão:', error);
        } else {
            setMembers((data || []) as MemberSession[]);
        }
        setCarregando(false);
    }, [sessaoId]);

    useEffect(() => {
        setCarregando(true);
        recarregar();
    }, [recarregar]);

    // Mantém a lista ao vivo enquanto a tela estiver aberta.
    useEffect(() => {
        if (!sessaoId) return;

        return observarMembrosDaSessao(sessaoId, () => {
            // O payload do realtime não traz o JOIN com profiles, então recarrega a lista
            // inteira para ter nome/foto de quem entrou ou mudou de status.
            recarregar();
        });
    }, [sessaoId, recarregar]);

    /*
      Rede de segurança para o realtime.

      A tela "Focando juntos" repinta o cronômetro de cada colega a cada segundo a partir de
      `ultimo_inicio` (ver utils/tempo.ts -> tempoAoVivoDoMembro). Se o evento de pausa não
      chegar — canal caído, app voltando do background, ou `tab_sessao_membros` fora da
      publicação `supabase_realtime` no projeto remoto —, a cópia local do membro continua
      dizendo "ativo" e o tempo dele segue correndo indefinidamente, que é exatamente o
      sintoma relatado. A rebusca periódica limita esse erro a alguns segundos mesmo quando
      o realtime não está funcionando.
    */
    useEffect(() => {
        if (!sessaoId) return;

        const id = setInterval(recarregar, 10000);
        return () => clearInterval(id);
    }, [sessaoId, recarregar]);

    return { members, carregando, recarregar };
};
