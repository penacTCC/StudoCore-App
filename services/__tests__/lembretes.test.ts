import { criarQueryBuilderMock } from "@/test/helpers/supabaseQueryMock";

jest.mock("@/repositories/supabase", () => ({ supabase: { from: jest.fn() } }));
jest.mock("expo-notifications", () => ({
    setNotificationChannelAsync: jest.fn(),
    getPermissionsAsync: jest.fn(),
    requestPermissionsAsync: jest.fn(),
    scheduleNotificationAsync: jest.fn(),
    getAllScheduledNotificationsAsync: jest.fn(),
    cancelScheduledNotificationAsync: jest.fn(),
    AndroidImportance: { HIGH: 4 },
    SchedulableTriggerInputTypes: { DATE: "date", WEEKLY: "weekly" },
}));
jest.mock("@/services/preferencias", () => ({ preferenciasDoUsuarioAtual: jest.fn() }));

import { supabase } from "@/repositories/supabase";
import * as Notifications from "expo-notifications";
import { preferenciasDoUsuarioAtual } from "@/services/preferencias";
import {
    cancelarLembreteRotina,
    cancelarLembretesPlano,
    cancelarTodosLembretesCronograma,
    ressincronizarTodosLembretes,
    sincronizarLembreteRotina,
    sincronizarLembretesPlano,
} from "@/services/lembretes";
import type { BlocoPlano, BlocoRotina } from "@/types/cronograma";

const fromMock = supabase.from as jest.Mock;
const prefsMock = preferenciasDoUsuarioAtual as jest.Mock;
const getPermissionsMock = Notifications.getPermissionsAsync as jest.Mock;
const scheduleMock = Notifications.scheduleNotificationAsync as jest.Mock;
const getAllScheduledMock = Notifications.getAllScheduledNotificationsAsync as jest.Mock;
const cancelMock = Notifications.cancelScheduledNotificationAsync as jest.Mock;

const PREFS_PADRAO = {
    notificacoesAtivas: true,
    antecedenciaMin: 10,
    naoPerturbar: false,
    naoPerturbarInicio: "22:00",
    naoPerturbarFim: "07:00",
};

const blocoRotinaBase: BlocoRotina = {
    id: "b1",
    dia_semana: 0, // segunda
    hora_inicio: "08:00",
    tipo: "estudo",
    notificar: true,
    materia_id: null,
    topico: null,
    antecedencia_min: null,
} as unknown as BlocoRotina;

beforeEach(() => {
    jest.clearAllMocks();
    fromMock.mockReturnValue(criarQueryBuilderMock({ data: null, error: null }));
    prefsMock.mockResolvedValue(PREFS_PADRAO);
    getPermissionsMock.mockResolvedValue({ status: "granted" });
    getAllScheduledMock.mockResolvedValue([]);
});

describe("sincronizarLembreteRotina", () => {
    it("não agenda bloco que não é do tipo 'estudo'", async () => {
        await sincronizarLembreteRotina({ ...blocoRotinaBase, tipo: "pausa" } as any);
        expect(scheduleMock).not.toHaveBeenCalled();
    });

    it("não agenda bloco com notificar=false", async () => {
        await sincronizarLembreteRotina({ ...blocoRotinaBase, notificar: false });
        expect(scheduleMock).not.toHaveBeenCalled();
    });

    it("não agenda quando as notificações estão desligadas nas preferências", async () => {
        prefsMock.mockResolvedValue({ ...PREFS_PADRAO, notificacoesAtivas: false });
        await sincronizarLembreteRotina(blocoRotinaBase);
        expect(scheduleMock).not.toHaveBeenCalled();
    });

    it("converte dia_semana (0=segunda) para o weekday do expo-notifications (1=domingo)", async () => {
        // dia_semana 0 (segunda), 08:00, 10min de antecedência -> dispara 07:50 de segunda.
        await sincronizarLembreteRotina(blocoRotinaBase);

        expect(scheduleMock).toHaveBeenCalledWith(
            expect.objectContaining({
                trigger: expect.objectContaining({ weekday: 2, hour: 7, minute: 50 }),
            })
        );
    });

    it("quando a antecedência cruza a meia-noite para trás, joga o disparo pro dia anterior", async () => {
        // dia_semana 0 (segunda) às 00:05, com 10min de antecedência -> domingo 23:55.
        await sincronizarLembreteRotina({ ...blocoRotinaBase, hora_inicio: "00:05" });

        expect(scheduleMock).toHaveBeenCalledWith(
            expect.objectContaining({
                // domingo: dia=(0+6)%7=6 -> weekday=((6+1)%7)+1=1
                trigger: expect.objectContaining({ weekday: 1, hour: 23, minute: 55 }),
            })
        );
    });

    it("bloco sem antecedência própria usa a antecedência padrão das preferências", async () => {
        await sincronizarLembreteRotina({ ...blocoRotinaBase, antecedencia_min: null });

        expect(scheduleMock).toHaveBeenCalledWith(
            expect.objectContaining({ trigger: expect.objectContaining({ minute: 50 }) }) // 10min padrão
        );
    });

    it("sem nenhuma antecedência (nem no bloco, nem no padrão), não agenda", async () => {
        prefsMock.mockResolvedValue({ ...PREFS_PADRAO, antecedenciaMin: 0 });
        await sincronizarLembreteRotina({ ...blocoRotinaBase, antecedencia_min: null });

        expect(scheduleMock).not.toHaveBeenCalled();
    });

    it("não agenda quando o horário calculado cai na janela de não perturbar", async () => {
        prefsMock.mockResolvedValue({ ...PREFS_PADRAO, naoPerturbar: true, naoPerturbarFim: "08:00" });
        // Disparo em 07:50, dentro de 22:00-08:00.
        await sincronizarLembreteRotina(blocoRotinaBase);

        expect(scheduleMock).not.toHaveBeenCalled();
    });

    it("cancela o lembrete anterior do mesmo bloco antes de reagendar", async () => {
        getAllScheduledMock.mockResolvedValue([
            { identifier: "old", content: { data: { tipo: "rotina", blocoId: "b1" } } },
            { identifier: "outro-bloco", content: { data: { tipo: "rotina", blocoId: "b2" } } },
        ]);

        await sincronizarLembreteRotina(blocoRotinaBase);

        expect(cancelMock).toHaveBeenCalledWith("old");
        expect(cancelMock).not.toHaveBeenCalledWith("outro-bloco");
    });
});

describe("cancelarLembreteRotina / cancelarLembretesPlano / cancelarTodosLembretesCronograma", () => {
    it("cancelarLembreteRotina só cancela notificações do bloco informado", async () => {
        getAllScheduledMock.mockResolvedValue([
            { identifier: "1", content: { data: { tipo: "rotina", blocoId: "b1" } } },
            { identifier: "2", content: { data: { tipo: "rotina", blocoId: "b2" } } },
            { identifier: "3", content: { data: { tipo: "plano", blocoId: "b1" } } },
        ]);

        await cancelarLembreteRotina("b1");

        expect(cancelMock).toHaveBeenCalledWith("1");
        expect(cancelMock).not.toHaveBeenCalledWith("2");
        expect(cancelMock).not.toHaveBeenCalledWith("3"); // é 'plano', não 'rotina'
    });

    it("cancelarLembretesPlano cancela só os blocos do plano informado", async () => {
        getAllScheduledMock.mockResolvedValue([
            { identifier: "1", content: { data: { tipo: "plano", blocoId: "b1" } } },
            { identifier: "2", content: { data: { tipo: "plano", blocoId: "b2" } } },
            { identifier: "3", content: { data: { tipo: "rotina", blocoId: "b1" } } },
        ]);

        await cancelarLembretesPlano("p1", ["b1"]);

        expect(cancelMock).toHaveBeenCalledWith("1");
        expect(cancelMock).not.toHaveBeenCalledWith("2");
        expect(cancelMock).not.toHaveBeenCalledWith("3");
    });

    it("cancelarTodosLembretesCronograma cancela tanto 'rotina' quanto 'plano'", async () => {
        getAllScheduledMock.mockResolvedValue([
            { identifier: "1", content: { data: { tipo: "rotina" } } },
            { identifier: "2", content: { data: { tipo: "plano" } } },
            { identifier: "3", content: { data: { tipo: "pausa" } } },
        ]);

        await cancelarTodosLembretesCronograma();

        expect(cancelMock).toHaveBeenCalledWith("1");
        expect(cancelMock).toHaveBeenCalledWith("2");
        expect(cancelMock).not.toHaveBeenCalledWith("3");
    });
});

describe("sincronizarLembretesPlano", () => {
    const blocoBase: BlocoPlano = {
        id: "bp1",
        dia_semana: null,
        hora_inicio: "09:00",
        tipo: "estudo",
        notificar: true,
        materia_id: null,
        topico: null,
        antecedencia_min: null,
    } as unknown as BlocoPlano;

    it("agenda_tipo 'nenhuma' não agenda nada", async () => {
        await sincronizarLembretesPlano({ id: "p1", agenda_tipo: "nenhuma", agenda_dias: null, agenda_data: null }, [blocoBase]);
        expect(scheduleMock).not.toHaveBeenCalled();
    });

    it("agenda_tipo 'data' no passado não agenda (não manda notificação atrasada)", async () => {
        jest.useFakeTimers().setSystemTime(new Date("2026-08-10T12:00:00-03:00"));
        await sincronizarLembretesPlano(
            { id: "p1", agenda_tipo: "data", agenda_dias: null, agenda_data: "2026-08-01" },
            [blocoBase]
        );
        expect(scheduleMock).not.toHaveBeenCalled();
        jest.useRealTimers();
    });

    it("agenda_tipo 'data' no futuro agenda um disparo pontual (DATE)", async () => {
        jest.useFakeTimers().setSystemTime(new Date("2026-08-01T00:00:00-03:00"));
        await sincronizarLembretesPlano(
            { id: "p1", agenda_tipo: "data", agenda_dias: null, agenda_data: "2026-08-10" },
            [blocoBase]
        );

        expect(scheduleMock).toHaveBeenCalledWith(
            expect.objectContaining({ trigger: expect.objectContaining({ type: "date" }) })
        );
        jest.useRealTimers();
    });

    it("bloco com dia_semana fixo só dispara nesse dia — outros dias da agenda são ignorados", async () => {
        // dia_semana do bloco = 2 (quarta), mas o plano é 'fixado' para os dias 0 e 1 (segunda, terça).
        await sincronizarLembretesPlano(
            { id: "p1", agenda_tipo: "fixado", agenda_dias: [0, 1], agenda_data: null },
            [{ ...blocoBase, dia_semana: 2 }]
        );

        expect(scheduleMock).not.toHaveBeenCalled();
    });

    it("agenda_tipo 'fixado' agenda um WEEKLY por dia marcado", async () => {
        await sincronizarLembretesPlano(
            { id: "p1", agenda_tipo: "fixado", agenda_dias: [0, 2], agenda_data: null },
            [blocoBase]
        );

        expect(scheduleMock).toHaveBeenCalledTimes(2);
        expect(scheduleMock.mock.calls.every(([args]) => args.trigger.type === "weekly")).toBe(true);
    });

    it("blocos sem notificar ou sem antecedência não entram na lista de agendamento", async () => {
        await sincronizarLembretesPlano(
            { id: "p1", agenda_tipo: "fixado", agenda_dias: [0], agenda_data: null },
            [
                { ...blocoBase, notificar: false },
                { ...blocoBase, tipo: "descanso" },
                { ...blocoBase, antecedencia_min: 0 },
            ]
        );

        expect(scheduleMock).not.toHaveBeenCalled();
    });

    it("cancela os lembretes existentes desses blocos antes de reagendar", async () => {
        getAllScheduledMock.mockResolvedValue([
            { identifier: "old", content: { data: { tipo: "plano", blocoId: "bp1" } } },
        ]);

        await sincronizarLembretesPlano({ id: "p1", agenda_tipo: "nenhuma", agenda_dias: null, agenda_data: null }, [blocoBase]);

        expect(cancelMock).toHaveBeenCalledWith("old");
    });
});

describe("ressincronizarTodosLembretes", () => {
    it("cancela tudo primeiro e não reagenda nada quando notificações estão desligadas", async () => {
        getAllScheduledMock.mockResolvedValue([
            { identifier: "old", content: { data: { tipo: "rotina" } } },
        ]);
        prefsMock.mockResolvedValue({ ...PREFS_PADRAO, notificacoesAtivas: false });

        await ressincronizarTodosLembretes("u1");

        expect(cancelMock).toHaveBeenCalledWith("old");
        expect(fromMock).not.toHaveBeenCalledWith("rotina_semanal_blocos");
    });

    it("busca rotina e planos do usuário e resincroniza cada um", async () => {
        const rotina = [{ ...blocoRotinaBase, id: "r1" }];
        const planos = [
            {
                id: "p1",
                agenda_tipo: "fixado" as const,
                agenda_dias: [0],
                agenda_data: null,
                planos_blocos: [
                    { id: "bp1", dia_semana: null, hora_inicio: "09:00", tipo: "estudo", notificar: true, materia_id: null, topico: null, antecedencia_min: null },
                ],
            },
        ];

        fromMock.mockImplementation((tabela: string) => {
            if (tabela === "rotina_semanal_blocos") return criarQueryBuilderMock({ data: rotina, error: null });
            if (tabela === "planos") return criarQueryBuilderMock({ data: planos, error: null });
            return criarQueryBuilderMock({ data: null, error: null });
        });

        await ressincronizarTodosLembretes("u1");

        // 1 disparo da rotina + 1 do plano fixado.
        expect(scheduleMock).toHaveBeenCalledTimes(2);
    });
});
