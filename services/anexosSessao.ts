import { File as FileClass } from "expo-file-system";
import { decode } from "base64-arraybuffer";

import { supabase } from "@/repositories/supabase";
import { uploadFileToB2 } from "@/services/backblaze";
import { analisarAnexoSessao } from "@/services/quizIA";
import type { AnexoSessao, CorrecaoFormulario } from "@/types/anotacoes";
import { acertosDoAnexo, anexoCorrigido } from "@/types/anotacoes";
import { buscarEstadoDoPlano, mensagemDeLimite, MENSAGEM_DE_LIMITE } from "@/services/assinatura";

// Uma linha só de propósito: quebrar a string com `+` faz o parser de `select()` do
// supabase-js perder o tipo literal e devolver GenericStringError no lugar da linha.
const COLUNAS_ANEXO = "id, sessao_id, user_id, titulo, disciplina, storage_path, backblaze_file_id, created_at, questoes_detectadas, questoes_discursivas, numeros_objetivas, resumo_ia, proximo_passo_ia, gabarito_ia, correcao, acertos_informados, gemini_file_uri, gemini_file_expira_em";

/** Limite do inline data do Gemini na Edge Function — acima disso a análise é pulada. */
const LIMITE_ANALISE_BYTES = 15 * 1024 * 1024;

/**
 * O DocumentPicker devolve `application/octet-stream` quando o provedor do arquivo não
 * informa o tipo (comum ao pegar um PDF do Drive/WhatsApp no Android). O Gemini rejeita
 * mimeType desconhecido na hora, com 400 — era o que fazia a análise falhar em menos de
 * meio segundo. Como só aceitamos PDF aqui, a extensão é a fonte de verdade.
 */
const tipoRealDoArquivo = (nome: string, mimeInformado: string) => {
    if (nome.toLowerCase().endsWith(".pdf")) return "application/pdf";
    return mimeInformado;
};

export async function buscarAnexosDaSessao(sessaoId: string): Promise<AnexoSessao[]> {
    const { data, error } = await supabase
        .from("arquivos")
        .select(COLUNAS_ANEXO)
        .eq("sessao_id", sessaoId)
        .eq("pendente_upload", false)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Erro ao buscar anexos da sessão:", error.message);
        return [];
    }

    return (data ?? []) as AnexoSessao[];
}

export async function buscarAnexo(anexoId: string): Promise<AnexoSessao | null> {
    const { data, error } = await supabase
        .from("arquivos")
        .select(COLUNAS_ANEXO)
        .eq("id", anexoId)
        .eq("pendente_upload", false)
        .maybeSingle();

    if (error) {
        console.error("Erro ao buscar anexo:", error.message);
        return null;
    }

    return (data as AnexoSessao) ?? null;
}

/**
 * Anexa um PDF de questões a uma sessão.
 *
 * O arquivo vai pro mesmo bucket do vault e pra mesma tabela `arquivos` (só que com
 * `sessao_id`), então ele continua aparecendo em "Meus Arquivos". Depois de gravado, a
 * Edge Function lê o PDF e devolve quantas questões tinha, um resumo e o próximo passo.
 *
 * A análise é best-effort de propósito: se a IA falhar, o anexo continua salvo e a tela
 * mostra o botão de "analisar de novo" — perder o upload por causa da IA seria pior.
 */
export async function anexarFormularioASessao(params: {
    userId: string;
    sessaoId: string;
    disciplina: string;
    conteudo?: string | null;
    arquivo: { uri: string; name: string; mimeType: string; size: number };
}): Promise<{ anexo: AnexoSessao | null; erro?: string; erroAnalise?: string }> {
    const { userId, sessaoId, disciplina, conteudo, arquivo } = params;

    try {
        // Pré-checagem só para feedback rápido na UI. O bloqueio real acontece na Edge
        // Function `arquivos-b2`, que reserva a cota antes de subir qualquer byte ao B2.
        const { limites, uso } = await buscarEstadoDoPlano();

        if (limites.arquivoBytesMax !== null && arquivo.size > limites.arquivoBytesMax) {
            return { anexo: null, erro: MENSAGEM_DE_LIMITE.tamanho_do_arquivo };
        }
        if (
            limites.armazenamentoBytes !== null &&
            uso.armazenamentoBytes + arquivo.size > limites.armazenamentoBytes
        ) {
            return { anexo: null, erro: MENSAGEM_DE_LIMITE.armazenamento };
        }

        const objetoArquivo = new FileClass(arquivo.uri);
        const base64 = await objetoArquivo.base64Sync();

        const nomeFormatado = arquivo.name.replace(/[^a-zA-Z0-9.]/g, "_");
        const caminhoArquivo = `${disciplina}/sessoes/${sessaoId}/${nomeFormatado}`;

        const mimeType = tipoRealDoArquivo(arquivo.name, arquivo.mimeType);
        const upload = await uploadFileToB2(caminhoArquivo, mimeType, decode(base64));
        const uploadData = await upload.json();

        const { data: novoAnexo, error } = await supabase
            .from("arquivos")
            .update({
                sessao_id: sessaoId,
                titulo: nomeFormatado,
                disciplina,
                pendente_upload: false,
            })
            .eq("id", uploadData.id)
            .eq("user_id", userId)
            .select(COLUNAS_ANEXO)
            .single();

        if (error) throw error;

        const anexo = novoAnexo as AnexoSessao;

        if (arquivo.size <= LIMITE_ANALISE_BYTES) {
            const { anexo: analisado, erro: erroIA } = await analisarEGravar(anexo.id, {
                base64,
                mimeType,
                disciplina,
                conteudo: conteudo ?? null,
            });
            if (analisado) return { anexo: analisado };
            // O anexo continua salvo — só a análise falhou. Quem chamou decide como avisar.
            return { anexo, erroAnalise: erroIA };
        }

        return { anexo };
    } catch (erro: any) {
        const limite = await mensagemDeLimite(erro);
        if (limite) return { anexo: null, erro: limite };

        console.error("Erro ao anexar formulário à sessão:", erro);
        return { anexo: null, erro: "Não foi possível anexar o arquivo." };
    }
}

/** Roda a análise da IA e grava o resultado no anexo. `anexo` vem null se a IA falhar. */
async function analisarEGravar(
    anexoId: string,
    entrada: { base64: string; mimeType: string; disciplina: string; conteudo: string | null }
): Promise<{ anexo: AnexoSessao | null; erro?: string }> {
    const { data: analise, error: erroIA } = await analisarAnexoSessao(entrada);
    if (!analise) return { anexo: null, erro: erroIA ?? undefined };

    const { data, error } = await supabase
        .from("arquivos")
        .update({
            questoes_detectadas: analise.questoesDetectadas,
            questoes_discursivas: analise.questoesDiscursivas,
            numeros_objetivas: analise.numerosObjetivas,
            resumo_ia: analise.resumo,
            proximo_passo_ia: analise.proximoPasso,
            gabarito_ia: analise.gabarito,
        })
        .eq("id", anexoId)
        .select(COLUNAS_ANEXO)
        .single();

    if (error) {
        console.error("Erro ao gravar análise do anexo:", error.message);
        return { anexo: null, erro: "Não foi possível salvar a análise." };
    }

    return { anexo: data as AnexoSessao };
}

/** Reanalisa um anexo já salvo, baixando o arquivo do bucket. Usado pelo botão de retry. */
export async function reanalisarAnexo(
    anexo: AnexoSessao,
    urlDoArquivo: string,
    conteudo?: string | null
): Promise<{ anexo: AnexoSessao | null; erro?: string }> {
    try {
        const resposta = await fetch(urlDoArquivo);
        const buffer = await resposta.arrayBuffer();
        const base64 = arrayBufferParaBase64(buffer);

        const { anexo: atualizado, erro } = await analisarEGravar(anexo.id, {
            base64,
            mimeType: "application/pdf",
            disciplina: anexo.disciplina,
            conteudo: conteudo ?? null,
        });

        if (!atualizado) return { anexo: null, erro: erro ?? "A IA não conseguiu ler esse arquivo." };
        return { anexo: atualizado };
    } catch (erro) {
        console.error("Erro ao reanalisar anexo:", erro);
        return { anexo: null, erro: "Não foi possível reanalisar o arquivo." };
    }
}

function arrayBufferParaBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binario = "";
    for (let i = 0; i < bytes.byteLength; i++) binario += String.fromCharCode(bytes[i]);
    return btoa(binario);
}

/**
 * Grava a correção de um anexo (quais questões o usuário acertou) e reflete o total na
 * sessão. `correcao` é a grade por questão; `acertosInformados` é o atalho "acertei X de N"
 * pra quem não quer detalhar.
 */
export async function salvarCorrecaoAnexo(params: {
    anexoId: string;
    sessaoId: string;
    correcao?: CorrecaoFormulario | null;
    acertosInformados?: number | null;
}): Promise<{ sucesso: boolean; erro?: string }> {
    const { anexoId, sessaoId, correcao, acertosInformados } = params;

    const { error } = await supabase
        .from("arquivos")
        .update({
            correcao: correcao ?? null,
            acertos_informados: acertosInformados ?? null,
        })
        .eq("id", anexoId);

    if (error) {
        console.error("Erro ao salvar correção do anexo:", error.message);
        return { sucesso: false, erro: "Não foi possível salvar a correção." };
    }

    await recalcularQuestoesExternas(sessaoId);
    return { sucesso: true };
}

export async function removerAnexo(anexoId: string, sessaoId: string) {
    const { error } = await supabase.from("arquivos").delete().eq("id", anexoId);
    if (error) {
        console.error("Erro ao remover anexo:", error.message);
        return { sucesso: false, erro: "Não foi possível remover o anexo." };
    }
    await recalcularQuestoesExternas(sessaoId);
    return { sucesso: true };
}

/**
 * Recalcula `questoes_externas`/`acertos_externos` da sessão a partir dos anexos.
 *
 * Só anexos JÁ CORRIGIDOS entram na conta: um PDF de 28 questões recém-anexado contaria
 * como 0/28 e derrubaria a taxa de acerto do usuário sem ele ter feito nada errado. Na
 * tela ele aparece como "aguardando correção" até ser corrigido.
 */
export async function recalcularQuestoesExternas(sessaoId: string) {
    const anexos = await buscarAnexosDaSessao(sessaoId);
    const corrigidos = anexos.filter(anexoCorrigido);

    const questoes = corrigidos.reduce((total, anexo) => total + (anexo.questoes_detectadas ?? 0), 0);
    const acertos = corrigidos.reduce((total, anexo) => total + acertosDoAnexo(anexo), 0);

    const { error } = await supabase
        .from("sessoes_foco")
        .update({ questoes_externas: questoes, acertos_externos: acertos })
        .eq("id", sessaoId);

    if (error) console.error("Erro ao atualizar questões externas da sessão:", error.message);
}
