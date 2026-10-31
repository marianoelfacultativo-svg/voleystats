// ============================================================
// TIPOS LOCALES V2 — DataEntryV2
// Solo tipos, cero lógica.
//
// v2.2 (armado cruzado + remate de segunda):
//   + Comentario actualizado: PopupEnCola ahora también
//     acepta "armado-cruzado" y "variante-remate-segunda"
//     (porque PopupRequerido los incluye desde v2.1 de
//     clasificacionV2.ts).
//   + Sin cambios estructurales: Exclude<PopupRequerido, null>
//     ya cubre los dos valores nuevos automáticamente.
//
// v2.1 (corrección FASE 7.1 — tie-break en BO3):
//   + esTieBreak ahora devuelve true también en BO3 set 3.
//
// v2 (FASE 7.1 — DataEntry con sets y partido):
//   + PuntoCerrado con set_numero explícito.
//   + Clave de puntosCerrados = "set-punto".
//   + Nuevos tipos: SetCerrado, SetsCerrados, FormatoPartido,
//     PartidoCerrado, PuntosPorSet.
//   + Helpers: clavePunto, setsNecesariosParaGanar,
//     maxSetsDeFormato, esTieBreak, puntosParaGanarSet,
//     setTerminado.
// ============================================================

import type { Libero, RotacionPunto, Zona } from "@/lib/rotaciones";
import type { Situacion, PopupRequerido } from "@/lib/clasificacionV2";
import type { CambioPendiente } from "./PanelRotacionV2";
import type { PopupPos } from "./PopupValoracion";

export type Lado = "propio" | "rival";

export interface Jugador {
  id: string;
  nombre: string;
  numero: number | null;
}

/** Equipo disponible para elegir como rival en modo espejo. */
export interface EquipoOpcion {
  id: string;
  nombre: string;
}

/** Estado del equipo rival guardado junto a cada punto (modo espejo). */
export interface EstadoRivalPunto {
  rotacion: RotacionPunto;
  liberos: Libero[];
  posicionesPunto: Record<Zona, string>;
  cambios: CambioPendiente[];
}

/**
 * Popup en cola.
 *
 * `tipo` hereda de `PopupRequerido` y suma "velocidad".
 *
 * A partir de FASE 7.1, `PopupRequerido` incluye también:
 *   - "armado-cruzado"          → popup de 3 opciones cuando el
 *                                  armado cruza la red.
 *   - "variante-remate-segunda" → sub-popup para elegir entre
 *                                  "toque-segunda" y
 *                                  "remate-segunda".
 *
 * No hace falta declararlos explícitamente acá: el
 * `Exclude<PopupRequerido, null>` los cubre.
 */
export interface PopupEnCola {
  tipo: Exclude<PopupRequerido, null> | "velocidad";
  pos: PopupPos;
  lineaId: string;
  indiceDesvio?: number;
}

export interface PuntoCerrado {
  numero: number;
  /** Set al que pertenece este punto (1..5). */
  set_numero: number;
  lineas: import("@/lib/clasificacionV2").LineaClasificada[];
  saqueInicial: Lado;
  situacion: Situacion;
  ganador: Lado;
  rotacion: RotacionPunto;
  liberos: Libero[];
  posicionesPunto: Record<Zona, string>;
  cambios: CambioPendiente[];
  /** Equipo dueño del punto (el que sacó). Opcional para compat con puntos viejos. */
  equipoId?: string;
  /** Estado del equipo rival al cerrar el punto (solo en modo espejo). */
  estadoRival?: EstadoRivalPunto;
}

// ------------------------------------------------------------
// SETS Y PARTIDO
// ------------------------------------------------------------

/** Set cerrado con su ganador y el marcador al cierre. */
export interface SetCerrado {
  numero: number;
  ganador: Lado;
  puntosPropios: number;
  puntosRivales: number;
  rotacionAlCerrar: RotacionPunto;
  liberosAlCerrar: Libero[];
}

/** Mapa de sets cerrados por número de set. */
export type SetsCerrados = Record<number, SetCerrado>;

/** Mapa de puntos cerrados por clave "set-punto". */
export type PuntosPorSet = Record<string, PuntoCerrado>;

/** Formato del partido. */
export type FormatoPartido = "bo3" | "bo5";

/** Partido cerrado con su ganador y el conteo de sets. */
export interface PartidoCerrado {
  ganador: Lado;
  setsPropios: number;
  setsRivales: number;
}

// ------------------------------------------------------------
// HELPERS DE NOMENCLATURA
// ------------------------------------------------------------

/**
 * Clave canónica de un punto: "set-punto".
 * Se usa en `puntosCerrados` para no chocar entre sets.
 */
export function clavePunto(setNumero: number, puntoNumero: number): string {
  return `${setNumero}-${puntoNumero}`;
}

/**
 * Cuántos sets hay que ganar para cerrar el partido.
 * BO3 → 2 sets. BO5 → 3 sets.
 *
 * Ejemplos:
 *   BO3 → 2-0 o 2-1.
 *   BO5 → 3-0, 3-1 o 3-2.
 */
export function setsNecesariosParaGanar(formato: FormatoPartido): number {
  return formato === "bo3" ? 2 : 3;
}

/**
 * Cantidad máxima de sets del formato.
 * BO3 → 3 sets. BO5 → 5 sets.
 */
export function maxSetsDeFormato(formato: FormatoPartido): number {
  return formato === "bo3" ? 3 : 5;
}

/**
 * ¿Este set es tie-break? (se juega a 15 puntos)
 *
 * Regla:
 *   - BO3 → set 3 es tie-break.
 *   - BO5 → set 5 es tie-break.
 *   - Cualquier otro caso → set normal (a 25).
 */
export function esTieBreak(
  formato: FormatoPartido,
  setNumero: number
): boolean {
  if (formato === "bo3") return setNumero === 3;
  return setNumero === 5;
}

/**
 * Puntos que hay que alcanzar para ganar un set.
 * 25 normal, 15 en tie-break.
 */
export function puntosParaGanarSet(
  formato: FormatoPartido,
  setNumero: number
): number {
  return esTieBreak(formato, setNumero) ? 15 : 25;
}

/**
 * ¿El set está terminado con este marcador?
 * Regla: llegar al target y tener 2+ de diferencia.
 */
export function setTerminado(
  puntosPropios: number,
  puntosRivales: number,
  target: number
): boolean {
  const max = Math.max(puntosPropios, puntosRivales);
  const min = Math.min(puntosPropios, puntosRivales);
  return max >= target && max - min >= 2;
}

// ------------------------------------------------------------
// PROPS
// ------------------------------------------------------------

export interface Props {
  partidoId: string;
  equipoId: string;
  nombreMiEquipo: string;
  nombreRival: string;
  jugadores: Jugador[];
  rotacionInicial?: RotacionPunto;
  /** Lista de equipos cargados en Supabase (para elegir rival en modo espejo). */
  equiposDisponibles: EquipoOpcion[];
}

// ------------------------------------------------------------
// CONSTANTES
// ------------------------------------------------------------

export const CLAVE_V2 = "voleystats_dataentry_v2_";
export const CLAVE_POSICIONES_FIJAS = "voleystats_posiciones_fijas_";

/**
 * Versión actual del schema de `localStorage` para `CLAVE_V2`.
 * Si el dato guardado tiene una versión menor, se migra.
 *
 * v1: estructura vieja (puntosCerrados con clave "punto" y sin
 *     set_numero en PuntoCerrado; sin setsCerrados; sin
 *     formatoPartido ni partidoCerrado).
 * v2: FASE 7.1 (DataEntry con sets y partido).
 */
export const VERSION_SCHEMA_LOCAL = 2;

export const POSICIONES_VACIAS: Record<Zona, string> = {
  1: "",
  2: "",
  3: "",
  4: "",
  5: "",
  6: "",
};

export type PosicionesFijasMap = Record<string, Record<Zona, string>>;