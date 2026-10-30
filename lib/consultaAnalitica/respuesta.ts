// ============================================================
// RESPUESTA — response builder
// ============================================================
// FASE 4 + FASE 6 del plan "Consultas Analíticas Libres".
//
// Toma la intención detectada (IntencionQuery), las acciones YA
// FILTRADAS por el motor, y el contexto externo, y arma un
// ResultadoConsulta con la respuesta correcta según el tipo.
//
// v1.1 (FASE 6):
//   + `habit` sin groupBy asume "subtipo".
//   + `distribution` sin groupBy asume "subtipo".
//   + `distribution` con cambio en condicion → groupBy "cambio".
//   + `ranking` / `max` / `min` sin groupBy → groupBy "jugador".
//   + `frequency` sin universo → mensaje claro.
//   + Métrica desconocida → mensaje con las soportadas.
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
import type { GroupBy, IntencionQuery } from "./intenciones";
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
  attackEfficiency,
  blockEfficiency,
  breakPointPct,
  digEfficiency,
  hittingPct,
  killPct,
  puntosPorRotacion,
  puntosPorSet,
  receptionPct,
  serveErrorPct,
  sideoutPct,
  type MetricaResultado,
} from "./metricasVoley";
import { calcularFrecuencia } from "./frecuencia";
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
// HELPERS
// ------------------------------------------------------------

function meta(
  ctx: ContextoRespuesta,
  totalAcciones: number
): ResultadoConsulta["meta"] {
  return {
    original: ctx.intencion.original,
    intencion: ctx.intencion.tipo,
    agregacion: ctx.intencion.agregacion,
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
  const norm = nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  if (!norm) return null;
  for (const j of jugadores) {
    const nNorm = j.nombre
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
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

// ------------------------------------------------------------
// MÉTRICAS DE VÓLEY
// ------------------------------------------------------------

function ejecutarMetrica(ctx: ContextoRespuesta): RespuestaConsulta {
  const metrica = ctx.intencion.metrica;
  if (!metrica) return respuestaVacia("Sin métrica definida.");

  const acciones = ctx.acciones;
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
          `puntos por rotación.`
      );
  }
}

// ------------------------------------------------------------
// GROUPBY EFECTIVO (con defaults inteligentes)
// ------------------------------------------------------------

function groupByEfectivo(ctx: ContextoRespuesta): GroupBy | null {
  const intencion = ctx.intencion;

  if (intencion.groupBy) return intencion.groupBy;

  const cond = intencion.condicion;

  // Distribución de "cambio" → agrupamos por cambio.
  if (
    intencion.tipo === "distribution" &&
    cond?.cambioEnPunto !== undefined
  ) {
    return "cambio";
  }

  // Distribución / habit sin groupBy → subtipo (resultado de la acción).
  if (
    (intencion.tipo === "habit" || intencion.tipo === "distribution") &&
    !intencion.groupBy
  ) {
    return "subtipo";
  }

  // Ranking / max / min sin groupBy → jugador.
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

  const filas = construirTabla(
    ctx.acciones,
    gb,
    ctx.intencion.agregacion,
    ctx.contextoAgrupacion
  );
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
    `${mejor.label}: ${mejor.valor} (${mejor.count} acciones).`
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

  const filas = construirRanking(
    ctx.acciones,
    gb,
    ctx.intencion.agregacion,
    orden,
    limite,
    ctx.contextoAgrupacion
  );

  return respuestaRanking(
    filas,
    ctx.intencion.agregacion,
    orden,
    `Top ${filas.length} por ${gb}.`
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
  else eje = "set"; // default

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
  ctx: ContextoRespuesta
): ResultadoConsulta {
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
          '"cómo terminan".'
      );
  }

  return { respuesta: resp, meta: metaFinal, fragmentos, noReconocidas };
}