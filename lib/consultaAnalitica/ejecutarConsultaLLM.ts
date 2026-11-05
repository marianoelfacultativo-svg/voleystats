// ============================================================
// EJECUTAR CONSULTA LLM — Orquestador del nuevo Pipeline Universal
// ============================================================
// Orquesta el flujo de interpretación y ejecución analítica:
//   prompt → Groq (ConsultaPipeline) → llmToPipeline
//   → ejecutarPipeline → ResultadoConsultaLLM
//
// ⚠️  SERVER-SIDE ONLY. Importa `traducirPrompt` que lee
//     `GROQ_API_KEY`. Nunca importar desde un componente
//     "use client".
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
import { traducirPrompt } from "./llmTranslator";
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
      promptOriginal: string;
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

export async function ejecutarConsultaLLM(
  prompt: string,
  contexto: ContextoEjecutorLLM
): Promise<ResultadoConsultaLLM> {
  const promptLimpio = prompt.trim();
  if (!promptLimpio) {
    return {
      tipo: "error",
      mensaje: "La consulta está vacía.",
      promptOriginal: prompt,
    };
  }

  // 1. Traducir el prompt con Groq a ConsultaPipeline
  const traduccion = await traducirPrompt(promptLimpio);
  if (!traduccion.ok) {
    return {
      tipo: "error",
      mensaje: traduccion.error,
      promptOriginal: promptLimpio,
    };
  }

  const pipelineRaw = traduccion.pipeline;

  // 2. Validar estructura semántica del pipeline
  const validado = llmToPipeline(pipelineRaw);
  if (validado.tipo === "clarification") {
    return {
      tipo: "clarification",
      pregunta: validado.pregunta,
      promptOriginal: promptLimpio,
    };
  }
  if (validado.tipo === "error") {
    return {
      tipo: "error",
      mensaje: validado.mensaje,
      promptOriginal: promptLimpio,
    };
  }

  const pipeline = validado.pipeline;

  // 3. Ejecutar el pipeline
  const respuesta = ejecutarPipeline(pipeline, {
    acciones: contexto.acciones,
    puntos: contexto.puntos,
    jugadores: contexto.jugadores,
    partidos: contexto.partidos,
  });

  // 4. Conteo de acciones para compatibilidad con UI
  const totalAccionesUniverso = contexto.acciones.filter((a) => !a.oculta).length;
  const { filtradas, total } = calcularFiltradasYTotal(
    respuesta,
    pipeline.entidad_base === "puntos"
      ? (contexto.puntos?.length ?? totalAccionesUniverso)
      : totalAccionesUniverso
  );

  const fragmentos = armarFragmentos(pipeline);
  const avisos: string[] = [];

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
    intentosTraduccion: traduccion.intentos,
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
    meta,
    fragmentos,
    avisos,
    debug,
  };
}
