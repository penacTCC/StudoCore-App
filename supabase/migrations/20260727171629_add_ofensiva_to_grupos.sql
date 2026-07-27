alter table public.grupos
add column if not exists ofensiva integer not null default 0,
add column if not exists melhor_ofensiva integer not null default 0,
add column if not exists ultima_data_estudo date;
