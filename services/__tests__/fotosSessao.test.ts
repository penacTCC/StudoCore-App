import { criarQueryBuilderMock, criarStorageBuilderMock } from "@/test/helpers/supabaseQueryMock";

jest.mock("@/repositories/supabase", () => ({
    supabase: { from: jest.fn(), storage: { from: jest.fn() } },
}));
jest.mock("expo-image-picker", () => ({
    requestCameraPermissionsAsync: jest.fn(),
    requestMediaLibraryPermissionsAsync: jest.fn(),
    launchCameraAsync: jest.fn(),
    launchImageLibraryAsync: jest.fn(),
}));
jest.mock("expo-image-manipulator", () => ({
    ImageManipulator: { manipulate: jest.fn() },
    SaveFormat: { JPEG: "jpeg" },
}));
jest.mock("base64-arraybuffer", () => ({ decode: jest.fn(() => new ArrayBuffer(0)) }));

import * as ImagePicker from "expo-image-picker";
import { ImageManipulator } from "expo-image-manipulator";
import { supabase } from "@/repositories/supabase";
import {
    anexarFotoASessao,
    assinarCaminhosDeFoto,
    buscarFotosDoUsuario,
    capturarFotoSessao,
    contarFotosDoUsuario,
    removerFotoDaSessao,
} from "@/services/fotosSessao";

const fromMock = supabase.from as jest.Mock;
const storageFromMock = supabase.storage.from as jest.Mock;

beforeEach(() => {
    fromMock.mockReset();
    storageFromMock.mockReset();
    jest.clearAllMocks();
});

describe("capturarFotoSessao", () => {
    const mockManipulador = (largura: number) => {
        const contexto = {
            resize: jest.fn(),
            renderAsync: jest.fn().mockResolvedValue({
                saveAsync: jest.fn().mockResolvedValue({ uri: "file://foto.jpg", base64: "abc123" }),
            }),
        };
        (ImageManipulator.manipulate as jest.Mock).mockReturnValue(contexto);
        return contexto;
    };

    it("devolve erro sem quebrar quando a permissão é negada", async () => {
        (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });

        const resultado = await capturarFotoSessao("camera");

        expect(resultado).toEqual({
            foto: null,
            cancelado: false,
            erro: "Libere o acesso à câmera para registrar a sessão.",
        });
    });

    it("marca como cancelado (sem erro) quando a pessoa só fecha a câmera", async () => {
        (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
        (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({ canceled: true });

        expect(await capturarFotoSessao("camera")).toEqual({ foto: null, cancelado: true, erro: null });
    });

    it("redimensiona só quando a foto excede a largura máxima", async () => {
        (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
        (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
            canceled: false,
            assets: [{ uri: "file://big.jpg", width: 3000 }],
        });
        const contexto = mockManipulador(3000);

        const resultado = await capturarFotoSessao("camera");

        expect(contexto.resize).toHaveBeenCalledWith({ width: 1080 });
        expect(resultado.foto).toEqual({ uri: "file://foto.jpg", base64: "abc123" });
    });

    it("não redimensiona uma foto já menor que o limite", async () => {
        (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
        (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
            canceled: false,
            assets: [{ uri: "file://small.jpg", width: 500 }],
        });
        const contexto = mockManipulador(500);

        await capturarFotoSessao("galeria");

        expect(contexto.resize).not.toHaveBeenCalled();
    });

    it("captura exceções da câmera/galeria sem propagar", async () => {
        (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockRejectedValue(new Error("boom"));

        expect(await capturarFotoSessao("camera")).toEqual({
            foto: null,
            cancelado: false,
            erro: "Não foi possível abrir a câmera.",
        });
    });
});

describe("anexarFotoASessao", () => {
    it("devolve erro sem chamar o banco quando não há sessão pra vincular", async () => {
        const resultado = await anexarFotoASessao({
            userId: "u1",
            sessaoIds: [],
            foto: { uri: "x", base64: "y" },
        });

        expect(resultado).toEqual({ path: null, erro: "Sessão não encontrada." });
        expect(fromMock).not.toHaveBeenCalled();
    });

    it("sobe o arquivo e vincula às linhas informadas", async () => {
        const upload = jest.fn().mockResolvedValue({ error: null });
        storageFromMock.mockReturnValue({ upload, remove: jest.fn() });
        const updateMock = jest.fn(() => criarQueryBuilderMock({ error: null }));
        fromMock.mockReturnValue({ update: updateMock });

        const resultado = await anexarFotoASessao({
            userId: "u1",
            sessaoIds: ["s1", "s2"],
            foto: { uri: "x", base64: "y" },
        });

        expect(resultado.path).toBe("u1/s1.jpg");
        expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ foto_path: "u1/s1.jpg" }));
    });

    it("remove o arquivo do bucket se o update da linha falhar (não deixa órfão invisível)", async () => {
        const upload = jest.fn().mockResolvedValue({ error: null });
        const remove = jest.fn().mockResolvedValue({ error: null });
        storageFromMock.mockReturnValue({ upload, remove });
        fromMock.mockReturnValue({ update: () => criarQueryBuilderMock({ error: { message: "falhou" } }) });

        const resultado = await anexarFotoASessao({
            userId: "u1",
            sessaoIds: ["s1"],
            foto: { uri: "x", base64: "y" },
        });

        expect(remove).toHaveBeenCalledWith(["u1/s1.jpg"]);
        expect(resultado.path).toBeNull();
    });
});

describe("buscarFotosDoUsuario", () => {
    it("devolve [] sem userId", async () => {
        expect(await buscarFotosDoUsuario("")).toEqual([]);
    });

    it("agrupa linhas da mesma execução (mesmo arquivo) somando o tempo e juntando as matérias", async () => {
        fromMock.mockReturnValue(
            criarQueryBuilderMock({
                data: [
                    { id: "s1", execucao_id: "e1", foto_path: "p1.jpg", foto_legenda: null, foto_criada_em: "t1", disciplina: "Matemática", tempo_minutos: 20 },
                    { id: "s2", execucao_id: "e1", foto_path: "p1.jpg", foto_legenda: null, foto_criada_em: "t1", disciplina: "Física", tempo_minutos: 10 },
                    { id: "s3", execucao_id: null, foto_path: "p2.jpg", foto_legenda: null, foto_criada_em: "t2", disciplina: "Química", tempo_minutos: 5 },
                ],
                error: null,
            })
        );
        storageFromMock.mockReturnValue({
            createSignedUrls: jest.fn().mockResolvedValue({
                data: [
                    { path: "p1.jpg", signedUrl: "https://x/p1" },
                    { path: "p2.jpg", signedUrl: "https://x/p2" },
                ],
                error: null,
            }),
        });

        const fotos = await buscarFotosDoUsuario("u1");

        expect(fotos).toHaveLength(2);
        const momento1 = fotos.find((f) => f.path === "p1.jpg")!;
        expect(momento1.tempoMinutos).toBe(30);
        expect(momento1.disciplina).toBe("Matemática · Física");
        expect(momento1.url).toBe("https://x/p1");
    });

    it("devolve [] quando a busca falha", async () => {
        fromMock.mockReturnValue(criarQueryBuilderMock({ data: null, error: { message: "falhou" } }));
        expect(await buscarFotosDoUsuario("u1")).toEqual([]);
    });
});

describe("contarFotosDoUsuario", () => {
    it("devolve 0 sem userId", async () => {
        expect(await contarFotosDoUsuario("")).toBe(0);
    });

    it("conta caminhos distintos, não linhas (várias linhas compartilham o mesmo arquivo)", async () => {
        fromMock.mockReturnValue(
            criarQueryBuilderMock({
                data: [
                    { foto_path: "p1.jpg", execucao_id: "e1" },
                    { foto_path: "p1.jpg", execucao_id: "e1" },
                    { foto_path: "p2.jpg", execucao_id: null },
                ],
                error: null,
            })
        );

        expect(await contarFotosDoUsuario("u1")).toBe(2);
    });
});

describe("removerFotoDaSessao", () => {
    it("devolve erro quando a sessão não tem foto", async () => {
        fromMock.mockReturnValue(criarQueryBuilderMock({ data: { foto_path: null }, error: null }));
        expect(await removerFotoDaSessao("s1")).toEqual({ sucesso: false, erro: "Foto não encontrada." });
    });

    it("desvincula a linha e remove o arquivo do bucket", async () => {
        const remove = jest.fn().mockResolvedValue({ error: null });
        storageFromMock.mockReturnValue({ remove });

        let chamada = 0;
        fromMock.mockImplementation(() => {
            chamada += 1;
            if (chamada === 1) return criarQueryBuilderMock({ data: { foto_path: "u1/s1.jpg" }, error: null });
            return criarQueryBuilderMock({ error: null }); // update
        });

        const resultado = await removerFotoDaSessao("s1");

        expect(resultado).toEqual({ sucesso: true });
        expect(remove).toHaveBeenCalledWith(["u1/s1.jpg"]);
    });

    it("mantém sucesso mesmo se o storage falhar (a referência já foi limpa)", async () => {
        storageFromMock.mockReturnValue({ remove: jest.fn().mockResolvedValue({ error: { message: "boom" } }) });

        let chamada = 0;
        fromMock.mockImplementation(() => {
            chamada += 1;
            if (chamada === 1) return criarQueryBuilderMock({ data: { foto_path: "u1/s1.jpg" }, error: null });
            return criarQueryBuilderMock({ error: null });
        });

        expect(await removerFotoDaSessao("s1")).toEqual({ sucesso: true });
    });
});

describe("assinarCaminhosDeFoto", () => {
    it("devolve mapa vazio sem chamar o storage quando não há caminhos", async () => {
        expect(await assinarCaminhosDeFoto([])).toEqual(new Map());
        expect(storageFromMock).not.toHaveBeenCalled();
    });

    it("assina cada caminho uma única vez mesmo com duplicatas (arquivo compartilhado por várias linhas)", async () => {
        const createSignedUrls = jest.fn().mockResolvedValue({
            data: [{ path: "p1.jpg", signedUrl: "https://x/p1" }],
            error: null,
        });
        storageFromMock.mockReturnValue({ createSignedUrls });

        const mapa = await assinarCaminhosDeFoto(["p1.jpg", "p1.jpg", "p1.jpg"]);

        expect(createSignedUrls).toHaveBeenCalledWith(["p1.jpg"], expect.any(Number));
        expect(mapa.get("p1.jpg")).toBe("https://x/p1");
    });
});
