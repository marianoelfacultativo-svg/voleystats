// ============================================================
// FILTROS TÁCTICOS — "conducta ante X"
// ============================================================
// Filtros que miran la ACCIÓN ANTERIOR / POSTERIOR dentro del
// mismo punto, o la REPETICIÓN de un jugador dentro del punto.
// Ej: "armados del armador después de un error de recepción",
//     "puntos donde el mismo jugador tocó 2+ veces", etc.
//
// Funciona sobre AccionVisual (3D) y sobre AccionDB (tablas),
// pero esta capa solo conoce AccionVisual. Para AccionDB hay
// un adaptador al final del archivo.
// ============================================================

import type { AccionVisual } from "../app/equipo/adaptadorUnificadoV2";

// ------------------------------------------------------------
// TIPOS
// ------------------------------------------------------------

export type TipoContexto =
  | "cualquiera"
  | "saque"
  | "recepcion"
  | "armado"
  | "ataque"
  | "bloqueo"
  | "defensa"
  | "libre"
  | "roce-red";

export type RelacionJugador =
  | "cualquiera"
  | "mismo"
  | "companero"
  | "rival";

export interface ContextoFiltro {
  tipo: TipoContexto;
  /** "cualquiera" = no filtra por resultado */
  resultado: string | "cualquiera";
  relacionJugador: RelacionJugador;
}

export interface RepeticionFiltro {
  veces: "2+" | "3+";
  porJugador: "mismo" | "cualquiera";
}

export interface FiltrosTacticos {
  contextoPrevio: ContextoFiltro | null;
  contextoPosterior: ContextoFiltro | null;
  repeticion: RepeticionFiltro | null;
}

export const FILTROS_TACTICOS_VACIO: FiltrosTacticos = {
  contextoPrevio: null,
  contextoPosterior: null,
  repeticion: null,
};

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

/** Devuelve true si algún filtro táctico está activo. */
export function hayFiltrosTacticos(f: FiltrosTacticos): boolean {
  return !!(f.contextoPrevio || f.contextoPosterior || f.repeticion);
}

/** Normaliza el subtipo (saca "toque:" adelante si existe). */
function baseSubtipo(a: AccionVisual): string {
  const s =
    a.subtipo !== null && a.subtipo !== undefined
      ? String(a.subtipo)
      : "";
  return s.startsWith("toque:") ? s.slice(6) : s;
}

/**
 * Chequea si `otra` (la acción anterior o posterior) matchea el
 * `filtro` respecto de `actual`.
 */
function matchContexto(
  otra: AccionVisual | null,
  filtro: ContextoFiltro,
  actual: AccionVisual
): boolean {
  if (!otra) return false;

  // Tipo
  if (filtro.tipo !== "cualquiera" && otra.tipo !== filtro.tipo) {
    return false;
  }

  // Resultado (solo si no es "cualquiera")
  if (filtro.resultado !== "cualquiera") {
    if (baseSubtipo(otra) !== filtro.resultado) return false;
  }

  // Relación de jugador
  if (filtro.relacionJugador !== "cualquiera") {
    const mismoJugador = otra.jugador_id === actual.jugador_id;
    const mismoEquipo = otra.es_rival === actual.es_rival;

    if (filtro.relacionJugador === "mismo" && !mismoJugador) return false;
    if (filtro.relacionJugador === "companero") {
      if (mismoJugador || !mismoEquipo) return false;
    }
    if (filtro.relacionJugador === "rival") {
      if (mismoEquipo) return false;
    }
  }

  return true;
}

// ------------------------------------------------------------
// APLICAR FILTROS TÁCTICOS
// ------------------------------------------------------------

/**
 * Filtra `acciones` según los filtros tácticos.
 *
 * IMPORTANTE: para evaluar contexto previo/posterior y repetición
 * necesitamos TODAS las acciones visibles de cada punto (no solo
 * las que ya vienen filtradas por tipo/jugador). Por eso este
 * helper recibe `todasLasAccionesDelPartido` como contexto y
 * `acciones` como el conjunto candidato a filtrar.
 *
 * - `acciones`: subset a filtrar (lo que ya pasó por otros filtros)
 * - `todasLasAcciones`: el universo completo del partido (para contexto)
 * - `jugadorFiltradoId`: para "repeticion.porJugador === 'mismo'"
 */
export function aplicarFiltrosTacticos(
  acciones: AccionVisual[],
  todasLasAcciones: AccionVisual[],
  filtros: FiltrosTacticos,
  jugadorFiltradoId: string | null
): AccionVisual[] {
  if (!hayFiltrosTacticos(filtros)) return acciones;

  // Agrupar el universo completo por punto, ordenado por `orden`.
  const porPunto = new Map<string, AccionVisual[]>();
  for (const a of todasLasAcciones) {
    if (a.oculta) continue;
    const k = `${a.set_numero}-${a.punto_numero}`;
    let lista = porPunto.get(k);
    if (!lista) {
      lista = [];
      porPunto.set(k, lista);
    }
    lista.push(a);
  }
  for (const lista of porPunto.values()) {
    lista.sort((x, y) => x.orden - y.orden);
  }

  // Precalcular puntos que pasan el filtro de repetición.
  const puntosOkRepeticion = new Set<string>();
  if (filtros.repeticion) {
    const minVeces = filtros.repeticion.veces === "2+" ? 2 : 3;
    for (const [k, lista] of porPunto) {
      if (
        filtros.repeticion.porJugador === "mismo" &&
        jugadorFiltradoId
      ) {
        const count = lista.filter(
          (a) => a.jugador_id === jugadorFiltradoId
        ).length;
        if (count >= minVeces) puntosOkRepeticion.add(k);
      } else {
        const conteo = new Map<string, number>();
        for (const a of lista) {
          if (!a.jugador_id) continue;
          conteo.set(
            a.jugador_id,
            (conteo.get(a.jugador_id) ?? 0) + 1
          );
        }
        if (
          Array.from(conteo.values()).some((c) => c >= minVeces)
        ) {
          puntosOkRepeticion.add(k);
        }
      }
    }
  }

  // Filtrar cada acción.
  const resultado: AccionVisual[] = [];
  for (const a of acciones) {
    if (a.oculta) continue;
    const k = `${a.set_numero}-${a.punto_numero}`;

    // Repetición: el punto entero debe pasar
    if (filtros.repeticion && !puntosOkRepeticion.has(k)) continue;

    const lista = porPunto.get(k) ?? [];
    const idx = lista.findIndex((x) => x.id === a.id);

    // Contexto previo
    if (filtros.contextoPrevio) {
      const prev = idx > 0 ? lista[idx - 1] : null;
      if (!matchContexto(prev, filtros.contextoPrevio, a)) continue;
    }

    // Contexto posterior
    if (filtros.contextoPosterior) {
      const next =
        idx >= 0 && idx < lista.length - 1 ? lista[idx + 1] : null;
      if (!matchContexto(next, filtros.contextoPosterior, a)) {
        continue;
      }
    }

    resultado.push(a);
  }

  return resultado;
}

// ------------------------------------------------------------
// RESULTADOS DISPONIBLES POR TIPO
// ------------------------------------------------------------

/**
 * Devuelve los resultados válidos para el dropdown del panel.
 * "cualquiera" siempre va primero.
 */
export function resultadosPorTipo(tipo: TipoContexto): string[] {
  switch (tipo) {
    case "saque":
      return [
        "cualquiera",
        "ace",
        "positivo_mas",
        "positivo",
        "neutro",
        "negativo",
        "error_rival",
      ];
    case "recepcion":
      return [
        "cualquiera",
        "perfecta",
        "positiva",
        "intermedia",
        "negativa",
        "doble_negativa",
        "overpass",
        "error_directo",
      ];
    case "armado":
      return ["cualquiera", "1", "2", "3", "4", "5", "6", "R"];
    case "ataque":
      return [
        "cualquiera",
        "punto",
        "neutro",
        "error",
        "error_afuera_ataque",
        "error_red_ataque",
        "gorro_ataque",
        "use_rival_ataque",
        "buena_rival",
        "peligroso",
        "simple",
        "libre",
      ];
    case "bloqueo":
      return [
        "cualquiera",
        "punto",
        "positivo_mas",
        "positivo",
        "neutro",
        "use_rival",
        "red",
        "filtrada",
      ];
    case "defensa":
      return [
        "cualquiera",
        "toque_positiva",
        "toque_negativa",
        "gran_def",
        "error_def",
        "mala_libre",
        "cobertura_positiva",
        "cobertura_negativa",
        "errores_graves",
        "neutro",
      ];
    case "libre":
      return ["cualquiera", "toque", "libre"];
    case "roce-red":
      return [
        "cualquiera",
        "ofensivo-propio",
        "invasion-zaguero",
        "invasion-delantero",
        "roce-red-rival",
      ];
    case "cualquiera":
    default:
      return ["cualquiera"];
  }
}