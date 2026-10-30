// ============================================================
// MOTOR PRINCIPAL — analizarConsecuencias
// ============================================================
// Extraído de lib/analisisConsecuencias.ts (v9).
//
// Ensambla:
//   - Ordenar acciones.
//   - Agrupar por punto.
//   - Calcular contexto de rally (solo si algún bloque lo necesita).
//   - Precalcular top% / vsPromedio.
//   - Precalcular posición en set.
//   - Evaluar bloques con AND/OR/NOT.
//   - Calcular comportamiento del trigger.
//   - Calcular ocurrencias + estadísticas observadas.
// ============================================================

import type { AccionVisual } from "../../app/equipo/adaptadorUnificadoV2";
import { calcularContextoRally } from "../contextoRally";
import { cumpleBloqueTrigger } from "./bloqueTrigger";
import {
  baseSubtipo,
  clasificarResultado,
} from "./clasificacion";
import {
  coincide,
  coincidenciasVacias,
  sumarCoincidencias,
} from "./coincidencias";
import { calcularComportamientoTrigger } from "./comportamiento";
import { hayContextoPartidoActivo } from "./contexto";
import {
  calcularIdsTopPorcentaje,
  calcularIdsVsPromedio,
} from "./topPromedio";
import type {
  CategoriaResultado,
  EvaluacionResultado,
  FiltrosAnalisis,
  OcurrenciaTrigger,
  ResumenPorTipo,
  ResultadoAnalisis,
  CoincidenciasResumen,
  DetalleAccionObservada,
  EstadisticasObservadas,
} from "./tipos";

export function analizarConsecuencias(
  acciones: AccionVisual[],
  filtros: FiltrosAnalisis
): ResultadoAnalisis {
  const vacio: ResultadoAnalisis = {
    totalOcurrencias: 0,
    ocurrencias: [],
    distribucionSiguiente: {},
    distribucionSubtipo: {},
    resumenPorTipo: [],
    coincidenciasGlobales: coincidenciasVacias(),
  };

  if (filtros.bloques.length === 0) return vacio;

  const {
    ventana,
    coincidencias,
    tipoObservado = "cualquiera",
    alcance = "partido",
    jugadorObservadoId = null,
    jugadorObservadoRelacion = "cualquiera",
  } = filtros;

  const accionesCronologicas = acciones
    .filter((a) => !a.oculta)
    .sort((x, y) => {
      if (x.partido_id !== y.partido_id)
        return (x.partido_id || "").localeCompare(y.partido_id || "");
      if (x.set_numero !== y.set_numero) return x.set_numero - y.set_numero;
      if (x.punto_numero !== y.punto_numero)
        return x.punto_numero - y.punto_numero;
      return x.orden - y.orden;
    });

  const indiceGlobalPorId = new Map<string, number>();
  for (let i = 0; i < accionesCronologicas.length; i++) {
    indiceGlobalPorId.set(accionesCronologicas[i].id, i);
  }

  const porPunto = new Map<string, AccionVisual[]>();
  for (const a of accionesCronologicas) {
    const k = `${a.partido_id || ""}|${a.set_numero}|${a.punto_numero}`;
    let lista = porPunto.get(k);
    if (!lista) {
      lista = [];
      porPunto.set(k, lista);
    }
    lista.push(a);
  }

  const necesitaContexto = filtros.bloques.some(
    (b) =>
      (b.filtro.contextoPartido &&
        hayContextoPartidoActivo(b.filtro.contextoPartido)) ||
      (b.filtro.rachaJugador &&
        (b.filtro.rachaJugador.tipo === "puntos_ganados" ||
          b.filtro.rachaJugador.tipo === "puntos_perdidos"))
  );
  const contextoRally = necesitaContexto
    ? calcularContextoRally(accionesCronologicas)
    : null;

  const idsTopPorcentajePorBloque = new Map<string, Set<string>>();
  const idsVsPromedioPorBloque = new Map<string, Set<string>>();
  for (const b of filtros.bloques) {
    if (b.filtro.topPorcentaje !== null) {
      idsTopPorcentajePorBloque.set(
        b.id,
        calcularIdsTopPorcentaje(
          accionesCronologicas,
          b.filtro.tipo,
          b.filtro.topPorcentaje
        )
      );
    }
    if (b.filtro.vsPromedio !== null) {
      idsVsPromedioPorBloque.set(
        b.id,
        calcularIdsVsPromedio(
          accionesCronologicas,
          b.filtro.tipo,
          b.filtro.vsPromedio
        )
      );
    }
  }

  const posicionEnSetPorAccion = new Map<
    string,
    "primero" | "ultimo" | "intermedio"
  >();
  {
    const porSet = new Map<string, AccionVisual[]>();
    for (const a of accionesCronologicas) {
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
      lista.sort((x, y) => x.punto_numero - y.punto_numero);
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

  const cumplePorBloque = new Map<string, Set<string>>();
  for (const b of filtros.bloques) {
    cumplePorBloque.set(b.id, new Set());
  }

  const triggers: AccionVisual[] = [];
  for (let i = 0; i < accionesCronologicas.length; i++) {
    const a = accionesCronologicas[i];

    const cumple: boolean[] = [];
    for (const b of filtros.bloques) {
      const cumpleB = cumpleBloqueTrigger(
        a,
        b.filtro,
        accionesCronologicas,
        i,
        porPunto,
        contextoRally,
        posicionEnSetPorAccion.get(a.id) ?? "intermedio",
        idsTopPorcentajePorBloque.get(b.id) ?? null,
        idsVsPromedioPorBloque.get(b.id) ?? null
      );
      cumple.push(cumpleB);
      if (cumpleB) {
        cumplePorBloque.get(b.id)!.add(a.id);
      }
    }

    let resultado = cumple[0];
    for (let bi = 1; bi < filtros.bloques.length; bi++) {
      const op = filtros.bloques[bi].operador;
      const c = cumple[bi];
      if (op === "AND") resultado = resultado && c;
      else if (op === "OR") resultado = resultado || c;
      else if (op === "NOT") resultado = resultado && !c;
    }

    if (resultado) triggers.push(a);
  }

  const comportamientoTrigger =
    triggers.length > 0
      ? calcularComportamientoTrigger(
          triggers,
          filtros.bloques,
          cumplePorBloque
        )
      : undefined;

  const ocurrencias: OcurrenciaTrigger[] = [];
  const distribucionSiguiente: Record<string, number> = {};
  const distribucionSubtipo: Record<string, number> = {};
  const porTipoCoincidencias = new Map<string, CoincidenciasResumen>();
  let coincidenciasGlobales = coincidenciasVacias();

  const maxSiguientes =
    ventana === "todas" ? Number.POSITIVE_INFINITY : ventana;

  let sumDistanciaAcciones = 0;
  let sumDistanciaPuntos = 0;
  let countObservadas = 0;
  let countMismoPunto = 0;
  let countPuntos = 0;
  let countErrores = 0;
  let countNeutros = 0;
  const subtiposCount: Record<string, number> = {};
  const jugadoresCount: Record<string, number> = {};
  const zonasCount: Record<number, number> = {};

  for (const a of triggers) {
    const i = indiceGlobalPorId.get(a.id) ?? -1;
    if (i < 0) continue;

    const listaPunto =
      porPunto.get(`${a.partido_id || ""}|${a.set_numero}|${a.punto_numero}`) ??
      [];
    const idxEnPunto = listaPunto.findIndex((x) => x.id === a.id);
    const anterior = idxEnPunto > 0 ? listaPunto[idxEnPunto - 1] : null;

    const siguientes =
      idxEnPunto >= 0
        ? listaPunto.slice(idxEnPunto + 1, idxEnPunto + 1 + maxSiguientes)
        : [];

    let accionObservada: DetalleAccionObservada | null = null;
    for (let j = i + 1; j < accionesCronologicas.length; j++) {
      const cand = accionesCronologicas[j];

      if (
        alcance === "mismo_punto" &&
        (cand.set_numero !== a.set_numero ||
          cand.punto_numero !== a.punto_numero ||
          cand.partido_id !== a.partido_id)
      )
        break;

      const coincideTipo =
        tipoObservado === "cualquiera" || cand.tipo === tipoObservado;
      if (!coincideTipo) continue;

      if (jugadorObservadoId && cand.jugador_id !== jugadorObservadoId)
        continue;

      if (jugadorObservadoRelacion === "mismo") {
        if (!a.jugador_id || cand.jugador_id !== a.jugador_id) continue;
      } else if (jugadorObservadoRelacion === "companero") {
        if (cand.es_rival !== a.es_rival) continue;
      } else if (jugadorObservadoRelacion === "rival") {
        if (cand.es_rival === a.es_rival) continue;
      }

      if (
        jugadorObservadoRelacion === "cualquiera" &&
        coincidencias.mismoJugadorTrigger
      ) {
        if (!a.jugador_id || cand.jugador_id !== a.jugador_id) continue;
      }

      if (
        coincidencias.mismaZonaTriggerDestino &&
        a.zona_destino !== null &&
        a.zona_destino !== undefined
      ) {
        if (cand.zona_destino !== a.zona_destino) continue;
      }
      if (
        coincidencias.mismaZonaTriggerOrigen &&
        a.zona_origen !== null &&
        a.zona_origen !== undefined
      ) {
        if (cand.zona_origen !== a.zona_origen) continue;
      }
      if (coincidencias.mismaVelocidadAnterior && a.velocidad) {
        if (cand.velocidad !== a.velocidad) continue;
      }

      const distanciaAcciones = j - i;
      let distanciaPuntos = 0;
      if (
        cand.partido_id === a.partido_id &&
        cand.set_numero === a.set_numero
      ) {
        distanciaPuntos = Math.max(0, cand.punto_numero - a.punto_numero);
      } else if (cand.partido_id === a.partido_id) {
        distanciaPuntos = Math.max(
          0,
          (cand.set_numero - a.set_numero) * 25 +
            cand.punto_numero -
            a.punto_numero
        );
      } else {
        distanciaPuntos = 999;
      }

      const esMismoPunto =
        cand.set_numero === a.set_numero &&
        cand.punto_numero === a.punto_numero &&
        cand.partido_id === a.partido_id;
      const categoriaResultado = clasificarResultado(cand);
      const sub = baseSubtipo(cand) || "—";

      accionObservada = {
        accion: cand,
        distanciaAcciones,
        distanciaPuntos,
        esMismoPunto,
        categoriaResultado,
        subtipo: sub,
      };

      countObservadas++;
      sumDistanciaAcciones += distanciaAcciones;
      sumDistanciaPuntos += distanciaPuntos;
      if (esMismoPunto) countMismoPunto++;

      if (categoriaResultado === "punto") countPuntos++;
      else if (categoriaResultado === "error") countErrores++;
      else countNeutros++;

      subtiposCount[sub] = (subtiposCount[sub] ?? 0) + 1;

      if (cand.jugador_id) {
        jugadoresCount[cand.jugador_id] =
          (jugadoresCount[cand.jugador_id] ?? 0) + 1;
      }

      if (cand.zona_destino !== null && cand.zona_destino !== undefined) {
        zonasCount[cand.zona_destino] =
          (zonasCount[cand.zona_destino] ?? 0) + 1;
      }

      break;
    }

    ocurrencias.push({
      set_numero: a.set_numero,
      punto_numero: a.punto_numero,
      triggerId: a.id,
      triggerJugadorId: a.jugador_id,
      triggerSubtipo: baseSubtipo(a) || null,
      anteriorId: anterior?.id ?? null,
      anteriorJugadorId: anterior?.jugador_id ?? null,
      anteriorSubtipo: anterior ? baseSubtipo(anterior) || null : null,
      siguientes,
      accionObservada,
    });

    if (siguientes.length > 0) {
      const s0 = siguientes[0];
      const tipoKey = s0.tipo;
      distribucionSiguiente[tipoKey] =
        (distribucionSiguiente[tipoKey] ?? 0) + 1;

      const subKey = `${s0.tipo}|${baseSubtipo(s0) || "—"}`;
      distribucionSubtipo[subKey] =
        (distribucionSubtipo[subKey] ?? 0) + 1;

      const coincideS0 = coincide(s0, coincidencias, {
        trigger: a,
        anterior,
      });
      coincidenciasGlobales = sumarCoincidencias(
        coincidenciasGlobales,
        coincideS0
      );

      const prev = porTipoCoincidencias.get(s0.tipo);
      porTipoCoincidencias.set(
        s0.tipo,
        prev ? sumarCoincidencias(prev, coincideS0) : coincideS0
      );
    }
  }

  const resumenPorTipo: ResumenPorTipo[] = Array.from(
    porTipoCoincidencias.entries()
  )
    .map(([tipo, coinc]) => ({
      tipo,
      count: distribucionSiguiente[tipo] ?? 0,
      coincidencias: coinc,
    }))
    .sort((a, b) => b.count - a.count);

  let estadisticasObservadas: EstadisticasObservadas | undefined;
  if (countObservadas > 0) {
    const total = countObservadas;
    const pctPuntos = Math.round((countPuntos / total) * 100);
    const pctErrores = Math.round((countErrores / total) * 100);
    const pctNeutros = Math.round((countNeutros / total) * 100);

    let masFrecuente: CategoriaResultado = "neutro";
    if (countPuntos >= countErrores && countPuntos >= countNeutros)
      masFrecuente = "punto";
    else if (countErrores >= countPuntos && countErrores >= countNeutros)
      masFrecuente = "error";

    const evaluacionResultado: EvaluacionResultado = {
      masFrecuente,
      puntos: countPuntos,
      errores: countErrores,
      neutros: countNeutros,
      total,
      pctPuntos,
      pctErrores,
      pctNeutros,
      efectividadNeta: Math.round(
        ((countPuntos - countErrores) / total) * 100
      ),
    };

    const subtiposRanking = Object.entries(subtiposCount)
      .map(([subtipo, count]) => ({
        subtipo,
        count,
        pct: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    const jugadoresRanking = Object.entries(jugadoresCount)
      .map(([jugadorId, count]) => ({
        jugadorId,
        count,
        pct: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    const zonasRanking = Object.entries(zonasCount)
      .map(([k, count]) => ({
        zona: Number(k),
        count,
        pct: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    estadisticasObservadas = {
      tipoObservado,
      totalEncontradas: total,
      promedioAccionesDistancia:
        Math.round((sumDistanciaAcciones / total) * 10) / 10,
      promedioPuntosDistancia:
        Math.round((sumDistanciaPuntos / total) * 10) / 10,
      pctMismoPunto: Math.round((countMismoPunto / total) * 100),
      pctPuntosPosteriores: Math.round(
        ((total - countMismoPunto) / total) * 100
      ),
      evaluacionResultado,
      subtiposRanking,
      subtipoMasFrecuente: subtiposRanking[0]?.subtipo ?? null,
      jugadoresRanking,
      jugadorMasFrecuenteId: jugadoresRanking[0]?.jugadorId ?? null,
      zonasRanking,
      zonaMasFrecuente: zonasRanking[0]?.zona ?? null,
    };
  }

  return {
    totalOcurrencias: triggers.length,
    ocurrencias,
    distribucionSiguiente,
    distribucionSubtipo,
    resumenPorTipo,
    coincidenciasGlobales,
    estadisticasObservadas,
    comportamientoTrigger,
  };
}