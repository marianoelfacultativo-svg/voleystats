// ============================================================
// ANÁLISIS DE CONSECUENCIAS — motor puro
// ============================================================
// "Si pasa X, ¿qué pasa después?"
//
// A diferencia de `filtrosTacticos` (que FILTRA acciones),
// este módulo AGREGA y RESUME qué ocurre después de un trigger.
//
// Ej: "si el ataque fue error → quién ataca después, ¿es el
// mismo jugador que erró?, ¿el armador le armó a la misma zona
// que antes?, ¿con la misma velocidad?, ¿al mismo receptor?"
//
// La comparación puede ser contra:
//   - el trigger (ej. mismo jugador que erró)
//   - la acción ANTERIOR al trigger (ej. misma zona del armado previo)
//   - o ambos, en paralelo.
//
// Solo conoce AccionVisual (3D). Para AccionDB hay un adapter
// al final del archivo, igual que en filtrosTacticos.
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
}

export const FILTROS_ANALISIS_VACIO: FiltrosAnalisis = {
  disparador: null,
  ventana: 1,
  coincidencias: { ...COINCIDENCIA_VACIA },
};

// ------------------------------------------------------------
// RESULTADOS
// ------------------------------------------------------------

export interface OcurrenciaTrigger {
  set_numero: number;
  punto_numero: number;
  triggerId: string;
  triggerJugadorId: string | null;
  triggerSubtipo: string | null;
  anteriorId: string | null;
  anteriorJugadorId: string | null;
  anteriorSubtipo: string | null;
  /** Las próximas acciones hasta la ventana. */
  siguientes: AccionVisual[];
}

export interface CoincidenciasResumen {
  /** Cantidad de ocurrencias donde la 1ra siguiente cumple cada comparación. */
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

export interface ResultadoAnalisis {
  /** Total de ocurrencias del disparador en el universo de acciones. */
  totalOcurrencias: number;
  ocurrencias: OcurrenciaTrigger[];
  /** Distribución del primer tipo de acción siguiente. */
  distribucionSiguiente: Record<string, number>;
  /** Distribución del primer subtipo siguiente por tipo: "armado|5" → count. */
  distribucionSubtipo: Record<string, number>;
  /** Por cada tipo de acción siguiente, cuántas coincidencias cumplen. */
  resumenPorTipo: ResumenPorTipo[];
  /** Agregado de todas las ocurrencias (coincide con la 1ra siguiente). */
  coincidenciasGlobales: CoincidenciasResumen;
}

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

function baseSubtipo(a: AccionVisual): string {
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

function coincidenciasVacias(): CoincidenciasResumen {
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

/** Devuelve true si algún comparador está activo. */
export function hayComparadoresActivos(c: CoincidenciaFiltro): boolean {
  return Object.values(c).some(Boolean);
}

/** Devuelve true si el filtro tiene un disparador configurado. */
export function hayFiltroAnalisisActivo(f: FiltrosAnalisis): boolean {
  return f.disparador !== null;
}

// ------------------------------------------------------------
// MOTOR
// ------------------------------------------------------------

/**
 * Analiza las consecuencias de un trigger en el universo de acciones.
 *
 * @param acciones Universo completo del partido (o del jugador).
 * @param filtros  Configuración del análisis.
 * @returns Resultado agregado con ocurrencias, distribuciones y
 *          porcentajes de coincidencia.
 */
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

  const { disparador, ventana, coincidencias } = filtros;

  // Agrupar por punto, ordenado por `orden`.
  const porPunto = new Map<string, AccionVisual[]>();
  for (const a of acciones) {
    if (a.oculta) continue;
    const k = `${a.set_numero}-${a.punto_numero}`;
    let lista = porPunto.get(k);
    if (!lista) {
      lista = [];
      porPunto.set(k, lista);
    }
    lista.push(a);
  }
  for (const lista of porPunto.values()) {
    lista.sort((x, y) => x.orden - y.orden);
  }

  const ocurrencias: OcurrenciaTrigger[] = [];
  const distribucionSiguiente: Record<string, number> = {};
  const distribucionSubtipo: Record<string, number> = {};
  const porTipoCoincidencias = new Map<string, CoincidenciasResumen>();
  let coincidenciasGlobales = coincidenciasVacias();

  const maxSiguientes =
    ventana === "todas" ? Number.POSITIVE_INFINITY : ventana;

  for (const [key, lista] of porPunto) {
    const [setStr, puntoStr] = key.split("-");
    const set_numero = parseInt(setStr, 10);
    const punto_numero = parseInt(puntoStr, 10);

    for (let i = 0; i < lista.length; i++) {
      const a = lista[i];

      // ¿Es trigger?
      if (disparador.tipo !== a.tipo) continue;
      if (disparador.resultado !== "cualquiera") {
        if (baseSubtipo(a) !== disparador.resultado) continue;
      }

      const anterior = i > 0 ? lista[i - 1] : null;
      const siguientes = lista.slice(i + 1, i + 1 + maxSiguientes);

      const ocurrencia: OcurrenciaTrigger = {
        set_numero,
        punto_numero,
        triggerId: a.id,
        triggerJugadorId: a.jugador_id,
        triggerSubtipo: baseSubtipo(a) || null,
        anteriorId: anterior?.id ?? null,
        anteriorJugadorId: anterior?.jugador_id ?? null,
        anteriorSubtipo: anterior ? baseSubtipo(anterior) || null : null,
        siguientes,
      };
      ocurrencias.push(ocurrencia);

      // Distribución de la PRIMERA siguiente (si hay).
      if (siguientes.length > 0) {
        const s0 = siguientes[0];
        const tipoKey = s0.tipo;
        distribucionSiguiente[tipoKey] =
          (distribucionSiguiente[tipoKey] ?? 0) + 1;

        const subKey = `${s0.tipo}|${baseSubtipo(s0) || "—"}`;
        distribucionSubtipo[subKey] =
          (distribucionSubtipo[subKey] ?? 0) + 1;

        // Coincidencias: solo evaluamos sobre la 1ra siguiente.
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

  return {
    totalOcurrencias: ocurrencias.length,
    ocurrencias,
    distribucionSiguiente,
    distribucionSubtipo,
    resumenPorTipo,
    coincidenciasGlobales,
  };
}

// ------------------------------------------------------------
// RESULTADOS DISPONIBLES POR TIPO (reusado del filtrosTacticos)
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
  return map[t];
}

export function etiquetaResultado(r: string): string {
  if (r === "cualquiera") return "Cualquier resultado";
  return r
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}