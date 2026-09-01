import { supabase } from "@/repositories/supabase";
import { urlAutenticadaDoArquivo, tipoDoArquivo } from "@/services/visualizarArquivo";
import { subirAnexoParaChat, perguntarSobreAnexo } from "@/services/quizIA";
import type { AnexoSessao, MensagemChatAnexo } from "@/types/anotacoes";

export async function buscarMensagensChat(anexoId: string): Promise<MensagemChatAnexo[]> {
    const { data, error } = await supabase
        .from("chat_anexo_mensagens")
        .select("id, anexo_id, papel, texto, created_at")
        .eq("anexo_id", anexoId)
        .order("created_at", { ascending: true });

    if (error) {
        console.error("Erro ao buscar mensagens do chat do anexo:", error.message);
        return [];
    }

    return (data ?? []) as MensagemChatAnexo[];
}

/*
  Garante que o arquivo esteja hospedado na Gemini Files API e devolve a referência pronta
  pra usar. Baixa e sobe de novo só quando não há referência salva ou ela já expirou (~48h) —
  na maioria das mensagens do chat isso é um no-op que só lê `arquivos`.
*/
async function garantirArquivoNoChat(anexo: AnexoSessao): Promise<{ fileUri: string; mimeType: string } | null> {
    const mimeType = tipoDoArquivo(anexo.titulo);
    const aindaValido =
        anexo.gemini_file_uri &&
        anexo.gemini_file_expira_em &&
        new Date(anexo.gemini_file_expira_em).getTime() > Date.now();

    if (aindaValido) return { fileUri: anexo.gemini_file_uri!, mimeType };

    if (!anexo.storage_path) return null;

    const urlArquivo = await urlAutenticadaDoArquivo(anexo.storage_path);
    const resposta = await fetch(urlArquivo);
    const buffer = await resposta.arrayBuffer();
    const base64 = arrayBufferParaBase64(buffer);

    const { data: upload, error: erroUpload } = await subirAnexoParaChat({ base64, mimeType });
    if (!upload) {
        console.error("Erro ao subir anexo pro chat:", erroUpload);
        return null;
    }

    await supabase
        .from("arquivos")
        .update({ gemini_file_uri: upload.fileUri, gemini_file_expira_em: upload.expiraEm })
        .eq("id", anexo.id);

    return { fileUri: upload.fileUri, mimeType };
}

/**
 * Manda uma pergunta do chat sobre o anexo. Grava a pergunta e a resposta em
 * `chat_anexo_mensagens` só depois de ambas darem certo — uma pergunta sem resposta salva
 * ficaria pendurada na tela sem forma de reenviar.
 */
export async function enviarMensagemChatAnexo(params: {
    anexo: AnexoSessao;
    conteudo: string | null;
    historico: MensagemChatAnexo[];
    pergunta: string;
}): Promise<{ sucesso: boolean; erro?: string }> {
    const { anexo, conteudo, historico, pergunta } = params;

    const arquivoNoChat = await garantirArquivoNoChat(anexo);
    if (!arquivoNoChat) return { sucesso: false, erro: "Não foi possível preparar o arquivo para o chat." };

    const { data: textoResposta, error } = await perguntarSobreAnexo({
        fileUri: arquivoNoChat.fileUri,
        mimeType: arquivoNoChat.mimeType,
        disciplina: anexo.disciplina,
        conteudo,
        historico: historico.map((m) => ({ papel: m.papel, texto: m.texto })),
        pergunta,
    });

    if (!textoResposta) return { sucesso: false, erro: error ?? "Não foi possível responder agora." };

    const { data: userId } = await supabase.auth.getUser();
    const donoId = userId.user?.id;
    if (!donoId) return { sucesso: false, erro: "Sessão expirada." };

    const { error: erroInsercao } = await supabase.from("chat_anexo_mensagens").insert([
        { anexo_id: anexo.id, user_id: donoId, papel: "user", texto: pergunta },
        { anexo_id: anexo.id, user_id: donoId, papel: "model", texto: textoResposta },
    ]);

    if (erroInsercao) {
        console.error("Erro ao salvar mensagens do chat do anexo:", erroInsercao.message);
        return { sucesso: false, erro: "Não foi possível salvar a conversa." };
    }

    return { sucesso: true };
}

function arrayBufferParaBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binario = "";
    for (let i = 0; i < bytes.byteLength; i++) binario += String.fromCharCode(bytes[i]);
    return btoa(binario);
}
