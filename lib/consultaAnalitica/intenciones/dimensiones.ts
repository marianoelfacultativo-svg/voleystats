// ============================================================
// INTENCIONES · DIMENSIONES
// ============================================================
// Agrupa los diccionarios "no-intención":
//   - SINONIMOS_GROUPBY
//   - SINONIMOS_METRICA
//   - SINONIMOS_UBICACION
//   - SINONIMOS_CAMBIO
//   - DIAS_SEMANA + SINONIMOS_ULTIMOS / TEMPORADA / ESPECIFICOS
//   - SINONIMOS_CONDICION
//
// v1.1 (FASE 6 — Opción A, familia cruces):
//   + Métricas nuevas en SINONIMOS_METRICA:
//       cruces_promedio, cruces_total, cruces_max,
//       rallys_largos, rallys_cortos, rallys_medios.
//     Van al PRINCIPIO del array (el parser las matchea primero).
//   + GroupBy nuevos: cruces, duracion_rally.
//
// v1.0: versión inicial del refactor.
// ============================================================

import type { GroupBy, UbicacionQuery, DiaSemana } from "./tipos";

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
      "por salida", "por salidas",
      "por cada salida", "por la salida",
      "agrupado por salida", "agrupados por salida",
      "separado por salida", "separados por salida",
      "desglosado por salida", "desglosados por salida",
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
      "en que rotacion", "en qué rotación",
      "en cual rotacion", "en cuál rotación",
      "que rotacion", "qué rotación",
      "cual rotacion", "cuál rotación",
      "mejor rotacion", "mejor rotación",
      "peor rotacion", "peor rotación",
      "mejores rotaciones", "peores rotaciones",
      "que rotaciones", "qué rotaciones",
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
    ],
    groupBy: "resultado_partido",
  },
  {
    patrones: [
      "por resultado del punto",
      "por resultado de punto",
      "por resultado de los puntos",
      "por como terminan los puntos",
      "por cómo terminan los puntos",
      "por como termino el punto",
      "por cómo terminó el punto",
      "por como acaban los puntos",
      "por cómo acaban los puntos",
      "por como acaba el punto",
      "por cómo acaba el punto",
      "por como salen los puntos",
      "por cómo salen los puntos",
      "por quien gano el punto",
      "por quién ganó el punto",
      "por quien gana el punto",
      "por quién gana el punto",
      "por ganador del punto",
      "por el ganador del punto",
    ],
    groupBy: "resultado_punto",
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

  // ------------------------------------------------------------
  // NUEVOS (Opción A — familia cruces)
  // ------------------------------------------------------------

  {
    patrones: [
      "por cantidad de cruces",
      "por cantidad de cruces de red",
      "por numero de cruces",
      "por número de cruces",
      "por cada cantidad de cruces",
      "por cada numero de cruces",
      "por cada número de cruces",
      "por cruces",
      "por cruces de red",
      "por cuantos cruces",
      "por cuántos cruces",
      "por cantidad de pelotazos",
      "por cantidad de intercambios",
    ],
    groupBy: "cruces",
  },
  {
    patrones: [
      "por duracion del rally",
      "por duración del rally",
      "por duracion de rally",
      "por duración de rally",
      "por duracion de los rallys",
      "por duración de los rallys",
      "por duracion de los rallies",
      "por duración de los rallies",
      "por largo del rally",
      "por largo de los rallys",
      "por largo de los rallies",
      "por duracion (corto/medio/largo)",
      "por duracion corto medio largo",
      "por duración corto medio largo",
      "por si son largos o cortos",
      "por si son cortos o largos",
    ],
    groupBy: "duracion_rally",
  },
];

// ------------------------------------------------------------
// MÉTRICAS DE VÓLEY
// ------------------------------------------------------------
// v1.1: las 6 métricas de cruces van al PRINCIPIO del array.
// Los patrones son largos y específicos, así que no se pisan
// con el resto.
// ------------------------------------------------------------

export const SINONIMOS_METRICA: { patrones: string[]; metrica: string }[] = [
  // ============================================================
  // FAMILIA CRUCES (Opción A)
  // ============================================================

  // ---- cruces_promedio ----
  {
    patrones: [
      "cuantas veces pasa al otro lado la pelota en promedio",
      "cuantas veces pasa al otro lado la pelota por punto",
      "cuantas veces pasa al otro lado la pelota por rally",
      "cuantas veces pasa al otro lado en promedio",
      "cuantas veces pasa la pelota al otro lado en promedio",
      "cuantas veces cruza la red en promedio",
      "cuantas veces cruza la red por rally",
      "cuantas veces cruza la red por punto",
      "cuantas veces cruzo la red en promedio",
      "promedio de cruces por punto",
      "promedio de cruces por rally",
      "promedio de cruces de red",
      "promedio de cruces de red por punto",
      "promedio de cruces de red por rally",
      "promedio de pelotazos por punto",
      "promedio de pelotazos por rally",
      "promedio de intercambios por rally",
      "promedio de intercambios por punto",
      "media de cruces",
      "media de cruces de red",
      "media de cruces por rally",
      "media de cruces por punto",
      "cuanto dura un rally en promedio",
      "cuanto dura un punto en promedio",
      "cuanto dura un rally promedio",
      "cuanto dura un punto promedio",
      "duracion promedio de rally",
      "duracion promedio de punto",
      "duracion promedio de los rallies",
      "duracion promedio de los rallys",
      "duracion promedio del punto",
      "duracion promedio del rally",
      "cuantos cruces en promedio",
      "cuantos cruces promedio",
      "cuantos cruces por rally en promedio",
      "cuantos cruces por punto en promedio",
      "cuantos cruces de red en promedio",
      "cuantos pelotazos por rally",
      "cuantos pelotazos por punto",
      "cuantos intercambios por rally",
      "cuantos intercambios por punto",
      "que tan largo es un rally",
      "que tan largo es un punto",
    ],
    metrica: "cruces_promedio",
  },

  // ---- cruces_total ----
  {
    patrones: [
      "cuantos cruces hay",
      "cuantos cruces hubo",
      "cuantos cruces en total",
      "cuantos cruces de red hay",
      "cuantos cruces de red hubo",
      "cuantos cruces de red en total",
      "cuantos pelotazos hay",
      "cuantos pelotazos hubo",
      "cuantos pelotazos en total",
      "cuantos intercambios hay",
      "cuantos intercambios hubo",
      "cuantos intercambios en total",
      "total de cruces",
      "total de cruces de red",
      "total de pelotazos",
      "total de intercambios",
    ],
    metrica: "cruces_total",
  },

  // ---- cruces_max ----
  {
    patrones: [
      "maximo de cruces",
      "maximo de cruces en un rally",
      "maximo de cruces de red",
      "maximo de pelotazos",
      "maximo de intercambios",
      "cuantos cruces tiene el rally mas largo",
      "cuantos cruces tuvo el rally mas largo",
      "cuantos cruces tiene el punto mas largo",
      "cuantos cruces tuvo el punto mas largo",
      "el rally mas largo tuvo cuantos cruces",
      "el rally mas largo tiene cuantos cruces",
      "el punto mas largo tuvo cuantos cruces",
      "el punto mas largo tiene cuantos cruces",
      "rally mas largo",
      "punto mas largo",
      "el rally mas largo",
      "el punto mas largo",
      "los rallies mas largos",
      "los puntos mas largos",
    ],
    metrica: "cruces_max",
  },

  // ---- rallys_largos ----
  {
    patrones: [
      "cuantos rallys largos hay",
      "cuantos rallies largos hay",
      "cuantos rallys largos hubo",
      "cuantos rallies largos hubo",
      "cuantos rallys largos",
      "cuantos rallies largos",
      "cantidad de rallys largos",
      "cantidad de rallies largos",
      "cantidad de puntos largos",
      "cuantos puntos largos hay",
      "cuantos puntos largos hubo",
      "cuantos puntos largos",
      "numero de rallys largos",
      "numero de rallies largos",
      "que porcentaje de rallys son largos",
      "que porcentaje de rallies son largos",
      "que porcentaje de rallys largos hay",
    ],
    metrica: "rallys_largos",
  },

  // ---- rallys_cortos ----
  {
    patrones: [
      "cuantos rallys cortos hay",
      "cuantos rallies cortos hay",
      "cuantos rallys cortos hubo",
      "cuantos rallies cortos hubo",
      "cuantos rallys cortos",
      "cuantos rallies cortos",
      "cantidad de rallys cortos",
      "cantidad de rallies cortos",
      "cantidad de puntos cortos",
      "cuantos puntos cortos hay",
      "cuantos puntos cortos hubo",
      "cuantos puntos cortos",
      "numero de rallys cortos",
      "numero de rallies cortos",
      "que porcentaje de rallys son cortos",
      "que porcentaje de rallies son cortos",
      "que porcentaje de rallys cortos hay",
    ],
    metrica: "rallys_cortos",
  },

  // ---- rallys_medios ----
  {
    patrones: [
      "cuantos rallys de 3 cruces",
      "cuantos rallies de 3 cruces",
      "cuantos rallys de 3 cruces hay",
      "cuantos rallies de 3 cruces hay",
      "cuantos rallys medios",
      "cuantos rallies medios",
      "cuantos rallys medios hay",
      "cuantos rallies medios hay",
      "cantidad de rallys medios",
      "cantidad de rallies medios",
    ],
    metrica: "rallys_medios",
  },

  // ============================================================
  // Resto de métricas (idénticas a v1.0)
  // ============================================================

  // ---- % de puntos ganados (bloque A.2) ----
  {
    patrones: [
      "porcentaje de puntos ganados",
      "porcentaje de puntos a favor",
      "porcentaje de puntos propios",
      "porcentaje de puntos que ganamos",
      "porcentaje de puntos que ganaron",
      "porcentaje de puntos que gano",
      "porcentaje de puntos que ganó",
      "porcentaje de puntos que conseguimos",
      "porcentaje de puntos conseguidos",
      "porcentaje de puntos a nuestro favor",
      "porcentaje de rallies ganados",
      "porcentaje de rallys ganados",
      "porcentaje de rallies que ganamos",
      "% de puntos ganados",
      "% de puntos a favor",
      "% de puntos propios",
      "% de rallies ganados",
      "% de rallys ganados",
      "que porcentaje de puntos ganamos",
      "que porcentaje de puntos ganaron",
      "que porcentaje de puntos gano",
      "que porcentaje de puntos ganó",
      "que porcentaje de puntos son nuestros",
      "que porcentaje de puntos son propios",
      "que porcentaje de puntos son a favor",
      "que porcentaje de rallies ganamos",
      "que porcentaje de rallys ganamos",
      "que % de puntos ganamos",
      "que % de puntos son nuestros",
      "que % de rallies ganamos",
      "cuanto por ciento de puntos ganamos",
      "cuanto por ciento de puntos son nuestros",
      "cuanto por ciento de rallies ganamos",
    ],
    metrica: "puntos_ganados_pct",
  },

  // ---- puntos ganados (conteo) ----
  {
    patrones: [
      "puntos ganados", "puntos ganados por",
      "puntos a favor", "puntos conseguidos",
      "puntos que consiguio", "puntos que consiguió",
      "puntos que sumo", "puntos que sumó",
      "puntos que anoto", "puntos que anotó",
      "puntos que hizo", "puntos que hizo el equipo",
      "puntos que gano", "puntos que ganó",
      "cuantos puntos ganamos", "cuantos puntos ganaron",
      "cuantos puntos gano", "cuantos puntos ganó",
      "cuantos puntos sumamos", "cuantos puntos sumaron",
      "cuantos puntos sumo", "cuantos puntos sumó",
      "cuantos puntos anotamos", "cuantos puntos anotaron",
      "cuantos puntos anoto", "cuantos puntos anotó",
      "cuantos puntos hicimos", "cuantos puntos hicieron",
      "cuantos puntos hizo", "cuantos puntos hizo el equipo",
      "cuantos puntos conseguimos", "cuantos puntos consiguieron",
      "cuantos puntos obtuvo", "cuantos puntos obtuvieron",
      "cuantos puntos alcanzo", "cuantos puntos alcanzaron",
    ],
    metrica: "puntos_ganados",
  },

  // ---- acciones en punto ----
  {
    patrones: [
      "acciones en punto", "acciones que terminaron en punto",
      "acciones que terminan en punto", "acciones exitosas",
      "acciones ganadoras", "acciones que sumaron",
      "acciones que suman",
      "puntos directos de ataque", "puntos de ataque",
      "ataques punto", "ataques que fueron punto",
      "ataques que terminaron en punto",
      "saques que fueron ace", "saques que fueron punto",
      "bloqueos que fueron punto",
    ],
    metrica: "acciones_punto",
  },

  // ---- v1.4 (las 12 originales) ----
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
  "dime los cambios", "dime donde hubo cambios",
  "dime cuando hubo cambios",
  "muestrame los cambios", "muestrame donde hubo cambios",
  "muestrame cuando hubo cambios",
  "cuentame los cambios", "cuentame donde hubo cambios",
  "indicame los cambios", "indicame donde hubo cambios",
  "informame los cambios",
  "cuantos cambios", "cuantos cambios hubo",
  "cuantos cambios tuvo", "cuantos cambios hubo en",
  "decime los cambios", "decime donde hubo cambios",
  "mostrame los cambios", "mostrame donde hubo cambios",
  "contame los cambios", "contame donde hubo cambios",
  "pasame los cambios", "pasame donde hubo cambios",
  "tira los cambios",
  "digame los cambios", "digame donde hubo cambios",
  "digame cuando hubo cambios",
  "muestreme los cambios", "muestreme donde hubo cambios",
  "cuenteme los cambios", "cuenteme donde hubo cambios",
  "indiqueme los cambios", "indiqueme donde hubo cambios",
  "informeme los cambios",
  "diganme los cambios", "diganme donde hubo cambios",
  "muestrenme los cambios", "muestrenme donde hubo cambios",
  "indiquenme los cambios",
  "decidme los cambios", "decidme donde hubo cambios",
  "mostradme los cambios",
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
  "como delantero", "como delanteros", "de delantero", "de delanteros",
  "como zaguero", "como zagueros", "de zaguero", "de zagueros",
  "como libero", "como liberos", "de libero", "de liberos",
  "como líbero", "como líberos", "de líbero", "de líberos",
  "jugando de delantero", "jugando de zaguero", "jugando de libero",
  "jugando de líbero",
  "estando de delantero", "estando de zaguero",
  "estando de libero", "estando de líbero",
  "despues de un cambio", "después de un cambio",
  "tras un cambio", "luego de un cambio",
  "despues del cambio", "después del cambio",
  "tras el cambio", "luego del cambio",
  "despues de cambios", "después de cambios",
  "tras cambios", "luego de cambios",
  "con cambio previo", "con cambios previos",
  "sin cambio previo", "sin cambios previos",
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