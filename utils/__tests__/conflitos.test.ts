import { encontrarConflitos, somarMinutosSemSobreposicao } from "@/utils/conflitos";

describe("encontrarConflitos", () => {
    it("não acusa conflito entre blocos que apenas se encostam", () => {
        const resultado = encontrarConflitos([
            { id: "a", horaInicio: "08:00", duracaoMin: 60 },
            { id: "b", horaInicio: "09:00", duracaoMin: 60 },
        ]);

        expect(resultado.size).toBe(0);
    });

    it("detecta sobreposição e devolve os minutos em ambas as direções", () => {
        const resultado = encontrarConflitos([
            { id: "a", horaInicio: "08:00", duracaoMin: 60 }, // 08:00–09:00
            { id: "b", horaInicio: "08:30", duracaoMin: 60 }, // 08:30–09:30
        ]);

        expect(resultado.get("a")).toEqual([{ comId: "b", minutos: 30 }]);
        expect(resultado.get("b")).toEqual([{ comId: "a", minutos: 30 }]);
    });

    it("acumula conflitos de um bloco contra vários outros", () => {
        const resultado = encontrarConflitos([
            { id: "a", horaInicio: "08:00", duracaoMin: 120 }, // 08:00–10:00
            { id: "b", horaInicio: "08:30", duracaoMin: 30 }, // 08:30–09:00
            { id: "c", horaInicio: "09:30", duracaoMin: 30 }, // 09:30–10:00
        ]);

        expect(resultado.get("a")).toEqual([
            { comId: "b", minutos: 30 },
            { comId: "c", minutos: 30 },
        ]);
        expect(resultado.has("b")).toBe(true);
        expect(resultado.has("c")).toBe(true);
    });

    it("sem itens não acusa nada", () => {
        expect(encontrarConflitos([]).size).toBe(0);
    });
});

describe("somarMinutosSemSobreposicao", () => {
    it("soma direto quando não há sobreposição", () => {
        const total = somarMinutosSemSobreposicao([
            { inicioMin: 0, duracaoMin: 30 },
            { inicioMin: 60, duracaoMin: 30 },
        ]);
        expect(total).toBe(60);
    });

    it("conta o tempo sobreposto uma única vez", () => {
        const total = somarMinutosSemSobreposicao([
            { inicioMin: 0, duracaoMin: 60 }, // 0–60
            { inicioMin: 30, duracaoMin: 60 }, // 30–90, 30min sobrepostos
        ]);
        expect(total).toBe(90); // não 120
    });

    it("funde uma cadeia de intervalos encadeados num único bloco", () => {
        const total = somarMinutosSemSobreposicao([
            { inicioMin: 0, duracaoMin: 30 }, // 0–30
            { inicioMin: 20, duracaoMin: 30 }, // 20–50
            { inicioMin: 45, duracaoMin: 30 }, // 45–75
        ]);
        expect(total).toBe(75);
    });

    it("não depende da ordem de entrada", () => {
        const total = somarMinutosSemSobreposicao([
            { inicioMin: 60, duracaoMin: 30 },
            { inicioMin: 0, duracaoMin: 30 },
        ]);
        expect(total).toBe(60);
    });

    it("lista vazia soma zero", () => {
        expect(somarMinutosSemSobreposicao([])).toBe(0);
    });
});
