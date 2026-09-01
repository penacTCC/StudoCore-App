import { DeviceEventEmitter } from "react-native";
import { criarQueryBuilderMock } from "@/test/helpers/supabaseQueryMock";

jest.mock("@/repositories/supabase", () => ({
    supabase: { from: jest.fn() },
}));

jest.mock("@/services/auth", () => ({
    buscarUsuarioLogado: jest.fn(),
}));

import { supabase } from "@/repositories/supabase";
import { buscarUsuarioLogado } from "@/services/auth";
import { definirModoTeste } from "@/services/modoTeste";
import { addStudyQuestions, loadProfileStats, syncProfileStatsAfterFocusSession } from "@/services/profileStats";

const fromMock = supabase.from as jest.Mock;
const buscarUsuarioMock = buscarUsuarioLogado as jest.Mock;

beforeEach(async () => {
    fromMock.mockReset();
    buscarUsuarioMock.mockReset();
    await definirModoTeste(false);
});

describe("loadProfileStats", () => {
    it("devolve as estatísticas padrão sem consultar o banco quando não há usuário logado", async () => {
        buscarUsuarioMock.mockResolvedValue({ data: { user: null } });

        const stats = await loadProfileStats();

        expect(stats.totalHours).toBe(0);
        expect(fromMock).not.toHaveBeenCalled();
    });

    it("não deixa tempo negativo de sessões antigas derrubar o total pra baixo de zero", async () => {
        buscarUsuarioMock.mockResolvedValue({ data: { user: { id: "u1" } } });

        fromMock.mockImplementation((tabela: string) => {
            if (tabela === "profiles") return criarQueryBuilderMock({ data: null, error: null });
            if (tabela === "sessoes_foco") {
                const builder = criarQueryBuilderMock({
                    data: [
                        { tempo_minutos: -10790, created_at: new Date().toISOString(), disciplina: "Matemática" },
                        { tempo_minutos: 60, created_at: new Date().toISOString(), disciplina: "Matemática" },
                    ],
                    error: null,
                    count: 2,
                });
                return builder;
            }
            return criarQueryBuilderMock({ data: null, error: null });
        });

        const stats = await loadProfileStats();

        // Só a sessão de 60min positiva conta; a negativa vira 0, nunca subtrai.
        expect(stats.totalHours).toBe(1);
    });

    it("soma o tempo vitalício mesmo de sessões fora da janela de 100 dias do heatmap, mas não as inclui no heatmap", async () => {
        buscarUsuarioMock.mockResolvedValue({ data: { user: { id: "u1" } } });
        const dataAntiga = new Date();
        dataAntiga.setDate(dataAntiga.getDate() - 200);

        fromMock.mockImplementation((tabela: string) => {
            if (tabela === "profiles") return criarQueryBuilderMock({ data: null, error: null });
            if (tabela === "sessoes_foco") {
                return criarQueryBuilderMock({
                    data: [{ tempo_minutos: 120, created_at: dataAntiga.toISOString(), disciplina: "Física" }],
                    error: null,
                    count: 1,
                });
            }
            return criarQueryBuilderMock({ data: null, error: null });
        });

        const stats = await loadProfileStats();

        expect(stats.totalHours).toBe(2); // 120min entram no total vitalício
        expect(Object.keys(stats.studyHistory)).toHaveLength(0); // mas fora da janela do heatmap
    });

    it("aceita medalhas gravadas como string JSON (schema antigo) além de array", async () => {
        buscarUsuarioMock.mockResolvedValue({ data: { user: { id: "u1" } } });

        fromMock.mockImplementation((tabela: string) => {
            if (tabela === "profiles") {
                return criarQueryBuilderMock({
                    data: { medalhas_desbloqueadas: JSON.stringify(["hours_1", "hours_2"]) },
                    error: null,
                });
            }
            return criarQueryBuilderMock({ data: [], error: null, count: 0 });
        });

        const stats = await loadProfileStats();

        expect(stats.badgesUnlocked).toEqual(["hours_1", "hours_2"]);
    });

    it("não quebra quando medalhas_desbloqueadas vem corrompido — reseta pra vazio", async () => {
        buscarUsuarioMock.mockResolvedValue({ data: { user: { id: "u1" } } });

        fromMock.mockImplementation((tabela: string) => {
            if (tabela === "profiles") {
                return criarQueryBuilderMock({ data: { medalhas_desbloqueadas: "{ json quebrado" }, error: null });
            }
            return criarQueryBuilderMock({ data: [], error: null, count: 0 });
        });

        const stats = await loadProfileStats();

        expect(stats.badgesUnlocked).toEqual([]);
    });
});

describe("syncProfileStatsAfterFocusSession", () => {
    it("recalcula horas e questões só a partir de sessões finalizadas, e desbloqueia a medalha da primeira sessão", async () => {
        buscarUsuarioMock.mockResolvedValue({ data: { user: { id: "u1" } } });
        const emitSpy = jest.spyOn(DeviceEventEmitter, "emit");

        const profileBuilder = criarQueryBuilderMock({ data: { medalhas_desbloqueadas: [] }, error: null });
        fromMock.mockImplementation((tabela: string) => {
            if (tabela === "profiles") return profileBuilder;
            if (tabela === "sessoes_foco") {
                return criarQueryBuilderMock({
                    data: [
                        {
                            tempo_minutos: 90,
                            questoes_respondidas: 4,
                            questoes_externas: 1,
                            data_sessao: new Date().toISOString().slice(0, 10),
                            created_at: new Date().toISOString(),
                        },
                    ],
                    error: null,
                    count: 1,
                });
            }
            return criarQueryBuilderMock({ data: [], error: null, count: 1 });
        });

        const stats = await syncProfileStatsAfterFocusSession("u1");

        expect(profileBuilder.update).toHaveBeenCalledWith(
            expect.objectContaining({
                horas_totais: 2, // Math.round(90/60)
                questoes_feitas: 5, // 4 + 1
                medalhas_desbloqueadas: expect.arrayContaining(["first_session"]),
            })
        );
        expect(emitSpy).toHaveBeenCalledWith("badgesUnlocked", expect.arrayContaining([expect.objectContaining({ id: "first_session" })]));
        expect(stats).not.toBeNull();

        emitSpy.mockRestore();
    });

    it("devolve null e não emite medalha quando a atualização do perfil falha", async () => {
        buscarUsuarioMock.mockResolvedValue({ data: { user: { id: "u1" } } });
        const emitSpy = jest.spyOn(DeviceEventEmitter, "emit");

        let chamadasEmProfiles = 0;
        fromMock.mockImplementation((tabela: string) => {
            if (tabela === "profiles") {
                chamadasEmProfiles += 1;
                // 1ª chamada: select() inicial (precisa devolver o perfil); 2ª: update() (deve falhar).
                return chamadasEmProfiles === 1
                    ? criarQueryBuilderMock({ data: { medalhas_desbloqueadas: [] }, error: null })
                    : criarQueryBuilderMock({ data: null, error: { message: "boom" } });
            }
            return criarQueryBuilderMock({ data: [{ tempo_minutos: 30, created_at: new Date().toISOString() }], error: null, count: 1 });
        });

        const stats = await syncProfileStatsAfterFocusSession("u1");

        expect(stats).toBeNull();
        expect(emitSpy).not.toHaveBeenCalledWith("badgesUnlocked", expect.anything());

        emitSpy.mockRestore();
    });

    it("devolve null quando a busca das sessões falha", async () => {
        buscarUsuarioMock.mockResolvedValue({ data: { user: { id: "u1" } } });

        fromMock.mockImplementation((tabela: string) => {
            if (tabela === "profiles") return criarQueryBuilderMock({ data: { medalhas_desbloqueadas: [] }, error: null });
            if (tabela === "sessoes_foco") return criarQueryBuilderMock({ data: null, error: { message: "boom" } });
            return criarQueryBuilderMock({ data: [], error: null });
        });

        const stats = await syncProfileStatsAfterFocusSession("u1");

        expect(stats).toBeNull();
    });
});

describe("addStudyQuestions", () => {
    it("não faz nada com uma contagem zero ou negativa", async () => {
        buscarUsuarioMock.mockResolvedValue({ data: { user: { id: "u1" } } });

        expect(await addStudyQuestions(0)).toBeNull();
        expect(await addStudyQuestions(-5)).toBeNull();
        expect(fromMock).not.toHaveBeenCalled();
    });

    it("não faz nada sem usuário logado", async () => {
        buscarUsuarioMock.mockResolvedValue({ data: { user: null } });

        expect(await addStudyQuestions(5)).toBeNull();
        expect(fromMock).not.toHaveBeenCalled();
    });
});
