// ============================================================
// LLM TO PIPELINE — Validación semántica y preparación del pipeline
// ============================================================

import type { ConsultaPipeline, FiltroExpr } from "./pipelineSchema";
import {
  CAMPOS_ACCION,
  CAMPOS_PUNTO,
  esConsultaPipelineValida,
} from "./pipelineSchema";

export type ResultadoLLMToPipeline =
  | { tipo: "ok"; pipeline: ConsultaPipeline }
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

  return {
    tipo: "ok",
    pipeline: consulta,
  };
}