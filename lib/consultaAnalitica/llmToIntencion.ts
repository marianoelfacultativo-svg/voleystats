// ============================================================
// LLM → INTENCION QUERY (paso 2.3)
// ============================================================
// Convierte el `ConsultaLLM` (JSON del LLM) en dos cosas:
//   1. `IntencionQuery` — lo que consume `construirRespuesta`.
//   2. `BloqueTriggerFiltro` — lo que consume `aplicarFiltro`
//      en `ejecutor.ts` para filtrar acciones ANTES de la
//      respuesta.
//   3. `jugadorTexto` — el nombre/apodo que dijo el LLM.
//      El caller lo resuelve con `resolverJugador()` y lo
//      inyecta en `filtro.jugadorId`.
//
// El caller (UI o API route) hace:
//   const conversion = llmToIntencion(consultaLLM, texto);
//   if (conversion.tipo === "clarification") → mostrar pregunta
//   if (conversion.tipo === "error") → mostrar error
//   // ok:
//   const filtro = resolverJugadorEnFiltro(conversion, jugadores);
//   const accionesFiltradas = aplicarFiltro(universo, filtro);
//   const resultado = construirRespuesta({
//     acciones: accionesFiltradas,
//     puntos, puntosUniverso,
//     intencion: conversion.intencion,
//     ...
//   });
//
// LIMITACIONES CONOCIDAS (documentadas como TODO):
//   1. `desglose` — el motor no tiene desglose. Por ahora:
//      · Si hay groupBy, se ignora el desglose.
//      · Si NO hay groupBy pero hay desglose, se usa
//        `groupBy: "subtipo"` como aproximación.
//   2. `groupBy` múltiple — `IntencionQuery.groupBy` es un solo
//      valor. Se usa el PRIMERO y se descarta el resto.
//   3. `tipo` de intención — se infiere con heurística
//      (`inferirTipo`). Cubre los casos comunes.
//   4. Filtro de rival / equipo — no implementado aún.
// ============================================================

import {
  intencionVacia,
  type AggFn,
  type DiaSemana,
  type GroupBy,
  type IntencionQuery,
  type TiempoTipo,
  type TipoIntencion,
} from "./intenciones";
import {
  BLOQUE_TRIGGER_VACIO,
  resultadosPorTipoAnalisis,
  type BloqueTriggerFiltro,
  type TipoDisparador,
} from "../analisisConsecuencias";
import type {
  ConsultaLLM,
  GroupByLLM,
  MetricaLLM,
  TiempoTipoLLM,
} from "./llmSchema";

// ------------------------------------------------------------
// TIPOS DE SALIDA
// ------------------------------------------------------------

export type ResultadoConversion =
  | {
      tipo: "ok";
      intencion: IntencionQuery;
      filtro: BloqueTriggerFiltro;
      /** Nombre/apodo que hay que resolver en el caller. */
      jugadorTexto: string | null;
      /** Avisos no bloqueantes (ej. aproximaciones aplicadas). */
      avisos: string[];
    }
  | { tipo: "clarification"; pregunta: string }
  | { tipo: "error"; mensaje: string };

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

function esCualquiera(v: string | null | undefined): boolean {
  return !v || v === "cualquiera";
}

/** Inferir tipo de acción a partir del resultado (para casos donde
 *  el LLM devuelve solo `resultado` sin `tipoAccion`). */
function inferirTipoDeResultado(
  resultado: string | null | undefined
): TipoDisparador | null {
  if (!resultado) return null;
  const r = resultado.toLowerCase();
  if (r === "ace") return "saque";
  if (r === "perfecta" || r === "positiva" || r === "negativa") {
    return "recepcion";
  }
  return null;
}

/** "k1" en el LLM equivale a "side-out" en el motor. */
function normalizarFaseLLM(
  fase: string | null | undefined
): string | null {
  if (esCualquiera(fase)) return null;
  if (fase === "k1") return "side-out";
  return fase!;
}

/** Mapeo directo: el enum LLM ya usa los mismos nombres que el motor. */
function normalizarTiempoTipo(tipo: TiempoTipoLLM): TiempoTipo {
  return tipo as TiempoTipo;
}

// ------------------------------------------------------------
// INFERENCIA DEL TIPO DE INTENCIÓN
// ------------------------------------------------------------
// El LLM NO devuelve `tipo` ni `agregacion`. Hay que inferirlo
// a partir de lo que devolvió (metrica, groupBy, orden, limite).
//
// Reglas (en orden):
//   1. limite=1 + orden       → max (desc) / min (asc)
//   2. orden + groupBy        → ranking
//   3. groupBy (sin orden)    → distribution
//   4. metrica === "count"    → count
//   5. metrica puntos_ganados → count
//   6. metrica %/efficiency   → percentage (avg)
//   7. tiempo con n_partidos  → trend
//   8. default                → count
// ------------------------------------------------------------

function inferirTipo(consulta: ConsultaLLM): {
  tipo: TipoIntencion;
  agregacion: AggFn;
} {
  const tieneLimite1 = consulta.limite === 1;
  const tieneOrden = consulta.orden !== undefined;
  const tieneGroupBy = (consulta.groupBy?.length ?? 0) > 0;
  const metrica = consulta.metrica;

  // 1. top 1 / bottom 1
  if (tieneLimite1 && tieneOrden) {
    return {
      tipo: consulta.orden === "desc" ? "max" : "min",
      agregacion: "count",
    };
  }

  // 2. ranking con orden
  if (tieneOrden && tieneGroupBy) {
    return { tipo: "ranking", agregacion: "count" };
  }

  // 3. distribución
  if (tieneGroupBy) {
    return { tipo: "distribution", agregacion: "count" };
  }

  // 4/5. count
  if (metrica === "count" || metrica === "puntos_ganados") {
    return { tipo: "count", agregacion: "count" };
  }

  // 6. métricas porcentuales
  if (metrica && (metrica.endsWith("_pct") || metrica.endsWith("_efficiency"))) {
    return { tipo: "percentage", agregacion: "avg" };
  }

  // 7. trend con ventana de tiempo (últimos N partidos / sets / jugadas)
  if (
    consulta.tiempo &&
    (consulta.tiempo.tipo === "ultimos_n_partidos" ||
      consulta.tiempo.tipo === "ultimos_n_sets" ||
      consulta.tiempo.tipo === "ultimos_n_jugadas")
  ) {
    return { tipo: "trend", agregacion: "avg" };
  }

  // 8. default
  return { tipo: "count", agregacion: "count" };
}

// ------------------------------------------------------------
// API PRINCIPAL
// ------------------------------------------------------------

export function llmToIntencion(
  consulta: ConsultaLLM,
  textoOriginal: string = ""
): ResultadoConversion {
  // ----------------------------------------------------------
  // 1) Aclaración pedida por el LLM
  // ----------------------------------------------------------
  if (consulta.needsClarification === true) {
    return {
      tipo: "clarification",
      pregunta:
        consulta.pregunta?.trim() ||
        "¿Podés aclarar un poco más tu pedido?",
    };
  }

  // ----------------------------------------------------------
  // 2) Sanity check: tiene que haber algo útil
  // ----------------------------------------------------------
  const tieneFiltros =
    consulta.filtros && Object.keys(consulta.filtros).length > 0;
  const tieneTiempo = !!consulta.tiempo;
  const tieneGroupBy = (consulta.groupBy?.length ?? 0) > 0;
  const tieneMetrica = !!consulta.metrica;

  if (!tieneFiltros && !tieneTiempo && !tieneGroupBy && !tieneMetrica) {
    return {
      tipo: "error",
      mensaje:
        "El LLM no devolvió filtros, tiempo, groupBy ni métrica. " +
        "Reformulá el pedido o revisá el output del LLM.",
    };
  }

  // ----------------------------------------------------------
  // 3) Construir IntencionQuery
  // ----------------------------------------------------------
  const intencion = intencionVacia();
  intencion.original = textoOriginal;

  const avisos: string[] = [];

  // ---- Filtro de acciones (BloqueTriggerFiltro) ----
  const filtro: BloqueTriggerFiltro = { ...BLOQUE_TRIGGER_VACIO };

  // ---- Tipo de acción ----
  const tipoLLM = consulta.filtros?.tipoAccion;
  const tipoInferido = inferirTipoDeResultado(
    consulta.filtros?.resultado
  );

  let tipoFinal: TipoDisparador = "ataque";
  if (!esCualquiera(tipoLLM)) {
    tipoFinal = tipoLLM as TipoDisparador;
  } else if (tipoInferido) {
    tipoFinal = tipoInferido;
    avisos.push(
      `tipoAccion no especificado; inferido "${tipoInferido}" por el resultado.`
    );
  }
  filtro.tipo = tipoFinal;

  // ---- Resultado (validado contra los válidos del tipo) ----
  const resLLM = consulta.filtros?.resultado;
  if (!esCualquiera(resLLM)) {
    const validos = resultadosPorTipoAnalisis(tipoFinal);
    if (validos.includes(resLLM!)) {
      filtro.resultado = resLLM!;
    } else {
      avisos.push(
        `El resultado "${resLLM}" no es válido para el tipo "${tipoFinal}". Se ignora.`
      );
    }
  }

  // ---- Rotación ----
  if (consulta.filtros?.rotacion != null) {
    filtro.rotaciones = [consulta.filtros.rotacion];
  }

  // ---- Zona del jugador ----
  if (consulta.filtros?.zonaJugador != null) {
    filtro.zonasJugador = [consulta.filtros.zonaJugador];
  }

  // ---- Jugador (texto, se resuelve en el caller) ----
  const jugadorTexto = consulta.filtros?.jugador?.trim() || null;

  // ---- Fase del rally → condicion.fase ----
  const faseNormalizada = normalizarFaseLLM(consulta.filtros?.faseRally);
  if (faseNormalizada) {
    if (!intencion.condicion) intencion.condicion = {};
    intencion.condicion.fase = faseNormalizada;
  }

  // ----------------------------------------------------------
  // 4) Tiempo
  // ----------------------------------------------------------
  const setDesdeFiltros = consulta.filtros?.set;

  if (consulta.tiempo) {
    const t: IntencionQuery["tiempo"] = {
      tipo: normalizarTiempoTipo(consulta.tiempo.tipo),
    };
    if (consulta.tiempo.n != null) t!.n = consulta.tiempo.n;
    if (consulta.tiempo.set != null) t!.set = consulta.tiempo.set;
    if (consulta.tiempo.diaSemana != null) {
      t!.diaSemana = consulta.tiempo.diaSemana as DiaSemana;
    }
    // Fusionar filtros.set si el tipo de tiempo lo permite
    if (
      setDesdeFiltros != null &&
      t!.set == null &&
      (t!.tipo === "ultimos_n_partidos" || t!.tipo === "ultimos_n_sets")
    ) {
      t!.set = setDesdeFiltros;
    }
    intencion.tiempo = t;
  } else if (setDesdeFiltros != null) {
    intencion.tiempo = { tipo: "set_especifico", set: setDesdeFiltros };
  }

  // ----------------------------------------------------------
  // 5) GroupBy (solo el primero, limitación del motor)
  // ----------------------------------------------------------
  if (consulta.groupBy && consulta.groupBy.length > 0) {
    intencion.groupBy = consulta.groupBy[0] as GroupBy;
    if (consulta.groupBy.length > 1) {
      avisos.push(
        `El LLM pidió ${consulta.groupBy.length} agrupaciones; ` +
          `el motor solo soporta una. Se usa "${consulta.groupBy[0]}".`
      );
    }
  }

  // ----------------------------------------------------------
  // 6) Desglose (TODO: el motor no lo soporta todavía)
  // ----------------------------------------------------------
  // Aproximación: si pidió desglose y no hay groupBy, usamos
  // `subtipo` como groupBy (lo más parecido a "positivo/negativo/
  // neutro" que el motor sabe hacer). Es una aproximación, no es
  // lo mismo.
  if (
    consulta.desglose &&
    consulta.desglose.length > 0 &&
    !intencion.groupBy
  ) {
    intencion.groupBy = "subtipo";
    avisos.push(
      `El desglose (${consulta.desglose.join(", ")}) no está soportado ` +
        `todavía por el motor. Se aproxima con groupBy: "subtipo".`
    );
  }

  // ----------------------------------------------------------
  // 7) Métrica
  // ----------------------------------------------------------
  // "count" no es una métrica del motor (es tipo de intención).
  // Otras métricas (puntos_ganados, kill_pct, etc.) sí lo son.
  const metricaLLM: MetricaLLM | undefined = consulta.metrica;
  if (metricaLLM && metricaLLM !== "count") {
    intencion.metrica = metricaLLM;
  }

  // ----------------------------------------------------------
  // 8) Orden + límite
  // ----------------------------------------------------------
  if (consulta.orden) {
    intencion.ordenamiento = consulta.orden;
  }
  if (consulta.limite != null) {
    intencion.limite = consulta.limite;
  }

  // ----------------------------------------------------------
  // 9) Tipo + agregación (inferidos)
  // ----------------------------------------------------------
  const { tipo, agregacion } = inferirTipo(consulta);
  intencion.tipo = tipo;
  intencion.agregacion = agregacion;

  // ----------------------------------------------------------
  // 10) Listo
  // ----------------------------------------------------------
  return {
    tipo: "ok",
    intencion,
    filtro,
    jugadorTexto,
    avisos,
  };
}

// ------------------------------------------------------------
// HELPERS DE APOYO PARA EL CALLER
// ------------------------------------------------------------
// `resolverJugadorEnFiltro` se llama después de resolver el
// nombre del jugador (con `resolverJugador()`), porque este
// archivo no tiene acceso a la lista de jugadores.
// ------------------------------------------------------------

/**
 * Inyecta el ID del jugador ya resuelto en el filtro.
 * Devuelve una copia del filtro con `jugadorId` seteado.
 */
export function inyectarJugadorEnFiltro(
  filtro: BloqueTriggerFiltro,
  jugadorId: string | null
): BloqueTriggerFiltro {
  return { ...filtro, jugadorId };
}

// ------------------------------------------------------------
// SERIALIZACIÓN (para debug / logs)
// ------------------------------------------------------------

export function describirConversion(r: ResultadoConversion): string {
  if (r.tipo === "clarification") {
    return `❓ Pregunta: ${r.pregunta}`;
  }
  if (r.tipo === "error") {
    return `❌ Error: ${r.mensaje}`;
  }
  const parts: string[] = [];
  parts.push(`tipo=${r.intencion.tipo}`);
  if (r.intencion.metrica) parts.push(`metrica=${r.intencion.metrica}`);
  if (r.intencion.groupBy) parts.push(`groupBy=${r.intencion.groupBy}`);
  if (r.intencion.tiempo) parts.push(`tiempo=${r.intencion.tiempo.tipo}`);
  if (r.jugadorTexto) parts.push(`jugador="${r.jugadorTexto}"`);
  if (r.avisos.length > 0) parts.push(`avisos=${r.avisos.length}`);
  return parts.join(" | ");
}