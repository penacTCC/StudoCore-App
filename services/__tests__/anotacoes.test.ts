import { criarQueryBuilderMock } from "@/test/helpers/supabaseQueryMock";

jest.mock("@/repositories/supabase", () => ({
    supabase: { from: jest.fn() },
}));

import { supabase } from "@/repositories/supabase";
import { buscarAnotacoes, salvarAnotacoes } from "@/services/anotacoes";

const fromMock = supabase.from as jest.Mock;

beforeEach(() => {
    fromMock.mockReset();
});

describe("buscarAnotacoes", () => {
    it("devolve os quatro campos vazios quando a sessão não tem nada gravado", async () => {
        fromMock.mockReturnValue(criarQueryBuilderMock({ data: null, error: null }));

        const anotacoes = await buscarAnotacoes("s1");

        expect(anotacoes).toEqual({ estudo: "", concentracao: "", pendente: "", proximoPasso: "" });
    });

    it("devolve vazio (em vez de propagar o erro) quando a consulta falha", async () => {
        fromMock.mockReturnValue(criarQueryBuilderMock({ data: null, error: { message: "falhou" } }));

        const anotacoes = await buscarAnotacoes("s1");

        expect(anotacoes.estudo).toBe("");
    });

    it("mapeia as colunas do banco pros campos da tela", async () => {
        fromMock.mockReturnValue(
            criarQueryBuilderMock({
                data: {
                    anotacao_estudo: "Cinemática",
                    anotacao_concentracao: null,
                    anotacao_pendente: "Revisar exercícios",
                    anotacao_proximo_passo: null,
                },
                error: null,
            })
        );

        const anotacoes = await buscarAnotacoes("s1");

        expect(anotacoes).toEqual({
            estudo: "Cinemática",
            concentracao: "",
            pendente: "Revisar exercícios",
            proximoPasso: "",
        });
    });
});

describe("salvarAnotacoes", () => {
    it("grava campo em branco como NULL, não como string vazia", async () => {
        const updateMock = jest.fn(() => criarQueryBuilderMock({ error: null }));
        fromMock.mockReturnValue({ update: updateMock });

        await salvarAnotacoes("s1", { estudo: "  ", concentracao: "Boa", pendente: "", proximoPasso: "   x  " });

        expect(updateMock).toHaveBeenCalledWith(
            expect.objectContaining({
                anotacao_estudo: null,
                anotacao_concentracao: "Boa",
                anotacao_pendente: null,
                anotacao_proximo_passo: "x",
            })
        );
    });

    it("devolve sucesso: false com mensagem amigável quando o banco falha", async () => {
        fromMock.mockReturnValue({ update: () => criarQueryBuilderMock({ error: { message: "erro" } }) });

        const resultado = await salvarAnotacoes("s1", { estudo: "", concentracao: "", pendente: "", proximoPasso: "" });

        expect(resultado).toEqual({ sucesso: false, erro: "Não foi possível salvar suas anotações." });
    });
});
