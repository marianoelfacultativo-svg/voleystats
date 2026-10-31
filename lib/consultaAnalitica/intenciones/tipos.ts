// ============================================================
// INTENCIONES · TIPOS
// ============================================================
// Extraído de intenciones.ts (v1.9). Solo tipos + intencionVacia.
// Sin diccionarios, sin lógica.
//
// v1.3 (FASE 7.1 — contexto de partido como dato de primera clase):
//   + GroupBy "resultado_set" (agrupa por set ganado/perdido).
//   + GroupBy "resultado_partido" ya existía pero ahora se usa
//     de verdad (ver respuesta.ts, groupBy.ts, ejecutor.ts).
//   + CondicionFiltro.setGanado (filtra acciones de sets
//     ganados o perdidos).
//   + CondicionFiltro.resultadoPartido (filtra acciones por
//     resultado del partido: ganado / perdido).
//
// v1.2 (FASE 6 — Opción A completa):
//   + CondicionFiltro.crucesMaximos: number
//   + CondicionFiltro.crucesExactos: number
//   + CondicionFiltro.crucesRango: [number, number]
//   + GroupBy "cruces"         (agrupa por cantidad exacta de cruces)
//   + GroupBy "duracion_rally" (agrupa por bucket corto/medio/largo)
//
// v1.1 (FASE 6 — Rondas 1.3 + 2):
//   + CondicionFiltro.salidaRol
//   + CondicionFiltro.crucesMinimos
// ============================================================

// ------------------------------------------------------------
// TIPOS BASE
// ------------------------------------------------------------

export type TipoIntencion =
  | "count"
  | "percentage"
  | "average"
  | "frequency"
  | "max"
  | "min"
  | "ranking"
  | "comparison"
  | "distribution"
  | "trend"
  | "habit"
  | "unknown";

export type AggFn =
  | "count"
  | "sum"
  | "avg"
  | "median"
  | "percentile_25"
  | "percentile_50"
  | "percentile_75"
  | "percentile_90"
  | "max"
  | "min"
  | "ratio"
  | "percentage"
  | "frequency"
  | "stddev"
  | "mode";

export type GroupBy =
  | "set"
  | "partido"
  | "jugador"
  | "zona_origen"
  | "zona_destino"
  | "zona_jugador"
  | "rotacion"
  | "rol"
  | "ubicacion"
  | "fase"
  | "rival"
  | "resultado_partido"
  | "resultado_punto"
  | "resultado_set"     // ← NUEVO (FASE 7.1)
  | "tipo"
  | "subtipo"
  | "velocidad"
  | "tipo_saque"
  | "variante"
  | "cambio"
  | "cruces"            // ← FASE 6
  | "duracion_rally";   // ← FASE 6

export type TiempoTipo =
  | "ultimos_n_partidos"
  | "ultimos_n_sets"
  | "ultimos_n_jugadas"
  | "esta_temporada"
  | "esta_semana"
  | "este_mes"
  | "este_ano"
  | "temporada_pasada"
  | "dia_semana"
  | "partido_especifico"
  | "set_especifico"
  | "punto_especifico";

export type DiaSemana =
  | "lunes"
  | "martes"
  | "miercoles"
  | "jueves"
  | "viernes"
  | "sabado"
  | "domingo";

export type UbicacionQuery = "delantero" | "zaguero" | "libero" | "otro";

// ------------------------------------------------------------
// FILTRO DE TIEMPO
// ------------------------------------------------------------

export interface TiempoFiltro {
  tipo: TiempoTipo;
  n?: number;
  diaSemana?: DiaSemana;
  rival?: string;
  set?: number;
  punto?: number;
}

// ------------------------------------------------------------
// FILTRO DE CONDICIÓN
// ------------------------------------------------------------

export interface CondicionFiltro {
  // --- Existente ---
  marcador?: string;
  diferencia?: number;
  puntoCritico?: boolean;
  rachaMinima?: number;
  fase?: string;
  toquesMinimos?: number;
  calidadArmado?: number;
  conErrorPrevio?: boolean;
  conAciertoPrevio?: boolean;
  ubicacion?: UbicacionQuery;
  zonaJugador?: number[];
  cambioEnPunto?: boolean;
  despuesDeCambio?: boolean;

  // --- Cat. 3 ---
  /** Rol cuyo "salida" (zona de origen del ataque) se filtra. */
  salidaRol?: "opuesto" | "central" | "punta" | "armador";

  // --- Cat. 6 ---
  /** Cantidad mínima de cruces de red del rally. */
  crucesMinimos?: number;
  /** Cantidad máxima de cruces de red del rally. */
  crucesMaximos?: number;
  /** Cantidad exacta de cruces de red del rally. */
  crucesExactos?: number;
  /** Rango [min, max] de cruces de red del rally. */
  crucesRango?: [number, number];

  // --- FASE 7.1 — Contexto de partido ---
  /**
   * Filtra acciones de sets ganados (true) o perdidos (false).
   * Necesita que el ejecutor tenga acceso a `partidos[].setGanado`
   * por partido.
   */
  setGanado?: boolean;
  /**
   * Filtra acciones por resultado del partido: solo acciones de
   * partidos ganados o solo de perdidos.
   */
  resultadoPartido?: "ganado" | "perdido";
}

// ------------------------------------------------------------
// INTENCIÓN QUERY
// ------------------------------------------------------------

export interface IntencionQuery {
  tipo: TipoIntencion;
  agregacion: AggFn;
  groupBy: GroupBy | null;
  metrica: string | null;
  ordenamiento: "asc" | "desc" | null;
  limite: number | null;
  comparacion: { a: string; b: string } | null;
  tiempo: TiempoFiltro | null;
  condicion: CondicionFiltro | null;
  fragmentos: string[];
  original: string;
}

export function intencionVacia(): IntencionQuery {
  return {
    tipo: "unknown",
    agregacion: "count",
    groupBy: null,
    metrica: null,
    ordenamiento: null,
    limite: null,
    comparacion: null,
    tiempo: null,
    condicion: null,
    fragmentos: [],
    original: "",
  };
}