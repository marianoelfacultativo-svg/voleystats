// ============================================================
// HELPERS PUROS — Partidos
// ============================================================
// Funciones sin React, sin estado. Solo transformación de datos
// y cálculos agregados.
//
// Todo lo que hoy está inline en el render de Partidos.tsx se
// extrae acá para poder testearlo y reusarlo.
// ============================================================

import type { AccionDB } from "@/lib/db";
import type { AccionVisual } from "../adaptadorUnificadoV2";
import { zonaCrudaDeCelda } from "@/lib/mapeoV2";
import {
  calcularEstadisticasEquipo,
  calcularEstadisticasJugador,
  calcularMaxAccionesPorFundamento,
  VALORES_RECEPCION,
  type EstadisticasJugador,
  type PromedioRecepcionSet,
} from "@/lib/estadisticas";
import {
  COLORES_COMPARACION,
  type DatosRival,
  type Jugador,
  type Partido,
} from "./types";

// ------------------------------------------------------------
// ADAPTER: AccionDB[] → AccionVisual[]
// ------------------------------------------------------------
//
// Usado por:
//   - Filtros tácticos en Partidos.
//   - Análisis de consecuencias en Partidos.
//
// AccionDB no trae `orden` ni `zona_origen`/`zona_destino`.
// Derivamos:
//   - orden: contador incremental por punto (en el orden que vienen).
//   - zonas: usando zonaCrudaDeCelda() sobre celdas propias (F1..F3).
//
// Todas las acciones de cargarAccionesCompatibles son del equipo
// propio (ya vienen filtradas), así que `es_rival` siempre es false.
// ------------------------------------------------------------

export function accionesDBaVisualParaTactico(
  acciones: AccionDB[]
): AccionVisual[] {
  const contadorPorPunto = new Map<string, number>();

  return acciones.map((a) => {
    const k = `${a.set_numero}-${a.punto_numero ?? 0}`;
    const orden = (contadorPorPunto.get(k) ?? 0) + 1;
    contadorPorPunto.set(k, orden);

    const tipo = a.fundamento === "armados" ? "armado" : a.fundamento;

    const zonaOrigen =
      a.origen_celda && /^F[1-3]-/.test(a.origen_celda)
        ? zonaCrudaDeCelda(a.origen_celda)
        : null;
    const zonaDestino =
      a.destino_celda && /^F[1-3]-/.test(a.destino_celda)
        ? zonaCrudaDeCelda(a.destino_celda)
        : null;

    return {
      id: `${a.jugador_id}|${a.set_numero}|${a.punto_numero ?? 0}|${orden}`,
      partido_id: a.partido_id ?? "",
      set_numero: a.set_numero,
      punto_numero: a.punto_numero ?? 0,
      orden,
      tipo,
      subtipo: a.subtipo_original ?? a.valoracion,
      es_rival: false,
      jugador_id: a.jugador_id,
      lado: "propio",
      equipo_id: null,
      origen_celda: a.origen_celda ?? null,
      origen_mini: a.origen_mini ?? null,
      destino_celda: a.destino_celda ?? null,
      destino_mini: a.destino_mini ?? null,
      desvios: [],
      variante: a.variante ?? null,
      tipo_saque: a.tipo_saque ?? null,
      velocidad: a.velocidad ?? null,
      x2: false,
      oculta: false,
      posicion_inicial_celda: a.posicion_inicial_celda ?? null,
      posicion_inicial_mini: a.posicion_inicial_mini ?? null,
      es_error: false,
      zona_origen: zonaOrigen,
      zona_destino: zonaDestino,
      rotacion_numero: null,
      rol_jugador: null,
      zona_jugador: null,
      origen_x: null,
      origen_y: null,
      destino_x: null,
      destino_y: null,
      posicion_inicial_x: null,
      posicion_inicial_y: null,
      zona_origen_codigo: null,
      zona_destino_codigo: null,
      subtipo_real: null,
      es_ultima_del_punto: false,
      calidad_armado_previo: null,
    };
  });
}

// ------------------------------------------------------------
// PROMEDIOS DE RECEPCIÓN POR SET (equipo)
// ------------------------------------------------------------
//
// Para cada set 1..5, calcula el promedio de valoración de
// recepción del equipo (excluyendo armadores) usando los valores
// del sistema nuevo.
// ------------------------------------------------------------

export function calcularPromediosRecepcionEquipo(
  acciones: AccionDB[],
  armadores: Set<string>
): PromedioRecepcionSet[] {
  return [1, 2, 3, 4, 5].map((s) => {
    const delSet = acciones.filter(
      (a) =>
        a.fundamento === "recepcion" &&
        a.set_numero === s &&
        !armadores.has(a.jugador_id)
    );
    let suma = 0;
    let total = 0;
    for (const a of delSet) {
      const v = VALORES_RECEPCION[a.valoracion] ?? 0;
      suma += v * a.cantidad;
      total += a.cantidad;
    }
    return {
      set: s,
      promedio: total > 0 ? suma / total : 0,
      totalRecepciones: total,
    };
  });
}

// ------------------------------------------------------------
// PARTIDOS COMPARADOS — datos agregados por partido
// ------------------------------------------------------------
//
// Para "Comparar 2-3 partidos": devuelve un array con el stats
// total de cada partido, sus acciones y el color asignado.
// ------------------------------------------------------------

export interface PartidoComparadoData {
  id: string;
  nombre: string;
  color: string;
  partido: Partido;
  stats: EstadisticasJugador;
  acciones: AccionDB[];
}

export function calcularPartidosComparadosData(
  partidosComparadosIds: string[],
  partidos: Partido[],
  acciones: AccionDB[],
  idsJugadores: string[],
  armadores: Set<string>,
  nombreRivalDe: (p: Partido) => string
): PartidoComparadoData[] {
  return partidosComparadosIds
    .map((id, idx) => {
      const partido = partidos.find((p) => p.id === id);
      if (!partido) return null;
      const accPartido = acciones.filter((a) => a.partido_id === id);
      const stats = calcularEstadisticasEquipo(
        idsJugadores,
        accPartido,
        armadores
      ).totales;
      return {
        id,
        nombre: `vs ${nombreRivalDe(partido)} (${partido.fecha})`,
        color: COLORES_COMPARACION[idx],
        partido,
        stats,
        acciones: accPartido,
      };
    })
    .filter((x): x is PartidoComparadoData => x !== null);
}

// ------------------------------------------------------------
// JUGADOR POR PARTIDOS — datos agregados
// ------------------------------------------------------------
//
// Para "Jugador por partidos": devuelve las stats individuales
// del jugador en cada uno de los partidos seleccionados.
// ------------------------------------------------------------

export interface PartidoJxPData {
  id: string;
  nombre: string;
  color: string;
  partido: Partido;
  accPartido: AccionDB[];
  est: EstadisticasJugador;
}

export function calcularPartidosJxPData(
  jugadorId: string | null,
  esArmador: boolean,
  partidosJxPIds: string[],
  partidos: Partido[],
  acciones: AccionDB[],
  idsJugadores: string[],
  nombreRivalDe: (p: Partido) => string
): PartidoJxPData[] {
  if (!jugadorId) return [];

  return partidosJxPIds
    .map((pid, idx) => {
      const partido = partidos.find((p) => p.id === pid);
      if (!partido) return null;

      const accPartido = acciones.filter((a) => a.partido_id === pid);

      const maxPorFundP = calcularMaxAccionesPorFundamento(
        accPartido,
        idsJugadores
      );
      let maxAccP = 1;
      for (const jid of idsJugadores) {
        const total = accPartido
          .filter((a) => a.jugador_id === jid)
          .reduce((s, a) => s + a.cantidad, 0);
        if (total > maxAccP) maxAccP = total;
      }

      const est = calcularEstadisticasJugador(
        jugadorId,
        accPartido,
        esArmador,
        maxPorFundP,
        maxAccP
      );

      return {
        id: pid,
        nombre: `vs ${nombreRivalDe(partido)} (${partido.fecha})`,
        color: COLORES_COMPARACION[idx],
        partido,
        accPartido,
        est,
      };
    })
    .filter((x): x is PartidoJxPData => x !== null);
}

// ------------------------------------------------------------
// STATS DE JUGADORES COMPARADOS (dentro de un mismo partido)
// ------------------------------------------------------------
//
// Para el modo "Comparar jugadores" dentro del detalle de un
// partido: devuelve las stats individuales de cada jugador
// seleccionado en ese partido.
// ------------------------------------------------------------

export interface JugadorComparadoData {
  id: string;
  nombre: string;
  color: string;
  est: EstadisticasJugador | undefined;
}

export function calcularStatsJugadoresComparados(
  jugadoresComparadosIds: string[],
  jugadores: Jugador[],
  accionesDelPartido: AccionDB[],
  idsJugadores: string[],
  armadores: Set<string>,
  nombreDe: (id: string) => string
): JugadorComparadoData[] {
  const porJugador = calcularEstadisticasEquipo(
    idsJugadores,
    accionesDelPartido,
    armadores
  ).porJugador;

  return jugadoresComparadosIds.map((id, idx) => ({
    id,
    nombre: nombreDe(id),
    color: COLORES_COMPARACION[idx],
    est: porJugador[id],
  }));
}

// ------------------------------------------------------------
// SERIES PARA GRÁFICOS DE COMPARACIÓN
// ------------------------------------------------------------

/** Acciones totales de un conjunto de partidos comparados. */
export function aplanarAccionesDePartidos(
  partidosData: PartidoComparadoData[]
): AccionDB[] {
  return partidosData.flatMap((s) => s.acciones);
}

/** Acciones totales de un conjunto de partidos JxP. */
export function aplanarAccionesDeJxP(
  partidosData: PartidoJxPData[]
): AccionDB[] {
  return partidosData.flatMap((s) => s.accPartido);
}

/** Serie de recepción por set para cada partido comparado. */
export function seriesRecepcionDePartidos(
  partidosData: PartidoComparadoData[],
  armadores: Set<string>
): {
  id: string;
  nombre: string;
  color: string;
  promedios: PromedioRecepcionSet[];
}[] {
  return partidosData.map((s) => {
    const promedios: PromedioRecepcionSet[] = [1, 2, 3, 4, 5].map((set) => {
      const delSet = s.acciones.filter(
        (a) =>
          a.fundamento === "recepcion" &&
          a.set_numero === set &&
          !armadores.has(a.jugador_id)
      );
      let suma = 0;
      let total = 0;
      for (const a of delSet) {
        const v = VALORES_RECEPCION[a.valoracion] ?? 0;
        suma += v * a.cantidad;
        total += a.cantidad;
      }
      return {
        set,
        promedio: total > 0 ? suma / total : 0,
        totalRecepciones: total,
      };
    });
    return {
      id: s.id,
      nombre: s.nombre,
      color: s.color,
      promedios,
    };
  });
}

// ------------------------------------------------------------
// DATOS DE RIVAL
// ------------------------------------------------------------

/** Devuelve los datos de rival de un partido, o ceros. */
export function datosRivalDePartido(
  partidoId: string | null | undefined,
  datosRival: Record<string, DatosRival>
): DatosRival {
  if (!partidoId) return { buenas: 0, errores: 0 };
  return datosRival[partidoId] ?? { buenas: 0, errores: 0 };
}