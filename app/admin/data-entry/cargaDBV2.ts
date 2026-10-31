// ============================================================
// CARGA DB V2 — DataEntryV2
// Funciones para reconstruir el estado de la consola a partir
// de los datos guardados en Supabase (puntos_v2 + acciones_v2 +
// partidos).
// ============================================================
//
// v2 (FASE 7.1 — DataEntry con sets y partido):
//   + `cargarEstadoDesdeDB` reemplaza a `cargarPuntosCerradosDesdeDB`.
//     Devuelve TODO el estado reconstruido de una sola vez:
//       · puntosCerrados: PuntosPorSet (clave "set-punto")
//       · setsCerrados: SetsCerrados (uno por set con resultado)
//       · partidoCerrado: PartidoCerrado | null
//       · setActivoRecomendado: number
//       · puntoActivoRecomendado: number
//   + Lee `partidos.setN_ganado` y `partidos.resultado_partido`
//     con flip si el equipo actual es el rival del partido.
//   + Reconstruye `SetCerrado` con:
//       · ganador y marcador desde `setN_ganado` + puntos del set
//       · rotacionAlCerrar y liberosAlCerrar desde el último punto
//         del set (o `rotacionVacia(1, set, 1)` si no hay puntos)
//   + Reconstruye `PartidoCerrado` desde `resultado_partido`.
//   + `subtipoPreservado` se mantiene igual (filtra subtipos
//     válidos por tipo).
//
// v1: solo cargaba `PuntoCerrado` con clave numérica (punto).
// ============================================================

import { supabase } from "@/lib/supabase";
import { cargarPuntosV2 } from "@/lib/dbV2";
import { debeFlipear } from "@/lib/flipPerspectiva";
import { rotacionVacia, type Libero, type RotacionPunto } from "@/lib/rotaciones";
import type { LineaClasificada } from "@/lib/clasificacionV2";
import {
  clavePunto,
  type FormatoPartido,
  type PartidoCerrado,
  type PuntoCerrado,
  type PuntosPorSet,
  type SetCerrado,
  type SetsCerrados,
} from "./tiposV2";

// ------------------------------------------------------------
// RECEPCIÓN — subtipos válidos
// ------------------------------------------------------------

const RECEPCION_VALORES_VALIDOS = new Set<string>([
  "perfecta",
  "positiva",
  "intermedia",
  "negativa",
  "doble_negativa",
  "overpass",
  "error_directo",
]);

/**
 * Qué subtipos se conservan al recargar.
 *
 * Recepción: solo strings del sistema nuevo (7 valores). Los
 * partidos viejos con subtipo numérico 1-6 quedan afuera a
 * propósito (opción 3: empezar de cero).
 */
export function subtipoPreservado(tipo: string, subtipo: any): any {
  if (tipo === "recepcion") {
    return typeof subtipo === "string" && RECEPCION_VALORES_VALIDOS.has(subtipo)
      ? subtipo
      : null;
  }
  if (tipo === "armado") return subtipo;
  if (tipo === "roce-red") return subtipo;
  if (tipo === "defensa") {
    const validos = new Set<string>([
      "toque",
      "gran-defensa",
      "libre",
      "cobertura",
      "toque_positiva",
      "toque_negativa",
      "gran_def",
      "error_def",
      "mala_libre",
      "buena_rival",
      "neutro",
      "cobertura_positiva",
      "cobertura_negativa",
      "errores_graves",
    ]);
    return typeof subtipo === "string" && validos.has(subtipo)
      ? subtipo
      : null;
  }
  return null;
}

// ------------------------------------------------------------
// RESULTADO DE LA CARGA
// ------------------------------------------------------------

export interface EstadoCargadoDesdeDB {
  puntosCerrados: PuntosPorSet;
  setsCerrados: SetsCerrados;
  partidoCerrado: PartidoCerrado | null;
  setActivoRecomendado: number;
  puntoActivoRecomendado: number;
}

// ------------------------------------------------------------
// HELPERS INTERNOS
// ------------------------------------------------------------

/**
 * Invierte un flag `setN_ganado` si el equipo actual es el rival
 * del partido.
 */
function invertirGanado(
  v: boolean | null | undefined,
  flipear: boolean
): boolean | null {
  if (v === null || v === undefined) return null;
  return flipear ? !v : v;
}

/**
 * Invierte `resultado_partido` si el equipo actual es el rival
 * del partido.
 */
function invertirResultadoPartido(
  v: string | null | undefined,
  flipear: boolean
): "ganado" | "perdido" | null {
  if (v === "ganado") return flipear ? "perdido" : "ganado";
  if (v === "perdido") return flipear ? "ganado" : "perdido";
  return null;
}

/**
 * Calcula el marcador (propios-rivales) de un set a partir de los
 * puntos cerrados. Si no hay puntos, devuelve 0-0.
 */
function marcadorDelSet(
  puntosDelSet: PuntoCerrado[]
): { propios: number; rivales: number } {
  let propios = 0;
  let rivales = 0;
  for (const p of puntosDelSet) {
    if (p.ganador === "propio") propios++;
    else rivales++;
  }
  return { propios, rivales };
}

// ------------------------------------------------------------
// CARGA PRINCIPAL
// ------------------------------------------------------------

export async function cargarEstadoDesdeDB(
  partidoId: string,
  equipoId: string,
  formatoPartido: FormatoPartido
): Promise<EstadoCargadoDesdeDB> {
  const vacio: EstadoCargadoDesdeDB = {
    puntosCerrados: {},
    setsCerrados: {},
    partidoCerrado: null,
    setActivoRecomendado: 1,
    puntoActivoRecomendado: 1,
  };

  if (!partidoId) return vacio;

  // ---------- 1. ¿Hay que invertir? ----------
  const hayQueFlipear = await debeFlipear(partidoId, equipoId);

  // ---------- 2. Leer partido (resultado por set + partido) ----------
  const { data: partidoData } = await supabase
    .from("partidos")
    .select(
      "set1_ganado, set2_ganado, set3_ganado, set4_ganado, set5_ganado, resultado_partido"
    )
    .eq("id", partidoId)
    .maybeSingle();

  const setGanadoPorSet = new Map<number, boolean | null>();
  if (partidoData) {
    setGanadoPorSet.set(1, invertirGanado(partidoData.set1_ganado, hayQueFlipear));
    setGanadoPorSet.set(2, invertirGanado(partidoData.set2_ganado, hayQueFlipear));
    setGanadoPorSet.set(3, invertirGanado(partidoData.set3_ganado, hayQueFlipear));
    setGanadoPorSet.set(4, invertirGanado(partidoData.set4_ganado, hayQueFlipear));
    setGanadoPorSet.set(5, invertirGanado(partidoData.set5_ganado, hayQueFlipear));
  }

  const resultadoPartido = invertirResultadoPartido(
    partidoData?.resultado_partido,
    hayQueFlipear
  );

  // ---------- 3. Leer puntos + acciones ----------
  const res = await cargarPuntosV2(partidoId);
  if (!res.ok || !res.puntos) return vacio;

  // ---------- 4. Construir PuntosPorSet ----------
  const puntosCerrados: PuntosPorSet = {};
  // También agrupamos por set para calcular marcador y rotación al cierre.
  const puntosPorSet: Record<number, PuntoCerrado[]> = {};

  for (const p of res.puntos) {
    if (p.ganador !== "propio" && p.ganador !== "rival") continue;

    const acciones = [...p.acciones].sort((a, b) => a.orden - b.orden);

    const lineas: LineaClasificada[] = acciones.map((a) => {
      let variante: any = a.variante ?? null;
      let subtipoRaw: any = a.subtipo;
      if (typeof subtipoRaw === "string" && subtipoRaw.startsWith("toque:")) {
        variante = variante ?? "toque";
        subtipoRaw = subtipoRaw.slice(6);
      }

      return {
        id: `db-${a.id}`,
        tipo: a.tipo as any,
        esRival: a.es_rival,
        jugadorId: a.jugador_id ?? null,
        origen: {
          celda: a.origen_celda ?? "",
          mini: a.origen_mini ?? "",
        },
        destino: {
          celda: a.destino_celda ?? "",
          mini: a.destino_mini ?? "",
        },
        desvios: (a.desvios ?? []).map((d: any) => ({
          celda: d.celda,
          mini: d.mini,
          jugadorId: d.jugador_id ?? null,
        })),
        subtipo: subtipoPreservado(a.tipo, subtipoRaw),
        variante,
        velocidad: a.velocidad ?? null,
        tipoSaque: (a.tipo_saque as any) ?? null,
        x2: a.x2 ?? undefined,
        oculta: a.oculta ?? undefined,
        posicionInicial: a.posicion_inicial_celda
          ? {
              celda: a.posicion_inicial_celda,
              mini: a.posicion_inicial_mini ?? "",
            }
          : null,
        equipoId: a.equipo_id ?? null,
      };
    });

    const pc: PuntoCerrado = {
      numero: p.punto_numero,
      set_numero: p.set_numero,
      lineas,
      saqueInicial: p.saque_equipo as any,
      situacion: p.situacion as any,
      ganador: p.ganador as any,
      rotacion: p.rotacion as any,
      liberos: (p.liberos ?? []) as any,
      posicionesPunto: (p.posiciones_punto ?? {}) as any,
      cambios: (p.cambios ?? []) as any,
      equipoId: p.equipo_id ?? undefined,
      estadoRival: p.estado_rival ? (p.estado_rival as any) : undefined,
    };

    puntosCerrados[clavePunto(p.set_numero, p.punto_numero)] = pc;

    if (!puntosPorSet[p.set_numero]) puntosPorSet[p.set_numero] = [];
    puntosPorSet[p.set_numero].push(pc);
  }

  // Ordenamos cada set por numero de punto.
  for (const s of Object.keys(puntosPorSet)) {
    puntosPorSet[parseInt(s, 10)].sort((a, b) => a.numero - b.numero);
  }

  // ---------- 5. Construir SetsCerrados ----------
  const setsCerrados: SetsCerrados = {};
  const maxSets = formatoPartido === "bo3" ? 3 : 5;

  for (let s = 1; s <= maxSets; s++) {
    const ganado = setGanadoPorSet.get(s);
    if (ganado === null || ganado === undefined) continue;

    const puntosDelSet = puntosPorSet[s] ?? [];
    const { propios, rivales } = marcadorDelSet(puntosDelSet);
    const ultimoPunto = puntosDelSet[puntosDelSet.length - 1] ?? null;

    const rotacionAlCerrar: RotacionPunto = ultimoPunto
      ? ultimoPunto.rotacion
      : rotacionVacia(1, s, Math.max(1, propios + rivales), "propio");

    const liberosAlCerrar: Libero[] = ultimoPunto
      ? ultimoPunto.liberos
      : [];

    setsCerrados[s] = {
      numero: s,
      ganador: ganado ? "propio" : "rival",
      puntosPropios: propios,
      puntosRivales: rivales,
      rotacionAlCerrar,
      liberosAlCerrar,
    };
  }

  // ---------- 6. Construir PartidoCerrado ----------
  let partidoCerrado: PartidoCerrado | null = null;
  if (resultadoPartido === "ganado" || resultadoPartido === "perdido") {
    let setsPropios = 0;
    let setsRivales = 0;
    for (const sc of Object.values(setsCerrados)) {
      if (sc.ganador === "propio") setsPropios++;
      else setsRivales++;
    }
    partidoCerrado = {
      ganador: resultadoPartido === "ganado" ? "propio" : "rival",
      setsPropios,
      setsRivales,
    };
  }

  // ---------- 7. Calcular set/punto activo recomendado ----------
  let setActivoRecomendado = 1;
  let puntoActivoRecomendado = 1;

  for (let s = 1; s <= maxSets; s++) {
    if (setsCerrados[s]) continue;
    // Este set no está cerrado. Es el que hay que editar.
    setActivoRecomendado = s;
    const puntosDelSet = puntosPorSet[s] ?? [];
    const maxNumero =
      puntosDelSet.length > 0
        ? puntosDelSet[puntosDelSet.length - 1].numero
        : 0;
    puntoActivoRecomendado = maxNumero + 1;
    break;
  }

  // Si todos los sets están cerrados (partido cerrado), quedamos
  // en el último set con resultado y su último punto.
  if (Object.keys(setsCerrados).length === maxSets) {
    const ultimoSet = Object.keys(setsCerrados)
      .map((k) => parseInt(k, 10))
      .sort((a, b) => b - a)[0];
    setActivoRecomendado = ultimoSet;
    const puntosDelUltimoSet = puntosPorSet[ultimoSet] ?? [];
    puntoActivoRecomendado =
      puntosDelUltimoSet.length > 0
        ? puntosDelUltimoSet[puntosDelUltimoSet.length - 1].numero
        : 1;
  }

  return {
    puntosCerrados,
    setsCerrados,
    partidoCerrado,
    setActivoRecomendado,
    puntoActivoRecomendado,
  };
}