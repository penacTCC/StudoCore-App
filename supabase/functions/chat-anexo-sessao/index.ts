// Edge Function do chat sobre o anexo de uma sessão (Premium) — tirar dúvida sobre o
// formulário/prova já anexado e pedir questões parecidas, em cima da mesma análise já feita
// por `analisar-anexo-sessao`.
//
// Duas ações, escolhidas pelo campo "acao" do corpo:
//
//   "upload"   — sobe o arquivo (base64) pra Gemini Files API e devolve a referência
//                (fileUri) que vale por ~48h. Quem chama guarda essa referência em
//                `arquivos.gemini_file_uri` e só faz upload de novo quando ela expira.
//   "mensagem" — manda uma pergunta pro Gemini, junto do histórico da conversa e da
//                referência do arquivo (fileUri, não o base64 de novo). É o motivo de ter
//                a etapa de upload separada: reenviar um PDF inteiro em base64 a cada
//                pergunta do chat seria lento e caro; a referência já sobe uma vez só.
//
// Mesmo motivo de viver no servidor que as outras funções de IA: a chave do Gemini não pode
// ir pro bundle do app.
//
// Deploy: `supabase functions deploy chat-anexo-sessao`
// Secret: já usa `GEMINI_API_KEY` (mesma da `analisar-anexo-sessao` e `gerar-quiz-foco`).

import { consumirCota, cotaDisponivel, respostaDeCotaEsgotada } from "../_shared/cota.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mesma cascata da análise: os modelos 2.5 saíram de circulação pra chaves novas (404), e a
// linha Flash-Lite tem a maior cota diária do free tier.
const MODELOS_GEMINI = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.5-flash"];

const MIMES_ACEITOS = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

function jsonResponse(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function mimeValido(mimeType: string | undefined) {
  return mimeType && MIMES_ACEITOS.includes(mimeType) ? mimeType : "application/pdf";
}

/*
  Decodifica o base64 pra bytes crus — a Files API quer o binário, não uma string JSON com
  base64 dentro (diferente do `inlineData` usado na análise).
*/
function base64ParaBytes(base64: string): Uint8Array {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

/*
  Upload resumível em duas etapas, do jeito que a Files API do Gemini exige: a primeira
  chamada reserva a URL de upload (ela vem num header da resposta, não no corpo), a segunda
  manda os bytes pra essa URL com "upload, finalize" pra fechar o arquivo de uma vez.
*/
async function subirArquivoParaGemini(chaveGemini: string, bytes: Uint8Array, mimeType: string) {
  const inicio = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${chaveGemini}`,
    {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(bytes.byteLength),
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file: { display_name: "anexo-sessao" } }),
    }
  );

  if (!inicio.ok) {
    throw new Error(`Gemini recusou iniciar o upload (HTTP ${inicio.status}): ${(await inicio.text()).slice(0, 250)}`);
  }

  const urlUpload = inicio.headers.get("x-goog-upload-url");
  if (!urlUpload) throw new Error("Gemini não devolveu a URL de upload.");

  const finalizacao = await fetch(urlUpload, {
    method: "POST",
    headers: {
      "Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: bytes,
  });

  if (!finalizacao.ok) {
    throw new Error(`Gemini recusou finalizar o upload (HTTP ${finalizacao.status}): ${(await finalizacao.text()).slice(0, 250)}`);
  }

  const dados = await finalizacao.json();
  const arquivo = dados?.file;
  if (!arquivo?.uri) throw new Error("Gemini não devolveu a referência do arquivo.");

  return { fileUri: arquivo.uri as string, expiraEm: arquivo.expirationTime as string | undefined };
}

type MensagemHistorico = { papel: "user" | "model"; texto: string };

function montarInstrucaoSistema(disciplina?: string, conteudo?: string | null) {
  const contexto = [
    disciplina ? `Matéria da sessão: ${disciplina}` : null,
    conteudo ? `Conteúdo estudado na sessão: ${conteudo}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `Você é um tutor ajudando um aluno a tirar dúvidas sobre um formulário/lista de
exercícios que ele anexou a uma sessão de estudo no app.

${contexto || "Nenhum contexto adicional sobre a sessão foi informado."}

Responda SEMPRE com base no conteúdo do documento anexado (é o arquivo desta conversa).
Você pode:
- Explicar uma questão específica passo a passo, sem só entregar a resposta pronta quando
  o aluno pedir "explique" — ensine o raciocínio.
- Tirar dúvida sobre qualquer trecho do documento.
- Gerar questões novas, no mesmo estilo e nível de dificuldade de alguma questão do
  documento, quando o aluno pedir — deixe claro a resposta correta ao final de cada uma.

Se a pergunta não tiver relação com o documento anexado, diga isso educadamente e redirecione
para o conteúdo do anexo. Seja direto e didático. Respostas de chat, não um texto longo:
poucos parágrafos, só o que ajuda o aluno a entender ou praticar. Responda em português do
Brasil.`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const chaveGemini = Deno.env.get("GEMINI_API_KEY");
  if (!chaveGemini) {
    console.error("GEMINI_API_KEY não configurada nos secrets da função.");
    return jsonResponse({ error: "Serviço de chat não configurado." }, 500);
  }

  try {
    const corpo = await req.json().catch(() => ({}));
    const acao = corpo?.acao as string | undefined;

    if (acao === "upload") {
      const base64 = corpo?.base64 as string | undefined;
      if (!base64) return jsonResponse({ error: "Arquivo não informado." }, 400);

      // O upload custa (Files API do Gemini) mas nao e a unidade cobrada: aqui so
      // CONSULTAMOS a cota, para o plano Gratis — que nao tem chat — nao conseguir subir
      // arquivo e so levar 429 na pergunta, depois do custo ja ter acontecido.
      const cotaUpload = await cotaDisponivel(req, "chat");
      if (cotaUpload && !cotaUpload.permitido) {
        return respostaDeCotaEsgotada("chat", cotaUpload, CORS_HEADERS);
      }

      const mimeType = mimeValido(corpo?.mimeType);
      try {
        const { fileUri, expiraEm } = await subirArquivoParaGemini(chaveGemini, base64ParaBytes(base64), mimeType);
        return jsonResponse({ fileUri, expiraEm: expiraEm ?? null });
      } catch (erro) {
        console.error("Erro no upload pra Gemini Files API:", erro);
        return jsonResponse({ error: "Não foi possível preparar o arquivo para o chat.", detalhe: String(erro) }, 502);
      }
    }

    if (acao === "mensagem") {
      const fileUri = corpo?.fileUri as string | undefined;
      const pergunta = (corpo?.pergunta as string | undefined)?.trim();
      if (!fileUri) return jsonResponse({ error: "Referência do arquivo não informada." }, 400);
      if (!pergunta) return jsonResponse({ error: "Pergunta vazia." }, 400);

      // A pergunta e a unidade cobrada do chat de anexo.
      const cota = await consumirCota(req, "chat");
      if (cota && !cota.permitido) {
        return respostaDeCotaEsgotada("chat", cota, CORS_HEADERS);
      }

      const mimeType = mimeValido(corpo?.mimeType);
      const historico = Array.isArray(corpo?.historico) ? (corpo.historico as MensagemHistorico[]) : [];

      const contents = [
        {
          role: "user",
          parts: [
            { fileData: { fileUri, mimeType } },
            { text: "Este é o documento anexado à minha sessão de estudo. Vou fazer perguntas sobre ele." },
          ],
        },
        {
          role: "model",
          parts: [{ text: "Certo, já li o documento. Pode perguntar." }],
        },
        ...historico
          .filter((m) => m?.texto?.trim())
          .map((m) => ({ role: m.papel === "model" ? "model" : "user", parts: [{ text: m.texto }] })),
        { role: "user", parts: [{ text: pergunta }] },
      ];

      const corpoGemini = JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: montarInstrucaoSistema(corpo?.disciplina, corpo?.conteudo) }] },
      });

      let respostaGemini: Response | null = null;
      let ultimoErro = "";

      for (const modelo of MODELOS_GEMINI) {
        const tentativa = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": chaveGemini },
            body: corpoGemini,
          }
        );

        if (tentativa.ok) {
          respostaGemini = tentativa;
          break;
        }

        ultimoErro = `${modelo} → ${tentativa.status}: ${(await tentativa.text()).slice(0, 250)}`;
        console.error("Erro do Gemini:", ultimoErro);
      }

      if (!respostaGemini) {
        return jsonResponse(
          { error: "Não foi possível responder agora.", detalhe: `Gemini ${ultimoErro}` },
          502
        );
      }

      const dadosGemini = await respostaGemini.json();
      const partes = dadosGemini?.candidates?.[0]?.content?.parts;
      const parte = Array.isArray(partes)
        ? partes.find((p: any) => !p?.thought && typeof p?.text === "string" && p.text.trim())
        : null;

      if (!parte?.text) {
        console.error("Resposta do Gemini sem conteúdo:", JSON.stringify(dadosGemini));
        return jsonResponse(
          {
            error: "O modelo não retornou uma resposta.",
            detalhe: `Sem conteúdo. finishReason: ${dadosGemini?.candidates?.[0]?.finishReason ?? "?"}`,
          },
          502
        );
      }

      return jsonResponse({ resposta: parte.text as string });
    }

    return jsonResponse({ error: "Ação inválida." }, 400);
  } catch (erro) {
    console.error("Erro inesperado no chat do anexo:", erro);
    return jsonResponse({ error: "Erro inesperado no chat." }, 500);
  }
});
