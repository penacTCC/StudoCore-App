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
- `index.tsx`: **Comunidade** (antiga aba "Grupos"). A casca traz só o título, a busca e um alternador de escopo entre **Meu grupo** e **Explorar**:
  - *Meu grupo* é a home de grupo de sempre, movida sem alterações para `components/comunidade/AbaMeuGrupo.tsx` (meta, ranking, sessões ao vivo, feed e membros). A única mudança é o cabeçalho de identidade do grupo, que desceu para dentro do scroll.
  - *Explorar* (`components/comunidade/AbaExplorar.tsx`) é o feed público que mistura fotos de sessão (Galeria), arquivos do Vault e planos compartilhados de qualquer usuário, com filtro por tipo, scroll infinito, curtida, comentários em um nível e as ações de denunciar/bloquear. As **três origens vêm do banco**. A Galeria só aparece para quem ligou o opt-in "Participar do feed público" nas Configurações; arquivo e plano são publicados um a um — o interruptor "Publicar no Explorar" no modal de upload do Vault e o "Compartilhar no Explorar" no editor de plano. O card de arquivo baixa e abre o documento; o de plano importa uma **cópia** para os planos de quem tocou.
  - Quem não tem grupo abre direto no Explorar; o escopo *Meu grupo* mostra o convite a criar ou procurar um.
  - O cabeçalho tem um **sino** que leva à caixa de notificações (`app/(modals)/notificacoes.tsx`), e o ícone da aba ganha o mesmo badge vermelho da Análise quando há curtida ou comentário por ler.
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
- **Comunidade:** `notificacoes.tsx` (curtidas e comentários nas suas publicações), `contas-bloqueadas.tsx` (desfazer um bloqueio).

---

## 3. Serviços e Lógica de Negócios (`services/`)
Toda a comunicação com banco de dados e APIs externas está centralizada em serviços específicos para evitar poluição das telas:
- **`auth.ts`**: Lida com registro, login e sessão (Supabase Auth).
- **`profileStats.ts`**: Serviço complexo (maior do projeto) responsável por calcular estatísticas de perfil, XP, horas estudadas e evolução.
- **`grupos.ts`**: Gestão de membros, criação, edição e listagem de grupos.
- **`sessions.ts`**: Salva e gerencia os registros das sessões de foco finalizadas.
- **`materias.ts`**: CRUD de matérias/disciplinas do usuário.
- **`archives.ts`, `supabaseStorage.ts`, `backblaze.ts`**: Abstrações para upload, download e listagem de materiais do Vault (com suporte ao armazenamento da Backblaze/Supabase).
- **`fotosSessao.ts`**: Foto opcional do momento de estudo, registrada na etapa pós-sessão e exibida na Galeria do perfil. Vive num bucket **privado** (`sessao-fotos`), com leitura por signed URL de 1h — a policy do bucket só libera pra terceiros se a sessão for pública e o perfil também. Inspirado no check-in por foto do GymRats, mas com uma diferença deliberada: a foto **não valida** a sessão (quem valida é o cronômetro), é memória e prova social, e por isso é sempre pulável.
- **`onlineUsers.ts`**: Real-time tracking para saber quem está estudando naquele momento.
- **`comunidade.ts`**: Feed público da aba Comunidade. Cada origem tem a RPC dela, todas com a mesma assinatura (limite + keyset `(criado_em, id)`), e o cursor do feed guarda a posição de cada uma separadamente — uma fonte vazia ou lenta não segura as outras. `comunidade_feed_galeria` (sessões públicas de perfis públicos, deduplicadas por `execucao_id`, fotos assinadas em lote porque o bucket é privado), `comunidade_feed_arquivos` e `comunidade_feed_planos` (este já devolve o plano resumido: nº de blocos, minutos de estudo e as matérias distintas, para o card não ter de baixar 24 blocos e desenhar 3 tags). Curtida, comentário, denúncia e bloqueio apontam para o par `(origem, referencia_id)`; quem decide o que pode é a RLS, não a tela.
  - **Decisão:** a foto de sessão não ganhou tabela `publicacoes` própria. A linha já existe em `sessoes_foco` e duplicá-la criaria duas fontes da verdade para "esta sessão ainda é pública?". O preço é não haver FK — daí o gatilho `comunidade_limpar_interacoes` limpando curtida e comentário órfãos ao apagar a sessão.
  - **Decisão (resolve o ponto de atenção anterior):** o feed é **opt-in**, pela preferência `preferencias_cronograma.feed_publico`, desligada por padrão. `sessoes_foco.is_public` vale `true` desde a primeira migration e sempre significou "o meu **grupo** vê" — é o cadeado do card de grupo. Pendurar o Explorar nele converteria consentimento de grupo em consentimento público, retroativamente, para quem nunca soube que existia um feed. Agora a foto só sai para estranhos com as duas coisas: sessão pública **e** opt-in. A checagem mora em `comunidade_usuario_no_feed`, usada tanto pela RPC do feed quanto por `comunidade_dono_da_publicacao` — então desligar o interruptor também recusa curtida e comentário novos, sem tocar em policy nenhuma. O preço aceito é o feed nascer vazio; por isso o estado vazio do Explorar convida quem está de fora a participar.
  - **Notificações (migration `20260807230000`):** a tabela `comunidade_notificacoes` guarda "fulano curtiu" e "fulano comentou". Quem escreve nela são **gatilhos** em `comunidade_curtidas` e `comunidade_comentarios` — não há policy de INSERT, senão qualquer um poderia forjar uma notificação e, com ela, o push de outra pessoa. `services/notificacoesComunidade.ts` lê a caixa (`comunidade_notificacoes_listar`), mantém o contador do badge num store global (mesmo molde de `formulariosPendentes.ts`, porque a tab bar não é uma tela) e assina o Realtime para o número subir com o app aberto.
    - **Decisão:** descurtir **não** apaga a notificação. A linha é a chave de deduplicação (índice único parcial), e apagá-la faria curtir/descurtir em loop virar um push por toque. Em vez disso, `comunidade_notificacao_valida` esconde da lista o que não vale mais — curtida desfeita, publicação despublicada ou apagada, bloqueio posterior. Lista e contagem usam a **mesma** função: um badge "3" que abre numa lista de 2 é pior que badge nenhum.
    - **Push:** a Edge Function `avisar-interacao` é chamada em fire-and-forget logo depois de curtir/comentar. Ela não recebe o texto nem o destinatário — recebe "interagi com esta publicação" e vai procurar no banco a notificação **pendente** que o gatilho criou em nome de quem chamou. Sem essa linha, nenhum push sai. Curtidas do mesmo par têm janela de 10 min (curtir cinco posts seguidos é uma coisa só acontecendo); comentários sempre notificam. Canal Android próprio (`comunidade`, importância DEFAULT), separado do das forças, para dar de desligar um sem o outro.
  - **Decisão:** arquivo e plano públicos (`arquivos.publico`, `planos.publico`, migration `20260807210000`) **não** passam pelo opt-in `feed_publico`. A preferência existe porque a foto era publicada por um flag que já valia `true` e significava outra coisa; aqui as colunas nascem `false` e só viram `true` quando a pessoa liga o interruptor no upload ou no editor do plano — o ato já é o consentimento, e exigir a preferência global por cima faria o arquivo recém-publicado não aparecer, sem explicação. O que continua valendo para as três origens é `perfil_publico` e o bloqueio entre as duas pessoas (`comunidade_autor_visivel`).
  - **Decisão:** publicar um plano abre os blocos em **leitura** (policy de `planos_blocos`), porque é isso que dá sentido ao "importar para meu cronograma". Importar é **copiar**, via `comunidade_importar_plano`: o plano vira de quem importou e não muda mais junto com o original, nem some se o autor despublicar. Entra sempre com agenda `nenhuma` — herdar a agenda alheia derrubaria o plano que já ocupava aqueles dias. As matérias são reconciliadas por `nome_normalizado` no acervo de quem importa (as padrão do sistema contam), em vez de copiar o `materia_id` do autor, que aponta para uma linha que ele pode renomear ou apagar.
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
