-- Ofensiva coletiva do grupo (streak), mesmo formato usado em public.gamificacoes
-- pra ofensiva individual: contador atual, recorde e último dia em que a
-- sequência foi contabilizada. Fica direto em grupos (não numa tabela à parte)
-- porque é 1:1 com o grupo, sem o motivo de desacoplamento que gamificacoes tem
-- em relação a profiles (identidade de usuário vs. mecânica de jogo).
alter table public.grupos
add column if not exists ofensiva integer not null default 0,
add column if not exists melhor_ofensiva integer not null default 0,
add column if not exists ultima_data_estudo date;
