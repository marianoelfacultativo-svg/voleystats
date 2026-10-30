// ============================================================
// TIPOS Y CONSTANTES VACÍAS — Análisis de consecuencias
// ============================================================
// Extraído de lib/analisisConsecuencias.ts (v9).
// Solo tipos e interfaces + constantes iniciales.
// Sin lógica, sin imports de motor.
//
// v1.2 (FASE 6 — Rondas 1.3 + 2):
//   + BloqueTriggerFiltro.salidaRol: RolSalida | null  (Cat. 3)
//   + BloqueTriggerFiltro.crucesMinimos: number | null (Cat. 6)
//   + BLOQUE_TRIGGER_VACIO los inicializa con null.
//
// v1.1 (FASE 2):
//   + BloqueTriggerFiltro.ubicacion: UbicacionFiltro
//   + BloqueTriggerFiltro.cambioEnPunto: boolean | null
// ============================================================

import type { FaseRally, InicioPunto, EstadoMarcador, DiferenciaMarcador } from "../contextoRally";
import type { RolSalida } from "../consultaAnalitica/intenciones/salida";

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

export type VarianteAtaque = "remate" | "toque";

export type ConDesplazamiento = "cualquiera" | "si" | "no";

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
  zonasDestino: number[];
  conDesplazamiento: ConDesplazamiento;
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
  zonasDestino: [],
  conDesplazamiento: "cualquiera",
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

export type TipoRachaJugador =
  | "puntos_ganados"
  | "puntos_perdidos"
  | "errores_seguidos"
  | "aciertos_seguidos";

export interface RachaJugadorFiltro {
  jugadorId: string | null;
  tipo: TipoRachaJugador;
  minimo: number;
  ambito: AmbitoRacha;
}

// ------------------------------------------------------------
// PATRÓN PREVIO
// ------------------------------------------------------------

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
// v1.2:
//   + salidaRol: filtra el rol de la "salida" (Cat. 3).
//   + crucesMinimos: mínimo de cruces de red del rally (Cat. 6).
// ------------------------------------------------------------

export interface BloqueTriggerFiltro {
  tipo: TipoDisparador;
  jugadorId: string | null;
  resultado: string | "cualquiera";
  sets: number[];
  puntos: number[];
  partidos: string[];
  roles: string[];
  zonasJugador: number[];
  /** FASE 2: delantero / zaguero / líbero / otro. */
  ubicacion: UbicacionFiltro;
  /** FASE 2: ¿el punto tuvo cambios? null = cualquiera. */
  cambioEnPunto: boolean | null;
  /** FASE 6 (Cat. 3): rol de la "salida" (zona de origen del ataque). */
  salidaRol: RolSalida | null;
  /** FASE 6 (Cat. 6): mínimo de cruces de red del rally. */
  crucesMinimos: number | null;
  rotaciones: number[];
  rachas: RachaHistorica[];
  accionPreviaDirecta: FiltroAccionHistorica | null;
  rachaJugador: RachaJugadorFiltro | null;
  patronPrevio: PatronPrevioFiltro | null;
  topPorcentaje: number | null;
  vsPromedio: "por_encima" | "por_debajo" | null;
  contextoPartido: ContextoPartidoFiltro | null;
  variante: VarianteAtaque | null;
  llamadasInferidas: string[];
  direccionAtaqueInferida: string[];
  sectoresAtaque: string[];
  zonasDefensaRival: number[];
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
  ubicacion: "cualquiera",
  cambioEnPunto: null,
  salidaRol: null,
  crucesMinimos: null,
  rotaciones: [],
  rachas: [],
  accionPreviaDirecta: null,
  rachaJugador: null,
  patronPrevio: null,
  topPorcentaje: null,
  vsPromedio: null,
  contextoPartido: null,
  variante: null,
  llamadasInferidas: [],
  direccionAtaqueInferida: [],
  sectoresAtaque: [],
  zonasDefensaRival: [],
};

// ------------------------------------------------------------
// BLOQUE TRIGGER (con operador)
// ------------------------------------------------------------

export interface BloqueTrigger {
  id: string;
  operador: OperadorBloque;
  filtro: BloqueTriggerFiltro;
}

// ------------------------------------------------------------
// FILTROS COMPLETOS
// ------------------------------------------------------------

export interface FiltrosAnalisis {
  bloques: BloqueTrigger[];
  tipoObservado?: TipoDisparador | "cualquiera";
  jugadorObservadoRelacion?: RelacionJugadorObservado;
  jugadorObservadoId?: string | null;
  alcance?: "partido" | "mismo_punto";
  ventana: Ventana;
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
  accion: import("../../app/equipo/adaptadorUnificadoV2").AccionVisual;
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
  siguientes: import("../../app/equipo/adaptadorUnificadoV2").AccionVisual[];
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
  porBloque: { bloqueId: string; tipo: string; count: number; pct: number }[];
  porLlamada: { llamada: string; count: number; pct: number }[];
  porDireccionAtaque: { direccion: string; count: number; pct: number }[];
  porSectorAtaque: { sector: string; count: number; pct: number }[];
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