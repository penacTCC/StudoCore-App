/**
 * Roadmap de estudos por IA (pessoal + grupo).
 *
 * Duas metades:
 *
 * 1. GERAÇÃO — chama a Edge Function `gerar-roadmap-estudo` com objetivo + PDF opcional
 *    em base64 (mesmo contrato de `analisar-anexo-sessao`). A função devolve uma PROPOSTA
 *    (nome + blocos), nada é gravado; quem decide é a revisão humana na prévia
 *    (`app/(modals)/roadmap-preview.tsx`).
 * 2. MATERIALIZAÇÃO — aceitar a proposta:
 *    - Pessoal: vira um plano seu via `criarPlano` + `salvarBlocoPlano` em loop (mesmo
 *      padrão de `duplicarPlano`), com `agenda_tipo` "nenhuma". As matérias livres que a
 *      IA devolve são reconciliadas com `materias_usuario` por nome normalizado — se não
 *      existe, cria (mesma lógica da cópia de plano da Comunidade).
 *    - Grupo (admin): cria o plano CANÔNICO do roadmap (`origem_grupo_id`) e distribui
 *      para os membros via RPC `grupo_distribuir_roadmap`, que faz a mesma cópia+matéria
 *      no banco e notifica o grupo.
 *
 * Regra de ouro (AGENTS.md): falha da IA nunca trava o fluxo. Quem chama deve sempre ter
 * o "criar plano manual" como saída — mesmo espírito de `services/quizIA.ts`.
 */

import { supabase } from "@/repositories/supabase";
import { criarPlano, salvarBlocoPlano } from "@/services/planos";
import { buscarMateriasUsuario, criarMateria, normalizarNomeMateria } from "@/services/materias";
import { CORES_PLANO } from "@/constants/hades";
import { mensagemDeLimite } from "@/services/assinatura";
import type {
    BlocoRoadmapCanonico,
    BlocoRoadmapProposta,
    EscopoRoadmap,
    ProgressoRoadmapGrupo,
    ProgressoRoadmapMembro,
    RoadmapProposta,
} from "@/types/roadmap";

/**
 * Pede a proposta de roadmap ao Gemini (via Edge Function). Devolve `{ data, error }` —
 * nunca lança, para o fallback da tela ser simples.
 */
export const gerarRoadmap = async (params: {
    objetivo: string;
    contexto?: string | null;
    escopo: EscopoRoadmap;
    /** @deprecated use `arquivos` para múltiplos materiais. */
    arquivo?: { base64: string; mimeType: string } | null;
    /** Múltiplos materiais de estudo (edital, ementa, lista de exercícios). */
    arquivos?: { base64: string; mimeType: string; nome: string }[];
    disponibilidade?: string;
}): Promise<{ data: RoadmapProposta | null; error: string | null }> => {
    const { data, error } = await supabase.functions.invoke("gerar-roadmap-estudo", {
        body: {
            objetivo: params.objetivo,
            contexto: params.contexto ?? null,
            escopo: params.escopo,
            base64: params.arquivo?.base64,
            mimeType: params.arquivo?.mimeType,
            arquivos: params.arquivos ?? null,
            disponibilidade: params.disponibilidade ?? null,
        },
    });

    if (error) {
        /*
          Mesmo tratamento do quiz/anexo: `invoke` transforma resposta não-2xx num
          FunctionsHttpError de mensagem genérica; o motivo real vive no corpo, em
          `context`. Sem ler isso, a tela não teria como explicar a falha.
        */
        // Cota estourada (429) tem texto próprio, voltado ao usuário.
        let detalhe: string | null = await mensagemDeLimite(error);
        if (!detalhe) {
            try {
                const corpo = await (error as any)?.context?.json?.();
                detalhe = corpo?.detalhe ?? corpo?.error ?? null;
            } catch {
                // Corpo não era JSON — segue com a mensagem genérica.
            }
        }

        console.warn("Erro ao gerar roadmap por IA:", detalhe ?? error);
        return { data: null, error: detalhe ?? error.message ?? "Erro ao gerar o roadmap." };
    }

    if (
        !data ||
        typeof data.nome !== "string" ||
        !Array.isArray(data.blocos) ||
        data.blocos.length === 0
    ) {
        console.warn("Roadmap gerado veio vazio ou em formato inesperado:", data);
        return { data: null, error: "Proposta vazia ou inválida." };
    }

    return {
        data: {
            nome: data.nome,
            resumoObjetivo: data.resumoObjetivo ?? "",
            blocos: data.blocos as BlocoRoadmapProposta[],
        },
        error: null,
    };
};

/**
 * Resolve o id da matéria no acervo do usuário pelo nome que a IA devolveu — e cria a
 * matéria custom quando não há equivalente. Mesma reconciliação por nome normalizado da
 * cópia de plano da Comunidade / da distribuição de roadmap no banco.
 */
async function resolverMateria(usuarioId: string, nome: string): Promise<string | null> {
    const materias = await buscarMateriasUsuario(usuarioId);
    const normalizado = normalizarNomeMateria(nome);

    const achada = materias.find((m) => m.nomeNormalizado === normalizado);
    if (achada?.id) return achada.id;

    const criada = await criarMateria(usuarioId, nome.trim());
    return criada.sucesso && criada.materia?.id ? criada.materia.id : null;
}

/** Materializa a proposta como um plano seu, sem agenda (você fixa/aplica depois). */
export async function aceitarRoadmapPessoal(
    usuarioId: string,
    proposta: RoadmapProposta
): Promise<{ sucesso: boolean; erro?: string; planoId?: string }> {
    const cor = CORES_PLANO[Math.floor(Math.random() * CORES_PLANO.length)];
    const criado = await criarPlano(usuarioId, proposta.nome, cor, false, undefined, true);
    if (!criado.sucesso || !criado.plano) {
        return { sucesso: false, erro: criado.erro ?? "Não foi possível criar o plano." };
    }

    for (const bloco of proposta.blocos) {
        const materiaId = await resolverMateria(usuarioId, bloco.materia);
        const { error } = await salvarBlocoPlano({
            plano_id: criado.plano.id,
            hora_inicio: bloco.horaInicio,
            duracao_min: bloco.duracaoMin,
            tipo: "estudo",
            materia_id: materiaId,
            topico: bloco.topico || null,
            notificar: true,
            antecedencia_min: null,
            dia_semana: bloco.diaSemana,
        });
        if (error) {
            console.error("Erro ao salvar bloco do roadmap:", error.message);
            return { sucesso: false, erro: "Não foi possível salvar os blocos do plano." };
        }
    }

    return { sucesso: true, planoId: criado.plano.id };
}

/**
 * Cria o plano canônico do roadmap de um grupo (dono = admin, com `origem_grupo_id`) e
 * distribui uma cópia para cada membro. A distribuição em si é a RPC SECURITY DEFINER,
 * que confere admin no banco, copia + reconcilia matéria e notifica o grupo.
 */
export async function publicarRoadmapGrupo(
    usuarioId: string,
    grupoId: string,
    proposta: RoadmapProposta
): Promise<{ sucesso: boolean; erro?: string; copias?: number }> {
    const cor = CORES_PLANO[Math.floor(Math.random() * CORES_PLANO.length)];
    const criado = await criarPlano(usuarioId, proposta.nome, cor, false, grupoId, true);
    if (!criado.sucesso || !criado.plano) {
        return { sucesso: false, erro: criado.erro ?? "Não foi possível criar o roadmap." };
    }

    for (const bloco of proposta.blocos) {
        const materiaId = await resolverMateria(usuarioId, bloco.materia);
        const { error } = await salvarBlocoPlano({
            plano_id: criado.plano.id,
            hora_inicio: bloco.horaInicio,
            duracao_min: bloco.duracaoMin,
            tipo: "estudo",
            materia_id: materiaId,
            topico: bloco.topico || null,
            notificar: true,
            antecedencia_min: null,
            dia_semana: bloco.diaSemana,
        });
        if (error) {
            console.error("Erro ao salvar bloco do roadmap do grupo:", error.message);
            return { sucesso: false, erro: "Não foi possível salvar os blocos do roadmap." };
        }
    }

    const distribuido = await distribuirRoadmapGrupo(criado.plano.id);
    if (!distribuido.sucesso) {
        return { sucesso: false, erro: distribuido.erro ?? "Não foi possível distribuir o roadmap." };
    }

    return { sucesso: true, copias: distribuido.copias };
}

/** Chama a RPC que copia o roadmap canônico para todos os membros do grupo (só admin). */
export async function distribuirRoadmapGrupo(
    planoId: string
): Promise<{ sucesso: boolean; erro?: string; copias?: number }> {
    const { data, error } = await supabase.rpc("grupo_distribuir_roadmap", {
        p_plano_id: planoId,
    });

    if (error) {
        console.error("Erro ao distribuir roadmap do grupo:", error.message);
        return { sucesso: false, erro: error.message ?? "Não foi possível distribuir o roadmap." };
    }

    return { sucesso: true, copias: Number(data) || 0 };
}

// ───── Progresso coletivo ─────

/** Marca um bloco meu como concluído (toggle manual). A RLS só permite no próprio plano. */
export async function marcarBlocoRoadmapConcluido(
    usuarioId: string,
    blocoId: string,
    concluido: boolean
): Promise<{ sucesso: boolean; erro?: string }> {
    const { error } = concluido
        ? await supabase.from("planos_blocos_concluidos").insert({ usuario_id: usuarioId, bloco_id: blocoId })
        : await supabase.from("planos_blocos_concluidos").delete().eq("bloco_id", blocoId);

    if (error) {
        console.error("Erro ao atualizar conclusão do bloco:", error.message);
        return { sucesso: false, erro: "Não foi possível marcar o bloco." };
    }
    return { sucesso: true };
}

/** Os blocos que EU marquei como concluídos neste plano. */
export async function buscarBlocosConcluidos(planoId: string): Promise<Set<string>> {
    const { data: blocos, error: erroBlocos } = await supabase
        .from("planos_blocos")
        .select("id")
        .eq("plano_id", planoId);

    if (erroBlocos || !blocos) return new Set();

    const ids = (blocos as { id: string }[]).map((b) => b.id);
    if (ids.length === 0) return new Set();

    const { data, error } = await supabase
        .from("planos_blocos_concluidos")
        .select("bloco_id")
        .in("bloco_id", ids);

    if (error) return new Set();
    return new Set((data as { bloco_id: string }[]).map((linha) => linha.bloco_id));
}

/** Progresso semanal do roadmap do grupo — RPC SECURITY DEFINER, cruzando com membros. */
export async function buscarProgressoRoadmapGrupo(grupoId: string): Promise<ProgressoRoadmapGrupo | null> {
    const { data, error } = await supabase.rpc("grupo_progresso_roadmap", {
        p_grupo_id: grupoId,
    });

    if (error) {
        console.error("Erro ao buscar progresso do roadmap do grupo:", error.message);
        return null;
    }

    const linha = (data as ProgressoRoadmapGrupo[] | null)?.[0];
    if (!linha) return null;

    return {
        plano_id: linha.plano_id,
        nome: linha.nome,
        cor: linha.cor,
        total_blocos_semana: Number(linha.total_blocos_semana) || 0,
        total_membros: Number(linha.total_membros) || 0,
        membros_completaram: Number(linha.membros_completaram) || 0,
    };
}

/** Progresso semanal do roadmap, um por membro — alimenta a lista individual da tela de progresso. */
export async function buscarProgressoRoadmapMembros(grupoId: string): Promise<ProgressoRoadmapMembro[]> {
    const { data, error } = await supabase.rpc("grupo_progresso_roadmap_membros", {
        p_grupo_id: grupoId,
    });

    if (error) {
        console.error("Erro ao buscar progresso por membro do roadmap:", error.message);
        return [];
    }

    return ((data as any[]) ?? []).map((linha) => ({
        user_id: linha.user_id,
        blocos_concluidos: Number(linha.blocos_concluidos) || 0,
        blocos_estudo: Number(linha.blocos_estudo) || 0,
    }));
}

/** Os blocos do roadmap canônico do grupo — só leitura, para a lista da tela de progresso. */
export async function buscarBlocosRoadmapGrupo(grupoId: string): Promise<BlocoRoadmapCanonico[]> {
    const { data, error } = await supabase.rpc("grupo_roadmap_blocos", {
        p_grupo_id: grupoId,
    });

    if (error) {
        console.error("Erro ao buscar blocos do roadmap do grupo:", error.message);
        return [];
    }

    return ((data as any[]) ?? []).map((linha) => ({
        diaSemana: linha.dia_semana === null || linha.dia_semana === undefined ? null : Number(linha.dia_semana),
        horaInicio: linha.hora_inicio,
        duracaoMin: Number(linha.duracao_min) || 0,
        tipo: linha.tipo,
        materiaNome: linha.materia_nome ?? null,
        materiaCor: linha.materia_cor ?? null,
        topico: linha.topico ?? null,
    }));
}
