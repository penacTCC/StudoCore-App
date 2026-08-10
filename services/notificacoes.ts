/**
 * Caixa de notificações do app: curtidas e comentários, força recebida, gente nova no
 * grupo, sala de foco aberta.
 *
 * Três partes moram aqui:
 *
 * 1. A LISTA (`buscarNotificacoes`), paginada por cursor, vinda da RPC
 *    `notificacoes_listar`.
 * 2. O CONTADOR do badge, que é um store global no mesmo molde de
 *    services/formulariosPendentes.ts — a tab bar não é uma tela e não roda hook de
 *    ninguém, então o número precisa viver fora do React.
 * 3. O PUSH DA COMUNIDADE (`avisarInteracao`), disparado logo depois de curtir/comentar.
 *    Ele não manda o texto da notificação: a Edge Function `avisar-interacao` procura no
 *    banco a linha que o gatilho criou e monta a mensagem de lá. É o que impede alguém de
 *    forjar um push em nome de outro.
 *
 * As outras categorias não têm push aqui porque já têm o seu: força passa por
 * `mandar-forca` e sala aberta por `avisar-sala-aberta`, as duas chamadas de onde o evento
 * acontece (services/incentivos.ts, services/salas.ts). Os gatilhos da migration
 * 20260807240000 só acrescentam a LINHA na caixa; quem toca o aparelho continua sendo
 * quem já tocava. Gente nova no grupo é caixa e nada mais.
 *
 * Nada aqui lança para fora do caminho de leitura: notificação é acessório, e uma falha
 * dela não pode derrubar a curtida nem a tela.
 */

import { supabase } from "@/repositories/supabase";
import { assinarCaminhosDeFoto } from "@/services/fotosSessao";
import type { ReferenciaPublicacao, TipoPublicacao } from "@/types/comunidade";
import type {
    CategoriaNotificacao,
    Notificacao,
    PaginaDeNotificacoes,
    TipoNotificacao,
} from "@/types/notificacoes";

const TAMANHO_PAGINA = 20;

// ─────────────────────────────────────────────────────────────────────────────
// Lista
// ─────────────────────────────────────────────────────────────────────────────

type Posicao = { criadoEm: string; id: string };

function lerCursor(bruto?: string | null): Posicao | null {
    if (!bruto) return null;
    try {
        return JSON.parse(bruto) as Posicao;
    } catch {
        return null;
    }
}

type LinhaNotificacao = {
    id: string;
    categoria: CategoriaNotificacao;
    tipo: TipoNotificacao;
    origem: TipoPublicacao | null;
    referencia_id: string;
    ator_id: string;
    ator_nome: string | null;
    ator_foto: string | null;
    texto: string | null;
    resumo: string | null;
    foto_path: string | null;
    lida: boolean;
    criado_em: string;
};

export async function buscarNotificacoes(cursor?: string | null): Promise<PaginaDeNotificacoes> {
    const posicao = lerCursor(cursor);

    const { data, error } = await supabase.rpc("notificacoes_listar", {
        p_limite: TAMANHO_PAGINA,
        p_cursor_data: posicao?.criadoEm ?? null,
        p_cursor_id: posicao?.id ?? null,
    });

    if (error) throw new Error(error.message);

    const linhas = (data ?? []) as LinhaNotificacao[];

    // Uma assinatura para a página inteira, como no feed: o bucket das fotos é privado.
    const urlPorPath = await assinarCaminhosDeFoto(
        linhas.map((linha) => linha.foto_path).filter((path): path is string => !!path)
    );

    const itens: Notificacao[] = linhas.map((linha) => ({
        id: linha.id,
        categoria: linha.categoria,
        tipo: linha.tipo,
        origem: linha.origem,
        referenciaId: linha.referencia_id,
        autor: {
            id: linha.ator_id,
            nome: linha.ator_nome || "Sem nome",
            foto: linha.ator_foto,
        },
        texto: linha.texto,
        resumo: linha.resumo,
        fotoUrl: linha.foto_path ? urlPorPath.get(linha.foto_path) ?? null : null,
        lida: linha.lida,
        criadoEm: linha.criado_em,
    }));

    const ultimo = itens[itens.length - 1];

    return {
        itens,
        proximoCursor:
            linhas.length < TAMANHO_PAGINA || !ultimo
                ? null
                : JSON.stringify({ criadoEm: ultimo.criadoEm, id: ultimo.id }),
    };
}

/** Marca tudo como lido — chamado quando a caixa abre, que é quando ela foi vista. */
export async function marcarNotificacoesLidas(): Promise<void> {
    const { error } = await supabase.rpc("notificacoes_marcar_lidas");
    if (error) {
        console.warn("Erro ao marcar notificações como lidas:", error.message);
        return;
    }
    definirNotificacoesNaoLidas(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Contador do badge
// ─────────────────────────────────────────────────────────────────────────────

type Listener = (contagem: number) => void;

const listeners = new Set<Listener>();
let naoLidas = 0;

export function definirNotificacoesNaoLidas(valor: number) {
    if (valor === naoLidas) return;
    naoLidas = valor;
    listeners.forEach((listener) => listener(naoLidas));
}

export function obterNotificacoesNaoLidas() {
    return naoLidas;
}

export function assinarNotificacoesNaoLidas(listener: Listener) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/**
 * Relê a contagem no banco.
 *
 * Vale a chamada mesmo quando o Realtime acabou de avisar de uma notificação nova: a RPC
 * aplica o mesmo filtro de validade da lista (publicação ainda pública, curtida ainda de
 * pé), então incrementar de um em um deixaria o badge maior que a caixa.
 */
export async function carregarNotificacoesNaoLidas(): Promise<void> {
    const { data, error } = await supabase.rpc("notificacoes_nao_lidas");
    if (error) {
        console.warn("Erro ao contar notificações não lidas:", error.message);
        return;
    }
    definirNotificacoesNaoLidas(Number(data) || 0);
}

type Assinatura = {
    userId: string;
    canal: ReturnType<typeof supabase.channel>;
    ouvintes: Set<() => void>;
};

let assinatura: Assinatura | null = null;
let sequencia = 0;

function encerrarAssinatura() {
    if (!assinatura) return;
    supabase.removeChannel(assinatura.canal);
    assinatura = null;
}

/**
 * Escuta as notificações que chegam para o usuário logado.
 *
 * Só serve para o badge subir com o app aberto — o push (Edge Function
 * `avisar-interacao`) é quem cobre o app fechado.
 *
 * O canal é único e compartilhado por contagem de ouvintes, por dois motivos que se somam:
 * o supabase-js devolve o canal já existente quando o nome bate, e `removeChannel` só o
 * tira da lista depois do round-trip com o servidor. Sem isso, uma remontagem (trocar de
 * grupo, por exemplo) pegava de volta o canal antigo — ainda assinado — e estourava em
 * `.on()`. O sufixo no nome fecha a mesma corrida pelo outro lado: o canal que está saindo
 * nunca colide com o que está entrando.
 */
export function observarNotificacoes(userId: string, aoChegar: () => void) {
    if (assinatura && assinatura.userId !== userId) encerrarAssinatura();

    if (!assinatura) {
        const ouvintes = new Set<() => void>();
        const canal = supabase
            .channel(`notificacoes:${userId}:${++sequencia}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "notificacoes",
                    filter: `destinatario_id=eq.${userId}`,
                },
                () => ouvintes.forEach((ouvinte) => ouvinte())
            )
            .subscribe();

        assinatura = { userId, canal, ouvintes };
    }

    const atual = assinatura;
    atual.ouvintes.add(aoChegar);

    return () => {
        atual.ouvintes.delete(aoChegar);
        if (atual === assinatura && atual.ouvintes.size === 0) encerrarAssinatura();
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Push
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pede o push da interação que acabou de acontecer. Best-effort de ponta a ponta: quem
 * chama não espera nem trata erro, porque a notificação já está na caixa de quem recebeu
 * de qualquer jeito — o push só decide se o aparelho toca agora.
 */
export function avisarInteracao(
    ref: ReferenciaPublicacao,
    // Só os dois tipos da Comunidade: a Edge Function recusa qualquer outro, e é ela que
    // sabe montar o texto.
    tipo: Extract<TipoNotificacao, "curtida" | "comentario">
): void {
    supabase.functions
        .invoke("avisar-interacao", {
            body: { tipo, origem: ref.origem, referenciaId: ref.referenciaId },
        })
        .catch((erro) => {
            console.warn("Não foi possível avisar a interação:", erro);
        });
}
