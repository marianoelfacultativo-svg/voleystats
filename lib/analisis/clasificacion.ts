// ============================================================
// CLASIFICACIÓN — Resultado, subtipo base, ubicación, puntaje
// ============================================================
// Extraído de lib/analisisConsecuencias.ts (v9).
//
// Funciones puras:
// - clasificarResultado(a): punto / error / neutro.
// - baseSubtipo(a): saca el prefijo "toque:" del subtipo.
// - ubicacionDeZona(zona): delantero / zaguero / otro.
// - puntajeDeAccion(a): puntaje 0..10 para top% y vsPromedio.
// ============================================================

import type { AccionVisual } from "../../app/equipo/adaptadorUnificadoV2";
import type { CategoriaResultado, UbicacionFiltro } from "./tipos";
import {
  clasificarSubtipo,
  puntajeDeSubtipo,
} from "./catalogoSubtipos";

export function baseSubtipo(a: AccionVisual): string {
  const s = a.subtipo !== null && a.subtipo !== undefined ? String(a.subtipo) : "";
  return s.startsWith("toque:") ? s.slice(6) : s;
}

export function clasificarResultado(a: AccionVisual): CategoriaResultado {
  const sub = baseSubtipo(a).toLowerCase();
  const tipo = a.tipo;

  // Override explícito del DataEntry: si está marcado como error, es error.
  if (a.es_error) return "error";

  // Mapear "armado" (singular, viene de AccionVisual) a "armados" (catálogo).
  const fundamento = tipo === "armado" ? "armados" : tipo;

  const cat = clasificarSubtipo(fundamento, sub);
  if (cat !== null) return cat;

  // Fallback defensivo para subtipos no catalogados.
  // Replica el comportamiento viejo para no romper nada raro.
  if (tipo === "ataque") {
    if (sub.includes("error") || sub.includes("gorro")) return "error";
    return "neutro";
  }
  if (tipo === "recepcion") {
    if (sub === "ace_contra" || sub === "error_directo") return "error";
    if (sub === "perfecta" || sub === "2x_positiva" || sub === "positiva")
      return "punto";
    return "neutro";
  }
  if (sub.includes("punto")) return "punto";
  if (sub.includes("error")) return "error";
  return "neutro";
}

export function ubicacionDeZona(zona: number | null): UbicacionFiltro {
  if (zona === null || zona === undefined) return "otro";
  if (zona === 1 || zona === 5 || zona === 6) return "zaguero";
  if (zona === 2 || zona === 3 || zona === 4) return "delantero";
  return "otro";
}

export function puntajeDeAccion(a: AccionVisual): number | null {
  const sub = baseSubtipo(a);
  const tipo = a.tipo;
  const fundamento = tipo === "armado" ? "armados" : tipo;
  return puntajeDeSubtipo(fundamento, sub);
}