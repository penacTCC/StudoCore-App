import { traduzirErroAuth } from "@/utils/errosAuth";

describe("traduzirErroAuth", () => {
    it("traduz uma mensagem conhecida", () => {
        expect(traduzirErroAuth("Invalid login credentials")).toBe("E-mail ou senha incorretos.");
    });

    it("é case-insensitive e casa por trecho, não a frase inteira", () => {
        expect(traduzirErroAuth("Error: INVALID LOGIN CREDENTIALS (400)")).toBe("E-mail ou senha incorretos.");
    });

    it("interpola grupos capturados na tradução (limite de senha)", () => {
        expect(traduzirErroAuth("Password should be at least 8 characters")).toBe(
            "A senha precisa ter pelo menos 8 caracteres."
        );
    });

    it("interpola o tempo de espera do rate limit", () => {
        expect(traduzirErroAuth("For security purposes, you can only request this after 42 seconds")).toBe(
            "Aguarde 42 segundos antes de tentar de novo."
        );
    });

    it("mensagem sem tradução conhecida volta como veio (não inventa texto)", () => {
        expect(traduzirErroAuth("Some brand new supabase error")).toBe("Some brand new supabase error");
    });

    it("mensagem vazia/nula cai no genérico", () => {
        expect(traduzirErroAuth(null)).toBe("Algo deu errado. Tente de novo em instantes.");
        expect(traduzirErroAuth(undefined)).toBe("Algo deu errado. Tente de novo em instantes.");
        expect(traduzirErroAuth("")).toBe("Algo deu errado. Tente de novo em instantes.");
    });

    it("usa a primeira regra que casar, na ordem declarada em TRADUCOES", () => {
        // "at least N characters" vem antes de "pwned" na lista, então vence mesmo
        // quando a mensagem também bateria com a regra de senha vazada.
        expect(traduzirErroAuth("Password should be at least 8 characters and not be pwned")).toBe(
            "A senha precisa ter pelo menos 8 caracteres."
        );
    });
});
