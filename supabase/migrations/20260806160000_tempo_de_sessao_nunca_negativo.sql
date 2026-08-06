-- Horas negativas no perfil.
--
-- Sintoma: o perfil mostrava total de estudo NEGATIVO (o aalps chegou a -179h). A causa
-- estava em `sessoes_foco.tempo_minutos`: sete linhas antigas foram gravadas com valores
-- como -10.790 e -21.597 minutos. Divididos pelo fator do modo de testes (360x, ver
-- services/modoTeste.ts), eles dão exatamente -1800s e -3600s — a duração da fase do
-- pomodoro entrando com o sinal trocado, ou seja, o tempo RESTANTE sendo gravado como
-- tempo decorrido logo na largada da sessão.
--
-- O lado do app já não produz isso: `escalarSegundos` descarta qualquer valor <= 0 antes
-- de virar minuto. O que faltava era o passado. Essas linhas ficaram meses paradas em
-- "pausado" (status que não conta em lugar nenhum) até `fecharSessoesAbandonadas` fechá-las
-- como "salvo" — e aí, de uma vez, o valor negativo entrou em todos os totais.
--
-- Aqui ficam a limpeza do que já estava gravado e a trava para nunca mais acontecer.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Zera o tempo das sessões negativas.
-- ─────────────────────────────────────────────────────────────────────────────
-- Zero, e não um valor "consertado": não há como saber quanto dessas sessões foi estudado
-- de verdade — elas nasceram com o cronômetro invertido e nenhuma delas chegou a ser
-- encerrada pela pessoa. Inventar minutos aqui seria o mesmo erro com o sinal certo.
update public.sessoes_foco
set tempo_minutos = 0
where tempo_minutos < 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Zera o contador legado de horas do perfil quando ele ficou negativo.
-- ─────────────────────────────────────────────────────────────────────────────
-- `profiles.horas_totais` é um acumulado escrito a cada sessão, e ele levou o mesmo tombo.
-- Quem manda no que a tela mostra é a soma de `sessoes_foco` (ver services/profileStats.ts),
-- mas deixar um número impossível na coluna só faria a próxima soma parcial errar de novo.
update public.profiles
set horas_totais = 0
where horas_totais < 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Trava: tempo estudado não pode ser negativo.
-- ─────────────────────────────────────────────────────────────────────────────
-- Um bug de cronômetro no app volta a ser um erro visível na hora de gravar, em vez de
-- virar silenciosamente uma hora negativa espalhada por perfil, ranking e meta de grupo.
alter table public.sessoes_foco
  drop constraint if exists sessoes_foco_tempo_minutos_nao_negativo;

alter table public.sessoes_foco
  add constraint sessoes_foco_tempo_minutos_nao_negativo
  check (tempo_minutos >= 0);

alter table public.tab_sessao_membros
  drop constraint if exists tab_sessao_membros_tempo_segundos_nao_negativo;

update public.tab_sessao_membros
set tempo_segundos = 0
where tempo_segundos < 0;

alter table public.tab_sessao_membros
  add constraint tab_sessao_membros_tempo_segundos_nao_negativo
  check (tempo_segundos >= 0);
