// ============================================================
// ADAPTADOR UNIFICADO V2
// Carga TODAS las acciones de un partido con sus 12 campos
// analíticos. Es la única fuente de datos para el 3D unificado.
// ============================================================

import { supabase } from "@/lib/supabase";
import type { AccionV2Row } from "@/lib/dbV2";

// ------------------------------------------------------------
// TIPOS
// ------------------------------------------------------------

export interface DesvioVisual {
  celda: string;
  mini: string | null;
  jugador_id?: string | null;
}

export interface AccionVisual {
  id: string;
  partido_id: string;
  set_numero: number;
  punto_numero: number;
  orden: number;

  tipo: string;
  subtipo: string | number | null;
  es_rival: boolean;
  jugador_id: string | null;
  lado: "propio" | "rival";
  equipo_id: string | null;

  origen_celda: string | null;
  origen_mini: string | null;
  destino_celda: string | null;
  destino_mini: string | null;
  desvios: DesvioVisual[];

  variante: string | null;
  tipo_saque: string | null;
  velocidad: number | null;
  x2: boolean;
  oculta: boolean;

  posicion_inicial_celda: string | null;
  posicion_inicial_mini: string | null;

  // ---- Analíticos ----
  es_error: boolean;
  zona_origen: number | null;
  zona_destino: number | null;
  rotacion_numero: number | null;
  rol_jugador: string | null;
  zona_jugador: number | null;
  origen_x: number | null;
  origen_y: number | null;
  destino_x: number | null;
  destino_y: number | null;
  posicion_inicial_x: number | null;
  posicion_inicial_y: number | null;
}

export interface PuntoConAcciones {
  set_numero: number;
  punto_numero: number;
  acciones: AccionVisual[];
}

export interface CargaUnificadaResult {
  acciones: AccionVisual[];
  puntos: PuntoConAcciones[];
}

// ------------------------------------------------------------
// CARGA
// ------------------------------------------------------------

export async function cargarAccionesUnificadas(
  partidoId: string,
  equipoId?: string
): Promise<CargaUnificadaResult> {
  if (!partidoId) return { acciones: [], puntos: [] };

  let q = supabase
    .from("acciones_v2")
    .select("*")
    .eq("partido_id", partidoId)
    .order("set_numero", { ascending: true })
    .order("punto_numero", { ascending: true })
    .order("orden", { ascending: true });

  if (equipoId) q = q.eq("equipo_id", equipoId);

  const { data, error } = await q;
  if (error || !data) return { acciones: [], puntos: [] };

  const acciones: AccionVisual[] = (data as AccionV2Row[]).map((a) => ({
    id: a.id,
    partido_id: a.partido_id,
    set_numero: a.set_numero,
    punto_numero: a.punto_numero,
    orden: a.orden,
    tipo: a.tipo,
    subtipo: a.subtipo ?? null,
    es_rival: a.es_rival,
    jugador_id: a.jugador_id ?? null,
    lado: a.lado,
    equipo_id: a.equipo_id ?? null,
    origen_celda: a.origen_celda ?? null,
    origen_mini: a.origen_mini ?? null,
    destino_celda: a.destino_celda ?? null,
    destino_mini: a.destino_mini ?? null,
    desvios: (a.desvios ?? []).map((d) => ({
      celda: d.celda,
      mini: d.mini,
      jugador_id: d.jugador_id ?? null,
    })),
    variante: a.variante ?? null,
    tipo_saque: a.tipo_saque ?? null,
    velocidad: a.velocidad ?? null,
    x2: a.x2 ?? false,
    oculta: a.oculta ?? false,
    posicion_inicial_celda: a.posicion_inicial_celda ?? null,
    posicion_inicial_mini: a.posicion_inicial_mini ?? null,
    es_error: a.es_error ?? false,
    zona_origen: a.zona_origen ?? null,
    zona_destino: a.zona_destino ?? null,
    rotacion_numero: a.rotacion_numero ?? null,
    rol_jugador: a.rol_jugador ?? null,
    zona_jugador: a.zona_jugador ?? null,
    origen_x: a.origen_x ?? null,
    origen_y: a.origen_y ?? null,
    destino_x: a.destino_x ?? null,
    destino_y: a.destino_y ?? null,
    posicion_inicial_x: a.posicion_inicial_x ?? null,
    posicion_inicial_y: a.posicion_inicial_y ?? null,
  }));

  const puntosMap = new Map<string, PuntoConAcciones>();
  for (const a of acciones) {
    const k = `${a.set_numero}-${a.punto_numero}`;
    let p = puntosMap.get(k);
    if (!p) {
      p = {
        set_numero: a.set_numero,
        punto_numero: a.punto_numero,
        acciones: [],
      };
      puntosMap.set(k, p);
    }
    p.acciones.push(a);
  }

  const puntos = Array.from(puntosMap.values()).sort((a, b) => {
    if (a.set_numero !== b.set_numero) return a.set_numero - b.set_numero;
    return a.punto_numero - b.punto_numero;
  });

  return { acciones, puntos };
}

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

/**
 * Color por tipo de acción (consistente con el 3D de fundamentos).
 */
export function colorPorTipo(tipo: string, esRival: boolean): string {
  if (esRival) return "#94a3b8";
  switch (tipo) {
    case "saque":
      return "#2563eb";
    case "recepcion":
      return "#16a34a";
    case "armado":
      return "#8b5cf6";
    case "ataque":
      return "#dc2626";
    case "bloqueo":
      return "#ea580c";
    case "defensa":
      return "#0891b2";
    case "libre":
      return "#a16207";
    case "roce-red":
      return "#0f172a";
    default:
      return "#64748b";
  }
}

/**
 * Etiqueta corta para mostrar en tooltip / lista.
 */
export function etiquetaAccion(a: AccionVisual): string {
  const st = a.subtipo !== null && a.subtipo !== undefined ? String(a.subtipo) : "";
  if (!st) return a.tipo;
  return `${a.tipo} · ${st}`;
}