// ============================================================
// CLASIFICACIÓN — Resultado, subtipo base, ubicación, puntaje
// ============================================================
// Extraído de lib/analisisConsecuencias.ts (v9).
//
// Funciones puras:
//   - clasificarResultado(a): punto / error / neutro.
//   - baseSubtipo(a): saca el prefijo "toque:" del subtipo.
//   - ubicacionDeZona(zona): delantero / zaguero / otro.
//   - puntajeDeAccion(a): puntaje 0..10 para top% y vsPromedio.
// ============================================================

import type { AccionVisual } from "../../app/equipo/adaptadorUnificadoV2";
import type { CategoriaResultado, UbicacionFiltro } from "./tipos";

export function baseSubtipo(a: AccionVisual): string {
  const s =
    a.subtipo !== null && a.subtipo !== undefined ? String(a.subtipo) : "";
  return s.startsWith("toque:") ? s.slice(6) : s;
}

export function clasificarResultado(a: AccionVisual): CategoriaResultado {
  const sub = baseSubtipo(a).toLowerCase();
  const tipo = a.tipo;

  if (a.es_error) return "error";

  if (tipo === "ataque") {
    if (sub === "punto") return "punto";
    if (
      sub.includes("error") ||
      sub.includes("gorro") ||
      sub === "use_rival_ataque" ||
      sub === "error_red_ataque" ||
      sub === "error_afuera_ataque"
    )
      return "error";
    return "neutro";
  }

  if (tipo === "saque") {
    if (sub === "ace") return "punto";
    if (sub === "negativo" || sub.includes("error")) return "error";
    return "neutro";
  }

  if (tipo === "bloqueo") {
    if (sub === "punto") return "punto";
    if (sub === "red" || sub === "use_rival") return "error";
    return "neutro";
  }

  if (tipo === "recepcion") {
    if (sub === "ace_contra" || sub === "error_directo") return "error";
    if (sub === "perfecta" || sub === "2x_positiva" || sub === "positiva")
      return "punto";
    return "neutro";
  }

  if (tipo === "defensa") {
    if (
      sub === "error_def" ||
      sub === "errores_graves" ||
      sub === "mala_libre"
    )
      return "error";
    if (
      sub === "gran_def" ||
      sub === "toque_positiva" ||
      sub === "cobertura_positiva"
    )
      return "punto";
    return "neutro";
  }

  if (sub.includes("punto") || sub === "ace") return "punto";
  if (sub.includes("error") || sub === "horrible" || sub === "malo")
    return "error";
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
  if (a.tipo === "saque") {
    switch (sub) {
      case "ace": return 10;
      case "positivo_mas": return 8;
      case "positivo": return 6;
      case "neutro": return 5;
      case "negativo": return 2;
      default: return null;
    }
  }
  if (a.tipo === "recepcion") {
    switch (sub) {
      case "perfecta": return 10;
      case "positiva": return 8;
      case "intermedia": return 5;
      case "negativa": return 4;
      case "doble_negativa": return 2;
      case "overpass": return 1;
      case "error_directo": return 0;
      default: return null;
    }
  }
  if (a.tipo === "armado") {
    if (sub === "R") return 5;
    const n = parseInt(sub, 10);
    if (isNaN(n)) return null;
    switch (n) {
      case 6: return 10;
      case 5: return 8;
      case 4: return 6;
      case 3: return 3;
      case 2: return 1;
      case 1: return 0;
      default: return null;
    }
  }
  if (a.tipo === "ataque") {
    switch (sub) {
      case "punto":
      case "punto_directo_ataque":
      case "punto_desviado_ataque":
      case "use_rival_ataque":
        return 10;
      case "neutro":
      case "neutro_bloqueo_cobertura_ataque":
      case "neutro_desvio_bloqueo_defensa_ataque":
      case "neutro_defensa_ataque":
        return 2;
      case "error":
      case "error_red_ataque":
      case "error_afuera_ataque":
      case "gorro_ataque":
        return 0;
      default: return null;
    }
  }
  if (a.tipo === "bloqueo") {
    switch (sub) {
      case "punto": return 10;
      case "positivo_mas": return 8;
      case "positivo": return 6;
      case "neutro": return 5;
      case "use_rival": return 3;
      case "filtrada": return 2;
      case "red": return 0;
      default: return null;
    }
  }
  if (a.tipo === "defensa") {
    switch (sub) {
      case "gran_def":
      case "toque_positiva":
      case "cobertura_positiva":
        return 10;
      case "neutro": return 5;
      case "toque_negativa":
      case "error_def":
      case "cobertura_negativa":
      case "errores_graves":
        return 0;
      case "mala_libre": return -2;
      default: return null;
    }
  }
  return null;
}