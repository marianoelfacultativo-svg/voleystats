// ============================================================
// BLOQUE TRIGGER — chequeo de un bloque completo
// ============================================================
// Extraído de lib/analisisConsecuencias.ts (v9).
//
// v1.1 (FASE 2):
//   + evalúa bloque.ubicacion (delantero / zaguero / líbero / otro)
//   + evalúa bloque.cambioEnPunto (boolean | null)
//   + agrega ubicacion y cambioEnPunto a hayFiltrosAvanzadosEnBloque
// ============================================================

import type { AccionVisual } from "../../app/equipo/adaptadorUnificadoV2";
import type { ContextoRally } from "../contextoRally";
import { baseSubtipo, ubicacionDeZona } from "./clasificacion";
import { hayContextoPartidoActivo, cumpleContextoPartido } from "./contexto";
import {
  cumpleAccionPreviaDirecta,
  cumplePatronPrevio,
  verificarRacha,
  verificarRachaJugador,
} from "./filtrosAccion";
import {
  inferirDireccionAtaque,
  inferirLlamadaArmado,
} from "./inferencias";
import { calificarSectorAtaque } from "./sectores";
import type { BloqueTriggerFiltro, FiltrosAnalisis } from "./tipos";
import { zonaDefensaRival } from "./zonas";

export function cumpleBloqueTrigger(
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
  if (bloque.tipo !== a.tipo) return false;
  if (bloque.jugadorId && a.jugador_id !== bloque.jugadorId) return false;
  if (bloque.resultado !== "cualquiera") {
    if (baseSubtipo(a) !== bloque.resultado) return false;
  }

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

  // FASE 2: ubicación del jugador (delantero / zaguero / líbero / otro)
  if (bloque.ubicacion !== "cualquiera") {
    if (bloque.ubicacion === "libero") {
      if (a.rol_jugador !== "L") return false;
    } else {
      const ubi = ubicacionDeZona(a.zona_jugador);
      if (ubi !== bloque.ubicacion) return false;
    }
  }

  // FASE 2: cambio de jugador en el punto
  if (bloque.cambioEnPunto !== null) {
    const tuvoCambio = a.cambioEnPunto ?? false;
    if (tuvoCambio !== bloque.cambioEnPunto) return false;
  }

  if (
    bloque.rotaciones.length > 0 &&
    (a.rotacion_numero === null ||
      !bloque.rotaciones.includes(a.rotacion_numero))
  )
    return false;

  if (bloque.variante !== null) {
    const varianteA = a.variante === "toque" ? "toque" : "remate";
    if (varianteA !== bloque.variante) return false;
  }
  if (bloque.llamadasInferidas.length > 0) {
    const llamada = inferirLlamadaArmado(a);
    if (llamada === null || !bloque.llamadasInferidas.includes(llamada))
      return false;
  }
  if (bloque.direccionAtaqueInferida.length > 0) {
    const direccion = inferirDireccionAtaque(a);
    if (
      direccion === null ||
      !bloque.direccionAtaqueInferida.includes(direccion)
    )
      return false;
  }

  if (bloque.sectoresAtaque.length > 0) {
    const sector = calificarSectorAtaque(a);
    if (sector === null || !bloque.sectoresAtaque.includes(sector))
      return false;
  }
  if (bloque.zonasDefensaRival.length > 0) {
    const zona = zonaDefensaRival(a.destino_celda, a.destino_mini);
    if (zona === null || !bloque.zonasDefensaRival.includes(zona))
      return false;
  }

  for (const racha of bloque.rachas) {
    if (!verificarRacha(accionesCronologicas, triggerIdxGlobal, a, racha))
      return false;
  }

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

  if (bloque.patronPrevio) {
    const listaPunto =
      porPunto.get(
        `${a.partido_id || ""}|${a.set_numero}|${a.punto_numero}`
      ) ?? [];
    const idxEnPunto = listaPunto.findIndex((x) => x.id === a.id);
    if (!cumplePatronPrevio(listaPunto, idxEnPunto, bloque.patronPrevio))
      return false;
  }

  if (bloque.topPorcentaje !== null) {
    if (!idsTopPorcentaje || !idsTopPorcentaje.has(a.id)) return false;
  }

  if (bloque.vsPromedio !== null) {
    if (!idsVsPromedio || !idsVsPromedio.has(a.id)) return false;
  }

  if (
    bloque.contextoPartido &&
    hayContextoPartidoActivo(bloque.contextoPartido)
  ) {
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

export function hayFiltrosAvanzadosEnBloque(f: BloqueTriggerFiltro): boolean {
  return !!(
    f.resultado !== "cualquiera" ||
    f.sets.length > 0 ||
    f.puntos.length > 0 ||
    f.partidos.length > 0 ||
    f.roles.length > 0 ||
    f.zonasJugador.length > 0 ||
    f.ubicacion !== "cualquiera" ||
    f.cambioEnPunto !== null ||
    f.rotaciones.length > 0 ||
    f.rachas.length > 0 ||
    f.accionPreviaDirecta ||
    f.rachaJugador ||
    f.patronPrevio ||
    f.topPorcentaje !== null ||
    f.vsPromedio ||
    (f.contextoPartido && hayContextoPartidoActivo(f.contextoPartido)) ||
    f.variante !== null ||
    f.llamadasInferidas.length > 0 ||
    f.direccionAtaqueInferida.length > 0 ||
    f.sectoresAtaque.length > 0 ||
    f.zonasDefensaRival.length > 0
  );
}

export function hayFiltroAnalisisActivo(f: FiltrosAnalisis): boolean {
  return f.bloques.length > 0;
}