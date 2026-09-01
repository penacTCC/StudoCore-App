import { criarQueryBuilderMock } from "@/test/helpers/supabaseQueryMock";

jest.mock("@/repositories/supabase", () => ({
    supabase: { from: jest.fn() },
}));
jest.mock("@/services/backblaze", () => ({
    uploadFileToB2: jest.fn(),
    getAuthenticatedDownloadUrl: jest.fn(),
}));
jest.mock("@/services/visualizarArquivo", () => ({ tipoDoArquivo: jest.fn(() => "application/pdf") }));
jest.mock("expo-file-system", () => ({
    File: jest.fn(),
    Paths: { cache: "/cache" },
}));

import { supabase } from "@/repositories/supabase";
import { alternarArquivoPublico, buscarArquivosVisiveis, deletaRegistro } from "@/services/archives";
import type { ArquivoDetalhe } from "@/types/archives";

const fromMock = supabase.from as jest.Mock;

beforeEach(() => {
    fromMock.mockReset();
});

const arquivo = (over: Partial<ArquivoDetalhe>): ArquivoDetalhe => ({
    id: "a1",
    user_id: "u1",
    titulo: "arquivo.pdf",
    disciplina: "Matemática",
    storage_path: "x",
    backblaze_file_id: "f1",
    created_at: "2026-01-01T00:00:00Z",
    ...over,
});

describe("buscarArquivosVisiveis", () => {
    it("junta arquivos próprios e de grupo, sem repetir o mesmo arquivo duas vezes", async () => {
        const arquivoProprio = arquivo({ id: "1", created_at: "2026-01-01T00:00:00Z" });
        // O mesmo arquivo compartilhado num grupo do qual o usuário também é dono/membro
        // não pode virar dois cards.
        const arquivoDuplicadoNoGrupo = arquivo({ id: "1", created_at: "2026-01-01T00:00:00Z" });
        const arquivoDoGrupo = arquivo({ id: "2", created_at: "2026-01-02T00:00:00Z" });

        fromMock.mockImplementation((tabela: string) => {
            if (tabela === "membros") return criarQueryBuilderMock({ data: [{ grupo_id: "g1" }], error: null });
            if (tabela === "arquivos") return criarQueryBuilderMock({ data: [arquivoProprio], error: null });
            if (tabela === "arquivos_grupos") {
                return criarQueryBuilderMock({
                    data: [{ grupo_id: "g1", arquivos: [arquivoDuplicadoNoGrupo, arquivoDoGrupo] }],
                    error: null,
                });
            }
            throw new Error(`tabela inesperada: ${tabela}`);
        });

        const resultado = await buscarArquivosVisiveis("u1");

        expect(resultado).toHaveLength(2);
        expect(resultado.map((a) => a.id).sort()).toEqual(["1", "2"]);
    });

    it("ordena do mais recente para o mais antigo", async () => {
        const antigo = arquivo({ id: "antigo", created_at: "2026-01-01T00:00:00Z" });
        const novo = arquivo({ id: "novo", created_at: "2026-06-01T00:00:00Z" });

        fromMock.mockImplementation((tabela: string) => {
            if (tabela === "membros") return criarQueryBuilderMock({ data: [], error: null });
            if (tabela === "arquivos") return criarQueryBuilderMock({ data: [antigo, novo], error: null });
            throw new Error(`tabela inesperada: ${tabela}`);
        });

        const resultado = await buscarArquivosVisiveis("u1");

        expect(resultado.map((a) => a.id)).toEqual(["novo", "antigo"]);
    });

    it("não consulta arquivos_grupos quando o usuário não participa de nenhum grupo", async () => {
        const arquivosGruposMock = jest.fn();
        fromMock.mockImplementation((tabela: string) => {
            if (tabela === "membros") return criarQueryBuilderMock({ data: [], error: null });
            if (tabela === "arquivos") return criarQueryBuilderMock({ data: [], error: null });
            if (tabela === "arquivos_grupos") {
                arquivosGruposMock();
                return criarQueryBuilderMock({ data: [], error: null });
            }
            throw new Error(`tabela inesperada: ${tabela}`);
        });

        await buscarArquivosVisiveis("u1");

        expect(arquivosGruposMock).not.toHaveBeenCalled();
    });

    it("lida com o link de arquivos_grupos vindo como objeto único (não array)", async () => {
        const arquivoDoGrupo = arquivo({ id: "solo" });

        fromMock.mockImplementation((tabela: string) => {
            if (tabela === "membros") return criarQueryBuilderMock({ data: [{ grupo_id: "g1" }], error: null });
            if (tabela === "arquivos") return criarQueryBuilderMock({ data: [], error: null });
            if (tabela === "arquivos_grupos") {
                // O join do Supabase pode devolver um objeto solto em vez de array de 1 item.
                return criarQueryBuilderMock({ data: [{ grupo_id: "g1", arquivos: arquivoDoGrupo }], error: null });
            }
            throw new Error(`tabela inesperada: ${tabela}`);
        });

        const resultado = await buscarArquivosVisiveis("u1");

        expect(resultado).toHaveLength(1);
        expect(resultado[0].id).toBe("solo");
    });
});

describe("alternarArquivoPublico", () => {
    it("lança erro quando o banco recusa (ex.: RLS)", async () => {
        const updateMock = jest.fn(() => criarQueryBuilderMock({ error: { message: "not allowed" } }));
        fromMock.mockReturnValue({ update: updateMock });

        await expect(alternarArquivoPublico("a1", true)).rejects.toThrow("not allowed");
    });

    it("não lança nada quando a atualização funciona", async () => {
        const updateMock = jest.fn(() => criarQueryBuilderMock({ error: null }));
        fromMock.mockReturnValue({ update: updateMock });

        await expect(alternarArquivoPublico("a1", false)).resolves.toBeUndefined();
        expect(updateMock).toHaveBeenCalledWith({ publico: false });
    });
});

describe("deletaRegistro", () => {
    it("apaga a linha pelo id do arquivo", async () => {
        const deleteMock = jest.fn(() => criarQueryBuilderMock({ error: null }));
        fromMock.mockReturnValue({ delete: deleteMock });

        const resultado = await deletaRegistro({ arquivoId: "a1" });

        expect(deleteMock).toHaveBeenCalled();
        expect(resultado.error).toBeNull();
    });
});
