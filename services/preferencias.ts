import { supabase } from "@/repositories/supabase";
import { toast } from "@/services/toast";
import type { PreferenciasCronograma } from "@/types/cronograma";

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
    resumoDiaSeguinte: false,
    naoPerturbar: true,
    naoPerturbarInicio: "22:00",
    naoPerturbarFim: "07:00",
    somFimFoco: true,
    vibrar: true,
    manterTelaLigada: false,
    inicioSemana: "segunda",
    duracaoPadraoBlocoMin: 50,
    duracaoPadraoDescansoMin: 10,
    contarDescansoComoEstudado: false,
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
};

function paraPreferencias(row: PreferenciasRow): PreferenciasCronograma {
    return {
        focoMin: row.foco_min,
        descansoCurtoMin: row.descanso_curto_min,
        descansoLongoMin: row.descanso_longo_min,
        ciclosAteLongo: row.ciclos_ate_longo,
        autoDescanso: row.auto_descanso,
        autoFoco: row.auto_foco,
        notificacoesAtivas: row.notificacoes_ativas,
        antecedenciaMin: row.antecedencia_min,
        avisarFimDeFase: row.avisar_fim_de_fase,
        resumoDiaSeguinte: row.resumo_dia_seguinte,
        naoPerturbar: row.nao_perturbar,
        naoPerturbarInicio: row.nao_perturbar_inicio.slice(0, 5),
        naoPerturbarFim: row.nao_perturbar_fim.slice(0, 5),
        somFimFoco: row.som_fim_foco,
        vibrar: row.vibrar,
        manterTelaLigada: row.manter_tela_ligada,
        inicioSemana: row.inicio_semana,
        duracaoPadraoBlocoMin: row.duracao_padrao_bloco_min,
        duracaoPadraoDescansoMin: row.duracao_padrao_descanso_min,
        contarDescansoComoEstudado: row.contar_descanso_como_estudado,
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
        resumo_dia_seguinte: prefs.resumoDiaSeguinte,
        nao_perturbar: prefs.naoPerturbar,
        nao_perturbar_inicio: prefs.naoPerturbarInicio,
        nao_perturbar_fim: prefs.naoPerturbarFim,
        som_fim_foco: prefs.somFimFoco,
        vibrar: prefs.vibrar,
        manter_tela_ligada: prefs.manterTelaLigada,
        inicio_semana: prefs.inicioSemana,
        duracao_padrao_bloco_min: prefs.duracaoPadraoBlocoMin,
        duracao_padrao_descanso_min: prefs.duracaoPadraoDescansoMin,
        contar_descanso_como_estudado: prefs.contarDescansoComoEstudado,
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
    return { sucesso: true };
}
