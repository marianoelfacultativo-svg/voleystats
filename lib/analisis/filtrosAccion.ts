// ============================================================
// FILTROS DE ACCIÓN HISTÓRICA + rachas + patrón previo
// ============================================================
// Extraído de lib/analisisConsecuencias.ts (v9).
//
// Funciones puras:
//   - cumpleFiltroAccion(a, trigger, f): evalúa una acción contra
//     un FiltroAccionHistorica (usado por rachas y acción previa).
//   - verificarRacha(...): racha histórica.
//   - cumpleAccionPreviaDirecta(...): la acción inmediatamente
//     anterior dentro del mismo punto.
//   - verificarRachaJugador(...): racha específica de jugador
//     (puntos ganados/perdidos, errores/aciertos seguidos).
//   - cumplePatronPrevio(...): secuencia exacta hasta 3 acciones.
// ============================================================

import type { AccionVisual } from "../../app/equipo/adaptadorUnificadoV2";
import type { ContextoRally } from "../contextoRally";
import {
  baseSubtipo,
  clasificarResultado,
  ubicacionDeZona,
} from "./clasificacion";
import type {
  FiltroAccionHistorica,
  PatronPrevioFiltro,
  RachaHistorica,
  RachaJugadorFiltro,
  TipoDisparador,
} from "./tipos";

// ------------------------------------------------------------
// FILTRO DE UNA ACCIÓN HISTÓRICA
// ------------------------------------------------------------

export function cumpleFiltroAccion(
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
  if (f.zonasDestino.length > 0) {
    if (a.zona_destino === null || !f.zonasDestino.includes(a.zona_destino))
      return false;
  }
  if (f.conDesplazamiento !== "cualquiera") {
    const tiene = a.posicion_inicial_celda !== null;
    if (f.conDesplazamiento === "si" && !tiene) return false;
    if (f.conDesplazamiento === "no" && tiene) return false;
  }
  return true;
}

// ------------------------------------------------------------
// RACHA HISTÓRICA
// ------------------------------------------------------------

export function verificarRacha(
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

// ------------------------------------------------------------
// ACCIÓN PREVIA DIRECTA
// ------------------------------------------------------------

export function cumpleAccionPreviaDirecta(
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

export function verificarRachaJugador(
  trigger: AccionVisual,
  filtro: RachaJugadorFiltro,
  contextoRally: Map<string, ContextoRally> | null,
  accionesCronologicas: AccionVisual[],
  triggerIdxGlobal: number,
  _equipoDelJugador: "propio" | "rival" | "cualquiera"
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

  const esError = filtro.tipo === "errores_seguidos";
  let contador = 0;

  for (let k = triggerIdxGlobal - 1; k >= 0; k--) {
    const cand = accionesCronologicas[k];
    if (cand.oculta) continue;

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
      return false;
    }
  }

  return contador >= filtro.minimo;
}

// ------------------------------------------------------------
// PATRÓN PREVIO
// ------------------------------------------------------------

export function cumplePatronPrevio(
  listaPunto: AccionVisual[],
  idxEnPunto: number,
  patron: PatronPrevioFiltro
): boolean {
  if (patron.acciones.length === 0) return true;

  const anteriores: AccionVisual[] = [];
  for (
    let k = idxEnPunto - 1;
    k >= 0 && anteriores.length < patron.acciones.length;
    k--
  ) {
    const cand = listaPunto[k];
    if (cand.oculta) continue;
    anteriores.push(cand);
  }

  if (anteriores.length < patron.acciones.length) return false;

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