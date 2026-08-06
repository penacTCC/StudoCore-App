-- Sessão fantasma: linha de `sessoes_foco` com `grupo_id` de um grupo do qual o autor não
-- é membro.
--
-- De onde vinham: o "último grupo" é guardado no AsyncStorage do APARELHO, não da conta.
-- Ao trocar de conta no mesmo aparelho, a conta nova herdava o id do grupo de quem usou o
-- app antes, e a tela de foco usava esse id como fallback ao gravar a sessão. O resultado
-- era uma sessão que aparecia no feed do grupo e somava na meta semanal dele, mas cujo
-- autor não estava na lista de membros nem no ranking — os dois leem `membros`.
--
-- O lado do app já foi corrigido (o id salvo agora carrega o dono, e `salvarSessaoFoco` /
-- `atualizarSessaoFoco` descartam `grupo_id` de quem não é membro). Aqui ficam a limpeza
-- do que já estava gravado e a mesma regra do lado do banco.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Desvincula as sessões fantasma já gravadas.
-- ─────────────────────────────────────────────────────────────────────────────
-- Só o vínculo com o grupo é removido: o estudo continua no histórico pessoal do autor,
-- que é onde ele sempre deveria ter estado.
update public.sessoes_foco s
set grupo_id = null
where s.grupo_id is not null
  and not exists (
    select 1 from public.membros m
    where m.user_id = s.user_id and m.grupo_id = s.grupo_id
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Zera a ofensiva dos grupos cuja última data de estudo pode ter vindo dessas sessões.
-- ─────────────────────────────────────────────────────────────────────────────
-- `ultima_data_estudo` é o que impede o recálculo de rodar de novo no mesmo dia. Se a cota
-- daquele dia só bateu por causa de uma sessão fantasma, deixar a data como está congela a
-- ofensiva num valor que o grupo não conquistou. Recuar a data faz o próximo
-- `registrar_ofensiva_grupo` recalcular o dia com a regra nova.
update public.grupos g
set ultima_data_estudo = null
where g.ultima_data_estudo >= (current_date - 7);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. A ofensiva do grupo passa a contar apenas sessões de quem é membro hoje.
-- ─────────────────────────────────────────────────────────────────────────────
-- Única mudança em relação a 20260803190000_rpc_ofensiva_grupo: o `exists` sobre `membros`
-- na soma dos minutos do dia. Sem ele, a cota diária podia ser batida por uma sessão
-- fantasma (ou por alguém que saiu do grupo depois de estudar).
create or replace function public.registrar_ofensiva_grupo(p_grupo_id uuid)
returns table(meta_horas integer, ofensiva integer, melhor_ofensiva integer, ultima_data_estudo date)
language plpgsql
security definer
set search_path to 'public'
as $function$
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
    and s.data_sessao = v_hoje
    -- Quem não é membro hoje não empurra a ofensiva do grupo.
    and exists (
      select 1 from public.membros m
      where m.grupo_id = p_grupo_id and m.user_id = s.user_id
    );

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
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Tempos absurdos deixados por builds antigos.
-- ─────────────────────────────────────────────────────────────────────────────
-- Resíduo de uma mistura de unidade (ms tratado como valor já escalado) combinada com o
-- modo de testes 360×, de antes dos ajustes de `calculateFocusSessionMinutes`. O maior era
-- de 3.601.392 minutos — 60.023 horas numa sessão só. O código atual não produz mais isso,
-- mas os valores continuam inflando as horas totais de quem os tem.
--
-- O corte é 44.640 minutos (31 dias) e NÃO 24h de propósito: com o modo de testes ligado,
-- 1h de relógio real vira 360h contabilizadas, então valores de vários dias são legítimos e
-- precisam sobreviver. Acima de 31 dias não há sessão possível nem em modo de testes.
--
-- Zera em vez de aparar num teto: não existe valor verdadeiro a recuperar dessas linhas, e
-- um teto arbitrário seria só um número inventado mais discreto.
update public.sessoes_foco
set tempo_minutos = 0
where tempo_minutos > 44640;
