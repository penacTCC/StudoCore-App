-- Planos de assinatura (Grátis / Pro) e a camada de limites do servidor.
--
-- Base da seção 8 do docs/project-context.md. A regra que orienta tudo aqui: limite que
-- custa dinheiro (IA e armazenamento) é verificado NO SERVIDOR; o cliente lê os mesmos
-- números só para desenhar a UI e o paywall, nunca para autorizar.
--
-- Convenção em `planos_limites`: NULL = ilimitado, 0 = bloqueado para o plano.
-- Fuso: janela diária usa o dia LOCAL (America/Sao_Paulo), igual ao resto do app.

-- ---------------------------------------------------------------------------
-- 1. Tabela de limites por plano
-- ---------------------------------------------------------------------------
create table if not exists public.planos_limites (
  plano                       text primary key,
  rotulo                      text not null,

  -- Social e organização
  grupos_max                  integer,
  membros_por_grupo_max       integer,
  sala_foco_max               integer,
  planos_max                  integer,

  -- IA (as duas cotas são separadas de propósito: o quiz roda num modelo barato e
  -- diário; a análise de anexo roda um PDF num modelo caro e é mensal.)
  quiz_ia_por_dia             integer,
  anexos_ia_por_mes           integer,
  roadmap_ia_por_mes          integer,
  chat_ia_por_mes             integer,

  -- Competição e leitura de dados
  duelos_criados_por_dia      integer,
  comparacao_perfil_completa  boolean not null default false,
  historico_dias              integer,   -- janela VISÍVEL; o dado nunca é apagado
  analises_dias               integer,
  wrapped_mensal              boolean not null default false,

  -- Armazenamento (cota TOTAL acumulada, nunca mensal)
  armazenamento_bytes         bigint,
  arquivo_bytes_max           bigint
);

comment on table public.planos_limites is
  'Limites por plano. NULL = ilimitado, 0 = bloqueado. Fonte da verdade para servidor e UI.';
comment on column public.planos_limites.historico_dias is
  'Quantos dias de histórico o plano VISUALIZA. Sessão nunca é apagada (LGPD + Play Store).';
comment on column public.planos_limites.armazenamento_bytes is
  'Cota total acumulada do Vault, não mensal: o mês passa, o arquivo fica.';

insert into public.planos_limites (
  plano, rotulo,
  grupos_max, membros_por_grupo_max, sala_foco_max, planos_max,
  quiz_ia_por_dia, anexos_ia_por_mes, roadmap_ia_por_mes, chat_ia_por_mes,
  duelos_criados_por_dia, comparacao_perfil_completa, historico_dias, analises_dias,
  wrapped_mensal, armazenamento_bytes, arquivo_bytes_max
) values
  ('gratis', 'Grátis',
   3, 5, 12, 3,
   1, 2, 1, 0,
   1, false, 30, 7,
   false, 300 * 1024 * 1024, 25 * 1024 * 1024),
  ('pro', 'Pro',
   null, 50, 12, null,
   null, 50, 10, 300,
   null, true, null, null,
   true, 5368709120, 25 * 1024 * 1024)
on conflict (plano) do nothing;

alter table public.planos_limites enable row level security;

-- Preço/limite é informação pública do produto: qualquer usuário logado lê, ninguém escreve.
drop policy if exists "planos_limites_leitura" on public.planos_limites;
create policy "planos_limites_leitura" on public.planos_limites
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 2. Assinatura do usuário
-- ---------------------------------------------------------------------------
create table if not exists public.assinaturas (
  usuario_id     uuid primary key references auth.users(id) on delete cascade,
  plano          text not null default 'gratis' references public.planos_limites(plano),
  status         text not null default 'ativa' check (status in ('ativa', 'cancelada', 'expirada')),
  expira_em      timestamptz,
  origem         text,  -- 'play_store' | 'app_store' | 'cortesia' | 'teste'
  atualizado_em  timestamptz not null default now()
);

comment on table public.assinaturas is
  'Assinatura vigente. Só o service role escreve (webhook de loja / ativação manual).';

alter table public.assinaturas enable row level security;

-- O usuário lê a própria assinatura. Escrita é exclusiva do service role, que ignora RLS:
-- se o cliente pudesse escrever aqui, viraria Pro sozinho.
drop policy if exists "assinaturas_leitura_propria" on public.assinaturas;
create policy "assinaturas_leitura_propria" on public.assinaturas
  for select to authenticated using (usuario_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. Consumo de IA
-- ---------------------------------------------------------------------------
-- `janela` guarda '2026-09-02' para cota diária e '2026-09' para mensal. Uma tabela só,
-- em vez de uma por periodicidade, porque a chave já identifica o período.
create table if not exists public.consumo_ia (
  usuario_id  uuid not null references auth.users(id) on delete cascade,
  tipo        text not null check (tipo in ('quiz', 'anexo', 'roadmap', 'chat')),
  janela      text not null,
  quantidade  integer not null default 0,
  primary key (usuario_id, tipo, janela)
);

alter table public.consumo_ia enable row level security;

drop policy if exists "consumo_ia_leitura_propria" on public.consumo_ia;
create policy "consumo_ia_leitura_propria" on public.consumo_ia
  for select to authenticated using (usuario_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. Funções de plano
-- ---------------------------------------------------------------------------
create or replace function public.plano_do_usuario(p_usuario uuid default auth.uid())
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select a.plano
       from public.assinaturas a
      where a.usuario_id = p_usuario
        and a.status = 'ativa'
        and (a.expira_em is null or a.expira_em > now())),
    'gratis'
  );
$$;

comment on function public.plano_do_usuario is
  'Plano vigente do usuário. Assinatura ausente, cancelada ou vencida cai em gratis.';

create or replace function public.limites_do_usuario(p_usuario uuid default auth.uid())
returns public.planos_limites
language sql
stable
security definer
set search_path = public
as $$
  select l.* from public.planos_limites l
   where l.plano = public.plano_do_usuario(p_usuario);
$$;

-- Consome uma unidade de cota de IA e devolve o resultado. É SECURITY DEFINER e usa
-- auth.uid() internamente: a Edge Function chama com o JWT do usuário e não consegue
-- consumir cota de outra pessoa.
--
-- O incremento e a verificação acontecem no mesmo INSERT ... ON CONFLICT, então duas
-- requisições simultâneas não conseguem furar o limite.
create or replace function public.consumir_cota_ia(p_tipo text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_plano   text;
  v_limites public.planos_limites;
  v_limite  integer;
  v_janela  text;
  v_usado   integer;
begin
  if v_uid is null then
    raise exception 'Sem usuário autenticado' using errcode = '28000';
  end if;

  v_plano := public.plano_do_usuario(v_uid);
  select * into v_limites from public.planos_limites where plano = v_plano;

  case p_tipo
    when 'quiz' then
      v_limite := v_limites.quiz_ia_por_dia;
      v_janela := to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD');
    when 'anexo' then
      v_limite := v_limites.anexos_ia_por_mes;
      v_janela := to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYY-MM');
    when 'roadmap' then
      v_limite := v_limites.roadmap_ia_por_mes;
      v_janela := to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYY-MM');
    when 'chat' then
      v_limite := v_limites.chat_ia_por_mes;
      v_janela := to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYY-MM');
    else
      raise exception 'Tipo de cota desconhecido: %', p_tipo using errcode = '22023';
  end case;

  -- 0 = recurso bloqueado no plano; nem chega a criar linha de consumo.
  if v_limite = 0 then
    return jsonb_build_object(
      'permitido', false, 'usado', 0, 'limite', 0,
      'janela', v_janela, 'plano', v_plano, 'motivo', 'bloqueado_no_plano'
    );
  end if;

  insert into public.consumo_ia (usuario_id, tipo, janela, quantidade)
  values (v_uid, p_tipo, v_janela, 1)
  on conflict (usuario_id, tipo, janela) do update
     set quantidade = consumo_ia.quantidade + 1
   where v_limite is null or consumo_ia.quantidade < v_limite
  returning quantidade into v_usado;

  if v_usado is null then
    -- O UPDATE não passou no WHERE: a cota já estava cheia.
    select quantidade into v_usado
      from public.consumo_ia
     where usuario_id = v_uid and tipo = p_tipo and janela = v_janela;

    return jsonb_build_object(
      'permitido', false, 'usado', coalesce(v_usado, 0), 'limite', v_limite,
      'janela', v_janela, 'plano', v_plano, 'motivo', 'cota_esgotada'
    );
  end if;

  return jsonb_build_object(
    'permitido', true, 'usado', v_usado, 'limite', v_limite,
    'janela', v_janela, 'plano', v_plano
  );
end;
$$;

create or replace function public.consumo_na_janela(p_usuario uuid, p_tipo text, p_janela text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select quantidade from public.consumo_ia
                    where usuario_id = p_usuario and tipo = p_tipo and janela = p_janela), 0);
$$;

-- Devolve a cota sem consumir — para a UI mostrar "3 de 10 restantes" e o paywall.
create or replace function public.uso_do_plano()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_limites public.planos_limites;
  v_dia     text := to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD');
  v_mes     text := to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYY-MM');
begin
  if v_uid is null then
    raise exception 'Sem usuário autenticado' using errcode = '28000';
  end if;

  select * into v_limites from public.planos_limites
   where plano = public.plano_do_usuario(v_uid);

  return jsonb_build_object(
    'plano', v_limites.plano,
    'limites', to_jsonb(v_limites),
    'uso', jsonb_build_object(
      'quiz_hoje',        public.consumo_na_janela(v_uid, 'quiz', v_dia),
      'anexos_no_mes',    public.consumo_na_janela(v_uid, 'anexo', v_mes),
      'roadmaps_no_mes',  public.consumo_na_janela(v_uid, 'roadmap', v_mes),
      'chat_no_mes',      public.consumo_na_janela(v_uid, 'chat', v_mes),
      'grupos',           (select count(*) from public.membros m
                            where m.user_id = v_uid and m.administrador),
      'planos',           (select count(*) from public.planos p where p.usuario_id = v_uid),
      'armazenamento_bytes', coalesce((select sum(a.tamanho_bytes) from public.arquivos a
                                        where a.user_id = v_uid), 0)
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Limites estruturais por trigger
-- ---------------------------------------------------------------------------
-- Mensagem padronizada `LIMITE_PLANO:<recurso>` para o app reconhecer e abrir o paywall
-- em vez de mostrar erro cru de banco.

create or replace function public.checar_limite_de_grupos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max          integer;
  v_atual        integer;
  v_dono         uuid;
  v_membros_max  integer;
  v_membros      integer;
begin
  -- (a) Quantos grupos a pessoa pode ADMINISTRAR.
  if new.administrador then
    select grupos_max into v_max from public.limites_do_usuario(new.user_id);
    if v_max is not null then
      select count(*) into v_atual from public.membros
       where user_id = new.user_id and administrador;
      if v_atual >= v_max then
        raise exception 'LIMITE_PLANO:grupos' using errcode = 'P0001';
      end if;
    end if;
  end if;

  -- (b) Tamanho do grupo sai do plano do DONO, não de quem está entrando: quem paga
  -- pelo grupo grande é quem o administra.
  select user_id into v_dono from public.membros
   where grupo_id = new.grupo_id and administrador
   order by joined_at limit 1;

  if v_dono is not null then
    select membros_por_grupo_max into v_membros_max from public.limites_do_usuario(v_dono);
    if v_membros_max is not null then
      select count(*) into v_membros from public.membros where grupo_id = new.grupo_id;
      if v_membros >= v_membros_max then
        raise exception 'LIMITE_PLANO:membros_por_grupo' using errcode = 'P0001';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_limite_de_grupos on public.membros;
create trigger trg_limite_de_grupos
  before insert on public.membros
  for each row execute function public.checar_limite_de_grupos();

create or replace function public.checar_limite_de_planos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max   integer;
  v_atual integer;
begin
  select planos_max into v_max from public.limites_do_usuario(new.usuario_id);
  if v_max is null then
    return new;
  end if;

  select count(*) into v_atual from public.planos where usuario_id = new.usuario_id;
  if v_atual >= v_max then
    raise exception 'LIMITE_PLANO:planos' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_limite_de_planos on public.planos;
create trigger trg_limite_de_planos
  before insert on public.planos
  for each row execute function public.checar_limite_de_planos();

create or replace function public.checar_limite_de_armazenamento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limites public.planos_limites;
  v_usado   bigint;
  v_novo    bigint := coalesce(new.tamanho_bytes, 0);
begin
  select * into v_limites from public.limites_do_usuario(new.user_id);

  if v_limites.arquivo_bytes_max is not null and v_novo > v_limites.arquivo_bytes_max then
    raise exception 'LIMITE_PLANO:tamanho_do_arquivo' using errcode = 'P0001';
  end if;

  if v_limites.armazenamento_bytes is not null then
    select coalesce(sum(tamanho_bytes), 0) into v_usado
      from public.arquivos where user_id = new.user_id;
    if v_usado + v_novo > v_limites.armazenamento_bytes then
      raise exception 'LIMITE_PLANO:armazenamento' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_limite_de_armazenamento on public.arquivos;
create trigger trg_limite_de_armazenamento
  before insert on public.arquivos
  for each row execute function public.checar_limite_de_armazenamento();

-- ---------------------------------------------------------------------------
-- 6. Permissões (o app roda só como `authenticated`; anon não enxerga nada)
-- ---------------------------------------------------------------------------
revoke all on function public.plano_do_usuario(uuid)                 from public, anon;
revoke all on function public.limites_do_usuario(uuid)               from public, anon;
revoke all on function public.consumir_cota_ia(text)                 from public, anon;
revoke all on function public.uso_do_plano()                         from public, anon;
revoke all on function public.consumo_na_janela(uuid, text, text)    from public, anon;

grant execute on function public.plano_do_usuario(uuid)   to authenticated;
grant execute on function public.limites_do_usuario(uuid) to authenticated;
grant execute on function public.consumir_cota_ia(text)   to authenticated;
grant execute on function public.uso_do_plano()           to authenticated;

revoke all on public.planos_limites from anon;
revoke all on public.assinaturas    from anon;
revoke all on public.consumo_ia     from anon;
