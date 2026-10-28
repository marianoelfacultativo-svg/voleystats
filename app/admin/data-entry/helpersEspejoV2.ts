// ============================================================
// HELPERS MODO ESPEJO V2 — DataEntryV2
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
import { zonaCrudaDeCelda } from "@/lib/mapeoV2";

import type { PuntoV2 } from "./LineasV2";
import { calcularRecepcionOverrides, centroDePunto } from "./helpersV2";
import {
  POSICIONES_VACIAS,
  type PuntoCerrado,
  type PosicionesFijasMap,
} from "./tiposV2";

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

function infoJugadorEnRotacion(
  rot: RotacionPunto,
  jugadorId: string | null
): { rol: string | null; zona: number | null } {
  if (!jugadorId) return { rol: null, zona: null };
  for (const asig of Object.values(rot.posiciones)) {
    if (asig.jugador_id === jugadorId) {
      return { rol: asig.tipo, zona: asig.zona };
    }
  }
  const lib = (rot.liberos ?? []).find(
    (l) => l.jugador_id === jugadorId
  );
  if (lib) return { rol: "L", zona: null };
  return { rol: null, zona: null };
}

/**
 * Genera recepciones sintéticas de ace cuando un saque termina en ace.
 *
 * Comportamiento:
 *
 *   - Modo normal (sin espejo):
 *       Solo cubre "saca el rival → el receptor es nuestro".
 *       Ahí tenemos nuestra rotación y nuestras posiciones, así que
 *       podemos saber quién debería haber recibido el ace.
 *
 *   - Modo espejo:
 *       Cubre además "saca el propio equipo → el receptor es del
 *       rival", usando el estado del rival guardado en el punto
 *       (`pc.estadoRival`).
 *
 *   - Sin popup en ningún caso: la recepción "error_directo" se
 *     genera automática y no se le pregunta nada al usuario.
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

  for (const linea of lineas) {
    if (linea.tipo !== "saque" || linea.oculta) continue;

    const esPropio = !linea.esRival;

    // Saque propio → el receptor sería del rival.
    // Sin estado del rival (o sin equipo rival) no podemos saber a
    // quién asignarle la recepción sintética → skip.
    if (esPropio && (!modoEspejo || !pc.estadoRival || !equipoRivalId)) {
      continue;
    }

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
    if (!equipoReceptor) continue;

    const yaHay = acciones.some(
      (a) => a.tipo === "recepcion" && a.equipo_id === equipoReceptor
    );
    if (yaHay) continue;

    let rotReceptora: RotacionPunto;
    let situacionReceptora: Situacion;
    let overrides: Partial<Record<Zona, string | null>>;
    let celdaReceptora: string;

    if (esPropio) {
      // Espejo: saca el propio equipo → el receptor es del rival.
      rotReceptora = pc.estadoRival!.rotacion;
      situacionReceptora =
        pc.saqueInicial === "propio" ? "recepcion" : "saque";
      const clave = `${numeroRotacionDesdePosiciones(rotReceptora)}-${situacionReceptora}`;
      const fijas = posicionesFijasRival[clave] ?? POSICIONES_VACIAS;
      overrides = calcularRecepcionOverrides(
        fijas,
        pc.estadoRival!.posicionesPunto
      );
      celdaReceptora = invertirCelda(linea.destino.celda);
    } else {
      // Saca el rival → el receptor es nuestro.
      // Este caso funciona con o sin modo espejo.
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

    const rotNum = numeroRotacionDesdePosiciones(rotReceptora);
    const { rol: rol_jugador, zona: zona_jugador } =
      infoJugadorEnRotacion(rotReceptora, jugador);
    const zonaCruda = zonaCrudaDeCelda(celdaReceptora);
    const coords = centroDePunto({
      celda: celdaReceptora,
      mini: linea.destino.mini,
    });

    acciones.push({
      orden: acciones.length + 1,
      tipo: "recepcion",
      subtipo: "error_directo",
      es_rival: esPropio,
      jugador_id: jugador,
      lado: esPropio ? "rival" : "propio",
      origen_celda: celdaReceptora,
      origen_mini: linea.destino.mini,
      destino_celda: celdaReceptora,
      destino_mini: linea.destino.mini,
      desvios: [],
      zona: zonaCruda,
      equipo_id: equipoReceptor,

      es_error: true,
      zona_origen: zonaCruda,
      zona_destino: zonaCruda,
      rotacion_numero: rotNum,
      rol_jugador,
      zona_jugador,
      origen_x: coords.x,
      origen_y: coords.y,
      destino_x: coords.x,
      destino_y: coords.y,
      posicion_inicial_x: null,
      posicion_inicial_y: null,
    });
  }
}