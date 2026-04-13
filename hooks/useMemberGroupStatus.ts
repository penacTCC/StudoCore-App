import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { loadLastGroupLocally } from '../services/offlineStorage';
import { fetchGroupById } from '../services/groups';
import { Session } from '@supabase/supabase-js';

type LastGroupParams = {
  groupId: string;
  groupName: string;
  groupPhoto: string | null;

};

export function useMemberGroupStatus(session: Session | null, isInitialized: boolean) {
  const [isMember, setIsMember] = useState(false);

  const [lastGroupParams, setLastGroupParams] = useState<LastGroupParams | undefined>(undefined);

  //Verifica se o usuario tem um grupo
  useEffect(() => {
    if (!isInitialized) return; // Aguarda a checagem da sessão terminar

    if (!session) {
      setIsMember(false);
      return;
    }

    const checkGroup = async () => {
      const { data: member } = await supabase
        .from('membros')
        .select('id')
        .eq('user_id', session?.user?.id)
        .limit(1)
        .maybeSingle();

      setIsMember(!!member);
      console.log("Member: ", member);

      // Se for membro, tenta carregar o último grupo visitado
      if (member) {
        // Tenta achar o grupo ANTES de avisar o Guarda
        const lastGroupId = await loadLastGroupLocally();
        let paramsToSave = lastGroupParams || undefined; // Presume null por padrão
        if (lastGroupId) {
          const groupInfo = await fetchGroupById(lastGroupId);
          if (groupInfo) {
            paramsToSave = ({
              groupId: groupInfo.id,
              groupName: groupInfo.nome_grupo,
              groupPhoto: groupInfo.foto_grupo
            });
          }
        }
        // Atualiza os states SEMPRE, mesmo sem lastGroupId salvo
        setLastGroupParams(paramsToSave);
        setIsMember(true); // Só agora que o Guarda pode ver que ele tem grupo
      } else {
        setLastGroupParams(undefined);
      }
    };

    checkGroup();
  }, [session, isInitialized]);

  return { isMember, lastGroupParams };

}
