-- Chat com o anexo da sessão (Premium): tira dúvida sobre o formulário/prova já anexado e
-- pede questões parecidas. Evolução da análise única de `analisar-anexo-sessao` — aqui vira
-- conversa de múltiplas mensagens sobre o mesmo arquivo.

-- Cache do upload do arquivo na Gemini Files API. Sem isso, cada mensagem do chat teria que
-- reenviar o PDF inteiro em base64 pra IA de novo; com o arquivo já hospedado lá, as
-- mensagens seguintes só mandam uma referência (fileUri) pequena. O arquivo expira em ~48h
-- do lado do Google, por isso guardamos o prazo pra saber quando reenviar.
alter table public.arquivos
  add column if not exists gemini_file_uri text,
  add column if not exists gemini_file_expira_em timestamptz;

create table if not exists public.chat_anexo_mensagens (
  id uuid primary key default gen_random_uuid(),
  anexo_id uuid not null references public.arquivos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  papel text not null check (papel in ('user', 'model')),
  texto text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_anexo_mensagens_anexo_id_idx
  on public.chat_anexo_mensagens (anexo_id, created_at);

alter table public.chat_anexo_mensagens enable row level security;

-- Só o dono do anexo lê ou escreve as mensagens dele. `user_id` na mensagem é redundante
-- com o dono do anexo por desenho (nunca é de outra pessoa), mas evita um join a mais nas
-- policies e prepara terreno pra um dia um dono compartilhar o anexo sem reabrir a RLS toda.
create policy "chat_anexo_mensagens_select_dono"
  on public.chat_anexo_mensagens for select
  using (
    user_id = auth.uid()
    and exists (select 1 from public.arquivos a where a.id = anexo_id and a.user_id = auth.uid())
  );

create policy "chat_anexo_mensagens_insert_dono"
  on public.chat_anexo_mensagens for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.arquivos a where a.id = anexo_id and a.user_id = auth.uid())
  );
