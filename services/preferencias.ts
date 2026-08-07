import { supabase } from "@/repositories/supabase";
import { toast } from "@/services/toast";
import type { PreferenciasCronograma } from "@/types/cronograma";
import {
    DURACAO_BLOCO_UNICO_MAX,
    DURACAO_BLOCO_UNICO_MIN,
    DURACAO_POMODORO_MAX,
    DURACAO_POMODORO_MIN,
} from "@/constants/cronograma";

export const PADRAO_PREFERENCIAS: PreferenciasCronograma = {
    focoMin: 25,
    descansoCurtoMin: 5,
    descansoLongoMin: 15,
    ciclosAteLongo: 4,
    autoDescanso: true,
    autoFoco: false,
    notificacoesAtivas: true,
    antecedenciaMin: 10,
    avisarFimDeFase: true,
    naoPerturbar: true,
    naoPerturbarInicio: "22:00",
    naoPerturbarFim: "07:00",
    vibrar: true,
    manterTelaLigada: false,
    duracaoPadraoBlocoMin: 50,
    duracaoPadraoDescansoMin: 10,
    contarDescansoComoEstudado: false,
    anotarAposQuiz: true,
    fotoAposSessao: true,
    aparecerNoRanking: true,
    sessaoPublicaPadrao: true,
    // Publicar para estranhos é escolha, não default. Ver 20260807190000_feed_publico_opt_in.
    feedPublico: false,
};

/** Linha de `preferencias_cronograma` — chaves batem com as colunas da tabela. */
type PreferenciasRow = {
    usuario_id: string;
    foco_min: number;
    descanso_curto_min: number;
    descanso_longo_min: number;
    ciclos_ate_longo: number;
    auto_descanso: boolean;
    auto_foco: boolean;
    notificacoes_ativas: boolean;
    antecedencia_min: number;
    avisar_fim_de_fase: boolean;
    resumo_dia_seguinte: boolean;
    nao_perturbar: boolean;
    nao_perturbar_inicio: string;
    nao_perturbar_fim: string;
    som_fim_foco: boolean;
    vibrar: boolean;
    manter_tela_ligada: boolean;
    inicio_semana: "domingo" | "segunda";
    duracao_padrao_bloco_min: number;
    duracao_padrao_descanso_min: number;
    contar_descanso_como_estudado: boolean;
    anotar_apos_quiz: boolean;
    foto_apos_sessao: boolean;
    aparecer_no_ranking: boolean;
    sessao_publica_padrao: boolean;
    feed_publico: boolean;
};

const entre = (valor: number, min: number, max: number) => Math.min(max, Math.max(min, valor));

/*
  As durações são normalizadas na leitura, e não só nos steppers da tela.

  Antes das configurações passarem a usar os limites do cronograma, dava para salvar um
  foco de 5min ou um bloco de 10min. Quem fez isso tem a linha gravada assim até hoje: sem
  o ajuste aqui, a tela mostraria 5min enquanto o cronograma usaria 25 — que é exatamente
  a divergência que os limites compartilhados foram corrigir. O valor corrigido volta pro
  banco no próximo autosave.
*/
function paraPreferencias(row: PreferenciasRow): PreferenciasCronograma {
    return {
        focoMin: entre(row.foco_min, DURACAO_POMODORO_MIN, DURACAO_POMODORO_MAX),
        descansoCurtoMin: row.descanso_curto_min,
        descansoLongoMin: row.descanso_longo_min,
        ciclosAteLongo: row.ciclos_ate_longo,
        autoDescanso: row.auto_descanso,
        autoFoco: row.auto_foco,
        notificacoesAtivas: row.notificacoes_ativas,
        antecedenciaMin: row.antecedencia_min,
        avisarFimDeFase: row.avisar_fim_de_fase,
        naoPerturbar: row.nao_perturbar,
        naoPerturbarInicio: row.nao_perturbar_inicio.slice(0, 5),
        naoPerturbarFim: row.nao_perturbar_fim.slice(0, 5),
        vibrar: row.vibrar,
        manterTelaLigada: row.manter_tela_ligada,
        duracaoPadraoBlocoMin: entre(
            row.duracao_padrao_bloco_min,
            DURACAO_BLOCO_UNICO_MIN,
            DURACAO_BLOCO_UNICO_MAX
        ),
        duracaoPadraoDescansoMin: row.duracao_padrao_descanso_min,
        contarDescansoComoEstudado: row.contar_descanso_como_estudado,
        anotarAposQuiz: row.anotar_apos_quiz ?? true,
        fotoAposSessao: row.foto_apos_sessao ?? true,
        aparecerNoRanking: row.aparecer_no_ranking ?? true,
        sessaoPublicaPadrao: row.sessao_publica_padrao ?? true,
        // Coluna ausente (linha gravada antes da migration) cai para desligado: no feed
        // público, o lado seguro do `??` é não publicar.
        feedPublico: row.feed_publico ?? false,
    };
}

function paraRow(usuarioId: string, prefs: PreferenciasCronograma): PreferenciasRow {
    return {
        usuario_id: usuarioId,
        foco_min: prefs.focoMin,
        descanso_curto_min: prefs.descansoCurtoMin,
        descanso_longo_min: prefs.descansoLongoMin,
        ciclos_ate_longo: prefs.ciclosAteLongo,
        auto_descanso: prefs.autoDescanso,
        auto_foco: prefs.autoFoco,
        notificacoes_ativas: prefs.notificacoesAtivas,
        antecedencia_min: prefs.antecedenciaMin,
        avisar_fim_de_fase: prefs.avisarFimDeFase,
        nao_perturbar: prefs.naoPerturbar,
        nao_perturbar_inicio: prefs.naoPerturbarInicio,
        nao_perturbar_fim: prefs.naoPerturbarFim,
        vibrar: prefs.vibrar,
        /*
          Interruptores removidos do app: o som de fim de foco nunca chegou a existir (não
          há biblioteca de áudio no projeto) e o resumo do dia seguinte nunca foi ligado a
          nenhum agendamento. As colunas continuam no banco, como `inicio_semana`, e vão
          com valor fixo até serem retiradas numa migration.
        */
        som_fim_foco: false,
        resumo_dia_seguinte: false,
        manter_tela_ligada: prefs.manterTelaLigada,
        // A escolha domingo/segunda foi removida do app; a coluna continua no
        // banco e é preenchida com o único valor que o cronograma usa.
        inicio_semana: "segunda",
        duracao_padrao_bloco_min: prefs.duracaoPadraoBlocoMin,
        duracao_padrao_descanso_min: prefs.duracaoPadraoDescansoMin,
        contar_descanso_como_estudado: prefs.contarDescansoComoEstudado,
        anotar_apos_quiz: prefs.anotarAposQuiz,
        foto_apos_sessao: prefs.fotoAposSessao,
        aparecer_no_ranking: prefs.aparecerNoRanking,
        sessao_publica_padrao: prefs.sessaoPublicaPadrao,
        feed_publico: prefs.feedPublico,
    };
}

/** Busca as preferências do usuário. Se ele ainda não tiver linha salva, devolve os padrões. */
export async function buscarPreferencias(usuarioId: string): Promise<PreferenciasCronograma> {
    const { data, error } = await supabase
        .from("preferencias_cronograma")
        .select("*")
        .eq("usuario_id", usuarioId)
        .maybeSingle();

    if (error) {
        console.error("Erro ao buscar preferências de cronograma:", error.message);
        toast.error("Não foi possível carregar suas preferências.");
        return PADRAO_PREFERENCIAS;
    }
    if (!data) return PADRAO_PREFERENCIAS;

    return paraPreferencias(data as PreferenciasRow);
}

/** Salva (cria ou atualiza) as preferências do usuário de uma vez só. */
export async function salvarPreferencias(
    usuarioId: string,
    prefs: PreferenciasCronograma
): Promise<{ sucesso: boolean; erro?: string }> {
    const { error } = await supabase
        .from("preferencias_cronograma")
        .upsert(paraRow(usuarioId, prefs));

    if (error) {
        console.error("Erro ao salvar preferências de cronograma:", error.message);
        return { sucesso: false, erro: "Não foi possível salvar as preferências." };
    }

    cache = { usuarioId, prefs, expiraEm: Date.now() + VALIDADE_CACHE_MS };
    return { sucesso: true };
}

/*
  Cache curto das preferências do usuário logado.

  Existe porque os services de lembrete consultam as preferências uma vez por
  bloco ao reagendar — sem isso, salvar um plano de 12 blocos viraria 12 idas ao
  banco só pra reler a mesma linha.
*/
const VALIDADE_CACHE_MS = 30_000;
let cache: { usuarioId: string; prefs: PreferenciasCronograma; expiraEm: number } | null = null;

export function invalidarCachePreferencias() {
    cache = null;
}

/**
 * Preferências do usuário logado, do jeito que os services precisam (eles não
 * recebem `usuarioId` em toda chamada). Devolve os padrões se não houver sessão.
 */
export async function preferenciasDoUsuarioAtual(): Promise<PreferenciasCronograma> {
    const { data } = await supabase.auth.getUser();
    const usuarioId = data.user?.id;
    if (!usuarioId) return PADRAO_PREFERENCIAS;

    if (cache && cache.usuarioId === usuarioId && cache.expiraEm > Date.now()) {
        return cache.prefs;
    }

    const prefs = await buscarPreferencias(usuarioId);
    cache = { usuarioId, prefs, expiraEm: Date.now() + VALIDADE_CACHE_MS };
    return prefs;
}
