import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/repositories/supabase";
import type { ItemFila } from "@/types/foco";
import type { SalaFoco, ParticipanteDaSala } from "@/types/sala";

/*
  Tudo que é da SALA mora aqui — participantes, anfitrião, cronograma, ciclo de vida.

  Antes isso estava espalhado entre `services/sessions.ts` e `app/(tabs)/focus.tsx`, operando
  sobre a linha de `sessoes_foco` do anfitrião, que ao mesmo tempo era o registro pessoal de
  estudo dele. Daí vinha a contradição que gerou os cronômetros de 142h: encerrar o estudo
  marcava `concluido_em` na linha que também identificava a sala, e quem estava dentro virava
  fantasma contando para sempre.

  A régua nova é simples: `sessoes_foco` é o que a PESSOA estudou; `salas_foco` é ONDE.
*/

const COLUNAS_SALA = "id, grupo_id, anfitriao_id, is_public, modo, fila, fila_inicio_em, criada_em, encerrada_em";

const COLUNAS_PARTICIPANTE =
    "sala_id, membro_id, funcao, ultimo_inicio, tempo_segundos, status, profiles:membro_id (nome_real, nome_usuario, foto_usuario)";

/** Abre uma sala. Só sessão pública em grupo cria uma — estudo solo não tem sala. */
export const criarSala = async (params: {
    grupoId: string | null;
    anfitriaoId: string;
    isPublic?: boolean;
    modo?: string | null;
    fila?: ItemFila[] | null;
    filaInicioEm?: string | null;
}) => {
    const { data, error } = await supabase
        .from("salas_foco")
        .insert({
            grupo_id: params.grupoId,
            anfitriao_id: params.anfitriaoId,
            is_public: params.isPublic ?? true,
            modo: params.modo ?? null,
            fila: params.fila ?? null,
            fila_inicio_em: params.filaInicioEm ?? null,
        })
        .select(COLUNAS_SALA)
        .single();

    if (error) {
        console.error("Erro ao abrir a sala de foco:", error);
        return { sala: null as SalaFoco | null, error };
    }

    const sala = data as SalaFoco;

    /*
      Avisa o grupo que tem sala aberta. Sem `await` de propósito: quem chamou está no meio
      de começar a estudar, e essa pessoa não pode esperar (nem ver falhar) uma notificação
      que é dos OUTROS. A função no servidor é que decide se avisa — ela tem o rate limit
      por grupo e as preferências de quem recebe.
    */
    if (sala.grupo_id) {
        supabase.functions
            .invoke("avisar-sala-aberta", { body: { salaId: sala.id } })
            .catch((erro) => console.warn("Não foi possível avisar o grupo da sala:", erro));
    }

    return { sala, error: null };
};

export const buscarSala = async (salaId: string) => {
    const { data, error } = await supabase
        .from("salas_foco")
        .select(COLUNAS_SALA)
        .eq("id", salaId)
        .maybeSingle();

    if (error) {
        console.warn("Erro ao buscar a sala de foco:", error);
        return { sala: null as SalaFoco | null, error };
    }

    return { sala: (data as SalaFoco | null) ?? null, error: null };
};

/** Sala aberta de um grupo, se houver — é o que permite entrar numa sessão já em andamento. */
export const buscarSalaAbertaDoGrupo = async (grupoId: string) => {
    const { data, error } = await supabase
        .from("salas_foco")
        .select(COLUNAS_SALA)
        .eq("grupo_id", grupoId)
        .is("encerrada_em", null)
        .order("criada_em", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.warn("Erro ao buscar sala aberta do grupo:", error);
        return { sala: null as SalaFoco | null, error };
    }

    return { sala: (data as SalaFoco | null) ?? null, error: null };
};

export const buscarParticipantesDaSala = async (salaId: string) => {
    const { data, error } = await supabase
        .from("tab_sessao_membros")
        .select(COLUNAS_PARTICIPANTE)
        .eq("sala_id", salaId);

    return { data: (data ?? []) as unknown as ParticipanteDaSala[], error };
};

/**
 * Entra numa sala (ou volta para ela).
 *
 * `sessaoId` ainda é gravado porque `tab_sessao_membros.sessao_id` faz parte da chave
 * primária antiga e é NOT NULL — é coluna legada, ninguém lê mais. Passamos a linha pessoal
 * de quem está entrando, que é a leitura correta do campo hoje: "o registro de estudo que
 * esta participação produziu".
 */
export const entrarNaSala = async (params: {
    salaId: string;
    membroId: string;
    sessaoId: string;
    funcao?: "anfitriao" | "membro";
}) => {
    const agora = new Date().toISOString();

    const { error } = await supabase.from("tab_sessao_membros").insert({
        sala_id: params.salaId,
        sessao_id: params.sessaoId,
        membro_id: params.membroId,
        funcao: params.funcao ?? "membro",
        status: "ativo",
        ultimo_inicio: agora,
    });

    if (!error) return { error: null };

    /*
      23505 é a violação de unicidade: já existe participação desta pessoa nesta sala. Não é
      falha — acontece ao reentrar. `tempo_segundos` fica de fora de propósito, para não
      zerar o que já foi acumulado por quem está retomando.
    */
    if (error.code === "23505") {
        return await atualizarParticipacao(params.salaId, params.membroId, {
            status: "ativo",
            ultimo_inicio: agora,
        });
    }

    console.warn("Erro ao entrar na sala:", error);
    return { error };
};

export const atualizarParticipacao = async (
    salaId: string,
    membroId: string,
    updates: Partial<Pick<ParticipanteDaSala, "status" | "ultimo_inicio" | "tempo_segundos" | "funcao">>
) => {
    const { error } = await supabase
        .from("tab_sessao_membros")
        .update(updates)
        .eq("sala_id", salaId)
        .eq("membro_id", membroId);

    if (error) console.warn("Erro ao atualizar a participação na sala:", error);

    return { error };
};

/**
 * Sai da sala.
 *
 * Esta é a mudança central: encerrar o próprio estudo fecha a PARTICIPAÇÃO, e a sala só
 * fecha se não sobrar mais ninguém. Antes, o anfitrião encerrando marcava a sala inteira
 * como concluída e deixava os colegas contando indefinidamente.
 *
 * Devolve `salaFechada` para quem chama saber se foi o último a sair.
 */
export const sairDaSala = async (salaId: string, tempoSegundos?: number) => {
    const { data, error } = await supabase.rpc("sair_da_sala", {
        p_sala_id: salaId,
        p_tempo_segundos: tempoSegundos ?? null,
    });

    if (error) {
        console.error("Erro ao sair da sala:", error);
        return { salaFechada: false, error };
    }

    return { salaFechada: Boolean(data), error: null };
};

/**
 * Passa o bastão de anfitrião para quem ainda está na sala.
 *
 * Diferente da versão antiga (`transferirAnfitriaoDaSessao`), esta atualiza de fato
 * `salas_foco.anfitriao_id`: a sala passa a ser do sucessor. Antes a sala continuava sendo
 * a linha pessoal — já concluída — do anfitrião original, e a transferência não significava
 * nada. Devolve `null` quando não sobrou ninguém.
 */
export const transferirAnfitriaoDaSala = async (salaId: string) => {
    const { data, error } = await supabase.rpc("transferir_anfitriao_sala", { p_sala_id: salaId });

    if (error) {
        console.error("Erro ao transferir o anfitrião da sala:", error);
        return { novoAnfitriaoId: null as string | null, error };
    }

    return { novoAnfitriaoId: (data as string | null) ?? null, error: null };
};

/** Fecha a sala inteira, creditando o tempo em aberto de cada um (limitado ao corte de 12h). */
export const encerrarSala = async (salaId: string) => {
    const { data, error } = await supabase.rpc("encerrar_sala", { p_sala_id: salaId });

    if (error) {
        console.error("Erro ao encerrar a sala:", error);
        return { encerradas: 0, error };
    }

    return { encerradas: (data as number | null) ?? 0, error: null };
};

/**
 * Reescreve o cronograma publicado da sala.
 *
 * Usado quando o anfitrião muda o combinado no meio — esticar o foco, pular um descanso. Em
 * vez de mandar "avance agora" a cada participante (evento que quem estivesse offline no
 * instante certo perderia), reescrevemos a fila: todos recalculam a posição a partir dela e
 * chegam à mesma resposta, inclusive quem só voltou depois.
 */
export const publicarFilaDaSala = async (
    salaId: string,
    fila: ItemFila[],
    filaInicioEm?: string | null
) => {
    const { error } = await supabase
        .from("salas_foco")
        .update({
            fila,
            ...(filaInicioEm !== undefined ? { fila_inicio_em: filaInicioEm } : {}),
        })
        .eq("id", salaId);

    if (error) console.warn("Erro ao publicar o cronograma da sala:", error);

    return { error };
};

/*
  Contador que dá nome único a cada canal: a mesma sala pode ser observada por mais de uma
  tela ao mesmo tempo (foco ativo, colegas focando, prévia), e o supabase-js reaproveita
  canais pelo nome — adicionar callbacks a um canal que já passou pelo `subscribe()` estoura.
*/
let contadorDeCanais = 0;

export type EventoParticipanteDaSala = {
    tipo: "INSERT" | "UPDATE" | "DELETE";
    linha: Partial<ParticipanteDaSala>;
};

/**
 * Observa as participações de uma sala (entrou, pausou, saiu).
 *
 * Entrega o evento cru — quem chama funde a linha localmente em vez de refazer o fetch da
 * sala inteira a cada mudança de 1 pessoa. Isso era o gargalo que fazia uma sala de N
 * participantes gerar até N consultas com JOIN em `profiles` a cada pausa/retomada de
 * qualquer um deles.
 */
export const observarParticipantesDaSala = (
    salaId: string,
    aoMudar: (evento: EventoParticipanteDaSala) => void,
    /*
      Sem isso, quem chama não sabia se o canal já estava com a inscrição confirmada pelo
      Realtime (status "SUBSCRIBED") ou ainda de passagem — os testes de carga mostraram que
      disparar ações ao vivo (pausar/retomar) antes disso, com muita gente entrando na sala
      ao mesmo tempo, faz a entrega desabar (30% em vez de 100%). Quem chama usa isso para
      liberar as ações só depois que a própria inscrição estiver de pé.
    */
    aoStatusMudar?: (status: string) => void
) => {
    contadorDeCanais += 1;

    const canal: RealtimeChannel = supabase
        .channel(`sala_membros:${salaId}:${contadorDeCanais}`)
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "tab_sessao_membros",
                filter: `sala_id=eq.${salaId}`,
            },
            (payload) =>
                aoMudar({
                    tipo: payload.eventType as EventoParticipanteDaSala["tipo"],
                    linha: (payload.eventType === "DELETE" ? payload.old : payload.new) as Partial<ParticipanteDaSala>,
                })
        );

    canal.subscribe((status) => aoStatusMudar?.(status));

    return () => {
        supabase.removeChannel(canal);
    };
};

/** Busca só o perfil resumido de uma pessoa — usado para completar quem acabou de entrar. */
export const buscarPerfilResumidoParaSala = async (membroId: string) => {
    const { data } = await supabase
        .from("profiles")
        .select("nome_real, nome_usuario, foto_usuario")
        .eq("id", membroId)
        .maybeSingle();

    return data as ParticipanteDaSala["profiles"] | null;
};

/** Observa a própria sala — mudanças de cronograma, de anfitrião e o fechamento. */
export const observarSala = (salaId: string, aoMudar: (sala: SalaFoco) => void) => {
    contadorDeCanais += 1;

    const canal: RealtimeChannel = supabase
        .channel(`sala:${salaId}:${contadorDeCanais}`)
        .on(
            "postgres_changes",
            {
                event: "UPDATE",
                schema: "public",
                table: "salas_foco",
                filter: `id=eq.${salaId}`,
            },
            (payload) => aoMudar(payload.new as SalaFoco)
        );

    canal.subscribe();

    return () => {
        supabase.removeChannel(canal);
    };
};
