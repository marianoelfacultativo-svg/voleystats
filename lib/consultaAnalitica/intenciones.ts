// ============================================================
// INTENCIONES — Diccionarios + tipos del parser de intención
// ============================================================
// FASE 1 del plan "Consultas Analíticas Libres".
//
// Acá viven:
//   - Los tipos de la consulta (IntencionQuery, AggFn, GroupBy, etc.)
//   - Los diccionarios de sinónimos de cada intención
//     (count, percentage, average, frequency, max, min, ranking,
//      comparison, distribution, trend, habit)
//   - Los diccionarios de agrupación (group by)
//   - Los diccionarios de métricas estándar de vóley
//   - Los diccionarios de tiempo (últimos N, día de la semana, etc.)
//   - Los diccionarios de condición (cuando está 20-18, en racha
//     de 3+, con 3 toques, de delantero, después de un cambio, etc.)
//
// v1.1 (FASE 1 ampliada):
//   + GroupBy: "ubicacion" y "cambio"
//   + CondicionFiltro.ubicacion, .zonaJugador, .cambioEnPunto,
//     .despuesDeCambio
//   + SINONIMOS_UBICACION y SINONIMOS_CAMBIO
//   + Entradas correspondientes en SINONIMOS_GROUPBY y
//     SINONIMOS_CONDICION
//
// Nota de alcance: "cuántos cambios" (contar eventos de cambio en
// sí) no es representable con el modelo actual porque los cambios
// no son acciones sino eventos (puntos_v2.cambios / cambios_jugador).
// Lo que SÍ se puede es "cuántos puntos tuvieron cambios" o "qué
// pasó después de un cambio" (cambioEnPunto / despuesDeCambio).
// Si más adelante querés contar cambios reales, se agrega como
// métrica especial en FASE 3.
//
// Nada de lógica: solo datos y tipos. La lógica vive en
// parserIntencion.ts.
// ============================================================

// ------------------------------------------------------------
// TIPOS
// ------------------------------------------------------------

export type TipoIntencion =
  | "count"
  | "percentage"
  | "average"
  | "frequency"
  | "max"
  | "min"
  | "ranking"
  | "comparison"
  | "distribution"
  | "trend"
  | "habit"
  | "unknown";

export type AggFn =
  | "count"
  | "sum"
  | "avg"
  | "median"
  | "percentile_25"
  | "percentile_50"
  | "percentile_75"
  | "percentile_90"
  | "max"
  | "min"
  | "ratio"
  | "percentage"
  | "frequency"
  | "stddev"
  | "mode";

export type GroupBy =
  | "set"
  | "partido"
  | "jugador"
  | "zona_origen"
  | "zona_destino"
  | "zona_jugador"
  | "rotacion"
  | "rol"
  | "ubicacion"
  | "fase"
  | "rival"
  | "resultado_partido"
  | "tipo"
  | "subtipo"
  | "velocidad"
  | "tipo_saque"
  | "variante"
  | "cambio";

export type TiempoTipo =
  | "ultimos_n_partidos"
  | "ultimos_n_sets"
  | "ultimos_n_jugadas"
  | "esta_temporada"
  | "esta_semana"
  | "este_mes"
  | "este_ano"
  | "temporada_pasada"
  | "dia_semana"
  | "partido_especifico"
  | "set_especifico"
  | "punto_especifico";

export type DiaSemana =
  | "lunes"
  | "martes"
  | "miercoles"
  | "jueves"
  | "viernes"
  | "sabado"
  | "domingo";

export type UbicacionQuery = "delantero" | "zaguero" | "libero" | "otro";

export interface TiempoFiltro {
  tipo: TiempoTipo;
  n?: number;
  diaSemana?: DiaSemana;
  rival?: string;
  set?: number;
  punto?: number;
}

export interface CondicionFiltro {
  marcador?: string;
  diferencia?: number;
  puntoCritico?: boolean;
  rachaMinima?: number;
  fase?: string;
  toquesMinimos?: number;
  calidadArmado?: number;
  conErrorPrevio?: boolean;
  conAciertoPrevio?: boolean;
  /** Ubicación del jugador al momento de la acción. */
  ubicacion?: UbicacionQuery;
  /** Zonas del jugador (1-6) al momento de la acción. */
  zonaJugador?: number[];
  /** ¿El punto tuvo algún cambio de jugador antes/durante la acción? */
  cambioEnPunto?: boolean;
  /** ¿La acción inmediatamente anterior fue un cambio? */
  despuesDeCambio?: boolean;
}

export interface IntencionQuery {
  tipo: TipoIntencion;
  agregacion: AggFn;
  groupBy: GroupBy | null;
  metrica: string | null;
  ordenamiento: "asc" | "desc" | null;
  limite: number | null;
  comparacion: { a: string; b: string } | null;
  tiempo: TiempoFiltro | null;
  condicion: CondicionFiltro | null;
  fragmentos: string[];
  original: string;
}

export function intencionVacia(): IntencionQuery {
  return {
    tipo: "unknown",
    agregacion: "count",
    groupBy: null,
    metrica: null,
    ordenamiento: null,
    limite: null,
    comparacion: null,
    tiempo: null,
    condicion: null,
    fragmentos: [],
    original: "",
  };
}

// ------------------------------------------------------------
// DICCIONARIOS DE INTENCIÓN
// ------------------------------------------------------------

export const SINONIMOS_COUNT: string[] = [
  "cuantos", "cuantas", "cuanto", "cuanta",
  "cantidad", "cantidades", "total", "totales",
  "numero", "numeros",
  "cuantas veces", "cuantos hubo", "cuantos fueron", "cuantos hizo",
  "cuantas hizo", "cuantas hay", "cuantos hay", "cuantas hubo",
  "cuantos hubieron", "cuantos tenemos", "cuantas tenemos",
  "cuantos tiene", "cuantas tiene",
  "cuantos son", "cuantas son",
  "cuantos estan", "cuantas estan",
];

export const SINONIMOS_PERCENTAGE: string[] = [
  "porcentaje", "porcentajes", "por ciento", "porciento", "porcientos",
  "%", "que porcentaje", "que %", "que tanto por ciento",
  "proporcion", "proporciones", "ratio", "ratios",
  "que tanto", "que fraccion", "que parte", "que proporcion",
  "de cada 100", "de cada cien", "cada cien", "cada 100",
];

export const SINONIMOS_AVERAGE: string[] = [
  "promedio", "promedios", "media", "medias",
  "en promedio", "promedio de", "media de",
  "por set", "por partido", "por jugador", "por rotacion", "por punto",
  "cuanto promedia", "cuanto promedian", "cuanto promedio",
  "cual es el promedio", "cual es la media",
];

export const SINONIMOS_FREQUENCY: string[] = [
  "cada cuanto", "cada cuantos", "cada cuantas",
  "frecuencia", "frecuencias",
  "con que frecuencia", "que tan seguido", "que tan frecuente",
  "cada cuantas veces", "cada cuantos puntos",
  "cada cuantos sets", "cada cuantos partidos",
  "cada cuantos ataques", "cada cuantos saques",
  "cada cuantos bloqueos", "cada cuantos eventos",
  "que tan a menudo", "cuantas veces por",
  "cuantas veces cada",
];

export const SINONIMOS_MAX: string[] = [
  "maximo", "maximos", "maxima", "maximas",
  "el mas", "la mas", "los mas", "las mas",
  "el mejor", "la mejor", "los mejores", "las mejores",
  "el que mas", "la que mas", "los que mas", "las que mas",
  "mayor", "mayores",
  "cual fue el mejor", "cual fue el maximo", "cual es el mejor",
];

export const SINONIMOS_MIN: string[] = [
  "minimo", "minimos", "minima", "minimas",
  "el menos", "la menos", "los menos", "las menos",
  "el peor", "la peor", "los peores", "las peores",
  "el que menos", "la que menos", "los que menos", "las que menos",
  "menor", "menores",
  "cual fue el peor", "cual fue el minimo", "cual es el peor",
];

export const SINONIMOS_RANKING: string[] = [
  "ranking", "rankings", "rankear",
  "ordenar", "ordena", "ordena por", "ordenados por",
  "de mayor a menor", "de menor a mayor",
  "mejor a peor", "peor a mejor",
  "podio", "primeros", "ultimos",
  "cual es el primero", "cual es el ultimo",
];

export const SINONIMOS_COMPARISON: string[] = [
  " vs ", " versus ", " contra ", " frente a ",
  "comparado con", "comparado a", "comparar", "comparacion",
  "comparando", "compara", "compara con",
  "diferencia entre", "diferencias entre",
  "mejor que", "peor que", "mas que", "menos que",
  "en comparacion", "en comparacion con",
];

export const SINONIMOS_DISTRIBUTION: string[] = [
  "distribucion", "distribuciones", "distribuir", "distribuido",
  "reparto", "repartir", "repartido",
  "desglose", "desglosar", "desglosado", "desglosada",
  "separado por", "separado en", "separados por",
  "agrupado por", "agrupado en", "agrupados por",
  "desglosado por", "desglosado en",
  "segun", "por tipo", "por categoria", "por zona",
  "cuantos por", "que porcentaje por", "cuanto por",
];

export const SINONIMOS_TREND: string[] = [
  "evolucion", "evoluciones", "evoluciono", "evolucionando",
  "tendencia", "tendencias",
  "como fue", "como fueron", "como viene", "como vienen",
  "a lo largo", "set a set", "partido a partido",
  "progresion", "progreso", "progresando",
  "como cambio", "como vario",
  "comparado con el set anterior", "comparado con el partido anterior",
  "comparado con la semana anterior", "comparado con el mes anterior",
  "como evoluciono", "como evolucionaron",
  "como viene evolucionando", "como viene rindiendo",
];

export const SINONIMOS_HABIT: string[] = [
  "suele", "suelen", "solia", "solian", "soler",
  "tiende a", "tienden a", "tendia a", "tendian a",
  "normalmente", "normal", "generalmente", "general",
  "acostumbra", "acostumbran", "acostumbraba",
  "por lo general", "en general",
  "habitualmente", "habitual",
  "la mayoria de las veces", "mayoria de las veces",
  "casi siempre", "casi nunca",
  "frecuentemente", "frecuente",
  "lo tipico", "lo habitual", "lo comun",
  "lo que suele", "lo que suelen",
  "que hace habitualmente", "que hace normalmente",
  "que acostumbra", "que acostumbran",
];

// ------------------------------------------------------------
// UBICACIÓN DEL JUGADOR
// ------------------------------------------------------------
// Delantero / zaguero / líbero. Distinto de zona (1-6) y de rol
// (A / O / C1 / C2 / P1 / P2 / L).
//
// Nota: "libero" también matchea con el rol L. El parser debería
// setear AMBOS (ubicacion = "libero" y rol = "L") cuando detecta
// esa palabra, porque el líbero es a la vez ubicación y rol.
// ------------------------------------------------------------

export const SINONIMOS_UBICACION: {
  patrones: string[];
  ubicacion: UbicacionQuery;
}[] = [
  {
    patrones: [
      "delantero", "delanteros", "delantera", "delanteras",
      "front row", "en la red", "en red", "de red",
    ],
    ubicacion: "delantero",
  },
  {
    patrones: [
      "zaguero", "zagueros", "zaguera", "zagueras",
      "back row", "del fondo", "en el fondo",
    ],
    ubicacion: "zaguero",
  },
  {
    patrones: [
      "libero", "liberos", "líbero", "líberos",
      "libera", "líbera",
    ],
    ubicacion: "libero",
  },
];

// ------------------------------------------------------------
// CAMBIO DE JUGADOR
// ------------------------------------------------------------
// Los cambios no son acciones, son eventos que se guardan en
// puntos_v2.cambios (y legacy en cambios_jugador). Sirven para
// filtrar puntos ("puntos con cambio") y acciones ("después de
// un cambio"), no para contar cambios como acciones.
//
// Si más adelante se quiere "contar cambios reales", se agrega
// una métrica especial en FASE 3 (no es un GroupBy ni un
// CondicionFiltro estándar).
// ------------------------------------------------------------

export const SINONIMOS_CAMBIO: string[] = [
  "cambio", "cambios", "cambió", "cambio_",
  "cambian", "cambia", "cambiamos", "cambiaron", "cambiando",
  "sustitucion", "sustitución", "sustituciones",
  "sustituye", "sustituyo", "sustituyó",
  "reemplazo", "reemplazos", "reemplaza", "reemplazo_",
  "despues de un cambio", "después de un cambio",
  "tras un cambio", "luego de un cambio",
  "despues del cambio", "después del cambio",
  "tras el cambio", "luego del cambio",
  "despues de cambios", "después de cambios",
  "tras cambios", "luego de cambios",
  "con cambio", "sin cambio", "con cambios", "sin cambios",
  "con cambio previo", "con cambios previos",
  "sin cambio previo", "sin cambios previos",
  "tuvo cambio", "tuvo cambios", "tuvo un cambio",
  "hubo cambio", "hubo cambios", "hubo un cambio",
  "jugador que entro", "jugador que entró",
  "jugador que salio", "jugador que salió",
];

// ------------------------------------------------------------
// TIEMPO
// ------------------------------------------------------------

export const DIAS_SEMANA: DiaSemana[] = [
  "lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo",
];

export const SINONIMOS_ULTIMOS: string[] = [
  "ultimos", "ultimas", "ultimo", "ultima",
  "recientes", "reciente",
  "pasados", "pasadas", "pasado", "pasada",
  "anteriores", "anterior",
  "los ultimos", "las ultimas",
];

export const SINONIMOS_TEMPORADA: string[] = [
  "esta temporada", "temporada actual", "temporada en curso",
  "esta semana", "semana actual", "semana en curso",
  "este mes", "mes actual", "mes en curso",
  "este ano", "ano actual", "ano en curso",
  "temporada pasada", "temporada anterior",
  "semana pasada", "mes pasado", "ano pasado",
];

export const SINONIMOS_ESPECIFICOS: string[] = [
  "en el partido", "en el partido del", "en el partido de",
  "en el set", "en el punto",
  "en la temporada", "en la semana", "en el mes", "en el ano",
];

// ------------------------------------------------------------
// CONDICIÓN
// ------------------------------------------------------------
// Frases "conectoras" que suelen introducir una condición.
// El parser después busca QUÉ condición específica sigue
// (marcador, zona, ubicación, cambio, etc.) en los demás
// diccionarios.
// ------------------------------------------------------------

export const SINONIMOS_CONDICION: string[] = [
  "cuando", "si", "en los casos en que", "siempre que",
  "cada vez que", "despues de", "antes de", "tras", "luego de",
  "en situacion de", "estando", "con el marcador",
  "con diferencia de", "en punto critico", "en racha de",
  "con 2 toques", "con 3 toques", "con 4 toques",
  "en fase de", "en side-out", "en side out",
  "en k2", "en k3", "en free ball", "en freeball",
  "con armado de", "con calidad de", "con error previo",
  "con acierto previo",
  // Ubicación
  "como delantero", "como delanteros", "de delantero", "de delanteros",
  "como zaguero", "como zagueros", "de zaguero", "de zagueros",
  "como libero", "como liberos", "de libero", "de liberos",
  "como líbero", "como líberos", "de líbero", "de líberos",
  "jugando de delantero", "jugando de zaguero", "jugando de libero",
  "jugando de líbero",
  "estando de delantero", "estando de zaguero",
  "estando de libero", "estando de líbero",
  // Cambio
  "despues de un cambio", "después de un cambio",
  "tras un cambio", "luego de un cambio",
  "despues del cambio", "después del cambio",
  "tras el cambio", "luego del cambio",
  "despues de cambios", "después de cambios",
  "tras cambios", "luego de cambios",
  "con cambio previo", "con cambios previos",
  "sin cambio previo", "sin cambios previos",
];

// ------------------------------------------------------------
// GROUP BY
// ------------------------------------------------------------

export const SINONIMOS_GROUPBY: { patrones: string[]; groupBy: GroupBy }[] = [
  {
    patrones: ["por set", "por cada set", "en cada set", "set a set"],
    groupBy: "set",
  },
  {
    patrones: ["por partido", "por cada partido", "en cada partido", "partido a partido"],
    groupBy: "partido",
  },
  {
    patrones: ["por jugador", "por cada jugador", "en cada jugador", "por jugadora"],
    groupBy: "jugador",
  },
  {
    patrones: ["por zona origen", "por zona de origen", "por origen"],
    groupBy: "zona_origen",
  },
  {
    patrones: ["por zona destino", "por zona de destino", "por destino"],
    groupBy: "zona_destino",
  },
  {
    patrones: ["por zona jugador", "por zona del jugador", "por zona de jugador"],
    groupBy: "zona_jugador",
  },
  {
    patrones: ["por rotacion", "por cada rotacion", "por rota", "rotacion a rotacion"],
    groupBy: "rotacion",
  },
  {
    patrones: ["por rol", "por cada rol"],
    groupBy: "rol",
  },
  {
    patrones: [
      "por ubicacion", "por ubicación",
      "por delantero", "por delanteros",
      "por zaguero", "por zagueros",
      "por libero", "por liberos", "por líbero", "por líberos",
      "por ubicacion en cancha", "por ubicación en cancha",
    ],
    groupBy: "ubicacion",
  },
  {
    patrones: ["por fase", "por cada fase", "por fase de rally"],
    groupBy: "fase",
  },
  {
    patrones: ["por rival", "por cada rival", "por cada equipo rival"],
    groupBy: "rival",
  },
  {
    patrones: ["por resultado", "por cada resultado", "por resultado del partido"],
    groupBy: "resultado_partido",
  },
  {
    patrones: ["por tipo", "por cada tipo", "por tipo de accion", "por fundamento"],
    groupBy: "tipo",
  },
  {
    patrones: ["por subtipo", "por cada subtipo", "por valoracion"],
    groupBy: "subtipo",
  },
  {
    patrones: ["por velocidad", "por cada velocidad", "por velocidad de armado"],
    groupBy: "velocidad",
  },
  {
    patrones: ["por tipo de saque", "por tipo saque"],
    groupBy: "tipo_saque",
  },
  {
    patrones: ["por variante", "por cada variante"],
    groupBy: "variante",
  },
  {
    patrones: [
      "por cambio", "por cambios",
      "por sustitucion", "por sustituciones", "por sustitución",
      "por reemplazo", "por reemplazos",
      "con o sin cambio", "con o sin cambios",
      "con cambio", "sin cambio", "con cambios", "sin cambios",
    ],
    groupBy: "cambio",
  },
];

// ------------------------------------------------------------
// MÉTRICAS DE VÓLEY
// ------------------------------------------------------------
// Nombres de las métricas estándar (kill %, sideout %, etc.)
// que el motor de cálculo va a resolver más adelante.
// ------------------------------------------------------------

export const SINONIMOS_METRICA: { patrones: string[]; metrica: string }[] = [
  {
    patrones: [
      "kill", "kill %", "kill porcentaje", "porcentaje de kill",
      "porcentaje de punto de ataque", "porcentaje de punto en ataque",
      "porcentaje de punto atacando",
    ],
    metrica: "kill_pct",
  },
  {
    patrones: [
      "eficiencia de ataque", "eficiencia ataque", "attack efficiency",
      "eficiencia atacando", "eficiencia en ataque",
    ],
    metrica: "attack_efficiency",
  },
  {
    patrones: [
      "hitting", "hitting %", "porcentaje de golpeo", "porcentaje de golpe",
    ],
    metrica: "hitting_pct",
  },
  {
    patrones: [
      "sideout", "side-out", "side out %", "porcentaje de side-out",
      "porcentaje de sideout", "efectividad recibiendo",
      "efectividad en recepcion",
    ],
    metrica: "sideout_pct",
  },
  {
    patrones: [
      "break point", "break-point", "break point %",
      "porcentaje de break point", "efectividad sacando",
      "efectividad en saque",
    ],
    metrica: "break_point_pct",
  },
  {
    patrones: [
      "recepcion %", "porcentaje de recepcion", "calidad de recepcion",
      "calidad de recepciones",
    ],
    metrica: "reception_pct",
  },
  {
    patrones: [
      "ace %", "porcentaje de ace", "porcentaje de aces",
    ],
    metrica: "ace_pct",
  },
  {
    patrones: [
      "error de saque %", "porcentaje de error de saque",
      "porcentaje de errores de saque",
    ],
    metrica: "serve_error_pct",
  },
  {
    patrones: [
      "eficiencia de bloqueo", "eficiencia bloqueo",
      "eficiencia bloqueando",
    ],
    metrica: "block_efficiency",
  },
  {
    patrones: [
      "eficiencia de defensa", "eficiencia defensa",
      "eficiencia defendiendo",
    ],
    metrica: "dig_efficiency",
  },
  {
    patrones: [
      "puntos por set", "promedio de puntos por set",
    ],
    metrica: "puntos_por_set",
  },
  {
    patrones: [
      "puntos por rotacion", "promedio de puntos por rotacion",
    ],
    metrica: "puntos_por_rotacion",
  },
];

// ------------------------------------------------------------
// ORDEN DE EVALUACIÓN
// ------------------------------------------------------------
// El primer tipo cuyo sinónimo aparece en el texto gana.
// Va de MÁS específico a MÁS genérico.
//
// Reglas de prioridad:
//   - "cada cuánto" (frequency) gana sobre "cuánto" (count)
//   - "ranking" / "top N" gana sobre "cuántos"
//   - "X vs Y" gana sobre "cuántos"
//   - "%" gana sobre "cuántos"
//   - "promedio" gana sobre "cuántos"
//   - "máximo / mejor" gana sobre "cuántos"
//   - "distribución" gana sobre "cuántos"
//   - "evolución" gana sobre "cuántos"
//   - "suele" gana sobre "cuántos"
// ------------------------------------------------------------

export const ORDEN_EVALUACION: {
  tipo: TipoIntencion;
  sinonimos: string[];
  agregacion: AggFn;
}[] = [
  {
    tipo: "frequency",
    sinonimos: SINONIMOS_FREQUENCY,
    agregacion: "frequency",
  },
  {
    tipo: "ranking",
    sinonimos: SINONIMOS_RANKING,
    agregacion: "count",
  },
  {
    tipo: "comparison",
    sinonimos: SINONIMOS_COMPARISON,
    agregacion: "percentage",
  },
  {
    tipo: "percentage",
    sinonimos: SINONIMOS_PERCENTAGE,
    agregacion: "percentage",
  },
  {
    tipo: "average",
    sinonimos: SINONIMOS_AVERAGE,
    agregacion: "avg",
  },
  {
    tipo: "max",
    sinonimos: SINONIMOS_MAX,
    agregacion: "max",
  },
  {
    tipo: "min",
    sinonimos: SINONIMOS_MIN,
    agregacion: "min",
  },
  {
    tipo: "distribution",
    sinonimos: SINONIMOS_DISTRIBUTION,
    agregacion: "count",
  },
  {
    tipo: "trend",
    sinonimos: SINONIMOS_TREND,
    agregacion: "avg",
  },
  {
    tipo: "habit",
    sinonimos: SINONIMOS_HABIT,
    agregacion: "mode",
  },
  {
    tipo: "count",
    sinonimos: SINONIMOS_COUNT,
    agregacion: "count",
  },
];