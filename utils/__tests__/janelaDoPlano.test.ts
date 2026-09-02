import { dataMinimaVisivel, dentroDaJanela } from "@/utils/janelaDoPlano";

describe("dataMinimaVisivel", () => {
    it("devolve null quando não há janela (plano ilimitado)", () => {
        expect(dataMinimaVisivel(null)).toBeNull();
        expect(dataMinimaVisivel(undefined)).toBeNull();
    });

    it("volta a quantidade de dias pedida, no formato aaaa-mm-dd", () => {
        jest.useFakeTimers().setSystemTime(new Date("2026-09-15T10:00:00"));
        expect(dataMinimaVisivel(30)).toBe("2026-08-16");
        expect(dataMinimaVisivel(7)).toBe("2026-09-08");
        jest.useRealTimers();
    });

    it("atravessa a virada de mês e de ano sem quebrar", () => {
        jest.useFakeTimers().setSystemTime(new Date("2026-01-05T10:00:00"));
        expect(dataMinimaVisivel(30)).toBe("2025-12-06");
        jest.useRealTimers();
    });
});

describe("dentroDaJanela", () => {
    const sessoes = [
        { id: "nova", data_sessao: "2026-09-14" as string | null },
        { id: "limite", data_sessao: "2026-08-16" as string | null },
        { id: "antiga", data_sessao: "2026-07-01" as string | null },
    ];

    it("mantém a lista intacta quando o plano é ilimitado", () => {
        expect(dentroDaJanela(sessoes, null, (s) => s.data_sessao)).toBe(sessoes);
    });

    it("corta o que é anterior à janela, mantendo o dia do limite", () => {
        jest.useFakeTimers().setSystemTime(new Date("2026-09-15T10:00:00"));

        const visiveis = dentroDaJanela(sessoes, 30, (s) => s.data_sessao);

        expect(visiveis.map((s) => s.id)).toEqual(["nova", "limite"]);
        jest.useRealTimers();
    });

    it("descarta item sem data em vez de deixá-lo passar", () => {
        jest.useFakeTimers().setSystemTime(new Date("2026-09-15T10:00:00"));

        const visiveis = dentroDaJanela([{ id: "x", data_sessao: null }], 30, (s) => s.data_sessao);

        expect(visiveis).toHaveLength(0);
        jest.useRealTimers();
    });
});
