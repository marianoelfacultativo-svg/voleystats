// ============================================================
// ACCESO A DATOS V2 — puntos_v2 + acciones_v2
// Puente entre la consola V2 y Supabase
// ============================================================

import { supabase } from "./supabase";

// ------------------------------------------------------------
// TIPOS
// ------------------------------------------------------------

export type LadoV2 = "propio" | "rival";
export type SituacionV2 = "saque" | "recepcion";

export interface DesvioV2 {
  celda: string;
  mini: string | null;
}

/** Datos crudos de un punto (lo que va a la tabla puntos_v2). */
export interface PuntoV2Data {
  set_numero: number;
  punto_numero: number;
  saque_equipo: LadoV2;
  situacion: SituacionV2;
  ganador: LadoV2 | null;
  rotacion: Record<string, unknown> | null;
  liberos: Record<string, unknown>[];
  cambios: Record<string, unknown>[];
  posiciones_punto: Record<string, string>;
}

/** Datos crudos de una acción (lo que va a acciones_v2). */
export interface AccionV2Data {
  orden: number;
  tipo: string;                // "saque" | "recepcion" | "armado" | ...
  subtipo?: string | number | null;
  es_rival: boolean;
  jugador_id?: string | null;
  lado: LadoV2;
  origen_celda: string | null;
  origen_mini: string | null;
  destino_celda: string | null;
  destino_mini: string | null;
  desvios: DesvioV2[];
  zona: number | null;
}

/** Fila leída de puntos_v2. */
export interface PuntoV2Row extends PuntoV2Data {
  id: string;
  partido_id: string;
  created_at: string;
}

/** Fila leída de acciones_v2. */
export interface AccionV2Row extends AccionV2Data {
  id: string;
  punto_id: string;
  partido_id: string;
  set_numero: number;
  punto_numero: number;
  created_at: string;
}

/** Punto con sus acciones, listo para el motor de stats / reconstrucción. */
export interface PuntoV2Completo extends PuntoV2Row {
  acciones: AccionV2Row[];
}

// ------------------------------------------------------------
// 1. GUARDAR PUNTO + ACCIONES
// ------------------------------------------------------------

/**
 * Inserta el punto en `puntos_v2` y todas sus acciones en `acciones_v2`.
 *
 * Si falla la inserción de acciones, borra el punto huérfano antes de
 * devolver el error (rollback manual, Supabase no da transacciones acá).
 *
 * @returns `{ ok: true, puntoId }` si todo salió bien.
 */
export async function guardarPuntoV2(
  partidoId: string,
  punto: PuntoV2Data,
  acciones: AccionV2Data[]
): Promise<{ ok: boolean; puntoId?: string; error?: string }> {
  if (!partidoId) return { ok: false, error: "Falta partidoId" };

  const filaPunto = {
    partido_id: partidoId,
    set_numero: punto.set_numero,
    punto_numero: punto.punto_numero,
    saque_equipo: punto.saque_equipo,
    situacion: punto.situacion,
    ganador: punto.ganador,
    rotacion: punto.rotacion,
    liberos: punto.liberos,
    cambios: punto.cambios,
    posiciones_punto: punto.posiciones_punto,
  };

  const { data: inserted, error: errPunto } = await supabase
    .from("puntos_v2")
    .insert([filaPunto])
    .select("id")
    .single();

  if (errPunto || !inserted) {
    return {
      ok: false,
      error: `puntos_v2: ${errPunto?.message ?? "sin id devuelto"}`,
    };
  }

  const puntoId = inserted.id as string;

  if (acciones.length > 0) {
    const filasAcciones = acciones.map((a) => ({
      punto_id: puntoId,
      partido_id: partidoId,
      set_numero: punto.set_numero,
      punto_numero: punto.punto_numero,
      orden: a.orden,
      tipo: a.tipo,
      subtipo: a.subtipo ?? null,
      es_rival: a.es_rival,
      jugador_id: a.jugador_id ?? null,
      lado: a.lado,
      origen_celda: a.origen_celda,
      origen_mini: a.origen_mini,
      destino_celda: a.destino_celda,
      destino_mini: a.destino_mini,
      desvios: a.desvios ?? [],
      zona: a.zona ?? null,
    }));

    const { error: errAcc } = await supabase
      .from("acciones_v2")
      .insert(filasAcciones);

    if (errAcc) {
      // Rollback manual: no dejar el punto huérfano en puntos_v2
      await supabase.from("puntos_v2").delete().eq("id", puntoId);
      return { ok: false, error: `acciones_v2: ${errAcc.message}` };
    }
  }

  return { ok: true, puntoId };
}

// ------------------------------------------------------------
// 2. CARGAR TODOS LOS PUNTOS DEL PARTIDO
// ------------------------------------------------------------

/**
 * Trae todos los puntos del partido, ordenados por set y punto, cada uno
 * con su lista de acciones (ordenadas por `orden`).
 */
export async function cargarPuntosV2(
  partidoId: string
): Promise<{ ok: boolean; puntos?: PuntoV2Completo[]; error?: string }> {
  if (!partidoId) return { ok: false, error: "Falta partidoId" };

  const { data: puntos, error: errPuntos } = await supabase
    .from("puntos_v2")
    .select("*")
    .eq("partido_id", partidoId)
    .order("set_numero", { ascending: true })
    .order("punto_numero", { ascending: true });

  if (errPuntos) {
    return { ok: false, error: `puntos_v2: ${errPuntos.message}` };
  }

  const { data: acciones, error: errAcciones } = await supabase
    .from("acciones_v2")
    .select("*")
    .eq("partido_id", partidoId)
    .order("orden", { ascending: true });

  if (errAcciones) {
    return { ok: false, error: `acciones_v2: ${errAcciones.message}` };
  }

  // Agrupar acciones por punto_id
  const accionesPorPunto = new Map<string, AccionV2Row[]>();
  for (const a of (acciones ?? []) as AccionV2Row[]) {
    const lista = accionesPorPunto.get(a.punto_id) ?? [];
    lista.push(a);
    accionesPorPunto.set(a.punto_id, lista);
  }

  const resultado: PuntoV2Completo[] = ((puntos ?? []) as PuntoV2Row[]).map(
    (p) => ({
      ...p,
      acciones: accionesPorPunto.get(p.id) ?? [],
    })
  );

  return { ok: true, puntos: resultado };
}

// ------------------------------------------------------------
// 3. BORRAR UN PUNTO
// ------------------------------------------------------------

/**
 * Borra un punto y todas sus acciones asociadas.
 * Primero las acciones (FK), después el punto.
 */
export async function borrarPuntoV2(
  puntoId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!puntoId) return { ok: false, error: "Falta puntoId" };

  const { error: errAcc } = await supabase
    .from("acciones_v2")
    .delete()
    .eq("punto_id", puntoId);
  if (errAcc) return { ok: false, error: `acciones_v2: ${errAcc.message}` };

  const { error: errPunto } = await supabase
    .from("puntos_v2")
    .delete()
    .eq("id", puntoId);
  if (errPunto) return { ok: false, error: `puntos_v2: ${errPunto.message}` };

  return { ok: true };
}

// ------------------------------------------------------------
// 4. LIMPIAR TODO EL PARTIDO (puntos + acciones + rotaciones)
// ------------------------------------------------------------

/**
 * Limpia todas las tablas V2 del partido.
 * Orden: acciones → puntos → rotaciones (por si hay FK).
 */
export async function borrarTodosV2(
  partidoId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!partidoId) return { ok: false, error: "Falta partidoId" };

  const { error: errAcc } = await supabase
    .from("acciones_v2")
    .delete()
    .eq("partido_id", partidoId);
  if (errAcc) return { ok: false, error: `acciones_v2: ${errAcc.message}` };

  const { error: errPuntos } = await supabase
    .from("puntos_v2")
    .delete()
    .eq("partido_id", partidoId);
  if (errPuntos) {
    return { ok: false, error: `puntos_v2: ${errPuntos.message}` };
  }

  const { error: errRot } = await supabase
    .from("rotaciones_v2")
    .delete()
    .eq("partido_id", partidoId);
  if (errRot) {
    return { ok: false, error: `rotaciones_v2: ${errRot.message}` };
  }

  return { ok: true };
}