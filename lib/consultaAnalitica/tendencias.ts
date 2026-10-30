// ============================================================
// TENDENCIAS — evolución y comparación entre períodos
// ============================================================
// FASE 3 del plan "Consultas Analíticas Libres".
//
// Responde preguntas del tipo:
//   "¿cómo evolucionó el kill % set a set?"
//   "¿cómo viene rindiendo en los últimos partidos?"
//   "¿mejoró o empeoró respecto al mes pasado?"
//
// El cálculo base ya lo hace `construirSerie` de groupBy.ts.
// Este archivo se encarga de:
//   - Analizar la serie (dirección, pendiente, magnitud).
//   - Detectar la tendencia (subida / bajada / estable).
//   - Comparar dos períodos (antes vs después).
//
// API pública:
//   analizarTendencia(puntos) → TendenciaResultado
//   compararPeriodos(puntos, corte) → ComparacionPeriodos
//   describirTendencia(t) → string
// ============================================================

import { promedio, redondear } from "./agregador";
import type { PuntoSerie } from "./tipos";

// ------------------------------------------------------------
// RESULTADO
// ------------------------------------------------------------

export type DireccionTendencia = "sube" | "baja" | "estable" | "sin_datos";

export interface TendenciaResultado {
  /** Dirección cualitativa. */
  direccion: DireccionTendencia;
  /** Pendiente de la recta de regresión (y por unidad de x). */
  pendiente: number;
  /** Promedio de todos los y de la serie. */
  promedio: number;
  /** Primer valor y último valor. */
  primero: number;
  ultimo: number;
  /** Cambio absoluto entre primero y último. */
  cambioAbsoluto: number;
  /** Cambio porcentual (0..∞, puede ser negativo). */
  cambioPorcentual: number;
  /** Cuántos puntos tiene la serie. */
  n: number;
  /** Texto humano. */
  descripcion: string;
}

export interface ComparacionPeriodos {
  /** Valor del primer período (promedio). */
  antes: number;
  /** Valor del segundo período (promedio). */
  despues: number;
  /** n de puntos del primer período. */
  nAntes: number;
  /** n de puntos del segundo período. */
  nDespues: number;
  /** Cambio absoluto (despues - antes). */
  cambioAbsoluto: number;
  /** Cambio porcentual (0..∞, puede ser negativo). */
  cambioPorcentual: number;
  direccion: DireccionTendencia;
  descripcion: string;
}

// ------------------------------------------------------------
// REGRESIÓN LINEAL SIMPLE
// ------------------------------------------------------------
// y = m*x + b, con x = índice (0..n-1).
// Devuelve { m, b }.
// ------------------------------------------------------------

function regresionLineal(
  ys: number[]
): { m: number; b: number } {
  const n = ys.length;
  if (n === 0) return { m: 0, b: 0 };
  if (n === 1) return { m: 0, b: ys[0] };

  const xs = ys.map((_, i) => i);
  const xMed = promedio(xs);
  const yMed = promedio(ys);

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - xMed;
    const dy = ys[i] - yMed;
    num += dx * dy;
    den += dx * dx;
  }
  if (den === 0) return { m: 0, b: yMed };

  const m = num / den;
  const b = yMed - m * xMed;
  return { m, b };
}

// ------------------------------------------------------------
// ANÁLISIS DE TENDENCIA
// ------------------------------------------------------------

/**
 * Analiza la tendencia de una serie de puntos.
 *
 * Reglas de clasificación:
 *   - Sin puntos          → "sin_datos"
 *   - 1 punto             → "estable"
 *   - |pendiente| < 0.05  → "estable"
 *   - pendiente >= 0.05   → "sube"
 *   - pendiente <= -0.05  → "baja"
 *
 * El umbral 0.05 es sobre el valor de `y` (que suele estar entre
 * 0 y 100 en los %). Si en el futuro hay series en otra escala,
 * revisar el umbral.
 */
export function analizarTendencia(
  puntos: PuntoSerie[]
): TendenciaResultado {
  const n = puntos.length;

  if (n === 0) {
    return {
      direccion: "sin_datos",
      pendiente: 0,
      promedio: 0,
      primero: 0,
      ultimo: 0,
      cambioAbsoluto: 0,
      cambioPorcentual: 0,
      n: 0,
      descripcion: "Sin datos para analizar la tendencia.",
    };
  }

  const ys = puntos.map((p) => p.y);
  const prom = promedio(ys);
  const primero = ys[0];
  const ultimo = ys[n - 1];
  const cambioAbsoluto = ultimo - primero;
  const cambioPorcentual =
    primero !== 0 ? ((ultimo - primero) / Math.abs(primero)) * 100 : 0;

  const { m } = regresionLineal(ys);

  let direccion: DireccionTendencia;
  if (n === 1) {
    direccion = "estable";
  } else if (m >= 0.05) {
    direccion = "sube";
  } else if (m <= -0.05) {
    direccion = "baja";
  } else {
    direccion = "estable";
  }

  return {
    direccion,
    pendiente: redondear(m, 3),
    promedio: redondear(prom, 2),
    primero: redondear(primero, 2),
    ultimo: redondear(ultimo, 2),
    cambioAbsoluto: redondear(cambioAbsoluto, 2),
    cambioPorcentual: redondear(cambioPorcentual, 1),
    n,
    descripcion: describirTendencia({
      direccion,
      pendiente: m,
      promedio: prom,
      primero,
      ultimo,
      cambioAbsoluto,
      cambioPorcentual,
      n,
      descripcion: "",
    }),
  };
}

// ------------------------------------------------------------
// COMPARACIÓN ENTRE PERÍODOS
// ------------------------------------------------------------

/**
 * Compara los puntos antes vs después del índice `corte`.
 *
 * `corte` es la posición del primer punto del SEGUNDO período.
 * Ej: si `corte = 3` y hay 5 puntos:
 *   - antes   = puntos[0..2]
 *   - despues = puntos[3..4]
 *
 * Promedia cada período y compara.
 */
export function compararPeriodos(
  puntos: PuntoSerie[],
  corte: number
): ComparacionPeriodos {
  if (puntos.length === 0) {
    return {
      antes: 0,
      despues: 0,
      nAntes: 0,
      nDespues: 0,
      cambioAbsoluto: 0,
      cambioPorcentual: 0,
      direccion: "sin_datos",
      descripcion: "Sin datos para comparar.",
    };
  }

  const idxCorte = Math.max(0, Math.min(puntos.length, corte));
  const antes = puntos.slice(0, idxCorte).map((p) => p.y);
  const despues = puntos.slice(idxCorte).map((p) => p.y);

  const promAntes = promedio(antes);
  const promDespues = promedio(despues);
  const cambioAbsoluto = promDespues - promAntes;
  const cambioPorcentual =
    promAntes !== 0
      ? ((promDespues - promAntes) / Math.abs(promAntes)) * 100
      : 0;

  let direccion: DireccionTendencia;
  if (cambioAbsoluto >= 0.05) {
    direccion = "sube";
  } else if (cambioAbsoluto <= -0.05) {
    direccion = "baja";
  } else {
    direccion = "estable";
  }

  return {
    antes: redondear(promAntes, 2),
    despues: redondear(promDespues, 2),
    nAntes: antes.length,
    nDespues: despues.length,
    cambioAbsoluto: redondear(cambioAbsoluto, 2),
    cambioPorcentual: redondear(cambioPorcentual, 1),
    direccion,
    descripcion: describirComparacion({
      antes: promAntes,
      despues: promDespues,
      nAntes: antes.length,
      nDespues: despues.length,
      cambioAbsoluto,
      cambioPorcentual,
      direccion,
      descripcion: "",
    }),
  };
}

// ------------------------------------------------------------
// TEXTOS HUMANOS
// ------------------------------------------------------------

/**
 * Describe una tendencia en castellano simple.
 */
export function describirTendencia(t: TendenciaResultado): string {
  if (t.direccion === "sin_datos") return "Sin datos para analizar.";

  const { primero, ultimo, n } = t;

  if (n === 1) {
    return `Con un solo punto no se puede ver tendencia (valor: ${primero}).`;
  }

  if (t.direccion === "estable") {
    return `Se mantiene estable alrededor de ${redondear(
      t.promedio,
      1
    )} (${n} puntos).`;
  }

  if (t.direccion === "sube") {
    return `Va en aumento: de ${primero} a ${ultimo} (${signo(
      t.cambioAbsoluto
    )}${t.cambioAbsoluto} en ${n} puntos).`;
  }

  return `Va en descenso: de ${primero} a ${ultimo} (${signo(
    t.cambioAbsoluto
  )}${t.cambioAbsoluto} en ${n} puntos).`;
}

/**
 * Describe una comparación entre dos períodos.
 */
export function describirComparacion(c: ComparacionPeriodos): string {
  if (c.direccion === "sin_datos") return "Sin datos para comparar.";

  const { antes, despues, cambioAbsoluto, cambioPorcentual } = c;

  if (c.direccion === "estable") {
    return `Sin cambios significativos: antes ${antes}, después ${despues}.`;
  }

  const palabra = c.direccion === "sube" ? "Mejoró" : "Empeoró";
  const delta = `${signo(cambioAbsoluto)}${cambioAbsoluto}`;
  const pct =
    cambioPorcentual !== 0
      ? ` (${signo(cambioPorcentual)}${cambioPorcentual}%)`
      : "";

  return `${palabra}: antes ${antes}, después ${despues} (${delta}${pct}).`;
}

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

function signo(n: number): string {
  return n > 0 ? "+" : "";
}