// ============================================================
// LLM TRANSLATOR — llamada a Groq + validación de ConsultaPipeline
// ============================================================
// Traduce el prompt del usuario a `ConsultaPipeline` (JSON tipado)
// llamando a Groq con el `SYSTEM_PROMPT_PIPELINE` de `pipelineSchema.ts`.
//
// ⚠️  SERVER-SIDE ONLY. Usa `GROQ_API_KEY`. Nunca importar este
//     archivo desde un componente "use client".
//
// v2.1: backoff exponencial en 429 (rate limit).
//   + Detecta 429 y extrae "try again in Xs" del mensaje.
//   + Espera entre reintentos.
//   + MAX_INTENTOS = 3.
//   + Mensaje claro al usuario si después de 3 intentos sigue rate-limited.
// ============================================================

import {
  esConsultaPipelineValida,
  SYSTEM_PROMPT_PIPELINE,
  type ConsultaPipeline,
} from "./pipelineSchema";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "openai/gpt-oss-120b";
const MAX_INTENTOS = 3;

const RETRY_DEFAULT_MS = 3000;

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
): Promise<{
  ok: boolean;
  content?: string;
  error?: string;
  retryAfterMs?: number;
}> {
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

    // Detectar 429 (rate limit) y extraer "try again in Xs"
    let retryAfterMs = RETRY_DEFAULT_MS;
    if (res.status === 429) {
      const m = texto.match(/try again in (\d+(?:\.\d+)?)s/);
      if (m) {
        retryAfterMs = Math.ceil(parseFloat(m[1]) * 1000) + 800;
      }
    }

    return {
      ok: false,
      error: `Groq respondió ${res.status}: ${texto.slice(0, 300)}`,
      retryAfterMs: res.status === 429 ? retryAfterMs : undefined,
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

async function esperar(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
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
  let fueRateLimit = false;

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

    // Si falló por 429, esperar antes del siguiente intento
    if (!llamada.ok && llamada.retryAfterMs !== undefined) {
      fueRateLimit = true;
      ultimoError = llamada.error ?? "Rate limit de Groq.";
      if (intento < MAX_INTENTOS) {
        await esperar(llamada.retryAfterMs);
      }
      continue;
    }

    if (!llamada.ok || !llamada.content) {
      ultimoError = llamada.error ?? "Groq devolvió vacío.";
      continue;
    }

    fueRateLimit = false;
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

  const mensajeFinal = fueRateLimit
    ? `Rate limit de Groq alcanzado (plan free: 8000 tokens/minuto). ` +
      `Esperá 60 segundos y volvé a intentar. ` +
      `Detalle: ${ultimoError}`
    : `No se pudo traducir el prompt después de ${MAX_INTENTOS} intentos. ` +
      `Último error: ${ultimoError}`;

  return {
    ok: false,
    error: mensajeFinal,
    intentos: MAX_INTENTOS,
    raw: ultimoRaw,
  };
}