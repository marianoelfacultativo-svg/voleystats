// ============================================================
// FRECUENCIA — "cada cuántos X ocurre Y"
// ============================================================
// FASE 3 del plan "Consultas Analíticas Libres".
//
// Responde preguntas del tipo:
//   "¿cada cuántos ataques comete un error?"
//   "¿cada cuántos saques hace un ace?"
//   "¿cada cuántas recepciones le sale una negativa?"
//
// El cálculo es siempre el mismo:
//   frecuencia = total_eventos_base / total_eventos_condicion
//
// Ej: 120 ataques, 15 errores → cada 8 ataques (120/15 = 8).
//
// API pública:
//   frecuenciaEvento(total, eventos) → number
//   calcularFrecuencia(acciones, filtro) → FrecuenciaResultado
//   describirFrecuencia(valor, unidad) → string
// ============================================================

import type { AccionVisual } from "../../app/equipo/adaptadorUnificadoV2";
import { redondear } from "./agregador";

// ------------------------------------------------------------
// RESULTADO
// ------------------------------------------------------------

export interface FrecuenciaResultado {
  /** "Cada cuántos" (ej. 8.5 = cada 8.5). 0 si no hubo eventos. */
  valor: number;
  /** Total de acciones base (denominador). */
  base: number;
  /** Total de eventos que cumplen la condición (numerador). */
  eventos: number;
  /** Texto formateado listo para mostrar en UI. */
  descripcion: string;
}

// ------------------------------------------------------------
// CÁLCULO BÁSICO
// ------------------------------------------------------------

/**
 * frecuencia = base / eventos.
 *
 * Casos borde:
 *   - eventos = 0 → 0 (no hay frecuencia medible)
 *   - base = 0    → 0
 *   - eventos = base → 1 (todos los casos cumplen)
 */
export function frecuenciaEvento(base: number, eventos: number): number {
  if (eventos <= 0) return 0;
  if (base <= 0) return 0;
  return base / eventos;
}

/**
 * Texto humano: "Cada 8.5 ataques".
 *
 * Si `valor = 0`, devuelve "Sin datos".
 * Si `valor = 1`, devuelve "Siempre" (todos los casos cumplen).
 * Si `valor = 2`, devuelve "Cada 2 (uno de cada 2)".
 */
export function describirFrecuencia(
  valor: number,
  unidad = "acciones"
): string {
  if (valor <= 0) return "Sin datos";
  if (valor === 1) return `Siempre (todos los ${unidad})`;
  if (valor === 2) return `1 de cada 2 ${unidad}`;
  return `Cada ${redondear(valor, 1)} ${unidad}`;
}

// ------------------------------------------------------------
// CÁLCULO A PARTIR DE ACCIONES
// ------------------------------------------------------------

export type FiltroFrecuencia = (a: AccionVisual) => boolean;

/**
 * Calcula la frecuencia de "cuántas acciones cumplen `condicion`"
 * dentro de un conjunto de acciones base.
 *
 * @param acciones Todas las acciones candidatas (universo base).
 * @param condicion Predicado que marca los "eventos".
 * @param unidad Nombre de la unidad ("ataques", "saques", etc.).
 * @param filtroBase Opcional: restringe el universo base antes de
 *                   calcular. Ej. solo acciones propias, o solo
 *                   ataques, o solo lo que cumple otro filtro.
 */
export function calcularFrecuencia(
  acciones: AccionVisual[],
  condicion: FiltroFrecuencia,
  unidad = "acciones",
  filtroBase?: FiltroFrecuencia
): FrecuenciaResultado {
  const visibles = acciones.filter((a) => !a.oculta);
  const base = filtroBase ? visibles.filter(filtroBase) : visibles;

  let eventos = 0;
  for (const a of base) {
    if (condicion(a)) eventos += 1;
  }

  const valor = frecuenciaEvento(base.length, eventos);
  return {
    valor: redondear(valor, 2),
    base: base.length,
    eventos,
    descripcion: describirFrecuencia(valor, unidad),
  };
}

// ------------------------------------------------------------
// ATAJOS POR FUNDAMENTO
// ------------------------------------------------------------
// Los atajos de abajo son solo helpers de comodidad. No agregan
// lógica nueva: usan `calcularFrecuencia` con las condiciones
// típicas de cada fundamento.
// ------------------------------------------------------------

/**
 * "¿Cada cuántos ataques comete un error?"
 *
 * Solo cuenta ataques propios. Un "error" es cualquier subtipo de
 * ataque que clasifique como error (error, error_afuera_ataque,
 * error_red_ataque, gorro_ataque).
 */
export function frecuenciaErrorEnAtaque(
  acciones: AccionVisual[]
): FrecuenciaResultado {
  const esAtaque = (a: AccionVisual) =>
    a.tipo === "ataque" && !a.es_rival;
  const esError = (a: AccionVisual) => {
    const s =
      a.subtipo !== null && a.subtipo !== undefined
        ? String(a.subtipo)
        : "";
    const base = s.startsWith("toque:") ? s.slice(6) : s;
    return (
      base === "error" ||
      base === "error_afuera_ataque" ||
      base === "error_red_ataque" ||
      base === "gorro_ataque"
    );
  };
  return calcularFrecuencia(
    acciones,
    esError,
    "ataques",
    esAtaque
  );
}

/**
 * "¿Cada cuántos saques hace un ace?"
 */
export function frecuenciaAceEnSaque(
  acciones: AccionVisual[]
): FrecuenciaResultado {
  const esSaque = (a: AccionVisual) => a.tipo === "saque" && !a.es_rival;
  const esAce = (a: AccionVisual) => {
    const s =
      a.subtipo !== null && a.subtipo !== undefined
        ? String(a.subtipo)
        : "";
    return s === "ace";
  };
  return calcularFrecuencia(acciones, esAce, "saques", esSaque);
}

/**
 * "¿Cada cuántos saques comete un error?"
 */
export function frecuenciaErrorEnSaque(
  acciones: AccionVisual[]
): FrecuenciaResultado {
  const esSaque = (a: AccionVisual) => a.tipo === "saque" && !a.es_rival;
  const esError = (a: AccionVisual) => {
    const s =
      a.subtipo !== null && a.subtipo !== undefined
        ? String(a.subtipo)
        : "";
    return s === "negativo";
  };
  return calcularFrecuencia(acciones, esError, "saques", esSaque);
}

/**
 * "¿Cada cuántas recepciones le sale una negativa?"
 */
export function frecuenciaRecepcionNegativa(
  acciones: AccionVisual[]
): FrecuenciaResultado {
  const esRecepcion = (a: AccionVisual) =>
    a.tipo === "recepcion" && !a.es_rival;
  const esNegativa = (a: AccionVisual) => {
    const s =
      a.subtipo !== null && a.subtipo !== undefined
        ? String(a.subtipo)
        : "";
    return (
      s === "negativa" ||
      s === "doble_negativa" ||
      s === "overpass" ||
      s === "error_directo"
    );
  };
  return calcularFrecuencia(
    acciones,
    esNegativa,
    "recepciones",
    esRecepcion
  );
}

// ------------------------------------------------------------
// CÁLCULO ENTRE DOS CONJUNTOS
// ------------------------------------------------------------

/**
 * Variante explícita: recibe `accionesBase` y `accionesEvento` ya
 * filtrados por separado. Sirve cuando el motor ya tiene ambos
 * conjuntos calculados.
 *
 * Los `eventos` se cuentan sobre el array de eventos.
 * El `base` se cuenta sobre el array base.
 *
 * No verifica que los eventos estén dentro de la base (el motor
 * es responsable de que así sea).
 */
export function frecuenciaEntreConjuntos(
  accionesBase: AccionVisual[],
  accionesEvento: AccionVisual[],
  unidad = "acciones"
): FrecuenciaResultado {
  const baseVisibles = accionesBase.filter((a) => !a.oculta);
  const eventosVisibles = accionesEvento.filter((a) => !a.oculta);
  const valor = frecuenciaEvento(baseVisibles.length, eventosVisibles.length);
  return {
    valor: redondear(valor, 2),
    base: baseVisibles.length,
    eventos: eventosVisibles.length,
    descripcion: describirFrecuencia(valor, unidad),
  };
}