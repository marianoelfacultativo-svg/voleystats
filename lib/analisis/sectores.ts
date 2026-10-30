// ============================================================
// SECTORES DE ATAQUE — 6 de banda + 4 de centro
// ============================================================
// Extraído de lib/analisisConsecuencias.ts (v9).
//
// Mapeo por origen + zona destino:
//
//   Origen 4 (delantero izq):   Z4→diagonal_corta, Z5→diagonal, Z6→a_6,
//                               Z1→paralela, Z2→detras_bloqueo, Z3→a_la_olla
//   Origen 2 (delantero der):   Z2→diagonal_corta, Z1→diagonal, Z6→a_6,
//                               Z5→paralela, Z4→detras_bloqueo, Z3→a_la_olla
//   Origen 1 (zaguero der):     = origen 2
//   Origen 5 (zaguero izq):     = origen 4
//   Origen 3 o 6 (centro):
//                               Z1+Z2→zona_1, Z4+Z5→zona_5,
//                               Z6→zona_6, Z3→olla
// ============================================================

import type { AccionVisual } from "../../app/equipo/adaptadorUnificadoV2";
import { zonaDefensaRival } from "./zonas";

export const SECTORES_ATAQUE = [
  "diagonal_corta",
  "diagonal",
  "a_6",
  "paralela",
  "detras_bloqueo",
  "a_la_olla",
  "zona_1",
  "zona_5",
  "zona_6",
  "olla",
] as const;

export type SectorAtaque = (typeof SECTORES_ATAQUE)[number];

function sectorPorBanda(
  origen: 1 | 2 | 4 | 5,
  zonaDestino: number
): SectorAtaque | null {
  // Origen 1 y 2 comparten mapeo.
  if (origen === 1 || origen === 2) {
    switch (zonaDestino) {
      case 2:
        return "diagonal_corta";
      case 1:
        return "diagonal";
      case 6:
        return "a_6";
      case 5:
        return "paralela";
      case 4:
        return "detras_bloqueo";
      case 3:
        return "a_la_olla";
      default:
        return null;
    }
  }
  // Origen 4 y 5 (espejo)
  switch (zonaDestino) {
    case 4:
      return "diagonal_corta";
    case 5:
      return "diagonal";
    case 6:
      return "a_6";
    case 1:
      return "paralela";
    case 2:
      return "detras_bloqueo";
    case 3:
      return "a_la_olla";
    default:
      return null;
  }
}

function sectorPorCentro(zonaDestino: number): SectorAtaque | null {
  switch (zonaDestino) {
    case 1:
    case 2:
      return "zona_1";
    case 4:
    case 5:
      return "zona_5";
    case 6:
      return "zona_6";
    case 3:
      return "olla";
    default:
      return null;
  }
}

export function calificarSectorAtaque(a: AccionVisual): SectorAtaque | null {
  if (a.tipo !== "ataque") return null;
  if (a.zona_origen === null || a.zona_origen === undefined) return null;

  const zonaDestino = zonaDefensaRival(a.destino_celda, a.destino_mini);
  if (zonaDestino === null) return null;

  const o = a.zona_origen;
  if (o === 1 || o === 2 || o === 4 || o === 5) {
    return sectorPorBanda(o, zonaDestino);
  }
  if (o === 3 || o === 6) {
    return sectorPorCentro(zonaDestino);
  }
  return null;
}

export function etiquetaSectorAtaque(s: SectorAtaque | string): string {
  const map: Record<string, string> = {
    diagonal_corta: "Diagonal corta",
    diagonal: "Diagonal (larga)",
    a_6: "A 6",
    paralela: "Paralela",
    detras_bloqueo: "Detrás del bloqueo",
    a_la_olla: "A la olla",
    zona_1: "Zona 1 (Z1+Z2)",
    zona_5: "Zona 5 (Z4+Z5)",
    zona_6: "Zona 6",
    olla: "Olla",
  };
  return map[s] ?? s;
}

export function etiquetaZonaDefensa(z: number | null): string {
  if (z === null) return "Sin zona";
  return `Z${z}`;
}