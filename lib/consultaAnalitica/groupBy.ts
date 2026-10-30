// ============================================================
// GROUP BY — agrupación + tablas + distribuciones + series
// ============================================================
// FASE 3 del plan "Consultas Analíticas Libres".
//
// Dado un GroupBy (set, jugador, rotacion, ubicacion, cambio, …)
// y un conjunto de acciones YA FILTRADAS por el motor, produce:
//   - FilaTabla[]           (para RespuestaTabla / Ranking)
//   - ItemDistribucion[]    (para RespuestaDistribucion / Habit)
//   - PuntoSerie[]          (para RespuestaSerie / Trend)
//
// No sabe nada de UI. No sabe nada de intención. Solo agrupa.
//
// Necesita contexto externo para algunas dimensiones:
//   - fase         → necesita `contextoRally`
//   - rival        → necesita `rivalDePartido`
//   - resultado_partido → necesita `resultadoDePartido`
//   - jugador      → necesita `nombreDeJugador`
//   - partido      → necesita `nombreDePartido`
//
// Si falta el contexto, la fila se etiqueta con el id crudo.
//
// v1.1 (fix build):
//   + `construirComparacion` normaliza `base` a `number` (0 si null)
//     para que el tipo de retorno sea compatible con `FilaTabla`.
// ============================================================

import type { AccionVisual } from "../../app/equipo/adaptadorUnificadoV2";
import type { ContextoRally } from "../contextoRally";
import { ubicacionDeZona, puntajeDeAccion } from "../analisis/clasificacion";
import {
  agregar,
  agrupar,
  porcentaje,
  promedio,
  redondear,
  sumar,
} from "./agregador";
import type { AggFn, GroupBy } from "./intenciones";
import type {
  FilaTabla,
  ItemDistribucion,
  PuntoSerie,
} from "./tipos";

// ------------------------------------------------------------
// CONTEXTO EXTERNO
// ------------------------------------------------------------

export interface ContextoAgrupacion {
  /** Para etiquetar "jugador". */
  nombreDeJugador?: (id: string) => string;
  /** Para etiquetar "partido". */
  nombreDePartido?: (id: string) => string;
  /** Para etiquetar "rival". */
  rivalDePartido?: (id: string) => string;
  /** Para etiquetar "resultado_partido". */
  resultadoDePartido?: (id: string) => string;
  /** Para groupBy "fase". */
  contextoRally?: Map<string, ContextoRally>;
}

// ------------------------------------------------------------
// CLAVE Y ETIQUETA POR TIPO DE ACCIÓN
// ------------------------------------------------------------

/**
 * Devuelve la clave de agrupación de una acción según `groupBy`.
 * `null` = la acción no tiene esa dimensión (se ignora).
 */
export function claveDeGrupo(
  a: AccionVisual,
  groupBy: GroupBy,
  _ctx: ContextoAgrupacion = {}
): string | null {
  switch (groupBy) {
    case "set":
      return String(a.set_numero);
    case "partido":
      return a.partido_id || null;
    case "jugador":
      return a.jugador_id;
    case "zona_origen":
      return a.zona_origen !== null ? String(a.zona_origen) : null;
    case "zona_destino":
      return a.zona_destino !== null ? String(a.zona_destino) : null;
    case "zona_jugador":
      return a.zona_jugador !== null ? String(a.zona_jugador) : null;
    case "rotacion":
      return a.rotacion_numero !== null
        ? String(a.rotacion_numero)
        : null;
    case "rol":
      return a.rol_jugador;
    case "ubicacion": {
      if (a.rol_jugador === "L") return "libero";
      const ubi = ubicacionDeZona(a.zona_jugador);
      return ubi === "otro" ? null : ubi;
    }
    case "fase": {
      const ctx = _ctx.contextoRally?.get(a.id);
      return ctx?.fase ?? null;
    }
    case "rival":
      return a.partido_id || null;
    case "resultado_partido":
      return a.partido_id || null;
    case "tipo":
      return a.tipo;
    case "subtipo": {
      const s =
        a.subtipo !== null && a.subtipo !== undefined
          ? String(a.subtipo)
          : null;
      if (s === null) return null;
      return s.startsWith("toque:") ? s.slice(6) : s;
    }
    case "velocidad":
      return a.velocidad !== null ? String(a.velocidad) : null;
    case "tipo_saque":
      return a.tipo_saque;
    case "variante":
      return a.variante ?? "remate";
    case "cambio":
      return a.cambioEnPunto ? "con_cambio" : "sin_cambio";
    default:
      return null;
  }
}

/**
 * Devuelve la etiqueta visible de una clave de grupo.
 */
export function etiquetaDeGrupo(
  groupBy: GroupBy,
  key: string,
  ctx: ContextoAgrupacion = {}
): string {
  switch (groupBy) {
    case "set":
      return `Set ${key}`;
    case "partido":
      return ctx.nombreDePartido ? ctx.nombreDePartido(key) : key.slice(0, 8);
    case "jugador":
      return ctx.nombreDeJugador ? ctx.nombreDeJugador(key) : key.slice(0, 8);
    case "zona_origen":
      return `Z${key} (origen)`;
    case "zona_destino":
      return `Z${key} (destino)`;
    case "zona_jugador":
      return `Z${key} (jugador)`;
    case "rotacion":
      return `R${key}`;
    case "rol":
      return key;
    case "ubicacion":
      if (key === "delantero") return "Delantero";
      if (key === "zaguero") return "Zaguero";
      if (key === "libero") return "Líbero";
      if (key === "otro") return "Otro";
      return key;
    case "fase":
      if (key === "side-out") return "Side-out (K1)";
      if (key === "k2") return "Contraataque defensa (K2)";
      if (key === "k3") return "Contraataque cobertura (K3)";
      if (key === "contraataque") return "Contraataque";
      if (key === "free-ball") return "Free ball";
      if (key === "otro") return "Otro";
      return key;
    case "rival":
      return ctx.rivalDePartido ? ctx.rivalDePartido(key) : key.slice(0, 8);
    case "resultado_partido":
      return ctx.resultadoDePartido
        ? ctx.resultadoDePartido(key)
        : key.slice(0, 8);
    case "tipo":
      return capitalizar(key);
    case "subtipo":
      return key.replace(/_/g, " ");
    case "velocidad":
      return `v${key}`;
    case "tipo_saque":
      return key === "potencia"
        ? "Potencia"
        : key === "flotado"
        ? "Flotado"
        : key;
    case "variante":
      return key === "toque" ? "Toque" : "Remate";
    case "cambio":
      return key === "con_cambio" ? "Con cambio" : "Sin cambio";
    default:
      return key;
  }
}

function capitalizar(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ------------------------------------------------------------
// AGRUPACIÓN
// ------------------------------------------------------------

/**
 * Agrupa `acciones` por la dimensión `groupBy`.
 * Las acciones sin esa dimensión se ignoran (no van a ningún grupo).
 */
export function agruparAcciones(
  acciones: AccionVisual[],
  groupBy: GroupBy,
  ctx: ContextoAgrupacion = {}
): Map<string, AccionVisual[]> {
  return agrupar(
    acciones.filter((a) => !a.oculta),
    (a) => claveDeGrupo(a, groupBy, ctx)
  );
}

// ------------------------------------------------------------
// SELECTOR DE VALOR PARA AGREGAR
// ------------------------------------------------------------

function selectorPara(agg: AggFn): (a: AccionVisual) => number | null {
  if (agg === "count") return () => 1;
  // Para avg / median / sum / max / min, usamos el puntaje de la
  // acción (0..10). Es el mismo puntaje que usa top% y vsPromedio.
  return (a) => puntajeDeAccion(a);
}

// ------------------------------------------------------------
// TABLA
// ------------------------------------------------------------

/**
 * Construye las filas de una tabla agrupada por `groupBy`, con la
 * agregación `agg` para el valor de cada fila.
 *
 * `porcentaje` es siempre count/grupo ÷ count_total × 100, sin
 * importar la agregación (es la columna "% del total").
 */
export function construirTabla(
  acciones: AccionVisual[],
  groupBy: GroupBy,
  agg: AggFn,
  ctx: ContextoAgrupacion = {}
): FilaTabla[] {
  const visibles = acciones.filter((a) => !a.oculta);
  const total = visibles.length;
  const grupos = agruparAcciones(visibles, groupBy, ctx);
  const selector = selectorPara(agg);

  const filas: FilaTabla[] = [];
  for (const [key, items] of grupos) {
    const count = items.length;
    const valor =
      agg === "percentage"
        ? porcentaje(count, total)
        : agregar(items, selector, agg);
    const base = total > 0 ? total : null;
    const pctFila = total > 0 ? (count / total) * 100 : 0;

    filas.push({
      key,
      label: etiquetaDeGrupo(groupBy, key, ctx),
      count,
      base,
      valor: redondear(valor, 2),
      porcentaje: redondear(pctFila, 1),
      extra: null,
    });
  }

  return filas;
}

// ------------------------------------------------------------
// DISTRIBUCIÓN
// ------------------------------------------------------------

/**
 * Construye una distribución (lista de items con % sobre el total).
 *
 * Si `groupBy` es null, devuelve un solo item con todo (100%).
 */
export function construirDistribucion(
  acciones: AccionVisual[],
  groupBy: GroupBy | null,
  ctx: ContextoAgrupacion = {}
): ItemDistribucion[] {
  const visibles = acciones.filter((a) => !a.oculta);
  const total = visibles.length;
  if (total === 0) return [];

  if (groupBy === null) {
    return [
      {
        key: "total",
        label: "Total",
        count: total,
        porcentaje: 100,
      },
    ];
  }

  const grupos = agruparAcciones(visibles, groupBy, ctx);
  const items: ItemDistribucion[] = [];
  for (const [key, itemsGrupo] of grupos) {
    const count = itemsGrupo.length;
    items.push({
      key,
      label: etiquetaDeGrupo(groupBy, key, ctx),
      count,
      porcentaje: redondear((count / total) * 100, 1),
    });
  }

  // Ordenar de mayor a menor count.
  items.sort((a, b) => b.count - a.count);
  return items;
}

// ------------------------------------------------------------
// SERIE
// ------------------------------------------------------------

/**
 * Construye una serie temporal / ordinal.
 *
 * El eje puede ser:
 *   - "set"       → x = 1..N
 *   - "partido"   → x = id del partido
 *   - "rotacion"  → x = 1..6
 *
 * Para cada punto del eje calcula:
 *   - y = agregación (count / avg / percentage / …)
 *   - base = count del grupo
 *   - porcentaje = base / total × 100
 */
export function construirSerie(
  acciones: AccionVisual[],
  eje: "set" | "partido" | "rotacion",
  agg: AggFn,
  ctx: ContextoAgrupacion = {}
): PuntoSerie[] {
  const visibles = acciones.filter((a) => !a.oculta);
  const total = visibles.length;

  // Clave del eje por acción.
  const keyFn = (a: AccionVisual): string | null => {
    if (eje === "set") return String(a.set_numero);
    if (eje === "partido") return a.partido_id || null;
    if (eje === "rotacion")
      return a.rotacion_numero !== null
        ? String(a.rotacion_numero)
        : null;
    return null;
  };

  const grupos = agrupar(visibles, keyFn);
  const selector = selectorPara(agg);

  const puntos: PuntoSerie[] = [];
  for (const [key, items] of grupos) {
    const count = items.length;
    let valor: number;
    if (agg === "percentage") {
      valor = porcentaje(count, total);
    } else {
      valor = agregar(items, selector, agg);
    }

    // x según eje
    let x: string | number;
    if (eje === "set" || eje === "rotacion") {
      x = parseInt(key, 10);
    } else {
      x = key;
    }

    // label según eje
    let label: string;
    if (eje === "set") {
      label = `Set ${key}`;
    } else if (eje === "rotacion") {
      label = `R${key}`;
    } else {
      label = ctx.nombreDePartido ? ctx.nombreDePartido(key) : key.slice(0, 8);
    }

    puntos.push({
      x,
      label,
      y: redondear(valor, 2),
      base: count,
      porcentaje: total > 0 ? redondear((count / total) * 100, 1) : null,
    });
  }

  // Ordenar por x si es numérico.
  if (eje === "set" || eje === "rotacion") {
    puntos.sort((a, b) => Number(a.x) - Number(b.x));
  }

  return puntos;
}

// ------------------------------------------------------------
// HABIT (valor más frecuente)
// ------------------------------------------------------------

/**
 * Devuelve el valor más frecuente de `groupBy` y su distribución.
 * Pensado para "¿qué suele hacer cuando…?".
 *
 * Si no hay acciones, devuelve valor = null, items = [].
 */
export function construirHabit(
  acciones: AccionVisual[],
  groupBy: GroupBy,
  ctx: ContextoAgrupacion = {}
): {
  valorMasFrecuente: string | null;
  etiqueta: string | null;
  items: ItemDistribucion[];
  total: number;
} {
  const items = construirDistribucion(acciones, groupBy, ctx);
  const total = items.reduce((s, it) => s + it.count, 0);
  const top = items[0] ?? null;
  return {
    valorMasFrecuente: top?.key ?? null,
    etiqueta: top?.label ?? null,
    items,
    total,
  };
}

// ------------------------------------------------------------
// RANKING
// ------------------------------------------------------------

/**
 * Construye un ranking: agrupa por `groupBy`, calcula la
 * agregación `agg` para cada fila, y ordena por `valor`.
 *
 * Si `limite` no es null, corta las primeras N filas.
 */
export function construirRanking(
  acciones: AccionVisual[],
  groupBy: GroupBy,
  agg: AggFn,
  orden: "asc" | "desc" = "desc",
  limite: number | null = null,
  ctx: ContextoAgrupacion = {}
): FilaTabla[] {
  const filas = construirTabla(acciones, groupBy, agg, ctx);
  filas.sort((a, b) =>
    orden === "desc" ? b.valor - a.valor : a.valor - b.valor
  );
  if (limite !== null && limite > 0) return filas.slice(0, limite);
  return filas;
}

// ------------------------------------------------------------
// HELPERS DE COMPARACIÓN
// ------------------------------------------------------------

/**
 * Para una comparación "A vs B", agrupa por jugador y devuelve
 * dos filas (una por cada id recibido), con count / base / valor.
 *
 * No decide qué es "A" ni "B": eso lo resuelve el motor (FASE 3).
 *
 * `base` siempre se normaliza a `number` (0 si era null) para
 * que coincida con el tipo de retorno esperado.
 */
export function construirComparacion(
  acciones: AccionVisual[],
  groupBy: GroupBy,
  agg: AggFn,
  idA: string,
  idB: string,
  ctx: ContextoAgrupacion = {}
): {
  a: { key: string; label: string; count: number; base: number; valor: number };
  b: { key: string; label: string; count: number; base: number; valor: number };
} {
  const filas = construirTabla(acciones, groupBy, agg, ctx);
  const filaA = filas.find((f) => f.key === idA);
  const filaB = filas.find((f) => f.key === idB);
  const totalBase = filas.reduce((s, f) => s + f.count, 0);

  const normalizar = (
    fila: FilaTabla | undefined,
    key: string
  ): {
    key: string;
    label: string;
    count: number;
    base: number;
    valor: number;
  } => {
    if (!fila) {
      return { key, label: key, count: 0, base: totalBase, valor: 0 };
    }
    return {
      key: fila.key,
      label: fila.label,
      count: fila.count,
      base: fila.base ?? 0,
      valor: fila.valor,
    };
  };

  return {
    a: normalizar(filaA, idA),
    b: normalizar(filaB, idB),
  };
}

// ------------------------------------------------------------
// HELPERS DE UTILIDAD
// ------------------------------------------------------------

/** Total de acciones visibles (sin ocultas). */
export function contarVisibles(acciones: AccionVisual[]): number {
  return acciones.filter((a) => !a.oculta).length;
}

/** Suma de puntajes de las acciones (para promedios simples). */
export function sumaDePuntajes(acciones: AccionVisual[]): number {
  const puntajes: number[] = [];
  for (const a of acciones) {
    const p = puntajeDeAccion(a);
    if (p !== null) puntajes.push(p);
  }
  return sumar(puntajes);
}

/** Promedio de puntajes (0..10). */
export function promedioDePuntajes(acciones: AccionVisual[]): number {
  const puntajes: number[] = [];
  for (const a of acciones) {
    const p = puntajeDeAccion(a);
    if (p !== null) puntajes.push(p);
  }
  return redondear(promedio(puntajes), 2);
}