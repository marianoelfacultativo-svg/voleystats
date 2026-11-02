// ============================================================
// API ROUTE — POST /api/traducir
// ============================================================
// Recibe: { texto: string, historial?: MensajeHistorial[] }
// Devuelve: ResultadoTraduccion (ver llmTranslator.ts)
//
// Es el puente entre el cliente (browser) y Groq (servidor).
// La API key NUNCA sale del servidor.
//
// Uso desde el cliente:
//   const res = await fetch("/api/traducir", {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({ texto: "cuántos aces" }),
//   });
//   const data = await res.json();
//   if (data.ok) { ... data.consulta ... }
// ============================================================

import { NextResponse } from "next/server";
import {
  traducirPromptConHistorial,
  type MensajeHistorial,
} from "@/lib/consultaAnalitica/llmTranslator";

export const runtime = "nodejs"; // fetch global disponible

interface Body {
  texto?: string;
  historial?: MensajeHistorial[];
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Body inválido (no es JSON).", intentos: 0 },
      { status: 400 }
    );
  }

  const texto = typeof body.texto === "string" ? body.texto : "";
  if (!texto.trim()) {
    return NextResponse.json(
      { ok: false, error: "Falta 'texto' en el body.", intentos: 0 },
      { status: 400 }
    );
  }

  const historial = Array.isArray(body.historial) ? body.historial : [];

  const resultado = await traducirPromptConHistorial(texto, historial);

  // Devolvemos 200 incluso si ok=false, porque es una respuesta
  // de negocio (el LLM no entendió), no un error del servidor.
  return NextResponse.json(resultado);
}