// ============================================================
// RESPUESTA — response builder
// ============================================================
// FASE 4 + FASE 6 del plan "Consultas Analíticas Libres".
//
// v2.0 (FASE 7.5 — AST compilado):
//   + Nuevo path `ejecutarComparacionBaseline(ctx)`:
//       · si `condicion.compararConBaseline === true` y hay
//         `condicion.expr` y hay `intencion.metrica`,
//       · calcula VariablesPunto sobre el universo,
//       · filtra los puntos que cumplen `expr`,
//       · calcula la métrica sobre las acciones de esos puntos,
//       · calcula la métrica sobre TODAS las acciones (baseline),
//       · devuelve `RespuestaComparacionBaseline`.
//   + `ContextoRespuesta` suma `variablesPunto?` (opcional, para
//     que el ejecutor lo precálcule y no recalculamos dos veces).
//
// v1.9 (FASE 7.4 — "Sin datos" → 0):
//   + Los 3 helpers de métrica (porcentaje / promedio / número)
//     devuelven 0 cuando el denominador es 0.
// ============================================================

import type {
  AccionVisual,
  PuntoConAcciones,
} from "../../app/equipo/adaptadorUnificadoV2";
import {
  calcularContextoRally,
  calcularFasesPorPunto,
  type ContextoRally,
  type FaseRally,
} from "../contextoRally";
import {
  clasificarResultado,
  puntajeDeAccion,
} from "../analisis/clasificacion";
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
  crucesMax,
  crucesPromedio,
  crucesTotal,
  digEfficiency,
  hittingPct,
  killPct,
  puntosGanados,
  puntosGanadosPct,
  puntosPorDimension,
  puntosPorRotacion,
  puntosPorSet,
  rallysCortos,
  rallysLargos,
  rallysMedios,
  receptionPct,
  serveErrorPct,
  sideoutPct,
  type MetricaResultado,
  type PuntoDimension,
} from "./metricasVoley";
import { matcheaSalidaRol } from "./intenciones/salida";
import {
  CRUCES_DEFAULT_CORTO,
  CRUCES_DEFAULT_LARGO,
} from "./intenciones/cruces";
import {
  analizarTendencia,
  describirTendencia,
} from "./tendencias";
import type {
  ItemDistribucion,
  ResultadoConsulta,
  RespuestaConsulta,
  FilaTabla,
} from "./tipos";
import {
  respuestaComparacion,
  respuestaComparacionBaseline,
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
import {
  resolverJugador,
  describirCandidatos,
  type JugadorParaResolver,
} from "./resolverJugador";
import {
  calcularVariablesPunto,
  type VariablesPunto,
} from "./variablesPunto";
import { evaluarBooleano } from "./expresiones";

// ------------------------------------------------------------
// CONTEXTO DE ENTRADA
// ------------------------------------------------------------

export interface ContextoRespuesta {
  acciones: AccionVisual[];
  puntos?: PuntoConAcciones[];
  intencion: IntencionQuery;
  contextoAgrupacion?: ContextoAgrupacion;
  contextoRally?: Map<string, ContextoRally>;
  fasesPorPunto?: Map<string, FaseRally>;
  jugadores?: JugadorParaResolver[];
  partidos?: { id: string; nombre: string }[];
  totalUniverso?: number;
  /** FASE 7.5 — Variables por punto precálculadas (opcional). */
  variablesPunto?: Map<string, VariablesPunto>;
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

function frasePidePuntos(original: string): boolean {
  const n = normalizarTexto(original);
  if (!/\bpuntos?\b/.test(n)) return false;
  if (/\bpuntos?\s+por\b/.test(n)) return false;
  if (/\bporcentaje\s+de\s+puntos\b/.test(n)) return false;
  if (/\bpromedio\s+de\s+puntos\b/.test(n)) return false;
  return true;
}

// ------------------------------------------------------------
// AMBIGÜEDAD DE CRUCES
// ------------------------------------------------------------

function esAmbiguedadCruces(intencion: IntencionQuery): boolean {
  const original = normalizarTexto(intencion.original || "");

  if (/\b(?:mas|más)\s+de\s+\d+\s+cruces?\b/.test(original)) return false;
  if (/\bmenos\s+de\s+\d+\s+cruces?\b/.test(original)) return false;
  if (/\bhasta\s+\d+\s+cruces?\b/.test(original)) return false;
  if (/\bentre\s+\d+\s+y\s+\d+\s+cruces?\b/.test(original)) return false;
  if (/\bexactamente\s+\d+\s+cruces?\b/.test(original)) return false;
  if (/\b\d+\s+cruces?\b/.test(original)) return false;
  if (/\b\d+\s+pelotazos?\b/.test(original)) return false;
  if (/\b\d+\s+intercambios?\b/.test(original)) return false;

  if (/\brallys?\s+larg/.test(original)) return true;
  if (/\brallys?\s+cort/.test(original)) return true;
  if (/\bcruces?\b/.test(original)) return true;
  if (/\bpelotazos?\b/.test(original)) return true;
  if (/\bintercambios?\b/.test(original)) return true;

  return false;
}

function agregarAvisoAmbiguedad(
  respuesta: RespuestaConsulta,
  intencion: IntencionQuery
): RespuestaConsulta {
  if (!esAmbiguedadCruces(intencion)) return respuesta;
  if (respuesta.tipo === "vacio") return respuesta;

  const aviso =
    `(Asumí "rally largo" = ≥${CRUCES_DEFAULT_LARGO} cruces, ` +
    `"rally corto" = ≤${CRUCES_DEFAULT_CORTO} cruces. ` +
    `Especificá un número para cambiar el umbral, ` +
    `ej: "más de 4 cruces".)`;

  if ("detalle" in respuesta) {
    const detalle = respuesta.detalle;
    return {
      ...respuesta,
      detalle: detalle ? `${detalle} ${aviso}` : aviso,
    };
  }
  return respuesta;
}

// ------------------------------------------------------------
// APLICAR CONDICIONES EXTRA
// ------------------------------------------------------------

function claveDePunto(a: AccionVisual): string {
  return `${a.partido_id || ""}|${a.set_numero}|${a.punto_numero}`;
}

function claveDePuntoDesdePunto(p: PuntoConAcciones): string {
  const pid =
    p.acciones.find((a) => a.partido_id)?.partido_id ?? "";
  return `${pid}|${p.set_numero}|${p.punto_numero}`;
}

function aplicarCondicionesExtra(
  ctx: ContextoRespuesta
): ContextoRespuesta {
  const cond = ctx.intencion.condicion;
  if (!cond) return ctx;

  const tieneFase = !!cond.fase;
  const tieneSalida = !!cond.salidaRol;
  if (!tieneFase && !tieneSalida) return ctx;

  let acciones = ctx.acciones;
  let puntos = ctx.puntos;
  let contextoRally = ctx.contextoRally;

  if (tieneFase) {
    const faseBuscada = cond.fase!;

    const fasesPorPunto: Map<string, FaseRally> =
      ctx.fasesPorPunto ??
      calcularFasesPorPunto(
        ctx.puntos && ctx.puntos.length > 0
          ? ctx.puntos.flatMap((p) => p.acciones)
          : ctx.acciones
      );

    const tenemosPuntos =
      ctx.puntos !== undefined && ctx.puntos !== null;

    if (tenemosPuntos) {
      const puntosFiltrados: PuntoConAcciones[] = (ctx.puntos ?? []).filter(
        (p) => fasesPorPunto.get(claveDePuntoDesdePunto(p)) === faseBuscada
      );

      const clavesOk = new Set<string>();
      for (const p of puntosFiltrados) {
        clavesOk.add(claveDePuntoDesdePunto(p));
      }

      acciones = acciones.filter((a) => clavesOk.has(claveDePunto(a)));

      puntos = puntosFiltrados;
    } else {
      const mapaRally =
        ctx.contextoRally ?? calcularContextoRally(ctx.acciones);
      acciones = acciones.filter((a) => {
        const c = mapaRally.get(a.id);
        return c?.fase === faseBuscada;
      });
      contextoRally = mapaRally;
    }
  }

  if (tieneSalida) {
    const rol = cond.salidaRol!;
    acciones = acciones.filter((a) =>
      matcheaSalidaRol(a.rol_jugador, a.zona_origen, rol)
    );
  }

  return {
    ...ctx,
    acciones,
    puntos,
    contextoRally,
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

// ------------------------------------------------------------
// MÉTRICAS → RESPUESTA
// ------------------------------------------------------------

const DETALLE_SIN_DATOS = "Sin datos (0 casos).";

function metricaAPorcentaje(m: MetricaResultado): RespuestaConsulta {
  if (m.denominador === 0) {
    return respuestaPorcentaje(0, 1, DETALLE_SIN_DATOS);
  }
  return respuestaPorcentaje(m.numerador, m.denominador, m.descripcion);
}

function metricaAPromedio(m: MetricaResultado): RespuestaConsulta {
  if (m.denominador === 0) {
    return respuestaPromedio(0, 1, DETALLE_SIN_DATOS);
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
    return respuestaNumero(0, unidad, DETALLE_SIN_DATOS);
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
// DISTRIBUCIÓN POR PUNTOS
// ------------------------------------------------------------

function esGroupByPorPunto(gb: GroupBy): boolean {
  return (
    gb === "resultado_punto" ||
    gb === "resultado_set" ||
    gb === "resultado_partido" ||
    gb === "cruces" ||
    gb === "duracion_rally" ||
    gb === "set"
  );
}

function calcularCrucesDePunto(lista: AccionVisual[]): number {
  const visibles = lista
    .filter((x) => !x.oculta)
    .sort((x, y) => x.orden - y.orden);
  let cruces = 0;
  for (let i = 1; i < visibles.length; i++) {
    if (visibles[i].lado !== visibles[i - 1].lado) cruces += 1;
  }
  return cruces;
}

function bucketDuracion(cruces: number): "corto" | "medio" | "largo" {
  if (cruces <= CRUCES_DEFAULT_CORTO) return "corto";
  if (cruces < CRUCES_DEFAULT_LARGO) return "medio";
  return "largo";
}

function etiquetaGrupoPorPunto(gb: GroupBy, key: string): string {
  switch (gb) {
    case "resultado_punto":
      if (key === "punto_propio") return "Punto propio";
      if (key === "punto_rival") return "Punto rival";
      if (key === "sin_ganador") return "Sin ganador";
      return key;
    case "resultado_set":
      if (key === "set_ganado") return "Set ganado";
      if (key === "set_perdido") return "Set perdido";
      if (key === "sin_resultado") return "Sin resultado";
      return key;
    case "resultado_partido":
      if (key === "partido_ganado") return "Partido ganado";
      if (key === "partido_perdido") return "Partido perdido";
      if (key === "sin_resultado") return "Sin resultado";
      return key;
    case "cruces": {
      const n = parseInt(key, 10);
      if (isNaN(n)) return key;
      return n === 1 ? "1 cruce" : `${n} cruces`;
    }
    case "duracion_rally":
      if (key === "corto") return `Corto (≤${CRUCES_DEFAULT_CORTO} cruces)`;
      if (key === "medio") return `Medio (${CRUCES_DEFAULT_CORTO + 1} cruces)`;
      if (key === "largo") return `Largo (≥${CRUCES_DEFAULT_LARGO} cruces)`;
      return key;
    case "set":
      return `Set ${key}`;
    default:
      return key;
  }
}

function calcularDistribucionPorPuntos(
  ctx: ContextoRespuesta,
  gb: GroupBy
): ItemDistribucion[] | null {
  if (!esGroupByPorPunto(gb)) return null;
  if (!ctx.puntos || ctx.puntos.length === 0) return null;

  const mapa = new Map<string, number>();

  for (const p of ctx.puntos) {
    const visibles = p.acciones
      .filter((a) => !a.oculta)
      .sort((a, b) => a.orden - b.orden);
    const ultima = visibles[visibles.length - 1] ?? null;

    let key: string | null = null;

    switch (gb) {
      case "resultado_punto": {
        if (!ultima) {
          key = "sin_ganador";
          break;
        }
        const cat = clasificarResultado(ultima);
        if (cat === "punto") {
          key = ultima.es_rival ? "punto_rival" : "punto_propio";
        } else if (cat === "error") {
          key = ultima.es_rival ? "punto_propio" : "punto_rival";
        } else {
          key = "sin_ganador";
        }
        break;
      }
      case "resultado_set": {
        const setGanado = ctx.contextoAgrupacion?.resultadosSet?.get(
          `${ultima?.partido_id ?? ""}|${p.set_numero}`
        );
        if (setGanado === true) key = "set_ganado";
        else if (setGanado === false) key = "set_perdido";
        else key = "sin_resultado";
        break;
      }
      case "resultado_partido": {
        const pid = ultima?.partido_id ?? "";
        const res = ctx.contextoAgrupacion?.resultadosPartido?.get(pid);
        if (res === "ganado") key = "partido_ganado";
        else if (res === "perdido") key = "partido_perdido";
        else key = "sin_resultado";
        break;
      }
      case "cruces": {
        const n = calcularCrucesDePunto(p.acciones);
        key = String(n);
        break;
      }
      case "duracion_rally": {
        const n = calcularCrucesDePunto(p.acciones);
        key = bucketDuracion(n);
        break;
      }
      case "set": {
        key = String(p.set_numero);
        break;
      }
      default:
        return null;
    }

    if (key === null) continue;
    mapa.set(key, (mapa.get(key) ?? 0) + 1);
  }

  if (mapa.size === 0) return [];

  const total = Array.from(mapa.values()).reduce((s, n) => s + n, 0);

  const items: ItemDistribucion[] = Array.from(mapa.entries()).map(
    ([key, count]) => ({
      key,
      label: etiquetaGrupoPorPunto(gb, key),
      count,
      porcentaje: total > 0 ? redondear((count / total) * 100, 1) : 0,
    })
  );

  items.sort((a, b) => b.count - a.count);
  return items;
}

// ------------------------------------------------------------
// MÉTRICAS DE VÓLEY
// ------------------------------------------------------------

function ejecutarMetrica(ctx: ContextoRespuesta): RespuestaConsulta {
  const metrica = ctx.intencion.metrica;
  if (!metrica) return respuestaVacia("Sin métrica definida.");

  const acciones = ctx.acciones;

  // FAMILIA CRUCES
  if (metrica === "cruces_promedio") {
    if (!ctx.puntos || ctx.puntos.length === 0) {
      return metricaAPromedio({
        valor: 0,
        numerador: 0,
        denominador: 0,
        descripcion: "",
      });
    }
    return metricaAPromedio(crucesPromedio(ctx.puntos));
  }
  if (metrica === "cruces_total") {
    if (!ctx.puntos || ctx.puntos.length === 0) {
      return metricaANumero(
        { valor: 0, numerador: 0, denominador: 0, descripcion: "" },
        "cruces"
      );
    }
    return metricaANumero(crucesTotal(ctx.puntos), "cruces");
  }
  if (metrica === "cruces_max") {
    if (!ctx.puntos || ctx.puntos.length === 0) {
      return metricaANumero(
        { valor: 0, numerador: 0, denominador: 0, descripcion: "" },
        "cruces"
      );
    }
    return metricaANumero(crucesMax(ctx.puntos), "cruces");
  }
  if (metrica === "rallys_largos") {
    if (!ctx.puntos || ctx.puntos.length === 0) {
      return metricaANumero(
        { valor: 0, numerador: 0, denominador: 0, descripcion: "" },
        "rallys largos"
      );
    }
    return metricaANumero(rallysLargos(ctx.puntos), "rallys largos");
  }
  if (metrica === "rallys_cortos") {
    if (!ctx.puntos || ctx.puntos.length === 0) {
      return metricaANumero(
        { valor: 0, numerador: 0, denominador: 0, descripcion: "" },
        "rallys cortos"
      );
    }
    return metricaANumero(rallysCortos(ctx.puntos), "rallys cortos");
  }
  if (metrica === "rallys_medios") {
    if (!ctx.puntos || ctx.puntos.length === 0) {
      return metricaANumero(
        { valor: 0, numerador: 0, denominador: 0, descripcion: "" },
        "rallys medios"
      );
    }
    return metricaANumero(rallysMedios(ctx.puntos), "rallys medios");
  }

  // PUNTOS GANADOS
  if (metrica === "puntos_ganados") {
    if (!ctx.puntos || ctx.puntos.length === 0) {
      return metricaANumero(
        { valor: 0, numerador: 0, denominador: 0, descripcion: "" },
        "puntos"
      );
    }
    const m = puntosGanados(ctx.puntos);
    return metricaANumero(m, "puntos");
  }

  if (metrica === "puntos_ganados_pct") {
    if (!ctx.puntos || ctx.puntos.length === 0) {
      return metricaAPorcentaje({
        valor: 0,
        numerador: 0,
        denominador: 0,
        descripcion: "",
      });
    }
    const m = puntosGanadosPct(ctx.puntos);
    return metricaAPorcentaje(m);
  }

  void contarVisibles(acciones);

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
        return metricaAPromedio({
          valor: 0,
          numerador: 0,
          denominador: 0,
          descripcion: "",
        });
      }
      return metricaAPromedio(puntosPorSet(ctx.puntos));
    }
    case "puntos_por_rotacion": {
      if (!ctx.puntos || ctx.puntos.length === 0) {
        return metricaAPromedio({
          valor: 0,
          numerador: 0,
          denominador: 0,
          descripcion: "",
        });
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
        `Métrica "${metrica}" no implementada todavía.`
      );
  }
}

// ------------------------------------------------------------
// COMPARE-TO-BASELINE (FASE 7.5 — capa 4)
// ------------------------------------------------------------
// Se dispara cuando `condicion.compararConBaseline === true` y
// hay `condicion.expr`. Calcula:
//   - variablesPunto sobre el universo,
//   - filtra los puntos que cumplen expr,
//   - calcula la métrica sobre las acciones de esos puntos,
//   - calcula la métrica sobre TODAS las acciones (baseline),
//   - devuelve `RespuestaComparacionBaseline`.
// ------------------------------------------------------------

function ejecutarComparacionBaseline(
  ctx: ContextoRespuesta
): RespuestaConsulta {
  const cond = ctx.intencion.condicion;
  const metrica = ctx.intencion.metrica;

  if (!cond?.expr) {
    return respuestaVacia(
      "Comparación con baseline: falta la expresión del filtro."
    );
  }
  if (!metrica) {
    return respuestaVacia(
      "Comparación con baseline: falta la métrica a comparar."
    );
  }

  const puntosUniverso = ctx.puntos ?? [];
  if (puntosUniverso.length === 0) {
    return respuestaComparacionBaseline(
      metrica,
      0,
      0,
      0,
      0,
      "Sin puntos en el universo."
    );
  }

  // 1. Variables por punto (usar precálculo si existe)
  const variables =
    ctx.variablesPunto ??
    calcularVariablesPunto(puntosUniverso, {
      formatoPartido: "bo3",
    });

  // 2. Filtrar puntos por expr
  const clavesFiltradas = new Set<string>();
  for (const [clave, vars] of variables) {
    try {
      if (evaluarBooleano(cond.expr, vars)) {
        clavesFiltradas.add(clave);
      }
    } catch {
      // Si la evaluación falla, se ignora el punto.
    }
  }

  // 3. Acciones filtradas (las que están en puntos filtrados)
  const accionesFiltradas: AccionVisual[] = [];
  for (const p of puntosUniverso) {
    if (clavesFiltradas.has(claveDePuntoDesdePunto(p))) {
      for (const a of p.acciones) accionesFiltradas.push(a);
    }
  }

  // 4. Métrica filtrada: reusar ejecutarMetrica con contexto parcial
  const ctxFiltrado: ContextoRespuesta = {
    ...ctx,
    acciones: accionesFiltradas,
    puntos: puntosUniverso.filter((p) =>
      clavesFiltradas.has(claveDePuntoDesdePunto(p))
    ),
  };
  const respFiltrada = ejecutarMetrica(ctxFiltrado);

  // 5. Métrica general (baseline)
  const respGeneral = ejecutarMetrica(ctx);

  // 6. Extraer números de cada respuesta
  const numFiltrada = extraerNumeroDeRespuesta(respFiltrada);
  const numGeneral = extraerNumeroDeRespuesta(respGeneral);

  if (numFiltrada === null || numGeneral === null) {
    return respuestaVacia(
      "Comparación con baseline: la métrica no devolvió un número."
    );
  }

  const puntosQueCumplen = clavesFiltradas.size;
  const puntosTotales = puntosUniverso.length;

  const detalle =
    `${puntosQueCumplen} de ${puntosTotales} puntos cumplen la condición. ` +
    `Filtrada: ${redondear(numFiltrada, 2)} · General: ${redondear(
      numGeneral,
      2
    )} · Diferencia: ${
      numFiltrada - numGeneral >= 0 ? "+" : ""
    }${redondear(numFiltrada - numGeneral, 2)}.`;

  return respuestaComparacionBaseline(
    metrica,
    redondear(numFiltrada, 2),
    redondear(numGeneral, 2),
    puntosQueCumplen,
    puntosTotales,
    detalle
  );
}

function extraerNumeroDeRespuesta(r: RespuestaConsulta): number | null {
  switch (r.tipo) {
    case "numero":
    case "porcentaje":
    case "promedio":
    case "frecuencia":
      return r.valor;
    default:
      return null;
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
    if (esGroupByPorPunto(gb)) {
      const items = calcularDistribucionPorPuntos(ctx, gb);
      if (items) {
        const totalPuntos = items.reduce((s, it) => s + it.count, 0);
        const filas: FilaTabla[] = items.map((it) => ({
          key: it.key,
          label: it.label,
          count: it.count,
          base: totalPuntos > 0 ? totalPuntos : null,
          valor: it.count,
          porcentaje: it.porcentaje,
          extra: null,
        }));
        return respuestaTabla(
          filas,
          gb,
          "count",
          {
            key: "TOTAL",
            label: "TOTAL",
            count: totalPuntos,
            base: totalPuntos,
            valor: totalPuntos,
            porcentaje: totalPuntos > 0 ? 100 : 0,
            extra: null,
          },
          `${totalPuntos} puntos en total (contando PUNTOS, no acciones).`
        );
      }
    }

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
      porcentaje: total > 0 ? 100 : 0,
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
    base > 0 ? base : 1,
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
    return respuestaPromedio(0, 1, DETALLE_SIN_DATOS);
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
    return respuestaFrecuencia(0, base > 0 ? base : 1, DETALLE_SIN_DATOS);
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
      return respuestaMaxMin(
        tipo,
        {
          key: "_none",
          label: "Sin datos",
          count: 0,
          base: 0,
          valor: 0,
          porcentaje: 0,
          extra: null,
        },
        DETALLE_SIN_DATOS
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
    return respuestaMaxMin(
      tipo,
      {
        key: "_none",
        label: "Sin datos",
        count: 0,
        base: 0,
        valor: 0,
        porcentaje: 0,
        extra: null,
      },
      DETALLE_SIN_DATOS
    );
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

  const rA = resolverJugador(comp.a, ctx.jugadores);
  const rB = resolverJugador(comp.b, ctx.jugadores);

  if (rA.motivo === "ambiguo") {
    return respuestaVacia(
      `Ambigüedad en la comparación: "${comp.a}" coincide con varios ` +
        `jugadores. Candidatos: ${describirCandidatos(rA.candidatos)}.`
    );
  }
  if (rB.motivo === "ambiguo") {
    return respuestaVacia(
      `Ambigüedad en la comparación: "${comp.b}" coincide con varios ` +
        `jugadores. Candidatos: ${describirCandidatos(rB.candidatos)}.`
    );
  }
  if (rA.motivo !== "unico" || rB.motivo !== "unico") {
    const faltante = rA.motivo !== "unico" ? comp.a : comp.b;
    return respuestaVacia(
      `No pude encontrar a "${faltante}" en la lista de jugadores.`
    );
  }

  const idA = rA.ids[0];
  const idB = rB.ids[0];

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

  if (esGroupByPorPunto(gb)) {
    const items = calcularDistribucionPorPuntos(ctx, gb);
    if (items !== null) {
      return respuestaDistribucion(
        items,
        gb,
        items.length === 0
          ? DETALLE_SIN_DATOS
          : `Distribución por ${gb} (contando puntos).`
      );
    }
  }

  const items = construirDistribucion(
    ctx.acciones,
    gb,
    ctx.contextoAgrupacion
  );
  return respuestaDistribucion(
    items,
    gb,
    items.length === 0 ? DETALLE_SIN_DATOS : `Distribución por ${gb}.`
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
    return respuestaSerie(
      eje,
      [],
      ctx.intencion.agregacion,
      DETALLE_SIN_DATOS
    );
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

  if (esGroupByPorPunto(gb)) {
    const items = calcularDistribucionPorPuntos(ctx, gb);
    if (items !== null) {
      const total = items.reduce((s, it) => s + it.count, 0);
      const top = items[0] ?? null;
      return respuestaHabit(
        top?.key ?? null,
        top?.label ?? null,
        items,
        items.length === 0
          ? DETALLE_SIN_DATOS
          : `Lo más frecuente (${top?.label}): ${top?.porcentaje ?? 0}% de ${total} puntos.`
      );
    }
  }

  const habit = construirHabit(
    ctx.acciones,
    gb,
    ctx.contextoAgrupacion
  );
  if (habit.items.length === 0) {
    return respuestaHabit(null, null, [], DETALLE_SIN_DATOS);
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
  const ctx = aplicarCondicionesExtra(ctxOriginal);

  const totalAcciones = ctx.acciones.filter((a) => !a.oculta).length;
  const fragmentos: string[] = [...ctx.intencion.fragmentos];
  const noReconocidas: string[] = [];
  const metaFinal = meta(ctx, totalAcciones);

  // ============================================================
  // FASE 7.5 — comparación filtrada vs baseline
  // ============================================================
  // Si la intención pide `compararConBaseline` Y hay métrica Y
  // hay `expr`, dispatch a `ejecutarComparacionBaseline`.
  // Esto es prioritario sobre el dispatch normal de métricas.
  // ============================================================
  if (
    ctx.intencion.condicion?.compararConBaseline === true &&
    ctx.intencion.condicion?.expr &&
    ctx.intencion.metrica
  ) {
    const resp = ejecutarComparacionBaseline(ctx);
    return {
      respuesta: agregarAvisoAmbiguedad(resp, ctx.intencion),
      meta: metaFinal,
      fragmentos,
      noReconocidas,
    };
  }

  if (ctx.intencion.metrica) {
    const resp = ejecutarMetrica(ctx);
    return {
      respuesta: agregarAvisoAmbiguedad(resp, ctx.intencion),
      meta: metaFinal,
      fragmentos,
      noReconocidas,
    };
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
          '"cómo terminan", "puntos ganados", "cruces".'
      );
  }

  return {
    respuesta: agregarAvisoAmbiguedad(resp, ctx.intencion),
    meta: metaFinal,
    fragmentos,
    noReconocidas,
  };
}