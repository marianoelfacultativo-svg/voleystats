// ============================================================
// EJECUTAR CONSULTA LLM — Orquestador del nuevo Pipeline Universal
// ============================================================
// v2.2 (fix explain): surfacea pipeline.explain al top-level de
//   ResultadoConsultaLLM.ok y propaga advertencias del validador
//   (Bloque 3a) a avisos[].
// ============================================================

import type {
  AccionVisual,
  PuntoConAcciones,
} from "../../app/equipo/adaptadorUnificadoV2";
import type {
  MetaConsulta,
  RespuestaConsulta,
} from "./tipos";
import type { ConsultaPipeline } from "./pipelineSchema";
import type { JugadorParaResolver } from "./resolverJugador";
import type { BloqueTriggerFiltro } from "../analisis/tipos";
import type {
  AggFn,
  GroupBy,
  IntencionQuery,
  TipoIntencion,
} from "./intenciones";
import {
  traducirPrompt,
  traducirPromptConCorreccion,
} from "./llmTranslator";
import { llmToPipeline } from "./llmToPipeline";
import { ejecutarPipeline } from "./pipelineEngine";

export interface ContextoEjecutorLLM {
  acciones: AccionVisual[];
  puntos?: PuntoConAcciones[];
  jugadores?: JugadorParaResolver[];
  partidos?: Array<{
    id: string;
    nombre: string;
    fecha?: string;
    setGanados?: (boolean | null)[];
    resultado?: "ganado" | "perdido" | null;
  }>;
}

export interface DebugConsultaLLM {
  promptOriginal: string;
  consultaLLM: ConsultaPipeline;
  intentosTraduccion: number;
  intencionFinal: IntencionQuery | null;
  filtroFinal: BloqueTriggerFiltro | null;
  jugadorResuelto: { id: string; nombre: string } | null;
  accionesFiltradas: number;
  accionesUniverso: number;
  conversion: null;
  tipoExplicitoAplicado: null;
  desgloseAplicado: boolean;
}

export type ResultadoConsultaLLM =
  | {
      tipo: "ok";
      respuesta: RespuestaConsulta;
      explain?: string;
      meta: MetaConsulta;
      fragmentos: string[];
      avisos: string[];
      debug: DebugConsultaLLM;
    }
  | {
      tipo: "clarification";
      pregunta: string;
      promptOriginal: string;
    }
  | {
      tipo: "ambiguo";
      aviso: string;
      candidatos: JugadorParaResolver[];
      promptOriginal: string;
    }
  | {
      tipo: "error";
      mensaje: string;
      errorTecnico: string;
      promptOriginal: string;
      intentos: number;
      pipelineIntentos: ConsultaPipeline[];
      debug?: Partial<DebugConsultaLLM>;
    };

const GROUP_BY_VALIDOS = new Set<GroupBy>([
  "set",
  "partido",
  "jugador",
  "zona_origen",
  "zona_destino",
  "zona_jugador",
  "rotacion",
  "rol",
  "ubicacion",
  "fase",
  "rival",
]);

function normalizarGroupBy(campo?: string): GroupBy | null {
  if (!campo) return null;
  if (GROUP_BY_VALIDOS.has(campo as GroupBy)) return campo as GroupBy;
  if (campo === "jugador_id") return "jugador";
  if (campo === "set_numero") return "set";
  if (campo === "rotacion_numero") return "rotacion";
  if (campo === "rol_jugador") return "rol";
  if (campo === "partido_id") return "partido";
  if (campo === "fase_rally") return "fase";
  return null;
}

function mapearTipoIntencion(tipoMetrica: string): TipoIntencion {
  switch (tipoMetrica) {
    case "avg":
      return "average";
    case "percentage":
    case "efficiency":
      return "percentage";
    case "count":
    case "sum":
    default:
      return "count";
  }
}

function mapearAggFn(tipoMetrica: string): AggFn {
  switch (tipoMetrica) {
    case "sum":
      return "sum";
    case "avg":
      return "avg";
    case "percentage":
      return "percentage";
    case "efficiency":
      return "ratio";
    case "count":
    default:
      return "count";
  }
}

function armarFragmentos(pipeline: ConsultaPipeline): string[] {
  const fragmentos: string[] = [];
  fragmentos.push(`Entidad: ${pipeline.entidad_base}`);
  if (pipeline.filtros && pipeline.filtros.length > 0) {
    for (const f of pipeline.filtros) {
      fragmentos.push(`${f.campo} ${f.operador} ${String(f.valor)}`);
    }
  }
  if (pipeline.agrupacion?.campo) {
    fragmentos.push(`agrupado por ${pipeline.agrupacion.campo}`);
  }
  fragmentos.push(`métrica: ${pipeline.metrica.tipo}`);
  return fragmentos;
}

function calcularFiltradasYTotal(
  respuesta: RespuestaConsulta,
  universoTotal: number
): { filtradas: number; total: number } {
  if (respuesta.tipo === "numero") {
    return { filtradas: respuesta.valor, total: universoTotal };
  }
  if (respuesta.tipo === "porcentaje" || respuesta.tipo === "frecuencia") {
    const totalBase =
      typeof respuesta.base === "number" ? respuesta.base : universoTotal;
    return { filtradas: respuesta.count, total: totalBase };
  }
  if (respuesta.tipo === "promedio") {
    return { filtradas: respuesta.n, total: universoTotal };
  }
  if (respuesta.tipo === "tabla") {
    const totalFilas =
      respuesta.total?.count ??
      respuesta.filas.reduce((acc, f) => acc + f.count, 0);
    const totalBase =
      typeof respuesta.total?.base === "number"
        ? respuesta.total.base
        : universoTotal;
    return { filtradas: totalFilas, total: totalBase };
  }
  if (respuesta.tipo === "ranking") {
    const totalFilas = respuesta.filas.reduce((acc, f) => acc + f.count, 0);
    return { filtradas: totalFilas, total: universoTotal };
  }
  return { filtradas: 0, total: universoTotal };
}

// Helper: pipeline YA validado → ejecutar y armar respuesta ok
// v2.2: recibe advertencias del validador (Bloque 3a) y surfacea explain.
function ejecutarYArmarRespuesta(
  pipeline: ConsultaPipeline,
  intentosTraduccion: number,
  promptLimpio: string,
  contexto: ContextoEjecutorLLM,
  advertenciasValidador: string[] = []
): ResultadoConsultaLLM {
  const respuesta = ejecutarPipeline(pipeline, {
    acciones: contexto.acciones,
    puntos: contexto.puntos,
    jugadores: contexto.jugadores,
    partidos: contexto.partidos,
  });

  const totalAccionesUniverso = contexto.acciones.filter(
    (a) => !a.oculta
  ).length;
  const { filtradas, total } = calcularFiltradasYTotal(
    respuesta,
    pipeline.entidad_base === "puntos"
      ? contexto.puntos?.length ?? totalAccionesUniverso
      : totalAccionesUniverso
  );

  const fragmentos = armarFragmentos(pipeline);
  const avisos: string[] = [...advertenciasValidador];

  const meta: MetaConsulta = {
    original: promptLimpio,
    intencion: mapearTipoIntencion(pipeline.metrica.tipo),
    agregacion: mapearAggFn(pipeline.metrica.tipo),
    groupBy: normalizarGroupBy(pipeline.agrupacion?.campo),
    metrica: pipeline.metrica.tipo,
    totalAcciones: filtradas,
    totalUniverso: total,
  };

  const debug: DebugConsultaLLM = {
    promptOriginal: promptLimpio,
    consultaLLM: pipeline,
    intentosTraduccion,
    intencionFinal: null,
    filtroFinal: null,
    jugadorResuelto: null,
    accionesFiltradas: filtradas,
    accionesUniverso: total,
    conversion: null,
    tipoExplicitoAplicado: null,
    desgloseAplicado: false,
  };

  return {
    tipo: "ok",
    respuesta,
    explain: pipeline.explain || undefined,
    meta,
    fragmentos,
    avisos,
    debug,
  };
}

// ------------------------------------------------------------
// ORQUESTADOR PRINCIPAL (con retry del Bloque 3b)
// ------------------------------------------------------------

export async function ejecutarConsultaLLM(
  prompt: string,
  contexto: ContextoEjecutorLLM
): Promise<ResultadoConsultaLLM> {
  const promptLimpio = prompt.trim();
  if (!promptLimpio) {
    return {
      tipo: "error",
      mensaje: "La consulta está vacía.",
      errorTecnico: "Prompt vacío.",
      promptOriginal: prompt,
      intentos: 0,
      pipelineIntentos: [],
    };
  }

  // ── Paso 1: traducción inicial (Groq)
  const traduccion1 = await traducirPrompt(promptLimpio);
  if (!traduccion1.ok) {
    return {
      tipo: "error",
      mensaje:
        "No pude interpretar tu consulta. Probá de nuevo en unos segundos.",
      errorTecnico: `Traducción inicial falló: ${traduccion1.error}`,
      promptOriginal: promptLimpio,
      intentos: traduccion1.intentos,
      pipelineIntentos: [],
    };
  }

  const pipeline1 = traduccion1.pipeline;

  // ── Paso 2: validación semántica (intento 1)
  const validado1 = llmToPipeline(pipeline1);
  if (validado1.tipo === "clarification") {
    return {
      tipo: "clarification",
      pregunta: validado1.pregunta,
      promptOriginal: promptLimpio,
    };
  }
  if (validado1.tipo === "ok") {
    return ejecutarYArmarRespuesta(
      validado1.pipeline,
      traduccion1.intentos,
      promptLimpio,
      contexto,
      validado1.advertencias ?? []
    );
  }

  // ── Paso 3: retry 1x con error específico (Bloque 3b)
  const errorValidacion1 = validado1.mensaje;
  const traduccion2 = await traducirPromptConCorreccion(
    promptLimpio,
    pipeline1,
    errorValidacion1
  );

  if (!traduccion2.ok) {
    return {
      tipo: "error",
      mensaje:
        "No pude interpretar tu consulta. Probá reformularla o hacela más específica.",
      errorTecnico: `Intento 1 (validación): ${errorValidacion1} | Retry (Groq): ${traduccion2.error}`,
      promptOriginal: promptLimpio,
      intentos: traduccion1.intentos + traduccion2.intentos,
      pipelineIntentos: [pipeline1],
    };
  }

  const validado2 = llmToPipeline(traduccion2.pipeline);
  if (validado2.tipo === "clarification") {
    return {
      tipo: "clarification",
      pregunta: validado2.pregunta,
      promptOriginal: promptLimpio,
    };
  }
  if (validado2.tipo === "ok") {
    return ejecutarYArmarRespuesta(
      validado2.pipeline,
      traduccion1.intentos + traduccion2.intentos,
      promptLimpio,
      contexto,
      validado2.advertencias ?? []
    );
  }

  // ── Paso 4: falló también el retry → error definitivo
  return {
    tipo: "error",
    mensaje:
      "No pude interpretar tu consulta. Probá reformularla o hacela más específica.",
    errorTecnico: `Intento 1 (validación): ${errorValidacion1} | Intento 2 (validación): ${validado2.mensaje}`,
    promptOriginal: promptLimpio,
    intentos: traduccion1.intentos + traduccion2.intentos,
    pipelineIntentos: [pipeline1, traduccion2.pipeline],
  };
}