# Project Context (Living PRD) - StudoCore App

Este documento é o **Project Context** (um PRD vivo) do StudoCore. Ele serve como a fonte da verdade para o projeto, registrando detalhadamente as funcionalidades atuais (arquivos, rotas e serviços), decisões de design, arquitetura, modelo de negócios e ideias futuras. Ele é ideal para dar contexto profundo a qualquer desenvolvedor (ou Inteligência Artificial) que vá assumir ou colaborar no projeto.

---

## 1. Visão Geral
O StudoCore é um aplicativo móvel (React Native/Expo) focado em produtividade, organização de estudos e gamificação, permitindo que os usuários gerenciem suas rotinas, participem de grupos de estudos e acompanhem sua evolução.

---

## 2. Funcionalidades e Telas Atuais (Mapeamento do `app/`)
A interface do usuário já possui diversas rotas implementadas com Expo Router, divididas por contexto:

### Navegação Principal (Tabs - `app/(tabs)/`)
A navegação inferior (bottom tabs) é o centro da experiência do usuário:
- `index.tsx`: Tela inicial (Home).
- `focus.tsx`: Ferramenta principal para gerenciar tempo de estudo (Pomodoro/Sessões de foco).
- `vault.tsx`: O "Cofre", espaço para armazenamento, organização e compartilhamento de materiais e arquivos.
- `brain.tsx`: Dashboard/Mente do usuário (Visão geral de aprendizado/atividades).
- `profile.tsx`: Perfil do usuário contendo estatísticas completas, histórico e conquistas.

### Grupos de Estudo (`app/(groups)/`)
Módulo dedicado à colaboração entre estudantes:
- `browse-groups.tsx`: Explorador para buscar e descobrir grupos públicos.
- `group-details.tsx` e `detailing.tsx`: Visualização aprofundada das informações de um grupo específico.
- `cronogram.tsx` e `schedule.tsx`: Funcionalidades de calendário, agendamento de estudos e blocos de tempo compartilhados.
- `settings.tsx`: Configurações administrativas do grupo.
- `no-group.tsx`: Tela de empty state/fallback quando o usuário não pertence a nenhum grupo.

### Autenticação e Onboarding (`app/(auth)/`)
Fluxos de entrada e primeira viagem do usuário:
- `login.tsx` e `signup.tsx`: Autenticação padrão.
- `forgot-password.tsx` e `verify-email.tsx`: Recuperação e verificação de conta.
- `onboarding-welcome.tsx` e `onboarding-profile.tsx`: Fluxos para configurar o perfil do usuário logo após a primeira entrada.

### Modais e Fluxos Sobrepostos (`app/(modals)/`)
Ações rápidas e contextos secundários:
- **Criação e Gestão:** `create-group.tsx` (Criar novo grupo), `criar-materia.tsx` (Adicionar disciplina).
- **Interação em Grupo:** `invite.tsx` (Convites), `join-by-code.tsx` (Entrar com código), `join-session.tsx` (Entrar em sessão ao vivo).
- **Gamificação e Social:** `ShareSession.tsx`, `ShareWeeklyProgress.tsx` (Compartilhamento de resumos/resultados), `badges.tsx` (Conquistas), `focus-feedback.tsx` (Feedback pós-sessão).
- **Vault:** `upload-vault.tsx` (Envio de arquivos), `archive-details.tsx` (Detalhes de um arquivo).

---

## 3. Serviços e Lógica de Negócios (`services/`)
Toda a comunicação com banco de dados e APIs externas está centralizada em serviços específicos para evitar poluição das telas:
- **`auth.ts`**: Lida com registro, login e sessão (Supabase Auth).
- **`profileStats.ts`**: Serviço complexo (maior do projeto) responsável por calcular estatísticas de perfil, XP, horas estudadas e evolução.
- **`grupos.ts`**: Gestão de membros, criação, edição e listagem de grupos.
- **`sessions.ts`**: Salva e gerencia os registros das sessões de foco finalizadas.
- **`materias.ts`**: CRUD de matérias/disciplinas do usuário.
- **`archives.ts`, `supabaseStorage.ts`, `backblaze.ts`**: Abstrações para upload, download e listagem de materiais do Vault (com suporte ao armazenamento da Backblaze/Supabase).
- **`onlineUsers.ts`**: Real-time tracking para saber quem está estudando naquele momento.
- **`ranking.ts`**: Lógica de leaderboard (classificação de usuários/grupos).
- **`armazenamentoOffline.ts`**: Gerenciador de cache ou estado persistido localmente (possivelmente usando AsyncStorage).

---

## 4. Arquitetura e Decisões Técnicas
O aplicativo é construído com as seguintes tecnologias (versões aproximadas com base no `package.json` atual):
- **Framework:** React Native (0.83) + Expo (~55). Uso do Expo Router para navegação baseada em diretórios.
- **Backend (BaaS):** Supabase (`@supabase/supabase-js`) fornecendo Database, Auth, e Realtime.
- **Estilização:** `nativewind` (Tailwind CSS para React Native) em conjunto com variáveis globais no `global.css`.
- **UI/Animações:** `react-native-reanimated`, `lottie-react-native` (animações vetoriais) e `lucide-react-native` para ícones.

**Regras de Arquitetura Estabelecidas:**
- **Separação de Camadas:** A camada `app/**` e `components/**` **nunca** deve importar `@/lib/supabase` diretamente. Tudo deve passar por chamadas de função da pasta `services/`.
- **Enforcement Automatizado:** O projeto contém um script `scripts/checar-arquitetura.sh` (`npm run check:architecture`) para impedir violações arquiteturais e importações indevidas.
- **Tipagem Estrita:** Uso de TypeScript com restrição de `any`.

---

## 5. Decisões de UX e Branding
- **Design System:** Baseado em utilitários Tailwind (NativeWind), facilitando suporte a dark/light mode e manutenibilidade.
- **Identidade Visual:** Foco em cores e temas que remetem à produtividade e concentração, evitando cansaço visual.
- **Experiência do Usuário (UX):** Uso de modais (`expo-router` modal presentations) para fluxos secundários rápidos sem perder o contexto principal. Integração constante com feedback visual (Lottie/Reanimated) para reforçar a gamificação (ex: tela de badges, progressões de foco).

---

## 6. Monetização (Proposta)
- **Freemium:** Acesso às ferramentas básicas de foco, cronograma limitado e criação de 1-2 grupos.
- **Premium (Assinatura):** Acesso a estatísticas avançadas, criação ilimitada de grupos, personalização avançada do perfil, e acesso antecipado a novas funcionalidades gamificadas.
- **Microtransações:** Compra de cosméticos para o perfil (ex: bordas, avatares, temas de card).

---

## 7. Concorrentes e Referências
- **Forest:** Referência em gamificação focada em foco e bloqueio de distrações.
- **Habitica:** Referência máxima na transformação de tarefas/estudos em RPG.
- **Chess.com:** Inspiração para o modelo competitivo, elo, e puzzles diários.
- **Spotify:** Inspiração para a apresentação de resumos de atividade (Wrapped).
- **Discord:** Referência para gestão de comunidades e Study Rooms.

---

## 8. Ideias Descartadas
*(Nenhuma ideia foi descartada permanentemente ainda. O histórico de funcionalidades testadas e reprovadas será documentado aqui para evitar retrabalho no futuro.)*

---

## 9. Roadmap e Ideias Futuras
Aqui estão consolidadas as propostas para evolução da plataforma, com forte foco em gamificação e inteligência artificial:

### IA e Planejamento
1. **Roadmap Semanal do Grupo (IA):** Uma pessoa do grupo poderá usar a IA (via API) para montar um planejamento automático para todo o grupo com base em um documento (ex: PDF da ementa). No futuro, isso será integrado diretamente ao cronograma de todos os membros.
2. **Projetos Personalizados:** Funcionalidade de criar projetos dentro do cronograma, quebrando-os em determinadas tarefas, com avisos prévios e gestão de prazos antes do horário determinado.

### Gamificação e Competição
3. **Modo Competição 1v1:** O usuário poderá chamar outro estudante para uma competição direta, com foco principal em "Time Attack" na resolução de questões.
4. **Batalha de Times:** Grupos de estudos poderão batalhar contra outros grupos durante uma semana. O grupo que acumular mais tempo/qualidade de estudo ganha recompensas.
5. **Sistema de Elo:** Ranqueamento global para os usuários baseado em seu engajamento, desempenho e constância, criando um cenário competitivo saudável.
6. **Comparação de Perfis (Cards):** Sistema ao estilo "batalha de cartas" onde os usuários comparam seus status (ex: horas de foco, sequência de dias, exercícios resolvidos) com os de amigos.
7. **Missões Semanais:** Desafios semanais com um ranking global, oferecendo badges exclusivas (conquistas) como recompensa para os melhores colocados.
8. **Daily Puzzle:** Um desafio ou pergunta rápida diária (ao estilo dos puzzles do chess.com) para incentivar a abertura do aplicativo e manter a ofensiva/sequência (streak).

### Comunidade e Social
9. **Study Rooms:** Salas virtuais onde o usuário pode se juntar a amigos para estudar simultaneamente. Suporte para chat em tempo real, comentários e compartilhamento de materiais.
10. **Comunidade (Feed):** Uma área social no estilo Instagram focada nos estudos, onde os usuários podem postar suas rotinas, fotos de resumos, compartilhar arquivos e interagir com materiais de outros.
11. **Replay Mensal:** Uma retrospectiva visual mensal no estilo "Spotify Wrapped", mostrando as principais disciplinas estudadas, tempo total de foco, conquistas desbloqueadas e evolução no elo.

---
*Este documento deve ser revisado e atualizado sempre que novas rotas, serviços importantes ou mudanças de escopo forem implementadas no projeto.*
