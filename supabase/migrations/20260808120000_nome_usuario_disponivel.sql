-- Checagem de @usuário disponível que funciona ANTES do login.
--
-- A policy de SELECT em `profiles` exige `authenticated`. Na tela de cadastro ninguém
-- está logado ainda, então a consulta direta voltava sempre vazia e o formulário
-- carimbava "✓ disponível" em qualquer nome — inclusive nos já tomados. A pessoa só
-- descobria o choque no fim do onboarding, quando o UNIQUE do banco derrubava o insert.
--
-- SECURITY DEFINER de propósito, liberada para `anon`: é o que permite responder sem
-- sessão. O retorno é só um booleano, então isto não expõe nenhuma linha de `profiles`
-- (nome real, foto, e-mail) — apenas confirma se um @ está livre, que é exatamente o que
-- qualquer formulário de cadastro precisa revelar.
create or replace function public.nome_usuario_disponivel(p_nome text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select not exists (
    select 1
    from public.profiles
    -- Comparação sem diferenciar maiúsculas: o UNIQUE da coluna é sensível a caixa, então
    -- "Joao" e "joao" caberiam os dois no banco e viraria par de contas confundíveis.
    -- Aqui a checagem é mais rigorosa que a constraint, o que nunca gera um falso "livre".
    where lower(nome_usuario) = lower(btrim(p_nome))
      -- Deixa a própria pessoa manter o @ dela na tela de editar perfil. Para o `anon`,
      -- auth.uid() é null e a comparação sobra verdadeira, varrendo a tabela inteira.
      and id is distinct from auth.uid()
  );
$$;

comment on function public.nome_usuario_disponivel(text) is
  'Retorna true se o @usuário está livre. Exposta ao anon para a tela de cadastro; devolve apenas booleano.';

revoke execute on function public.nome_usuario_disponivel(text) from public;
grant execute on function public.nome_usuario_disponivel(text) to anon, authenticated;
