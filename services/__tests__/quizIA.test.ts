jest.mock("@/repositories/supabase", () => ({
    supabase: { functions: { invoke: jest.fn() } },
}));

import { supabase } from "@/repositories/supabase";
import { analisarAnexoSessao, gerarQuizIA } from "@/services/quizIA";

const invokeMock = supabase.functions.invoke as jest.Mock;

beforeEach(() => {
    invokeMock.mockReset();
});

describe("gerarQuizIA", () => {
    it("devolve as perguntas quando a Edge Function responde bem", async () => {
        invokeMock.mockResolvedValue({ data: { questions: [{ pergunta: "?" }] }, error: null });

        const resultado = await gerarQuizIA({ disciplina: "Matemática" } as any);

        expect(resultado).toEqual({ data: [{ pergunta: "?" }], error: null });
    });

    it("nunca lança: falha da IA vira { data: null, error } pro chamador aplicar o fallback fixo", async () => {
        invokeMock.mockResolvedValue({
            data: null,
            error: { message: "Edge Function returned a non-2xx status code", context: { json: async () => ({ detalhe: "matéria faltando" }) } },
        });

        const resultado = await gerarQuizIA({ disciplina: "" } as any);

        // O detalhe real (do corpo da resposta) prevalece sobre a mensagem genérica do invoke.
        expect(resultado).toEqual({ data: null, error: "matéria faltando" });
    });

    it("cai na mensagem genérica quando o corpo do erro não é JSON", async () => {
        invokeMock.mockResolvedValue({
            data: null,
            error: { message: "Edge Function returned a non-2xx status code", context: { json: async () => { throw new Error("not json"); } } },
        });

        const resultado = await gerarQuizIA({ disciplina: "Matemática" } as any);

        expect(resultado).toEqual({ data: null, error: "Edge Function returned a non-2xx status code" });
    });

    it("trata resposta sem 'questions' como erro em vez de devolver um quiz vazio", async () => {
        invokeMock.mockResolvedValue({ data: { questions: [] }, error: null });

        const resultado = await gerarQuizIA({ disciplina: "Matemática" } as any);

        expect(resultado.data).toBeNull();
        expect(resultado.error).toBe("Quiz vazio ou inválido.");
    });

    it("trata 'questions' que não é array como erro", async () => {
        invokeMock.mockResolvedValue({ data: { questions: "não é uma lista" }, error: null });

        const resultado = await gerarQuizIA({ disciplina: "Matemática" } as any);

        expect(resultado.data).toBeNull();
    });
});

describe("analisarAnexoSessao", () => {
    const params = { base64: "abc", mimeType: "application/pdf", disciplina: "Matemática", conteudo: null };

    it("devolve a análise completa, com defaults pros campos opcionais ausentes", async () => {
        invokeMock.mockResolvedValue({
            data: { questoesDetectadas: 5 },
            error: null,
        });

        const resultado = await analisarAnexoSessao(params);

        expect(resultado).toEqual({
            data: {
                questoesDetectadas: 5,
                questoesDiscursivas: 0,
                numerosObjetivas: null,
                resumo: null,
                proximoPasso: null,
                gabarito: null,
            },
            error: null,
        });
    });

    it("nunca lança: falha da IA vira { data: null, error } pro upload continuar sem análise", async () => {
        invokeMock.mockResolvedValue({
            data: null,
            error: { message: "Edge Function returned a non-2xx status code", context: { json: async () => ({ error: "mimeType inválido" }) } },
        });

        const resultado = await analisarAnexoSessao(params);

        expect(resultado).toEqual({ data: null, error: "mimeType inválido" });
    });

    it("rejeita resposta sem 'questoesDetectadas' numérico", async () => {
        invokeMock.mockResolvedValue({ data: { resumo: "algo" }, error: null });

        const resultado = await analisarAnexoSessao(params);

        expect(resultado).toEqual({ data: null, error: "Análise vazia ou inválida." });
    });
});
