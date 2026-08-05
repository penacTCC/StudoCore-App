import { useState, useEffect } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { carregarUltimoGrupoLocalmente, limparUltimoGrupoLocalmente } from '@/services/armazenamentoOffline';
import { buscarGrupoPorId, usuarioParticipaDeGrupo, usuarioParticipaDoGrupo } from '@/services/grupos';
import { Session } from '@supabase/supabase-js';
import { ParametrosUltimoGrupo } from '@/types/grupos';

export function useStatusMembroGrupo(session: Session | null, inicializado: boolean) {
  const [membro, setMembro] = useState<boolean | null>(null);
  const [parametrosUltimoGrupo, setParametrosUltimoGrupo] = useState<ParametrosUltimoGrupo | null | undefined>(undefined);

  useEffect(() => {
    if (!inicializado) return;

    if (!session) {
      setMembro(false);
      setParametrosUltimoGrupo(null);
      return;
    }

    const verificarGrupo = async () => {
      setMembro(null);
      setParametrosUltimoGrupo(undefined);

      const participaDeGrupo = await usuarioParticipaDeGrupo(session.user.id);
      setMembro(participaDeGrupo);

      if (participaDeGrupo) {
        const ultimoGrupoId = await carregarUltimoGrupoLocalmente();
        let parametrosParaSalvar: ParametrosUltimoGrupo | null = null;

        if (ultimoGrupoId) {
          // O id fica salvo no aparelho, não na conta: sem validar a participação, ao trocar
          // de conta a pessoa caía direto nas tabs do grupo de quem usou o app antes.
          const participaDoUltimo = await usuarioParticipaDoGrupo(session.user.id, ultimoGrupoId);

          if (!participaDoUltimo) {
            await limparUltimoGrupoLocalmente();
          } else {
            const grupo = await buscarGrupoPorId(ultimoGrupoId);
            if (grupo) {
              parametrosParaSalvar = {
                groupId: grupo.id,
                groupName: grupo.nome_grupo,
                groupPhoto: grupo.foto_grupo,
                groupGoal: grupo.meta_horas
              };
            }
          }
        }

        setParametrosUltimoGrupo(parametrosParaSalvar);
        setMembro(true);
      } else {
        setParametrosUltimoGrupo(null);
      }
    };

    verificarGrupo();

    const subscription = DeviceEventEmitter.addListener('groupMembershipChanged', verificarGrupo);

    return () => subscription.remove();
  }, [session, inicializado]);

  return { membro, parametrosUltimoGrupo };
}
