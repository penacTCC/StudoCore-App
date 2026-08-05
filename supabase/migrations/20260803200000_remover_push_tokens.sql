-- Remove a infra de push remoto do "mandar força".
--
-- Motivo: push remoto via Expo exige credenciais do Firebase/FCM pra entregar no Android, e
-- este projeto não usa Firebase. A notificação passou a ser LOCAL, disparada no aparelho do
-- destinatário quando o INSERT em `incentivos` chega por Realtime
-- (ver hooks/useForcasRecebidas.ts, services/notificacoesForca.ts e a Edge Function
-- mandar-forca, que não fala mais com a API do Expo).
--
-- Com isso a tabela `push_tokens` e suas policies não têm mais nenhum leitor nem escritor.
DROP TABLE IF EXISTS public.push_tokens;
