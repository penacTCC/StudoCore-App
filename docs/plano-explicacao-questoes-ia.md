# Plano de Ideação — Explicação de Questões por IA (banco de erros)

> Documento de trabalho para implementação futura. Não é o Project Context
> (`docs/project-context.md`) — esse continua sendo a fonte da verdade sobre o produto;
> este arquivo registra uma decisão de arquitetura tomada em conversa antes de qualquer
> código existir, pra não perder o raciocínio quando for implementar. Resumir em
> `project-context.md` (ou apagar) quando a feature for concluída.

## A ideia

Quando o usuário anexa um formulário/PDF de exercícios a uma sessão e corrige questão a
questão, a IA vai poder gerar uma explicação (texto + imagens) para as questões que ele
errou — sem precisar reler o material inteiro.

## Por que isso não é infraestrutura nova

`AnexoSessao` (`types/anotacoes.ts`) já guarda `correcao: CorrecaoFormulario`, um mapa
`{ "1": true, "2": false, ... }` questão a questão, com o comentário explícito no código
de que foi feito assim **pra alimentar o banco de erros depois**. Ou seja, o dado que essa
feature precisa (quais questões, de qual anexo, o usuário errou) já existe desde
`services/anexosSessao.ts` / `detalhes-sessao.tsx`. Essa feature é o próximo passo de algo
já modelado, não uma entidade nova.

Também já existe `gabarito_ia` (gabarito extraído do PDF quando ele trazia um) e
`numeros_objetivas` — a base pra IA saber qual pergunta explicar, sem precisar reanalisar
o PDF inteiro do zero.

## Decisão: dois pontos de entrada, não um

**1. Logo depois da correção**, dentro do próprio fluxo de anexo/formulário
(`detalhes-sessao.tsx`, onde hoje o usuário marca certo/errado questão a questão). Assim
que a correção é salva, oferecer algo como "quer que eu explique as que você errou?". Esse
é o momento de maior intenção — o usuário acabou de descobrir o erro, contexto quente.

**2. Um lugar permanente pra revisitar depois**, porque revisão de erro raramente acontece
no minuto em que foi corrigido — geralmente é véspera de prova. Como `correcao` e
`gabarito_ia` já moram no anexo, e o anexo já aparece no Vault, a casa natural é um detalhe
a mais na tela do arquivo no Vault — ou, se quiser dar destaque, um "banco de erros"
agregando questões erradas de vários anexos (item que já aparece como pendência na memória
do projeto, ver `project_focus_sessions_gap.md`).

**O que decidimos não fazer**: não ancorar isso em "quando o usuário for fazer o
formulário", porque não existe esse momento ao vivo no app — pelo fluxo atual
(`anexosSessao.ts`, `EtapaFotoSessao.tsx`), o exercício é feito fora do app (papel/PDF
externo) e só depois anexado e corrigido aqui. Não tem "durante a prova" pra ancorar um
gatilho.

## Relação com o seletor de material compartilhado

Essa feature também é um dos motivadores do "seletor de material do Vault" discutido
separadamente (ver conversa/memória sobre unificar `DocumentPicker` de
`gerar-roadmap.tsx` e `anexosSessao.ts`): a IA vai precisar ler materiais já salvos no
Vault (não só o que acabou de ser anexado numa sessão), então o ponto de entrada dela
deve nascer já pensando em puxar do Vault, não reimplementar upload próprio.

## Em aberto (decidir na hora de implementar)

- Formato do "banco de erros": tela nova dedicada, ou só uma seção/filtro dentro da aba
  "Arquivos" do Vault?
- A explicação (texto + imagens) é gerada sob demanda (usuário pede) ou proativamente
  assim que a correção é salva?
- Onde fica o histórico de explicações já geradas — no próprio anexo, ou entidade nova
  tipo `explicacoes_questoes`?
