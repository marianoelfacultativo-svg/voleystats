// ============================================================
// RESPUESTA — response builder
// ============================================================
// FASE 4 + FASE 6 del plan "Consultas Analíticas Libres".
//
// v1.5 (FASE 6 — Rondas 1.2 + 1.3 + 2):
//   + `aplicarCondicionesExtra(ctx)`: filtra acciones por
//     `condicion.fase` (usando contextoRally) y `condicion.salidaRol`.
//     Filtra puntos por `condicion.fase`.
//   + `frasePidePuntos(original)`: detecta "puntos" sin "por".
//   + `ejecutarMaxMin` / `ejecutarRanking` usan
//     `puntosPorDimension` (rallies ganados) cuando el groupBy
//     es dimensionable por puntos y la frase pide puntos.
//     Antes "qué rotación hace más puntos" contaba ACCIONES.
//
// v1.4 (Ronda 1.1):
//   + `agregacionEfectiva(ctx)`: max/min/ranking con "mejor"/"peor"
//     usan "avg" (calidad) en vez de "count" (cantidad).
//
// v1.3 (bloque A.2):
//   + habit "cómo terminan los puntos/rallys" → resultado_punto.
//   + puntos_ganados_pct.
//
// v1.2 (bloque A.1):
//   + puntos_ganados + acciones_punto.
// ============================================================

import type {
  AccionVisual,
  PuntoConAcciones,
} from "../../app/equipo/adaptadorUnificadoV2";
import {
  calcularContextoRally,
  type ContextoRally,
} from "../contextoRally";
import { puntajeDeAccion } from "../analisis/clasificacion";
import type { AggFn, GroupBy, IntencionQuery } from "./intenciones";
import {
  porcentaje,
  promedio,
  redondear,
} from "./agregador";
import {
  construirDistribucion,
  construirHabit,
  construirRanking,
  construirSerie,
  construirTabla,
  contarVisibles,
  type ContextoAgrupacion,
} from "./groupBy";
import {
  acePct,
  accionesPunto,
  attackEfficiency,
  blockEfficiency,
  breakPointPct,
  digEfficiency,
  hittingPct,
  killPct,
  puntosGanados,
  puntosGanadosPct,
  puntosPorDimension,
  puntosPorRotacion,
  puntosPorSet,
  receptionPct,
  serveErrorPct,
  sideoutPct,
  type MetricaResultado,
  type PuntoDimension,
} from "./metricasVoley";
import { matcheaSalidaRol } from "./intenciones/salida";
import {
  analizarTendencia,
  describirTendencia,
} from "./tendencias";
import type {
  ResultadoConsulta,
  RespuestaConsulta,
  FilaTabla,
} from "./tipos";
import {
  respuestaComparacion,
  respuestaDistribucion,
  respuestaFrecuencia,
  respuestaHabit,
  respuestaMaxMin,
  respuestaNumero,
  respuestaPorcentaje,
  respuestaPromedio,
  respuestaRanking,
  respuestaSerie,
  respuestaTabla,
  respuestaVacia,
} from "./tipos";

// ------------------------------------------------------------
// CONTEXTO DE ENTRADA
// ------------------------------------------------------------

export interface ContextoRespuesta {
  acciones: AccionVisual[];
  puntos?: PuntoConAcciones[];
  intencion: IntencionQuery;
  contextoAgrupacion?: ContextoAgrupacion;
  contextoRally?: Map<string, ContextoRally>;
  jugadores?: { id: string; nombre: string }[];
  partidos?: { id: string; nombre: string }[];
  totalUniverso?: number;
}

// ------------------------------------------------------------
// NORMALIZACIÓN
// ------------------------------------------------------------

function normalizarTexto(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// ------------------------------------------------------------
// AGREGACIÓN EFECTIVA
// ------------------------------------------------------------
// Si la pregunta es por calidad ("mejor"/"peor"), el motor
// promedia puntajes (avg) en lugar de contar acciones (count).
// ------------------------------------------------------------

function agregacionEfectiva(ctx: ContextoRespuesta): AggFn {
  const intencion = ctx.intencion;
  const esMaxMinRanking =
    intencion.tipo === "max" ||
    intencion.tipo === "min" ||
    intencion.tipo === "ranking";
  if (!esMaxMinRanking) return intencion.agregacion;
  if (intencion.agregacion !== "count") return intencion.agregacion;

  const original = normalizarTexto(intencion.original || "");
  const hablaDeCalidad =
    /\bmejor(es|a|as)?\b/.test(original) ||
    /\bpeor(es|a|as)?\b/.test(original);
  if (!hablaDeCalidad) return intencion.agregacion;
  return "avg";
}

// ------------------------------------------------------------
// ¿LA FRASE PIDE PUNTOS?
// ------------------------------------------------------------
// Detecta "puntos" pero NO "puntos por X" (eso es un promedio,
// va por la métrica puntos_por_*).
//
// Ejemplos:
//   "¿qué rotación hace más puntos?"     → true
//   "¿qué rotación gana más puntos?"     → true
//   "¿cuántos puntos por rotación?"      → false (métrica de promedio)
//   "¿qué rotación tiene más ataques?"   → false
//   "¿quién anotó más puntos?"           → true
// ------------------------------------------------------------

function frasePidePuntos(original: string): boolean {
  const n = normalizarTexto(original);
  if (!/\bpuntos?\b/.test(n)) return false;
  if (/\bpuntos?\s+por\b/.test(n)) return false;
  if (/\bporcentaje\s+de\s+puntos\b/.test(n)) return false;
  if (/\bpromedio\s+de\s+puntos\b/.test(n)) return false;
  return true;
}

// ------------------------------------------------------------
// APLICAR CONDICIONES EXTRA
// ------------------------------------------------------------
// Filtra ctx.acciones por:
//   - condicion.fase       (Cat. 5)
//   - condicion.salidaRol  (Cat. 3)
//
// Filtra ctx.puntos por:
//   - condicion.fase (usa la fase de la última acción visible)
//
// Se llama UNA sola vez al principio de construirRespuesta.
// ------------------------------------------------------------

function aplicarCondicionesExtra(
  ctx: ContextoRespuesta
): ContextoRespuesta {
  const cond = ctx.intencion.condicion;
  if (!cond) return ctx;

  const tieneFase = !!cond.fase;
  const tieneSalida = !!cond.salidaRol;
  if (!tieneFase && !tieneSalida) return ctx;

  // Contexto de rally: lo necesito para fase.
  let mapaRally: Map<string, ContextoRally> | null = null;
  if (tieneFase) {
    mapaRally = ctx.contextoRally ?? calcularContextoRally(ctx.acciones);
  }

  // --- Filtro de acciones ---
  let acciones = ctx.acciones;

  if (tieneFase && mapaRally) {
    const faseBuscada = cond.fase!;
    acciones = acciones.filter((a) => {
      const c = mapaRally!.get(a.id);
      return c?.fase === faseBuscada;
    });
  }

  if (tieneSalida) {
    const rol = cond.salidaRol!;
    acciones = acciones.filter((a) =>
      matcheaSalidaRol(a.rol_jugador, a.zona_origen, rol)
    );
  }

  // --- Filtro de puntos (solo fase) ---
  let puntos = ctx.puntos;
  if (tieneFase && mapaRally && puntos && puntos.length > 0) {
    const faseBuscada = cond.fase!;
    puntos = puntos.filter((p) => {
      const vis = p.acciones
        .filter((a) => !a.oculta)
        .sort((a, b) => a.orden - b.orden);
      const ultima = vis[vis.length - 1];
      if (!ultima) return false;
      const c = mapaRally!.get(ultima.id);
      return c?.fase === faseBuscada;
    });
  }

  return {
    ...ctx,
    acciones,
    puntos,
    contextoRally: mapaRally ?? ctx.contextoRally,
  };
}

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

function meta(
  ctx: ContextoRespuesta,
  totalAcciones: number
): ResultadoConsulta["meta"] {
  return {
    original: ctx.intencion.original,
    intencion: ctx.intencion.tipo,
    agregacion: agregacionEfectiva(ctx),
    groupBy: ctx.intencion.groupBy,
    metrica: ctx.intencion.metrica,
    totalAcciones,
    totalUniverso: ctx.totalUniverso ?? totalAcciones,
  };
}

function resolverJugadorPorNombre(
  nombre: string,
  jugadores: { id: string; nombre: string }[]
): string | null {
  const norm = normalizarTexto(nombre).trim();
  if (!norm) return null;
  for (const j of jugadores) {
    const nNorm = normalizarTexto(j.nombre).trim();
    if (nNorm === norm || nNorm.includes(norm) || norm.includes(nNorm)) {
      return j.id;
    }
  }
  return null;
}

function metricaAPorcentaje(m: MetricaResultado): RespuestaConsulta {
  if (m.denominador === 0) {
    return respuestaVacia("Sin datos para calcular esta métrica.");
  }
  return respuestaPorcentaje(m.numerador, m.denominador, m.descripcion);
}

function metricaAPromedio(m: MetricaResultado): RespuestaConsulta {
  if (m.denominador === 0) {
    return respuestaVacia("Sin datos para calcular esta métrica.");
  }
  return respuestaPromedio(
    m.valor * m.denominador,
    m.denominador,
    m.descripcion
  );
}

function metricaANumero(
  m: MetricaResultado,
  unidad: string | null = null
): RespuestaConsulta {
  if (m.denominador === 0) {
    return respuestaVacia("Sin datos para calcular esta métrica.");
  }
  return respuestaNumero(m.valor, unidad, m.descripcion);
}

// ------------------------------------------------------------
// CONVERSIÓN PuntoDimension → FilaTabla
// ------------------------------------------------------------

function puntosDimensionAFilas(dist: PuntoDimension[]): FilaTabla[] {
  const total = dist.reduce((s, d) => s + d.count, 0);
  return dist.map((d) => ({
    key: d.key,
    label: d.label,
    count: d.count,
    base: total > 0 ? total : null,
    valor: d.count,
    porcentaje: total > 0 ? redondear((d.count / total) * 100, 1) : 0,
    extra: null,
  }));
}

// ------------------------------------------------------------
// DIMENSIONES QUE SE PUEDEN CONTAR POR PUNTOS
// ------------------------------------------------------------

const DIMENSIONES_POR_PUNTOS: GroupBy[] = [
  "rotacion",
  "zona_origen",
  "jugador",
  "ubicacion",
  "rol",
];

function puedeContarPuntosPorDimension(
  ctx: ContextoRespuesta,
  gb: GroupBy | null
): boolean {
  if (!gb) return false;
  if (!DIMENSIONES_POR_PUNTOS.includes(gb)) return false;
  if (!ctx.puntos || ctx.puntos.length === 0) return false;
  return frasePidePuntos(ctx.intencion.original);
}

// ------------------------------------------------------------
// MÉTRICAS DE VÓLEY
// ------------------------------------------------------------

function ejecutarMetrica(ctx: ContextoRespuesta): RespuestaConsulta {
  const metrica = ctx.intencion.metrica;
  if (!metrica) return respuestaVacia("Sin métrica definida.");

  const acciones = ctx.acciones;

  if (metrica === "puntos_ganados") {
    if (!ctx.puntos || ctx.puntos.length === 0) {
      return respuestaVacia(
        "Sin puntos cargados para calcular puntos ganados."
      );
    }
    const m = puntosGanados(ctx.puntos);
    return metricaANumero(m, "puntos");
  }

  if (metrica === "puntos_ganados_pct") {
    if (!ctx.puntos || ctx.puntos.length === 0) {
      return respuestaVacia(
        "Sin puntos cargados para calcular el % de puntos ganados."
      );
    }
    const m = puntosGanadosPct(ctx.puntos);
    return metricaAPorcentaje(m);
  }

  if (contarVisibles(acciones) === 0) {
    return respuestaVacia("Sin datos para calcular esta métrica.");
  }

  switch (metrica) {
    case "kill_pct":
      return metricaAPorcentaje(killPct(acciones));
    case "attack_efficiency":
      return metricaAPorcentaje(attackEfficiency(acciones));
    case "hitting_pct":
      return metricaAPorcentaje(hittingPct(acciones));
    case "reception_pct":
      return metricaAPorcentaje(receptionPct(acciones));
    case "ace_pct":
      return metricaAPorcentaje(acePct(acciones));
    case "serve_error_pct":
      return metricaAPorcentaje(serveErrorPct(acciones));
    case "block_efficiency":
      return metricaAPorcentaje(blockEfficiency(acciones));
    case "dig_efficiency":
      return metricaAPorcentaje(digEfficiency(acciones));
    case "acciones_punto":
      return metricaANumero(accionesPunto(acciones), "acciones en punto");
    case "puntos_por_set": {
      if (!ctx.puntos || ctx.puntos.length === 0) {
        return respuestaVacia(
          "Sin puntos cargados para calcular puntos por set."
        );
      }
      return metricaAPromedio(puntosPorSet(ctx.puntos));
    }
    case "puntos_por_rotacion": {
      if (!ctx.puntos || ctx.puntos.length === 0) {
        return respuestaVacia(
          "Sin puntos cargados para calcular puntos por rotación."
        );
      }
      return metricaAPromedio(puntosPorRotacion(ctx.puntos));
    }
    case "sideout_pct": {
      const mapa =
        ctx.contextoRally ?? calcularContextoRally(acciones);
      return metricaAPorcentaje(sideoutPct(acciones, mapa));
    }
    case "break_point_pct": {
      const mapa =
        ctx.contextoRally ?? calcularContextoRally(acciones);
      return metricaAPorcentaje(breakPointPct(acciones, mapa));
    }
    default:
      return respuestaVacia(
        `Métrica "${metrica}" no implementada todavía. ` +
          `Disponibles: kill %, eficiencia de ataque, hitting %, ` +
          `side-out %, break point %, recepción %, ace %, ` +
          `error de saque %, eficiencia de bloqueo, ` +
          `eficiencia de defensa, puntos por set, ` +
          `puntos por rotación, puntos ganados, ` +
          `% de puntos ganados, acciones en punto.`
      );
  }
}

// ------------------------------------------------------------
// GROUPBY EFECTIVO
// ------------------------------------------------------------

function groupByEfectivo(ctx: ContextoRespuesta): GroupBy | null {
  const intencion = ctx.intencion;

  if (intencion.groupBy) return intencion.groupBy;

  const cond = intencion.condicion;

  if (
    intencion.tipo === "distribution" &&
    cond?.cambioEnPunto !== undefined
  ) {
    return "cambio";
  }

  if (intencion.tipo === "habit") {
    const original = (intencion.original || "").toLowerCase();
    const hablaDeTerminar = /termin|acab|finaliz|sal(e|en)\b/.test(original);
    const hablaDePuntoORally = /(punto|puntos|rally|rallys|pelota)/.test(
      original
    );
    if (hablaDeTerminar && hablaDePuntoORally) {
      return "resultado_punto";
    }
  }

  if (
    (intencion.tipo === "habit" || intencion.tipo === "distribution") &&
    !intencion.groupBy
  ) {
    return "subtipo";
  }

  if (
    (intencion.tipo === "ranking" ||
      intencion.tipo === "max" ||
      intencion.tipo === "min") &&
    !intencion.groupBy
  ) {
    return "jugador";
  }

  return null;
}

// ------------------------------------------------------------
// DISPATCHERS
// ------------------------------------------------------------

function ejecutarCount(ctx: ContextoRespuesta): RespuestaConsulta {
  const acciones = ctx.acciones;
  const visibles = acciones.filter((a) => !a.oculta);
  const total = visibles.length;
  const gb = groupByEfectivo(ctx);

  if (gb) {
    const filas = construirTabla(
      acciones,
      gb,
      "count",
      ctx.contextoAgrupacion
    );
    const totalFila: FilaTabla = {
      key: "TOTAL",
      label: "TOTAL",
      count: total,
      base: total,
      valor: total,
      porcentaje: 100,
      extra: null,
    };
    return respuestaTabla(
      filas,
      gb,
      "count",
      totalFila,
      `${total} acciones en total.`
    );
  }

  return respuestaNumero(total, "acciones", `${total} acciones.`);
}

function ejecutarPercentage(ctx: ContextoRespuesta): RespuestaConsulta {
  const acciones = ctx.acciones;
  const visibles = acciones.filter((a) => !a.oculta);
  const count = visibles.length;
  const base =
    ctx.totalUniverso !== undefined && ctx.totalUniverso > 0
      ? ctx.totalUniverso
      : count;
  const gb = groupByEfectivo(ctx);

  if (gb) {
    const filas = construirTabla(
      acciones,
      gb,
      "percentage",
      ctx.contextoAgrupacion
    );
    return respuestaTabla(
      filas,
      gb,
      "percentage",
      null,
      `${count} de ${base} acciones (${redondear(
        porcentaje(count, base),
        1
      )}%).`
    );
  }

  return respuestaPorcentaje(
    count,
    base,
    `${count} de ${base} acciones (${redondear(
      porcentaje(count, base),
      1
    )}%).`
  );
}

function ejecutarAverage(ctx: ContextoRespuesta): RespuestaConsulta {
  const acciones = ctx.acciones.filter((a) => !a.oculta);
  const gb = groupByEfectivo(ctx);

  if (gb) {
    const filas = construirTabla(
      ctx.acciones,
      gb,
      "avg",
      ctx.contextoAgrupacion
    );
    return respuestaTabla(
      filas,
      gb,
      "avg",
      null,
      "Promedio de puntaje (0..10) por grupo."
    );
  }

  const puntajes: number[] = [];
  for (const a of acciones) {
    const p = puntajeDeAccion(a);
    if (p !== null) puntajes.push(p);
  }
  if (puntajes.length === 0) {
    return respuestaVacia("Sin acciones con puntaje para promediar.");
  }
  const prom = promedio(puntajes);
  return respuestaPromedio(
    prom * puntajes.length,
    puntajes.length,
    `Promedio ${redondear(prom, 2)} sobre ${puntajes.length} acciones.`
  );
}

function ejecutarFrequency(ctx: ContextoRespuesta): RespuestaConsulta {
  const acciones = ctx.acciones;
  const count = acciones.filter((a) => !a.oculta).length;
  const base =
    ctx.totalUniverso !== undefined && ctx.totalUniverso > 0
      ? ctx.totalUniverso
      : count;

  if (count === 0) {
    return respuestaVacia("Sin eventos para calcular la frecuencia.");
  }
  if (base === count) {
    return respuestaVacia(
      "Para calcular la frecuencia necesito el universo total. " +
        'Reformulá la consulta: "cada cuántos ataques erra" ' +
        '(no "cuántos errores").'
    );
  }

  const valor = base / count;
  return respuestaFrecuencia(
    count,
    base,
    `Cada ${redondear(valor, 1)} acciones (${count} de ${base}).`
  );
}

function ejecutarMaxMin(
  ctx: ContextoRespuesta,
  tipo: "max" | "min"
): RespuestaConsulta {
  const gb = groupByEfectivo(ctx);
  if (!gb) {
    return respuestaVacia(
      `Para "${tipo}" necesito una agrupación (por jugador, por set, etc.).`
    );
  }

  const usarPuntos = puedeContarPuntosPorDimension(ctx, gb);

  let filas: FilaTabla[];
  let notaModo = "";

  if (usarPuntos) {
    const dist = puntosPorDimension(ctx.puntos!, gb, {
      nombreDeJugador: ctx.contextoAgrupacion?.nombreDeJugador,
    });
    if (dist.length === 0) {
      return respuestaVacia(
        "No hay rallies ganados con esa dimensión (faltan datos)."
      );
    }
    filas = puntosDimensionAFilas(dist);
    notaModo = "contando rallies ganados";
  } else {
    const agg = agregacionEfectiva(ctx);
    filas = construirTabla(ctx.acciones, gb, agg, ctx.contextoAgrupacion);
    notaModo = `agregación "${agg}" sobre acciones`;
  }

  if (filas.length === 0) {
    return respuestaVacia("Sin filas para comparar.");
  }

  let mejor: FilaTabla = filas[0];
  for (const f of filas) {
    if (tipo === "max" && f.valor > mejor.valor) mejor = f;
    if (tipo === "min" && f.valor < mejor.valor) mejor = f;
  }

  return respuestaMaxMin(
    tipo,
    mejor,
    `${mejor.label}: ${redondear(mejor.valor, 2)} ` +
      `(${notaModo}, ${mejor.count} casos).`
  );
}

function ejecutarRanking(ctx: ContextoRespuesta): RespuestaConsulta {
  const gb = groupByEfectivo(ctx);
  if (!gb) {
    return respuestaVacia(
      "Para hacer un ranking necesito una agrupación (groupBy)."
    );
  }

  const orden = ctx.intencion.ordenamiento ?? "desc";
  const limite = ctx.intencion.limite ?? null;

  const usarPuntos = puedeContarPuntosPorDimension(ctx, gb);

  let filas: FilaTabla[];
  let agg: AggFn;
  let notaModo = "";

  if (usarPuntos) {
    const dist = puntosPorDimension(ctx.puntos!, gb, {
      nombreDeJugador: ctx.contextoAgrupacion?.nombreDeJugador,
    });
    filas = puntosDimensionAFilas(dist);
    filas.sort((a, b) =>
      orden === "desc" ? b.valor - a.valor : a.valor - b.valor
    );
    if (limite !== null && limite > 0) filas = filas.slice(0, limite);
    agg = "count";
    notaModo = "contando rallies ganados";
  } else {
    agg = agregacionEfectiva(ctx);
    filas = construirRanking(
      ctx.acciones,
      gb,
      agg,
      orden,
      limite,
      ctx.contextoAgrupacion
    );
    notaModo = `agregación "${agg}" sobre acciones`;
  }

  return respuestaRanking(
    filas,
    agg,
    orden,
    `Top ${filas.length} por ${gb} (${notaModo}).`
  );
}

function ejecutarComparison(ctx: ContextoRespuesta): RespuestaConsulta {
  const comp = ctx.intencion.comparacion;
  if (!comp) {
    return respuestaVacia("Sin datos de comparación.");
  }
  if (!ctx.jugadores || ctx.jugadores.length === 0) {
    return respuestaVacia(
      "Para comparar necesito la lista de jugadores en el contexto."
    );
  }

  const idA = resolverJugadorPorNombre(comp.a, ctx.jugadores);
  const idB = resolverJugadorPorNombre(comp.b, ctx.jugadores);

  if (!idA || !idB) {
    return respuestaVacia(
      `No pude encontrar a "${!idA ? comp.a : comp.b}" en la lista de jugadores.`
    );
  }

  const gb = groupByEfectivo(ctx) ?? "jugador";
  const filas = construirTabla(
    ctx.acciones,
    gb,
    ctx.intencion.agregacion,
    ctx.contextoAgrupacion
  );
  const filaA = filas.find((f) => f.key === idA);
  const filaB = filas.find((f) => f.key === idB);

  return respuestaComparacion(
    {
      etiqueta: comp.a,
      valor: filaA?.valor ?? 0,
      count: filaA?.count ?? 0,
      base: filaA?.base ?? 0,
    },
    {
      etiqueta: comp.b,
      valor: filaB?.valor ?? 0,
      count: filaB?.count ?? 0,
      base: filaB?.base ?? 0,
    },
    `${comp.a}: ${filaA?.valor ?? 0} · ${comp.b}: ${filaB?.valor ?? 0}`
  );
}

function ejecutarDistribution(ctx: ContextoRespuesta): RespuestaConsulta {
  const gb = groupByEfectivo(ctx);
  if (!gb) {
    return respuestaVacia(
      "Para una distribución necesito una agrupación (por set, por zona, etc.)."
    );
  }
  const items = construirDistribucion(
    ctx.acciones,
    gb,
    ctx.contextoAgrupacion
  );
  if (items.length === 0) {
    return respuestaVacia("Sin datos para distribuir.");
  }
  return respuestaDistribucion(
    items,
    gb,
    `Distribución por ${gb}.`
  );
}

function ejecutarTrend(ctx: ContextoRespuesta): RespuestaConsulta {
  const gb = groupByEfectivo(ctx);
  let eje: "set" | "partido" | "rotacion";

  if (gb === "partido") eje = "partido";
  else if (gb === "rotacion") eje = "rotacion";
  else eje = "set";

  const puntos = construirSerie(
    ctx.acciones,
    eje,
    ctx.intencion.agregacion,
    ctx.contextoAgrupacion
  );
  if (puntos.length === 0) {
    return respuestaVacia("Sin datos para analizar la tendencia.");
  }

  const tendencia = analizarTendencia(puntos);
  const detalle = describirTendencia(tendencia);
  return respuestaSerie(
    eje,
    puntos,
    ctx.intencion.agregacion,
    detalle
  );
}

function ejecutarHabit(ctx: ContextoRespuesta): RespuestaConsulta {
  const gb = groupByEfectivo(ctx);
  if (!gb) {
    return respuestaVacia(
      'Para "suele" necesito una agrupación. Ej: "cómo terminan sus saques" ' +
        'se agrupa automáticamente por subtipo (ace, positivo, negativo, error).'
    );
  }

  const habit = construirHabit(
    ctx.acciones,
    gb,
    ctx.contextoAgrupacion
  );
  if (habit.items.length === 0) {
    return respuestaVacia("Sin datos para detectar hábito.");
  }
  return respuestaHabit(
    habit.valorMasFrecuente,
    habit.etiqueta,
    habit.items,
    `Lo más frecuente (${habit.etiqueta}): ${
      habit.items[0]?.porcentaje ?? 0
    }% de ${habit.total} acciones.`
  );
}

// ------------------------------------------------------------
// DISPATCHER PRINCIPAL
// ------------------------------------------------------------

export function construirRespuesta(
  ctxOriginal: ContextoRespuesta
): ResultadoConsulta {
  // Pre-filtro de condiciones extra (fase + salidaRol).
  const ctx = aplicarCondicionesExtra(ctxOriginal);

  const totalAcciones = ctx.acciones.filter((a) => !a.oculta).length;
  const fragmentos: string[] = [...ctx.intencion.fragmentos];
  const noReconocidas: string[] = [];
  const metaFinal = meta(ctx, totalAcciones);

  if (ctx.intencion.metrica) {
    const resp = ejecutarMetrica(ctx);
    return { respuesta: resp, meta: metaFinal, fragmentos, noReconocidas };
  }

  let resp: RespuestaConsulta;
  switch (ctx.intencion.tipo) {
    case "count":
      resp = ejecutarCount(ctx);
      break;
    case "percentage":
      resp = ejecutarPercentage(ctx);
      break;
    case "average":
      resp = ejecutarAverage(ctx);
      break;
    case "frequency":
      resp = ejecutarFrequency(ctx);
      break;
    case "max":
      resp = ejecutarMaxMin(ctx, "max");
      break;
    case "min":
      resp = ejecutarMaxMin(ctx, "min");
      break;
    case "ranking":
      resp = ejecutarRanking(ctx);
      break;
    case "comparison":
      resp = ejecutarComparison(ctx);
      break;
    case "distribution":
      resp = ejecutarDistribution(ctx);
      break;
    case "trend":
      resp = ejecutarTrend(ctx);
      break;
    case "habit":
      resp = ejecutarHabit(ctx);
      break;
    case "unknown":
    default:
      resp = respuestaVacia(
        "No pude entender qué cálculo querés hacer. Probá con " +
          '"cuántos", "porcentaje", "promedio", "cada cuánto", ' +
          '"mejor", "peor", "distribución", "evolución", "suele", ' +
          '"cómo terminan", "puntos ganados".'
      );
  }

  return { respuesta: resp, meta: metaFinal, fragmentos, noReconocidas };
}