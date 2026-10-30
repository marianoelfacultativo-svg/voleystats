// ============================================================
// INTENCIONES · MAX / MIN
// ============================================================
// Cuatro arrays:
//   - SINONIMOS_MAX       → "quién hace más X"     → count
//   - SINONIMOS_MIN       → "quién hace menos X"   → count
//   - SINONIMOS_MAX_MEJOR → "quién saca mejor"     → avg
//   - SINONIMOS_MIN_PEOR  → "quién ataca peor"     → avg
//
// En ORDEN_EVALUACION van primero MAX_MEJOR y MIN_PEOR, así
// "saca mejor" prioriza calidad y no cantidad.
//
// Extraído de intenciones.ts (v1.9). Sin cambios funcionales.
// ============================================================

// ------------------------------------------------------------
// MAX — cantidad (agregacion: "count")
// ------------------------------------------------------------

export const SINONIMOS_MAX: string[] = [
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
  "quien hace mas", "quien hacen mas",
  "quien hace la mayor cantidad",
  "dime el mejor", "dime el maximo", "dime el que mas",
  "dime el mayor", "dime el lider",
  "dime cual es el mejor", "dime cual es el maximo",
  "muestrame el mejor", "muestrame el maximo", "muestrame el que mas",
  "muestrame el mayor",
  "cuentame el mejor", "cuentame el que mas",
  "indicame el mejor", "indicame el maximo",
  "indicame el que mas", "indicame el mayor",
  "informame el mejor", "informame el maximo",
  "decime el mejor", "decime el maximo", "decime el que mas",
  "decime el mayor", "decime el lider",
  "mostrame el mejor", "mostrame el maximo", "mostrame el que mas",
  "contame el mejor", "contame el que mas",
  "pasame el mejor", "pasame el maximo", "pasame el que mas",
  "tira el mejor", "tira el maximo",
  "digame el mejor", "digame el maximo", "digame el que mas",
  "digame el mayor", "digame el lider",
  "digame cual es el mejor", "digame cual es el maximo",
  "muestreme el mejor", "muestreme el maximo",
  "cuenteme el mejor", "cuenteme el que mas",
  "indiqueme el mejor", "indiqueme el maximo",
  "indiqueme el que mas", "indiqueme el mayor",
  "informeme el mejor", "informeme el maximo",
  "diganme el mejor", "diganme el maximo",
  "diganme el que mas", "diganme el mayor",
  "muestrenme el mejor", "muestrenme el maximo",
  "indiquenme el mejor", "indiquenme el maximo",
  "decidme el mejor", "decidme el maximo",
  "mostradme el mejor", "mostradme el maximo",
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

// ------------------------------------------------------------
// MIN — cantidad (agregacion: "count")
// ------------------------------------------------------------

export const SINONIMOS_MIN: string[] = [
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
  "quien hace menos", "quien hacen menos",
  "dime el peor", "dime el minimo", "dime el que menos",
  "dime el menor",
  "dime cual es el peor", "dime cual es el minimo",
  "muestrame el peor", "muestrame el minimo", "muestrame el que menos",
  "muestrame el menor",
  "cuentame el peor", "cuentame el que menos",
  "indicame el peor", "indicame el minimo",
  "indicame el que menos", "indicame el menor",
  "informame el peor", "informame el minimo",
  "decime el peor", "decime el minimo", "decime el que menos",
  "decime el menor",
  "mostrame el peor", "mostrame el minimo", "mostrame el que menos",
  "contame el peor", "contame el que menos",
  "pasame el peor", "pasame el minimo", "pasame el que menos",
  "tira el peor", "tira el minimo",
  "digame el peor", "digame el minimo", "digame el que menos",
  "digame el menor",
  "digame cual es el peor", "digame cual es el minimo",
  "muestreme el peor", "muestreme el minimo",
  "cuenteme el peor", "cuenteme el que menos",
  "indiqueme el peor", "indiqueme el minimo",
  "indiqueme el que menos", "indiqueme el menor",
  "informeme el peor", "informeme el minimo",
  "diganme el peor", "diganme el minimo",
  "diganme el que menos", "diganme el menor",
  "muestrenme el peor", "muestrenme el minimo",
  "indiquenme el peor", "indiquenme el minimo",
  "decidme el peor", "decidme el minimo",
  "mostradme el peor", "mostradme el minimo",
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
  "el mas flojo", "la mas floja", "los mas flojos", "las mas flojas",
  "el que menos rinde", "la que menos rinde",
  "el que peor rinde", "la que peor rinde",
  "el que peor juega", "la que peor juega",
  "el mas malo", "la mas mala",
  "el ultimo de la tabla", "la ultima de la tabla",
  "a ver el peor", "veamos el peor",
  "vamos a ver el peor",
];

// ------------------------------------------------------------
// MAX_MEJOR — calidad (agregacion: "avg")
// ------------------------------------------------------------
// Se matchea ANTES que SINONIMOS_MAX en ORDEN_EVALUACION.
// El parser busca por orden; si entra acá, gana "avg".
// ------------------------------------------------------------

export const SINONIMOS_MAX_MEJOR: string[] = [
  // Verbo + "mejor"
  "saca mejor", "sacan mejor", "saco mejor", "sacó mejor",
  "sacaba mejor", "sacaban mejor",
  "ataca mejor", "atacan mejor", "ataco mejor", "atacó mejor",
  "atacaba mejor", "atacaban mejor",
  "defiende mejor", "defienden mejor", "defendio mejor",
  "defendió mejor", "defendia mejor", "defendía mejor",
  "recibe mejor", "reciben mejor", "recibio mejor",
  "recibió mejor", "recibia mejor", "recibía mejor",
  "bloquea mejor", "bloquean mejor", "bloqueo mejor",
  "bloqueó mejor",
  "arma mejor", "arman mejor", "armo mejor", "armó mejor",
  "remata mejor", "rematan mejor",
  "ataca mejor que", "saca mejor que", "defiende mejor que",
  "recibe mejor que", "bloquea mejor que", "arma mejor que",

  // "El mejor X" específico por fundamento
  "mejor sacador", "mejor sacadora",
  "mejores sacadores", "mejores sacadoras",
  "mejor atacante", "mejores atacantes",
  "mejor defensor", "mejor defensora",
  "mejores defensores", "mejores defensoras",
  "mejor receptor", "mejor receptora",
  "mejores receptores", "mejores receptoras",
  "mejor bloqueador", "mejores bloqueadores",
  "mejor armador", "mejores armadores",
  "mejor central", "mejores centrales",
  "mejor punta", "mejores puntas",
  "mejor opuesto", "mejores opuestos",
  "mejor libero", "mejor líbero", "mejores liberos",

  // Gerundios
  "mejor sacando", "mejor atacando", "mejor defendiendo",
  "mejor recibiendo", "mejor bloqueando", "mejor armando",

  // Dimensiones
  "mejor rotacion", "mejor rotación",
  "mejores rotaciones",
  "mejor set", "mejores sets",

  // Preguntas directas
  "quien saca mejor", "quien ataca mejor", "quien defiende mejor",
  "quien recibe mejor", "quien bloquea mejor", "quien arma mejor",
  "quienes sacan mejor", "quienes atacan mejor",
  "quienes defienden mejor", "quienes reciben mejor",
  "quienes bloquean mejor", "quienes arman mejor",
];

// ------------------------------------------------------------
// MIN_PEOR — calidad (agregacion: "avg")
// ------------------------------------------------------------
// Se matchea ANTES que SINONIMOS_MIN en ORDEN_EVALUACION.
// ------------------------------------------------------------

export const SINONIMOS_MIN_PEOR: string[] = [
  // Verbo + "peor"
  "saca peor", "sacan peor", "saco peor", "sacó peor",
  "sacaba peor", "sacaban peor",
  "ataca peor", "atacan peor", "ataco peor", "atacó peor",
  "atacaba peor", "atacaban peor",
  "defiende peor", "defienden peor", "defendio peor",
  "defendió peor", "defendia peor", "defendía peor",
  "recibe peor", "reciben peor", "recibio peor",
  "recibió peor", "recibia peor", "recibía peor",
  "bloquea peor", "bloquean peor", "bloqueo peor",
  "bloqueó peor",
  "arma peor", "arman peor", "armo peor", "armó peor",
  "remata peor", "rematan peor",
  "ataca peor que", "saca peor que", "defiende peor que",
  "recibe peor que", "bloquea peor que", "arma peor que",

  // "El peor X" específico por fundamento
  "peor sacador", "peor sacadora",
  "peores sacadores", "peores sacadoras",
  "peor atacante", "peores atacantes",
  "peor defensor", "peor defensora",
  "peores defensores", "peores defensoras",
  "peor receptor", "peor receptora",
  "peores receptores", "peores receptoras",
  "peor bloqueador", "peores bloqueadores",
  "peor armador", "peores armadores",
  "peor central", "peores centrales",
  "peor punta", "peores puntas",
  "peor opuesto", "peores opuestos",
  "peor libero", "peor líbero", "peores liberos",

  // Gerundios
  "peor sacando", "peor atacando", "peor defendiendo",
  "peor recibiendo", "peor bloqueando", "peor armando",

  // Dimensiones
  "peor rotacion", "peor rotación",
  "peores rotaciones",
  "peor set", "peores sets",

  // Preguntas directas
  "quien saca peor", "quien ataca peor", "quien defiende peor",
  "quien recibe peor", "quien bloquea peor", "quien arma peor",
  "quienes sacan peor", "quienes atacan peor",
  "quienes defienden peor", "quienes reciben peor",
  "quienes bloquean peor", "quienes arman peor",
];