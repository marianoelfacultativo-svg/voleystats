// ============================================================
// TIPOS — Respuesta de una consulta analítica
// ============================================================
// FASE 3 del plan "Consultas Analíticas Libres".
//
// Acá viven SOLO los tipos de salida del motor de cálculo.
// Cada intención (count, percentage, average, frequency, etc.)
// produce una `RespuestaConsulta` distinta, que la UI de FASE 5
// va a renderizar según corresponda.
//
// No hay lógica acá. Solo tipos + helper de respuesta vacía.
// ============================================================

import type { AggFn, GroupBy, TipoIntencion } from "./intenciones";

// ------------------------------------------------------------
// RESULTADOS PARCIALES
// ------------------------------------------------------------

export interface FilaTabla {
  /** Clave interna (por ejemplo "set-3", "jugador-abc", "zona-4"). */
  key: string;
  /** Etiqueta visible ("Set 3", "Juan #7", "Zona 4"). */
  label: string;
  /** Cuántas acciones cayeron en esta fila (numerador). */
  count: number;
  /** Denominador (para porcentajes / promedios). null = no aplica. */
  base: number | null;
  /** Valor principal de la fila (count, %, avg, etc.). */
  valor: number;
  /** % del total, si aplica (0..100). */
  porcentaje: number | null;
  /** Valor adicional opcional (ej. efectividad, eficiencia, etc.). */
  extra: number | null;
}

export interface ItemDistribucion {
  key: string;
  label: string;
  count: number;
  /** % sobre el total. 0..100. */
  porcentaje: number;
}

export interface PuntoSerie {
  /** Eje X (string o número). Para "por set", 1..5. Para fechas, ISO. */
  x: string | number;
  /** Etiqueta visible del eje X ("Set 3", "vs Boca (2025-04-12)"). */
  label: string;
  /** Valor principal de ese punto. */
  y: number;
  /** Denominador de ese punto, si aplica. */
  base: number | null;
  /** % sobre el total, si aplica. */
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
  /** 0..100 */
  valor: number;
  /** Numerador absoluto. */
  count: number;
  /** Denominador absoluto. */
  base: number;
  detalle: string | null;
}

export interface RespuestaPromedio {
  tipo: "promedio";
  valor: number;
  /** Cuántas acciones se promediaron. */
  n: number;
  detalle: string | null;
}

export interface RespuestaFrecuencia {
  tipo: "frecuencia";
  /** Cada cuántas acciones ocurre. Ej. 4.2 = "cada 4.2". */
  valor: number;
  /** Total de acciones base. */
  base: number;
  /** Total de eventos (el numerador). */
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
  /** Agregación usada para ordenar (count, %, avg, etc.). */
  agregacion: AggFn;
  /** Dirección del ordenamiento. */
  orden: "asc" | "desc";
  detalle: string | null;
}

export interface RespuestaTabla {
  tipo: "tabla";
  /** GroupBy de la tabla (set, jugador, rotacion, etc.). */
  groupBy: GroupBy | null;
  filas: FilaTabla[];
  /** Agregación principal (la que calcula `valor`). */
  agregacion: AggFn;
  /** Total general (fila "TOTAL"). */
  total: FilaTabla | null;
  detalle: string | null;
}

export interface RespuestaDistribucion {
  tipo: "distribucion";
  /** GroupBy sobre el que se calcula la distribución. */
  groupBy: GroupBy | null;
  /** Dimensiones paralelas opcionales (ej. distribución de ataques
   *  por zona destino Y por resultado). */
  items: ItemDistribucion[];
  /** Total de acciones incluidas. */
  total: number;
  detalle: string | null;
}

export interface RespuestaSerie {
  tipo: "serie";
  /** Eje X (set, partido, fecha, rotación, etc.). */
  eje: string;
  puntos: PuntoSerie[];
  agregacion: AggFn;
  detalle: string | null;
}

export interface RespuestaHabit {
  tipo: "habit";
  /** Valor más frecuente (subtipo, zona destino, tipo, etc.). */
  valorMasFrecuente: string | null;
  /** Etiqueta visible del valor más frecuente. */
  etiqueta: string | null;
  /** % sobre el total. */
  porcentaje: number;
  /** Total de acciones consideradas. */
  total: number;
  /** Distribución completa por si quieren mostrar el detalle. */
  items: ItemDistribucion[];
  detalle: string | null;
}

export interface RespuestaComparacion {
  tipo: "comparacion";
  /** Etiqueta de cada lado (nombre del jugador o equipo). */
  a: { etiqueta: string; valor: number; count: number; base: number };
  b: { etiqueta: string; valor: number; count: number; base: number };
  /** Diferencia b - a (para mostrar "X más que Y"). */
  diferencia: number;
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
  /** Cuántas acciones del universo se consideraron (después del filtro). */
  totalAcciones: number;
  /** Cuántas acciones del universo total había antes del filtro. */
  totalUniverso: number;
}

export interface ResultadoConsulta {
  respuesta: RespuestaConsulta;
  meta: MetaConsulta;
  /** Fragmentos que el parser reconoció en la consulta. */
  fragmentos: string[];
  /** Palabras que NO se reconocieron (para mostrar al usuario). */
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