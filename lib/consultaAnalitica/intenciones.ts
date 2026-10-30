// ============================================================
// INTENCIONES — Diccionarios + tipos del parser de intención
// ============================================================
// v1.4 (FASE 6 — diccionarios multiplados):
//   + Cada diccionario de sinónimos ampliado ~6x con variantes
//     formales, de España, México, Colombia, Chile, Perú,
//     Venezuela, Ecuador, y tratamientos usted/ustedes/vosotros.
//   + Sustantivos alternativos (conteo, recuento, tope, cima,
//     valle, cotejo, desagregación, cadencia, etc.).
//   + Frases de cortesía ("quisiera saber", "me interesa",
//     "podría indicarme", "le agradecería", etc.).
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
  ubicacion?: UbicacionQuery;
  zonaJugador?: number[];
  cambioEnPunto?: boolean;
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
  // ---- Neutros / formales ----
  "cuantos", "cuantas", "cuanto", "cuanta",
  "cantidad", "cantidades",
  "total", "totales",
  "numero", "numeros",
  "conteo", "conteos", "recuento", "recuentos",
  "computo", "cómputo", "computos", "cómputos",
  "suma", "sumas", "sumatoria",
  "cuenta", "cuentas",
  "valor absoluto", "valores absolutos",
  "magnitud", "magnitudes",
  // ---- Preguntas neutras ----
  "cuantas veces", "cuantos hubo", "cuantos fueron", "cuantos hizo",
  "cuantas hizo", "cuantas hay", "cuantos hay", "cuantas hubo",
  "cuantos hubieron", "cuantos tenemos", "cuantas tenemos",
  "cuantos tiene", "cuantas tiene",
  "cuantos son", "cuantas son",
  "cuantos estan", "cuantas estan", "cuantos están", "cuantas están",
  "cuanto hay", "cuanta hay",
  "cual es el total", "cual es el numero", "cual es la cantidad",
  "cual es el conteo", "cual es el recuento",
  "que cantidad", "que cantidad de", "que numero",
  "que total", "que total de",
  // ---- Tú (España / neutro) ----
  "dime cuantos", "dime cuantas", "dime cuanto", "dime cuanta",
  "dime la cantidad", "dime el total", "dime el numero",
  "dime el conteo", "dime el recuento",
  "muestrame cuantos", "muestrame cuantas", "muestrame cuanto",
  "muestrame la cantidad", "muestrame el total",
  "cuentame cuantos", "cuentame cuantas", "cuentame cuanto",
  "cuentame la cantidad", "cuentame el total",
  "indicame cuantos", "indicame cuantas", "indicame cuanto",
  "indicame la cantidad", "indicame el total",
  "informame cuantos", "informame cuantas",
  "informame la cantidad", "informame el total",
  // ---- Vos (Argentina / Uruguay) ----
  "decime cuantos", "decime cuantas", "decime cuanto", "decime cuanta",
  "decime la cantidad", "decime el total",
  "mostrame cuantos", "mostrame cuantas", "mostrame cuanto",
  "mostrame la cantidad", "mostrame el total",
  "contame cuantos", "contame cuantas", "contame cuanto",
  "contame la cantidad", "contame el total",
  "pasame cuantos", "pasame cuantas", "pasame la cantidad",
  "tira cuantos", "tira cuantas", "tira el total",
  // ---- Usted / formal ----
  "digame cuantos", "digame cuantas", "digame cuanto", "digame cuanta",
  "digame la cantidad", "digame el total", "digame el numero",
  "digame el conteo", "digame el recuento",
  "muestreme cuantos", "muestreme cuantas", "muestreme cuanto",
  "muestreme la cantidad", "muestreme el total",
  "cuenteme cuantos", "cuenteme cuantas", "cuenteme cuanto",
  "cuenteme la cantidad", "cuenteme el total",
  "indiqueme cuantos", "indiqueme cuantas", "indiqueme cuanto",
  "indiqueme la cantidad", "indiqueme el total",
  "informeme cuantos", "informeme cuantas",
  "informeme la cantidad", "informeme el total",
  "digame por favor cuantos", "digame por favor cuantas",
  "indiqueme por favor cuantos", "indiqueme por favor cuantas",
  // ---- Ustedes ----
  "diganme cuantos", "diganme cuantas", "diganme cuanto",
  "diganme la cantidad", "diganme el total",
  "muestrenme cuantos", "muestrenme cuantas",
  "muestrenme la cantidad", "muestrenme el total",
  "cuentenme cuantos", "cuentenme cuantas",
  "indiquenme cuantos", "indiquenme cuantas",
  // ---- Vosotros (España) ----
  "decidme cuantos", "decidme cuantas", "decidme cuanto",
  "mostradme cuantos", "mostradme cuantas", "mostradme cuanto",
  "contadme cuantos", "contadme cuantas", "contadme cuanto",
  "indicadme cuantos", "indicadme cuantas",
  // ---- Cortesía / escrito formal ----
  "quisiera saber cuantos", "quisiera saber cuantas",
  "quisiera saber cuanto", "quisiera saber cuanta",
  "quisiera saber la cantidad", "quisiera saber el total",
  "me interesa saber cuantos", "me interesa saber cuantas",
  "me interesa conocer cuantos", "me interesa conocer cuantas",
  "me gustaria saber cuantos", "me gustaria saber cuantas",
  "me gustaria conocer cuantos", "me gustaria conocer cuantas",
  "necesito saber cuantos", "necesito saber cuantas",
  "necesito saber cuanto", "necesito saber cuanta",
  "necesito conocer cuantos", "necesito conocer cuantas",
  "necesito la cantidad", "necesito el total",
  "podria indicarme cuantos", "podria indicarme cuantas",
  "podria indicarme la cantidad", "podria indicarme el total",
  "podria decirme cuantos", "podria decirme cuantas",
  "podria decirme la cantidad", "podria decirme el total",
  "seria posible saber cuantos", "seria posible saber cuantas",
  "seria posible conocer cuantos", "seria posible conocer cuantas",
  "le agradeceria saber cuantos", "le agradeceria saber cuantas",
  "le agradeceria que me diga cuantos", "le agradeceria que me diga cuantas",
  "le agradeceria que me indique cuantos",
  "le agradeceria que me indique cuantas",
  "me podria indicar cuantos", "me podria indicar cuantas",
  "me podria decir cuantos", "me podria decir cuantas",
  "me puede indicar cuantos", "me puede indicar cuantas",
  "me puede decir cuantos", "me puede decir cuantas",
  "tengo curiosidad por saber cuantos",
  "tengo curiosidad por saber cuantas",
  "queria consultar cuantos", "queria consultar cuantas",
  "queria saber cuantos", "queria saber cuantas",
  "vengo a preguntar cuantos", "vengo a preguntar cuantas",
  // ---- Imperativos plural ----
  "listame cuantos", "listame cuantas",
  "listennos cuantos", "listennos cuantas",
  "haganme una lista de cuantos", "haganme una lista de cuantas",
  "enumere cuantos", "enumere cuantas",
  "enumeren cuantos", "enumeren cuantas",
  // ---- Coloquial / regional ----
  "cuantos casos", "cuantos casos hay", "cuantos casos hubo",
  "cuantas cosas", "cuantas cosas hizo",
  "cuantas jugadas", "cuantos eventos", "cuantos eventos hubo",
  "cuantas veces hizo", "cuantas veces hubo", "cuantas veces hubieron",
  "cuanta cosa", "cuanta cosa hubo",
  "que tanto", "que tanto hay", "que tanto hubo",
  "a ver cuantos", "a ver cuantas", "a ver cuanto",
  "veamos cuantos", "veamos cuantas", "veamos cuanto",
  "vamos a ver cuantos", "vamos a ver cuantas", "vamos a ver cuanto",
];

export const SINONIMOS_PERCENTAGE: string[] = [
  // ---- Neutros / formales ----
  "porcentaje", "porcentajes",
  "por ciento", "porciento", "porcientos",
  "%", "porcentual", "porcentuales",
  "proporcion", "proporciones",
  "ratio", "ratios",
  "fraccion", "fracción", "fracciones",
  "tanto por ciento", "tanto por cien",
  "relacion porcentual", "relaciones porcentuales",
  "indice", "índice", "indices", "índices",
  "coeficiente", "coeficientes",
  "cuota", "cuotas",
  // ---- Preguntas neutras ----
  "que porcentaje", "que %", "que tanto por ciento",
  "que proporcion", "que proporción",
  "que fraccion", "que fracción",
  "que parte", "que tanto",
  "de cada 100", "de cada cien", "cada cien", "cada 100",
  "cual es el porcentaje", "cual es el %",
  "cual es la proporcion", "cual es la proporción",
  "cual es la fraccion", "cual es la fracción",
  "en que porcentaje", "en que proporcion", "en que proporción",
  "que porcentaje de", "que % de",
  "que proporcion de", "que fraccion de", "que parte de",
  "que porcentaje representa", "que fraccion representa",
  "cuanto por ciento", "cuanto porciento",
  "cuanto es el porcentaje", "cuanto es el %",
  "cuanto representa", "cuanto representa en porcentaje",
  // ---- Tú ----
  "dime el porcentaje", "dime el %",
  "dime que porcentaje", "dime que %",
  "dime la proporcion", "dime la proporción",
  "dime la fraccion", "dime la fracción",
  "dime cuanto por ciento",
  "muestrame el porcentaje", "muestrame el %",
  "muestrame que porcentaje", "muestrame la proporcion",
  "cuentame el porcentaje", "cuentame el %",
  "cuentame que porcentaje", "cuentame la proporcion",
  "indicame el porcentaje", "indicame el %",
  "indicame que porcentaje", "indicame la proporcion",
  // ---- Vos ----
  "decime el porcentaje", "decime el %",
  "decime que porcentaje", "decime que %",
  "decime la proporcion", "decime la fraccion",
  "mostrame el porcentaje", "mostrame el %",
  "mostrame que porcentaje",
  "contame el porcentaje", "contame que porcentaje",
  "pasame el porcentaje", "pasame el %",
  "tira el porcentaje", "tira el %",
  // ---- Usted ----
  "digame el porcentaje", "digame el %",
  "digame que porcentaje", "digame que %",
  "digame la proporcion", "digame la proporción",
  "digame la fraccion", "digame la fracción",
  "muestreme el porcentaje", "muestreme el %",
  "muestreme que porcentaje",
  "cuenteme el porcentaje", "cuenteme que porcentaje",
  "indiqueme el porcentaje", "indiqueme el %",
  "indiqueme que porcentaje",
  "informeme el porcentaje", "informeme el %",
  // ---- Ustedes ----
  "diganme el porcentaje", "diganme el %",
  "diganme que porcentaje",
  "muestrenme el porcentaje", "muestrenme el %",
  "indiquenme el porcentaje", "indiquenme el %",
  // ---- Vosotros ----
  "decidme el porcentaje", "decidme el %",
  "mostradme el porcentaje", "mostradme el %",
  // ---- Cortesía / formal escrito ----
  "quisiera saber el porcentaje", "quisiera saber el %",
  "quisiera saber que porcentaje",
  "me interesa saber el porcentaje", "me interesa saber el %",
  "me interesa conocer el porcentaje",
  "me gustaria saber el porcentaje", "me gustaria saber el %",
  "necesito saber el porcentaje", "necesito saber el %",
  "necesito conocer el porcentaje", "necesito el porcentaje",
  "podria indicarme el porcentaje", "podria indicarme el %",
  "podria decirme el porcentaje", "podria decirme el %",
  "seria posible saber el porcentaje",
  "le agradeceria saber el porcentaje",
  "le agradeceria que me diga el porcentaje",
  "le agradeceria que me indique el porcentaje",
  "me podria indicar el porcentaje", "me podria decir el porcentaje",
  "me puede indicar el porcentaje", "me puede decir el porcentaje",
  // ---- Regional / coloquial ----
  "que tan seguido", "que tan comun", "que tan común",
  "que tan frecuente", "que tan habitual",
  "a ver que porcentaje", "veamos que porcentaje",
  "vamos a ver que porcentaje",
];

export const SINONIMOS_AVERAGE: string[] = [
  // ---- Neutros / formales ----
  "promedio", "promedios",
  "media", "medias",
  "media aritmetica", "media aritmética",
  "valor medio", "valores medios",
  "termino medio", "término medio",
  "tasa", "tasas",
  "ratio medio", "ratios medios",
  "indice medio", "índice medio",
  "nivel medio", "niveles medios",
  "por accion", "por acción", "por acciones",
  "por unidad", "por unidades",
  // ---- Preguntas neutras ----
  "en promedio", "promedio de", "media de",
  "por set", "por partido", "por jugador", "por rotacion", "por punto",
  "por sets", "por partidos", "por jugadores",
  "por rotaciones", "por puntos",
  "cuanto promedia", "cuanto promedian", "cuanto promedio",
  "cual es el promedio", "cual es la media",
  "cual es el valor medio", "cual es el termino medio",
  "que promedio tiene", "que promedio saca",
  "que promedio hace", "que media tiene",
  "que promedio hay", "que media hay",
  "cuanto es el promedio", "cuanto es la media",
  "cuanto saca en promedio", "cuanto saca de promedio",
  "cuanto hace en promedio", "cuanto hace de promedio",
  "cuanto obtiene en promedio", "cuanto obtiene de promedio",
  "cuanto consigue en promedio",
  "cuanto registra en promedio",
  "promedia", "promedian", "promedio por", "media por", "promedio en",
  "promedio de acciones", "promedio de puntos",
  "promedio de sets", "promedio de partidos",
  "cuantas por partido", "cuantos por partido",
  "cuantas por set", "cuantos por set",
  "cuantas por jugada", "cuantos por jugada",
  // ---- Tú ----
  "dime el promedio", "dime la media",
  "dime cuanto promedia", "dime cuanto promedian",
  "dime el valor medio",
  "muestrame el promedio", "muestrame la media",
  "muestrame cuanto promedia",
  "cuentame el promedio", "cuentame la media",
  "indicame el promedio", "indicame la media",
  "indicame cuanto promedia",
  // ---- Vos ----
  "decime el promedio", "decime la media",
  "decime cuanto promedia", "decime cuanto promedian",
  "mostrame el promedio", "mostrame la media",
  "mostrame cuanto promedia",
  "contame el promedio", "contame la media",
  "pasame el promedio", "pasame la media",
  "tira el promedio", "tira la media",
  // ---- Usted ----
  "digame el promedio", "digame la media",
  "digame cuanto promedia", "digame cuanto promedian",
  "muestreme el promedio", "muestreme la media",
  "cuenteme el promedio", "cuenteme la media",
  "indiqueme el promedio", "indiqueme la media",
  "informeme el promedio", "informeme la media",
  // ---- Ustedes ----
  "diganme el promedio", "diganme la media",
  "muestrenme el promedio", "muestrenme la media",
  // ---- Vosotros ----
  "decidme el promedio", "decidme la media",
  "mostradme el promedio", "mostradme la media",
  // ---- Cortesía / formal escrito ----
  "quisiera saber el promedio", "quisiera saber la media",
  "quisiera saber cuanto promedia",
  "me interesa saber el promedio", "me interesa saber la media",
  "me interesa conocer el promedio",
  "me gustaria saber el promedio", "me gustaria saber la media",
  "necesito saber el promedio", "necesito saber la media",
  "necesito conocer el promedio", "necesito el promedio",
  "podria indicarme el promedio", "podria indicarme la media",
  "podria decirme el promedio", "podria decirme la media",
  "seria posible saber el promedio",
  "le agradeceria saber el promedio",
  "le agradeceria que me diga el promedio",
  "le agradeceria que me indique el promedio",
  "me podria indicar el promedio", "me podria decir el promedio",
  "me puede indicar el promedio", "me puede decir el promedio",
  // ---- Regional / coloquial ----
  "que promedio mete", "que promedio clava",
  "a ver el promedio", "veamos el promedio",
  "vamos a ver el promedio",
];

export const SINONIMOS_FREQUENCY: string[] = [
  // ---- Neutros / formales ----
  "frecuencia", "frecuencias",
  "periodicidad", "periodicidades",
  "regularidad", "regularidades",
  "cadencia", "cadencias",
  "intervalo", "intervalos",
  "cada cuando", "cada cuándo",
  "cada cuanto", "cada cuantos", "cada cuantas",
  "cada cuánto", "cada cuántos", "cada cuántas",
  "con que frecuencia", "con que periodicidad",
  "con que regularidad", "con que cadencia",
  "que tan seguido", "que tan frecuente",
  "que tan a menudo", "que tan habitual",
  "cuantas veces por", "cuantas veces cada",
  "cada cuantas veces", "cada cuantos puntos",
  "cada cuantos sets", "cada cuantos partidos",
  "cada cuantos ataques", "cada cuantos saques",
  "cada cuantos bloqueos", "cada cuantos eventos",
  "cada cuantas jugadas", "cada cuantos toques",
  "cada cuantas recepciones", "cada cuantos saques",
  "cada cuantos puntos", "cada cuantos rallies",
  // ---- Tú ----
  "dime cada cuanto", "dime la frecuencia",
  "dime la periodicidad", "dime la cadencia",
  "dime con que frecuencia",
  "muestrame cada cuanto", "muestrame la frecuencia",
  "muestrame la periodicidad",
  "cuentame cada cuanto", "cuentame la frecuencia",
  "indicame cada cuanto", "indicame la frecuencia",
  "indicame la periodicidad",
  // ---- Vos ----
  "decime cada cuanto", "decime la frecuencia",
  "decime la periodicidad", "decime la cadencia",
  "mostrame cada cuanto", "mostrame la frecuencia",
  "contame cada cuanto", "contame la frecuencia",
  "pasame la frecuencia", "pasame la cadencia",
  // ---- Usted ----
  "digame cada cuanto", "digame la frecuencia",
  "digame la periodicidad", "digame la cadencia",
  "digame con que frecuencia",
  "muestreme cada cuanto", "muestreme la frecuencia",
  "cuenteme cada cuanto", "cuenteme la frecuencia",
  "indiqueme cada cuanto", "indiqueme la frecuencia",
  "informeme la frecuencia", "informeme la cadencia",
  // ---- Ustedes ----
  "diganme cada cuanto", "diganme la frecuencia",
  "muestrenme la frecuencia", "muestrenme la cadencia",
  // ---- Vosotros ----
  "decidme cada cuanto", "decidme la frecuencia",
  "mostradme la frecuencia", "mostradme la cadencia",
  // ---- Cortesía / formal escrito ----
  "quisiera saber la frecuencia", "quisiera saber cada cuanto",
  "quisiera conocer la frecuencia",
  "me interesa saber la frecuencia", "me interesa saber cada cuanto",
  "me interesa conocer la frecuencia",
  "me gustaria saber la frecuencia", "me gustaria saber cada cuanto",
  "necesito saber la frecuencia", "necesito saber cada cuanto",
  "necesito conocer la frecuencia",
  "podria indicarme la frecuencia", "podria indicarme cada cuanto",
  "podria decirme la frecuencia", "podria decirme cada cuanto",
  "seria posible saber la frecuencia",
  "le agradeceria saber la frecuencia",
  "le agradeceria que me diga la frecuencia",
  "le agradeceria que me indique la frecuencia",
  "me podria indicar la frecuencia", "me podria decir la frecuencia",
  "me puede indicar la frecuencia", "me puede decir la frecuencia",
  // ---- Coloquial / regional ----
  "cada cuanto pasa", "cada cuanto ocurre",
  "cada cuanto le pasa", "cada cuanto le ocurre",
  "cada cuanto comete", "cada cuanto hace",
  "cada cuanto erra", "cada cuanto falla",
  "cada cuanto le erra", "cada cuanto le falla",
  "cada cuanto se manda", "cada cuanto se manda un error",
  "cada cuanto le sale", "cada cuanto le sale bien",
  "cada cuanto le sale mal",
  "con que regularidad pasa", "con que regularidad ocurre",
  "con que periodicidad pasa", "con que periodicidad ocurre",
  "que frecuencia tiene", "que frecuencia hay",
  "cuantas veces en promedio",
  "cuantas veces por partido", "cuantas veces por set",
  "cuantos por partido", "cuantos por set",
  "frecuencia de", "frecuencia por",
  "a ver cada cuanto", "veamos cada cuanto",
  "vamos a ver cada cuanto",
];

export const SINONIMOS_MAX: string[] = [
  // ---- Neutros / formales ----
  "maximo", "maximos", "maxima", "maximas",
  "máximo", "máximos", "máxima", "máximas",
  "tope", "topes", "pico", "picos",
  "cima", "cimas", "cumbre", "cumbres",
  "record", "records", "récord", "récords",
  "punto mas alto", "puntos mas altos",
  "el valor mas alto", "los valores mas altos",
  "la cifra mas alta", "las cifras mas altas",
  "el mayor", "los mayores", "la mayor", "las mayores",
  "el que mas", "la que mas", "los que mas", "las que mas",
  "el mejor", "la mejor", "los mejores", "las mejores",
  "mayor", "mayores", "maximo valor", "valor maximo",
  "el lider", "la lider", "los lideres", "las lideres",
  // ---- Preguntas neutras ----
  "cual fue el mejor", "cual fue el maximo", "cual es el mejor",
  "cual fue el mayor", "cual es el mayor",
  "cual es el valor maximo", "cual fue el valor maximo",
  "quien es el mejor", "quien es la mejor",
  "quienes son los mejores", "quienes son las mejores",
  "quien tiene mas", "quien tiene el maximo",
  "quien saco mas", "quien hizo mas",
  "quien anoto mas", "quien metio mas",
  "quien consiguio mas", "quien logro mas",
  "quien acumulo mas", "quien registro mas",
  "quien obtuvo mas", "quien alcanzo mas",
  "quien llego a mas", "quien llego al maximo",
  // ---- Tú ----
  "dime el mejor", "dime el maximo", "dime el que mas",
  "dime el mayor", "dime el lider",
  "dime cual es el mejor", "dime cual es el maximo",
  "muestrame el mejor", "muestrame el maximo", "muestrame el que mas",
  "muestrame el mayor",
  "cuentame el mejor", "cuentame el que mas",
  "indicame el mejor", "indicame el maximo",
  "indicame el que mas", "indicame el mayor",
  "informame el mejor", "informame el maximo",
  // ---- Vos ----
  "decime el mejor", "decime el maximo", "decime el que mas",
  "decime el mayor", "decime el lider",
  "mostrame el mejor", "mostrame el maximo", "mostrame el que mas",
  "contame el mejor", "contame el que mas",
  "pasame el mejor", "pasame el maximo", "pasame el que mas",
  "tira el mejor", "tira el maximo",
  // ---- Usted ----
  "digame el mejor", "digame el maximo", "digame el que mas",
  "digame el mayor", "digame el lider",
  "digame cual es el mejor", "digame cual es el maximo",
  "muestreme el mejor", "muestreme el maximo",
  "cuenteme el mejor", "cuenteme el que mas",
  "indiqueme el mejor", "indiqueme el maximo",
  "indiqueme el que mas", "indiqueme el mayor",
  "informeme el mejor", "informeme el maximo",
  // ---- Ustedes ----
  "diganme el mejor", "diganme el maximo",
  "diganme el que mas", "diganme el mayor",
  "muestrenme el mejor", "muestrenme el maximo",
  "indiquenme el mejor", "indiquenme el maximo",
  // ---- Vosotros ----
  "decidme el mejor", "decidme el maximo",
  "mostradme el mejor", "mostradme el maximo",
  // ---- Cortesía / formal escrito ----
  "quisiera saber el mejor", "quisiera saber el maximo",
  "quisiera saber cual es el mejor",
  "quisiera saber cual es el maximo",
  "me interesa saber el mejor", "me interesa saber el maximo",
  "me interesa conocer el mejor", "me interesa conocer el maximo",
  "me gustaria saber el mejor", "me gustaria saber el maximo",
  "necesito saber el mejor", "necesito saber el maximo",
  "necesito conocer el mejor", "necesito conocer el maximo",
  "podria indicarme el mejor", "podria indicarme el maximo",
  "podria decirme el mejor", "podria decirme el maximo",
  "seria posible saber el mejor", "seria posible saber el maximo",
  "le agradeceria saber el mejor", "le agradeceria saber el maximo",
  "le agradeceria que me diga el mejor",
  "le agradeceria que me indique el mejor",
  "me podria indicar el mejor", "me podria decir el mejor",
  "me puede indicar el mejor", "me puede decir el mejor",
  // ---- Coloquial / regional ----
  "el que la rompio", "la que la rompio",
  "el que la rompió", "la que la rompió",
  "el que mas la rompio", "la que mas la rompio",
  "el crack", "la crack", "los cracks", "las cracks",
  "el número uno", "la número uno",
  "el primero", "la primera", "los primeros", "las primeras",
  "el top", "la top", "el podio",
  "el goleador", "la goleadora",
  "el que mas metio", "la que mas metio",
  "a ver el mejor", "veamos el mejor",
  "vamos a ver el mejor",
];

export const SINONIMOS_MIN: string[] = [
  // ---- Neutros / formales ----
  "minimo", "minimos", "minima", "minimas",
  "mínimo", "mínimos", "mínima", "mínimas",
  "piso", "pisos", "valle", "valles",
  "punto mas bajo", "puntos mas bajos",
  "el valor mas bajo", "los valores mas bajos",
  "la cifra mas baja", "las cifras mas bajas",
  "el menor", "los menores", "la menor", "las menores",
  "el que menos", "la que menos", "los que menos", "las que menos",
  "el peor", "la peor", "los peores", "las peores",
  "menor", "menores", "minimo valor", "valor minimo",
  "el ultimo", "la ultima", "los ultimos", "las ultimas",
  // ---- Preguntas neutras ----
  "cual fue el peor", "cual fue el minimo", "cual es el peor",
  "cual fue el menor", "cual es el menor",
  "cual es el valor minimo", "cual fue el valor minimo",
  "quien es el peor", "quien es la peor",
  "quienes son los peores", "quienes son las peores",
  "quien tiene menos", "quien tiene el minimo",
  "quien saco menos", "quien hizo menos",
  "quien anoto menos", "quien metio menos",
  "quien consiguio menos", "quien logro menos",
  "quien acumulo menos", "quien registro menos",
  "quien obtuvo menos", "quien alcanzo menos",
  "quien llego a menos", "quien llego al minimo",
  // ---- Tú ----
  "dime el peor", "dime el minimo", "dime el que menos",
  "dime el menor",
  "dime cual es el peor", "dime cual es el minimo",
  "muestrame el peor", "muestrame el minimo", "muestrame el que menos",
  "muestrame el menor",
  "cuentame el peor", "cuentame el que menos",
  "indicame el peor", "indicame el minimo",
  "indicame el que menos", "indicame el menor",
  "informame el peor", "informame el minimo",
  // ---- Vos ----
  "decime el peor", "decime el minimo", "decime el que menos",
  "decime el menor",
  "mostrame el peor", "mostrame el minimo", "mostrame el que menos",
  "contame el peor", "contame el que menos",
  "pasame el peor", "pasame el minimo", "pasame el que menos",
  "tira el peor", "tira el minimo",
  // ---- Usted ----
  "digame el peor", "digame el minimo", "digame el que menos",
  "digame el menor",
  "digame cual es el peor", "digame cual es el minimo",
  "muestreme el peor", "muestreme el minimo",
  "cuenteme el peor", "cuenteme el que menos",
  "indiqueme el peor", "indiqueme el minimo",
  "indiqueme el que menos", "indiqueme el menor",
  "informeme el peor", "informeme el minimo",
  // ---- Ustedes ----
  "diganme el peor", "diganme el minimo",
  "diganme el que menos", "diganme el menor",
  "muestrenme el peor", "muestrenme el minimo",
  "indiquenme el peor", "indiquenme el minimo",
  // ---- Vosotros ----
  "decidme el peor", "decidme el minimo",
  "mostradme el peor", "mostradme el minimo",
  // ---- Cortesía / formal escrito ----
  "quisiera saber el peor", "quisiera saber el minimo",
  "quisiera saber cual es el peor",
  "quisiera saber cual es el minimo",
  "me interesa saber el peor", "me interesa saber el minimo",
  "me interesa conocer el peor", "me interesa conocer el minimo",
  "me gustaria saber el peor", "me gustaria saber el minimo",
  "necesito saber el peor", "necesito saber el minimo",
  "necesito conocer el peor", "necesito conocer el minimo",
  "podria indicarme el peor", "podria indicarme el minimo",
  "podria decirme el peor", "podria decirme el minimo",
  "seria posible saber el peor", "seria posible saber el minimo",
  "le agradeceria saber el peor", "le agradeceria saber el minimo",
  "le agradeceria que me diga el peor",
  "le agradeceria que me indique el peor",
  "me podria indicar el peor", "me podria decir el peor",
  "me puede indicar el peor", "me puede decir el peor",
  // ---- Coloquial / regional ----
  "el mas flojo", "la mas floja", "los mas flojos", "las mas flojas",
  "el que menos rinde", "la que menos rinde",
  "el que peor rinde", "la que peor rinde",
  "el que peor juega", "la que peor juega",
  "el mas malo", "la mas mala",
  "el ultimo de la tabla", "la ultima de la tabla",
  "a ver el peor", "veamos el peor",
  "vamos a ver el peor",
];

export const SINONIMOS_RANKING: string[] = [
  // ---- Neutros / formales ----
  "ranking", "rankings",
  "clasificacion", "clasificación", "clasificaciones",
  "tabla", "tablas", "tabla de posiciones",
  "lista ordenada", "listas ordenadas",
  "orden de merito", "orden de mérito",
  "ordenamiento", "ordenamientos",
  "posicionamiento", "posicionamientos",
  "podio", "podios",
  "top", "tops",
  "rankear", "ranquear",
  "ordenar", "ordena", "ordena por", "ordenados por",
  "de mayor a menor", "de menor a mayor",
  "mejor a peor", "peor a mejor",
  "de mas a menos", "de menos a mas",
  "de más a menos", "de menos a más",
  "primeros", "ultimos", "últimos",
  "primeros puestos", "ultimos puestos", "últimos puestos",
  "cual es el primero", "cual es el ultimo",
  "cual es el primero", "cual es el último",
  // ---- Tú ----
  "dime el ranking", "dime la clasificacion",
  "dime la tabla", "dime el orden",
  "dime el podio", "dime el top",
  "muestrame el ranking", "muestrame la clasificacion",
  "muestrame la tabla", "muestrame el top",
  "muestrame el podio",
  "cuentame el ranking", "cuentame el top",
  "indicame el ranking", "indicame el top",
  "indicame la clasificacion",
  "informame el ranking", "informame el top",
  "hazme un ranking", "hazme un top",
  "hazme una lista ordenada", "hazme una tabla",
  // ---- Vos ----
  "decime el ranking", "decime la clasificacion",
  "decime la tabla", "decime el top",
  "mostrame el ranking", "mostrame la clasificacion",
  "mostrame la tabla", "mostrame el top",
  "contame el ranking", "contame el top",
  "pasame el ranking", "pasame el top",
  "haceme un ranking", "haceme un top",
  "haceme una lista ordenada", "haceme una tabla",
  "tira el ranking", "tira el top",
  "ordenalos", "ordenalas", "ordena de mayor a menor",
  "ordena de menor a mayor",
  // ---- Usted ----
  "digame el ranking", "digame la clasificacion",
  "digame la tabla", "digame el top",
  "digame el podio",
  "muestreme el ranking", "muestreme la clasificacion",
  "muestreme la tabla", "muestreme el top",
  "cuenteme el ranking", "cuenteme el top",
  "indiqueme el ranking", "indiqueme el top",
  "informeme el ranking", "informeme el top",
  "hagame un ranking", "hagame un top",
  "ordene de mayor a menor", "ordene de menor a mayor",
  // ---- Ustedes ----
  "diganme el ranking", "diganme el top",
  "muestrenme el ranking", "muestrenme el top",
  "indiquenme el ranking", "indiquenme el top",
  "ordenen de mayor a menor", "ordenen de menor a mayor",
  // ---- Vosotros ----
  "decidme el ranking", "decidme el top",
  "mostradme el ranking", "mostradme el top",
  "ordenad de mayor a menor", "ordenad de menor a mayor",
  // ---- Cortesía / formal escrito ----
  "quisiera saber el ranking", "quisiera saber el top",
  "quisiera conocer el ranking", "quisiera conocer el top",
  "me interesa saber el ranking", "me interesa saber el top",
  "me interesa conocer el ranking", "me interesa conocer el top",
  "me gustaria saber el ranking", "me gustaria saber el top",
  "necesito saber el ranking", "necesito saber el top",
  "necesito conocer el ranking", "necesito conocer el top",
  "podria indicarme el ranking", "podria indicarme el top",
  "podria decirme el ranking", "podria decirme el top",
  "seria posible saber el ranking",
  "le agradeceria saber el ranking",
  "le agradeceria que me diga el ranking",
  "le agradeceria que me indique el ranking",
  "me podria indicar el ranking", "me podria decir el ranking",
  "me puede indicar el ranking", "me puede decir el ranking",
  // ---- Coloquial / regional ----
  "del mejor al peor", "del peor al mejor",
  "de arriba a abajo", "de abajo a arriba",
  "los mejores primeros", "los peores primeros",
  "quien encabeza", "quienes encabezan",
  "quien esta primero", "quien esta ultimo",
  "quien esta arriba", "quien esta abajo",
  "los top", "el top", "los top de",
  "primer lugar", "primeros lugares",
  "ultimo lugar", "ultimos lugares",
  "el podio completo", "el podio entero",
  "el top 3", "el top 5", "el top 10",
  "a ver el ranking", "veamos el ranking",
  "vamos a ver el ranking",
];

export const SINONIMOS_COMPARISON: string[] = [
  // ---- Neutros / formales ----
  " vs ", " versus ", " contra ", " frente a ",
  "comparado con", "comparado a",
  "comparacion", "comparación", "comparaciones",
  "contraste", "contrastes",
  "cotejo", "cotejos",
  "diferencia", "diferencias",
  "diferencia entre", "diferencias entre",
  "comparar", "comparando", "compara", "compara con",
  "en comparacion", "en comparacion con",
  "en relación a", "en relacion a",
  "respecto a", "respecto de",
  "en contraste con", "a diferencia de",
  "mejor que", "peor que",
  "mas que", "menos que",
  "más que", "menos que",
  // ---- Tú ----
  "compara", "compara a", "compara con",
  "dime la diferencia entre", "dime cual es mejor",
  "dime quien es mejor", "dime quien rinde mas",
  "muestrame la diferencia entre", "muestrame quien es mejor",
  "cuentame la diferencia entre", "cuentame quien es mejor",
  "indicame la diferencia entre", "indicame quien es mejor",
  "informame la diferencia entre",
  // ---- Vos ----
  "compara", "compará", "compará a", "compará con",
  "decime la diferencia entre", "decime cual es mejor",
  "decime quien es mejor", "decime quien rinde mas",
  "mostrame la diferencia entre", "mostrame quien es mejor",
  "contame la diferencia entre", "contame quien es mejor",
  "pasame la diferencia entre",
  "comparame", "comparame a", "comparame con",
  // ---- Usted ----
  "compare", "compare a", "compare con",
  "digame la diferencia entre", "digame cual es mejor",
  "digame quien es mejor", "digame quien rinde mas",
  "muestreme la diferencia entre", "muestreme quien es mejor",
  "cuenteme la diferencia entre", "cuenteme quien es mejor",
  "indiqueme la diferencia entre", "indiqueme quien es mejor",
  "informeme la diferencia entre",
  "compareme", "compareme a", "compareme con",
  // ---- Ustedes ----
  "comparen", "comparen a", "comparen con",
  "diganme la diferencia entre", "diganme quien es mejor",
  "muestrenme la diferencia entre",
  "indiquenme la diferencia entre",
  // ---- Vosotros ----
  "comparar", "comparar a", "comparar con",
  "decidme la diferencia entre", "decidme quien es mejor",
  "mostradme la diferencia entre",
  // ---- Cortesía / formal escrito ----
  "quisiera comparar", "quisiera saber la diferencia entre",
  "quisiera saber quien es mejor",
  "me interesa comparar", "me interesa saber la diferencia entre",
  "me gustaria comparar", "me gustaria saber la diferencia entre",
  "necesito comparar", "necesito saber la diferencia entre",
  "podria comparar", "podria indicarme la diferencia entre",
  "podria decirme la diferencia entre",
  "seria posible comparar", "seria posible saber la diferencia",
  "le agradeceria que compare", "le agradeceria que me diga la diferencia",
  "me podria indicar la diferencia entre",
  "me podria decir la diferencia entre",
  "me puede indicar la diferencia entre",
  "me puede decir la diferencia entre",
  // ---- Coloquial / regional ----
  "quien es mejor", "quien es peor",
  "quien juega mejor", "quien juega peor",
  "quien rinde mas", "quien rinde menos",
  "quien hace mas", "quien hace menos",
  "quien esta mejor", "quien esta peor",
  "quien anda mejor", "quien anda peor",
  "quien viene mejor", "quien viene peor",
  "que diferencia hay entre", "que diferencia hubo entre",
  "que diferencia hay", "que diferencia hubo",
  "a ver la diferencia entre", "veamos la diferencia entre",
  "vamos a ver la diferencia entre",
  "quien gana entre", "quien pierde entre",
  "quien es mas", "quien es menos",
  "quien tiene mas", "quien tiene menos",
];

export const SINONIMOS_DISTRIBUTION: string[] = [
  // ---- Neutros / formales ----
  "distribucion", "distribución", "distribuciones",
  "desglose", "desgloses",
  "desagregacion", "desagregación", "desagregaciones",
  "reparto", "repartos",
  "division", "división", "divisiones",
  "segmentacion", "segmentación",
  "clasificacion por", "clasificación por",
  "categorizacion por", "categorización por",
  "agrupacion por", "agrupación por",
  "separacion por", "separación por",
  "por tipo", "por categoria", "por categoría",
  "por zona", "por zonas",
  "por grupo", "por grupos",
  "por clase", "por clases",
  "por nivel", "por niveles",
  "por segmento", "por segmentos",
  "segun", "según",
  "distribuir", "distribuido", "distribuida",
  "repartir", "repartido", "repartida",
  "desglosar", "desglosado", "desglosada",
  "desagregar", "desagregado", "desagregada",
  "dividir", "dividido", "dividida",
  "separado por", "separado en", "separados por",
  "separada por", "separadas por",
  "agrupado por", "agrupado en", "agrupados por",
  "agrupada por", "agrupadas por",
  "desglosado por", "desglosado en",
  "desagregado por", "desagregado en",
  "cuantos por", "que porcentaje por", "cuanto por",
  "cuantos por cada", "que cantidad por",
  // ---- Tú ----
  "dime la distribucion", "dime el desglose",
  "dime el reparto", "dime la division",
  "dime la desagregacion",
  "muestrame la distribucion", "muestrame el desglose",
  "muestrame el reparto", "muestrame la division",
  "cuentame la distribucion", "cuentame el desglose",
  "indicame la distribucion", "indicame el desglose",
  "informame la distribucion",
  "desglosame", "desglosame por", "desglosame en",
  "separame por", "separame en", "agrupame por",
  "dividime por", "dividime en",
  // ---- Vos ----
  "decime la distribucion", "decime el desglose",
  "decime el reparto",
  "mostrame la distribucion", "mostrame el desglose",
  "mostrame el reparto",
  "contame la distribucion", "contame el desglose",
  "pasame la distribucion", "pasame el desglose",
  "desglosame", "desglosame por", "desglosame en",
  "separame por", "separame en", "agrupame por",
  "dividime por", "dividime en",
  // ---- Usted ----
  "digame la distribucion", "digame el desglose",
  "digame el reparto", "digame la division",
  "muestreme la distribucion", "muestreme el desglose",
  "muestreme el reparto",
  "cuenteme la distribucion", "cuenteme el desglose",
  "indiqueme la distribucion", "indiqueme el desglose",
  "informeme la distribucion",
  "desgloseme", "desgloseme por", "desgloseme en",
  "separeme por", "separeme en", "agrupeme por",
  "dividame por", "dividame en",
  // ---- Ustedes ----
  "diganme la distribucion", "diganme el desglose",
  "muestrenme la distribucion", "muestrenme el desglose",
  "indiquenme la distribucion",
  "desglosenme", "desglosenme por",
  "separenme por", "agrupenme por", "dividanme por",
  // ---- Vosotros ----
  "decidme la distribucion", "decidme el desglose",
  "mostradme la distribucion", "mostradme el desglose",
  "desglosadme por", "separadmin por", "agrupadmin por",
  // ---- Cortesía / formal escrito ----
  "quisiera saber la distribucion", "quisiera ver la distribucion",
  "quisiera ver el desglose", "quisiera ver el reparto",
  "me interesa saber la distribucion",
  "me interesa ver la distribucion",
  "me interesa conocer la distribucion",
  "me gustaria saber la distribucion",
  "me gustaria ver la distribucion",
  "necesito saber la distribucion",
  "necesito conocer la distribucion",
  "necesito el desglose", "necesito el reparto",
  "podria indicarme la distribucion",
  "podria mostrarme la distribucion",
  "podria indicarme el desglose",
  "seria posible ver la distribucion",
  "le agradeceria que me muestre la distribucion",
  "le agradeceria que me indique la distribucion",
  "me podria indicar la distribucion",
  "me podria mostrar la distribucion",
  "me puede indicar la distribucion",
  "me puede mostrar la distribucion",
  // ---- Coloquial / regional ----
  "como se reparten", "como se reparte",
  "como se distribuyen", "como se distribuye",
  "como se dividen", "como se divide",
  "como se agrupan", "como se agrupa",
  "como se separan", "como se separa",
  "como se desglosan", "como se desglosa",
  "como se desagregan", "como se desagrega",
  "que hay por cada", "que hay en cada",
  "que cantidad por", "que cantidad por cada",
  "como se reparte por", "como se distribuye por",
  "desglosado por cada",
  "un desglose de", "la division por",
  "el reparto por", "la distribucion por",
  "a ver la distribucion", "veamos la distribucion",
  "vamos a ver la distribucion",
  "a ver como se reparte", "veamos como se reparte",
];

export const SINONIMOS_TREND: string[] = [
  // ---- Neutros / formales ----
  "evolucion", "evolución", "evoluciones",
  "tendencia", "tendencias",
  "progresion", "progresión", "progresiones",
  "desarrollo", "desarrollos",
  "marcha", "marchas",
  "curso", "cursos",
  "recorrido", "recorridos",
  "trayectoria", "trayectorias",
  "comportamiento a lo largo",
  "desempeno a lo largo", "desempeño a lo largo",
  "rendimiento a lo largo",
  "como fue", "como fueron",
  "como viene", "como vienen",
  "como viene siendo", "como vienen siendo",
  "como ha sido", "como han sido",
  "como ha venido", "como han venido",
  "a lo largo", "a lo largo de",
  "set a set", "partido a partido",
  "semana a semana", "mes a mes", "ano a ano", "año a año",
  "temporada a temporada",
  "como cambio", "como vario",
  "como ha cambiado", "como ha variado",
  "comparado con el set anterior",
  "comparado con el partido anterior",
  "comparado con la semana anterior",
  "comparado con el mes anterior",
  "como evoluciono", "como evolucionaron",
  "como ha evolucionado", "como han evolucionado",
  "como viene evolucionando", "como viene rindiendo",
  "como ha venido evolucionando", "como ha venido rindiendo",
  // ---- Tú ----
  "dime la evolucion", "dime la tendencia",
  "dime como viene", "dime como fue",
  "dime como ha sido", "dime como ha venido",
  "muestrame la evolucion", "muestrame la tendencia",
  "muestrame como viene", "muestrame como fue",
  "cuentame la evolucion", "cuentame la tendencia",
  "cuentame como viene", "cuentame como fue",
  "indicame la evolucion", "indicame la tendencia",
  "indicame como viene", "indicame como fue",
  "informame la evolucion", "informame la tendencia",
  "graficame la evolucion", "graficame la tendencia",
  "graficame como viene", "graficame como fue",
  // ---- Vos ----
  "decime la evolucion", "decime la tendencia",
  "decime como viene", "decime como fue",
  "mostrame la evolucion", "mostrame la tendencia",
  "mostrame como viene", "mostrame como fue",
  "contame la evolucion", "contame la tendencia",
  "contame como viene", "contame como fue",
  "pasame la evolucion", "pasame la tendencia",
  "graficame la evolucion", "graficame la tendencia",
  // ---- Usted ----
  "digame la evolucion", "digame la tendencia",
  "digame como viene", "digame como fue",
  "digame como ha sido", "digame como ha venido",
  "muestreme la evolucion", "muestreme la tendencia",
  "muestreme como viene", "muestreme como fue",
  "cuenteme la evolucion", "cuenteme la tendencia",
  "indiqueme la evolucion", "indiqueme la tendencia",
  "informeme la evolucion", "informeme la tendencia",
  "graficame la evolucion", "graficame la tendencia",
  // ---- Ustedes ----
  "diganme la evolucion", "diganme la tendencia",
  "muestrenme la evolucion", "muestrenme la tendencia",
  "indiquenme la evolucion", "indiquenme la tendencia",
  // ---- Vosotros ----
  "decidme la evolucion", "decidme la tendencia",
  "mostradme la evolucion", "mostradme la tendencia",
  // ---- Cortesía / formal escrito ----
  "quisiera saber la evolucion", "quisiera ver la evolucion",
  "quisiera saber la tendencia", "quisiera ver la tendencia",
  "me interesa saber la evolucion", "me interesa ver la evolucion",
  "me interesa conocer la evolucion",
  "me gustaria saber la evolucion", "me gustaria ver la evolucion",
  "necesito saber la evolucion", "necesito conocer la evolucion",
  "necesito ver la evolucion",
  "podria indicarme la evolucion", "podria mostrarme la evolucion",
  "podria indicarme la tendencia",
  "seria posible ver la evolucion",
  "le agradeceria que me muestre la evolucion",
  "le agradeceria que me indique la evolucion",
  "me podria indicar la evolucion",
  "me podria mostrar la evolucion",
  "me puede indicar la evolucion",
  "me puede mostrar la evolucion",
  // ---- Coloquial / regional ----
  "como viene la mano", "como viene la cosa",
  "como viene rindiendo", "como viene jugando",
  "como viene apareciendo",
  "mejoro o empeoro", "mejoro", "empeoro",
  "mejoró o empeoró", "mejoró", "empeoró",
  "esta mejorando", "esta empeorando",
  "está mejorando", "está empeorando",
  "viene mejorando", "viene empeorando",
  "va mejorando", "va empeorando",
  "esta subiendo", "esta bajando",
  "está subiendo", "está bajando",
  "va subiendo", "va bajando",
  "de a poco mejora", "de a poco empeora",
  "set a set como", "partido a partido como",
  "entre sets como", "entre partidos como",
  "como cambia", "como va cambiando",
  "como viene cambiando", "como viene la evolucion",
  "a ver la evolucion", "veamos la evolucion",
  "vamos a ver la evolucion",
  "a ver como viene", "veamos como viene",
];

export const SINONIMOS_HABIT: string[] = [
  // ---- Neutros / formales ----
  "habito", "hábito", "habitos", "hábitos",
  "costumbre", "costumbres",
  "patron", "patrón", "patrones",
  "rutina", "rutinas",
  "practica", "práctica", "practicas", "prácticas",
  "suele", "suelen", "solia", "solian", "solía", "solían",
  "soler", "acostumbra", "acostumbran", "acostumbraba",
  "acostumbraban", "acostumbro",
  "tiende a", "tienden a", "tendia a", "tendian a",
  "tendía a", "tendían a",
  "normalmente", "normal", "generales",
  "generalmente", "general",
  "por lo general", "en general",
  "habitualmente", "habitual", "habituales",
  "tipicamente", "típicamente", "tipico", "típico",
  "comunmente", "comúnmente", "comun", "común",
  "regularmente", "regular",
  "frecuentemente", "frecuente", "frecuentes",
  "la mayoria de las veces", "mayoria de las veces",
  "la mayoría de las veces", "mayoría de las veces",
  "casi siempre", "casi nunca",
  "lo tipico", "lo típico",
  "lo habitual", "lo comun", "lo común",
  "lo normal", "lo frecuente",
  "lo que suele", "lo que suelen",
  "lo que acostumbra", "lo que acostumbran",
  "lo que tiende", "lo que tienden",
  "que hace habitualmente", "que hace normalmente",
  "que hace generalmente", "que hace tipicamente",
  "que hace tipicamente", "que hace comúnmente",
  "que acostumbra", "que acostumbran",
  "que suele hacer", "que suelen hacer",
  "que tiende a hacer", "que tienden a hacer",
  // ---- "Cómo terminan / acaban / finalizan" ----
  "como termina", "como terminan", "como termino", "como terminaron",
  "como acaba", "como acaban", "como acabo", "como acabaron",
  "como finaliza", "como finalizan", "como finalizo", "como finalizaron",
  "como resulta", "como resultan", "como resulto", "como resultaron",
  "como sale", "como salen", "como salio", "como salieron",
  "como quedan", "como queda", "como quedaron", "como quedo",
  "como ha terminado", "como han terminado",
  "como ha acabado", "como han acabado",
  "como ha resultado", "como han resultado",
  // ---- Tú ----
  "dime que suele", "dime que suele hacer",
  "dime que hace normalmente", "dime que hace habitualmente",
  "dime como termina", "dime como terminan",
  "dime como sale", "dime como salen",
  "dime como acaba", "dime como acaban",
  "dime el habito", "dime la costumbre",
  "dime el patron", "dime la rutina",
  "muestrame que suele", "muestrame que suele hacer",
  "muestrame como termina", "muestrame como terminan",
  "muestrame como sale", "muestrame como salen",
  "muestrame el habito", "muestrame el patron",
  "cuentame que suele", "cuentame que hace normalmente",
  "cuentame como termina", "cuentame como terminan",
  "cuentame el habito", "cuentame el patron",
  "indicame que suele", "indicame como termina",
  "indicame el habito", "indicame el patron",
  "informame que suele", "informame como termina",
  // ---- Vos ----
  "decime que suele", "decime que suele hacer",
  "decime que hace normalmente", "decime que hace habitualmente",
  "decime como termina", "decime como terminan",
  "decime como sale", "decime como salen",
  "decime el habito", "decime la costumbre",
  "mostrame que suele", "mostrame que suele hacer",
  "mostrame como termina", "mostrame como terminan",
  "mostrame como sale", "mostrame como salen",
  "mostrame el habito", "mostrame el patron",
  "contame que suele", "contame que hace normalmente",
  "contame como termina", "contame como terminan",
  "pasame que suele", "pasame el habito",
  "tira que suele", "tira el habito",
  // ---- Usted ----
  "digame que suele", "digame que suele hacer",
  "digame que hace normalmente", "digame que hace habitualmente",
  "digame como termina", "digame como terminan",
  "digame como sale", "digame como salen",
  "digame como acaba", "digame como acaban",
  "digame el habito", "digame la costumbre",
  "digame el patron", "digame la rutina",
  "muestreme que suele", "muestreme que suele hacer",
  "muestreme como termina", "muestreme como terminan",
  "muestreme como sale", "muestreme como salen",
  "muestreme el habito", "muestreme el patron",
  "cuenteme que suele", "cuenteme como termina",
  "cuenteme el habito", "cuenteme el patron",
  "indiqueme que suele", "indiqueme como termina",
  "indiqueme el habito", "indiqueme el patron",
  "informeme que suele", "informeme como termina",
  "informeme el habito", "informeme el patron",
  // ---- Ustedes ----
  "diganme que suele", "diganme que suele hacer",
  "diganme como termina", "diganme como terminan",
  "diganme el habito", "diganme el patron",
  "muestrenme que suele", "muestrenme como termina",
  "muestrenme el habito",
  "indiquenme que suele", "indiquenme como termina",
  // ---- Vosotros ----
  "decidme que suele", "decidme como termina",
  "mostradme que suele", "mostradme como termina",
  // ---- Cortesía / formal escrito ----
  "quisiera saber que suele", "quisiera saber que suele hacer",
  "quisiera saber como termina", "quisiera saber como terminan",
  "quisiera conocer el habito", "quisiera conocer el patron",
  "me interesa saber que suele", "me interesa saber como termina",
  "me interesa conocer el habito", "me interesa conocer el patron",
  "me gustaria saber que suele", "me gustaria saber como termina",
  "necesito saber que suele", "necesito saber como termina",
  "necesito conocer el habito", "necesito conocer el patron",
  "podria indicarme que suele", "podria indicarme como termina",
  "podria decirme que suele", "podria decirme como termina",
  "seria posible saber que suele", "seria posible saber como termina",
  "le agradeceria que me diga que suele",
  "le agradeceria que me diga como termina",
  "le agradeceria que me indique que suele",
  "le agradeceria que me indique como termina",
  "me podria indicar que suele", "me podria indicar como termina",
  "me podria decir que suele", "me podria decir como termina",
  "me puede indicar que suele", "me puede indicar como termina",
  "me puede decir que suele", "me puede decir como termina",
  // ---- Coloquial / regional ----
  "que hace cuando", "que hace si",
  "que suele hacer cuando", "que suele hacer si",
  "que hace normalmente cuando", "que hace habitualmente cuando",
  "que hace tipicamente cuando", "que hace comunmente cuando",
  "que pasa cuando", "que pasa si",
  "que suele pasar cuando", "que suele pasar si",
  "que pasa normalmente cuando", "que pasa habitualmente cuando",
  "que ocurre cuando", "que ocurre si",
  "que suele ocurrir cuando", "que suele ocurrir si",
  "como le va cuando", "como le va si",
  "como le suele ir cuando", "como le suele ir si",
  "que hace tipicamente", "que hace comunmente",
  "lo habitual es", "lo tipico es", "lo comun es",
  "lo normal es", "lo frecuente es",
  "lo que suele pasar es", "lo que suele ocurrir es",
  "cuando X, que suele hacer",
  "que le gusta hacer", "que acostumbra hacer",
  "que tiende a hacer", "hacia donde va",
  "para donde va", "hacia donde suele ir",
  "para donde suele ir",
  "a ver que suele", "veamos que suele",
  "vamos a ver que suele",
  "a ver como termina", "veamos como termina",
  "vamos a ver como termina",
];

// ------------------------------------------------------------
// UBICACIÓN DEL JUGADOR
// ------------------------------------------------------------

export const SINONIMOS_UBICACION: {
  patrones: string[];
  ubicacion: UbicacionQuery;
}[] = [
  {
    patrones: [
      "delantero", "delanteros", "delantera", "delanteras",
      "front row", "en la red", "en red", "de red", "de adelante",
      "jugador de red", "jugadores de red",
      "en la linea de frente", "en la línea de frente",
      "en la primera linea", "en la primera línea",
      "jugando adelante", "parado adelante", "ubicado adelante",
      "en la zona de ataque",
    ],
    ubicacion: "delantero",
  },
  {
    patrones: [
      "zaguero", "zagueros", "zaguera", "zagueras",
      "back row", "del fondo", "en el fondo", "de atras", "de atrás",
      "jugador de fondo", "jugadores de fondo",
      "en la linea de fondo", "en la línea de fondo",
      "en la segunda linea", "en la segunda línea",
      "jugando atras", "jugando atrás",
      "parado atras", "parado atrás",
      "ubicado atras", "ubicado atrás",
      "en la zona de defensa",
    ],
    ubicacion: "zaguero",
  },
  {
    patrones: [
      "libero", "liberos", "líbero", "líberos",
      "libera", "líbera", "lib", "libs",
    ],
    ubicacion: "libero",
  },
];

// ------------------------------------------------------------
// CAMBIO DE JUGADOR
// ------------------------------------------------------------

export const SINONIMOS_CAMBIO: string[] = [
  // ---- Neutros / formales ----
  "cambio", "cambios", "cambió", "cambio_",
  "cambian", "cambia", "cambiamos", "cambiaron", "cambiando",
  "sustitucion", "sustitución", "sustituciones",
  "sustituye", "sustituyo", "sustituyó",
  "reemplazo", "reemplazos", "reemplaza", "reemplazo_",
  "rotacion de jugadores", "rotación de jugadores",
  "cambio de jugador", "cambios de jugador",
  "cambio de jugadores", "cambios de jugadores",
  "entrada", "entradas", "salida", "salidas",
  "ingreso", "ingresos", "egreso", "egresos",
  // ---- Frases neutras ----
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
  "el que entro", "el que entró",
  "el que salio", "el que salió",
  "que entro", "que salio",
  "que entraron", "que salieron",
  "quien entro", "quien salio",
  "quienes entraron", "quienes salieron",
  // ---- Tú ----
  "dime los cambios", "dime donde hubo cambios",
  "dime cuando hubo cambios",
  "muestrame los cambios", "muestrame donde hubo cambios",
  "muestrame cuando hubo cambios",
  "cuentame los cambios", "cuentame donde hubo cambios",
  "indicame los cambios", "indicame donde hubo cambios",
  "informame los cambios",
  "cuantos cambios", "cuantos cambios hubo",
  "cuantos cambios tuvo", "cuantos cambios hubo en",
  // ---- Vos ----
  "decime los cambios", "decime donde hubo cambios",
  "mostrame los cambios", "mostrame donde hubo cambios",
  "contame los cambios", "contame donde hubo cambios",
  "pasame los cambios", "pasame donde hubo cambios",
  "tira los cambios",
  // ---- Usted ----
  "digame los cambios", "digame donde hubo cambios",
  "digame cuando hubo cambios",
  "muestreme los cambios", "muestreme donde hubo cambios",
  "cuenteme los cambios", "cuenteme donde hubo cambios",
  "indiqueme los cambios", "indiqueme donde hubo cambios",
  "informeme los cambios",
  // ---- Ustedes ----
  "diganme los cambios", "diganme donde hubo cambios",
  "muestrenme los cambios", "muestrenme donde hubo cambios",
  "indiquenme los cambios",
  // ---- Vosotros ----
  "decidme los cambios", "decidme donde hubo cambios",
  "mostradme los cambios",
  // ---- Cortesía / formal escrito ----
  "quisiera saber los cambios", "quisiera ver los cambios",
  "quisiera saber donde hubo cambios",
  "me interesa saber los cambios", "me interesa ver los cambios",
  "me gustaria saber los cambios", "me gustaria ver los cambios",
  "necesito saber los cambios", "necesito ver los cambios",
  "podria indicarme los cambios", "podria mostrarme los cambios",
  "seria posible ver los cambios",
  "le agradeceria que me muestre los cambios",
  "le agradeceria que me indique los cambios",
  "me podria indicar los cambios", "me podria mostrar los cambios",
  "me puede indicar los cambios", "me puede mostrar los cambios",
  // ---- Coloquial / regional ----
  "quien entro por quien", "quien salio por quien",
  "quien reemplazo a quien", "quien sustituyo a quien",
  "a ver los cambios", "veamos los cambios",
  "vamos a ver los cambios",
  "a ver donde hubo cambios", "veamos donde hubo cambios",
];

// ------------------------------------------------------------
// TIEMPO
// ------------------------------------------------------------

export const DIAS_SEMANA: DiaSemana[] = [
  "lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo",
];

export const SINONIMOS_ULTIMOS: string[] = [
  "ultimos", "ultimas", "ultimo", "ultima",
  "últimos", "últimas", "último", "última",
  "recientes", "reciente",
  "pasados", "pasadas", "pasado", "pasada",
  "anteriores", "anterior",
  "los ultimos", "las ultimas",
  "los últimos", "las últimas",
  "los N ultimos", "las N ultimas",
  "los últimos N", "las últimas N",
  "ultimas fechas", "ultimos encuentros",
  "últimas fechas", "últimos encuentros",
  "ultimos juegos", "ultimos partidos jugados",
  "ultimos partidos disputados", "ultimos partidos oficiales",
  "recientes encuentros", "recientes partidos",
  "ultimo tiempo", "ultimo periodo", "ultimo período",
];

export const SINONIMOS_TEMPORADA: string[] = [
  "esta temporada", "temporada actual", "temporada en curso",
  "esta semana", "semana actual", "semana en curso",
  "este mes", "mes actual", "mes en curso",
  "este ano", "ano actual", "ano en curso",
  "este año", "año actual", "año en curso",
  "temporada pasada", "temporada anterior",
  "semana pasada", "mes pasado", "ano pasado", "año pasado",
  "el ano pasado", "la temporada pasada",
  "el año pasado", "la temporada pasada",
  "esta primavera", "este verano", "este otono", "este invierno",
  "esta primavera", "este verano", "este otoño", "este invierno",
  "esta pretemporada", "pretemporada",
  "esta copa", "esta liga", "este torneo", "este campeonato",
  "el torneo actual", "el campeonato actual",
  "la copa actual", "la liga actual",
];

export const SINONIMOS_ESPECIFICOS: string[] = [
  "en el partido", "en el partido del", "en el partido de",
  "en el set", "en el punto",
  "en la temporada", "en la semana", "en el mes", "en el ano",
  "en el año",
  "contra", "frente a", "vs", "versus",
  "en el encuentro", "en el juego",
  "en la copa", "en la liga", "en el torneo",
  "en ese partido", "en ese set", "en ese punto",
  "durante el partido", "durante el set",
  "a lo largo del partido", "a lo largo del set",
];

// ------------------------------------------------------------
// CONDICIÓN
// ------------------------------------------------------------

export const SINONIMOS_CONDICION: string[] = [
  // ---- Conectores ----
  "cuando", "si", "en los casos en que", "siempre que",
  "cada vez que", "despues de", "después de",
  "antes de", "tras", "luego de",
  "en situacion de", "en situación de",
  "estando", "con el marcador", "con diferencia de",
  "en punto critico", "en punto crítico",
  "en racha de", "con 2 toques", "con 3 toques", "con 4 toques",
  "en fase de", "en side-out", "en side out",
  "en k2", "en k3", "en free ball", "en freeball",
  "con armado de", "con calidad de",
  "con error previo", "con acierto previo",
  // ---- Ubicación ----
  "como delantero", "como delanteros", "de delantero", "de delanteros",
  "como zaguero", "como zagueros", "de zaguero", "de zagueros",
  "como libero", "como liberos", "de libero", "de liberos",
  "como líbero", "como líberos", "de líbero", "de líberos",
  "jugando de delantero", "jugando de zaguero", "jugando de libero",
  "jugando de líbero",
  "estando de delantero", "estando de zaguero",
  "estando de libero", "estando de líbero",
  // ---- Cambio ----
  "despues de un cambio", "después de un cambio",
  "tras un cambio", "luego de un cambio",
  "despues del cambio", "después del cambio",
  "tras el cambio", "luego del cambio",
  "despues de cambios", "después de cambios",
  "tras cambios", "luego de cambios",
  "con cambio previo", "con cambios previos",
  "sin cambio previo", "sin cambios previos",
  // ---- Marcador ----
  "cuando esta", "cuando estan",
  "cuando está", "cuando están",
  "cuando va", "cuando van",
  "cuando gana", "cuando gano", "cuando ganó",
  "cuando pierde", "cuando perdio", "cuando perdió",
  "cuando empata", "cuando empataron", "cuando empató",
  "estando arriba", "estando abajo",
  "estando ganando", "estando perdiendo", "estando empatado",
  "yendo arriba", "yendo abajo",
  "yendo ganando", "yendo perdiendo", "yendo empatado",
  "con ventaja", "con desventaja",
  "con el marcador a favor", "con el marcador en contra",
  "ganando por", "perdiendo por",
  "arriba por", "abajo por",
  // ---- Racha ----
  "en racha", "en racha de",
  "viene de", "vienen de", "venia de", "venian de",
  "viene de", "vienen de", "venía de", "venían de",
  "despues de ganar", "despues de perder", "despues de empatar",
  "después de ganar", "después de perder", "después de empatar",
  "tras ganar", "tras perder", "tras empatar",
  "luego de ganar", "luego de perder", "luego de empatar",
  "con X victorias seguidas", "con X derrotas seguidas",
  "con X triunfos seguidos", "con X caidas seguidas",
  "con X caídas seguidas",
  // ---- Condiciones específicas ----
  "en el quinto set", "en el cuarto set",
  "en el tercer set", "en el segundo set", "en el primer set",
  "en tie break", "en tie-break", "en tiebreak",
  "en punto de set", "en punto de partido",
  "en match point", "en punto critico", "en punto crítico",
  "en set point", "en matchpoint",
  "en el set final", "en el set decisivo",
  "en la recta final", "en el cierre",
  "en la definicion", "en la definición",
];

// ------------------------------------------------------------
// GROUP BY
// ------------------------------------------------------------

export const SINONIMOS_GROUPBY: { patrones: string[]; groupBy: GroupBy }[] = [
  {
    patrones: [
      "por set", "por cada set", "en cada set", "set a set",
      "por sets", "en los sets",
      "por cada sets", "para cada set",
      "agrupado por set", "agrupados por set",
      "separado por set", "separados por set",
      "desglosado por set", "desglosados por set",
    ],
    groupBy: "set",
  },
  {
    patrones: [
      "por partido", "por cada partido", "en cada partido",
      "partido a partido", "por partidos", "en los partidos",
      "por cada partidos", "para cada partido",
      "agrupado por partido", "agrupados por partido",
      "separado por partido", "separados por partido",
      "desglosado por partido", "desglosados por partido",
    ],
    groupBy: "partido",
  },
  {
    patrones: [
      "por jugador", "por cada jugador", "en cada jugador",
      "por jugadora", "por jugadores", "en los jugadores",
      "por cada jugadores", "para cada jugador",
      "agrupado por jugador", "agrupados por jugador",
      "separado por jugador", "separados por jugador",
      "desglosado por jugador", "desglosados por jugador",
    ],
    groupBy: "jugador",
  },
  {
    patrones: [
      "por zona origen", "por zona de origen", "por origen",
      "por zonas de origen", "por zona de origen",
      "por la zona de origen", "por la zona origen",
    ],
    groupBy: "zona_origen",
  },
  {
    patrones: [
      "por zona destino", "por zona de destino", "por destino",
      "por zonas de destino", "por donde ataca",
      "por la zona de destino", "por la zona destino",
      "por donde va la pelota",
    ],
    groupBy: "zona_destino",
  },
  {
    patrones: [
      "por zona jugador", "por zona del jugador",
      "por zona de jugador", "por donde esta parado",
      "por donde está parado", "por donde esta ubicado",
      "por donde está ubicado",
    ],
    groupBy: "zona_jugador",
  },
  {
    patrones: [
      "por rotacion", "por cada rotacion", "por rota", "rotacion a rotacion",
      "por rotaciones", "en las rotaciones",
      "por rotación", "por cada rotación", "rotación a rotación",
      "agrupado por rotacion", "agrupados por rotacion",
      "separado por rotacion", "separados por rotacion",
    ],
    groupBy: "rotacion",
  },
  {
    patrones: [
      "por rol", "por cada rol", "por roles",
      "por cada roles", "para cada rol",
      "agrupado por rol", "agrupados por rol",
      "separado por rol", "separados por rol",
    ],
    groupBy: "rol",
  },
  {
    patrones: [
      "por ubicacion", "por ubicación",
      "por delantero", "por delanteros",
      "por zaguero", "por zagueros",
      "por libero", "por liberos", "por líbero", "por líberos",
      "por ubicacion en cancha", "por ubicación en cancha",
      "por posicion", "por posición",
      "por posiciones", "por puesto", "por puestos",
      "agrupado por ubicacion", "agrupados por ubicacion",
      "separado por ubicacion", "separados por ubicacion",
    ],
    groupBy: "ubicacion",
  },
  {
    patrones: [
      "por fase", "por cada fase", "por fase de rally",
      "por fases", "en cada fase",
      "por fase del rally", "por la fase",
      "agrupado por fase", "agrupados por fase",
      "separado por fase", "separados por fase",
    ],
    groupBy: "fase",
  },
  {
    patrones: [
      "por rival", "por cada rival", "por cada equipo rival",
      "por rivales", "contra cada rival",
      "frente a cada rival", "vs cada rival",
      "agrupado por rival", "agrupados por rival",
      "separado por rival", "separados por rival",
    ],
    groupBy: "rival",
  },
  {
    patrones: [
      "por resultado del partido", "por resultado de partido",
      "por resultado de los partidos",
      "por resultado", "por resultados",
    ],
    groupBy: "resultado_partido",
  },
  {
    patrones: [
      "por tipo", "por cada tipo", "por tipo de accion",
      "por fundamento", "por tipos", "por fundamentos",
      "por tipo de acción", "por cada fundamento",
      "agrupado por tipo", "agrupados por tipo",
      "separado por tipo", "separados por tipo",
    ],
    groupBy: "tipo",
  },
  {
    patrones: [
      "por subtipo", "por cada subtipo",
      "por valoracion", "por valoración",
      "por resultado", "por resultados",
      "por subtipos",
      "por tipo de resultado", "por tipo de valoracion",
      "agrupado por subtipo", "agrupados por subtipo",
      "separado por subtipo", "separados por subtipo",
    ],
    groupBy: "subtipo",
  },
  {
    patrones: [
      "por velocidad", "por cada velocidad", "por velocidad de armado",
      "por velocidades",
      "por la velocidad", "por la velocidad de armado",
      "agrupado por velocidad", "agrupados por velocidad",
      "separado por velocidad", "separados por velocidad",
    ],
    groupBy: "velocidad",
  },
  {
    patrones: [
      "por tipo de saque", "por tipo saque", "por tipos de saque",
      "por cada tipo de saque",
      "agrupado por tipo de saque", "agrupados por tipo de saque",
    ],
    groupBy: "tipo_saque",
  },
  {
    patrones: [
      "por variante", "por cada variante", "por variantes",
      "remate vs toque", "remate contra toque",
      "agrupado por variante", "agrupados por variante",
    ],
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

export const SINONIMOS_METRICA: { patrones: string[]; metrica: string }[] = [
  {
    patrones: [
      "kill", "kill %", "kill porcentaje", "porcentaje de kill",
      "porcentaje de punto de ataque", "porcentaje de punto en ataque",
      "porcentaje de punto atacando",
      "porcentaje de acierto en ataque",
      "eficacia de ataque",
      "tasa de kill", "tasa de acierto en ataque",
    ],
    metrica: "kill_pct",
  },
  {
    patrones: [
      "eficiencia de ataque", "eficiencia ataque", "attack efficiency",
      "eficiencia atacando", "eficiencia en ataque",
      "eficiencia ofensiva",
    ],
    metrica: "attack_efficiency",
  },
  {
    patrones: [
      "hitting", "hitting %", "porcentaje de golpeo", "porcentaje de golpe",
      "porcentaje de hitting",
    ],
    metrica: "hitting_pct",
  },
  {
    patrones: [
      "sideout", "side-out", "side out %", "porcentaje de side-out",
      "porcentaje de sideout", "efectividad recibiendo",
      "efectividad en recepcion", "efectividad en recepción",
      "eficiencia en side-out", "eficiencia en sideout",
      "eficiencia recibiendo",
    ],
    metrica: "sideout_pct",
  },
  {
    patrones: [
      "break point", "break-point", "break point %",
      "porcentaje de break point", "efectividad sacando",
      "efectividad en saque",
      "eficiencia en break point", "eficiencia sacando",
    ],
    metrica: "break_point_pct",
  },
  {
    patrones: [
      "recepcion %", "porcentaje de recepcion", "calidad de recepcion",
      "calidad de recepciones",
      "porcentaje de recepcion positiva", "porcentaje de recepcion perfecta",
      "porcentaje de recepción", "calidad de recepción",
      "calidad de recepciones",
    ],
    metrica: "reception_pct",
  },
  {
    patrones: [
      "ace %", "porcentaje de ace", "porcentaje de aces",
      "porcentaje de aces por saque",
      "tasa de aces",
    ],
    metrica: "ace_pct",
  },
  {
    patrones: [
      "error de saque %", "porcentaje de error de saque",
      "porcentaje de errores de saque",
      "porcentaje de saques errados",
      "tasa de errores de saque",
    ],
    metrica: "serve_error_pct",
  },
  {
    patrones: [
      "eficiencia de bloqueo", "eficiencia bloqueo",
      "eficiencia bloqueando",
      "eficiencia en el bloqueo",
      "eficiencia en bloqueo",
    ],
    metrica: "block_efficiency",
  },
  {
    patrones: [
      "eficiencia de defensa", "eficiencia defensa",
      "eficiencia defendiendo",
      "eficiencia en defensa",
    ],
    metrica: "dig_efficiency",
  },
  {
    patrones: [
      "puntos por set", "promedio de puntos por set",
      "puntos por set en promedio",
      "media de puntos por set",
      "promedio de puntos por set",
    ],
    metrica: "puntos_por_set",
  },
  {
    patrones: [
      "puntos por rotacion", "promedio de puntos por rotacion",
      "puntos por rotacion en promedio",
      "media de puntos por rotacion",
      "promedio de puntos por rotación",
    ],
    metrica: "puntos_por_rotacion",
  },
];

// ------------------------------------------------------------
// ORDEN DE EVALUACIÓN
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