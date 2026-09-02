-- Reserva de armazenamento para uploads do Backblaze B2.
--
-- A Edge Function `arquivos-b2` cria uma linha em `arquivos` antes de subir o binário ao
-- B2. Isso faz o limite de armazenamento contar imediatamente e impede upload órfão fora
-- do fluxo normal do app. Depois que o upload termina, o app atualiza essa mesma linha com
-- os metadados finais (sessão, público, grupos etc.).

alter table public.arquivos
  add column if not exists backblaze_file_id text,
  add column if not exists pendente_upload boolean not null default false;

create index if not exists arquivos_pendente_upload_idx
  on public.arquivos (created_at)
  where pendente_upload;
