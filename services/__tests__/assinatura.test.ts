jest.mock("@/repositories/supabase", () => ({
    supabase: { rpc: jest.fn(), from: jest.fn() },
}));

import { supabase } from "@/repositories/supabase";
import {
    buscarEstadoDoPlano,
    buscarLimitesDePlano,
    dentroDoLimite,
    mensagemDeLimite,
    MENSAGEM_DE_LIMITE,
    recursoDoErroDeLimite,
    restante,
} from "@/services/assinatura";

const rpcMock = supabase.rpc as jest.Mock;
const fromMock = supabase.from as jest.Mock;

beforeEach(() => {
    jest.clearAllMocks();
});

describe("recursoDoErroDeLimite", () => {
    it("extrai o recurso da mensagem levantada pelo trigger", () => {
        expect(recursoDoErroDeLimite({ message: "LIMITE_PLANO:grupos" })).toBe("grupos");
        expect(recursoDoErroDeLimite({ message: 'new row violates: LIMITE_PLANO:armazenamento' }))
            .toBe("armazenamento");
    });

    it("devolve null para erro que não é de limite", () => {
        expect(recursoDoErroDeLimite({ message: "duplicate key value" })).toBeNull();
        expect(recursoDoErroDeLimite(null)).toBeNull();
    });
});

describe("mensagemDeLimite", () => {
    it("traduz o erro do trigger no texto da tela", async () => {
        await expect(mensagemDeLimite({ message: "LIMITE_PLANO:planos" }))
            .resolves.toBe(MENSAGEM_DE_LIMITE.planos);
    });

    it("traduz o 429 da Edge Function lendo o corpo em `context`", async () => {
        const erro = {
            message: "Edge Function returned a non-2xx status code",
            context: { json: async () => ({ error: "LIMITE_PLANO", recurso: "anexo", motivo: "cota_esgotada" }) },
        };
        await expect(mensagemDeLimite(erro)).resolves.toBe(MENSAGEM_DE_LIMITE.anexo);
    });

    it("devolve null quando o 429 é de outra coisa", async () => {
        const erro = { context: { json: async () => ({ error: "Gemini fora do ar" }) } };
        await expect(mensagemDeLimite(erro)).resolves.toBeNull();
    });

    it("não quebra quando o corpo não é JSON", async () => {
        const erro = { context: { json: async () => { throw new Error("not json"); } } };
        await expect(mensagemDeLimite(erro)).resolves.toBeNull();
    });
});

describe("dentroDoLimite / restante", () => {
    it("trata null como ilimitado", () => {
        expect(dentroDoLimite(9999, null)).toBe(true);
        expect(restante(9999, null)).toBeNull();
    });

    it("bloqueia ao chegar no teto e nunca devolve negativo", () => {
        expect(dentroDoLimite(1, 2)).toBe(true);
        expect(dentroDoLimite(2, 2)).toBe(false);
        expect(restante(3, 2)).toBe(0);
    });
});

describe("buscarEstadoDoPlano", () => {
    it("cai no Grátis — nunca no Pro — quando a RPC falha", async () => {
        rpcMock.mockResolvedValue({ data: null, error: { message: "network" } });

        const estado = await buscarEstadoDoPlano();

        expect(estado.plano).toBe("gratis");
        expect(estado.limites.chatIaPorMes).toBe(0);
        expect(estado.uso.armazenamentoBytes).toBe(0);
    });

    it("cai no Grátis quando a chamada lança, sem propagar o erro", async () => {
        // Quem chama está no meio de um upload: uma falha ao LER o plano não pode derrubar.
        rpcMock.mockImplementation(() => { throw new Error("supabase indisponível"); });

        await expect(buscarEstadoDoPlano()).resolves.toMatchObject({ plano: "gratis" });
    });

    it("converte a resposta da RPC de snake_case para o formato do app", async () => {
        rpcMock.mockResolvedValue({
            data: {
                plano: "pro",
                limites: {
                    plano: "pro", rotulo: "Pro", grupos_max: null, membros_por_grupo_max: 50,
                    quiz_ia_por_dia: null, anexos_ia_por_mes: 50, chat_ia_por_mes: 300,
                    historico_dias: null, armazenamento_bytes: 5368709120,
                    comparacao_perfil_completa: true, wrapped_mensal: true,
                },
                uso: { quiz_hoje: 4, anexos_no_mes: 7, grupos: 2, armazenamento_bytes: 1024 },
            },
            error: null,
        });

        const estado = await buscarEstadoDoPlano();

        expect(estado.plano).toBe("pro");
        expect(estado.limites.gruposMax).toBeNull();
        expect(estado.limites.membrosPorGrupoMax).toBe(50);
        expect(estado.limites.comparacaoPerfilCompleta).toBe(true);
        expect(estado.uso.quizHoje).toBe(4);
        expect(estado.uso.gruposAdministrados).toBe(2);
    });
});

describe("buscarLimitesDePlano", () => {
    it("lê a linha do plano pedido e converte para o formato do app", async () => {
        const single = jest.fn().mockResolvedValue({
            data: { plano: "pro", rotulo: "Pro", anexos_ia_por_mes: 50, membros_por_grupo_max: 50, grupos_max: null },
            error: null,
        });
        fromMock.mockReturnValue({
            select: () => ({ eq: () => ({ single }) }),
        });

        const limites = await buscarLimitesDePlano("pro");

        expect(limites?.plano).toBe("pro");
        expect(limites?.anexosIaPorMes).toBe(50);
        expect(limites?.gruposMax).toBeNull();
    });

    it("devolve null em vez de propagar quando a consulta falha", async () => {
        fromMock.mockImplementation(() => { throw new Error("offline"); });
        await expect(buscarLimitesDePlano("pro")).resolves.toBeNull();
    });
});
