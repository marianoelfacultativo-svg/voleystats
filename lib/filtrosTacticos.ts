// ============================================================
// FILTROS TÁCTICOS — motor puro
// ============================================================
// Filtros de contexto para análisis táctico.
//
// Ahora cubre:
//   - Contexto previo/posterior (dentro del mismo punto)
//   - Repetición de jugador en el punto
//   - Contexto de rally (fase, primer toque, nº toques)
//   - Ubicación (delantero / zaguero / líbero)
//   - Marcador al momento de la acción (estado, diferencia, crítico)
//   - vs Promedio (por encima / por debajo del promedio del equipo)
//   - Racha mínima (puntos ganados/perdidos consecutivos)
//   - Comparadores contra trigger / anterior (incluye mismo rol)
//
// Toda la lógica de contexto rally se delega a lib/contextoRally.ts.
//
// Funciona sobre AccionVisual. Para AccionDB hay adapters en
// cada consumidor.
// ============================================================

import type { AccionVisual } from "../app/equipo/adaptadorUnificadoV2";
import {
  calcularContextoRally,
  type ContextoRally,
  type FaseRally,
  type InicioPunto,
  type UbicacionJugador,
  type EstadoMarcador,
  type DiferenciaMarcador,
} from "./contextoRally";

// ------------------------------------------------------------
// TIPOS BASE (existentes)
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
  resultado: string | "cualquiera";
  relacionJugador: RelacionJugador;
}

export interface RepeticionFiltro {
  veces: "2+" | "3+";
  porJugador: "mismo" | "cualquiera";
}

// ------------------------------------------------------------
// TIPOS NUEVOS
// ------------------------------------------------------------

export type FaseRallyFiltro = "cualquiera" | FaseRally;

export interface RallyFiltro {
  /** Fase del rally (side-out / contraataque / free-ball / otro) */
  fase: FaseRallyFiltro;
  /** ¿Es el primer toque del equipo en el punto? */
  esPrimerToque: "cualquiera" | "si" | "no";
  /** Mínimo de toques del equipo en el punto hasta esta acción */
  toquesMinimo: number | null;
  /** Cómo empezó el punto (ace propio/rival, recepción pos/neg, etc.) */
  inicioPunto: InicioPunto | "cualquiera";
}

export type UbicacionFiltro = "cualquiera" | UbicacionJugador;

export interface MarcadorFiltro {
  estado: EstadoMarcador | "cualquiera";
  diferencia: DiferenciaMarcador | "cualquiera";
  soloCriticos: boolean;
}

export type VsPromedioFiltro = "por_encima" | "por_debajo" | null;

// Comparador extendido: agregamos "mismoRolTrigger"
export interface CoincidenciaFiltro {
  mismoJugadorTrigger: boolean;
  mismaZonaTriggerDestino: boolean;
  mismaZonaTriggerOrigen: boolean;
  mismaZonaAnteriorOrigen: boolean;
  mismaZonaAnteriorDestino: boolean;
  mismaVelocidadAnterior: boolean;
  mismoTipoSaqueAnterior: boolean;
  mismoReceptorAnterior: boolean;
  /** NUEVO: mismo rol_jugador que el trigger */
  mismoRolTrigger: boolean;
}

// ------------------------------------------------------------
// FILTROS TÁCTICOS COMPLETOS
// ------------------------------------------------------------

export interface FiltrosTacticos {
  // Existentes
  contextoPrevio: ContextoFiltro | null;
  contextoPosterior: ContextoFiltro | null;
  repeticion: RepeticionFiltro | null;

  // Nuevos
  rally: RallyFiltro | null;
  ubicacion: UbicacionFiltro;
  marcador: MarcadorFiltro | null;
  vsPromedio: VsPromedioFiltro;
  rachaMinima: number | null;

  // Meta
  presetActivoId: string | null;
}

export const FILTROS_TACTICOS_VACIO: FiltrosTacticos = {
  contextoPrevio: null,
  contextoPosterior: null,
  repeticion: null,
  rally: null,
  ubicacion: "cualquiera",
  marcador: null,
  vsPromedio: null,
  rachaMinima: null,
  presetActivoId: null,
};

// ------------------------------------------------------------
// HELPERS BASE
// ------------------------------------------------------------

function baseSubtipo(a: AccionVisual): string {
  const s =
    a.subtipo !== null && a.subtipo !== undefined
      ? String(a.subtipo)
      : "";
  return s.startsWith("toque:") ? s.slice(6) : s;
}

// ------------------------------------------------------------
// PUNTAJE DE ACCIÓN (para "vs promedio")
// ------------------------------------------------------------
// Mapeo directo al sistema de puntajes de estadisticas.ts, pero
// con los valores NUEVOS de recepción (7 valores).

function puntajeDeAccion(a: AccionVisual): number | null {
  const sub = baseSubtipo(a);

  if (a.tipo === "saque") {
    switch (sub) {
      case "ace": return 10;
      case "positivo_mas": return 8;
      case "positivo": return 6;
      case "neutro": return 5;
      case "negativo": return 2;
      default: return null;
    }
  }

  if (a.tipo === "recepcion") {
    switch (sub) {
      case "perfecta": return 10;
      case "positiva": return 8;
      case "intermedia": return 5;
      case "negativa": return 4;
      case "doble_negativa": return 2;
      case "overpass": return 1;
      case "error_directo": return 0;
      default: return null;
    }
  }

  if (a.tipo === "armado") {
    if (sub === "R") return 5;
    const n = parseInt(sub, 10);
    if (isNaN(n)) return null;
    switch (n) {
      case 6: return 10;
      case 5: return 8;
      case 4: return 6;
      case 3: return 3;
      case 2: return 1;
      case 1: return 0;
      default: return null;
    }
  }

  if (a.tipo === "ataque") {
    switch (sub) {
      case "punto":
      case "punto_directo_ataque":
      case "punto_desviado_ataque":
      case "use_rival_ataque":
        return 10;
      case "neutro":
      case "neutro_bloqueo_cobertura_ataque":
      case "neutro_desvio_bloqueo_defensa_ataque":
      case "neutro_defensa_ataque":
        return 2;
      case "error":
      case "error_red_ataque":
      case "error_afuera_ataque":
      case "gorro_ataque":
        return 0;
      default: return null;
    }
  }

  if (a.tipo === "bloqueo") {
    switch (sub) {
      case "punto": return 10;
      case "positivo_mas": return 8;
      case "positivo": return 6;
      case "neutro": return 5;
      case "use_rival": return 3;
      case "filtrada": return 2;
      case "red": return 0;
      default: return null;
    }
  }

  if (a.tipo === "defensa") {
    switch (sub) {
      case "gran_def":
      case "toque_positiva":
      case "cobertura_positiva":
        return 10;
      case "neutro": return 5;
      case "toque_negativa":
      case "error_def":
      case "cobertura_negativa":
      case "errores_graves":
        return 0;
      case "mala_libre": return -2;
      default: return null;
    }
  }

  return null;
}

/** Devuelve el fundamento normalizado (armado → armados). */
function fundamentoDeAccion(a: AccionVisual): string {
  return a.tipo === "armado" ? "armados" : a.tipo;
}

// ------------------------------------------------------------
// HELPERS DE MATCH (contexto previo/posterior)
// ------------------------------------------------------------

function matchContexto(
  otra: AccionVisual | null,
  filtro: ContextoFiltro,
  actual: AccionVisual
): boolean {
  if (!otra) return false;

  if (filtro.tipo !== "cualquiera" && otra.tipo !== filtro.tipo) {
    return false;
  }

  if (filtro.resultado !== "cualquiera") {
    if (baseSubtipo(otra) !== filtro.resultado) return false;
  }

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

function matchCoincidencia(
  otra: AccionVisual | null,
  c: CoincidenciaFiltro,
  actual: AccionVisual
): boolean {
  if (!otra) return false;
  if (c.mismoJugadorTrigger && otra.jugador_id !== actual.jugador_id) return false;
  if (
    c.mismoRolTrigger &&
    otra.rol_jugador !== actual.rol_jugador
  ) return false;
  if (
    c.mismaZonaTriggerDestino &&
    otra.zona_destino !== actual.zona_destino
  ) return false;
  if (
    c.mismaZonaTriggerOrigen &&
    otra.zona_origen !== actual.zona_origen
  ) return false;
  return true;
}

// ------------------------------------------------------------
// HAY FILTROS ACTIVOS
// ------------------------------------------------------------

export function hayFiltrosTacticos(f: FiltrosTacticos): boolean {
  return !!(
    f.contextoPrevio ||
    f.contextoPosterior ||
    f.repeticion ||
    f.rally ||
    f.ubicacion !== "cualquiera" ||
    f.marcador ||
    f.vsPromedio ||
    f.rachaMinima !== null
  );
}

export function hayComparadoresActivos(c: CoincidenciaFiltro): boolean {
  return Object.values(c).some(Boolean);
}

// ------------------------------------------------------------
// FILTRO DE RALLY
// ------------------------------------------------------------

function matchRally(
  ctx: ContextoRally | undefined,
  filtro: RallyFiltro
): boolean {
  if (!ctx) return false;

  if (filtro.fase !== "cualquiera" && ctx.fase !== filtro.fase) {
    return false;
  }

  if (filtro.esPrimerToque !== "cualquiera") {
    const esperado = filtro.esPrimerToque === "si";
    if (ctx.esPrimerToqueDelEquipo !== esperado) return false;
  }

  if (
    filtro.toquesMinimo !== null &&
    ctx.toquesDelEquipoEnPunto < filtro.toquesMinimo
  ) {
    return false;
  }

  if (
    filtro.inicioPunto !== "cualquiera" &&
    ctx.inicioPunto !== filtro.inicioPunto
  ) {
    return false;
  }

  return true;
}

// ------------------------------------------------------------
// FILTRO DE MARCADOR
// ------------------------------------------------------------

function matchMarcador(
  ctx: ContextoRally | undefined,
  filtro: MarcadorFiltro
): boolean {
  if (!ctx) return false;

  if (
    filtro.estado !== "cualquiera" &&
    ctx.estadoMarcador !== filtro.estado
  ) {
    return false;
  }

  if (
    filtro.diferencia !== "cualquiera" &&
    ctx.diferencia !== filtro.diferencia
  ) {
    return false;
  }

  if (filtro.soloCriticos && !ctx.esPuntoCritico) {
    return false;
  }

  return true;
}

// ------------------------------------------------------------
// FILTRO DE RACHA
// ------------------------------------------------------------

function matchRacha(
  ctx: ContextoRally | undefined,
  rachaMinima: number
): boolean {
  if (!ctx) return false;
  return (
    ctx.rachaGanadosActual >= rachaMinima ||
    ctx.rachaPerdidosActual >= rachaMinima
  );
}

// ------------------------------------------------------------
// FILTRO VS PROMEDIO
// ------------------------------------------------------------

/**
 * Calcula el promedio de puntaje por fundamento y marca cada acción
 * como por encima / por debajo.
 *
 * Devuelve un Set con los IDs que pasan el filtro.
 */
function calcularVsPromedio(
  acciones: AccionVisual[],
  modo: "por_encima" | "por_debajo"
): Set<string> {
  // Agrupar puntajes por fundamento.
  const puntajesPorFund = new Map<string, number[]>();
  const puntajePorAccion = new Map<string, number>();

  for (const a of acciones) {
    const p = puntajeDeAccion(a);
    if (p === null) continue;
    const fund = fundamentoDeAccion(a);
    let arr = puntajesPorFund.get(fund);
    if (!arr) {
      arr = [];
      puntajesPorFund.set(fund, arr);
    }
    arr.push(p);
    puntajePorAccion.set(a.id, p);
  }

  // Calcular promedio por fundamento.
  const promedioPorFund = new Map<string, number>();
  for (const [fund, arr] of puntajesPorFund) {
    const suma = arr.reduce((s, v) => s + v, 0);
    promedioPorFund.set(fund, suma / arr.length);
  }

  // Marcar IDs que pasan.
  const out = new Set<string>();
  for (const a of acciones) {
    const p = puntajePorAccion.get(a.id);
    if (p === undefined) continue;
    const fund = fundamentoDeAccion(a);
    const prom = promedioPorFund.get(fund);
    if (prom === undefined) continue;

    if (modo === "por_encima" && p > prom) out.add(a.id);
    else if (modo === "por_debajo" && p < prom) out.add(a.id);
  }

  return out;
}

// ------------------------------------------------------------
// APLICAR FILTROS TÁCTICOS
// ------------------------------------------------------------

/**
 * Aplica TODOS los filtros tácticos sobre `acciones`.
 *
 * @param acciones         Subset a filtrar (ya pasó por otros filtros)
 * @param todasLasAcciones Universo completo del partido (necesario para
 *                         rally, marcador, racha, contexto previo/posterior)
 * @param filtros          Configuración
 * @param jugadorFiltradoId Para "repeticion.porJugador === 'mismo'"
 */
export function aplicarFiltrosTacticos(
  acciones: AccionVisual[],
  todasLasAcciones: AccionVisual[],
  filtros: FiltrosTacticos,
  jugadorFiltradoId: string | null
): AccionVisual[] {
  if (!hayFiltrosTacticos(filtros)) return acciones;

  // 1. Contexto rally (calculado sobre el universo completo).
  const contexto = calcularContextoRally(todasLasAcciones);

  // 2. Precalcular vsPromedio (sobre el universo completo para que el
  //    promedio sea representativo del equipo, no del subset).
  const idsVsPromedio =
    filtros.vsPromedio !== null
      ? calcularVsPromedio(todasLasAcciones, filtros.vsPromedio)
      : null;

  // 3. Agrupar universo por punto, ordenado por `orden`.
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

  // 4. Precalcular puntos que pasan el filtro de repetición.
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

  // 5. Filtrar cada acción.
  const resultado: AccionVisual[] = [];
  for (const a of acciones) {
    if (a.oculta) continue;
    const k = `${a.set_numero}-${a.punto_numero}`;

    // Repetición
    if (filtros.repeticion && !puntosOkRepeticion.has(k)) continue;

    // Rally
    if (filtros.rally) {
      if (!matchRally(contexto.get(a.id), filtros.rally)) continue;
    }

    // Ubicación
    if (filtros.ubicacion !== "cualquiera") {
      const ctx = contexto.get(a.id);
      if (!ctx || ctx.ubicacion !== filtros.ubicacion) continue;
    }

    // Marcador
    if (filtros.marcador) {
      if (!matchMarcador(contexto.get(a.id), filtros.marcador)) continue;
    }

    // Racha
    if (filtros.rachaMinima !== null) {
      if (!matchRacha(contexto.get(a.id), filtros.rachaMinima)) continue;
    }

    // Vs promedio
    if (idsVsPromedio && !idsVsPromedio.has(a.id)) continue;

    // Contexto previo / posterior (igual que antes)
    const lista = porPunto.get(k) ?? [];
    const idx = lista.findIndex((x) => x.id === a.id);

    if (filtros.contextoPrevio) {
      const prev = idx > 0 ? lista[idx - 1] : null;
      if (!matchContexto(prev, filtros.contextoPrevio, a)) continue;
    }

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