import { criarQueryBuilderMock } from "@/test/helpers/supabaseQueryMock";

jest.mock("@/repositories/supabase", () => ({
    supabase: { from: jest.fn() },
}));
jest.mock("@/services/toast", () => ({ toast: { error: jest.fn() } }));
jest.mock("@/services/notificacoesOfensiva", () => ({
    sincronizarLembreteDeOfensiva: jest.fn(),
}));

import { supabase } from "@/repositories/supabase";
import {
    buscarGamificacao,
    ofensivaVigente,
    registrarSessaoConcluida,
} from "@/services/gamificacao";
import { sincronizarLembreteDeOfensiva } from "@/services/notificacoesOfensiva";

const fromMock = supabase.from as jest.Mock;

beforeEach(() => {
    fromMock.mockReset();
    (sincronizarLembreteDeOfensiva as jest.Mock).mockReset();
    jest.useFakeTimers().setSystemTime(new Date("2026-08-15T15:00:00.000Z")); // meio-dia em UTC-3
});

afterEach(() => {
    jest.useRealTimers();
});

describe("ofensivaVigente", () => {
    it("vale o número gravado quando o último estudo foi hoje", () => {
        expect(ofensivaVigente({ ofensiva: 5, ultima_data_estudo: "2026-08-15" })).toBe(5);
    });

    it("vale o número gravado quando o último estudo foi ontem (ainda não quebrou)", () => {
        expect(ofensivaVigente({ ofensiva: 5, ultima_data_estudo: "2026-08-14" })).toBe(5);
    });

    it("zera quando o último estudo foi anteontem ou antes (sequência quebrada)", () => {
        expect(ofensivaVigente({ ofensiva: 5, ultima_data_estudo: "2026-08-13" })).toBe(0);
    });

    it("zera sem nenhum dia registrado", () => {
        expect(ofensivaVigente({ ofensiva: 5, ultima_data_estudo: null })).toBe(0);
        expect(ofensivaVigente(null)).toBe(0);
        expect(ofensivaVigente(undefined)).toBe(0);
    });

    it("não fica negativo quando a ofensiva gravada já é 0", () => {
        expect(ofensivaVigente({ ofensiva: 0, ultima_data_estudo: "2026-08-15" })).toBe(0);
    });
});

describe("buscarGamificacao", () => {
    it("devolve a ofensiva já recalculada pra vigência de hoje", async () => {
        fromMock.mockReturnValue(
            criarQueryBuilderMock({
                data: { user_id: "u1", ofensiva: 3, melhor_ofensiva: 10, ultima_data_estudo: "2026-08-13" },
                error: null,
            })
        );

        const resultado = await buscarGamificacao("u1");

        // Sequência quebrada (anteontem): o valor exposto vira 0 mesmo com 3 gravado no banco.
        expect(resultado?.ofensiva).toBe(0);
    });

    it("devolve null quando a busca falha", async () => {
        fromMock.mockReturnValue(criarQueryBuilderMock({ data: null, error: { message: "falhou" } }));

        expect(await buscarGamificacao("u1")).toBeNull();
    });
});

describe("registrarSessaoConcluida", () => {
    it("é idempotente: chamar de novo no mesmo dia não soma ofensiva extra", async () => {
        const atual = { user_id: "u1", ofensiva: 4, melhor_ofensiva: 4, ultima_data_estudo: "2026-08-15" };
        fromMock.mockReturnValue(criarQueryBuilderMock({ data: atual, error: null }));

        const resultado = await registrarSessaoConcluida("u1");

        expect(resultado).toEqual(atual);
        expect(sincronizarLembreteDeOfensiva).toHaveBeenCalledWith(atual);
        // Não upsertou — só o select de buscarGamificacao foi chamado.
        expect(fromMock).toHaveBeenCalledTimes(1);
    });

    it("soma +1 quando o último estudo foi ontem", async () => {
        const select = criarQueryBuilderMock({
            data: { user_id: "u1", ofensiva: 4, melhor_ofensiva: 6, ultima_data_estudo: "2026-08-14" },
            error: null,
        });
        const upsertResultado = { user_id: "u1", ofensiva: 5, melhor_ofensiva: 6, ultima_data_estudo: "2026-08-15" };
        const upsert = jest.fn(() => criarQueryBuilderMock({ data: upsertResultado, error: null }));

        fromMock.mockImplementation(() => ({ ...select, upsert }));

        const resultado = await registrarSessaoConcluida("u1");

        expect(upsert).toHaveBeenCalledWith(
            expect.objectContaining({ ofensiva: 5, melhor_ofensiva: 6, ultima_data_estudo: "2026-08-15" })
        );
        expect(resultado).toEqual(upsertResultado);
    });

    it("reseta para 1 quando pulou um dia", async () => {
        const select = criarQueryBuilderMock({
            data: { user_id: "u1", ofensiva: 4, melhor_ofensiva: 9, ultima_data_estudo: "2026-08-10" },
            error: null,
        });
        const upsert = jest.fn(() => criarQueryBuilderMock({ data: { ofensiva: 1 }, error: null }));
        fromMock.mockImplementation(() => ({ ...select, upsert }));

        await registrarSessaoConcluida("u1");

        // Melhor ofensiva não regride mesmo com o reset da atual.
        expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ ofensiva: 1, melhor_ofensiva: 9 }));
    });

    it("começa em 1 quando nunca estudou antes", async () => {
        const select = criarQueryBuilderMock({ data: null, error: null });
        const upsert = jest.fn(() => criarQueryBuilderMock({ data: { ofensiva: 1 }, error: null }));
        fromMock.mockImplementation(() => ({ ...select, upsert }));

        await registrarSessaoConcluida("u1");

        expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ ofensiva: 1, melhor_ofensiva: 1 }));
    });

    it("devolve null quando o upsert falha", async () => {
        const select = criarQueryBuilderMock({ data: null, error: null });
        const upsert = jest.fn(() => criarQueryBuilderMock({ data: null, error: { message: "falhou" } }));
        fromMock.mockImplementation(() => ({ ...select, upsert }));

        expect(await registrarSessaoConcluida("u1")).toBeNull();
    });
});
