-- Adiciona o vínculo opcional entre uma sessão de foco e o grupo onde ela aconteceu.
alter table public.sessoes_foco
add column if not exists grupo_id uuid references public.grupos(id) on delete set null;

-- Cria índice para acelerar o live feed e o cálculo de progresso semanal por grupo.
create index if not exists sessoes_foco_grupo_id_data_sessao_idx
on public.sessoes_foco (grupo_id, data_sessao desc);
