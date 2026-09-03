// Acesso à Android Publisher API (Google Play), compartilhado pelas Edge Functions de
// assinatura — `confirmar-compra-play` (logo após a compra) e `sincronizar-assinatura-play`
// (reconciliação periódica). As duas precisam da MESMA autenticação e do MESMO mapeamento
// de estado; duplicar isso arriscaria as duas ficarem divergentes numa mudança de API.
//
// Sem SDK de propósito — mesmo espírito de `backblaze.ts`: um fetch cru autenticado é menos
// código e menos dependência do que trazer a lib oficial do Google só por causa de duas
// chamadas.
//
// Secrets necessários (ver comentário de deploy em cada função que importa este arquivo):
//   GOOGLE_PLAY_CLIENT_EMAIL, GOOGLE_PLAY_PRIVATE_KEY, GOOGLE_PLAY_PACKAGE_NAME

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ESCOPO = "https://www.googleapis.com/auth/androidpublisher";

function base64UrlDoBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binario = "";
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDoTexto(texto: string): string {
  return base64UrlDoBuffer(new TextEncoder().encode(texto));
}

/** A chave vem do secret como uma única linha com `\n` literais — PEM de verdade tem quebras reais. */
function pemParaChavePrivada(pem: string): Promise<CryptoKey> {
  const pemNormalizado = pem.includes("\\n") ? pem.replace(/\\n/g, "\n") : pem;
  const corpo = pemNormalizado
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");

  const bytes = Uint8Array.from(atob(corpo), (c) => c.charCodeAt(0));

  return crypto.subtle.importKey(
    "pkcs8",
    bytes.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

/**
 * Troca as credenciais da service account por um access token OAuth2, via o fluxo
 * "JWT Bearer" (RFC 7523) — o mesmo que qualquer service account do Google usa, só que
 * montado e assinado na mão com Web Crypto em vez da lib `google-auth-library`.
 */
export async function obterTokenDeAcesso(): Promise<string> {
  const clientEmail = Deno.env.get("GOOGLE_PLAY_CLIENT_EMAIL");
  const privateKey = Deno.env.get("GOOGLE_PLAY_PRIVATE_KEY");
  if (!clientEmail || !privateKey) {
    throw new Error("GOOGLE_PLAY_CLIENT_EMAIL/GOOGLE_PLAY_PRIVATE_KEY não configurados nos secrets.");
  }

  const agora = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: clientEmail,
    scope: ESCOPO,
    aud: TOKEN_URL,
    iat: agora,
    exp: agora + 3600,
  };

  const semAssinar = `${base64UrlDoTexto(JSON.stringify(header))}.${base64UrlDoTexto(JSON.stringify(claims))}`;
  const chave = await pemParaChavePrivada(privateKey);
  const assinatura = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    chave,
    new TextEncoder().encode(semAssinar),
  );
  const jwt = `${semAssinar}.${base64UrlDoBuffer(assinatura)}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const detalhe = await res.text().catch(() => "");
    throw new Error(`Google recusou o token de acesso (HTTP ${res.status}): ${detalhe.slice(0, 200)}`);
  }

  const dados = await res.json();
  return dados.access_token as string;
}

export type EstadoAssinaturaGoogle = {
  estado: string;
  expiraEm: string | null;
  produtoId: string | null;
  orderId: string | null;
  reconhecida: boolean;
};

function nomeDoPacote(): string {
  const pacote = Deno.env.get("GOOGLE_PLAY_PACKAGE_NAME");
  if (!pacote) throw new Error("GOOGLE_PLAY_PACKAGE_NAME não configurado nos secrets.");
  return pacote;
}

/**
 * Estado atual de uma assinatura na Play Store, pelo purchase token.
 *
 * Usa `subscriptionsv2` (não a v1): uma chamada só devolve estado, validade e produto —
 * a v1 exige tratar base plans/offers separadamente para a mesma informação.
 */
export async function buscarAssinaturaGoogle(
  purchaseToken: string,
  accessToken: string,
): Promise<EstadoAssinaturaGoogle> {
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${nomeDoPacote()}/purchases/subscriptionsv2/tokens/${purchaseToken}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });

  if (!res.ok) {
    const detalhe = await res.text().catch(() => "");
    throw new Error(`Google Play recusou a consulta (HTTP ${res.status}): ${detalhe.slice(0, 200)}`);
  }

  const dados = await res.json();
  const item = dados?.lineItems?.[0] ?? {};

  return {
    estado: dados?.subscriptionState ?? "SUBSCRIPTION_STATE_UNSPECIFIED",
    expiraEm: item?.expiryTime ?? null,
    produtoId: item?.productId ?? null,
    orderId: dados?.latestOrderId ?? null,
    reconhecida: dados?.acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
  };
}

/**
 * Confirma (acknowledge) uma compra ainda não reconhecida. Obrigatório dentro de 3 dias
 * pela política da Play Billing — sem isso o Google estorna a compra automaticamente.
 *
 * O endpoint de acknowledge continua sendo o da v1 (`purchases.subscriptions.acknowledge`,
 * por productId), mesmo consultando o estado pela v2 — confirmar contra a documentação
 * atual do Google antes de depender disso em produção, a API muda com o tempo.
 */
export async function confirmarAssinaturaGoogle(
  productId: string,
  purchaseToken: string,
  accessToken: string,
): Promise<void> {
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${nomeDoPacote()}/purchases/subscriptions/${productId}/tokens/${purchaseToken}:acknowledge`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const detalhe = await res.text().catch(() => "");
    throw new Error(`Google Play recusou a confirmação (HTTP ${res.status}): ${detalhe.slice(0, 200)}`);
  }
}

/** Domínio de status de `assinaturas`, bem mais simples que os ~7 estados do Google. */
export type StatusAssinatura = "ativa" | "cancelada" | "expirada";

/**
 * Reduz o `subscriptionState` do Google ao domínio de `assinaturas.status`.
 *
 * `CANCELED` conta como `ativa` enquanto a validade não passou: cancelar só desliga a
 * renovação automática, o período já pago continua valendo. `PENDING` (compra iniciada mas
 * ainda não paga) não vira Pro — quem chamou não deve gravar nada em `assinaturas` nesse caso.
 */
export function mapearEstadoDoGoogle(estado: string, expiraEm: string | null): StatusAssinatura {
  const expirou = expiraEm !== null && new Date(expiraEm).getTime() <= Date.now();

  switch (estado) {
    case "SUBSCRIPTION_STATE_ACTIVE":
    case "SUBSCRIPTION_STATE_IN_GRACE_PERIOD":
      return expirou ? "expirada" : "ativa";
    case "SUBSCRIPTION_STATE_CANCELED":
      return expirou ? "expirada" : "ativa";
    case "SUBSCRIPTION_STATE_ON_HOLD":
    case "SUBSCRIPTION_STATE_PAUSED":
    case "SUBSCRIPTION_STATE_EXPIRED":
    default:
      return "expirada";
  }
}
