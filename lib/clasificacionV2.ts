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
  | "bloqueo"
  | null;

export interface PuntoV2 {
  celda: string;
  mini: string;
  jugadorId?: string | null;
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
  subtipoFijo?: string | number;
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

// ------------------------------------------------------------
// FUERA DE CANCHA
// ------------------------------------------------------------
export function esFuera(celda: string): boolean {
  if (celda.startsWith("FUERA-")) return true;
  if (/^F[123456]-C[15]$/.test(celda)) return true;
  return false;
}

// ------------------------------------------------------------
// CANCHA REAL (columnas C2/C3/C4)
// ------------------------------------------------------------
function esCanchaPropiaReal(celda: string): boolean {
  return /^F[123]-C[234]$/.test(celda);
}

function esCanchaRivalReal(celda: string): boolean {
  return /^F[456]-C[234]$/.test(celda);
}

// ------------------------------------------------------------
// ATAQUE CON DESVÍO EN BLOQUEO RIVAL (cobertura)
// ------------------------------------------------------------
function tieneDesvioBloqueoRival(l: LineaClasificada): boolean {
  return (l.desvios ?? []).some((d) => d.celda.startsWith("BLOQ-R-"));
}

// ------------------------------------------------------------
// DESVÍO EN BLOQUEO PROPIO
// ------------------------------------------------------------
function tieneDesvioBloqueoPropio(l: LineaInput | LineaClasificada): boolean {
  return (l.desvios ?? []).some((d) => d.celda.startsWith("BLOQ-P-"));
}

export function esCeldaBloqueoPropioConPopup(celda: string): boolean {
  return /^BLOQ-P-C[234]$/.test(celda);
}

export function esCeldaBloqueoPropioLateral(celda: string): boolean {
  return celda === "BLOQ-P-C1" || celda === "BLOQ-P-C5";
}

function bloqueoSeValoraComoAtaque(ultima: LineaClasificada): boolean {
  if (ultima.tipo === "defensa" && ultima.esRival) return true;
  if (
    ultima.tipo === "armado" &&
    ultima.esRival &&
    ultima.subtipo !== "T"
  )
    return true;
  return false;
}

// ------------------------------------------------------------
// ¿La línea cruzó la red?
// ------------------------------------------------------------
// Una línea "pasó la red" si:
//  - tiene desvío en un bloqueo (BLOQ-P-* o BLOQ-R-*), porque la
//    pelota tocó la red aunque vuelva al mismo lado, o
//  - el origen y el destino están en lados opuestos.
// ------------------------------------------------------------
export function pasoLaRed(l: LineaClasificada): boolean {
  if (
    (l.desvios ?? []).some(
      (d) => d.celda.startsWith("BLOQ-P-") || d.celda.startsWith("BLOQ-R-")
    )
  ) {
    return true;
  }
  const ladoO = ladoDeCelda(l.origen.celda);
  const ladoD = ladoDeCelda(l.destino.celda);
  if (ladoO && ladoD && ladoO !== ladoD) return true;
  return false;
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

  // ---------- BLOQUEO PROPIO (desvío en BLOQ-P-*) ----------
  // Esta línea EN SÍ es un bloqueo propio. Va primero porque la
  // línea actual "es" el bloqueo, no un reinicio.
  if (tieneDesvioBloqueoPropio(linea) && ultima) {
    const comoAtaque = bloqueoSeValoraComoAtaque(ultima);
    const primerJugador =
      (linea.desvios ?? []).find((d) => d.celda.startsWith("BLOQ-P-"))
        ?.jugadorId ?? null;
    return {
      tipo: comoAtaque ? "ataque" : "bloqueo",
      esRival: false,
      jugadorId: primerJugador,
      popup: null,
    };
  }

  // ---------- REINICIO POR CRUCE DE RED ----------
  // Si la última línea cruzó la red (por destino o por desvío en
  // bloqueo), la próxima acción del lado receptor es DEFENSA.
  // Excepción: ataque propio con desvío BLOQ-R-* que cae en cancha
  // propia → defensa con subtipo "cobertura".
  if (ultima && pasoLaRed(ultima)) {
    if (
      ultima.tipo === "ataque" &&
      !ultima.esRival &&
      tieneDesvioBloqueoRival(ultima) &&
      ladoDeCelda(ultima.destino.celda) === "propio"
    ) {
      return {
        tipo: "defensa",
        esRival: false,
        jugadorId: null,
        popup: "jugador",
        subtipoFijo: "cobertura",
      };
    }

    const ladoReceptor = ladoDeCelda(ultima.destino.celda);
    const esRival = ladoReceptor === "rival";
    return {
      tipo: "defensa",
      esRival,
      jugadorId: null,
      popup: esRival ? null : "defensa",
    };
  }

  // ---------- ORIGEN EN BLOQUEO ----------
  if (esBloqueo(linea.origen.celda)) {
    const esRival = ultima!.esRival;
    return {
      tipo: "defensa",
      esRival,
      jugadorId: null,
      popup: esRival ? null : "defensa",
    };
  }

  // ---------- CADENA NORMAL ----------
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
    // Nota: los casos "cruzó a cancha propia/rival" ya fueron
    // manejados arriba por el reinicio por cruce de red.
    const esRival = ultima!.esRival;
    return {
      tipo: "libre",
      esRival,
      jugadorId: null,
      popup: esRival ? null : "libre",
    };
  }

  if (ultima!.tipo === "bloqueo") {
    const esRival = ultima!.esRival;
    return {
      tipo: "libre",
      esRival,
      jugadorId: null,
      popup: esRival ? null : "libre",
    };
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
// GANADOR DEL PUNTO
// ============================================================

export function ganadorDelPunto(
  lineas: LineaClasificada[]
): Lado | null {
  if (lineas.length === 0) return null;
  const ultima = lineas[lineas.length - 1];

  if (ultima.tipo === "toque-red") {
    return ultima.esRival ? "propio" : "rival";
  }

  if (esFuera(ultima.destino.celda)) {
    if (
      ultima.tipo === "ataque" &&
      !ultima.esRival &&
      tieneDesvioBloqueoRival(ultima)
    ) {
      return "propio";
    }
    return ultima.esRival ? "propio" : "rival";
  }

  const ladoDestino = ladoDeCelda(ultima.destino.celda);

  if (ladoDestino === "rival") return "propio";
  if (ladoDestino === "propio") return "rival";

  return null;
}

// ============================================================
// SUBTIPOS DE ATAQUE
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
    if (l.subtipo && l.subtipo !== null) return l;
    if (i === ultimoAtaque && cierraElPunto) {
      return { ...l, subtipo: ganador === "propio" ? "punto" : "error" };
    }
    return { ...l, subtipo: "neutro" };
  });
}

// ============================================================
// SUBTIPOS DE BLOQUEO PROPIO (automático)
// ============================================================

function valorarBloqueoBase(
  destino: string,
  esUltimaVisible: boolean,
  siguiente: LineaClasificada | undefined
): string {
  if (esFuera(destino)) return "use_rival";
  if (destino.startsWith("RED-")) return "filtrada";
  if (esCeldaBloqueoPropioLateral(destino)) return "filtrada";
  if (esCanchaPropiaReal(destino)) return "positivo";

  const esRival =
    esCanchaRivalReal(destino) ||
    destino.startsWith("BLOQ-R-") ||
    esCeldaBloqueoPropioConPopup(destino);

  if (esRival) {
    if (esUltimaVisible) return "punto";
    if (siguiente?.tipo === "libre" && siguiente.esRival)
      return "positivo_mas";
    return "positivo";
  }

  return "positivo";
}

export function calcularSubtiposBloqueo(
  lineas: LineaClasificada[]
): LineaClasificada[] {
  const idxBloqueos: number[] = [];
  lineas.forEach((l, i) => {
    if (l.tipo === "bloqueo" && !l.esRival) idxBloqueos.push(i);
  });
  if (idxBloqueos.length === 0) return lineas;

  let ultimoVisible = -1;
  for (let i = lineas.length - 1; i >= 0; i--) {
    if (!lineas[i].oculta) {
      ultimoVisible = i;
      break;
    }
  }

  return lineas.map((l, i) => {
    if (l.tipo !== "bloqueo" || l.esRival) return l;
    const esUltima = i === ultimoVisible;
    const siguiente = lineas[i + 1];
    const base = valorarBloqueoBase(l.destino.celda, esUltima, siguiente);
    return { ...l, subtipo: base };
  });
}

// ============================================================
// SUBTIPOS DE SAQUE (automático)
// ============================================================

function valorarSaqueSinRecepcion(destino: string): string {
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
  if (destino.startsWith("FUERA-ARR-")) return "positivo_mas";
  if (destino.startsWith("FUERA-ABA-")) return "ace";

  if (destino.startsWith("RED-")) return "ace";
  if (destino.startsWith("BLOQ-R-")) return "ace";
  if (destino.startsWith("BLOQ-P-")) return "positivo_mas";

  if (
    destino.startsWith("F1-") ||
    destino.startsWith("F2-") ||
    destino.startsWith("F3-")
  ) {
    const col = destino.split("-")[1];
    if (col === "C2" || col === "C3" || col === "C4") return "positivo_mas";
    return "ace";
  }

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
      return "positivo";
    }
  }

  return "positivo";
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

  const desvios = saque.desvios ?? [];
  const tieneDesvioBloqueo = desvios.some((d) =>
    d.celda.startsWith("BLOQ-R-")
  );

  let subtipo: string;

  if (destinoSaque.startsWith("BLOQ-R-") && !tieneDesvioBloqueo) {
    const siguiente = lineas[idxSaque + 1];
    if (siguiente && siguiente.origen.celda === destinoSaque) {
      const destinoFinal = siguiente.destino.celda;
      if (destinoFinal.startsWith("FUERA-")) {
        subtipo = "negativo";
      } else {
        subtipo = valorarSaqueSinRecepcion(destinoFinal);
      }
    } else {
      subtipo = "negativo";
    }
  } else if (tieneDesvioBloqueo) {
    if (destinoSaque.startsWith("FUERA-")) {
      subtipo = "negativo";
    } else {
      subtipo = valorarSaqueSinRecepcion(destinoSaque);
    }
  } else {
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