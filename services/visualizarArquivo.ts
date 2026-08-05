import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import * as IntentLauncher from "expo-intent-launcher";
import * as Sharing from "expo-sharing";

import { getAuthenticatedDownloadUrl } from "@/services/backblaze";
import { toast } from "@/services/toast";

/** mimeType a partir da extensão, pro sistema saber com qual app abrir. */
function tipoDoArquivo(nome: string) {
    const extensao = nome.split(".").pop()?.toLowerCase();
    if (extensao === "pdf") return "application/pdf";
    if (extensao === "png") return "image/png";
    if (extensao === "jpg" || extensao === "jpeg") return "image/jpeg";
    return "application/octet-stream";
}

/**
 * Baixa um arquivo do bucket pro cache e abre no visualizador nativo.
 *
 * Mesmo fluxo já usado em app/(modals)/archive-details.tsx, extraído aqui porque a tela
 * de detalhes da sessão também precisa abrir os PDFs anexados.
 */
export async function abrirArquivoDoBucket(storagePath: string): Promise<boolean> {
    try {
        const urlAutenticada = await getAuthenticatedDownloadUrl(storagePath);
        const nomeArquivo = storagePath.split("/").pop() || "arquivo";
        const arquivoLocal = new File(Paths.cache, nomeArquivo);

        const baixado = await File.downloadFileAsync(urlAutenticada, arquivoLocal, { idempotent: true });
        if (!baixado.exists) throw new Error("Falha ao salvar o arquivo no cache.");

        if (Platform.OS === "android") {
            await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
                data: baixado.contentUri,
                flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
                type: tipoDoArquivo(nomeArquivo),
            });
        } else {
            await Sharing.shareAsync(baixado.uri);
        }
        return true;
    } catch (erro) {
        console.error("Erro ao abrir arquivo:", erro);
        toast.error("Não foi possível abrir o documento no momento.");
        return false;
    }
}

/** URL temporária autenticada do arquivo — usada pra reenviar o PDF à IA. */
export async function urlAutenticadaDoArquivo(storagePath: string) {
    return getAuthenticatedDownloadUrl(storagePath);
}
