/**
 * Tipos do feed público da aba Comunidade → Explorar.
 *
 * O feed mistura três origens de conteúdo público num único fluxo: a foto de sessão
 * (Galeria), o arquivo do Vault e o plano de estudos compartilhado. Cada card tem uma
 * forma própria, mas todos compartilham autor, data e as reações.
 */

export type TipoPublicacao = "galeria" | "arquivo" | "plano";

/** Chip de filtro do topo do Explorar. `tudo` não filtra nada. */
export type FiltroComunidade = "tudo" | TipoPublicacao;

export type AutorPublicacao = {
    id: string;
    nome: string;
    foto: string | null;
};

type PublicacaoBase = {
    id: string;
    autor: AutorPublicacao;
    /** ISO 8601. */
    criadoEm: string;
    curtidas: number;
    curtidoPorMim: boolean;
    comentarios: number;
};

export type PublicacaoGaleria = PublicacaoBase & {
    tipo: "galeria";
    fotoUrl: string | null;
    materia: string;
    materiaCor: string;
    duracaoMinutos: number;
};

export type PublicacaoArquivo = PublicacaoBase & {
    tipo: "arquivo";
    nomeArquivo: string;
    /** Extensão em maiúsculas, como aparece no card: PDF, DOCX… */
    extensao: string;
    tamanhoBytes: number;
    materia: string | null;
    materiaCor: string | null;
};

export type MateriaDoPlano = {
    nome: string;
    cor: string;
};

export type PublicacaoPlano = PublicacaoBase & {
    tipo: "plano";
    titulo: string;
    blocos: number;
    horasTotais: number;
    /** Só as primeiras matérias entram nas tags; o resto vira "+N". */
    materias: MateriaDoPlano[];
    materiasExtras: number;
};

export type Publicacao = PublicacaoGaleria | PublicacaoArquivo | PublicacaoPlano;

export type ComentarioPublicacao = {
    id: string;
    publicacaoId: string;
    autor: AutorPublicacao;
    texto: string;
    criadoEm: string;
    /** Comentário do próprio usuário logado — ganha o selo VOCÊ e pode ser apagado. */
    meu: boolean;
    /** Comentário de quem publicou o post — ganha o selo AUTOR(A). */
    doAutorDaPublicacao: boolean;
};

export type PaginaDoFeed = {
    itens: Publicacao[];
    /** `null` quando não há mais nada para carregar. */
    proximoCursor: string | null;
};
