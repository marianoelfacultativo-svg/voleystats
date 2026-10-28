// ============================================================
// ANÁLISIS DE CONSECUENCIAS — motor puro
// ============================================================
// "Si pasa X, ¿qué pasa después?"
//
// A diferencia de `filtrosTacticos` (que FILTRA acciones),
// este módulo AGREGA y RESUME qué ocurre después de un trigger.
//
// Permite observar:
//   - La 1ra acción siguiente inmediata
//   - O la siguiente acción de un tipo específico (ej. "siguiente ataque"),
//     incluso si ocurre puntos o acciones después.
//   - Evalúa resultado dominante (punto, error, neutro).
//   - Subtipo más frecuente.
//   - Promedio de toques y puntos de distancia entre ambas acciones.
//   - Jugador y zona predominantes.
// ============================================================

import type { AccionVisual } from "../app/equipo/adaptadorUnificadoV2";

// ------------------------------------------------------------
// TIPOS
// ------------------------------------------------------------

export type TipoDisparador =
  | "saque"
  | "recepcion"
  | "armado"
  | "ataque"
  | "bloqueo"
  | "defensa"
  | "libre"
  | "roce-red";

export interface DisparadorFiltro {
  tipo: TipoDisparador;
  /** "cualquiera" = cualquier resultado */
  resultado: string | "cualquiera";
}

export type Ventana = 1 | 2 | 3 | "todas";

export type CategoriaResultado = "punto" | "error" | "neutro";

export interface CoincidenciaFiltro {
  /** La próxima acción es del MISMO jugador que ejecutó el trigger. */
  mismoJugadorTrigger: boolean;
  /** La próxima acción cae en la MISMA zona destino que el trigger. */
  mismaZonaTriggerDestino: boolean;
  /** La próxima acción sale de la MISMA zona origen que el trigger. */
  mismaZonaTriggerOrigen: boolean;
  /** La próxima acción sale de la MISMA zona origen que la acción previa al trigger. */
  mismaZonaAnteriorOrigen: boolean;
  /** La próxima acción cae en la MISMA zona destino que la acción previa al trigger. */
  mismaZonaAnteriorDestino: boolean;
  /** La próxima acción tiene la MISMA velocidad de armado que la previa al trigger. */
  mismaVelocidadAnterior: boolean;
  /** La próxima acción tiene el MISMO tipo de saque que la previa al trigger. */
  mismoTipoSaqueAnterior: boolean;
  /** La próxima acción es del MISMO jugador que la previa al trigger. */
  mismoReceptorAnterior: boolean;
}

export const COINCIDENCIA_VACIA: CoincidenciaFiltro = {
  mismoJugadorTrigger: false,
  mismaZonaTriggerDestino: false,
  mismaZonaTriggerOrigen: false,
  mismaZonaAnteriorOrigen: false,
  mismaZonaAnteriorDestino: false,
  mismaVelocidadAnterior: false,
  mismoTipoSaqueAnterior: false,
  mismoReceptorAnterior: false,
};

export interface FiltrosAnalisis {
  disparador: DisparadorFiltro | null;
  ventana: Ventana;
  coincidencias: CoincidenciaFiltro;
  /** Tipo específico de acción a observar (ej. "ataque", "saque", "recepcion" o "cualquiera"). */
  tipoObservado?: TipoDisparador | "cualquiera";
  /** Alcance: "partido" (busca la siguiente en el partido) o "mismo_punto". */
  alcance?: "partido" | "mismo_punto";
  /** ID del jugador que ejecuta el disparador. */
  jugadorId?: string | null;
}

export const FILTROS_ANALISIS_VACIO: FiltrosAnalisis = {
  disparador: null,
  ventana: 1,
  coincidencias: { ...COINCIDENCIA_VACIA },
  tipoObservado: "cualquiera",
  alcance: "partido",
  jugadorId: null,
};

// ------------------------------------------------------------
// RESULTADOS
// ------------------------------------------------------------

export interface DetalleAccionObservada {
  accion: AccionVisual;
  distanciaAcciones: number;
  distanciaPuntos: number;
  esMismoPunto: boolean;
  categoriaResultado: CategoriaResultado;
  subtipo: string;
}

export interface OcurrenciaTrigger {
  set_numero: number;
  punto_numero: number;
  triggerId: string;
  triggerJugadorId: string | null;
  triggerSubtipo: string | null;
  anteriorId: string | null;
  anteriorJugadorId: string | null;
  anteriorSubtipo: string | null;
  /** Las próximas acciones hasta la ventana dentro del punto. */
  siguientes: AccionVisual[];
  /** La acción objetivo observada específica (si se encontró). */
  accionObservada?: DetalleAccionObservada | null;
}

export interface CoincidenciasResumen {
  mismoJugadorTrigger: number;
  mismaZonaTriggerDestino: number;
  mismaZonaTriggerOrigen: number;
  mismaZonaAnteriorOrigen: number;
  mismaZonaAnteriorDestino: number;
  mismaVelocidadAnterior: number;
  mismoTipoSaqueAnterior: number;
  mismoReceptorAnterior: number;
}

export interface ResumenPorTipo {
  tipo: string;
  count: number;
  coincidencias: CoincidenciasResumen;
}

export interface EvaluacionResultado {
  masFrecuente: CategoriaResultado;
  puntos: number;
  errores: number;
  neutros: number;
  total: number;
  pctPuntos: number;
  pctErrores: number;
  pctNeutros: number;
  /** Saldo neto porcentual: ((puntos - errores) / total) * 100 */
  efectividadNeta: number;
}

export interface EstadisticasObservadas {
  tipoObservado: TipoDisparador | "cualquiera";
  totalEncontradas: number;
  promedioAccionesDistancia: number;
  promedioPuntosDistancia: number;
  pctMismoPunto: number;
  pctPuntosPosteriores: number;
  evaluacionResultado: EvaluacionResultado;
  subtiposRanking: { subtipo: string; count: number; pct: number }[];
  subtipoMasFrecuente: string | null;
  jugadoresRanking: { jugadorId: string; count: number; pct: number }[];
  jugadorMasFrecuenteId: string | null;
  zonasRanking: { zona: number; count: number; pct: number }[];
  zonaMasFrecuente: number | null;
}

export interface ResultadoAnalisis {
  totalOcurrencias: number;
  ocurrencias: OcurrenciaTrigger[];
  distribucionSiguiente: Record<string, number>;
  distribucionSubtipo: Record<string, number>;
  resumenPorTipo: ResumenPorTipo[];
  coincidenciasGlobales: CoincidenciasResumen;
  /** Métricas detalladas de la acción observada */
  estadisticasObservadas?: EstadisticasObservadas;
}

// ------------------------------------------------------------
// CLASIFICACIÓN DE RESULTADOS (Punto / Error / Neutro)
// ------------------------------------------------------------

export function clasificarResultado(a: AccionVisual): CategoriaResultado {
  const sub = baseSubtipo(a).toLowerCase();
  const tipo = a.tipo;

  // Errores directos marcados
  if (a.es_error) return "error";

  if (tipo === "ataque") {
    if (sub === "punto") return "punto";
    if (
      sub.includes("error") ||
      sub.includes("gorro") ||
      sub === "use_rival_ataque" ||
      sub === "error_red_ataque" ||
      sub === "error_afuera_ataque"
    ) {
      return "error";
    }
    return "neutro";
  }

  if (tipo === "saque") {
    if (sub === "ace") return "punto";
    if (sub === "negativo" || sub.includes("error")) return "error";
    return "neutro";
  }

  if (tipo === "bloqueo") {
    if (sub === "punto") return "punto";
    if (sub === "red" || sub === "use_rival") return "error";
    return "neutro";
  }

  if (tipo === "recepcion") {
    if (sub === "ace_contra" || sub === "error_directo") return "error";
    if (sub === "perfecta" || sub === "2x_positiva" || sub === "positiva") {
      return "punto"; // valoración positiva de recepción
    }
    return "neutro";
  }

  if (tipo === "defensa") {
    if (
      sub === "error_def" ||
      sub === "errores_graves" ||
      sub === "mala_libre"
    ) {
      return "error";
    }
    if (sub === "gran_def" || sub === "toque_positiva" || sub === "cobertura_positiva") {
      return "punto"; // salvada brillante / positiva
    }
    return "neutro";
  }

  // Genérico
  if (sub.includes("punto") || sub === "ace") return "punto";
  if (sub.includes("error") || sub === "horrible" || sub === "malo") return "error";

  return "neutro";
}

// ------------------------------------------------------------
// HELPERS INTERNOS
// ------------------------------------------------------------

export function baseSubtipo(a: AccionVisual): string {
  const s =
    a.subtipo !== null && a.subtipo !== undefined
      ? String(a.subtipo)
      : "";
  return s.startsWith("toque:") ? s.slice(6) : s;
}

function coincide(a: AccionVisual, filtro: CoincidenciaFiltro, ref: {
  trigger: AccionVisual;
  anterior: AccionVisual | null;
}): CoincidenciasResumen {
  const { trigger, anterior } = ref;

  const mismoJugadorTrigger =
    !!filtro.mismoJugadorTrigger &&
    a.jugador_id !== null &&
    a.jugador_id === trigger.jugador_id;

  const mismaZonaTriggerDestino =
    !!filtro.mismaZonaTriggerDestino &&
    a.zona_destino !== null &&
    a.zona_destino === trigger.zona_destino;

  const mismaZonaTriggerOrigen =
    !!filtro.mismaZonaTriggerOrigen &&
    a.zona_origen !== null &&
    a.zona_origen === trigger.zona_origen;

  const mismaZonaAnteriorOrigen =
    !!filtro.mismaZonaAnteriorOrigen &&
    !!anterior &&
    a.zona_origen !== null &&
    a.zona_origen === anterior.zona_origen;

  const mismaZonaAnteriorDestino =
    !!filtro.mismaZonaAnteriorDestino &&
    !!anterior &&
    a.zona_destino !== null &&
    a.zona_destino === anterior.zona_destino;

  const mismaVelocidadAnterior =
    !!filtro.mismaVelocidadAnterior &&
    !!anterior &&
    a.velocidad !== null &&
    anterior.velocidad !== null &&
    a.velocidad === anterior.velocidad;

  const mismoTipoSaqueAnterior =
    !!filtro.mismoTipoSaqueAnterior &&
    !!anterior &&
    a.tipo_saque !== null &&
    anterior.tipo_saque !== null &&
    a.tipo_saque === anterior.tipo_saque;

  const mismoReceptorAnterior =
    !!filtro.mismoReceptorAnterior &&
    !!anterior &&
    a.jugador_id !== null &&
    a.jugador_id === anterior.jugador_id;

  return {
    mismoJugadorTrigger: mismoJugadorTrigger ? 1 : 0,
    mismaZonaTriggerDestino: mismaZonaTriggerDestino ? 1 : 0,
    mismaZonaTriggerOrigen: mismaZonaTriggerOrigen ? 1 : 0,
    mismaZonaAnteriorOrigen: mismaZonaAnteriorOrigen ? 1 : 0,
    mismaZonaAnteriorDestino: mismaZonaAnteriorDestino ? 1 : 0,
    mismaVelocidadAnterior: mismaVelocidadAnterior ? 1 : 0,
    mismoTipoSaqueAnterior: mismoTipoSaqueAnterior ? 1 : 0,
    mismoReceptorAnterior: mismoReceptorAnterior ? 1 : 0,
  };
}

function sumarCoincidencias(
  a: CoincidenciasResumen,
  b: CoincidenciasResumen
): CoincidenciasResumen {
  return {
    mismoJugadorTrigger: a.mismoJugadorTrigger + b.mismoJugadorTrigger,
    mismaZonaTriggerDestino:
      a.mismaZonaTriggerDestino + b.mismaZonaTriggerDestino,
    mismaZonaTriggerOrigen:
      a.mismaZonaTriggerOrigen + b.mismaZonaTriggerOrigen,
    mismaZonaAnteriorOrigen:
      a.mismaZonaAnteriorOrigen + b.mismaZonaAnteriorOrigen,
    mismaZonaAnteriorDestino:
      a.mismaZonaAnteriorDestino + b.mismaZonaAnteriorDestino,
    mismaVelocidadAnterior:
      a.mismaVelocidadAnterior + b.mismaVelocidadAnterior,
    mismoTipoSaqueAnterior:
      a.mismoTipoSaqueAnterior + b.mismoTipoSaqueAnterior,
    mismoReceptorAnterior:
      a.mismoReceptorAnterior + b.mismoReceptorAnterior,
  };
}

export function coincidenciasVacias(): CoincidenciasResumen {
  return {
    mismoJugadorTrigger: 0,
    mismaZonaTriggerDestino: 0,
    mismaZonaTriggerOrigen: 0,
    mismaZonaAnteriorOrigen: 0,
    mismaZonaAnteriorDestino: 0,
    mismaVelocidadAnterior: 0,
    mismoTipoSaqueAnterior: 0,
    mismoReceptorAnterior: 0,
  };
}

export function hayComparadoresActivos(f: CoincidenciaFiltro): boolean {
  return Object.values(f).some(Boolean);
}

export function hayFiltroAnalisisActivo(f: FiltrosAnalisis): boolean {
  return f.disparador !== null;
}

// ------------------------------------------------------------
// MOTOR PRINCIPAL
// ------------------------------------------------------------

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

  if (!filtros.disparador) return vacio;

  const {
    disparador,
    ventana,
    coincidencias,
    tipoObservado = "cualquiera",
    alcance = "partido",
  } = filtros;

  // Filtrar ocultas y ordenar cronológicamente
  const accionesCronologicas = acciones
    .filter((a) => !a.oculta)
    .sort((x, y) => {
      if (x.set_numero !== y.set_numero) return x.set_numero - y.set_numero;
      if (x.punto_numero !== y.punto_numero)
        return x.punto_numero - y.punto_numero;
      return x.orden - y.orden;
    });

  const porPunto = new Map<string, AccionVisual[]>();
  for (const a of accionesCronologicas) {
    const k = `${a.set_numero}-${a.punto_numero}`;
    let lista = porPunto.get(k);
    if (!lista) {
      lista = [];
      porPunto.set(k, lista);
    }
    lista.push(a);
  }

  const ocurrencias: OcurrenciaTrigger[] = [];
  const distribucionSiguiente: Record<string, number> = {};
  const distribucionSubtipo: Record<string, number> = {};
  const porTipoCoincidencias = new Map<string, CoincidenciasResumen>();
  let coincidenciasGlobales = coincidenciasVacias();

  const maxSiguientes =
    ventana === "todas" ? Number.POSITIVE_INFINITY : ventana;

  // Acumuladores para estadísticas de la acción observada
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

  for (let i = 0; i < accionesCronologicas.length; i++) {
    const a = accionesCronologicas[i];

    // ¿Es trigger?
    if (disparador.tipo !== a.tipo) continue;
    if (disparador.resultado !== "cualquiera") {
      if (baseSubtipo(a) !== disparador.resultado) continue;
    }
    // Si se especificó un jugador disparador, validar coincidencia
    if (filtros.jugadorId && a.jugador_id !== filtros.jugadorId) {
      continue;
    }

    // Acciones dentro del mismo punto
    const listaPunto = porPunto.get(`${a.set_numero}-${a.punto_numero}`) ?? [];
    const idxEnPunto = listaPunto.findIndex((x) => x.id === a.id);
    const anterior = idxEnPunto > 0 ? listaPunto[idxEnPunto - 1] : null;
    const siguientes =
      idxEnPunto >= 0
        ? listaPunto.slice(idxEnPunto + 1, idxEnPunto + 1 + maxSiguientes)
        : [];

    // Búsqueda de la acción observada específica (hacia adelante en la cronología)
    let accionObservada: DetalleAccionObservada | null = null;
    for (let j = i + 1; j < accionesCronologicas.length; j++) {
      const cand = accionesCronologicas[j];

      // Si el alcance es solo dentro del mismo punto y cambió de punto, cortar
      if (
        alcance === "mismo_punto" &&
        (cand.set_numero !== a.set_numero || cand.punto_numero !== a.punto_numero)
      ) {
        break;
      }

      const coincideTipo =
        tipoObservado === "cualquiera" || cand.tipo === tipoObservado;
      if (!coincideTipo) continue;

      // Si se requiere que la acción observada sea del mismo jugador
      if (coincidencias.mismoJugadorTrigger) {
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

      if (true) {
        const distanciaAcciones = j - i;
        let distanciaPuntos = 0;
        if (cand.set_numero === a.set_numero) {
          distanciaPuntos = Math.max(0, cand.punto_numero - a.punto_numero);
        } else {
          distanciaPuntos = Math.max(
            0,
            (cand.set_numero - a.set_numero) * 25 + cand.punto_numero - a.punto_numero
          );
        }

        const esMismoPunto =
          cand.set_numero === a.set_numero &&
          cand.punto_numero === a.punto_numero;
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

        // Acumular métricas
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

        break; // primera acción que cumple la condición
      }
    }

    const ocurrencia: OcurrenciaTrigger = {
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
    };
    ocurrencias.push(ocurrencia);

    // Distribución clásica de la primera siguiente en el punto
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

      const prevTipoCoinc = porTipoCoincidencias.get(tipoKey);
      porTipoCoincidencias.set(
        tipoKey,
        prevTipoCoinc
          ? sumarCoincidencias(prevTipoCoinc, coincideS0)
          : coincideS0
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

  // Construir estadísticas avanzadas si hubo ocurrencias
  let estadisticasObservadas: EstadisticasObservadas | undefined;
  if (countObservadas > 0) {
    const total = countObservadas;
    const pctPuntos = Math.round((countPuntos / total) * 100);
    const pctErrores = Math.round((countErrores / total) * 100);
    const pctNeutros = Math.round((countNeutros / total) * 100);

    let masFrecuente: CategoriaResultado = "neutro";
    if (countPuntos >= countErrores && countPuntos >= countNeutros) {
      masFrecuente = "punto";
    } else if (countErrores >= countPuntos && countErrores >= countNeutros) {
      masFrecuente = "error";
    }

    const evaluacionResultado: EvaluacionResultado = {
      masFrecuente,
      puntos: countPuntos,
      errores: countErrores,
      neutros: countNeutros,
      total,
      pctPuntos,
      pctErrores,
      pctNeutros,
      efectividadNeta: Math.round(((countPuntos - countErrores) / total) * 100),
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
      .map(([zStr, count]) => ({
        zona: Number(zStr),
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
    totalOcurrencias: ocurrencias.length,
    ocurrencias,
    distribucionSiguiente,
    distribucionSubtipo,
    resumenPorTipo,
    coincidenciasGlobales,
    estadisticasObservadas,
  };
}

// ------------------------------------------------------------
// RESULTADOS DISPONIBLES POR TIPO
// ------------------------------------------------------------

export function resultadosPorTipoAnalisis(tipo: TipoDisparador): string[] {
  switch (tipo) {
    case "saque":
      return [
        "cualquiera",
        "ace",
        "positivo_mas",
        "positivo",
        "neutro",
        "negativo",
        "error_rival",
      ];
    case "recepcion":
      return [
        "cualquiera",
        "perfecta",
        "positiva",
        "intermedia",
        "negativa",
        "doble_negativa",
        "overpass",
        "error_directo",
      ];
    case "armado":
      return ["cualquiera", "1", "2", "3", "4", "5", "6", "R"];
    case "ataque":
      return [
        "cualquiera",
        "punto",
        "neutro",
        "error",
        "error_afuera_ataque",
        "error_red_ataque",
        "gorro_ataque",
        "use_rival_ataque",
        "buena_rival",
        "peligroso",
        "simple",
        "libre",
      ];
    case "bloqueo":
      return [
        "cualquiera",
        "punto",
        "positivo_mas",
        "positivo",
        "neutro",
        "use_rival",
        "red",
        "filtrada",
      ];
    case "defensa":
      return [
        "cualquiera",
        "toque_positiva",
        "toque_negativa",
        "gran_def",
        "error_def",
        "mala_libre",
        "cobertura_positiva",
        "cobertura_negativa",
        "errores_graves",
        "neutro",
      ];
    case "libre":
      return ["cualquiera", "toque", "libre"];
    case "roce-red":
      return [
        "cualquiera",
        "ofensivo-propio",
        "invasion-zaguero",
        "invasion-delantero",
        "roce-red-rival",
      ];
    default:
      return ["cualquiera"];
  }
}

// ------------------------------------------------------------
// ETIQUETAS
// ------------------------------------------------------------

export function etiquetaTipoDisparador(t: TipoDisparador): string {
  const map: Record<TipoDisparador, string> = {
    saque: "Saque",
    recepcion: "Recepción",
    armado: "Armado",
    ataque: "Ataque",
    bloqueo: "Bloqueo",
    defensa: "Defensa",
    libre: "Libre",
    "roce-red": "Roce red",
  };
  return map[t] ?? t;
}

export function etiquetaResultado(r: string): string {
  if (r === "cualquiera") return "Cualquier resultado";
  return r
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
