// ============================================================
// HELPERS MODO ESPEJO V2 — DataEntryV2
// Funciones para resolver jugadores y generar acciones
// cuando se carga el partido con "Modo espejo".
// ============================================================

import {
  numeroRotacionDesdePosiciones,
  type RotacionPunto,
  type Zona,
} from "@/lib/rotaciones";
import {
  POSICIONES_JUEGO,
  resolverRolAJugador,
  type LineaClasificada,
  type Situacion,
} from "@/lib/clasificacionV2";
import type { AccionV2Data } from "@/lib/dbV2";

import type { PuntoV2 } from "./LineasV2";
import { calcularRecepcionOverrides } from "./helpersV2";
import {
  POSICIONES_VACIAS,
  type PuntoCerrado,
  type PosicionesFijasMap,
} from "./tiposV2";

/** Invierte una celda de un lado al otro (F1↔F4, F2↔F5, etc.). */
export function invertirCelda(celda: string): string {
  if (celda.startsWith("F1-")) return "F4-" + celda.slice(3);
  if (celda.startsWith("F2-")) return "F5-" + celda.slice(3);
  if (celda.startsWith("F3-")) return "F6-" + celda.slice(3);
  if (celda.startsWith("F4-")) return "F1-" + celda.slice(3);
  if (celda.startsWith("F5-")) return "F2-" + celda.slice(3);
  if (celda.startsWith("F6-")) return "F3-" + celda.slice(3);
  if (celda.startsWith("BLOQ-P-")) return "BLOQ-R-" + celda.slice(7);
  if (celda.startsWith("BLOQ-R-")) return "BLOQ-P-" + celda.slice(7);
  if (celda.startsWith("FUERA-ARR-")) return "FUERA-ABA-" + celda.slice(10);
  if (celda.startsWith("FUERA-ABA-")) return "FUERA-ARR-" + celda.slice(10);
  return celda;
}

export function jugadorQueSacaDeRot(rot: RotacionPunto): string | null {
  for (const asig of Object.values(rot.posiciones)) {
    if (asig.zona === 1) return asig.jugador_id;
  }
  return null;
}

export function jugadorQueArmaDeRot(rot: RotacionPunto): string | null {
  for (const asig of Object.values(rot.posiciones)) {
    if (asig.tipo === "A") return asig.jugador_id;
  }
  return null;
}

export function zonaRecepcionDeCelda(celda: string): 1 | 5 | 6 | null {
  if (!/^F[123]-/.test(celda)) return null;
  const col = celda.split("-")[1];
  if (col === "C1" || col === "C2") return 5;
  if (col === "C3") return 6;
  if (col === "C4" || col === "C5") return 1;
  return null;
}

export function jugadorQueRecibeDeRot(
  origen: PuntoV2,
  rot: RotacionPunto,
  situacion: Situacion,
  overrides?: Partial<Record<Zona, string | null>>
): string | null {
  const zonaRec = zonaRecepcionDeCelda(origen.celda);
  if (zonaRec === null) return null;
  if (overrides && zonaRec in overrides) {
    return overrides[zonaRec] ?? null;
  }
  const numRot = numeroRotacionDesdePosiciones(rot);
  const fila = POSICIONES_JUEGO[numRot]?.[situacion];
  if (!fila) return null;
  const rol = fila[zonaRec];
  return resolverRolAJugador(rot, rol);
}

/**
 * Genera acciones sintéticas de recepción "ace_contra" cuando un saque
 * termina en ace (cae dentro de la cancha real del receptor sin que nadie
 * la toque). Solo en modo espejo. El jugador que "recibe" se resuelve con
 * el mapeo de recepción del equipo receptor.
 */
export function generarRecepcionesAceContra(params: {
  pc: PuntoCerrado;
  lineas: LineaClasificada[];
  acciones: AccionV2Data[];
  equipoId: string;
  equipoRivalId: string | null;
  posicionesFijas: PosicionesFijasMap;
  posicionesFijasRival: PosicionesFijasMap;
  modoEspejo: boolean;
}): void {
  const {
    pc,
    lineas,
    acciones,
    equipoId,
    equipoRivalId,
    posicionesFijas,
    posicionesFijasRival,
    modoEspejo,
  } = params;

  if (!modoEspejo || !pc.estadoRival || !equipoRivalId) return;

  for (const linea of lineas) {
    if (linea.tipo !== "saque" || linea.oculta) continue;

    const esPropio = !linea.esRival;
    const equipoSacador = esPropio ? equipoId : equipoRivalId;
    if (!equipoSacador) continue;

    // ¿Es un ace?
    let esAce = false;
    if (esPropio) {
      esAce = linea.subtipo === "ace";
    } else {
      const d = linea.destino.celda;
      if (/^F[123]-/.test(d)) {
        const col = d.split("-")[1];
        if (col === "C2" || col === "C3" || col === "C4") {
          const huboRecepcion = lineas.some(
            (l) => l.tipo === "recepcion" && l.equipoId === equipoId
          );
          esAce = !huboRecepcion;
        }
      }
    }
    if (!esAce) continue;

    const equipoReceptor = esPropio ? equipoRivalId : equipoId;

    const yaHay = acciones.some(
      (a) => a.tipo === "recepcion" && a.equipo_id === equipoReceptor
    );
    if (yaHay) continue;

    let rotReceptora: RotacionPunto;
    let situacionReceptora: Situacion;
    let overrides: Partial<Record<Zona, string | null>>;
    let celdaReceptora: string;

    if (esPropio) {
      rotReceptora = pc.estadoRival.rotacion;
      situacionReceptora =
        pc.saqueInicial === "propio" ? "recepcion" : "saque";
      const clave = `${numeroRotacionDesdePosiciones(rotReceptora)}-${situacionReceptora}`;
      const fijas = posicionesFijasRival[clave] ?? POSICIONES_VACIAS;
      overrides = calcularRecepcionOverrides(
        fijas,
        pc.estadoRival.posicionesPunto
      );
      celdaReceptora = invertirCelda(linea.destino.celda);
    } else {
      rotReceptora = pc.rotacion;
      situacionReceptora = pc.situacion;
      const clave = `${numeroRotacionDesdePosiciones(rotReceptora)}-${situacionReceptora}`;
      const fijas = posicionesFijas[clave] ?? POSICIONES_VACIAS;
      overrides = calcularRecepcionOverrides(fijas, pc.posicionesPunto);
      celdaReceptora = linea.destino.celda;
    }

    let jugador = jugadorQueRecibeDeRot(
      { celda: celdaReceptora, mini: linea.destino.mini },
      rotReceptora,
      situacionReceptora,
      overrides
    );

    if (!jugador) {
      const zonaRec = zonaRecepcionDeCelda(celdaReceptora);
      if (zonaRec !== null) {
        const posicionesReceptor = esPropio
          ? pc.estadoRival?.posicionesPunto
          : pc.posicionesPunto;
        jugador =
          overrides?.[zonaRec] ||
          posicionesReceptor?.[zonaRec] ||
          rotReceptora.posiciones[zonaRec as Zona]?.jugador_id ||
          null;
      }
    }
    if (!jugador) continue;

    acciones.push({
      orden: acciones.length + 1,
      tipo: "recepcion",
      subtipo: 1,
      es_rival: !esPropio,
      jugador_id: jugador,
      lado: esPropio ? "rival" : "propio",
      origen_celda: celdaReceptora,
      origen_mini: linea.destino.mini,
      destino_celda: celdaReceptora,
      destino_mini: linea.destino.mini,
      desvios: [],
      zona: null,
      equipo_id: equipoReceptor,
    });
  }
}