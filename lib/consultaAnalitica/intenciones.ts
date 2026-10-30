// ============================================================
// INTENCIONES — barrel
// ============================================================
// Este archivo reexporta todo lo de lib/consultaAnalitica/intenciones/*.
// La API pública es idéntica a v1.9 (más los arrays nuevos para
// Cat. 3, Cat. 5 y Cat. 6).
//
//   import {
//     ORDEN_EVALUACION,
//     SINONIMOS_MAX,
//     intencionVacia,
//     type IntencionQuery,
//   } from "@/lib/consultaAnalitica/intenciones";
//
// No hay cambios de firmas ni de valores. Solo cambió la
// ubicación física del código.
// ============================================================

// --- Tipos y helpers base ---
export {
  intencionVacia,
  type TipoIntencion,
  type AggFn,
  type GroupBy,
  type TiempoTipo,
  type DiaSemana,
  type UbicacionQuery,
  type TiempoFiltro,
  type CondicionFiltro,
  type IntencionQuery,
} from "./intenciones/tipos";

// --- Diccionarios de intención (count / % / avg / freq / ranking / etc.) ---
export {
  SINONIMOS_COUNT,
  SINONIMOS_PERCENTAGE,
  SINONIMOS_AVERAGE,
  SINONIMOS_FREQUENCY,
  SINONIMOS_RANKING,
  SINONIMOS_COMPARISON,
  SINONIMOS_DISTRIBUTION,
  SINONIMOS_TREND,
  SINONIMOS_HABIT,
} from "./intenciones/intencion";

// --- MAX / MIN (cantidad) y MAX_MEJOR / MIN_PEOR (calidad) ---
export {
  SINONIMOS_MAX,
  SINONIMOS_MIN,
  SINONIMOS_MAX_MEJOR,
  SINONIMOS_MIN_PEOR,
} from "./intenciones/maxMin";

// --- Dimensiones (groupBy, métrica, ubicación, cambio, tiempo, condición) ---
export {
  SINONIMOS_GROUPBY,
  SINONIMOS_METRICA,
  SINONIMOS_UBICACION,
  SINONIMOS_CAMBIO,
  DIAS_SEMANA,
  SINONIMOS_ULTIMOS,
  SINONIMOS_TEMPORADA,
  SINONIMOS_ESPECIFICOS,
  SINONIMOS_CONDICION,
} from "./intenciones/dimensiones";

// --- Cat. 5: fases del rally (side-out %, break-point %, K2, K3, free-ball) ---
export { SINONIMOS_FASE } from "./intenciones/fase";

// --- Cat. 3: salida por rol (opuesto / central / punta / armador) ---
export { SINONIMOS_SALIDA_ROL } from "./intenciones/salida";

// --- Cat. 6: cruces de red (rallys con N+ cruces) ---
export { SINONIMOS_CRUCES_MINIMOS } from "./intenciones/cruces";

// --- Orden de evaluación del parser ---
export { ORDEN_EVALUACION } from "./intenciones/orden";