-- Fecha o Cofre no banco para a Edge Function `arquivos-b2` ser a única porta de
-- criação/exclusão de metadados sensíveis.
--
-- Sem RLS explícita em `arquivos`, a checagem de download da Edge Function poderia ler uma
-- linha alheia como usuário autenticado e gerar URL assinada para quem soubesse o path.
-- Sem bloquear DELETE direto, um app modificado poderia apagar só o metadado, liberar cota
-- no app e deixar o objeto físico órfão no B2.

alter table public.arquivos enable row level security;
alter table public.arquivos_grupos enable row level security;

create or replace function public.usuario_dono_arquivo(p_arquivo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.arquivos a
    where a.id = p_arquivo_id
      and a.user_id = auth.uid()
  );
$$;

create or replace function public.usuario_membro_grupo(p_grupo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.membros m
    where m.grupo_id = p_grupo_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.usuario_recebeu_arquivo_por_grupo(p_arquivo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.arquivos_grupos ag
    join public.membros m on m.grupo_id = ag.grupo_id
    where ag.arquivo_id = p_arquivo_id
      and m.user_id = auth.uid()
  );
$$;

drop policy if exists "Visualizar arquivos permitidos" on public.arquivos;
create policy "Visualizar arquivos permitidos"
  on public.arquivos for select
  using (
    user_id = auth.uid()
    or public.usuario_recebeu_arquivo_por_grupo(id)
    or (publico and public.comunidade_autor_visivel(user_id))
  );

drop policy if exists "Dono atualiza metadados editaveis do arquivo" on public.arquivos;
create policy "Dono atualiza metadados editaveis do arquivo"
  on public.arquivos for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Cliente nao cria arquivos diretamente" on public.arquivos;
create policy "Cliente nao cria arquivos diretamente"
  on public.arquivos for insert
  with check (false);

drop policy if exists "Cliente nao apaga arquivos diretamente" on public.arquivos;
create policy "Cliente nao apaga arquivos diretamente"
  on public.arquivos for delete
  using (false);

drop policy if exists "Ver compartilhamentos de arquivos permitidos" on public.arquivos_grupos;
create policy "Ver compartilhamentos de arquivos permitidos"
  on public.arquivos_grupos for select
  using (
    public.usuario_dono_arquivo(arquivo_id)
    or public.usuario_membro_grupo(grupo_id)
  );

drop policy if exists "Dono compartilha arquivo com grupos onde participa" on public.arquivos_grupos;
create policy "Dono compartilha arquivo com grupos onde participa"
  on public.arquivos_grupos for insert
  with check (
    public.usuario_dono_arquivo(arquivo_id)
    and public.usuario_membro_grupo(grupo_id)
  );

drop policy if exists "Dono remove compartilhamento do arquivo" on public.arquivos_grupos;
create policy "Dono remove compartilhamento do arquivo"
  on public.arquivos_grupos for delete
  using (public.usuario_dono_arquivo(arquivo_id));

revoke all on function public.usuario_dono_arquivo(uuid) from public, anon;
revoke all on function public.usuario_membro_grupo(uuid) from public, anon;
revoke all on function public.usuario_recebeu_arquivo_por_grupo(uuid) from public, anon;

grant execute on function public.usuario_dono_arquivo(uuid) to authenticated;
grant execute on function public.usuario_membro_grupo(uuid) to authenticated;
grant execute on function public.usuario_recebeu_arquivo_por_grupo(uuid) to authenticated;

-- Policies legadas, de antes de a Edge Function virar a única porta do Cofre.
--
-- Elas precisam sair, não só serem substituídas: policies permissivas se combinam com OR,
-- então "Cliente nao apaga arquivos diretamente" (using false) somada a "Dono remove
-- arquivo" (using user_id = auth.uid()) continua deixando o cliente apagar. Como o trigger
-- `proteger_metadados_b2` só cobre INSERT e UPDATE, o DELETE direto era o buraco inteiro
-- que esta migration existe para fechar: apagar o metadado, liberar cota no app e deixar o
-- objeto físico órfão no B2.
drop policy if exists "Dono remove arquivo" on public.arquivos;
drop policy if exists "Usuario cria arquivo" on public.arquivos;
-- Predicado idêntico ao de "Dono atualiza metadados editaveis do arquivo"; some por ser
-- duplicata, não por mudar permissão.
drop policy if exists "Dono edita arquivo" on public.arquivos;

-- Mesma equivalência do lado dos compartilhamentos: `pode_vincular_arquivo_ao_grupo` faz
-- exatamente o que `usuario_dono_arquivo AND usuario_membro_grupo` faz.
drop policy if exists "Usuarios inserem grupos em seus arquivos" on public.arquivos_grupos;
drop policy if exists "Visualizar vinculos de grupos permitidos" on public.arquivos_grupos;
drop policy if exists "Usuarios deletam grupos de seus arquivos" on public.arquivos_grupos;

-- Esta era mais larga do que parecia: qualquer membro do grupo podia vincular QUALQUER
-- `arquivo_id` ao grupo, inclusive arquivo de outra pessoa, bastando saber o id.
drop policy if exists "membros enviam arquivos" on public.arquivos_grupos;

-- Remoção de compartilhamento por administrador do grupo. Nenhuma tela chama DELETE em
-- `arquivos_grupos` hoje, então a policy só ampliava a superfície sem servir a nada; se a
-- moderação de grupo voltar, ela volta junto com a tela que a usa.
drop policy if exists "autor ou admin remove o arquivo" on public.arquivos_grupos;
