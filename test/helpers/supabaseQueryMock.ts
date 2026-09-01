/**
 * Mock genérico do query builder do supabase-js (`supabase.from(...).select().eq()...`).
 *
 * O client encadeia métodos e o resultado só existe quando a chain é "await"ada — por isso
 * cada método devolve o próprio builder (`this`) e o builder implementa `.then`, se
 * comportando como uma Promise que resolve para `{ data, error, count }`.
 *
 * Uso típico num teste de service:
 *
 *   import { supabase } from "@/repositories/supabase";
 *   jest.mock("@/repositories/supabase", () => ({ supabase: { from: jest.fn() } }));
 *
 *   const builder = criarQueryBuilderMock({ data: [{ id: "1" }], error: null });
 *   (supabase.from as jest.Mock).mockReturnValue(builder);
 *
 * Quando a função testada faz mais de uma chamada `.from(...)` (ex.: um fallback de
 * schema), use `mockReturnValueOnce` em sequência, uma vez por chamada.
 */

export type QueryResult<T = any> = {
    data?: T;
    error?: any;
    count?: number | null;
};

const CHAIN_METHODS = [
    "select",
    "insert",
    "update",
    "delete",
    "upsert",
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "in",
    "is",
    "order",
    "limit",
    "range",
    "filter",
    "match",
    "contains",
    "or",
    "not",
    "abortSignal",
] as const;

export function criarQueryBuilderMock<T = any>(resultado: QueryResult<T>) {
    const builder: any = {};

    for (const metodo of CHAIN_METHODS) {
        builder[metodo] = jest.fn(() => builder);
    }

    // `maybeSingle`/`single` encerram a chain sem passar por `.then` do caller — resolvem direto.
    builder.maybeSingle = jest.fn(() => Promise.resolve(resultado));
    builder.single = jest.fn(() => Promise.resolve(resultado));

    // Faz o builder se comportar como a Promise que `await query` espera.
    builder.then = (onFulfilled: any, onRejected: any) =>
        Promise.resolve(resultado).then(onFulfilled, onRejected);

    return builder;
}

/** Cria um mock de `supabase.storage.from(bucket)` (usado por serviços que mexem em arquivos). */
export function criarStorageBuilderMock(resultado: QueryResult) {
    return {
        remove: jest.fn(() => Promise.resolve(resultado)),
        upload: jest.fn(() => Promise.resolve(resultado)),
        download: jest.fn(() => Promise.resolve(resultado)),
        createSignedUrl: jest.fn(() => Promise.resolve(resultado)),
        getPublicUrl: jest.fn(() => resultado),
    };
}
