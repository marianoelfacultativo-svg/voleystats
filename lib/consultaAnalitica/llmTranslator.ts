// ============================================================
// LLM TRANSLATOR — llamada a Groq + validación
// ============================================================
// Traduce el prompt del usuario a `ConsultaLLM` (JSON tipado)
// llamando a Groq con el `SYSTEM_PROMPT` de `llmSchema.ts`.
//
// ⚠️  SERVER-SIDE ONLY. Usa `GROQ_API_KEY` (no debe exponerse
//     al cliente). Nunca importar este archivo desde un
//     componente "use client".
//
// API pública:
//   traducirPrompt(texto) → Promise<ResultadoTraduccion>
//   traducirPromptConHistorial(texto, historial) → Promise<ResultadoTraduccion>
//
// El historial es para el feedback loop ("No es lo que pedí"):
//   - Cada turno tiene { role, content }.
//   - El LLM ve la conversación completa y devuelve el JSON
//     corregido en vez de reinterpretar desde cero.
// ============================================================

import {
  esConsultaLLMValida,
  SYSTEM_PROMPT,
  type ConsultaLLM,
} from "./llmSchema";

// ------------------------------------------------------------
// CONSTANTES
// ------------------------------------------------------------

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "openai/gpt-oss-120b";
const MAX_INTENTOS = 2; // 1 intento + 1 reintento si JSON inválido

// ------------------------------------------------------------
// TIPOS
// ------------------------------------------------------------

export interface MensajeHistorial {
  role: "user" | "assistant";
  content: string;
}

export type ResultadoTraduccion =
  | { ok: true; consulta: ConsultaLLM; intentos: number }
  | { ok: false; error: string; intentos: number; raw?: string };

// ------------------------------------------------------------
// LLAMADA A GROQ
// ------------------------------------------------------------

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
    temperature: 0, // determinístico para JSON
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

// ------------------------------------------------------------
// PARSEO + VALIDACIÓN
// ------------------------------------------------------------

function parsearYValidar(
  raw: string
): { ok: true; consulta: ConsultaLLM } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "El output no es JSON válido." };
  }

  if (!esConsultaLLMValida(parsed)) {
    return {
      ok: false,
      error: "El JSON no cumple el schema esperado (faltan campos o tipos mal).",
    };
  }

  return { ok: true, consulta: parsed };
}

// ------------------------------------------------------------
// API PÚBLICA
// ------------------------------------------------------------

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
      { role: "system", content: SYSTEM_PROMPT },
      ...historial.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: textoLimpio },
    ];

    // En el reintento, agregamos un mensaje de corrección al system.
    if (intento > 1) {
      messages.unshift({
        role: "system",
        content:
          "ATENCIÓN: en el intento anterior devolviste un JSON inválido. " +
          "Respondé SOLO con JSON que cumpla el schema. Sin texto extra, " +
          "sin markdown, sin comentarios.",
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
        consulta: validado.consulta,
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