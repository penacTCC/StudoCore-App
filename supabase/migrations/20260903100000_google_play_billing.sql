-- Colunas para reconciliar assinaturas do Google Play (Android Publisher subscriptionsv2)
-- sem depender de Real-time Developer Notifications: o app reconsulta o Google usando o
-- token guardado aqui sempre que a tela de plano abre ou o app volta pro primeiro plano.
alter table public.assinaturas
  add column if not exists purchase_token text,
  add column if not exists order_id text,
  add column if not exists product_id text;

comment on column public.assinaturas.purchase_token is
  'Token de compra do Google Play (Android Publisher subscriptionsv2). Chave para reconciliar com a API. NULL para assinaturas de cortesia/teste/manuais.';
comment on column public.assinaturas.order_id is
  'orderId da Play Store (ex: GPA.xxxx), guardado para suporte/estorno; não é chave de nada.';
comment on column public.assinaturas.product_id is
  'productId da assinatura no Play Console, ex: pro_mensal.';

-- Um purchase_token pertence a uma única conta: impede que o mesmo token seja associado a
-- duas linhas de assinaturas (reenvio indevido, fraude, ou bug no cliente).
create unique index if not exists assinaturas_purchase_token_key
  on public.assinaturas (purchase_token)
  where purchase_token is not null;
