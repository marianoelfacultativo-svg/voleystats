// ============================================================
// API ROUTE — POST /api/consultas/[id]/feedback
// ============================================================
// Guarda el feedback del usuario sobre una consulta: qué esperaba
// ver en vez de lo que obtuvo.
// ============================================================

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  if (!id) {
    return NextResponse.json(
      { error: "Falta id de consulta." },
      { status: 400 }
    );
  }

  let body: { texto?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Body inválido (no es JSON)." },
      { status: 400 }
    );
  }

  const texto =
    typeof body.texto === "string" ? body.texto.trim() : "";
  if (!texto) {
    return NextResponse.json(
      { error: "Falta el texto del feedback." },
      { status: 400 }
    );
  }
  if (texto.length > 2000) {
    return NextResponse.json(
      { error: "El feedback es muy largo (máximo 2000 caracteres)." },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("consultas")
    .update({
      feedback_texto: texto,
      feedback_fecha: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: `No se pudo guardar: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}