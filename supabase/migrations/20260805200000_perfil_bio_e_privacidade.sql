-- A tela de editar perfil passou a ter bio livre e dois interruptores de privacidade.
--
-- Até aqui a "bio" do perfil era derivada do `objetivo` escolhido no onboarding
-- (ver constants/helpers.ts:getBioFromObjetivo), o que dava a todo mundo com o mesmo
-- objetivo exatamente o mesmo texto. `bio` guarda o texto que o usuário escreve; o
-- objetivo continua sendo o fallback de quem nunca escreveu nada.
--
-- `perfil_publico` controla se outras pessoas veem as estatísticas no perfil do membro;
-- `mostrar_ofensiva` esconde o selo de dias seguidos no avatar. Ambos começam ligados
-- pra não mudar o comportamento de quem já usa o app.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS perfil_publico BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS mostrar_ofensiva BOOLEAN NOT NULL DEFAULT TRUE;
