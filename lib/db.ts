// ============================================
// ACCESO A DATOS — 7 tablas de detalle
// ============================================

import { supabase } from "./supabase";
import type { RotacionPunto } from "./rotaciones";

// ------------------------------------------------------------
// TIPOS
// ------------------------------------------------------------
export interface AtaqueRow {
  id?: string;
  partido_id: string;
  jugador_id: string;
  set_numero: number;
  punto_numero: number;
  origen_celda: string;
  origen_mini: string | null;
  destino_celda: string;
  destino_mini: string | null;
  desvios: { celda: string; mini: string | null }[];
  zona: number | null;
  valoracion: "punto" | "error" | "neutro";
}

export interface DefensaRow {
  id?: string;
  partido_id: string;
  jugador_id: string;
  set_numero: number;
  punto_numero: number;
  celda: string;
  mini: string | null;
  rol: "L" | "A" | "O" | "Pd" | "Pz" | "C";
  tipo: "parado" | "salvada" | "error";
}

export interface BloqueoRow {
  id?: string;
  partido_id: string;
  jugador_id: string;
  set_numero: number;
  punto_numero: number;
  posicion_x: number;
  zona: number | null;
  valoracion:
    | "punto"
    | "positivo_mas"
    | "positivo"
    | "use_rival"
    | "red"
    | "filtrada";
}

export interface SaqueRow {
  id?: string;
  partido_id: string;
  jugador_id: string;
  set_numero: number;
  punto_numero: number;
  origen_celda: string;
  destino_celda: string;
  destino_mini: string | null;
  tipo: "flotado" | "potencia" | null;
  valoracion: "ace" | "positivo_mas" | "positivo" | "neutro" | "negativo";
}

export interface RecepcionRow {
  id?: string;
  partido_id: string;
  jugador_id: string;
  set_numero: number;
  punto_numero: number;
  origen_celda: string;
  origen_mini: string | null;
  destino_celda: string;
  destino_mini: string | null;
  valoracion: number;
}

export interface CambioRow {
  id?: string;
  partido_id: string;
  set_numero: number;
  punto_numero: number;
  entra_id: string;
  sale_id: string;
  rol: string | null;
}

// ------------------------------------------------------------
// GUARDAR — rota todas las tablas de un partido (borra + inserta)
// ------------------------------------------------------------
export async function guardarDetalles(
  partidoId: string,
  data: {
    rotaciones: (RotacionPunto & { partido_id: string })[];
    ataques: AtaqueRow[];
    defensas: DefensaRow[];
    bloqueos: BloqueoRow[];
    saques: SaqueRow[];
    recepciones: RecepcionRow[];
    cambios: CambioRow[];
  }
): Promise<{ ok: boolean; error?: string }> {
  const tablas = [
    "rotaciones",
    "ataques_detalle",
    "defensa_detalle",
    "bloqueo_detalle",
    "saque_detalle",
    "recepcion_detalle",
    "cambios_jugador",
  ] as const;

  // Borrar todo lo del partido
  for (const t of tablas) {
    const { error } = await supabase
      .from(t)
      .delete()
      .eq("partido_id", partidoId);
    if (error) return { ok: false, error: `Error borrando ${t}: ${error.message}` };
  }

  // Insertar rotaciones
  if (data.rotaciones.length > 0) {
    const filas = data.rotaciones.map((r) => ({
      partido_id: r.partido_id,
      set_numero: r.set_numero,
      punto_numero: r.punto_numero,
      saque_equipo: r.saque_equipo,
      posiciones: r.posiciones,
      liberos: r.liberos,
    }));
    const { error } = await supabase.from("rotaciones").insert(filas);
    if (error) return { ok: false, error: `rotaciones: ${error.message}` };
  }

  // Insertar ataques
  if (data.ataques.length > 0) {
    const { error } = await supabase.from("ataques_detalle").insert(data.ataques);
    if (error) return { ok: false, error: `ataques: ${error.message}` };
  }

  // Defensas
  if (data.defensas.length > 0) {
    const { error } = await supabase.from("defensa_detalle").insert(data.defensas);
    if (error) return { ok: false, error: `defensas: ${error.message}` };
  }

  // Bloqueos
  if (data.bloqueos.length > 0) {
    const { error } = await supabase.from("bloqueo_detalle").insert(data.bloqueos);
    if (error) return { ok: false, error: `bloqueos: ${error.message}` };
  }

  // Saques
  if (data.saques.length > 0) {
    const { error } = await supabase.from("saque_detalle").insert(data.saques);
    if (error) return { ok: false, error: `saques: ${error.message}` };
  }

  // Recepciones
  if (data.recepciones.length > 0) {
    const { error } = await supabase
      .from("recepcion_detalle")
      .insert(data.recepciones);
    if (error) return { ok: false, error: `recepciones: ${error.message}` };
  }

  // Cambios
  if (data.cambios.length > 0) {
    const { error } = await supabase.from("cambios_jugador").insert(data.cambios);
    if (error) return { ok: false, error: `cambios: ${error.message}` };
  }

  return { ok: true };
}

// ------------------------------------------------------------
// CARGAR — trae todo de un partido
// ------------------------------------------------------------
export async function cargarDetalles(partidoId: string) {
  const [
    rotaciones,
    ataques,
    defensas,
    bloqueos,
    saques,
    recepciones,
    cambios,
  ] = await Promise.all([
    supabase.from("rotaciones").select("*").eq("partido_id", partidoId),
    supabase
      .from("ataques_detalle")
      .select("*")
      .eq("partido_id", partidoId)
      .order("created_at"),
    supabase
      .from("defensa_detalle")
      .select("*")
      .eq("partido_id", partidoId)
      .order("created_at"),
    supabase
      .from("bloqueo_detalle")
      .select("*")
      .eq("partido_id", partidoId)
      .order("created_at"),
    supabase
      .from("saque_detalle")
      .select("*")
      .eq("partido_id", partidoId)
      .order("created_at"),
    supabase
      .from("recepcion_detalle")
      .select("*")
      .eq("partido_id", partidoId)
      .order("created_at"),
    supabase
      .from("cambios_jugador")
      .select("*")
      .eq("partido_id", partidoId)
      .order("created_at"),
  ]);

  return {
    rotaciones: rotaciones.data ?? [],
    ataques: (ataques.data ?? []) as AtaqueRow[],
    defensas: (defensas.data ?? []) as DefensaRow[],
    bloqueos: (bloqueos.data ?? []) as BloqueoRow[],
    saques: (saques.data ?? []) as SaqueRow[],
    recepciones: (recepciones.data ?? []) as RecepcionRow[],
    cambios: (cambios.data ?? []) as CambioRow[],
  };
}

// ------------------------------------------------------------
// BORRAR todo lo de un partido en las 7 tablas
// ------------------------------------------------------------
export async function borrarDetalles(partidoId: string) {
  const tablas = [
    "rotaciones",
    "ataques_detalle",
    "defensa_detalle",
    "bloqueo_detalle",
    "saque_detalle",
    "recepcion_detalle",
    "cambios_jugador",
  ] as const;
  for (const t of tablas) {
    await supabase.from(t).delete().eq("partido_id", partidoId);
  }
}
