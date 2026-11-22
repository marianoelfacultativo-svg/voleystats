// ============================================================
// GUARDAR EN SUPABASE V2 — DataEntryV2
// Lógica para guardar los puntos cerrados, calcular subtipos,
// generar aces en contra (modo espejo) y persistir el partido.
// ============================================================
//
// v2 (FASE 7.1): sets + resultado del partido.
// v2.1 (bug fix rotaciones): se elimina la llamada a
//   borrarPuntoV1DeTablas. Las tablas V1 (rotaciones,
//   cambios_jugador) están abandonadas por diseño y no hay nada
//   que borrar. Preparado para el DROP de tablas legacy.
// ============================================================

import {
  calcularErroresRival,
  calcularSubtiposAtaque,
  calcularSubtiposAtaqueRival,
  calcularSubtiposBloqueo,
  calcularSubtiposDefensa,
  calcularSubtiposSaque,
  type Situacion,
} from "@/lib/clasificacionV2";
import { supabase } from "@/lib/supabase";
import { guardarPuntoV2, type PuntoV2Data } from "@/lib/dbV2";

import { lineasAAcciones, type ContextoAnalitico } from "./helpersV2";
import { generarRecepcionesAceContra } from "./helpersEspejoV2";
import type {
  PartidoCerrado,
  PuntoCerrado,
  PosicionesFijasMap,
  SetsCerrados,
} from "./tiposV2";

// ------------------------------------------------------------
// PARÁMETROS
// ------------------------------------------------------------

interface ParametrosGuardado {
  partidoId: string;
  setActivo: number;
  listaPuntos: PuntoCerrado[];
  equipoId: string;
  equipoRivalId: string | null;
  posicionesFijas: PosicionesFijasMap;
  posicionesFijasRival: PosicionesFijasMap;
  modoEspejo: boolean;
  /** FASE 7.1 — sets cerrados con su ganador. */
  setsCerrados: SetsCerrados;
  /** FASE 7.1 — partido cerrado (si lo está). */
  partidoCerrado: PartidoCerrado | null;
}

// ------------------------------------------------------------
// RESULTADO
// ------------------------------------------------------------

export interface ResultadoGuardado {
  ok: boolean;
  errores: number;
  primerError: string;
}

// ------------------------------------------------------------
// GUARDADO DE PUNTOS
// ------------------------------------------------------------

export async function guardarPuntosEnSupabase({
  partidoId,
  setActivo,
  listaPuntos,
  equipoId,
  equipoRivalId,
  posicionesFijas,
  posicionesFijasRival,
  modoEspejo,
  setsCerrados,
  partidoCerrado,
}: ParametrosGuardado): Promise<ResultadoGuardado> {
  let errores = 0;
  let primerError = "";

  // ---------- 1. Guardar cada punto ----------
  for (const pc of listaPuntos) {
    const puntoData: PuntoV2Data = {
      set_numero: pc.set_numero,
      punto_numero: pc.numero,
      saque_equipo: pc.saqueInicial,
      situacion: pc.situacion,
      ganador: pc.ganador,
      rotacion: pc.rotacion as unknown as Record<string, unknown>,
      liberos: pc.liberos as unknown as Record<string, unknown>[],
      cambios: pc.cambios as unknown as Record<string, unknown>[],
      posiciones_punto: pc.posicionesPunto,
      equipo_id:
        pc.equipoId ??
        (pc.saqueInicial === "propio" ? equipoId : equipoRivalId),
      estado_rival: (pc.estadoRival ?? null) as Record<string, unknown> | null,
    };

    const lineasConSaque = calcularSubtiposSaque(pc.lineas);
    const lineasConAtaqueRival = calcularSubtiposAtaqueRival(lineasConSaque);
    const lineasConBloqueo = calcularSubtiposBloqueo(lineasConAtaqueRival);
    const lineasConDefensa = calcularSubtiposDefensa(lineasConBloqueo);
    const lineasConAtaque = calcularSubtiposAtaque(
      lineasConDefensa,
      pc.ganador
    );
    const lineasConErroresRival = calcularErroresRival(lineasConAtaque);

    // ---------- Contexto analítico para calcular campos extra ----------
    const situacionRival: Situacion =
      pc.saqueInicial === "propio" ? "recepcion" : "saque";

    const contexto: ContextoAnalitico = {
      rotacionPropia: pc.rotacion,
      rotacionRival: pc.estadoRival?.rotacion ?? null,
      situacionPropia: pc.situacion,
      situacionRival,
      equipoId,
      equipoRivalId,
    };

    const acciones = lineasAAcciones(lineasConErroresRival, contexto);

    // ---------- MODO ESPEJO: recepciones sintéticas de ace_contra ----------
    generarRecepcionesAceContra({
      pc,
      lineas: lineasConErroresRival,
      acciones,
      equipoId,
      equipoRivalId,
      posicionesFijas,
      posicionesFijasRival,
      modoEspejo,
    });

    const res = await guardarPuntoV2(partidoId, puntoData, acciones);
    if (!res.ok) {
      errores++;
      if (!primerError) primerError = res.error ?? "desconocido";
      continue;
    }
    // (v2.1) Ya NO se llama a borrarPuntoV1DeTablas. Las tablas V1
    // (rotaciones, cambios_jugador) están abandonadas por diseño.
  }

  // ---------- 2. Actualizar partidos (sets + resultado) ----------
  const resPartido = await guardarSetsYPartidoEnPartidos({
    partidoId,
    equipoId,
    setsCerrados,
    partidoCerrado,
  });

  if (!resPartido.ok) {
    errores++;
    if (!primerError) {
      primerError = `actualizando partido: ${
        resPartido.error ?? "desconocido"
      }`;
    }
  }

  return {
    ok: errores === 0,
    errores,
    primerError,
  };
}

// ------------------------------------------------------------
// GUARDADO DE SETS + RESULTADO DEL PARTIDO
// ------------------------------------------------------------

interface ParametrosPartido {
  partidoId: string;
  equipoId: string;
  setsCerrados: SetsCerrados;
  partidoCerrado: PartidoCerrado | null;
}

async function guardarSetsYPartidoEnPartidos({
  partidoId,
  equipoId,
  setsCerrados,
  partidoCerrado,
}: ParametrosPartido): Promise<{ ok: boolean; error?: string }> {
  // ¿El equipo actual es el rival del partido?
  // Si sí, hay que invertir los flags antes de guardarlos en la DB,
  // porque `partidos.setN_ganado` y `resultado_partido` se guardan
  // desde la perspectiva de `partidos.equipo_id`.
  const { data: partidoData, error: errPartido } = await supabase
    .from("partidos")
    .select("equipo_id, equipo_rival_id")
    .eq("id", partidoId)
    .maybeSingle();

  if (errPartido) {
    return { ok: false, error: errPartido.message };
  }

  const espejoPartido = partidoData?.equipo_rival_id === equipoId;

  const updates: Record<string, unknown> = {};

  // ---------- Sets ----------
  for (const [numStr, sc] of Object.entries(setsCerrados)) {
    const num = parseInt(numStr, 10);
    if (num < 1 || num > 5) continue;
    const ganoPropio = sc.ganador === "propio";
    updates[`set${num}_ganado`] = espejoPartido ? !ganoPropio : ganoPropio;
  }

  // ---------- Resultado del partido ----------
  if (partidoCerrado) {
    const ganoPropio = partidoCerrado.ganador === "propio";
    let resultado: "ganado" | "perdido" = ganoPropio ? "ganado" : "perdido";
    if (espejoPartido) {
      resultado = resultado === "ganado" ? "perdido" : "ganado";
    }
    updates.resultado_partido = resultado;
  }

  if (Object.keys(updates).length === 0) {
    return { ok: true };
  }

  const { error: errUpdate } = await supabase
    .from("partidos")
    .update(updates)
    .eq("id", partidoId);

  if (errUpdate) {
    return { ok: false, error: errUpdate.message };
  }

  return { ok: true };
}