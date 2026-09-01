import { criarQueryBuilderMock } from "@/test/helpers/supabaseQueryMock";

jest.mock("@/repositories/supabase", () => ({
    supabase: { from: jest.fn() },
}));
jest.mock("@/services/backblaze", () => ({ uploadFileToB2: jest.fn() }));
jest.mock("@/services/quizIA", () => ({ analisarAnexoSessao: jest.fn() }));
jest.mock("expo-file-system", () => ({ File: jest.fn() }));
jest.mock("base64-arraybuffer", () => ({ decode: jest.fn(() => new ArrayBuffer(1)) }));

import { supabase } from "@/repositories/supabase";
import { uploadFileToB2 } from "@/services/backblaze";
import { analisarAnexoSessao } from "@/services/quizIA";
import { File as FileClass } from "expo-file-system";
import {
    anexarFormularioASessao,
    buscarAnexo,
    buscarAnexosDaSessao,
    recalcularQuestoesExternas,
    removerAnexo,
    salvarCorrecaoAnexo,
} from "@/services/anexosSessao";
import type { AnexoSessao } from "@/types/anotacoes";

const fromMock = supabase.from as jest.Mock;

beforeEach(() => {
    jest.clearAllMocks();
});

const anexo = (over: Partial<AnexoSessao>): AnexoSessao =>
    ({
        id: "a1",
        sessao_id: "s1",
        user_id: "u1",
        titulo: "prova.pdf",
        disciplina: "Matemática",
        storage_path: "x",
        backblaze_file_id: "f1",
        created_at: "2026-01-01T00:00:00Z",
        questoes_detectadas: 10,
        questoes_discursivas: null,
        numeros_objetivas: null,
        resumo_ia: null,
        proximo_passo_ia: null,
        gabarito_ia: null,
        correcao: null,
        acertos_informados: null,
        ...over,
    }) as AnexoSessao;

describe("buscarAnexosDaSessao / buscarAnexo", () => {
    it("devolve lista vazia (não propaga o erro) quando a consulta falha", async () => {
        fromMock.mockReturnValue(criarQueryBuilderMock({ data: null, error: { message: "falhou" } }));

        expect(await buscarAnexosDaSessao("s1")).toEqual([]);
    });

    it("devolve null quando o anexo não existe", async () => {
        fromMock.mockReturnValue(criarQueryBuilderMock({ data: null, error: null }));

        expect(await buscarAnexo("inexistente")).toBeNull();
    });
});

describe("anexarFormularioASessao", () => {
    beforeEach(() => {
        (FileClass as unknown as jest.Mock).mockImplementation(() => ({
            base64Sync: async () => "base64conteudo",
        }));
    });

    it("pula a análise da IA quando o arquivo passa do limite de 15MB, mas mantém o anexo salvo", async () => {
        fromMock.mockReturnValue({
            insert: () => criarQueryBuilderMock({ data: anexo({}), error: null }),
        });
        (uploadFileToB2 as jest.Mock).mockResolvedValue({ json: async () => ({ fileId: "f1" }) });

        const resultado = await anexarFormularioASessao({
            userId: "u1",
            sessaoId: "s1",
            disciplina: "Matemática",
            arquivo: { uri: "file://x.pdf", name: "prova.pdf", mimeType: "application/pdf", size: 20 * 1024 * 1024 },
        });

        expect(resultado.anexo).not.toBeNull();
        expect(analisarAnexoSessao).not.toHaveBeenCalled();
        expect(resultado.erroAnalise).toBeUndefined();
    });

    it("analisa e grava o resultado da IA quando o arquivo está dentro do limite", async () => {
        let chamadasArquivos = 0;
        fromMock.mockImplementation((tabela: string) => {
            if (tabela !== "arquivos") throw new Error(`tabela inesperada: ${tabela}`);
            chamadasArquivos += 1;
            if (chamadasArquivos === 1) return { insert: () => criarQueryBuilderMock({ data: anexo({}), error: null }) };
            return { update: () => criarQueryBuilderMock({ data: anexo({ resumo_ia: "resumo" }), error: null }) };
        });
        (uploadFileToB2 as jest.Mock).mockResolvedValue({ json: async () => ({ fileId: "f1" }) });
        (analisarAnexoSessao as jest.Mock).mockResolvedValue({
            data: { questoesDetectadas: 10, questoesDiscursivas: 0, numerosObjetivas: [], resumo: "resumo", proximoPasso: "p", gabarito: {} },
            error: null,
        });

        const resultado = await anexarFormularioASessao({
            userId: "u1",
            sessaoId: "s1",
            disciplina: "Matemática",
            arquivo: { uri: "file://x.pdf", name: "prova.pdf", mimeType: "application/pdf", size: 1024 },
        });

        expect(resultado.anexo?.resumo_ia).toBe("resumo");
        expect(resultado.erroAnalise).toBeUndefined();
    });

    it("mantém o anexo salvo mesmo quando a análise da IA falha", async () => {
        let chamadasArquivos = 0;
        fromMock.mockImplementation((tabela: string) => {
            chamadasArquivos += 1;
            if (chamadasArquivos === 1) return { insert: () => criarQueryBuilderMock({ data: anexo({}), error: null }) };
            throw new Error("não deveria fazer update quando a IA não devolveu análise");
        });
        (uploadFileToB2 as jest.Mock).mockResolvedValue({ json: async () => ({ fileId: "f1" }) });
        (analisarAnexoSessao as jest.Mock).mockResolvedValue({ data: null, error: "IA indisponível" });

        const resultado = await anexarFormularioASessao({
            userId: "u1",
            sessaoId: "s1",
            disciplina: "Matemática",
            arquivo: { uri: "file://x.pdf", name: "prova.pdf", mimeType: "application/pdf", size: 1024 },
        });

        expect(resultado.anexo).not.toBeNull();
        expect(resultado.erroAnalise).toBe("IA indisponível");
    });

    it("devolve anexo: null com mensagem amigável quando o upload lança exceção", async () => {
        (uploadFileToB2 as jest.Mock).mockRejectedValue(new Error("rede caiu"));

        const resultado = await anexarFormularioASessao({
            userId: "u1",
            sessaoId: "s1",
            disciplina: "Matemática",
            arquivo: { uri: "file://x.pdf", name: "prova.pdf", mimeType: "application/pdf", size: 1024 },
        });

        expect(resultado.anexo).toBeNull();
        expect(resultado.erro).toBe("Não foi possível anexar o arquivo.");
    });
});

describe("recalcularQuestoesExternas", () => {
    it("só soma anexos já corrigidos — um anexo pendente não derruba a taxa de acerto", async () => {
        const corrigidoPorGrade = anexo({ id: "1", questoes_detectadas: 10, correcao: { "1": true, "2": false, "3": true } });
        const corrigidoPorTotal = anexo({ id: "2", questoes_detectadas: 5, correcao: null, acertos_informados: 4 });
        const naoCorrigido = anexo({ id: "3", questoes_detectadas: 20, correcao: null, acertos_informados: null });

        let updatePayload: any = null;
        fromMock.mockImplementation((tabela: string) => {
            if (tabela === "arquivos") {
                return criarQueryBuilderMock({ data: [corrigidoPorGrade, corrigidoPorTotal, naoCorrigido], error: null });
            }
            if (tabela === "sessoes_foco") {
                return {
                    update: (payload: any) => {
                        updatePayload = payload;
                        return criarQueryBuilderMock({ error: null });
                    },
                };
            }
            throw new Error(`tabela inesperada: ${tabela}`);
        });

        await recalcularQuestoesExternas("s1");

        // Só os dois corrigidos entram: 10 + 5 = 15 questões, 2 (grade) + 4 (total) = 6 acertos.
        expect(updatePayload).toEqual({ questoes_externas: 15, acertos_externos: 6 });
    });
});

describe("salvarCorrecaoAnexo / removerAnexo", () => {
    it("salvarCorrecaoAnexo grava a correção e recalcula os totais da sessão", async () => {
        let updateArquivoPayload: any = null;
        fromMock.mockImplementation((tabela: string) => {
            if (tabela === "arquivos") {
                return {
                    update: (payload: any) => {
                        updateArquivoPayload = payload;
                        return criarQueryBuilderMock({ error: null });
                    },
                    select: () => criarQueryBuilderMock({ data: [], error: null }),
                };
            }
            if (tabela === "sessoes_foco") return { update: () => criarQueryBuilderMock({ error: null }) };
            throw new Error(`tabela inesperada: ${tabela}`);
        });

        const resultado = await salvarCorrecaoAnexo({ anexoId: "a1", sessaoId: "s1", acertosInformados: 8 });

        expect(resultado.sucesso).toBe(true);
        expect(updateArquivoPayload).toEqual({ correcao: null, acertos_informados: 8 });
    });

    it("removerAnexo devolve erro amigável quando a exclusão falha, sem recalcular nada", async () => {
        const recalculoMock = jest.fn();
        fromMock.mockImplementation((tabela: string) => {
            if (tabela === "arquivos") return { delete: () => criarQueryBuilderMock({ error: { message: "falhou" } }) };
            recalculoMock();
            return criarQueryBuilderMock({ data: [], error: null });
        });

        const resultado = await removerAnexo("a1", "s1");

        expect(resultado).toEqual({ sucesso: false, erro: "Não foi possível remover o anexo." });
        expect(recalculoMock).not.toHaveBeenCalled();
    });
});
