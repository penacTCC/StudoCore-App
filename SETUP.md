# Setup do ambiente Android

Este projeto usa Expo com **dev client** (não é Expo Go puro) por depender de módulos
nativos como `expo-contacts`. Por isso é necessário um build nativo, não só `npx expo start`.

## 1. Pré-requisitos

- Node.js (LTS)
- JDK 17
- Android Studio (ou só o Android SDK Command Line Tools)

## 2. Configurar o Android SDK

- Instale a SDK pelo Android Studio (SDK Manager) ou via `sdkmanager`.
- Crie um emulador (AVD) pelo Device Manager, **ou** conecte um celular físico com
  Depuração USB ativada (Configurações → Sobre o telefone → tocar 7x em "Número da versão"
  para liberar Opções de desenvolvedor → ativar USB debugging).

## 3. Variáveis de ambiente

Adicione no `~/.bashrc` ou `~/.zshrc`:

```bash
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"
```

## 4. Clonar e instalar dependências

```bash
git clone <repo>
cd StudoCore-App
npm install
```

## 5. Criar o arquivo `.env`

O `.env` é ignorado pelo git — peça as variáveis para quem já tem o projeto rodando
(nunca envie por commit/PR):

```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_SENTRY_DSN=...
```

`EXPO_PUBLIC_SENTRY_DSN` é opcional: sem ela, o Sentry fica desligado (no-op) e o app
funciona normalmente. Crie um projeto grátis em sentry.io (plataforma React Native) e
cole o DSN aí para passar a receber crash reports de builds reais.

As credenciais do Backblaze B2 não entram no `.env` do app. Configure-as como secrets do
Supabase antes de publicar a função de arquivos:

```bash
supabase secrets set B2_KEY_ID=... B2_APPLICATION_KEY=... B2_BUCKET_ID=...
supabase functions deploy arquivos-b2 --use-api
```

## 6. Build e instalação inicial

Com o emulador aberto ou celular conectado (`adb devices` deve listar o dispositivo):

```bash
npx expo run:android
```

Esse comando gera a pasta `android/` automaticamente (prebuild), builda e instala o app.
A primeira build é lenta (10+ min); builds incrementais depois disso são bem mais rápidas.

## 7. Dia a dia

Depois da build inicial, normalmente basta:

```bash
npx expo start
```

e abrir o app de dev client já instalado no celular/emulador — sem rebuildar.

## 8. Quando é necessário rebuildar de novo

`npx expo start` só atualiza o código JS/TS (telas, lógica, estilos). Ele **não** é
suficiente quando:

- Um módulo nativo novo é adicionado ao `package.json` (ex: `expo-contacts`,
  `expo-camera`, qualquer pacote com pasta `android/`/`ios/`).
- Um plugin é adicionado/alterado no `app.json` (seção `"plugins"`).
- Permissões nativas mudam (ex: `READ_CONTACTS`, câmera, localização).

Nesses casos, depois do `npm install`, rode de novo:

```bash
npx expo run:android
```

Isso regenera a pasta `android/` com o módulo novo linkado e reinstala o app no
dispositivo. Sem isso, o app abre normalmente mas dá erro do tipo
`Cannot find native module ExpoXxx` ao tentar usar a funcionalidade nova.

## 9. Notificação do "mandar força" — sem Firebase

O botão "mandar força" notifica a pessoa **sem push remoto e sem Firebase**. O caminho é:

1. O app chama a Edge Function `mandar-forca`, que checa o cooldown de 20min e insere a
   linha em `incentivos`.
2. O app de quem vai receber está com um canal de Realtime aberto o tempo todo
   (`useForcasRecebidas`, montado no `_layout`), filtrado por `destinatario_id`.
3. Chegou o INSERT, o próprio aparelho dispara uma **notificação local**
   (`services/notificacoesForca.ts`), no canal Android `forca-recebida`.

Não precisa de `google-services.json`, nem de credencial FCM no EAS, nem de push token
guardado no banco. Só da permissão de notificação, que o app já pede.

**A Edge Function precisa estar deployada** — sem ela o botão responde 404, nada é inserido
e não acontece nem notificação nem cooldown:

```bash
npx supabase login
npx supabase functions deploy mandar-forca --project-ref vrcxocwxfslwnajjrwkh
```

E a constraint antiga de "1 força por sessão" precisa estar fora, senão o 2º dos 3 cliques
já falha. É idempotente, pode rodar no SQL Editor sem medo:

```sql
ALTER TABLE public.incentivos DROP CONSTRAINT IF EXISTS incentivos_unicos;
```

Cooldown: até **3 forças a cada 15 minutos** por par (quem manda, quem recebe), contados em
janela móvel — a 4ª só libera quando a 1ª das 3 completa 15min. A regra vive na Edge
Function (`supabase/functions/mandar-forca/index.ts`); `hooks/useIncentivos.ts` só espelha
ela pra desabilitar o botão com contagem regressiva.

**Limite:** a notificação só aparece com o app rodando (em primeiro plano, ou pouco depois
de ir pro segundo plano, enquanto o socket do Realtime sobrevive). Com o app fechado, a
força continua registrada e aparece na torcida quando a pessoa abrir o app — o que ela não
recebe é o "toque" na hora.

Para que a notificação chegue com o app **fechado**, aí não tem jeito: no Android o único
canal de entrega é o FCM (Google Play Services), então seria preciso configurar Firebase +
credenciais no EAS e voltar a guardar um push token — ver
https://docs.expo.dev/push-notifications/fcm-credentials/
