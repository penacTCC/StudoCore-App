# Project Context (Living PRD) - StudoCore App

Este documento é o **Project Context** (um PRD vivo) do StudoCore. Ele serve como a fonte da verdade para o projeto, registrando detalhadamente as funcionalidades atuais (arquivos, rotas e serviços), decisões de design, arquitetura, modelo de negócios e ideias futuras. Ele é ideal para dar contexto profundo a qualquer desenvolvedor (ou Inteligência Artificial) que vá assumir ou colaborar no projeto.

*Última atualização: 2026-08-10.*

---

## 1. Visão Geral
O StudoCore é um aplicativo móvel (React Native/Expo) de produtividade para estudos: sessões de foco (Pomodoro/cronômetro), cronograma com planos e rotina semanal, grupos de estudo com salas de foco ao vivo, uma aba de comunidade (feed público entre usuários), gamificação (ofensiva, badges, duelo de perfis) e um cofre de arquivos (Vault). É o TCC (Trabalho de Conclusão de Curso) do Agápito.

---

## 2. Stack e Arquitetura
- **Framework:** React Native `0.83.6` + Expo `~55` (Expo Router para navegação por diretórios, `app/`).
- **Backend (BaaS):** Supabase — Postgres (Auth, RLS, Realtime, Storage) + Edge Functions (Deno). Alguns arquivos grandes (Vault) usam **Backblaze B2** (`services/backblaze.ts`) em vez do Storage do Supabase.
- **Estilização:** `nativewind` (Tailwind para RN) + `global.css`. Sistema de design **HADES** (ver seção 3).
- **UI/Animações:** `react-native-reanimated` (4.x), `lottie-react-native`, ícones via `components/ui/icons.tsx` (Solar/lucide).
- **Notificações:** `expo-notifications`. Push remoto real via Expo → FCM (Android, credencial V1 no EAS) / APNs (iOS), com fallback automático para notificação local via Realtime quando o token de push não existe.
- **IA:** Google Gemini (`gemini-2.5-flash-lite` para o quiz, `gemini-2.5-flash` para análise de PDF anexado — precisa aceitar entrada em PDF), chamado só a partir de Edge Functions (a chave nunca chega ao cliente).
- **Cache de navegação:** módulo próprio `lib/cache.ts` + `hooks/useDadosCache.ts` (stale-while-revalidate), não `@tanstack/react-query` — decisão deliberada, ver seção 10.

**Regras de arquitetura estabelecidas:**
- **Separação de camadas:** `app/**` e `components/**` **nunca** importam `@/lib/supabase` (ou `@/repositories/supabase`) diretamente. Toda leitura/escrita passa por uma função de `services/`.
- **Enforcement automatizado:** `scripts/checar-arquitetura.sh` (`npm run check:architecture`) falha o build em violação.
- **Tipagem estrita:** TypeScript com restrição de `any`.
- **Fuso horário:** o Postgres roda em UTC, mas "dia de estudo" é sempre o dia **local** (`America/Sao_Paulo`, cravado como constante — app de uso local/TCC, não multi-fuso). App usa `paraDataISO()` de `utils/tempo.ts`; SQL usa `(now() at time zone 'America/Sao_Paulo')::date`. Nunca usar `toISOString().split("T")[0]` nem `CURRENT_DATE` puro para dados de sessão/ofensiva/ranking por período.
- **Agregação por grupo:** nunca filtrar sessões só por `grupo_id` — sempre cruzar com `membros` (quem saiu do grupo não deve continuar contando nas métricas dele).

---

## 3. Sistema de Design — HADES
A UI foi migrada (2026-07) para um design system próprio chamado **HADES**, cobrindo hoje praticamente todo o app: tabs, grupos/comunidade, Vault, configurações, perfis, modais pequenos e autenticação (login/signup/forgot-password/verify-email).

- **Exceção conhecida:** `app/(auth)/onboarding-welcome.tsx` ainda usa o tema legado (`constants/colors`) e não foi redesenhado.
- `app/(auth)/onboarding-profile.tsx` é o **carrossel HADES de onboarding** (6 slides: aniversário via `WheelPicker` → objetivo → fase de ensino → áreas de foco → ritmo → dificuldade → foto). Nome + @usuário são coletados antes, em `signup.tsx`, e carregados via `user_metadata` até o carrossel terminar.
- Alguns primitivos compartilhados por telas migradas **e** pelo onboarding (`components/ui/ImagePickerAvatar.tsx`, `components/form/PrimaryButton.tsx`, `components/form/InputField.tsx`) ganharam uma prop **opt-in** `hades` em vez de mudar o visual padrão — passe `hades` em telas migradas; sem a prop, o componente renderiza no estilo legado (usado pelo onboarding-welcome).
- Constantes do tema em `constants/hades.ts`.

---

## 4. Mapeamento de Telas (`app/`)

### Tabs (`app/(tabs)/`)
- `index.tsx` — **Comunidade** (era "Grupos"). Header com busca + alternador **Meu grupo** / **Explorar**:
  - *Meu grupo* (`components/comunidade/AbaMeuGrupo.tsx`): meta do grupo, ranking, sessões/salas ao vivo, feed do grupo, membros.
  - *Explorar* (`components/comunidade/AbaExplorar.tsx`): feed público entre usuários (ver seção 6.3).
  - Sino no header leva à caixa de notificações do **app inteiro** (`(modals)/notificacoes.tsx`); o ícone da tab ganha badge vermelho quando há não lidas.
  - Quem não tem grupo abre direto no Explorar.
- `focus.tsx` — Motor de sessão de foco (Pomodoro/cronômetro/plano/sala de grupo). Tela mais complexa do app (ver seção 6.1).
- `vault.tsx` — Cofre de arquivos.
- `brain.tsx` — Dashboard/visão geral de aprendizado.
- `profile.tsx` — Perfil: estatísticas, galeria de sessões, badges, exclusão de conta.
- `schedule.tsx` — Cronograma: planos e rotina semanal.

### Grupos (`app/(groups)/`)
- `browse-groups.tsx` — Descobrir grupos públicos.
- `group-details.tsx` / `detailing.tsx` — Detalhe de um grupo.
- `settings.tsx` — Configurações administrativas do grupo (permissão de convidar, etc.).
- `no-group.tsx` — Empty state.
- `ranking-completo.tsx` — Ranking expandido do grupo.

### Autenticação (`app/(auth)/`)
- `login.tsx`, `signup.tsx`, `forgot-password.tsx`, `verify-email.tsx`.
- `onboarding-welcome.tsx` (legado), `onboarding-profile.tsx` (carrossel HADES, ver seção 3).

### Modais (`app/(modals)/`)
- **Grupo:** `create-group.tsx`, `invite.tsx`, `join-by-code.tsx`, `join.tsx` (entrar em sala/sessão ao vivo).
- **Cronograma/matérias:** `criar-materia.tsx`, `novo-bloco.tsx` (rotina), `novo-bloco-plano.tsx`, `plano-editor.tsx`, `session-preview.tsx`.
- **Social/gamificação:** `badges.tsx`, `compare-profile.tsx` (duelo de perfis), `colegas-focando.tsx`, `member-profile.tsx`, `focus-feedback.tsx` (quiz + resultado pós-sessão), `ShareWeeklyProgress.tsx`. `ShareSession.tsx` é um **stub morto** (~13 linhas, não conectado).
- **Sessão/anotações:** `detalhes-sessao.tsx`, `corrigir-anexo.tsx` (correção do PDF anexado).
- **Vault:** `upload-vault.tsx`, `archive-details.tsx`.
- **Comunidade:** `notificacoes.tsx` (caixa do app inteiro), `contas-bloqueadas.tsx`.
- **Conta:** `editar-perfil.tsx`, `settings.tsx`.

---

## 5. Serviços (`services/`)
Toda comunicação com Supabase/APIs externas fica aqui — nunca em `app/`/`components/` (ver regra de arquitetura, seção 2).

**Núcleo de conta e dados:**
- `auth.ts` — registro, login, sessão.
- `profileStats.ts` — o maior/mais complexo: estatísticas de perfil, XP, horas, evolução, e os dados do duelo (`buscarEstatisticasParaDuelo`).
- `gamificacao.ts` — ofensiva (streak): `ofensivaVigente` recalcula no cliente se a sequência ainda vale hoje (a coluna só é escrita ao concluir sessão, ninguém zera à meia-noite).
- `materias.ts` — CRUD de disciplinas.
- `preferencias.ts` — preferências de cronograma/notificação do usuário (`preferencias_cronograma`, inclui `feed_publico`).
- `armazenamentoOffline.ts` — cache/estado local (AsyncStorage).
- `modoTeste.ts` — modo de testes 360× (10s reais = 1h) usado para QA manual de features baseadas em tempo.

**Foco e cronograma:**
- `sessions.ts` — CRUD de `sessoes_foco`, feed de sessões, observação realtime de sessões do grupo.
- `salas.ts` — **salas de foco em grupo** (`salas_foco`): quem está na sala, anfitrião, fila de itens, ciclo de vida. Separado de `sessions.ts` de propósito — `sessoes_foco` é o que a PESSOA estudou, `salas_foco` é ONDE, depois de um bug em que encerrar o estudo do anfitrião matava a sala para todo mundo.
- `agenda.ts` — resolve a agenda do dia (blocos de plano + rotina) para a tela de foco/cronograma.
- `schedule.ts` — CRUD de blocos da rotina semanal.
- `planos.ts` — CRUD de planos de estudo (blocos, agenda fixada/por data/nenhuma).
- `lembretes.ts` — notificações locais agendadas para blocos de plano/rotina.
- `lembretePausa.ts` — lembrete local de "cronômetro parado" (30 min), agendado/cancelado a partir do efeito que observa pausa/retomada/restauração do app.
- `notificacoesOfensiva.ts` — lembrete local noturno "sua ofensiva está em risco" (decisão é local: depende do fuso e se a pessoa já estudou hoje — um cron central teria que varrer todo mundo).
- `quizIA.ts` — gera o quiz pós-sessão via IA (Edge Function `gerar-quiz-foco`) e analisa PDFs anexados (`analisar-anexo-sessao`); sempre com fallback local se a IA falhar.
- `anotacoes.ts` — anotações da sessão (o que estudou / concentração / pendências / próximo passo).
- `anexosSessao.ts` — anexo de PDF externo à sessão, reaproveitando a tabela `arquivos` do Vault.

**Grupos, social e comunidade:**
- `grupos.ts` — gestão de membros/criação/edição/listagem de grupos.
- `ranking.ts` — leaderboard.
- `onlineUsers.ts` — presença realtime (quem está estudando agora).
- `incentivos.ts` — "mandar força" (torcida): registro via Edge Function `mandar-forca` (cooldown de 20 min por par, decidido no servidor), notificação de quem recebe via Realtime.
- `comunidade.ts` — feed público da aba Explorar (ver seção 6.3).
- `notificacoes.ts` — caixa de notificações do app inteiro (lê `notificacoes_listar`, mantém contador de badge global, assina Realtime).
- `notificacoesForca.ts` — notificação local de força recebida (canal Android `forcas`).
- `pushTokens.ts` — registro do token Expo Push do aparelho.
- `invalidacaoCache.ts` — liga eventos de mutação (`groupMembershipChanged`, `badgesUnlocked`) à invalidação do cache de navegação.

**Vault e arquivos:**
- `archives.ts`, `supabaseStorage.ts`, `backblaze.ts` — upload/download/listagem de materiais (Backblaze B2 como storage principal de arquivos grandes).
- `imagens.ts` — seleção + upload de imagem (avatar, etc.) via `expo-image-picker`.
- `visualizarArquivo.ts` — abrir/compartilhar arquivo baixado (mimeType por extensão, `expo-intent-launcher`/`expo-sharing`).
- `fotosSessao.ts` — foto opcional pós-sessão (ver seção 6.4).

**Infra de UI:**
- `toast.ts`, `confirm.ts` — toasts e diálogos de confirmação globais (fora de `app/`, chamados de qualquer service).

---

## 6. Funcionalidades em detalhe

### 6.1 Sessão de foco (`app/(tabs)/focus.tsx`)
Motor unificado de execução: em vez de uma máquina de estados fixa foco/descanso, a sessão percorre uma fila (`ItemFila[]`) que pode ser:
- uma sequência Pomodoro solo sintética (`utils/pomodoroSequence.ts`), com `qtdPomodoros` configurável (1–12) e parada automática ao final;
- os blocos restantes do dia de um **plano** ativo (`agenda.ts` → `resolverAgendaDoDia`), permitindo que um plano com várias matérias avance automaticamente por todas em uma sessão contínua (uma linha de `sessoes_foco` por matéria, agrupadas por `execucao_id` compartilhado + `plano_id`).

Sessões de grupo abrem uma **sala** (`salas_foco`, `services/salas.ts`), com anfitrião, participantes em realtime (`hooks/useSessionMembers.ts`) e handover automático de anfitrião (RPC `transferir_anfitriao_sessao`) se quem sai é o host. O feed do grupo mostra tempo ao vivo (`utils/tempo.ts` → `tempoAoVivoDaSessao`) e badge "Focando agora"/"Em pausa".

Ao final, etapas pós-sessão (todas puláveis): **foto** → **anotações** → **quiz** (gerado por IA para modo cronômetro; quiz fixo de frações para Pomodoro, por decisão explícita de escopo — Pomodoro ainda não foi revisado nesse ponto).

### 6.2 Gamificação: ofensiva, badges e duelo
- **Ofensiva (streak):** `gamificacao.ts`, recalculada no cliente a partir de `ultima_data_estudo` — vale se o último dia estudado foi hoje ou ontem.
- **Badges (medalhas):** sistema de conquistas com ilustrações próprias em `assets/badges/` (migrando de ícones lucide genéricos, ver `constants/badgeIcons.ts`), telas `(modals)/badges.tsx` e `components/badges/`. **Em desenvolvimento ativo em 2026-08-10** — novos badges sendo adicionados (sessões, horas, questões, meta semanal).
- **Duelo de perfis** (`compare-profile.tsx`, `services/profileStats.ts` → `buscarEstatisticasParaDuelo`): comparação "cartas de batalha" entre dois usuários (horas, ofensiva, matéria favorita, questões) — respeita perfil privado e bloqueio entre usuários (migrations `20260806200000`/`20260807100000`/`20260808100000`). Esta é a antiga ideia de roadmap "Comparação de Perfis (Cards)" — **já implementada**.

### 6.3 Aba Comunidade / Explorar (feed público)
Substituiu a antiga aba "Grupos"; "Meu grupo" é a home de sempre (seção 4). O Explorar mistura três origens reais do banco, cada uma com sua RPC (mesma assinatura: limite + keyset `(criado_em, id)`, cursor por origem):
- **Galeria** — fotos de sessão públicas de perfis públicos.
- **Arquivos** — arquivos do Vault publicados.
- **Planos** — planos de estudo publicados (resumidos: nº de blocos, minutos, matérias).

**Consentimento é assimétrico de propósito** (não uniformizar): Galeria depende do opt-in global `preferencias_cronograma.feed_publico` (default `false`) porque `sessoes_foco.is_public` já existia e sempre significou "meu grupo vê" — reaproveitá-lo publicaria retroativamente para estranhos. Arquivo e plano **não** passam por esse opt-in: `arquivos.publico`/`planos.publico` nascem `false` e o próprio ato de ligar o interruptor no upload/editor já é o consentimento.

Curtida/comentário/denúncia/bloqueio apontam para o par `(origem, referencia_id)` em vez de uma tabela `publicacoes` própria — evita duplicar "esta sessão ainda é pública?" como duas fontes da verdade. Importar um plano **copia** os dados (`comunidade_importar_plano`), nunca referencia o original.

Isto também resolve o item de roadmap "Comunidade (Feed)" e parcialmente o "global feed" — mas ainda é só usuário-a-usuário via publicação explícita, não um feed geral de toda atividade.

### 6.4 Foto e anotações de sessão
Etapa pós-sessão opcional (sempre pulável), inspirada no GymRats **mas com diferença deliberada: a foto não valida a sessão** — quem valida é o cronômetro. Bucket `sessao-fotos` é **privado** (LGPD — pode ser foto de quarto de menor de idade), leitura por signed URL de 1h, liberada a terceiros só se sessão pública **e** perfil público. Anotações (o que estudou/concentração/pendências/próximo passo) vêm em seguida, opcionais atrás de `anotarAposQuiz`.

Também dá para anexar um **PDF externo** (prova, lista de exercícios) à sessão, analisado por IA (resumo, gabarito, próximo passo) e corrigido manualmente em `corrigir-anexo.tsx`; desempenho do anexo nunca é inferido pela IA e só entra na taxa de acerto do usuário se corrigido.

### 6.5 Notificações
`notificacoes` é a caixa do **app inteiro**, escrita só por gatilhos de banco (nunca pelo app — sem policy de INSERT, para não permitir forjar notificação/push alheio) através da função `notificar` (SECURITY DEFINER). Entra nela o que "sobrevive a você não estar olhando": curtida, comentário, força recebida, gente nova no grupo, sala aberta. **Não** entra o que é aviso momentâneo (lembrete de cronograma, ofensiva em risco, fim de fase do pomodoro) — isso é notificação local e nada mais.

Push remoto real (Expo → FCM/APNs) para força e interações do Explorar, com fallback automático para notificação local via Realtime quando não há token registrado no aparelho.

---

## 7. Decisões de UX e Branding
- **Design System:** HADES (seção 3), sobre NativeWind — dark/light mode.
- **Identidade Visual:** paleta e tom voltados a produtividade/concentração, evitando cansaço visual.
- **Padrões de interação:** modais do Expo Router para fluxos secundários; feedback visual (Lottie/Reanimated) reforçando gamificação (badges, progressão de foco).
- **Cache stale-while-revalidate próprio** (`lib/cache.ts`) em quase todo o app: skeleton só aparece sem dado em cache; janela de frescor por tipo de dado (`tempoFresco: 0` para o que muda após uma sessão de foco — perfil, agenda, sessões, progresso de grupo — revalidando sempre ao focar sem piscar skeleton; janelas mais longas para dado estável como matérias/planos/membros). Ficaram de fora de propósito telas com autosave local ou hooks de presença/realtime, onde cache não ajuda (`(modals)/settings.tsx`, `useIncentivos`, `useOnlineUsers`, `session-preview`, `invite`, entre outros).

---

## 8. Monetização (Proposta — ainda não implementada)
- **Freemium:** ferramentas básicas de foco, cronograma limitado, criação de 1-2 grupos.
- **Premium (Assinatura):** estatísticas avançadas, grupos ilimitados, personalização de perfil, acesso antecipado a novas features gamificadas.
- **Microtransações:** cosméticos de perfil (bordas, avatares, temas de card).

### Rascunho de features Premium (atratividade para o lançamento na Play Store)
A base para cobrar por "IA + estatística + conveniência" já existe — quiz pós-sessão e análise de anexo já rodam por IA (seção 6.4). Ideias priorizadas:
1. **Chat com o anexo da sessão (Premium):** tirar dúvida sobre qualquer questão do formulário/prova anexado, explicar passo a passo e gerar questões similares ao anexo — evolução natural do `analisar-anexo-sessao` (Edge Function + `GEMINI_API_KEY` já prontas).
2. **`banco_erros` com revisão espaçada:** schema já existe (seção 11); Premium v1 = replay dos erros por matéria + mini-quiz IA gerado a partir dos erros.
3. **Plano de estudos por IA:** dar um objetivo ("passar em X em 3 meses") e receber um plano com blocos diários — reusa `planos.ts`/`agenda.ts`/`schedule.ts`.
4. **Wrapped / Replay Mensal:** retrospectiva estilo Spotify (horas, matérias, ofensiva, marcos) — roadmap item 8.
5. **Estatísticas avançadas:** heatmap anual, projeção de desempenho, comparativo de matérias (`profileStats.ts` já tem a base).
6. **Grupos ilimitados** e **salas de foco maiores** (limite por plano).
7. **Cosméticos:** bordas de perfil, avatares, temas de card (microtransação).

**Gatilhos de conversão propostos:** manter o quiz IA grátis com limite diário e cobrar o ilimitado, ou cobrar especificamente pela IA de questões do anexo (maior percepção de valor); tudo que é IA continua atrás de Edge Function com a chave só no servidor (regra da seção 2/6.4).

**Pré-requisitos de lançamento (fora de features):** remover as chaves Backblaze hardcoded de `services/backblaze.ts` (hoje vão no bundle e já estão no git), transformar "perfil privado" em RLS real (hoje só esconde a UI), limpar fotos órfãs do bucket `sessao-fotos`, executar o plano de testes (seção 12) e fechar política de privacidade/LGPD + termos de uso.

---

## 9. Concorrentes e Referências
- **Forest:** gamificação de foco/bloqueio de distrações.
- **Habitica:** transformar tarefas/estudos em RPG.
- **Chess.com:** modelo competitivo, elo, puzzles diários.
- **Spotify:** resumos de atividade (Wrapped).
- **Discord:** gestão de comunidades e salas.
- **GymRats:** referência (com desvio deliberado) para a foto pós-sessão — ver 6.4.

---

## 10. Decisões técnicas notáveis (não óbvias pelo código)
- **Cache de navegação é módulo próprio, não `@tanstack/react-query`:** ganho de UX é o mesmo; a escolha foi zero dependência nova e o mecanismo ser explicável na defesa do TCC. Migrar depois é mecânico se o app crescer a ponto de precisar invalidação em cascata.
- **Push remoto voltou a existir (Expo→FCM/APNs)** depois de uma primeira tentativa ter sido revertida por falta de credencial Firebase; hoje é best-effort com fallback local, então nunca é a única forma de uma notificação chegar.
- **"Perfil público" hoje só esconde dado na UI** — a policy de SELECT de `profiles` continua liberando a linha inteira a qualquer usuário autenticado. Não é privacidade real; se o TCC exigir isso, precisa de view/coluna restrita antes de prometer na tela.
- **Exclusão de conta** (`excluir-conta`, Edge Function) apaga manualmente tabelas sem `CASCADE` (ex: as do SClass, `alunos_turmas`) porque usam `ON DELETE NO ACTION`. Toda tabela nova referenciando usuário sem CASCADE precisa entrar nessa lista.
- **Fantasma de sessão entre contas:** "último grupo" ficava salvo por *aparelho*, não por conta — corrigido em três camadas independentes (armazenamento local com dono, descarte de `grupo_id` de não-membro ao salvar sessão, agregações cruzando com `membros`). Nunca confiar em `grupo_id` puro numa agregação de grupo.

---

## 11. Débitos conhecidos / o que falta
- **`banco_erros`** (banco de questões erradas): schema existe, zero código de app ainda.
- **`ShareSession.tsx`**: modal stub, não conectado.
- **Pomodoro não sobrevive a app kill** corretamente (só o modo cronômetro restaura via AsyncStorage) — problema pré-existente, fora de escopo até agora.
- **Foto de sessão vira órfã no bucket** quando a sessão ou conta é apagada (sem cascade de storage).
- **Zero infraestrutura de teste automatizado** (sem Jest/Vitest, sem `__tests__`, sem `testID` nas telas). Plano de testes já **acordado mas não iniciado** (ver seção 12) — só deve começar quando o usuário disser que terminou as features que quer construir antes.
- Deploys/migrations do Supabase às vezes ficam pendentes de aplicação manual (sem credencial de CLI/MCP em algumas sessões) — sempre confirmar com o usuário se uma migration/edge function recém-criada já foi aplicada no projeto remoto antes de assumir que está no ar.

---

## 12. Plano de testes pré-Play Store (acordado, não iniciado)
Objetivo: rede de segurança antes de publicar, com o mínimo de trabalho manual do usuário — ele quer que a IA execute os testes.
1. **Teste de unidade em TODOS os `services/`** (não só a lógica recente — escopo completo, recusado reduzir). Maior retorno porque os bugs reais têm sido de lógica de domínio (tempo de sessão, fuso, privacidade em duelo, permissão de convidar).
2. **Maestro** (não Appium — YAML, sem infra de servidor/driver, acha elemento por texto visível, que importa por não haver `testID`) para 4-5 fluxos de caminho feliz: login, iniciar/encerrar sessão de foco, entrar em grupo, ver cronograma.
3. **Checklist manual tela a tela** — só o usuário faz; nenhum robô pega bug visual.

Ambiente já pronto: Android SDK, AVD `Medium_Phone`, `adb` no PATH, projeto com `android/`/`ios/` (prebuild feito). E2E roda contra o Supabase de **produção** com uma conta descartável que o usuário cria e passa a senha — aceitou gerar dado falso no banco real em vez de montar staging; nunca usar a conta pessoal dele.

---

## 13. Ideias Descartadas
- **Push remoto via Firebase, primeira tentativa:** revertido por decisão deliberada de não depender de credenciais Firebase àquela altura — depois reintroduzido corretamente com credencial FCM V1 via EAS (ver seção 10). Histórico registrado para não repetir a primeira abordagem malfeita.
- **Reusar `sessoes_foco.is_public` como consentimento do feed público (Explorar):** descartado — esse flag sempre significou "meu grupo vê"; usá-lo publicaria retroativamente fotos de quem só consentiu com o grupo. Ver seção 6.3.
- **Tabela `publicacoes` própria para o feed:** descartada — duplicaria "esta sessão ainda é pública?" como duas fontes da verdade. Curtida/comentário apontam para `(origem, referencia_id)` na tabela original.

---

## 14. Roadmap e Ideias Futuras

### Já implementado (removido do roadmap, ver seção 6)
- ~~Comparação de Perfis (Cards)~~ → **Duelo** (6.2).
- ~~Study Rooms~~ → **Salas de foco** (6.1).
- ~~Comunidade (Feed)~~ → **Aba Explorar** (6.3), com a ressalva de que ainda não é feed geral de toda atividade.

### Em aberto
1. **Roadmap Semanal do Grupo (IA):** planejamento automático do grupo a partir de um documento (ex: PDF de ementa), via IA.
2. **Projetos Personalizados:** quebrar projetos em tarefas com avisos prévios e gestão de prazos.
3. **Modo Competição 1v1:** "Time Attack" na resolução de questões.
4. **Batalha de Times:** grupos competindo por tempo/qualidade de estudo numa semana.
5. **Sistema de Elo:** ranqueamento global por engajamento/desempenho/constância.
6. **Missões Semanais:** desafios com ranking global e badges exclusivas.
7. **Daily Puzzle:** desafio diário curto para manter a ofensiva.
8. **Replay Mensal:** retrospectiva estilo "Spotify Wrapped".
9. **`banco_erros`:** banco de questões erradas para revisão — schema já existe (ver seção 11).
10. **Feed geral/cross-group de atividade** (distinto do Explorar atual, que depende de publicação explícita por item).
11. **Chat com o anexo da sessão + questões similares por IA (Premium)** — detalhado na seção 8.
12. **Plano de estudos por IA** (objetivo → plano com blocos) e **heatmap de estudos/projeção de desempenho** — seção 8.

---
*Este documento deve ser revisado e atualizado sempre que novas rotas, serviços importantes ou mudanças de escopo forem implementadas no projeto.*
