// ============================================================
// INTENCIONES — barrel
// ============================================================
// Este archivo reexporta todo lo de lib/consultaAnalitica/intenciones/*.
// La API pública es idéntica a v1.9 (más los arrays nuevos para
// Cat. 3, Cat. 5 y Cat. 6).
//
// v2.1 (fix build): corrige el re-export de cruces.ts
//   (SINONIMOS_CRUCES_MINIMOS no existía; ahora se re-exporta
//   extraerCrucesDeTexto y las constantes/regex de cruces).
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
export {
  SINONIMOS_SALIDA_ROL,
  ZONAS_POR_ROL,
  ROL_JUGADOR_A_SALIDA,
  matcheaSalidaRol,
  type RolSalida,
} from "./intenciones/salida";

// --- Cat. 6: cruces de red (rallys con N+ cruces) ---
export {
  CRUCES_DEFAULT_LARGO,
  REGEX_MAS_DE_CRUCES,
  REGEX_N_O_MAS_CRUCES,
  REGEX_CRUCES_SUELTO,
  REGEX_RALLY_LARGO,
  extraerCrucesDeTexto,
  parsearNumeroCruces,
  type ResultadoCruces,
} from "./intenciones/cruces";

// --- Orden de evaluación del parser ---
export { ORDEN_EVALUACION } from "./intenciones/orden";