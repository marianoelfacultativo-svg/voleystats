// ============================================================
// MÉTRICAS DE VÓLEY — cálculos estándar
// ============================================================
// FASE 3 del plan "Consultas Analíticas Libres".
//
// Funciones que reciben acciones (ya filtradas por el motor de
// consulta) y devuelven la métrica estándar de vóley.
//
// Cada función devuelve un `MetricaResultado` con:
//   - valor:       el número principal
//   - numerador:   lo que cuenta como "evento"
//   - denominador: el total sobre el que se calcula
//   - descripcion: string formateado para mostrar en UI
//
// Métricas implementadas:
//   - killPct               (kills / intentos de ataque)
//   - attackEfficiency      ((kills − errores) / intentos)
//   - hittingPct            ((kills − errores) / total)
//   - sideoutPct            (puntos en K1 / rallys en K1)
//   - breakPointPct         (puntos en K2/K3 / rallys en K2/K3)
//   - receptionPct          ((perfectas+positivas) / total recepciones)
//   - acePct                (aces / total saques)
//   - serveErrorPct         (errores saque / total saques)
//   - blockEfficiency       ((puntos + positivos − errores) / total bloqueos)
//   - digEfficiency         (defensas positivas / total defensas)
//   - puntosPorSet          (puntos ganados / sets jugados)
//   - puntosPorRotacion     (puntos ganados / rotación 1..6)
//
// Notas:
//   - Todos los % se devuelven en escala 0..100.
//   - Las eficiencias se devuelven en escala 0..100 también
//     (para que "30" signifique "30% de eficiencia").
//   - Si no hay datos, todas devuelven valor = 0 y descripcion
//     "Sin datos".
// ============================================================

import type {
  AccionVisual,
  PuntoConAcciones,
} from "../../app/equipo/adaptadorUnificadoV2";
import type { ContextoRally } from "../contextoRally";
import { baseSubtipo, clasificarResultado } from "../analisis/clasificacion";
import { redondear } from "./agregador";

// ------------------------------------------------------------
// TIPO DE RESULTADO
// ------------------------------------------------------------

export interface MetricaResultado {
  /** Número principal (0..100 para %, o el valor crudo para conteos). */
  valor: number;
  /** Cuántos eventos cumplieron la condición. */
  numerador: number;
  /** Denominador base (total sobre el que se calcula). */
  denominador: number;
  /** String formateado para mostrar en UI. */
  descripcion: string;
}

function vacio(): MetricaResultado {
  return {
    valor: 0,
    numerador: 0,
    denominador: 0,
    descripcion: "Sin datos",
  };
}

function pct(num: number, den: number): MetricaResultado {
  if (den === 0) return vacio();
  const valor = (num / den) * 100;
  return {
    valor: redondear(valor, 1),
    numerador: num,
    denominador: den,
    descripcion: `${num}/${den} (${redondear(valor, 1)}%)`,
  };
}

function eff(num: number, den: number): MetricaResultado {
  // Eficiencias: (a − b) / n × 100. Puede dar negativo.
  if (den === 0) return vacio();
  const valor = (num / den) * 100;
  const signo = valor > 0 ? "+" : "";
  return {
    valor: redondear(valor, 1),
    numerador: num,
    denominador: den,
    descripcion: `${signo}${redondear(valor, 1)}% (${den} intentos)`,
  };
}

// ------------------------------------------------------------
// HELPERS INTERNOS
// ------------------------------------------------------------

function esAtaque(a: AccionVisual): boolean {
  return a.tipo === "ataque" && !a.es_rival;
}

function esRecepcion(a: AccionVisual): boolean {
  return a.tipo === "recepcion" && !a.es_rival;
}

function esSaque(a: AccionVisual): boolean {
  return a.tipo === "saque" && !a.es_rival;
}

function esBloqueo(a: AccionVisual): boolean {
  return a.tipo === "bloqueo" && !a.es_rival;
}

function esDefensa(a: AccionVisual): boolean {
  return a.tipo === "defensa" && !a.es_rival;
}

function sub(a: AccionVisual): string {
  return baseSubtipo(a);
}

/**
 * Determina el ganador del punto a partir de la última acción
 * visible. Devuelve "propio" | "rival" | null (null si neutro).
 */
function ganadorDelPunto(acciones: AccionVisual[]): "propio" | "rival" | null {
  const visibles = acciones.filter((a) => !a.oculta);
  if (visibles.length === 0) return null;
  const ultima = visibles[visibles.length - 1];
  const cat = clasificarResultado(ultima);
  if (cat === "punto") return ultima.es_rival ? "rival" : "propio";
  if (cat === "error") return ultima.es_rival ? "propio" : "rival";
  return null;
}

// ------------------------------------------------------------
// ATAQUE
// ------------------------------------------------------------

/**
 * Kill %: kills / intentos de ataque.
 * Kills = ataques propios con subtipo "punto".
 */
export function killPct(acciones: AccionVisual[]): MetricaResultado {
  const ataques = acciones.filter(esAtaque);
  if (ataques.length === 0) return vacio();
  const kills = ataques.filter((a) => sub(a) === "punto").length;
  return pct(kills, ataques.length);
}

/**
 * Attack Efficiency: (kills − errores) / intentos.
 * Errores = subtipos de error_* + gorro_ataque.
 */
export function attackEfficiency(
  acciones: AccionVisual[]
): MetricaResultado {
  const ataques = acciones.filter(esAtaque);
  if (ataques.length === 0) return vacio();
  let kills = 0;
  let errores = 0;
  for (const a of ataques) {
    const s = sub(a);
    if (s === "punto") kills += 1;
    else if (
      s === "error" ||
      s === "error_afuera_ataque" ||
      s === "error_red_ataque" ||
      s === "gorro_ataque"
    ) {
      errores += 1;
    }
  }
  return eff(kills - errores, ataques.length);
}

/**
 * Hitting %: (kills − errores) / total de acciones de ataque.
 * Prácticamente igual que Attack Efficiency, pero la convención
 * de vóley USA distingue: Hitting % incluye errores forzados,
 * Attack Efficiency a veces no. Acá los tratamos igual.
 */
export function hittingPct(acciones: AccionVisual[]): MetricaResultado {
  return attackEfficiency(acciones);
}

// ------------------------------------------------------------
// SIDE-OUT / BREAK-POINT
// ------------------------------------------------------------

/**
 * Side-out %: % de rallys en K1 (recepción) que terminaron en
 * punto para el equipo.
 *
 * Requiere el `contextoRally` (calculado con calcularContextoRally)
 * porque necesita saber la fase del rally.
 */
export function sideoutPct(
  acciones: AccionVisual[],
  contextoRally: Map<string, ContextoRally>
): MetricaResultado {
  // Agrupar por punto.
  const porPunto = new Map<string, AccionVisual[]>();
  for (const a of acciones) {
    if (a.oculta) continue;
    const k = `${a.partido_id}|${a.set_numero}|${a.punto_numero}`;
    let arr = porPunto.get(k);
    if (!arr) {
      arr = [];
      porPunto.set(k, arr);
    }
    arr.push(a);
  }

  let totales = 0;
  let ganados = 0;

  for (const lista of porPunto.values()) {
    // La fase del rally se toma de la última acción visible.
    const ordenada = [...lista].sort((a, b) => a.orden - b.orden);
    const ultima = ordenada[ordenada.length - 1];
    const ctx = contextoRally.get(ultima.id);
    if (!ctx) continue;
    if (ctx.fase !== "side-out") continue;

    totales += 1;
    if (ganadorDelPunto(lista) === "propio") ganados += 1;
  }

  return pct(ganados, totales);
}

/**
 * Break-point %: % de rallys en K2 o K3 (contraataque desde
 * defensa o cobertura) que terminaron en punto para el equipo.
 *
 * Requiere `contextoRally`.
 */
export function breakPointPct(
  acciones: AccionVisual[],
  contextoRally: Map<string, ContextoRally>
): MetricaResultado {
  const porPunto = new Map<string, AccionVisual[]>();
  for (const a of acciones) {
    if (a.oculta) continue;
    const k = `${a.partido_id}|${a.set_numero}|${a.punto_numero}`;
    let arr = porPunto.get(k);
    if (!arr) {
      arr = [];
      porPunto.set(k, arr);
    }
    arr.push(a);
  }

  let totales = 0;
  let ganados = 0;

  for (const lista of porPunto.values()) {
    const ordenada = [...lista].sort((a, b) => a.orden - b.orden);
    const ultima = ordenada[ordenada.length - 1];
    const ctx = contextoRally.get(ultima.id);
    if (!ctx) continue;
    const esK2oK3 =
      ctx.fase === "k2" ||
      ctx.fase === "k3" ||
      ctx.fase === "contraataque";
    if (!esK2oK3) continue;

    totales += 1;
    if (ganadorDelPunto(lista) === "propio") ganados += 1;
  }

  return pct(ganados, totales);
}

// ------------------------------------------------------------
// RECEPCIÓN
// ------------------------------------------------------------

/**
 * Reception %: (perfectas + positivas) / total recepciones.
 */
export function receptionPct(
  acciones: AccionVisual[]
): MetricaResultado {
  const recepciones = acciones.filter(esRecepcion);
  if (recepciones.length === 0) return vacio();
  let buenas = 0;
  for (const a of recepciones) {
    const s = sub(a);
    if (s === "perfecta" || s === "positiva") buenas += 1;
  }
  return pct(buenas, recepciones.length);
}

// ------------------------------------------------------------
// SAQUE
// ------------------------------------------------------------

/**
 * Ace %: aces / total saques.
 */
export function acePct(acciones: AccionVisual[]): MetricaResultado {
  const saques = acciones.filter(esSaque);
  if (saques.length === 0) return vacio();
  const aces = saques.filter((a) => sub(a) === "ace").length;
  return pct(aces, saques.length);
}

/**
 * Serve Error %: errores de saque / total saques.
 */
export function serveErrorPct(
  acciones: AccionVisual[]
): MetricaResultado {
  const saques = acciones.filter(esSaque);
  if (saques.length === 0) return vacio();
  const errores = saques.filter((a) => sub(a) === "negativo").length;
  return pct(errores, saques.length);
}

// ------------------------------------------------------------
// BLOQUEO / DEFENSA
// ------------------------------------------------------------

/**
 * Block Efficiency: (puntos + positivos − errores) / total bloqueos.
 * Puntos: punto, positivo_mas, positivo.
 * Errores: red, use_rival, filtrada.
 */
export function blockEfficiency(
  acciones: AccionVisual[]
): MetricaResultado {
  const bloqueos = acciones.filter(esBloqueo);
  if (bloqueos.length === 0) return vacio();
  let puntos = 0;
  let errores = 0;
  for (const a of bloqueos) {
    const s = sub(a);
    if (s === "punto" || s === "positivo_mas" || s === "positivo") {
      puntos += 1;
    } else if (s === "red" || s === "use_rival" || s === "filtrada") {
      errores += 1;
    }
  }
  return eff(puntos - errores, bloqueos.length);
}

/**
 * Dig Efficiency: defensas positivas / total defensas.
 * Positivas: toque_positiva, gran_def, cobertura_positiva.
 */
export function digEfficiency(
  acciones: AccionVisual[]
): MetricaResultado {
  const defensas = acciones.filter(esDefensa);
  if (defensas.length === 0) return vacio();
  let buenas = 0;
  for (const a of defensas) {
    const s = sub(a);
    if (
      s === "toque_positiva" ||
      s === "gran_def" ||
      s === "cobertura_positiva"
    ) {
      buenas += 1;
    }
  }
  return pct(buenas, defensas.length);
}

// ------------------------------------------------------------
// PUNTOS POR SET / ROTACIÓN
// ------------------------------------------------------------

/**
 * Puntos por set: promedio de puntos ganados por el equipo por set.
 * Recibe los puntos completos (con sus acciones). Solo cuenta
 * puntos donde el ganador fue "propio".
 */
export function puntosPorSet(
  puntos: PuntoConAcciones[]
): MetricaResultado {
  if (puntos.length === 0) return vacio();

  const sets = new Set<number>();
  let totalPuntos = 0;
  for (const p of puntos) {
    sets.add(p.set_numero);
    if (ganadorDelPunto(p.acciones) === "propio") totalPuntos += 1;
  }

  const nSets = sets.size;
  if (nSets === 0) return vacio();

  const promedio = totalPuntos / nSets;
  return {
    valor: redondear(promedio, 2),
    numerador: totalPuntos,
    denominador: nSets,
    descripcion: `${totalPuntos} puntos en ${nSets} set${
      nSets !== 1 ? "s" : ""
    } (${redondear(promedio, 2)}/set)`,
  };
}

/**
 * Puntos por rotación: promedio de puntos ganados por rotación.
 * Recibe los puntos completos. Para cada punto ganado, busca la
 * última acción propia con `rotacion_numero` para saber en qué
 * rotación se ganó.
 */
export function puntosPorRotacion(
  puntos: PuntoConAcciones[]
): MetricaResultado {
  if (puntos.length === 0) return vacio();

  const puntosPorRot: Record<number, number> = {};
  let totalPuntos = 0;

  for (const p of puntos) {
    if (ganadorDelPunto(p.acciones) !== "propio") continue;

    // Buscar la última acción propia con rotacion_numero no nulo.
    const propias = p.acciones
      .filter((a) => !a.es_rival && !a.oculta && a.rotacion_numero !== null)
      .sort((a, b) => b.orden - a.orden);

    const rot = propias[0]?.rotacion_numero;
    if (rot === null || rot === undefined) continue;

    puntosPorRot[rot] = (puntosPorRot[rot] ?? 0) + 1;
    totalPuntos += 1;
  }

  const rotacionesConPuntos = Object.keys(puntosPorRot).length;
  if (rotacionesConPuntos === 0) return vacio();

  const promedio = totalPuntos / rotacionesConPuntos;
  return {
    valor: redondear(promedio, 2),
    numerador: totalPuntos,
    denominador: rotacionesConPuntos,
    descripcion: `${totalPuntos} puntos en ${rotacionesConPuntos} rotaci${
      rotacionesConPuntos !== 1 ? "ones" : "ón"
    } (${redondear(promedio, 2)}/rot)`,
  };
}

// ------------------------------------------------------------
// DISPATCHER POR NOMBRE DE MÉTRICA
// ------------------------------------------------------------

/**
 * Dado un `metrica` de los diccionarios (kill_pct, sideout_pct,
 * etc.), devuelve la función correspondiente.
 *
 * Si la métrica no existe, devuelve null.
 */
export function resolverMetrica(
  metrica: string
):
  | ((acciones: AccionVisual[]) => MetricaResultado)
  | null {
  switch (metrica) {
    case "kill_pct":
      return killPct;
    case "attack_efficiency":
      return attackEfficiency;
    case "hitting_pct":
      return hittingPct;
    case "reception_pct":
      return receptionPct;
    case "ace_pct":
      return acePct;
    case "serve_error_pct":
      return serveErrorPct;
    case "block_efficiency":
      return blockEfficiency;
    case "dig_efficiency":
      return digEfficiency;
    // Las que necesitan contexto (sideout / break-point) se resuelven
    // por separado para no complicar la firma.
    default:
      return null;
  }
}