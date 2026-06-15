import { supabase } from "@/repositories/supabase";
import { SessaoFocoInsert } from "@/types/sessions";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TEST_MODE_KEY = "@app_test_mode";

const isMissingGroupColumnError = (error: any) => {
    // O Postgres usa 42703 quando uma coluna referenciada na query ainda não existe.
    const isDatabaseMissingColumn = error?.code === "42703" && String(error?.message || "").includes("grupo_id");

    // O PostgREST usa PGRST204 quando a coluna ainda não apareceu no schema cache da API.
    const isSchemaCacheMissingColumn = error?.code === "PGRST204" && String(error?.message || "").includes("grupo_id");

    // Qualquer uma das duas respostas significa que precisamos cair no payload sem `grupo_id`.
    return isDatabaseMissingColumn || isSchemaCacheMissingColumn;
};

const removeGroupIdFromPayload = <T extends Partial<SessaoFocoInsert>>(payload: T) => {
    // Cria uma cópia para não mutar o objeto original recebido pela tela ou hook.
    const payloadWithoutGroupId = { ...payload };

    // Remove `grupo_id` quando o banco remoto ainda não recebeu a migration dessa coluna.
    delete payloadWithoutGroupId.grupo_id;

    // Devolve o payload compatível com o schema antigo.
    return payloadWithoutGroupId;
};

/**
 * Calcula a duração persistida da sessão a partir dos segundos reais do cronômetro.
 * No modo normal, 60 segundos viram 1 minuto; no modo teste, 10 segundos viram 60 minutos.
 */
export const calculateFocusSessionMinutes = async (timerSeconds: number) => {
    // Lê a preferência local usada pela tela de configurações para ativar o modo teste.
    const testModeValue = await AsyncStorage.getItem(TEST_MODE_KEY);

    // Converte o valor persistido em booleano explícito para evitar truthy acidental.
    const isTestModeEnabled = testModeValue === "true";

    // Protege o cálculo contra valores inválidos vindos de params ou restauração de sessão.
    const safeSeconds = Number.isFinite(timerSeconds) && timerSeconds > 0 ? timerSeconds : 0;

    // No modo teste, cada segundo vale 6 minutos, então 10s fecham exatamente 60min.
    const calculatedMinutes = isTestModeEnabled ? safeSeconds * 6 : safeSeconds / 60;

    // Arredonda para o inteiro mais próximo porque a coluna `tempo_minutos` é INTEGER.
    return Math.max(1, Math.round(calculatedMinutes));
};

// ───── INSERT ─────
export const salvarSessaoFoco = async (sessao: SessaoFocoInsert) => {
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
export const atualizarSessaoFoco = async (id: string, updates: Partial<SessaoFocoInsert>) => {
    // Tenta atualizar com `grupo_id`, mantendo a sessão vinculada ao grupo quando o schema já permite.
    const result = await supabase.from("sessoes_foco").update(updates).eq("id", id);

    // Se a coluna ainda não existe no remoto, remove só `grupo_id` e preserva todos os outros dados da sessão.
    if (result.error && isMissingGroupColumnError(result.error)) {
        return await supabase.from("sessoes_foco").update(removeGroupIdFromPayload(updates)).eq("id", id);
    }

    // Retorna o resultado original quando a migration já foi aplicada ou quando há outro erro real.
    return result;
};

// ───── SELECT (feed público, só sessões públicas, status salvo e score > 7) ─────
export const buscarSessoesRecentes = async (limit: number = 20, groupId?: string | null) => {
    // Monta a query base do feed: apenas sessões públicas, salvas e com bom desempenho no quiz.
    let query = supabase
        .from("sessoes_foco")
        .select(`
            *,
            profiles:user_id (
                nome_real,
                nome_usuario,
                foto_usuario
            )
        `)
        .eq("is_public", true)
        .eq("status", "salvo")
        .gt("questoes_acertadas", 7);

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
        return await supabase
            .from("sessoes_foco")
            .select(`
                *,
                profiles:user_id (
                    nome_real,
                    nome_usuario,
                    foto_usuario
                )
            `)
            .eq("is_public", true)
            .eq("status", "salvo")
            .gt("questoes_acertadas", 7)
            .in("user_id", memberIds)
            .order("created_at", { ascending: false })
            .limit(limit);
    }

    // Retorna a query principal quando o schema já tem `grupo_id`.
    return result;
};

// ───── SELECT (sessões de um usuário específico) ─────
export const buscarSessoesPorUsuario = async (userId: string, limit: number = 20) => {
    return await supabase
        .from("sessoes_foco")
        .select(`
            *,
            profiles:user_id (
                nome_real,
                nome_usuario,
                foto_usuario
            )
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);
};
