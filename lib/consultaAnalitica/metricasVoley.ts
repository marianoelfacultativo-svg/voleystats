// ============================================================
// MÉTRICAS DE VÓLEY — cálculos estándar
// ============================================================
// FASE 3 + FASE 6 del plan "Consultas Analíticas Libres".
//
// v1.2 (FASE 6 — bloque A.2):
//   + `puntosGanadosPct(puntos)`: % de puntos propios sobre el
//     total de puntos. Numerador = puntos ganados, denominador =
//     total de rallies cerrados (propios + rival).
//
// v1.1 (FASE 6):
//   + `puntosGanados(puntos)`: rallies cerrados con punto propio.
//     Recibe puntos completos (PuntoConAcciones), no acciones.
//   + `accionesPunto(acciones)`: acciones que terminaron en punto
//     (saque ace, ataque punto, bloqueo punto).
//
// El resto igual que v1.0.
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
  valor: number;
  numerador: number;
  denominador: number;
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

function conteo(num: number, den: number, unidad = "acciones"): MetricaResultado {
  if (den === 0) return vacio();
  return {
    valor: num,
    numerador: num,
    denominador: den,
    descripcion: `${num} de ${den} ${unidad}.`,
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

export function killPct(acciones: AccionVisual[]): MetricaResultado {
  const ataques = acciones.filter(esAtaque);
  if (ataques.length === 0) return vacio();
  const kills = ataques.filter((a) => sub(a) === "punto").length;
  return pct(kills, ataques.length);
}

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

export function hittingPct(acciones: AccionVisual[]): MetricaResultado {
  return attackEfficiency(acciones);
}

// ------------------------------------------------------------
// SIDE-OUT / BREAK-POINT
// ------------------------------------------------------------

export function sideoutPct(
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
    if (ctx.fase !== "side-out") continue;

    totales += 1;
    if (ganadorDelPunto(lista) === "propio") ganados += 1;
  }

  return pct(ganados, totales);
}

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

export function acePct(acciones: AccionVisual[]): MetricaResultado {
  const saques = acciones.filter(esSaque);
  if (saques.length === 0) return vacio();
  const aces = saques.filter((a) => sub(a) === "ace").length;
  return pct(aces, saques.length);
}

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

export function puntosPorRotacion(
  puntos: PuntoConAcciones[]
): MetricaResultado {
  if (puntos.length === 0) return vacio();

  const puntosPorRot: Record<number, number> = {};
  let totalPuntos = 0;

  for (const p of puntos) {
    if (ganadorDelPunto(p.acciones) !== "propio") continue;

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
// PUNTOS GANADOS
// ------------------------------------------------------------

/**
 * Puntos ganados: rallies cerrados con punto propio.
 *
 * A diferencia de `puntosPorSet`, devuelve un CONTEO ABSOLUTO,
 * no un promedio. Sirve para "cuántos puntos ganamos" o
 * "cuántos puntos ganó X" (si ya filtramos `puntos` por X antes).
 */
export function puntosGanados(
  puntos: PuntoConAcciones[]
): MetricaResultado {
  if (puntos.length === 0) return vacio();

  let ganados = 0;
  for (const p of puntos) {
    if (ganadorDelPunto(p.acciones) === "propio") ganados += 1;
  }
  return conteo(ganados, puntos.length, "puntos");
}

/**
 * % de puntos ganados: puntos propios / total de rallies cerrados.
 *
 * A diferencia de `puntosGanados` (conteo absoluto), devuelve un
 * porcentaje 0..100.
 *
 * Solo cuenta rallies con ganador determinado (propio o rival).
 * Los rallies "sin ganador" (sin última acción visible o neutra)
 * no se cuentan en el denominador — si no, el % quedaría
 * subestimado por puntos que en realidad no cerraron.
 */
export function puntosGanadosPct(
  puntos: PuntoConAcciones[]
): MetricaResultado {
  if (puntos.length === 0) return vacio();

  let total = 0;
  let ganados = 0;
  for (const p of puntos) {
    const g = ganadorDelPunto(p.acciones);
    if (g === null) continue; // sin ganador → no cuenta
    total += 1;
    if (g === "propio") ganados += 1;
  }

  if (total === 0) return vacio();
  return pct(ganados, total);
}

// ------------------------------------------------------------
// ACCIONES EN PUNTO
// ------------------------------------------------------------

/**
 * Acciones en punto: cuántas acciones (saques, ataques, bloqueos)
 * terminaron en punto directo.
 *
 * - Saque con subtipo "ace" → cuenta.
 * - Ataque con subtipo "punto" → cuenta.
 * - Bloqueo con subtipo "punto" → cuenta.
 * - Resto → no cuenta.
 *
 * Es útil para "cuántos puntos hizo X atacando/bloqueando/sacando".
 */
export function accionesPunto(
  acciones: AccionVisual[]
): MetricaResultado {
  const visibles = acciones.filter((a) => !a.oculta);
  if (visibles.length === 0) return vacio();

  let cuenta = 0;
  for (const a of visibles) {
    const s = sub(a);
    if (a.tipo === "saque" && !a.es_rival && s === "ace") cuenta += 1;
    else if (a.tipo === "ataque" && !a.es_rival && s === "punto") cuenta += 1;
    else if (a.tipo === "bloqueo" && !a.es_rival && s === "punto") cuenta += 1;
  }

  return conteo(cuenta, visibles.length, "acciones");
}

// ------------------------------------------------------------
// DISPATCHER POR NOMBRE DE MÉTRICA
// ------------------------------------------------------------

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
    case "acciones_punto":
      return accionesPunto;
    default:
      return null;
  }
}