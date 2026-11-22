// ============================================================
// API ROUTE — POST /api/consultar
// ============================================================
// v2.1 (Bloque 3b): cuando la consulta falla, persiste en
//   `consultas_fallidas` para que el admin la vea.
//   El insert es "best-effort": si falla, igual devolvemos
//   la respuesta al usuario.
// ============================================================

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { cargarAccionesUnificadas } from "@/app/equipo/adaptadorUnificadoV2";
import type {
  AccionVisual,
  PuntoConAcciones,
} from "@/app/equipo/adaptadorUnificadoV2";
import type { JugadorParaResolver } from "@/lib/consultaAnalitica/resolverJugador";
import { ejecutarConsultaLLM } from "@/lib/consultaAnalitica/ejecutarConsultaLLM";

export const runtime = "nodejs";

interface Body {
  prompt?: string;
  partidoId?: string | null;
  equipoId?: string;
}

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

  try {
    // 2.a) Partidos
    const { data: partidosRaw, error: errPartidos } = partidoId
      ? await supabase
          .from("partidos")
          .select(
            "id, rival, fecha, equipo_id, equipo_rival_id, " +
            "set1_ganado, set2_ganado, set3_ganado, set4_ganado, set5_ganado, " +
            "resultado_partido"
          )
          .eq("id", partidoId)
      : await supabase
          .from("partidos")
          .select(
            "id, rival, fecha, equipo_id, equipo_rival_id, " +
            "set1_ganado, set2_ganado, set3_ganado, set4_ganado, set5_ganado, " +
            "resultado_partido"
          )
          .or(`equipo_id.eq.${equipoId},equipo_rival_id.eq.${equipoId}`)
          .order("fecha", { ascending: false });

    if (errPartidos) {
      return NextResponse.json(
        {
          tipo: "error",
          mensaje: `Error cargando partidos: ${errPartidos.message}`,
        },
        { status: 500 }
      );
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

    // 2.b) Jugadores
    const { data: jeRaw } = await supabase
      .from("jugador_equipo")
      .select("jugador_id")
      .eq("equipo_id", equipoId)
      .eq("activo", true);

    const idsJugadores = (jeRaw ?? []).map(
      (x: any) => x.jugador_id as string
    );

    let jugadores: JugadorParaResolver[] = [];
    if (idsJugadores.length > 0) {
      const { data: jugRaw } = await supabase
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

    // 2.c) Acciones + puntos
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

    // 3) Ejecutar consulta LLM (con retry del 3b)
    const resultado = await ejecutarConsultaLLM(prompt, {
      acciones,
      puntos,
      jugadores,
      partidos,
    });

    // 4) Si falló, guardar en Supabase (best-effort, no bloqueante)
    if (resultado.tipo === "error") {
      try {
        await supabase.from("consultas_fallidas").insert({
          equipo_id: equipoId,
          partido_id: partidoId,
          prompt: prompt,
          mensaje_usuario: resultado.mensaje,
          error_tecnico: resultado.errorTecnico,
          intentos: resultado.intentos,
        });
      } catch (e) {
        console.error(
          "[consultar] Error persistiendo consulta fallida:",
          e
        );
      }
    }

    return NextResponse.json(resultado);
  } catch (e) {
    return NextResponse.json(
      {
        tipo: "error",
        mensaje: `Error procesando la consulta: ${
          e instanceof Error ? e.message : "desconocido"
        }`,
        errorTecnico:
          e instanceof Error ? e.stack ?? e.message : "desconocido",
        promptOriginal: prompt,
        intentos: 0,
        pipelineIntentos: [],
      },
      { status: 500 }
    );
  }
}