/**
 * Feed público da Comunidade.
 *
 * As três origens vêm do banco, cada uma pela RPC dela:
 *
 * - GALERIA (`comunidade_feed_galeria`): sessões com foto de quem optou pelo feed. A foto
 *   é assinada em lote, porque o bucket é privado (ver 20260806090000_fotos_sessao.sql).
 * - ARQUIVOS (`comunidade_feed_arquivos`) e PLANOS (`comunidade_feed_planos`): as duas
 *   origens que ganharam `publico` em 20260807210000. Diferente da galeria, aqui não há
 *   preferência global no meio: publicar é um ato explícito por item.
 *
 * Curtida, comentário, denúncia e bloqueio valem igual para as três: apontam para o par
 * (origem, referencia_id), e a RLS recusa a interação numa publicação que saiu do ar.
 */

import { supabase } from "@/repositories/supabase";
import { assinarCaminhosDeFoto } from "@/services/fotosSessao";
import { avisarInteracao } from "@/services/notificacoes";
import { CORES_PLANO } from "@/constants/hades";
import type {
    ComentarioPublicacao,
    FiltroComunidade,
    MateriaDoPlano,
    PaginaDoFeed,
    PreviaPlano,
    Publicacao,
    PublicacaoArquivo,
    PublicacaoGaleria,
    PublicacaoPlano,
    ReferenciaPublicacao,
    TipoPublicacao,
} from "@/types/comunidade";

const TAMANHO_PAGINA = 6;

/** Chave de lista: única entre origens e estável entre páginas. */
const chaveDe = (ref: ReferenciaPublicacao) => `${ref.origem}:${ref.referenciaId}`;

/**
 * Cor da matéria no card.
 *
 * A sessão guarda só o nome da disciplina em texto; a cor escolhida pela pessoa vive em
 * `materias_usuario`, que é dela e não do feed. Um hash do nome sobre a paleta HADES dá
 * uma cor estável para a mesma matéria em todos os cards, sem join nenhum.
 */
function corDaMateria(nome: string): string {
    let soma = 0;
    for (let i = 0; i < nome.length; i++) soma = (soma + nome.charCodeAt(i)) % 997;
    return CORES_PLANO[soma % CORES_PLANO.length];
}

// ─────────────────────────────────────────────────────────────────────────────
// Cursor
//
// O feed junta três fontes que paginam em ritmos diferentes, então um cursor só não
// serve: ele guarda a posição keyset de cada uma. Vai e volta como string opaca.
//
// A origem SAI do objeto quando se esgota — é o que distingue "ainda não comecei"
// (presente, valendo `null`) de "acabou" (ausente). Quando não sobra nenhuma, o cursor
// inteiro vira `null` e o scroll infinito para.
// ─────────────────────────────────────────────────────────────────────────────
type Posicao = { criadoEm: string; id: string };
type Cursor = Partial<Record<TipoPublicacao, Posicao | null>>;

const ORIGENS: TipoPublicacao[] = ["galeria", "arquivo", "plano"];

const CURSOR_INICIAL: Cursor = { galeria: null, arquivo: null, plano: null };

function lerCursor(bruto?: string | null): Cursor {
    if (!bruto) return CURSOR_INICIAL;
    try {
        return JSON.parse(bruto) as Cursor;
    } catch {
        return CURSOR_INICIAL;
    }
}

function escreverCursor(cursor: Cursor): string | null {
    return Object.keys(cursor).length === 0 ? null : JSON.stringify(cursor);
}

// ─────────────────────────────────────────────────────────────────────────────
// Uma página de cada origem
//
// As três RPCs têm a mesma assinatura de propósito (limite + keyset), então o feed
// trata as origens de forma uniforme e só o mapeamento de linha muda.
// ─────────────────────────────────────────────────────────────────────────────
type PaginaDaOrigem<T extends Publicacao> = { itens: T[]; acabou: boolean };

type LinhaFeedGaleria = {
    sessao_id: string;
    autor_id: string;
    autor_nome: string | null;
    autor_foto: string | null;
    foto_path: string;
    foto_legenda: string | null;
    disciplina: string | null;
    tempo_minutos: number | null;
    criado_em: string;
    curtidas: number;
    curtido_por_mim: boolean;
    comentarios: number;
    /** Só a Galeria tem "salvar" — ver migration 20260813010000_comunidade_salvos. */
    salvo_por_mim: boolean;
};

async function paginaGaleria(
    posicao: Posicao | null,
    limite: number
): Promise<PaginaDaOrigem<PublicacaoGaleria>> {
    const { data, error } = await supabase.rpc("comunidade_feed_galeria", {
        p_limite: limite,
        p_cursor_data: posicao?.criadoEm ?? null,
        p_cursor_id: posicao?.id ?? null,
    });

    if (error) throw new Error(error.message);

    const linhas = (data ?? []) as LinhaFeedGaleria[];

    /*
      Uma assinatura para a página inteira, não uma por card: com signed URL individual
      um feed de dez fotos abriria dez requisições ao storage antes de desenhar.
    */
    const urlPorPath = await assinarCaminhosDeFoto(linhas.map((linha) => linha.foto_path));

    const itens: PublicacaoGaleria[] = linhas.map((linha) => ({
        ...comum("galeria", linha.sessao_id, linha),
        tipo: "galeria",
        fotoUrl: urlPorPath.get(linha.foto_path) ?? null,
        legenda: linha.foto_legenda,
        materia: linha.disciplina || "Sessão de estudo",
        materiaCor: corDaMateria(linha.disciplina || ""),
        duracaoMinutos: linha.tempo_minutos ?? 0,
        salvoPorMim: !!linha.salvo_por_mim,
    }));

    return { itens, acabou: linhas.length < limite };
}

type LinhaFeedArquivo = {
    arquivo_id: string;
    autor_id: string;
    autor_nome: string | null;
    autor_foto: string | null;
    titulo: string;
    storage_path: string | null;
    disciplina: string | null;
    tamanho_bytes: number | null;
    criado_em: string;
    curtidas: number;
    curtido_por_mim: boolean;
    comentarios: number;
};

async function paginaArquivos(
    posicao: Posicao | null,
    limite: number
): Promise<PaginaDaOrigem<PublicacaoArquivo>> {
    const { data, error } = await supabase.rpc("comunidade_feed_arquivos", {
        p_limite: limite,
        p_cursor_data: posicao?.criadoEm ?? null,
        p_cursor_id: posicao?.id ?? null,
    });

    if (error) throw new Error(error.message);

    const linhas = (data ?? []) as LinhaFeedArquivo[];

    const itens: PublicacaoArquivo[] = linhas.map((linha) => ({
        ...comum("arquivo", linha.arquivo_id, linha),
        tipo: "arquivo",
        nomeArquivo: linha.titulo,
        extensao: extensaoDe(linha.titulo),
        storagePath: linha.storage_path,
        tamanhoBytes: linha.tamanho_bytes === null ? null : Number(linha.tamanho_bytes),
        materia: linha.disciplina,
        materiaCor: linha.disciplina ? corDaMateria(linha.disciplina) : null,
    }));

    return { itens, acabou: linhas.length < limite };
}

type LinhaFeedPlano = {
    plano_id: string;
    autor_id: string;
    autor_nome: string | null;
    autor_foto: string | null;
    nome: string;
    cor: string;
    blocos: number;
    minutos_totais: number;
    materias: { nome: string; cor: string }[] | null;
    criado_em: string;
    curtidas: number;
    curtido_por_mim: boolean;
    comentarios: number;
};

/** Quantas matérias viram tag no card; o resto é contado no "+N". */
const MATERIAS_NO_CARD = 3;

async function paginaPlanos(
    posicao: Posicao | null,
    limite: number
): Promise<PaginaDaOrigem<PublicacaoPlano>> {
    const { data, error } = await supabase.rpc("comunidade_feed_planos", {
        p_limite: limite,
        p_cursor_data: posicao?.criadoEm ?? null,
        p_cursor_id: posicao?.id ?? null,
    });

    if (error) throw new Error(error.message);

    const linhas = (data ?? []) as LinhaFeedPlano[];

    const itens: PublicacaoPlano[] = linhas.map((linha) => {
        const materias: MateriaDoPlano[] = linha.materias ?? [];
        return {
            ...comum("plano", linha.plano_id, linha),
            tipo: "plano",
            titulo: linha.nome,
            blocos: Number(linha.blocos) || 0,
            minutosTotais: Number(linha.minutos_totais) || 0,
            materias: materias.slice(0, MATERIAS_NO_CARD),
            materiasExtras: Math.max(0, materias.length - MATERIAS_NO_CARD),
        };
    });

    return { itens, acabou: linhas.length < limite };
}

/** A parte que as três RPCs devolvem igual: autor, data e o placar das reações. */
function comum(
    origem: TipoPublicacao,
    referenciaId: string,
    linha: {
        autor_id: string;
        autor_nome: string | null;
        autor_foto: string | null;
        criado_em: string;
        curtidas: number;
        curtido_por_mim: boolean;
        comentarios: number;
    }
) {
    return {
        id: chaveDe({ origem, referenciaId }),
        origem,
        referenciaId,
        autor: {
            id: linha.autor_id,
            nome: linha.autor_nome || "Sem nome",
            foto: linha.autor_foto,
        },
        criadoEm: linha.criado_em,
        curtidas: Number(linha.curtidas) || 0,
        curtidoPorMim: !!linha.curtido_por_mim,
        comentarios: Number(linha.comentarios) || 0,
    };
}

/** "Resumo.pdf" → "PDF". Sem ponto no nome, some do card em vez de repetir o título. */
function extensaoDe(nome: string): string {
    const partes = nome.split(".");
    return partes.length > 1 ? partes[partes.length - 1].toUpperCase() : "";
}

function paginaDaOrigem(
    origem: TipoPublicacao,
    posicao: Posicao | null,
    limite: number
): Promise<PaginaDaOrigem<Publicacao>> {
    if (origem === "galeria") return paginaGaleria(posicao, limite);
    if (origem === "arquivo") return paginaArquivos(posicao, limite);
    return paginaPlanos(posicao, limite);
}

// ─────────────────────────────────────────────────────────────────────────────
// Feed
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Uma página do feed, juntando as origens por data.
 *
 * Cada fonte devolve sua própria página ordenada; o merge pega as mais recentes e devolve
 * ao cursor só o que foi de fato consumido de cada uma. É o que mantém a ordem cronológica
 * correta sem que uma fonte vazia ou lenta segure as outras.
 */
export async function buscarFeedComunidade(opcoes: {
    filtro: FiltroComunidade;
    cursor?: string | null;
}): Promise<PaginaDoFeed> {
    const cursor = lerCursor(opcoes.cursor);

    // Ativa = pedida pelo filtro e ainda não esgotada.
    const ativas = ORIGENS.filter(
        (origem) =>
            (opcoes.filtro === "tudo" || opcoes.filtro === origem) && origem in cursor
    );

    const paginas = await Promise.all(
        ativas.map((origem) => paginaDaOrigem(origem, cursor[origem] ?? null, TAMANHO_PAGINA))
    );

    const entregues = paginas
        .flatMap((pagina) => pagina.itens)
        .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())
        .slice(0, TAMANHO_PAGINA);

    // Cada fonte avança só até o último item dela que entrou nesta página.
    const proximo: Cursor = {};
    ativas.forEach((origem, i) => {
        const daOrigem = entregues.filter((item) => item.origem === origem);
        const acabou = paginas[i].acabou && daOrigem.length === paginas[i].itens.length;
        if (acabou) return;

        const ultimo = daOrigem[daOrigem.length - 1];
        proximo[origem] = ultimo
            ? { criadoEm: ultimo.criadoEm, id: ultimo.referenciaId }
            : cursor[origem] ?? null;
    });

    return {
        itens: entregues,
        proximoCursor: entregues.length === 0 ? null : escreverCursor(proximo),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Interações
// ─────────────────────────────────────────────────────────────────────────────

async function usuarioAtual(): Promise<string> {
    const { data } = await supabase.auth.getUser();
    const id = data.user?.id;
    if (!id) throw new Error("Sessão expirada.");
    return id;
}

/** Curte ou descurte. A RLS recusa a curtida se a publicação não estiver pública. */
export async function alternarCurtida(ref: ReferenciaPublicacao, curtir: boolean): Promise<void> {
    const userId = await usuarioAtual();

    if (curtir) {
        const { error } = await supabase.from("comunidade_curtidas").insert({
            user_id: userId,
            origem: ref.origem,
            referencia_id: ref.referenciaId,
        });
        // Curtir duas vezes (toque duplo, corrida de rede) esbarra na unique: não é erro.
        if (error && error.code !== "23505") throw new Error(error.message);

        /*
          A notificação em si já foi criada pelo gatilho do INSERT acima; isto aqui só pede
          o push. Fica fora do `if` de erro de propósito: mesmo na colisão de unique existe
          a chance de o push anterior não ter saído, e a Edge Function é idempotente (só
          avisa notificação ainda pendente).
        */
        avisarInteracao(ref, "curtida");
        return;
    }

    const { error } = await supabase
        .from("comunidade_curtidas")
        .delete()
        .eq("user_id", userId)
        .eq("origem", ref.origem)
        .eq("referencia_id", ref.referenciaId);

    if (error) throw new Error(error.message);
}

type LinhaComentario = {
    id: string;
    user_id: string;
    texto: string;
    criado_em: string;
};

type PerfilIdentidade = { id: string; nome_usuario: string | null; foto_usuario: string | null };

/**
 * `profiles` só é legível pelo dono (RLS); identidade de outra pessoa vem da view
 * `perfis_identidade`, que nunca expõe celular/data_nascimento/estatística.
 */
async function buscarIdentidades(userIds: string[]): Promise<Map<string, PerfilIdentidade>> {
    const unicos = Array.from(new Set(userIds));
    if (unicos.length === 0) return new Map();

    const { data } = await supabase
        .from("perfis_identidade")
        .select("id, nome_usuario, foto_usuario")
        .in("id", unicos);

    return new Map((data ?? []).map((p) => [p.id, p as PerfilIdentidade]));
}

export async function buscarComentarios(
    ref: ReferenciaPublicacao,
    donoDaPublicacaoId?: string | null
): Promise<ComentarioPublicacao[]> {
    const [userId, resposta] = await Promise.all([
        usuarioAtual(),
        supabase
            .from("comunidade_comentarios")
            .select("id, user_id, texto, criado_em")
            .eq("origem", ref.origem)
            .eq("referencia_id", ref.referenciaId)
            .order("criado_em", { ascending: true }),
    ]);

    if (resposta.error) throw new Error(resposta.error.message);

    const linhas = (resposta.data ?? []) as LinhaComentario[];
    const identidades = await buscarIdentidades(linhas.map((l) => l.user_id));

    return linhas.map((linha) => {
        const perfil = identidades.get(linha.user_id);
        return {
            id: linha.id,
            autor: {
                id: linha.user_id,
                nome: perfil?.nome_usuario || "Sem nome",
                foto: perfil?.foto_usuario ?? null,
            },
            texto: linha.texto,
            criadoEm: linha.criado_em,
            meu: linha.user_id === userId,
            doAutorDaPublicacao: !!donoDaPublicacaoId && linha.user_id === donoDaPublicacaoId,
        };
    });
}

export async function publicarComentario(
    ref: ReferenciaPublicacao,
    texto: string,
    donoDaPublicacaoId?: string | null
): Promise<ComentarioPublicacao> {
    const userId = await usuarioAtual();

    const { data, error } = await supabase
        .from("comunidade_comentarios")
        .insert({
            user_id: userId,
            origem: ref.origem,
            referencia_id: ref.referenciaId,
            texto: texto.trim(),
        })
        .select("id, user_id, texto, criado_em")
        .single();

    if (error) throw new Error(error.message);

    // O gatilho do INSERT já pôs a notificação na caixa de quem publicou; falta o push.
    avisarInteracao(ref, "comentario");

    const linha = data as LinhaComentario;
    const perfil = (await buscarIdentidades([linha.user_id])).get(linha.user_id);
    return {
        id: linha.id,
        autor: {
            id: linha.user_id,
            nome: perfil?.nome_usuario || "Você",
            foto: perfil?.foto_usuario ?? null,
        },
        texto: linha.texto,
        criadoEm: linha.criado_em,
        meu: true,
        doAutorDaPublicacao: !!donoDaPublicacaoId && linha.user_id === donoDaPublicacaoId,
    };
}

/** Apagar é de quem escreveu e de quem publicou — a RLS decide, não a tela. */
export async function apagarComentario(comentarioId: string): Promise<void> {
    const { error } = await supabase.from("comunidade_comentarios").delete().eq("id", comentarioId);
    if (error) throw new Error(error.message);
}

export async function denunciar(alvo: {
    ref: ReferenciaPublicacao;
    comentarioId?: string | null;
    motivo?: string;
    detalhe?: string;
}): Promise<void> {
    const userId = await usuarioAtual();

    const { error } = await supabase.from("comunidade_denuncias").insert({
        denunciante_id: userId,
        origem: alvo.ref.origem,
        referencia_id: alvo.ref.referenciaId,
        comentario_id: alvo.comentarioId ?? null,
        motivo: alvo.motivo ?? "nao_informado",
        detalhe: alvo.detalhe ?? null,
    });

    // Denunciar a mesma coisa de novo não é sinal novo, e nem erro para quem denunciou.
    if (error && error.code !== "23505") throw new Error(error.message);
}

export async function bloquearAutor(autorId: string): Promise<void> {
    const userId = await usuarioAtual();

    const { error } = await supabase.from("comunidade_bloqueios").insert({
        bloqueador_id: userId,
        bloqueado_id: autorId,
    });

    if (error && error.code !== "23505") throw new Error(error.message);
}

export async function desbloquearAutor(autorId: string): Promise<void> {
    const userId = await usuarioAtual();

    const { error } = await supabase
        .from("comunidade_bloqueios")
        .delete()
        .eq("bloqueador_id", userId)
        .eq("bloqueado_id", autorId);

    if (error) throw new Error(error.message);
}

/** Quem o usuário bloqueou, para a tela de privacidade poder desfazer. */
export async function listarBloqueados(): Promise<AutorBloqueado[]> {
    const { data, error } = await supabase
        .from("comunidade_bloqueios")
        .select("bloqueado_id, criado_em")
        .order("criado_em", { ascending: false });

    if (error) throw new Error(error.message);

    const linhas = (data ?? []) as LinhaBloqueio[];
    const identidades = await buscarIdentidades(linhas.map((l) => l.bloqueado_id));

    return linhas.map((linha) => {
        const perfil = identidades.get(linha.bloqueado_id);
        return {
            id: linha.bloqueado_id,
            nome: perfil?.nome_usuario || "Sem nome",
            foto: perfil?.foto_usuario ?? null,
            bloqueadoEm: linha.criado_em,
        };
    });
}

type LinhaBloqueio = {
    bloqueado_id: string;
    criado_em: string;
};

export type AutorBloqueado = {
    id: string;
    nome: string;
    foto: string | null;
    bloqueadoEm: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Salvos — só Galeria. Arquivo e plano já têm cópia de verdade (adicionar aos meus
// arquivos / importar plano); duplicar isso como "salvar" criaria dois jeitos de guardar
// a mesma coisa. Ver comentário no topo de 20260813010000_comunidade_salvos.sql.
// ─────────────────────────────────────────────────────────────────────────────

/** Salva ou remove uma foto da Galeria dos salvos. RLS recusa o que não está mais público. */
export async function alternarSalvo(sessaoId: string, salvar: boolean): Promise<void> {
    const userId = await usuarioAtual();

    if (salvar) {
        const { error } = await supabase
            .from("comunidade_salvos")
            .insert({ user_id: userId, sessao_id: sessaoId });
        if (error && error.code !== "23505") throw new Error(error.message);
        return;
    }

    const { error } = await supabase
        .from("comunidade_salvos")
        .delete()
        .eq("user_id", userId)
        .eq("sessao_id", sessaoId);
    if (error) throw new Error(error.message);
}

type LinhaSalvoGaleria = LinhaFeedGaleria & { salvo_em: string };
type PosicaoSalvo = { salvoEm: string; id: string };

function lerCursorSalvo(bruto?: string | null): PosicaoSalvo | null {
    if (!bruto) return null;
    try {
        return JSON.parse(bruto) as PosicaoSalvo;
    } catch {
        return null;
    }
}

/** Página dos salvos do usuário logado — ordenada por quando ELE salvou, não pela data da sessão. */
export async function buscarSalvos(opcoes: { cursor?: string | null }): Promise<PaginaDoFeed> {
    const posicao = lerCursorSalvo(opcoes.cursor);

    const { data, error } = await supabase.rpc("comunidade_salvos_galeria", {
        p_limite: TAMANHO_PAGINA,
        p_cursor_data: posicao?.salvoEm ?? null,
        p_cursor_id: posicao?.id ?? null,
    });

    if (error) throw new Error(error.message);

    const linhas = (data ?? []) as LinhaSalvoGaleria[];
    const urlPorPath = await assinarCaminhosDeFoto(linhas.map((linha) => linha.foto_path));

    const itens: PublicacaoGaleria[] = linhas.map((linha) => ({
        ...comum("galeria", linha.sessao_id, linha),
        tipo: "galeria",
        fotoUrl: urlPorPath.get(linha.foto_path) ?? null,
        legenda: linha.foto_legenda,
        materia: linha.disciplina || "Sessão de estudo",
        materiaCor: corDaMateria(linha.disciplina || ""),
        duracaoMinutos: linha.tempo_minutos ?? 0,
        salvoPorMim: true,
    }));

    const ultimo = linhas[linhas.length - 1];
    const acabou = linhas.length < TAMANHO_PAGINA;

    return {
        itens,
        proximoCursor:
            acabou || !ultimo ? null : JSON.stringify({ salvoEm: ultimo.salvo_em, id: ultimo.sessao_id }),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Prévia de um plano público
// ─────────────────────────────────────────────────────────────────────────────

type LinhaBlocoDaPrevia = {
    id: string;
    hora_inicio: string;
    duracao_min: number;
    tipo: "estudo" | "descanso";
    topico: string | null;
    materias_usuario: { nome_exibicao: string; cor: string } | null;
};

/**
 * Os blocos de um plano público, para a tela que a pessoa vê ANTES de importar.
 *
 * Sem RPC: as policies de 20260807210000 já liberam `planos` e `planos_blocos` públicos
 * em leitura, e `materias_usuario` é legível por qualquer usuário logado — daí o join
 * trazer nome e cor da matéria do autor de graça. Se a RLS recusar (plano despublicado
 * entre o card e o toque, autor bloqueado), a consulta volta vazia e isto devolve `null`,
 * que a tela traduz em "esse plano não está mais disponível".
 *
 * O card do feed continua com o resumo da RPC (`comunidade_feed_planos`): trazer os blocos
 * crus de cada plano do feed só para desenhar três tags é o que essa RPC evita. Aqui é o
 * contrário — é um plano só, e os blocos são justamente o que a pessoa abriu para ver.
 */
export async function buscarPreviaPlano(planoId: string): Promise<PreviaPlano | null> {
    const [plano, blocos] = await Promise.all([
        supabase.from("planos").select("id, nome, cor").eq("id", planoId).maybeSingle(),
        supabase
            .from("planos_blocos")
            .select("id, hora_inicio, duracao_min, tipo, topico, materias_usuario(nome_exibicao, cor)")
            .eq("plano_id", planoId)
            .order("hora_inicio", { ascending: true }),
    ]);

    if (plano.error) throw new Error(plano.error.message);
    if (blocos.error) throw new Error(blocos.error.message);
    if (!plano.data) return null;

    const linha = plano.data as { id: string; nome: string; cor: string };
    const linhas = (blocos.data ?? []) as unknown as LinhaBlocoDaPrevia[];

    let minutosEstudo = 0;
    let minutosDescanso = 0;

    for (const bloco of linhas) {
        if (bloco.tipo === "descanso") minutosDescanso += bloco.duracao_min;
        else minutosEstudo += bloco.duracao_min;
    }

    return {
        id: linha.id,
        nome: linha.nome,
        cor: linha.cor,
        blocos: linhas.map((bloco) => ({
            id: bloco.id,
            horaInicio: bloco.hora_inicio.slice(0, 5),
            duracaoMin: bloco.duracao_min,
            tipo: bloco.tipo,
            materia: bloco.materias_usuario?.nome_exibicao ?? null,
            materiaCor: bloco.materias_usuario?.cor ?? null,
            topico: bloco.topico,
        })),
        minutosEstudo,
        minutosDescanso,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Importar um plano público
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Copia um plano público para o cronograma de quem chamou e devolve o id da cópia.
 *
 * É cópia, não referência: o plano importado é seu e não muda mais se o original mudar
 * (nem some se o autor despublicar). Entra sem agenda — quem importou decide depois em
 * que dias ele vale, porque agenda é disputa de espaço no cronograma de cada um.
 */
export async function importarPlano(planoId: string): Promise<string> {
    const { data, error } = await supabase.rpc("comunidade_importar_plano", {
        p_plano_id: planoId,
    });

    if (error) throw new Error(error.message);
    return data as string;
}
