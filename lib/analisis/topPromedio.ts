// ============================================================
// TOP % y VS PROMEDIO
// ============================================================
// Extraído de lib/analisisConsecuencias.ts (v9).
//
// Funciones puras que devuelven Set<string> con los IDs de las
// acciones que pasan el filtro de top% o de vs promedio.
//
// Se calculan sobre el universo completo de acciones del tipo
// (no sobre el subset filtrado) para que el promedio sea
// representativo del equipo, no del subset.
// ============================================================

import type { AccionVisual } from "../../app/equipo/adaptadorUnificadoV2";
import { puntajeDeAccion } from "./clasificacion";
import type { TipoDisparador } from "./tipos";

export function calcularIdsTopPorcentaje(
  todasAcciones: AccionVisual[],
  tipo: TipoDisparador,
  porcentaje: number
): Set<string> {
  const delTipo = todasAcciones
    .filter((a) => !a.oculta && a.tipo === tipo)
    .map((a) => ({ id: a.id, p: puntajeDeAccion(a) }))
    .filter((x): x is { id: string; p: number } => x.p !== null);

  if (delTipo.length === 0) return new Set();

  delTipo.sort((a, b) => b.p - a.p);
  const cuantos = Math.max(1, Math.ceil((delTipo.length * porcentaje) / 100));
  return new Set(delTipo.slice(0, cuantos).map((x) => x.id));
}

export function calcularIdsVsPromedio(
  todasAcciones: AccionVisual[],
  tipo: TipoDisparador,
  modo: "por_encima" | "por_debajo"
): Set<string> {
  const delTipo = todasAcciones
    .filter((a) => !a.oculta && a.tipo === tipo)
    .map((a) => ({ id: a.id, p: puntajeDeAccion(a) }))
    .filter((x): x is { id: string; p: number } => x.p !== null);

  if (delTipo.length === 0) return new Set();

  const suma = delTipo.reduce((s, x) => s + x.p, 0);
  const prom = suma / delTipo.length;

  const out = new Set<string>();
  for (const x of delTipo) {
    if (modo === "por_encima" && x.p > prom) out.add(x.id);
    else if (modo === "por_debajo" && x.p < prom) out.add(x.id);
  }
  return out;
}