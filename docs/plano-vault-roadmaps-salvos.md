# Plano de Implementação — Abas "Roadmaps" e "Salvos" do Vault

> **Status: implementado (2026-08-10), com desvios do plano original abaixo.** O corpo do
> documento fica como registro do raciocínio original — quem for auditar a implementação
> real deve ler esta seção primeiro.

## Desvios da implementação final (decididos depois de um mockup do Claude Design)

- **A.1–A.7 (Roadmaps) ficaram obsoletos**: a aba não filtra por `geradoPorIA`/
  `roadmapDeGrupo` — mostra **todos os planos do usuário**, como cards de progresso
  (blocos concluídos, próximo bloco, badge de origem: "Importado de X" / "Roadmap de
  grupo" / "Gerado por IA" / "Criado por você"). Motivo: um roadmap compartilhado da
  Comunidade já é só um `plano` com material anexado — não faz sentido ter uma entidade
  separada nem uma aba que é subconjunto do Cronograma. O diferencial real da aba é
  **progresso**, que `AbaPlanos.tsx` nunca calculou.
  - Nova coluna `planos.importado_de_usuario_id` (migration `20260813000000`), setada por
    `comunidade_importar_plano`.
  - `services/planos.ts:buscarPlanos` agora calcula `materias`, `blocosConcluidos`,
    `blocosEstudoTotal` e `proximoBloco` por plano (join com `planos_blocos_concluidos` +
    `materias_usuario`, mais o cálculo de "próximo bloco" só quando o plano está fixado em
    dias E o bloco tem `dia_semana` — blocos sem dia não têm um "próximo" único).
  - `gerado_por_ia` continua existindo (migration `20260813000000`) só como sinal pro badge
    "Gerado por IA" — não filtra mais nada.
- **Parte B (Salvos) ficou só Galeria.** Arquivo e plano já têm uma ação de cópia de
  verdade — "Adicionar aos meus arquivos" (novo, `services/archives.ts:
  adicionarArquivoDaComunidadeAosMeus`, baixa e reenvia os bytes pro Backblaze com um
  `storage_path` novo — **não** reaproveita o mesmo arquivo físico, porque o delete de
  arquivo apaga o objeto do bucket, e duas linhas `arquivos` apontando pro mesmo arquivo
  físico faria uma pessoa apagar o arquivo da outra) e "Importar plano" (já existia). Um
  terceiro jeito de guardar a mesma coisa ("salvar") seria redundante. Só a foto de sessão
  (Galeria) não tem equivalente de cópia, então só ela ficou com o botão de salvar.
  - `comunidade_salvos` (migration `20260813010000`) tem FK direta pra `sessoes_foco`, sem
    o par polimórfico `(origem, referencia_id)` do plano original — só uma origem, não
    precisa dele.
  - `CardPublicacao.tsx`: bookmark só aparece pra `tipo === "galeria"`; o card de arquivo
    ganhou um segundo ícone (`FolderArchive`) ao lado do download.

O resto do documento (§A.1–A.7, §B.1–B.6) é o plano **original**, escrito antes dessas
decisões — mantido por contexto histórico, não como fonte da verdade do código atual.

---

> Documento de trabalho original para implementação assistida (DeepSeek), no mesmo
> espírito de `docs/plano-roadmap-ia.md`. Não é o Project Context
> (`docs/project-context.md`) — esse continua sendo a fonte da verdade sobre o produto.

Hoje `app/(tabs)/vault.tsx` tem três abas — Arquivos, Roadmaps, Salvos. Arquivos é real;
as outras duas são placeholder (`renderRoadmaps`/`renderSalvos`, `vault.tsx:447-517`):
ícone + "em breve". Este documento cobre as duas.

São duas features **independentes** (não compartilham tabela nem tela), agrupadas aqui só
porque vivem na mesma tela hospedeira. Um implementador pode fazer uma sem a outra.

---

## Parte A — Aba "Roadmaps"

### A.1 O que já existe (reusar, não recriar)

A geração de roadmap por IA já está implementada de ponta a ponta — ver
`docs/plano-roadmap-ia.md`. Roadmaps **não são uma entidade nova**: são linhas de `planos`
(mesma tabela dos planos manuais), marcadas por:

- `planos.origem_grupo_id` — plano canônico de um roadmap de grupo (dono = admin).
- `planos.origem_roadmap_plano_id` — cópia de um roadmap de grupo que cada membro recebe
  (`grupo_distribuir_roadmap`, ver §2.3 do outro documento).

`services/planos.ts:36` já computa isso no tipo `Plano` (`types/cronograma.ts:57-71`):

```ts
roadmapDeGrupo: !!(row.origem_grupo_id || row.origem_roadmap_plano_id),
```

**Esse campo já existe mas hoje não é usado em NENHUMA tela** (`AbaPlanos.tsx` não lê
`roadmapDeGrupo`) — é a primeira vez que algo vai efetivamente consumi-lo.

`buscarPlanos(usuarioId)` (`services/planos.ts`) já devolve **todas** as linhas de `planos`
do usuário — incluindo o plano canônico do admin e a cópia de cada membro — então **não
existe busca nova a fazer no Supabase**: o roadmap de grupo de um membro já está na mesma
lista que os planos manuais dele, é só filtrar client-side. `hooks/usePlanos.ts` já
cacheia essa lista por `planos:${userId}` via `useDadosCache` — reusar o mesmo hook na
tela do Vault, não duplicar a query.

### A.2 O gap: roadmap pessoal não tem marcador

`roadmapDeGrupo` distingue roadmap de grupo de plano manual. Mas um roadmap **pessoal**
(gerado via `aceitarRoadmapPessoal`, `services/roadmapIA.ts:115`) grava um `planos` comum,
sem `origem_grupo_id` nem `origem_roadmap_plano_id` — hoje é **indistinguível** de um plano
criado manualmente em `AbaPlanos.tsx`. Precisa de coluna nova.

### A.3 Migration

Nova migration, ex. `supabase/migrations/20260813000000_gerado_por_ia_em_planos.sql`:

```sql
ALTER TABLE public.planos
  ADD COLUMN IF NOT EXISTS gerado_por_ia BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.planos.gerado_por_ia IS
  'true quando o plano nasceu de uma proposta de IA (roadmap pessoal ou de grupo) — usado
   pela aba Roadmaps do Vault para filtrar sem depender só de origem_grupo_id/
   origem_roadmap_plano_id, que só existem no caso de grupo.';
```

Sem RLS nova (metadado, mesma regra de `origem_grupo_id`/`origem_roadmap_plano_id` — ver
§4 do outro documento). `duplicarPlano` (`services/planos.ts:256`) **não** deve copiar
`gerado_por_ia = true`: duplicar um roadmap pessoal manualmente vira um plano comum — mesma
lógica que já vale para `origem_grupo_id`/`origem_roadmap_plano_id`, que também não são
copiados hoje (conferir em `duplicarPlano` antes de mexer, para manter o padrão).

### A.4 Tipos e services a alterar

- `types/cronograma.ts:57-71` (`Plano`) — novo campo `geradoPorIA: boolean`.
- `services/planos.ts` (`paraPlano`, linha ~27-38) — `geradoPorIA: !!row.gerado_por_ia`, e
  `PlanoRow` (`types/cronograma.ts:74-87`) ganha `gerado_por_ia: boolean`.
- `services/roadmapIA.ts` — os dois pontos de materialização passam a gravar a flag:
  - `aceitarRoadmapPessoal` (`:120`, chamada a `criarPlano`) — `criarPlano` precisa aceitar
    um parâmetro novo (ex. `geradoPorIa = false`, adicionado no fim da assinatura para não
    quebrar as outras chamadas) e gravar `gerado_por_ia: true` no INSERT.
  - `publicarRoadmapGrupo` (`:159`) — mesma alteração, mesmo `criarPlano`.
- Nenhuma migration de dados retroativa: os roadmaps já criados antes desta mudança (se
  houver, em ambiente de teste) ficam com `gerado_por_ia = false` e simplesmente não
  aparecem na aba nova até serem regenerados — aceitável, não é dado de produção ainda
  (ver §8.4 do outro documento: as migrations do roadmap nem foram deployadas no remoto).

Derive um helper (local ao componente da aba, não precisa ir pro service) para decidir se
um `Plano` é roadmap:

```ts
const ehRoadmap = (p: Plano) => p.geradoPorIA || p.roadmapDeGrupo;
```

### A.5 UI — `renderRoadmaps` em `vault.tsx`

Trocar o placeholder (`vault.tsx:447-481`) por uma lista, no mesmo padrão visual da seção
"Meus arquivos" já existente na própria tela (linhas 250-322: cabeçalho com contagem,
`ScrollView` com `RefreshControl`, estado vazio custom, separador de 1px entre linhas).

1. `const { planos, carregando, recarregarPlanos } = usePlanos(userId)` (mesmo hook de
   `schedule.tsx:177` — conferir a assinatura exata lá antes de usar).
2. `const roadmaps = useMemo(() => planos.filter(ehRoadmap), [planos])`.
3. Duas seções, não uma lista única — a distinção pessoal/grupo importa para o usuário
   entender o que está vendo:
   - **"Meus roadmaps"** — `roadmaps.filter(r => !r.roadmapDeGrupo)`.
   - **"Roadmaps de grupo"** — `roadmaps.filter(r => r.roadmapDeGrupo)`.
4. Cada linha: nome do plano, `qtdBlocos` + `duracaoTotal` (já vêm prontos em `Plano`),
   ícone `CalendarClock` (já importado, `vault.tsx:20`) num badge colorido com `plano.cor`.
   Roadmap de grupo ganha um badge extra pequeno com `Users` (ícone já importado,
   `vault.tsx:16`) — sem tentar resolver o nome do grupo (ver §A.6, é o motivo).
5. `onPress` de cada linha → `router.push({ pathname: "/(modals)/plano-editor", params: { planoId: plano.id } })`,
   igual ao `abrirEditor` de `schedule.tsx:200-207` — é a mesma tela de edição, roadmap não
   tem editor próprio (o editor já trata blocos de roadmap: toggle de conclusão via
   `buscarBlocosConcluidos`/`marcarBlocoRoadmapConcluido`, ver `plano-editor.tsx`).
6. Estado vazio: reaproveitar o texto do placeholder atual como estado vazio de verdade
   ("Crie e importe planos de estudo personalizados com acompanhamento de progresso"), com
   um botão "Gerar com IA" que navega para `/(modals)/gerar-roadmap` com `escopo: "pessoal"`
   (mesmo destino de `abrirRoadmapIA` em `schedule.tsx` — conferir params exatos lá).
7. `RefreshControl` chamando `recarregarPlanos()` (mesmo padrão de `handleRefresh` já
   existente em `vault.tsx:159-162`, que hoje só cobre `refresh`/`atualizarGrupos` —
   adicionar `recarregarPlanos` ali em vez de duplicar o handler).

### A.6 Progresso do grupo — por que fica de fora do card (decisão explícita)

`ProgressoRoadmapGrupo` (`types/roadmap.ts:25-32`) e o componente
`components/grupo/RoadmapGrupo.tsx` já mostram % de conclusão do roadmap — mas dentro de
`AbaMeuGrupo.tsx`, no contexto de UM grupo específico (`buscarProgressoRoadmapGrupo(grupoId)`
precisa do `grupoId`).

Uma cópia de roadmap de membro (`origem_roadmap_plano_id` setado) **não carrega o
`grupoId` diretamente** — só o id do plano canônico, que por sua vez tem o `origem_grupo_id`.
Resolver isso pediria uma consulta extra por card (buscar o plano canônico, ler o
`origem_grupo_id` dele) só para mostrar um número que **já existe** em outra tela. Decisão:
o card do Vault **não duplica o progresso coletivo** — mostra só nome/blocos/duração e leva
pro editor. Quem quiser o %, já sabe onde está (aba do grupo). Se isso incomodar no uso
real, a correção de baixo custo é adicionar uma coluna `grupo_id` direta em `planos`
(preenchida tanto no canônico quanto nas cópias), não replicar a lógica de resolução aqui.

### A.7 Fora de escopo (Parte A)

- Criar/gerar roadmap a partir da aba Vault (o ponto de entrada de geração continua sendo
  `AbaPlanos.tsx`/`schedule.tsx`, como já decidido no outro documento, §1 item 6). A aba
  Roadmaps do Vault é só **listagem e acesso rápido**, não um formulário novo.
- Excluir/duplicar roadmap a partir do card do Vault — usa o editor (`plano-editor.tsx`)
  ou `AbaPlanos.tsx`, que já têm esses menus. Não replicar o action sheet de
  `AbaPlanos.tsx` aqui.

---

## Parte B — Aba "Salvos"

### B.1 Estado atual — greenfield confirmado

Não existe, em lugar nenhum do repositório, tabela, RPC, service function ou componente de
"salvar"/"favoritar"/"bookmark" de publicação da Comunidade. É feature nova do zero.

Contexto necessário (Comunidade, `docs/project-context.md` tem mais, resumo aqui): o feed
(`app/(tabs)`, aba Comunidade → Explorar, `components/comunidade/AbaExplorar.tsx`) mistura
três origens reais — `types/comunidade.ts:1-6,15`:

```ts
export type TipoPublicacao = "galeria" | "arquivo" | "plano";
```

Não existe tabela `publicacoes` — cada origem é uma linha de uma tabela já existente
(`sessoes_foco`, `arquivos`, `planos`). Curtida/comentário/denúncia por isso apontam para o
par `(origem, referencia_id)` em vez de uma FK única. "Salvos" tem que seguir o mesmo
padrão, por identica razão (ver `types/comunidade.ts:26-36`, `ReferenciaPublicacao`).

A checagem "essa publicação ainda está visível/pública?" já existe, pronta pra reusar:
`comunidade_publicacao_visivel(origem, referencia_id)` → `comunidade_dono_da_publicacao(...)`
(recriada em `supabase/migrations/20260807210000_arquivos_e_planos_publicos.sql:123-154`,
cobre as três origens — `galeria` via `sessoes_foco.is_public` + opt-in de feed,
`arquivo`/`plano` via `arquivos.publico`/`planos.publico`). **Confirmado nas migrations
atuais que essa função já cobre as três origens** — uma versão mais antiga
(`20260807170000`) só cobria `galeria`, mas foi substituída por `CREATE OR REPLACE` na
migration seguinte; não precisa de nenhuma alteração nela para "salvos" funcionar nas três.

### B.2 Modelo de dados

Nova migration, ex. `supabase/migrations/20260813010000_comunidade_salvos.sql`, no mesmo
molde de `comunidade_curtidas` (`20260807170000_comunidade_feed_publico.sql:145-186`), com
duas diferenças deliberadas listadas abaixo:

```sql
CREATE TABLE IF NOT EXISTS public.comunidade_salvos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  origem        public.comunidade_origem NOT NULL,
  referencia_id UUID NOT NULL,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, origem, referencia_id)
);

-- Listar "meus salvos" ordenado por data de salvamento é a consulta quente daqui.
CREATE INDEX IF NOT EXISTS comunidade_salvos_user_idx
  ON public.comunidade_salvos (user_id, criado_em DESC);

ALTER TABLE public.comunidade_salvos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Diferença 1: leitura é PRIVADA (só o próprio usuário vê o que salvou —
  -- diferente de curtidas, que são contagem pública). Não existe "3 pessoas salvaram".
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                 AND tablename='comunidade_salvos' AND policyname='Usuários veem os próprios salvos') THEN
    CREATE POLICY "Usuários veem os próprios salvos"
      ON public.comunidade_salvos FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                 AND tablename='comunidade_salvos' AND policyname='Usuários salvam o que podem ver') THEN
    CREATE POLICY "Usuários salvam o que podem ver"
      ON public.comunidade_salvos FOR INSERT
      WITH CHECK (
        auth.uid() = user_id
        AND public.comunidade_publicacao_visivel(origem, referencia_id)
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                 AND tablename='comunidade_salvos' AND policyname='Usuários removem os próprios salvos') THEN
    CREATE POLICY "Usuários removem os próprios salvos"
      ON public.comunidade_salvos FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;
```

Diferença 2 (não está no SQL acima, é sobre limpeza): **não precisa** do trigger de
cascata que `comunidade_curtidas`/`comunidade_comentarios` têm ao apagar uma
`sessoes_foco` (ver §8.1 do outro documento sobre órfãos) — `ON DELETE CASCADE` já limpa
pelo `user_id`, mas o registro pode ficar órfão se a publicação original for apagada
(sessão/arquivo/plano). Isso é **aceitável para v1**: um item salvo cuja origem sumiu vira
simplesmente inexibível (§B.4, a RPC de listagem faz `JOIN`, então a linha órfã some
sozinha da consulta — não precisa de trigger de limpeza, só não deixa "lixo" visível,
mesmo que a linha continue fisicamente em `comunidade_salvos` até o `UNIQUE` permitir
salvar de novo algo com o mesmo id reciclado, cenário que não acontece com UUID).

### B.3 RPCs de listagem

O feed usa três RPCs, uma por origem (`comunidade_feed_galeria`, `comunidade_feed_arquivos`,
`comunidade_feed_planos`, todas em `20260807170000`/`20260807210000`), cada uma com
paginação por cursor `(criado_em, id)` da **própria tabela de origem** (sessão, arquivo,
plano), e o merge das três acontece client-side em `buscarFeedComunidade`
(`services/comunidade.ts:287-325`).

Para "Salvos", a ordem certa **não é** a data de criação da publicação — é a data em que
**o usuário salvou** (`comunidade_salvos.criado_em`). Três RPCs novas, mesmo formato de
retorno das três já existentes (mesmas colunas — reconferir a lista exata de colunas de
`comunidade_feed_galeria`/`arquivos`/`planos` antes de escrever, para bater 1:1 com o
`SELECT` de cada uma), trocando só o `FROM`/`WHERE`/`ORDER BY`:

```sql
CREATE OR REPLACE FUNCTION public.comunidade_salvos_galeria(
  p_limite INT DEFAULT 6,
  p_cursor_data TIMESTAMPTZ DEFAULT NULL,
  p_cursor_id UUID DEFAULT NULL
)
RETURNS TABLE (
  sessao_id UUID, autor_id UUID, autor_nome TEXT, autor_foto TEXT,
  foto_path TEXT, legenda TEXT, materia TEXT, materia_cor TEXT,
  duracao_minutos INT, criado_em TIMESTAMPTZ,
  curtidas BIGINT, curtido_por_mim BOOLEAN, comentarios BIGINT,
  salvo_em TIMESTAMPTZ                                   -- coluna NOVA: quando EU salvei
)
LANGUAGE SQL STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT
    s.id, s.user_id, p.nome_usuario, p.foto_usuario,
    s.foto_path, s.legenda, /* ...mesmas colunas de comunidade_feed_galeria... */,
    s.created_at,
    (SELECT count(*) FROM public.comunidade_curtidas c WHERE c.origem='galeria' AND c.referencia_id=s.id),
    EXISTS (SELECT 1 FROM public.comunidade_curtidas c WHERE c.origem='galeria' AND c.referencia_id=s.id AND c.user_id=auth.uid()),
    (SELECT count(*) FROM public.comunidade_comentarios m WHERE m.origem='galeria' AND m.referencia_id=s.id),
    sv.criado_em
  FROM public.comunidade_salvos sv
  JOIN public.sessoes_foco s ON s.id = sv.referencia_id
  JOIN public.profiles p ON p.id = s.user_id
  WHERE sv.user_id = auth.uid()
    AND sv.origem = 'galeria'
    AND (p_cursor_data IS NULL OR sv.criado_em < p_cursor_data
         OR (sv.criado_em = p_cursor_data AND sv.referencia_id < p_cursor_id))
  ORDER BY sv.criado_em DESC, sv.referencia_id DESC
  LIMIT p_limite;
$$;
```

**Não precisa checar `comunidade_publicacao_visivel` de novo dentro dessas RPCs** — se a
publicação deixou de ser pública depois de salva, ela simplesmente não deveria mais
aparecer nem no card salvo; decisão de produto a confirmar com quem pediu a feature (opção
mais simples e mais segura: `JOIN` filtrando por `s.is_public`/`a.publico`/`pl.publico`
igual às RPCs do feed fazem implicitamente ao ler só o necessário — replicar o mesmo
`WHERE` de visibilidade das RPCs de feed originais em vez de reinventar). Repetir o mesmo
padrão para `comunidade_salvos_arquivos` (a partir de `public.arquivos`) e
`comunidade_salvos_planos` (a partir de `public.planos`), espelhando exatamente as colunas
de `comunidade_feed_arquivos`/`comunidade_feed_planos`
(`20260807210000_arquivos_e_planos_publicos.sql:165-260`, conferir os nomes lá).

`REVOKE ALL ... FROM PUBLIC, anon; GRANT EXECUTE ... TO authenticated;` nas três, mesmo
padrão de segurança das RPCs de feed.

### B.4 `services/comunidade.ts`

```ts
/** Salva ou remove dos salvos. RLS recusa salvar o que não está mais público. */
export async function alternarSalvo(ref: ReferenciaPublicacao, salvar: boolean): Promise<void> {
    const userId = await usuarioAtual(); // já existe, services/comunidade.ts:331

    if (salvar) {
        const { error } = await supabase.from("comunidade_salvos").insert({
            user_id: userId,
            origem: ref.origem,
            referencia_id: ref.referenciaId,
        });
        if (error && error.code !== "23505") throw new Error(error.message); // mesmo tratamento de alternarCurtida
        return;
    }

    const { error } = await supabase
        .from("comunidade_salvos")
        .delete()
        .eq("user_id", userId)
        .eq("origem", ref.origem)
        .eq("referencia_id", ref.referenciaId);
    if (error) throw new Error(error.message);
}

/**
 * Página dos salvos do usuário logado, juntando as três origens — mesmo padrão de merge por
 * cursor de `buscarFeedComunidade` (linhas 287-325), mas ordenado por `salvo_em`
 * (`comunidade_salvos.criado_em`), não pela data de criação da publicação original.
 */
export async function buscarSalvos(opcoes: { cursor?: string | null }): Promise<PaginaDoFeed> {
    // mesma estrutura de Cursor/lerCursor/escreverCursor/ORIGENS já usada em buscarFeedComunidade,
    // trocando paginaGaleria/paginaArquivos/paginaPlanos por três funções novas que chamam
    // comunidade_salvos_galeria/arquivos/planos e mapeiam salvo_em em vez de criado_em para o
    // sort e o cursor.
}
```

Cada `Publicacao` devolvida por `buscarSalvos` precisa saber que está salva — não dá pra
reusar `curtidoPorMim` para isso. Duas opções:
- **(a) Adicionar `salvoPorMim: boolean` em `PublicacaoBase`** (`types/comunidade.ts:38-47`)
  — sempre `true` nos itens de `buscarSalvos`, e passa a vir também de
  `buscarFeedComunidade` (as três RPCs de feed ganham uma coluna `salvo_por_mim` igual
  fizeram com `curtido_por_mim`) para o botão de salvar no feed normal saber seu estado
  inicial sem uma chamada extra. **Recomendado** — mesma forma que curtida já resolve o
  mesmo problema, evita gambiarra.
- (b) Botão de salvar sem estado inicial no feed normal (sempre parte de "não salvo",
  corrige no primeiro toque) — mais simples, mas o usuário vê o ícone "errado" ao rolar o
  feed de novo depois de já ter salvo algo. Não recomendado.

Ir com (a): mexe nas quatro RPCs de feed (adicionar a subselect de `comunidade_salvos`,
igual ao padrão de `curtido_por_mim`) — mais barato que parece porque é copiar-colar o
mesmo `EXISTS (...)` trocando a tabela.

### B.5 UI

**Botão de salvar no feed** (`components/comunidade/CardPublicacao.tsx`): ao lado do
`Reacao` de curtida (linha ~297-303), um terceiro `Reacao` com ícone `Bookmark` (já existe
em `@/components/ui/icons`, é o mesmo usado no ícone da aba Salvos do Vault,
`vault.tsx:18`) — **sem número ao lado** (salvar não é social, não tem contagem pública,
§B.2). `Reacao` (linha 316+) hoje sempre recebe `valor: number`; ou vira opcional
(`valor?: number`, omite o texto quando ausente) ou nasce um componente irmão
`ReacaoSemContagem` — decidir olhando o componente, mas preferir tornar `valor` opcional a
duplicar o componente. Prop nova em `CardPublicacaoProps`: `onSalvar: () => void`.

`AbaExplorar.tsx` (linha ~202, onde `onCurtir={() => curtir(item)}` já é passado) ganha
`onSalvar={() => salvar(item)}` no mesmo padrão de otimismo local que `curtir` já usa ali
(procurar a função `curtir` no mesmo arquivo e espelhar exatamente a forma — update
otimista do item na lista local, chamada a `alternarSalvo`, reverte em erro).
`SheetComentarios.tsx` também renderiza `CardPublicacao` (o post por trás do sheet de
comentários) — mesma prop precisa ser passada lá também, senão o botão quebra por falta de
prop obrigatória.

**Lista "Salvos" em `vault.tsx`** (`renderSalvos`, hoje placeholder em `vault.tsx:483-517`):
mesmo padrão de paginação por cursor que `AbaExplorar.tsx` já usa para o feed normal
(scroll infinito, `onEndReached` → `buscarSalvos({ cursor })`) — **não reinventar
paginação aqui, copiar o hook/padrão que `AbaExplorar.tsx` já usa** (conferir se é um hook
próprio tipo `useFeedComunidade` ou lógica inline, e replicar a mesma forma, só trocando
`buscarFeedComunidade` por `buscarSalvos`). Cada item renderiza com o **mesmo**
`CardPublicacao` do feed (é o mesmo tipo `Publicacao`) — `onSalvar` aqui remove da lista
otimisticamente (item some da tela ao desmarcar, já que por definição só aparecem os
salvos). `onVerPlano`/`onBaixarArquivo`/`onComentar`/`onAbrirMenu` recebem os mesmos
handlers que `AbaExplorar.tsx` já tem prontos — não escrever de novo, extrair para um hook
compartilhado se a duplicação incomodar (não obrigatório para v1).

Estado vazio: ícone `Bookmark` (já é o do placeholder atual) + texto adaptado do que já
existe ("Nada salvo ainda — toque no ícone de salvar em qualquer publicação da Comunidade
para guardá-la aqui").

### B.6 Fora de escopo (Parte B)

- Contagem pública de "N pessoas salvaram" — decisão deliberada, §B.2: salvos são privados,
  diferente de curtida.
- Notificar o autor quando alguém salva o post dele — curtida notifica
  (`avisarInteracao`, `services/comunidade.ts:357`), salvar não. Salvar é uma ação de
  "guardar para mim", não uma interação social.
- Salvar comentários avulsos, ou salvar publicações do "Meu grupo" (a aba de
  grupo tem seu próprio contexto — não parte do Explorar). Escopo é só publicações do
  Explorar (as três origens já cobertas pelo feed).
- Pastas/coleções dentro de Salvos (organizar por tema) — lista única cronológica é
  suficiente pro v1, mesmo espírito de "sem web/relatório" do outro documento.

---

## Ordem de implementação sugerida

1. **Parte A** primeiro — é bem mais barata (uma coluna, um filtro client-side, zero RPC
   nova) e já valida o padrão de reusar `usePlanos`/`plano-editor` dentro do Vault.
   1. Migration `gerado_por_ia` (§A.3).
   2. `criarPlano` + `services/roadmapIA.ts` gravando a flag (§A.4).
   3. `renderRoadmaps` em `vault.tsx` (§A.5).
2. **Parte B**:
   1. Migration `comunidade_salvos` + as três RPCs de listagem (§B.2, §B.3).
   2. Coluna `salvo_por_mim` nas RPCs de feed existentes + `salvoPorMim` no tipo
      `Publicacao` (§B.4, decisão (a)).
   3. `alternarSalvo`/`buscarSalvos` em `services/comunidade.ts` (§B.4).
   4. Botão de salvar em `CardPublicacao.tsx` + wiring em `AbaExplorar.tsx` e
      `SheetComentarios.tsx` (§B.5).
   5. `renderSalvos` em `vault.tsx` consumindo `buscarSalvos` (§B.5).

## Checklist de arquivos

**Parte A:**
- `supabase/migrations/20260813000000_gerado_por_ia_em_planos.sql` (novo)
- `types/cronograma.ts` — `Plano.geradoPorIA`, `PlanoRow.gerado_por_ia`
- `services/planos.ts` — `paraPlano`, `criarPlano` (parâmetro novo)
- `services/roadmapIA.ts` — `aceitarRoadmapPessoal`, `publicarRoadmapGrupo`
- `app/(tabs)/vault.tsx` — `renderRoadmaps`

**Parte B:**
- `supabase/migrations/20260813010000_comunidade_salvos.sql` (novo)
- `types/comunidade.ts` — `PublicacaoBase.salvoPorMim`
- `services/comunidade.ts` — `alternarSalvo`, `buscarSalvos`, coluna nova nas três
  `paginaX` internas
- `components/comunidade/CardPublicacao.tsx` — botão de salvar, prop `onSalvar`
- `components/comunidade/AbaExplorar.tsx` — wiring de `salvar`
- `components/comunidade/SheetComentarios.tsx` — prop `onSalvar` repassada
- `app/(tabs)/vault.tsx` — `renderSalvos`

## Fora de escopo geral deste documento

- Aba Arquivos do Vault — já funciona, não é tocada.
- Qualquer alteração na Comunidade → "Meu grupo" (`AbaMeuGrupo.tsx`) — Salvos é só sobre o
  Explorar.
