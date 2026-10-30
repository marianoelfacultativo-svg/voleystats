// ============================================================
// MÉTRICAS DE VÓLEY — cálculos estándar
// ============================================================
// FASE 3 + FASE 6 del plan "Consultas Analíticas Libres".
//
// v1.4 (FASE 6 — Opción A, familia cruces de red):
//   + calcularCrucesDePunto(lista): helper local.
//   + crucesPromedio(puntos): promedio de cruces por rally.
//   + crucesTotal(puntos): total de cruces del universo.
//   + crucesMax(puntos): máximo de cruces en un rally.
//   + rallysLargos(puntos): rallys con >= CRUCES_DEFAULT_LARGO.
//   + rallysCortos(puntos): rallys con <= CRUCES_DEFAULT_CORTO.
//   + rallysMedios(puntos): rallys con exactamente 3 cruces.
//
// v1.3 (FASE 6 — Ronda 1.2):
//   + puntosPorDimension(puntos, groupBy, contexto).
//
// v1.2 (FASE 6 — bloque A.2):
//   + puntosGanadosPct(puntos).
//
// v1.1 (FASE 6):
//   + puntosGanados(puntos) + accionesPunto(acciones).
//
// v1.0:
//   + Las 12 métricas originales (kill %, sideout %, etc.).
// ============================================================

import type {
  AccionVisual,
  PuntoConAcciones,
} from "../../app/equipo/adaptadorUnificadoV2";
import type { ContextoRally } from "../contextoRally";
import {
  baseSubtipo,
  clasificarResultado,
  ubicacionDeZona,
} from "../analisis/clasificacion";
import { redondear } from "./agregador";
import type { GroupBy } from "./intenciones";
import {
  CRUCES_DEFAULT_CORTO,
  CRUCES_DEFAULT_LARGO,
} from "./intenciones/cruces";

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
// CRUCES DE RED POR PUNTO
// ------------------------------------------------------------
// Un "cruce" es cada cambio de lado entre acciones consecutivas
// visibles. Un overpass también cuenta (la pelota cruzó la red).
// ------------------------------------------------------------

function calcularCrucesDePunto(lista: AccionVisual[]): number {
  const visibles = lista
    .filter((x) => !x.oculta)
    .sort((x, y) => x.orden - y.orden);
  let cruces = 0;
  for (let i = 1; i < visibles.length; i++) {
    if (visibles[i].lado !== visibles[i - 1].lado) cruces += 1;
  }
  return cruces;
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
// PUNTOS POR SET / ROTACIÓN (promedios)
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
// PUNTOS GANADOS (conteo absoluto)
// ------------------------------------------------------------

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

// ------------------------------------------------------------
// % DE PUNTOS GANADOS
// ------------------------------------------------------------

export function puntosGanadosPct(
  puntos: PuntoConAcciones[]
): MetricaResultado {
  if (puntos.length === 0) return vacio();

  let total = 0;
  let ganados = 0;
  for (const p of puntos) {
    const g = ganadorDelPunto(p.acciones);
    if (g === null) continue;
    total += 1;
    if (g === "propio") ganados += 1;
  }

  if (total === 0) return vacio();
  return pct(ganados, total);
}

// ------------------------------------------------------------
// ACCIONES EN PUNTO
// ------------------------------------------------------------

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
// CRUCES DE RED — MÉTRICAS AGREGADAS (Opción A)
// ------------------------------------------------------------

/**
 * Promedio de cruces de red por rally.
 *
 * Cuenta cambios de lado por punto (incluye overpass) y divide
 * por la cantidad de rallies con al menos 1 acción visible.
 *
 * Si la pregunta original dice "por punto" o "por rally", esta
 * es la métrica. El motor la devuelve como número decimal.
 */
export function crucesPromedio(
  puntos: PuntoConAcciones[]
): MetricaResultado {
  let totalPuntos = 0;
  let sumaCruces = 0;

  for (const p of puntos) {
    const visibles = p.acciones.filter((a) => !a.oculta);
    if (visibles.length === 0) continue;
    sumaCruces += calcularCrucesDePunto(p.acciones);
    totalPuntos += 1;
  }

  if (totalPuntos === 0) return vacio();

  const promedio = sumaCruces / totalPuntos;
  return {
    valor: redondear(promedio, 2),
    numerador: sumaCruces,
    denominador: totalPuntos,
    descripcion:
      `${sumaCruces} cruces en ${totalPuntos} rallies ` +
      `(${redondear(promedio, 2)} cruces/rally)`,
  };
}

/**
 * Total de cruces de red en el universo.
 */
export function crucesTotal(
  puntos: PuntoConAcciones[]
): MetricaResultado {
  let total = 0;
  for (const p of puntos) {
    total += calcularCrucesDePunto(p.acciones);
  }
  return conteo(total, puntos.length, "cruces");
}

/**
 * Máximo de cruces en un solo rally.
 */
export function crucesMax(
  puntos: PuntoConAcciones[]
): MetricaResultado {
  let max = 0;
  for (const p of puntos) {
    const c = calcularCrucesDePunto(p.acciones);
    if (c > max) max = c;
  }
  return conteo(max, puntos.length, "cruces (máximo)");
}

/**
 * Cantidad de rallies largos (≥ CRUCES_DEFAULT_LARGO cruces).
 */
export function rallysLargos(
  puntos: PuntoConAcciones[]
): MetricaResultado {
  let cuenta = 0;
  for (const p of puntos) {
    if (calcularCrucesDePunto(p.acciones) >= CRUCES_DEFAULT_LARGO) {
      cuenta += 1;
    }
  }
  return conteo(cuenta, puntos.length, "rallys largos");
}

/**
 * Cantidad de rallies cortos (≤ CRUCES_DEFAULT_CORTO cruces).
 */
export function rallysCortos(
  puntos: PuntoConAcciones[]
): MetricaResultado {
  let cuenta = 0;
  for (const p of puntos) {
    if (calcularCrucesDePunto(p.acciones) <= CRUCES_DEFAULT_CORTO) {
      cuenta += 1;
    }
  }
  return conteo(cuenta, puntos.length, "rallys cortos");
}

/**
 * Cantidad de rallies "medios": exactamente 3 cruces.
 *
 * Nota: con los cortes actuales (corto ≤ 2, largo ≥ 3), "medio"
 * es el primer valor de "largo". Es un atajo útil para "rallies
 * que llegaron a 3 cruces exactos".
 */
export function rallysMedios(
  puntos: PuntoConAcciones[]
): MetricaResultado {
  let cuenta = 0;
  for (const p of puntos) {
    if (calcularCrucesDePunto(p.acciones) === 3) cuenta += 1;
  }
  return conteo(cuenta, puntos.length, "rallys de 3 cruces");
}

// ------------------------------------------------------------
// PUNTOS POR DIMENSIÓN (FASE 6 — Ronda 1.2)
// ------------------------------------------------------------

export interface PuntoDimension {
  key: string;
  label: string;
  count: number;
}

export function puntosPorDimension(
  puntos: PuntoConAcciones[],
  groupBy: GroupBy,
  contexto?: {
    nombreDeJugador?: (id: string) => string;
  }
): PuntoDimension[] {
  if (puntos.length === 0) return [];

  const mapa = new Map<string, PuntoDimension>();

  for (const p of puntos) {
    if (ganadorDelPunto(p.acciones) !== "propio") continue;

    const propias = p.acciones
      .filter((a) => !a.es_rival && !a.oculta)
      .sort((a, b) => b.orden - a.orden);

    if (propias.length === 0) continue;

    let key: string | null = null;
    let label: string | null = null;

    switch (groupBy) {
      case "rotacion": {
        const conRot = propias.find((a) => a.rotacion_numero !== null);
        if (!conRot || conRot.rotacion_numero === null) continue;
        key = String(conRot.rotacion_numero);
        label = `R${conRot.rotacion_numero}`;
        break;
      }
      case "zona_origen": {
        const ataque = propias.find((a) => a.tipo === "ataque");
        if (!ataque || ataque.zona_origen === null) continue;
        key = String(ataque.zona_origen);
        label = `Z${ataque.zona_origen} (origen)`;
        break;
      }
      case "jugador": {
        const ultima = propias[0];
        if (!ultima.jugador_id) continue;
        key = ultima.jugador_id;
        label =
          contexto?.nombreDeJugador?.(ultima.jugador_id) ??
          ultima.jugador_id.slice(0, 8);
        break;
      }
      case "ubicacion": {
        const ultima = propias[0];
        if (ultima.rol_jugador === "L") {
          key = "libero";
          label = "Líbero";
        } else {
          const ubi = ubicacionDeZona(ultima.zona_jugador);
          if (ubi === "otro") continue;
          key = ubi;
          label = ubi === "delantero" ? "Delantero" : "Zaguero";
        }
        break;
      }
      case "rol": {
        const ultima = propias[0];
        if (!ultima.rol_jugador) continue;
        key = ultima.rol_jugador;
        label = ultima.rol_jugador;
        break;
      }
      default:
        return [];
    }

    if (key === null || label === null) continue;

    let item = mapa.get(key);
    if (!item) {
      item = { key, label, count: 0 };
      mapa.set(key, item);
    }
    item.count += 1;
  }

  return Array.from(mapa.values()).sort((a, b) => b.count - a.count);
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