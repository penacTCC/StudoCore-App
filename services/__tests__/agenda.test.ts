import { criarQueryBuilderMock } from "@/test/helpers/supabaseQueryMock";

jest.mock("@/repositories/supabase", () => ({
    supabase: { from: jest.fn() },
}));

import { supabase } from "@/repositories/supabase";
import { toast } from "@/services/toast";
import {
    datasDoIntervalo,
    diaSemanaDe,
    resolverAgendaDoDia,
} from "@/services/agenda";

const fromMock = supabase.from as jest.Mock;

beforeEach(() => {
    fromMock.mockReset();
});

describe("diaSemanaDe", () => {
    it("segunda-feira vira 0", () => {
        // 2024-01-01 é uma segunda-feira.
        expect(diaSemanaDe("2024-01-01")).toBe(0);
    });

    it("domingo vira 6 (convenção do banco, não a do JS)", () => {
        // 2024-01-07 é um domingo.
        expect(diaSemanaDe("2024-01-07")).toBe(6);
    });
});

describe("datasDoIntervalo", () => {
    it("um único dia devolve só ele", () => {
        expect(datasDoIntervalo("2024-01-01", "2024-01-01")).toEqual(["2024-01-01"]);
    });

    it("atravessa o fim do mês corretamente", () => {
        expect(datasDoIntervalo("2024-01-30", "2024-02-02")).toEqual([
            "2024-01-30",
            "2024-01-31",
            "2024-02-01",
            "2024-02-02",
        ]);
    });
});

describe("resolverAgendaDoDia — prioridade das fontes", () => {
    const blocoPlano = {
        id: "b1",
        hora_inicio: "10:00:00",
        duracao_min: 30,
        tipo: "estudo",
        materia_id: "m1",
        topico: null,
        notificar: false,
        antecedencia_min: null,
        dia_semana: null,
    };

    it("plano aplicado à data vence tudo, mesmo com plano fixado e rotina disponíveis", async () => {
        let chamada = 0;
        fromMock.mockImplementation(() => {
            chamada += 1;
            if (chamada === 1) {
                return criarQueryBuilderMock({
                    data: { id: "plano-data", nome: "Reta final", planos_blocos: [blocoPlano] },
                    error: null,
                });
            }
            throw new Error("não deveria consultar plano fixado nem rotina quando há plano da data");
        });

        const blocos = await resolverAgendaDoDia("u1", "2024-01-01");

        expect(blocos).toHaveLength(1);
        expect(blocos[0].origem).toBe("plano");
        expect(blocos[0].planoNome).toBe("Reta final");
    });

    it("cai para o plano fixado quando não há plano específico da data", async () => {
        let chamada = 0;
        fromMock.mockImplementation(() => {
            chamada += 1;
            if (chamada === 1) return criarQueryBuilderMock({ data: null, error: null });
            if (chamada === 2) {
                return criarQueryBuilderMock({
                    data: { id: "plano-fixado", nome: "Rotina fixa", planos_blocos: [blocoPlano] },
                    error: null,
                });
            }
            throw new Error("não deveria consultar a rotina quando há plano fixado");
        });

        const blocos = await resolverAgendaDoDia("u1", "2024-01-01");

        expect(blocos[0].planoNome).toBe("Rotina fixa");
    });

    it("cai para a rotina semanal quando não há plano nenhum", async () => {
        fromMock.mockImplementation(() =>
            criarQueryBuilderMock({ data: null, error: null })
        );
        // A 3ª chamada (rotina) precisa devolver algo diferente de null — reconfigura.
        fromMock
            .mockReturnValueOnce(criarQueryBuilderMock({ data: null, error: null }))
            .mockReturnValueOnce(criarQueryBuilderMock({ data: null, error: null }))
            .mockReturnValueOnce(
                criarQueryBuilderMock({
                    data: [{ ...blocoPlano, id: "r1", materia_id: "m2" }],
                    error: null,
                })
            );

        const blocos = await resolverAgendaDoDia("u1", "2024-01-01");

        expect(blocos).toHaveLength(1);
        expect(blocos[0].origem).toBe("rotina");
    });

    it("bloco de plano com dia_semana fixo só entra no dia certo", async () => {
        const blocoSoTerca = { ...blocoPlano, id: "b-terca", dia_semana: 1 }; // 1 = terça
        fromMock
            .mockReturnValueOnce(
                criarQueryBuilderMock({
                    data: { id: "plano-1", nome: "P", planos_blocos: [blocoSoTerca] },
                    error: null,
                })
            );

        // 2024-01-01 é segunda (dia_semana 0) — o bloco de terça não deve aparecer.
        const blocos = await resolverAgendaDoDia("u1", "2024-01-01");

        expect(blocos).toHaveLength(0);
    });

    it("avisa por toast quando a única fonte disponível (rotina) falha ao carregar", async () => {
        const spy = jest.spyOn(toast, "error").mockImplementation(() => {});
        fromMock
            .mockReturnValueOnce(criarQueryBuilderMock({ data: null, error: null }))
            .mockReturnValueOnce(criarQueryBuilderMock({ data: null, error: null }))
            .mockReturnValueOnce(criarQueryBuilderMock({ data: null, error: { message: "falhou" } }));

        await resolverAgendaDoDia("u1", "2024-01-01");

        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });
});
