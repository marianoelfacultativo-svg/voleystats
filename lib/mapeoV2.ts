// ============================================================
// MAPEO V2 — celda → zona → jugador
// Sistema 5-1 con rotación dinámica
// ============================================================

import type { RotacionPunto, TipoLogico } from "./rotaciones";

// ------------------------------------------------------------
// 1. MAPEO FIJO: celda → zona de ataque (crudo)
// ------------------------------------------------------------
// Devuelve la zona "nominal". La zona 2/1 se resuelve después
// según quién esté delantero/zaguero (ver resolverZonaBanda).
// ------------------------------------------------------------

export function zonaCrudaDeCelda(celda: string): number | null {
  switch (celda) {
    // Banda izquierda (zona 4)
    case "F1-C1":
    case "F1-C2":
    case "F2-C2":
      return 4;
    // Centro (zona 3)
    case "F1-C3":
      return 3;
    // Banda derecha (zona 2 o 1, según rotación)
    case "F1-C4":
    case "F1-C5":
    case "F2-C4":
    case "F2-C5":
    case "F3-C4":
    case "F3-C5":
      return 2; // se resuelve después a 1 o 2
    // Zaguero centro (zona 6 / pipe)
    case "F2-C3":
    case "F3-C3":
      return 6;
    // F2-C1, F3-C1, F3-C2 → no cuentan
    default:
      return null;
  }
}

// ------------------------------------------------------------
// 2. RESOLVER BANDA DERECHA: zona 2 vs zona 1
// ------------------------------------------------------------
// El opuesto siempre ataca por la banda derecha. Si está
// delantero (zona 2) ataca por 2; si está zaguero (zona 1) ataca
// por 1. Excepción: R1 recepción → el que ataca por 2 es el punta.
// ------------------------------------------------------------

export function resolverZonaBanda(
  rotacion: RotacionPunto,
  situacion: "saque" | "recepcion"
): 1 | 2 | null {
  const numeroRot = numeroRotacionDesdeArmador(rotacion);
  if (!numeroRot) return null;

  // Excepción R1 recepción: ataca el punta por 2
  // (igual devolvemos 2, porque la zona es la misma)
  // La diferencia es QUIÉN, no la zona.

  // Buscar al opuesto
  let zonaOpuesto: number | null = null;
  for (const asig of Object.values(rotacion.posiciones)) {
    if (asig.tipo === "O") {
      zonaOpuesto = asig.zona;
      break;
    }
  }
  if (!zonaOpuesto) return null;

  // Delantero = zona 2, 3 o 4
  const esDelantero = zonaOpuesto === 2 || zonaOpuesto === 3 || zonaOpuesto === 4;
  return esDelantero ? 2 : 1;
}

// ------------------------------------------------------------
// 3. ZONA FINAL de una celda (resolviendo 2 vs 1)
// ------------------------------------------------------------

export function zonaFinalDeCelda(
  celda: string,
  rotacion: RotacionPunto,
  situacion: "saque" | "recepcion"
): number | null {
  const cruda = zonaCrudaDeCelda(celda);
  if (cruda === null) return null;
  if (cruda === 2) {
    return resolverZonaBanda(rotacion, situacion);
  }
  return cruda;
}

// ------------------------------------------------------------
// 4. QUIÉN ATACA POR CADA ZONA
// ------------------------------------------------------------

/**
 * Devuelve el jugador_id que ataca desde la celda indicada,
 * según la rotación y la situación.
 */
export function jugadorQueAtacaDesdeCelda(
  celda: string,
  rotacion: RotacionPunto,
  situacion: "saque" | "recepcion"
): string | null {
  const zona = zonaFinalDeCelda(celda, rotacion, situacion);
  if (zona === null) return null;

  const numeroRot = numeroRotacionDesdeArmador(rotacion);
  if (!numeroRot) return null;

  // Excepción R1 recepción: el que ataca por 2 es el punta
  const excepcionR1 = numeroRot === 1 && situacion === "recepcion";

  // Caso 1: zona 2 o 1
  if (zona === 1 || zona === 2) {
    if (excepcionR1 && zona === 2) {
      // Ataca el punta que está en zona 2
      for (const asig of Object.values(rotacion.posiciones)) {
        if (asig.tipo === "P1" || asig.tipo === "P2") {
          if (asig.zona === 2) return asig.jugador_id;
        }
      }
    }
    // Caso normal: ataca el opuesto
    for (const asig of Object.values(rotacion.posiciones)) {
      if (asig.tipo === "O") return asig.jugador_id;
    }
    return null;
  }

  // Caso 2: zona 4 → el punta que está adelante
  if (zona === 4) {
    for (const asig of Object.values(rotacion.posiciones)) {
      if ((asig.tipo === "P1" || asig.tipo === "P2") &&
          (asig.zona === 4 || asig.zona === 3 || asig.zona === 2)) {
        return asig.jugador_id;
      }
    }
    // Excepción R1 recepción: ataca el opuesto por 4
    if (excepcionR1) {
      for (const asig of Object.values(rotacion.posiciones)) {
        if (asig.tipo === "O") return asig.jugador_id;
      }
    }
    return null;
  }

  // Caso 3: zona 3 → el central que está adelante
  if (zona === 3) {
    for (const asig of Object.values(rotacion.posiciones)) {
      if ((asig.tipo === "C1" || asig.tipo === "C2") &&
          (asig.zona === 4 || asig.zona === 3 || asig.zona === 2)) {
        return asig.jugador_id;
      }
    }
    return null;
  }

  // Caso 4: zona 6 → el punta que está atrás (o el opuesto si R1 saque)
  if (zona === 6) {
    for (const asig of Object.values(rotacion.posiciones)) {
      if ((asig.tipo === "P1" || asig.tipo === "P2") &&
          (asig.zona === 1 || asig.zona === 6 || asig.zona === 5)) {
        return asig.jugador_id;
      }
    }
    return null;
  }

  return null;
}

// ------------------------------------------------------------
// 5. HELPER: número de rotación desde la posición del armador
// ------------------------------------------------------------

export function numeroRotacionDesdeArmador(
  rotacion: RotacionPunto
): number | null {
  for (const asig of Object.values(rotacion.posiciones)) {
    if (asig.tipo === "A") return asig.zona;
  }
  return null;
}

// ------------------------------------------------------------
// 6. EXPORTS auxiliares
// ------------------------------------------------------------

export type { TipoLogico };