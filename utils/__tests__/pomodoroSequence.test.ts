import { gerarSequenciaPomodoro, posicaoNaFila, inicioDoItemMs } from "@/utils/pomodoroSequence";

describe("gerarSequenciaPomodoro", () => {
    it("alterna estudo e descanso, sem descanso depois do último pomodoro", () => {
        const sequencia = gerarSequenciaPomodoro({
            qtdPomodoros: 3,
            duracaoPomodoroMin: 25,
            inserirDescansos: true,
            descansoCurtoMin: 5,
            descansoLongoMin: 15,
            ciclosAteLongo: 4,
        });

        expect(sequencia.map((i) => i.tipo)).toEqual(["estudo", "descanso", "estudo", "descanso", "estudo"]);
        expect(sequencia[sequencia.length - 1].tipo).toBe("estudo");
    });

    it("marca descanso longo a cada N ciclos", () => {
        const sequencia = gerarSequenciaPomodoro({
            qtdPomodoros: 4,
            duracaoPomodoroMin: 25,
            inserirDescansos: true,
            descansoCurtoMin: 5,
            descansoLongoMin: 15,
            ciclosAteLongo: 2,
        });

        const descansos = sequencia.filter((i) => i.tipo === "descanso");
        // 2º descanso (após o 2º pomodoro) é longo; o 1º é curto.
        expect(descansos[0]).toMatchObject({ duracaoMin: 5, ehLongo: false });
        expect(descansos[1]).toMatchObject({ duracaoMin: 15, ehLongo: true });
    });

    it("sem inserirDescansos, só gera os blocos de estudo", () => {
        const sequencia = gerarSequenciaPomodoro({
            qtdPomodoros: 3,
            duracaoPomodoroMin: 25,
            inserirDescansos: false,
            descansoCurtoMin: 5,
            descansoLongoMin: 15,
            ciclosAteLongo: 4,
        });

        expect(sequencia).toHaveLength(3);
        expect(sequencia.every((i) => i.tipo === "estudo")).toBe(true);
    });

    it("um único pomodoro não gera descanso nenhum", () => {
        const sequencia = gerarSequenciaPomodoro({
            qtdPomodoros: 1,
            duracaoPomodoroMin: 25,
            inserirDescansos: true,
            descansoCurtoMin: 5,
            descansoLongoMin: 15,
            ciclosAteLongo: 4,
        });

        expect(sequencia).toEqual([{ tipo: "estudo", duracaoMin: 25 }]);
    });
});

describe("posicaoNaFila", () => {
    const fila = [
        { tipo: "estudo", duracaoMin: 25 } as any,
        { tipo: "descanso", duracaoMin: 5 } as any,
        { tipo: "estudo", duracaoMin: 25 } as any,
    ];
    const inicioMs = 1_000_000;

    it("fila vazia já termina imediatamente", () => {
        expect(posicaoNaFila([], inicioMs, inicioMs)).toEqual({ indice: 0, restanteSeg: 0, terminou: true });
    });

    it("no início, está no primeiro item com o tempo todo restante", () => {
        const posicao = posicaoNaFila(fila, inicioMs, inicioMs);
        expect(posicao).toEqual({ indice: 0, restanteSeg: 25 * 60, terminou: false });
    });

    it("avança para o item seguinte quando o tempo do atual passa", () => {
        const agora = inicioMs + 25 * 60 * 1000 + 60_000; // 25min de estudo + 1min de descanso
        const posicao = posicaoNaFila(fila, inicioMs, agora);
        expect(posicao.indice).toBe(1);
        expect(posicao.restanteSeg).toBe(4 * 60);
        expect(posicao.terminou).toBe(false);
    });

    it("depois do fim da fila, fica no último item com restante negativo e terminou=true", () => {
        const totalSeg = (25 + 5 + 25) * 60;
        const agora = inicioMs + (totalSeg + 30) * 1000;
        const posicao = posicaoNaFila(fila, inicioMs, agora);
        expect(posicao.indice).toBe(fila.length - 1);
        expect(posicao.restanteSeg).toBe(-30);
        expect(posicao.terminou).toBe(true);
    });

    it("reabrir o app horas depois cai no ponto certo (não depende de nada além do relógio)", () => {
        const agora = inicioMs + 26 * 60 * 1000; // 1min dentro do descanso
        const posicao = posicaoNaFila(fila, inicioMs, agora);
        expect(posicao.indice).toBe(1);
        expect(posicao.restanteSeg).toBe(4 * 60);
    });
});

describe("inicioDoItemMs", () => {
    const fila = [
        { tipo: "estudo", duracaoMin: 25 } as any,
        { tipo: "descanso", duracaoMin: 5 } as any,
        { tipo: "estudo", duracaoMin: 25 } as any,
    ];
    const inicioMs = 1_000_000;

    it("o primeiro item começa junto com o início da fila", () => {
        expect(inicioDoItemMs(fila, inicioMs, 0)).toBe(inicioMs);
    });

    it("desloca pelo tempo acumulado dos itens anteriores", () => {
        expect(inicioDoItemMs(fila, inicioMs, 1)).toBe(inicioMs + 25 * 60 * 1000);
        expect(inicioDoItemMs(fila, inicioMs, 2)).toBe(inicioMs + (25 + 5) * 60 * 1000);
    });
});
