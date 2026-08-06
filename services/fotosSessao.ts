import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { decode } from "base64-arraybuffer";

import { supabase } from "@/repositories/supabase";
import type { FotoCapturada, FotoSessao } from "@/types/fotoSessao";

/*
  Foto da sessão de foco.

  A foto não valida nada — quem valida a sessão é o cronômetro. Ela existe pra virar
  memória (aba Galeria do perfil), então todo o fluxo aqui é best-effort: se o upload
  falhar, a sessão continua salva e o usuário pode tentar de novo depois.

  O bucket é privado (ver migration 20260806090000_fotos_sessao.sql), diferente do
  `images` dos avatares: leitura sempre passa por signed URL de validade curta.
*/

const BUCKET = "sessao-fotos";

/** Foto de câmera chega com 3000px+; 1080 já cobre o maior grid que a galeria mostra. */
const LARGURA_MAX = 1080;

/** JPEG a 0.6 deixa a foto por volta de 200–400 KB, bem abaixo do teto de 5 MB do bucket. */
const QUALIDADE = 0.6;

/** Validade das signed URLs. Uma hora dá folga pra galeria aberta e não vaza link útil. */
const VALIDADE_URL_SEGUNDOS = 3600;

const COLUNAS_FOTO =
    "id, execucao_id, foto_path, foto_legenda, foto_criada_em, disciplina, tempo_minutos";

type LinhaFoto = {
    id: string;
    execucao_id: string | null;
    foto_path: string;
    foto_legenda: string | null;
    foto_criada_em: string | null;
    disciplina: string | null;
    tempo_minutos: number | null;
};

export type ResultadoCaptura = {
    foto: FotoCapturada | null;
    /** `true` quando a pessoa só fechou a câmera — não é erro, não mostra aviso. */
    cancelado: boolean;
    erro: string | null;
};

/**
 * Abre a câmera (ou a galeria) e devolve a foto já redimensionada e comprimida.
 *
 * O redimensionamento não é cosmético: sem ele o base64 de uma foto full-res fica na casa
 * das dezenas de MB na memória, que é onde aparelho Android modesto morre.
 */
export async function capturarFotoSessao(
    origem: "camera" | "galeria" = "camera"
): Promise<ResultadoCaptura> {
    try {
        const permissao =
            origem === "camera"
                ? await ImagePicker.requestCameraPermissionsAsync()
                : await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permissao.granted) {
            return {
                foto: null,
                cancelado: false,
                erro:
                    origem === "camera"
                        ? "Libere o acesso à câmera para registrar a sessão."
                        : "Libere o acesso às fotos para escolher uma imagem.",
            };
        }

        const opcoes: ImagePicker.ImagePickerOptions = {
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 1, // A compressão real acontece no saveAsync, depois do resize.
        };

        const resultado =
            origem === "camera"
                ? await ImagePicker.launchCameraAsync(opcoes)
                : await ImagePicker.launchImageLibraryAsync(opcoes);

        if (resultado.canceled) return { foto: null, cancelado: true, erro: null };

        const asset = resultado.assets[0];
        const contexto = ImageManipulator.manipulate(asset.uri);

        // Só encolhe: ampliar uma foto pequena não melhora nada e ainda pesaria mais.
        if (asset.width > LARGURA_MAX) contexto.resize({ width: LARGURA_MAX });

        const imagem = await contexto.renderAsync();
        const processada = await imagem.saveAsync({
            format: SaveFormat.JPEG,
            compress: QUALIDADE,
            base64: true,
        });

        if (!processada.base64) {
            return { foto: null, cancelado: false, erro: "Não foi possível ler a foto." };
        }

        return {
            foto: { uri: processada.uri, base64: processada.base64 },
            cancelado: false,
            erro: null,
        };
    } catch (erro) {
        console.error("Erro ao capturar foto da sessão:", erro);
        return { foto: null, cancelado: false, erro: "Não foi possível abrir a câmera." };
    }
}

/**
 * Sobe a foto e vincula às linhas da sessão.
 *
 * `sessaoIds` vem com mais de um id quando a execução encadeou várias matérias: a foto é
 * do momento de estudo, não de uma matéria, então todas as linhas apontam pro mesmo
 * arquivo e a galeria reagrupa na leitura.
 *
 * O caminho é derivado da primeira sessão (`${userId}/${sessaoId}.jpg`), com upsert, pra
 * refazer a foto sobrescrever em vez de acumular lixo no bucket.
 */
export async function anexarFotoASessao(params: {
    userId: string;
    sessaoIds: string[];
    foto: FotoCapturada;
    legenda?: string | null;
}): Promise<{ path: string | null; erro?: string }> {
    const { userId, sessaoIds, foto } = params;
    if (sessaoIds.length === 0) return { path: null, erro: "Sessão não encontrada." };

    const legenda = params.legenda?.trim() || null;
    const path = `${userId}/${sessaoIds[0]}.jpg`;

    try {
        const { error: erroUpload } = await supabase.storage
            .from(BUCKET)
            .upload(path, decode(foto.base64), { contentType: "image/jpeg", upsert: true });

        if (erroUpload) throw erroUpload;

        const { error: erroUpdate } = await supabase
            .from("sessoes_foco")
            .update({
                foto_path: path,
                foto_legenda: legenda,
                foto_criada_em: new Date().toISOString(),
            })
            .in("id", sessaoIds);

        if (erroUpdate) {
            // Sem a linha apontando pro arquivo, ele é invisível e ninguém mais o apaga.
            await supabase.storage.from(BUCKET).remove([path]);
            throw erroUpdate;
        }

        return { path };
    } catch (erro: any) {
        console.error("Erro ao anexar foto à sessão:", erro?.message ?? erro);
        return { path: null, erro: "Não foi possível enviar a foto." };
    }
}

/**
 * Fotos de um usuário, prontas pra galeria.
 *
 * Quem chama não precisa ser o dono: as sessões privadas já são cortadas pela RLS de
 * `sessoes_foco`, e a assinatura da URL é barrada pela policy do bucket. Uma foto que
 * escape do primeiro filtro e caia no segundo volta com `url: null` em vez de derrubar
 * a lista inteira.
 */
export async function buscarFotosDoUsuario(
    userId: string,
    limite = 60
): Promise<FotoSessao[]> {
    if (!userId) return [];

    const { data, error } = await supabase
        .from("sessoes_foco")
        .select(COLUNAS_FOTO)
        .eq("user_id", userId)
        .not("foto_path", "is", null)
        .order("foto_criada_em", { ascending: false, nullsFirst: false })
        // Busca com folga porque linhas da mesma execução colapsam num item só depois.
        .limit(limite * 3);

    if (error) {
        console.error("Erro ao buscar fotos das sessões:", error.message);
        return [];
    }

    const momentos = agruparPorMomento((data ?? []) as LinhaFoto[]).slice(0, limite);
    return await assinarUrls(momentos);
}

/** Total de momentos com foto — usado pelo contador da seção do próprio perfil. */
export async function contarFotosDoUsuario(userId: string): Promise<number> {
    if (!userId) return 0;

    const { data, error } = await supabase
        .from("sessoes_foco")
        .select("foto_path, execucao_id")
        .eq("user_id", userId)
        .not("foto_path", "is", null);

    if (error) {
        console.error("Erro ao contar fotos das sessões:", error.message);
        return 0;
    }

    // Conta caminhos distintos: as N linhas de uma execução compartilham o mesmo arquivo.
    return new Set((data ?? []).map((linha: { foto_path: string }) => linha.foto_path)).size;
}

/** Remove a foto de uma sessão (e das irmãs da mesma execução) e apaga o arquivo. */
export async function removerFotoDaSessao(
    sessaoId: string
): Promise<{ sucesso: boolean; erro?: string }> {
    const { data, error } = await supabase
        .from("sessoes_foco")
        .select("foto_path")
        .eq("id", sessaoId)
        .maybeSingle();

    if (error || !data?.foto_path) {
        return { sucesso: false, erro: "Foto não encontrada." };
    }

    const path = data.foto_path as string;

    // Limpa a referência antes do arquivo: se a remoção no bucket falhar, sobra um órfão
    // invisível, o que é bem melhor do que um card de foto quebrado na galeria.
    const { error: erroUpdate } = await supabase
        .from("sessoes_foco")
        .update({ foto_path: null, foto_legenda: null, foto_criada_em: null })
        .eq("foto_path", path);

    if (erroUpdate) {
        console.error("Erro ao remover foto da sessão:", erroUpdate.message);
        return { sucesso: false, erro: "Não foi possível remover a foto." };
    }

    const { error: erroStorage } = await supabase.storage.from(BUCKET).remove([path]);
    if (erroStorage) console.warn("Foto desvinculada, mas o arquivo continuou no bucket:", erroStorage.message);

    return { sucesso: true };
}

/**
 * Colapsa as linhas que compartilham o mesmo arquivo (as matérias de uma execução de
 * plano) num único item, somando os minutos e juntando os nomes das matérias — mesma
 * ideia do `compilarSessoesPorExecucao` do feed, só que a chave aqui é o `foto_path`.
 */
function agruparPorMomento(linhas: LinhaFoto[]): Omit<FotoSessao, "url">[] {
    const porPath = new Map<string, Omit<FotoSessao, "url">>();
    const materiasPorPath = new Map<string, Set<string>>();

    for (const linha of linhas) {
        const existente = porPath.get(linha.foto_path);
        const materias = materiasPorPath.get(linha.foto_path) ?? new Set<string>();
        if (linha.disciplina) materias.add(linha.disciplina);
        materiasPorPath.set(linha.foto_path, materias);

        if (!existente) {
            porPath.set(linha.foto_path, {
                sessaoId: linha.id,
                execucaoId: linha.execucao_id,
                path: linha.foto_path,
                legenda: linha.foto_legenda,
                disciplina: linha.disciplina ?? "",
                tempoMinutos: linha.tempo_minutos ?? 0,
                criadaEm: linha.foto_criada_em ?? "",
            });
            continue;
        }

        existente.tempoMinutos += linha.tempo_minutos ?? 0;
    }

    return [...porPath.values()].map((momento) => ({
        ...momento,
        disciplina: [...(materiasPorPath.get(momento.path) ?? [])].join(" · "),
    }));
}

/**
 * Assina caminhos avulsos e devolve `path -> url`.
 *
 * O feed do grupo precisa disso porque lá a foto é só a miniatura de um card: ele já tem
 * o `foto_path` na linha da sessão e não passa por `buscarFotosDoUsuario`. Como no grid,
 * é uma chamada só para a lista inteira — uma por card faria o feed abrir dezenas.
 */
export async function assinarCaminhosDeFoto(caminhos: string[]): Promise<Map<string, string>> {
    const urlPorPath = new Map<string, string>();

    // O mesmo arquivo é compartilhado pelas linhas de uma execução: assinar duas vezes é desperdício.
    const unicos = [...new Set(caminhos.filter(Boolean))];
    if (unicos.length === 0) return urlPorPath;

    const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(unicos, VALIDADE_URL_SEGUNDOS);

    if (error) {
        console.error("Erro ao assinar URLs das fotos do feed:", error.message);
        return urlPorPath;
    }

    for (const assinada of data ?? []) {
        if (assinada.path && assinada.signedUrl) urlPorPath.set(assinada.path, assinada.signedUrl);
    }

    return urlPorPath;
}

/** Assina todos os caminhos de uma vez — uma chamada em vez de uma por foto do grid. */
async function assinarUrls(momentos: Omit<FotoSessao, "url">[]): Promise<FotoSessao[]> {
    if (momentos.length === 0) return [];

    const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(momentos.map((m) => m.path), VALIDADE_URL_SEGUNDOS);

    if (error) {
        console.error("Erro ao assinar URLs das fotos:", error.message);
        return momentos.map((momento) => ({ ...momento, url: null }));
    }

    const urlPorPath = new Map<string, string>();
    for (const assinada of data ?? []) {
        if (assinada.path && assinada.signedUrl) urlPorPath.set(assinada.path, assinada.signedUrl);
    }

    return momentos.map((momento) => ({
        ...momento,
        url: urlPorPath.get(momento.path) ?? null,
    }));
}
