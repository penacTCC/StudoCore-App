jest.mock("@/repositories/supabase", () => ({
    supabase: { rpc: jest.fn() },
}));

import { supabase } from "@/repositories/supabase";
import { buscarRankingHorasMembros } from "@/services/ranking";

const rpcMock = supabase.rpc as jest.Mock;

beforeEach(() => {
    rpcMock.mockReset();
});

describe("buscarRankingHorasMembros", () => {
    it("devolve lista vazia sem groupId, sem nem chamar o banco", async () => {
        const resultado = await buscarRankingHorasMembros(undefined, "total");

        expect(resultado).toEqual([]);
        expect(rpcMock).not.toHaveBeenCalled();
    });

    it("chama a RPC de ranking cruzando grupo e período", async () => {
        rpcMock.mockResolvedValue({ data: [{ user_id: "u1", horas: 10 }], error: null });

        const resultado = await buscarRankingHorasMembros("g1", "semanal");

        expect(rpcMock).toHaveBeenCalledWith("ranking_horas_membros_grupo", {
            p_grupo_id: "g1",
            p_periodo: "semanal",
        });
        expect(resultado).toEqual([{ user_id: "u1", horas: 10 }]);
    });

    it("devolve lista vazia (não lança) quando a RPC falha", async () => {
        rpcMock.mockResolvedValue({ data: null, error: { message: "erro" } });

        const resultado = await buscarRankingHorasMembros("g1", "total");

        expect(resultado).toEqual([]);
    });

    it("devolve lista vazia quando a RPC não retorna erro mas também não retorna dado", async () => {
        rpcMock.mockResolvedValue({ data: null, error: null });

        const resultado = await buscarRankingHorasMembros("g1", "total");

        expect(resultado).toEqual([]);
    });
});
