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

      /*
        A limpeza do último grupo roda ANTES de saber se a pessoa participa de algum grupo,
        e não mais só dentro do `if (participaDeGrupo)`. Naquele lugar, uma conta que não
        estava em grupo nenhum nunca chegava a limpar — o id do grupo alheio continuava no
        aparelho e a tela de foco o usava como fallback ao gravar `grupo_id` na sessão.
      */
      const ultimoGrupoId = await carregarUltimoGrupoLocalmente();

      if (ultimoGrupoId) {
        const participaDoUltimo = await usuarioParticipaDoGrupo(session.user.id, ultimoGrupoId);
        if (!participaDoUltimo) await limparUltimoGrupoLocalmente();
      }

      const participaDeGrupo = await usuarioParticipaDeGrupo(session.user.id);
      setMembro(participaDeGrupo);

      if (participaDeGrupo) {
        let parametrosParaSalvar: ParametrosUltimoGrupo | null = null;

        // Relê depois da limpeza: se o id não era desta conta, aqui já volta nulo.
        const ultimoGrupoValidado = await carregarUltimoGrupoLocalmente();

        if (ultimoGrupoValidado) {
          const grupo = await buscarGrupoPorId(ultimoGrupoValidado);
          if (grupo) {
            parametrosParaSalvar = {
              groupId: grupo.id,
              groupName: grupo.nome_grupo,
              groupPhoto: grupo.foto_grupo,
              groupGoal: grupo.meta_horas
            };
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
