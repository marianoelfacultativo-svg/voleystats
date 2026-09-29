// ============================================
// ACCESO A DATOS — 7 tablas de detalle
// ============================================

import { supabase } from "./supabase";
import type { RotacionPunto } from "./rotaciones";

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
  tipo: "parado";
  celda_accion: string | null;
  mini_accion: string | null;
  tipo_accion: "defensa" | "toque" | "cobertura" | null;
  resultado: "salvada" | "error" | null;
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

  for (const t of tablas) {
    const { error } = await supabase
      .from(t)
      .delete()
      .eq("partido_id", partidoId);
    if (error) return { ok: false, error: `Error borrando ${t}: ${error.message}` };
  }

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

  if (data.ataques.length > 0) {
    const { error } = await supabase.from("ataques_detalle").insert(data.ataques);
    if (error) return { ok: false, error: `ataques: ${error.message}` };
  }

  if (data.defensas.length > 0) {
    const { error } = await supabase.from("defensa_detalle").insert(data.defensas);
    if (error) return { ok: false, error: `defensas: ${error.message}` };
  }

  if (data.bloqueos.length > 0) {
    const { error } = await supabase.from("bloqueo_detalle").insert(data.bloqueos);
    if (error) return { ok: false, error: `bloqueos: ${error.message}` };
  }

  if (data.saques.length > 0) {
    const { error } = await supabase.from("saque_detalle").insert(data.saques);
    if (error) return { ok: false, error: `saques: ${error.message}` };
  }

  if (data.recepciones.length > 0) {
    const { error } = await supabase
      .from("recepcion_detalle")
      .insert(data.recepciones);
    if (error) return { ok: false, error: `recepciones: ${error.message}` };
  }

  if (data.cambios.length > 0) {
    const { error } = await supabase.from("cambios_jugador").insert(data.cambios);
    if (error) return { ok: false, error: `cambios: ${error.message}` };
  }

  return { ok: true };
}

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

// ============================================
// ADAPTADOR: tablas nuevas → formato AccionDB
// ============================================

export interface AccionDB {
  jugador_id: string;
  partido_id?: string;
  set_numero: number;
  fundamento: string;
  valoracion: string;
  cantidad: number;
}

const RECEPCION_NUM_A_STR: Record<number, string> = {
  1: "ace_contra",
  2: "3x_negativa",
  3: "2x_negativa",
  4: "negativa",
  5: "positiva",
  6: "2x_positiva",
};

const CALIDAD_A_STR: Record<number, string> = {
  1: "horrible",
  2: "malo",
  3: "flojo",
  4: "correcto",
  5: "perfecto",
  6: "genial",
};

function mapDefensa(
  tipo: string | null,
  resultado: string | null
): string | null {
  if (!tipo || !resultado) return null;
  if (tipo === "toque") {
    return resultado === "salvada" ? "toque_positiva" : "toque_negativa";
  }
  if (tipo === "defensa") {
    return resultado === "salvada" ? "gran_def" : "error_def";
  }
  if (tipo === "cobertura") {
    return resultado === "salvada"
      ? "cobertura_positiva"
      : "cobertura_negativa";
  }
  return null;
}

export async function cargarAccionesCompatibles(
  partidoId: string
): Promise<AccionDB[]> {
  const [ataques, defensas, bloqueos, saques, recepciones, armados] =
    await Promise.all([
      supabase
        .from("ataques_detalle")
        .select("jugador_id, set_numero, valoracion")
        .eq("partido_id", partidoId),
      supabase
        .from("defensa_detalle")
        .select("jugador_id, set_numero, tipo_accion, resultado")
        .eq("partido_id", partidoId),
      supabase
        .from("bloqueo_detalle")
        .select("jugador_id, set_numero, valoracion")
        .eq("partido_id", partidoId),
      supabase
        .from("saque_detalle")
        .select("jugador_id, set_numero, valoracion")
        .eq("partido_id", partidoId),
      supabase
        .from("recepcion_detalle")
        .select("jugador_id, set_numero, valoracion")
        .eq("partido_id", partidoId),
      supabase
        .from("armados_detalle")
        .select("jugador_id, set_numero, calidad, zona_tendencia")
        .eq("partido_id", partidoId),
    ]);

  const bucket = new Map<string, AccionDB>();
  const add = (
    jugador_id: string | null,
    set_numero: number,
    fundamento: string,
    valoracion: string
  ) => {
    if (!jugador_id) return;
    const k = `${jugador_id}|${set_numero}|${fundamento}|${valoracion}`;
    const existing = bucket.get(k);
    if (existing) {
      existing.cantidad += 1;
    } else {
      bucket.set(k, {
        jugador_id,
        partido_id: partidoId,
        set_numero,
        fundamento,
        valoracion,
        cantidad: 1,
      });
    }
  };

  (ataques.data ?? []).forEach((a: any) => {
    if (!a.valoracion) return;
    add(a.jugador_id, a.set_numero, "ataque", a.valoracion);
  });

  (defensas.data ?? []).forEach((d: any) => {
    const val = mapDefensa(d.tipo_accion, d.resultado);
    if (!val) return;
    add(d.jugador_id, d.set_numero, "defensa", val);
  });

  (bloqueos.data ?? []).forEach((b: any) => {
    if (!b.valoracion) return;
    add(b.jugador_id, b.set_numero, "bloqueo", b.valoracion);
  });

  (saques.data ?? []).forEach((s: any) => {
    if (!s.valoracion) return;
    add(s.jugador_id, s.set_numero, "saque", s.valoracion);
  });

  (recepciones.data ?? []).forEach((r: any) => {
    const val = RECEPCION_NUM_A_STR[r.valoracion];
    if (!val) return;
    add(r.jugador_id, r.set_numero, "recepcion", val);
  });

  (armados.data ?? []).forEach((a: any) => {
    const valCalidad = CALIDAD_A_STR[a.calidad];
    if (valCalidad) {
      add(a.jugador_id, a.set_numero, "armados", valCalidad);
    }
    if (a.zona_tendencia !== null && a.zona_tendencia !== undefined) {
      add(a.jugador_id, a.set_numero, "tendencia", `zona_${a.zona_tendencia}`);
    }
  });

  return Array.from(bucket.values());
}