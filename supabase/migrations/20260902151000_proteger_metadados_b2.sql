-- Metadados de arquivo que impactam custo/posse não podem ser alterados pelo cliente.
--
-- `arquivos-b2` grava esses campos com service role depois de validar o upload. Um app
-- modificado não pode reduzir `tamanho_bytes`, trocar `storage_path` ou apontar a linha
-- para outro `backblaze_file_id` para burlar cota ou posse.

create or replace function public.proteger_metadados_b2()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    raise exception 'Arquivos devem ser criados pela função segura de upload'
      using errcode = '42501';
  end if;

  if new.user_id is distinct from old.user_id
     or new.storage_path is distinct from old.storage_path
     or new.tamanho_bytes is distinct from old.tamanho_bytes
     or new.backblaze_file_id is distinct from old.backblaze_file_id then
    raise exception 'Metadados de armazenamento não podem ser alterados pelo cliente'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteger_metadados_b2 on public.arquivos;
create trigger trg_proteger_metadados_b2
  before insert or update on public.arquivos
  for each row execute function public.proteger_metadados_b2();
