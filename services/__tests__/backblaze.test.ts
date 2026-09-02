jest.mock("@/repositories/supabase", () => ({
    supabase: {
        auth: { getSession: jest.fn() },
        functions: { invoke: jest.fn() },
    },
}));

process.env.EXPO_PUBLIC_SUPABASE_URL = "https://test.supabase.co/";
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "anon-test";

import { supabase } from "@/repositories/supabase";
import { deleteFileFromB2, getAuthenticatedDownloadUrl, uploadFileToB2 } from "@/services/backblaze";

const invokeMock = supabase.functions.invoke as jest.Mock;
const getSessionMock = supabase.auth.getSession as jest.Mock;
const fetchMock = jest.fn();

beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock as any;
    getSessionMock.mockResolvedValue({
        data: { session: { access_token: "jwt-user" } },
        error: null,
    });
});

describe("uploadFileToB2", () => {
    it("envia o binário para a Edge Function, sem receber token de escrita do B2 no app", async () => {
        fetchMock.mockResolvedValue({
            json: jest.fn().mockResolvedValue({
                ok: true,
                fileId: "file-123",
                fileName: "Matemática/pasta com espaço/arquivo.pdf",
            }),
        });

        const buffer = new Uint8Array([1, 2, 3]).buffer;
        const resposta = await uploadFileToB2("Matemática/pasta com espaço/arquivo.pdf", "application/pdf", buffer);

        expect(fetchMock).toHaveBeenCalledWith("https://test.supabase.co/functions/v1/arquivos-b2", {
            method: "POST",
            body: buffer,
            headers: {
                apikey: "anon-test",
                Authorization: "Bearer jwt-user",
                "content-type": "application/pdf",
                "x-acao": "upload",
                "x-storage-path": "Matemática/pasta com espaço/arquivo.pdf",
                "x-mime-type": "application/pdf",
            },
        });
        await expect(resposta.json()).resolves.toEqual({
            ok: true,
            fileId: "file-123",
            fileName: "Matemática/pasta com espaço/arquivo.pdf",
        });
    });

    it("lança erro amigável quando a Edge Function falha", async () => {
        fetchMock.mockRejectedValue(new Error("offline"));

        await expect(uploadFileToB2("a.pdf", "application/pdf", new ArrayBuffer(1))).rejects.toThrow(
            "Não foi possível falar com o servidor de arquivos."
        );
    });

    it("lança o erro do servidor quando a função responde ok: false", async () => {
        fetchMock.mockResolvedValue({
            json: jest.fn().mockResolvedValue({ ok: false, error: "cota excedida" }),
        });

        await expect(uploadFileToB2("a.pdf", "application/pdf", new ArrayBuffer(1))).rejects.toThrow(
            "cota excedida"
        );
    });

    it("exige sessão do usuário para fazer upload", async () => {
        getSessionMock.mockResolvedValue({ data: { session: null }, error: null });

        await expect(uploadFileToB2("a.pdf", "application/pdf", new ArrayBuffer(1))).rejects.toThrow(
            "Você precisa estar logado para enviar arquivos."
        );
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe("deleteFileFromB2", () => {
    it("chama a Edge Function com o path e o fileId, e devolve sucesso", async () => {
        invokeMock.mockResolvedValue({ data: { ok: true }, error: null });

        const resultado = await deleteFileFromB2("Matemática/arquivo.pdf", "file-123");

        expect(invokeMock).toHaveBeenCalledWith("arquivos-b2", {
            body: { acao: "excluir", storagePath: "Matemática/arquivo.pdf", fileId: "file-123" },
        });
        expect(resultado).toEqual({ success: true });
    });
});

describe("getAuthenticatedDownloadUrl", () => {
    it("devolve a URL assinada que a função gerou", async () => {
        invokeMock.mockResolvedValue({ data: { ok: true, url: "https://b2.example/signed" }, error: null });

        const url = await getAuthenticatedDownloadUrl("Matemática/arquivo.pdf");

        expect(url).toBe("https://b2.example/signed");
    });
});
