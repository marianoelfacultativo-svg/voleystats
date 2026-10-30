// ============================================================
// ANÁLISIS DE CONSECUENCIAS — barrel
// ============================================================
// Este archivo reexporta todo lo de lib/analisis/*.
// La API pública es exactamente la misma que en v9:
//
//   import {
//     analizarConsecuencias,
//     etiquetaTipoDisparador,
//     BLOQUE_TRIGGER_VACIO,
//     ...
//   } from "@/lib/analisisConsecuencias";
//
// No hay cambios en los tipos, firmas ni valores. Solo cambió
// la ubicación física del código.
// ============================================================

// --- Tipos y constantes vacías ---
export * from "./analisis/tipos";

// --- Zonas de defensa (rival y propia) ---
export {
  partirCelda,
  zonaDefensaRival,
  zonaDefensaPropia,
} from "./analisis/zonas";

// --- Sectores de ataque ---
export {
  SECTORES_ATAQUE,
  calificarSectorAtaque,
  etiquetaSectorAtaque,
  etiquetaZonaDefensa,
  type SectorAtaque,
} from "./analisis/sectores";

// --- Inferencias (llamada + dirección legacy) ---
export {
  inferirLlamadaArmado,
  inferirDireccionAtaque,
} from "./analisis/inferencias";

// --- Clasificación ---
export {
  baseSubtipo,
  clasificarResultado,
  ubicacionDeZona,
  puntajeDeAccion,
} from "./analisis/clasificacion";

// --- Filtros de acción / rachas / patrón previo ---
export {
  cumpleFiltroAccion,
  verificarRacha,
  cumpleAccionPreviaDirecta,
  verificarRachaJugador,
  cumplePatronPrevio,
} from "./analisis/filtrosAccion";

// --- Top% y vsPromedio ---
export {
  calcularIdsTopPorcentaje,
  calcularIdsVsPromedio,
} from "./analisis/topPromedio";

// --- Contexto del partido ---
export {
  hayContextoPartidoActivo,
  cumpleContextoPartido,
} from "./analisis/contexto";

// --- Coincidencias ---
export {
  coincide,
  sumarCoincidencias,
  coincidenciasVacias,
  hayComparadoresActivos,
} from "./analisis/coincidencias";

// --- Comportamiento del trigger ---
export { calcularComportamientoTrigger } from "./analisis/comportamiento";

// --- Chequeo de bloque trigger ---
export {
  cumpleBloqueTrigger,
  hayFiltrosAvanzadosEnBloque,
  hayFiltroAnalisisActivo,
} from "./analisis/bloqueTrigger";

// --- Motor principal ---
export { analizarConsecuencias } from "./analisis/motor";

// --- Resultados por tipo ---
export { resultadosPorTipoAnalisis } from "./analisis/resultadosTipo";

// --- Etiquetas ---
export {
  etiquetaTipoDisparador,
  etiquetaResultado,
  etiquetaAmbito,
  etiquetaUbicacion,
  etiquetaRelacion,
  etiquetaRelacionObservado,
  etiquetaCierraPunto,
  etiquetaOperador,
  etiquetaVariante,
  etiquetaConDesplazamiento,
  etiquetaLlamadaInferida,
  etiquetaDireccionAtaque,
} from "./analisis/etiquetas";