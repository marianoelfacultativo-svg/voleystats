// ============================================================
// CLASIFICACIÓN V2 — motor de tipos de acción
// ============================================================

import {
  numeroRotacionDesdePosiciones,
  type Libero,
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
  | "tipo-saque"
  | "recepcion"
  | "armado"
  | "defensa"
  | "libre"
  | "jugador"
  | "roce-red"
  | "bloqueo"
  | "ataque-toque-libre"
  | "remate-segunda"
  | null;

export type VarianteAtaque = "remate" | "toque";
export type TipoSaque = "potencia" | "flotado";

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
  x2?: boolean;
  velocidad?: number | null;
  tipoSaque?: TipoSaque | null;
  equipoId?: string | null;
}

export interface EstadoClasificacion {
  saqueInicial: Lado;
  situacion: Situacion;
  rotacion: RotacionPunto;
  lineas: LineaClasificada[];
  recepcionOverrides?: Partial<Record<Zona, string | null>>;
  modoEspejo?: boolean;
  equipoPropioId?: string | null;
  equipoRivalId?: string | null;
  rotacionRival?: RotacionPunto | null;
  situacionRival?: Situacion | null;
  recepcionOverridesRival?: Partial<Record<Zona, string | null>>;
}

export interface ResultadoClasificacion {
  tipo: TipoAccion;
  esRival: boolean;
  jugadorId: string | null;
  popup: PopupRequerido;
  cierraPunto?: Lado;
  desvios?: PuntoV2[];
  subtipoFijo?: string | number;
  tipoSaqueFijo?: TipoSaque;
  equipoId?: string | null;
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

function bloqueoSeValoraComoAtaque(
  ultima: LineaClasificada,
  destinoActual: string
): boolean {
  if (esCanchaPropiaReal(destinoActual)) return false;

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

function ultimaVisible(
  lineas: LineaClasificada[]
): LineaClasificada | null {
  for (let i = lineas.length - 1; i >= 0; i--) {
    if (!lineas[i].oculta) return lineas[i];
  }
  return null;
}

function anteriorVisible(
  lineas: LineaClasificada[],
  desdeIdx: number
): LineaClasificada | null {
  for (let i = desdeIdx - 1; i >= 0; i--) {
    if (!lineas[i].oculta) return lineas[i];
  }
  return null;
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

function buscarLiberoActivo(rotacion: RotacionPunto): string | null {
  const liberos: Libero[] = rotacion.liberos ?? [];
  if (liberos.length === 0) return null;

  if (liberos.length === 1) {
    return liberos[0].jugador_id || null;
  }

  const esRecepcion = rotacion.saque_equipo === "rival";
  const tipoBuscado: Libero["tipo"] = esRecepcion ? "recepcion" : "defensa";
  const lib = liberos.find((l) => l.tipo === tipoBuscado);
  return (lib ?? liberos[0]).jugador_id || null;
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
// RESOLUCIÓN DE JUGADOR — DEFENSA
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
// RESOLUCIÓN DE JUGADOR — ARMADO ALTERNATIVO
// ============================================================

export function resolverJugadorArmadoAlternativo(
  origen: PuntoV2,
  rotacion: RotacionPunto
): string | null {
  const celda = origen.celda;
  if (!/^F[123]-/.test(celda)) return null;

  const fila = celda.split("-")[0];

  if (fila === "F1") {
    return buscarCentralDelantero(rotacion);
  }
  return buscarLiberoActivo(rotacion);
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
      popup: esRival ? null : "tipo-saque",
      tipoSaqueFijo: esRival ? undefined : "flotado",
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
    const comoAtaque = bloqueoSeValoraComoAtaque(ultima, linea.destino.celda);
    const primerJugador =
      (linea.desvios ?? []).find((d) => d.celda.startsWith("BLOQ-P-"))
        ?.jugadorId ?? null;
    const esRemateSegunda =
      ultima.tipo === "defensa" && ultima.esRival === true;
    return {
      tipo: comoAtaque ? "ataque" : "bloqueo",
      esRival: false,
      jugadorId: primerJugador,
      popup: esRemateSegunda ? "remate-segunda" : null,
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
          popup: esRival ? "remate-segunda" : "libre",
        }
      : {
          tipo: "armado",
          esRival,
          jugadorId: esRival ? null : jugadorQueArma(estado.rotacion),
          popup: esRival ? null : "armado",
        };

  if (ultima!.tipo === "defensa") {
    if (!ultima!.esRival && ultima!.x2 === true) {
      return {
        tipo: "defensa",
        esRival: false,
        jugadorId: resolverJugadorDefensa(
          linea.origen,
          estado.rotacion,
          estado.situacion
        ),
        popup: null,
      };
    }

    const idxUltima = estado.lineas.length - 1;
    const anterior = anteriorVisible(estado.lineas, idxUltima);
    if (
      !ultima!.esRival &&
      anterior?.tipo === "defensa" &&
      anterior.x2 === true &&
      !ultima!.x2
    ) {
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

    if (!ultima!.esRival && !cruzaNet) {
      const ultimaVis = ultimaVisible(estado.lineas);
      const armador = jugadorQueArma(estado.rotacion);
      if (
        ultimaVis &&
        ultimaVis.tipo === "defensa" &&
        !ultimaVis.esRival &&
        armador &&
        ultimaVis.jugadorId === armador
      ) {
        const alternativo = resolverJugadorArmadoAlternativo(
          linea.origen,
          estado.rotacion
        );
        return {
          tipo: "armado",
          esRival: false,
          jugadorId: alternativo,
          popup: "armado",
        };
      }
    }
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

  // ------------------------------------------------------------
  // BLOQUEO: distinguir dónde cayó la pelota.
  // ------------------------------------------------------------
  if (ultima!.tipo === "bloqueo") {
    const esRivalBloqueador = ultima!.esRival;
    const ladoDestinoBloqueo = ladoDeCelda(ultima!.destino.celda);
    const caeEnCanchaDelBloqueador =
      (esRivalBloqueador && ladoDestinoBloqueo === "rival") ||
      (!esRivalBloqueador && ladoDestinoBloqueo === "propio");

    if (caeEnCanchaDelBloqueador) {
      return {
        tipo: "defensa",
        esRival: esRivalBloqueador,
        jugadorId: null,
        popup: esRivalBloqueador ? null : "defensa",
      };
    }

    // Cayó del lado del atacante → cobertura del atacante.
    const esRivalDefensor = !esRivalBloqueador;
    return {
      tipo: "defensa",
      esRival: esRivalDefensor,
      jugadorId: null,
      popup: esRivalDefensor ? null : "jugador",
      subtipoFijo: "cobertura",
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

function hayCoberturaPropiaDespues(
  lineas: LineaClasificada[],
  idxAtaque: number
): boolean {
  for (let j = idxAtaque + 1; j < lineas.length; j++) {
    const l = lineas[j];
    if (
      l.tipo === "defensa" &&
      !l.esRival &&
      (l.subtipo === "cobertura_positiva" ||
        l.subtipo === "cobertura" ||
        l.subtipo === "cobertura_negativa")
    ) {
      return true;
    }
  }
  return false;
}

function proximaVisible(
  lineas: LineaClasificada[],
  desdeIdx: number
): { idx: number; linea: LineaClasificada } | null {
  for (let j = desdeIdx + 1; j < lineas.length; j++) {
    if (!lineas[j].oculta) return { idx: j, linea: lineas[j] };
  }
  return null;
}

function calcularSubtipoDeAtaque(
  lineas: LineaClasificada[],
  idxAtaque: number,
  ultimoVisibleIdx: number
): string {
  const ataque = lineas[idxAtaque];
  const destino = ataque.destino.celda;
  const desvios = ataque.desvios ?? [];
  const tocoBloqueoRival = desvios.some((d) =>
    d.celda.startsWith("BLOQ-R-")
  );

  const ultimaVisibleLinea =
    ultimoVisibleIdx >= 0 ? lineas[ultimoVisibleIdx] : null;

  // #1 — Última visible = defensa rival → punto desviado
  if (
    ultimaVisibleLinea &&
    ultimaVisibleLinea.tipo === "defensa" &&
    ultimaVisibleLinea.esRival
  ) {
    return "punto_desviado_ataque";
  }

  // #2..#6 — Tocó bloqueo rival
  if (tocoBloqueoRival) {
    if (destino.startsWith("FUERA-")) {
      return "use_rival_ataque";
    }
    if (destino.startsWith("RED-")) {
      return "error_red_ataque";
    }
    if (/^F[123]-/.test(destino)) {
      return hayCoberturaPropiaDespues(lineas, idxAtaque)
        ? "neutro_bloqueo_cobertura_ataque"
        : "gorro_ataque";
    }
    if (/^F[456]-/.test(destino)) {
      return "punto_desviado_ataque";
    }
    return "neutro_desvio_bloqueo_defensa_ataque";
  }

  // #7 — Sin bloqueo, pero hay defensa rival después y NO es la última
  const sig = proximaVisible(lineas, idxAtaque);
  if (
    sig &&
    sig.linea.tipo === "defensa" &&
    sig.linea.esRival &&
    sig.idx !== ultimoVisibleIdx
  ) {
    return "neutro_defensa_ataque";
  }

  // #8..#10 — Ataque es la última visible
  const esUltimaVisible = idxAtaque === ultimoVisibleIdx;
  if (esUltimaVisible) {
    if (destino.startsWith("RED-")) return "error_red_ataque";
    if (destino.startsWith("FUERA-")) return "error_afuera_ataque";
    if (/^F[456]-/.test(destino)) return "punto_directo_ataque";
    return "neutro_defensa_ataque";
  }

  // #11 — Fallback
  return "neutro_defensa_ataque";
}

export function calcularSubtiposAtaque(
  lineas: LineaClasificada[],
  _ganador: Lado
): LineaClasificada[] {
  const idxAtaques: number[] = [];
  lineas.forEach((l, i) => {
    if (l.tipo === "ataque" && !l.esRival) idxAtaques.push(i);
  });
  if (idxAtaques.length === 0) return lineas;

  let ultimoVisibleIdx = -1;
  for (let i = lineas.length - 1; i >= 0; i--) {
    if (!lineas[i].oculta) {
      ultimoVisibleIdx = i;
      break;
    }
  }

  return lineas.map((l, i) => {
    if (l.tipo !== "ataque" || l.esRival) return l;
    if (l.subtipo && l.subtipo !== null) return l;
    return {
      ...l,
      subtipo: calcularSubtipoDeAtaque(lineas, i, ultimoVisibleIdx),
    };
  });
}

// ============================================================
// SUBTIPOS DE DEFENSA (propias y rivales)
// ============================================================

export function calcularSubtiposDefensa(
  lineas: LineaClasificada[]
): LineaClasificada[] {
  const tieneDefensas = lineas.some((l) => l.tipo === "defensa");
  if (!tieneDefensas) return lineas;

  let ultimoVisibleIdx = -1;
  for (let i = lineas.length - 1; i >= 0; i--) {
    if (!lineas[i].oculta) {
      ultimoVisibleIdx = i;
      break;
    }
  }

  return lineas.map((l, i) => {
    if (l.tipo !== "defensa") return l;

    const esUltima = i === ultimoVisibleIdx;
    const subActual = l.subtipo;
    let nuevoSubtipo = subActual;

    if (esUltima) {
      if (!subActual || subActual === "defensa_normal") {
        nuevoSubtipo = "neutro";
      } else if (subActual === "toque") {
        nuevoSubtipo = "toque_negativa";
      } else if (subActual === "gran-defensa") {
        nuevoSubtipo = "error_def";
      } else if (subActual === "libre") {
        nuevoSubtipo = "error_def";
      } else if (subActual === "cobertura") {
        nuevoSubtipo = "cobertura_negativa";
      }
    } else {
      if (!subActual || subActual === "defensa_normal") {
        nuevoSubtipo = "neutro";
      } else if (subActual === "toque") {
        nuevoSubtipo = "toque_positiva";
      } else if (subActual === "gran-defensa") {
        nuevoSubtipo = "gran_def";
      } else if (subActual === "libre") {
        if (l.destino.celda === "F1-C3") {
          nuevoSubtipo = "toque_positiva";
        } else {
          nuevoSubtipo = "mala_libre";
        }
      } else if (subActual === "cobertura") {
        nuevoSubtipo = "cobertura_positiva";
      }
    }

    return {
      ...l,
      subtipo: nuevoSubtipo,
      variante: "defensa_normal" as any,
    };
  });
}

// ============================================================
// SUBTIPOS DE ATAQUE RIVAL
// ============================================================
//
// Reglas (v19.1):
//   - Ataque rival que toca bloqueo propio y va afuera → buena_rival
//     (si es la última acción visible) o simple (si no lo es).
//   - Ataque rival que pica en cancha propia sin defensa después
//     → buena_rival (si es la última) o simple (si no lo es).
//   - Resto de ataques rivales que NO son la última acción visible
//     → simple.
//   - Resto de ataques rivales que SÍ son la última → buena_rival.

export function calcularSubtiposAtaqueRival(
  lineas: LineaClasificada[]
): LineaClasificada[] {
  if (lineas.length === 0) return lineas;

  let ultimoVisibleIdx = -1;
  for (let i = lineas.length - 1; i >= 0; i--) {
    if (!lineas[i].oculta) {
      ultimoVisibleIdx = i;
      break;
    }
  }

  const resultado = [...lineas];

  for (let i = 0; i < resultado.length; i++) {
    const l = resultado[i];
    if (l.tipo !== "ataque" || !l.esRival) continue;
    if (l.subtipo === "toque") continue;

    const esUltima = i === ultimoVisibleIdx;

    let j = i + 1;
    while (j < resultado.length && resultado[j].oculta) j++;

    // No hay siguiente visible
    if (j >= resultado.length) {
      resultado[i] = {
        ...l,
        subtipo: esUltima ? "buena_rival" : "simple",
      };
      continue;
    }

    const siguiente = resultado[j];

    // El siguiente no es defensa propia
    if (siguiente.tipo !== "defensa" || siguiente.esRival) {
      resultado[i] = {
        ...l,
        subtipo: esUltima ? "buena_rival" : "simple",
      };
      continue;
    }

    // Hay defensa propia después: se valora según lo que hizo la defensa
    const subtipoDef = siguiente.subtipo;
    let nuevoSub: string;

    if (
      subtipoDef === "toque" ||
      subtipoDef === "toque_positiva" ||
      subtipoDef === "toque_negativa"
    ) {
      nuevoSub = "toque";
    } else if (
      subtipoDef === "gran-defensa" ||
      subtipoDef === "gran_def"
    ) {
      nuevoSub = "peligroso";
    } else if (
      subtipoDef === "libre" ||
      subtipoDef === "mala_libre"
    ) {
      nuevoSub = "libre";
    } else {
      nuevoSub = j === ultimoVisibleIdx ? "buena_rival" : "simple";
    }

    resultado[i] = { ...l, subtipo: nuevoSub };
  }

  return resultado;
}

// ============================================================
// ERRORES RIVALES
// ============================================================

export function calcularErroresRival(
  lineas: LineaClasificada[]
): LineaClasificada[] {
  return lineas.map((l) => {
    if (!l.esRival) return l;

    if (l.tipo === "roce-red") {
      return { ...l, subtipo: "error_rival" };
    }

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
//
// Reglas (v19.1):
//   - use_rival  → desvío del bloqueo propio que se va afuera.
//   - filtrada   → toca la red o cae en bloqueo lateral.
//   - positivo_mas → pelota sigue viva después del bloqueo y la
//     próxima acción es un "libre" (rival o propio).
//   - neutro     → punto directo de bloqueo, o cae en cancha propia
//     sin que haya un libre después (termina ahí).
//   - positivo   → pelota sigue en juego más de una acción sin libre
//     inmediato (ataque rival bloqueado que queda en cancha rival).
//
// IMPORTANTE: "libre" acá es el subtipo RAW del popup. También
// aceptamos sus variantes finales ("mala_libre", "toque_positiva")
// para que el pipeline sea idempotente al re-guardar un punto.

function siguienteEsLibre(siguiente: LineaClasificada | undefined): boolean {
  if (!siguiente) return false;
  if (siguiente.tipo === "libre") return true;
  if (siguiente.tipo === "defensa") {
    const s = siguiente.subtipo;
    return s === "libre" || s === "mala_libre" || s === "toque_positiva";
  }
  return false;
}

function valorarBloqueoBase(
  destino: string,
  esUltimaVisible: boolean,
  siguiente: LineaClasificada | undefined
): string {
  if (esFuera(destino)) return "use_rival";
  if (destino.startsWith("RED-")) return "filtrada";
  if (esCeldaBloqueoPropioLateral(destino)) return "filtrada";

  // Cae en cancha propia real
  if (esCanchaPropiaReal(destino)) {
    if (siguienteEsLibre(siguiente)) return "positivo_mas";
    return "neutro";
  }

  const esRival =
    esCanchaRivalReal(destino) ||
    destino.startsWith("BLOQ-R-") ||
    esCeldaBloqueoPropioConPopup(destino);

  if (esRival) {
    // Punto directo de bloqueo → neutro (no positivo)
    if (esUltimaVisible) return "neutro";
    // Sigue en juego: si la próxima es libre → positivo_mas
    if (siguienteEsLibre(siguiente)) return "positivo_mas";
    return "positivo";
  }

  // Fallback (no debería pasar seguido)
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

  let ultimoVisibleIdx = -1;
  for (let i = lineas.length - 1; i >= 0; i--) {
    if (!lineas[i].oculta) {
      ultimoVisibleIdx = i;
      break;
    }
  }

  return lineas.map((l, i) => {
    if (l.tipo !== "bloqueo" || l.esRival) return l;
    const esUltima = i === ultimoVisibleIdx;
    const siguiente = lineas[i + 1];
    const base = valorarBloqueoBase(l.destino.celda, esUltima, siguiente);
    return { ...l, subtipo: base };
  });
}

// ============================================================
// SUBTIPOS DE SAQUE (propio y rival)
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

function valorarSaqueRival(
  destinoSaque: string,
  siguiente: LineaClasificada | undefined
): string {
  const huboRecepcion =
    siguiente?.tipo === "recepcion" && !siguiente.esRival;

  if (!huboRecepcion) {
    if (esCanchaPropiaReal(destinoSaque)) {
      return "ace";
    }
    return "negativo";
  }

  const destinoRec = siguiente!.destino.celda;

  if (esFuera(destinoRec) || destinoRec.startsWith("RED-")) {
    return "positivo_mas";
  }

  if (destinoRec === "F1-C3") {
    return "neutro";
  }

  if (destinoRec.startsWith("F1-")) {
    const col = destinoRec.split("-")[1];
    if (col === "C1" || col === "C5") return "positivo";
    return "neutro";
  }

  return "negativo";
}

export function calcularSubtiposSaque(
  lineas: LineaClasificada[]
): LineaClasificada[] {
  const resultado = [...lineas];

  // ---------- Saque propio ----------
  const idxSaquePropio = resultado.findIndex(
    (l) => l.tipo === "saque" && !l.esRival
  );
  if (idxSaquePropio !== -1) {
    const saque = resultado[idxSaquePropio];
    const destinoSaque = saque.destino.celda;

    const desvios = saque.desvios ?? [];
    const tieneDesvioBloqueo = desvios.some((d) =>
      d.celda.startsWith("BLOQ-R-")
    );

    let subtipo: string;

    if (destinoSaque.startsWith("BLOQ-R-") && !tieneDesvioBloqueo) {
      const siguiente = resultado[idxSaquePropio + 1];
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
      const siguiente = resultado[idxSaquePropio + 1];
      if (siguiente && siguiente.tipo === "recepcion" && siguiente.esRival) {
        subtipo = valorarSaqueConRecepcion(siguiente.destino.celda);
      } else {
        subtipo = valorarSaqueSinRecepcion(destinoSaque);
      }
    }

    resultado[idxSaquePropio] = { ...saque, subtipo };
  }

  // ---------- Saque rival ----------
  const idxSaqueRival = resultado.findIndex(
    (l) => l.tipo === "saque" && l.esRival
  );
  if (idxSaqueRival !== -1) {
    const saque = resultado[idxSaqueRival];
    const siguiente = resultado[idxSaqueRival + 1];
    const subtipo = valorarSaqueRival(saque.destino.celda, siguiente);
    resultado[idxSaqueRival] = { ...saque, subtipo };
  }

  return resultado;
}