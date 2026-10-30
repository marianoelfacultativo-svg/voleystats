// ============================================================
// ZONAS DE DEFENSA — Rival y propia (Z1..Z6)
// ============================================================
// Extraído de lib/analisisConsecuencias.ts (v9).
//
// Vista DataEntry:
//   RIVAL (red abajo):
//     F6: Z1 Z1 Z6 Z5 Z5
//     F5: Z1 Z1 Z3 Z5 Z5
//     F4: Z2 Z2 Z3 Z4 Z4
//   PROPIA (red arriba):
//     F1: Z4 Z4 Z3 Z2 Z2
//     F2: Z5 Z5 Z3 Z1 Z1
//     F3: Z5 Z5 Z6 Z1 Z1
//
// Celdas partidas (mitad izquierda / derecha):
//   F3-C2-izq → Z5 ;  F3-C2-der → Z6 ;  c2 → Z6
//   F3-C4-izq → Z6 ;  F3-C4-der → Z1 ;  c2 → Z6
//   F6-C2-izq → Z1 ;  F6-C2-der → Z6 ;  c2 → Z6
//   F6-C4-izq → Z6 ;  F6-C4-der → Z5 ;  c2 → Z6
//
// Fuera de cancha (detrás del fondo):
//   FUERA-ARR-C1 → Z1 ; C2/C3/C4 → Z6 ; C5 → Z5
//   FUERA-ABA-C1 → Z5 ; C2/C3/C4 → Z6 ; C5 → Z1
//
// Sin dato (mini null): cae en la zona "exterior" de la celda.
// ============================================================

// Mapa base: celda exacta → zona (para celdas enteras)
const ZONA_RIVAL_ENTERA: Record<string, number> = {
  // F4 (adentro de la línea de 3)
  "F4-C1": 2,
  "F4-C2": 2,
  "F4-C3": 3,
  "F4-C4": 4,
  "F4-C5": 4,
  // F5
  "F5-C1": 1,
  "F5-C2": 1,
  "F5-C3": 3,
  "F5-C4": 5,
  "F5-C5": 5,
  // F6
  "F6-C1": 1,
  "F6-C2": 1,
  "F6-C3": 6,
  "F6-C4": 5,
  "F6-C5": 5,
  // Fuera rival
  "FUERA-ARR-C1": 1,
  "FUERA-ARR-C2": 6,
  "FUERA-ARR-C3": 6,
  "FUERA-ARR-C4": 6,
  "FUERA-ARR-C5": 5,
};

const ZONA_PROPIA_ENTERA: Record<string, number> = {
  // F1 (adentro de la línea de 3)
  "F1-C1": 4,
  "F1-C2": 4,
  "F1-C3": 3,
  "F1-C4": 2,
  "F1-C5": 2,
  // F2
  "F2-C1": 5,
  "F2-C2": 5,
  "F2-C3": 3,
  "F2-C4": 1,
  "F2-C5": 1,
  // F3
  "F3-C1": 5,
  "F3-C2": 5,
  "F3-C3": 6,
  "F3-C4": 1,
  "F3-C5": 1,
  // Fuera propio
  "FUERA-ABA-C1": 5,
  "FUERA-ABA-C2": 6,
  "FUERA-ABA-C3": 6,
  "FUERA-ABA-C4": 6,
  "FUERA-ABA-C5": 1,
};

// Celdas partidas → qué zona según mitad
const CELDAS_PARTIDAS: Record<
  string,
  { izq: number; der: number; centro: number }
> = {
  "F3-C2": { izq: 5, der: 6, centro: 6 },
  "F3-C4": { izq: 6, der: 1, centro: 6 },
  "F6-C2": { izq: 1, der: 6, centro: 6 },
  "F6-C4": { izq: 6, der: 5, centro: 6 },
};

// Celdas con sufijo explícito (por si el dato ya viene partido)
const ZONA_SUFIJO_RIVAL: Record<string, number> = {
  "F6-C2-izq": 1,
  "F6-C2-der": 6,
  "F6-C4-izq": 6,
  "F6-C4-der": 5,
};
const ZONA_SUFIJO_PROPIA: Record<string, number> = {
  "F3-C2-izq": 5,
  "F3-C2-der": 6,
  "F3-C4-izq": 6,
  "F3-C4-der": 1,
};

/** Devuelve la celda con sufijo -izq / -der si aplica. */
export function partirCelda(
  celda: string | null | undefined,
  mini: string | null | undefined
): string | null {
  if (!celda) return null;
  if (!CELDAS_PARTIDAS[celda]) return celda;
  // mini formato m1-5 (DataEntry) o f1c3 (legacy)
  let col: number | null = null;
  if (mini) {
    const m = mini.match(/^m\d+-(\d+)$/);
    if (m) col = parseInt(m[1], 10);
    else {
      const mf = mini.match(/^f\d+c(\d)$/);
      if (mf) col = parseInt(mf[1], 10);
    }
  }
  if (col === null) {
    // Sin dato: cae en la mitad "exterior" (izq en los -C2, der en los -C4)
    return celda.endsWith("-C2") ? `${celda}-izq` : `${celda}-der`;
  }
  // mini columna 1..9: c1..c3 = izq, c4..c6 = centro, c7..c9 = der
  // El centro va a Z6 (regla confirmada).
  if (col <= 3) return `${celda}-izq`;
  return `${celda}-der`;
}

export function zonaDefensaRival(
  celda: string | null | undefined,
  mini: string | null | undefined
): number | null {
  if (!celda) return null;
  if (ZONA_SUFIJO_RIVAL[celda] !== undefined) return ZONA_SUFIJO_RIVAL[celda];
  const partida = partirCelda(celda, mini);
  if (!partida) return null;
  if (ZONA_SUFIJO_RIVAL[partida] !== undefined) {
    return ZONA_SUFIJO_RIVAL[partida];
  }
  return ZONA_RIVAL_ENTERA[celda] ?? null;
}

export function zonaDefensaPropia(
  celda: string | null | undefined,
  mini: string | null | undefined
): number | null {
  if (!celda) return null;
  if (ZONA_SUFIJO_PROPIA[celda] !== undefined) return ZONA_SUFIJO_PROPIA[celda];
  const partida = partirCelda(celda, mini);
  if (!partida) return null;
  if (ZONA_SUFIJO_PROPIA[partida] !== undefined) {
    return ZONA_SUFIJO_PROPIA[partida];
  }
  return ZONA_PROPIA_ENTERA[celda] ?? null;
}