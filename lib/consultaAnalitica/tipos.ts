// ============================================================
// TIPOS — Respuesta de una consulta analítica
// ============================================================
// FASE 3 del plan "Consultas Analíticas Libres".
//
// v1.1 (FASE 7.5 — AST compilado):
//   + Nuevo tipo `RespuestaComparacionBaseline` con:
//       filtrada, general, diferencia,
//       puntosQueCumplen, puntosTotales.
//   + Se agrega a la union `RespuestaConsulta`.
//   + Nueva factory `respuestaComparacionBaseline(...)`.
//
// v1.0:
//   + Tipos base (numero, porcentaje, promedio, frecuencia,
//     max/min, ranking, tabla, distribucion, serie, habit,
//     comparacion, texto, vacio).
// ============================================================

import type { AggFn, GroupBy, TipoIntencion } from "./intenciones";

// ------------------------------------------------------------
// RESULTADOS PARCIALES
// ------------------------------------------------------------

export interface FilaTabla {
  key: string;
  label: string;
  count: number;
  base: number | null;
  valor: number;
  porcentaje: number | null;
  extra: number | null;
}

export interface ItemDistribucion {
  key: string;
  label: string;
  count: number;
  porcentaje: number;
}

export interface PuntoSerie {
  x: string | number;
  label: string;
  y: number;
  base: number | null;
  porcentaje: number | null;
}

// ------------------------------------------------------------
// RESULTADO FINAL
// ------------------------------------------------------------

export type RespuestaConsulta =
  | RespuestaNumero
  | RespuestaPorcentaje
  | RespuestaPromedio
  | RespuestaFrecuencia
  | RespuestaMaxMin
  | RespuestaRanking
  | RespuestaTabla
  | RespuestaDistribucion
  | RespuestaSerie
  | RespuestaHabit
  | RespuestaComparacion
  | RespuestaComparacionBaseline
  | RespuestaTexto
  | RespuestaVacia;

export interface RespuestaNumero {
  tipo: "numero";
  valor: number;
  unidad: string | null;
  detalle: string | null;
}

export interface RespuestaPorcentaje {
  tipo: "porcentaje";
  valor: number;
  count: number;
  base: number;
  detalle: string | null;
}

export interface RespuestaPromedio {
  tipo: "promedio";
  valor: number;
  n: number;
  detalle: string | null;
}

export interface RespuestaFrecuencia {
  tipo: "frecuencia";
  valor: number;
  base: number;
  count: number;
  detalle: string | null;
}

export interface RespuestaMaxMin {
  tipo: "max" | "min";
  fila: FilaTabla | null;
  detalle: string | null;
}

export interface RespuestaRanking {
  tipo: "ranking";
  filas: FilaTabla[];
  agregacion: AggFn;
  orden: "asc" | "desc";
  detalle: string | null;
}

export interface RespuestaTabla {
  tipo: "tabla";
  groupBy: GroupBy | null;
  filas: FilaTabla[];
  agregacion: AggFn;
  total: FilaTabla | null;
  detalle: string | null;
}

export interface RespuestaDistribucion {
  tipo: "distribucion";
  groupBy: GroupBy | null;
  items: ItemDistribucion[];
  total: number;
  detalle: string | null;
}

export interface RespuestaSerie {
  tipo: "serie";
  eje: string;
  puntos: PuntoSerie[];
  agregacion: AggFn;
  detalle: string | null;
}

export interface RespuestaHabit {
  tipo: "habit";
  valorMasFrecuente: string | null;
  etiqueta: string | null;
  porcentaje: number;
  total: number;
  items: ItemDistribucion[];
  detalle: string | null;
}

export interface RespuestaComparacion {
  tipo: "comparacion";
  a: { etiqueta: string; valor: number; count: number; base: number };
  b: { etiqueta: string; valor: number; count: number; base: number };
  diferencia: number;
  detalle: string | null;
}

/**
 * Comparación filtrada vs baseline general.
 * Se produce cuando `condicion.compararConBaseline === true`.
 *
 * Ejemplo: "cuando al rival le faltan la mitad de puntos,
 *           cómo varía la efectividad respecto al general".
 *
 * - `filtrada`  = métrica sobre los puntos que cumplen el filtro.
 * - `general`   = métrica sobre TODOS los puntos (baseline).
 * - `diferencia`= filtrada - general.
 * - `puntosQueCumplen` / `puntosTotales` = tamaño de cada conjunto.
 */
export interface RespuestaComparacionBaseline {
  tipo: "comparacion_baseline";
  metrica: string;
  filtrada: number;
  general: number;
  diferencia: number;
  puntosQueCumplen: number;
  puntosTotales: number;
  detalle: string | null;
}

export interface RespuestaTexto {
  tipo: "texto";
  texto: string;
  detalle: string | null;
}

export interface RespuestaVacia {
  tipo: "vacio";
  mensaje: string;
}

// ------------------------------------------------------------
// METADATOS DE LA CONSULTA
// ------------------------------------------------------------

export interface MetaConsulta {
  original: string;
  intencion: TipoIntencion;
  agregacion: AggFn;
  groupBy: GroupBy | null;
  metrica: string | null;
  totalAcciones: number;
  totalUniverso: number;
}

export interface ResultadoConsulta {
  respuesta: RespuestaConsulta;
  meta: MetaConsulta;
  fragmentos: string[];
  noReconocidas: string[];
}

// ------------------------------------------------------------
// HELPERS DE CREACIÓN
// ------------------------------------------------------------

export function respuestaVacia(
  mensaje = "No hay datos para esta consulta."
): RespuestaVacia {
  return { tipo: "vacio", mensaje };
}

export function respuestaNumero(
  valor: number,
  unidad: string | null = null,
  detalle: string | null = null
): RespuestaNumero {
  return { tipo: "numero", valor, unidad, detalle };
}

export function respuestaPorcentaje(
  count: number,
  base: number,
  detalle: string | null = null
): RespuestaPorcentaje {
  const valor = base > 0 ? (count / base) * 100 : 0;
  return { tipo: "porcentaje", valor, count, base, detalle };
}

export function respuestaPromedio(
  suma: number,
  n: number,
  detalle: string | null = null
): RespuestaPromedio {
  const valor = n > 0 ? suma / n : 0;
  return { tipo: "promedio", valor, n, detalle };
}

export function respuestaFrecuencia(
  count: number,
  base: number,
  detalle: string | null = null
): RespuestaFrecuencia {
  const valor = count > 0 ? base / count : 0;
  return { tipo: "frecuencia", valor, base, count, detalle };
}

export function respuestaTexto(
  texto: string,
  detalle: string | null = null
): RespuestaTexto {
  return { tipo: "texto", texto, detalle };
}

export function respuestaDistribucion(
  items: ItemDistribucion[],
  groupBy: GroupBy | null,
  detalle: string | null = null
): RespuestaDistribucion {
  const total = items.reduce((s, it) => s + it.count, 0);
  return { tipo: "distribucion", groupBy, items, total, detalle };
}

export function respuestaSerie(
  eje: string,
  puntos: PuntoSerie[],
  agregacion: AggFn,
  detalle: string | null = null
): RespuestaSerie {
  return { tipo: "serie", eje, puntos, agregacion, detalle };
}

export function respuestaRanking(
  filas: FilaTabla[],
  agregacion: AggFn,
  orden: "asc" | "desc" = "desc",
  detalle: string | null = null
): RespuestaRanking {
  return { tipo: "ranking", filas, agregacion, orden, detalle };
}

export function respuestaTabla(
  filas: FilaTabla[],
  groupBy: GroupBy | null,
  agregacion: AggFn,
  total: FilaTabla | null = null,
  detalle: string | null = null
): RespuestaTabla {
  return {
    tipo: "tabla",
    groupBy,
    filas,
    agregacion,
    total,
    detalle,
  };
}

export function respuestaHabit(
  valorMasFrecuente: string | null,
  etiqueta: string | null,
  items: ItemDistribucion[],
  detalle: string | null = null
): RespuestaHabit {
  const total = items.reduce((s, it) => s + it.count, 0);
  const top = items[0];
  return {
    tipo: "habit",
    valorMasFrecuente,
    etiqueta,
    porcentaje: top?.porcentaje ?? 0,
    total,
    items,
    detalle,
  };
}

export function respuestaMaxMin(
  tipo: "max" | "min",
  fila: FilaTabla | null,
  detalle: string | null = null
): RespuestaMaxMin {
  return { tipo, fila, detalle };
}

export function respuestaComparacion(
  a: RespuestaComparacion["a"],
  b: RespuestaComparacion["b"],
  detalle: string | null = null
): RespuestaComparacion {
  return {
    tipo: "comparacion",
    a,
    b,
    diferencia: b.valor - a.valor,
    detalle,
  };
}

export function respuestaComparacionBaseline(
  metrica: string,
  filtrada: number,
  general: number,
  puntosQueCumplen: number,
  puntosTotales: number,
  detalle: string | null = null
): RespuestaComparacionBaseline {
  return {
    tipo: "comparacion_baseline",
    metrica,
    filtrada,
    general,
    diferencia: filtrada - general,
    puntosQueCumplen,
    puntosTotales,
    detalle,
  };
}