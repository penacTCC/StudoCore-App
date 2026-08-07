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

/**
 * Endereço de uma publicação no banco: `origem` diz em qual tabela `referenciaId` vive.
 *
 * Curtida, comentário e denúncia apontam para esse par em vez de para uma tabela
 * `publicacoes` — a foto de sessão já é uma linha de `sessoes_foco`, e duplicá-la criaria
 * duas fontes da verdade para "esta sessão ainda é pública?".
 */
export type ReferenciaPublicacao = {
    origem: TipoPublicacao;
    referenciaId: string;
};

type PublicacaoBase = ReferenciaPublicacao & {
    /** `origem:referenciaId` — chave estável de lista, única entre as origens. */
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
    /** Signed URL de 1h — o bucket é privado, então ela expira e é reassinada por página. */
    fotoUrl: string | null;
    legenda: string | null;
    materia: string;
    materiaCor: string;
    duracaoMinutos: number;
};

export type PublicacaoArquivo = PublicacaoBase & {
    tipo: "arquivo";
    nomeArquivo: string;
    /** Extensão em maiúsculas, como aparece no card: PDF, DOCX… */
    extensao: string;
    /** Caminho no bucket — é por ele que o botão de download baixa o arquivo. */
    storagePath: string | null;
    /** `null` nos arquivos enviados antes da coluna existir; o card omite o tamanho. */
    tamanhoBytes: number | null;
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
    /** Só o tempo de estudo — somar o descanso inflaria o plano. */
    minutosTotais: number;
    /** Só as primeiras matérias entram nas tags; o resto vira "+N". */
    materias: MateriaDoPlano[];
    materiasExtras: number;
};

export type Publicacao = PublicacaoGaleria | PublicacaoArquivo | PublicacaoPlano;

export type ComentarioPublicacao = {
    id: string;
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
    /**
     * Cursor opaco da próxima página; `null` quando acabou.
     *
     * Ele carrega a posição de cada origem separadamente, porque o feed é uma junção de
     * fontes que paginam em ritmos diferentes.
     */
    proximoCursor: string | null;
};
