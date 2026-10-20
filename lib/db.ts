// ============================================
// ACCESO A DATOS — 7 tablas de detalle + V2
// Correlación: cadena lineal + armado → ataque extra
// ============================================

import { supabase } from "./supabase";
import { cargarPuntosV2 } from "./dbV2";
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

// ============================================================
// BORRAR UN PUNTO ESPECÍFICO DE V1 (por partido + set + punto)
// ============================================================

export async function borrarPuntoV1DeTablas(
  partidoId: string,
  setNumero: number,
  puntoNumero: number
): Promise<{ ok: boolean; error?: string }> {
  if (!partidoId) return { ok: false, error: "Falta partidoId" };

  const tablas = [
    "armados_detalle",
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
      .eq("partido_id", partidoId)
      .eq("set_numero", setNumero)
      .eq("punto_numero", puntoNumero);
    if (error) {
      return { ok: false, error: `${t}: ${error.message}` };
    }
  }

  return { ok: true };
}

// ============================================
// ADAPTADOR: tablas nuevas → formato AccionDB
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

// ------------------------------------------------------------
// TRADUCCIÓN V2 → V1 (para que el motor de stats las entienda)
// ------------------------------------------------------------

function fundamentoV2aV1(tipo: string): string | null {
  switch (tipo) {
    case "saque":
      return "saque";
    case "recepcion":
      return "recepcion";
    case "armado":
      return "armados";
    case "ataque":
      return "ataque";
    case "bloqueo":
      return "bloqueo";
    case "defensa":
      return "defensa";
    default:
      return null;
  }
}

function valoracionV2aV1(
  tipo: string,
  subtipo: string | number | null
): string | null {
  if (subtipo === null || subtipo === undefined) return null;

  if (tipo === "saque") {
    const validos = [
      "ace",
      "positivo_mas",
      "positivo",
      "neutro",
      "negativo",
    ];
    return typeof subtipo === "string" && validos.includes(subtipo)
      ? subtipo
      : null;
  }

  if (tipo === "recepcion") {
    const n = typeof subtipo === "number" ? subtipo : parseInt(String(subtipo));
    return RECEPCION_NUM_A_STR[n] ?? null;
  }

  if (tipo === "armado") {
    if (subtipo === "R") return null;
    const n = typeof subtipo === "number" ? subtipo : parseInt(String(subtipo));
    return CALIDAD_A_STR[n] ?? null;
  }

  if (tipo === "ataque") {
    let s = String(subtipo);
    if (s.startsWith("toque:")) s = s.slice(6);
    if (s === "punto" || s === "error" || s === "neutro") return s;
    return null;
  }

  if (tipo === "bloqueo") {
    const validos = [
      "punto",
      "positivo_mas",
      "positivo",
      "use_rival",
      "red",
      "filtrada",
    ];
    return typeof subtipo === "string" && validos.includes(subtipo)
      ? subtipo
      : null;
  }

  if (tipo === "defensa") {
    const s = String(subtipo);
    if (s === "toque") return "toque_positiva";
    if (s === "gran-defensa") return "gran_def";
    if (s === "libre") return "mala_libre";
    if (s === "cobertura") return "cobertura_positiva";
    if (s === "buena_rival") return "gran_def";
    
    // Nuevos subtipos generados por clasificacionV2
    if (s === "toque_positiva") return "toque_positiva";
    if (s === "toque_negativa") return "toque_negativa";
    if (s === "gran_def") return "gran_def";
    if (s === "mala_libre") return "mala_libre";
    if (s === "error_def") return "error_def";
    if (s === "neutro") return "toque_positiva";
    
    return null;
  }

  return null;
}

async function traducirAccionesV2(
  partidoId: string,
  equipoId?: string
): Promise<AccionIndividual[]> {
  const res = await cargarPuntosV2(partidoId);
  if (!res.ok || !res.puntos) return [];

  const out: AccionIndividual[] = [];
  for (const p of res.puntos) {
    for (const a of p.acciones) {
      if (equipoId && a.equipo_id && a.equipo_id !== equipoId) continue;
      const fund = fundamentoV2aV1(a.tipo);
      if (!fund) continue;
      const val = valoracionV2aV1(a.tipo, a.subtipo ?? null);
      if (!val) continue;
      if (!a.jugador_id) continue;
      out.push({
        jugador_id: a.jugador_id,
        set_numero: p.set_numero,
        punto_numero: p.punto_numero,
        fundamento: fund,
        valoracion: val,
        created_at: a.created_at ?? p.created_at ?? "",
      });
    }
  }
  return out;
}

// ------------------------------------------------------------
// CARGA COMPATIBLE (V1 + V2)
// ------------------------------------------------------------

export async function cargarAccionesCompatibles(
  partidoId: string,
  equipoId?: string
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
          "jugador_id, set_numero, punto_numero, calidad, zona_tendencia, tipo, valoracion_toque, created_at"
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
    if (a.tipo === "toque") {
      if (!a.valoracion_toque) return;
      acciones.push({
        jugador_id: a.jugador_id,
        set_numero: a.set_numero,
        punto_numero: a.punto_numero ?? 1,
        fundamento: "toque",
        valoracion: a.valoracion_toque,
        created_at: a.created_at ?? "",
      });
      return;
    }

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

  // ---------- V2 ----------
  const v2 = await traducirAccionesV2(partidoId, equipoId);
  for (const a of v2) acciones.push(a);

  acciones.sort((a, b) => {
    if (a.set_numero !== b.set_numero) return a.set_numero - b.set_numero;
    if (a.punto_numero !== b.punto_numero)
      return a.punto_numero - b.punto_numero;
    return a.created_at.localeCompare(b.created_at);
  });

  const procesadas: AccionDB[] = [];
  let puntoAnterior = "";
  let anteriorFinal: number | null = null;
  let ultimoArmadoFinal: number | null = null;

  for (const acc of acciones) {
    const puntoKey = `${acc.set_numero}-${acc.punto_numero}`;
    if (puntoKey !== puntoAnterior) {
      anteriorFinal = null;
      ultimoArmadoFinal = null;
      puntoAnterior = puntoKey;
    }

    const base = puntajeBase(acc.fundamento, acc.valoracion);
    if (base === null) continue;

    let final = base;

    if (anteriorFinal !== null) {
      final = ajustarPorContexto(final, anteriorFinal);
    }

    if (acc.fundamento === "ataque" && ultimoArmadoFinal !== null) {
      final = ajustarPorContexto(final, ultimoArmadoFinal);
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

    anteriorFinal = final;

    if (acc.fundamento === "armados") {
      ultimoArmadoFinal = final;
    } else if (acc.fundamento !== "ataque") {
      ultimoArmadoFinal = null;
    }
  }

  (armados.data ?? []).forEach((a: any) => {
    if (a.tipo === "toque") return;
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