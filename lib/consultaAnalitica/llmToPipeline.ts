// ============================================================
// LLM TO PIPELINE — Validación semántica y preparación del pipeline
// ============================================================
// v48.1 (Bloque 3a): agrega `advertencias?: string[]` al resultado ok.
//   Si el LLM no devolvió `explain`, se emite warning NO bloqueante:
//   la consulta sigue funcionando, pero se avisa para que la UI
//   pueda mostrar el detalle técnico.
// ============================================================

import type { ConsultaPipeline, FiltroExpr } from "./pipelineSchema";
import {
  CAMPOS_ACCION,
  CAMPOS_PUNTO,
  esConsultaPipelineValida,
} from "./pipelineSchema";

export type ResultadoLLMToPipeline =
  | { tipo: "ok"; pipeline: ConsultaPipeline; advertencias?: string[] }
  | { tipo: "clarification"; pregunta: string }
  | { tipo: "error"; mensaje: string };

function validarExpr(expr: FiltroExpr, camposValidos: readonly string[]): string | null {
  switch (expr.kind) {
    case "filter":
      if (!camposValidos.includes(expr.campo)) {
        return `El campo de filtro '${expr.campo}' no es válido para la entidad.`;
      }
      return null;
    case "and":
    case "or":
      for (const c of expr.children) {
        const err = validarExpr(c, camposValidos);
        if (err) return err;
      }
      return null;
    case "not":
      return validarExpr(expr.child, camposValidos);
  }
}

export function llmToPipeline(consulta: ConsultaPipeline): ResultadoLLMToPipeline {
  if (consulta.needsClarification) {
    return {
      tipo: "clarification",
      pregunta:
        consulta.preguntaClarificacion ??
        "Por favor, especificá más detalles sobre la consulta requerida.",
    };
  }

  if (!esConsultaPipelineValida(consulta)) {
    return {
      tipo: "error",
      mensaje: "El JSON generado no cumple con el esquema estructural de ConsultaPipeline.",
    };
  }

  const camposValidos: readonly string[] =
    consulta.entidad_base === "puntos" ? CAMPOS_PUNTO : CAMPOS_ACCION;

  // 1. Validar filtros legacy (Filtro[])
  if (consulta.filtros && Array.isArray(consulta.filtros)) {
    for (const f of consulta.filtros) {
      if (!camposValidos.includes(f.campo)) {
        return {
          tipo: "error",
          mensaje: `El campo de filtro '${f.campo}' no es válido para la entidad '${consulta.entidad_base}'.`,
        };
      }
    }
  }

  // 1b. Validar filtro nuevo (AST o array)
  if (consulta.filtro) {
    if (Array.isArray(consulta.filtro)) {
      for (const f of consulta.filtro) {
        if (!camposValidos.includes(f.campo)) {
          return {
            tipo: "error",
            mensaje: `El campo de filtro '${f.campo}' no es válido para la entidad '${consulta.entidad_base}'.`,
          };
        }
      }
    } else {
      const err = validarExpr(consulta.filtro, camposValidos);
      if (err) return { tipo: "error", mensaje: err };
    }
  }

  // 2. Validar campo de agrupación
  if (consulta.agrupacion?.campo) {
    if (!camposValidos.includes(consulta.agrupacion.campo)) {
      return {
        tipo: "error",
        mensaje: `El campo de agrupación '${consulta.agrupacion.campo}' no es válido para la entidad '${consulta.entidad_base}'.`,
      };
    }
  }

  // 3. Validar métricas que requieren campo
  if (consulta.metrica.tipo === "sum" || consulta.metrica.tipo === "avg") {
    if (!consulta.metrica.campo) {
      return {
        tipo: "error",
        mensaje: `La métrica '${consulta.metrica.tipo}' requiere especificar un 'campo' numérico (ej. 'puntaje').`,
      };
    }
    if (!camposValidos.includes(consulta.metrica.campo)) {
      return {
        tipo: "error",
        mensaje: `El campo '${consulta.metrica.campo}' para la métrica no es válido en '${consulta.entidad_base}'.`,
      };
    }
  }

  // 4. v48.1 (Bloque 3a) — Warning NO bloqueante si falta explain.
  //    La consulta funciona igual; solo avisamos para que la UI
  //    pueda mostrar el detalle técnico.
  const advertencias: string[] = [];
  const explainValido =
    typeof consulta.explain === "string" && consulta.explain.trim().length > 0;

  if (!explainValido) {
    advertencias.push(
      "El LLM no devolvió 'explain'. La consulta funciona igual, pero la UI no podrá mostrar la interpretación en lenguaje natural."
    );
    // eslint-disable-next-line no-console
    console.warn(
      "[llmToPipeline] Falta 'explain' en la consulta. El LLM no explicó cómo la interpretó.",
      consulta
    );
  }

  if (advertencias.length > 0) {
    return { tipo: "ok", pipeline: consulta, advertencias };
  }
  return { tipo: "ok", pipeline: consulta };
}