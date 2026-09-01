# STUDOCORE (PENAC) — ROTEIRO DE TESTES DE SOFTWARE (COMPLEMENTAR)

> Este documento complementa o "Roteiro de Testes de Software" original (UC001 a UC015),
> cobrindo fluxos existentes no app que ainda não tinham caso de uso e roteiro de teste
> associados. Segue exatamente o mesmo padrão: cada UC descreve ator, descrição,
> pré-condições, caminho no sistema e fluxos (principal, alternativos, de exceção); em
> seguida vem o RT correspondente, com cenários (CN) e casos de teste (CT).
>
> Numeração continua a partir do documento original (UC016 em diante).

## Sumário

- Identificação de telas adicionais
- UC016 – Confirmar cadastro por e-mail
- UC017 – Completar onboarding de perfil
- UC018 – Entrar com Google
- UC019 – Registrar feedback pós-sessão de foco
- UC020 – Anexar e corrigir PDF de questões na sessão
- UC021 – Conversar com IA sobre um anexo de sessão
- UC022 – Ver colegas focando em tempo real
- UC023 – Buscar e entrar em grupo público
- UC024 – Criar grupo e convidar membros
- UC025 – Gerenciar configurações do grupo (administrador)
- UC026 – Gerar roadmap de estudos com IA
- UC027 – Consultar ranking completo do grupo
- UC028 – Comparar perfil com outro usuário (duelo)
- UC029 – Visualizar perfil de um membro
- UC030 – Gerenciar matérias de estudo
- UC031 – Montar plano de estudos multi-bloco
- UC032 – Importar plano de estudos da comunidade
- UC033 – Consultar notificações
- UC034 – Compartilhar progresso (semanal e Wrapped mensal)
- UC035 – Bloquear e desbloquear contas no feed
- UC036 – Operar com o aplicativo offline

## Identificação de telas adicionais

16. Tela de Confirmação de E-mail
17. Telas de Onboarding (Boas-vindas e Perfil inicial)
18. Tela de Feedback pós-sessão (anotações, foto, quiz)
19. Tela de Corrigir Anexo (gabarito/grade)
20. Tela de Chat com IA sobre Anexo
21. Tela de Colegas Focando
22. Tela de Buscar Grupos (Explorar)
23. Tela de Criar Grupo / Convidar (contatos, WhatsApp, link)
24. Tela de Configurações do Grupo
25. Tela de Gerar Roadmap (IA) e Preview do Roadmap
26. Tela de Ranking Completo do Grupo
27. Tela de Comparar Perfil (Duelo)
28. Tela de Perfil de Membro
29. Tela de Criar Matéria
30. Telas de Plano de Estudos (novo bloco, editor, preview)
31. Tela de Notificações
32. Telas de Compartilhamento (Progresso Semanal e Wrapped Mensal)
33. Tela de Contas Bloqueadas
34. Banner Offline / Tela de Estado de Erro

---

## Roteiro de Testes de Software

### UC016 – Confirmar cadastro por e-mail

| Campo | Descrição |
|---|---|
| **Ator(es)** | Usuário |
| **Descrição** | Este caso de uso permite que o usuário confirme o e-mail informado no cadastro através de um código enviado pelo sistema, ativando a conta. |
| **Pré-condições** | Usuário ter realizado um cadastro no sistema. UC001 |
| **Caminho no sistema** | Cadastro > Tela de confirmação de e-mail |
| **Fluxo principal** | 1. O sistema exibe a tela de confirmação com o e-mail cadastrado.<br>2. O usuário informa o código recebido por e-mail.<br>3. O usuário clica em 'Confirmar'.<br>4. O sistema valida o código e libera o acesso ao aplicativo. |
| **Fluxo Alternativo 1** | 1. O usuário clica em 'Reenviar código'.<br>2. O sistema reenvia um novo código para o e-mail cadastrado. |
| **Fluxo de exceção 1** | 1. O usuário informa um código inválido ou expirado.<br>2. O sistema exibe uma mensagem de erro e não libera o acesso. |
| **Fluxo de exceção 2** | 1. O usuário clica em 'Reenviar código' repetidas vezes em curto intervalo.<br>2. O sistema bloqueia novos reenvios por um período de espera e exibe uma contagem regressiva. |

Abaixo segue o roteiro de teste elaborado com base no caso de uso explicado acima.

#### RT.016 - Confirmar cadastro por e-mail

**CN001 – Confirmar com código válido**
Localização: Cadastro > Tela de confirmação de e-mail
Pré-condições: Usuário ter se cadastrado e recebido o código por e-mail.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT101 | 1. Informar o código recebido.<br>2. Clicar em 'Confirmar'. | 1. O sistema valida o código e libera o acesso ao aplicativo. | |

**CN002 – Confirmar com código inválido**
Localização: Cadastro > Tela de confirmação de e-mail
Pré-condições: Usuário estar na tela de confirmação de e-mail.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT201 | 1. Informar um código inválido.<br>2. Clicar em 'Confirmar'. | 1. O sistema exibe uma mensagem de erro e não libera o acesso. | |
| CT202 | 1. Informar um código já expirado.<br>2. Clicar em 'Confirmar'. | 1. O sistema exibe uma mensagem de erro informando que o código expirou. | |

**CN003 – Reenviar código**
Localização: Cadastro > Tela de confirmação de e-mail
Pré-condições: Usuário estar na tela de confirmação de e-mail.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT301 | 1. Clicar em 'Reenviar código'. | 1. O sistema reenvia um novo código para o e-mail cadastrado. | |
| CT302 | 1. Clicar em 'Reenviar código' mais de uma vez em curto intervalo. | 1. O sistema bloqueia o reenvio e exibe uma contagem regressiva até liberar novamente. | |

---

### UC017 – Completar onboarding de perfil

| Campo | Descrição |
|---|---|
| **Ator(es)** | Usuário |
| **Descrição** | Este caso de uso permite que, após confirmar o cadastro, o usuário defina apelido, avatar e objetivo de estudo antes de acessar o aplicativo pela primeira vez. |
| **Pré-condições** | Usuário ter confirmado o e-mail. UC016 |
| **Caminho no sistema** | Confirmação de e-mail > Boas-vindas > Perfil inicial |
| **Fluxo principal** | 1. O sistema exibe a tela de boas-vindas com os pilares do app.<br>2. O usuário clica em 'Continuar'.<br>3. O usuário preenche apelido e escolhe um objetivo de estudo.<br>4. O usuário opcionalmente escolhe um avatar.<br>5. O usuário clica em 'Concluir'.<br>6. O sistema salva o perfil e redireciona para a tela inicial. |
| **Fluxo Alternativo 1** | 1. O usuário clica no botão de sortear apelido (embaralhar).<br>2. O sistema sugere um apelido aleatório disponível. |
| **Fluxo de exceção 1** | 1. O usuário tenta concluir sem preencher o apelido.<br>2. O sistema exibe uma mensagem de erro solicitando o preenchimento. |
| **Fluxo de exceção 2** | 1. O usuário informa um apelido já em uso por outro usuário.<br>2. O sistema exibe uma mensagem de erro informando que o apelido está indisponível. |

Abaixo segue o roteiro de teste elaborado com base no caso de uso explicado acima.

#### RT.017 - Completar onboarding de perfil

**CN001 – Concluir onboarding com sucesso**
Localização: Boas-vindas > Perfil inicial
Pré-condições: Usuário ter confirmado o e-mail.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT101 | 1. Preencher apelido e objetivo de estudo.<br>2. Clicar em 'Concluir'. | 1. O sistema salva o perfil e redireciona para a tela inicial. | |

**CN002 – Sortear apelido**
Localização: Perfil inicial
Pré-condições: Usuário estar na tela de perfil inicial.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT201 | 1. Clicar no ícone de sortear apelido. | 1. O sistema preenche o campo com um apelido disponível. | |

**CN003 – Concluir com dados inválidos**
Localização: Perfil inicial
Pré-condições: Usuário estar na tela de perfil inicial.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT301 | 1. Deixar o campo apelido vazio.<br>2. Clicar em 'Concluir'. | 1. O sistema exibe uma mensagem de erro solicitando o preenchimento. | |
| CT302 | 1. Informar um apelido já utilizado por outro usuário.<br>2. Clicar em 'Concluir'. | 1. O sistema exibe uma mensagem de erro informando que o apelido está indisponível. | |

---

### UC018 – Entrar com Google

| Campo | Descrição |
|---|---|
| **Ator(es)** | Usuário |
| **Descrição** | Este caso de uso permite que o usuário se cadastre ou autentique no sistema usando sua conta Google, sem preencher e-mail e senha manualmente. |
| **Pré-condições** | Usuário possuir uma conta Google válida no dispositivo. |
| **Caminho no sistema** | Página inicial > Entrar com Google / Boas-vindas > Entrar com Google |
| **Fluxo principal** | 1. O usuário clica no botão 'Entrar com Google'.<br>2. O sistema abre a tela de seleção de conta do Google.<br>3. O usuário seleciona uma conta.<br>4. O sistema autentica o usuário e, se for o primeiro acesso, cria o cadastro automaticamente.<br>5. O sistema redireciona para a tela inicial (ou onboarding, se for o primeiro acesso). |
| **Fluxo de exceção 1** | 1. O usuário cancela a seleção de conta na tela do Google.<br>2. O sistema retorna à tela anterior sem autenticar. |
| **Fluxo de exceção 2** | 1. O dispositivo está sem conexão com a internet.<br>2. O sistema exibe uma mensagem de erro informando a falha de conexão. |

Abaixo segue o roteiro de teste elaborado com base no caso de uso explicado acima.

#### RT.018 - Entrar com Google

**CN001 – Autenticar com Google com sucesso (usuário novo)**
Localização: Boas-vindas > Entrar com Google
Pré-condições: Conta Google nunca usada no StudoCore.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT101 | 1. Clicar em 'Entrar com Google'.<br>2. Selecionar uma conta Google. | 1. O sistema cria o cadastro automaticamente e direciona para o onboarding. | |

**CN002 – Autenticar com Google com sucesso (usuário existente)**
Localização: Página inicial > Entrar com Google
Pré-condições: Conta Google já vinculada a um cadastro no StudoCore.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT201 | 1. Clicar em 'Entrar com Google'.<br>2. Selecionar a conta já vinculada. | 1. O sistema autentica o usuário e direciona para a tela inicial. | |

**CN003 – Cancelar seleção de conta**
Localização: Página inicial > Entrar com Google
Pré-condições: Nenhuma.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT301 | 1. Clicar em 'Entrar com Google'.<br>2. Cancelar a seleção de conta na tela do Google. | 1. O sistema retorna à tela anterior sem autenticar. | |

**CN004 – Falha de conexão**
Localização: Página inicial > Entrar com Google
Pré-condições: Dispositivo sem conexão com a internet.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT401 | 1. Clicar em 'Entrar com Google' sem conexão. | 1. O sistema exibe uma mensagem de erro informando a falha de conexão. | |

---

### UC019 – Registrar feedback pós-sessão de foco

| Campo | Descrição |
|---|---|
| **Ator(es)** | Usuário |
| **Descrição** | Este caso de uso permite que, ao encerrar uma sessão de foco, o usuário registre anotações, uma foto da sessão e responda a um quiz gerado por IA sobre o conteúdo estudado. |
| **Pré-condições** | Uma sessão de foco ter sido concluída ou encerrada. UC003 |
| **Caminho no sistema** | Pomodoro > Encerrar sessão > Feedback da sessão |
| **Fluxo principal** | 1. O sistema exibe a tela de feedback ao final da sessão.<br>2. O usuário escreve anotações sobre o que estudou.<br>3. O usuário anexa uma foto da sessão (opcional).<br>4. O usuário clica em 'Gerar quiz'.<br>5. O sistema gera perguntas com IA sobre o conteúdo informado.<br>6. O usuário responde às perguntas.<br>7. O sistema salva a sessão com as anotações, foto e resultado do quiz. |
| **Fluxo Alternativo 1** | 1. O usuário pula a etapa de quiz.<br>2. O sistema salva a sessão apenas com anotações e foto (se houver). |
| **Fluxo de exceção 1** | 1. O serviço de IA não consegue gerar o quiz (erro de conexão ou indisponibilidade).<br>2. O sistema exibe uma mensagem de erro e permite salvar a sessão sem o quiz. |
| **Fluxo de exceção 2** | 1. A foto selecionada excede o tamanho ou formato permitido.<br>2. O sistema exibe uma mensagem de erro e não anexa a foto. |

Abaixo segue o roteiro de teste elaborado com base no caso de uso explicado acima.

#### RT.019 - Registrar feedback pós-sessão de foco

**CN001 – Registrar feedback completo com sucesso**
Localização: Pomodoro > Feedback da sessão
Pré-condições: Sessão de foco concluída.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT101 | 1. Escrever anotações.<br>2. Anexar uma foto válida.<br>3. Clicar em 'Gerar quiz'.<br>4. Responder às perguntas. | 1. O sistema salva a sessão com anotações, foto e resultado do quiz. | |

**CN002 – Pular etapa de quiz**
Localização: Pomodoro > Feedback da sessão
Pré-condições: Sessão de foco concluída.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT201 | 1. Escrever anotações.<br>2. Pular a etapa do quiz. | 1. O sistema salva a sessão apenas com as anotações. | |

**CN003 – Falha ao gerar quiz**
Localização: Pomodoro > Feedback da sessão
Pré-condições: Serviço de IA indisponível ou dispositivo sem conexão.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT301 | 1. Clicar em 'Gerar quiz' sem conexão com o serviço de IA. | 1. O sistema exibe uma mensagem de erro e permite salvar a sessão sem o quiz. | |

**CN004 – Anexar foto inválida**
Localização: Pomodoro > Feedback da sessão
Pré-condições: Sessão de foco concluída.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT401 | 1. Selecionar uma foto que excede o tamanho permitido. | 1. O sistema exibe uma mensagem de erro e não anexa a foto. | |

---

### UC020 – Anexar e corrigir PDF de questões na sessão

| Campo | Descrição |
|---|---|
| **Ator(es)** | Usuário |
| **Descrição** | Este caso de uso permite que o usuário anexe um PDF de questões a uma sessão de estudo e registre sua correção, seja por gabarito (extraído automaticamente pela IA) ou por marcação manual de certo/errado. |
| **Pré-condições** | Usuário estar autenticado no sistema. UC002 |
| **Caminho no sistema** | Feedback da sessão > Adicionar anexo > Corrigir anexo |
| **Fluxo principal** | 1. O usuário anexa um PDF de questões à sessão.<br>2. O sistema analisa o PDF e identifica se há gabarito.<br>3. O usuário acessa a tela 'Corrigir anexo'.<br>4. Caso exista gabarito, o usuário marca as respostas dadas.<br>5. O sistema compara com o gabarito e calcula o resultado por questão.<br>6. O usuário clica em 'Salvar correção'.<br>7. O sistema registra o resultado por questão no banco de erros. |
| **Fluxo Alternativo 1** | 1. O PDF não possui gabarito identificável.<br>2. O usuário marca certo/errado questão a questão manualmente (modo 'grade'). |
| **Fluxo de exceção 1** | 1. O usuário tenta anexar um arquivo que não é PDF ou excede o tamanho máximo.<br>2. O sistema exibe uma mensagem de erro e não anexa o arquivo. |
| **Fluxo de exceção 2** | 1. O usuário tenta salvar a correção sem marcar nenhuma resposta.<br>2. O sistema exibe uma mensagem de erro solicitando o preenchimento. |

Abaixo segue o roteiro de teste elaborado com base no caso de uso explicado acima.

#### RT.020 - Anexar e corrigir PDF de questões na sessão

**CN001 – Anexar PDF com sucesso**
Localização: Feedback da sessão > Adicionar anexo
Pré-condições: Usuário estar autenticado no sistema. UC002

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT101 | 1. Selecionar um arquivo PDF válido.<br>2. Confirmar o anexo. | 1. O sistema analisa o PDF e o disponibiliza para correção. | |

**CN002 – Corrigir com gabarito extraído**
Localização: Corrigir anexo
Pré-condições: PDF anexado possuir gabarito identificado pela IA.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT201 | 1. Marcar as respostas dadas para cada questão.<br>2. Clicar em 'Salvar correção'. | 1. O sistema compara com o gabarito, calcula o resultado por questão e o registra. | |

**CN003 – Corrigir sem gabarito (modo grade)**
Localização: Corrigir anexo
Pré-condições: PDF anexado não possuir gabarito identificado.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT301 | 1. Marcar certo/errado questão a questão.<br>2. Clicar em 'Salvar correção'. | 1. O sistema registra o resultado por questão informado manualmente. | |

**CN004 – Anexar arquivo inválido**
Localização: Feedback da sessão > Adicionar anexo
Pré-condições: Usuário estar autenticado no sistema.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT401 | 1. Selecionar um arquivo que não é PDF ou excede o tamanho máximo. | 1. O sistema exibe uma mensagem de erro e não anexa o arquivo. | |

**CN005 – Salvar correção sem respostas**
Localização: Corrigir anexo
Pré-condições: PDF anexado disponível para correção.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT501 | 1. Clicar em 'Salvar correção' sem marcar nenhuma resposta. | 1. O sistema exibe uma mensagem de erro solicitando o preenchimento. | |

---

### UC021 – Conversar com IA sobre um anexo de sessão

| Campo | Descrição |
|---|---|
| **Ator(es)** | Usuário |
| **Descrição** | Este caso de uso permite que o usuário converse com uma IA sobre o conteúdo de um PDF anexado a uma sessão, tirando dúvidas ou pedindo questões semelhantes. |
| **Pré-condições** | Existir um anexo de sessão já processado. UC020 |
| **Caminho no sistema** | Detalhes da sessão > Anexo > Chat com IA |
| **Fluxo principal** | 1. O usuário acessa o chat do anexo.<br>2. O sistema exibe sugestões de perguntas iniciais.<br>3. O usuário digita uma pergunta ou seleciona uma sugestão.<br>4. O usuário envia a mensagem.<br>5. O sistema exibe um indicador de carregamento.<br>6. O sistema responde com base no conteúdo do anexo. |
| **Fluxo Alternativo 1** | 1. O usuário clica em uma das sugestões clicáveis.<br>2. O sistema envia a sugestão como mensagem automaticamente. |
| **Fluxo de exceção 1** | 1. O serviço de IA não responde (erro de conexão ou indisponibilidade).<br>2. O sistema exibe uma mensagem de erro no chat. |

Abaixo segue o roteiro de teste elaborado com base no caso de uso explicado acima.

#### RT.021 - Conversar com IA sobre um anexo de sessão

**CN001 – Enviar mensagem com sucesso**
Localização: Detalhes da sessão > Anexo > Chat com IA
Pré-condições: Anexo de sessão já processado.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT101 | 1. Digitar uma pergunta sobre o anexo.<br>2. Enviar a mensagem. | 1. O sistema exibe a resposta da IA com base no conteúdo do anexo. | |

**CN002 – Usar sugestão de pergunta**
Localização: Chat com IA
Pré-condições: Chat recém-aberto, sem mensagens enviadas.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT201 | 1. Clicar em uma sugestão de pergunta exibida. | 1. O sistema envia a sugestão automaticamente e exibe a resposta da IA. | |

**CN003 – Falha ao responder**
Localização: Chat com IA
Pré-condições: Serviço de IA indisponível ou dispositivo sem conexão.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT301 | 1. Enviar uma mensagem sem conexão com o serviço de IA. | 1. O sistema exibe uma mensagem de erro no chat. | |

---

### UC022 – Ver colegas focando em tempo real

| Campo | Descrição |
|---|---|
| **Ator(es)** | Usuário |
| **Descrição** | Este caso de uso permite que o usuário visualize, em tempo real, quem mais está em uma sessão de foco na mesma sala, e envie um incentivo ('força') aos colegas. |
| **Pré-condições** | Usuário estar participando de uma sala de foco compartilhada. |
| **Caminho no sistema** | Sessão de foco > Colegas Focando |
| **Fluxo principal** | 1. O usuário acessa a tela 'Colegas Focando'.<br>2. O sistema exibe a lista de participantes da sala com o tempo de foco ao vivo de cada um.<br>3. O usuário seleciona um colega e clica em enviar 'força'.<br>4. O sistema registra o incentivo e inicia um cooldown para o mesmo colega. |
| **Fluxo Alternativo 1** | 1. Um novo colega entra na sala.<br>2. O sistema atualiza a lista de participantes em tempo real, sem necessidade de recarregar a tela. |
| **Fluxo de exceção 1** | 1. O usuário tenta enviar 'força' para o mesmo colega antes do cooldown terminar.<br>2. O sistema impede o novo envio e exibe o tempo restante do cooldown. |

Abaixo segue o roteiro de teste elaborado com base no caso de uso explicado acima.

#### RT.022 - Ver colegas focando em tempo real

**CN001 – Visualizar participantes da sala**
Localização: Sessão de foco > Colegas Focando
Pré-condições: Usuário participar de uma sala de foco com outros membros.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT101 | 1. Acessar a tela 'Colegas Focando'. | 1. O sistema exibe os participantes da sala com o tempo de foco ao vivo de cada um. | |

**CN002 – Enviar incentivo (força)**
Localização: Colegas Focando
Pré-condições: Cooldown de incentivo disponível para o colega selecionado.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT201 | 1. Selecionar um colega.<br>2. Clicar em enviar 'força'. | 1. O sistema registra o incentivo e inicia o cooldown para aquele colega. | |

**CN003 – Enviar incentivo durante o cooldown**
Localização: Colegas Focando
Pré-condições: Cooldown de incentivo em andamento para o colega selecionado.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT301 | 1. Tentar enviar 'força' para um colega que ainda está em cooldown. | 1. O sistema impede o envio e exibe o tempo restante do cooldown. | |

**CN004 – Atualização em tempo real**
Localização: Colegas Focando
Pré-condições: Usuário estar com a tela 'Colegas Focando' aberta.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT401 | 1. Outro usuário entra na mesma sala de foco. | 1. A lista de participantes é atualizada automaticamente, sem necessidade de recarregar a tela. | |

---

### UC023 – Buscar e entrar em grupo público

| Campo | Descrição |
|---|---|
| **Ator(es)** | Usuário |
| **Descrição** | Este caso de uso permite que o usuário pesquise grupos públicos de estudo por nome, veja seus detalhes e entre neles. |
| **Pré-condições** | Usuário estar autenticado no sistema. UC002 |
| **Caminho no sistema** | Página inicial > Grupos > Explorar grupos |
| **Fluxo principal** | 1. O usuário acessa a tela 'Explorar grupos'.<br>2. O sistema exibe a lista de grupos públicos disponíveis.<br>3. O usuário pesquisa por nome do grupo.<br>4. O usuário seleciona um grupo na lista.<br>5. O sistema exibe os detalhes do grupo (membros, meta semanal, se é público ou privado).<br>6. O usuário clica em 'Entrar neste grupo'.<br>7. O sistema adiciona o usuário ao grupo. |
| **Fluxo Alternativo 1** | 1. O usuário arrasta a tela para baixo (pull-to-refresh).<br>2. O sistema atualiza a lista de grupos públicos. |
| **Fluxo de exceção 1** | 1. A pesquisa não retorna nenhum grupo correspondente.<br>2. O sistema exibe uma mensagem informando que nenhum grupo foi encontrado. |
| **Fluxo de exceção 2** | 1. O usuário tenta entrar em um grupo do qual já participa.<br>2. O sistema exibe uma mensagem informando que o usuário já é membro. |

Abaixo segue o roteiro de teste elaborado com base no caso de uso explicado acima.

#### RT.023 - Buscar e entrar em grupo público

**CN001 – Pesquisar grupo por nome**
Localização: Página inicial > Grupos > Explorar grupos
Pré-condições: Usuário estar autenticado no sistema. UC002

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT101 | 1. Informar o nome de um grupo existente na busca. | 1. O sistema exibe apenas os grupos correspondentes à pesquisa. | |

**CN002 – Entrar em grupo público com sucesso**
Localização: Explorar grupos > Detalhes do grupo
Pré-condições: Usuário não ser membro do grupo selecionado.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT201 | 1. Selecionar um grupo público.<br>2. Clicar em 'Entrar neste grupo'. | 1. O sistema adiciona o usuário ao grupo e exibe a tela do grupo. | |

**CN003 – Pesquisa sem resultados**
Localização: Explorar grupos
Pré-condições: Usuário estar autenticado no sistema.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT301 | 1. Pesquisar por um nome de grupo inexistente. | 1. O sistema exibe uma mensagem informando que nenhum grupo foi encontrado. | |

**CN004 – Entrar em grupo já participante**
Localização: Explorar grupos > Detalhes do grupo
Pré-condições: Usuário já ser membro do grupo selecionado.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT401 | 1. Selecionar um grupo do qual já participa.<br>2. Clicar em 'Entrar neste grupo'. | 1. O sistema exibe uma mensagem informando que o usuário já é membro. | |

---

### UC024 – Criar grupo e convidar membros

| Campo | Descrição |
|---|---|
| **Ator(es)** | Usuário |
| **Descrição** | Este caso de uso permite que o usuário crie um grupo de estudo definindo nome, descrição, visibilidade e meta semanal, e convide pessoas por link, WhatsApp ou contatos da agenda. |
| **Pré-condições** | Usuário estar autenticado no sistema. UC002 |
| **Caminho no sistema** | Página inicial > Grupos > Criar grupo |
| **Fluxo principal** | 1. O usuário acessa a tela 'Criar grupo'.<br>2. O usuário preenche nome, descrição e meta semanal.<br>3. O usuário define o grupo como público ou privado.<br>4. O usuário clica em 'Criar'.<br>5. O sistema cria o grupo e exibe a tela de convite.<br>6. O usuário compartilha o link de convite via WhatsApp, contatos ou copiando o link. |
| **Fluxo Alternativo 1** | 1. O usuário seleciona um contato da agenda na tela de convite.<br>2. O sistema abre o WhatsApp com uma mensagem de convite pré-preenchida para aquele contato. |
| **Fluxo de exceção 1** | 1. O usuário tenta criar o grupo sem preencher nome ou descrição.<br>2. O sistema exibe uma mensagem de erro solicitando o preenchimento dos campos. |
| **Fluxo de exceção 2** | 1. O usuário nega a permissão de acesso aos contatos.<br>2. O sistema exibe a tela de convite sem a lista de contatos, mantendo as demais opções de compartilhamento. |

Abaixo segue o roteiro de teste elaborado com base no caso de uso explicado acima.

#### RT.024 - Criar grupo e convidar membros

**CN001 – Criar grupo com sucesso**
Localização: Página inicial > Grupos > Criar grupo
Pré-condições: Usuário estar autenticado no sistema. UC002

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT101 | 1. Preencher nome, descrição e meta semanal.<br>2. Clicar em 'Criar'. | 1. O sistema cria o grupo e exibe a tela de convite. | |

**CN002 – Criar grupo com dados inválidos**
Localização: Criar grupo
Pré-condições: Usuário estar autenticado no sistema.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT201 | 1. Deixar o nome ou a descrição vazios.<br>2. Clicar em 'Criar'. | 1. O sistema exibe uma mensagem de erro solicitando o preenchimento dos campos. | |

**CN003 – Convidar por link/WhatsApp**
Localização: Tela de convite
Pré-condições: Grupo já criado.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT301 | 1. Clicar em copiar o link de convite. | 1. O sistema copia o link do grupo para a área de transferência. | |
| CT302 | 1. Informar um número e clicar em convidar via WhatsApp. | 1. O sistema abre o WhatsApp com a mensagem de convite pré-preenchida. | |

**CN004 – Convidar por contatos sem permissão**
Localização: Tela de convite
Pré-condições: Permissão de acesso aos contatos negada pelo usuário.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT401 | 1. Acessar a tela de convite sem conceder permissão de contatos. | 1. O sistema exibe a tela sem a lista de contatos, mantendo as demais formas de compartilhamento. | |

---

### UC025 – Gerenciar configurações do grupo (administrador)

| Campo | Descrição |
|---|---|
| **Ator(es)** | Usuário (administrador do grupo) |
| **Descrição** | Este caso de uso permite que o administrador de um grupo altere seus dados, defina quem pode convidar novos membros, remova participantes e exclua ou saia do grupo. |
| **Pré-condições** | Usuário ser administrador do grupo. UC024 |
| **Caminho no sistema** | Grupo > Configurações |
| **Fluxo principal** | 1. O administrador acessa as 'Configurações' do grupo.<br>2. O sistema exibe os dados do grupo e a lista de membros.<br>3. O administrador altera nome, descrição, foto ou meta semanal.<br>4. O sistema salva as alterações automaticamente. |
| **Fluxo Alternativo 1** | 1. O administrador altera a permissão de quem pode convidar novos membros.<br>2. O sistema aplica a nova permissão imediatamente. |
| **Fluxo Alternativo 2** | 1. O administrador seleciona um membro na lista.<br>2. O administrador clica em 'Remover do grupo'.<br>3. O sistema exibe uma confirmação e, após confirmar, remove o membro. |
| **Fluxo de exceção 1** | 1. O administrador clica em 'Excluir grupo'.<br>2. O sistema exibe uma mensagem de confirmação alertando que a ação é irreversível.<br>3. O administrador confirma e o sistema exclui o grupo e todos os dados associados. |
| **Fluxo de exceção 2** | 1. Um membro (não administrador) tenta acessar as opções de exclusão de grupo ou remoção de membros.<br>2. O sistema não exibe essas opções para membros sem permissão de administrador. |

Abaixo segue o roteiro de teste elaborado com base no caso de uso explicado acima.

#### RT.025 - Gerenciar configurações do grupo (administrador)

**CN001 – Editar dados do grupo**
Localização: Grupo > Configurações
Pré-condições: Usuário ser administrador do grupo.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT101 | 1. Alterar o nome ou a meta semanal do grupo. | 1. O sistema salva a alteração automaticamente. | |

**CN002 – Alterar permissão de convite**
Localização: Configurações do grupo
Pré-condições: Usuário ser administrador do grupo.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT201 | 1. Alterar quem pode convidar novos membros. | 1. O sistema aplica a nova permissão imediatamente. | |

**CN003 – Remover membro do grupo**
Localização: Configurações do grupo
Pré-condições: Existir ao menos um membro além do administrador.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT301 | 1. Selecionar um membro.<br>2. Clicar em 'Remover do grupo'.<br>3. Confirmar a remoção. | 1. O sistema remove o membro do grupo. | |

**CN004 – Excluir grupo**
Localização: Configurações do grupo
Pré-condições: Usuário ser administrador do grupo.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT401 | 1. Clicar em 'Excluir grupo'.<br>2. Confirmar a exclusão. | 1. O sistema exclui o grupo e todos os dados associados. | |

**CN005 – Membro sem permissão de administrador**
Localização: Configurações do grupo
Pré-condições: Usuário ser membro comum (não administrador).

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT501 | 1. Acessar as configurações do grupo como membro comum. | 1. O sistema não exibe as opções de excluir grupo ou remover membros. | |

---

### UC026 – Gerar roadmap de estudos com IA

| Campo | Descrição |
|---|---|
| **Ator(es)** | Usuário |
| **Descrição** | Este caso de uso permite que o usuário gere, com o auxílio de IA, uma proposta de roadmap de estudos (pessoal ou de grupo) a partir de um objetivo, matérias, disponibilidade e, opcionalmente, arquivos de referência (edital, ementa), revisando-a antes de aceitar. |
| **Pré-condições** | Usuário estar autenticado no sistema. UC002. Para o escopo de grupo, ser administrador do grupo. |
| **Caminho no sistema** | Cronograma / Grupo > Gerar roadmap |
| **Fluxo principal** | 1. O usuário acessa a tela 'Gerar roadmap'.<br>2. O usuário descreve o objetivo, seleciona matérias e disponibilidade.<br>3. O usuário anexa opcionalmente um ou mais PDFs de referência.<br>4. O usuário clica em 'Gerar'.<br>5. O sistema exibe um indicador de carregamento e chama o serviço de IA.<br>6. O sistema exibe a proposta de roadmap na tela de revisão, organizada por dia.<br>7. O usuário remove blocos indesejados, se necessário.<br>8. O usuário clica em 'Aceitar roadmap'.<br>9. O sistema grava o roadmap: como plano pessoal, ou distribuindo uma cópia para cada membro do grupo. |
| **Fluxo Alternativo 1** | 1. O usuário está no escopo de grupo.<br>2. O sistema exibe um aviso de que o roadmap valerá para todos os membros do grupo antes de aceitar. |
| **Fluxo de exceção 1** | 1. O usuário tenta gerar o roadmap sem preencher o objetivo.<br>2. O sistema exibe uma mensagem de erro solicitando o preenchimento. |
| **Fluxo de exceção 2** | 1. O serviço de IA não consegue gerar a proposta (erro de conexão ou indisponibilidade).<br>2. O sistema exibe uma mensagem de erro com a opção de tentar novamente. |
| **Fluxo de exceção 3** | 1. O usuário anexa um arquivo que excede o tamanho máximo permitido.<br>2. O sistema exibe uma mensagem de erro informando o limite. |

Abaixo segue o roteiro de teste elaborado com base no caso de uso explicado acima.

#### RT.026 - Gerar roadmap de estudos com IA

**CN001 – Gerar e aceitar roadmap pessoal**
Localização: Cronograma > Gerar roadmap
Pré-condições: Usuário estar autenticado no sistema. UC002

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT101 | 1. Preencher objetivo, matérias e disponibilidade.<br>2. Clicar em 'Gerar'.<br>3. Revisar a proposta.<br>4. Clicar em 'Aceitar roadmap'. | 1. O sistema grava o roadmap como um plano pessoal do usuário. | |

**CN002 – Gerar e publicar roadmap de grupo**
Localização: Grupo > Gerar roadmap
Pré-condições: Usuário ser administrador do grupo.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT201 | 1. Preencher objetivo do roadmap de grupo.<br>2. Clicar em 'Gerar'.<br>3. Revisar a proposta.<br>4. Clicar em 'Aceitar e publicar'. | 1. O sistema distribui uma cópia do roadmap para cada membro do grupo. | |

**CN003 – Remover bloco da proposta antes de aceitar**
Localização: Preview do roadmap
Pré-condições: Proposta de roadmap gerada com sucesso.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT301 | 1. Remover um bloco da proposta.<br>2. Clicar em 'Aceitar roadmap'. | 1. O sistema grava o roadmap sem o bloco removido. | |

**CN004 – Gerar sem preencher objetivo**
Localização: Gerar roadmap
Pré-condições: Usuário estar autenticado no sistema.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT401 | 1. Clicar em 'Gerar' sem preencher o objetivo. | 1. O sistema exibe uma mensagem de erro solicitando o preenchimento. | |

**CN005 – Falha ao gerar roadmap**
Localização: Gerar roadmap
Pré-condições: Serviço de IA indisponível ou dispositivo sem conexão.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT501 | 1. Preencher os campos e clicar em 'Gerar' sem conexão com o serviço de IA. | 1. O sistema exibe uma mensagem de erro com a opção de tentar novamente. | |

**CN006 – Anexar arquivo de referência acima do limite**
Localização: Gerar roadmap
Pré-condições: Usuário estar autenticado no sistema.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT601 | 1. Anexar um PDF de referência que excede o tamanho máximo permitido. | 1. O sistema exibe uma mensagem de erro informando o limite de tamanho. | |

---

### UC027 – Consultar ranking completo do grupo

| Campo | Descrição |
|---|---|
| **Ator(es)** | Usuário |
| **Descrição** | Este caso de uso permite que o usuário visualize o ranking completo de tempo estudado dos membros de um grupo, com pódio e filtros por período. |
| **Pré-condições** | Usuário participar de um grupo. UC008 |
| **Caminho no sistema** | Grupo > Ranking completo |
| **Fluxo principal** | 1. O usuário acessa o 'Ranking completo' do grupo.<br>2. O sistema exibe o pódio dos três primeiros colocados e a lista dos demais membros ordenada por tempo estudado.<br>3. O usuário seleciona um filtro de período (diário, semanal ou mensal).<br>4. O sistema atualiza o ranking conforme o período selecionado. |
| **Fluxo Alternativo 1** | 1. O usuário arrasta a tela para baixo (pull-to-refresh).<br>2. O sistema atualiza os dados do ranking. |
| **Fluxo de exceção 1** | 1. Nenhum membro do grupo possui tempo estudado no período selecionado.<br>2. O sistema exibe uma mensagem informando que ainda não há dados para o período. |

Abaixo segue o roteiro de teste elaborado com base no caso de uso explicado acima.

#### RT.027 - Consultar ranking completo do grupo

**CN001 – Visualizar ranking completo**
Localização: Grupo > Ranking completo
Pré-condições: Usuário participar de um grupo com membros pontuando.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT101 | 1. Acessar o 'Ranking completo' do grupo. | 1. O sistema exibe o pódio e a lista de membros ordenada por tempo estudado. | |

**CN002 – Filtrar ranking por período**
Localização: Ranking completo
Pré-condições: Usuário estar na tela de ranking completo.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT201 | 1. Selecionar o filtro 'Mensal'. | 1. O sistema atualiza o pódio e a lista conforme o período selecionado. | |

**CN003 – Ranking sem dados no período**
Localização: Ranking completo
Pré-condições: Nenhum membro possuir tempo estudado no período selecionado.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT301 | 1. Selecionar um período sem nenhum registro de estudo. | 1. O sistema exibe uma mensagem informando que ainda não há dados para o período. | |

---

### UC028 – Comparar perfil com outro usuário (duelo)

| Campo | Descrição |
|---|---|
| **Ator(es)** | Usuário |
| **Descrição** | Este caso de uso permite que o usuário compare suas estatísticas de estudo (tempo, sequência, questões, medalhas) com as de outro usuário, em formato de duelo, e compartilhe o resultado. |
| **Pré-condições** | Usuário estar autenticado no sistema. UC002. O perfil do outro usuário ser público ou visível ao usuário. |
| **Caminho no sistema** | Perfil de membro > Comparar |
| **Fluxo principal** | 1. O usuário acessa o perfil de outro membro.<br>2. O usuário clica em 'Comparar'.<br>3. O sistema exibe o duelo com as estatísticas dos dois lado a lado, destacando quem está à frente em cada categoria.<br>4. O usuário clica em 'Compartilhar'.<br>5. O sistema gera uma imagem do duelo para compartilhamento. |
| **Fluxo Alternativo 1** | 1. O usuário arrasta a tela para baixo (pull-to-refresh).<br>2. O sistema atualiza as estatísticas do duelo. |
| **Fluxo de exceção 1** | 1. O perfil do outro usuário é privado.<br>2. O sistema exibe uma mensagem informando que o perfil não está disponível para comparação. |

Abaixo segue o roteiro de teste elaborado com base no caso de uso explicado acima.

#### RT.028 - Comparar perfil com outro usuário (duelo)

**CN001 – Comparar perfis com sucesso**
Localização: Perfil de membro > Comparar
Pré-condições: Perfil do outro usuário ser público.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT101 | 1. Acessar o perfil de um membro.<br>2. Clicar em 'Comparar'. | 1. O sistema exibe o duelo com as estatísticas dos dois usuários lado a lado. | |

**CN002 – Compartilhar resultado do duelo**
Localização: Tela de duelo
Pré-condições: Duelo carregado com sucesso.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT201 | 1. Clicar em 'Compartilhar'. | 1. O sistema gera uma imagem do duelo e abre as opções de compartilhamento do dispositivo. | |

**CN003 – Comparar com perfil privado**
Localização: Perfil de membro > Comparar
Pré-condições: Perfil do outro usuário estar configurado como privado.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT301 | 1. Tentar comparar com um usuário de perfil privado. | 1. O sistema exibe uma mensagem informando que o perfil não está disponível para comparação. | |

---

### UC029 – Visualizar perfil de um membro

| Campo | Descrição |
|---|---|
| **Ator(es)** | Usuário |
| **Descrição** | Este caso de uso permite que o usuário visualize o perfil público de outro membro (bio, medalhas, sequência de estudo, galeria de sessões), a partir de um grupo ou de uma sessão compartilhada. |
| **Pré-condições** | Usuário estar autenticado no sistema. UC002 |
| **Caminho no sistema** | Grupo / Sessão > Perfil do membro |
| **Fluxo principal** | 1. O usuário seleciona um membro em um grupo ou em uma sessão.<br>2. O sistema exibe o perfil do membro: bio, ofensiva, medalhas e galeria de sessões.<br>3. O usuário arrasta a tela para baixo para atualizar os dados. |
| **Fluxo Alternativo 1** | 1. O usuário clica no botão de comparar perfil a partir da tela.<br>2. O sistema abre a tela de duelo (UC028). |
| **Fluxo de exceção 1** | 1. O membro selecionado possui perfil privado.<br>2. O sistema exibe as informações públicas mínimas e oculta estatísticas e galeria de sessões. |

Abaixo segue o roteiro de teste elaborado com base no caso de uso explicado acima.

#### RT.029 - Visualizar perfil de um membro

**CN001 – Visualizar perfil de membro com sucesso**
Localização: Grupo > Perfil do membro
Pré-condições: Usuário estar autenticado no sistema. UC002

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT101 | 1. Selecionar um membro do grupo. | 1. O sistema exibe o perfil com bio, medalhas, ofensiva e galeria de sessões. | |

**CN002 – Atualizar perfil por pull-to-refresh**
Localização: Perfil do membro
Pré-condições: Usuário estar na tela de perfil de um membro.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT201 | 1. Arrastar a tela para baixo. | 1. O sistema atualiza as informações exibidas no perfil. | |

**CN003 – Visualizar perfil privado**
Localização: Perfil do membro
Pré-condições: Membro selecionado possuir perfil configurado como privado.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT301 | 1. Selecionar um membro com perfil privado. | 1. O sistema exibe apenas as informações públicas mínimas, ocultando estatísticas e galeria. | |

---

### UC030 – Gerenciar matérias de estudo

| Campo | Descrição |
|---|---|
| **Ator(es)** | Usuário |
| **Descrição** | Este caso de uso permite que o usuário crie matérias personalizadas de estudo ou adote matérias já usadas pela comunidade, para usar no cronograma e nas sessões de foco. |
| **Pré-condições** | Usuário estar autenticado no sistema. UC002 |
| **Caminho no sistema** | Cronograma > Matérias > Criar matéria |
| **Fluxo principal** | 1. O usuário acessa a tela 'Criar matéria'.<br>2. O sistema exibe as matérias já criadas pelo usuário e sugestões da comunidade.<br>3. O usuário informa o nome da nova matéria.<br>4. O usuário clica em 'Criar'.<br>5. O sistema adiciona a matéria à lista do usuário. |
| **Fluxo Alternativo 1** | 1. O usuário seleciona uma matéria sugerida pela comunidade.<br>2. O sistema adiciona a matéria à lista do usuário sem necessidade de digitar o nome. |
| **Fluxo Alternativo 2** | 1. O usuário seleciona uma matéria própria e clica em excluir.<br>2. O sistema verifica se a matéria está em uso em algum bloco do cronograma antes de excluir.<br>3. O sistema remove a matéria caso não esteja em uso. |
| **Fluxo de exceção 1** | 1. O usuário tenta criar uma matéria com nome já existente na sua lista (após normalização do nome).<br>2. O sistema exibe uma mensagem de erro informando que a matéria já existe. |
| **Fluxo de exceção 2** | 1. O usuário tenta excluir uma matéria que está em uso em um bloco do cronograma.<br>2. O sistema exibe uma mensagem de erro informando que a matéria está em uso e não pode ser excluída. |

Abaixo segue o roteiro de teste elaborado com base no caso de uso explicado acima.

#### RT.030 - Gerenciar matérias de estudo

**CN001 – Criar matéria com sucesso**
Localização: Cronograma > Matérias > Criar matéria
Pré-condições: Usuário estar autenticado no sistema. UC002

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT101 | 1. Informar o nome da nova matéria.<br>2. Clicar em 'Criar'. | 1. O sistema adiciona a matéria à lista do usuário. | |

**CN002 – Adotar matéria da comunidade**
Localização: Criar matéria
Pré-condições: Existirem matérias sugeridas pela comunidade.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT201 | 1. Selecionar uma matéria sugerida pela comunidade. | 1. O sistema adiciona a matéria à lista do usuário. | |

**CN003 – Criar matéria duplicada**
Localização: Criar matéria
Pré-condições: Usuário já possuir uma matéria com o mesmo nome (normalizado).

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT301 | 1. Informar o nome de uma matéria já existente na lista do usuário.<br>2. Clicar em 'Criar'. | 1. O sistema exibe uma mensagem de erro informando que a matéria já existe. | |

**CN004 – Excluir matéria sem uso**
Localização: Criar matéria
Pré-condições: Matéria não estar associada a nenhum bloco do cronograma.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT401 | 1. Selecionar uma matéria sem uso.<br>2. Clicar em excluir.<br>3. Confirmar a exclusão. | 1. O sistema remove a matéria da lista do usuário. | |

**CN005 – Excluir matéria em uso**
Localização: Criar matéria
Pré-condições: Matéria estar associada a algum bloco do cronograma.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT501 | 1. Selecionar uma matéria em uso.<br>2. Clicar em excluir. | 1. O sistema exibe uma mensagem de erro informando que a matéria está em uso e não pode ser excluída. | |

---

### UC031 – Montar plano de estudos multi-bloco

| Campo | Descrição |
|---|---|
| **Ator(es)** | Usuário |
| **Descrição** | Este caso de uso permite que o usuário monte um plano de estudos composto por vários blocos (matéria, duração, pausas), organizados em sequência para um dia específico, incluindo blocos no formato Pomodoro. |
| **Pré-condições** | Usuário estar autenticado no sistema. UC002 |
| **Caminho no sistema** | Cronograma > Planos > Editor de plano |
| **Fluxo principal** | 1. O usuário acessa o 'Editor de plano'.<br>2. O usuário informa o nome do plano.<br>3. O usuário adiciona um ou mais blocos, definindo matéria, duração e pausa.<br>4. O usuário clica em 'Salvar plano'.<br>5. O sistema salva o plano e exibe a lista de blocos organizados em sequência. |
| **Fluxo Alternativo 1** | 1. O usuário adiciona um bloco no formato Pomodoro (quantidade de ciclos, duração de foco e descanso).<br>2. O sistema gera automaticamente a sequência de blocos de foco e pausa. |
| **Fluxo Alternativo 2** | 1. O usuário clica em 'Aplicar hoje' em um plano salvo.<br>2. O sistema copia os blocos do plano para o cronograma do dia atual e agenda os lembretes. |
| **Fluxo de exceção 1** | 1. O sistema detecta conflito de horário entre dois blocos do plano.<br>2. O sistema exibe uma mensagem de erro informando o conflito e não salva o bloco conflitante. |
| **Fluxo de exceção 2** | 1. O usuário tenta salvar o plano sem nenhum bloco adicionado.<br>2. O sistema exibe uma mensagem de erro solicitando ao menos um bloco. |

Abaixo segue o roteiro de teste elaborado com base no caso de uso explicado acima.

#### RT.031 - Montar plano de estudos multi-bloco

**CN001 – Criar plano com blocos com sucesso**
Localização: Cronograma > Planos > Editor de plano
Pré-condições: Usuário estar autenticado no sistema. UC002

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT101 | 1. Informar o nome do plano.<br>2. Adicionar um bloco com matéria e duração.<br>3. Clicar em 'Salvar plano'. | 1. O sistema salva o plano com o bloco adicionado. | |

**CN002 – Adicionar bloco Pomodoro ao plano**
Localização: Editor de plano > Novo bloco (Pomodoro)
Pré-condições: Plano em edição.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT201 | 1. Definir quantidade de ciclos, duração de foco e de descanso.<br>2. Confirmar a adição do bloco. | 1. O sistema gera automaticamente a sequência de blocos de foco e pausa no plano. | |

**CN003 – Aplicar plano ao dia atual**
Localização: Editor de plano
Pré-condições: Plano já salvo com ao menos um bloco.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT301 | 1. Clicar em 'Aplicar hoje'. | 1. O sistema copia os blocos do plano para o cronograma do dia atual e agenda os lembretes. | |

**CN004 – Conflito de horário entre blocos**
Localização: Editor de plano
Pré-condições: Já existir um bloco cadastrado em determinado horário do plano.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT401 | 1. Adicionar um novo bloco em um horário já ocupado por outro bloco do plano. | 1. O sistema exibe uma mensagem de erro informando o conflito e não salva o bloco. | |

**CN005 – Salvar plano sem blocos**
Localização: Editor de plano
Pré-condições: Nenhum bloco adicionado ao plano.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT501 | 1. Informar apenas o nome do plano.<br>2. Clicar em 'Salvar plano'. | 1. O sistema exibe uma mensagem de erro solicitando ao menos um bloco. | |

---

### UC032 – Importar plano de estudos da comunidade

| Campo | Descrição |
|---|---|
| **Ator(es)** | Usuário |
| **Descrição** | Este caso de uso permite que o usuário visualize a prévia de um plano de estudos compartilhado por outro usuário na Comunidade e o importe como um plano próprio, editável. |
| **Pré-condições** | Usuário estar autenticado no sistema. UC002. Existir um plano público compartilhado na Comunidade. |
| **Caminho no sistema** | Comunidade > Plano compartilhado > Prévia do plano |
| **Fluxo principal** | 1. O usuário acessa a prévia de um plano compartilhado a partir do feed da Comunidade.<br>2. O sistema exibe os blocos do plano na ordem do dia, com duração total e matérias envolvidas.<br>3. O usuário clica em 'Importar'.<br>4. O sistema cria uma cópia do plano na lista de planos do usuário. |
| **Fluxo de exceção 1** | 1. O plano foi removido pelo autor antes da importação.<br>2. O sistema exibe uma mensagem de erro informando que o plano não está mais disponível. |

Abaixo segue o roteiro de teste elaborado com base no caso de uso explicado acima.

#### RT.032 - Importar plano de estudos da comunidade

**CN001 – Importar plano com sucesso**
Localização: Comunidade > Prévia do plano
Pré-condições: Plano público disponível na Comunidade.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT101 | 1. Acessar a prévia de um plano compartilhado.<br>2. Clicar em 'Importar'. | 1. O sistema cria uma cópia do plano na lista de planos do usuário. | |

**CN002 – Importar plano indisponível**
Localização: Prévia do plano
Pré-condições: Plano ter sido removido pelo autor antes da importação.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT201 | 1. Tentar importar um plano que foi removido pelo autor. | 1. O sistema exibe uma mensagem de erro informando que o plano não está mais disponível. | |

---

### UC033 – Consultar notificações

| Campo | Descrição |
|---|---|
| **Ator(es)** | Usuário |
| **Descrição** | Este caso de uso permite que o usuário visualize, em ordem cronológica, as notificações de atividade social (curtidas, comentários, incentivos recebidos, novos membros no grupo, salas de foco abertas). |
| **Pré-condições** | Usuário estar autenticado no sistema. UC002 |
| **Caminho no sistema** | Página inicial > Notificações |
| **Fluxo principal** | 1. O usuário acessa a tela 'Notificações'.<br>2. O sistema exibe a lista de notificações em ordem cronológica e zera o contador de não lidas.<br>3. O usuário arrasta a tela para baixo para atualizar. |
| **Fluxo de exceção 1** | 1. O usuário não possui nenhuma notificação.<br>2. O sistema exibe uma mensagem informando que não há notificações. |

Abaixo segue o roteiro de teste elaborado com base no caso de uso explicado acima.

#### RT.033 - Consultar notificações

**CN001 – Visualizar notificações com sucesso**
Localização: Página inicial > Notificações
Pré-condições: Existirem notificações registradas para o usuário.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT101 | 1. Acessar a tela 'Notificações'. | 1. O sistema exibe a lista de notificações em ordem cronológica e zera o contador de não lidas. | |

**CN002 – Atualizar lista por pull-to-refresh**
Localização: Notificações
Pré-condições: Usuário estar na tela de notificações.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT201 | 1. Arrastar a tela para baixo. | 1. O sistema atualiza a lista de notificações exibida. | |

**CN003 – Nenhuma notificação disponível**
Localização: Notificações
Pré-condições: Usuário não possuir nenhuma notificação.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT301 | 1. Acessar a tela 'Notificações' sem nenhum registro. | 1. O sistema exibe uma mensagem informando que não há notificações. | |

---

### UC034 – Compartilhar progresso (semanal e Wrapped mensal)

| Campo | Descrição |
|---|---|
| **Ator(es)** | Usuário |
| **Descrição** | Este caso de uso permite que o usuário gere e compartilhe, em redes sociais, um resumo visual do seu progresso semanal ou do seu 'Wrapped' mensal (tempo estudado, sequência, distribuição por matéria). |
| **Pré-condições** | Usuário estar autenticado no sistema e possuir tempo de estudo registrado no período. UC002 |
| **Caminho no sistema** | Perfil > Compartilhar progresso / Perfil > Wrapped mensal |
| **Fluxo principal** | 1. O usuário acessa a tela de compartilhamento (progresso semanal ou Wrapped mensal).<br>2. O sistema monta o cartão com as estatísticas do período.<br>3. O usuário navega entre os cartões (no caso do Wrapped).<br>4. O usuário clica em 'Compartilhar'.<br>5. O sistema gera uma imagem do cartão e abre as opções de compartilhamento do dispositivo. |
| **Fluxo Alternativo 1** | 1. O usuário seleciona compartilhar diretamente para uma rede social específica.<br>2. O sistema abre o aplicativo da rede social com a imagem já anexada. |
| **Fluxo de exceção 1** | 1. O usuário não possui nenhum tempo de estudo registrado no período.<br>2. O sistema exibe uma mensagem informando que ainda não há dados suficientes para gerar o compartilhamento. |
| **Fluxo de exceção 2** | 1. O dispositivo não possui nenhum aplicativo compatível para compartilhamento.<br>2. O sistema exibe uma mensagem de erro informando que não foi possível compartilhar. |

Abaixo segue o roteiro de teste elaborado com base no caso de uso explicado acima.

#### RT.034 - Compartilhar progresso (semanal e Wrapped mensal)

**CN001 – Compartilhar progresso semanal com sucesso**
Localização: Perfil > Compartilhar progresso
Pré-condições: Usuário possuir tempo de estudo registrado na semana.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT101 | 1. Acessar 'Compartilhar progresso'.<br>2. Clicar em 'Compartilhar'. | 1. O sistema gera a imagem do cartão e abre as opções de compartilhamento do dispositivo. | |

**CN002 – Navegar pelos cartões do Wrapped mensal**
Localização: Perfil > Wrapped mensal
Pré-condições: Usuário possuir tempo de estudo registrado no mês.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT201 | 1. Acessar o 'Wrapped mensal'.<br>2. Arrastar entre os cartões. | 1. O sistema exibe os diferentes cartões com as estatísticas do mês. | |

**CN003 – Compartilhar para rede social específica**
Localização: Wrapped mensal / Compartilhar progresso
Pré-condições: Cartão de compartilhamento gerado com sucesso.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT301 | 1. Selecionar uma rede social específica na opção de compartilhar. | 1. O sistema abre o aplicativo da rede social com a imagem já anexada. | |

**CN004 – Sem dados para compartilhar**
Localização: Compartilhar progresso / Wrapped mensal
Pré-condições: Usuário não possuir tempo de estudo registrado no período.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT401 | 1. Acessar a tela de compartilhamento sem dados no período. | 1. O sistema exibe uma mensagem informando que não há dados suficientes. | |

---

### UC035 – Bloquear e desbloquear contas no feed

| Campo | Descrição |
|---|---|
| **Ator(es)** | Usuário |
| **Descrição** | Este caso de uso permite que o usuário bloqueie um autor no feed público da Comunidade, deixando de ver suas publicações, e reverta esse bloqueio a qualquer momento na lista de contas bloqueadas. |
| **Pré-condições** | Usuário estar autenticado no sistema. UC002 |
| **Caminho no sistema** | Comunidade > Publicação > Bloquear autor / Perfil > Configurações > Contas bloqueadas |
| **Fluxo principal** | 1. O usuário abre o menu de uma publicação no feed.<br>2. O usuário clica em 'Bloquear autor'.<br>3. O sistema exibe uma mensagem de confirmação.<br>4. O usuário confirma o bloqueio.<br>5. O sistema oculta as publicações do autor bloqueado do feed do usuário. |
| **Fluxo Alternativo 1** | 1. O usuário acessa 'Contas bloqueadas' nas configurações do perfil.<br>2. O sistema exibe a lista de autores bloqueados.<br>3. O usuário clica em 'Desbloquear' em um autor da lista.<br>4. O sistema remove o bloqueio e volta a exibir as publicações do autor. |
| **Fluxo de exceção 1** | 1. O usuário não possui nenhuma conta bloqueada.<br>2. O sistema exibe uma mensagem informando que a lista está vazia. |

Abaixo segue o roteiro de teste elaborado com base no caso de uso explicado acima.

#### RT.035 - Bloquear e desbloquear contas no feed

**CN001 – Bloquear autor com sucesso**
Localização: Comunidade > Publicação > Bloquear autor
Pré-condições: Usuário estar autenticado no sistema. UC002

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT101 | 1. Abrir o menu de uma publicação.<br>2. Clicar em 'Bloquear autor'.<br>3. Confirmar o bloqueio. | 1. O sistema oculta as publicações do autor bloqueado do feed. | |

**CN002 – Desbloquear autor**
Localização: Perfil > Configurações > Contas bloqueadas
Pré-condições: Existir ao menos um autor bloqueado pelo usuário.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT201 | 1. Acessar 'Contas bloqueadas'.<br>2. Clicar em 'Desbloquear' em um autor. | 1. O sistema remove o bloqueio e volta a exibir as publicações do autor. | |

**CN003 – Lista de bloqueados vazia**
Localização: Contas bloqueadas
Pré-condições: Usuário não possuir nenhuma conta bloqueada.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT301 | 1. Acessar 'Contas bloqueadas' sem nenhum autor bloqueado. | 1. O sistema exibe uma mensagem informando que a lista está vazia. | |

---

### UC036 – Operar com o aplicativo offline

| Campo | Descrição |
|---|---|
| **Ator(es)** | Usuário |
| **Descrição** | Este caso de uso permite que o usuário seja informado quando o dispositivo perde conexão com a internet, e consiga recuperar telas que falharam ao carregar assim que a conexão retornar. |
| **Pré-condições** | Usuário estar autenticado no sistema. UC002 |
| **Caminho no sistema** | Qualquer tela do aplicativo |
| **Fluxo principal** | 1. O dispositivo perde a conexão com a internet.<br>2. O sistema exibe um banner fixo informando que o usuário está offline.<br>3. A conexão é restabelecida.<br>4. O sistema remove o banner automaticamente. |
| **Fluxo Alternativo 1** | 1. O usuário está sem conexão e tenta acessar uma tela que depende de dados remotos.<br>2. O sistema exibe um estado de erro com a opção 'Tentar novamente'.<br>3. O usuário clica em 'Tentar novamente' após a conexão retornar.<br>4. O sistema recarrega os dados com sucesso. |
| **Fluxo de exceção 1** | 1. O usuário clica em 'Tentar novamente' ainda sem conexão.<br>2. O sistema exibe novamente o estado de erro. |

Abaixo segue o roteiro de teste elaborado com base no caso de uso explicado acima.

#### RT.036 - Operar com o aplicativo offline

**CN001 – Exibir banner ao perder conexão**
Localização: Qualquer tela do aplicativo
Pré-condições: Usuário estar autenticado e usando o aplicativo.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT101 | 1. Desativar a conexão com a internet do dispositivo. | 1. O sistema exibe um banner fixo informando que o usuário está offline. | |

**CN002 – Remover banner ao restabelecer conexão**
Localização: Qualquer tela do aplicativo
Pré-condições: Banner de offline estar sendo exibido.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT201 | 1. Reativar a conexão com a internet do dispositivo. | 1. O sistema remove o banner automaticamente. | |

**CN003 – Recuperar tela após falha de conexão**
Localização: Tela dependente de dados remotos (ex.: dashboard, grupo)
Pré-condições: Dispositivo sem conexão ao abrir a tela.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT301 | 1. Abrir a tela sem conexão.<br>2. Restabelecer a conexão.<br>3. Clicar em 'Tentar novamente'. | 1. O sistema recarrega os dados da tela com sucesso. | |

**CN004 – Tentar novamente ainda sem conexão**
Localização: Tela dependente de dados remotos
Pré-condições: Dispositivo permanecer sem conexão.

| ID | Passos | Resultado esperado | Execução |
|---|---|---|---|
| CT401 | 1. Clicar em 'Tentar novamente' sem restabelecer a conexão. | 1. O sistema exibe novamente o estado de erro. | |
