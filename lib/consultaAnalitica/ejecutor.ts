// ============================================================
// EJECUTOR — corre una consulta completa
// ============================================================
// FASE 4 + FASE 6 del plan "Consultas Analíticas Libres".
//
// v2.2 (FASE 7.5 — paso 2.4.b):
//   + `filtrarPorTiempo` y `filtrarPuntosPorTiempo` pasan a ser
//     `export` para reutilizarlas desde `ejecutarConsultaLLM.ts`
//     (flujo LLM). Antes eran privadas. Sin cambios de
//     comportamiento.
//
// v2.1 (FASE 7.5 — paso 2.4.a):
//   + `aplicarFiltro` pasa a ser `export`.
//
// v2.0 (FASE 7.5 — paso 10/10):
//   + B6: `variablesPunto` se calcula UNA SOLA VEZ acá y se pasa
//     a `construirRespuesta` en `ctxRespuesta.variablesPunto`.
//   + B31: `totalUniverso` se setea SIEMPRE en `ctxRespuesta`.
//   + B9: nuevo campo `puntosUniverso` en `ctxRespuesta`.
//
// v1.9: `necesitaVariables` se dispara si hay `condicion.expr`.
// v1.8: calcula `variablesPunto` sobre `puntosConTiempo`.
// v1.7: fallback a count si hay filtros válidos.
// v1.6: parserInfo suma jugadorAmbiguo/jugadorAviso/candidatos.
// v1.5: fasesPorPunto sobre el universo.
// v1.4: crucesPorPunto sobre el universo.
// v1.3: crucesMinimos + salidaRol.
// v1.2: resultadosPunto sobre el universo.
// v1.1: filtro de tiempo también sobre puntos.
// ============================================================

import type {
  AccionVisual,
  PuntoConAcciones,
} from "../../app/equipo/adaptadorUnificadoV2";
import {
  calcularContextoRally,
  calcularFasesPorPunto,
} from "../contextoRally";
import {
  BLOQUE_TRIGGER_VACIO,
  type BloqueTriggerFiltro,
} from "../analisis/tipos";
import { cumpleBloqueTrigger } from "../analisis/bloqueTrigger";
import { parsearBusqueda } from "../parserBusqueda";
import type { ContextoParser } from "../parserBusqueda";
import type { IntencionQuery } from "./intenciones";
import { construirRespuesta, type ContextoRespuesta } from "./respuesta";
import {
  calcularCrucesPorPunto,
  calcularResultadosPunto,
} from "./groupBy";
import type { ResultadoConsulta } from "./tipos";
import type { JugadorParaResolver } from "./resolverJugador";
import { calcularVariablesPunto } from "./variablesPunto";

// ------------------------------------------------------------
// CONTEXTO DE ENTRADA
// ------------------------------------------------------------

export interface ContextoEjecutor {
  acciones: AccionVisual[];
  puntos?: PuntoConAcciones[];
  jugadores?: JugadorParaResolver[];
  partidos?: { id: string; nombre: string; fecha?: string }[];
}

export interface ResultadoConsultaExtendido extends ResultadoConsulta {
  parserInfo: {
    aplicado: boolean;
    sugerencias: string[];
    filtro: BloqueTriggerFiltro;
    intencion: IntencionQuery;
    jugadorAmbiguo: boolean;
    jugadorAviso: string | null;
    jugadorCandidatos: JugadorParaResolver[];
  };
  accionesFiltradas: number;
  accionesUniverso: number;
}

// ------------------------------------------------------------
// FALLBACK DE INTENCIÓN
// ------------------------------------------------------------

function aplicarFallbackCount(
  intencion: IntencionQuery,
  aplicado: boolean
): IntencionQuery {
  if (intencion.tipo !== "unknown") return intencion;
  if (!aplicado) return intencion;
  return {
    ...intencion,
    tipo: "count",
    agregacion: "count",
  };
}

// ------------------------------------------------------------
// FILTRO DE TIEMPO (acciones) — EXPORTADO en v2.2
// ------------------------------------------------------------

export function filtrarPorTiempo(
  acciones: AccionVisual[],
  intencion: IntencionQuery,
  partidos: { id: string; fecha?: string }[] | undefined
): AccionVisual[] {
  const t = intencion.tiempo;
  if (!t) return acciones;

  if (t.tipo === "set_especifico" && t.set !== undefined) {
    return acciones.filter((a) => a.set_numero === t.set);
  }
  if (t.tipo === "punto_especifico" && t.punto !== undefined) {
    return acciones.filter((a) => a.punto_numero === t.punto);
  }

  if (t.tipo === "ultimos_n_partidos" && t.n !== undefined && t.n > 0) {
    const idsPorPartido: string[] = [];
    const vistos = new Set<string>();
    for (const a of acciones) {
      if (a.partido_id && !vistos.has(a.partido_id)) {
        vistos.add(a.partido_id);
        idsPorPartido.push(a.partido_id);
      }
    }

    let ordenados: string[] = idsPorPartido;
    if (partidos && partidos.length > 0) {
      const fechas = new Map<string, string>();
      for (const p of partidos) {
        if (p.fecha) fechas.set(p.id, p.fecha);
      }
      if (fechas.size > 0) {
        ordenados = [...idsPorPartido].sort((a, b) => {
          const fa = fechas.get(a) ?? "";
          const fb = fechas.get(b) ?? "";
          return fb.localeCompare(fa);
        });
      }
    }

    const permitidos = new Set(ordenados.slice(0, t.n));
    return acciones.filter(
      (a) => a.partido_id && permitidos.has(a.partido_id)
    );
  }

  if (t.tipo === "ultimos_n_sets" && t.n !== undefined && t.n > 0) {
    const setsUnicos: number[] = [];
    const vistos = new Set<number>();
    for (const a of acciones) {
      if (!vistos.has(a.set_numero)) {
        vistos.add(a.set_numero);
        setsUnicos.push(a.set_numero);
      }
    }
    const permitidos = new Set(setsUnicos.slice(0, t.n));
    return acciones.filter((a) => permitidos.has(a.set_numero));
  }

  if (t.tipo === "dia_semana" && t.diaSemana && partidos) {
    const DIAS: Record<string, number> = {
      domingo: 0,
      lunes: 1,
      martes: 2,
      miercoles: 3,
      jueves: 4,
      viernes: 5,
      sabado: 6,
    };
    const diaBuscado = DIAS[t.diaSemana] ?? -1;
    if (diaBuscado < 0) return acciones;

    const idsPorFecha = new Set<string>();
    for (const p of partidos) {
      if (!p.fecha) continue;
      const d = new Date(p.fecha);
      if (isNaN(d.getTime())) continue;
      if (d.getDay() === diaBuscado) idsPorFecha.add(p.id);
    }
    return acciones.filter(
      (a) => a.partido_id && idsPorFecha.has(a.partido_id)
    );
  }

  if (partidos && partidos.length > 0) {
    const ahora = new Date();
    const anio = ahora.getFullYear();
    const mes = ahora.getMonth();
    let filtroFecha: ((d: Date) => boolean) | null = null;

    if (t.tipo === "este_ano") {
      filtroFecha = (d) => d.getFullYear() === anio;
    } else if (t.tipo === "este_mes") {
      filtroFecha = (d) =>
        d.getFullYear() === anio && d.getMonth() === mes;
    } else if (t.tipo === "esta_semana") {
      const inicioSemana = new Date(ahora);
      inicioSemana.setDate(ahora.getDate() - ahora.getDay());
      inicioSemana.setHours(0, 0, 0, 0);
      filtroFecha = (d) => d.getTime() >= inicioSemana.getTime();
    } else if (t.tipo === "temporada_pasada") {
      filtroFecha = (d) => d.getFullYear() === anio - 1;
    }

    if (filtroFecha) {
      const idsOk = new Set<string>();
      for (const p of partidos) {
        if (!p.fecha) continue;
        const d = new Date(p.fecha);
        if (isNaN(d.getTime())) continue;
        if (filtroFecha(d)) idsOk.add(p.id);
      }
      return acciones.filter(
        (a) => a.partido_id && idsOk.has(a.partido_id)
      );
    }
  }

  return acciones;
}

// ------------------------------------------------------------
// FILTRO DE TIEMPO (puntos) — EXPORTADO en v2.2
// ------------------------------------------------------------

export function filtrarPuntosPorTiempo(
  puntos: PuntoConAcciones[],
  intencion: IntencionQuery,
  partidos: { id: string; fecha?: string }[] | undefined
): PuntoConAcciones[] {
  const t = intencion.tiempo;
  if (!t) return puntos;

  if (t.tipo === "set_especifico" && t.set !== undefined) {
    return puntos.filter((p) => p.set_numero === t.set);
  }
  if (t.tipo === "punto_especifico" && t.punto !== undefined) {
    return puntos.filter((p) => p.punto_numero === t.punto);
  }

  const partidoIdDePunto = (p: PuntoConAcciones): string | null => {
    for (const a of p.acciones) {
      if (a.partido_id) return a.partido_id;
    }
    return null;
  };

  if (t.tipo === "ultimos_n_partidos" && t.n !== undefined && t.n > 0) {
    const idsPorPartido: string[] = [];
    const vistos = new Set<string>();
    for (const p of puntos) {
      const pid = partidoIdDePunto(p);
      if (pid && !vistos.has(pid)) {
        vistos.add(pid);
        idsPorPartido.push(pid);
      }
    }

    let ordenados: string[] = idsPorPartido;
    if (partidos && partidos.length > 0) {
      const fechas = new Map<string, string>();
      for (const p of partidos) {
        if (p.fecha) fechas.set(p.id, p.fecha);
      }
      if (fechas.size > 0) {
        ordenados = [...idsPorPartido].sort((a, b) => {
          const fa = fechas.get(a) ?? "";
          const fb = fechas.get(b) ?? "";
          return fb.localeCompare(fa);
        });
      }
    }

    const permitidos = new Set(ordenados.slice(0, t.n));
    return puntos.filter((p) => {
      const pid = partidoIdDePunto(p);
      return pid && permitidos.has(pid);
    });
  }

  if (t.tipo === "ultimos_n_sets" && t.n !== undefined && t.n > 0) {
    const setsUnicos: number[] = [];
    const vistos = new Set<number>();
    for (const p of puntos) {
      if (!vistos.has(p.set_numero)) {
        vistos.add(p.set_numero);
        setsUnicos.push(p.set_numero);
      }
    }
    const permitidos = new Set(setsUnicos.slice(0, t.n));
    return puntos.filter((p) => permitidos.has(p.set_numero));
  }

  if (t.tipo === "dia_semana" && t.diaSemana && partidos) {
    const DIAS: Record<string, number> = {
      domingo: 0,
      lunes: 1,
      martes: 2,
      miercoles: 3,
      jueves: 4,
      viernes: 5,
      sabado: 6,
    };
    const diaBuscado = DIAS[t.diaSemana] ?? -1;
    if (diaBuscado < 0) return puntos;

    const idsPorFecha = new Set<string>();
    for (const p of partidos) {
      if (!p.fecha) continue;
      const d = new Date(p.fecha);
      if (isNaN(d.getTime())) continue;
      if (d.getDay() === diaBuscado) idsPorFecha.add(p.id);
    }
    return puntos.filter((p) => {
      const pid = partidoIdDePunto(p);
      return pid && idsPorFecha.has(pid);
    });
  }

  if (partidos && partidos.length > 0) {
    const ahora = new Date();
    const anio = ahora.getFullYear();
    const mes = ahora.getMonth();
    let filtroFecha: ((d: Date) => boolean) | null = null;

    if (t.tipo === "este_ano") {
      filtroFecha = (d) => d.getFullYear() === anio;
    } else if (t.tipo === "este_mes") {
      filtroFecha = (d) =>
        d.getFullYear() === anio && d.getMonth() === mes;
    } else if (t.tipo === "esta_semana") {
      const inicioSemana = new Date(ahora);
      inicioSemana.setDate(ahora.getDate() - ahora.getDay());
      inicioSemana.setHours(0, 0, 0, 0);
      filtroFecha = (d) => d.getTime() >= inicioSemana.getTime();
    } else if (t.tipo === "temporada_pasada") {
      filtroFecha = (d) => d.getFullYear() === anio - 1;
    }

    if (filtroFecha) {
      const idsOk = new Set<string>();
      for (const p of partidos) {
        if (!p.fecha) continue;
        const d = new Date(p.fecha);
        if (isNaN(d.getTime())) continue;
        if (filtroFecha(d)) idsOk.add(p.id);
      }
      return puntos.filter((p) => {
        const pid = partidoIdDePunto(p);
        return pid && idsOk.has(pid);
      });
    }
  }

  return puntos;
}

// ------------------------------------------------------------
// FILTRO POR BloqueTriggerFiltro — EXPORTADO en v2.1
// ------------------------------------------------------------

export function aplicarFiltro(
  universo: AccionVisual[],
  filtro: BloqueTriggerFiltro
): AccionVisual[] {
  if (!universo || universo.length === 0) return [];

  const ordenadas = [...universo].sort((a, b) => {
    if (a.partido_id !== b.partido_id) {
      return (a.partido_id || "").localeCompare(b.partido_id || "");
    }
    if (a.set_numero !== b.set_numero) return a.set_numero - b.set_numero;
    if (a.punto_numero !== b.punto_numero) {
      return a.punto_numero - b.punto_numero;
    }
    return a.orden - b.orden;
  });

  const porPunto = new Map<string, AccionVisual[]>();
  for (const a of ordenadas) {
    if (a.oculta) continue;
    const k = `${a.partido_id || ""}|${a.set_numero}|${a.punto_numero}`;
    let lista = porPunto.get(k);
    if (!lista) {
      lista = [];
      porPunto.set(k, lista);
    }
    lista.push(a);
  }

  const necesitaContexto =
    filtro.contextoPartido !== null ||
    (filtro.rachaJugador !== null &&
      (filtro.rachaJugador.tipo === "puntos_ganados" ||
        filtro.rachaJugador.tipo === "puntos_perdidos"));

  const contextoRally = necesitaContexto
    ? calcularContextoRally(ordenadas)
    : null;

  const posicionEnSetPorAccion = new Map<
    string,
    "primero" | "ultimo" | "intermedio"
  >();
  {
    const porSet = new Map<string, AccionVisual[]>();
    for (const a of ordenadas) {
      const k = `${a.partido_id || ""}|${a.set_numero}`;
      let lista = porSet.get(k);
      if (!lista) {
        lista = [];
        porSet.set(k, lista);
      }
      if (!lista.some((x) => x.punto_numero === a.punto_numero)) {
        lista.push(a);
      }
    }
    for (const lista of porSet.values()) {
      lista.sort((a, b) => a.punto_numero - b.punto_numero);
      if (lista.length === 0) continue;
      const primero = lista[0].punto_numero;
      const ultimo = lista[lista.length - 1].punto_numero;
      for (const a of lista) {
        if (a.punto_numero === primero) {
          posicionEnSetPorAccion.set(a.id, "primero");
        } else if (a.punto_numero === ultimo) {
          posicionEnSetPorAccion.set(a.id, "ultimo");
        } else {
          posicionEnSetPorAccion.set(a.id, "intermedio");
        }
      }
    }
  }

  if (esFiltroVacio(filtro)) {
    return ordenadas.filter((a) => !a.oculta);
  }

  const resultado: AccionVisual[] = [];
  for (let i = 0; i < ordenadas.length; i++) {
    const a = ordenadas[i];
    const ok = cumpleBloqueTrigger(
      a,
      filtro,
      ordenadas,
      i,
      porPunto,
      contextoRally,
      posicionEnSetPorAccion.get(a.id) ?? "intermedio",
      null,
      null
    );
    if (ok) resultado.push(a);
  }

  return resultado;
}

function esFiltroVacio(f: BloqueTriggerFiltro): boolean {
  if (f.tipo !== BLOQUE_TRIGGER_VACIO.tipo) return false;
  if (f.jugadorId !== null) return false;
  if (f.resultado !== "cualquiera") return false;
  if (f.sets.length > 0) return false;
  if (f.puntos.length > 0) return false;
  if (f.partidos.length > 0) return false;
  if (f.roles.length > 0) return false;
  if (f.zonasJugador.length > 0) return false;
  if (f.ubicacion !== "cualquiera") return false;
  if (f.cambioEnPunto !== null) return false;
  if (f.salidaRol !== null) return false;
  if (f.crucesMinimos !== null) return false;
  if (f.crucesMaximos !== null) return false;
  if (f.crucesExactos !== null) return false;
  if (f.crucesRango !== null) return false;
  if (f.rotaciones.length > 0) return false;
  if (f.rachas.length > 0) return false;
  if (f.accionPreviaDirecta !== null) return false;
  if (f.rachaJugador !== null) return false;
  if (f.patronPrevio !== null) return false;
  if (f.topPorcentaje !== null) return false;
  if (f.vsPromedio !== null) return false;
  if (f.contextoPartido !== null) return false;
  if (f.variante !== null) return false;
  if (f.llamadasInferidas.length > 0) return false;
  if (f.direccionAtaqueInferida.length > 0) return false;
  if (f.sectoresAtaque.length > 0) return false;
  if (f.zonasDefensaRival.length > 0) return false;
  return true;
}

// ------------------------------------------------------------
// FILTRO POR CRUCES
// ------------------------------------------------------------

function filtrarPuntosPorCruces(
  acciones: AccionVisual[],
  crucesPorPunto: Map<string, number>,
  intencion: IntencionQuery
): Set<string> | null {
  const cond = intencion.condicion;
  if (!cond) return null;
  const tieneMin = cond.crucesMinimos !== undefined && cond.crucesMinimos !== null;
  const tieneMax = cond.crucesMaximos !== undefined && cond.crucesMaximos !== null;
  const tieneExacto = cond.crucesExactos !== undefined && cond.crucesExactos !== null;
  const tieneRango = cond.crucesRango !== undefined && cond.crucesRango !== null;
  if (!tieneMin && !tieneMax && !tieneExacto && !tieneRango) return null;

  const mapa = crucesPorPunto.size > 0 ? crucesPorPunto : calcularCrucesPorPunto(acciones);

  const permitidos = new Set<string>();
  for (const [k, n] of mapa) {
    let ok = true;
    if (tieneMin && n < cond.crucesMinimos!) ok = false;
    if (tieneMax && n > cond.crucesMaximos!) ok = false;
    if (tieneExacto && n !== cond.crucesExactos!) ok = false;
    if (tieneRango) {
      const [lo, hi] = cond.crucesRango!;
      if (n < lo || n > hi) ok = false;
    }
    if (ok) permitidos.add(k);
  }
  return permitidos;
}

// ------------------------------------------------------------
// EJECUTOR PRINCIPAL
// ------------------------------------------------------------

export function ejecutarConsulta(
  texto: string,
  contexto: ContextoEjecutor
): ResultadoConsultaExtendido {
  const universo = contexto.acciones ?? [];
  const universoPuntos = contexto.puntos ?? [];

  // 1) Parser.
  const contextoParser: ContextoParser = {
    jugadores: contexto.jugadores,
    partidos: contexto.partidos?.map((p) => ({
      id: p.id,
      nombre: p.nombre,
    })),
  };
  const parsed = parsearBusqueda(texto, contextoParser);

  // 1.b) FALLBACK
  const intencion = aplicarFallbackCount(parsed.intencion, parsed.aplicado);

  // 2) Time filter
  let accionesConTiempo = filtrarPorTiempo(
    universo,
    intencion,
    contexto.partidos
  );
  let puntosConTiempo = filtrarPuntosPorTiempo(
    universoPuntos,
    intencion,
    contexto.partidos
  );

  // 3) Cruces de red
  const crucesPorPunto = calcularCrucesPorPunto(universo);

  const puntosPermitidosPorCruces = filtrarPuntosPorCruces(
    universo,
    crucesPorPunto,
    intencion
  );

  if (puntosPermitidosPorCruces) {
    accionesConTiempo = accionesConTiempo.filter((a) => {
      const k = `${a.partido_id || ""}|${a.set_numero}|${a.punto_numero}`;
      return puntosPermitidosPorCruces.has(k);
    });
    puntosConTiempo = puntosConTiempo.filter((p) => {
      const pid = p.acciones.find((a) => a.partido_id)?.partido_id ?? "";
      const k = `${pid}|${p.set_numero}|${p.punto_numero}`;
      return puntosPermitidosPorCruces.has(k);
    });
  }

  // 4) Filtro por BloqueTriggerFiltro
  const accionesFiltradas = aplicarFiltro(
    accionesConTiempo,
    parsed.filtro
  );

  // 5) Resultado del punto
  const resultadosPunto = calcularResultadosPunto(universo);

  // 6) Fases por punto
  const fasesPorPunto = calcularFasesPorPunto(universo);

  // 6.b) Variables por punto
  const necesitaVariables =
    intencion.condicion?.expr !== undefined &&
    intencion.condicion?.expr !== null;

  const variablesPunto = necesitaVariables
    ? calcularVariablesPunto(puntosConTiempo, {
        formatoPartido: "bo3",
      })
    : undefined;

  // 7) Contexto de respuesta
  const ctxRespuesta: ContextoRespuesta = {
    acciones: accionesFiltradas,
    puntos: puntosConTiempo,
    puntosUniverso: universoPuntos,
    intencion,
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
    contextoRally: undefined,
    fasesPorPunto,
    jugadores: contexto.jugadores,
    partidos: contexto.partidos,
    totalUniverso: universo.filter((a) => !a.oculta).length,
    variablesPunto,
  };

  const resultado = construirRespuesta(ctxRespuesta);

  // 8) Volcar filtros extra
  let filtroFinal: BloqueTriggerFiltro = parsed.filtro;
  if (parsed.intencion.condicion?.salidaRol !== undefined) {
    filtroFinal = {
      ...filtroFinal,
      salidaRol: parsed.intencion.condicion.salidaRol,
    };
  }
  if (parsed.intencion.condicion?.crucesMinimos !== undefined) {
    filtroFinal = {
      ...filtroFinal,
      crucesMinimos: parsed.intencion.condicion.crucesMinimos,
    };
  }
  if (parsed.intencion.condicion?.crucesMaximos !== undefined) {
    filtroFinal = {
      ...filtroFinal,
      crucesMaximos: parsed.intencion.condicion.crucesMaximos,
    };
  }
  if (parsed.intencion.condicion?.crucesExactos !== undefined) {
    filtroFinal = {
      ...filtroFinal,
      crucesExactos: parsed.intencion.condicion.crucesExactos,
    };
  }
  if (parsed.intencion.condicion?.crucesRango !== undefined) {
    filtroFinal = {
      ...filtroFinal,
      crucesRango: parsed.intencion.condicion.crucesRango,
    };
  }

  // 9) Extender con info del parser
  return {
    ...resultado,
    parserInfo: {
      aplicado: parsed.aplicado,
      sugerencias: parsed.sugerencias,
      filtro: filtroFinal,
      intencion,
      jugadorAmbiguo: parsed.jugadorAmbiguo,
      jugadorAviso: parsed.jugadorAviso,
      jugadorCandidatos: parsed.jugadorCandidatos,
    },
    accionesFiltradas: accionesFiltradas.filter((a) => !a.oculta).length,
    accionesUniverso: universo.filter((a) => !a.oculta).length,
  };
}