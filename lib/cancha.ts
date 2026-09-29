// ============================================
// HELPERS DE CANCHA — grid, celdas, miniceldas
// ============================================

export const COLUMNAS = ["C1", "C2", "C3", "C4", "C5"] as const;
export type Columna = (typeof COLUMNAS)[number];

export const FILAS_PROPIAS = ["F1", "F2", "F3"] as const;
export const FILAS_RIVAL = ["F4", "F5", "F6"] as const;
export const FILAS_TODAS = [...FILAS_PROPIAS, ...FILAS_RIVAL] as const;
export type Fila = (typeof FILAS_TODAS)[number];

export type Celda = `${Fila}-${Columna}`;

// ------------------------------------------------------------
// Dimensiones del grid
// ------------------------------------------------------------
// Ancho: C1=2, C2=3, C3=3, C4=3, C5=2 → total 13 unidades
// Alto:  cada fila = 3 unidades → F1..F3 = 9, F1..F6 = 18
// ------------------------------------------------------------
export const ANCHO_TOTAL = 13;
export const ALTO_POR_FILA = 3;
export const ALTO_PROPIAS = 9;
export const ALTO_TOTAL = 18;

export const RED_INICIO_X = 2;
export const RED_FIN_X = 11;

// ------------------------------------------------------------
// Ancho de cada columna (en unidades del grid)
// ------------------------------------------------------------
export const ANCHO_COLUMNA: Record<Columna, number> = {
  C1: 2,
  C2: 3,
  C3: 3,
  C4: 3,
  C5: 2,
};

// ------------------------------------------------------------
// Rango [x0, x1] de cada columna
// ------------------------------------------------------------
export const RANGO_X: Record<Columna, [number, number]> = (() => {
  const r: Partial<Record<Columna, [number, number]>> = {};
  let acum = 0;
  for (const c of COLUMNAS) {
    const ancho = ANCHO_COLUMNA[c];
    r[c] = [acum, acum + ancho];
    acum += ancho;
  }
  return r as Record<Columna, [number, number]>;
})();

// ------------------------------------------------------------
// Rango [z0, z1] de cada fila
// ------------------------------------------------------------
export const RANGO_Z: Record<Fila, [number, number]> = (() => {
  const r: Partial<Record<Fila, [number, number]>> = {};
  FILAS_TODAS.forEach((f, i) => {
    r[f] = [i * ALTO_POR_FILA, (i + 1) * ALTO_POR_FILA];
  });
  return r as Record<Fila, [number, number]>;
})();

// ------------------------------------------------------------
// Parseo
// ------------------------------------------------------------
export function parsearCelda(celda: string): { fila: Fila; col: Columna } | null {
  const partes = celda.split("-");
  if (partes.length !== 2) return null;
  const [fila, col] = partes;
  if (!FILAS_TODAS.includes(fila as Fila)) return null;
  if (!COLUMNAS.includes(col as Columna)) return null;
  return { fila: fila as Fila, col: col as Columna };
}

export function parsearMini(
  mini: string
): { f: number; c: number } | null {
  const m = mini.match(/^f(\d)c(\d)$/);
  if (!m) return null;
  return { f: parseInt(m[1]), c: parseInt(m[2]) };
}

// ------------------------------------------------------------
// ¿Cuántas minis tiene una columna?
// C1 y C5: 2 columnas de minis
// C2, C3, C4: 3 columnas de minis
// ------------------------------------------------------------
export function minisColumnas(col: Columna): number {
  return col === "C1" || col === "C5" ? 2 : 3;
}

// ------------------------------------------------------------
// ¿Cuántas minis tiene una fila? (siempre 3 por defecto)
// ------------------------------------------------------------
export function minisFilas(_fila: Fila, _contexto: Contexto = "ataque"): number {
  return 3;
}

export type Contexto = "armado" | "ataque" | "defensa";

// ------------------------------------------------------------
// Lista de minis de una celda
// ------------------------------------------------------------
export function minisDeCelda(
  celda: Celda,
  contexto: Contexto = "ataque"
): string[] {
  const parsed = parsearCelda(celda);
  if (!parsed) return [];
  const { fila, col } = parsed;

  // En armado, F3 no tiene minis (celda simple)
  if (contexto === "armado" && fila === "F3") return [];

  const cols = minisColumnas(col);
  const fils = minisFilas(fila, contexto);
  const out: string[] = [];
  for (let f = 1; f <= fils; f++) {
    for (let c = 1; c <= cols; c++) {
      out.push(`f${f}c${c}`);
    }
  }
  return out;
}

// ------------------------------------------------------------
// ¿Es celda simple (sin minis)?
// ------------------------------------------------------------
export function esCeldaSimple(
  celda: Celda,
  contexto: Contexto = "ataque"
): boolean {
  return minisDeCelda(celda, contexto).length === 0;
}

// ------------------------------------------------------------
// Lista de todas las celdas de un contexto
// ------------------------------------------------------------
export function celdasDeContexto(
  contexto: Contexto
): { celda: Celda; tipo: "mini33" | "mini32" | "single" }[] {
  const filas =
    contexto === "ataque" ? FILAS_TODAS : FILAS_PROPIAS;
  const out: { celda: Celda; tipo: "mini33" | "mini32" | "single" }[] = [];
  for (const fila of filas) {
    for (const col of COLUMNAS) {
      const celda = `${fila}-${col}` as Celda;
      const cols = minisColumnas(col);
      const tieneMinis = minisDeCelda(celda, contexto).length > 0;
      let tipo: "mini33" | "mini32" | "single";
      if (!tieneMinis) tipo = "single";
      else if (cols === 2) tipo = "mini32";
      else tipo = "mini33";
      out.push({ celda, tipo });
    }
  }
  return out;
}

// ------------------------------------------------------------
// Coordenadas (x, z) del centro de una celda
// ------------------------------------------------------------
export function centroDeCelda(celda: Celda): { x: number; z: number } | null {
  const parsed = parsearCelda(celda);
  if (!parsed) return null;
  const [x0, x1] = RANGO_X[parsed.col];
  const [z0, z1] = RANGO_Z[parsed.fila];
  return { x: (x0 + x1) / 2, z: (z0 + z1) / 2 };
}

// ------------------------------------------------------------
// Coordenadas (x, z) del centro de una mini
// ------------------------------------------------------------
export function centroDeMini(
  celda: Celda,
  mini: string | null,
  contexto: Contexto = "ataque"
): { x: number; z: number } | null {
  const parsed = parsearCelda(celda);
  if (!parsed) return null;
  const [x0, x1] = RANGO_X[parsed.col];
  const [z0, z1] = RANGO_Z[parsed.fila];

  if (!mini) return { x: (x0 + x1) / 2, z: (z0 + z1) / 2 };

  const m = parsearMini(mini);
  if (!m) return null;

  const cols = minisColumnas(parsed.col);
  const fils = minisFilas(parsed.fila, contexto);
  const ancho = (x1 - x0) / cols;
  const alto = (z1 - z0) / fils;

  return {
    x: x0 + (m.c - 0.5) * ancho,
    z: z0 + (m.f - 0.5) * alto,
  };
}

// ------------------------------------------------------------
// ¿La celda está en cancha propia o rival?
// ------------------------------------------------------------
export function esCanchaPropia(fila: Fila): boolean {
  return FILAS_PROPIAS.includes(fila as (typeof FILAS_PROPIAS)[number]);
}
export function esCanchaRival(fila: Fila): boolean {
  return FILAS_RIVAL.includes(fila as (typeof FILAS_RIVAL)[number]);
}

// ------------------------------------------------------------
// Mapeo de origen de ataque → zona (según handoff)
// ------------------------------------------------------------
export function zonaDeOrigenAtaque(celda: string): number | null {
  switch (celda) {
    case "F1-C1":
    case "F1-C2":
      return 4;
    case "F1-C3":
      return 3;
    case "F1-C4":
    case "F1-C5":
      return 2;
    case "F2-C2":
      return 4;
    case "F2-C3":
    case "F3-C3":
      return 6;
    case "F2-C4":
    case "F2-C5":
    case "F3-C4":
    case "F3-C5":
      return 2;
    default:
      return null;
  }
}

// ------------------------------------------------------------
// Clave de origen/destino unificada
// ------------------------------------------------------------
export function keyPunto(
  celda: string,
  mini: string | null
): string {
  return mini ? `${celda}-${mini}` : celda;
}

export function parseKeyPunto(
  key: string
): { celda: string; mini: string | null } {
  const partes = key.split("-");
  if (partes.length === 2) return { celda: key, mini: null };
  return {
    celda: `${partes[0]}-${partes[1]}`,
    mini: partes.slice(2).join("-"),
  };
}

// ------------------------------------------------------------
// Filas de origen del saque (9 posiciones pegadas a F3)
// ------------------------------------------------------------
export const SAQUE_ORIGEN = [
  "S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9",
] as const;
export type SaqueOrigen = (typeof SAQUE_ORIGEN)[number];

// ------------------------------------------------------------
// Filas de destino del saque (9 posiciones entre F1 y F4 = red)
// ------------------------------------------------------------
export const SAQUE_DESTINO = [
  "D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9",
] as const;
export type SaqueDestino = (typeof SAQUE_DESTINO)[number];

// ------------------------------------------------------------
// Valores de recepción 1-6
// ------------------------------------------------------------
export const VALORES_RECEPCION_NUEVOS: Record<number, string> = {
  1: "Ace en contra",
  2: "3x Negativa",
  3: "2x Negativa",
  4: "Negativa",
  5: "Positiva",
  6: "2x Positiva",
};
