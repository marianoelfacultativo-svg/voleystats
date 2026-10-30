// ============================================================
// HELPERS — Análisis de consecuencias (UI)
// ============================================================
// Funciones puras: resúmenes de racha/bloque, construcción de
// filtros, clases CSS compartidas.
// ============================================================

import {
  etiquetaAmbito,
  etiquetaDireccionAtaque,
  etiquetaLlamadaInferida,
  etiquetaRelacionObservado,
  etiquetaTipoDisparador,
  type FiltrosAnalisis,
  type RachaHistorica,
  type BloqueTriggerFiltro,
  type RelacionJugadorObservado,
  type Ventana,
} from "@/lib/analisisConsecuencias";
import type { ConfiguracionPanel } from "./types";

// ------------------------------------------------------------
// CLASES CSS COMPARTIDAS
// ------------------------------------------------------------

export const selectCls =
  "w-full bg-slate-900 text-white text-[11px] rounded px-2 py-1.5 border border-white/10 focus:outline-none focus:border-slate-400 cursor-pointer";

export const inputCls = selectCls;

export const cardBase: React.CSSProperties = {
  background: "var(--sx-surface-1)",
  border: "1px solid var(--sx-border)",
};

// ------------------------------------------------------------
// RESUMEN DE RACHA
// ------------------------------------------------------------

export function resumenRacha(r: RachaHistorica): string {
  const partes: string[] = [];
  partes.push(etiquetaAmbito(r.ambito));
  partes.push(`≥${r.minimo}`);
  if (r.desdeAtras > 0) partes.push(`saltar ${r.desdeAtras}`);
  if (r.filtro.tipos.length > 0) {
    partes.push(r.filtro.tipos.map((t) => etiquetaTipoDisparador(t)).join("|"));
  } else {
    partes.push("cualquier acción");
  }
  if (r.filtro.resultados.length > 0) partes.push(r.filtro.resultados[0]);
  return partes.join(" · ");
}

// ------------------------------------------------------------
// RESUMEN DE BLOQUE
// ------------------------------------------------------------

export function resumenBloque(b: BloqueTriggerFiltro): string {
  const partes: string[] = [];
  partes.push(etiquetaTipoDisparador(b.tipo));
  if (b.resultado !== "cualquiera") partes.push(b.resultado);
  if (b.variante !== null)
    partes.push(b.variante === "toque" ? "toque" : "remate");
  if (b.llamadasInferidas.length > 0) {
    partes.push(
      b.llamadasInferidas.map((l) => etiquetaLlamadaInferida(l)).join("|")
    );
  }
  if (b.direccionAtaqueInferida.length > 0) {
    partes.push(
      b.direccionAtaqueInferida
        .map((d) => etiquetaDireccionAtaque(d))
        .join("|")
    );
  }
  if (b.jugadorId) partes.push(`jugador`);
  return partes.join(" · ");
}

// ------------------------------------------------------------
// CONSTRUCCIÓN DEL FILTRO DE ANÁLISIS
// ------------------------------------------------------------

export function construirFiltros(
  config: ConfiguracionPanel
): FiltrosAnalisis {
  const esRelacion =
    config.jugadorObservadoFiltro === "cualquiera" ||
    config.jugadorObservadoFiltro === "mismo" ||
    config.jugadorObservadoFiltro === "companero" ||
    config.jugadorObservadoFiltro === "rival";

  const jugadorObservadoRelacion: RelacionJugadorObservado = esRelacion
    ? (config.jugadorObservadoFiltro as RelacionJugadorObservado)
    : "cualquiera";

  const jugadorObservadoId = esRelacion
    ? null
    : config.jugadorObservadoFiltro;

  return {
    bloques: config.bloques,
    tipoObservado: config.tipoObservado,
    jugadorObservadoRelacion,
    jugadorObservadoId,
    alcance: config.alcance,
    ventana: 1 as Ventana,
    coincidencias: config.coincidencias,
  };
}

// Re-export para conveniencia
export { etiquetaRelacionObservado };