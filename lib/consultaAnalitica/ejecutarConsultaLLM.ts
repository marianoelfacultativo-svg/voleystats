// ============================================================
// EJECUTAR CONSULTA LLM (paso 2.4.b)
// ============================================================
// Orquesta el flujo completo:
//   prompt → LLM (Groq) → JSON → IntencionQuery + filtro
//   → aplicarFiltro → construirRespuesta → resultado
//
// ⚠️  SERVER-SIDE ONLY. Importa `traducirPrompt` que lee
//     `GROQ_API_KEY`. Nunca importar desde un componente
//     "use client".
//
// Uso:
//   const r = await ejecutarConsultaLLM("cómo atacan en k1", {
//     acciones, puntos, jugadores, partidos,
//   });
//   if (r.tipo === "ok") { ... r.respuesta ... }
//   if (r.tipo === "clarification") { ... r.pregunta ... }
//   if (r.tipo === "ambiguo") { ... r.candidatos ... }
//   if (r.tipo === "error") { ... r.mensaje ... }
//
// Este archivo NO reemplaza `ejecutarConsulta()` (flujo por
// parser viejo). Conviven: `ejecutarConsulta` usa el parser
// de diccionarios; `ejecutarConsultaLLM` usa Groq.
// ============================================================

import type {
  AccionVisual,
  PuntoConAcciones,
} from "../../app/equipo/adaptadorUnificadoV2";
import type {
  MetaConsulta,
  RespuestaConsulta,
} from "./tipos";
import type { IntencionQuery } from "./intenciones";
import type { BloqueTriggerFiltro } from "../analisis/tipos";
import type { ConsultaLLM } from "./llmSchema";
import type { JugadorParaResolver } from "./resolverJugador";
import { resolverJugador } from "./resolverJugador";
import { traducirPrompt } from "./llmTranslator";
import {
  llmToIntencion,
  inyectarJugadorEnFiltro,
  type ResultadoConversion,
} from "./llmToIntencion";
import {
  aplicarFiltro,
  filtrarPorTiempo,
  filtrarPuntosPorTiempo,
} from "./ejecutor";
import {
  calcularCrucesPorPunto,
  calcularResultadosPunto,
} from "./groupBy";
import { construirRespuesta, type ContextoRespuesta } from "./respuesta";

// ------------------------------------------------------------
// TIPOS
// ------------------------------------------------------------

export interface ContextoEjecutorLLM {
  acciones: AccionVisual[];
  puntos?: PuntoConAcciones[];
  jugadores?: JugadorParaResolver[];
  partidos?: { id: string; nombre: string; fecha?: string }[];
}

export interface DebugConsultaLLM {
  promptOriginal: string;
  consultaLLM: ConsultaLLM;
  intentosTraduccion: number;
  intencionFinal: IntencionQuery;
  filtroFinal: BloqueTriggerFiltro;
  jugadorResuelto: { id: string; nombre: string } | null;
  accionesFiltradas: number;
  accionesUniverso: number;
  conversion: ResultadoConversion | null;
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

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

function contarVisibles(acciones: AccionVisual[]): number {
  return acciones.filter((a) => !a.oculta).length;
}

// ------------------------------------------------------------
// API PRINCIPAL
// ------------------------------------------------------------

export async function ejecutarConsultaLLM(
  prompt: string,
  contexto: ContextoEjecutorLLM
): Promise<ResultadoConsultaLLM> {
  const promptLimpio = prompt.trim();
  if (!promptLimpio) {
    return {
      tipo: "error",
      mensaje: "El prompt está vacío.",
      promptOriginal: prompt,
    };
  }

  // ----------------------------------------------------------
  // 1) LLM → JSON
  // ----------------------------------------------------------
  const traduccion = await traducirPrompt(promptLimpio);
  if (!traduccion.ok) {
    return {
      tipo: "error",
      mensaje: `No se pudo traducir el prompt: ${traduccion.error}`,
      promptOriginal: prompt,
    };
  }

  // ----------------------------------------------------------
  // 2) JSON → IntencionQuery + Filtro
  // ----------------------------------------------------------
  const conversion = llmToIntencion(traduccion.consulta, promptLimpio);

  if (conversion.tipo === "clarification") {
    return {
      tipo: "clarification",
      pregunta: conversion.pregunta,
      promptOriginal: prompt,
    };
  }
  if (conversion.tipo === "error") {
    return {
      tipo: "error",
      mensaje: conversion.mensaje,
      promptOriginal: prompt,
      debug: {
        promptOriginal: prompt,
        consultaLLM: traduccion.consulta,
        intentosTraduccion: traduccion.intentos,
      } as Partial<DebugConsultaLLM>,
    };
  }

  // ----------------------------------------------------------
  // 3) Resolver jugador (si el LLM devolvió uno)
  // ----------------------------------------------------------
  let filtro = conversion.filtro;
  let jugadorResuelto: { id: string; nombre: string } | null = null;

  if (conversion.jugadorTexto) {
    if (!contexto.jugadores || contexto.jugadores.length === 0) {
      return {
        tipo: "error",
        mensaje:
          `Necesito la lista de jugadores para resolver ` +
          `"${conversion.jugadorTexto}".`,
        promptOriginal: prompt,
      };
    }

    const r = resolverJugador(conversion.jugadorTexto, contexto.jugadores);

    if (r.motivo === "ambiguo") {
      return {
        tipo: "ambiguo",
        aviso: `"${conversion.jugadorTexto}" coincide con varios jugadores.`,
        candidatos: r.candidatos,
        promptOriginal: prompt,
      };
    }

    if (r.motivo !== "unico") {
      return {
        tipo: "error",
        mensaje: `No encontré a "${conversion.jugadorTexto}" en la lista de jugadores.`,
        promptOriginal: prompt,
      };
    }

    filtro = inyectarJugadorEnFiltro(filtro, r.ids[0]);
    const j = contexto.jugadores.find((x) => x.id === r.ids[0]);
    jugadorResuelto = j ? { id: j.id, nombre: j.nombre } : null;
  }

  // ----------------------------------------------------------
  // 4) Filtrar por tiempo (sobre acciones y puntos)
  // ----------------------------------------------------------
  const universoAcciones = contexto.acciones ?? [];
  const universoPuntos = contexto.puntos ?? [];

  const accionesConTiempo = filtrarPorTiempo(
    universoAcciones,
    conversion.intencion,
    contexto.partidos
  );
  const puntosConTiempo = filtrarPuntosPorTiempo(
    universoPuntos,
    conversion.intencion,
    contexto.partidos
  );

  // ----------------------------------------------------------
  // 5) Aplicar filtro (tipo, resultado, jugador, rotación, etc.)
  // ----------------------------------------------------------
  const accionesFiltradas = aplicarFiltro(accionesConTiempo, filtro);

  // ----------------------------------------------------------
  // 6) Construir respuesta
  // ----------------------------------------------------------
  const crucesPorPunto = calcularCrucesPorPunto(universoAcciones);
  const resultadosPunto = calcularResultadosPunto(universoAcciones);

  const ctxRespuesta: ContextoRespuesta = {
    acciones: accionesFiltradas,
    puntos: puntosConTiempo,
    puntosUniverso: universoPuntos,
    intencion: conversion.intencion,
    contextoAgrupacion: {
      nombreDeJugador: contexto.jugadores
        ? (id) => {
            const j = contexto.jugadores!.find((x) => x.id === id);
            return j ? j.nombre : id.slice(0, 8);
          }
        : undefined,
      nombreDePartido: contexto.partidos
        ? (id) => {
            const p = contexto.partidos!.find((x) => x.id === id);
            return p ? p.nombre : id.slice(0, 8);
          }
        : undefined,
      rivalDePartido: contexto.partidos
        ? (id) => {
            const p = contexto.partidos!.find((x) => x.id === id);
            return p ? p.nombre : id.slice(0, 8);
          }
        : undefined,
      resultadosPunto,
      crucesPorPunto,
    },
    jugadores: contexto.jugadores,
    partidos: contexto.partidos,
    totalUniverso: contarVisibles(universoAcciones),
  };

  const resultado = construirRespuesta(ctxRespuesta);

  // ----------------------------------------------------------
  // 7) Devolver
  // ----------------------------------------------------------
  return {
    tipo: "ok",
    respuesta: resultado.respuesta,
    meta: resultado.meta,
    fragmentos: resultado.fragmentos,
    avisos: conversion.avisos,
    debug: {
      promptOriginal: prompt,
      consultaLLM: traduccion.consulta,
      intentosTraduccion: traduccion.intentos,
      intencionFinal: conversion.intencion,
      filtroFinal: filtro,
      jugadorResuelto,
      accionesFiltradas: contarVisibles(accionesFiltradas),
      accionesUniverso: contarVisibles(universoAcciones),
      conversion,
    },
  };
}