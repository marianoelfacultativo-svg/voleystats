// ============================================================
// TYPES — Análisis de consecuencias (UI)
// ============================================================
// Configuración de un panel de análisis (A o B), helpers de
// creación de bloques vacíos y estado inicial del panel.
// ============================================================

import {
  BLOQUE_TRIGGER_VACIO,
  COINCIDENCIA_VACIA,
  type BloqueTrigger,
  type CoincidenciaFiltro,
  type OperadorBloque,
  type TipoDisparador,
} from "@/lib/analisisConsecuencias";

// ------------------------------------------------------------
// CONFIGURACIÓN DE UN PANEL
// ------------------------------------------------------------

export interface ConfiguracionPanel {
  bloques: BloqueTrigger[];
  tipoObservado: TipoDisparador | "cualquiera";
  jugadorObservadoFiltro: string;
  alcance: "partido" | "mismo_punto";
  coincidencias: CoincidenciaFiltro;
}

// ------------------------------------------------------------
// GENERACIÓN DE IDS
// ------------------------------------------------------------

let _blockCounter = 0;

export function generarIdBloque(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `b-${crypto.randomUUID()}`;
  }
  _blockCounter += 1;
  return `b-${Date.now()}-${_blockCounter}`;
}

// ------------------------------------------------------------
// BLOQUES
// ------------------------------------------------------------

export function bloqueVacio(operador: OperadorBloque = "AND"): BloqueTrigger {
  return {
    id: generarIdBloque(),
    operador,
    filtro: { ...BLOQUE_TRIGGER_VACIO },
  };
}

// ------------------------------------------------------------
// PANEL INICIAL
// ------------------------------------------------------------

export function panelInicial(): ConfiguracionPanel {
  return {
    bloques: [bloqueVacio("AND")],
    tipoObservado: "ataque",
    jugadorObservadoFiltro: "cualquiera",
    alcance: "partido",
    coincidencias: { ...COINCIDENCIA_VACIA },
  };
}