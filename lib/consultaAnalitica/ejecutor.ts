// ============================================================
// EJECUTOR — corre una consulta completa
// ============================================================
// FASE 4 del plan "Consultas Analíticas Libres".
//
// Es el punto de entrada público que la UI va a llamar. Ata todo:
//
//   1. parsearBusqueda(texto, contexto)   → ResultadoParser
//   2. resolve time filter (últimos N, etc.) sobre `acciones`
//   3. aplicar el filtro `BloqueTriggerFiltro` a las acciones
//   4. construirRespuesta({ acciones, intencion, contexto })
//   5. devolver ResultadoConsulta + meta + parser info
//
// No sabe nada de UI. Devuelve estructuras tipadas.
//
// API pública:
//   ejecutarConsulta(texto, contexto) → ResultadoConsultaExtendido
//
// Uso típico en un panel:
//   const res = ejecutarConsulta("¿cuál es el kill % de Juan?", {
//     acciones, puntos, jugadores, partidos,
//   });
//   // res.respuesta → { tipo: "porcentaje", valor: 52.3, ... }
// ============================================================

import type {
  AccionVisual,
  PuntoConAcciones,
} from "../../app/equipo/adaptadorUnificadoV2";
import { calcularContextoRally } from "../contextoRally";
import {
  BLOQUE_TRIGGER_VACIO,
  type BloqueTriggerFiltro,
} from "../analisis/tipos";
import { cumpleBloqueTrigger } from "../analisis/bloqueTrigger";
import { parsearBusqueda } from "../parserBusqueda";
import type { ContextoParser } from "../parserBusqueda";
import type { IntencionQuery } from "./intenciones";
import { construirRespuesta, type ContextoRespuesta } from "./respuesta";
import type { ResultadoConsulta } from "./tipos";

// ------------------------------------------------------------
// CONTEXTO DE ENTRADA
// ------------------------------------------------------------

export interface ContextoEjecutor {
  /** Universo de acciones sobre el que correr la consulta. */
  acciones: AccionVisual[];
  /** Puntos completos (con acciones). Solo para puntos_por_set. */
  puntos?: PuntoConAcciones[];
  /** Jugadores disponibles (para resolver "Juan", "Pedro", etc.). */
  jugadores?: { id: string; nombre: string }[];
  /** Partidos disponibles (para resolver "el sábado vs Boca", etc.). */
  partidos?: { id: string; nombre: string; fecha?: string }[];
}

export interface ResultadoConsultaExtendido extends ResultadoConsulta {
  /** Parser original, para mostrar chips / noReconocidas en la UI. */
  parserInfo: {
    aplicado: boolean;
    sugerencias: string[];
    filtro: BloqueTriggerFiltro;
    intencion: IntencionQuery;
  };
  /** Cuántas acciones sobrevivieron al filtro. */
  accionesFiltradas: number;
  /** Universo original (antes del filtro). */
  accionesUniverso: number;
}

// ------------------------------------------------------------
// FILTRO DE TIEMPO
// ------------------------------------------------------------
// Hoy soportamos:
//   - ultimos_n_partidos: cortar a los primeros N partidos
//     (por orden de aparición en `partidos` si viene con fecha,
//      o por orden de aparición en `acciones` si no).
//   - ultimos_n_sets: cortar a los primeros N sets (por
//     set_numero único).
//   - esta_temporada / esta_semana / este_mes / este_ano /
//     temporada_pasada: solo si `partidos` trae `fecha`. Si no
//     viene fecha, no se aplica.
//   - dia_semana: filtra por el día de la semana del partido
//     (requiere `fecha` en `partidos`).
//   - set_especifico: filtra por set_numero === intencion.set.
//   - punto_especifico: filtra por punto_numero === intencion.punto.
//   - partido_especifico: si el parser no resolvió un id concreto,
//     no se puede aplicar. Se ignora.
//
// Si el filtro no se puede aplicar (falta info), devuelve TODAS
// las acciones sin cortar.
// ------------------------------------------------------------

function filtrarPorTiempo(
  acciones: AccionVisual[],
  intencion: IntencionQuery,
  partidos: { id: string; fecha?: string }[] | undefined
): AccionVisual[] {
  const t = intencion.tiempo;
  if (!t) return acciones;

  // --- Filtros simples ---
  if (t.tipo === "set_especifico" && t.set !== undefined) {
    return acciones.filter((a) => a.set_numero === t.set);
  }
  if (t.tipo === "punto_especifico" && t.punto !== undefined) {
    return acciones.filter((a) => a.punto_numero === t.punto);
  }

  // --- Últimos N partidos ---
  if (t.tipo === "ultimos_n_partidos" && t.n !== undefined && t.n > 0) {
    const idsPorPartido: string[] = [];
    const vistos = new Set<string>();
    for (const a of acciones) {
      if (a.partido_id && !vistos.has(a.partido_id)) {
        vistos.add(a.partido_id);
        idsPorPartido.push(a.partido_id);
      }
    }

    // Si tenemos fechas, ordenamos por fecha DESC.
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

  // --- Últimos N sets ---
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

  // --- Día de la semana ---
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

  // --- Esta temporada / este mes / etc. ---
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
// FILTRO POR BloqueTriggerFiltro
// ------------------------------------------------------------

function aplicarFiltro(
  universo: AccionVisual[],
  filtro: BloqueTriggerFiltro
): AccionVisual[] {
  if (!universo || universo.length === 0) return [];

  // Ordenar cronológicamente.
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

  // Mapas que pide cumpleBloqueTrigger.
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

  // Contexto rally: solo si el filtro lo necesita.
  const necesitaContexto =
    filtro.contextoPartido !== null ||
    (filtro.rachaJugador !== null &&
      (filtro.rachaJugador.tipo === "puntos_ganados" ||
        filtro.rachaJugador.tipo === "puntos_perdidos"));

  const contextoRally = necesitaContexto
    ? calcularContextoRally(ordenadas)
    : null;

  // Posición en set.
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

  // ¿Hay algún filtro activo? Si no, devolvemos TODO (sin filtrar).
  if (esFiltroVacio(filtro)) {
    return ordenadas.filter((a) => !a.oculta);
  }

  // Recorremos cada acción y evaluamos el bloque.
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
      null, // topPorcentaje: no se usa en consultas analíticas todavía
      null // vsPromedio: idem
    );
    if (ok) resultado.push(a);
  }

  return resultado;
}

function esFiltroVacio(f: BloqueTriggerFiltro): boolean {
  // El filtro se considera "vacío" si no tiene NINGÚN criterio
  // más allá del tipo por defecto. Ojo: si `f.tipo` es distinto al
  // default ("ataque"), entonces sí hay filtro.
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
// EJECUTOR PRINCIPAL
// ------------------------------------------------------------

export function ejecutarConsulta(
  texto: string,
  contexto: ContextoEjecutor
): ResultadoConsultaExtendido {
  const universo = contexto.acciones ?? [];

  // 1) Parser.
  const contextoParser: ContextoParser = {
    jugadores: contexto.jugadores,
    partidos: contexto.partidos?.map((p) => ({
      id: p.id,
      nombre: p.nombre,
    })),
  };
  const parsed = parsearBusqueda(texto, contextoParser);

  // 2) Time filter (corta por fecha / N partidos / etc.).
  const accionesConTiempo = filtrarPorTiempo(
    universo,
    parsed.intencion,
    contexto.partidos
  );

  // 3) Filtro por BloqueTriggerFiltro.
  const accionesFiltradas = aplicarFiltro(
    accionesConTiempo,
    parsed.filtro
  );

  // 4) Construir respuesta.
  const ctxRespuesta: ContextoRespuesta = {
    acciones: accionesFiltradas,
    puntos: contexto.puntos,
    intencion: parsed.intencion,
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
    },
    contextoRally: undefined, // se calcula dentro de construirRespuesta si hace falta
    jugadores: contexto.jugadores,
    partidos: contexto.partidos,
    totalUniverso: universo.filter((a) => !a.oculta).length,
  };

  const resultado = construirRespuesta(ctxRespuesta);

  // 5) Extender con info del parser y contadores.
  return {
    ...resultado,
    parserInfo: {
      aplicado: parsed.aplicado,
      sugerencias: parsed.sugerencias,
      filtro: parsed.filtro,
      intencion: parsed.intencion,
    },
    accionesFiltradas: accionesFiltradas.filter((a) => !a.oculta).length,
    accionesUniverso: universo.filter((a) => !a.oculta).length,
  };
}