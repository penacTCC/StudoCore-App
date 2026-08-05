-- Ofensiva coletiva do grupo via RPC.
--
-- Antes o app fazia o UPDATE em `grupos` direto do cliente. Como a policy de UPDATE
-- da tabela só libera o dono/admin do grupo, quando um membro comum terminava uma
-- sessão o update afetava 0 linhas e o `.select().single()` estourava PGRST116
-- ("Cannot coerce the result to a single JSON object").
--
-- Aqui a regra vira uma função SECURITY DEFINER: qualquer membro do grupo pode
-- disparar o recálculo, mas quem escreve é a função (não o usuário), e a lógica
-- roda numa transação só — some também a corrida entre dois membros terminando
-- sessão ao mesmo tempo.

create or replace function public.registrar_ofensiva_grupo(p_grupo_id uuid)
returns table (
  meta_horas integer,
  ofensiva integer,
  melhor_ofensiva integer,
  ultima_data_estudo date
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grupo public.grupos%rowtype;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_qtd_membros integer;
  v_meta_diaria_minutos numeric;
  v_minutos_hoje numeric;
  v_nova_ofensiva integer;
begin
  -- Só membro do grupo mexe na ofensiva dele.
  if not exists (
    select 1 from public.membros m
    where m.grupo_id = p_grupo_id and m.user_id = auth.uid()
  ) then
    raise exception 'Usuário não é membro do grupo %', p_grupo_id
      using errcode = '42501';
  end if;

  -- Trava a linha do grupo: dois membros terminando sessão junto não duplicam a ofensiva.
  select * into v_grupo from public.grupos g where g.id = p_grupo_id for update;
  if not found then
    raise exception 'Grupo % não encontrado', p_grupo_id using errcode = 'P0002';
  end if;

  -- Cota do dia já contabilizada — nada a recalcular.
  if v_grupo.ultima_data_estudo = v_hoje then
    return query select v_grupo.meta_horas, v_grupo.ofensiva, v_grupo.melhor_ofensiva, v_grupo.ultima_data_estudo;
    return;
  end if;

  select count(*) into v_qtd_membros from public.membros m where m.grupo_id = p_grupo_id;
  if v_qtd_membros = 0 then
    return query select v_grupo.meta_horas, v_grupo.ofensiva, v_grupo.melhor_ofensiva, v_grupo.ultima_data_estudo;
    return;
  end if;

  -- Fração diária da meta semanal do grupo, em minutos.
  v_meta_diaria_minutos := (v_grupo.meta_horas * v_qtd_membros / 7.0) * 60;

  select coalesce(sum(s.tempo_minutos), 0) into v_minutos_hoje
  from public.sessoes_foco s
  where s.grupo_id = p_grupo_id
    and s.status in ('salvo', 'pendente')
    and s.data_sessao = v_hoje;

  -- Ainda não bateu a cota do dia — espera mais sessões dos membros chegarem.
  if v_minutos_hoje < v_meta_diaria_minutos then
    return query select v_grupo.meta_horas, v_grupo.ofensiva, v_grupo.melhor_ofensiva, v_grupo.ultima_data_estudo;
    return;
  end if;

  -- Regra Duolingo: bateu a cota ontem -> +1; pulou um dia -> reseta pra 1.
  v_nova_ofensiva := case
    when v_grupo.ultima_data_estudo = v_hoje - 1 then v_grupo.ofensiva + 1
    else 1
  end;

  return query
  update public.grupos g
  set ofensiva = v_nova_ofensiva,
      melhor_ofensiva = greatest(g.melhor_ofensiva, v_nova_ofensiva),
      ultima_data_estudo = v_hoje
  where g.id = p_grupo_id
  returning g.meta_horas, g.ofensiva, g.melhor_ofensiva, g.ultima_data_estudo;
end;
$$;

revoke all on function public.registrar_ofensiva_grupo(uuid) from public;
grant execute on function public.registrar_ofensiva_grupo(uuid) to authenticated;
