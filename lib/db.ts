// ============================================
// ACCESO A DATOS — SOLO V2
// Correlación: cadena lineal + armado → ataque extra
// ============================================

import { supabase } from "./supabase";
import { cargarPuntosV2, type AccionV2Row } from "./dbV2";
import type { RotacionPunto } from "./rotaciones";
import { puntajeBase, ajustarPorContexto } from "./estadisticas";
import { debeFlipear, prepararPuntos } from "./flipPerspectiva";

// ------------------------------------------------------------
// Interfaces V1 (compat con visualizadores antiguos)
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
    | "neutro"
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
// CRUD V1 (código muerto hasta borrar data-entry-jugador)
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

// ------------------------------------------------------------
// Borrar punto V1 (mantenido por compat, se elimina en paso 3)
// ------------------------------------------------------------

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
// ADAPTADOR: acciones_v2 → AccionDB
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
  variante?: string | null;
  destino_celda?: string | null;
  subtipo_original?: string | null;
  tipo_saque?: string | null;
  velocidad?: number | null;

  // Campos nuevos para el mapa de calor
  origen_celda?: string | null;
  origen_mini?: string | null;
  destino_mini?: string | null;
  posicion_inicial_celda?: string | null;
  posicion_inicial_mini?: string | null;
}

// ============================================================
// RECEPCIÓN — sistema nuevo de 7 valores
// ============================================================
// Los valores válidos de `subtipo` para recepción son strings:
//   perfecta, positiva, intermedia, negativa, doble_negativa,
//   overpass, error_directo.
//
// Los partidos viejos guardados con subtipo numérico (1-6) se
// consideran fuera de soporte: no se convierten y no cuentan en
// estadísticas.
// ------------------------------------------------------------

const RECEPCION_VALORES_VALIDOS = new Set<string>([
  "perfecta",
  "positiva",
  "intermedia",
  "negativa",
  "doble_negativa",
  "overpass",
  "error_directo",
]);

const CALIDAD_A_STR: Record<number, string> = {
  1: "horrible",
  2: "malo",
  3: "flojo",
  4: "correcto",
  5: "perfecto",
  6: "genial",
};

interface AccionIndividual {
  jugador_id: string;
  set_numero: number;
  punto_numero: number;
  fundamento: string;
  valoracion: string;
  variante?: string | null;
  destino_celda?: string | null;
  subtipo_original?: string | null;
  tipo_saque?: string | null;
  velocidad?: number | null;
  origen_celda?: string | null;
  origen_mini?: string | null;
  destino_mini?: string | null;
  posicion_inicial_celda?: string | null;
  posicion_inicial_mini?: string | null;
  created_at: string;
}

function fundamentoV2aV1(tipo: string): string | null {
  switch (tipo) {
    case "saque": return "saque";
    case "recepcion": return "recepcion";
    case "armado": return "armados";
    case "ataque": return "ataque";
    case "bloqueo": return "bloqueo";
    case "defensa": return "defensa";
    default: return null;
  }
}

function valoracionV2aV1(
  tipo: string,
  subtipo: string | number | null
): string | null {
  if (subtipo === null || subtipo === undefined) return null;

  if (tipo === "saque") {
    const validos = ["ace", "positivo_mas", "positivo", "neutro", "negativo"];
    return typeof subtipo === "string" && validos.includes(subtipo) ? subtipo : null;
  }

  if (tipo === "recepcion") {
    // El subtipo ya viene como string del sistema nuevo.
    // No hay conversión numérica: los partidos viejos (1-6)
    // quedan fuera de soporte y devuelven null.
    const s = String(subtipo);
    return RECEPCION_VALORES_VALIDOS.has(s) ? s : null;
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
    if (s === "punto_directo_ataque") return "punto";
    if (s === "punto_desviado_ataque") return "punto";
    if (s === "use_rival_ataque") return "punto";
    if (s === "error_red_ataque") return "error";
    if (s === "error_afuera_ataque") return "error";
    if (s === "gorro_ataque") return "error";
    if (s === "neutro_bloqueo_cobertura_ataque") return "neutro";
    if (s === "neutro_desvio_bloqueo_defensa_ataque") return "neutro";
    if (s === "neutro_defensa_ataque") return "neutro";
    return null;
  }

  if (tipo === "bloqueo") {
    const validos = ["punto", "positivo_mas", "positivo", "neutro", "use_rival", "red", "filtrada"];
    return typeof subtipo === "string" && validos.includes(subtipo) ? subtipo : null;
  }

  if (tipo === "defensa") {
    const s = String(subtipo);
    if (s === "toque") return "toque_positiva";
    if (s === "gran-defensa") return "gran_def";
    if (s === "libre") return "mala_libre";
    if (s === "cobertura") return "cobertura_positiva";
    if (s === "buena_rival") return "neutro";
    if (s === "toque_positiva") return "toque_positiva";
    if (s === "toque_negativa") return "toque_negativa";
    if (s === "gran_def") return "gran_def";
    if (s === "mala_libre") return "mala_libre";
    if (s === "error_def") return "error_def";
    if (s === "neutro") return "neutro";
    if (s === "cobertura_positiva") return "cobertura_positiva";
    if (s === "cobertura_negativa") return "cobertura_negativa";
    return null;
  }

  return null;
}

function zonaTendenciaDeCelda(celda: string | null): number | null {
  if (!celda) return null;
  switch (celda) {
    case "F1-C1": case "F1-C2": return 4;
    case "F1-C3": return 3;
    case "F1-C4": case "F1-C5": return 2;
    case "F2-C3": case "F3-C3": return 6;
    case "F2-C4": case "F2-C5": case "F3-C4": case "F3-C5": return 2;
    default: return null;
  }
}

export async function cargarAccionesCompatibles(
  partidoId: string,
  equipoId?: string
): Promise<AccionDB[]> {
  const res = await cargarPuntosV2(partidoId);
  if (!res.ok || !res.puntos) return [];

  const hayQueFlipear = await debeFlipear(partidoId, equipoId);
  const puntos = prepararPuntos(res.puntos, hayQueFlipear);

  const acciones: AccionIndividual[] = [];
  for (const p of puntos) {
    for (const a of p.acciones) {
      if (equipoId && a.equipo_id && a.equipo_id !== equipoId) continue;
      const fund = fundamentoV2aV1(a.tipo);
      if (!fund) continue;
      const val = valoracionV2aV1(a.tipo, a.subtipo ?? null);
      if (!val) continue;
      if (!a.jugador_id) continue;

      let subRaw: string | null = typeof a.subtipo === "string" ? a.subtipo : null;
      if (subRaw && subRaw.startsWith("toque:")) subRaw = subRaw.slice(6);

      acciones.push({
        jugador_id: a.jugador_id,
        set_numero: p.set_numero,
        punto_numero: p.punto_numero,
        fundamento: fund,
        valoracion: val,
        variante: a.variante ?? null,
        destino_celda: a.destino_celda ?? null,
        subtipo_original: subRaw,
        tipo_saque: a.tipo_saque ?? null,
        velocidad: a.velocidad ?? null,
        origen_celda: a.origen_celda ?? null,
        origen_mini: a.origen_mini ?? null,
        destino_mini: a.destino_mini ?? null,
        posicion_inicial_celda: a.posicion_inicial_celda ?? null,
        posicion_inicial_mini: a.posicion_inicial_mini ?? null,
        created_at: a.created_at ?? p.created_at ?? "",
      });
    }
  }

  acciones.sort((a, b) => {
    if (a.set_numero !== b.set_numero) return a.set_numero - b.set_numero;
    if (a.punto_numero !== b.punto_numero) return a.punto_numero - b.punto_numero;
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
    if (anteriorFinal !== null) final = ajustarPorContexto(final, anteriorFinal);
    if (acc.fundamento === "ataque" && ultimoArmadoFinal !== null) final = ajustarPorContexto(final, ultimoArmadoFinal);

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
      variante: acc.variante ?? null,
      destino_celda: acc.destino_celda ?? null,
      subtipo_original: acc.subtipo_original ?? null,
      tipo_saque: acc.tipo_saque ?? null,
      velocidad: acc.velocidad ?? null,
      origen_celda: acc.origen_celda ?? null,
      origen_mini: acc.origen_mini ?? null,
      destino_mini: acc.destino_mini ?? null,
      posicion_inicial_celda: acc.posicion_inicial_celda ?? null,
      posicion_inicial_mini: acc.posicion_inicial_mini ?? null,
    });

    anteriorFinal = final;
    if (acc.fundamento === "armados") ultimoArmadoFinal = final;
    else if (acc.fundamento !== "ataque") ultimoArmadoFinal = null;
  }

  for (const p of puntos) {
    for (const a of p.acciones) {
      if (a.tipo !== "armado") continue;
      if (!a.jugador_id) continue;
      if (equipoId && a.equipo_id && a.equipo_id !== equipoId) continue;
      const zona = zonaTendenciaDeCelda(a.destino_celda);
      if (zona === null) continue;
      procesadas.push({
        jugador_id: a.jugador_id,
        partido_id: partidoId,
        set_numero: p.set_numero,
        punto_numero: p.punto_numero,
        fundamento: "tendencia",
        valoracion: `zona_${zona}`,
        cantidad: 1,
        puntaje: 5,
        puntajeBase: 5,
      });
    }
  }

  const agrupado = new Map<string, AccionDB>();
  for (const r of procesadas) {
    const pRed = Math.round((r.puntaje ?? 5) * 10) / 10;
    const k = `${r.jugador_id}|${r.set_numero}|${r.fundamento}|${r.valoracion}|${pRed}|${r.destino_celda ?? ""}|${r.subtipo_original ?? ""}|${r.tipo_saque ?? ""}|${r.velocidad ?? ""}|${r.origen_celda ?? ""}|${r.origen_mini ?? ""}|${r.destino_mini ?? ""}|${r.posicion_inicial_celda ?? ""}`;
    const existente = agrupado.get(k);
    if (existente) existente.cantidad += 1;
    else agrupado.set(k, { ...r, puntaje: pRed });
  }

  return Array.from(agrupado.values());
}

// ============================================
// CONTAR PUNTOS DEL RIVAL (buenas / errores)
// ============================================

type ClasificacionRival = "buena" | "error" | null;

function clasificarUltimaRival(ultima: AccionV2Row): ClasificacionRival {
  if (ultima.es_rival !== true) return null;

  const sub = typeof ultima.subtipo === "string" ? ultima.subtipo : null;
  const base = sub && sub.startsWith("toque:") ? sub.slice(6) : sub;
  const destino = ultima.destino_celda ?? "";

  if (ultima.tipo === "saque") {
    if (base === "negativo") return "error";
    return null;
  }

  if (ultima.tipo === "ataque") {
    if (base === "punto_directo_ataque" || base === "buena_rival" || base === "punto") return "buena";
    if (base === "error_afuera_ataque" || base === "error_red_ataque" || base === "error_rival" || base === "error") return "error";
    return null;
  }

  if (ultima.tipo === "bloqueo") return null;

  if (ultima.tipo === "roce-red") {
    if (base === "roce-red-rival") return "buena";
    if (base === "ofensivo-propio" || base === "invasion-zaguero" || base === "invasion-delantero" || base === "error_rival") return "error";
    return null;
  }

  if (destino.startsWith("FUERA-") || destino.startsWith("RED-")) return "error";

  return null;
}

export async function contarPuntosRival(
  partidoId: string,
  equipoId?: string
): Promise<{ buenas: number; errores: number }> {
  const res = await cargarPuntosV2(partidoId);
  if (!res.ok || !res.puntos) return { buenas: 0, errores: 0 };

  const hayQueFlipear = await debeFlipear(partidoId, equipoId);
  const puntos = prepararPuntos(res.puntos, hayQueFlipear);

  let buenas = 0;
  let errores = 0;

  for (const p of puntos) {
    if (p.ganador !== "propio" && p.ganador !== "rival") continue;

    const visibles = p.acciones.filter((a) => !a.oculta);
    if (visibles.length === 0) continue;
    const ultima = visibles[visibles.length - 1];

    const clasif = clasificarUltimaRival(ultima);
    if (clasif === "buena") buenas++;
    else if (clasif === "error") errores++;
  }

  return { buenas, errores };
}