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
  | "recepcion"
  | "armado"
  | "defensa"
  | "libre"
  | "jugador"
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
  oculta?: boolean;
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
  return null;
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

function jugadorQueSaca(rotacion: RotacionPunto): string | null {
  for (const asig of Object.values(rotacion.posiciones)) {
    if (asig.zona === 1) return asig.jugador_id;
  }
  return null;
}

// ============================================================
// RESOLUCIÓN DE JUGADOR — RECEPCIÓN
// ============================================================

function zonaRecepcion(celda: string): 1 | 5 | 6 | null {
  if (!/^F[123]-/.test(celda)) return null;
  const col = celda.split("-")[1];
  if (col === "C1" || col === "C2") return 5;
  if (col === "C3") return 6;
  if (col === "C4" || col === "C5") return 1;
  return null;
}

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

function buscarLiberoActivo(rotacion: RotacionPunto): string | null {
  const lib =
    rotacion.liberos.find((l) => l.tipo === "recepcion") ??
    (rotacion.liberos.length === 1 ? rotacion.liberos[0] : null);
  if (lib?.jugador_id) return lib.jugador_id;
  return buscarCentralZaguero(rotacion);
}

type RolRecepcion = "PD" | "PZ" | "L";

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

function jugadorQueRecibe(
  origen: PuntoV2,
  rotacion: RotacionPunto,
  _situacion: Situacion
): string | null {
  const celda = origen.celda;

  if (celda === "F1-C3") {
    return (
      buscarCentralDelantero(rotacion) ??
      buscarLiberoActivo(rotacion) ??
      null
    );
  }

  const zonaRec = zonaRecepcion(celda);
  if (zonaRec === null) return null;

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
  // Ya NO tiene popup: el subtipo se calcula automáticamente al guardar.
  if (n === 0) {
    const esRival = ladoDeCelda(linea.origen.celda) === "rival";
    return {
      tipo: "saque",
      esRival,
      jugadorId: esRival ? null : jugadorQueSaca(estado.rotacion),
      popup: null,
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
      popup: esRival ? null : "recepcion",
    };
  }

  // ============================================================
  // A PARTIR DE LA 3RA LÍNEA
  // ============================================================

  const ladoO = ladoDeCelda(linea.origen.celda);
  const ladoD = ladoDeCelda(linea.destino.celda);

  if (esBloqueo(linea.origen.celda)) {
    const esRival = ultima!.esRival;
    return {
      tipo: "defensa",
      esRival,
      jugadorId: null,
      popup: esRival ? null : "defensa",
    };
  }

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

  if (ultima!.tipo === "defensa") {
    const esRival = ultima!.esRival;
    return {
      tipo: "armado",
      esRival,
      jugadorId: null,
      popup: esRival ? null : "armado",
    };
  }

  if (ultima!.tipo === "recepcion") {
    const esRival = ultima!.esRival;
    return {
      tipo: "armado",
      esRival,
      jugadorId: null,
      popup: esRival ? null : "armado",
    };
  }

  if (ultima!.tipo === "ataque") {
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

    if (!ultima!.esRival && ladoD === "rival") {
      return {
        tipo: "defensa",
        esRival: true,
        jugadorId: null,
        popup: null,
      };
    }

    const esRival = ultima!.esRival;
    return {
      tipo: "libre",
      esRival,
      jugadorId: null,
      popup: esRival ? null : "libre",
    };
  }

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
        popup: null,
      };
    }
  }

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
    const esRival = ultima!.esRival;
    return {
      tipo: "armado",
      esRival,
      jugadorId: null,
      popup: esRival ? null : "armado",
    };
  }

  const esRival = ultima!.esRival;
  return {
    tipo: "libre",
    esRival,
    jugadorId: null,
    popup: esRival ? null : "libre",
  };
}

// ============================================================
// RESOLVER GANADOR DEL PUNTO
// ============================================================
// Regla general para FUERA: el punto va al lado CONTRARIO al que
// ejecutó la última acción visible. Si saqué yo y salió afuera,
// punto del rival. Si el rival atacó y salió afuera, punto mío.

export function ganadorDelPunto(
  lineas: LineaClasificada[]
): Lado | null {
  if (lineas.length === 0) return null;
  const ultima = lineas[lineas.length - 1];

  if (ultima.tipo === "toque-red") {
    return ultima.esRival ? "propio" : "rival";
  }

  if (ultima.destino.celda.startsWith("FUERA-")) {
    return ultima.esRival ? "propio" : "rival";
  }

  const ladoDestino = ladoDeCelda(ultima.destino.celda);

  if (ladoDestino === "rival") return "propio";
  if (ladoDestino === "propio") return "rival";

  return null;
}

// ============================================================
// CÁLCULO DE SUBTIPOS DE ATAQUE
// ============================================================

export function calcularSubtiposAtaque(
  lineas: LineaClasificada[],
  ganador: Lado
): LineaClasificada[] {
  const idxAtaques: number[] = [];
  lineas.forEach((l, i) => {
    if (l.tipo === "ataque" && !l.esRival) idxAtaques.push(i);
  });
  if (idxAtaques.length === 0) return lineas;

  let ultimoVisible = -1;
  for (let i = lineas.length - 1; i >= 0; i--) {
    if (!lineas[i].oculta) {
      ultimoVisible = i;
      break;
    }
  }

  const ultimoAtaque = idxAtaques[idxAtaques.length - 1];
  const cierraElPunto = ultimoAtaque === ultimoVisible;

  return lineas.map((l, i) => {
    if (l.tipo !== "ataque" || l.esRival) return l;
    if (i === ultimoAtaque && cierraElPunto) {
      return { ...l, subtipo: ganador === "propio" ? "punto" : "error" };
    }
    return { ...l, subtipo: "neutro" };
  });
}

// ============================================================
// CÁLCULO DE SUBTIPOS DE SAQUE (automático)
// ============================================================
// Reglas del usuario:
//
// SIN recepción rival (la pelota no fue tocada por el rival):
//   - Cae dentro de cancha rival (F4/F5/F6-C2/C3/C4) → "ace"
//   - Cualquier otro destino → "negativo"
//
// CON recepción rival (el rival la tocó):
//   - FUERA-ARR (fuera largo rival)              → positivo_mas
//   - F4/F5/F6-C1/C5 (fuera ancho rival)         → positivo_mas
//   - F6-C2/C3/C4 (fondo rival)                  → positivo_mas
//   - F1/F2/F3-C2/C3/C4 (cancha propia centro)   → positivo_mas
//   - BLOQ-P-*                                   → positivo_mas
//   - F4-C3                                      → neutro
//   - RED-* / FUERA-ABA / F1/F2/F3-C1/C5 / BLOQ-R → ace
//   - F5-C2/C3/C4 / F4-C2 / F4-C4                → positivo
//
// DESVÍO en bloqueo rival (saque golpea BLOQ-R y sigue):
//   - Si el destino final es FUERA-* → negativo
//   - Si no → aplicar reglas "sin recepción" al destino final

function valorarSaqueSinRecepcion(destino: string): string {
  // Solo ace si cae dentro de cancha rival
  if (
    destino.startsWith("F4-") ||
    destino.startsWith("F5-") ||
    destino.startsWith("F6-")
  ) {
    const col = destino.split("-")[1];
    if (col === "C2" || col === "C3" || col === "C4") return "ace";
  }
  return "negativo";
}

function valorarSaqueConRecepcion(destino: string): string {
  // Fuera de cancha
  if (destino.startsWith("FUERA-ARR-")) return "positivo_mas";
  if (destino.startsWith("FUERA-ABA-")) return "ace";

  // Red / bloqueos
  if (destino.startsWith("RED-")) return "ace";
  if (destino.startsWith("BLOQ-R-")) return "ace";
  if (destino.startsWith("BLOQ-P-")) return "positivo_mas";

  // Cancha propia
  if (
    destino.startsWith("F1-") ||
    destino.startsWith("F2-") ||
    destino.startsWith("F3-")
  ) {
    const col = destino.split("-")[1];
    if (col === "C2" || col === "C3" || col === "C4") return "positivo_mas";
    return "ace";
  }

  // Cancha rival
  if (
    destino.startsWith("F4-") ||
    destino.startsWith("F5-") ||
    destino.startsWith("F6-")
  ) {
    const [fila, col] = destino.split("-");
    if (col === "C1" || col === "C5") return "positivo_mas";
    if (fila === "F6") return "positivo_mas";
    if (fila === "F5") return "positivo";
    if (fila === "F4") {
      if (col === "C3") return "neutro";
      return "positivo"; // C2, C4
    }
  }

  return "positivo"; // fallback
}

export function calcularSubtiposSaque(
  lineas: LineaClasificada[]
): LineaClasificada[] {
  const idxSaque = lineas.findIndex(
    (l) => l.tipo === "saque" && !l.esRival
  );
  if (idxSaque === -1) return lineas;

  const saque = lineas[idxSaque];
  const destinoSaque = saque.destino.celda;

  // ¿Hay desvío por bloqueo rival? (dentro de la misma línea)
  const desvios = saque.desvios ?? [];
  const tieneDesvioBloqueo = desvios.some((d) =>
    d.celda.startsWith("BLOQ-R-")
  );

  let subtipo: string;

  if (destinoSaque.startsWith("BLOQ-R-") && !tieneDesvioBloqueo) {
    // El saque terminó sobre el bloqueo rival. Buscar la línea que sale del bloqueo.
    const siguiente = lineas[idxSaque + 1];
    if (siguiente && siguiente.origen.celda === destinoSaque) {
      const destinoFinal = siguiente.destino.celda;
      if (destinoFinal.startsWith("FUERA-")) {
        subtipo = "negativo";
      } else {
        subtipo = valorarSaqueSinRecepcion(destinoFinal);
      }
    } else {
      // Quedó en el bloqueo → error
      subtipo = "negativo";
    }
  } else if (tieneDesvioBloqueo) {
    // Hubo desvío por bloqueo rival en el medio. Evaluar el destino final.
    if (destinoSaque.startsWith("FUERA-")) {
      subtipo = "negativo";
    } else {
      subtipo = valorarSaqueSinRecepcion(destinoSaque);
    }
  } else {
    // ¿Hay recepción rival?
    const siguiente = lineas[idxSaque + 1];
    if (siguiente && siguiente.tipo === "recepcion" && siguiente.esRival) {
      subtipo = valorarSaqueConRecepcion(siguiente.destino.celda);
    } else {
      subtipo = valorarSaqueSinRecepcion(destinoSaque);
    }
  }

  return lineas.map((l, i) =>
    i === idxSaque ? { ...l, subtipo } : l
  );
}