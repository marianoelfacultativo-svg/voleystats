// ============================================================
// LLM TRANSLATOR — llamada a Groq + validación de ConsultaPipeline
// ============================================================
// Traduce el prompt del usuario a `ConsultaPipeline` (JSON tipado)
// llamando a Groq con el `SYSTEM_PROMPT_PIPELINE` de `pipelineSchema.ts`.
//
// ⚠️  SERVER-SIDE ONLY. Usa `GROQ_API_KEY`. Nunca importar este
//     archivo desde un componente "use client".
// ============================================================

import {
  esConsultaPipelineValida,
  SYSTEM_PROMPT_PIPELINE,
  type ConsultaPipeline,
} from "./pipelineSchema";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "openai/gpt-oss-120b";
const MAX_INTENTOS = 2;

export interface MensajeHistorial {
  role: "user" | "assistant";
  content: string;
}

export type ResultadoTraduccion =
  | { ok: true; pipeline: ConsultaPipeline; intentos: number }
  | { ok: false; error: string; intentos: number; raw?: string };

async function llamarGroq(
  messages: Array<{ role: string; content: string }>,
  jsonMode: boolean
): Promise<{ ok: boolean; content?: string; error?: string }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "Falta GROQ_API_KEY en el entorno." };
  }

  const body: Record<string, unknown> = {
    model: GROQ_MODEL,
    messages,
    temperature: 0,
    max_completion_tokens: 2048,
    top_p: 1,
  };

  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  let res: Response;
  try {
    res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return {
      ok: false,
      error: `Error de red al llamar a Groq: ${
        e instanceof Error ? e.message : "desconocido"
      }`,
    };
  }

  if (!res.ok) {
    const texto = await res.text().catch(() => "");
    return {
      ok: false,
      error: `Groq respondió ${res.status}: ${texto.slice(0, 300)}`,
    };
  }

  const data = await res.json().catch(() => null);
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    return { ok: false, error: "Groq devolvió una respuesta vacía." };
  }

  return { ok: true, content };
}

function parsearYValidar(
  raw: string
): { ok: true; pipeline: ConsultaPipeline } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "El output no es JSON válido." };
  }

  if (!esConsultaPipelineValida(parsed)) {
    return {
      ok: false,
      error: "El JSON no cumple el schema de ConsultaPipeline esperado.",
    };
  }

  return { ok: true, pipeline: parsed };
}

export async function traducirPrompt(
  texto: string
): Promise<ResultadoTraduccion> {
  return traducirPromptConHistorial(texto, []);
}

export async function traducirPromptConHistorial(
  texto: string,
  historial: MensajeHistorial[]
): Promise<ResultadoTraduccion> {
  const textoLimpio = texto.trim();
  if (!textoLimpio) {
    return { ok: false, error: "El prompt está vacío.", intentos: 0 };
  }

  let ultimoError = "";
  let ultimoRaw: string | undefined;

  for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: SYSTEM_PROMPT_PIPELINE },
      ...historial.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: textoLimpio },
    ];

    if (intento > 1) {
      messages.unshift({
        role: "system",
        content:
          "ATENCIÓN: en el intento anterior devolviste un JSON inválido. " +
          "Respondé SOLO con JSON que cumpla el schema ConsultaPipeline. " +
          "Sin markdown, sin comentarios.",
      });
    }

    const llamada = await llamarGroq(messages, true);
    if (!llamada.ok || !llamada.content) {
      ultimoError = llamada.error ?? "Groq devolvió vacío.";
      continue;
    }

    ultimoRaw = llamada.content;
    const validado = parsearYValidar(llamada.content);
    if (validado.ok) {
      return {
        ok: true,
        pipeline: validado.pipeline,
        intentos: intento,
      };
    }
    ultimoError = validado.error;
  }

  return {
    ok: false,
    error: `No se pudo traducir el prompt después de ${MAX_INTENTOS} intentos. Último error: ${ultimoError}`,
    intentos: MAX_INTENTOS,
    raw: ultimoRaw,
  };
}
