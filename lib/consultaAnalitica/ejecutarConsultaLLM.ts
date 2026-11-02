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
// CAMBIOS v2.1 (fix tipos + desglose):
//   + Post-filtro de tipo: si `conversion.tipoExplicito` no
//     es null, filtramos accionesFiltradas por ese tipo. Esto
//     cierra el bug de "el tipo no filtra" (que se dispara
//     siempre que el tipo es "ataque", porque
//     `BLOQUE_TRIGGER_VACIO.tipo === "ataque"`).
//   + `desglose`: si el LLM pidió `desglose` y NO hay
//     `groupBy`, armamos una `RespuestaTabla` con las
//     categorías pedidas (Positivo / Negativo / Neutro) usando
//     `clasificarResultado()`. Devolvemos esa tabla sin pasar
//     por `construirRespuesta`. Si hay `groupBy` también, se
//     prioriza `groupBy` (con aviso ya emitido por
//     `llmToIntencion`).
//   + `DebugConsultaLLM` suma `tipoExplicitoAplicado` y
//     `desgloseAplicado` (opcionales).
//
// Uso:
//   const r = await ejecutarConsultaLLM("cómo atacan en k1", {
//     acciones, puntos, jugadores, partidos,
//   });
//   if (r.tipo === "ok") { ... r.respuesta ... }
//   if (r.tipo === "clarification") { ... r.pregunta ... }
//   if (r.tipo === "ambiguo") { ... r.candidatos ... }
//   if (r.tipo === "error") { ... r.mensaje ... }
// ============================================================

import type {
  AccionVisual,
  PuntoConAcciones,
} from "../../app/equipo/adaptadorUnificadoV2";
import type {
  FilaTabla,
  MetaConsulta,
  RespuestaConsulta,
} from "./tipos";
import { respuestaTabla } from "./tipos";
import type { IntencionQuery } from "./intenciones";
import type {
  BloqueTriggerFiltro,
  TipoDisparador,
} from "../analisis/tipos";
import { clasificarResultado } from "../analisis/clasificacion";
import type {
  ConsultaLLM,
  DesgloseLLM,
} from "./llmSchema";
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
  /** v2.1: tipo que se post-filtró (si hubo). */
  tipoExplicitoAplicado: TipoDisparador | null;
  /** v2.1: ¿se armó tabla de desglose? */
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

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

function contarVisibles(acciones: AccionVisual[]): number {
  return acciones.filter((a) => !a.oculta).length;
}

/** ¿El usuario pidió desglose y NO hay groupBy? Solo en ese caso armamos la tabla. */
function debeAplicarDesglose(
  consulta: ConsultaLLM,
  intencion: IntencionQuery
): boolean {
  const tieneDesglose =
    !!consulta.desglose && consulta.desglose.length > 0;
  if (!tieneDesglose) return false;
  if (intencion.groupBy) return false;
  return true;
}

/**
 * Convierte `DesgloseLLM[]` a las 3 categorías canónicas
 * (`punto` = Positivo, `error` = Negativo, `neutro` = Neutro)
 * sin duplicar.
 */
function normalizarCategorias(
  desglose: DesgloseLLM[]
): ("punto" | "error" | "neutro")[] {
  const out: ("punto" | "error" | "neutro")[] = [];
  for (const d of desglose) {
    if (d === "positivo" || d === "punto") {
      if (!out.includes("punto")) out.push("punto");
    } else if (d === "negativo" || d === "error") {
      if (!out.includes("error")) out.push("error");
    } else if (d === "neutro") {
      if (!out.includes("neutro")) out.push("neutro");
    }
  }
  return out;
}

/**
 * Construye una `RespuestaTabla` con las categorías pedidas,
 * contando acciones por `clasificarResultado()`.
 *
 * IMPORTANTE: asume que `acciones` ya viene filtrado por
 * `aplicarFiltro` + post-filtro de tipo. NO vuelve a filtrar.
 */
function construirRespuestaDesglose(
  acciones: AccionVisual[],
  desglose: DesgloseLLM[],
  intencion: IntencionQuery,
  totalUniverso: number
): { respuesta: RespuestaConsulta; meta: MetaConsulta } {
  const categorias = normalizarCategorias(desglose);

  const labelPorCat: Record<"punto" | "error" | "neutro", string> = {
    punto: "Positivo",
    error: "Negativo",
    neutro: "Neutro",
  };

  const visibles = acciones.filter((a) => !a.oculta);
  const total = visibles.length;

  const conteos: Record<"punto" | "error" | "neutro", number> = {
    punto: 0,
    error: 0,
    neutro: 0,
  };

  for (const a of visibles) {
    const cat = clasificarResultado(a);
    conteos[cat]++;
  }

  const filas: FilaTabla[] = categorias.map((cat) => ({
    key: cat,
    label: labelPorCat[cat],
    count: conteos[cat],
    base: total > 0 ? total : null,
    valor: conteos[cat],
    porcentaje:
      total > 0 ? Math.round((conteos[cat] / total) * 1000) / 10 : 0,
    extra: null,
  }));

  const totalFila: FilaTabla = {
    key: "TOTAL",
    label: "TOTAL",
    count: total,
    base: total > 0 ? total : null,
    valor: total,
    porcentaje: total > 0 ? 100 : 0,
    extra: null,
  };

  const respuesta = respuestaTabla(
    filas,
    null,
    "count",
    totalFila,
    `Desglose en ${categorias.length} categoría${
      categorias.length !== 1 ? "s" : ""
    } sobre ${total} acción${total !== 1 ? "es" : ""}.`
  );

  const meta: MetaConsulta = {
    original: intencion.original,
    intencion: intencion.tipo,
    agregacion: "count",
    groupBy: null,
    metrica: intencion.metrica,
    totalAcciones: total,
    totalUniverso,
  };

  return { respuesta, meta };
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
  let accionesFiltradas = aplicarFiltro(accionesConTiempo, filtro);

  // ----------------------------------------------------------
  // 5.b) FIX v2.1: post-filtro de tipo
  // ----------------------------------------------------------
  // `aplicarFiltro` del motor viejo devuelve TODO si considera
  // el filtro "vacío", y eso pasa siempre que `filtro.tipo`
  // coincide con `BLOQUE_TRIGGER_VACIO.tipo` (= "ataque"). Así
  // que si el LLM pidió un tipo explícito, forzamos el filtro
  // acá.
  // ----------------------------------------------------------
  if (conversion.tipoExplicito) {
    accionesFiltradas = accionesFiltradas.filter(
      (a) => a.tipo === conversion.tipoExplicito
    );
  }

  // ----------------------------------------------------------
  // 6) Desglose (fix v2.1)
  // ----------------------------------------------------------
  // Si el LLM pidió `desglose` Y no hay `groupBy`, armamos una
  // tabla con las categorías pedidas (Positivo / Negativo /
  // Neutro) y devolvemos directo, SIN pasar por
  // `construirRespuesta`.
  // ----------------------------------------------------------
  const desgloseAplicado = debeAplicarDesglose(
    traduccion.consulta,
    conversion.intencion
  );

  if (desgloseAplicado) {
    const totalUniverso = contarVisibles(universoAcciones);
    const { respuesta, meta } = construirRespuestaDesglose(
      accionesFiltradas,
      traduccion.consulta.desglose!,
      conversion.intencion,
      totalUniverso
    );

    return {
      tipo: "ok",
      respuesta,
      meta,
      fragmentos: conversion.intencion.fragmentos,
      avisos: conversion.avisos,
      debug: {
        promptOriginal: prompt,
        consultaLLM: traduccion.consulta,
        intentosTraduccion: traduccion.intentos,
        intencionFinal: conversion.intencion,
        filtroFinal: filtro,
        jugadorResuelto,
        accionesFiltradas: contarVisibles(accionesFiltradas),
        accionesUniverso: totalUniverso,
        conversion,
        tipoExplicitoAplicado: conversion.tipoExplicito,
        desgloseAplicado: true,
      },
    };
  }

  // ----------------------------------------------------------
  // 7) Construir respuesta (flujo normal)
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
  // 8) Devolver
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
      tipoExplicitoAplicado: conversion.tipoExplicito,
      desgloseAplicado: false,
    },
  };
}