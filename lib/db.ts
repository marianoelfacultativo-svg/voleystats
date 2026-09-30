// ============================================
// ACCESO A DATOS — 7 tablas de detalle
// Correlación: solo armado → ataque (pila FIFO)
// ============================================

import { supabase } from "./supabase";
import type { RotacionPunto } from "./rotaciones";
import { puntajeBase, ajustarPorContexto } from "./estadisticas";

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

  const sinId = <T extends { id?: string }>(arr: T[]) =>
    arr.map(({ id, ...rest }) => rest);

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
    const { error } = await supabase
      .from("ataques_detalle")
      .insert(sinId(data.ataques));
    if (error) return { ok: false, error: `ataques: ${error.message}` };
  }

  if (data.defensas.length > 0) {
    const { error } = await supabase
      .from("defensa_detalle")
      .insert(sinId(data.defensas));
    if (error) return { ok: false, error: `defensas: ${error.message}` };
  }

  if (data.bloqueos.length > 0) {
    const { error } = await supabase
      .from("bloqueo_detalle")
      .insert(sinId(data.bloqueos));
    if (error) return { ok: false, error: `bloqueos: ${error.message}` };
  }

  if (data.saques.length > 0) {
    const { error } = await supabase
      .from("saque_detalle")
      .insert(sinId(data.saques));
    if (error) return { ok: false, error: `saques: ${error.message}` };
  }

  if (data.recepciones.length > 0) {
    const { error } = await supabase
      .from("recepcion_detalle")
      .insert(sinId(data.recepciones));
    if (error) return { ok: false, error: `recepciones: ${error.message}` };
  }

  if (data.cambios.length > 0) {
    const { error } = await supabase
      .from("cambios_jugador")
      .insert(sinId(data.cambios));
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
// Correlación: armado → ataque (uno a uno)
// ============================================

export interface AccionDB {
  jugador_id: string;
  partido_id?: string;
  set_numero: number;
  punto_numero?: number;
  fundamento: string;
  valoracion: string;
  cantidad: number;
  puntaje?: number;
  puntajeBase?: number;
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

interface AccionIndividual {
  jugador_id: string;
  set_numero: number;
  punto_numero: number;
  fundamento: string;
  valoracion: string;
  created_at: string;
}

export async function cargarAccionesCompatibles(
  partidoId: string
): Promise<AccionDB[]> {
  const [ataques, defensas, bloqueos, saques, recepciones, armados] =
    await Promise.all([
      supabase
        .from("ataques_detalle")
        .select("jugador_id, set_numero, punto_numero, valoracion, created_at")
        .eq("partido_id", partidoId),
      supabase
        .from("defensa_detalle")
        .select(
          "jugador_id, set_numero, punto_numero, tipo_accion, resultado, created_at"
        )
        .eq("partido_id", partidoId),
      supabase
        .from("bloqueo_detalle")
        .select("jugador_id, set_numero, punto_numero, valoracion, created_at")
        .eq("partido_id", partidoId),
      supabase
        .from("saque_detalle")
        .select("jugador_id, set_numero, punto_numero, valoracion, created_at")
        .eq("partido_id", partidoId),
      supabase
        .from("recepcion_detalle")
        .select("jugador_id, set_numero, punto_numero, valoracion, created_at")
        .eq("partido_id", partidoId),
      supabase
        .from("armados_detalle")
        .select(
          "jugador_id, set_numero, punto_numero, calidad, zona_tendencia, created_at"
        )
        .eq("partido_id", partidoId),
    ]);

  const acciones: AccionIndividual[] = [];

  (ataques.data ?? []).forEach((a: any) => {
    if (!a.valoracion) return;
    acciones.push({
      jugador_id: a.jugador_id,
      set_numero: a.set_numero,
      punto_numero: a.punto_numero ?? 1,
      fundamento: "ataque",
      valoracion: a.valoracion,
      created_at: a.created_at ?? "",
    });
  });

  (defensas.data ?? []).forEach((d: any) => {
    const val = mapDefensa(d.tipo_accion, d.resultado);
    if (!val) return;
    acciones.push({
      jugador_id: d.jugador_id,
      set_numero: d.set_numero,
      punto_numero: d.punto_numero ?? 1,
      fundamento: "defensa",
      valoracion: val,
      created_at: d.created_at ?? "",
    });
  });

  (bloqueos.data ?? []).forEach((b: any) => {
    if (!b.valoracion) return;
    acciones.push({
      jugador_id: b.jugador_id,
      set_numero: b.set_numero,
      punto_numero: b.punto_numero ?? 1,
      fundamento: "bloqueo",
      valoracion: b.valoracion,
      created_at: b.created_at ?? "",
    });
  });

  (saques.data ?? []).forEach((s: any) => {
    if (!s.valoracion) return;
    acciones.push({
      jugador_id: s.jugador_id,
      set_numero: s.set_numero,
      punto_numero: s.punto_numero ?? 1,
      fundamento: "saque",
      valoracion: s.valoracion,
      created_at: s.created_at ?? "",
    });
  });

  (recepciones.data ?? []).forEach((r: any) => {
    const val = RECEPCION_NUM_A_STR[r.valoracion];
    if (!val) return;
    acciones.push({
      jugador_id: r.jugador_id,
      set_numero: r.set_numero,
      punto_numero: r.punto_numero ?? 1,
      fundamento: "recepcion",
      valoracion: val,
      created_at: r.created_at ?? "",
    });
  });

  (armados.data ?? []).forEach((a: any) => {
    const val = CALIDAD_A_STR[a.calidad];
    if (!val) return;
    acciones.push({
      jugador_id: a.jugador_id,
      set_numero: a.set_numero,
      punto_numero: a.punto_numero ?? 1,
      fundamento: "armados",
      valoracion: val,
      created_at: a.created_at ?? "",
    });
  });

  acciones.sort((a, b) => {
    if (a.set_numero !== b.set_numero) return a.set_numero - b.set_numero;
    if (a.punto_numero !== b.punto_numero)
      return a.punto_numero - b.punto_numero;
    return a.created_at.localeCompare(b.created_at);
  });

  const procesadas: AccionDB[] = [];
  let puntoAnterior = "";
  let pilaArmados: number[] = [];

  for (const acc of acciones) {
    const puntoKey = `${acc.set_numero}-${acc.punto_numero}`;
    if (puntoKey !== puntoAnterior) {
      pilaArmados = [];
      puntoAnterior = puntoKey;
    }

    const base = puntajeBase(acc.fundamento, acc.valoracion);
    if (base === null) continue;

    let final = base;

    if (acc.fundamento === "armados") {
      pilaArmados.push(base);
      final = base;
    } else if (acc.fundamento === "ataque") {
      if (pilaArmados.length > 0) {
        const armadoReciente = pilaArmados.pop()!;
        final = ajustarPorContexto(base, armadoReciente);
      } else {
        final = base;
      }
    } else {
      final = base;
    }

    procesadas.push({
      jugador_id: acc.jugador_id,
      partido_id: partidoId,
      set_numero: acc.set_numero,
      punto_numero: acc.punto_numero,
      fundamento: acc.fundamento,
      valoracion: acc.valoracion,
      cantidad: 1,
      puntaje: final,
      puntajeBase: base,
    });
  }

  (armados.data ?? []).forEach((a: any) => {
    if (a.zona_tendencia === null || a.zona_tendencia === undefined) return;
    procesadas.push({
      jugador_id: a.jugador_id,
      partido_id: partidoId,
      set_numero: a.set_numero,
      punto_numero: a.punto_numero ?? 1,
      fundamento: "tendencia",
      valoracion: `zona_${a.zona_tendencia}`,
      cantidad: 1,
      puntaje: 5,
      puntajeBase: 5,
    });
  });

  const agrupado = new Map<string, AccionDB>();
  for (const r of procesadas) {
    const pRed = Math.round((r.puntaje ?? 5) * 10) / 10;
    const k = `${r.jugador_id}|${r.set_numero}|${r.fundamento}|${r.valoracion}|${pRed}`;
    const existente = agrupado.get(k);
    if (existente) {
      existente.cantidad += 1;
    } else {
      agrupado.set(k, { ...r, puntaje: pRed });
    }
  }

  return Array.from(agrupado.values());
}