// ============================================================
// PIPELINE ENGINE — Motor de ejecución de consultas analíticas
// ============================================================

import type { AccionVisual, PuntoConAcciones } from "../../app/equipo/adaptadorUnificadoV2";
import type { ConsultaPipeline, Filtro, InfoSubtipo } from "./pipelineSchema";
import { infoDeSubtipoPipeline } from "./pipelineSchema";
import { calcularFasesPorPunto } from "../contextoRally";
import type { JugadorParaResolver } from "./resolverJugador";
import { resolverJugador } from "./resolverJugador";
import type {
  FilaTabla, RespuestaConsulta, RespuestaNumero, RespuestaPorcentaje,
  RespuestaPromedio, RespuestaRanking, RespuestaTabla, RespuestaVacia,
} from "./tipos";

export interface ContextoPipeline {
  acciones: AccionVisual[];
  puntos?: PuntoConAcciones[];
  jugadores?: JugadorParaResolver[];
  partidos?: Array<{ id: string; nombre: string; fecha?: string }>;
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
// ENRIQUECIMIENTO DE DATOS
// ------------------------------------------------------------

function enriquecerAcciones(
  acciones: AccionVisual[],
  fasesPorPunto: Map<string, string>
): FilaAccionEnriquecida[] {
  return acciones.map((a) => {
    const clave = `${a.partido_id}|${a.set_numero}|${a.punto_numero}`;
    const info: InfoSubtipo = infoDeSubtipoPipeline(a.tipo, a.subtipo, a.es_error);
    return {
      ...a,
      desenlace: info.desenlace,
      valoracion: info.valoracion,
      puntaje: info.puntaje,
      fase_rally: fasesPorPunto.get(clave) ?? "otro",
    };
  });
}

function calcularGanadorPunto(accs: AccionVisual[]): "propio" | "rival" | "desconocido" {
  const vis = accs.filter((a) => !a.oculta).sort((x, y) => x.orden - y.orden);
  if (vis.length === 0) return "desconocido";
  const ult = vis[vis.length - 1];
  const info = infoDeSubtipoPipeline(ult.tipo, ult.subtipo, ult.es_error);
  if (info.desenlace === "punto") return ult.es_rival ? "rival" : "propio";
  if (info.desenlace === "error" || ult.es_error) return ult.es_rival ? "propio" : "rival";
  return "desconocido";
}

function calcularCruces(accs: AccionVisual[]): number {
  const vis = accs.filter((a) => !a.oculta).sort((x, y) => x.orden - y.orden);
  let c = 0;
  for (let i = 1; i < vis.length; i++) {
    if (vis[i].es_rival !== vis[i - 1].es_rival) c++;
  }
  return c;
}

function construirPuntos(
  acciones: AccionVisual[],
  puntosExistentes: PuntoConAcciones[] | undefined,
  fasesPorPunto: Map<string, string>
): FilaPuntoEnriquecido[] {
  const pMap = new Map<string, AccionVisual[]>();
  for (const a of acciones) {
    const clave = `${a.partido_id}|${a.set_numero}|${a.punto_numero}`;
    const l = pMap.get(clave) ?? [];
    l.push(a);
    pMap.set(clave, l);
  }

  const res: FilaPuntoEnriquecido[] = [];
  for (const [clave, accs] of pMap.entries()) {
    const [pid, sStr, pStr] = clave.split("|");
    const setNum = Number(sStr) || 1;
    res.push({
      set_numero: setNum,
      punto_numero: Number(pStr) || 1,
      partido_id: pid,
      fase: fasesPorPunto.get(clave) ?? "otro",
      ganador: calcularGanadorPunto(accs),
      es_tie_break: setNum === 3 || setNum === 5,
      resultado_set: "desconocido",
      resultado_partido: "desconocido",
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

function cumpleFiltros(fila: Record<string, unknown>, filtros?: Filtro[]): boolean {
  if (!filtros || filtros.length === 0) return true;
  return filtros.every((f) => coincideValor(fila[f.campo], f.valor, f.operador));
}

// ------------------------------------------------------------
// EJECUCIÓN PRINCIPAL DEL PIPELINE
// ------------------------------------------------------------

export function ejecutarPipeline(
  consulta: ConsultaPipeline,
  contexto: ContextoPipeline
): RespuestaConsulta {
  // Resolver jugadores por texto antes de filtrar
  let filtrosResueltos: Filtro[] = consulta.filtros ?? [];
  if (contexto.jugadores && contexto.jugadores.length > 0) {
    const resolverFiltro = (f: Filtro): { ok: true; filtro: Filtro } | { ok: false; mensaje: string } => {
      if (f.campo !== "jugador_id") return { ok: true, filtro: f };
      const esUUID = (v: unknown): boolean =>
        typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

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

    const resueltos: Filtro[] = [];
    for (const f of filtrosResueltos) {
      const r = resolverFiltro(f);
      if (!r.ok) {
        return { tipo: "vacio", mensaje: r.mensaje } as RespuestaVacia;
      }
      resueltos.push(r.filtro);
    }
    filtrosResueltos = resueltos;
  }

  const acciones = contexto.acciones ?? [];
  const fasesPorPunto = calcularFasesPorPunto(acciones);
  const universo: Array<Record<string, unknown>> =
    consulta.entidad_base === "puntos"
      ? construirPuntos(acciones, contexto.puntos, fasesPorPunto)
      : enriquecerAcciones(acciones, fasesPorPunto);

  const filtradas = universo.filter((fila) => cumpleFiltros(fila, filtrosResueltos));
  const mapaJugadores = new Map<string, string>();
  if (contexto.jugadores) {
    for (const j of contexto.jugadores) mapaJugadores.set(j.id, j.nombre);
  }

  const resolverLabel = (campo: string, valor: unknown): string => {
    if (campo === "jugador_id") return mapaJugadores.get(String(valor)) ?? String(valor);
    if (campo === "rotacion_numero") return `Rotación ${valor}`;
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

  const filaTotal: FilaTabla = {
    key: "total",
    label: "Total",
    count: baseTotal,
    base: baseTotal,
    valor: baseTotal,
    porcentaje: baseTotal > 0 ? 100 : 0,
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
