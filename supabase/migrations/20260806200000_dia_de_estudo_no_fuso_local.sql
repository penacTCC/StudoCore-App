-- O dia de estudo é o do aparelho, não o do servidor.
--
-- Sintoma: uma sessão feita às 22h29 de 05/08 aparecia como "Hoje" no Banco no dia 06.
--
-- Causa: `sessoes_foco.data_sessao` é `DATE DEFAULT CURRENT_DATE` e o app nunca mandava a
-- coluna no insert — quem preenchia era o Postgres, que roda em **UTC** neste projeto. Em
-- UTC-3, tudo que começa depois das 21h cai no dia seguinte para o banco. São 24 linhas com
-- essa marca, a mais antiga de 06/05, e TODAS adiantadas em um dia — nenhuma atrasada, que
-- é a assinatura exata de um deslocamento de fuso e não de um erro de digitação de data.
--
-- O lado do app já foi corrigido: `salvarSessaoFoco` e `registrarBlocoComoFeito` carimbam
-- `data_sessao` com o dia local (`paraDataISO`), e a regra combinada é que a sessão conta no
-- dia em que COMEÇOU — a linha nasce quando a pessoa aperta "iniciar", então uma sessão que
-- atravessa a meia-noite fica no dia de origem. O DEFAULT continua na coluna, só que agora
-- como rede de segurança e não como caminho principal.
--
-- Aqui ficam o conserto do que já estava gravado e o último ponto que ainda lia a data no
-- servidor.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Devolve as sessões deslocadas para o dia em que aconteceram de verdade.
-- ─────────────────────────────────────────────────────────────────────────────
-- `created_at` é `timestamptz`, então ele guarda o instante certo: convertê-lo para o fuso
-- de Brasília reconstrói o dia que a pessoa viveu. O app é de uso local (TCC, usuários todos
-- no mesmo fuso); se um dia isso deixar de valer, o fuso de cada um precisa virar dado de
-- perfil, e não uma constante no SQL.
--
-- O filtro do `+1 dia` é de propósito: só corrige o deslocamento conhecido para frente. Uma
-- data editada à mão para um dia qualquer no passado não é efeito deste bug e fica de fora.
update public.sessoes_foco
set data_sessao = (created_at at time zone 'America/Sao_Paulo')::date
where data_sessao is not null
  and data_sessao = ((created_at at time zone 'America/Sao_Paulo')::date + 1);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. O ranking do grupo também recortava o período em UTC.
-- ─────────────────────────────────────────────────────────────────────────────
-- `CURRENT_DATE` aqui é UTC, e a coluna comparada (`data_sessao`) passa a ser local. O erro
-- aparecia na virada: num domingo às 21h, `date_trunc('week', CURRENT_DATE)` já apontava
-- para a segunda seguinte e o ranking "Semanal" zerava a semana inteira antes da hora.
--
-- Só as três linhas de data mudam; o resto da função é o mesmo da migration
-- 20260803160000_corrigir_tempo_sessoes.sql.
DROP FUNCTION IF EXISTS public.ranking_horas_membros_grupo(UUID, TEXT);

CREATE FUNCTION public.ranking_horas_membros_grupo(p_grupo_id UUID, p_periodo TEXT DEFAULT 'total')
RETURNS TABLE (user_id UUID, total_minutos BIGINT)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    s.user_id,
    COALESCE(SUM(s.tempo_minutos), 0)::BIGINT AS total_minutos
  FROM public.sessoes_foco s
  WHERE s.grupo_id = p_grupo_id
    AND s.status IN ('salvo', 'pendente')
    AND (
      p_periodo IS NULL
      OR p_periodo = 'total'
      OR (p_periodo = 'semanal' AND s.data_sessao >= date_trunc('week', (now() AT TIME ZONE 'America/Sao_Paulo')::DATE)::DATE)
      OR (p_periodo = 'mensal' AND s.data_sessao >= date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo')::DATE)::DATE)
      OR (p_periodo = 'anual' AND s.data_sessao >= date_trunc('year', (now() AT TIME ZONE 'America/Sao_Paulo')::DATE)::DATE)
    )
  GROUP BY s.user_id
  ORDER BY total_minutos DESC;
$$;

GRANT EXECUTE ON FUNCTION public.ranking_horas_membros_grupo(UUID, TEXT) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. O DEFAULT da coluna passa a ser o dia de Brasília.
-- ─────────────────────────────────────────────────────────────────────────────
-- Quem preenche `data_sessao` agora é o app. Mas enquanto o DEFAULT existir, ele vai ser
-- usado por qualquer caminho que esqueça a coluna — e não faz sentido que essa rede de
-- segurança seja justamente a que erra o dia.
alter table public.sessoes_foco
  alter column data_sessao set default (now() at time zone 'America/Sao_Paulo')::date;
