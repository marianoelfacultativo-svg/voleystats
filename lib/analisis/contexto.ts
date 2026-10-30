// ============================================================
// CONTEXTO DEL PARTIDO
// ============================================================
// Extraído de lib/analisisConsecuencias.ts (v9).
//
// Funciones puras:
//   - hayContextoPartidoActivo(ctx): ¿el filtro de contexto tiene
//     algún campo activo? Se usa para saber si hay que calcular el
//     contexto del rally.
//   - matcheaFase(ctxFase, filtroFase): "contraataque" legacy
//     matchea k2 o k3.
//   - cumpleContextoPartido(ctx, filtro, posicionEnSet): evalúa si
//     el contexto de una acción cumple el filtro.
// ============================================================

import type { ContextoRally, FaseRally } from "../contextoRally";
import type { ContextoPartidoFiltro } from "./tipos";

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

function matcheaFase(ctxFase: FaseRally, filtroFase: FaseRally): boolean {
  if (filtroFase === "contraataque") {
    return ctxFase === "contraataque" || ctxFase === "k2" || ctxFase === "k3";
  }
  return ctxFase === filtroFase;
}

export function cumpleContextoPartido(
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

  if (filtro.faseRally !== "cualquiera") {
    if (!matcheaFase(ctx.fase, filtro.faseRally)) return false;
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