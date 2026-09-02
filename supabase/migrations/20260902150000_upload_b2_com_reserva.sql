-- Reserva de armazenamento para uploads do Backblaze B2.
--
-- A Edge Function `arquivos-b2` cria uma linha em `arquivos` antes de subir o binário ao
-- B2. Isso faz o limite de armazenamento contar imediatamente e impede upload órfão fora
-- do fluxo normal do app. Depois que o upload termina, o app atualiza essa mesma linha com
-- os metadados finais (sessão, público, grupos etc.).

alter table public.arquivos
  add column if not exists backblaze_file_id text,
  add column if not exists pendente_upload boolean not null default false;

-- `backblaze_file_id` nasceu NOT NULL, de quando a linha só era criada depois do upload.
-- Com a reserva, a linha existe antes de o B2 devolver o id: manter o NOT NULL fazia o
-- insert de reserva falhar com 23502 e a Edge Function responder 403 "Não foi possível
-- reservar armazenamento.". O id é preenchido logo em seguida, no mesmo request.
alter table public.arquivos
  alter column backblaze_file_id drop not null;

create index if not exists arquivos_pendente_upload_idx
  on public.arquivos (created_at)
  where pendente_upload;
