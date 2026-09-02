# Correções propostas (não fazem parte da cadeia de migrations)

SQL que **não** roda no `supabase db reset` de propósito. São correções que o teste de carga
encontrou mas que ainda não foram aprovadas para produção — deixá-las fora de
`supabase/migrations/` garante que o banco local reproduza a produção como ela é hoje, que é a
condição para qualquer número medido valer alguma coisa.

Para aplicar uma delas no banco LOCAL e comparar antes/depois:

```sh
DOCKER_HOST=unix:///run/user/$(id -u)/podman/podman.sock \
  podman exec -i supabase_db_StudoCore-Mobile psql -U postgres -d postgres \
  < supabase/correcoes-propostas/<arquivo>.sql
```

## politica-da-sala-sem-security-definer.sql

A política de SELECT de `tab_sessao_membros` chama `esta_na_sala()`, uma função
SECURITY DEFINER. Quando o Realtime avalia essa política para vários assinantes ao mesmo
tempo — N pessoas numa sala de foco —, o backend do Postgres morre com
`signal 11: Segmentation fault`, o banco entra em recovery e nenhum evento de participação é
entregue. Medido com 8 assinantes: crash em 4/4 execuções com a política, 0/4 sem ela.

**Atenção:** esta correção também MUDA a regra de acesso, de "estou nesta sala" para "sou do
grupo desta sala". Em produção `selecionar_participantes_da_sala` é a ÚNICA política de SELECT
da tabela, então aplicá-la lá alarga a leitura. Não aplicar sem decidir isso primeiro.
