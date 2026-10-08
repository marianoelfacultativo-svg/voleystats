// ============================================================
// CLASIFICACIÓN V2 — motor de tipos de acción
// ============================================================

import type { RotacionPunto, Zona } from "./rotaciones";
import { jugadorQueAtacaDesdeCelda } from "./mapeoV2";

// ============================================================
// TIPOS
// ============================================================

export type TipoAccion =
  | "saque"
  | "recepcion"
  | "armado"
  | "ataque"
  | "bloqueo"
  | "defensa"
  | "libre"
  | "toque-red";

export type Lado = "propio" | "rival";
export type Situacion = "saque" | "recepcion";
export type PopupRequerido =
  | "saque"
  | "armado"
  | "defensa"
  | "libre"
  | "toque-red"
  | null;

export interface PuntoV2 {
  celda: string;
  mini: string;
}

export interface LineaInput {
  origen: PuntoV2;
  destino: PuntoV2;
  desvios?: PuntoV2[];
}

export interface LineaClasificada {
  id: string;
  tipo: TipoAccion;
  esRival: boolean;
  jugadorId: string | null;
  origen: PuntoV2;
  destino: PuntoV2;
  desvios?: PuntoV2[];
  subtipo?: string | number | null;
}

export interface EstadoClasificacion {
  saqueInicial: Lado;
  situacion: Situacion;
  rotacion: RotacionPunto;
  lineas: LineaClasificada[];
}

export interface ResultadoClasificacion {
  tipo: TipoAccion;
  esRival: boolean;
  jugadorId: string | null;
  popup: PopupRequerido;
  cierraPunto?: Lado;
  desvios?: PuntoV2[];
}

// ============================================================
// HELPERS DE CELDA
// ============================================================

export function ladoDeCelda(celda: string): Lado | null {
  if (/^F[123]-/.test(celda)) return "propio";
  if (/^F[456]-/.test(celda)) return "rival";
  if (celda.startsWith("BLOQ-P-")) return "propio";
  if (celda.startsWith("BLOQ-R-")) return "rival";
  if (celda.startsWith("FUERA-ARR-")) return "rival";
  if (celda.startsWith("FUERA-ABA-")) return "propio";
  return null; // RED-* = neutral
}

export function esRed(celda: string): boolean {
  return celda.startsWith("RED-");
}

export function esBloqueoPropio(celda: string): boolean {
  return celda.startsWith("BLOQ-P-");
}

export function esBloqueoRival(celda: string): boolean {
  return celda.startsWith("BLOQ-R-");
}

export function esBloqueo(celda: string): boolean {
  return esBloqueoPropio(celda) || esBloqueoRival(celda);
}

export function esCanchaPropia(celda: string): boolean {
  return /^F[123]-/.test(celda);
}

export function esCanchaRival(celda: string): boolean {
  return /^F[456]-/.test(celda);
}

export function esFuera(celda: string): boolean {
  return celda.startsWith("FUERA-");
}

// ============================================================
// RESOLUCIÓN DE JUGADOR — SAQUE
// ============================================================

/** Devuelve el jugador que saca: el que está en zona 1. */
function jugadorQueSaca(rotacion: RotacionPunto): string | null {
  for (const asig of Object.values(rotacion.posiciones)) {
    if (asig.zona === 1) return asig.jugador_id;
  }
  return null;
}

// ============================================================
// RESOLUCIÓN DE JUGADOR — RECEPCIÓN
// ============================================================

/** Zona de recepción según columna de la celda.
 *  C1+C2 → 5 · C3 → 6 · C4+C5 → 1
 */
function zonaRecepcion(celda: string): 1 | 5 | 6 | null {
  if (!/^F[123]-/.test(celda)) return null;
  const col = celda.split("-")[1];
  if (col === "C1" || col === "C2") return 5;
  if (col === "C3") return 6;
  if (col === "C4" || col === "C5") return 1;
  return null;
}

/** Busca al central delantero (zona 2/3/4). */
function buscarCentralDelantero(rotacion: RotacionPunto): string | null {
  for (const asig of Object.values(rotacion.posiciones)) {
    if (
      (asig.tipo === "C1" || asig.tipo === "C2") &&
      (asig.zona === 2 || asig.zona === 3 || asig.zona === 4)
    ) {
      return asig.jugador_id;
    }
  }
  return null;
}

/** Busca al central zaguero (zona 1/5/6). */
function buscarCentralZaguero(rotacion: RotacionPunto): string | null {
  for (const asig of Object.values(rotacion.posiciones)) {
    if (
      (asig.tipo === "C1" || asig.tipo === "C2") &&
      (asig.zona === 1 || asig.zona === 5 || asig.zona === 6)
    ) {
      return asig.jugador_id;
    }
  }
  return null;
}

/** Busca al punta delantero (zona 2/3/4). */
function buscarPuntaDelantero(rotacion: RotacionPunto): string | null {
  for (const asig of Object.values(rotacion.posiciones)) {
    if (
      (asig.tipo === "P1" || asig.tipo === "P2") &&
      (asig.zona === 2 || asig.zona === 3 || asig.zona === 4)
    ) {
      return asig.jugador_id;
    }
  }
  return null;
}

/** Busca al punta zaguero (zona 1/5/6). */
function buscarPuntaZaguero(rotacion: RotacionPunto): string | null {
  for (const asig of Object.values(rotacion.posiciones)) {
    if (
      (asig.tipo === "P1" || asig.tipo === "P2") &&
      (asig.zona === 1 || asig.zona === 5 || asig.zona === 6)
    ) {
      return asig.jugador_id;
    }
  }
  return null;
}

/** Busca al líbero activo.
 *  Prioriza el de tipo "recepcion"; si hay 1 solo, ese.
 *  Si no hay líbero, cae al central zaguero.
 */
function buscarLiberoActivo(rotacion: RotacionPunto): string | null {
  const lib =
    rotacion.liberos.find((l) => l.tipo === "recepcion") ??
    (rotacion.liberos.length === 1 ? rotacion.liberos[0] : null);
  if (lib?.jugador_id) return lib.jugador_id;
  return buscarCentralZaguero(rotacion);
}

type RolRecepcion = "PD" | "PZ" | "L";

/** Tabla de roles por zona del armador × zona de recepción.
 *  Portada de resolverJugadorRecepcion en page.tsx.
 */
const TABLA_RECEPCION: Record<
  Zona,
  { z1: RolRecepcion; z6: RolRecepcion; z5: RolRecepcion }
> = {
  1: { z1: "PD", z6: "L", z5: "PZ" },
  2: { z1: "L", z6: "PZ", z5: "PD" },
  3: { z1: "PZ", z6: "L", z5: "PD" },
  4: { z1: "L", z6: "PZ", z5: "PD" },
  5: { z1: "L", z6: "PZ", z5: "PD" },
  6: { z1: "PZ", z6: "L", z5: "PD" },
};

/** Devuelve el jugador_id que recibe según la celda + rotación. */
function jugadorQueRecibe(
  origen: PuntoV2,
  rotacion: RotacionPunto,
  _situacion: Situacion
): string | null {
  const celda = origen.celda;

  // Excepción F1-C3: la recibe el central delantero
  if (celda === "F1-C3") {
    return (
      buscarCentralDelantero(rotacion) ??
      buscarLiberoActivo(rotacion) ??
      null
    );
  }

  const zonaRec = zonaRecepcion(celda);
  if (zonaRec === null) return null;

  // Zona del armador
  let zonaArmador: Zona | null = null;
  for (const asig of Object.values(rotacion.posiciones)) {
    if (asig.tipo === "A") {
      zonaArmador = asig.zona;
      break;
    }
  }
  if (!zonaArmador) return null;

  const fila = TABLA_RECEPCION[zonaArmador];
  let rol: RolRecepcion;
  if (zonaRec === 1) rol = fila.z1;
  else if (zonaRec === 6) rol = fila.z6;
  else rol = fila.z5;

  if (rol === "L") {
    return buscarLiberoActivo(rotacion) ?? null;
  }
  if (rol === "PD") {
    return (
      buscarPuntaDelantero(rotacion) ??
      buscarLiberoActivo(rotacion) ??
      null
    );
  }
  // rol === "PZ"
  return (
    buscarPuntaZaguero(rotacion) ??
    buscarLiberoActivo(rotacion) ??
    null
  );
}

// ============================================================
// CLASIFICACIÓN PRINCIPAL
// ============================================================

export function clasificarLinea(
  estado: EstadoClasificacion,
  linea: LineaInput
): ResultadoClasificacion {
  const n = estado.lineas.length;
  const ultima = n > 0 ? estado.lineas[n - 1] : null;

  // ---------- 0. TOQUE DE RED ----------
  if (esRed(linea.origen.celda) || esRed(linea.destino.celda)) {
    return {
      tipo: "toque-red",
      esRival: false,
      jugadorId: null,
      popup: "toque-red",
    };
  }

  // ---------- 1. PRIMERA LÍNEA = SAQUE ----------
  if (n === 0) {
    const esRival = ladoDeCelda(linea.origen.celda) === "rival";
    return {
      tipo: "saque",
      esRival,
      jugadorId: esRival ? null : jugadorQueSaca(estado.rotacion),
      popup: "saque",
    };
  }

  // ---------- 2. SEGUNDA LÍNEA = RECEPCIÓN ----------
  if (n === 1 && ultima!.tipo === "saque") {
    const esRival = !ultima!.esRival;
    return {
      tipo: "recepcion",
      esRival,
      jugadorId: esRival
        ? null
        : jugadorQueRecibe(linea.origen, estado.rotacion, estado.situacion),
      popup: null,
    };
  }

  // ============================================================
  // A PARTIR DE LA 3RA LÍNEA
  // ============================================================

  const ladoO = ladoDeCelda(linea.origen.celda);
  const ladoD = ladoDeCelda(linea.destino.celda);

  // ---------- CASO: origen en zona de bloqueo → DEFENSA ----------
  // (fallback: en el flujo normal el bloqueo se maneja como desvío
  //  desde DataEntryV2 y nunca llega acá como origen)
  if (esBloqueo(linea.origen.celda)) {
    return {
      tipo: "defensa",
      esRival: ultima!.esRival,
      jugadorId: null,
      popup: "defensa",
    };
  }

  // Última fue ARMADO → ATAQUE
  if (ultima!.tipo === "armado") {
    const esRival = ultima!.esRival;
    const jugadorId = esRival
      ? null
      : jugadorQueAtacaDesdeCelda(
          linea.origen.celda,
          estado.rotacion,
          estado.situacion
        );
    return {
      tipo: "ataque",
      esRival,
      jugadorId,
      popup: null,
    };
  }

  // Última fue DEFENSA → ARMADO
  if (ultima!.tipo === "defensa") {
    return {
      tipo: "armado",
      esRival: ultima!.esRival,
      jugadorId: null,
      popup: "armado",
    };
  }

  // Última fue RECEPCIÓN → ARMADO
  if (ultima!.tipo === "recepcion") {
    return {
      tipo: "armado",
      esRival: ultima!.esRival,
      jugadorId: null,
      popup: "armado",
    };
  }

  // Última fue ATAQUE → BLOQUEO, DEFENSA o LIBRE
  if (ultima!.tipo === "ataque") {
    // Si viene del lado opuesto y cae en mi cancha → DEFENSA mía
    if (
      ultima!.esRival &&
      (ladoD === "propio" || esFuera(linea.destino.celda))
    ) {
      return {
        tipo: "defensa",
        esRival: false,
        jugadorId: null,
        popup: "defensa",
      };
    }

    // Si es mi ataque y cae en cancha rival → defensa rival (no se evalúa)
    if (!ultima!.esRival && ladoD === "rival") {
      return {
        tipo: "defensa",
        esRival: true,
        jugadorId: null,
        popup: null,
      };
    }

    // Si es mi ataque y cae en mi propia cancha → rebote
    return {
      tipo: "libre",
      esRival: ultima!.esRival,
      jugadorId: null,
      popup: "libre",
    };
  }

  // Última fue BLOQUEO → DEFENSA o fin del punto
  if (ultima!.tipo === "bloqueo") {
    if (ladoD === "propio" || esFuera(linea.destino.celda)) {
      return {
        tipo: "defensa",
        esRival: false,
        jugadorId: null,
        popup: "defensa",
      };
    }
    if (ladoD === "rival") {
      return {
        tipo: "libre",
        esRival: true,
        jugadorId: null,
        popup: "libre",
      };
    }
  }

  // Última fue LIBRE → ARMADO del otro lado o ATAQUE
  if (ultima!.tipo === "libre") {
    if (ladoO === "propio" && ladoD === "rival") {
      return {
        tipo: "ataque",
        esRival: false,
        jugadorId: jugadorQueAtacaDesdeCelda(
          linea.origen.celda,
          estado.rotacion,
          estado.situacion
        ),
        popup: null,
      };
    }
    if (ladoO === "rival" && ladoD === "propio") {
      return {
        tipo: "ataque",
        esRival: true,
        jugadorId: null,
        popup: null,
      };
    }
    // Mismo lado → armado
    return {
      tipo: "armado",
      esRival: ultima!.esRival,
      jugadorId: null,
      popup: "armado",
    };
  }

  // ---------- FALLBACK ----------
  return {
    tipo: "libre",
    esRival: ultima!.esRival,
    jugadorId: null,
    popup: "libre",
  };
}

// ============================================================
// RESOLVER GANADOR DEL PUNTO
// ============================================================

export function ganadorDelPunto(
  lineas: LineaClasificada[]
): Lado | null {
  if (lineas.length === 0) return null;
  const ultima = lineas[lineas.length - 1];

  if (ultima.tipo === "toque-red") {
    return ultima.esRival ? "propio" : "rival";
  }

  const ladoDestino = ladoDeCelda(ultima.destino.celda);

  // Si cae en cancha rival → ganó propio
  if (ladoDestino === "rival") return "propio";
  // Si cae en cancha propia → ganó rival
  if (ladoDestino === "propio") return "rival";
  // Fuera: depende de qué lado
  if (ultima.destino.celda.startsWith("FUERA-ARR")) return "propio";
  if (ultima.destino.celda.startsWith("FUERA-ABA")) return "rival";

  return null;
}