jest.mock("expo-image-picker", () => ({
    launchImageLibraryAsync: jest.fn(),
    MediaTypeOptions: { Images: "Images" },
}));
jest.mock("@/services/supabaseStorage", () => ({ uploadArquivoBucket: jest.fn() }));

import * as ImagePicker from "expo-image-picker";
import { uploadArquivoBucket } from "@/services/supabaseStorage";
import { escolherEEnviarImagem } from "@/services/imagens";

const launchMock = ImagePicker.launchImageLibraryAsync as jest.Mock;
const uploadMock = uploadArquivoBucket as jest.Mock;

beforeEach(() => {
    launchMock.mockReset();
    uploadMock.mockReset();
});

describe("escolherEEnviarImagem", () => {
    it("devolve cancelado quando a pessoa fecha a galeria", async () => {
        launchMock.mockResolvedValue({ canceled: true });

        const resultado = await escolherEEnviarImagem();

        expect(resultado).toEqual({ uriLocal: null, publicUrl: null, error: null, cancelado: true });
        expect(uploadMock).not.toHaveBeenCalled();
    });

    it("devolve erro quando o asset escolhido não tem base64", async () => {
        launchMock.mockResolvedValue({ canceled: false, assets: [{ uri: "file://x.jpg", base64: null }] });

        const resultado = await escolherEEnviarImagem();

        expect(resultado.error).toBe("Não foi possível ler a imagem escolhida.");
        expect(resultado.uriLocal).toBe("file://x.jpg");
    });

    it("sobe a imagem pro bucket informado e devolve a URL pública", async () => {
        launchMock.mockResolvedValue({
            canceled: false,
            assets: [{ uri: "file://avatar.png", base64: "abc" }],
        });
        uploadMock.mockResolvedValue({ publicUrl: "https://x/avatar.png", error: null });

        const resultado = await escolherEEnviarImagem("avatares");

        expect(uploadMock).toHaveBeenCalledWith(
            expect.objectContaining({ base64: "abc", fileExt: "png", bucket: "avatares" })
        );
        expect(resultado).toEqual({
            uriLocal: "file://avatar.png",
            publicUrl: "https://x/avatar.png",
            error: null,
            cancelado: false,
        });
    });

    it("usa 'images' como bucket padrão quando nenhum é informado", async () => {
        launchMock.mockResolvedValue({ canceled: false, assets: [{ uri: "file://a.jpg", base64: "abc" }] });
        uploadMock.mockResolvedValue({ publicUrl: "https://x/a.jpg", error: null });

        await escolherEEnviarImagem();

        expect(uploadMock).toHaveBeenCalledWith(expect.objectContaining({ bucket: "images" }));
    });

    it("devolve erro quando o upload falha", async () => {
        launchMock.mockResolvedValue({ canceled: false, assets: [{ uri: "file://a.jpg", base64: "abc" }] });
        uploadMock.mockResolvedValue({ publicUrl: null, error: { message: "falhou" } });

        const resultado = await escolherEEnviarImagem();

        expect(resultado.publicUrl).toBeNull();
        expect(resultado.error).toBe("Não foi possível enviar a imagem.");
    });

    it("captura exceções inesperadas sem propagar", async () => {
        launchMock.mockRejectedValue(new Error("boom"));

        const resultado = await escolherEEnviarImagem();

        expect(resultado.error).toBe("Não foi possível selecionar a imagem.");
    });
});
