import { criarQueryBuilderMock } from "@/test/helpers/supabaseQueryMock";

jest.mock("@/repositories/supabase", () => ({
    supabase: { from: jest.fn() },
}));
jest.mock("@/services/lembretes", () => ({
    sincronizarLembreteRotina: jest.fn(),
    cancelarLembreteRotina: jest.fn(),
}));

import { supabase } from "@/repositories/supabase";
import { cancelarLembreteRotina, sincronizarLembreteRotina } from "@/services/lembretes";
import {
    adiarBlocoRotina,
    buscarBlocoPorId,
    editarBlocoRotina,
    excluirBlocoRotina,
    moverBlocoRotina,
    salvarBlocoRotina,
} from "@/services/schedule";

const fromMock = supabase.from as jest.Mock;

beforeEach(() => {
    fromMock.mockReset();
    (sincronizarLembreteRotina as jest.Mock).mockReset();
    (cancelarLembreteRotina as jest.Mock).mockReset();
});

describe("salvarBlocoRotina", () => {
    it("agenda o lembrete do bloco recém-criado", async () => {
        const novoBloco = { id: "b1", hora_inicio: "08:00" };
        fromMock.mockReturnValue({ insert: jest.fn(() => criarQueryBuilderMock({ data: [novoBloco], error: null })) });

        await salvarBlocoRotina({ hora_inicio: "08:00" } as any);

        expect(sincronizarLembreteRotina).toHaveBeenCalledWith(novoBloco);
    });

    it("não tenta agendar lembrete quando o insert falha", async () => {
        fromMock.mockReturnValue({ insert: jest.fn(() => criarQueryBuilderMock({ data: null, error: { message: "erro" } })) });

        await salvarBlocoRotina({ hora_inicio: "08:00" } as any);

        expect(sincronizarLembreteRotina).not.toHaveBeenCalled();
    });
});

describe("editarBlocoRotina", () => {
    it("resincroniza o lembrete quando a edição dá certo", async () => {
        const builder = criarQueryBuilderMock({ data: [{}], error: null });
        fromMock.mockReturnValue({ update: jest.fn(() => builder) });

        const bloco = { id: "b1", hora_inicio: "09:00" } as any;
        await editarBlocoRotina(bloco);

        expect(sincronizarLembreteRotina).toHaveBeenCalledWith(bloco);
    });

    it("não resincroniza quando a edição falha", async () => {
        const builder = criarQueryBuilderMock({ data: null, error: { message: "erro" } });
        fromMock.mockReturnValue({ update: jest.fn(() => builder) });

        await editarBlocoRotina({ id: "b1" } as any);

        expect(sincronizarLembreteRotina).not.toHaveBeenCalled();
    });
});

describe("moverBlocoRotina", () => {
    it("atualiza o dia da semana e resincroniza o lembrete com o dado já atualizado", async () => {
        const bloco = { id: "b1", dia_semana: 2 };
        fromMock.mockReturnValue({ update: jest.fn(() => criarQueryBuilderMock({ data: bloco, error: null })) });

        await moverBlocoRotina("b1", 2);

        expect(sincronizarLembreteRotina).toHaveBeenCalledWith(bloco);
    });
});

describe("adiarBlocoRotina", () => {
    it("some com o erro original quando o bloco não é encontrado", async () => {
        fromMock.mockReturnValue({ select: jest.fn(() => criarQueryBuilderMock({ data: null, error: null })) });

        const resultado = await adiarBlocoRotina("b1", 15);

        expect(resultado.error).toBeInstanceOf(Error);
    });

    it("empurra o horário mantendo a duração, sem cruzar a meia-noite", async () => {
        const atual = { id: "b1", hora_inicio: "08:00", duracao_min: 30 };
        fromMock
            .mockReturnValueOnce({ select: jest.fn(() => criarQueryBuilderMock({ data: atual, error: null })) })
            .mockReturnValueOnce({ update: jest.fn(() => criarQueryBuilderMock({ data: null, error: null })) });

        await adiarBlocoRotina("b1", 15);

        expect(sincronizarLembreteRotina).toHaveBeenCalledWith(expect.objectContaining({ hora_inicio: "08:15" }));
    });

    it("dá a volta pro dia seguinte quando o adiamento cruza a meia-noite", async () => {
        const atual = { id: "b1", hora_inicio: "23:50", duracao_min: 30 };
        fromMock
            .mockReturnValueOnce({ select: jest.fn(() => criarQueryBuilderMock({ data: atual, error: null })) })
            .mockReturnValueOnce({ update: jest.fn(() => criarQueryBuilderMock({ data: null, error: null })) });

        await adiarBlocoRotina("b1", 20);

        expect(sincronizarLembreteRotina).toHaveBeenCalledWith(expect.objectContaining({ hora_inicio: "00:10" }));
    });

    it("aceita minutos negativos (antecipar), voltando pro dia anterior sem virar horário negativo", async () => {
        const atual = { id: "b1", hora_inicio: "00:10", duracao_min: 30 };
        fromMock
            .mockReturnValueOnce({ select: jest.fn(() => criarQueryBuilderMock({ data: atual, error: null })) })
            .mockReturnValueOnce({ update: jest.fn(() => criarQueryBuilderMock({ data: null, error: null })) });

        await adiarBlocoRotina("b1", -20);

        expect(sincronizarLembreteRotina).toHaveBeenCalledWith(expect.objectContaining({ hora_inicio: "23:50" }));
    });
});

describe("excluirBlocoRotina", () => {
    it("cancela o lembrete quando a exclusão dá certo", async () => {
        fromMock.mockReturnValue({ delete: jest.fn(() => criarQueryBuilderMock({ data: null, error: null })) });

        await excluirBlocoRotina("b1");

        expect(cancelarLembreteRotina).toHaveBeenCalledWith("b1");
    });

    it("não cancela lembrete quando a exclusão falha", async () => {
        fromMock.mockReturnValue({ delete: jest.fn(() => criarQueryBuilderMock({ data: null, error: { message: "erro" } })) });

        await excluirBlocoRotina("b1");

        expect(cancelarLembreteRotina).not.toHaveBeenCalled();
    });
});

describe("buscarBlocoPorId / buscarBlocosSemana (smoke)", () => {
    it("busca um bloco pelo id", async () => {
        const builder = criarQueryBuilderMock({ data: { id: "b1" }, error: null });
        fromMock.mockReturnValue({ select: jest.fn(() => builder) });

        const resultado = await buscarBlocoPorId("b1");

        expect(builder.eq).toHaveBeenCalledWith("id", "b1");
        expect(resultado.data).toEqual({ id: "b1" });
    });
});
