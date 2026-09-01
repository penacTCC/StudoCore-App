jest.mock("@/repositories/supabase", () => ({
    supabase: {
        auth: {
            signInWithPassword: jest.fn(),
            signUp: jest.fn(),
            getUser: jest.fn(),
            getSession: jest.fn(),
            signOut: jest.fn(),
        },
    },
}));
jest.mock("@/services/armazenamentoOffline", () => ({
    limparUltimoGrupoLocalmente: jest.fn(),
}));
jest.mock("@/services/pushTokens", () => ({
    removerTokenPush: jest.fn(),
}));
jest.mock("expo-linking", () => ({ createURL: jest.fn(() => "studocore://forgot-password") }));

import { supabase } from "@/repositories/supabase";
import { limparUltimoGrupoLocalmente } from "@/services/armazenamentoOffline";
import { removerTokenPush } from "@/services/pushTokens";
import { buscarUsuarioLogado, cadastrarUsuario, deslogarUsuario } from "@/services/auth";

beforeEach(() => {
    jest.clearAllMocks();
});

describe("cadastrarUsuario — detecção de e-mail já cadastrado", () => {
    /*
      Com confirmação de e-mail ligada, o Supabase responde 200 (sem `error`) mesmo quando o
      e-mail já tem conta — só o array `identities` vazio denuncia isso.
      */
    it("marca emailJaCadastrado quando o Supabase devolve identities vazio e sem erro", async () => {
        (supabase.auth.signUp as jest.Mock).mockResolvedValue({
            data: { user: { identities: [] } },
            error: null,
        });

        const resultado = await cadastrarUsuario("ja@existe.com", "senha123");

        expect(resultado.emailJaCadastrado).toBe(true);
    });

    it("não marca emailJaCadastrado quando há identities (cadastro novo de verdade)", async () => {
        (supabase.auth.signUp as jest.Mock).mockResolvedValue({
            data: { user: { identities: [{ id: "1" }] } },
            error: null,
        });

        const resultado = await cadastrarUsuario("novo@exemplo.com", "senha123");

        expect(resultado.emailJaCadastrado).toBe(false);
    });

    it("não marca emailJaCadastrado quando o Supabase devolveu um erro de verdade", async () => {
        (supabase.auth.signUp as jest.Mock).mockResolvedValue({
            data: { user: { identities: [] } },
            error: { message: "senha fraca" },
        });

        const resultado = await cadastrarUsuario("x@exemplo.com", "123");

        expect(resultado.emailJaCadastrado).toBe(false);
    });
});

describe("deslogarUsuario", () => {
    it("limpa o último grupo e remove o token de push ANTES do signOut, quando há usuário", async () => {
        const chamadas: string[] = [];
        (limparUltimoGrupoLocalmente as jest.Mock).mockImplementation(async () => {
            chamadas.push("limparGrupo");
        });
        (supabase.auth.getUser as jest.Mock).mockImplementation(async () => {
            chamadas.push("getUser");
            return { data: { user: { id: "u1" } } };
        });
        (removerTokenPush as jest.Mock).mockImplementation(async () => {
            chamadas.push("removerToken");
        });
        (supabase.auth.signOut as jest.Mock).mockImplementation(async () => {
            chamadas.push("signOut");
            return { error: null };
        });

        await deslogarUsuario();

        // removerTokenPush precisa acontecer antes do signOut: depois dele a RLS não deixa mais apagar a linha.
        expect(chamadas).toEqual(["limparGrupo", "getUser", "removerToken", "signOut"]);
        expect(removerTokenPush).toHaveBeenCalledWith("u1");
    });

    it("não tenta remover token de push quando não há usuário logado", async () => {
        (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: null } });
        (supabase.auth.signOut as jest.Mock).mockResolvedValue({ error: null });

        await deslogarUsuario();

        expect(removerTokenPush).not.toHaveBeenCalled();
    });
});

describe("buscarUsuarioLogado", () => {
    it("expõe o usuário da sessão no mesmo formato de getUser()", async () => {
        (supabase.auth.getSession as jest.Mock).mockResolvedValue({
            data: { session: { user: { id: "u1" } } },
            error: null,
        });

        const resultado = await buscarUsuarioLogado();

        expect(resultado.data.user).toEqual({ id: "u1" });
    });

    it("devolve user: null sem sessão, em vez de quebrar", async () => {
        (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null }, error: null });

        const resultado = await buscarUsuarioLogado();

        expect(resultado.data.user).toBeNull();
    });
});
