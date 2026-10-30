// ============================================================
// INFERENCIAS — Llamada de armado + dirección de ataque legacy
// ============================================================
// Extraído de lib/analisisConsecuencias.ts (v9).
//
// Dos inferencias:
//   1. inferirLlamadaArmado(a): a partir de velocidad + destino
//      del armado. Devuelve la "llamada" (hatu, corta_atras,
//      shoot, superfast, v, bic, pipe, hanati_volada, slide,
//      alta_a_4, alta_a_2, alta_al_central, pipe_alto).
//
//   2. inferirDireccionAtaque(a): legacy. La UI v5 la sigue
//      importando. Se mantiene tal cual. El nuevo sistema de
//      sectores vive en lib/analisis/sectores.ts.
// ============================================================

import type { AccionVisual } from "../../app/equipo/adaptadorUnificadoV2";

// ------------------------------------------------------------
// LLAMADA DE ARMADO
// ------------------------------------------------------------

function zonaDesdeCeldaArmado(celda: string | null): number | null {
  if (!celda) return null;
  switch (celda) {
    case "F1-C1":
    case "F1-C2":
      return 4;
    case "F1-C3":
      return 3;
    case "F1-C4":
    case "F1-C5":
      return 2;
    case "F2-C3":
    case "F3-C3":
      return 6;
    case "F2-C1":
    case "F3-C1":
      return 5;
    case "F2-C4":
    case "F2-C5":
    case "F3-C4":
    case "F3-C5":
      return 1;
    case "F2-C2":
    case "F3-C2":
      return 4;
    default:
      return null;
  }
}

function esCentralAdelante(destinoMini: string | null): boolean {
  if (!destinoMini) return true;
  const m = destinoMini.match(/^f(\d+)c(\d+)$/);
  if (!m) return true;
  const col = parseInt(m[2], 10);
  return col <= 2;
}

export function inferirLlamadaArmado(a: AccionVisual): string | null {
  if (a.tipo !== "armado") return null;
  const v = a.velocidad;
  const zona = zonaDesdeCeldaArmado(a.destino_celda);
  if (zona === null) return null;

  if (v === 1) {
    if (zona === 3) {
      return esCentralAdelante(a.destino_mini) ? "hatu" : "corta_atras";
    }
    if (zona === 4) return "superfast";
    if (zona === 2) return "v";
    if (zona === 6) return "bic";
    return null;
  }

  if (v === 1.5) {
    if (zona === 6) return "pipe";
    if (zona === 3) return "hanati_volada";
    if (zona === 2) return "slide";
    return null;
  }

  if (v === 2 || v === 3 || v === 5) {
    if (zona === 4) return "alta_a_4";
    if (zona === 2) return "alta_a_2";
    if (zona === 6) return "pipe_alto";
    if (zona === 3) return "alta_al_central";
    return null;
  }

  return null;
}

// ------------------------------------------------------------
// DIRECCIÓN DE ATAQUE — legacy
// ------------------------------------------------------------
//
// Se mantiene porque la UI v5 la importa. El nuevo sistema de
// 10 sectores vive en lib/analisis/sectores.ts y no depende de
// esta función.
// ------------------------------------------------------------

export function inferirDireccionAtaque(a: AccionVisual): string | null {
  if (a.tipo !== "ataque") return null;
  const o = a.zona_origen;
  const d = a.zona_destino;
  if (o === null || d === null) return null;

  if (o === 4) {
    if (d === 1 || d === 2) return "diagonal";
    if (d === 5 || d === 6) return "paralela";
    if (d === 4) return "en_linea";
    if (d === 3) return "diagonal";
  }
  if (o === 2) {
    if (d === 4 || d === 5) return "diagonal";
    if (d === 1 || d === 6) return "paralela";
    if (d === 2) return "en_linea";
    if (d === 3) return "diagonal";
  }
  if (o === 3) {
    if (d === 5 || d === 1) return "diagonal";
    if (d === 6) return "en_linea";
    if (d === 4 || d === 2) return "diagonal";
  }
  if (o === 6) return "sobre_6";
  if (o === 1 || o === 5) return "desde_zaguero";
  return null;
}