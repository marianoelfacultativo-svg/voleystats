// ============================================================
// VALORACIÓN VISUAL — fuente única de verdad para pos/neu/neg
// ============================================================
// Helper que devuelve la clasificación visual ("pos" | "neu" | "neg")
// de una acción, usando el catálogo pipeline como fuente única de
// verdad.
//
// Lo usan los componentes de UI que muestran gráficos de barras por
// fundamento (MiEquipo, GraficoBarrasFundamentoPartidos, PanelFiltros3D).
// ============================================================

import { infoDeSubtipoPipeline } from "../consultaAnalitica/pipelineSchema";

export type ValoracionVisual = "pos" | "neu" | "neg";

export function valoracionVisualDeAccion(
  fundamento: string,
  subtipo: string | number | null | undefined
): ValoracionVisual {
  const info = infoDeSubtipoPipeline(fundamento, subtipo, false);
  return info.valoracion;
}
