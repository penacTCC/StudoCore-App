import {
    formatarDuracao,
    paraDataISO,
    dentroDoNaoPerturbar,
    paraTimestampMs,
    segundosDesde,
    tempoAoVivoDoMembro,
    tempoAoVivoDaSessao,
    pegarSegundaDaSemana,
    somarSemanas,
    somarDias,
    pegarDatasDaSemana,
    pegarDiaDaSemanaAtual,
    pegarIntervaloSemanaAtual,
    pegarDiasDaSemana,
    formatarIntervaloSemana,
} from "@/utils/tempo";

describe("formatarDuracao", () => {
    it("minutos puros abaixo de 1h", () => {
        expect(formatarDuracao(45)).toBe("45m");
    });

    it("hora cheia sem minutos", () => {
        expect(formatarDuracao(120)).toBe("2h");
    });

    it("hora com minutos, minutos com 2 dígitos", () => {
        expect(formatarDuracao(90)).toBe("1h30");
        expect(formatarDuracao(65)).toBe("1h05");
    });
});

describe("paraDataISO", () => {
    it("formata no fuso local, não em UTC", () => {
        // 23:30 UTC de 1º de agosto: em UTC-3 já é 20:30 do mesmo dia, mas o ponto
        // deste teste é que a função usa os getters locais (getFullYear/getMonth/getDate),
        // não toISOString() — o resultado depende do fuso da máquina que roda o teste.
        const data = new Date(2026, 7, 1); // mês local, sem ambiguidade de fuso
        expect(paraDataISO(data)).toBe("2026-08-01");
    });

    it("preenche mês e dia com zero à esquerda", () => {
        expect(paraDataISO(new Date(2026, 0, 5))).toBe("2026-01-05");
    });
});

describe("dentroDoNaoPerturbar", () => {
    it("janela normal (não cruza meia-noite)", () => {
        expect(dentroDoNaoPerturbar(13, 0, "12:00", "14:00")).toBe(true);
        expect(dentroDoNaoPerturbar(15, 0, "12:00", "14:00")).toBe(false);
    });

    it("janela que cruza a meia-noite (22:00–07:00)", () => {
        expect(dentroDoNaoPerturbar(23, 0, "22:00", "07:00")).toBe(true); // 23h, dentro
        expect(dentroDoNaoPerturbar(3, 0, "22:00", "07:00")).toBe(true); // 3h da madrugada, dentro
        expect(dentroDoNaoPerturbar(12, 0, "22:00", "07:00")).toBe(false); // meio-dia, fora
    });

    it("limite inicial é inclusivo, limite final é exclusivo", () => {
        expect(dentroDoNaoPerturbar(22, 0, "22:00", "07:00")).toBe(true);
        expect(dentroDoNaoPerturbar(7, 0, "22:00", "07:00")).toBe(false);
    });
});

describe("paraTimestampMs", () => {
    it("respeita o fuso quando o timestamp já traz um (Z)", () => {
        expect(paraTimestampMs("2026-08-01T12:00:00Z")).toBe(Date.parse("2026-08-01T12:00:00Z"));
    });

    it("respeita offset explícito", () => {
        expect(paraTimestampMs("2026-08-01T12:00:00+00:00")).toBe(Date.parse("2026-08-01T12:00:00Z"));
    });

    it("assume UTC quando não há marcador de fuso (timestamp without time zone)", () => {
        // Sem isso, o JS leria como horário local e o cronômetro nasceria negativo.
        expect(paraTimestampMs("2026-08-01 12:00:00")).toBe(Date.parse("2026-08-01T12:00:00Z"));
    });

    it("nulo/vazio devolve null", () => {
        expect(paraTimestampMs(null)).toBeNull();
        expect(paraTimestampMs(undefined)).toBeNull();
        expect(paraTimestampMs("")).toBeNull();
    });

    it("valor inválido devolve null em vez de NaN", () => {
        expect(paraTimestampMs("isso não é uma data")).toBeNull();
    });
});

describe("segundosDesde", () => {
    afterEach(() => jest.useRealTimers());

    it("calcula o tempo decorrido a partir de agora", () => {
        jest.useFakeTimers().setSystemTime(new Date("2026-08-01T12:00:30Z"));
        expect(segundosDesde("2026-08-01T12:00:00Z")).toBe(30);
    });

    it("nunca devolve negativo (timestamp no futuro)", () => {
        jest.useFakeTimers().setSystemTime(new Date("2026-08-01T12:00:00Z"));
        expect(segundosDesde("2026-08-01T12:05:00Z")).toBe(0);
    });

    it("timestamp nulo devolve 0", () => {
        expect(segundosDesde(null)).toBe(0);
    });
});

describe("tempoAoVivoDoMembro", () => {
    afterEach(() => jest.useRealTimers());

    it("membro fora de 'ativo' devolve só o acumulado congelado", () => {
        const tempo = tempoAoVivoDoMembro({ tempo_segundos: 120, status: "pausado", ultimo_inicio: "2026-08-01T12:00:00Z" });
        expect(tempo).toBe(120);
    });

    it("membro ativo soma o acumulado com o trecho desde ultimo_inicio", () => {
        jest.useFakeTimers().setSystemTime(new Date("2026-08-01T12:01:00Z"));
        const tempo = tempoAoVivoDoMembro({ tempo_segundos: 60, status: "ativo", ultimo_inicio: "2026-08-01T12:00:00Z" });
        expect(tempo).toBe(120); // 60 acumulado + 60s decorridos
    });

    it("para no instante em que a sala fechou, não continua contando", () => {
        jest.useFakeTimers().setSystemTime(new Date("2026-08-01T13:00:00Z")); // 1h depois
        const tempo = tempoAoVivoDoMembro(
            { tempo_segundos: 0, status: "ativo", ultimo_inicio: "2026-08-01T12:00:00Z" },
            { sessaoConcluidaEm: "2026-08-01T12:05:00Z" } // sala fechou 5min após o início
        );
        expect(tempo).toBe(5 * 60);
    });

    it("acima do corte de abandono (12h), descarta o trecho inteiro — não é estudo real", () => {
        jest.useFakeTimers().setSystemTime(new Date("2026-08-02T01:00:01Z")); // 13h depois
        const tempo = tempoAoVivoDoMembro({ tempo_segundos: 300, status: "ativo", ultimo_inicio: "2026-08-01T12:00:00Z" });
        expect(tempo).toBe(300); // só o acumulado, sem somar o trecho fugitivo
    });

    it("sem ultimo_inicio, devolve só o acumulado", () => {
        const tempo = tempoAoVivoDoMembro({ tempo_segundos: 42, status: "ativo", ultimo_inicio: null });
        expect(tempo).toBe(42);
    });
});

describe("tempoAoVivoDaSessao", () => {
    afterEach(() => jest.useRealTimers());

    it("sessão concluída devolve o valor gravado, sem continuar andando", () => {
        const tempo = tempoAoVivoDaSessao({ tempo_minutos: 10, status: "ativo", concluido_em: "2026-08-01T12:00:00Z", ultimo_inicio: "2026-08-01T11:00:00Z" });
        expect(tempo).toBe(10 * 60);
    });

    it("sessão ativa soma o acumulado (em minutos) com o trecho decorrido", () => {
        jest.useFakeTimers().setSystemTime(new Date("2026-08-01T12:00:30Z"));
        const tempo = tempoAoVivoDaSessao({ tempo_minutos: 5, status: "ativo", concluido_em: null, ultimo_inicio: "2026-08-01T12:00:00Z" });
        expect(tempo).toBe(5 * 60 + 30);
    });

    it("sessão 'ativa' há mais de 12h é tratada como abandonada, não como 40h de estudo", () => {
        jest.useFakeTimers().setSystemTime(new Date("2026-08-02T01:00:01Z"));
        const tempo = tempoAoVivoDaSessao({ tempo_minutos: 5, status: "ativo", concluido_em: null, ultimo_inicio: "2026-08-01T12:00:00Z" });
        expect(tempo).toBe(5 * 60);
    });
});

describe("semana / dias", () => {
    it("pegarSegundaDaSemana acha a segunda mesmo caindo num domingo", () => {
        const domingo = new Date(2026, 7, 2); // 2026-08-02 é domingo
        const segunda = pegarSegundaDaSemana(domingo);
        expect(paraDataISO(segunda)).toBe("2026-07-27");
    });

    it("pegarSegundaDaSemana mantém a própria segunda-feira", () => {
        const segundaFeira = new Date(2026, 7, 3); // 2026-08-03 é segunda
        expect(paraDataISO(pegarSegundaDaSemana(segundaFeira))).toBe("2026-08-03");
    });

    it("somarSemanas avança/retrocede em blocos de 7 dias", () => {
        const segunda = new Date(2026, 7, 3);
        expect(paraDataISO(somarSemanas(segunda, 1))).toBe("2026-08-10");
        expect(paraDataISO(somarSemanas(segunda, -1))).toBe("2026-07-27");
    });

    it("somarDias cruza o fim do mês corretamente", () => {
        expect(paraDataISO(somarDias(new Date(2026, 6, 30), 3))).toBe("2026-08-02");
    });

    it("pegarDatasDaSemana devolve as 7 datas ISO segunda a domingo", () => {
        const segunda = new Date(2026, 7, 3);
        expect(pegarDatasDaSemana(segunda)).toEqual([
            "2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06",
            "2026-08-07", "2026-08-08", "2026-08-09",
        ]);
    });

    it("pegarDiaDaSemanaAtual usa a convenção 0=segunda", () => {
        jest.useFakeTimers().setSystemTime(new Date(2026, 7, 3)); // segunda
        expect(pegarDiaDaSemanaAtual()).toBe(0);
        jest.useFakeTimers().setSystemTime(new Date(2026, 7, 9)); // domingo
        expect(pegarDiaDaSemanaAtual()).toBe(6);
        jest.useRealTimers();
    });

    it("pegarIntervaloSemanaAtual devolve segunda a domingo da semana corrente", () => {
        jest.useFakeTimers().setSystemTime(new Date(2026, 7, 5)); // quarta, 2026-08-05
        expect(pegarIntervaloSemanaAtual()).toEqual({ inicio: "2026-08-03", fim: "2026-08-09" });
        jest.useRealTimers();
    });

    it("pegarDiasDaSemana devolve letra, número e diaSemana (convenção do banco) pros 7 dias", () => {
        const dias = pegarDiasDaSemana(new Date(2026, 7, 3)); // segunda
        expect(dias).toHaveLength(7);
        expect(dias[0]).toMatchObject({ letra: "S", dataISO: "2026-08-03", diaSemana: 0 });
        expect(dias[6]).toMatchObject({ dataISO: "2026-08-09", diaSemana: 6 });
    });
});

describe("formatarIntervaloSemana", () => {
    it("mesmo mês usa formato curto", () => {
        const segunda = new Date(2026, 7, 3); // 3–9 de agosto, sem virar o mês
        expect(formatarIntervaloSemana(segunda)).toBe("3–9 de agosto");
    });

    it("virando o mês, escreve o mês nas duas pontas", () => {
        const segunda = new Date(2026, 6, 27); // segunda 27/jul, domingo 2/ago
        expect(formatarIntervaloSemana(segunda)).toBe("27 de julho – 2 de agosto");
    });
});
