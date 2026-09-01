import { criarQueryBuilderMock } from "@/test/helpers/supabaseQueryMock";

jest.mock("@/repositories/supabase", () => ({
    supabase: { from: jest.fn() },
}));
jest.mock("@/services/toast", () => ({ toast: { error: jest.fn() } }));

import { supabase } from "@/repositories/supabase";
import {
    buscarMateriasComunidade,
    buscarMateriasUsuario,
    contarSessoesVinculadas,
    criarMateria,
    deletarMateria,
    normalizarNomeMateria,
} from "@/services/materias";
import type { Materia } from "@/types/materias";

const fromMock = supabase.from as jest.Mock;

beforeEach(() => {
    fromMock.mockReset();
});

describe("normalizarNomeMateria", () => {
    it("remove acentos, espaços e caixa para comparar nomes equivalentes", () => {
        expect(normalizarNomeMateria("Matemática")).toBe("matematica");
        expect(normalizarNomeMateria("  Educação   Física ")).toBe("educacaofisica");
        expect(normalizarNomeMateria("MATEMÁTICA")).toBe(normalizarNomeMateria("matemática"));
    });

    it("trata nomes com espaçamento diferente como o mesmo nome normalizado", () => {
        expect(normalizarNomeMateria("Língua Portuguesa")).toBe(normalizarNomeMateria("língua   portuguesa"));
    });
});

describe("criarMateria", () => {
    it("rejeita nome vazio sem chamar o banco", async () => {
        const resultado = await criarMateria("u1", "   ");

        expect(resultado).toEqual({ sucesso: false, erro: "O nome da matéria não pode estar vazio." });
        expect(fromMock).not.toHaveBeenCalled();
    });

    it("cria a matéria com o nome normalizado", async () => {
        const insertMock = jest.fn(() =>
            criarQueryBuilderMock({
                data: { id: "m1", usuario_id: "u1", nome_exibicao: "Matemática", nome_normalizado: "matematica", cor: null },
                error: null,
            })
        );
        fromMock.mockReturnValue({ insert: insertMock });

        const resultado = await criarMateria("u1", "Matemática");

        expect(insertMock).toHaveBeenCalledWith(
            expect.objectContaining({ usuario_id: "u1", nome_exibicao: "Matemática", nome_normalizado: "matematica" })
        );
        expect(resultado).toEqual({
            sucesso: true,
            materia: {
                id: "m1",
                usuarioId: "u1",
                nomeExibicao: "Matemática",
                nomeNormalizado: "matematica",
                isPadrao: false,
                cor: null,
            },
        });
    });

    it("traduz violação de UNIQUE (23505) em erro de duplicidade amigável", async () => {
        fromMock.mockReturnValue({
            insert: jest.fn(() => criarQueryBuilderMock({ data: null, error: { code: "23505", message: "duplicate key" } })),
        });

        const resultado = await criarMateria("u1", "Matemática");

        expect(resultado).toEqual({ sucesso: false, erro: "Essa matéria já existe na sua lista." });
    });
});

describe("contarSessoesVinculadas", () => {
    it("devolve a contagem do banco", async () => {
        fromMock.mockReturnValue(criarQueryBuilderMock({ count: 3, error: null }));

        expect(await contarSessoesVinculadas("u1", "Matemática")).toBe(3);
        expect(fromMock).toHaveBeenCalledWith("sessoes_foco");
    });

    it("devolve 0 quando a consulta falha, em vez de propagar o erro", async () => {
        fromMock.mockReturnValue(criarQueryBuilderMock({ count: null, error: { message: "boom" } }));

        expect(await contarSessoesVinculadas("u1", "Matemática")).toBe(0);
    });
});

describe("deletarMateria", () => {
    it("bloqueia a remoção quando há sessões vinculadas e forcar=false", async () => {
        fromMock.mockReturnValue(criarQueryBuilderMock({ count: 2, error: null })); // contarSessoesVinculadas

        const resultado = await deletarMateria("mat1", "u1", "Matemática", false);

        expect(resultado).toEqual({
            sucesso: false,
            erro: "Essa matéria possui 2 sessões de foco vinculadas.",
            sessoesVinculadas: 2,
        });
        // Não deve ter tentado o delete.
        expect(fromMock).toHaveBeenCalledTimes(1);
    });

    it("usa singular na mensagem quando há exatamente 1 sessão vinculada", async () => {
        fromMock.mockReturnValue(criarQueryBuilderMock({ count: 1, error: null }));

        const resultado = await deletarMateria("mat1", "u1", "Matemática", false);

        expect(resultado.erro).toBe("Essa matéria possui 1 sessão de foco vinculada.");
    });

    it("com forcar=true, ignora a contagem e deleta direto", async () => {
        const deleteMock = jest.fn(() => criarQueryBuilderMock({ error: null }));
        fromMock.mockReturnValue({ delete: deleteMock });

        const resultado = await deletarMateria("mat1", "u1", "Matemática", true);

        expect(resultado).toEqual({ sucesso: true });
        expect(fromMock).toHaveBeenCalledTimes(1);
        expect(fromMock).toHaveBeenCalledWith("materias_usuario");
    });

    it("sem sessões vinculadas, deleta normalmente", async () => {
        fromMock
            .mockReturnValueOnce(criarQueryBuilderMock({ count: 0, error: null })) // contarSessoesVinculadas
            .mockReturnValueOnce({ delete: jest.fn(() => criarQueryBuilderMock({ error: null })) });

        const resultado = await deletarMateria("mat1", "u1", "Matemática", false);

        expect(resultado).toEqual({ sucesso: true });
    });
});

describe("buscarMateriasUsuario", () => {
    it("mapeia as linhas do banco, marcando isPadrao quando usuario_id é null", async () => {
        fromMock.mockReturnValue(
            criarQueryBuilderMock({
                data: [
                    { id: "1", usuario_id: null, nome_exibicao: "Física", nome_normalizado: "fisica", cor: "#fff" },
                    { id: "2", usuario_id: "u1", nome_exibicao: "Química", nome_normalizado: "quimica", cor: null },
                ],
                error: null,
            })
        );

        const resultado = await buscarMateriasUsuario("u1");

        expect(resultado).toEqual([
            { id: "1", usuarioId: undefined, nomeExibicao: "Física", nomeNormalizado: "fisica", isPadrao: true, cor: "#fff" },
            { id: "2", usuarioId: "u1", nomeExibicao: "Química", nomeNormalizado: "quimica", isPadrao: false, cor: null },
        ]);
    });

    it("devolve lista vazia (sem lançar) quando a consulta falha", async () => {
        fromMock.mockReturnValue(criarQueryBuilderMock({ data: null, error: { message: "boom" } }));

        expect(await buscarMateriasUsuario("u1")).toEqual([]);
    });
});

describe("buscarMateriasComunidade", () => {
    const materiasDoUsuario: Materia[] = [
        { id: "x", usuarioId: "u1", nomeExibicao: "Matemática", nomeNormalizado: "matematica", isPadrao: false, cor: "#000" },
    ];

    it("exclui matérias que o usuário já tem e deduplica por nome normalizado", async () => {
        fromMock.mockReturnValue(
            criarQueryBuilderMock({
                data: [
                    { id: "a", usuario_id: "outro", nome_exibicao: "Matemática", nome_normalizado: "matematica", cor: null }, // já tem
                    { id: "b", usuario_id: "outro", nome_exibicao: "História", nome_normalizado: "historia", cor: null },
                    { id: "c", usuario_id: "outro2", nome_exibicao: "história", nome_normalizado: "historia", cor: null }, // duplicada
                ],
                error: null,
            })
        );

        const resultado = await buscarMateriasComunidade("u1", materiasDoUsuario);

        expect(resultado).toHaveLength(1);
        expect(resultado[0].nomeExibicao).toBe("História");
    });
});
