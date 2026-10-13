// ============================================================
// CLASIFICACIÓN V2 — motor de tipos de acción
// ============================================================

import {
  numeroRotacionDesdePosiciones,
  type RotacionPunto,
  type Zona,
} from "./rotaciones";
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
  | "roce-red";

export type Lado = "propio" | "rival";
export type Situacion = "saque" | "recepcion";
export type PopupRequerido =
  | "saque"
  | "recepcion"
  | "armado"
  | "defensa"
  | "libre"
  | "jugador"
  | "roce-red"
  | "bloqueo"
  | "ataque-toque-libre"
  | null;

export type VarianteAtaque = "remate" | "toque";

export interface PuntoV2 {
  celda: string;
  mini: string;
  jugadorId?: string | null;
}

export interface LineaInput {
  origen: PuntoV2;
  destino: PuntoV2;
  desvios?: PuntoV2[];
  posicionInicial?: PuntoV2 | null;
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
  variante?: VarianteAtaque | null;
  posicionInicial?: PuntoV2 | null;
  oculta?: boolean;
}

export interface EstadoClasificacion {
  saqueInicial: Lado;
  situacion: Situacion;
  rotacion: RotacionPunto;
  lineas: LineaClasificada[];
  recepcionOverrides?: Partial<Record<Zona, string | null>>;
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

export function esFuera(celda: string): boolean {
  if (celda.startsWith("FUERA-")) return true;
  if (/^F[123456]-C[15]$/.test(celda)) return true;
  return false;
}

function esCanchaPropiaReal(celda: string): boolean {
  return /^F[123]-C[234]$/.test(celda);
}

function esCanchaRivalReal(celda: string): boolean {
  return /^F[456]-C[234]$/.test(celda);
}

function tieneDesvioBloqueoRival(l: LineaClasificada): boolean {
  return (l.desvios ?? []).some((d) => d.celda.startsWith("BLOQ-R-"));
}

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
// POSICIONES DE JUEGO
// ============================================================

export type RolJuego = "A" | "O" | "C1" | "C2" | "P1" | "P2" | "L";

export const POSICIONES_JUEGO: Record<
  number,
  Record<Situacion, Record<Zona, RolJuego>>
> = {
  1: {
    saque: { 1: "A", 2: "O", 3: "C1", 4: "P1", 5: "L", 6: "P2" },
    recepcion: { 1: "A", 2: "P1", 3: "C1", 4: "O", 5: "L", 6: "P2" },
  },
  2: {
    saque: { 1: "P1", 2: "C1", 3: "O", 4: "P2", 5: "C2", 6: "A" },
    recepcion: { 1: "A", 2: "O", 3: "C1", 4: "P2", 5: "L", 6: "P1" },
  },
  3: {
    saque: { 1: "C1", 2: "O", 3: "P2", 4: "C2", 5: "A", 6: "P1" },
    recepcion: { 1: "A", 2: "O", 3: "C2", 4: "P2", 5: "L", 6: "P1" },
  },
  4: {
    saque: { 1: "O", 2: "P2", 3: "C2", 4: "A", 5: "P1", 6: "C1" },
    recepcion: { 1: "O", 2: "A", 3: "C2", 4: "P2", 5: "L", 6: "P1" },
  },
  5: {
    saque: { 1: "P2", 2: "C2", 3: "A", 4: "P1", 5: "C1", 6: "O" },
    recepcion: { 1: "O", 2: "A", 3: "C2", 4: "P1", 5: "L", 6: "P2" },
  },
  6: {
    saque: { 1: "C2", 2: "A", 3: "P1", 4: "C1", 5: "O", 6: "P2" },
    recepcion: { 1: "O", 2: "A", 3: "C1", 4: "P1", 5: "L", 6: "P2" },
  },
};

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
// RESOLUCIÓN DE JUGADOR — POR ROL LÓGICO
// ============================================================

function jugadorDeTipo(
  rotacion: RotacionPunto,
  tipo: "A" | "O" | "C1" | "C2" | "P1" | "P2"
): string | null {
  for (const asig of Object.values(rotacion.posiciones)) {
    if (asig.tipo === tipo) return asig.jugador_id;
  }
  return null;
}

function jugadorQueArma(rotacion: RotacionPunto): string | null {
  return jugadorDeTipo(rotacion, "A");
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

function buscarLiberoActivo(rotacion: RotacionPunto): string | null {
  const lib =
    rotacion.liberos.find((l) => l.tipo === "recepcion") ??
    (rotacion.liberos.length === 1 ? rotacion.liberos[0] : null);
  if (lib?.jugador_id) return lib.jugador_id;
  return buscarCentralZaguero(rotacion);
}

export function resolverRolAJugador(
  rotacion: RotacionPunto,
  rol: RolJuego
): string | null {
  if (rol === "L") return buscarLiberoActivo(rotacion);
  return jugadorDeTipo(rotacion, rol);
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

function jugadorQueRecibe(
  origen: PuntoV2,
  rotacion: RotacionPunto,
  situacion: Situacion,
  overrides?: Partial<Record<Zona, string | null>>
): string | null {
  const celda = origen.celda;

  const zonaRec = zonaRecepcion(celda);
  if (zonaRec === null) return null;

  if (overrides && zonaRec in overrides) {
    return overrides[zonaRec] ?? null;
  }

  const numeroRot = numeroRotacionDesdePosiciones(rotacion);
  const fila = POSICIONES_JUEGO[numeroRot]?.[situacion];
  if (!fila) return null;
  const rol = fila[zonaRec];
  return resolverRolAJugador(rotacion, rol);
}

// ============================================================
// RESOLUCIÓN DE JUGADOR — DEFENSA (por defecto, sin estrella)
// ============================================================

export function resolverJugadorDefensa(
  origen: PuntoV2,
  rotacion: RotacionPunto,
  situacion: Situacion
): string | null {
  const celda = origen.celda;
  if (!/^F[123]-/.test(celda)) return null;

  const col = celda.split("-")[1];
  let zona: Zona;
  if (col === "C1" || col === "C2") zona = 5;
  else if (col === "C3") zona = 6;
  else zona = 1;

  const numeroRot = numeroRotacionDesdePosiciones(rotacion);
  const fila = POSICIONES_JUEGO[numeroRot]?.[situacion];
  if (!fila) return null;
  const rol = fila[zona];
  return resolverRolAJugador(rotacion, rol);
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

  if (esRed(linea.origen.celda) || esRed(linea.destino.celda)) {
    return {
      tipo: "roce-red",
      esRival: false,
      jugadorId: null,
      popup: "roce-red",
    };
  }

  if (n === 0) {
    const esRival = ladoDeCelda(linea.origen.celda) === "rival";
    return {
      tipo: "saque",
      esRival,
      jugadorId: esRival ? null : jugadorQueSaca(estado.rotacion),
      popup: null,
    };
  }

  if (n === 1 && ultima!.tipo === "saque") {
    const esRival = !ultima!.esRival;
    return {
      tipo: "recepcion",
      esRival,
      jugadorId: esRival
        ? null
        : jugadorQueRecibe(
            linea.origen,
            estado.rotacion,
            estado.situacion,
            estado.recepcionOverrides
          ),
      popup: esRival ? null : "recepcion",
    };
  }

  if (ultima && ultima.tipo === "libre" && ultima.esRival) {
    return {
      tipo: "libre",
      esRival: false,
      jugadorId: null,
      popup: null,
    };
  }

  const ladoO = ladoDeCelda(linea.origen.celda);
  const ladoD = ladoDeCelda(linea.destino.celda);
  const cruzaNet = ladoO !== null && ladoD !== null && ladoO !== ladoD;

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
      popup: esRival ? null : "ataque-toque-libre",
    };
  }

  const armarOlibre = (esRival: boolean): ResultadoClasificacion =>
    cruzaNet
      ? {
          tipo: "libre",
          esRival,
          jugadorId: null,
          popup: esRival ? null : "libre",
        }
      : {
          tipo: "armado",
          esRival,
          jugadorId: esRival ? null : jugadorQueArma(estado.rotacion),
          popup: esRival ? null : "armado",
        };

  if (ultima!.tipo === "defensa") {
    return armarOlibre(ultima!.esRival);
  }

  if (ultima!.tipo === "recepcion") {
    return armarOlibre(ultima!.esRival);
  }

  if (ultima!.tipo === "ataque") {
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
        popup: "ataque-toque-libre",
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
    return armarOlibre(ultima!.esRival);
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

  if (ultima.tipo === "roce-red") {
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
// SUBTIPOS DE DEFENSA (para "defensa normal" sin tipo asignado)
// ============================================================

export function calcularSubtiposDefensa(
  lineas: LineaClasificada[]
): LineaClasificada[] {
  const idxDefensas: number[] = [];
  lineas.forEach((l, i) => {
    if (l.tipo === "defensa" && !l.esRival) idxDefensas.push(i);
  });
  if (idxDefensas.length === 0) return lineas;

  let ultimoVisible = -1;
  for (let i = lineas.length - 1; i >= 0; i--) {
    if (!lineas[i].oculta) {
      ultimoVisible = i;
      break;
    }
  }

  return lineas.map((l, i) => {
    if (l.tipo !== "defensa" || l.esRival) return l;
    if (l.subtipo && l.subtipo !== "defensa_normal") return l;
    const esUltima = i === ultimoVisible;
    return {
      ...l,
      subtipo: esUltima ? "buena_rival" : "neutro",
      variante: "defensa_normal" as any,
    };
  });
}

// ============================================================
// SUBTIPOS DE ATAQUE RIVAL (según defensa propia siguiente)
// ============================================================
//
// Para cada ataque rival seguido de una defensa propia:
//   - defensa con subtipo "toque"        → ataque rival = "toque"
//   - defensa con subtipo "gran-defensa" → ataque rival = "peligroso"
//   - defensa con subtipo "libre"        → ataque rival = "libre"
//   - defensa sin elegir (defensa_normal / null):
//       · si es la última visible → ataque rival = "buena_rival"
//       · si la jugada sigue       → ataque rival = "simple"
//
// IMPORTANTE: esta función corre ANTES de calcularSubtiposDefensa.
// La marca de "es error rival" (fuera/red/cancha propia) la sobreescribe
// después calcularErroresRival.
// ============================================================

export function calcularSubtiposAtaqueRival(
  lineas: LineaClasificada[]
): LineaClasificada[] {
  if (lineas.length === 0) return lineas;

  let ultimoVisible = -1;
  for (let i = lineas.length - 1; i >= 0; i--) {
    if (!lineas[i].oculta) {
      ultimoVisible = i;
      break;
    }
  }

  const resultado = [...lineas];

  for (let i = 0; i < resultado.length; i++) {
    const l = resultado[i];
    if (l.tipo !== "ataque" || !l.esRival) continue;

    let j = i + 1;
    while (j < resultado.length && resultado[j].oculta) j++;

    if (j >= resultado.length) {
      // Última acción visible: es el ataque rival → buena_rival
      // (calcularErroresRival después lo pisa a error_rival si corresponde)
      if (i === ultimoVisible) {
        resultado[i] = { ...l, subtipo: "buena_rival" };
      }
      continue;
    }

    const siguiente = resultado[j];
    if (siguiente.tipo !== "defensa" || siguiente.esRival) {
      if (i === ultimoVisible) {
        resultado[i] = { ...l, subtipo: "buena_rival" };
      }
      continue;
    }

    const subtipoDef = siguiente.subtipo;
    let nuevoSub: string;

    if (subtipoDef === "toque") {
      nuevoSub = "toque";
    } else if (subtipoDef === "gran-defensa") {
      nuevoSub = "peligroso";
    } else if (subtipoDef === "libre") {
      nuevoSub = "libre";
    } else {
      nuevoSub = j === ultimoVisible ? "buena_rival" : "simple";
    }

    resultado[i] = { ...l, subtipo: nuevoSub };
  }

  return resultado;
}

// ============================================================
// ERRORES RIVALES (unificados)
// ============================================================
//
// Corre al FINAL del pipeline. Recorre todas las líneas rivales y,
// si la acción es un error, le pone subtipo "error_rival".
//
// Reglas:
//   - Roce-red rival → siempre error_rival.
//   - Saque rival con destino en FUERA-*, RED-*, o cancha propia
//     del rival (F4/5/6) → error_rival.
//   - Ataque rival con destino en FUERA-*, RED-*, o cancha propia
//     del rival (F4/5/6) → error_rival.
//
// Sobreescribe cualquier subtipo previo (buena_rival, simple, etc.).
// ============================================================

export function calcularErroresRival(
  lineas: LineaClasificada[]
): LineaClasificada[] {
  return lineas.map((l) => {
    if (!l.esRival) return l;

    // Roce-red rival → siempre error.
    if (l.tipo === "roce-red") {
      return { ...l, subtipo: "error_rival" };
    }

    // Saque rival o ataque rival: error si cae afuera, en la red,
    // o en su propia cancha (F4/5/6 reales, sin las C1/C5 que ya
    // cubre esFuera).
    if (l.tipo === "saque" || l.tipo === "ataque") {
      const d = l.destino.celda;
      const esError =
        esFuera(d) ||
        d.startsWith("RED-") ||
        esCanchaRival(d);
      if (esError) {
        return { ...l, subtipo: "error_rival" };
      }
    }

    return l;
  });
}

// ============================================================
// SUBTIPOS DE BLOQUEO PROPIO
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
// SUBTIPOS DE SAQUE
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