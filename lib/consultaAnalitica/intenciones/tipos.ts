// ============================================================
// INTENCIONES · TIPOS
// ============================================================
// Extraído de intenciones.ts (v1.9). Solo tipos + intencionVacia.
//
// v1.4 (FASE 7.5 — AST compilado):
//   + CondicionFiltro suma 2 campos opcionales:
//       · expr                 → Expr del AST (capa 4)
//       · compararConBaseline  → true si la frase pide comparar
//                                 contra el general
//     Los setea `parserIntencion` cuando `compilarCondicion` detecta
//     una condición compleja. El ejecutor los usa para filtrar
//     VariablesPunto y disparar `RespuestaComparacionBaseline`.
//
// v1.3 (FASE 7.1 — contexto de partido como dato de primera clase):
//   + GroupBy "resultado_set".
//   + CondicionFiltro.setGanado / .resultadoPartido.
//
// v1.2 (FASE 6 — Opción A completa):
//   + CondicionFiltro.crucesMaximos / .crucesExactos / .crucesRango.
//   + GroupBy "cruces" / "duracion_rally".
//
// v1.1 (FASE 6 — Rondas 1.3 + 2):
//   + CondicionFiltro.salidaRol / .crucesMinimos.
// ============================================================

import type { Expr } from "../expresiones";

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
  | "resultado_set"
  | "tipo"
  | "subtipo"
  | "velocidad"
  | "tipo_saque"
  | "variante"
  | "cambio"
  | "cruces"
  | "duracion_rally";

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
  crucesMinimos?: number;
  crucesMaximos?: number;
  crucesExactos?: number;
  crucesRango?: [number, number];

  // --- FASE 7.1 — Contexto de partido ---
  setGanado?: boolean;
  resultadoPartido?: "ganado" | "perdido";

  // --- FASE 7.5 — AST compilado (capa 4) ---
  /**
   * Expresión booleana del AST que filtra puntos.
   * Cuando está presente, el ejecutor la aplica sobre
   * `VariablesPunto` antes de calcular la métrica.
   * Null = sin filtro complejo (se usan los campos de arriba).
   */
  expr?: Expr | null;
  /**
   * Si true, la frase pide comparar la métrica filtrada contra un
   * baseline general (sin filtro). El motor devuelve un
   * `RespuestaComparacionBaseline` con `filtrada`, `general`,
   * `diferencia`, `puntosQueCumplen`, `puntosTotales`.
   */
  compararConBaseline?: boolean;
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