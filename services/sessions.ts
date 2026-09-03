import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/repositories/supabase";
import { BUCKET as BUCKET_FOTOS_SESSAO } from "@/services/fotosSessao";
import { SessaoFocoInsert, SessaoFocoRow, SessionCardItem } from "@/types/sessions";
import type { ParticipanteResumido } from "@/types/sala";
import { paraDataISO, pegarIntervaloSemanaAtual } from "@/utils/tempo";
import { escalarSegundos, garantirFatorCarregado } from "@/services/modoTeste";
import {
    listarFinalizacoesSessaoPendentes,
    removerFinalizacaoSessaoPendente,
} from "@/services/armazenamentoOffline";

/**
 * `true` quando o erro é "essa coluna não existe" para a coluna informada — 42703 vem do
 * Postgres e PGRST204 do PostgREST, quando a coluna ainda não apareceu no schema cache.
 * Serve para o app continuar funcionando num banco que ainda não recebeu a migration.
 */
const isMissingColumnError = (error: any, coluna: string) => {
    const mensagem = String(error?.message || "");
    return ["42703", "PGRST204"].includes(error?.code) && mensagem.includes(coluna);
};

const isMissingGroupColumnError = (error: any) => isMissingColumnError(error, "grupo_id");

/**
 * `profiles` só é legível pelo dono (RLS); identidade de outra pessoa vem da view
 * `perfis_identidade`, que nunca expõe celular/data_nascimento/estatística. Substitui o
 * antigo embed `profiles:user_id (...)` do PostgREST por uma consulta em lote + merge em JS.
 */
async function anexarIdentidades<T extends { user_id: string }>(linhas: T[]): Promise<(T & Pick<SessionCardItem, "profiles">)[]> {
    const userIds = Array.from(new Set(linhas.map((l) => l.user_id)));
    if (userIds.length === 0) return linhas as (T & Pick<SessionCardItem, "profiles">)[];

    const { data: perfis } = await supabase
        .from("perfis_identidade")
        .select("id, nome_real, nome_usuario, foto_usuario")
        .in("id", userIds);

    const perfilPorId = new Map((perfis ?? []).map((p) => [p.id, { nome_real: p.nome_real, nome_usuario: p.nome_usuario, foto_usuario: p.foto_usuario }]));

    return linhas.map((linha) => ({ ...linha, profiles: perfilPorId.get(linha.user_id) }));
}

const removeGroupIdFromPayload = <T extends Partial<SessaoFocoInsert>>(payload: T) => {
    // Cria uma cópia para não mutar o objeto original recebido pela tela ou hook.
    const payloadWithoutGroupId = { ...payload };

    // Remove `grupo_id` quando o banco remoto ainda não recebeu a migration dessa coluna.
    delete payloadWithoutGroupId.grupo_id;

    // Devolve o payload compatível com o schema antigo.
    return payloadWithoutGroupId;
};

/**
 * Converte os segundos reais do cronômetro nos segundos que vão para o banco — a mesma
 * escala do modo de testes que todo o resto do app aplica (ver services/modoTeste.ts).
 * Use sempre que gravar `tab_sessao_membros.tempo_segundos`.
 */
export const segundosContabilizados = async (segundosReais: number) => {
    await garantirFatorCarregado();
    return escalarSegundos(segundosReais);
};

/**
 * Calcula a duração persistida da sessão a partir dos segundos reais do cronômetro.
 * No modo normal, 60 segundos viram 1 minuto; no modo teste, 10 segundos viram 60 minutos.
 *
 * Zero segundos devolve zero: o piso de 1 minuto vale para uma sessão curta de verdade,
 * mas aplicá-lo a uma sessão sem tempo nenhum inventava minutos que ninguém estudou —
 * era como um pomodoro solo acabava somando mais minutos do que o relógio marcou.
 */
export const calculateFocusSessionMinutes = async (timerSeconds: number) => {
    const contabilizados = await segundosContabilizados(timerSeconds);

    if (contabilizados === 0) return 0;

    // Arredonda para o inteiro mais próximo porque a coluna `tempo_minutos` é INTEGER.
    return Math.max(1, Math.round(contabilizados / 60));
};

/**
 * Descarta o `grupo_id` do payload quando o autor não é membro daquele grupo.
 *
 * A tela de foco carimba o grupo a partir do "último grupo" guardado no aparelho, e um id
 * inválido ali (conta trocada no mesmo aparelho, ou alguém que saiu do grupo) gerava sessão
 * fantasma: ela aparecia no feed e somava na meta semanal de um grupo em que o autor não
 * está — mas não no ranking nem na lista de membros, que leem `membros`. Sem grupo a sessão
 * continua valendo no histórico pessoal, que é o comportamento certo.
 *
 * Falha de rede aqui não bloqueia a gravação: a checagem só remove o vínculo quando a
 * resposta diz, com certeza, que não há participação.
 */
const descartarGrupoDeNaoMembro = async <T extends Partial<SessaoFocoInsert>>(payload: T, userId?: string | null) => {
    if (!payload.grupo_id || !userId) return payload;

    const { data, error } = await supabase
        .from("membros")
        .select("id")
        .eq("user_id", userId)
        .eq("grupo_id", payload.grupo_id)
        .maybeSingle();

    if (error || data) return payload;

    return { ...payload, grupo_id: null };
};

/**
 * Carimba o dia de estudo no fuso do aparelho, quando quem chamou não informou um.
 *
 * A coluna é `DATE DEFAULT CURRENT_DATE`, e o Postgres do Supabase roda em UTC: deixar o
 * banco preencher jogava toda sessão começada depois das 21h (horário de Brasília) para o
 * dia seguinte. Quem estudou às 22h de ontem via a sessão marcada como "Hoje" no Banco.
 *
 * A data é a do INÍCIO da sessão, não a do fim: uma sessão que atravessa a meia-noite conta
 * no dia em que começou. Como a linha nasce quando a pessoa aperta "iniciar" (ver
 * app/(tabs)/focus.tsx), carimbar aqui, no insert, já é o instante certo.
 */
const carimbarDiaDeEstudo = (sessao: SessaoFocoInsert): SessaoFocoInsert => ({
    ...sessao,
    data_sessao: sessao.data_sessao ?? paraDataISO(new Date()),
});

// ───── INSERT ─────
export const salvarSessaoFoco = async (sessaoRecebida: SessaoFocoInsert) => {
    const sessao = await descartarGrupoDeNaoMembro(carimbarDiaDeEstudo(sessaoRecebida), sessaoRecebida.user_id);

    // Tenta salvar com `grupo_id`, que é o caminho correto depois da migration.
    const result = await supabase.from("sessoes_foco").insert(sessao).select();

    // Se o banco remoto ainda não tiver a coluna, salva a sessão sem quebrar o fluxo do usuário.
    if (result.error && isMissingGroupColumnError(result.error)) {
        return await supabase.from("sessoes_foco").insert(removeGroupIdFromPayload(sessao)).select();
    }

    // Retorna o resultado original quando a coluna existe ou quando o erro é de outra natureza.
    return result;
};

// ───── UPDATE (refazer ou revisar formulário pendente) ─────
export const atualizarSessaoFoco = async (id: string, updatesRecebidos: Partial<SessaoFocoInsert>) => {
    /*
      Mesma checagem do insert. O update não traz `user_id` no payload, então o autor vem da
      própria linha — só quando há `grupo_id` a gravar, para não custar uma ida ao banco em
      todo tick de pomodoro (que atualiza status e tempo, nunca o grupo).
    */
    let updates = updatesRecebidos;

    if (updates.grupo_id) {
        const { data: linha } = await supabase
            .from("sessoes_foco")
            .select("user_id")
            .eq("id", id)
            .maybeSingle();

        updates = await descartarGrupoDeNaoMembro(updates, linha?.user_id);
    }

    // Tenta atualizar com `grupo_id`, mantendo a sessão vinculada ao grupo quando o schema já permite.
    const result = await supabase.from("sessoes_foco").update(updates).eq("id", id);

    // Se a coluna ainda não existe no remoto, remove só `grupo_id` e preserva todos os outros dados da sessão.
    if (result.error && isMissingGroupColumnError(result.error)) {
        return await supabase.from("sessoes_foco").update(removeGroupIdFromPayload(updates)).eq("id", id);
    }

    // Retorna o resultado original quando a migration já foi aplicada ou quando há outro erro real.
    return result;
};

/**
 * Reaplica finalizações de sessão que falharam ao serem enviadas na hora (rede caiu, banco
 * engasgou) e ficaram enfileiradas no aparelho (ver `enfileirarFinalizacaoSessaoPendente` em
 * `armazenamentoOffline.ts`).
 *
 * Seguro para chamar repetidas vezes: `atualizarSessaoFoco` só faz UPDATE por `id`, então
 * tentar de novo um item que já foi sincronizado por outro caminho (ex.: pela varredura de
 * `fecharSessoesAbandonadas`) apenas regrava o mesmo estado final, sem duplicar nada.
 */
export const sincronizarFinalizacoesPendentes = async () => {
    const pendentes = await listarFinalizacoesSessaoPendentes();

    for (const pendente of pendentes) {
        const { error } = await atualizarSessaoFoco(pendente.id, pendente.updates);
        if (!error) {
            await removerFinalizacaoSessaoPendente(pendente.id);
        }
    }
};

// ───── DELETE (descartar sessão, ex.: formulário pendente que não vai ser refeito) ─────
/**
 * Apaga a linha e, quando ela tinha foto, o arquivo no bucket `sessao-fotos` também — sem
 * isso a foto vira órfã (storage não tem CASCADE com o Postgres). Uma execução de plano
 * multi-matéria grava o MESMO `foto_path` em várias linhas (ver
 * services/fotosSessao.ts), então só apaga o arquivo se nenhuma sessão irmã ainda apontar
 * pra ele — mesma checagem que `removerFotoDaSessao` já faz ao desvincular manualmente.
 */
export const excluirSessaoFoco = async (id: string, userId: string) => {
    const { data: sessao } = await supabase
        .from("sessoes_foco")
        .select("foto_path")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle();

    // O filtro pelo dono protege a operação mesmo em um ambiente cuja RLS esteja
    // desatualizada. Pedir a linha apagada também evita tratar "0 linhas" como sucesso.
    const result = await supabase
        .from("sessoes_foco")
        .delete()
        .eq("id", id)
        .eq("user_id", userId)
        .select("id")
        .maybeSingle();

    if (!result.error && !result.data) {
        return {
            ...result,
            error: new Error("Sessão não encontrada ou não pertence ao usuário."),
        };
    }

    const fotoPath = sessao?.foto_path as string | null | undefined;
    if (!result.error && fotoPath) {
        const { count, error: erroContagem } = await supabase
            .from("sessoes_foco")
            .select("id", { count: "exact", head: true })
            .eq("foto_path", fotoPath);

        if (!erroContagem && count === 0) {
            const { error: erroStorage } = await supabase.storage.from(BUCKET_FOTOS_SESSAO).remove([fotoPath]);
            if (erroStorage) {
                console.warn("Sessão apagada, mas o arquivo da foto continuou no bucket:", erroStorage.message);
            }
        }
    }

    return result;
};

// ───── SELECT (sessão específica) ─────
export const fetchFocusSession = async (id: string) => {
    let query = supabase
    .from("sessoes_foco")
    .select(`*`)
    .eq("id", id);

    const result = await query
    return result;
}

export const fetchSessionById = async (id: string) => {
    const { data, error } = await supabase
        .from("sessoes_foco")
        .select(`*`)
        .eq("id", id)
        .maybeSingle();

    if (error || !data) return { data, error };

    const [comIdentidade] = await anexarIdentidades([data as SessionCardItem]);
    return { data: comIdentidade, error: null };
};

/**
 * Compila no feed as linhas de uma mesma execução de plano (matérias diferentes, mesmo
 * `execucao_id` — ver app/(tabs)/focus.tsx) num único card, somando tempo/questões e
 * juntando os nomes das matérias. Linhas sem `execucao_id` passam direto, um card cada,
 * como sempre foi. Só usado no feed histórico/finalizado — o feed ao vivo
 * (`buscarSessoesAoVivo`) não compila, porque só a matéria atual fica com status "ativo"
 * enquanto a execução roda; as anteriores já viraram "salvo" e não fazem sentido juntar
 * antes da execução inteira acabar.
 */
export const compilarSessoesPorExecucao = (linhas: SessionCardItem[]): SessionCardItem[] => {
    const semExecucao: SessionCardItem[] = [];
    const porExecucao = new Map<string, SessionCardItem[]>();

    for (const linha of linhas) {
        if (!linha.execucao_id) {
            semExecucao.push(linha);
            continue;
        }
        const grupo = porExecucao.get(linha.execucao_id) ?? [];
        grupo.push(linha);
        porExecucao.set(linha.execucao_id, grupo);
    }

    const compiladas: SessionCardItem[] = [...semExecucao];

    for (const grupo of porExecucao.values()) {
        if (grupo.length === 1) {
            compiladas.push(grupo[0]);
            continue;
        }

        // A linha mais recente representa o card (a última matéria estudada na execução).
        const [representante] = [...grupo].sort((a, b) => b.created_at.localeCompare(a.created_at));
        const materias = [...new Set(grupo.map((linha) => linha.disciplina))];
        const disciplinaCompilada = materias.length <= 2 ? materias.join(" e ") : `${materias[0]} +${materias.length - 1}`;

        compiladas.push({
            ...representante,
            disciplina: disciplinaCompilada,
            conteudo_especifico: materias.join(", "),
            tempo_minutos: grupo.reduce((soma, linha) => soma + (linha.tempo_minutos ?? 0), 0),
            questoes_respondidas: grupo.reduce((soma, linha) => soma + (linha.questoes_respondidas ?? 0), 0),
            questoes_acertadas: grupo.reduce((soma, linha) => soma + (linha.questoes_acertadas ?? 0), 0),
            questoes_externas: grupo.reduce((soma, linha) => soma + (linha.questoes_externas ?? 0), 0),
            acertos_externos: grupo.reduce((soma, linha) => soma + (linha.acertos_externos ?? 0), 0),
            materiasCompiladas: materias.length,
        });
    }

    return compiladas.sort((a, b) => b.created_at.localeCompare(a.created_at));
};

// ───── SELECT (todas as matérias de uma execução de plano, pra prévia/quiz combinado) ─────
export const buscarSessoesPorExecucao = async (execucaoId: string) => {
    const { data, error } = await supabase
        .from("sessoes_foco")
        .select(`*`)
        .eq("execucao_id", execucaoId)
        .order("created_at", { ascending: true });

    const comIdentidade = await anexarIdentidades((data || []) as SessionCardItem[]);
    return { data: comIdentidade as SessionCardItem[], error };
};

// ───── SELECT (feed público, só sessões públicas, status salvo e score > 7) ─────
const buscarSessoesRecentesBrutas = async (limit: number = 20, groupId?: string | null) => {
    // Monta a query base do feed: apenas sessões públicas e salvas. O filtro de bom
    // desempenho no quiz (>70% de acerto) é aplicado depois de compilar (ver
    // buscarSessoesRecentes), porque numa execução de plano cada matéria vira sua própria
    // linha com poucas questões — um corte fixo em "questoes_acertadas > 7" excluiria até
    // quem acertou tudo, já que a nota fica dividida entre as matérias.
    let query = supabase
        .from("sessoes_foco")
        .select(`*`)
        .eq("is_public", true)
        .eq("status", "salvo");

    // Quando a tela informa o grupo, o feed fica restrito às sessões daquele grupo específico.
    if (groupId) {
        query = query.eq("grupo_id", groupId);
    }

    // Ordena as sessões mais novas primeiro e limita a quantidade retornada para preservar performance.
    const result = await query.order("created_at", { ascending: false }).limit(limit);

    // Se `grupo_id` ainda não existe no remoto, usa fallback por membros para não quebrar a tela.
    if (result.error && groupId && isMissingGroupColumnError(result.error)) {
        // Busca os usuários que pertencem ao grupo atual.
        const { data: members, error: membersError } = await supabase
            .from("membros")
            .select("user_id")
            .eq("grupo_id", groupId);

        // Se nem os membros puderem ser buscados, retorna o erro original do fallback.
        if (membersError) {
            return { data: null, error: membersError };
        }

        // Extrai os IDs dos membros para limitar o feed aos usuários do grupo.
        const memberIds = (members || []).map((member) => member.user_id);

        // Se o grupo não tiver membros retornados, devolve lista vazia sem bater em `sessoes_foco`.
        if (memberIds.length === 0) {
            return { data: [], error: null };
        }

        // Busca o feed antigo filtrando por membros do grupo; fica perfeito após aplicar a migration.
        const fallback = await supabase
            .from("sessoes_foco")
            .select(`*`)
            .eq("is_public", true)
            .eq("status", "salvo")
            .in("user_id", memberIds)
            .order("created_at", { ascending: false })
            .limit(limit);

        if (fallback.error || !fallback.data) return fallback;
        return { data: await anexarIdentidades(fallback.data as SessionCardItem[]), error: null };
    }

    // Retorna a query principal quando o schema já tem `grupo_id`.
    if (result.error || !result.data) return result;
    return { data: await anexarIdentidades(result.data as SessionCardItem[]), error: null };
};

/** "Destaque" = mais de 70% de acerto no quiz (equivale ao corte antigo de >7 em 10). */
export const ehSessaoDestaque = (sessao: Pick<SessionCardItem, "questoes_respondidas" | "questoes_acertadas">) =>
    sessao.questoes_respondidas > 0 && sessao.questoes_acertadas / sessao.questoes_respondidas > 0.7;

/**
 * Feed de atividades encerradas do grupo.
 *
 * O corte de "destaque" era aplicado aqui como **filtro**, e escondia a maior parte do que
 * o grupo de fato estudou: quem pulava o quiz ficava com `questoes_respondidas = 0` e a
 * sessão nunca aparecia — nem na home, nem na tela de detalhamento. Uma sessão em grupo
 * recém-encerrada simplesmente sumia. Agora o destaque é só uma marcação no card
 * (`destaque`), e o feed mostra tudo que foi concluído.
 */
export const buscarSessoesRecentes = async (limit: number = 20, groupId?: string | null) => {
    const { data, error } = await buscarSessoesRecentesBrutas(limit, groupId);
    if (error || !data) return { data, error };

    const compiladas = compilarSessoesPorExecucao(data as SessionCardItem[]).map((sessao) => ({
        ...sessao,
        destaque: ehSessaoDestaque(sessao),
    }));

    return { data: compiladas, error: null };
};

// ───── SELECT (feed ao vivo: quem está focando agora) ─────
/**
 * Sessões que ainda estão acontecendo, para o feed "ao vivo" da home.
 *
 * Diferente de `buscarSessoesRecentes`, que é um feed de destaques do passado
 * (`status = 'salvo'` só é gravado no encerramento, junto com `concluido_em`).
 *
 * O corte de tempo usa `created_at` porque é `timestamptz` na definição da tabela,
 * enquanto `ultimo_inicio` foi adicionada depois sem migration e hoje volta com fuso
 * errado (aparece no futuro e gera cronômetro negativo). É rolante em vez de "hoje"
 * para não descartar quem começou perto da meia-noite.
 */
export const buscarSessoesAoVivo = async (limit: number = 20, groupId?: string | null) => {
    // Sessão abandonada (app fechado à força) fica 'ativo' para sempre: o corte evita fantasma.
    const horasDeValidade = 12;
    const limiteDeTempo = new Date(Date.now() - horasDeValidade * 60 * 60 * 1000).toISOString();

    const montarQuery = () => {
        let query = supabase
            .from("sessoes_foco")
            .select(`*`)
            // Sessão privada é estudo solo: não entra no feed de ninguém.
            .eq("is_public", true)
            .in("status", ["ativo", "pausado"])
            .is("concluido_em", null)
            .gt("created_at", limiteDeTempo);

        if (groupId) {
            query = query.eq("grupo_id", groupId);
        }

        return query.order("created_at", { ascending: false }).limit(limit);
    };

    const result = await montarQuery();

    // Mesmo fallback de `buscarSessoesRecentes`: se `grupo_id` ainda não existe no remoto,
    // restringe pelos membros do grupo em vez de quebrar a tela.
    if (result.error && groupId && isMissingGroupColumnError(result.error)) {
        const { data: members, error: membersError } = await supabase
            .from("membros")
            .select("user_id")
            .eq("grupo_id", groupId);

        if (membersError) {
            return { data: null, error: membersError };
        }

        const memberIds = (members || []).map((member) => member.user_id);

        if (memberIds.length === 0) {
            return { data: [], error: null };
        }

        const fallback = await supabase
            .from("sessoes_foco")
            .select(`*`)
            .eq("is_public", true)
            .in("status", ["ativo", "pausado"])
            .is("concluido_em", null)
            .gt("created_at", limiteDeTempo)
            .in("user_id", memberIds)
            .order("created_at", { ascending: false })
            .limit(limit);

        if (fallback.error || !fallback.data) return fallback;
        return { data: await anexarIdentidades(fallback.data as SessionCardItem[]), error: null };
    }

    if (result.error || !result.data) return result;
    return { data: await anexarIdentidades(result.data as SessionCardItem[]), error: null };
};

// ───── SELECT (sessões de um usuário específico) ─────
export const buscarSessoesPorUsuario = async (userId: string, limit?: number) => {
    const query = supabase
        .from("sessoes_foco")
        .select(`*`)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    // Sem limite explícito, traz todas as sessões (necessário para análises que olham até 1 ano+ para trás).
    const result = await (limit !== undefined ? query.limit(limit) : query);
    if (result.error || !result.data) return result;
    return { ...result, data: await anexarIdentidades(result.data as SessionCardItem[]) };
};

// ───── SELECT (só a contagem de formulários pendentes) ─────
/**
 * Conta as sessões do usuário que ficaram com formulário em aberto.
 *
 * Existe separada de `buscarSessoesPorUsuario` porque o badge da tab bar vive fora de
 * qualquer tela e só precisa do número — puxar as 100 linhas com o join de `profiles`
 * a cada troca de aba seria caro à toa.
 */
export const contarSessoesPendentes = async (userId: string) => {
    return await supabase
        .from("sessoes_foco")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "pendente");
};

/**
 * Uma sessão só entra em totais, ranking e estatísticas depois de terminar: enquanto ela
 * está "ativo"/"pausado" o `tempo_minutos` gravado é parcial (o encerramento é que escreve
 * o valor final). Isso também garante o que a sessão pública promete — o tempo dela só é
 * contabilizado quando acaba, não enquanto o grupo ainda está focando.
 */
export const STATUS_SESSAO_FINALIZADA = ["salvo", "pendente"];

/**
 * Grava no banco o tempo de foco que a sessão acumulou até agora, sem encerrá-la.
 *
 * Serve de batimento cardíaco: enquanto a pessoa foca, o app chama isto de tempos em tempos
 * (ver app/(tabs)/focus.tsx). Duas coisas dependem disso:
 *
 * 1. Se o app for morto — bateria, force stop, o sistema recuperando memória —, o tempo já
 *    estudado está no banco. Antes, o `tempo_minutos` só era escrito ao pausar, trocar de
 *    fase ou encerrar: uma sessão de uma hora morta antes do primeiro descanso ficava
 *    registrada como zero, e a hora estudada simplesmente sumia.
 * 2. `ultimo_inicio` volta a ser recente, e é isso que distingue uma sessão viva de uma
 *    abandonada em `fecharSessoesAbandonadas`.
 *
 * O tempo é sempre ABSOLUTO (o total desde o início), nunca um incremento, então repetir a
 * chamada não infla nada. `ultimo_inicio` é reescrito junto de propósito: os cronômetros ao
 * vivo somam "acumulado + tempo desde `ultimo_inicio`" (ver utils/tempo.ts), e regravar só
 * o acumulado faria o feed contar o mesmo trecho duas vezes.
 */
export const registrarProgressoSessao = async (params: {
    sessaoId: string;
    /** Sala do encontro, quando a sessão é pública em grupo. */
    salaId?: string | null;
    userId?: string | null;
    segundosDeFoco: number;
    ehPublica: boolean;
}) => {
    const agoraIso = new Date().toISOString();

    const { error } = await supabase
        .from("sessoes_foco")
        .update({
            tempo_minutos: await calculateFocusSessionMinutes(params.segundosDeFoco),
            ultimo_inicio: agoraIso,
        })
        .eq("id", params.sessaoId);

    if (error) {
        console.warn("Erro ao registrar o progresso da sessão:", error);
    }

    if (params.ehPublica && params.salaId && params.userId) {
        await supabase
            .from("tab_sessao_membros")
            .update({ tempo_segundos: params.segundosDeFoco, ultimo_inicio: agoraIso })
            .eq("sala_id", params.salaId)
            .eq("membro_id", params.userId);
    }
};

/** Sem batimento por este tempo, a sessão é considerada abandonada. */
const MINUTOS_ATE_ABANDONO = 15;

/**
 * Fecha as sessões que ficaram "ativo"/"pausado" para sempre porque o app morreu antes de
 * encerrá-las.
 *
 * Elas eram um problema dos dois lados: o tempo estudado nunca entrava nas estatísticas
 * (só status "salvo"/"pendente" contam) e a pessoa continuava aparecendo "focando agora"
 * no feed do grupo sem estar. O feed tinha um remendo — ignorar sessões abertas há mais de
 * 12h —, que escondia o fantasma sem devolver o tempo a ninguém.
 *
 * Uma sessão com tempo estudado vira "pendente", que é o estado que o app já conhece: ela
 * conta nas estatísticas e aparece como formulário a preencher. Sem tempo nenhum, vira
 * "salvo" com zero — não há o que perguntar sobre uma sessão que não chegou a acontecer.
 *
 * `idsEmAndamento` são as sessões que este aparelho ainda está tocando (ver o snapshot em
 * services/armazenamentoOffline.ts): elas nunca podem ser fechadas por aqui. A janela de
 * silêncio protege o resto — uma sessão que ainda recebe batimento, mesmo de outro
 * aparelho, tem `ultimo_inicio` recente e não é tocada.
 */
export const fecharSessoesAbandonadas = async (userId: string, idsEmAndamento: string[] = []) => {
    const limite = new Date(Date.now() - MINUTOS_ATE_ABANDONO * 60 * 1000).toISOString();

    const { data, error } = await supabase
        .from("sessoes_foco")
        .select("id, tempo_minutos, ultimo_inicio, created_at")
        .eq("user_id", userId)
        .in("status", ["ativo", "pausado"])
        .is("concluido_em", null);

    if (error) {
        console.warn("Erro ao procurar sessões abandonadas:", error);
        return { fechadas: 0 };
    }

    const abandonadas = (data || []).filter((sessao) => {
        if (idsEmAndamento.includes(sessao.id)) return false;
        // `created_at` cobre a sessão que morreu antes do primeiro batimento.
        return (sessao.ultimo_inicio || sessao.created_at) < limite;
    });

    if (abandonadas.length === 0) return { fechadas: 0 };

    const agoraIso = new Date().toISOString();

    await Promise.all(
        abandonadas.map((sessao) =>
            atualizarSessaoFoco(sessao.id, {
                status: sessao.tempo_minutos > 0 ? "pendente" : "salvo",
                concluido_em: agoraIso,
            })
        )
    );

    /*
      A participação em grupo é fechada pela mesma régua de silêncio, e não pelos ids das
      sessões acima: quem entrou na sessão de outra pessoa tem a participação amarrada à
      sessão do ANFITRIÃO, não à sua própria linha. Filtrar pelos ids só limparia o rastro
      de quem criou a sessão, deixando os convidados eternamente "focando" na tela do grupo.
    */
    const { error: erroMembros } = await supabase
        .from("tab_sessao_membros")
        .update({ status: "concluido" })
        .eq("membro_id", userId)
        .neq("status", "concluido")
        .lt("ultimo_inicio", limite);

    if (erroMembros) {
        console.warn("Erro ao fechar participações abandonadas:", erroMembros);
    }

    return { fechadas: abandonadas.length };
};

//Cálculo do tempo total de hoje, das sessões de foco
export const tempoTotalSessoesFoco = async (groupId?: string) => {
    if(!groupId)
    return {
        horasFormatadas: "0h0",
        totalMinutos: 0,
    };

    // Data resolvida no fuso local e a cada chamada: como constante de módulo em UTC, o
    // "hoje" ficava congelado no horário em que o app abriu e já virava o dia seguinte às 21h.
    const dataAtual = paraDataISO(new Date());

    const {data, error} = await supabase
        .from("sessoes_foco")
        .select('tempo_minutos')
        .eq('grupo_id', groupId)
        .eq('data_sessao', dataAtual)
        .in('status', STATUS_SESSAO_FINALIZADA)

    if(error) {
        console.log(error) 
        return {
            horasFormatadas: "0h0",
            totalMinutos: 0,
        };
    }
    console.log(data)
    
    //reduce percorre todo um array e reduz todos os seus elementos a um único valor
    const totalMinutos = data?.reduce((acumulador, sessao) => {
        return acumulador + (sessao.tempo_minutos ?? 0)
    }, 0) ?? 0

    //Horas em decimais
    const totalHoras = totalMinutos/60
    //Hora inteira
    const horas = Math.floor(totalHoras)
    //Minutos
    const minutos = Math.round((totalHoras - horas) * 60)
    //Horas formatadas
    const horasFormatadas = `${horas} h${minutos}m`

    return {
        horasFormatadas, totalMinutos,
    }
}

export const tempoTotalSessoesFocoOntem = async (groupId?: string) => {
    if(!groupId) return 0

    //pegando a data de ontem para o aumento percentual
    const ontem = new Date()
    const hoje = new Date()
    ontem.setDate(hoje.getDate() - 1)

    const diaOntem = paraDataISO(ontem)

    const {data, error} = await supabase
        .from("sessoes_foco")
        .select('tempo_minutos')
        .eq('grupo_id', groupId)
        .eq('data_sessao', diaOntem)
        .in('status', STATUS_SESSAO_FINALIZADA)


    if(error) {
        console.log(error) 
        return 0
    }
    const totalMinutosAnteriores = data?.reduce((acumulador, sessao) => {
        return acumulador + (sessao.tempo_minutos ?? 0)
    }, 0) ?? 0

    return totalMinutosAnteriores
}

//Buscar sessões do Grupo
const buscarSessoesPorGrupoBrutas = async (groupId: string, limit?: number) => {
    const query = supabase
        .from("sessoes_foco")
        .select("*")
        .eq("grupo_id", groupId)
        .order("created_at", { ascending: false });

    return await (limit !== undefined ? query.limit(limit) : query);
};

export const buscarSessoesPorGrupo = async (groupId: string, limit?: number) => {
    const { data, error } = await buscarSessoesPorGrupoBrutas(groupId, limit);
    if (error || !data) return { data, error };
    return { data: compilarSessoesPorExecucao(data as SessionCardItem[]), error: null };
};

export const buscarParticipantesDasSalas = async (salaIds: string[]) => {
    const porSessao = new Map<string, ParticipanteResumido[]>();
    if (salaIds.length === 0) return porSessao;

    const { data, error } = await supabase
        .from("tab_sessao_membros")
        .select("sala_id, membro_id, funcao")
        .in("sala_id", salaIds);

    // Uma falha aqui só custa a pilha de avatares: o card continua válido sem ela.
    if (error) {
        console.warn("Erro ao buscar participantes das salas:", error);
        return porSessao;
    }

    const membroIds = Array.from(new Set((data ?? []).map((linha) => linha.membro_id)));
    // `profiles` só é legível pelo dono (RLS); identidade de outra pessoa vem da view
    // `perfis_identidade`, então o JOIN vira duas consultas em vez de embed do PostgREST.
    const { data: perfis } = membroIds.length
        ? await supabase
              .from("perfis_identidade")
              .select("id, nome_real, nome_usuario, foto_usuario")
              .in("id", membroIds)
        : { data: [] as { id: string; nome_real: string | null; nome_usuario: string | null; foto_usuario: string | null }[] };

    const perfilPorId = new Map((perfis ?? []).map((p) => [p.id, p]));

    for (const linha of data ?? []) {
        const perfil = perfilPorId.get(linha.membro_id);
        const lista = porSessao.get(linha.sala_id) ?? [];

        lista.push({
            membroId: linha.membro_id,
            funcao: linha.funcao === "anfitriao" ? "anfitriao" : "membro",
            nome: perfil?.nome_real || perfil?.nome_usuario || "Usuário",
            foto: perfil?.foto_usuario ?? null,
        });

        porSessao.set(linha.sala_id, lista);
    }

    for (const lista of porSessao.values()) {
        lista.sort((a, b) => Number(b.funcao === "anfitriao") - Number(a.funcao === "anfitriao"));
    }

    return porSessao;
};

/* O supabase-js reaproveita canais pelo nome, e a home escuta o feed ao vivo e o feed de
   destaques ao mesmo tempo — cada assinatura precisa do seu próprio canal. */
let contadorDeCanaisSessoes = 0;

/**
 * Escuta em tempo real as sessões de foco de um grupo — é o que faz uma sessão pública
 * aparecer no feed dos colegas no momento em que ela começa, sem precisar sair e voltar da
 * tela. Também cobre pausa/retomada/encerramento, porque todas passam por UPDATE na mesma
 * linha.
 *
 * O payload não traz o JOIN com `profiles`, então quem chama deve refazer o fetch; o
 * callback só avisa que algo mudou. Sem `grupoId` o canal não é aberto (feed pessoal não
 * tem o que sincronizar entre pessoas).
 *
 * @returns função de cleanup que remove o canal.
 */
export const observarSessoesDoGrupo = (grupoId: string, aoMudar: () => void) => {
    contadorDeCanaisSessoes += 1;

    const canal: RealtimeChannel = supabase
        .channel(`sessoes_foco:${grupoId}:${contadorDeCanaisSessoes}`)
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "sessoes_foco",
                filter: `grupo_id=eq.${grupoId}`,
            },
            () => aoMudar()
        );

    canal.subscribe();

    return () => {
        supabase.removeChannel(canal);
    };
};

/**
 * Observa UMA sessão específica em tempo real.
 *
 * Serve ao pomodoro em grupo: os participantes precisam saber na hora quando o cronograma
 * publicado muda (o anfitrião esticou o foco, pulou um descanso) ou quando a sessão é
 * encerrada. `observarSessoesDoGrupo` não cobre esse caso — quem entra numa sessão pública
 * pode nem estar no mesmo grupo, e assinar o grupo inteiro traria ruído de todas as outras
 * sessões acontecendo ao mesmo tempo.
 *
 * @returns função de cleanup que remove o canal.
 */
export const observarSessao = (sessaoId: string, aoMudar: (linha: SessaoFocoRow) => void) => {
    contadorDeCanaisSessoes += 1;

    const canal: RealtimeChannel = supabase
        .channel(`sessao:${sessaoId}:${contadorDeCanaisSessoes}`)
        .on(
            "postgres_changes",
            {
                event: "UPDATE",
                schema: "public",
                table: "sessoes_foco",
                filter: `id=eq.${sessaoId}`,
            },
            (payload) => aoMudar(payload.new as SessaoFocoRow)
        );

    canal.subscribe();

    return () => {
        supabase.removeChannel(canal);
    };
};

/**
 * Reescreve o cronograma publicado de uma sessão.
 *
 * Usado quando o anfitrião muda o combinado no meio do caminho — esticar o foco em 5
 * minutos, pular um descanso. Em vez de mandar "avance agora" para cada participante (que
 * quem estivesse offline no instante certo perderia), reescrevemos a fila: todo mundo
 * recalcula a posição a partir dela e chega à mesma resposta, mesmo quem só voltou depois.
 *
 * O início da fila não se move — é a origem de todo o cálculo. O que muda é a duração dos
 * itens.
 */
export const republicarFilaDaSessao = async (sessaoId: string, fila: unknown[]) => {
    const { error } = await supabase.from("sessoes_foco").update({ fila }).eq("id", sessaoId);

    if (error) {
        console.warn("Erro ao republicar o cronograma da sessão:", error);
    }

    return { error };
};

/**
 * Registra que um bloco do cronograma foi cumprido sem passar pelo cronômetro
 * (estudou no caderno, na aula, etc.).
 *
 * Grava uma sessão comum já concluída, amarrada ao bloco — assim o mesmo cálculo
 * que já existe passa a enxergar o tempo: o bloco vira "cumprido" na aba Hoje e
 * os minutos entram no "Realizado" da semana, sem nenhuma regra nova.
 */
export const registrarBlocoComoFeito = async (params: {
    userId: string;
    disciplina: string;
    conteudo: string | null;
    minutos: number;
    origem: "rotina" | "plano";
    blocoId: string;
    planoId?: string | null;
    /** Dia do bloco na agenda ("YYYY-MM-DD"), que é o dia em que o estudo conta. Sem ele,
     *  vale hoje no fuso do aparelho — nunca o `CURRENT_DATE` do banco, que é UTC. */
    dataISO?: string;
}) => {
    const agora = new Date().toISOString();

    const { error } = await supabase.from("sessoes_foco").insert({
        user_id: params.userId,
        /*
          A aba Hoje casa bloco e sessão por `data_sessao` (ver buscarSessoesDoDia). Deixar
          o banco preencher com CURRENT_DATE em UTC fazia um bloco marcado depois das 21h
          ser gravado no dia seguinte — e voltar a aparecer como pendente na tela.
        */
        data_sessao: params.dataISO ?? paraDataISO(new Date()),
        disciplina: params.disciplina || "Estudo Geral",
        conteudo_especifico: params.conteudo || "Marcado como feito",
        tempo_minutos: params.minutos,
        questoes_respondidas: 0,
        questoes_acertadas: 0,
        is_public: false,
        status: "salvo",
        bloco_rotina_id: params.origem === "rotina" ? params.blocoId : null,
        bloco_plano_id: params.origem === "plano" ? params.blocoId : null,
        plano_id: params.planoId ?? null,
        ultimo_inicio: agora,
        concluido_em: agora,
    });

    return { error };
};

//Busca as sessões de um dia específico do usuário (usado pra calcular o status dos blocos da aba Hoje)
export const buscarSessoesDoDia = async (userId: string, dataISO: string) => {
    const { data, error } = await supabase
        .from('sessoes_foco')
        .select('*')
        .eq('user_id', userId)
        .eq('data_sessao', dataISO)
    return { data: data as SessaoFocoRow[] | null, error };
}

//Busca as sessões do usuário num intervalo de datas (inclusivo nas duas pontas)
export const buscarSessoesPeriodo = async (userId: string, inicioISO: string, fimISO: string) => {
    const { data, error } = await supabase
        .from('sessoes_foco')
        .select('*')
        .eq('user_id', userId)
        .gte('data_sessao', inicioISO)
        .lte('data_sessao', fimISO)
        .order('created_at', { ascending: false });
    return { data: data as SessaoFocoRow[] | null, error };
}

//Busca sessões da semana atual (segunda a domingo) do usuário
export const buscarSessoesSemana = async (userId: string) => {
    const { inicio, fim } = pegarIntervaloSemanaAtual();
    return buscarSessoesPeriodo(userId, inicio, fim);
}
