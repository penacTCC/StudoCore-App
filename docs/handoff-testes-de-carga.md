# Handoff — Testes de carga no Supabase local

Documento de contexto para quem for continuar os testes de carga (Codex, Claude Code, ou eu
mesmo daqui a duas semanas). Escrito em 2026-09-03, a partir de uma sessão que parou no meio.

---

## 1. Para que servem estes testes

Preencher esta tabela do TCC (seção "iii. Carga"). Cada linha precisa de um número medido, não
estimado:

| Cenário | Carga | Situação |
| --- | --- | --- |
| Usuários realizando login simultaneamente | ? | cenário não existe |
| Usuários entrando em uma mesma sala de estudo | ? | escrito, **quebrado** (bloqueio A) |
| Sessões de foco funcionando simultaneamente | 100 sessões (já definido) | parcial (depende do bloqueio A) |
| Usuários registrando sessões de estudo simultaneamente | ? | escrito, **nunca rodado em rampa** |
| Usuários consultando o ranking simultaneamente | ? | cenário não existe |
| Usuários utilizando a IA simultaneamente | ? | cenário não existe, precisa de decisão |
| Registros armazenados no banco de dados | ? | cenário não existe (é volumetria, não concorrência) |

---

## 2. REGRA INVIOLÁVEL: produção não se toca

Um teste de carga anterior rodou contra o projeto hospedado e **estourou a cota do plano Free**
(pico de 501 conexões de Realtime contra um limite de 200). Esse número é o PICO do ciclo de
faturamento e não desce quando o teste acaba.

Por isso:

- Todo teste roda contra `http://127.0.0.1:54321`. `scripts/load/_comum.mjs` já tem um guard que
  aborta se a URL não for local; só passa com `PERMITIR_REMOTO=1` digitado à mão. **Não use essa
  flag.**
- **Não aplique migration nenhuma no banco remoto.** Nem por MCP, nem por `db push`, nem pelo
  dashboard.
- Ler o schema remoto (SELECT em catálogo via MCP) é permitido e útil. Escrever, não.
- `supabase db push` é especialmente perigoso neste repositório — ver seção 6.

---

## 3. O que já existe e funciona

Tudo commitado em `fb0e9b6`.

### Ambiente local

O stack sobe com podman (não há docker nesta máquina):

```sh
systemctl --user start podman.socket
export DOCKER_HOST=unix:///run/user/$(id -u)/podman/podman.sock
npx supabase start
npx supabase db reset     # aplica a cadeia inteira de migrations
```

Para rodar SQL direto no banco local:

```sh
podman exec -i supabase_db_StudoCore-Mobile psql -U postgres -d postgres -c "<sql>"
```

Chaves locais são as padrão do CLI e estão embutidas em `scripts/load/_comum.mjs`.

### Harness (`scripts/load/`)

| Arquivo | O que é |
| --- | --- |
| `_comum.mjs` | Guard anti-produção, assinatura de JWT, criação de client por usuário, estatísticas (p50/p95), `assinarCanal`, execução em lotes |
| `seed.mjs` | Cria N contas reais em `auth.users` + `profiles` + grupos + `membros`. Idempotente. Guarda ids em `.seed.local.json` |
| `cenario-conexoes.mjs` | **Funciona.** N usuários com o app aberto (1 WebSocket + 2 canais cada), mede taxa de conexão, latência até SUBSCRIBED e entrega ponta a ponta |
| `cenario-sala.mjs` | **Quebrado** (bloqueio A). N pessoas numa sala de foco |
| `cenario-sessoes.mjs` | Escrito, nunca rodado em rampa. N usuários distintos gravando sessão |
| `runner.mjs` | Roda um cenário em vários tamanhos e cospe a tabela em Markdown pronta pro TCC |

Os três arquivos antigos (`presence-load.mjs`, `salas-load.mjs`, `sessions-load.mjs`) são a
versão anterior, que apontava para produção e usava uma única identidade. Estão lá só como
histórico — **não use, e considere apagar.**

Uso:

```sh
node scripts/load/seed.mjs                      # 300 contas, 10 grupos
USUARIOS=600 GRUPOS=20 node scripts/load/seed.mjs
node scripts/load/runner.mjs conexoes 25 50 100 200
node scripts/load/runner.mjs sessoes 10 30 60 100
```

### Decisão de projeto que economiza tempo

O harness **assina o próprio JWT** com o segredo local em vez de fazer login pelo GoTrue. Motivo:
o local limita sign-in a 30 requisições por 5 minutos por IP
(`auth.rate_limit.sign_in_sign_ups` no `config.toml`), o que impediria autenticar 300 usuários
simulados. O token assinado é aceito por PostgREST e pelo Realtime igual ao real, e o
`auth.uid()` que a RLS enxerga é o do usuário — que é o que importa.

Contrapartida explícita: **estes testes não medem o endpoint de login.** A linha "usuários
realizando login simultaneamente" precisa de um cenário próprio que use
`signInWithPassword` de verdade, e para isso o rate limit local tem que subir.

### Correções de migration já feitas (a cadeia agora reconstrói do zero)

Antes disso, `supabase db reset` quebrava e não havia ambiente local:

1. `20260409192430_database.sql` — coluna `questoes_feitas` estava duplicada no `CREATE TABLE`.
2. `20260626093714_create_gamificacoes_table.sql` — o backfill lia `profiles.ofensiva` e
   `profiles.ultima_data_estudo`, colunas que nunca existiram em migration nenhuma. Virou
   condicional, dentro de um `DO $$ ... IF EXISTS (information_schema.columns) ... $$`.
3. **Novo** `20260409192702_colunas_de_profiles_sem_migration.sql` — `celular`,
   `materia_favorita`, `minutos_semana` e `medalhas_desbloqueadas` existiam só no banco remoto
   (criadas pelo dashboard). Tudo `ADD COLUMN IF NOT EXISTS`, no-op no remoto.
4. Três migrations tinham o **mesmo timestamp** de outras (o CLI trata a versão como chave
   primária e recusa). Renomeadas com +1 segundo:
   - `20260806180000_recriar_push_tokens.sql` → `20260806180001_...`
   - `20260806190000_push_tokens_fuso.sql` → `20260806190001_...`
   - `20260806200000_duelo_respeita_perfil_privado.sql` → `20260806200001_...`
5. CLI do Supabase atualizado de 2.96 para 2.116 (`package.json`).

**Não verificado:** desde então entraram 6 migrations novas (B2, `google_play_billing`,
`remover_sessao_pomodoro_planos` etc.). A primeira coisa a fazer é rodar `npx supabase db reset`
e confirmar que a cadeia ainda aplica limpa.

---

## 4. Os três bloqueios

### Bloqueio A — o Realtime da sala de foco não entrega evento nenhum

`cenario-sala.mjs` conecta bem (8/8 participantes entram, latências na casa dos 10-25 ms) mas
recebe **0 de 80 eventos** esperados.

O que já foi investigado, para não refazer:

- **Causa parcial encontrada e reproduzida:** a política de SELECT `selecionar_participantes_da_sala`
  em `tab_sessao_membros` chama `esta_na_sala()`, uma função `SECURITY DEFINER`. Quando o Realtime
  avalia essa política para vários assinantes ao mesmo tempo, o backend do Postgres morre com
  `signal 11: Segmentation fault` dentro da decodificação de WAL (`wal2json`), o banco entra em
  recovery e o PostgREST passa a responder `Could not query the database for the schema cache`.
- Medições: **crash em 4/4 execuções** com a política; **0 crashes em 3/3** com ela removida;
  **0 crashes em 3/3** com ela reescrita inline (sem chamada de função).
- O gatilho é a **chamada de função dentro da política**, não a autorreferência: trocar o corpo de
  `esta_na_sala` para consultar outra tabela mantinha o crash.
- Reproduz nas imagens do CLI 2.96 **e** 2.116 (Postgres 17.6.1.104, Realtime v2.129.3).
- A correção proposta está em `supabase/correcoes-propostas/politica-da-sala-sem-security-definer.sql`,
  **de propósito fora da cadeia de migrations**, para o banco local reproduzir produção como ela é.
- **Mas o crash não explica tudo.** Mesmo em execuções sem nenhum segfault, `cenario-sala.mjs`
  continuou entregando 0 eventos, enquanto um probe isolado quase idêntico (1 client, mesmas
  tabelas, sem filtro) recebia INSERT e UPDATE normalmente. Essa diferença **não foi fechada**.
  Suspeitas não descartadas: o `filter: sala_id=eq.<uuid>` dos canais, o número de clients
  distintos, ou estado sujo do container de Realtime depois de um crash anterior.

Sugestão de retomada: começar de um `db reset` + `podman restart supabase_realtime_*` limpo,
rodar `cenario-sala.mjs` com `PARTICIPANTES=2` e `DEBUG_CARGA=1`, e só subir se entregar 100%.
Comparar com um probe de 1 client passo a passo até achar a variável que muda o resultado.

### Bloqueio B — a RLS local não é a de produção

Isto invalida qualquer número medido hoje, e é falha de método num TCC.

Comparação feita em 2026-09-02 entre `pg_policies` local e remoto:

| Tabela | Local | Produção |
| --- | --- | --- |
| `sessoes_foco` | **RLS desligada, 0 políticas** | RLS ligada, 4 políticas (SELECT com `comunidade_usuario_no_feed`, `comunidade_bloqueio_entre`, `perfil_publico`) |
| `membros` | **RLS desligada, 0 políticas** | RLS ligada, 3 políticas |
| `grupos` | **RLS desligada, 0 políticas** | RLS ligada, 3 políticas |
| `profiles` | **RLS desligada** (1 política, não aplicada) | RLS ligada, 3 políticas |
| `tab_sessao_membros` | 4 políticas, **incluindo uma permissiva ampla** (`auth.role() = 'authenticated'`) que não existe em produção | 4 políticas, sem a ampla — `selecionar_participantes_da_sala` é a ÚNICA de SELECT |

Ou seja: o caminho de escrita mais pesado do teste (`sessoes_foco`) hoje roda **sem RLS
nenhuma** localmente. Os números saem otimistas.

O que fazer: escrever uma migration que ligue a RLS e recrie as políticas de produção
**literalmente** para as tabelas que os testes tocam (`profiles`, `grupos`, `membros`,
`sessoes_foco`, `salas_foco`, `tab_sessao_membros`, `incentivos`, `notificacoes`,
`gamificacoes`, `materias_usuario`). Pegue as definições com:

```sql
select tablename, policyname, cmd, roles::text, qual, with_check
from pg_policies where schemaname = 'public' order by tablename, policyname;
```

rodado **por MCP contra o remoto, somente leitura**.

Duas ressalvas:

- Pule as políticas que referenciam `alunos_turmas` e `sclass_professores_turmas` (o recurso
  Turma existe em produção mas as tabelas não estão no repositório). Documente a exclusão no
  cabeçalho da migration.
- Escolha um timestamp livre. `20260902140000` e `20260902150000` **já estão ocupados** por
  migrations novas — use algo depois de `20260903100000`.

### Bloqueio C — a máquina

Durante a sessão anterior: 11 GiB de 14 GiB de RAM em uso e 7 GiB de swap ativos. Acima de
~150 clients simultâneos, o teto medido é o do notebook, não o do sistema.

Isso não tem correção de código. Ou se roda num ambiente mais folgado, ou entra como limitação
declarada na metodologia do TCC — e nesse caso os números têm que ser apresentados como **limite
inferior verificado**, não como capacidade do sistema.

---

## 5. Tarefas, em ordem

1. `npx supabase db reset` e confirmar que a cadeia (agora com as 6 migrations novas) aplica
   limpa. Corrigir o que quebrar.
2. **Bloqueio B**: migration de alinhamento de RLS. Sem isso nenhum número vale.
3. Rodar `node scripts/load/runner.mjs sessoes 10 30 60 100` → preenche "usuários registrando
   sessões simultaneamente".
4. Escrever `cenario-ranking.mjs` (leitura pura, bate nas RPCs de ranking com N usuários) →
   preenche "consultando o ranking".
5. Escrever `cenario-volumetria.mjs` (semear N linhas em `sessoes_foco`, medir latência das
   consultas principais e o tamanho do banco em cada patamar) → preenche "registros armazenados".
6. Escrever `cenario-login.mjs` com `signInWithPassword` real. Subir
   `auth.rate_limit.sign_in_sign_ups` no `config.toml` local e **comentar no arquivo que é só
   para teste de carga** → preenche "login simultâneo".
7. **Bloqueio A** → destrava "entrando na mesma sala" e "sessões de foco simultâneas".
8. Cenário de IA. **Precisa de decisão do autor antes de escrever:** as Edge Functions chamam o
   Gemini de verdade. Opções: (a) medir só `consumir_cota_ia`, que é onde está o gargalo real e
   não gasta API; (b) stubar o Gemini localmente; (c) aceitar gastar cota. Recomendo (a).
9. Consolidar tudo em `docs/testes-de-carga.md` com metodologia, tabelas e as limitações
   (bloqueio C, e o fato de o login ser medido à parte).

---

## 6. Armadilhas conhecidas do repositório

- **`supabase db push` é perigoso aqui.** O histórico do remoto tem 33 migrations com timestamps
  próprios; o repositório tem ~90 com timestamps diferentes. São duas linhas do tempo distintas —
  as migrations foram aplicadas à mão em produção. Um `push` tentaria reaplicar dezenas de
  migrations já aplicadas. Isso é anterior a este trabalho e não foi consertado.
- Existem migrations **só em produção**, ausentes do repositório:
  `drop_ofensiva_and_ultima_data_estudo_from_profiles`, `restringe_acesso_anonimo_sessoes_e_arquivos`,
  `profiles_select_apenas_dono`, `revoga_anon_security_definer_e_view_invoker`. É a causa raiz do
  bloqueio B.
- `scripts/load/.seed.local.json` foi commitado por acidente (52 KB de dados de teste). Deveria
  entrar no `.gitignore`.
- `sala_foco_max` existe em `planos_limites` mas **não é aplicado por trigger nenhum** — o
  tamanho da sala hoje é tecnicamente ilimitado. Relevante para decidir até onde faz sentido
  testar.
- O `seed.mjs` cria um plano `carga` sem tetos para poder montar grupos grandes. Para medir o
  produto como ele é vendido, rode com `PLANO=gratis` (5 membros/grupo) ou `PLANO=pro` (50).
