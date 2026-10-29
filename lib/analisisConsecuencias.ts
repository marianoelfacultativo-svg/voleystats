// ============================================================
// ANÁLISIS DE CONSECUENCIAS — motor puro (v5)
// ============================================================
// Cambios v5:
//   + OR/AND/NOT entre N bloques trigger.
//   + Filtros de scope: sets, puntos, partidos, roles, zonas,
//     rotaciones, diferencia exacta, primer/último punto del set.
//   + Racha específica de jugador (puntos ganados/perdidos del
//     equipo, o errores/aciertos seguidos del jugador).
//   + Patrón previo (secuencia exacta de hasta 3 acciones).
//   + Top N% por puntaje de la acción del trigger.
//   + Vs promedio del jugador (por encima / por debajo).
//
// Jerarquía conceptual:
//   DISPARADOR = cada BloqueTrigger tiene su propio filtro completo.
//   El análisis combina los bloques con el operador elegido.
//
// Ejemplo:
//   [A: ataque·error·Juan] AND [B: bloqueo·punto·Pedro]
//   → "Cuando Juan erró un ataque Y Pedro metió un bloqueo-punto"
//
//   [A: ataque·punto] OR [B: bloqueo·punto]
//   → "Cuando el equipo metió punto por ataque O por bloqueo"
//
//   NOT [A: armado]
//   → "Cuando NO es armado" (se combina con el bloque anterior)
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

export type RelacionJugadorObservado =
  | "cualquiera"
  | "mismo"
  | "companero"
  | "rival";

export type AmbitoRacha = "mismo_punto" | "puntos_del_set" | "partido";
export type CierraPuntoFiltro = "cualquiera" | "si" | "no";
export type PosicionEnSet = "cualquiera" | "primero" | "ultimo";

export type OperadorBloque = "AND" | "OR" | "NOT";

// ------------------------------------------------------------
// FILTRO DE UNA ACCIÓN HISTÓRICA
// ------------------------------------------------------------

export interface FiltroAccionHistorica {
  tipos: TipoDisparador[];
  resultados: string[];
  cierraPunto: CierraPuntoFiltro;
  ubicacion: UbicacionFiltro;
  zonaJugador: number | "cualquiera";
  velocidad: number | null;
  tipoSaque: "potencia" | "flotado" | null;
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
  id: string;
  ambito: AmbitoRacha;
  desdeAtras: number;
  minimo: number;
  filtro: FiltroAccionHistorica;
}

// ------------------------------------------------------------
// RACHA ESPECÍFICA DE JUGADOR
// ------------------------------------------------------------
// Distinto de RachaHistorica:
//   - "puntos_ganados" / "puntos_perdidos": cuenta puntos del SET
//     que el equipo del jugador ganó/perdió consecutivamente.
//   - "errores_seguidos": cuenta las últimas N acciones de ese
//     jugador que resultaron en error (de cualquier tipo).
//   - "aciertos_seguidos": cuenta las últimas N acciones que
//     resultaron en punto/positivo.

export type TipoRachaJugador =
  | "puntos_ganados"
  | "puntos_perdidos"
  | "errores_seguidos"
  | "aciertos_seguidos";

export interface RachaJugadorFiltro {
  jugadorId: string | null; // null = el jugador del trigger
  tipo: TipoRachaJugador;
  minimo: number;
  ambito: AmbitoRacha;
}

// ------------------------------------------------------------
// PATRÓN PREVIO
// ------------------------------------------------------------
// Secuencia exacta de acciones anteriores del mismo punto.
// Ejemplo: [{ tipo: "recepcion" }, { tipo: "armado", velocidad: 1 }]
// requiere que las 2 acciones inmediatamente anteriores hayan
// sido recepción → armado con velocidad 1.

export interface ItemPatron {
  tipo: TipoDisparador;
  resultado: string | "cualquiera";
}

export interface PatronPrevioFiltro {
  acciones: ItemPatron[];
}

// ------------------------------------------------------------
// CONTEXTO DEL PARTIDO
// ------------------------------------------------------------

export interface MarcadorFiltro {
  estado: "cualquiera" | EstadoMarcador;
  diferencia: "cualquiera" | DiferenciaMarcador;
  diferenciaExacta: number | null;
  soloCriticos: boolean;
  puntosParaCerrar: "cualquiera" | "<=1" | "<=3" | "<=5";
}

export interface ContextoPartidoFiltro {
  marcador: MarcadorFiltro;
  faseRally: "cualquiera" | FaseRally;
  inicioPunto: "cualquiera" | InicioPunto;
  rachaPuntos: number | null;
  ubicacionTrigger: UbicacionFiltro;
  esPrimerToque: "cualquiera" | "si" | "no";
  toquesMinimo: number | null;
  posicionEnSet: PosicionEnSet;
}

export const CONTEXTO_PARTIDO_VACIO: ContextoPartidoFiltro = {
  marcador: {
    estado: "cualquiera",
    diferencia: "cualquiera",
    diferenciaExacta: null,
    soloCriticos: false,
    puntosParaCerrar: "cualquiera",
  },
  faseRally: "cualquiera",
  inicioPunto: "cualquiera",
  rachaPuntos: null,
  ubicacionTrigger: "cualquiera",
  esPrimerToque: "cualquiera",
  toquesMinimo: null,
  posicionEnSet: "cualquiera",
};

// ------------------------------------------------------------
// COINCIDENCIA
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
// FILTRO COMPLETO DE UN BLOQUE TRIGGER
// ------------------------------------------------------------

export interface BloqueTriggerFiltro {
  // ---------- Mínimo esencial ----------
  tipo: TipoDisparador;
  jugadorId: string | null;

  // ---------- Resultado del trigger ----------
  resultado: string | "cualquiera";

  // ---------- Scope ----------
  sets: number[];
  puntos: number[];
  partidos: string[];
  roles: string[];
  zonasJugador: number[];
  rotaciones: number[];

  // ---------- Avanzado ----------
  rachas: RachaHistorica[];
  accionPreviaDirecta: FiltroAccionHistorica | null;
  rachaJugador: RachaJugadorFiltro | null;
  patronPrevio: PatronPrevioFiltro | null;
  topPorcentaje: number | null;
  vsPromedio: "por_encima" | "por_debajo" | null;
  contextoPartido: ContextoPartidoFiltro | null;
}

export const BLOQUE_TRIGGER_VACIO: BloqueTriggerFiltro = {
  tipo: "ataque",
  jugadorId: null,
  resultado: "cualquiera",
  sets: [],
  puntos: [],
  partidos: [],
  roles: [],
  zonasJugador: [],
  rotaciones: [],
  rachas: [],
  accionPreviaDirecta: null,
  rachaJugador: null,
  patronPrevio: null,
  topPorcentaje: null,
  vsPromedio: null,
  contextoPartido: null,
};

// ------------------------------------------------------------
// BLOQUE TRIGGER (con operador)
// ------------------------------------------------------------

export interface BloqueTrigger {
  id: string;
  /** Cómo se combina con el bloque anterior. El primero lo ignora. */
  operador: OperadorBloque;
  filtro: BloqueTriggerFiltro;
}

// ------------------------------------------------------------
// FILTROS COMPLETOS
// ------------------------------------------------------------

export interface FiltrosAnalisis {
  // ---------- Triggers (lista con OR/AND/NOT) ----------
  bloques: BloqueTrigger[];

  // ---------- Acción observada ----------
  tipoObservado?: TipoDisparador | "cualquiera";
  jugadorObservadoRelacion?: RelacionJugadorObservado;
  jugadorObservadoId?: string | null;
  alcance?: "partido" | "mismo_punto";
  ventana: Ventana;

  // ---------- Comparadores ----------
  coincidencias: CoincidenciaFiltro;
}

export const FILTROS_ANALISIS_VACIO: FiltrosAnalisis = {
  bloques: [],
  tipoObservado: "cualquiera",
  jugadorObservadoRelacion: "cualquiera",
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

export interface ComportamientoTrigger {
  totalTriggers: number;
  porSubtipo: { subtipo: string; count: number; pct: number }[];
  porZonaDestino: { zona: number | null; count: number; pct: number }[];
  porVelocidad: { velocidad: number | null; count: number; pct: number }[];
  porJugador: { jugadorId: string; count: number; pct: number }[];
  porSet: { set: number; count: number; pct: number }[];
  /** Distribución por bloque trigger: cuántos casos cumplen cada bloque. */
  porBloque: { bloqueId: string; tipo: string; count: number; pct: number }[];
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
// CLASIFICACIÓN DE RESULTADOS
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

    if (racha.filtro.tipos.length > 0) {
      if (!racha.filtro.tipos.includes(cand.tipo as TipoDisparador)) {
        continue;
      }
    }

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

function cumpleAccionPreviaDirecta(
  listaPunto: AccionVisual[],
  idxEnPunto: number,
  trigger: AccionVisual,
  filtro: FiltroAccionHistorica
): boolean {
  if (idxEnPunto <= 0) return false;
  for (let k = idxEnPunto - 1; k >= 0; k--) {
    const cand = listaPunto[k];
    if (cand.oculta) continue;
    return cumpleFiltroAccion(cand, trigger, filtro);
  }
  return false;
}

// ------------------------------------------------------------
// RACHA ESPECÍFICA DE JUGADOR
// ------------------------------------------------------------

function verificarRachaJugador(
  trigger: AccionVisual,
  filtro: RachaJugadorFiltro,
  contextoRally: Map<string, ContextoRally> | null,
  accionesCronologicas: AccionVisual[],
  triggerIdxGlobal: number,
  equipoDelJugador: "propio" | "rival" | "cualquiera"
): boolean {
  const jugadorObjetivo = filtro.jugadorId ?? trigger.jugador_id;
  if (!jugadorObjetivo) return false;

  if (filtro.tipo === "puntos_ganados" || filtro.tipo === "puntos_perdidos") {
    if (!contextoRally) return false;
    const ctx = contextoRally.get(trigger.id);
    if (!ctx) return false;
    const racha =
      filtro.tipo === "puntos_ganados"
        ? ctx.rachaGanadosActual
        : ctx.rachaPerdidosActual;
    return racha >= filtro.minimo;
  }

  // errores_seguidos / aciertos_seguidos
  // Contar hacia atrás las últimas N acciones del mismo jugador
  // (en el ámbito) que fueron error o punto.
  const esError = filtro.tipo === "errores_seguidos";
  let contador = 0;

  for (let k = triggerIdxGlobal - 1; k >= 0; k--) {
    const cand = accionesCronologicas[k];
    if (cand.oculta) continue;

    // Ámbito
    if (filtro.ambito === "mismo_punto") {
      if (
        cand.set_numero !== trigger.set_numero ||
        cand.punto_numero !== trigger.punto_numero ||
        cand.partido_id !== trigger.partido_id
      )
        break;
    } else if (filtro.ambito === "puntos_del_set") {
      if (
        cand.set_numero !== trigger.set_numero ||
        cand.partido_id !== trigger.partido_id
      )
        break;
    } else if (filtro.ambito === "partido") {
      if (cand.partido_id !== trigger.partido_id) break;
    }

    if (cand.jugador_id !== jugadorObjetivo) continue;

    const cat = clasificarResultado(cand);
    const esAcierto = cat === "punto";
    const esFalla = cat === "error";

    if (esError ? esFalla : esAcierto) {
      contador++;
      if (contador >= filtro.minimo) return true;
    } else {
      // Se corta la racha
      return false;
    }
  }

  return contador >= filtro.minimo;
}

// ------------------------------------------------------------
// PATRÓN PREVIO
// ------------------------------------------------------------
// Verifica que las últimas N acciones visibles del punto (antes del
// trigger) coincidan exactamente con el patrón, en orden.

function cumplePatronPrevio(
  listaPunto: AccionVisual[],
  idxEnPunto: number,
  patron: PatronPrevioFiltro
): boolean {
  if (patron.acciones.length === 0) return true;

  // Recolectar las últimas N acciones visibles
  const anteriores: AccionVisual[] = [];
  for (let k = idxEnPunto - 1; k >= 0 && anteriores.length < patron.acciones.length; k--) {
    const cand = listaPunto[k];
    if (cand.oculta) continue;
    anteriores.push(cand);
  }

  if (anteriores.length < patron.acciones.length) return false;

  // anteriores está en orden inverso (última primero). Lo ordenamos.
  anteriores.reverse();

  for (let i = 0; i < patron.acciones.length; i++) {
    const esperado = patron.acciones[i];
    const real = anteriores[i];
    if (real.tipo !== esperado.tipo) return false;
    if (esperado.resultado !== "cualquiera") {
      if (baseSubtipo(real) !== esperado.resultado) return false;
    }
  }

  return true;
}

// ------------------------------------------------------------
// TOP N% y VS PROMEDIO
// ------------------------------------------------------------

function calcularIdsTopPorcentaje(
  todasAcciones: AccionVisual[],
  tipo: TipoDisparador,
  porcentaje: number
): Set<string> {
  const delTipo = todasAcciones
    .filter((a) => !a.oculta && a.tipo === tipo)
    .map((a) => ({ id: a.id, p: puntajeDeAccion(a) }))
    .filter((x): x is { id: string; p: number } => x.p !== null);

  if (delTipo.length === 0) return new Set();

  delTipo.sort((a, b) => b.p - a.p);
  const cuantos = Math.max(1, Math.ceil((delTipo.length * porcentaje) / 100));
  return new Set(delTipo.slice(0, cuantos).map((x) => x.id));
}

function calcularIdsVsPromedio(
  todasAcciones: AccionVisual[],
  tipo: TipoDisparador,
  modo: "por_encima" | "por_debajo"
): Set<string> {
  const delTipo = todasAcciones
    .filter((a) => !a.oculta && a.tipo === tipo)
    .map((a) => ({ id: a.id, p: puntajeDeAccion(a) }))
    .filter((x): x is { id: string; p: number } => x.p !== null);

  if (delTipo.length === 0) return new Set();

  const suma = delTipo.reduce((s, x) => s + x.p, 0);
  const prom = suma / delTipo.length;

  const out = new Set<string>();
  for (const x of delTipo) {
    if (modo === "por_encima" && x.p > prom) out.add(x.id);
    else if (modo === "por_debajo" && x.p < prom) out.add(x.id);
  }
  return out;
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
  if (ctx.marcador.diferenciaExacta !== null) return true;
  if (ctx.marcador.soloCriticos) return true;
  if (ctx.marcador.puntosParaCerrar !== "cualquiera") return true;
  if (ctx.faseRally !== "cualquiera") return true;
  if (ctx.inicioPunto !== "cualquiera") return true;
  if (ctx.rachaPuntos !== null) return true;
  if (ctx.ubicacionTrigger !== "cualquiera") return true;
  if (ctx.esPrimerToque !== "cualquiera") return true;
  if (ctx.toquesMinimo !== null) return true;
  if (ctx.posicionEnSet !== "cualquiera") return true;
  return false;
}

function cumpleContextoPartido(
  ctx: ContextoRally | undefined,
  filtro: ContextoPartidoFiltro,
  posicionEnSet: "primero" | "ultimo" | "intermedio"
): boolean {
  if (!ctx) return false;

  if (
    filtro.marcador.estado !== "cualquiera" &&
    ctx.estadoMarcador !== filtro.marcador.estado
  )
    return false;

  if (
    filtro.marcador.diferencia !== "cualquiera" &&
    ctx.diferencia !== filtro.marcador.diferencia
  )
    return false;

  if (filtro.marcador.diferenciaExacta !== null) {
    const diff = Math.abs(ctx.puntosPropios - ctx.puntosRivales);
    if (diff !== filtro.marcador.diferenciaExacta) return false;
  }

  if (filtro.marcador.soloCriticos && !ctx.esPuntoCritico) return false;

  if (filtro.marcador.puntosParaCerrar !== "cualquiera") {
    const maxPts = Math.max(ctx.puntosPropios, ctx.puntosRivales);
    const ptsCerrar = Math.max(0, 25 - maxPts);
    const max = parseInt(
      filtro.marcador.puntosParaCerrar.replace("<=", "").trim(),
      10
    );
    if (ptsCerrar > max) return false;
  }

  if (filtro.faseRally !== "cualquiera" && ctx.fase !== filtro.faseRally) {
    return false;
  }

  if (
    filtro.inicioPunto !== "cualquiera" &&
    ctx.inicioPunto !== filtro.inicioPunto
  ) {
    return false;
  }

  if (filtro.esPrimerToque !== "cualquiera") {
    const esperado = filtro.esPrimerToque === "si";
    if (ctx.esPrimerToqueDelEquipo !== esperado) return false;
  }

  if (filtro.toquesMinimo !== null) {
    if (ctx.toquesDelEquipoEnPunto < filtro.toquesMinimo) return false;
  }

  if (filtro.rachaPuntos !== null) {
    if (
      ctx.rachaGanadosActual < filtro.rachaPuntos &&
      ctx.rachaPerdidosActual < filtro.rachaPuntos
    ) {
      return false;
    }
  }

  if (
    filtro.ubicacionTrigger !== "cualquiera" &&
    ctx.ubicacion !== filtro.ubicacionTrigger
  ) {
    return false;
  }

  if (filtro.posicionEnSet !== "cualquiera") {
    if (posicionEnSet !== filtro.posicionEnSet) return false;
  }

  return true;
}

// ------------------------------------------------------------
// COINCIDENCIAS
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
  return f.bloques.length > 0;
}

export function hayFiltrosAvanzadosEnBloque(f: BloqueTriggerFiltro): boolean {
  return !!(
    f.resultado !== "cualquiera" ||
    f.sets.length > 0 ||
    f.puntos.length > 0 ||
    f.partidos.length > 0 ||
    f.roles.length > 0 ||
    f.zonasJugador.length > 0 ||
    f.rotaciones.length > 0 ||
    f.rachas.length > 0 ||
    f.accionPreviaDirecta ||
    f.rachaJugador ||
    f.patronPrevio ||
    f.topPorcentaje !== null ||
    f.vsPromedio ||
    (f.contextoPartido && hayContextoPartidoActivo(f.contextoPartido))
  );
}

// ------------------------------------------------------------
// COMPORTAMIENTO DEL TRIGGER
// ------------------------------------------------------------

function calcularComportamientoTrigger(
  triggers: AccionVisual[],
  bloques: BloqueTrigger[],
  cumplePorBloque: Map<string, Set<string>>
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

  const porBloque: { bloqueId: string; tipo: string; count: number; pct: number }[] =
    bloques.map((b) => {
      const set = cumplePorBloque.get(b.id) ?? new Set();
      return {
        bloqueId: b.id,
        tipo: b.filtro.tipo,
        count: set.size,
        pct: pct(set.size),
      };
    });

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
    porBloque,
  };
}

// ------------------------------------------------------------
// EVALUACIÓN DE UN BLOQUE TRIGGER
// ------------------------------------------------------------
// Devuelve true si la acción `a` cumple TODOS los filtros del bloque.
// Los filtros de scope (sets, puntos, etc.) y los avanzados se
// evalúan acá.

function cumpleBloqueTrigger(
  a: AccionVisual,
  bloque: BloqueTriggerFiltro,
  accionesCronologicas: AccionVisual[],
  triggerIdxGlobal: number,
  porPunto: Map<string, AccionVisual[]>,
  contextoRally: Map<string, ContextoRally> | null,
  posicionEnSet: "primero" | "ultimo" | "intermedio",
  idsTopPorcentaje: Set<string> | null,
  idsVsPromedio: Set<string> | null
): boolean {
  // Tipo
  if (bloque.tipo !== a.tipo) return false;

  // Jugador
  if (bloque.jugadorId && a.jugador_id !== bloque.jugadorId) return false;

  // Resultado
  if (bloque.resultado !== "cualquiera") {
    if (baseSubtipo(a) !== bloque.resultado) return false;
  }

  // Scope
  if (bloque.sets.length > 0 && !bloque.sets.includes(a.set_numero))
    return false;
  if (bloque.puntos.length > 0 && !bloque.puntos.includes(a.punto_numero))
    return false;
  if (
    bloque.partidos.length > 0 &&
    !bloque.partidos.includes(a.partido_id || "")
  )
    return false;
  if (
    bloque.roles.length > 0 &&
    (!a.rol_jugador || !bloque.roles.includes(a.rol_jugador))
  )
    return false;
  if (
    bloque.zonasJugador.length > 0 &&
    (a.zona_jugador === null || !bloque.zonasJugador.includes(a.zona_jugador))
  )
    return false;
  if (
    bloque.rotaciones.length > 0 &&
    (a.rotacion_numero === null ||
      !bloque.rotaciones.includes(a.rotacion_numero))
  )
    return false;

  // Rachas
  for (const racha of bloque.rachas) {
    if (!verificarRacha(accionesCronologicas, triggerIdxGlobal, a, racha))
      return false;
  }

  // Acción previa directa
  if (bloque.accionPreviaDirecta) {
    const listaPunto =
      porPunto.get(
        `${a.partido_id || ""}|${a.set_numero}|${a.punto_numero}`
      ) ?? [];
    const idxEnPunto = listaPunto.findIndex((x) => x.id === a.id);
    if (
      !cumpleAccionPreviaDirecta(
        listaPunto,
        idxEnPunto,
        a,
        bloque.accionPreviaDirecta
      )
    )
      return false;
  }

  // Racha de jugador
  if (bloque.rachaJugador) {
    if (
      !verificarRachaJugador(
        a,
        bloque.rachaJugador,
        contextoRally,
        accionesCronologicas,
        triggerIdxGlobal,
        "cualquiera"
      )
    )
      return false;
  }

  // Patrón previo
  if (bloque.patronPrevio) {
    const listaPunto =
      porPunto.get(
        `${a.partido_id || ""}|${a.set_numero}|${a.punto_numero}`
      ) ?? [];
    const idxEnPunto = listaPunto.findIndex((x) => x.id === a.id);
    if (!cumplePatronPrevio(listaPunto, idxEnPunto, bloque.patronPrevio))
      return false;
  }

  // Top %
  if (bloque.topPorcentaje !== null) {
    if (!idsTopPorcentaje || !idsTopPorcentaje.has(a.id)) return false;
  }

  // Vs promedio
  if (bloque.vsPromedio !== null) {
    if (!idsVsPromedio || !idsVsPromedio.has(a.id)) return false;
  }

  // Contexto del partido
  if (bloque.contextoPartido && hayContextoPartidoActivo(bloque.contextoPartido)) {
    if (!contextoRally) return false;
    if (
      !cumpleContextoPartido(
        contextoRally.get(a.id),
        bloque.contextoPartido,
        posicionEnSet
      )
    )
      return false;
  }

  return true;
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

  if (filtros.bloques.length === 0) return vacio;

  const {
    ventana,
    coincidencias,
    tipoObservado = "cualquiera",
    alcance = "partido",
    jugadorObservadoId = null,
    jugadorObservadoRelacion = "cualquiera",
  } = filtros;

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

  const indiceGlobalPorId = new Map<string, number>();
  for (let i = 0; i < accionesCronologicas.length; i++) {
    indiceGlobalPorId.set(accionesCronologicas[i].id, i);
  }

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

  // Contexto rally solo si algún bloque lo necesita
  const necesitaContexto = filtros.bloques.some(
    (b) =>
      (b.filtro.contextoPartido &&
        hayContextoPartidoActivo(b.filtro.contextoPartido)) ||
      (b.filtro.rachaJugador &&
        (b.filtro.rachaJugador.tipo === "puntos_ganados" ||
          b.filtro.rachaJugador.tipo === "puntos_perdidos"))
  );
  const contextoRally = necesitaContexto
    ? calcularContextoRally(accionesCronologicas)
    : null;

  // Precalcular Top % / Vs promedio por bloque
  const idsTopPorcentajePorBloque = new Map<string, Set<string>>();
  const idsVsPromedioPorBloque = new Map<string, Set<string>>();
  for (const b of filtros.bloques) {
    if (b.filtro.topPorcentaje !== null) {
      idsTopPorcentajePorBloque.set(
        b.id,
        calcularIdsTopPorcentaje(
          accionesCronologicas,
          b.filtro.tipo,
          b.filtro.topPorcentaje
        )
      );
    }
    if (b.filtro.vsPromedio !== null) {
      idsVsPromedioPorBloque.set(
        b.id,
        calcularIdsVsPromedio(
          accionesCronologicas,
          b.filtro.tipo,
          b.filtro.vsPromedio
        )
      );
    }
  }

  // Calcular "posicionEnSet" para cada acción (primero/ultimo/intermedio)
  const posicionEnSetPorAccion = new Map<
    string,
    "primero" | "ultimo" | "intermedio"
  >();
  {
    const porSet = new Map<string, AccionVisual[]>();
    for (const a of accionesCronologicas) {
      const k = `${a.partido_id || ""}|${a.set_numero}`;
      let lista = porSet.get(k);
      if (!lista) {
        lista = [];
        porSet.set(k, lista);
      }
      if (!lista.some((x) => x.punto_numero === a.punto_numero)) {
        lista.push(a);
      }
    }
    for (const lista of porSet.values()) {
      lista.sort((x, y) => x.punto_numero - y.punto_numero);
      if (lista.length === 0) continue;
      const primero = lista[0].punto_numero;
      const ultimo = lista[lista.length - 1].punto_numero;
      for (const a of lista) {
        if (a.punto_numero === primero) {
          posicionEnSetPorAccion.set(a.id, "primero");
        } else if (a.punto_numero === ultimo) {
          posicionEnSetPorAccion.set(a.id, "ultimo");
        } else {
          posicionEnSetPorAccion.set(a.id, "intermedio");
        }
      }
    }
  }

  // Calcular cumplePorBloque para el resumen
  const cumplePorBloque = new Map<string, Set<string>>();
  for (const b of filtros.bloques) {
    cumplePorBloque.set(b.id, new Set());
  }

  // ===== Recolectar triggers que pasan la expresión lógica =====
  const triggers: AccionVisual[] = [];
  for (let i = 0; i < accionesCronologicas.length; i++) {
    const a = accionesCronologicas[i];

    // Para cada bloque, evaluar si la acción cumple
    const cumple: boolean[] = [];
    for (const b of filtros.bloques) {
      const cumpleB = cumpleBloqueTrigger(
        a,
        b.filtro,
        accionesCronologicas,
        i,
        porPunto,
        contextoRally,
        posicionEnSetPorAccion.get(a.id) ?? "intermedio",
        idsTopPorcentajePorBloque.get(b.id) ?? null,
        idsVsPromedioPorBloque.get(b.id) ?? null
      );
      cumple.push(cumpleB);
      if (cumpleB) {
        cumplePorBloque.get(b.id)!.add(a.id);
      }
    }

    // Combinar con operadores
    // [A] AND [B] OR [C]  →  ((A AND B) OR C)
    // NOT [A]             →  NOT A (bloque único con NOT)
    // [A] NOT [B]         →  A AND NOT B
    let resultado = cumple[0];
    for (let bi = 1; bi < filtros.bloques.length; bi++) {
      const op = filtros.bloques[bi].operador;
      const c = cumple[bi];
      if (op === "AND") resultado = resultado && c;
      else if (op === "OR") resultado = resultado || c;
      else if (op === "NOT") resultado = resultado && !c;
    }

    if (resultado) triggers.push(a);
  }

  const comportamientoTrigger =
    triggers.length > 0
      ? calcularComportamientoTrigger(triggers, filtros.bloques, cumplePorBloque)
      : undefined;

  // ===== Consecuencias =====
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

      if (jugadorObservadoRelacion === "mismo") {
        if (!a.jugador_id || cand.jugador_id !== a.jugador_id) continue;
      } else if (jugadorObservadoRelacion === "companero") {
        if (cand.es_rival !== a.es_rival) continue;
      } else if (jugadorObservadoRelacion === "rival") {
        if (cand.es_rival === a.es_rival) continue;
      }

      if (
        jugadorObservadoRelacion === "cualquiera" &&
        coincidencias.mismoJugadorTrigger
      ) {
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
// RESULTADOS DISPONIBLES POR TIPO
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

export function etiquetaRelacionObservado(r: RelacionJugadorObservado): string {
  const map: Record<RelacionJugadorObservado, string> = {
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

export function etiquetaOperador(op: OperadorBloque): string {
  const map: Record<OperadorBloque, string> = {
    AND: "Y",
    OR: "O",
    NOT: "Y NO",
  };
  return map[op];
}