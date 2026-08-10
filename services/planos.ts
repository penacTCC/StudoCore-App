import { supabase } from "@/repositories/supabase";
import { formatarDuracao, paraDataISO } from "@/utils/tempo";
import { sincronizarLembretesPlano, cancelarLembretesPlano } from "@/services/lembretes";
import { toast } from "@/services/toast";
import type {
    AgendaPlano,
    BlocoPlano,
    NovoBlocoPlano,
    Plano,
    PlanoRow,
    ResultadoPlano,
} from "@/types/cronograma";

const DIAS_CURTOS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]; // 0 = segunda

function paraAgendaPlano(row: PlanoRow): AgendaPlano {
    if (row.agenda_tipo === "fixado" && row.agenda_dias) {
        return { tipo: "fixado", dias: row.agenda_dias.map((dia) => DIAS_CURTOS[dia]) };
    }
    if (row.agenda_tipo === "data" && row.agenda_data) {
        return { tipo: "data", data: row.agenda_data };
    }
    return { tipo: "nenhuma" };
}

function paraPlano(row: PlanoRow, blocos: { duracao_min: number }[]): Plano {
    const duracaoTotalMin = blocos.reduce((soma, b) => soma + b.duracao_min, 0);
    return {
        id: row.id,
        nome: row.nome,
        cor: row.cor,
        qtdBlocos: blocos.length,
        duracaoTotal: formatarDuracao(duracaoTotalMin),
        agenda: paraAgendaPlano(row),
        publico: row.publico ?? false,
        roadmapDeGrupo: !!(row.origem_grupo_id || row.origem_roadmap_plano_id),
    };
}

/**
 * Busca os planos do usuário, já com quantidade de blocos e duração total somadas
 * a partir de planos_blocos.
 */
export async function buscarPlanos(usuarioId: string): Promise<Plano[]> {
    const { data, error } = await supabase
        .from("planos")
        .select("*, planos_blocos(duracao_min)")
        .eq("usuario_id", usuarioId)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Erro ao buscar planos:", error.message);
        toast.error("Não foi possível carregar seus planos.");
        return [];
    }

    return (data as (PlanoRow & { planos_blocos: { duracao_min: number }[] })[]).map((row) =>
        paraPlano(row, row.planos_blocos)
    );
}

/**
 * Cria um novo plano, sem agenda definida ainda (fica "nenhuma" até o usuário fixar/agendar).
 *
 * `origemGrupoId` (opcional) marca o plano como o canônico de um roadmap de grupo por IA —
 * a fonte que a RPC `grupo_distribuir_roadmap` copia para os membros. Ver docs/plano-roadmap-ia.md.
 */
export async function criarPlano(
    usuarioId: string,
    nome: string,
    cor: string,
    publico = false,
    origemGrupoId?: string
): Promise<ResultadoPlano> {
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) {
        return { sucesso: false, erro: "O nome do plano não pode estar vazio." };
    }

    const { data, error } = await supabase
        .from("planos")
        .insert({
            usuario_id: usuarioId,
            nome: nomeLimpo,
            cor,
            publico,
            ...(origemGrupoId ? { origem_grupo_id: origemGrupoId } : {}),
        })
        .select()
        .single();

    if (error) {
        console.error("Erro ao criar plano:", error.message);
        return { sucesso: false, erro: "Erro inesperado ao criar plano." };
    }

    return { sucesso: true, plano: paraPlano(data as PlanoRow, []) };
}

/**
 * Compartilha (ou para de compartilhar) o plano no Explorar da Comunidade.
 *
 * Publicar expõe os blocos em leitura para qualquer pessoa — é o que dá sentido ao
 * "importar para meu cronograma" do card. Parar de compartilhar tira o card do feed, mas
 * não desfaz nada: quem já importou ficou com uma cópia, que é dessa pessoa e continua
 * valendo. Quem chama precisa deixar isso claro.
 */
export async function alternarPlanoPublico(
    planoId: string,
    publico: boolean
): Promise<ResultadoPlano> {
    return atualizarPlano(planoId, { publico });
}

/** Atualiza nome, cor e/ou compartilhamento de um plano existente. */
export async function atualizarPlano(
    planoId: string,
    dados: { nome?: string; cor?: string; publico?: boolean }
): Promise<ResultadoPlano> {
    const { data, error } = await supabase
        .from("planos")
        .update(dados)
        .eq("id", planoId)
        .select("*, planos_blocos(duracao_min)")
        .single();

    if (error) {
        console.error("Erro ao atualizar plano:", error.message);
        return { sucesso: false, erro: "Erro inesperado ao atualizar plano." };
    }

    const row = data as PlanoRow & { planos_blocos: { duracao_min: number }[] };
    return { sucesso: true, plano: paraPlano(row, row.planos_blocos) };
}

/** Busca um plano específico por id (usado ao abrir o editor pra edição). */
export async function buscarPlanoPorId(planoId: string): Promise<Plano | null> {
    const { data, error } = await supabase
        .from("planos")
        .select("*, planos_blocos(duracao_min)")
        .eq("id", planoId)
        .single();

    if (error || !data) {
        console.error("Erro ao buscar plano:", error?.message);
        toast.error("Não foi possível carregar o plano.");
        return null;
    }

    const row = data as PlanoRow & { planos_blocos: { duracao_min: number }[] };
    return paraPlano(row, row.planos_blocos);
}

/**
 * Só o nome do plano, em silêncio.
 *
 * A prévia da sessão usa isto para dizer de onde a sessão veio ("Do cronograma · ENEM
 * 2026"). Diferente de `buscarPlanoPorId`, não avisa nada em caso de erro: quem abre a
 * prévia de uma sessão alheia não enxerga o plano da outra pessoa (RLS), e isso é o
 * esperado — a linha simplesmente não aparece.
 */
export async function buscarNomeDoPlano(planoId: string): Promise<string | null> {
    const { data, error } = await supabase
        .from("planos")
        .select("nome")
        .eq("id", planoId)
        .maybeSingle();

    if (error || !data) return null;
    return (data as { nome: string }).nome;
}

/**
 * Aplica o plano a uma data específica — vence a rotina e qualquer plano fixado
 * nesse dia (ver comentário de `agenda_tipo` na migration). Reconfigura o próprio
 * plano em vez de duplicar: se outro plano já estava aplicado a essa mesma data,
 * ele volta a ficar "sem agenda" primeiro (só um plano pode ocupar cada data).
 */
export async function aplicarPlanoData(
    usuarioId: string,
    planoId: string,
    data: string
): Promise<ResultadoPlano> {
    const { data: planosLiberados, error: erroLimpeza } = await supabase
        .from("planos")
        .update({ agenda_tipo: "nenhuma", agenda_dias: null, agenda_data: null })
        .eq("usuario_id", usuarioId)
        .eq("agenda_tipo", "data")
        .eq("agenda_data", data)
        .neq("id", planoId)
        .select("id");

    if (erroLimpeza) {
        console.error("Erro ao liberar a data de outro plano:", erroLimpeza.message);
    } else {
        for (const liberado of planosLiberados ?? []) {
            const { data: blocosLiberado } = await buscarBlocosPlano(liberado.id);
            await cancelarLembretesPlano(liberado.id, (blocosLiberado ?? []).map((b) => b.id));
        }
    }

    const { data: row, error } = await supabase
        .from("planos")
        .update({ agenda_tipo: "data", agenda_dias: null, agenda_data: data })
        .eq("id", planoId)
        .select("*, planos_blocos(duracao_min)")
        .single();

    if (error) {
        console.error("Erro ao aplicar plano à data:", error.message);
        return { sucesso: false, erro: "Não foi possível aplicar o plano a essa data." };
    }

    await ressincronizarLembretesDoPlano(planoId);

    const linha = row as PlanoRow & { planos_blocos: { duracao_min: number }[] };
    return { sucesso: true, plano: paraPlano(linha, linha.planos_blocos) };
}

/** Atalho de `aplicarPlanoData` pra hoje. */
export async function aplicarPlanoHoje(usuarioId: string, planoId: string): Promise<ResultadoPlano> {
    return aplicarPlanoData(usuarioId, planoId, paraDataISO(new Date()));
}

/**
 * Fixa o plano nos dias da semana informados (0 = segunda ... 6 = domingo).
 * Só um plano "fixado" pode ocupar cada dia da semana — se colidir com outro
 * plano fixado do usuário, o banco recusa a operação (trigger no Postgres).
 */
export async function fixarPlanoEmDias(planoId: string, dias: number[]): Promise<ResultadoPlano> {
    const { data: row, error } = await supabase
        .from("planos")
        .update({ agenda_tipo: "fixado", agenda_dias: dias, agenda_data: null })
        .eq("id", planoId)
        .select("*, planos_blocos(duracao_min)")
        .single();

    if (error) {
        console.error("Erro ao fixar plano em dias:", error.message);
        const conflito = error.code === "P0001";
        return {
            sucesso: false,
            erro: conflito
                ? "Já existe outro plano fixado em um desses dias."
                : "Não foi possível fixar o plano nesses dias.",
        };
    }

    await ressincronizarLembretesDoPlano(planoId);

    const linha = row as PlanoRow & { planos_blocos: { duracao_min: number }[] };
    return { sucesso: true, plano: paraPlano(linha, linha.planos_blocos) };
}

/** Duplica um plano e os blocos dele como um novo plano solto, sem agenda. */
export async function duplicarPlano(usuarioId: string, planoId: string): Promise<ResultadoPlano> {
    const original = await buscarPlanoPorId(planoId);
    if (!original) {
        return { sucesso: false, erro: "Plano não encontrado." };
    }

    const { data: blocos, error: erroBlocos } = await buscarBlocosPlano(planoId);
    if (erroBlocos) {
        console.error("Erro ao buscar blocos pra duplicar:", erroBlocos.message);
        return { sucesso: false, erro: "Não foi possível duplicar os blocos do plano." };
    }

    const criado = await criarPlano(usuarioId, `${original.nome} (cópia)`, original.cor);
    if (!criado.sucesso || !criado.plano) return criado;

    for (const bloco of blocos ?? []) {
        await salvarBlocoPlano({
            plano_id: criado.plano.id,
            hora_inicio: bloco.hora_inicio,
            duracao_min: bloco.duracao_min,
            tipo: bloco.tipo,
            materia_id: bloco.materia_id,
            topico: bloco.topico,
            notificar: bloco.notificar,
            antecedencia_min: bloco.antecedencia_min,
            sessao_id: bloco.sessao_id,
            dia_semana: bloco.dia_semana,
        });
    }

    return { sucesso: true, plano: { ...criado.plano, qtdBlocos: blocos?.length ?? 0 } };
}

/** Exclui um plano. Os blocos do plano vão junto (ON DELETE CASCADE em planos_blocos). */
export async function excluirPlano(planoId: string): Promise<{ sucesso: boolean; erro?: string }> {
    const { data: blocos } = await buscarBlocosPlano(planoId);

    const { error } = await supabase.from("planos").delete().eq("id", planoId);

    if (error) {
        console.error("Erro ao excluir plano:", error.message);
        return { sucesso: false, erro: "Erro ao remover o plano." };
    }

    await cancelarLembretesPlano(planoId, (blocos ?? []).map((b) => b.id));

    return { sucesso: true };
}

// ───── CRUD de blocos dentro de um plano ─────

/** Busca os blocos de um plano, ordenados por horário. */
export async function buscarBlocosPlano(planoId: string) {
    const { data, error } = await supabase
        .from("planos_blocos")
        .select("*")
        .eq("plano_id", planoId)
        .order("hora_inicio", { ascending: true });

    return { data: data as BlocoPlano[] | null, error };
}

/**
 * Reagenda os lembretes de um plano a partir da agenda dele agora no banco —
 * usado depois de qualquer mudança que possa afetar quando os blocos disparam
 * (blocos criados/editados, ou a agenda do plano mudou).
 */
export async function ressincronizarLembretesDoPlano(planoId: string): Promise<void> {
    const { data: planoRow, error } = await supabase
        .from("planos")
        .select("id, agenda_tipo, agenda_dias, agenda_data")
        .eq("id", planoId)
        .single();
    if (error || !planoRow) return;

    const { data: blocos } = await buscarBlocosPlano(planoId);
    await sincronizarLembretesPlano(
        planoRow as { id: string; agenda_tipo: "fixado" | "data" | "nenhuma"; agenda_dias: number[] | null; agenda_data: string | null },
        blocos ?? []
    );
}

/** Salva um novo bloco dentro de um plano. */
export const salvarBlocoPlano = async (bloco: NovoBlocoPlano) => {
    const result = await supabase.from("planos_blocos").insert(bloco).select();
    return result;
};

/** Edita um bloco existente de um plano. */
export const editarBlocoPlano = async (bloco: BlocoPlano) => {
    const result = await supabase
        .from("planos_blocos")
        .update(bloco)
        .eq("id", bloco.id)
        .select();
    return result;
};

/** Exclui um bloco de um plano. */
/**
 * Empurra o horário de um bloco de plano em `minutos`.
 *
 * Atenção: o bloco pertence ao plano, então isso vale para todos os dias em que
 * esse plano se aplica — quem chama precisa deixar isso claro pro usuário.
 */
export const adiarBlocoPlano = async (blocoId: string, minutos: number) => {
    const { data: atual, error: erroBusca } = await supabase
        .from("planos_blocos")
        .select("*")
        .eq("id", blocoId)
        .maybeSingle();

    if (erroBusca || !atual) return { error: erroBusca ?? new Error("Bloco não encontrado") };

    const linha = atual as BlocoPlano;
    const [h, m] = linha.hora_inicio.split(":").map(Number);
    const totalMin = (h * 60 + m + minutos + 1440) % 1440;
    const hora_inicio = `${Math.floor(totalMin / 60).toString().padStart(2, "0")}:${(totalMin % 60)
        .toString()
        .padStart(2, "0")}`;

    const { error } = await supabase.from("planos_blocos").update({ hora_inicio }).eq("id", blocoId);
    if (!error) await ressincronizarLembretesDoPlano(linha.plano_id);
    return { error };
};

export const excluirBlocoPlano = async (blocoId: string) => {
    const { error } = await supabase.from("planos_blocos").delete().eq("id", blocoId);
    return { error };
};
