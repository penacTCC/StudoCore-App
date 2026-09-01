import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    FATOR_MODO_TESTE,
    carregarModoTeste,
    definirModoTeste,
    escalarSegundos,
    fatorModoTeste,
    garantirFatorCarregado,
    modoTesteAtivo,
} from "@/services/modoTeste";

beforeEach(async () => {
    await AsyncStorage.clear();
    // Reseta o estado em memória do módulo para "modo normal, já carregado" antes de cada teste.
    await definirModoTeste(false);
});

describe("definirModoTeste / modoTesteAtivo / fatorModoTeste", () => {
    it("liga o modo de testes e aplica o fator 360x", async () => {
        await definirModoTeste(true);

        expect(modoTesteAtivo()).toBe(true);
        expect(fatorModoTeste()).toBe(FATOR_MODO_TESTE);
    });

    it("desliga o modo de testes e volta o fator para 1x", async () => {
        await definirModoTeste(true);
        await definirModoTeste(false);

        expect(modoTesteAtivo()).toBe(false);
        expect(fatorModoTeste()).toBe(1);
    });

    it("persiste a escolha no AsyncStorage", async () => {
        await definirModoTeste(true);
        expect(await AsyncStorage.getItem("@app_test_mode")).toBe("true");

        await definirModoTeste(false);
        expect(await AsyncStorage.getItem("@app_test_mode")).toBe("false");
    });
});

describe("carregarModoTeste", () => {
    it("lê 'true' persistido e liga o fator", async () => {
        await AsyncStorage.setItem("@app_test_mode", "true");

        const ligado = await carregarModoTeste();

        expect(ligado).toBe(true);
        expect(fatorModoTeste()).toBe(FATOR_MODO_TESTE);
    });

    it("sem nada persistido, assume modo normal", async () => {
        await AsyncStorage.clear();

        const ligado = await carregarModoTeste();

        expect(ligado).toBe(false);
        expect(fatorModoTeste()).toBe(1);
    });
});

describe("garantirFatorCarregado", () => {
    it("depois de definirModoTeste, não precisa reler o AsyncStorage — só devolve o fator em memória", async () => {
        await definirModoTeste(true);
        await AsyncStorage.setItem("@app_test_mode", "false"); // muda o storage por baixo, sem passar pelo módulo

        // jaCarregou já é true (definirModoTeste marca isso), então o valor de memória prevalece.
        expect(await garantirFatorCarregado()).toBe(FATOR_MODO_TESTE);
    });
});

describe("escalarSegundos", () => {
    it("no modo normal, não altera o valor", async () => {
        await definirModoTeste(false);
        expect(escalarSegundos(100)).toBe(100);
    });

    it("no modo de testes, aplica o fator 360x", async () => {
        await definirModoTeste(true);
        expect(escalarSegundos(10)).toBe(3600);
    });

    it("arredonda o resultado", async () => {
        await definirModoTeste(true);
        // Um valor fracionário de segundos reais (ex.: vindo de um cálculo de delta) não pode
        // gerar um total quebrado no banco.
        expect(escalarSegundos(1.5)).toBe(Math.round(1.5 * FATOR_MODO_TESTE));
    });

    it("trata segundos negativos ou não finitos como zero", () => {
        expect(escalarSegundos(-5)).toBe(0);
        expect(escalarSegundos(NaN)).toBe(0);
        expect(escalarSegundos(Infinity)).toBe(0);
    });

    it("zero permanece zero", () => {
        expect(escalarSegundos(0)).toBe(0);
    });
});
