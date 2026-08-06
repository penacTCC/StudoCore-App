/**
 * Uma foto da galeria, já pronta pra render: uma entrada por *momento de estudo*, não por
 * linha de `sessoes_foco`. Uma execução de plano com 3 matérias vira uma foto só, com os
 * minutos das 3 somados (ver services/fotosSessao.ts -> agruparPorMomento).
 */
export type FotoSessao = {
    /** Sessão que abre ao tocar na foto — a mais recente do momento, quando há várias. */
    sessaoId: string;
    execucaoId: string | null;
    /** Caminho no bucket `sessao-fotos`. Serve de chave: é ele que identifica o momento. */
    path: string;
    /** URL assinada, de validade curta. `null` quando a assinatura falhou (RLS ou rede). */
    url: string | null;
    legenda: string | null;
    /** Matérias do momento, já formatadas ("Cálculo · Física"). */
    disciplina: string;
    tempoMinutos: number;
    criadaEm: string;
};

/** Foto escolhida na etapa pós-sessão, ainda não enviada. */
export type FotoCapturada = {
    /** URI local do arquivo já redimensionado — é o que a etapa mostra no preview. */
    uri: string;
    /** Conteúdo do mesmo arquivo, que vai pro bucket sem precisar reler do disco. */
    base64: string;
};
