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
KEY_ID=...
APPLICATION_KEY=...
BUCKET_ID=...
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
