// ============================================================
// HEALTH CHECK — verificar que las env vars están cargadas
// ============================================================
// Solo devuelve si las env vars existen, NO sus valores.
// Se puede borrar después de diagnosticar.
// ============================================================

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    groq_key_present: !!process.env.GROQ_API_KEY,
    groq_key_length: process.env.GROQ_API_KEY?.length ?? 0,
    node_env: process.env.NODE_ENV,
    vercel_env: process.env.VERCEL_ENV ?? null,
    timestamp: new Date().toISOString(),
  });
}