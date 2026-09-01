# E2E com Maestro

Item 2 do plano de testes pré-Play Store (ver `docs/project-context.md` e a
decisão de usar Maestro em vez de Appium): 4-5 fluxos de caminho feliz, rodando
no emulador Android que já existe (`Medium_Phone`), contra o Supabase de
**produção**, com uma conta descartável.

## Configuração (uma vez)

```bash
export PATH="$PATH":"$HOME/.maestro/bin"   # já foi adicionado ao ~/.bashrc/~/.zshrc
cp maestro/.env.example maestro/.env       # e preencha com a conta descartável
```

O app precisa estar instalado como dev client no emulador (`npx expo run:android`
ou o APK/AAB de debug já buildado) — o Maestro só automatiza o que já está
instalado, ele não builda o app.

A conta em `EMAIL_TESTE` precisa:
- já existir (login por senha, sem passar pelo OAuth do Google);
- ter pelo menos uma matéria cadastrada com o nome de `MATERIA_TESTE` (usada
  pelo flow `sessao-de-foco.yaml`).

## Rodando

```bash
maestro test maestro/flows/login.yaml --env-file maestro/.env
maestro test maestro/flows/ver-cronograma.yaml --env-file maestro/.env
maestro test maestro/flows/entrar-em-grupo.yaml --env-file maestro/.env
maestro test maestro/flows/sessao-de-foco.yaml --env-file maestro/.env

# todos de uma vez
maestro test maestro/flows/ --env-file maestro/.env
```

Para explorar a árvore de acessibilidade de uma tela nova e descobrir os
seletores certos (texto, `id`, `accessibilityLabel`), abra o Maestro Studio
com o emulador rodando:

```bash
maestro studio
```

## O que existe hoje

| Flow | Cobre | Observação |
|---|---|---|
| `login.yaml` | `services/auth.ts` -> `loginComSenha` | ponto de entrada dos outros flows via `runFlow` |
| `ver-cronograma.yaml` | aba Cronograma, navegação de dia | só navegação, não valida conteúdo do dia |
| `entrar-em-grupo.yaml` | entrar num grupo público | **entra de verdade** num grupo de produção a cada rodada — ver aviso no arquivo |
| `sessao-de-foco.yaml` | iniciar/encerrar sessão de foco (cronômetro, privada) | para no "Encerrar sessão"; o modal de feedback pós-sessão (quiz gerado por IA) fica fora — feche-o manualmente antes do próximo teste |

## Por que texto/accessibilityLabel em vez de testID

O app não tem `testID` nas telas (47 telas, zero cobertura). Maestro acha
elementos por texto visível ou accessibilityLabel, o que cobre a maior parte
das telas do StudoCore. Só foi preciso adicionar um `accessibilityLabel`
("Abrir menu") no botão hambúrguer da aba Comunidade
(`app/(tabs)/index.tsx`), que era ícone puro sem nenhum rótulo acessível —
sem isso não dava pra abrir o painel lateral. Se um flow novo esbarrar no
mesmo problema (botão só com ícone, sem texto nem accessibilityLabel), o
ajuste é o mesmo: adicionar `accessibilityLabel` no componente, não `testID`
(evita puxar `react-native-testing-library` ou qualquer outra dependência só
pra isso).

## O que fica de fora (por enquanto)

- Cadastro/onboarding, esqueci senha, OAuth do Google/GitHub.
- Criar/editar matéria, criar plano, criar grupo.
- Feedback pós-sessão (quiz de IA) e sair de um grupo — sem flow ainda.
- Checklist visual tela a tela: isso é manual, nenhum robô pega bug de layout.
