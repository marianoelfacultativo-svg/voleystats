// ============================================================
// LLM TRANSLATOR — llamada a Groq + validación de ConsultaPipeline
// ============================================================
// v2.1: backoff exponencial en 429 (rate limit).
// v2.2 (Bloque 3b): agrega `traducirPromptConCorreccion` — una sola
//   llamada extra pasándole al LLM el error exacto de validación.
// ============================================================

import {
  esConsultaPipelineValida,
  SYSTEM_PROMPT_PIPELINE,
  type ConsultaPipeline,
} from "./pipelineSchema";

const GROQ_URL =
  process.env.GROQ_URL ||
  (process.env.OPENAI_API_KEY && !process.env.GROQ_API_KEY
    ? "https://api.openai.com/v1/chat/completions"
    : "https://api.groq.com/openai/v1/chat/completions");

const GROQ_MODEL =
  process.env.GROQ_MODEL ||
  (process.env.OPENAI_API_KEY && !process.env.GROQ_API_KEY
    ? "gpt-4o-mini"
    : "openai/gpt-oss-120b");

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
  const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error:
        "Falta GROQ_API_KEY (o OPENAI_API_KEY) en el entorno (.env.local). Configurala para habilitar las consultas LLM.",
    };
  }

  const body: Record<string, unknown> = {
    model: GROQ_MODEL,
    messages,
    temperature: 0,
    max_completion_tokens: 8192,
    top_p: 1,
    reasoning_effort: "high",
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

// ------------------------------------------------------------
// v2.2 (Bloque 3b) — RETRY CON ERROR ESPECÍFICO
// ------------------------------------------------------------
// Una SOLA llamada extra a Groq. Le pasamos:
//   - el prompt original,
//   - el pipeline que devolvió antes (assistant),
//   - el error exacto que dio la validación (user).
// El LLM corrige lo necesario y devuelve el JSON de nuevo.
//
// NO tiene loop interno: si falla, falla. Cap duro en 1 llamada
// extra para no gastar tokens (plan free).
// ------------------------------------------------------------

export async function traducirPromptConCorreccion(
  textoOriginal: string,
  pipelineAnterior: ConsultaPipeline,
  errorValidacion: string
): Promise<ResultadoTraduccion> {
  const textoLimpio = textoOriginal.trim();
  if (!textoLimpio) {
    return { ok: false, error: "El prompt está vacío.", intentos: 0 };
  }

  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: SYSTEM_PROMPT_PIPELINE },
    { role: "user", content: textoLimpio },
    { role: "assistant", content: JSON.stringify(pipelineAnterior) },
    {
      role: "user",
      content:
        `Tu respuesta anterior falló la validación con este error: "${errorValidacion}".\n` +
        `Corregí SOLO lo necesario y devolvé únicamente el JSON ConsultaPipeline corregido. ` +
        `Sin markdown, sin explicaciones, sin comentarios fuera del JSON.`,
    },
  ];

  const llamada = await llamarGroq(messages, true);

  if (!llamada.ok || !llamada.content) {
    return {
      ok: false,
      error:
        llamada.error ??
        "Groq devolvió vacío en el retry de corrección.",
      intentos: 1,
    };
  }

  const validado = parsearYValidar(llamada.content);
  if (validado.ok) {
    return { ok: true, pipeline: validado.pipeline, intentos: 1 };
  }

  return {
    ok: false,
    error: `El retry de corrección devolvió JSON inválido: ${validado.error}`,
    intentos: 1,
    raw: llamada.content,
  };
}