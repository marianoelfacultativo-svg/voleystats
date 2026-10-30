// ============================================================
// INTENCIONES · TIPOS
// ============================================================
// Extraído de intenciones.ts (v1.9). Solo tipos + intencionVacia.
// Sin diccionarios, sin lógica.
//
// v1.1 (FASE 6 — Ronda 1.1 + 1.3 + 2):
//   + CondicionFiltro.salidaRol (Cat. 3)
//   + CondicionFiltro.crucesMinimos (Cat. 6)
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
  | "tipo"
  | "subtipo"
  | "velocidad"
  | "tipo_saque"
  | "variante"
  | "cambio";

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
// v1.1: agrega salidaRol (Cat. 3) y crucesMinimos (Cat. 6).
// ------------------------------------------------------------

export interface CondicionFiltro {
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
  /** Rol cuyo "salida" (zona de origen del ataque) se filtra. */
  salidaRol?: "opuesto" | "central" | "punta" | "armador";
  /** Cantidad mínima de cruces de red del rally (Cat. 6). */
  crucesMinimos?: number;
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