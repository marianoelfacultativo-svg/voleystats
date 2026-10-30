// ============================================================
// COINCIDENCIAS — comparadores trigger / anterior
// ============================================================
// Extraído de lib/analisisConsecuencias.ts (v9).
//
// Funciones puras:
//   - coincide(a, filtro, ref): evalúa una acción contra los
//     comparadores activos y devuelve un CoincidenciasResumen
//     con 1/0 en cada campo.
//   - sumarCoincidencias(a, b): suma dos CoincidenciasResumen.
//   - coincidenciasVacias(): todos los campos en 0.
//   - hayComparadoresActivos(f): ¿algún comparador prendido?
// ============================================================

import type { AccionVisual } from "../../app/equipo/adaptadorUnificadoV2";
import type {
  CoincidenciaFiltro,
  CoincidenciasResumen,
} from "./tipos";

export function coincide(
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

export function sumarCoincidencias(
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