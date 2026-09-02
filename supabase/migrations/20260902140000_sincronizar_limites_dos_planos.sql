-- Sincroniza os limites de produto vigentes.
--
-- A migration original criou as linhas com `on conflict do nothing`; isso é seguro para
-- bootstrap, mas não corrige bancos onde a linha já existia com valores antigos. Esta
-- migration é deliberadamente um upsert com atualização para fazer o remoto bater com a
-- tabela documentada em `docs/project-context.md`.

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
on conflict (plano) do update set
  rotulo = excluded.rotulo,
  grupos_max = excluded.grupos_max,
  membros_por_grupo_max = excluded.membros_por_grupo_max,
  sala_foco_max = excluded.sala_foco_max,
  planos_max = excluded.planos_max,
  quiz_ia_por_dia = excluded.quiz_ia_por_dia,
  anexos_ia_por_mes = excluded.anexos_ia_por_mes,
  roadmap_ia_por_mes = excluded.roadmap_ia_por_mes,
  chat_ia_por_mes = excluded.chat_ia_por_mes,
  duelos_criados_por_dia = excluded.duelos_criados_por_dia,
  comparacao_perfil_completa = excluded.comparacao_perfil_completa,
  historico_dias = excluded.historico_dias,
  analises_dias = excluded.analises_dias,
  wrapped_mensal = excluded.wrapped_mensal,
  armazenamento_bytes = excluded.armazenamento_bytes,
  arquivo_bytes_max = excluded.arquivo_bytes_max;
