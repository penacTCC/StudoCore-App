import { useEffect } from "react";
import {
    confirmarCompraNoServidor,
    encerrarConexaoPlay,
    finalizarCompra,
    inicializarConexaoPlay,
    purchaseErrorListener,
    purchaseUpdatedListener,
} from "@/services/comprasPlay";
import { limparCache } from "@/lib/cache";

/**
 * Singleton montado uma vez perto da raiz (`app/_layout.tsx`), ao lado de `ProBottomSheetHost`.
 *
 * Existe porque o Google pode entregar uma atualização de compra a qualquer momento — não só
 * logo após `iniciarCompraPro()` (ex: pagamento pendente que acabou de ser aprovado, app
 * reaberto no meio de uma compra) — então o listener precisa estar sempre vivo pra pegar isso
 * e chamar `finalizarCompra`. Sem este host, uma compra concluída enquanto o app estava
 * fechado nunca seria confirmada no servidor.
 */
export function CompraPlayHost() {
    useEffect(() => {
        let ativo = true;

        inicializarConexaoPlay().catch((erro) => {
            console.warn("Falha ao iniciar conexão com a Play Store:", erro);
        });

        const assinaturaAtualizada = purchaseUpdatedListener(async (purchase) => {
            if (!ativo) return;
            try {
                await confirmarCompraNoServidor(purchase);
                await finalizarCompra(purchase);
                // Invalida o cache de navegação: `plano:estado` e afins precisam refletir o
                // Pro recém-ativado assim que a tela seguinte abrir.
                limparCache();
            } catch (erro) {
                console.warn("Falha ao confirmar compra Play:", erro);
            }
        });

        const assinaturaErro = purchaseErrorListener((erro) => {
            console.warn("Erro de compra Play:", erro);
        });

        return () => {
            ativo = false;
            assinaturaAtualizada.remove();
            assinaturaErro.remove();
            encerrarConexaoPlay().catch(() => {});
        };
    }, []);

    return null;
}
