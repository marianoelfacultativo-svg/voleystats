// ============================================================
// INTENCIONES · ORDEN DE EVALUACIÓN
// ============================================================
// El parser recorre este array de arriba a abajo. El primer
// tipo cuyo sinónimo aparece en el texto GANA.
//
// El orden va de MÁS específico a MÁS genérico. Reglas:
//
//   - MAX_MEJOR / MIN_PEOR (calidad, avg) van ANTES que
//     MAX / MIN genéricos (cantidad, count). Así "saca mejor"
//     prioriza puntaje y no cantidad de saques.
//
//   - FREQUENCY ("cada cuánto") va antes que COUNT ("cuántos").
//   - RANKING ("top N") va antes que COUNT.
//   - COMPARISON ("X vs Y") va antes que COUNT y antes que MAX.
//   - PERCENTAGE ("%") va antes que COUNT.
//   - AVERAGE ("promedio") va antes que MAX y antes que COUNT.
//   - DISTRIBUTION ("por X") va antes que COUNT.
//   - TREND ("cómo viene") va antes que COUNT.
//   - HABIT ("suele", "cómo terminan") va antes que COUNT.
//
// Ejemplos de por qué importa el orden:
//   "¿cuántos puntos ganamos en side-out?"  → COUNT (no MAX).
//   "¿quién saca mejor?"                    → MAX_MEJOR (avg).
//   "¿quién hace más aces?"                 → MAX genérico (count).
//   "top 5 atacantes por kill %"            → RANKING.
//   "¿en qué rotación saca mejor?"          → MAX_MEJOR + ROTACION.
// ============================================================

import type { AggFn, TipoIntencion } from "./tipos";
import {
  SINONIMOS_COUNT,
  SINONIMOS_PERCENTAGE,
  SINONIMOS_AVERAGE,
  SINONIMOS_FREQUENCY,
  SINONIMOS_RANKING,
  SINONIMOS_COMPARISON,
  SINONIMOS_DISTRIBUTION,
  SINONIMOS_TREND,
  SINONIMOS_HABIT,
} from "./intencion";
import {
  SINONIMOS_MAX,
  SINONIMOS_MIN,
  SINONIMOS_MAX_MEJOR,
  SINONIMOS_MIN_PEOR,
} from "./maxMin";

export interface EntradaOrden {
  tipo: TipoIntencion;
  sinonimos: string[];
  agregacion: AggFn;
}

export const ORDEN_EVALUACION: EntradaOrden[] = [
  // ----------------------------------------------------------
  // Calidad (avg) — ANTES que cantidad (count)
  // ----------------------------------------------------------
  {
    tipo: "max",
    sinonimos: SINONIMOS_MAX_MEJOR,
    agregacion: "avg",
  },
  {
    tipo: "min",
    sinonimos: SINONIMOS_MIN_PEOR,
    agregacion: "avg",
  },

  // ----------------------------------------------------------
  // Intenciones intermedias
  // ----------------------------------------------------------
  {
    tipo: "frequency",
    sinonimos: SINONIMOS_FREQUENCY,
    agregacion: "frequency",
  },
  {
    tipo: "ranking",
    sinonimos: SINONIMOS_RANKING,
    agregacion: "count",
  },
  {
    tipo: "comparison",
    sinonimos: SINONIMOS_COMPARISON,
    agregacion: "percentage",
  },
  {
    tipo: "percentage",
    sinonimos: SINONIMOS_PERCENTAGE,
    agregacion: "percentage",
  },
  {
    tipo: "average",
    sinonimos: SINONIMOS_AVERAGE,
    agregacion: "avg",
  },
  {
    tipo: "max",
    sinonimos: SINONIMOS_MAX,
    agregacion: "count",
  },
  {
    tipo: "min",
    sinonimos: SINONIMOS_MIN,
    agregacion: "count",
  },
  {
    tipo: "distribution",
    sinonimos: SINONIMOS_DISTRIBUTION,
    agregacion: "count",
  },
  {
    tipo: "trend",
    sinonimos: SINONIMOS_TREND,
    agregacion: "avg",
  },
  {
    tipo: "habit",
    sinonimos: SINONIMOS_HABIT,
    agregacion: "mode",
  },

  // ----------------------------------------------------------
  // Count al final (el más genérico)
  // ----------------------------------------------------------
  {
    tipo: "count",
    sinonimos: SINONIMOS_COUNT,
    agregacion: "count",
  },
];