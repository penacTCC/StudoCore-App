/**
 * Feed público da Comunidade — AINDA MOCKADO.
 *
 * Nada aqui toca o Supabase por enquanto: as tabelas de publicação, curtida, comentário,
 * denúncia e bloqueio não existem no banco. A tela já foi escrita contra esta interface,
 * então trocar o mock pela consulta real é substituir o corpo destas funções — a assinatura
 * (cursor, página, promessas) é a que o feed de verdade vai precisar.
 *
 * O estado vive em memória do módulo: curtir, comentar e bloquear valem enquanto o app
 * estiver aberto e somem no recarregamento, o que é o suficiente para validar o fluxo.
 */

import { HADES } from "@/constants/hades";
import type {
    ComentarioPublicacao,
    FiltroComunidade,
    PaginaDoFeed,
    Publicacao,
} from "@/types/comunidade";

/** Simula a latência da rede para que os estados de carregando/revalidando apareçam. */
const LATENCIA_MS = 550;
const TAMANHO_PAGINA = 4;

const esperar = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const agora = Date.now();
const minutosAtras = (minutos: number) => new Date(agora - minutos * 60_000).toISOString();

const AUTOR_LOGADO = { id: "eu", nome: "penac", foto: null };

const AUTORES = {
    marina: { id: "u-marina", nome: "Marina R.", foto: null },
    rafael: { id: "u-rafael", nome: "Rafael", foto: null },
    lucas: { id: "u-lucas", nome: "Lucas", foto: null },
    bia: { id: "u-bia", nome: "Bia", foto: null },
    nat: { id: "u-nat", nome: "NatVM", foto: null },
    toulhe: { id: "u-toulhe", nome: "toulhe", foto: null },
};

/*
  Publicações de exemplo, em ordem cronológica decrescente — é a ordem que o feed real
  também vai usar.
*/
const PUBLICACOES: Publicacao[] = [
    {
        id: "p1",
        tipo: "galeria",
        autor: AUTORES.marina,
        criadoEm: minutosAtras(35),
        curtidas: 24,
        curtidoPorMim: true,
        comentarios: 6,
        fotoUrl: null,
        materia: "Cálculo II",
        materiaCor: HADES.subjectBlue,
        duracaoMinutos: 105,
    },
    {
        id: "p2",
        tipo: "arquivo",
        autor: AUTORES.rafael,
        criadoEm: minutosAtras(120),
        curtidas: 11,
        curtidoPorMim: false,
        comentarios: 2,
        nomeArquivo: "Resumo Bioquímica — Ciclo de Krebs.pdf",
        extensao: "PDF",
        tamanhoBytes: 2_517_000,
        materia: "Bioquímica",
        materiaCor: "#1f9d63",
    },
    {
        id: "p3",
        tipo: "plano",
        autor: AUTORES.lucas,
        criadoEm: minutosAtras(60 * 26),
        curtidas: 47,
        curtidoPorMim: false,
        comentarios: 13,
        titulo: "Reta final ENEM — 6 semanas",
        blocos: 24,
        horasTotais: 36,
        materias: [
            { nome: "Matemática", cor: HADES.subjectBlue },
            { nome: "Física", cor: HADES.groupViolet },
            { nome: "Química", cor: "#1f9d63" },
        ],
        materiasExtras: 2,
    },
    {
        id: "p4",
        tipo: "galeria",
        autor: AUTORES.nat,
        criadoEm: minutosAtras(60 * 30),
        curtidas: 8,
        curtidoPorMim: false,
        comentarios: 1,
        fotoUrl: null,
        materia: "Física",
        materiaCor: HADES.groupViolet,
        duracaoMinutos: 80,
    },
    {
        id: "p5",
        tipo: "plano",
        autor: AUTORES.bia,
        criadoEm: minutosAtras(60 * 24 * 3),
        curtidas: 19,
        curtidoPorMim: true,
        comentarios: 4,
        titulo: "Rotina de revisão espaçada — Anatomia",
        blocos: 12,
        horasTotais: 18,
        materias: [
            { nome: "Anatomia", cor: "#d0455e" },
            { nome: "Fisiologia", cor: "#1f9d63" },
        ],
        materiasExtras: 0,
    },
    {
        id: "p6",
        tipo: "arquivo",
        autor: AUTORES.toulhe,
        criadoEm: minutosAtras(60 * 24 * 4),
        curtidas: 5,
        curtidoPorMim: false,
        comentarios: 0,
        nomeArquivo: "Lista resolvida — Cinemática.docx",
        extensao: "DOCX",
        tamanhoBytes: 640_000,
        materia: "Física",
        materiaCor: HADES.groupViolet,
    },
    {
        id: "p7",
        tipo: "galeria",
        autor: AUTORES.lucas,
        criadoEm: minutosAtras(60 * 24 * 5),
        curtidas: 31,
        curtidoPorMim: false,
        comentarios: 3,
        fotoUrl: null,
        materia: "Química",
        materiaCor: "#1f9d63",
        duracaoMinutos: 145,
    },
    {
        id: "p8",
        tipo: "arquivo",
        autor: AUTORES.marina,
        criadoEm: minutosAtras(60 * 24 * 6),
        curtidas: 14,
        curtidoPorMim: false,
        comentarios: 2,
        nomeArquivo: "Mapa mental — Revolução Industrial.pdf",
        extensao: "PDF",
        tamanhoBytes: 1_120_000,
        materia: "História",
        materiaCor: HADES.amber,
    },
];

const COMENTARIOS: ComentarioPublicacao[] = [
    {
        id: "c1",
        publicacaoId: "p1",
        autor: AUTORES.rafael,
        texto: "Que setup! Essa técnica de resumo à mão ainda é imbatível.",
        criadoEm: minutosAtras(20),
        meu: false,
        doAutorDaPublicacao: false,
    },
    {
        id: "c2",
        publicacaoId: "p1",
        autor: AUTOR_LOGADO,
        texto: "1h45 de Cálculo II num sábado, respeito demais 👏",
        criadoEm: minutosAtras(12),
        meu: true,
        doAutorDaPublicacao: false,
    },
    {
        id: "c3",
        publicacaoId: "p1",
        autor: AUTORES.nat,
        texto: "Qual caderno é esse? Preciso de um igual pra Física.",
        criadoEm: minutosAtras(8),
        meu: false,
        doAutorDaPublicacao: false,
    },
    {
        id: "c4",
        publicacaoId: "p1",
        autor: AUTORES.marina,
        texto: "É um Moleskine quadriculado! Valeu, gente 🧡",
        criadoEm: minutosAtras(5),
        meu: false,
        doAutorDaPublicacao: true,
    },
    {
        id: "c5",
        publicacaoId: "p2",
        autor: AUTORES.bia,
        texto: "Salvei na hora, obrigada!",
        criadoEm: minutosAtras(90),
        meu: false,
        doAutorDaPublicacao: false,
    },
    {
        id: "c6",
        publicacaoId: "p3",
        autor: AUTORES.nat,
        texto: "Importei aqui e já encaixou na minha semana.",
        criadoEm: minutosAtras(60 * 20),
        meu: false,
        doAutorDaPublicacao: false,
    },
];

/** Autores bloqueados nesta sessão do app. */
const bloqueados = new Set<string>();

let sequenciaComentario = 100;

/** Autor usado como "eu" nos comentários enquanto o feed é mock. */
export function autorLogadoMock() {
    return AUTOR_LOGADO;
}

/**
 * Uma página do feed público, já sem os autores bloqueados.
 *
 * `cursor` é o id da última publicação recebida; o feed real vai paginar por
 * (criadoEm, id), então a assinatura não muda.
 */
export async function buscarFeedComunidade(opcoes: {
    filtro: FiltroComunidade;
    cursor?: string | null;
}): Promise<PaginaDoFeed> {
    await esperar(LATENCIA_MS);

    const visiveis = PUBLICACOES.filter(
        (publicacao) =>
            !bloqueados.has(publicacao.autor.id) &&
            (opcoes.filtro === "tudo" || publicacao.tipo === opcoes.filtro)
    );

    const inicio = opcoes.cursor ? visiveis.findIndex((p) => p.id === opcoes.cursor) + 1 : 0;
    const pagina = visiveis.slice(inicio, inicio + TAMANHO_PAGINA);
    const acabou = inicio + TAMANHO_PAGINA >= visiveis.length;

    return {
        // Cópia rasa: a tela mexe no item (curtida otimista) e não deve editar o mock.
        itens: pagina.map((publicacao) => ({ ...publicacao })),
        proximoCursor: acabou || pagina.length === 0 ? null : pagina[pagina.length - 1].id,
    };
}

/** Curte ou descurte. Devolve a contagem que o servidor passou a ter. */
export async function alternarCurtida(publicacaoId: string, curtir: boolean): Promise<number> {
    await esperar(220);

    const publicacao = PUBLICACOES.find((p) => p.id === publicacaoId);
    if (!publicacao) return 0;

    if (publicacao.curtidoPorMim !== curtir) {
        publicacao.curtidoPorMim = curtir;
        publicacao.curtidas = Math.max(0, publicacao.curtidas + (curtir ? 1 : -1));
    }

    return publicacao.curtidas;
}

export async function buscarComentarios(publicacaoId: string): Promise<ComentarioPublicacao[]> {
    await esperar(400);
    return COMENTARIOS.filter((comentario) => comentario.publicacaoId === publicacaoId).map(
        (comentario) => ({ ...comentario })
    );
}

export async function publicarComentario(
    publicacaoId: string,
    texto: string
): Promise<ComentarioPublicacao> {
    await esperar(300);

    const comentario: ComentarioPublicacao = {
        id: `c${++sequenciaComentario}`,
        publicacaoId,
        autor: AUTOR_LOGADO,
        texto: texto.trim(),
        criadoEm: new Date().toISOString(),
        meu: true,
        doAutorDaPublicacao: false,
    };

    COMENTARIOS.push(comentario);

    const publicacao = PUBLICACOES.find((p) => p.id === publicacaoId);
    if (publicacao) publicacao.comentarios += 1;

    return { ...comentario };
}

export async function apagarComentario(comentarioId: string): Promise<void> {
    await esperar(250);

    const indice = COMENTARIOS.findIndex((comentario) => comentario.id === comentarioId);
    if (indice < 0) return;

    const [removido] = COMENTARIOS.splice(indice, 1);
    const publicacao = PUBLICACOES.find((p) => p.id === removido.publicacaoId);
    if (publicacao) publicacao.comentarios = Math.max(0, publicacao.comentarios - 1);
}

/** Denúncia de publicação ou comentário. No mock só confirma o recebimento. */
export async function denunciar(alvo: {
    tipo: "publicacao" | "comentario";
    id: string;
    motivo?: string;
}): Promise<void> {
    await esperar(300);
    console.log("[comunidade] denúncia registrada (mock)", alvo);
}

/**
 * Bloqueia um autor. As publicações dele somem do feed na hora — quem apaga da lista
 * em tela é o hook; aqui a lista deixa de devolvê-las nas próximas páginas.
 */
export async function bloquearAutor(autorId: string): Promise<void> {
    await esperar(300);
    bloqueados.add(autorId);
}

/** Importa um plano público para o cronograma do usuário. Ainda não implementado. */
export async function importarPlanoPublicado(planoId: string): Promise<void> {
    await esperar(500);
    console.log("[comunidade] importar plano (mock)", planoId);
}
