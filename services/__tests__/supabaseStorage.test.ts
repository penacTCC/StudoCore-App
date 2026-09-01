import { criarStorageBuilderMock } from "@/test/helpers/supabaseQueryMock";

jest.mock("@/repositories/supabase", () => ({
    supabase: { storage: { from: jest.fn() } },
}));

import { supabase } from "@/repositories/supabase";
import { uploadArquivoBucket } from "@/services/supabaseStorage";

const storageFromMock = supabase.storage.from as jest.Mock;

beforeEach(() => {
    storageFromMock.mockReset();
});

describe("uploadArquivoBucket", () => {
    it("devolve a URL pública depois de subir o arquivo", async () => {
        const builder = criarStorageBuilderMock({ error: null });
        (builder.getPublicUrl as jest.Mock).mockReturnValue({ data: { publicUrl: "https://exemplo/arquivo.jpg" } });
        storageFromMock.mockReturnValue(builder);

        const resultado = await uploadArquivoBucket({
            bucket: "avatars",
            fileName: "foto.jpg",
            base64: "abc123",
            fileExt: "jpg",
        } as any);

        expect(resultado).toEqual({ publicUrl: "https://exemplo/arquivo.jpg", error: null });
    });

    it("devolve o erro sem pedir a URL pública quando o upload falha", async () => {
        const builder = criarStorageBuilderMock({ error: { message: "upload falhou" } });
        storageFromMock.mockReturnValue(builder);

        const resultado = await uploadArquivoBucket({
            bucket: "avatars",
            fileName: "foto.jpg",
            base64: "abc123",
            fileExt: "jpg",
        } as any);

        expect(resultado).toEqual({ publicUrl: null, error: { message: "upload falhou" } });
        expect(builder.getPublicUrl).not.toHaveBeenCalled();
    });
});
