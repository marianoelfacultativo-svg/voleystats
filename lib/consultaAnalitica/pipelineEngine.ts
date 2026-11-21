// ============================================================
// PIPELINE ENGINE — Motor de ejecución de consultas analíticas
// ============================================================

import type { AccionVisual, PuntoConAcciones } from "../../app/equipo/adaptadorUnificadoV2";
import type { ConsultaPipeline, Filtro, FiltroExpr, FiltroInput, InfoSubtipo } from "./pipelineSchema";
import { infoDeSubtipoPipeline, normalizarFiltros } from "./pipelineSchema";
import { calcularFasesPorPunto } from "../contextoRally";
import type { JugadorParaResolver } from "./resolverJugador";
import { resolverJugador } from "./resolverJugador";
import type {
  FilaTabla, RespuestaConsulta, RespuestaNumero, RespuestaPorcentaje,
  RespuestaPromedio, RespuestaRanking, RespuestaTabla, RespuestaVacia,
} from "./tipos";

export interface PartidoConResultado {
  id: string;
  nombre: string;
  fecha?: string;
  setGanados?: (boolean | null)[];
  resultado?: "ganado" | "perdido" | null;
}

export interface ContextoPipeline {
  acciones: AccionVisual[];
  puntos?: PuntoConAcciones[];
  jugadores?: JugadorParaResolver[];
  partidos?: PartidoConResultado[];
}

export interface FilaAccionEnriquecida extends AccionVisual {
  desenlace: string;
  valoracion: string;
  puntaje: number;
  fase_rally: string;
  [key: string]: unknown;
}

export interface FilaPuntoEnriquecido {
  set_numero: number;
  punto_numero: number;
  partido_id: string;
  fase: string;
  ganador: "propio" | "rival" | "desconocido";
  es_tie_break: boolean;
  resultado_set: string;
  resultado_partido: string;
  cruces: number;
  diferencia_marcador: number;
  es_primer_toque: boolean;
  acciones: AccionVisual[];
  [key: string]: unknown;
}

// ------------------------------------------------------------
// AJUSTE POR CONTEXTO — armados malos no-últimos
// ------------------------------------------------------------
// El catálogo marca `armados.horrible/malo/1/2` como desenlace
// "error". Pero el DataEntry permite que un armado siga con un
// ataque (no cierra el rally). En ese caso NO es error: es
// "en_juego" con calidad negativa.
//
// Este helper detecta ese caso y devuelve true si el armado es
// malo Y NO es la última acción del punto. En ese caso el motor
// degrada el desenlace a "en_juego".
// ------------------------------------------------------------

function esArmadoMaloNoUltimo(a: AccionVisual): boolean {
  if (a.tipo !== "armado") return false;
  if (a.es_ultima_del_punto) return false;
  const s = String(a.subtipo ?? "").toLowerCase();
  return s === "malo" || s === "horrible" || s === "1" || s === "2";
}

function esBloqueoFiltradaNoUltimo(a: AccionVisual): boolean {
  if (a.tipo !== "bloqueo") return false;
  if (a.es_ultima_del_punto) return false;
  return String(a.subtipo ?? "").toLowerCase() === "filtrada";
}

// ------------------------------------------------------------
// ENRIQUECIMIENTO DE DATOS
// ------------------------------------------------------------

function enriquecerAcciones(
  acciones: AccionVisual[],
  fasesPorPunto: Map<string, string>,
  partidosConResultado?: PartidoConResultado[]
): FilaAccionEnriquecida[] {
  const pMap = new Map<string, AccionVisual[]>();
  for (const a of acciones) {
    const clave = `${a.partido_id}|${a.set_numero}|${a.punto_numero}`;
    const l = pMap.get(clave) ?? [];
    l.push(a);
    pMap.set(clave, l);
  }

  const porPartido = new Map<
    string,
    {
      setGanados?: (boolean | null)[];
      resultado?: "ganado" | "perdido" | null;
    }
  >();
  if (partidosConResultado) {
    for (const p of partidosConResultado) {
      porPartido.set(p.id, {
        setGanados: p.setGanados,
        resultado: p.resultado,
      });
    }
  }

  const infoPuntos = new Map<
    string,
    {
      ganador_punto: "propio" | "rival" | "desconocido";
      resultado_set: string;
      resultado_partido: string;
      calidad_recepcion: string | null;
      valoracion_recepcion: string | null;
    }
  >();

  for (const [clave, accs] of pMap.entries()) {
    const [pid, sStr] = clave.split("|");
    const setNum = Number(sStr) || 1;
    const infoPartido = porPartido.get(pid);

    let resultadoSet = "sin_resultado";
    const ganadoDelSet = infoPartido?.setGanados?.[setNum - 1];
    if (ganadoDelSet === true) resultadoSet = "set_ganado";
    else if (ganadoDelSet === false) resultadoSet = "set_perdido";

    let resultadoPartido = "sin_resultado";
    if (infoPartido?.resultado === "ganado") {
      resultadoPartido = "partido_ganado";
    } else if (infoPartido?.resultado === "perdido") {
      resultadoPartido = "partido_perdido";
    }

    const rec =
      accs.find((x) => x.tipo === "recepcion" && !x.es_rival) ||
      accs.find((x) => x.tipo === "recepcion");
    const subRec = rec ? String(rec.subtipo ?? "").trim().toLowerCase() : null;
    const infoRec = rec
      ? infoDeSubtipoPipeline(rec.tipo, rec.subtipo, rec.es_error)
      : null;

    infoPuntos.set(clave, {
      ganador_punto: calcularGanadorPunto(accs),
      resultado_set: resultadoSet,
      resultado_partido: resultadoPartido,
      calidad_recepcion: subRec,
      valoracion_recepcion: infoRec?.valoracion ?? null,
    });
  }

  return acciones.map((a) => {
    const clave = `${a.partido_id}|${a.set_numero}|${a.punto_numero}`;
    const info: InfoSubtipo = infoDeSubtipoPipeline(a.tipo, a.subtipo, a.es_error);

    // Ajuste por contexto: si el armado es malo pero NO es la
    // última acción, el rally siguió → en_juego (calidad negativa
    // pero no cierra).
    let desenlace = info.desenlace;
    if (desenlace === "error" && esArmadoMaloNoUltimo(a)) {
      desenlace = "en_juego";
    }
    if (desenlace === "error" && esBloqueoFiltradaNoUltimo(a)) {
      desenlace = "en_juego";
    }

    const pInfo = infoPuntos.get(clave);

    return {
      ...a,
      desenlace,
      valoracion: info.valoracion,
      puntaje: info.puntaje,
      fase_rally: fasesPorPunto.get(clave) ?? "otro",
      resultado_set: pInfo?.resultado_set ?? "sin_resultado",
      resultado_partido: pInfo?.resultado_partido ?? "sin_resultado",
      ganador_punto: pInfo?.ganador_punto ?? "desconocido",
      calidad_recepcion: pInfo?.calidad_recepcion ?? null,
      valoracion_recepcion: pInfo?.valoracion_recepcion ?? null,
    };
  });
}

function calcularGanadorPunto(accs: AccionVisual[]): "propio" | "rival" | "desconocido" {
  const vis = accs.filter((a) => !a.oculta).sort((x, y) => x.orden - y.orden);
  if (vis.length === 0) return "desconocido";
  const ult = vis[vis.length - 1];
  const info = infoDeSubtipoPipeline(ult.tipo, ult.subtipo, ult.es_error);
  if (info.desenlace === "punto") return ult.es_rival ? "rival" : "propio";

  const esFiltradaNoUltima =
    ult.tipo === "bloqueo" &&
    String(ult.subtipo ?? "").toLowerCase() === "filtrada" &&
    !ult.es_ultima_del_punto;
  if (info.desenlace === "error" || (ult.es_error && !esFiltradaNoUltima)) {
    return ult.es_rival ? "propio" : "rival";
  }
  return "desconocido";
}

function calcularCruces(accs: AccionVisual[]): number {
  const vis = accs.filter((a) => !a.oculta).sort((x, y) => x.orden - y.orden);
  let c = 0;
  for (let i = 1; i < vis.length; i++) {
    if (vis[i].lado !== vis[i - 1].lado) c++;
  }
  return c;
}

function construirPuntos(
  acciones: AccionVisual[],
  puntosExistentes: PuntoConAcciones[] | undefined,
  fasesPorPunto: Map<string, string>,
  partidosConResultado: PartidoConResultado[] | undefined
): FilaPuntoEnriquecido[] {
  const pMap = new Map<string, AccionVisual[]>();
  for (const a of acciones) {
    const clave = `${a.partido_id}|${a.set_numero}|${a.punto_numero}`;
    const l = pMap.get(clave) ?? [];
    l.push(a);
    pMap.set(clave, l);
  }

  const porPartido = new Map<
    string,
    {
      setGanados?: (boolean | null)[];
      resultado?: "ganado" | "perdido" | null;
    }
  >();
  if (partidosConResultado) {
    for (const p of partidosConResultado) {
      porPartido.set(p.id, {
        setGanados: p.setGanados,
        resultado: p.resultado,
      });
    }
  }

  const res: FilaPuntoEnriquecido[] = [];
  for (const [clave, accs] of pMap.entries()) {
    const [pid, sStr, pStr] = clave.split("|");
    const setNum = Number(sStr) || 1;

    const infoPartido = porPartido.get(pid);

    let resultadoSet = "sin_resultado";
    const ganadoDelSet = infoPartido?.setGanados?.[setNum - 1];
    if (ganadoDelSet === true) resultadoSet = "set_ganado";
    else if (ganadoDelSet === false) resultadoSet = "set_perdido";

    let resultadoPartido = "sin_resultado";
    if (infoPartido?.resultado === "ganado") {
      resultadoPartido = "partido_ganado";
    } else if (infoPartido?.resultado === "perdido") {
      resultadoPartido = "partido_perdido";
    }

    res.push({
      set_numero: setNum,
      punto_numero: Number(pStr) || 1,
      partido_id: pid,
      fase: fasesPorPunto.get(clave) ?? "otro",
      ganador: calcularGanadorPunto(accs),
      es_tie_break: setNum === 3 || setNum === 5,
      resultado_set: resultadoSet,
      resultado_partido: resultadoPartido,
      cruces: calcularCruces(accs),
      diferencia_marcador: 0,
      es_primer_toque: accs.length <= 1,
      acciones: accs,
    });
  }
  return res;
}

// ------------------------------------------------------------
// EVALUACIÓN DE FILTROS
// ------------------------------------------------------------

function coincideValor(campoVal: unknown, filtroVal: unknown, op: string): boolean {
  if (campoVal === undefined || campoVal === null) return op === "neq";
  const strC = String(campoVal).trim().toLowerCase();

  switch (op) {
    case "eq":
      return typeof filtroVal === "number" || typeof filtroVal === "boolean"
        ? campoVal === filtroVal : strC === String(filtroVal).trim().toLowerCase();
    case "neq":
      return typeof filtroVal === "number" || typeof filtroVal === "boolean"
        ? campoVal !== filtroVal : strC !== String(filtroVal).trim().toLowerCase();
    case "in":
      return Array.isArray(filtroVal) && filtroVal.some((v) => String(v).trim().toLowerCase() === strC);
    case "nin":
      return !Array.isArray(filtroVal) || !filtroVal.some((v) => String(v).trim().toLowerCase() === strC);
    case "gt": return Number(campoVal) > Number(filtroVal);
    case "gte": return Number(campoVal) >= Number(filtroVal);
    case "lt": return Number(campoVal) < Number(filtroVal);
    case "lte": return Number(campoVal) <= Number(filtroVal);
    case "between":
      return Array.isArray(filtroVal) && filtroVal.length >= 2 &&
        Number(campoVal) >= Number(filtroVal[0]) && Number(campoVal) <= Number(filtroVal[1]);
    case "contains":
      return strC.includes(String(filtroVal).trim().toLowerCase());
    default:
      return true;
  }
}

function normalizarValorFiltro(campo: string, valor: unknown): unknown {
  if (typeof valor !== "string") return valor;
  const v = valor.trim().toLowerCase();

  if (campo === "resultado_set") {
    if (v === "ganado" || v === "ganados" || v === "set_ganado") return "set_ganado";
    if (v === "perdido" || v === "perdidos" || v === "set_perdido") return "set_perdido";
    if (v === "sin_resultado" || v === "desconocido") return "sin_resultado";
  }
  if (campo === "resultado_partido") {
    if (v === "ganado" || v === "ganados" || v === "partido_ganado") return "partido_ganado";
    if (v === "perdido" || v === "perdidos" || v === "partido_perdido") return "partido_perdido";
    if (v === "sin_resultado" || v === "desconocido") return "sin_resultado";
  }
  return valor;
}

// ------------------------------------------------------------
// EVALUADOR DEL AST
// ------------------------------------------------------------
function evaluarExpr(fila: Record<string, unknown>, expr: FiltroExpr): boolean {
  switch (expr.kind) {
    case "filter":
      return coincideValor(
        fila[expr.campo],
        normalizarValorFiltro(expr.campo, expr.valor),
        expr.operador
      );
    case "and":
      return expr.children.every(c => evaluarExpr(fila, c));
    case "or":
      return expr.children.some(c => evaluarExpr(fila, c));
    case "not":
      return !evaluarExpr(fila, expr.child);
  }
}

// Wrapper con compat: acepta Filtro[] (legacy) o FiltroExpr (nuevo).
// Se sigue usando en metricas (filtros_numerador / denominador).
function cumpleFiltros(
  fila: Record<string, unknown>,
  input?: FiltroInput | null
): boolean {
  const expr = normalizarFiltros(input);
  if (!expr) return true;
  return evaluarExpr(fila, expr);
}

// Resolución recursiva de jugador_id sobre un AST.
function resolverExprJugadores(
  expr: FiltroExpr,
  resolverFiltro: (f: Filtro) => { ok: true; filtro: Filtro } | { ok: false; mensaje: string }
): { ok: true; expr: FiltroExpr } | { ok: false; mensaje: string } {
  switch (expr.kind) {
    case "filter": {
      const r = resolverFiltro({ campo: expr.campo, operador: expr.operador, valor: expr.valor });
      if (!r.ok) return r;
      return { ok: true, expr: { kind: "filter", ...r.filtro } };
    }
    case "and":
    case "or": {
      const children: FiltroExpr[] = [];
      for (const c of expr.children) {
        const r = resolverExprJugadores(c, resolverFiltro);
        if (!r.ok) return r;
        children.push(r.expr);
      }
      return { ok: true, expr: { kind: expr.kind, children } };
    }
    case "not": {
      const r = resolverExprJugadores(expr.child, resolverFiltro);
      if (!r.ok) return r;
      return { ok: true, expr: { kind: "not", child: r.expr } };
    }
  }
}

// ------------------------------------------------------------
// EJECUCIÓN PRINCIPAL DEL PIPELINE
// ------------------------------------------------------------

export function ejecutarPipeline(
  consulta: ConsultaPipeline,
  contexto: ContextoPipeline
): RespuestaConsulta {
  // Normalizar el filtro principal (AST o array legacy → FiltroExpr | null)
  let filtroExpr: FiltroExpr | null = normalizarFiltros(consulta.filtro ?? consulta.filtros ?? null);

  // Resolver jugadores por texto dentro del AST
  if (contexto.jugadores && contexto.jugadores.length > 0 && filtroExpr) {
    const resolverFiltro = (f: Filtro): { ok: true; filtro: Filtro } | { ok: false; mensaje: string } => {
      if (f.campo !== "jugador_id") return { ok: true, filtro: f };
      const esUUID = (v: unknown): boolean =>
        typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

      if (f.operador === "eq") {
        if (esUUID(f.valor)) return { ok: true, filtro: f };
        const r = resolverJugador(String(f.valor), contexto.jugadores!);
        if (r.motivo === "unico") return { ok: true, filtro: { ...f, valor: r.ids[0] } };
        if (r.motivo === "ambiguo") {
          const cands = r.candidatos.map((c) => `${c.nombre}${c.numero ? ` #${c.numero}` : ""}`).join(" | ");
          return { ok: false, mensaje: `"${f.valor}" coincide con varios jugadores: ${cands}. Probá con nombre completo, apodo o #número.` };
        }
        return { ok: false, mensaje: `No encontré a "${f.valor}" en la lista de jugadores.` };
      }

      if (f.operador === "in" && Array.isArray(f.valor)) {
        const nuevosIds: string[] = [];
        for (const v of f.valor) {
          if (esUUID(v)) { nuevosIds.push(String(v)); continue; }
          const r = resolverJugador(String(v), contexto.jugadores!);
          if (r.motivo === "unico") { nuevosIds.push(r.ids[0]); continue; }
          if (r.motivo === "ambiguo") {
            const cands = r.candidatos.map((c) => `${c.nombre}${c.numero ? ` #${c.numero}` : ""}`).join(" | ");
            return { ok: false, mensaje: `"${v}" coincide con varios jugadores: ${cands}.` };
          }
          return { ok: false, mensaje: `No encontré a "${v}" en la lista de jugadores.` };
        }
        return { ok: true, filtro: { ...f, valor: nuevosIds } };
      }

      return { ok: true, filtro: f };
    };

    const r = resolverExprJugadores(filtroExpr, resolverFiltro);
    if (!r.ok) {
      return { tipo: "vacio", mensaje: r.mensaje } as RespuestaVacia;
    }
    filtroExpr = r.expr;
  }

  const acciones = contexto.acciones ?? [];
  const fasesPorPunto = calcularFasesPorPunto(acciones);
  const universo: Array<Record<string, unknown>> =
    consulta.entidad_base === "puntos"
      ? construirPuntos(
          acciones,
          contexto.puntos,
          fasesPorPunto,
          contexto.partidos
        )
      : enriquecerAcciones(acciones, fasesPorPunto, contexto.partidos);

  const filtradas = universo.filter((fila) => filtroExpr ? evaluarExpr(fila, filtroExpr) : true);
  const mapaJugadores = new Map<string, string>();
  if (contexto.jugadores) {
    for (const j of contexto.jugadores) mapaJugadores.set(j.id, j.nombre);
  }

  const resolverLabel = (campo: string, valor: unknown): string => {
    if (campo === "jugador_id") return mapaJugadores.get(String(valor)) ?? String(valor);
    if (campo === "rotacion_numero") return `Rotación ${valor}`;
    if (campo === "set_numero") return `Set ${valor}`;
    if (campo === "resultado_set") {
      if (valor === "set_ganado") return "Sets ganados";
      if (valor === "set_perdido") return "Sets perdidos";
      return "Sin resultado de set";
    }
    if (campo === "resultado_partido") {
      if (valor === "partido_ganado") return "Partidos ganados";
      if (valor === "partido_perdido") return "Partidos perdidos";
      return "Sin resultado de partido";
    }
    if (campo === "ganador" || campo === "ganador_punto") {
      if (valor === "propio") return "Puntos propios";
      if (valor === "rival") return "Puntos rivales";
      return "Desconocido";
    }
    if (campo === "desenlace") {
      if (valor === "punto") return "Punto";
      if (valor === "error") return "Error";
      if (valor === "en_juego") return "En juego";
    }
    if (campo === "valoracion") {
      if (valor === "pos") return "Positiva";
      if (valor === "neu") return "Neutra";
      if (valor === "neg") return "Negativa";
    }
    if (campo === "calidad_recepcion") {
      if (valor === "perfecta") return "Recepción perfecta (R#)";
      if (valor === "positiva") return "Recepción positiva (R+)";
      if (valor === "intermedia") return "Recepción neutra (R!)";
      if (valor === "negativa") return "Recepción negativa (R-)";
      return String(valor ?? "Sin recepción");
    }
    return String(valor ?? "Sin definir");
  };

  // 1. SIN AGRUPACIÓN
  if (!consulta.agrupacion?.campo) {
    const total = filtradas.length;
    if (consulta.metrica.tipo === "count") {
      return {
        tipo: "numero",
        valor: total,
        unidad: consulta.entidad_base === "puntos" ? "puntos" : "acciones",
        detalle: null,
      } as RespuestaNumero;
    }
    if (consulta.metrica.tipo === "avg") {
      const campo = consulta.metrica.campo ?? "puntaje";
      const suma = filtradas.reduce((acc, f) => acc + (Number(f[campo]) || 0), 0);
      return {
        tipo: "promedio",
        valor: total > 0 ? Number((suma / total).toFixed(2)) : 0,
        n: total,
        detalle: `Promedio de ${campo}`,
      } as RespuestaPromedio;
    }
    if (
      consulta.metrica.tipo === "percentage" &&
      !normalizarFiltros(consulta.metrica.filtros_numerador)
    ) {
      return {
        tipo: "vacio",
        mensaje:
          "La métrica 'percentage' requiere 'filtros_numerador'. " +
          "El LLM no devolvió el filtro del numerador. Reformulá la " +
          "consulta.",
      } as RespuestaVacia;
    }
    if (consulta.metrica.tipo === "percentage") {
      const num = filtradas.filter((f) => cumpleFiltros(f, consulta.metrica.filtros_numerador)).length;
      return {
        tipo: "porcentaje",
        valor: total > 0 ? Number(((num / total) * 100).toFixed(1)) : 0,
        count: num,
        base: total,
        detalle: null,
      } as RespuestaPorcentaje;
    }
    if (consulta.metrica.tipo === "efficiency") {
      const num = filtradas.filter((f) =>
        cumpleFiltros(f, consulta.metrica.filtros_numerador ?? [{ campo: "desenlace", operador: "eq", valor: "punto" }])
      ).length;
      const denNeg = filtradas.filter((f) =>
        cumpleFiltros(f, consulta.metrica.filtros_denominador_negativo ?? [{ campo: "desenlace", operador: "eq", valor: "error" }])
      ).length;
      return {
        tipo: "porcentaje",
        valor: total > 0 ? Number((((num - denNeg) / total) * 100).toFixed(1)) : 0,
        count: num,
        base: total,
        detalle: `Eficiencia (${num} pts - ${denNeg} err) / ${total}`,
      } as RespuestaPorcentaje;
    }
    if (consulta.metrica.tipo === "sum") {
      const campo = consulta.metrica.campo ?? "puntaje";
      const suma = filtradas.reduce(
        (acc, f) => acc + (Number(f[campo]) || 0),
        0
      );
      return {
        tipo: "numero",
        valor: Number(suma.toFixed(2)),
        unidad: campo,
        detalle: `Suma de ${campo}`,
      } as RespuestaNumero;
    }
    return {
      tipo: "numero",
      valor: total,
      unidad: consulta.entidad_base === "puntos" ? "puntos" : "acciones",
      detalle: null,
    } as RespuestaNumero;
  }

  // 2. CON AGRUPACIÓN
  const campoAgrup = consulta.agrupacion.campo;
  const grupos = new Map<string, Array<Record<string, unknown>>>();
  for (const fila of filtradas) {
    const rawVal = fila[campoAgrup];
    const key = rawVal === null || rawVal === undefined ? "null" : String(rawVal);
    const arr = grupos.get(key) ?? [];
    arr.push(fila);
    grupos.set(key, arr);
  }

  const filasTabla: FilaTabla[] = [];
  const baseTotal = filtradas.length;

  for (const [key, items] of grupos.entries()) {
    const label = resolverLabel(campoAgrup, items[0]?.[campoAgrup] ?? key);
    const count = items.length;
    let valor = count;
    let porcentaje: number | null = null;

    if (consulta.metrica.tipo === "avg") {
      const campo = consulta.metrica.campo ?? "puntaje";
      const sum = items.reduce((acc, f) => acc + (Number(f[campo]) || 0), 0);
      valor = count > 0 ? Number((sum / count).toFixed(2)) : 0;
    } else if (consulta.metrica.tipo === "percentage") {
      const num = items.filter((f) => cumpleFiltros(f, consulta.metrica.filtros_numerador)).length;
      porcentaje = count > 0 ? Number(((num / count) * 100).toFixed(1)) : 0;
      valor = num;
    } else if (consulta.metrica.tipo === "efficiency") {
      const num = items.filter((f) =>
        cumpleFiltros(f, consulta.metrica.filtros_numerador ?? [{ campo: "desenlace", operador: "eq", valor: "punto" }])
      ).length;
      const denNeg = items.filter((f) =>
        cumpleFiltros(f, consulta.metrica.filtros_denominador_negativo ?? [{ campo: "desenlace", operador: "eq", valor: "error" }])
      ).length;
      porcentaje = count > 0 ? Number((((num - denNeg) / count) * 100).toFixed(1)) : 0;
      valor = num;
    } else if (consulta.metrica.tipo === "sum") {
      const campo = consulta.metrica.campo ?? "puntaje";
      const sum = items.reduce(
        (acc, f) => acc + (Number(f[campo]) || 0),
        0
      );
      valor = Number(sum.toFixed(2));
    } else {
      porcentaje = baseTotal > 0 ? Number(((count / baseTotal) * 100).toFixed(1)) : 0;
    }

    filasTabla.push({ key, label, count, base: baseTotal, valor, porcentaje, extra: null });
  }

  const orden = consulta.orden ?? (consulta.limite ? "desc" : "asc");
  filasTabla.sort((a, b) => {
    const valA = a.valor ?? a.count;
    const valB = b.valor ?? b.count;
    return orden === "desc" ? valB - valA : valA - valB;
  });

  const filasFinales = consulta.limite ? filasTabla.slice(0, consulta.limite) : filasTabla;

  if (consulta.limite || (consulta.orden && campoAgrup === "jugador_id")) {
    return {
      tipo: "ranking",
      filas: filasFinales,
      agregacion: consulta.metrica.tipo === "avg" ? "avg" : "count",
      orden: orden === "desc" ? "desc" : "asc",
      detalle: null,
    } as RespuestaRanking;
  }

  let valorTotal: number = baseTotal;
  let porcentajeTotal: number = baseTotal > 0 ? 100 : 0;

  if (consulta.metrica.tipo === "avg") {
    const campo = consulta.metrica.campo ?? "puntaje";
    const sumaTotal = filtradas.reduce(
      (acc, f) => acc + (Number(f[campo]) || 0),
      0
    );
    valorTotal =
      baseTotal > 0 ? Number((sumaTotal / baseTotal).toFixed(2)) : 0;
  } else if (consulta.metrica.tipo === "percentage") {
    const numTotal = filtradas.filter((f) =>
      cumpleFiltros(f, consulta.metrica.filtros_numerador)
    ).length;
    valorTotal = numTotal;
    porcentajeTotal =
      baseTotal > 0
        ? Number(((numTotal / baseTotal) * 100).toFixed(1))
        : 0;
  } else if (consulta.metrica.tipo === "efficiency") {
    const numTotal = filtradas.filter((f) =>
      cumpleFiltros(
        f,
        consulta.metrica.filtros_numerador ?? [
          { campo: "desenlace", operador: "eq", valor: "punto" },
        ]
      )
    ).length;
    const denNegTotal = filtradas.filter((f) =>
      cumpleFiltros(
        f,
        consulta.metrica.filtros_denominador_negativo ?? [
          { campo: "desenlace", operador: "eq", valor: "error" },
        ]
      )
    ).length;
    valorTotal = numTotal - denNegTotal;
    porcentajeTotal =
      baseTotal > 0
        ? Number(
            (((numTotal - denNegTotal) / baseTotal) * 100).toFixed(1)
          )
        : 0;
  } else if (consulta.metrica.tipo === "sum") {
    const campo = consulta.metrica.campo ?? "puntaje";
    const sumaTotal = filtradas.reduce(
      (acc, f) => acc + (Number(f[campo]) || 0),
      0
    );
    valorTotal = Number(sumaTotal.toFixed(2));
  }

  const filaTotal: FilaTabla = {
    key: "total",
    label: "Total",
    count: baseTotal,
    base: baseTotal,
    valor: valorTotal,
    porcentaje: porcentajeTotal,
    extra: null,
  };

  return {
    tipo: "tabla",
    groupBy: campoAgrup as any,
    filas: filasFinales,
    agregacion: consulta.metrica.tipo === "avg" ? "avg" : "count",
    total: filaTotal,
    detalle: null,
  } as RespuestaTabla;
}