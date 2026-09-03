import {
    endConnection,
    fetchProducts,
    finishTransaction,
    getAvailablePurchases,
    initConnection,
    purchaseErrorListener,
    purchaseUpdatedListener,
    requestPurchase,
    type Purchase,
    type PurchaseError,
} from "react-native-iap";
import { supabase } from "@/repositories/supabase";

/**
 * Compra da assinatura Pro via Google Play Billing.
 *
 * Este é o único arquivo do app que fala com o SDK nativo de compra — mesmo papel que
 * `services/backblaze.ts` tem para o Cofre: uma porta só, pra não espalhar o SDK pela UI.
 *
 * O app NUNCA decide sozinho que a compra deu certo: `confirmarCompraNoServidor` chama a
 * Edge Function `confirmar-compra-play`, que reconfere direto com o Google antes de gravar
 * `assinaturas`. `finalizarCompra` (que tira a compra da fila do Google) só roda DEPOIS
 * dessa confirmação — se o app cair no meio do caminho, o Google reentrega a compra no
 * próximo `purchaseUpdatedListener`, e nada se perde.
 */
export const PRODUTO_PRO_MENSAL = "pro_mensal";

let conexaoIniciada = false;

/** Idempotente: pode ser chamada de novo sem reabrir a conexão com a Play Store. */
export async function inicializarConexaoPlay(): Promise<void> {
    if (conexaoIniciada) return;
    await initConnection();
    conexaoIniciada = true;
}

export async function encerrarConexaoPlay(): Promise<void> {
    if (!conexaoIniciada) return;
    await endConnection();
    conexaoIniciada = false;
}

/** Inicia o fluxo de compra — o resultado chega pelo listener, não pelo retorno desta função. */
export async function iniciarCompraPro(): Promise<void> {
    await inicializarConexaoPlay();

    const produtos = await fetchProducts({ skus: [PRODUTO_PRO_MENSAL], type: "subs" });
    const produto = Array.isArray(produtos) ? produtos[0] : null;
    const offerToken = (produto as { subscriptionOffers?: { offerToken: string }[] } | null)
        ?.subscriptionOffers?.[0]?.offerToken;

    if (!offerToken) {
        throw new Error("Não foi possível carregar a oferta da assinatura Pro.");
    }

    await requestPurchase({
        type: "subs",
        request: {
            google: {
                skus: [PRODUTO_PRO_MENSAL],
                subscriptionOffers: [{ sku: PRODUTO_PRO_MENSAL, offerToken }],
            },
        },
    });
}

/** Chama a Edge Function que reconfere a compra com o Google e grava `assinaturas`. */
export async function confirmarCompraNoServidor(purchase: Purchase): Promise<void> {
    if (!purchase.purchaseToken) throw new Error("Compra sem purchaseToken.");

    const { data, error } = await supabase.functions.invoke("confirmar-compra-play", {
        body: { purchaseToken: purchase.purchaseToken, productId: purchase.productId },
    });

    if (error) throw error;
    if (data && (data as { ok?: boolean }).ok === false) {
        throw new Error((data as { error?: string }).error ?? "Não foi possível confirmar a compra.");
    }
}

/** Só finaliza (tira da fila do Google) depois que o servidor já confirmou. */
export async function finalizarCompra(purchase: Purchase): Promise<void> {
    await finishTransaction({ purchase, isConsumable: false });
}

/**
 * Reatribui compras já feitas (reinstalação, troca de aparelho) — confirma no servidor e
 * finaliza cada uma encontrada.
 */
export async function restaurarCompras(): Promise<void> {
    await inicializarConexaoPlay();
    const compras = await getAvailablePurchases();
    for (const compra of compras) {
        if (compra.productId !== PRODUTO_PRO_MENSAL) continue;
        await confirmarCompraNoServidor(compra);
        await finalizarCompra(compra);
    }
}

/** Reconciliação: pede ao servidor para reconferir a assinatura atual contra o Google. */
export async function verificarAssinaturaAtual(): Promise<{ alterado: boolean }> {
    const { data, error } = await supabase.functions.invoke("sincronizar-assinatura-play");
    if (error) {
        console.warn("Falha ao sincronizar assinatura Play:", error);
        return { alterado: false };
    }
    return { alterado: Boolean((data as { alterado?: boolean } | null)?.alterado) };
}

export type { Purchase, PurchaseError };
export { purchaseErrorListener, purchaseUpdatedListener };
