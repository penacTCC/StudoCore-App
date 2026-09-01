import { ehErroDeRede } from "@/utils/erroDeRede";

describe("ehErroDeRede", () => {
    it("reconhece o AbortError do timeout de lib/supabase.ts", () => {
        const erro = Object.assign(new Error("aborted"), { name: "AbortError" });
        expect(ehErroDeRede(erro)).toBe(true);
    });

    it("reconhece 'Network request failed' do fetch do RN", () => {
        expect(ehErroDeRede(new Error("Network request failed"))).toBe(true);
    });

    it("reconhece variações de mensagem (case-insensitive)", () => {
        expect(ehErroDeRede(new Error("FAILED TO FETCH"))).toBe(true);
        expect(ehErroDeRede({ message: "network error" })).toBe(true);
    });

    it("não confunde um erro real da API (400, RLS) com falha de rede", () => {
        expect(ehErroDeRede(new Error("permission denied for table sessoes_foco"))).toBe(false);
    });

    it("erro nulo/undefined não é erro de rede", () => {
        expect(ehErroDeRede(null)).toBe(false);
        expect(ehErroDeRede(undefined)).toBe(false);
    });

    it("lida com valor sem .message (usa String(erro))", () => {
        expect(ehErroDeRede("network request failed")).toBe(true);
    });
});
