// ============================================================
// AGREGADOR — funciones puras de cálculo
// ============================================================
// FASE 3 del plan "Consultas Analíticas Libres".
//
// Funciones puras sobre arrays de números (o arrays de items con
// un selector). No saben nada de vóley, ni de acciones, ni de la
// UI. Solo calculan.
//
// API pública:
//   agregar(items, selector, agg) → number
//   contar(numeros) → number
//   sumar(numeros) → number
//   promedio(numeros) → number
//   mediana(numeros) → number
//   percentil(numeros, p) → number
//   maximo(numeros) → number
//   minimo(numeros) → number
//   desvioEstandar(numeros) → number
//   moda(numeros) → number | null
//   ratio(a, b) → number
//   porcentaje(count, base) → number
//   frecuencia(count, base) → number
//
// Todos los helpers devuelven 0 cuando el array está vacío (en
// lugar de NaN o -Infinity), para que la UI no rompa.
// ============================================================

import type { AggFn } from "./intenciones";

// ------------------------------------------------------------
// HELPERS BÁSICOS
// ------------------------------------------------------------

/** Cantidad de elementos. */
export function contar(numeros: number[]): number {
  return numeros.length;
}

/** Suma total. */
export function sumar(numeros: number[]): number {
  let s = 0;
  for (const n of numeros) s += n;
  return s;
}

/** Promedio aritmético. 0 si está vacío. */
export function promedio(numeros: number[]): number {
  if (numeros.length === 0) return 0;
  return sumar(numeros) / numeros.length;
}

/** Mediana (percentil 50). 0 si está vacío. */
export function mediana(numeros: number[]): number {
  return percentil(numeros, 50);
}

/**
 * Percentil p (0..100) usando interpolación lineal.
 * Implementación estándar (la misma de Excel / numpy default).
 * 0 si está vacío.
 */
export function percentil(numeros: number[], p: number): number {
  if (numeros.length === 0) return 0;
  if (numeros.length === 1) return numeros[0];

  const ordenados = [...numeros].sort((a, b) => a - b);
  const clamped = Math.max(0, Math.min(100, p));
  const idx = (clamped / 100) * (ordenados.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return ordenados[lo];
  const frac = idx - lo;
  return ordenados[lo] * (1 - frac) + ordenados[hi] * frac;
}

/** Máximo. 0 si está vacío. */
export function maximo(numeros: number[]): number {
  if (numeros.length === 0) return 0;
  let m = numeros[0];
  for (let i = 1; i < numeros.length; i++) {
    if (numeros[i] > m) m = numeros[i];
  }
  return m;
}

/** Mínimo. 0 si está vacío. */
export function minimo(numeros: number[]): number {
  if (numeros.length === 0) return 0;
  let m = numeros[0];
  for (let i = 1; i < numeros.length; i++) {
    if (numeros[i] < m) m = numeros[i];
  }
  return m;
}

/** Desvío estándar poblacional (÷ n). 0 si hay < 2 elementos. */
export function desvioEstandar(numeros: number[]): number {
  if (numeros.length < 2) return 0;
  const prom = promedio(numeros);
  let suma = 0;
  for (const n of numeros) {
    const d = n - prom;
    suma += d * d;
  }
  return Math.sqrt(suma / numeros.length);
}

/**
 * Moda: el valor que más veces aparece.
 * Si hay empate, devuelve el más chico.
 * null si el array está vacío.
 */
export function moda(numeros: number[]): number | null {
  if (numeros.length === 0) return null;
  const conteo = new Map<number, number>();
  for (const n of numeros) {
    conteo.set(n, (conteo.get(n) ?? 0) + 1);
  }
  let mejorValor: number | null = null;
  let mejorCuenta = -1;
  for (const [valor, cuenta] of conteo) {
    if (
      cuenta > mejorCuenta ||
      (cuenta === mejorCuenta &&
        (mejorValor === null || valor < mejorValor))
    ) {
      mejorValor = valor;
      mejorCuenta = cuenta;
    }
  }
  return mejorValor;
}

// ------------------------------------------------------------
// AGREGADOS DE DOS NÚMEROS
// ------------------------------------------------------------

/** a / b. 0 si b = 0. */
export function ratio(a: number, b: number): number {
  return b === 0 ? 0 : a / b;
}

/** count / base × 100. 0 si base = 0. Devuelve 0..100. */
export function porcentaje(count: number, base: number): number {
  return base === 0 ? 0 : (count / base) * 100;
}

/**
 * Frecuencia: "cada cuántas acciones ocurre el evento".
 * count = eventos, base = acciones totales.
 * Ej: count=10, base=100 → 10 (cada 10 acciones).
 * count=0 → 0 (no hay frecuencia).
 */
export function frecuencia(count: number, base: number): number {
  return count === 0 ? 0 : base / count;
}

// ------------------------------------------------------------
// AGREGADOR GENÉRICO
// ------------------------------------------------------------

/**
 * Aplica la agregación `agg` sobre `items`, extrayendo el número
 * de cada item con `selector`.
 *
 * Si `selector` devuelve `null`, ese item se ignora.
 *
 * Devuelve 0 si no queda ningún número (a menos que agg = "count",
 * que devuelve la cantidad de números válidos).
 */
export function agregar<T>(
  items: T[],
  selector: (item: T) => number | null,
  agg: AggFn
): number {
  const numeros: number[] = [];
  for (const it of items) {
    const v = selector(it);
    if (v === null || !isFinite(v)) continue;
    numeros.push(v);
  }

  if (agg === "count") return numeros.length;
  if (numeros.length === 0) return 0;

  switch (agg) {
    case "sum":
      return sumar(numeros);
    case "avg":
      return promedio(numeros);
    case "median":
      return mediana(numeros);
    case "percentile_25":
      return percentil(numeros, 25);
    case "percentile_50":
      return percentil(numeros, 50);
    case "percentile_75":
      return percentil(numeros, 75);
    case "percentile_90":
      return percentil(numeros, 90);
    case "max":
      return maximo(numeros);
    case "min":
      return minimo(numeros);
    case "stddev":
      return desvioEstandar(numeros);
    case "mode":
      return moda(numeros) ?? 0;
    // ratio / percentage / frequency no tienen sentido en este
    // contexto (necesitan 2 números), devolvemos 0 por seguridad.
    case "ratio":
    case "percentage":
    case "frequency":
      return 0;
    default:
      return 0;
  }
}

// ------------------------------------------------------------
// AGRUPACIÓN
// ------------------------------------------------------------

/**
 * Agrupa `items` por la clave que devuelve `keyFn` y devuelve un
 * Map<clave, T[]>.
 *
 * Si `keyFn` devuelve `null`, el item se ignora.
 */
export function agrupar<T>(
  items: T[],
  keyFn: (item: T) => string | null
): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const it of items) {
    const k = keyFn(it);
    if (k === null) continue;
    let arr = out.get(k);
    if (!arr) {
      arr = [];
      out.set(k, arr);
    }
    arr.push(it);
  }
  return out;
}

/**
 * Devuelve un array de { key, items } ordenado alfabéticamente por
 * key. Útil cuando el orden importa para la UI.
 */
export function agruparYOrdenar<T>(
  items: T[],
  keyFn: (item: T) => string | null
): { key: string; items: T[] }[] {
  const m = agrupar(items, keyFn);
  return Array.from(m.entries())
    .map(([key, items]) => ({ key, items }))
    .sort((a, b) => a.key.localeCompare(b.key, "es"));
}

// ------------------------------------------------------------
// REDONDEO HELPERS (para la UI)
// ------------------------------------------------------------

/** Redondea a `decimales` dígitos después de la coma. */
export function redondear(n: number, decimales = 2): number {
  if (!isFinite(n)) return 0;
  const factor = Math.pow(10, decimales);
  return Math.round(n * factor) / factor;
}

/** Formatea como porcentaje legible ("72.3%"). */
export function formatearPorcentaje(n: number, decimales = 1): string {
  return `${redondear(n, decimales)}%`;
}

/** Formatea un número con separadores de miles ("1.234"). */
export function formatearNumero(n: number): string {
  return n.toLocaleString("es-AR");
}