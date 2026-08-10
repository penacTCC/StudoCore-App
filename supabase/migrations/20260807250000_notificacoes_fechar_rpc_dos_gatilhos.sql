/*
  Fecha as funções de escrita da caixa de notificações à API pública.

  A migration anterior (20260807240000) criou `public.notificar` como SECURITY DEFINER,
  que é o que permite a ela escrever numa tabela sem policy de INSERT. O efeito colateral
  é que o PostgREST expõe toda função do schema `public` em `/rest/v1/rpc/<nome>`: sem
  este arquivo, `notificar` fica chamável por `anon` e por qualquer pessoa logada, e o
  desenho inteiro cai por terra — dá para forjar "fulano curtiu você" para quem se quiser
  e, com a linha forjada, o push que a Edge Function `avisar-interacao` manda em cima dela.

  Não ter policy de INSERT na tabela não bastava: a função passa por cima da RLS, que é
  exatamente para que só os gatilhos escrevam.

  As funções de gatilho vão junto por higiene — elas já falhariam se chamadas direto ("can
  only be called as a trigger"), mas não têm por que aparecer na API. Revogar não afeta o
  disparo: o EXECUTE é conferido ao CRIAR o gatilho, não a cada disparo.
*/

REVOKE ALL ON FUNCTION public.notificar(
  UUID, UUID, public.notificacao_categoria, TEXT, UUID, public.comunidade_origem, UUID
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.notificar_forca()                FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notificar_novo_membro()          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notificar_sala_aberta()          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.comunidade_notificar_interacao() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.comunidade_limpar_interacoes()   FROM PUBLIC, anon, authenticated;

/*
  `notificacao_valida` é só leitura, mas CONTINUA chamável por quem está logado: as duas
  RPCs da caixa (`notificacoes_listar`, `notificacoes_nao_lidas`) são SECURITY INVOKER e a
  chamam por dentro, então revogar de `authenticated` quebraria a caixa. De `anon` não
  serve para nada.

  O preço é uma função que responde "esta pessoa é do grupo X?" a quem já está logado e
  souber adivinhar dois UUIDs. É o mesmo que a antecessora dela (`comunidade_notificacao_valida`)
  já expunha; fechar isso de vez pede transformar as duas RPCs em SECURITY DEFINER, que é
  seguro (elas já filtram `destinatario_id = auth.uid()` na mão) mas é mudança de outra
  natureza.
*/
REVOKE ALL ON FUNCTION public.notificacao_valida(
  UUID, UUID, public.notificacao_categoria, TEXT, public.comunidade_origem, UUID
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.notificacao_valida(
  UUID, UUID, public.notificacao_categoria, TEXT, public.comunidade_origem, UUID
) TO authenticated;
