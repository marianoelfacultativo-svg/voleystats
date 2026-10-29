// ============================================================
// ANÁLISIS DE CONSECUENCIAS — motor puro
// ============================================================
// "Si pasa X en la situación S, ¿cómo se comporta el jugador
// y qué pasa después?"
//
// Cubre DOS análisis complementarios sobre el mismo conjunto
// de acciones disparadoras (triggers):
//
//   1. COMPORTAMIENTO DEL TRIGGER
//      Distribución del propio trigger: subtipo, zona destino,
//      velocidad, jugador, set. Responde "¿cómo actúa?".
//
//   2. CONSECUENCIA
//      Qué pasa después del trigger: siguiente acción, resultado
//      predominante, subtipos, distancia en toques y puntos.
//      Responde "¿qué genera?".
//
// FILTROS DEL TRIGGER
// -------------------
// Un trigger se acepta si cumple TODAS estas condiciones (AND):
//   a. disparador: { tipo, resultado } + jugadorId opcional.
//   b. rachas[]: cada racha mira hacia atrás desde el trigger y
//      exige que las últimas N acciones (del tipo filtrado que
//      caen en el ámbito) cumplan un filtro. `desdeAtras` permite
//      saltear las más recientes (caso "perfecta después de 3 malas").
//   c. contextoPartido: estado del partido/rally al momento del
//      trigger (marcador, fase, inicio del punto, racha de puntos,
//      ubicación del jugador, primer toque, toques mínimos).
//
// La lógica de contexto rally vive en `lib/contextoRally.ts`.
// ============================================================

import type { AccionVisual } from "../app/equipo/adaptadorUnificadoV2";
import {
  calcularContextoRally,
  type ContextoRally,
  type FaseRally,
  type InicioPunto,
  type EstadoMarcador,
  type DiferenciaMarcador,
} from "./contextoRally";

// ------------------------------------------------------------
// TIPOS BASE
// ------------------------------------------------------------

export type TipoDisparador =
  | "saque"
  | "recepcion"
  | "armado"
  | "ataque"
  | "bloqueo"
  | "defensa"
  | "libre"
  | "roce-red";

export interface DisparadorFiltro {
  tipo: TipoDisparador;
  /** "cualquiera" = cualquier resultado. */
  resultado: string | "cualquiera";
}

export type Ventana = 1 | 2 | 3 | "todas";

export type CategoriaResultado = "punto" | "error" | "neutro";

export type UbicacionFiltro =
  | "cualquiera"
  | "delantero"
  | "zaguero"
  | "libero"
  | "otro";

export type RelacionJugador =
  | "cualquiera"
  | "mismo"
  | "companero"
  | "rival";

export type AmbitoRacha = "mismo_punto" | "puntos_del_set" | "partido";

export type CierraPuntoFiltro = "cualquiera" | "si" | "no";

// ------------------------------------------------------------
// FILTRO DE UNA ACCIÓN HISTÓRICA (para rachas)
// ------------------------------------------------------------
// Cada racha tiene un filtro que define qué acciones cuentan para
// esa racha. Los campos que quedan en "vacío" no restringen.

export interface FiltroAccionHistorica {
  /** Tipos de acción que cuentan. Vacío = cualquiera. */
  tipos: TipoDisparador[];
  /** Resultados/subtipos que cuentan. Vacío = cualquiera. */
  resultados: string[];
  /** ¿Tiene que ser la última acción del punto? */
  cierraPunto: CierraPuntoFiltro;
  /** Ubicación del jugador que ejecutó la acción. */
  ubicacion: UbicacionFiltro;
  /** Zona exacta (1-6) del jugador. */
  zonaJugador: number | "cualquiera";
  /** Velocidad de armado. Solo aplica a armado. */
  velocidad: number | null;
  /** Tipo de saque. Solo aplica a saque. */
  tipoSaque: "potencia" | "flotado" | null;
  /** Relación del jugador con el trigger. */
  relacionJugador: RelacionJugador;
}

export const FILTRO_ACCION_HISTORICA_VACIO: FiltroAccionHistorica = {
  tipos: [],
  resultados: [],
  cierraPunto: "cualquiera",
  ubicacion: "cualquiera",
  zonaJugador: "cualquiera",
  velocidad: null,
  tipoSaque: null,
  relacionJugador: "cualquiera",
};

// ------------------------------------------------------------
// RACHA HISTÓRICA
// ------------------------------------------------------------

export interface RachaHistorica {
  /** ID estable para React (no se usa en el motor). */
  id: string;
  /** Ámbito de la racha. */
  ambito: AmbitoRacha;
  /**
   * Cuántas de las acciones más recientes del `filtro.tipos` se
   * saltean antes de empezar a contar. 0 = empezar desde la más
   * reciente. Sirve para el caso "perfecta después de 3 malas":
   *   racha 1 = { tipos: [recepcion], resultados: [perfecta], desdeAtras: 0, minimo: 1 }
   *   racha 2 = { tipos: [recepcion], resultados: [malas...], desdeAtras: 1, minimo: 3 }
   */
  desdeAtras: number;
  /** Cuántas acciones consecutivas tienen que cumplir el filtro. */
  minimo: number;
  /** Filtro de cada acción. */
  filtro: FiltroAccionHistorica;
}

// ------------------------------------------------------------
// CONTEXTO DEL PARTIDO
// ------------------------------------------------------------
// Filtros sobre el estado del partido/rally al momento del trigger.

export interface MarcadorFiltro {
  estado: "cualquiera" | EstadoMarcador;
  diferencia: "cualquiera" | DiferenciaMarcador;
  soloCriticos: boolean;
  /** Puntos máximos que faltan para cerrar el set. */
  puntosParaCerrar: "cualquiera" | "<=1" | "<=3" | "<=5";
}

export interface ContextoPartidoFiltro {
  marcador: MarcadorFiltro;
  faseRally: "cualquiera" | FaseRally;
  inicioPunto: "cualquiera" | InicioPunto;
  /** Racha mínima de puntos (ganados o perdidos consecutivos). */
  rachaPuntos: number | null;
  /** Ubicación del jugador que ejecutó el trigger. */
  ubicacionTrigger: UbicacionFiltro;
  /** ¿Es el primer toque del equipo en el punto? */
  esPrimerToque: "cualquiera" | "si" | "no";
  /** Toques mínimos del equipo en el punto hasta el trigger. */
  toquesMinimo: number | null;
}

export const CONTEXTO_PARTIDO_VACIO: ContextoPartidoFiltro = {
  marcador: {
    estado: "cualquiera",
    diferencia: "cualquiera",
    soloCriticos: false,
    puntosParaCerrar: "cualquiera",
  },
  faseRally: "cualquiera",
  inicioPunto: "cualquiera",
  rachaPuntos: null,
  ubicacionTrigger: "cualquiera",
  esPrimerToque: "cualquiera",
  toquesMinimo: null,
};

// ------------------------------------------------------------
// COINCIDENCIA (comparadores de la acción observada)
// ------------------------------------------------------------

export interface CoincidenciaFiltro {
  mismoJugadorTrigger: boolean;
  mismaZonaTriggerDestino: boolean;
  mismaZonaTriggerOrigen: boolean;
  mismaZonaAnteriorOrigen: boolean;
  mismaZonaAnteriorDestino: boolean;
  mismaVelocidadAnterior: boolean;
  mismoTipoSaqueAnterior: boolean;
  mismoReceptorAnterior: boolean;
}

export const COINCIDENCIA_VACIA: CoincidenciaFiltro = {
  mismoJugadorTrigger: false,
  mismaZonaTriggerDestino: false,
  mismaZonaTriggerOrigen: false,
  mismaZonaAnteriorOrigen: false,
  mismaZonaAnteriorDestino: false,
  mismaVelocidadAnterior: false,
  mismoTipoSaqueAnterior: false,
  mismoReceptorAnterior: false,
};

// ------------------------------------------------------------
// FILTROS COMPLETOS DEL ANÁLISIS
// ------------------------------------------------------------

export interface FiltrosAnalisis {
  // ---------- Disparador ----------
  disparador: DisparadorFiltro | null;
  jugadorId?: string | null;

  // ---------- Historia previa ----------
  rachas: RachaHistorica[];

  // ---------- Contexto del partido ----------
  contextoPartido?: ContextoPartidoFiltro | null;

  // ---------- Acción observada (consecuencia) ----------
  tipoObservado?: TipoDisparador | "cualquiera";
  jugadorObservadoId?: string | null;
  alcance?: "partido" | "mismo_punto";
  ventana: Ventana;

  // ---------- Comparadores opcionales ----------
  coincidencias: CoincidenciaFiltro;
}

export const FILTROS_ANALISIS_VACIO: FiltrosAnalisis = {
  disparador: null,
  jugadorId: null,
  rachas: [],
  contextoPartido: null,
  tipoObservado: "cualquiera",
  jugadorObservadoId: null,
  alcance: "partido",
  ventana: 1,
  coincidencias: { ...COINCIDENCIA_VACIA },
};

// ------------------------------------------------------------
// RESULTADOS
// ------------------------------------------------------------

export interface DetalleAccionObservada {
  accion: AccionVisual;
  distanciaAcciones: number;
  distanciaPuntos: number;
  esMismoPunto: boolean;
  categoriaResultado: CategoriaResultado;
  subtipo: string;
}

export interface OcurrenciaTrigger {
  set_numero: number;
  punto_numero: number;
  triggerId: string;
  triggerJugadorId: string | null;
  triggerSubtipo: string | null;
  anteriorId: string | null;
  anteriorJugadorId: string | null;
  anteriorSubtipo: string | null;
  siguientes: AccionVisual[];
  accionObservada?: DetalleAccionObservada | null;
}

export interface CoincidenciasResumen {
  mismoJugadorTrigger: number;
  mismaZonaTriggerDestino: number;
  mismaZonaTriggerOrigen: number;
  mismaZonaAnteriorOrigen: number;
  mismaZonaAnteriorDestino: number;
  mismaVelocidadAnterior: number;
  mismoTipoSaqueAnterior: number;
  mismoReceptorAnterior: number;
}

export interface ResumenPorTipo {
  tipo: string;
  count: number;
  coincidencias: CoincidenciasResumen;
}

export interface EvaluacionResultado {
  masFrecuente: CategoriaResultado;
  puntos: number;
  errores: number;
  neutros: number;
  total: number;
  pctPuntos: number;
  pctErrores: number;
  pctNeutros: number;
  efectividadNeta: number;
}

export interface EstadisticasObservadas {
  tipoObservado: TipoDisparador | "cualquiera";
  totalEncontradas: number;
  promedioAccionesDistancia: number;
  promedioPuntosDistancia: number;
  pctMismoPunto: number;
  pctPuntosPosteriores: number;
  evaluacionResultado: EvaluacionResultado;
  subtiposRanking: { subtipo: string; count: number; pct: number }[];
  subtipoMasFrecuente: string | null;
  jugadoresRanking: { jugadorId: string; count: number; pct: number }[];
  jugadorMasFrecuenteId: string | null;
  zonasRanking: { zona: number; count: number; pct: number }[];
  zonaMasFrecuente: number | null;
}

// ------------------------------------------------------------
// COMPORTAMIENTO DEL TRIGGER
// ------------------------------------------------------------

export interface ComportamientoTrigger {
  totalTriggers: number;
  porSubtipo: { subtipo: string; count: number; pct: number }[];
  porZonaDestino: { zona: number | null; count: number; pct: number }[];
  porVelocidad: { velocidad: number | null; count: number; pct: number }[];
  porJugador: { jugadorId: string; count: number; pct: number }[];
  porSet: { set: number; count: number; pct: number }[];
}

export interface ResultadoAnalisis {
  totalOcurrencias: number;
  ocurrencias: OcurrenciaTrigger[];
  distribucionSiguiente: Record<string, number>;
  distribucionSubtipo: Record<string, number>;
  resumenPorTipo: ResumenPorTipo[];
  coincidenciasGlobales: CoincidenciasResumen;
  estadisticasObservadas?: EstadisticasObservadas;
  comportamientoTrigger?: ComportamientoTrigger;
}

// ------------------------------------------------------------
// CLASIFICACIÓN DE RESULTADOS (Punto / Error / Neutro)
// ------------------------------------------------------------

export function clasificarResultado(a: AccionVisual): CategoriaResultado {
  const sub = baseSubtipo(a).toLowerCase();
  const tipo = a.tipo;

  if (a.es_error) return "error";

  if (tipo === "ataque") {
    if (sub === "punto") return "punto";
    if (
      sub.includes("error") ||
      sub.includes("gorro") ||
      sub === "use_rival_ataque" ||
      sub === "error_red_ataque" ||
      sub === "error_afuera_ataque"
    )
      return "error";
    return "neutro";
  }

  if (tipo === "saque") {
    if (sub === "ace") return "punto";
    if (sub === "negativo" || sub.includes("error")) return "error";
    return "neutro";
  }

  if (tipo === "bloqueo") {
    if (sub === "punto") return "punto";
    if (sub === "red" || sub === "use_rival") return "error";
    return "neutro";
  }

  if (tipo === "recepcion") {
    if (sub === "ace_contra" || sub === "error_directo") return "error";
    if (sub === "perfecta" || sub === "2x_positiva" || sub === "positiva")
      return "punto";
    return "neutro";
  }

  if (tipo === "defensa") {
    if (
      sub === "error_def" ||
      sub === "errores_graves" ||
      sub === "mala_libre"
    )
      return "error";
    if (
      sub === "gran_def" ||
      sub === "toque_positiva" ||
      sub === "cobertura_positiva"
    )
      return "punto";
    return "neutro";
  }

  if (sub.includes("punto") || sub === "ace") return "punto";
  if (sub.includes("error") || sub === "horrible" || sub === "malo")
    return "error";
  return "neutro";
}

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

export function baseSubtipo(a: AccionVisual): string {
  const s =
    a.subtipo !== null && a.subtipo !== undefined ? String(a.subtipo) : "";
  return s.startsWith("toque:") ? s.slice(6) : s;
}

function ubicacionDeZona(zona: number | null): UbicacionFiltro {
  if (zona === null || zona === undefined) return "otro";
  if (zona === 1 || zona === 5 || zona === 6) return "zaguero";
  if (zona === 2 || zona === 3 || zona === 4) return "delantero";
  return "otro";
}

function cumpleFiltroAccion(
  a: AccionVisual,
  trigger: AccionVisual,
  f: FiltroAccionHistorica
): boolean {
  if (f.tipos.length > 0) {
    if (!f.tipos.includes(a.tipo as TipoDisparador)) return false;
  }
  if (f.resultados.length > 0) {
    const sub = baseSubtipo(a);
    if (!f.resultados.includes(sub)) return false;
  }
  if (f.cierraPunto !== "cualquiera") {
    const cierra = !!a.es_ultima_del_punto;
    if (f.cierraPunto === "si" && !cierra) return false;
    if (f.cierraPunto === "no" && cierra) return false;
  }
  if (f.ubicacion !== "cualquiera") {
    const ubi = ubicacionDeZona(a.zona_jugador);
    if (ubi !== f.ubicacion) return false;
  }
  if (f.zonaJugador !== "cualquiera") {
    if (a.zona_jugador !== f.zonaJugador) return false;
  }
  if (f.velocidad !== null) {
    if (a.velocidad !== f.velocidad) return false;
  }
  if (f.tipoSaque !== null) {
    if (a.tipo_saque !== f.tipoSaque) return false;
  }
  if (f.relacionJugador !== "cualquiera") {
    const mismoJugador = a.jugador_id === trigger.jugador_id;
    const mismoEquipo = a.es_rival === trigger.es_rival;
    if (f.relacionJugador === "mismo" && !mismoJugador) return false;
    if (f.relacionJugador === "companero" && (mismoJugador || !mismoEquipo))
      return false;
    if (f.relacionJugador === "rival" && mismoEquipo) return false;
  }
  return true;
}

/**
 * Verifica si el trigger cumple una racha histórica.
 *
 * 1. Miramos hacia atrás desde el trigger dentro del ámbito.
 * 2. Filtramos las acciones cuyo `tipo` matchea `filtro.tipos`
 *    (vacío = cualquier tipo).
 * 3. Salteamos las primeras `desdeAtras` de esas (las más recientes).
 * 4. Tomamos las siguientes `minimo`.
 * 5. Verificamos que TODAS cumplan el resto del filtro.
 */
function verificarRacha(
  accionesCronologicas: AccionVisual[],
  triggerIdxGlobal: number,
  trigger: AccionVisual,
  racha: RachaHistorica
): boolean {
  if (racha.minimo <= 0) return true;

  const candidatas: AccionVisual[] = [];
  let salteadas = 0;

  for (let k = triggerIdxGlobal - 1; k >= 0; k--) {
    const cand = accionesCronologicas[k];
    if (cand.oculta) continue;

    // Ámbito
    if (racha.ambito === "mismo_punto") {
      if (
        cand.set_numero !== trigger.set_numero ||
        cand.punto_numero !== trigger.punto_numero ||
        cand.partido_id !== trigger.partido_id
      )
        break;
    } else if (racha.ambito === "puntos_del_set") {
      if (
        cand.set_numero !== trigger.set_numero ||
        cand.partido_id !== trigger.partido_id
      )
        break;
    } else if (racha.ambito === "partido") {
      if (cand.partido_id !== trigger.partido_id) break;
    }

    // Tipo
    if (racha.filtro.tipos.length > 0) {
      if (!racha.filtro.tipos.includes(cand.tipo as TipoDisparador)) {
        continue;
      }
    }

    // Saltar
    if (salteadas < racha.desdeAtras) {
      salteadas++;
      continue;
    }

    candidatas.push(cand);
    if (candidatas.length >= racha.minimo) break;
  }

  if (candidatas.length < racha.minimo) return false;

  for (const cand of candidatas) {
    if (!cumpleFiltroAccion(cand, trigger, racha.filtro)) return false;
  }

  return true;
}

// ------------------------------------------------------------
// CONTEXTO DEL PARTIDO
// ------------------------------------------------------------

export function hayContextoPartidoActivo(
  ctx: ContextoPartidoFiltro | null | undefined
): boolean {
  if (!ctx) return false;
  if (ctx.marcador.estado !== "cualquiera") return true;
  if (ctx.marcador.diferencia !== "cualquiera") return true;
  if (ctx.marcador.soloCriticos) return true;
  if (ctx.marcador.puntosParaCerrar !== "cualquiera") return true;
  if (ctx.faseRally !== "cualquiera") return true;
  if (ctx.inicioPunto !== "cualquiera") return true;
  if (ctx.rachaPuntos !== null) return true;
  if (ctx.ubicacionTrigger !== "cualquiera") return true;
  if (ctx.esPrimerToque !== "cualquiera") return true;
  if (ctx.toquesMinimo !== null) return true;
  return false;
}

function cumpleContextoPartido(
  ctx: ContextoRally | undefined,
  filtro: ContextoPartidoFiltro
): boolean {
  if (!ctx) return false;

  // Marcador · estado
  if (
    filtro.marcador.estado !== "cualquiera" &&
    ctx.estadoMarcador !== filtro.marcador.estado
  )
    return false;

  // Marcador · diferencia
  if (
    filtro.marcador.diferencia !== "cualquiera" &&
    ctx.diferencia !== filtro.marcador.diferencia
  )
    return false;

  // Marcador · solo críticos
  if (filtro.marcador.soloCriticos && !ctx.esPuntoCritico) return false;

  // Marcador · puntos para cerrar
  if (filtro.marcador.puntosParaCerrar !== "cualquiera") {
    const maxPts = Math.max(ctx.puntosPropios, ctx.puntosRivales);
    const ptsCerrar = Math.max(0, 25 - maxPts);
    const max = parseInt(
      filtro.marcador.puntosParaCerrar.replace("<=", "").trim(),
      10
    );
    if (ptsCerrar > max) return false;
  }

  // Rally · fase
  if (filtro.faseRally !== "cualquiera" && ctx.fase !== filtro.faseRally) {
    return false;
  }

  // Rally · inicio del punto
  if (
    filtro.inicioPunto !== "cualquiera" &&
    ctx.inicioPunto !== filtro.inicioPunto
  ) {
    return false;
  }

  // Rally · primer toque del equipo
  if (filtro.esPrimerToque !== "cualquiera") {
    const esperado = filtro.esPrimerToque === "si";
    if (ctx.esPrimerToqueDelEquipo !== esperado) return false;
  }

  // Rally · toques mínimo
  if (filtro.toquesMinimo !== null) {
    if (ctx.toquesDelEquipoEnPunto < filtro.toquesMinimo) return false;
  }

  // Racha de puntos
  if (filtro.rachaPuntos !== null) {
    if (
      ctx.rachaGanadosActual < filtro.rachaPuntos &&
      ctx.rachaPerdidosActual < filtro.rachaPuntos
    ) {
      return false;
    }
  }

  // Ubicación del trigger
  if (
    filtro.ubicacionTrigger !== "cualquiera" &&
    ctx.ubicacion !== filtro.ubicacionTrigger
  ) {
    return false;
  }

  return true;
}

// ------------------------------------------------------------
// COINCIDENCIAS (comparadores)
// ------------------------------------------------------------

function coincide(
  a: AccionVisual,
  filtro: CoincidenciaFiltro,
  ref: { trigger: AccionVisual; anterior: AccionVisual | null }
): CoincidenciasResumen {
  const { trigger, anterior } = ref;

  return {
    mismoJugadorTrigger:
      !!filtro.mismoJugadorTrigger &&
      a.jugador_id !== null &&
      a.jugador_id === trigger.jugador_id
        ? 1
        : 0,
    mismaZonaTriggerDestino:
      !!filtro.mismaZonaTriggerDestino &&
      a.zona_destino !== null &&
      a.zona_destino === trigger.zona_destino
        ? 1
        : 0,
    mismaZonaTriggerOrigen:
      !!filtro.mismaZonaTriggerOrigen &&
      a.zona_origen !== null &&
      a.zona_origen === trigger.zona_origen
        ? 1
        : 0,
    mismaZonaAnteriorOrigen:
      !!filtro.mismaZonaAnteriorOrigen &&
      !!anterior &&
      a.zona_origen !== null &&
      a.zona_origen === anterior.zona_origen
        ? 1
        : 0,
    mismaZonaAnteriorDestino:
      !!filtro.mismaZonaAnteriorDestino &&
      !!anterior &&
      a.zona_destino !== null &&
      a.zona_destino === anterior.zona_destino
        ? 1
        : 0,
    mismaVelocidadAnterior:
      !!filtro.mismaVelocidadAnterior &&
      !!anterior &&
      a.velocidad !== null &&
      anterior.velocidad !== null &&
      a.velocidad === anterior.velocidad
        ? 1
        : 0,
    mismoTipoSaqueAnterior:
      !!filtro.mismoTipoSaqueAnterior &&
      !!anterior &&
      a.tipo_saque !== null &&
      anterior.tipo_saque !== null &&
      a.tipo_saque === anterior.tipo_saque
        ? 1
        : 0,
    mismoReceptorAnterior:
      !!filtro.mismoReceptorAnterior &&
      !!anterior &&
      a.jugador_id !== null &&
      a.jugador_id === anterior.jugador_id
        ? 1
        : 0,
  };
}

function sumarCoincidencias(
  a: CoincidenciasResumen,
  b: CoincidenciasResumen
): CoincidenciasResumen {
  return {
    mismoJugadorTrigger: a.mismoJugadorTrigger + b.mismoJugadorTrigger,
    mismaZonaTriggerDestino:
      a.mismaZonaTriggerDestino + b.mismaZonaTriggerDestino,
    mismaZonaTriggerOrigen:
      a.mismaZonaTriggerOrigen + b.mismaZonaTriggerOrigen,
    mismaZonaAnteriorOrigen:
      a.mismaZonaAnteriorOrigen + b.mismaZonaAnteriorOrigen,
    mismaZonaAnteriorDestino:
      a.mismaZonaAnteriorDestino + b.mismaZonaAnteriorDestino,
    mismaVelocidadAnterior:
      a.mismaVelocidadAnterior + b.mismaVelocidadAnterior,
    mismoTipoSaqueAnterior:
      a.mismoTipoSaqueAnterior + b.mismoTipoSaqueAnterior,
    mismoReceptorAnterior:
      a.mismoReceptorAnterior + b.mismoReceptorAnterior,
  };
}

export function coincidenciasVacias(): CoincidenciasResumen {
  return {
    mismoJugadorTrigger: 0,
    mismaZonaTriggerDestino: 0,
    mismaZonaTriggerOrigen: 0,
    mismaZonaAnteriorOrigen: 0,
    mismaZonaAnteriorDestino: 0,
    mismaVelocidadAnterior: 0,
    mismoTipoSaqueAnterior: 0,
    mismoReceptorAnterior: 0,
  };
}

export function hayComparadoresActivos(f: CoincidenciaFiltro): boolean {
  return Object.values(f).some(Boolean);
}

export function hayFiltroAnalisisActivo(f: FiltrosAnalisis): boolean {
  return f.disparador !== null;
}

// ------------------------------------------------------------
// COMPORTAMIENTO DEL TRIGGER
// ------------------------------------------------------------

function calcularComportamientoTrigger(
  triggers: AccionVisual[]
): ComportamientoTrigger {
  const total = triggers.length;
  const subtiposCount: Record<string, number> = {};
  const zonasCount: Record<string, number> = {};
  const velocidadesCount: Record<string, number> = {};
  const jugadoresCount: Record<string, number> = {};
  const setsCount: Record<string, number> = {};

  for (const a of triggers) {
    const sub = baseSubtipo(a) || "—";
    subtiposCount[sub] = (subtiposCount[sub] ?? 0) + 1;

    const zk =
      a.zona_destino !== null && a.zona_destino !== undefined
        ? String(a.zona_destino)
        : "null";
    zonasCount[zk] = (zonasCount[zk] ?? 0) + 1;

    const vk =
      a.velocidad !== null && a.velocidad !== undefined
        ? String(a.velocidad)
        : "null";
    velocidadesCount[vk] = (velocidadesCount[vk] ?? 0) + 1;

    if (a.jugador_id) {
      jugadoresCount[a.jugador_id] =
        (jugadoresCount[a.jugador_id] ?? 0) + 1;
    }

    setsCount[String(a.set_numero)] =
      (setsCount[String(a.set_numero)] ?? 0) + 1;
  }

  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  return {
    totalTriggers: total,
    porSubtipo: Object.entries(subtiposCount)
      .map(([subtipo, count]) => ({ subtipo, count, pct: pct(count) }))
      .sort((a, b) => b.count - a.count),
    porZonaDestino: Object.entries(zonasCount)
      .map(([k, count]) => ({
        zona: k === "null" ? null : Number(k),
        count,
        pct: pct(count),
      }))
      .sort((a, b) => b.count - a.count),
    porVelocidad: Object.entries(velocidadesCount)
      .map(([k, count]) => ({
        velocidad: k === "null" ? null : Number(k),
        count,
        pct: pct(count),
      }))
      .sort((a, b) => b.count - a.count),
    porJugador: Object.entries(jugadoresCount)
      .map(([jugadorId, count]) => ({ jugadorId, count, pct: pct(count) }))
      .sort((a, b) => b.count - a.count),
    porSet: Object.entries(setsCount)
      .map(([k, count]) => ({ set: Number(k), count, pct: pct(count) }))
      .sort((a, b) => a.set - b.set),
  };
}

// ------------------------------------------------------------
// MOTOR PRINCIPAL
// ------------------------------------------------------------

export function analizarConsecuencias(
  acciones: AccionVisual[],
  filtros: FiltrosAnalisis
): ResultadoAnalisis {
  const vacio: ResultadoAnalisis = {
    totalOcurrencias: 0,
    ocurrencias: [],
    distribucionSiguiente: {},
    distribucionSubtipo: {},
    resumenPorTipo: [],
    coincidenciasGlobales: coincidenciasVacias(),
  };

  if (!filtros.disparador) return vacio;

  const {
    disparador,
    ventana,
    coincidencias,
    tipoObservado = "cualquiera",
    alcance = "partido",
    jugadorObservadoId = null,
    rachas = [],
    contextoPartido = null,
  } = filtros;

  // 1. Ordenar y filtrar acciones ocultas.
  const accionesCronologicas = acciones
    .filter((a) => !a.oculta)
    .sort((x, y) => {
      if (x.partido_id !== y.partido_id)
        return (x.partido_id || "").localeCompare(y.partido_id || "");
      if (x.set_numero !== y.set_numero) return x.set_numero - y.set_numero;
      if (x.punto_numero !== y.punto_numero)
        return x.punto_numero - y.punto_numero;
      return x.orden - y.orden;
    });

  // 2. Índice global por id.
  const indiceGlobalPorId = new Map<string, number>();
  for (let i = 0; i < accionesCronologicas.length; i++) {
    indiceGlobalPorId.set(accionesCronologicas[i].id, i);
  }

  // 3. Agrupar por punto (partido|set|punto).
  const porPunto = new Map<string, AccionVisual[]>();
  for (const a of accionesCronologicas) {
    const k = `${a.partido_id || ""}|${a.set_numero}|${a.punto_numero}`;
    let lista = porPunto.get(k);
    if (!lista) {
      lista = [];
      porPunto.set(k, lista);
    }
    lista.push(a);
  }

  // 4. Contexto rally solo si hay filtros activos.
  const contextoRally = hayContextoPartidoActivo(contextoPartido)
    ? calcularContextoRally(accionesCronologicas)
    : null;

  // 5. Recolectar triggers que pasan TODAS las condiciones.
  const triggers: AccionVisual[] = [];
  for (let i = 0; i < accionesCronologicas.length; i++) {
    const a = accionesCronologicas[i];

    if (disparador.tipo !== a.tipo) continue;
    if (disparador.resultado !== "cualquiera") {
      if (baseSubtipo(a) !== disparador.resultado) continue;
    }
    if (filtros.jugadorId && a.jugador_id !== filtros.jugadorId) continue;

    // Rachas (AND)
    let pasaRachas = true;
    for (const racha of rachas) {
      if (!verificarRacha(accionesCronologicas, i, a, racha)) {
        pasaRachas = false;
        break;
      }
    }
    if (!pasaRachas) continue;

    // Contexto del partido
    if (contextoRally && contextoPartido) {
      if (!cumpleContextoPartido(contextoRally.get(a.id), contextoPartido))
        continue;
    }

    triggers.push(a);
  }

  // 6. Comportamiento del trigger.
  const comportamientoTrigger =
    triggers.length > 0 ? calcularComportamientoTrigger(triggers) : undefined;

  // 7. Análisis de consecuencias.
  const ocurrencias: OcurrenciaTrigger[] = [];
  const distribucionSiguiente: Record<string, number> = {};
  const distribucionSubtipo: Record<string, number> = {};
  const porTipoCoincidencias = new Map<string, CoincidenciasResumen>();
  let coincidenciasGlobales = coincidenciasVacias();

  const maxSiguientes =
    ventana === "todas" ? Number.POSITIVE_INFINITY : ventana;

  let sumDistanciaAcciones = 0;
  let sumDistanciaPuntos = 0;
  let countObservadas = 0;
  let countMismoPunto = 0;
  let countPuntos = 0;
  let countErrores = 0;
  let countNeutros = 0;
  const subtiposCount: Record<string, number> = {};
  const jugadoresCount: Record<string, number> = {};
  const zonasCount: Record<number, number> = {};

  for (const a of triggers) {
    const i = indiceGlobalPorId.get(a.id) ?? -1;
    if (i < 0) continue;

    const listaPunto =
      porPunto.get(`${a.partido_id || ""}|${a.set_numero}|${a.punto_numero}`) ??
      [];
    const idxEnPunto = listaPunto.findIndex((x) => x.id === a.id);
    const anterior = idxEnPunto > 0 ? listaPunto[idxEnPunto - 1] : null;

    const siguientes =
      idxEnPunto >= 0
        ? listaPunto.slice(idxEnPunto + 1, idxEnPunto + 1 + maxSiguientes)
        : [];

    // Buscar la acción observada específica.
    let accionObservada: DetalleAccionObservada | null = null;
    for (let j = i + 1; j < accionesCronologicas.length; j++) {
      const cand = accionesCronologicas[j];

      if (
        alcance === "mismo_punto" &&
        (cand.set_numero !== a.set_numero ||
          cand.punto_numero !== a.punto_numero ||
          cand.partido_id !== a.partido_id)
      )
        break;

      const coincideTipo =
        tipoObservado === "cualquiera" || cand.tipo === tipoObservado;
      if (!coincideTipo) continue;

      if (jugadorObservadoId && cand.jugador_id !== jugadorObservadoId)
        continue;

      if (coincidencias.mismoJugadorTrigger) {
        if (!a.jugador_id || cand.jugador_id !== a.jugador_id) continue;
      }
      if (
        coincidencias.mismaZonaTriggerDestino &&
        a.zona_destino !== null &&
        a.zona_destino !== undefined
      ) {
        if (cand.zona_destino !== a.zona_destino) continue;
      }
      if (
        coincidencias.mismaZonaTriggerOrigen &&
        a.zona_origen !== null &&
        a.zona_origen !== undefined
      ) {
        if (cand.zona_origen !== a.zona_origen) continue;
      }
      if (coincidencias.mismaVelocidadAnterior && a.velocidad) {
        if (cand.velocidad !== a.velocidad) continue;
      }

      const distanciaAcciones = j - i;
      let distanciaPuntos = 0;
      if (
        cand.partido_id === a.partido_id &&
        cand.set_numero === a.set_numero
      ) {
        distanciaPuntos = Math.max(0, cand.punto_numero - a.punto_numero);
      } else if (cand.partido_id === a.partido_id) {
        distanciaPuntos = Math.max(
          0,
          (cand.set_numero - a.set_numero) * 25 +
            cand.punto_numero -
            a.punto_numero
        );
      } else {
        distanciaPuntos = 999;
      }

      const esMismoPunto =
        cand.set_numero === a.set_numero &&
        cand.punto_numero === a.punto_numero &&
        cand.partido_id === a.partido_id;
      const categoriaResultado = clasificarResultado(cand);
      const sub = baseSubtipo(cand) || "—";

      accionObservada = {
        accion: cand,
        distanciaAcciones,
        distanciaPuntos,
        esMismoPunto,
        categoriaResultado,
        subtipo: sub,
      };

      countObservadas++;
      sumDistanciaAcciones += distanciaAcciones;
      sumDistanciaPuntos += distanciaPuntos;
      if (esMismoPunto) countMismoPunto++;

      if (categoriaResultado === "punto") countPuntos++;
      else if (categoriaResultado === "error") countErrores++;
      else countNeutros++;

      subtiposCount[sub] = (subtiposCount[sub] ?? 0) + 1;

      if (cand.jugador_id) {
        jugadoresCount[cand.jugador_id] =
          (jugadoresCount[cand.jugador_id] ?? 0) + 1;
      }

      if (cand.zona_destino !== null && cand.zona_destino !== undefined) {
        zonasCount[cand.zona_destino] =
          (zonasCount[cand.zona_destino] ?? 0) + 1;
      }

      break;
    }

    ocurrencias.push({
      set_numero: a.set_numero,
      punto_numero: a.punto_numero,
      triggerId: a.id,
      triggerJugadorId: a.jugador_id,
      triggerSubtipo: baseSubtipo(a) || null,
      anteriorId: anterior?.id ?? null,
      anteriorJugadorId: anterior?.jugador_id ?? null,
      anteriorSubtipo: anterior ? baseSubtipo(anterior) || null : null,
      siguientes,
      accionObservada,
    });

    if (siguientes.length > 0) {
      const s0 = siguientes[0];
      const tipoKey = s0.tipo;
      distribucionSiguiente[tipoKey] =
        (distribucionSiguiente[tipoKey] ?? 0) + 1;

      const subKey = `${s0.tipo}|${baseSubtipo(s0) || "—"}`;
      distribucionSubtipo[subKey] =
        (distribucionSubtipo[subKey] ?? 0) + 1;

      const coincideS0 = coincide(s0, coincidencias, {
        trigger: a,
        anterior,
      });
      coincidenciasGlobales = sumarCoincidencias(
        coincidenciasGlobales,
        coincideS0
      );

      const prev = porTipoCoincidencias.get(s0.tipo);
      porTipoCoincidencias.set(
        s0.tipo,
        prev ? sumarCoincidencias(prev, coincideS0) : coincideS0
      );
    }
  }

  const resumenPorTipo: ResumenPorTipo[] = Array.from(
    porTipoCoincidencias.entries()
  )
    .map(([tipo, coinc]) => ({
      tipo,
      count: distribucionSiguiente[tipo] ?? 0,
      coincidencias: coinc,
    }))
    .sort((a, b) => b.count - a.count);

  // 8. Estadísticas de la acción observada.
  let estadisticasObservadas: EstadisticasObservadas | undefined;
  if (countObservadas > 0) {
    const total = countObservadas;
    const pctPuntos = Math.round((countPuntos / total) * 100);
    const pctErrores = Math.round((countErrores / total) * 100);
    const pctNeutros = Math.round((countNeutros / total) * 100);

    let masFrecuente: CategoriaResultado = "neutro";
    if (countPuntos >= countErrores && countPuntos >= countNeutros)
      masFrecuente = "punto";
    else if (countErrores >= countPuntos && countErrores >= countNeutros)
      masFrecuente = "error";

    const evaluacionResultado: EvaluacionResultado = {
      masFrecuente,
      puntos: countPuntos,
      errores: countErrores,
      neutros: countNeutros,
      total,
      pctPuntos,
      pctErrores,
      pctNeutros,
      efectividadNeta: Math.round(
        ((countPuntos - countErrores) / total) * 100
      ),
    };

    const subtiposRanking = Object.entries(subtiposCount)
      .map(([subtipo, count]) => ({
        subtipo,
        count,
        pct: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    const jugadoresRanking = Object.entries(jugadoresCount)
      .map(([jugadorId, count]) => ({
        jugadorId,
        count,
        pct: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    const zonasRanking = Object.entries(zonasCount)
      .map(([k, count]) => ({
        zona: Number(k),
        count,
        pct: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    estadisticasObservadas = {
      tipoObservado,
      totalEncontradas: total,
      promedioAccionesDistancia:
        Math.round((sumDistanciaAcciones / total) * 10) / 10,
      promedioPuntosDistancia:
        Math.round((sumDistanciaPuntos / total) * 10) / 10,
      pctMismoPunto: Math.round((countMismoPunto / total) * 100),
      pctPuntosPosteriores: Math.round(
        ((total - countMismoPunto) / total) * 100
      ),
      evaluacionResultado,
      subtiposRanking,
      subtipoMasFrecuente: subtiposRanking[0]?.subtipo ?? null,
      jugadoresRanking,
      jugadorMasFrecuenteId: jugadoresRanking[0]?.jugadorId ?? null,
      zonasRanking,
      zonaMasFrecuente: zonasRanking[0]?.zona ?? null,
    };
  }

  return {
    totalOcurrencias: triggers.length,
    ocurrencias,
    distribucionSiguiente,
    distribucionSubtipo,
    resumenPorTipo,
    coincidenciasGlobales,
    estadisticasObservadas,
    comportamientoTrigger,
  };
}

// ------------------------------------------------------------
// RESULTADOS DISPONIBLES POR TIPO (para dropdowns)
// ------------------------------------------------------------

export function resultadosPorTipoAnalisis(tipo: TipoDisparador): string[] {
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
    default:
      return ["cualquiera"];
  }
}

// ------------------------------------------------------------
// ETIQUETAS
// ------------------------------------------------------------

export function etiquetaTipoDisparador(t: TipoDisparador): string {
  const map: Record<TipoDisparador, string> = {
    saque: "Saque",
    recepcion: "Recepción",
    armado: "Armado",
    ataque: "Ataque",
    bloqueo: "Bloqueo",
    defensa: "Defensa",
    libre: "Libre",
    "roce-red": "Roce red",
  };
  return map[t] ?? t;
}

export function etiquetaResultado(r: string): string {
  if (r === "cualquiera") return "Cualquier resultado";
  return r.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function etiquetaAmbito(a: AmbitoRacha): string {
  const map: Record<AmbitoRacha, string> = {
    mismo_punto: "Mismo punto",
    puntos_del_set: "Este set",
    partido: "Todo el partido",
  };
  return map[a];
}

export function etiquetaUbicacion(u: UbicacionFiltro): string {
  const map: Record<UbicacionFiltro, string> = {
    cualquiera: "Cualquier ubicación",
    delantero: "Delantero",
    zaguero: "Zaguero",
    libero: "Líbero",
    otro: "Otro",
  };
  return map[u];
}

export function etiquetaRelacion(r: RelacionJugador): string {
  const map: Record<RelacionJugador, string> = {
    cualquiera: "Cualquier jugador",
    mismo: "El mismo jugador",
    companero: "Un compañero",
    rival: "Un rival",
  };
  return map[r];
}

export function etiquetaCierraPunto(c: CierraPuntoFiltro): string {
  const map: Record<CierraPuntoFiltro, string> = {
    cualquiera: "Cualquiera",
    si: "Solo si cerró",
    no: "Solo si NO cerró",
  };
  return map[c];
}