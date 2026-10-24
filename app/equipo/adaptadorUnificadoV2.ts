// ============================================================
// ADAPTADOR UNIFICADO V2
// Carga TODAS las acciones de un partido con sus 12 campos
// analíticos. Es la única fuente de datos para el 3D unificado.
// ============================================================

import { supabase } from "@/lib/supabase";
import type { AccionV2Row } from "@/lib/dbV2";
import { zonaCrudaDeCelda } from "@/lib/mapeoV2";

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

  zona_origen_codigo: string | null;
  zona_destino_codigo: string | null;

  subtipo_real: string | null;
  es_ultima_del_punto: boolean;
  calidad_armado_previo: number | null;
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
// FLIP DE PERSPECTIVA (para cuando mira el equipo rival)
// ------------------------------------------------------------

function invertirCelda(celda: string): string {
  if (celda.startsWith("F1-")) return "F4-" + celda.slice(3);
  if (celda.startsWith("F2-")) return "F5-" + celda.slice(3);
  if (celda.startsWith("F3-")) return "F6-" + celda.slice(3);
  if (celda.startsWith("F4-")) return "F1-" + celda.slice(3);
  if (celda.startsWith("F5-")) return "F2-" + celda.slice(3);
  if (celda.startsWith("F6-")) return "F3-" + celda.slice(3);
  if (celda.startsWith("BLOQ-P-")) return "BLOQ-R-" + celda.slice(7);
  if (celda.startsWith("BLOQ-R-")) return "BLOQ-P-" + celda.slice(7);
  if (celda.startsWith("FUERA-ARR-")) return "FUERA-ABA-" + celda.slice(10);
  if (celda.startsWith("FUERA-ABA-")) return "FUERA-ARR-" + celda.slice(10);
  return celda;
}

function flipAccionRow(a: AccionV2Row): AccionV2Row {
  return {
    ...a,
    es_rival: !a.es_rival,
    lado: a.lado === "propio" ? "rival" : "propio",
    origen_celda: a.origen_celda ? invertirCelda(a.origen_celda) : null,
    destino_celda: a.destino_celda ? invertirCelda(a.destino_celda) : null,
    desvios: (a.desvios ?? []).map((d) => ({
      ...d,
      celda: invertirCelda(d.celda),
    })),
    posicion_inicial_celda: a.posicion_inicial_celda
      ? invertirCelda(a.posicion_inicial_celda)
      : null,
  };
}

// ------------------------------------------------------------
// HELPERS DE ZONA CODIFICADA
// ------------------------------------------------------------

function esLadoRival(celda: string | null | undefined): boolean {
  if (!celda) return false;
  if (/^F[456]-/.test(celda)) return true;
  if (celda.startsWith("BLOQ-R-")) return true;
  if (celda.startsWith("FUERA-ARR-")) return true;
  return false;
}

function espejarFila(celda: string): string {
  if (celda.startsWith("F4-")) return "F3-" + celda.slice(3);
  if (celda.startsWith("F5-")) return "F2-" + celda.slice(3);
  if (celda.startsWith("F6-")) return "F1-" + celda.slice(3);
  return celda;
}

function codigoZonaDeCelda(
  celda: string | null | undefined
): string | null {
  if (!celda) return null;
  if (!/^F[1-6]-/.test(celda)) return null;
  const esRival = esLadoRival(celda);
  const celdaEsp = esRival ? espejarFila(celda) : celda;
  const zona = zonaCrudaDeCelda(celdaEsp);
  if (zona === null) return null;
  return `${esRival ? "R" : "P"}${zona}`;
}

function subtiipoReal(a: AccionV2Row): string | null {
  if (a.tipo === "saque") return a.tipo_saque ?? null;
  if (a.tipo === "ataque") {
    return a.variante === "toque" ? "toque" : "remate";
  }
  return null;
}

function calidadDeArmado(
  subtipo: string | number | null | undefined
): number | null {
  if (subtipo === null || subtipo === undefined) return null;
  if (typeof subtipo === "number") {
    if (subtipo >= 1 && subtipo <= 6) return subtipo;
    return null;
  }
  const n = parseInt(subtipo, 10);
  if (!isNaN(n) && n >= 1 && n <= 6) return n;
  return null;
}

// ------------------------------------------------------------
// CARGA
// ------------------------------------------------------------

export async function cargarAccionesUnificadas(
  partidoId: string,
  equipoId?: string
): Promise<CargaUnificadaResult> {
  if (!partidoId) return { acciones: [], puntos: [] };

  // Si el equipo que mira es el equipo_rival_id del partido, flipeamos
  // toda la perspectiva (es_rival, lado, celdas, desvíos).
  let debeFlipear = false;
  if (equipoId) {
    const { data: partido } = await supabase
      .from("partidos")
      .select("equipo_id, equipo_rival_id")
      .eq("id", partidoId)
      .maybeSingle();
    if (partido && partido.equipo_rival_id === equipoId) {
      debeFlipear = true;
    }
  }

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

  let rows = data as AccionV2Row[];
  if (debeFlipear) rows = rows.map(flipAccionRow);

  const calidadArmadoPrevioPorAccion = new Map<string, number | null>();
  {
    let ultimoArmado: number | null = null;
    let ultimoPuntoKey = "";
    for (const a of rows) {
      const k = `${a.set_numero}-${a.punto_numero}`;
      if (k !== ultimoPuntoKey) {
        ultimoArmado = null;
        ultimoPuntoKey = k;
      }
      if (a.tipo === "ataque") {
        calidadArmadoPrevioPorAccion.set(a.id, ultimoArmado);
      }
      if (a.tipo === "armado" && !(a.oculta ?? false)) {
        const c = calidadDeArmado(a.subtipo ?? null);
        if (c !== null) ultimoArmado = c;
      }
    }
  }

  const base: AccionVisual[] = rows.map((a) => ({
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
    zona_origen_codigo: codigoZonaDeCelda(a.origen_celda),
    zona_destino_codigo: codigoZonaDeCelda(a.destino_celda),
    subtipo_real: subtiipoReal(a),
    es_ultima_del_punto: false,
    calidad_armado_previo: calidadArmadoPrevioPorAccion.get(a.id) ?? null,
  }));

  const ultimaOrdenPorPunto = new Map<string, number>();
  for (const a of base) {
    if (a.oculta) continue;
    const k = `${a.set_numero}-${a.punto_numero}`;
    const prev = ultimaOrdenPorPunto.get(k);
    if (prev === undefined || a.orden > prev) {
      ultimaOrdenPorPunto.set(k, a.orden);
    }
  }

  const acciones: AccionVisual[] = base.map((a) => {
    if (a.oculta) return a;
    const k = `${a.set_numero}-${a.punto_numero}`;
    const ultima = ultimaOrdenPorPunto.get(k);
    return {
      ...a,
      es_ultima_del_punto: ultima !== undefined && a.orden === ultima,
    };
  });

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
// COLORES
// ------------------------------------------------------------

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

export function colorPorValoracion(a: AccionVisual): string {
  const raw =
    a.subtipo !== null && a.subtipo !== undefined
      ? String(a.subtipo)
      : "";
  const base = raw.startsWith("toque:") ? raw.slice(6) : raw;

  if (a.tipo === "saque") {
    switch (base) {
      case "ace":
        return "#16a34a";
      case "positivo_mas":
        return "#65a30d";
      case "positivo":
        return "#84cc16";
      case "neutro":
        return "#94a3b8";
      case "negativo":
        return "#dc2626";
    }
  }

  if (a.tipo === "recepcion") {
    const n = parseInt(base, 10);
    const colores: Record<number, string> = {
      1: "#991b1b",
      2: "#dc2626",
      3: "#ea580c",
      4: "#eab308",
      5: "#84cc16",
      6: "#16a34a",
    };
    if (!isNaN(n) && colores[n]) return colores[n];
  }

  if (a.tipo === "armado") {
    if (base === "R") return "#64748b";
    const n = parseInt(base, 10);
    const colores: Record<number, string> = {
      1: "#dc2626",
      2: "#ea580c",
      3: "#eab308",
      4: "#84cc16",
      5: "#16a34a",
      6: "#059669",
    };
    if (!isNaN(n) && colores[n]) return colores[n];
  }

  if (a.tipo === "ataque") {
    switch (base) {
      case "punto":
        return "#16a34a";
      case "neutro":
        return "#64748b";
      case "error":
        return "#dc2626";
    }
  }

  if (a.tipo === "bloqueo") {
    switch (base) {
      case "punto":
        return "#16a34a";
      case "positivo_mas":
        return "#65a30d";
      case "positivo":
        return "#84cc16";
      case "use_rival":
        return "#eab308";
      case "red":
        return "#dc2626";
      case "filtrada":
        return "#ea580c";
    }
  }

  if (a.tipo === "defensa") {
    switch (base) {
      case "toque_positiva":
      case "gran_def":
      case "cobertura_positiva":
        return "#16a34a";
      case "toque_negativa":
      case "error_def":
      case "cobertura_negativa":
      case "errores_graves":
        return "#dc2626";
      case "mala_libre":
        return "#991b1b";
      case "neutro":
        return "#64748b";
    }
  }

  if (a.tipo === "libre") {
    return "#a16207";
  }

  if (a.tipo === "roce-red") {
    if (base === "roce-red-rival") return "#0284c7";
    if (base === "ofensivo-propio") return "#dc2626";
    return "#ea580c";
  }

  if (a.es_rival) return "#94a3b8";
  return "#64748b";
}

export function etiquetaAccion(a: AccionVisual): string {
  const st =
    a.subtipo !== null && a.subtipo !== undefined
      ? String(a.subtipo)
      : "";
  if (!st) return a.tipo;
  return `${a.tipo} · ${st}`;
}