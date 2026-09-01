jest.mock("@/repositories/supabase", () => ({
    supabase: { functions: { invoke: jest.fn() } },
}));
jest.mock("expo-crypto", () => ({
    CryptoDigestAlgorithm: { SHA1: "SHA-1" },
    digest: jest.fn(async () => new Uint8Array([0xab, 0xcd]).buffer),
}));

import { supabase } from "@/repositories/supabase";
import { deleteFileFromB2, getAuthenticatedDownloadUrl, uploadFileToB2 } from "@/services/backblaze";

const invokeMock = supabase.functions.invoke as jest.Mock;
const fetchMock = jest.fn();

beforeEach(() => {
    jest.clearAllMocks();
    (global as any).fetch = fetchMock;
});

describe("uploadFileToB2", () => {
    it("pede a URL de upload à Edge Function e envia o binário direto pro B2, com o hash SHA1 e o nome codificado (sem codificar as barras)", async () => {
        invokeMock.mockResolvedValue({
            data: { ok: true, uploadUrl: "https://b2.example/upload", authorizationToken: "tok-123" },
            error: null,
        });
        fetchMock.mockResolvedValue({ ok: true });

        const buffer = new Uint8Array([1, 2, 3]).buffer;
        await uploadFileToB2("Matemática/pasta com espaço/arquivo.pdf", "application/pdf", buffer);

        expect(invokeMock).toHaveBeenCalledWith("arquivos-b2", {
            body: { acao: "urlUpload", storagePath: "Matemática/pasta com espaço/arquivo.pdf" },
        });

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe("https://b2.example/upload");
        expect(init.headers.Authorization).toBe("tok-123");
        expect(init.headers["X-Bz-File-Name"]).toBe("Matem%C3%A1tica/pasta%20com%20espa%C3%A7o/arquivo.pdf");
        expect(init.headers["X-Bz-Content-Sha1"]).toBe("abcd");
        expect(init.headers["Content-Length"]).toBe("3");
    });

    it("lança erro quando o upload ao B2 falha (resposta não-ok)", async () => {
        invokeMock.mockResolvedValue({
            data: { ok: true, uploadUrl: "https://b2.example/upload", authorizationToken: "tok" },
            error: null,
        });
        fetchMock.mockResolvedValue({ ok: false });

        await expect(uploadFileToB2("a.pdf", "application/pdf", new ArrayBuffer(1))).rejects.toThrow(
            "Falha no upload"
        );
    });

    it("lança erro amigável quando a Edge Function falha", async () => {
        invokeMock.mockResolvedValue({ data: null, error: { message: "offline" } });

        await expect(uploadFileToB2("a.pdf", "application/pdf", new ArrayBuffer(1))).rejects.toThrow(
            "Não foi possível falar com o servidor de arquivos."
        );
    });

    it("lança o erro do servidor quando a função responde ok: false", async () => {
        invokeMock.mockResolvedValue({ data: { ok: false, error: "cota excedida" }, error: null });

        await expect(uploadFileToB2("a.pdf", "application/pdf", new ArrayBuffer(1))).rejects.toThrow(
            "cota excedida"
        );
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
