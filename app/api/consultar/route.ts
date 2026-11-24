// ============================================================
// API ROUTE — POST /api/consultar
// ============================================================
// v3.0 (v49.4) — Background + persistencia
//
// Flujo nuevo:
//   1. POST inserta fila en `consultas` con estado='pendiente'
//      y devuelve { consultaId } al toque (<200ms).
//   2. `after()` procesa en background (carga contexto,
//      traduce, ejecuta, update a 'completada'/'fallida').
//   3. El cliente se suscribe a Supabase Realtime para ver el
//      cambio de estado y mostrar el resultado.
//
// Requiere:
//   · Next.js 14.2+ con `unstable_after` (o Next 15 con `after`).
//   · Vercel Fluid Compute activado para maxDuration > 60s.
//   · Tabla `consultas` (Pieza 1, ya creada).
//   · Realtime habilitado para `public.consultas`.
// ============================================================

import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { cargarAccionesUnificadas } from "@/app/equipo/adaptadorUnificadoV2";
import type {
  AccionVisual,
  PuntoConAcciones,
} from "@/app/equipo/adaptadorUnificadoV2";
import type { JugadorParaResolver } from "@/lib/consultaAnalitica/resolverJugador";
import { ejecutarConsultaLLM } from "@/lib/consultaAnalitica/ejecutarConsultaLLM";

export const runtime = "nodejs";
// Hobby: 60s sin Fluid Compute, 300s con Fluid Compute.
// Si el deploy falla con 300, bajalo a 60.
export const maxDuration = 300;

interface Body {
  prompt?: string;
  partidoId?: string | null;
  equipoId?: string;
}

// ------------------------------------------------------------
// POST
// ------------------------------------------------------------

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { tipo: "error", mensaje: "Body inválido (no es JSON)." },
      { status: 400 }
    );
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return NextResponse.json(
      { tipo: "error", mensaje: "Falta 'prompt' en el body." },
      { status: 400 }
    );
  }

  const equipoId = typeof body.equipoId === "string" ? body.equipoId : "";
  if (!equipoId) {
    return NextResponse.json(
      { tipo: "error", mensaje: "Falta 'equipoId' en el body." },
      { status: 400 }
    );
  }

  const partidoId =
    typeof body.partidoId === "string" && body.partidoId.length > 0
      ? body.partidoId
      : null;

  // 1) Insertar la consulta como 'pendiente' y devolver el id al toque.
  const { data: creada, error: errInsert } = await supabase
    .from("consultas")
    .insert({
      equipo_id: equipoId,
      partido_id: partidoId,
      prompt,
      estado: "pendiente",
    })
    .select("id")
    .single();

  if (errInsert || !creada) {
    return NextResponse.json(
      {
        tipo: "error",
        mensaje: `Error al crear la consulta: ${
          errInsert?.message ?? "desconocido"
        }`,
      },
      { status: 500 }
    );
  }

  const consultaId = creada.id as string;

  // 2) Procesar en background, después de enviar la respuesta.
  waitUntil(
    procesarConsultaEnBackground(consultaId, prompt, equipoId, partidoId)
  );

  // 3) Responder al cliente con el id para que se suscriba.
  return NextResponse.json({
    tipo: "pendiente",
    consultaId,
  });
}

// ------------------------------------------------------------
// PROCESAMIENTO EN BACKGROUND
// ------------------------------------------------------------

async function procesarConsultaEnBackground(
  consultaId: string,
  prompt: string,
  equipoId: string,
  partidoId: string | null
) {
  // Cliente server-side fresco (el `after` corre en otro contexto
  // que el `supabase` browser).
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  try {
    // Marcar 'procesando'
    await sb
      .from("consultas")
      .update({ estado: "procesando" })
      .eq("id", consultaId);

    // ── Cargar contexto ─────────────────────────────────────
    const { data: partidosRaw, error: errPartidos } = partidoId
      ? await sb
          .from("partidos")
          .select(
            "id, rival, fecha, equipo_id, equipo_rival_id, " +
              "set1_ganado, set2_ganado, set3_ganado, set4_ganado, set5_ganado, " +
              "resultado_partido"
          )
          .eq("id", partidoId)
      : await sb
          .from("partidos")
          .select(
            "id, rival, fecha, equipo_id, equipo_rival_id, " +
              "set1_ganado, set2_ganado, set3_ganado, set4_ganado, set5_ganado, " +
              "resultado_partido"
          )
          .or(`equipo_id.eq.${equipoId},equipo_rival_id.eq.${equipoId}`)
          .order("fecha", { ascending: false });

    if (errPartidos) {
      throw new Error(`Error cargando partidos: ${errPartidos.message}`);
    }

    const partidos = (partidosRaw ?? []).map((p: any) => {
      const espejo = p.equipo_rival_id === equipoId;

      const flipGanado = (v: boolean | null | undefined): boolean | null => {
        if (v === null || v === undefined) return null;
        return espejo ? !v : v;
      };

      const flipResultado = (
        v: string | null | undefined
      ): "ganado" | "perdido" | null => {
        if (v === "ganado") return espejo ? "perdido" : "ganado";
        if (v === "perdido") return espejo ? "ganado" : "perdido";
        return null;
      };

      return {
        id: p.id as string,
        nombre: `vs ${p.rival ?? "?"} (${p.fecha ?? "?"})`,
        fecha: (p.fecha as string | null) ?? undefined,
        setGanados: [
          flipGanado(p.set1_ganado),
          flipGanado(p.set2_ganado),
          flipGanado(p.set3_ganado),
          flipGanado(p.set4_ganado),
          flipGanado(p.set5_ganado),
        ] as (boolean | null)[],
        resultado: flipResultado(p.resultado_partido),
      };
    });

    const { data: jeRaw } = await sb
      .from("jugador_equipo")
      .select("jugador_id")
      .eq("equipo_id", equipoId)
      .eq("activo", true);

    const idsJugadores = (jeRaw ?? []).map(
      (x: any) => x.jugador_id as string
    );

    let jugadores: JugadorParaResolver[] = [];
    if (idsJugadores.length > 0) {
      const { data: jugRaw } = await sb
        .from("jugadores")
        .select("id, nombre, apodo, numero")
        .in("id", idsJugadores);
      jugadores = (jugRaw ?? []).map((j: any) => ({
        id: j.id as string,
        nombre: j.nombre as string,
        apodo: (j.apodo as string | null) ?? null,
        numero: (j.numero as number | null) ?? null,
      }));
    }

    let acciones: AccionVisual[] = [];
    let puntos: PuntoConAcciones[] = [];

    if (partidoId) {
      const r = await cargarAccionesUnificadas(partidoId, equipoId);
      acciones = r.acciones;
      puntos = r.puntos;
    } else {
      const partidosIds = partidos.map((p) => p.id);
      if (partidosIds.length > 0) {
        const results = await Promise.all(
          partidosIds.map((pid) => cargarAccionesUnificadas(pid, equipoId))
        );
        acciones = results.flatMap((r) => r.acciones);
        puntos = results.flatMap((r) => r.puntos);
      }
    }

    // ── Ejecutar LLM ────────────────────────────────────────
    const resultado = await ejecutarConsultaLLM(prompt, {
      acciones,
      puntos,
      jugadores,
      partidos,
    });

    // ── Persistir según resultado ───────────────────────────
    if (resultado.tipo === "ok") {
      await sb
        .from("consultas")
        .update({
          estado: "completada",
          pipeline: resultado.debug.consultaLLM,
          respuesta: resultado, // ResultadoConsultaLLM completo
          intentos: resultado.debug.intentosTraduccion,
          fecha_completado: new Date().toISOString(),
        })
        .eq("id", consultaId);
    } else if (resultado.tipo === "error") {
      await sb
        .from("consultas")
        .update({
          estado: "fallida",
          error_tecnico: resultado.errorTecnico,
          intentos: resultado.intentos,
          fecha_completado: new Date().toISOString(),
        })
        .eq("id", consultaId);

      // Mantener el panel de consultas-fallidas
      try {
        await sb.from("consultas_fallidas").insert({
          equipo_id: equipoId,
          partido_id: partidoId,
          prompt,
          mensaje_usuario: resultado.mensaje,
          error_tecnico: resultado.errorTecnico,
          intentos: resultado.intentos,
        });
      } catch (e) {
        console.error("[consultar] Error persistiendo consulta fallida:", e);
      }
    } else if (
      resultado.tipo === "clarification" ||
      resultado.tipo === "ambiguo"
    ) {
      // El LLM respondió pidiendo aclaración o avisando jugador ambiguo.
      // NO es un error: es una respuesta útil. Guardamos el objeto
      // completo en `respuesta` para que el panel lo muestre como pregunta.
      await sb
        .from("consultas")
        .update({
          estado: "completada",
          respuesta: resultado,
          fecha_completado: new Date().toISOString(),
        })
        .eq("id", consultaId);
    }
  } catch (e) {
    console.error("[consultar] Error en background:", e);
    await sb
      .from("consultas")
      .update({
        estado: "fallida",
        error_tecnico:
          e instanceof Error ? e.stack ?? e.message : "desconocido",
        fecha_completado: new Date().toISOString(),
      })
      .eq("id", consultaId);
  }
}