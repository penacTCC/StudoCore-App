import { totalQuestoes, totalAcertos, taxaDeAcerto } from "@/utils/estatisticasSessao";

describe("totalQuestoes / totalAcertos", () => {
    it("soma quiz da IA com formulário externo corrigido", () => {
        const sessao = {
            questoes_respondidas: 8,
            questoes_acertadas: 6,
            questoes_externas: 10,
            acertos_externos: 7,
        };

        expect(totalQuestoes(sessao)).toBe(18);
        expect(totalAcertos(sessao)).toBe(13);
    });

    it("null/undefined nas colunas externas não quebra a soma", () => {
        const sessao = {
            questoes_respondidas: 5,
            questoes_acertadas: 4,
            questoes_externas: null,
            acertos_externos: undefined,
        };

        expect(totalQuestoes(sessao)).toBe(5);
        expect(totalAcertos(sessao)).toBe(4);
    });
});

describe("taxaDeAcerto", () => {
    it("calcula a porcentagem arredondada combinando as duas fontes", () => {
        // 6 de 8 no quiz + 1 de 2 no formulário = 7 de 10 = 70%
        expect(
            taxaDeAcerto({
                questoes_respondidas: 8,
                questoes_acertadas: 6,
                questoes_externas: 2,
                acertos_externos: 1,
            })
        ).toBe(70);
    });

    it("sem nenhuma questão respondida, devolve 0 em vez de dividir por zero", () => {
        expect(taxaDeAcerto({ questoes_respondidas: 0, questoes_acertadas: 0 })).toBe(0);
    });

    it("anexo ainda não corrigido (sem questoes_externas) não puxa a média pra baixo", () => {
        expect(
            taxaDeAcerto({
                questoes_respondidas: 10,
                questoes_acertadas: 10,
                questoes_externas: null,
                acertos_externos: null,
            })
        ).toBe(100);
    });
});
