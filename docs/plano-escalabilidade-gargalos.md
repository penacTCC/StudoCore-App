# Plano de escalabilidade e gargalos - StudoCore

Atualizado em 2026-09-03.

Este documento consolida os gargalos encontrados nos testes de carga locais do Supabase e
propõe caminhos de evolução. Ele nao implementa as mudanças; serve como plano tecnico para
decidir o que fazer antes de rodar novos testes ou antes de levar o app para producao.

Regra de leitura dos numeros: os testes foram executados em Supabase local, com banco,
PostgREST, Auth, Realtime, containers e clientes simulados competindo pelos recursos do
mesmo notebook. Portanto, os resultados sao limites inferiores verificados no ambiente
local, nao capacidade absoluta do app em producao.

## 1. Resumo executivo

| Area | Limite estavel medido | Primeiro sinal de falha | Gargalo principal |
| --- | ---: | --- | --- |
| Login simultaneo | 90 usuarios | 100 usuarios: 99/100, erro de schema no Auth/PostgREST | Auth local + conexoes simultaneas |
| Sala de foco ao vivo | 60 participantes | 65 participantes: 40% eventos de participacao, 0% incentivos | Fanout do Realtime via Postgres Changes |
| Registro de sessoes | 175 usuarios | 200 usuarios: INSERT 100%, UPDATE 96%; 300 degradou | rajada HTTP + pool PostgREST/DB |
| Ranking simultaneo | pelo menos 150 usuarios | nao falhou ate 150 | leitura agregada ainda aceitavel, mas cresce com volume |
| Volumetria | 40.000 sessoes verificadas | nao falhou; feed/ranking ~400 ms p95 | consultas sobre `sessoes_foco` crescem com linhas |

O maior risco tecnico hoje e a sala de foco ao vivo. Ela combina muitos WebSockets, duas
assinaturas por participante e fanout para todos da sala. Esse custo cresce de forma
quadratica: quando N usuarios recebem eventos gerados por outros N usuarios, o sistema nao
processa "N usuarios"; ele processa milhares de entregas.

O segundo risco e o ranking/feed com crescimento de historico. Hoje ainda esta saudavel em
40.000 registros locais, mas as consultas ja sobem de dezenas para centenas de milissegundos.
Sem agregacao, esse caminho tende a piorar conforme o app acumula meses de sessoes.

## 2. Metodologia usada nos testes

Ambiente:

- Supabase local via Podman.
- API local em `http://127.0.0.1:54321`.
- Banco Postgres 17 via Supabase CLI.
- RLS local alinhada com a producao para as tabelas testadas.
- Clientes simulados usando usuarios reais em `auth.users`, `profiles`, `membros` e grupos.
- Realtime autenticado com JWT por usuario. Um bug do harness fazia os canais entrarem como
  `anon`; isso foi corrigido em `scripts/load/_comum.mjs`.

Arquivos de resultado gerados:

- `scripts/load/resultado-login.json`
- `scripts/load/resultado-sala.json`
- `scripts/load/resultado-sessoes.json`
- `scripts/load/resultado-ranking.json`
- `scripts/load/resultado-volumetria.json`

Observacao importante: alguns arquivos JSON foram sobrescritos por rampas isoladas finais.
Os limites deste documento usam os ultimos resultados mais relevantes coletados durante a
execucao completa.

## 3. Diagnostico por cenario

### 3.1 Login simultaneo

Resultado medido:

| Carga | Sucesso | p50 | p95 | Observacao |
| ---: | ---: | ---: | ---: | --- |
| 80 | 100% | 623 ms | 668 ms | estavel |
| 90 | 100% | 676 ms | 720 ms | teto estavel local |
| 100 | 99% | 753 ms | 792 ms | 1 falha: `Database error querying schema` |

Gargalo provavel:

- Auth local processando rajadas simultaneas.
- Banco e servicos Supabase competindo com o gerador de carga na mesma maquina.
- Pool/conexoes internas do Supabase local.
- Rate limit local precisou ser aumentado em `supabase/config.toml` para o teste medir login
  real, nao bloqueio artificial.

Impacto no app:

- Na vida real, login simultaneo tende a ser menos critico que sala ao vivo, porque usuarios
  normalmente mantem sessao persistida e nao fazem login todos ao mesmo tempo.
- O pico pode acontecer em evento de apresentacao, aula, turma ou lancamento.

Solucoes:

1. Manter sessao persistida no app e evitar relogin desnecessario.
2. Garantir que o app nao chame `signInWithPassword` em loop apos erro de rede.
3. Tratar falhas de login com retry exponencial curto no cliente.
4. Para producao, usar plano Supabase com cota adequada de Auth/conexoes.
5. Para teste metodologico, repetir em projeto Supabase pago ou em ambiente local mais forte.

Implementacao sugerida:

- Auditar `services/auth.ts` para confirmar que login e refresh nao geram repeticao agressiva.
- Adicionar protecao de botao "entrar" desabilitado durante chamada.
- Adicionar retry apenas para erro transitorio de rede/5xx, nunca para senha invalida.

Criterio de validacao:

- `node scripts/load/runner.mjs login 60 80 90 100`
- Teto aceitavel: 100% de sucesso ate a meta escolhida, p95 abaixo de 1s.

Prioridade: media. O gargalo existe, mas nao e o caminho mais quente do produto.

### 3.2 Sala de foco ao vivo

Resultado medido:

| Participantes | Entraram | Entrega participacao | Entrega incentivo | p95 participacao | p95 incentivo |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 50 | 50/50 | 100% | 100% | 482 ms | 485 ms |
| 60 | 60/60 | 100% | 100% | 288 ms | 516 ms |
| 65 | 65/65 | 40% | 0% | 292 ms dos eventos recebidos | 0 eventos |
| 75 | 75/75 | 20% | 0% | 189 ms dos eventos recebidos | 0 eventos |
| 100 | 100/100 | 40% | 0% | 392 ms dos eventos recebidos | 0 eventos |

Gargalo provavel:

- Cada participante abre dois canais de Realtime para a sala:
  - `tab_sessao_membros`
  - `incentivos`
- Cada evento relevante e replicado para todos os participantes.
- O custo cresce aproximadamente como `participantes * eventos`.
- Incentivos geram fanout maior que pausa/retomada quando varios usuarios enviam ao mesmo
  tempo.
- O uso de Postgres Changes para estado efemero de sala transforma cada mudanca pequena em
  escrita no banco + WAL + RLS + decodificacao + entrega WebSocket.

Por que esse e o maior gargalo:

- O estado ao vivo nao precisa ter durabilidade total em banco.
- Pausa/retomada/tempo corrente sao dados temporarios; gravar tudo no Postgres cria custo
  persistente e custo de replicacao.
- Realtime Postgres Changes e excelente para eventos de banco que realmente importam, mas
  nao e o melhor mecanismo para telemetria frequente de sala.

Solucoes de curto prazo:

1. Manter limite comercial de sala baixo.
   - O plano atual do PRD ja fala em sala de foco ao vivo ate 12 simultaneos.
   - Os testes locais suportaram 60, entao 12 e conservador.
2. Reduzir frequencia de eventos.
   - Enviar atualizacao de tempo no maximo a cada 2-5 segundos.
   - Enviar pausa/retomada apenas quando muda de estado, nao em ticks.
3. Separar evento importante de estado visual.
   - Entrou/saiu/finalizou: banco.
   - Cronometro/tempo parcial/presenca momentanea: Realtime Presence ou Broadcast.
4. Debounce de incentivos.
   - Agrupar incentivos em janela de 500-1000 ms.
   - Mostrar contador local em vez de criar varias entregas individuais.

Solucoes de medio prazo:

1. Migrar estado vivo da sala para Realtime Broadcast/Presence.
   - `tab_sessao_membros` ficaria como snapshot persistido.
   - `broadcast` carregaria eventos como `pause`, `resume`, `heartbeat`, `host_changed`.
   - `presence` carregaria quem esta online/agora.
2. Persistir snapshots periodicos.
   - A cada 30-60 segundos, salvar `tempo_segundos`, `status` e `ultimo_inicio`.
   - Ao sair/finalizar, gravar estado final.
3. Reduzir canais por usuario.
   - Um canal por sala pode carregar participacao e incentivos via Broadcast.
   - Evita dois subscriptions de Postgres Changes por participante.
4. Implementar backpressure visual.
   - Se o cliente receber muitos eventos, descartar estados intermediarios e aplicar somente
     o mais recente por usuario.

Solucoes de longo prazo:

1. Servico dedicado de sala ao vivo.
   - Supabase continua como persistencia.
   - Estado quente em um servidor WebSocket/Redis/Ably/Pusher/Liveblocks.
   - Banco recebe apenas eventos finais.
2. Sharding logico por sala.
   - Salas grandes podem ser divididas em subcanais.
   - Ranking/placar da sala e agregado por intervalos.
3. Modelo "host authoritative".
   - Host publica estado da fila e cronometro.
   - Participantes enviam heartbeat leve.
   - Banco valida resultado final.

Implementacao sugerida para v1 sem grande reescrita:

1. Manter `salas_foco` e `tab_sessao_membros` como fonte persistida.
2. Adicionar um canal Broadcast por sala em `services/salas.ts`.
3. Ao pausar/retomar:
   - atualizar estado local imediatamente;
   - enviar Broadcast para sala;
   - persistir no banco com debounce.
4. Ao entrar/sair/finalizar:
   - escrever no banco.
5. Usar Postgres Changes apenas para:
   - sala aberta/encerrada;
   - participante entrou/saiu;
   - fallback quando Broadcast falhar.

Criterio de validacao:

- Antes: `node scripts/load/runner.mjs sala 50 60 65`
- Depois: criar novo cenario `sala-broadcast` e testar `60 100 150 200`.
- Aceite minimo: 100 participantes com 100% dos eventos essenciais e p95 abaixo de 1s.

Prioridade: alta. E o principal gargalo de escala e o unico que apresentou perda clara de
eventos antes de 100 usuarios.

### 3.3 Registro simultaneo de sessoes

Resultado medido:

| Carga | INSERT | UPDATE | p95 INSERT | p95 UPDATE | Observacao |
| ---: | ---: | ---: | ---: | ---: | --- |
| 175 | 100% | 100% | 170 ms | 78 ms | teto estavel local |
| 200 | 100% | 96% | 157 ms | 111 ms | primeira degradacao |
| 300 | 92.3% | 71.8% | 216 ms | 130 ms | degradacao forte |

Gargalo provavel:

- Rajada de PostgREST criando e encerrando sessoes ao mesmo tempo.
- Pool local de conexoes.
- RLS e triggers associados ao caminho de sessao.
- Realtime publicado em `sessoes_foco` pode aumentar custo quando existem assinantes ativos.

Impacto no app:

- O caso real e muita gente finalizando foco ao mesmo tempo.
- Mesmo em grupos, o registro pessoal de estudo e independente por usuario.
- O caminho aguentou bem ate 175 usuarios simultaneos no local.

Solucoes de curto prazo:

1. Retry idempotente para encerramento de sessao.
   - Se o INSERT criou a sessao mas o UPDATE falhou, o app deve conseguir finalizar depois.
   - Usar `id`/`execucao_id` para nao duplicar.
2. Fila local de sincronizacao.
   - Se encerrar falhar, salvar payload local e reenviar quando rede voltar.
   - O app ja tem `armazenamentoOffline.ts`; aproveitar a estrutura.
3. Evitar atualizacoes frequentes em `sessoes_foco`.
   - Sessao ativa nao precisa atualizar banco a cada tick.
   - Banco recebe inicio e encerramento; progresso vivo vai por Broadcast/local.

Solucoes de medio prazo:

1. RPC transacional para finalizar sessao.
   - Uma chamada faz update da sessao, fecha participacao, atualiza gamificacao e retorna
     resultado.
   - Reduz idas ao banco e corridas entre services.
2. Consolidar triggers do caminho de fim de sessao.
   - Cada trigger aumenta custo em rajada.
   - Preferir uma funcao clara chamada no final a varios efeitos colaterais dispersos.
3. Indices focados no update por usuario/sessao.
   - `sessoes_foco(id, user_id)` pode ajudar se policies e updates sempre cruzam ambos.
   - Medir com `EXPLAIN (ANALYZE, BUFFERS)` antes de adicionar.

Solucoes de longo prazo:

1. Fila de eventos de sessao.
   - App grava um evento `sessao_finalizada`.
   - Worker/Edge Function processa agregados e notificacoes.
2. Escrita append-only.
   - Menos updates em linha quente.
   - Estado final derivado por evento mais recente.

Criterio de validacao:

- `node scripts/load/runner.mjs sessoes 150 175 200 250`
- Aceite: 100% de insert/update no alvo escolhido, p95 abaixo de 500 ms.

Prioridade: media-alta. Hoje esta aceitavel, mas precisa de retry/idempotencia para nao
perder sessao do usuario em falha transitoria.

### 3.4 Ranking simultaneo

Resultado medido:

| Carga | Sucesso | Linhas retornadas | p95 | Observacao |
| ---: | ---: | ---: | ---: | --- |
| 100 | 100% | 100 | 94 ms | estavel |
| 150 | 100% | 150 | 155 ms | teto medido pelo grupo semeado |

Gargalo provavel:

- A RPC `ranking_horas_membros_grupo` soma `sessoes_foco` por grupo e periodo.
- O custo cresce com o numero de sessoes no grupo, nao apenas com o numero de usuarios
  consultando.
- Em 40.000 registros, ranking p95 ficou perto de 395 ms.

Impacto no app:

- Ranking e consultado em telas de grupo e pode ser revalidado em foco/navegacao.
- Se muitos usuarios abrirem o mesmo grupo depois de uma sessao coletiva, todos podem pedir
  o mesmo ranking ao mesmo tempo.

Solucoes de curto prazo:

1. Cache no cliente ja existente.
   - Manter `tempoFresco` adequado para ranking.
   - Invalidar apos sessao finalizada ou mudanca de membro.
2. Limitar ranking inicial.
   - Tela principal mostra top N.
   - Tela completa pagina.
3. Evitar revalidacoes duplicadas.
   - Deduplicar chamadas simultaneas para a mesma chave no cache.

Solucoes de medio prazo:

1. Tabela agregada diaria:

   ```sql
   ranking_grupo_diario (
     grupo_id uuid,
     user_id uuid,
     data_sessao date,
     total_minutos integer,
     questoes integer,
     updated_at timestamptz,
     primary key (grupo_id, user_id, data_sessao)
   )
   ```

2. Atualizar agregado ao finalizar sessao.
   - Trigger ou RPC de finalizacao soma no agregado.
   - Ranking semanal/mensal/anual le dezenas de linhas por usuario, nao todas as sessoes.
3. Agregado total por grupo/usuario:

   ```sql
   ranking_grupo_total (
     grupo_id uuid,
     user_id uuid,
     total_minutos integer,
     updated_at timestamptz,
     primary key (grupo_id, user_id)
   )
   ```

4. Rebuild assicrono.
   - Comando de manutencao recalcula agregados se houver bug ou migration.

Solucoes de longo prazo:

1. Materialized view com refresh programado.
2. Cache server-side por grupo/periodo.
3. Edge Function/RPC com resposta cacheada por alguns segundos para absorver rajadas.

Criterio de validacao:

- Com dados grandes:
  - `node scripts/load/runner.mjs volumetria 50000 100000`
  - `node scripts/load/runner.mjs ranking 100 150`
- Aceite: ranking p95 abaixo de 300 ms em 100k sessoes ou abaixo de 500 ms se a tela tolerar.

Prioridade: media. Nao falhou, mas sera gargalo natural com historico real.

### 3.5 Volumetria de `sessoes_foco`

Resultado medido:

| Registros totais | Banco | Historico p95 | Feed p95 | Ranking p95 |
| ---: | ---: | ---: | ---: | ---: |
| 1.000 | 34 MB | 14 ms | 23 ms | 25 ms |
| 5.000 | 35 MB | 7 ms | 53 ms | 55 ms |
| 15.000 | 37 MB | 6 ms | 148 ms | 149 ms |
| 40.000 | 43 MB | 9 ms | 400 ms | 395 ms |

Leitura dos resultados:

- Historico pessoal esta bom. O filtro por `user_id` e limite baixo seguram bem.
- Feed do grupo e ranking crescem juntos, indicando leitura/soma por volume do grupo.
- 40.000 registros ainda e aceitavel, mas ja mostra a curva.

Solucoes de curto prazo:

1. Confirmar indices existentes com `EXPLAIN`.
2. Criar indices apenas se o plano mostrar scan ruim.
3. Paginar feed e ranking completo.
4. Evitar selecionar colunas pesadas em listagens.

Indices candidatos para medir:

```sql
create index concurrently if not exists sessoes_foco_user_status_created_idx
  on public.sessoes_foco (user_id, status, created_at desc);

create index concurrently if not exists sessoes_foco_grupo_status_created_idx
  on public.sessoes_foco (grupo_id, status, created_at desc)
  where grupo_id is not null;

create index concurrently if not exists sessoes_foco_grupo_status_data_user_idx
  on public.sessoes_foco (grupo_id, status, data_sessao, user_id)
  where grupo_id is not null;
```

Observacao: em migration normal do Supabase, `CREATE INDEX CONCURRENTLY` exige cuidado porque
nao pode rodar dentro de transacao. Se o CLI aplicar migrations em transacao, usar `CREATE
INDEX` comum em ambiente de manutencao ou migration separada conforme suporte do CLI.

Solucoes de medio prazo:

1. Agregados para ranking e estatisticas.
2. Arquivamento logico de sessoes antigas.
   - Nao apagar dados do usuario.
   - Mas telas padrao podem ler ultimos 30/90 dias primeiro.
3. Particionamento por data, se o volume crescer muito.
   - Provavelmente desnecessario na v1.
   - Considerar apenas se chegar a milhoes de sessoes.

Criterio de validacao:

- `node scripts/load/runner.mjs volumetria 50000 100000 250000`
- Rodar `EXPLAIN (ANALYZE, BUFFERS)` das consultas principais.
- Aceite inicial: historico p95 < 100 ms, feed/ranking p95 < 500 ms em 100k registros.

Prioridade: media.

### 3.6 Usuarios simultaneos com app aberto

Este cenario existia no harness como `conexoes`, mas a rampa final desta rodada focou nos
cinco cenarios pedidos. Ele mede o custo de usuarios com app aberto, cada um com WebSocket e
canais de notificacao/incentivo.

Gargalo provavel:

- Cota de conexoes Realtime do plano Supabase.
- Numero de canais por usuario.
- Fanout de notificacoes quando muitas pessoas recebem eventos ao mesmo tempo.

Solucoes:

1. Reduzir canais globais por usuario.
2. Assinar canais apenas quando necessario.
3. Usar um canal unico de notificacoes por usuario.
4. Evitar Realtime para dados que podem ser revalidados no foco da tela.
5. Medir separadamente:
   - app aberto parado;
   - app aberto com notificacoes chegando;
   - app aberto dentro de sala.

Prioridade: alta se o plano Supabase continuar Free, porque o limite comercial de Realtime
pode ser menor que o limite tecnico.

### 3.7 IA simultanea

Nao foi testado nesta rodada porque as Edge Functions chamam Gemini de verdade.

Risco principal:

- Custo financeiro e cota da API Gemini.
- Latencia externa fora do controle do Supabase.
- Concorrencia de Edge Functions.
- Upload/anexo PDF pode ser muito mais pesado que quiz simples.

Decisao recomendada:

- Para TCC, medir `consumir_cota_ia` e fluxo de autorizacao de cota, sem chamar Gemini real.
- Separar teste de "capacidade do app" de teste de "provedor externo".

Solucoes:

1. Stub local do Gemini para carga.
2. Timeout curto nas Edge Functions.
3. Fallback local sempre ativo no app.
4. Fila assicrona para analise pesada de PDF.
5. Limite por usuario/plano antes de chamar IA.
6. Circuit breaker se Gemini falhar ou ficar lento.

Criterio de validacao:

- Novo `cenario-ia.mjs` com modos:
  - `MODO=cota`: mede RPC/tabela de consumo sem Gemini.
  - `MODO=stub`: chama Edge Function local com resposta falsa.
  - `MODO=real`: chama Gemini real, apenas com aprovacao explicita.

Prioridade: media para escala, alta para custo.

## 4. Mapa de prioridades

### Fase 0 - Medicao e documentacao

Objetivo: deixar os numeros defensaveis no TCC.

Tarefas:

1. Consolidar resultados em `docs/testes-de-carga.md`.
2. Preservar tabelas de rampas completas, sem sobrescrever resultados finais importantes.
3. Registrar limitacao de ambiente local.
4. Rodar `conexoes` novamente se a tabela final precisar da linha "usuarios com app aberto".

Impacto: melhora a qualidade metodologica sem mudar produto.

### Fase 1 - Correcoes de robustez de baixo risco

Objetivo: reduzir falhas transitorias sem redesenhar arquitetura.

Tarefas:

1. Retry idempotente no encerramento de sessao.
2. Fila local para sessoes finalizadas nao sincronizadas.
3. Evitar duplo clique em login e fim de sessao.
4. Deduplicar chamadas simultaneas ao mesmo ranking no cache.
5. Adicionar logs estruturados nos scripts de carga.

Impacto esperado:

- Menos perda em 200+ registros simultaneos.
- Melhor experiencia em rede instavel.
- Melhor confiabilidade sem grande refatoracao.

Risco: baixo.

### Fase 2 - Sala ao vivo mais escalavel

Objetivo: tirar estado efemero do Postgres Changes.

Tarefas:

1. Introduzir Broadcast/Presence em `services/salas.ts`.
2. Manter banco para eventos duraveis.
3. Debounce de persistencia de participacao.
4. Reduzir para um canal por sala.
5. Criar `cenario-sala-broadcast.mjs`.

Impacto esperado:

- Sala acima de 100 participantes no local, dependendo da maquina.
- Menos perda de incentivos.
- Menos carga em WAL/RLS.

Risco: medio, porque mexe no fluxo mais complexo do app.

### Fase 3 - Ranking e feed com agregados

Objetivo: impedir que historico acumulado degrade ranking/feed.

Tarefas:

1. Criar tabelas agregadas diarias e totais.
2. Atualizar agregados ao finalizar sessao.
3. Reescrever RPC de ranking para ler agregado.
4. Criar job/RPC de rebuild.
5. Testar com 100k+ sessoes.

Impacto esperado:

- Ranking quase constante mesmo com muito historico.
- Menor custo por consulta.

Risco: medio. Precisa garantir consistencia e rebuild.

### Fase 4 - IA e custos

Objetivo: controlar custo e latencia externa.

Tarefas:

1. Cenario de carga de IA sem Gemini real.
2. Circuit breaker em Edge Functions.
3. Fila para analise pesada de PDF.
4. Observabilidade de custo por usuario/plano.

Impacto esperado:

- Menos risco financeiro.
- App nao trava quando IA fica lenta.

Risco: medio.

## 5. Mudancas recomendadas por arquivo

### `services/salas.ts`

Mudanca proposta:

- Adicionar camada de Broadcast/Presence para sala.
- Manter funcoes atuais de banco para persistencia.
- Expor callbacks separados:
  - `observarEstadoAoVivoDaSala`
  - `observarParticipantesPersistidos`
  - `enviarEventoAoVivoDaSala`

Risco:

- Alto acoplamento com `app/(tabs)/focus.tsx`.
- Precisa preservar fallback por Postgres Changes.

### `hooks/useSessionMembers.ts`

Mudanca proposta:

- Consumir eventos ao vivo e aplicar estado local por `membro_id`.
- Descartar eventos antigos se chegar versao mais nova.
- Revalidar snapshot do banco ao entrar na sala e periodicamente.

Risco:

- Estado local pode divergir se nao houver reconciliacao.

### `services/sessions.ts`

Mudanca proposta:

- Finalizacao idempotente.
- Fila local de retry.
- Menos updates enquanto a sessao esta ativa.

Risco:

- Precisa testar bem para nao duplicar sessoes nem quebrar quiz/anotacoes.

### `lib/cache.ts` e `hooks/useDadosCache.ts`

Mudanca proposta:

- Deduplicar promises em voo por chave.
- Evitar que varias telas disparem a mesma consulta ao ranking ao mesmo tempo.

Risco:

- Baixo, desde que mantenha invalidacao atual.

### Supabase migrations

Mudancas propostas:

- Agregados de ranking.
- Indices medidos por `EXPLAIN`.
- Eventual RPC transacional para finalizar sessao.

Risco:

- Medio. Nao usar `supabase db push` no remoto sem resolver historico divergente de
  migrations.

## 6. Plano de testes apos melhorias

Rodar local:

```sh
DOCKER_HOST=unix:///run/user/$(id -u)/podman/podman.sock npx supabase start
USUARIOS=300 GRUPOS=2 node scripts/load/seed.mjs

node scripts/load/runner.mjs login 60 80 90 100
node scripts/load/runner.mjs sessoes 150 175 200 250
node scripts/load/runner.mjs ranking 100 150
node scripts/load/runner.mjs sala 50 60 65 75 100
node scripts/load/runner.mjs volumetria 10000 25000 50000 100000
```

Depois das melhorias de Broadcast:

```sh
node scripts/load/runner.mjs sala-broadcast 60 100 150 200
```

Metas sugeridas:

| Cenario | Meta tecnica local antes da v1 |
| --- | ---: |
| Login | 100 simultaneos com 100% sucesso |
| Sala ao vivo | 100 participantes com 100% eventos essenciais |
| Registro de sessoes | 250 simultaneos com 100% insert/update |
| Ranking | 150 simultaneos com p95 < 300 ms |
| Volumetria | 100k sessoes com feed/ranking p95 < 500 ms |

## 7. Como falar disso no TCC

Texto sugerido:

> Os testes de carga foram executados em ambiente local, com Supabase, banco de dados e
> clientes simulados compartilhando os recursos da mesma maquina. Por isso, os resultados
> representam limites inferiores verificados. O principal gargalo observado foi a sala de
> foco ao vivo, cujo uso de Realtime com Postgres Changes gera fanout elevado conforme o
> numero de participantes aumenta. Para evolucao futura, propoe-se separar o estado efemero
> da sala, usando canais de Broadcast/Presence, e manter o banco relacional apenas para
> eventos duraveis e historico final de estudo.

Para a tabela de carga:

| Cenario | Carga recomendada para declarar |
| --- | ---: |
| Usuarios realizando login simultaneamente | 90 usuarios |
| Usuarios entrando em uma mesma sala de estudo | 60 participantes |
| Sessoes de foco funcionando simultaneamente | 60 participantes em sala ao vivo ou 175 sessoes pessoais |
| Usuarios registrando sessoes de estudo simultaneamente | 175 usuarios |
| Usuarios consultando o ranking simultaneamente | 150 usuarios |
| Usuarios utilizando IA simultaneamente | nao medido; pendente de decisao metodologica |
| Registros armazenados no banco de dados | 40.000 registros verificados |

## 8. Decisoes pendentes

1. Sala ao vivo deve continuar limitada comercialmente a 12 participantes na v1?
   - Tecnico local suportou 60.
   - O PRD ja defende 12 por razao tecnica/comercial.
2. Ranking deve ser agregado antes da Play Store ou apenas depois de sinais reais?
   - Se o app lancar com poucos usuarios, pode esperar.
   - Se houver apresentacao/turma usando muito, melhor agregar antes.
3. IA sera medida como custo interno ou chamada real ao Gemini?
   - Recomendacao: medir cota interna e deixar Gemini real fora do teste de carga principal.
4. Vale rodar uma rampa em ambiente Supabase pago?
   - Sim, se o TCC precisar falar de capacidade de producao.
   - Nao rodar no projeto principal Free.

## 9. Conclusao tecnica

O app nao esta bloqueado por um gargalo unico. Ele tem tres perfis de escala:

1. Caminhos HTTP simples, como login e registro de sessoes, escalam razoavelmente bem e
   melhoram com infraestrutura mais forte.
2. Consultas agregadas, como ranking/feed, funcionam hoje, mas precisam de agregacao para
   manter latencia baixa conforme o historico cresce.
3. Sala ao vivo e o ponto critico: enquanto depender de Postgres Changes para estado efemero,
   o limite pratico sera definido pelo fanout do Realtime antes do banco relacional em si.

Para a v1, a recomendacao pragmatica e manter sala pequena, documentar o limite tecnico,
adicionar robustez de retry nas sessoes e adiar agregados de ranking ate antes de um uso
com mais volume. Para uma v2 mais escalavel, a mudanca de maior impacto e mover sala ao vivo
para Broadcast/Presence e deixar o Postgres apenas como registro persistente.
