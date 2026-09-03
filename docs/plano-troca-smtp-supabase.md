# Plano de Troca de SMTP do Supabase Auth

*Criado em: 2026-09-03.*

## 1. Problema

Durante o teste do fluxo de recuperação de senha, o Supabase retornou erro de excesso de envio de emails. Isso não indica, por si só, um bug no StudoCore. O projeto está usando o serviço padrão de envio de email do Supabase Auth, que é deliberadamente limitado para uso de desenvolvimento.

O SMTP padrão do Supabase tem duas limitações críticas para produção:

- limite atual de **2 emails por hora** por projeto para emails de autenticação;
- entrega sem garantia de SLA, indicada pela própria Supabase como best-effort.

Esse limite afeta os fluxos de Auth que disparam email:

- cadastro com confirmação de email (`/auth/v1/signup`);
- reenvio de confirmação (`supabase.auth.resend`);
- recuperação de senha (`/auth/v1/recover`);
- alteração de email do usuário (`/auth/v1/user`, quando aplicável);
- convites/magic links/OTP por email, se forem usados futuramente.

No StudoCore, os pontos atuais afetados são:

- `services/auth.ts`
  - `cadastrarUsuario`
  - `reenviarEmailConfirmacao`
  - `confirmarCodigoCadastro`
  - `recuperarSenha`
  - `redefinirSenha`
- `app/(auth)/verify-email.tsx`
- `app/(auth)/forgot-password.tsx`
- `supabase/templates/confirmation.html`
- `supabase/templates/recovery.html`

## 2. Risco Para Usuários Reais

Se o app for lançado mantendo o SMTP padrão do Supabase, usuários reais podem ficar bloqueados em operações básicas:

- criar conta e não receber código de confirmação;
- pedir recuperação de senha e não receber link;
- tocar em "reenviar código" e receber erro logo nos primeiros usuários do dia;
- avaliar o app mal por não conseguir entrar;
- abrir suporte por problema que parece ser do StudoCore, embora seja limite de infraestrutura.

O risco é alto porque autenticação é caminho crítico. Mesmo que o banco, Realtime, Edge Functions e UI estejam funcionando, o usuário fica impedido de usar o produto se o email de Auth falhar.

## 3. Decisão Técnica

Antes de qualquer lançamento público, o StudoCore deve sair do SMTP padrão do Supabase e usar um provedor SMTP transacional próprio.

Critérios mínimos:

- permitir envio para qualquer endereço real de usuário;
- suportar volume superior ao limite de teste do Supabase;
- fornecer reputação e entregabilidade aceitáveis;
- permitir domínio remetente próprio do StudoCore;
- expor logs de entrega, bounce, bloqueio e spam;
- permitir aumento gradual de limite;
- guardar credenciais fora do app, apenas no painel/segredos da Supabase.

## 4. Provedores Candidatos

### Opção A: Resend

Boa opção para começo de produto pequeno porque costuma ter configuração simples, dashboard limpo e foco em emails transacionais.

Pontos fortes:

- setup rápido;
- bom DX;
- logs fáceis de interpretar;
- domínio remetente com SPF/DKIM;
- plano inicial suficiente para validar lançamento pequeno.

Pontos de atenção:

- precisa validar domínio;
- limites podem exigir aumento conforme campanha de lançamento;
- confirmar se SMTP atende o volume e preço desejados no momento da contratação.

### Opção B: SendGrid

Opção madura e muito usada.

Pontos fortes:

- infraestrutura robusta;
- bom volume;
- recursos avançados de entregabilidade.

Pontos de atenção:

- dashboard e setup mais pesados;
- reputação depende bastante de configuração correta;
- pode ser excesso para uma v1/TCC se o objetivo for só Auth transacional.

### Opção C: AWS SES

Opção barata e escalável.

Pontos fortes:

- custo baixo em escala;
- alta capacidade;
- boa integração com domínios.

Pontos de atenção:

- setup mais técnico;
- pode começar em sandbox e exigir aprovação para produção;
- observabilidade e experiência de uso são menos diretas que Resend/SendGrid.

### Recomendação Inicial

Para o estágio atual do StudoCore, a escolha mais pragmática é **Resend** ou outro provedor transacional simples. AWS SES faz sentido se o app crescer e o custo por volume virar prioridade.

## 5. Configuração Necessária no Provedor SMTP

1. Criar conta no provedor escolhido.
2. Adicionar domínio remetente.
3. Configurar DNS do domínio:
   - SPF;
   - DKIM;
   - DMARC, mesmo que inicialmente em modo monitoramento;
   - registros extras exigidos pelo provedor.
4. Aguardar verificação do domínio.
5. Criar credenciais SMTP.
6. Definir remetente transacional:
   - exemplo: `StudoCore <no-reply@seudominio.com>`;
   - evitar Gmail pessoal, Outlook pessoal ou remetente improvisado.
7. Desativar tracking de links, se o provedor habilitar por padrão.

O tracking de links é importante: a Supabase alerta que provedores que reescrevem links podem quebrar links de confirmação/reset. O template de recuperação usa `{{ .ConfirmationURL }}`, então esse link precisa chegar intacto.

## 6. Configuração no Supabase

No Dashboard:

1. Acessar o projeto do StudoCore.
2. Ir em `Authentication > Emails > SMTP Settings`.
3. Habilitar SMTP customizado.
4. Preencher:
   - host SMTP;
   - porta, normalmente `587`;
   - usuário SMTP;
   - senha/API key SMTP;
   - email remetente/admin;
   - nome do remetente: `StudoCore`.
5. Salvar.
6. Enviar email de teste, se disponível no painel.
7. Ir em `Authentication > Rate Limits`.
8. Ajustar limites de envio conforme o lançamento.

Também é possível configurar via Management API, mas para este projeto a configuração manual no Dashboard é mais segura, porque evita salvar senha/API key SMTP no repositório.

## 7. Segredos e Arquivos

Credenciais SMTP não devem entrar em:

- `.env` do app Expo;
- `EXPO_PUBLIC_*`;
- `app.json`;
- `eas.json`;
- código fonte;
- migration SQL;
- Edge Functions;
- `supabase/config.toml` versionado com senha real.

O arquivo `supabase/config.toml` já contém um bloco comentado de exemplo:

```toml
[auth.email.smtp]
enabled = true
host = "smtp.sendgrid.net"
port = 587
user = "apikey"
pass = "env(SENDGRID_API_KEY)"
admin_email = "admin@email.com"
sender_name = "Admin"
```

Esse bloco serve como referência local. Para produção hospedada, a senha real deve ficar no painel da Supabase ou em secrets gerenciados, nunca commitada.

## 8. Rate Limits Recomendados

O limite padrão após configurar SMTP customizado pode começar baixo. A Supabase documenta um limite inicial de referência de 30 emails por hora para proteger reputação.

Para lançamento pequeno/TCC:

- `email_sent`: 100 a 300 por hora;
- janela mínima por usuário para reset/cadastro: manter pelo menos 60 segundos;
- evitar aumentar limites sem CAPTCHA ou proteção contra abuso.

Para lançamento público com divulgação:

- estimar cadastros esperados na primeira hora;
- multiplicar por 2 ou 3 para cobrir reenvio e recuperação;
- pedir aumento no provedor SMTP antes do anúncio;
- monitorar bounce/spam desde o primeiro dia.

Exemplo de cálculo:

- 100 usuários tentando cadastrar em uma hora;
- 1 email de confirmação por cadastro;
- 20% pedindo reenvio;
- 5% usando recuperação de senha.

Volume estimado:

- 100 confirmações;
- 20 reenvios;
- 5 resets;
- total aproximado: 125 emails/hora.

Nesse cenário, um limite de 30/hora ainda falharia. Um limite inicial de 200/hora seria mais compatível.

## 9. Ajustes Recomendados no App

### 9.1 Tratar erro 429 com mensagem específica

Hoje `forgot-password.tsx` e `verify-email.tsx` chamam `traduzirErroAuth(error.message)`. O app deve garantir que mensagens como `rate limit`, `too many requests` ou `email rate limit exceeded` virem uma mensagem clara.

Mensagem recomendada:

> Muitas tentativas recentes. Aguarde alguns minutos antes de pedir outro código.

Para recuperação de senha:

> Muitas tentativas recentes. Aguarde alguns minutos antes de pedir outro link de recuperação.

Essa melhoria evita que o usuário veja um erro técnico ou ache que a conta foi perdida.

### 9.2 Cooldown no reset de senha

`verify-email.tsx` já tem cooldown visual de 60 segundos para reenvio de confirmação. `forgot-password.tsx` ainda permite tocar em `ENVIAR LINK` repetidamente após voltar ao estado inicial ou reabrir a tela.

Recomendação:

- adicionar cooldown local de 60 segundos após envio bem-sucedido;
- bloquear novo envio enquanto `isLoading` estiver ativo;
- manter texto do botão coerente: `Reenviar em 42s`;
- não revelar se o email existe ou não, para evitar enumeração de contas.

### 9.3 Estado de sucesso neutro

Para recuperação de senha, manter o comportamento de sucesso mesmo que o email não exista é desejável por segurança. A tela deve dizer que, se houver uma conta associada, o link será enviado.

Texto mais seguro:

> Se houver uma conta com esse e-mail, enviaremos as instruções de recuperação.

Isso reduz enumeração de usuários.

### 9.4 Observabilidade de erro

Adicionar logs não sensíveis em pontos de falha de Auth ajuda no diagnóstico.

Não logar:

- email completo do usuário;
- código OTP;
- senha;
- token;
- link de recuperação.

Pode logar:

- tipo do fluxo: `signup_confirmation`, `resend_confirmation`, `password_recovery`;
- código/status de erro, se disponível;
- mensagem técnica sanitizada;
- timestamp.

## 10. Templates de Email

Arquivos atuais:

- `supabase/templates/confirmation.html`
- `supabase/templates/recovery.html`

Pontos atuais positivos:

- templates em português;
- identidade visual escura compatível com HADES;
- confirmação usa `{{ .Token }}`, bom para app mobile;
- recuperação usa `{{ .ConfirmationURL }}`, coerente com o fluxo atual de deep link.

Melhorias recomendadas:

- incluir nome `StudoCore` no rodapé;
- avisar expiração aproximada do código/link;
- manter texto simples para não parecer phishing;
- testar modo claro/escuro em Gmail e Outlook;
- evitar imagens externas no email de Auth;
- garantir que o botão de recuperação continua funcionando quando aberto no celular.

Para cadastro, o app espera OTP de 8 dígitos:

- `supabase/config.toml`: `otp_length = 8`;
- `app/(auth)/verify-email.tsx`: `TAMANHO_CODIGO = 8`;
- template usa `{{ .Token }}`.

Esses três pontos precisam permanecer alinhados.

## 11. Deep Links e URL de Recuperação

O reset de senha em `services/auth.ts` usa:

```ts
Linking.createURL("forgot-password", {
  scheme: "studocore",
  isTripleSlashed: true,
})
```

O `supabase/config.toml` inclui:

```toml
additional_redirect_urls = [
  "https://towardly-insensately-mose.ngrok-free.dev",
  "exp://**",
  "studocore:///forgot-password",
  "studocore://**"
]
```

Para produção, revisar:

- `site_url` não deve depender de ngrok;
- URLs de redirect devem incluir o scheme final do app;
- se houver landing/site público, incluir domínio oficial;
- testar em build Android real, não só dev client.

## 12. Plano de Execução

### Fase 1: Escolha do provedor

Responsável: dono do projeto.

Checklist:

- escolher Resend, SendGrid, AWS SES ou similar;
- confirmar preço e limite inicial;
- confirmar suporte a SMTP;
- confirmar domínio remetente disponível;
- confirmar se há dashboard de logs.

Critério de saída:

- provedor escolhido e conta criada.

### Fase 2: Domínio e DNS

Responsável: dono do domínio.

Checklist:

- configurar domínio/subdomínio de envio;
- aplicar registros SPF/DKIM/DMARC;
- aguardar validação;
- enviar teste pelo próprio provedor;
- checar se email não cai diretamente em spam.

Critério de saída:

- domínio verificado e apto para envio.

### Fase 3: Configuração no Supabase

Responsável: desenvolvedor com acesso ao Dashboard.

Checklist:

- habilitar SMTP customizado;
- inserir host/porta/usuário/senha;
- configurar remetente `StudoCore`;
- salvar;
- testar email de confirmação;
- testar email de recuperação de senha;
- ajustar rate limits;
- documentar valores finais usados.

Critério de saída:

- Supabase Auth enviando emails pelo provedor customizado.

### Fase 4: Ajustes no App

Responsável: desenvolvimento.

Checklist:

- revisar `utils/errosAuth.ts` para erro 429/rate limit;
- adicionar cooldown em `forgot-password.tsx`;
- revisar copy para não enumerar email;
- garantir que `verify-email.tsx` continua com cooldown de 60s;
- rodar `npx tsc --noEmit`;
- rodar `npx jest services/__tests__/auth.test.ts`, se alterar service de auth;
- rodar `npm run check` se mexer em app/components/hooks com dados.

Critério de saída:

- app lida com limite sem quebrar UX.

### Fase 5: Teste de Produção Controlado

Responsável: QA/manual.

Checklist:

- criar conta nova com email real;
- receber OTP;
- confirmar cadastro;
- pedir reenvio após cooldown;
- pedir reset de senha;
- abrir link no celular;
- trocar senha;
- entrar com nova senha;
- repetir em Gmail e Outlook;
- checar logs no provedor SMTP;
- checar logs do Supabase Auth.

Critério de saída:

- todos os fluxos críticos de Auth funcionam em build real.

## 13. Plano de Rollback

Se o SMTP customizado falhar:

1. Verificar logs do provedor.
2. Verificar credenciais no Supabase.
3. Verificar DNS do domínio.
4. Reduzir rate limit se houver suspeita de bloqueio por abuso.
5. Trocar senha/API key SMTP.
6. Se necessário, voltar temporariamente ao SMTP padrão apenas para teste interno.

Voltar ao SMTP padrão não é solução de produção, porque recoloca o limite de 2 emails/hora.

## 14. Monitoramento Pós-Lançamento

Durante a primeira semana pública, acompanhar diariamente:

- quantidade de emails enviados;
- taxa de bounce;
- taxa de reclamação de spam;
- bloqueios/rejeições;
- falhas de Auth por rate limit;
- usuários presos em confirmação de email;
- reclamações sobre recuperação de senha.

Alertas desejáveis:

- pico de `429 Too Many Requests`;
- aumento de bounce;
- aumento de spam complaint;
- queda brusca de entrega;
- volume perto do limite contratado.

## 15. Critérios de Pronto Para Lançamento

O StudoCore só deve considerar o fluxo de Auth pronto para produção quando:

- SMTP customizado estiver ativo;
- domínio remetente estiver verificado;
- SPF/DKIM/DMARC estiverem configurados;
- links/códigos funcionarem em dispositivo real;
- rate limit estiver dimensionado para o lançamento;
- app tiver tratamento amigável para 429;
- `forgot-password.tsx` tiver cooldown;
- templates estiverem revisados;
- teste manual de cadastro, reenvio e reset passar;
- credenciais não estiverem versionadas.

## 16. Referências

- Supabase Auth Rate Limits: https://supabase.com/docs/guides/auth/rate-limits
- Supabase Custom SMTP: https://supabase.com/docs/guides/auth/auth-smtp
- Supabase Password Auth: https://supabase.com/docs/guides/auth/passwords
- Supabase Email Templates: https://supabase.com/docs/guides/auth/auth-email-templates
