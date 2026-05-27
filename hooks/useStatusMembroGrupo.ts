import { useState, useEffect } from 'react';
import { carregarUltimoGrupoLocalmente } from '@/services/armazenamentoOffline';
import { buscarGrupoPorId, usuarioParticipaDeGrupo } from '@/services/grupos';
import { Session } from '@supabase/supabase-js';
import { ParametrosUltimoGrupo } from '@/types/grupos';

export function useStatusMembroGrupo(session: Session | null, inicializado: boolean) {
  const [membro, setMembro] = useState<boolean | null>(null);
  const [parametrosUltimoGrupo, setParametrosUltimoGrupo] = useState<ParametrosUltimoGrupo | null | undefined>(undefined);

  useEffect(() => {
    if (!inicializado) return;

    if (!session) {
      setMembro(false);
      return;
    }

    const verificarGrupo = async () => {
      const participaDeGrupo = await usuarioParticipaDeGrupo(session.user.id);
      setMembro(participaDeGrupo);

      if (participaDeGrupo) {
        const ultimoGrupoId = await carregarUltimoGrupoLocalmente();
        let parametrosParaSalvar: ParametrosUltimoGrupo | null = null;

        if (ultimoGrupoId) {
          const grupo = await buscarGrupoPorId(ultimoGrupoId);
          if (grupo) {
            parametrosParaSalvar = {
              groupId: grupo.id,
              groupName: grupo.nome_grupo,
              groupPhoto: grupo.foto_grupo
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
  }, [session, inicializado]);

  return { membro, parametrosUltimoGrupo };
}
