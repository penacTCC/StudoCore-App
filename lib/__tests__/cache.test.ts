import {
    buscarNoCache,
    lerCache,
    definirCache,
    semearCache,
    invalidarCache,
    limparCache,
    observarCache,
    buscaTravada,
    TEMPO_LIMITE_BUSCA,
} from "@/lib/cache";

// Cada teste usa uma chave própria (uuid incremental) pra não vazar estado do módulo,
// que é compartilhado (Map em memória) entre todos os testes do arquivo.
let contador = 0;
const novaChave = () => `teste:${++contador}`;

describe("buscarNoCache", () => {
    it("grava o resultado e marca buscando=false ao terminar", async () => {
        const chave = novaChave();
        await buscarNoCache(chave, async () => "valor");

        const estado = lerCache(chave);
        expect(estado.dados).toBe("valor");
        expect(estado.buscando).toBe(false);
        expect(estado.erro).toBeNull();
    });

    it("três chamadas simultâneas com a mesma chave compartilham UMA busca (dedupe)", async () => {
        const chave = novaChave();
        const buscar = jest.fn(async () => "valor");

        await Promise.all([
            buscarNoCache(chave, buscar),
            buscarNoCache(chave, buscar),
            buscarNoCache(chave, buscar),
        ]);

        expect(buscar).toHaveBeenCalledTimes(1);
    });

    it("uma falha de rede preserva o dado anterior, só marca o erro", async () => {
        const chave = novaChave();
        await buscarNoCache(chave, async () => "dado bom");

        await expect(buscarNoCache(chave, async () => {
            throw new Error("rede caiu");
        })).rejects.toThrow("rede caiu");

        const estado = lerCache(chave);
        expect(estado.dados).toBe("dado bom"); // não foi esvaziado
        expect(estado.erro).toBeInstanceOf(Error);
        expect(estado.buscando).toBe(false);
    });

    it("uma busca mais nova vence: o resultado de uma busca velha e lenta é descartado", async () => {
        const chave = novaChave();

        let resolverAntiga: (v: string) => void;
        const antiga = new Promise<string>((resolve) => { resolverAntiga = resolve; });

        const promiseAntiga = buscarNoCache(chave, () => antiga);
        // A geração avança porque a busca antiga ainda não resolveu (não está "travada" ainda,
        // mas usamos uma chave diferente de dedupe: aqui simulamos indiretamente forçando uma
        // segunda leitura enquanto a primeira está em voo — o dedupe faria as duas convergirem,
        // então validamos via geração: escrevemos direto com definirCache para simular uma
        // segunda busca que já terminou primeiro.
        definirCache(chave, "dado da busca nova, que chegou primeiro");

        resolverAntiga!("dado da busca antiga, atrasada");
        await promiseAntiga;

        // O valor da busca antiga não deveria sobrescrever o da nova.
        expect(lerCache(chave).dados).toBe("dado da busca nova, que chegou primeiro");
    });
});

describe("buscaTravada", () => {
    afterEach(() => jest.useRealTimers());

    it("busca recente não é considerada travada", async () => {
        const chave = novaChave();
        const pendente = buscarNoCache(chave, () => new Promise(() => {})); // nunca resolve
        expect(buscaTravada(chave)).toBe(false);
        void pendente; // evita warning de promise pendente
    });

    it("busca em andamento há mais que TEMPO_LIMITE_BUSCA é considerada travada", () => {
        const chave = novaChave();
        jest.useFakeTimers().setSystemTime(0);
        void buscarNoCache(chave, () => new Promise(() => {}));

        jest.setSystemTime(TEMPO_LIMITE_BUSCA + 1000);
        expect(buscaTravada(chave)).toBe(true);
    });

    it("uma busca travada é abandonada: uma nova chamada dispara uma busca de verdade", () => {
        const chave = novaChave();
        jest.useFakeTimers().setSystemTime(0);
        const primeiraBusca = jest.fn(() => new Promise(() => {}));
        void buscarNoCache(chave, primeiraBusca);

        jest.setSystemTime(TEMPO_LIMITE_BUSCA + 1000);
        const segundaBusca = jest.fn(() => new Promise(() => {}));
        void buscarNoCache(chave, segundaBusca);

        expect(segundaBusca).toHaveBeenCalledTimes(1);
    });
});

describe("definirCache", () => {
    it("escreve sem passar pela rede e avisa observadores", () => {
        const chave = novaChave();
        const notificar = jest.fn();
        const cancelar = observarCache(chave, notificar);

        definirCache(chave, "valor otimista");

        expect(lerCache(chave).dados).toBe("valor otimista");
        expect(notificar).toHaveBeenCalled();
        cancelar();
    });

    it("invalida uma busca em voo: ela não deve mais escrever no cache ao chegar", async () => {
        const chave = novaChave();
        let resolverBuscaVelha: (v: string) => void;
        const promiseBusca = buscarNoCache(chave, () => new Promise((r) => { resolverBuscaVelha = r; }));

        definirCache(chave, "valor definido manualmente");
        resolverBuscaVelha!("valor da busca que chegou depois");
        await promiseBusca;

        expect(lerCache(chave).dados).toBe("valor definido manualmente");
    });
});

describe("semearCache", () => {
    it("preenche uma chave vazia", () => {
        const chave = novaChave();
        semearCache(chave, "semente");
        expect(lerCache(chave).dados).toBe("semente");
    });

    it("não sobrescreve uma chave que já tem dado (a rede já respondeu antes)", () => {
        const chave = novaChave();
        definirCache(chave, "dado da rede");
        semearCache(chave, "semente atrasada");
        expect(lerCache(chave).dados).toBe("dado da rede");
    });
});

describe("invalidarCache", () => {
    it("zera gravadoEm sem apagar o dado (mantém stale-while-revalidate)", () => {
        const chave = novaChave();
        definirCache(chave, "valor");
        invalidarCache(chave);

        const estado = lerCache(chave);
        expect(estado.dados).toBe("valor");
        expect(estado.gravadoEm).toBe(0);
    });

    it("com prefixo, só invalida as chaves que começam com ele", () => {
        const prefixo = novaChave();
        const chaveA = `${prefixo}:a`;
        const chaveB = `${prefixo}:b`;
        const outraChave = novaChave();

        definirCache(chaveA, "a");
        definirCache(chaveB, "b");
        definirCache(outraChave, "outro");

        invalidarCache(prefixo);

        expect(lerCache(chaveA).gravadoEm).toBe(0);
        expect(lerCache(chaveB).gravadoEm).toBe(0);
        expect(lerCache(outraChave).gravadoEm).not.toBe(0);
    });
});

describe("limparCache", () => {
    it("remove a entrada por completo (diferente de invalidar)", () => {
        const chave = novaChave();
        definirCache(chave, "valor");
        limparCache(chave);
        expect(lerCache(chave).dados).toBeUndefined();
    });

    it("uma busca em voo órfã não trava a próxima chamada com a mesma chave", async () => {
        const chave = novaChave();
        // Busca que nunca resolve, fica pendurada em "emVoo".
        void buscarNoCache(chave, () => new Promise(() => {}));

        limparCache(chave);

        // A próxima busca não deve se juntar à promise morta.
        const resultado = await buscarNoCache(chave, async () => "dado novo depois do logout");
        expect(resultado).toBe("dado novo depois do logout");
    });

    it("sem prefixo, limpa tudo (usado no logout)", () => {
        const chaveA = novaChave();
        const chaveB = novaChave();
        definirCache(chaveA, "a");
        definirCache(chaveB, "b");

        limparCache();

        expect(lerCache(chaveA).dados).toBeUndefined();
        expect(lerCache(chaveB).dados).toBeUndefined();
    });
});

describe("observarCache", () => {
    it("cancelar a inscrição para de notificar", () => {
        const chave = novaChave();
        const notificar = jest.fn();
        const cancelar = observarCache(chave, notificar);
        cancelar();

        definirCache(chave, "valor");
        expect(notificar).not.toHaveBeenCalled();
    });
});
