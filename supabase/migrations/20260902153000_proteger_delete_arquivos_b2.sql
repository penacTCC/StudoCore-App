-- Fecha o DELETE de `arquivos` no trigger, não só na RLS.
--
-- `proteger_metadados_b2` cobria INSERT e UPDATE e deixava DELETE de fora. Enquanto a RLS
-- do Cofre esteve incompleta, isso significou nenhuma barreira: dava para apagar só a linha
-- de metadado, liberar cota no app e deixar o objeto físico órfão no B2, pagando storage
-- por arquivo que ninguém mais enxerga. A policy `Cliente nao apaga arquivos diretamente`
-- já fecha o caminho hoje; o trigger existe para o dia em que alguém afrouxar a policy sem
-- perceber o que ela sustentava.
--
-- Não há cascata chegando aqui: `arquivos.user_id` e `arquivos.sessao_id` são ON DELETE SET
-- NULL, então apagar perfil ou sessão nunca dispara este trigger. Quem apaga de verdade é a
-- ação `excluir` da Edge Function, com service role, depois de tirar o arquivo do bucket.

create or replace function public.proteger_metadados_b2()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'service_role' then
    -- BEFORE DELETE precisa devolver OLD; devolver NEW (nulo) cancelaria a exclusão.
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    raise exception 'Arquivos devem ser criados pela função segura de upload'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    raise exception 'Arquivos devem ser apagados pela função segura de exclusão'
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
  before insert or update or delete on public.arquivos
  for each row execute function public.proteger_metadados_b2();
