// Silencia o editor sobre o global `Deno` nas Edge Functions — essa pasta é excluída do
// tsconfig do app (roda no runtime Deno do Supabase, não no bundle React Native).
declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: { get: (key: string) => string | undefined };
};
