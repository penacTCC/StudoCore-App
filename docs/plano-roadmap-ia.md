# Plano de Implementação — Roadmap de Estudos por IA (pessoal + grupo)

> Documento de trabalho para implementação assistida (DeepSeek). Não é o Project Context
> (`docs/project-context.md`) — esse continua sendo a fonte da verdade sobre o produto;
> este arquivo é o plano técnico de UMA feature (itens 1 e 3 do roadmap, §14/§8) e deve
> ser apagado ou resumido em `project-context.md` quando a feature for concluída.

Cobre duas entregas do roadmap:
- **Item 3 (§8):** plano de estudos pessoal por IA a partir de um objetivo (com ou sem material anexado).
- **Item 1 (§14):** roadmap semanal do grupo por IA a partir de um documento, criado pelo admin.

Decisão de arquitetura (ver discussão que originou este documento): **não criar uma
entidade "roadmap" nova do zero.** Reusar `planos`/`planos_blocos` (já existem, já têm
edição, aplicação à agenda e lembretes prontos) e o padrão de **cópia** que a Comunidade
já usa para "importar plano" (`comunidade_importar_plano`, migration
`20260807210000_arquivos_e_planos_publicos.sql`). O roadmap de grupo é, no fim, N cópias
de um plano — uma por membro — geradas de uma vez, não um objeto compartilhado editado ao
vivo por todo mundo.

---

## 1. Fluxo pessoal (mais simples, fazer primeiro)

1. Usuário informa um objetivo (texto livre — pode vir pré-preenchido do `objetivo` já
   salvo no perfil, `services/auth.ts` / `types/profile.ts`) e, opcionalmente, anexa um
   PDF (edital, ementa, lista de tópicos).
2. App chama uma nova Edge Function `gerar-roadmap-estudo` (ver §3) com objetivo + PDF em
   base64 (mesmo padrão de upload de `analisar-anexo-sessao`/`corrigir-anexo.tsx`).
3. A função devolve uma **proposta**: nome do plano + lista de blocos (matéria, tópico,
   dia da semana sugerido, horário sugerido, duração) — JSON estruturado, sem gravar nada
   ainda.
4. Nova tela `app/(modals)/roadmap-preview.tsx` (modelo: `plano-preview.tsx`, que já existe
   para prévia de plano importado da Comunidade) mostra a proposta e deixa o usuário
   remover/editar blocos antes de aceitar. Nada de IA sem revisão humana antes de gravar.
5. Ao aceitar, materializa via `criarPlano` + `salvarBlocoPlano` em loop (mesmo padrão de
   `duplicarPlano` em `services/planos.ts:243`). Plano nasce com `agenda_tipo: 'nenhuma'`
   — o usuário fixa/aplica depois, como qualquer plano.
6. Ponto de entrada: botão "Gerar com IA" na tela de planos (`components/cronograma/AbaPlanos.tsx`,
   perto do botão de criar plano manual).

Não precisa de tabela nova nem de RLS nova — é só um novo "produtor" de `planos`/`planos_blocos`,
como o editor manual já é.

---

## 2. Fluxo de grupo

### 2.1 Quem pode gerar
Só administrador do grupo (mesmo padrão `souAdmin` de `app/(groups)/settings.tsx:104`).
Ponto de entrada: novo botão em `app/(groups)/settings.tsx` (seção só visível se `souAdmin`)
ou em `group-details.tsx` — decidir qual dos dois é mais natural olhando a tela hoje, mas
**não** colocar em `AbaMeuGrupo.tsx` (é leitura para todo mundo).

### 2.2 Geração e revisão
Mesmos passos 1–4 do fluxo pessoal, mas a Edge Function recebe também `grupo_id` (só para
log/rate-limit, a lógica de prompt é igual) e a prévia deixa claro que isso vai para o
grupo inteiro, não só para o admin.

### 2.3 Distribuição (o ponto que sua pergunta original levantava)

Ao aceitar:

1. Cria UM plano "canônico" do roadmap, com `usuario_id = admin`, e uma coluna nova
   `origem_grupo_id UUID REFERENCES grupos(id)` em `planos` (nullable) marcando que esse
   plano é a fonte de um roadmap de grupo. Esse plano do admin **não** entra na agenda dele
   automaticamente — ele decide se quer seguir também, como qualquer plano.
2. RPC nova `grupo_distribuir_roadmap(p_plano_id UUID)`, SECURITY DEFINER, modelada
   diretamente em cima de `comunidade_importar_plano` (mesma migration como referência):
   - Confere no banco que quem chama é admin do grupo dono do plano (nunca confiar em
     checagem client-side — mesmo comentário já existe em `services/grupos.ts:243` sobre
     a RPC de administrador).
   - Para cada linha de `membros` do grupo (**exceto o admin, que já tem o original**):
     copia o plano + blocos para esse `usuario_id`, reconciliando `materia_id` por nome
     normalizado (copiar a lógica de `materias_usuario` de `comunidade_importar_plano`,
     migration `20260807210000` linhas 337–354).
     - Cada cópia grava `origem_roadmap_plano_id = p_plano_id` (nova coluna em `planos`,
       aponta pro plano canônico) — é o que amarra "essa cópia pertence a este roadmap de
       grupo" para a agregação de progresso (§2.5).
3. Depois de distribuir, dispara notificação categoria `grupo` para os membros (reusar
   `notificar()`, mesma função já usada por `notificar_novo_membro`/`notificar_sala_aberta`
   — ver migration `20260807240000_notificacoes_gerais.sql`). Texto: "Novo roadmap de
   estudos disponível no grupo".

### 2.4 Membro que entra depois

Quando alguém entra num grupo que já tem um roadmap ativo (plano canônico com
`origem_grupo_id` não nulo mais recente), o trigger/RPC de entrada no grupo
(`services/grupos.ts`, fluxo de aceitar convite/entrar) chama a mesma lógica de cópia para
esse membro novo. Documentar claramente que isso é best-effort — se o admin já tiver
"regenerado" o roadmap (novo plano canônico substitui o antigo), só o mais recente é
copiado.

### 2.5 Onde os membros veem e qual o ganho coletivo

- **Individual:** a cópia do roadmap aparece no cronograma do membro como qualquer plano
  (`AbaPlanos.tsx`, `schedule.tsx`) — ele decide se fixa nos dias sugeridos ou aplica manualmente,
  igual a um plano importado da Comunidade. Zero UI nova aqui, é o fluxo que já existe.
- **Coletivo:** nova seção "Roadmap do grupo" dentro de `AbaMeuGrupo.tsx`, entre a meta do
  grupo e o ranking (mesmo padrão visual de `MetaGrupo`/`RankingGrupo`). Mostra:
  - nome do roadmap + quantos blocos/semana;
  - **% de membros que concluíram os blocos da semana atual**, cruzando sempre com `membros`
    (regra de agregação por grupo, `AGENTS.md` — nunca contar quem saiu do grupo).
  - Isso é o "ganho coletivo": o roadmap deixa de ser um plano que cada um vê sozinho e
    vira um checklist com visibilidade social, no mesmo espírito do ranking que já existe.

**Rastreio de conclusão** precisa de uma peça nova — hoje não existe "bloco concluído",
só sessão de foco encerrada. Duas opções, recomendo a primeira para v1:
  - **(a) Tabela leve `planos_blocos_concluidos (bloco_id, usuario_id, concluido_em)`**,
    marcado manualmente pelo membro (um toggle no bloco, na tela de plano) — simples,
    RLS igual à de `planos_blocos` (dono do plano só marca os próprios).
  - (b) Inferir automaticamente cruzando com `sessoes_foco` por matéria/dia — mais "mágico"
    mas frágil (sessão fora do horário do bloco, ou sessão maior que o bloco, não teria
    correspondência clara). Não recomendo para v1.

### 2.6 Dias por bloco (correção pós-v1 — decidida na implementação)

A proposta da IA tem `diaSemana` por bloco (Matemática na segunda, Física na quarta), mas
o modelo de `planos_blocos` não tinha dia por bloco: `agenda_dias` do plano vale para
TODOS os blocos, então a estrutura semanal morria na materialização e virava "todo bloco
todo dia". Resolvido com uma coluna nova, migration `20260812000000_dia_semana_em_planos_blocos.sql`:

- `planos_blocos.dia_semana INTEGER NULL` (0 = segunda ... 6 = domingo):
  - `NULL` = vale em todos os dias da agenda do plano (comportamento de sempre — blocos
    existentes e blocos novos do editor manual);
  - `0..6` = vale SÓ naquele dia (blocos do roadmap por IA).
- Agenda (`services/agenda.ts`) filtra os blocos do plano pelo dia resolvido; lembretes
  (`services/lembretes.ts`) só disparam no dia do bloco. O editor de plano mostra o dia
  ao lado do bloco.
- As duas portas de cópia de plano no banco (`comunidade_importar_plano` e
  `grupo_copiar_roadmap_para_membro`) foram recriadas carregando `dia_semana`.
- Fluxo do usuário: aceitar → plano nasce com agenda "nenhuma" (como sempre) → ao fixar o
  plano nos dias, cada bloco aparece só no dia dele. **Importante:** para a semana inteira
  aparecer, o membro deve fixar o plano nos dias que têm blocos (ex.: Seg + Qua).
  Coletivo (`grupo_progresso_roadmap`) segue contando todos os blocos de estudo da cópia.

---

## 3. Edge Function `gerar-roadmap-estudo`

Copiar a estrutura de `supabase/functions/analisar-anexo-sessao/index.ts` quase 1:1:
- Mesma cascata de modelos Gemini (`MODELOS_GEMINI`) e mesmo tratamento de `thought: true`
  em `extrairTexto`.
- Mesmos MIME types aceitos (PDF é o caso principal aqui).
- Corpo da requisição: `{ base64?, mimeType?, objetivo: string, contexto?: string, escopo: "pessoal" | "grupo" }`.
  PDF é opcional — o pessoal pode gerar só a partir do objetivo (texto), o grupo
  tipicamente vem com um PDF (ementa/edital), mas não deveria ser obrigatório.
- `RESPONSE_SCHEMA` novo, formato aproximado:
  ```
  {
    nome: STRING,               // nome sugerido do plano/roadmap
    resumoObjetivo: STRING,     // 1 frase confirmando o que entendeu do objetivo
    blocos: ARRAY<{
      diaSemana: INTEGER,       // 0=segunda..6=domingo, mesma convenção de agenda_dias
      horaInicio: STRING,       // "HH:MM"
      duracaoMin: INTEGER,
      materia: STRING,          // nome livre — reconciliado com materias_usuario no cliente/RPC, igual ao import de plano
      topico: STRING
    }>
  }
  ```
- Deploy: `supabase functions deploy gerar-roadmap-estudo`, mesma secret `GEMINI_API_KEY`
  já configurada — não precisa de secret nova.
- **Fallback obrigatório** (regra do AGENTS.md sobre IA): se a função falhar, a tela de
  prévia deve deixar claro que a geração falhou e permitir cair para "criar plano manual"
  — nunca travar o fluxo de cronograma por causa da IA, mesmo espírito de `services/quizIA.ts`.

---

## 4. Migrations necessárias

Uma migration nova, ex. `20260811_roadmap_ia.sql`:

```sql
ALTER TABLE public.planos
  ADD COLUMN IF NOT EXISTS origem_grupo_id UUID REFERENCES public.grupos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origem_roadmap_plano_id UUID REFERENCES public.planos(id) ON DELETE SET NULL;

CREATE TABLE public.planos_blocos_concluidos (
  bloco_id UUID REFERENCES public.planos_blocos(id) ON DELETE CASCADE NOT NULL,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  concluido_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (bloco_id, usuario_id)
);
-- RLS: dono do plano do bloco só mexe no próprio registro (mesma condição de
-- "Usuários veem blocos dos próprios planos" em 20260728100100_criar_planos_e_blocos.sql).

-- RPC grupo_distribuir_roadmap(p_plano_id UUID) — ver §2.3, modelada em
-- comunidade_importar_plano (20260807210000_arquivos_e_planos_publicos.sql:293).
-- SECURITY DEFINER + REVOKE de PUBLIC/anon, GRANT só a authenticated (mesmo padrão de
-- 20260807250000_notificacoes_fechar_rpc_dos_gatilhos.sql para notificar()).
```

RLS de `planos`/`planos_blocos` não precisa mudar — as novas colunas são só metadado.

---

## 5. Services e UI — checklist de arquivos

- `services/roadmapIA.ts` (novo): `gerarRoadmap(objetivo, escopo, arquivo?)` chamando a
  Edge Function; `aceitarRoadmapPessoal(...)` (materializa via `criarPlano`/`salvarBlocoPlano`);
  `distribuirRoadmapGrupo(planoId)` (chama a RPC).
- `app/(modals)/roadmap-preview.tsx` (novo, modelo `plano-preview.tsx`): mostra a proposta,
  permite remover blocos, botão "Aceitar" (pessoal) ou "Publicar para o grupo" (admin).
- `app/(modals)/gerar-roadmap.tsx` ou reaproveitar um modal existente para o formulário de
  entrada (objetivo + anexo opcional) — decidir olhando `upload-vault.tsx` como referência
  de picker de PDF + base64.
- `components/cronograma/AbaPlanos.tsx`: botão "Gerar com IA".
- `app/(groups)/settings.tsx`: botão "Gerar roadmap do grupo" dentro do bloco `{souAdmin && (...)}`.
- `components/comunidade/AbaMeuGrupo.tsx`: nova seção de progresso do roadmap (§2.5),
  componente novo `components/grupo/RoadmapGrupo.tsx` no estilo de `MetaGrupo`/`RankingGrupo`.
- `services/grupos.ts`: no fluxo de entrar no grupo, chamar a distribuição para roadmap
  ativo (§2.4).

---

## 6. Ordem de implementação sugerida

1. Migration (§4).
2. Edge Function `gerar-roadmap-estudo` (§3) — testável isolada via `curl`/Postman antes de
   mexer no app.
3. Fluxo pessoal completo (§1) — é o caminho mais curto pra validar geração + prévia + aceite.
4. RPC `grupo_distribuir_roadmap` + fluxo de admin (§2.1–2.3).
5. Entrada de novo membro herdando roadmap ativo (§2.4).
6. Progresso coletivo: tabela `planos_blocos_concluidos`, toggle na UI do bloco, seção nova
   em `AbaMeuGrupo.tsx` (§2.5).
7. Notificação de "novo roadmap" (§2.3, passo 3).

## 7. Fora de escopo do v1 (decisão explícita, não esquecimento)

- **Sincronizar edição:** se o admin editar o roadmap depois de distribuído, as cópias
  já entregues **não** se atualizam sozinhas. Reaplicar = gerar de novo e redistribuir
  (nova entrada em `origem_roadmap_plano_id`); as cópias antigas ficam órfãs até o membro
  apagar manualmente. Se isso incomodar no uso real, é a primeira coisa a revisitar.
- **Progresso automático por sessão de foco** (opção b do §2.5) — fica para depois de
  validar que o toggle manual já entrega o "ganho coletivo" que motivou a feature.
- **Web/Wrapped/relatório do roadmap** — nada disso, é só cronograma + um número de %.

---

## 8. Correção de dois bugs pós-implementação (análise para revisão)

> Seção de auditoria: descreve os DOIS defeitos encontrados depois da implementação
> inicial da feature, a causa-raiz de cada um e exatamente o que mudou para corrigir.
> Um revisor (humano ou Claude) pode verificar cada afirmação contra os arquivos e
> migrations citados. Estado do código na revisão: `npx tsc --noEmit` limpo e
> `npm run check:architecture` OK.

### 8.1 Bug 1 — o toggle "concluí este bloco" nunca gravava nada

#### Sintoma

O checkbox de conclusão de bloco em `app/(modals)/plano-editor.tsx` parecia funcionar
(alternava na tela), mas toda marcação era rejeitada pelo banco: ao reabrir o plano, tudo
voltava desmarcado, e o progresso coletivo do grupo (§2.5) nunca registrava nenhum membro
tendo completado a semana. Ou seja, a peça central da feature (o "ganho coletivo") era
inoperante de ponta a ponta.

#### Causa-raiz

O INSERT em `services/roadmapIA.ts:208` (versão com bug) montava apenas `{ bloco_id }`:

```ts
await supabase.from("planos_blocos_concluidos").insert({ bloco_id: blocoId })
```

Duas trava independentes rejeitavam o insert:

1. **Coluna `usuario_id` é `NOT NULL`** (migration `20260811090000_roadmap_ia.sql:51`).
   Sem a coluna no payload, o Postgres recusa com `null value in column "usuario_id"`.
2. **A policy de INSERT da tabela exige `usuario_id = auth.uid()`**
   (migration `20260811090000_roadmap_ia.sql:67–75`): mesmo que a coluna fosse preenchida,
   quem assina a linha precisa ser o dono. Como o campo vinha ausente, a RLS também barrava.

#### Por que a UI não mostrava o erro

`alternarConclusao` (`plano-editor.tsx:244`) é **otimista**: alterna o `Set` local antes da
ida ao banco e só reverte se a chamada devolver `sucesso: false`. Como
`marcarBlocoRoadmapConcluido` retornava `{ sucesso: true }` quando `error` era nulo e o
erro de RLS/NOT NULL vem em `error`, o `sucesso` era falso — **mas** a função nunca
informava a tela do motivo, e o fluxo de erro existente reverteia o check em silêncio,
deixando a impressão de "alternou e voltou sozinho" sem explicação.

#### Correção aplicada

- `services/roadmapIA.ts:205` — a função passou a exigir o usuário logado na assinatura:
  ```ts
  export async function marcarBlocoRoadmapConcluido(
      usuarioId: string,
      blocoId: string,
      concluido: boolean
  )
  ```
  e o INSERT grava `usuario_id: usuarioId` junto do `bloco_id`. O ramo de `DELETE` não
  mudou: a policy de DELETE já filtra por `usuario_id = auth.uid()`, então apagar pelo
  `bloco_id` é seguro (só remove linha do próprio usuário).
- `plano-editor.tsx:261` — o chamador passa `userId` (de `useAuth()`), e o guard da função
  (`plano-editor.tsx:251`) passou a incluir `!userId` — nunca chama o serviço sem usuário.
- Decisão de design: passar `usuarioId` como parâmetro (padrão do resto do service, ex.
  `aceitarRoadmapPessoal(userId, ...)`) em vez de buscar `supabase.auth.getUser()` dentro
  da função — o chamador já tem o id, e centraliza a dependência de sessão no hook.

#### Como verificar

- Abrir um plano de roadmap de grupo, marcar um bloco, reabrir o plano → permanece marcado.
- Conferir no banco uma linha em `planos_blocos_concluidos` com `usuario_id` preenchido.
- RPC `grupo_progresso_roadmap` passa a devolver `membros_completaram > 0` quando o
  requisito da semana é satisfeito.

### 8.2 Bug 2 — a estrutura "um bloco por dia" da IA era descartada na materialização

#### Sintoma

A proposta da IA traz `diaSemana` por bloco (Matemática na segunda, Física na quarta —
ver schema da Edge Function, §3). A prévia (`roadmap-preview.tsx`) até agrupava os blocos
por dia, sugerindo que aquela estrutura sobreviveria. Mas, ao aceitar, o `diaSemana` era
simplesmente ignorado: o plano materializado virava uma lista uniforme de blocos que, ao
ser fixada em um ou mais dias, repetia **todos** os blocos em **todos** os dias
escolhidos. O usuário recebia "Matemática + Física todos os dias" em vez da semana que a
IA propôs.

#### Causa-raiz

`planos_blocos` não tinha coluna de dia. A granularidade de agenda de um plano é o
`planos.agenda_dias` (INT[]) — que vale para TODOS os blocos de uma vez (migration
`20260728100100_criar_planos_e_blocos.sql`). Como a materialização (`aceitarRoadmapPessoal`
e `publicarRoadmapGrupo`) gravava apenas hora/duração/matéria/tópico, o `diaSemana` morria
na fronteira entre a proposta e o plano.

#### Decisão de correção

Duas saídas possíveis foram avaliadas com o dono do produto:
- **(a) Mudança de schema (escolhida):** coluna `dia_semana` por bloco, com `NULL` = vale
  em todos os dias (retrocompatível) e `0..6` = só naquele dia.
- (b) Só avisar na UI que a estrutura por dia não sobreviveria — descartada: entregaria
  uma feature esvaziada, onde o roadmap vira uma lista sem a semana que a motivou.

A opção (a) preserva o valor da feature com custo contido: o bloco "escolhe" o dia dele e
a agenda/lembretes passam a respeitar, reusando toda a infra existente (fixar plano em
dias, resolução de agenda, lembretes recorrentes).

#### Alterações aplicadas (schema primeiro, depois código)

1. **Migration nova `supabase/migrations/20260812000000_dia_semana_em_planos_blocos.sql`:**
   - `ALTER TABLE planos_blocos ADD COLUMN IF NOT EXISTS dia_semana INTEGER` com `CHECK
     (dia_semana IS NULL OR dia_semana BETWEEN 0 AND 6)` e `COMMENT` explicando o contrato.
   - Índice parcial `planos_blocos_dia_semana_idx ON (plano_id, dia_semana)` para a
     varredura de agenda por dia.
   - Recria `comunidade_importar_plano` copiando `dia_semana` — importar um roadmap
     compartilhado na Comunidade preserva a estrutura por dia.
   - Recria `grupo_copiar_roadmap_para_membro` copiando `dia_semana` — a cópia de cada
     membro do grupo chega com os dias certos (sem isso, o bug retornava no fluxo de
     grupo). Reforça o `REVOKE` da função interna.
   - Por que uma migration nova e não editar a `20260811090000_roadmap_ia.sql`: a de
     roadmap é nova/ainda não deployada, mas a de Comunidade (`20260807210000`) já roda em
     produção — mexer nela in-place não teria efeito no remoto. Migration nova cobre os
     dois cenários (deployada ou não) de forma determinística.

2. **`types/cronograma.ts`** — `BlocoPlano.dia_semana: number | null` (novo campo; vira
   obrigatório em `NovoBlocoPlano = Omit<BlocoPlano, "id">`).

3. **`services/roadmapIA.ts`** — os dois fluxos de aceite salvam o dia:
   `aceitarRoadmapPessoal` (`:131`) e `publicarRoadmapGrupo` (`:170`) passam
   `dia_semana: bloco.diaSemana` ao `salvarBlocoPlano`.

4. **`services/planos.ts`** — `duplicarPlano` copia `dia_semana: bloco.dia_semana`
   (duplicar um roadmap não deve achatar os dias).

5. **`services/agenda.ts`** — `paraBlocosDePlano` (linha 39) ganhou o parâmetro
   `diaSemana: number` e filtra `row.dia_semana == null || row.dia_semana === diaSemana`.
   As três resoluções passam o dia resolvido: `resolverAgendaDoDia` (`:84` e `:101`),
   `resolverAgendaDaSemana` (`:221`) e `resolverAgendaDoIntervalo` (`:327`). Sem esta
   mudança, os blocos apareceriam em todos os dias mesmo com a coluna populada.

6. **`services/lembretes.ts`** — `sincronizarLembretesPlano` só agenda o disparo no dia do
   bloco: helper `valeNoDia` (`:160`), aplicado no ramo `agenda_tipo = 'data'` (compara
   com `diaSemanaDe(plano.agenda_data)`, `:163`) e no ramo `'fixado'` (filtra o loop de
   `agenda_dias`, `:178`). Sem isto, o lembrete dispararia nos dias em que o bloco não vale.

7. **`app/(modals)/plano-editor.tsx`** — `BlocoEditor.diaSemana?: number`;
   carrega (`:140`), salva (`dia_semana: bloco.diaSemana ?? null`, `:414`) e desenha o dia
   ao lado do bloco (`DIAS_CURTOS[bloco.diaSemana]`, `:959`) — o usuário volta a saber qual
   bloco é de qual dia ao revisar o plano.

8. **`app/(modals)/roadmap-preview.tsx`** — texto do balão informativo passou a afirmar
   que os dias são preservados ("cada um no dia dele"), tirando a promessa implícita de
   perda que o texto anterior carregava.

9. **`docs/plano-roadmap-ia.md`** — nova subseção §2.6 registrando a decisão e o
   contrato da coluna.

#### Comportamento esperado depois da correção

- Aceitar → plano nasce com agenda "nenhuma" (como sempre) e blocos com `dia_semana` fixo.
- Ao **fixar o plano nos dias** (`AbaPlanos` → `fixarPlanoEmDias`), cada bloco aparece só
  no dia dele e o lembrete só dispara nesse dia.
- **Importante (limitação conhecida, documentada no §2.6):** para a semana inteira
  aparecer, o membro deve fixar o plano nos dias que têm blocos (ex.: Seg + Qua). Se fixar
  só na segunda, os blocos de quarta não aparecem — é o comportamento coerente com o
  modelo de "fixar plano em dias" já existente, não um novo bug.
- Coletivo (`grupo_progresso_roadmap`) segue contando todos os blocos de estudo da cópia,
  independente do dia — "completar a semana" significa marcar todos os blocos.

#### Como verificar

- Gerar roadmap, aceitar, abrir o plano no editor → cada bloco mostra o dia; conferir no
  banco `planos_blocos.dia_semana` preenchido.
- Fixar o plano em Seg+Qua → a agenda de segunda mostra só os blocos de segunda, a de
  quarta só os de quarta.
- Fluxo de grupo: publicar roadmap → inspecionar a cópia de um membro → `dia_semana`
  idêntico ao canônico.

### 8.3 Checagens finais aplicadas

- `npx tsc --noEmit` — limpo (sem erros novos; os erros pré-existentes de
  `roadmap-preview.tsx` no estilo foram corrigidos no mesmo passe: estilos passaram a
  `StyleSheet.create` e o prop `progresso` de `RoadmapGrupo` aceita `undefined`).
- `npm run check:architecture` — OK.
- Sem novo ciclo de imports: `lembretes.ts` passou a importar `diaSemanaDe` de
  `services/agenda.ts`; `agenda` não importa `lembretes` nem `preferencias` (que importa
  `lembretes`), então não há ciclo.

### 8.4 Pendências de deploy (não são bugs de código)

- Aplicar no Supabase remoto as migrations `20260811090000_roadmap_ia.sql` e
  `20260812000000_dia_semana_em_planos_blocos.sql`.
- Deploy da Edge Function `gerar-roadmap-estudo`.
- O código do app assume as duas como aplicadas; sem o deploy, o toggle (§8.1) e os dias
  (§8.2) não funcionam apesar de tudo estar correto no repositório.
