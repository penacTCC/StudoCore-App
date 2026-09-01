import { criarQueryBuilderMock } from "@/test/helpers/supabaseQueryMock";

jest.mock("@/repositories/supabase", () => ({
    supabase: { from: jest.fn(), rpc: jest.fn(), auth: { getUser: jest.fn() } },
}));
jest.mock("@/services/fotosSessao", () => ({ assinarCaminhosDeFoto: jest.fn() }));
jest.mock("@/services/notificacoes", () => ({ avisarInteracao: jest.fn() }));

import { supabase } from "@/repositories/supabase";
import { assinarCaminhosDeFoto } from "@/services/fotosSessao";
import { avisarInteracao } from "@/services/notificacoes";
import {
    alternarCurtida,
    apagarComentario,
    bloquearAutor,
    buscarComentarios,
    buscarFeedComunidade,
    buscarPreviaPlano,
    denunciar,
    importarPlano,
} from "@/services/comunidade";

const fromMock = supabase.from as jest.Mock;
const rpcMock = supabase.rpc as jest.Mock;
const getUserMock = supabase.auth.getUser as jest.Mock;

const linhaGaleria = (overrides: Partial<any> = {}) => ({
    sessao_id: "s1",
    autor_id: "u1",
    autor_nome: "Fulano",
    autor_foto: null,
    foto_path: "p1.jpg",
    foto_legenda: null,
    disciplina: "Matemática",
    tempo_minutos: 30,
    criado_em: "2026-08-10T10:00:00Z",
    curtidas: 0,
    curtido_por_mim: false,
    comentarios: 0,
    salvo_por_mim: false,
    ...overrides,
});

beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
    getUserMock.mockReset();
    (assinarCaminhosDeFoto as jest.Mock).mockReset().mockResolvedValue(new Map());
    (avisarInteracao as jest.Mock).mockReset();
});

describe("buscarFeedComunidade", () => {
    it("junta as três origens ordenadas por data, mais recente primeiro", async () => {
        rpcMock.mockImplementation((nome: string) => {
            if (nome === "comunidade_feed_galeria") {
                return Promise.resolve({ data: [linhaGaleria({ sessao_id: "g1", criado_em: "2026-08-10T08:00:00Z" })], error: null });
            }
            if (nome === "comunidade_feed_arquivos") {
                return Promise.resolve({
                    data: [
                        { arquivo_id: "a1", autor_id: "u2", autor_nome: "Beltrano", autor_foto: null, titulo: "resumo.pdf", storage_path: "x", disciplina: null, tamanho_bytes: 100, criado_em: "2026-08-10T12:00:00Z", curtidas: 0, curtido_por_mim: false, comentarios: 0 },
                    ],
                    error: null,
                });
            }
            return Promise.resolve({ data: [], error: null });
        });

        const pagina = await buscarFeedComunidade({ filtro: "tudo" });

        expect(pagina.itens.map((i) => i.referenciaId)).toEqual(["a1", "g1"]); // arquivo (12h) antes da galeria (8h)
    });

    it("filtra por uma única origem quando o filtro não é 'tudo'", async () => {
        rpcMock.mockResolvedValue({ data: [], error: null });

        await buscarFeedComunidade({ filtro: "arquivo" });

        expect(rpcMock).toHaveBeenCalledWith("comunidade_feed_arquivos", expect.anything());
        expect(rpcMock).not.toHaveBeenCalledWith("comunidade_feed_galeria", expect.anything());
        expect(rpcMock).not.toHaveBeenCalledWith("comunidade_feed_planos", expect.anything());
    });

    it("devolve proximoCursor nulo quando a página final vem vazia (fim do scroll)", async () => {
        rpcMock.mockResolvedValue({ data: [], error: null });

        const pagina = await buscarFeedComunidade({ filtro: "tudo" });

        expect(pagina.proximoCursor).toBeNull();
    });

    it("lança quando a RPC devolve erro", async () => {
        rpcMock.mockResolvedValue({ data: null, error: { message: "falhou" } });

        await expect(buscarFeedComunidade({ filtro: "galeria" })).rejects.toThrow("falhou");
    });
});

describe("alternarCurtida", () => {
    beforeEach(() => getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } }));

    it("insere a curtida e dispara o push de interação", async () => {
        const insertMock = jest.fn(() => criarQueryBuilderMock({ error: null }));
        fromMock.mockReturnValue({ insert: insertMock });

        await alternarCurtida({ origem: "galeria", referenciaId: "s1" }, true);

        expect(insertMock).toHaveBeenCalledWith(
            expect.objectContaining({ user_id: "u1", origem: "galeria", referencia_id: "s1" })
        );
        expect(avisarInteracao).toHaveBeenCalledWith({ origem: "galeria", referenciaId: "s1" }, "curtida");
    });

    it("não lança em curtida duplicada (unique violation 23505)", async () => {
        fromMock.mockReturnValue({ insert: () => criarQueryBuilderMock({ error: { code: "23505" } }) });

        await expect(alternarCurtida({ origem: "galeria", referenciaId: "s1" }, true)).resolves.toBeUndefined();
    });

    it("lança em outros erros de insert", async () => {
        fromMock.mockReturnValue({ insert: () => criarQueryBuilderMock({ error: { code: "500", message: "falhou" } }) });

        await expect(alternarCurtida({ origem: "galeria", referenciaId: "s1" }, true)).rejects.toThrow("falhou");
    });

    it("remove a curtida quando `curtir` é false", async () => {
        fromMock.mockReturnValue(criarQueryBuilderMock({ error: null }));

        await alternarCurtida({ origem: "galeria", referenciaId: "s1" }, false);

        expect(avisarInteracao).not.toHaveBeenCalled();
    });

    it("propaga a sessão expirada quando não há usuário logado", async () => {
        getUserMock.mockResolvedValue({ data: { user: null } });

        await expect(alternarCurtida({ origem: "galeria", referenciaId: "s1" }, true)).rejects.toThrow("Sessão expirada.");
    });
});

describe("buscarComentarios", () => {
    it("marca `meu` para comentários do usuário logado", async () => {
        getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
        fromMock.mockReturnValue(
            criarQueryBuilderMock({
                data: [
                    { id: "c1", user_id: "u1", texto: "oi", criado_em: "t1", profiles: { nome_usuario: "Fulano", foto_usuario: null } },
                    { id: "c2", user_id: "u2", texto: "opa", criado_em: "t2", profiles: null },
                ],
                error: null,
            })
        );

        const comentarios = await buscarComentarios({ origem: "galeria", referenciaId: "s1" });

        expect(comentarios[0].meu).toBe(true);
        expect(comentarios[1].meu).toBe(false);
        expect(comentarios[1].autor.nome).toBe("Sem nome");
    });

    it("marca doAutorDaPublicacao quando o comentário é do dono da publicação", async () => {
        getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
        fromMock.mockReturnValue(
            criarQueryBuilderMock({
                data: [{ id: "c1", user_id: "u2", texto: "oi", criado_em: "t1", profiles: null }],
                error: null,
            })
        );

        const [comentario] = await buscarComentarios({ origem: "galeria", referenciaId: "s1" }, "u2");

        expect(comentario.doAutorDaPublicacao).toBe(true);
    });
});

describe("apagarComentario / denunciar / bloquearAutor", () => {
    it("apagarComentario lança quando o delete falha", async () => {
        fromMock.mockReturnValue(criarQueryBuilderMock({ error: { message: "falhou" } }));
        await expect(apagarComentario("c1")).rejects.toThrow("falhou");
    });

    it("denunciar não lança em denúncia duplicada", async () => {
        getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
        fromMock.mockReturnValue(criarQueryBuilderMock({ error: { code: "23505" } }));

        await expect(denunciar({ ref: { origem: "galeria", referenciaId: "s1" } })).resolves.toBeUndefined();
    });

    it("bloquearAutor não lança ao bloquear duas vezes a mesma pessoa", async () => {
        getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
        fromMock.mockReturnValue(criarQueryBuilderMock({ error: { code: "23505" } }));

        await expect(bloquearAutor("u2")).resolves.toBeUndefined();
    });
});

describe("buscarPreviaPlano", () => {
    it("devolve null quando o plano não existe (ou não está mais público)", async () => {
        fromMock.mockReturnValue(criarQueryBuilderMock({ data: null, error: null }));
        expect(await buscarPreviaPlano("p1")).toBeNull();
    });

    it("separa minutos de estudo e de descanso pelos blocos", async () => {
        fromMock.mockImplementation((tabela: string) => {
            if (tabela === "planos") return criarQueryBuilderMock({ data: { id: "p1", nome: "Plano A", cor: "#fff" }, error: null });
            return criarQueryBuilderMock({
                data: [
                    { id: "b1", hora_inicio: "08:00:00", duracao_min: 25, tipo: "estudo", topico: null, materias_usuario: null },
                    { id: "b2", hora_inicio: "08:25:00", duracao_min: 5, tipo: "descanso", topico: null, materias_usuario: null },
                    { id: "b3", hora_inicio: "08:30:00", duracao_min: 25, tipo: "estudo", topico: null, materias_usuario: null },
                ],
                error: null,
            });
        });

        const previa = await buscarPreviaPlano("p1");

        expect(previa?.minutosEstudo).toBe(50);
        expect(previa?.minutosDescanso).toBe(5);
        expect(previa?.blocos[0].horaInicio).toBe("08:00");
    });
});

describe("importarPlano", () => {
    it("devolve o id da cópia criada pela RPC", async () => {
        rpcMock.mockResolvedValue({ data: "novo-plano-id", error: null });
        expect(await importarPlano("p1")).toBe("novo-plano-id");
    });

    it("lança quando a RPC falha", async () => {
        rpcMock.mockResolvedValue({ data: null, error: { message: "falhou" } });
        await expect(importarPlano("p1")).rejects.toThrow("falhou");
    });
});
