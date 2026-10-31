// ============================================================
// GROUP BY — agrupación + tablas + distribuciones + series
// ============================================================
// FASE 3 del plan "Consultas Analíticas Libres".
//
// v1.4 (FASE 7.1 — contexto de partido como dato de primera clase):
//   + groupBy "resultado_set" (set ganado / set perdido / sin
//     resultado).
//   + groupBy "resultado_partido" ahora devuelve una clave
//     ("partido_ganado" | "partido_perdido" | "sin_resultado")
//     en lugar del partido_id. La etiqueta ya no depende de
//     `ctx.resultadoDePartido()`.
//   + ContextoAgrupacion.resultadosSet y .resultadosPartido
//     (mapas precalculados por el ejecutor).
//   + Helpers exportados `calcularResultadosSet(partidos)` y
//     `calcularResultadosPartido(partidos)` para que el
//     ejecutor los construya desde `partidos`.
//   + `ContextoAgrupacion.resultadoDePartido` queda marcado
//     como deprecado: ya no se usa para etiquetar. Se mantiene
//     en el tipo para no romper consumidores viejos.
//
// v1.3 (FASE 6 — Opción A, familia cruces):
//   + groupBy "cruces" (cantidad exacta de cruces del rally).
//   + groupBy "duracion_rally" (bucket corto / medio / largo).
//   + ContextoAgrupacion.crucesPorPunto.
//   + Fallback: si el groupBy es cruces/duracion_rally y no
//     viene el mapa, se calcula sobre las acciones recibidas.
//
// v1.2 (FASE 6 — bloque A):
//   + groupBy "resultado_punto" + calcularResultadosPunto.
//
// v1.1 (fix build):
//   + construirComparacion normaliza base a number.
// ============================================================

import type { AccionVisual } from "../../app/equipo/adaptadorUnificadoV2";
import type { ContextoRally } from "../contextoRally";
import {
  ubicacionDeZona,
  puntajeDeAccion,
  clasificarResultado,
} from "../analisis/clasificacion";
import {
  agregar,
  agrupar,
  porcentaje,
  promedio,
  redondear,
  sumar,
} from "./agregador";
import type { AggFn, GroupBy } from "./intenciones";
import {
  CRUCES_DEFAULT_CORTO,
  CRUCES_DEFAULT_LARGO,
} from "./intenciones/cruces";
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
  /**
   * @deprecated desde v1.4: `groupBy: "resultado_partido"` ya no
   * usa esta función para etiquetar (usa el mapa
   * `resultadosPartido`). Se conserva solo por compatibilidad
   * con consumidores viejos.
   */
  resultadoDePartido?: (id: string) => string;
  /** Para groupBy "fase". */
  contextoRally?: Map<string, ContextoRally>;
  /**
   * Resultado (ganador) de cada punto. Debe calcularse sobre el
   * UNIVERSO COMPLETO (no sobre el subset filtrado).
   * Necesario para groupBy "resultado_punto".
   * Clave: `partido|set|punto`.
   */
  resultadosPunto?: Map<string, "propio" | "rival" | null>;
  /**
   * Cantidad de cruces de red de cada punto (clave "partido|set|punto").
   * Necesario para groupBy "cruces" y "duracion_rally".
   * Si no se provee, se calcula como fallback sobre las acciones.
   */
  crucesPorPunto?: Map<string, number>;
  /**
   * FASE 7.1 — Resultado de cada set.
   * Clave: `partido|set`. Valor: true (ganado) | false (perdido)
   * | null (sin resultado cargado).
   * Necesario para groupBy "resultado_set".
   */
  resultadosSet?: Map<string, boolean | null>;
  /**
   * FASE 7.1 — Resultado de cada partido.
   * Clave: `partido`. Valor: "ganado" | "perdido" | null.
   * Necesario para groupBy "resultado_partido".
   */
  resultadosPartido?: Map<string, "ganado" | "perdido" | null>;
}

// ------------------------------------------------------------
// FASE 7.1 — HELPERS PARA CONSTRUIR LOS MAPAS
// ------------------------------------------------------------
// Los usa el ejecutor. Los tipos son estructurales para no
// importar nada de `ejecutor.ts` (evita ciclo).
// ------------------------------------------------------------

export interface PartidoConResultado {
  id: string;
  /** Resultado de cada set (1..5). `null` o ausente = sin dato. */
  setGanados?: (boolean | null)[];
  /** Resultado del partido. `null`/ausente = sin dato. */
  resultado?: "ganado" | "perdido" | null;
}

/**
 * Devuelve un `Map<"partidoId|set", boolean | null>` con el
 * resultado de cada set. Solo agrega entradas para los sets que
 * tienen dato (`true` o `false`). Los sets sin dato no aparecen
 * en el mapa (y por lo tanto el groupBy cae en "sin_resultado").
 */
export function calcularResultadosSet(
  partidos: PartidoConResultado[]
): Map<string, boolean | null> {
  const out = new Map<string, boolean | null>();
  for (const p of partidos) {
    if (!p.setGanados) continue;
    p.setGanados.forEach((v, i) => {
      if (v === true || v === false) {
        out.set(`${p.id}|${i + 1}`, v);
      }
    });
  }
  return out;
}

/**
 * Devuelve un `Map<"partidoId", "ganado" | "perdido" | null>` con
 * el resultado de cada partido.
 */
export function calcularResultadosPartido(
  partidos: PartidoConResultado[]
): Map<string, "ganado" | "perdido" | null> {
  const out = new Map<string, "ganado" | "perdido" | null>();
  for (const p of partidos) {
    out.set(p.id, p.resultado ?? null);
  }
  return out;
}

// ------------------------------------------------------------
// RESULTADO DEL PUNTO — helper compartido
// ------------------------------------------------------------

export function calcularResultadosPunto(
  acciones: AccionVisual[]
): Map<string, "propio" | "rival" | null> {
  const porPunto = new Map<string, AccionVisual[]>();
  for (const a of acciones) {
    if (a.oculta) continue;
    const k = `${a.partido_id || ""}|${a.set_numero}|${a.punto_numero}`;
    let arr = porPunto.get(k);
    if (!arr) {
      arr = [];
      porPunto.set(k, arr);
    }
    arr.push(a);
  }

  const out = new Map<string, "propio" | "rival" | null>();
  for (const [k, lista] of porPunto) {
    const ordenada = [...lista].sort((a, b) => a.orden - b.orden);
    const ultima = ordenada[ordenada.length - 1];
    if (!ultima) {
      out.set(k, null);
      continue;
    }
    const cat = clasificarResultado(ultima);
    if (cat === "punto") {
      out.set(k, ultima.es_rival ? "rival" : "propio");
    } else if (cat === "error") {
      out.set(k, ultima.es_rival ? "propio" : "rival");
    } else {
      out.set(k, null);
    }
  }
  return out;
}

// ------------------------------------------------------------
// CRUCES DE RED — helper local
// ------------------------------------------------------------
// Mismo algoritmo que metricasVoley.ts (no lo importamos para
// evitar dependencia circular con groupBy).
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

/**
 * Calcula la cantidad de cruces de red de cada punto.
 * Clave: `partido|set|punto`. Valor: cantidad de cruces.
 *
 * Exportado por si el ejecutor o los tests lo necesitan.
 */
export function calcularCrucesPorPunto(
  acciones: AccionVisual[]
): Map<string, number> {
  const porPunto = new Map<string, AccionVisual[]>();
  for (const a of acciones) {
    if (a.oculta) continue;
    const k = `${a.partido_id || ""}|${a.set_numero}|${a.punto_numero}`;
    let arr = porPunto.get(k);
    if (!arr) {
      arr = [];
      porPunto.set(k, arr);
    }
    arr.push(a);
  }

  const out = new Map<string, number>();
  for (const [k, lista] of porPunto) {
    out.set(k, calcularCrucesDePunto(lista));
  }
  return out;
}

function bucketDuracion(cruces: number): "corto" | "medio" | "largo" {
  if (cruces <= CRUCES_DEFAULT_CORTO) return "corto";
  if (cruces < CRUCES_DEFAULT_LARGO) return "medio";
  return "largo";
}

// ------------------------------------------------------------
// CLAVE Y ETIQUETA POR TIPO DE ACCIÓN
// ------------------------------------------------------------

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
    case "resultado_partido": {
      // FASE 7.1 — clave = resultado del partido (no partido_id).
      const pid = a.partido_id || "";
      const g = _ctx.resultadosPartido?.get(pid);
      if (g === "ganado") return "partido_ganado";
      if (g === "perdido") return "partido_perdido";
      return "sin_resultado";
    }
    case "resultado_set": {
      // FASE 7.1 — clave = resultado del set.
      const k = `${a.partido_id || ""}|${a.set_numero}`;
      const g = _ctx.resultadosSet?.get(k);
      if (g === true) return "set_ganado";
      if (g === false) return "set_perdido";
      return "sin_resultado";
    }
    case "resultado_punto": {
      const k = `${a.partido_id || ""}|${a.set_numero}|${a.punto_numero}`;
      const g = _ctx.resultadosPunto?.get(k) ?? null;
      if (g === "propio") return "punto_propio";
      if (g === "rival") return "punto_rival";
      return "sin_ganador";
    }
    case "cruces": {
      const k = `${a.partido_id || ""}|${a.set_numero}|${a.punto_numero}`;
      const n = _ctx.crucesPorPunto?.get(k);
      if (n === undefined) return null;
      return String(n);
    }
    case "duracion_rally": {
      const k = `${a.partido_id || ""}|${a.set_numero}|${a.punto_numero}`;
      const n = _ctx.crucesPorPunto?.get(k);
      if (n === undefined) return null;
      return bucketDuracion(n);
    }
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
    case "resultado_partido": {
      // FASE 7.1 — etiqueta a partir de la clave del resultado.
      if (key === "partido_ganado") return "Partido ganado";
      if (key === "partido_perdido") return "Partido perdido";
      if (key === "sin_resultado") return "Sin resultado";
      return key;
    }
    case "resultado_set": {
      // FASE 7.1 — etiqueta a partir de la clave del resultado.
      if (key === "set_ganado") return "Set ganado";
      if (key === "set_perdido") return "Set perdido";
      if (key === "sin_resultado") return "Sin resultado";
      return key;
    }
    case "resultado_punto":
      if (key === "punto_propio") return "Punto propio";
      if (key === "punto_rival") return "Punto rival";
      if (key === "sin_ganador") return "Sin ganador";
      return key;
    case "cruces": {
      const n = parseInt(key, 10);
      if (isNaN(n)) return key;
      return n === 1 ? "1 cruce" : `${n} cruces`;
    }
    case "duracion_rally":
      if (key === "corto") {
        return `Corto (≤${CRUCES_DEFAULT_CORTO} cruces)`;
      }
      if (key === "medio") {
        return `Medio (${CRUCES_DEFAULT_CORTO + 1} cruces)`;
      }
      if (key === "largo") {
        return `Largo (≥${CRUCES_DEFAULT_LARGO} cruces)`;
      }
      return key;
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

export function agruparAcciones(
  acciones: AccionVisual[],
  groupBy: GroupBy,
  ctx: ContextoAgrupacion = {}
): Map<string, AccionVisual[]> {
  let ctxFinal: ContextoAgrupacion = ctx;

  // Fallback resultado_punto
  if (groupBy === "resultado_punto" && !ctx.resultadosPunto) {
    ctxFinal = {
      ...ctxFinal,
      resultadosPunto: calcularResultadosPunto(acciones),
    };
  }

  // Fallback cruces / duracion_rally
  if (
    (groupBy === "cruces" || groupBy === "duracion_rally") &&
    !ctxFinal.crucesPorPunto
  ) {
    ctxFinal = {
      ...ctxFinal,
      crucesPorPunto: calcularCrucesPorPunto(acciones),
    };
  }

  // FASE 7.1 — los mapas de resultado_set / resultado_partido NO
  // tienen fallback: si el ejecutor no los pasa, todos los grupos
  // caen en "sin_resultado". Es preferible a inventar datos.

  return agrupar(
    acciones.filter((a) => !a.oculta),
    (a) => claveDeGrupo(a, groupBy, ctxFinal)
  );
}

// ------------------------------------------------------------
// SELECTOR DE VALOR PARA AGREGAR
// ------------------------------------------------------------

function selectorPara(agg: AggFn): (a: AccionVisual) => number | null {
  if (agg === "count") return () => 1;
  return (a) => puntajeDeAccion(a);
}

// ------------------------------------------------------------
// TABLA
// ------------------------------------------------------------

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

  items.sort((a, b) => b.count - a.count);
  return items;
}

// ------------------------------------------------------------
// SERIE
// ------------------------------------------------------------

export function construirSerie(
  acciones: AccionVisual[],
  eje: "set" | "partido" | "rotacion",
  agg: AggFn,
  ctx: ContextoAgrupacion = {}
): PuntoSerie[] {
  const visibles = acciones.filter((a) => !a.oculta);
  const total = visibles.length;

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

    let x: string | number;
    if (eje === "set" || eje === "rotacion") {
      x = parseInt(key, 10);
    } else {
      x = key;
    }

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

  if (eje === "set" || eje === "rotacion") {
    puntos.sort((a, b) => Number(a.x) - Number(b.x));
  }

  return puntos;
}

// ------------------------------------------------------------
// HABIT
// ------------------------------------------------------------

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

export function contarVisibles(acciones: AccionVisual[]): number {
  return acciones.filter((a) => !a.oculta).length;
}

export function sumaDePuntajes(acciones: AccionVisual[]): number {
  const puntajes: number[] = [];
  for (const a of acciones) {
    const p = puntajeDeAccion(a);
    if (p !== null) puntajes.push(p);
  }
  return sumar(puntajes);
}

export function promedioDePuntajes(acciones: AccionVisual[]): number {
  const puntajes: number[] = [];
  for (const a of acciones) {
    const p = puntajeDeAccion(a);
    if (p !== null) puntajes.push(p);
  }
  return redondear(promedio(puntajes), 2);
}