const downloadFileAsyncMock = jest.fn();

jest.mock("expo-file-system", () => ({
    File: jest.fn().mockImplementation((_dir: any, nome: string) => ({ uri: `file:///cache/${nome}`, contentUri: `content://cache/${nome}` })),
    Paths: { cache: "file:///cache" },
}));
// `File.downloadFileAsync` é estático no módulo real; simulamos isso atribuindo depois do mock acima.
jest.mock("expo-intent-launcher", () => ({ startActivityAsync: jest.fn() }));
jest.mock("expo-sharing", () => ({ shareAsync: jest.fn() }));
jest.mock("@/services/backblaze", () => ({ getAuthenticatedDownloadUrl: jest.fn() }));
jest.mock("@/services/toast", () => ({ toast: { error: jest.fn() } }));

import { Platform } from "react-native";
import { File } from "expo-file-system";
import * as IntentLauncher from "expo-intent-launcher";
import * as Sharing from "expo-sharing";
import { getAuthenticatedDownloadUrl } from "@/services/backblaze";
import { toast } from "@/services/toast";
import { abrirArquivoDoBucket, tipoDoArquivo, urlAutenticadaDoArquivo } from "@/services/visualizarArquivo";

(File as unknown as jest.Mock & { downloadFileAsync: jest.Mock }).downloadFileAsync = downloadFileAsyncMock;

beforeEach(() => {
    jest.clearAllMocks();
    (getAuthenticatedDownloadUrl as jest.Mock).mockResolvedValue("https://exemplo/download?assinado=1");
});

describe("tipoDoArquivo", () => {
    it.each([
        ["prova.pdf", "application/pdf"],
        ["foto.png", "image/png"],
        ["foto.jpg", "image/jpeg"],
        ["foto.JPEG", "image/jpeg"],
        ["arquivo.xyz", "application/octet-stream"],
        ["sem-extensao", "application/octet-stream"],
    ])("%s -> %s", (nome, esperado) => {
        expect(tipoDoArquivo(nome)).toBe(esperado);
    });
});

describe("abrirArquivoDoBucket", () => {
    const definirPlataforma = (os: "android" | "ios") => {
        (Platform as any).OS = os;
    };

    it("no Android, baixa e abre com o intent launcher", async () => {
        definirPlataforma("android");
        downloadFileAsyncMock.mockResolvedValue({ exists: true });

        const resultado = await abrirArquivoDoBucket("sessoes/abc/prova.pdf");

        expect(resultado).toBe(true);
        expect(IntentLauncher.startActivityAsync).toHaveBeenCalledWith(
            "android.intent.action.VIEW",
            expect.objectContaining({ type: "application/pdf" })
        );
        expect(Sharing.shareAsync).not.toHaveBeenCalled();
    });

    it("no iOS, usa o compartilhamento nativo em vez do intent launcher", async () => {
        definirPlataforma("ios");
        downloadFileAsyncMock.mockResolvedValue({ exists: true });

        const resultado = await abrirArquivoDoBucket("sessoes/abc/prova.pdf");

        expect(resultado).toBe(true);
        expect(Sharing.shareAsync).toHaveBeenCalled();
        expect(IntentLauncher.startActivityAsync).not.toHaveBeenCalled();
    });

    it("devolve false e mostra um toast quando o download falha", async () => {
        definirPlataforma("android");
        downloadFileAsyncMock.mockResolvedValue({ exists: false });

        const resultado = await abrirArquivoDoBucket("sessoes/abc/prova.pdf");

        expect(resultado).toBe(false);
        expect(toast.error).toHaveBeenCalled();
    });

    it("devolve false quando pegar a URL autenticada lança (não deixa o erro subir pra tela)", async () => {
        (getAuthenticatedDownloadUrl as jest.Mock).mockRejectedValue(new Error("sem permissão"));

        const resultado = await abrirArquivoDoBucket("sessoes/abc/prova.pdf");

        expect(resultado).toBe(false);
        expect(toast.error).toHaveBeenCalled();
    });
});

describe("urlAutenticadaDoArquivo", () => {
    it("delega pro cliente do Backblaze", async () => {
        const resultado = await urlAutenticadaDoArquivo("sessoes/abc/prova.pdf");

        expect(getAuthenticatedDownloadUrl).toHaveBeenCalledWith("sessoes/abc/prova.pdf");
        expect(resultado).toBe("https://exemplo/download?assinado=1");
    });
});
