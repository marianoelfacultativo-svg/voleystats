// ============================================================
// SEMANTIC LAYER — capa 3
// ============================================================
// Catálogo de variables, métricas, entidades y operadores que
// el compilador (capa 4) puede usar para producir ASTs válidos.
//
// Es el diccionario entre "lo que dice el usuario en castellano"
// y "lo que el motor sabe calcular".
//
// Cuando el compilador encuentra una palabra, la busca acá y la
// traduce a una `Expr` del AST. Si no la encuentra, no compila.
//
// Para agregar una variable nueva alcanza con:
//   1) Definirla en `variablesPunto.ts` (calcularla).
//   2) Agregar su entrada a `VARIABLES` (abajo).
//   → Todo el motor la puede usar sin tocar nada más.
// ============================================================

import {
  cantidad,
  contiene,
  division,
  igual,
  mayor,
  mayorIgual,
  menor,
  menorIgual,
  no,
  numero,
  producto,
  resta,
  suma,
  variable,
  y,
  o,
  type Expr,
} from "./expresiones";

// ------------------------------------------------------------
// VARIABLES
// ------------------------------------------------------------
// Cada entrada tiene:
//   - path:    nombre de la propiedad en VariablesPunto.
//   - tipo:    "numero" | "booleano".
//   - patrones: cómo el usuario puede referirse a ella.
//   - ayuda:   texto para el usuario cuando no compila.
//
// Los patrones se matchean case-insensitive y sin tildes
// (el normalizador se aplica antes).
// ------------------------------------------------------------

export interface VariableDef {
  path: string;
  tipo: "numero" | "booleano";
  patrones: string[];
  ayuda: string;
}

export const VARIABLES: VariableDef[] = [
  // --- Marcador ---
  {
    path: "puntosPropios",
    tipo: "numero",
    patrones: ["puntos propios", "puntos nuestros", "nuestros puntos", "puntos a favor"],
    ayuda: "Cantidad de puntos que lleva mi equipo",
  },
  {
    path: "puntosRivales",
    tipo: "numero",
    patrones: ["puntos rivales", "puntos del rival", "puntos en contra", "puntos del otro equipo"],
    ayuda: "Cantidad de puntos que lleva el rival",
  },
  {
    path: "diferencia",
    tipo: "numero",
    patrones: ["diferencia", "diferencia de marcador", "ventaja", "desventaja"],
    ayuda: "Puntos propios menos puntos rivales (con signo)",
  },
  {
    path: "diferenciaAbs",
    tipo: "numero",
    patrones: ["diferencia absoluta", "distancia en el marcador"],
    ayuda: "Valor absoluto de la diferencia",
  },

  // --- Cierre de set ---
  {
    path: "puntosParaCerrarSetPropio",
    tipo: "numero",
    patrones: [
      "puntos para cerrar",
      "puntos para cerrar el set",
      "puntos que faltan para cerrar",
      "puntos que nos faltan",
      "puntos para ganar el set",
    ],
    ayuda: "Cuántos puntos le faltan a mi equipo para cerrar el set",
  },
  {
    path: "puntosParaCerrarSetRival",
    tipo: "numero",
    patrones: [
      "puntos para cerrar rival",
      "puntos que le faltan al rival",
      "puntos que le faltan al otro",
      "puntos para que cierre el rival",
      "al rival le faltan",
    ],
    ayuda: "Cuántos puntos le faltan al rival para cerrar el set",
  },
  {
    path: "esTieBreak",
    tipo: "booleano",
    patrones: ["tie break", "tie-break", "tiebreak", "set decisivo", "set final"],
    ayuda: "¿Es el set a 15 (tie-break)?",
  },
  {
    path: "setTerminado",
    tipo: "booleano",
    patrones: ["set terminado", "set cerrado", "fin del set"],
    ayuda: "¿El set ya está cerrado?",
  },
  {
    path: "target",
    tipo: "numero",
    patrones: ["target del set", "puntos del set", "meta del set"],
    ayuda: "25 o 15 según el set",
  },

  // --- Sets del partido ---
  {
    path: "setsPropios",
    tipo: "numero",
    patrones: ["sets propios", "sets ganados", "sets nuestros", "sets a favor"],
    ayuda: "Sets ganados por mi equipo",
  },
  {
    path: "setsRivales",
    tipo: "numero",
    patrones: ["sets rivales", "sets del rival", "sets en contra"],
    ayuda: "Sets ganados por el rival",
  },
  {
    path: "setsParaGanarPropio",
    tipo: "numero",
    patrones: ["sets para ganar", "sets para cerrar el partido"],
    ayuda: "Cuántos sets más necesita mi equipo",
  },
  {
    path: "setsParaGanarRival",
    tipo: "numero",
    patrones: ["sets para ganar el rival"],
    ayuda: "Cuántos sets más necesita el rival",
  },

  // --- Resultado del punto ---
  {
    path: "ganoPropio",
    tipo: "booleano",
    patrones: ["ganamos", "ganó el punto", "punto propio", "punto ganado", "punto a favor"],
    ayuda: "¿El punto lo ganó mi equipo?",
  },

  // --- Rally ---
  {
    path: "faseRally",
    tipo: "numero", // se compara con contiene() abajo, no directo
    patrones: ["fase del rally", "fase"],
    ayuda: "side-out | k2 | k3 | free-ball | otro",
  },
  {
    path: "cruces",
    tipo: "numero",
    patrones: ["cruces", "cruces de red", "pelotazos", "intercambios"],
    ayuda: "Cuántas veces cruzó la red la pelota en el punto",
  },
  {
    path: "toquesPropios",
    tipo: "numero",
    patrones: ["toques propios", "toques nuestros"],
    ayuda: "Acciones de mi equipo en el punto",
  },
  {
    path: "toquesRivales",
    tipo: "numero",
    patrones: ["toques rivales", "toques del rival"],
    ayuda: "Acciones del rival en el punto",
  },

  // --- Rachas ---
  {
    path: "rachaGanadosActual",
    tipo: "numero",
    patrones: ["racha de ganados", "puntos seguidos ganados", "racha ganando"],
    ayuda: "Puntos seguidos ganados por mi equipo",
  },
  {
    path: "rachaPerdidosActual",
    tipo: "numero",
    patrones: ["racha de perdidos", "puntos seguidos perdidos", "racha perdiendo"],
    ayuda: "Puntos seguidos perdidos por mi equipo",
  },
];

// ------------------------------------------------------------
// MAPA RÁPIDO
// ------------------------------------------------------------

const POR_PATH = new Map<string, VariableDef>();
for (const v of VARIABLES) POR_PATH.set(v.path, v);

export function buscarVariableDef(path: string): VariableDef | null {
  return POR_PATH.get(path) ?? null;
}

// ------------------------------------------------------------
// MÉTRICAS
// ------------------------------------------------------------
// Las métricas NO se calculan por punto. Se calculan sobre un
// CONJUNTO de acciones (filtradas). Se resuelven en `respuesta.ts`
// con el motor de métricas existente.
// ------------------------------------------------------------

export interface MetricaDef {
  nombre: string; // el nombre que usa respuesta.ts (case-sensitive)
  patrones: string[];
  ayuda: string;
}

export const METRICAS: MetricaDef[] = [
  {
    nombre: "attack_efficiency",
    patrones: [
      "efectividad de ataque",
      "eficiencia de ataque",
      "attack efficiency",
      "efectividad atacando",
      "eficiencia atacando",
      "ataque eficiente",
    ],
    ayuda: "(puntos - errores) / intentos × 100",
  },
  {
    nombre: "puntos_ganados_pct",
    patrones: [
      "porcentaje de puntos ganados",
      "% de puntos ganados",
      "puntos que ganamos",
      "tasa de puntos",
    ],
    ayuda: "Puntos propios / total de puntos × 100",
  },
  {
    nombre: "sideout_pct",
    patrones: ["side-out %", "sideout", "side out", "efectividad recibiendo"],
    ayuda: "Puntos ganados en side-out / total side-out × 100",
  },
  {
    nombre: "break_point_pct",
    patrones: ["break point", "break-point", "efectividad sacando"],
    ayuda: "Puntos ganados sacando / total sacando × 100",
  },
  {
    nombre: "reception_pct",
    patrones: [
      "calidad de recepción",
      "calidad de recepciones",
      "porcentaje de recepción",
      "recepción %",
    ],
    ayuda: "Recepciones positivas / total × 100",
  },
  {
    nombre: "kill_pct",
    patrones: ["kill %", "porcentaje de kill", "porcentaje de punto de ataque"],
    ayuda: "Puntos de ataque / intentos × 100",
  },
  {
    nombre: "ace_pct",
    patrones: ["ace %", "porcentaje de aces"],
    ayuda: "Aces / saques × 100",
  },
  {
    nombre: "serve_error_pct",
    patrones: ["error de saque %", "porcentaje de errores de saque"],
    ayuda: "Errores de saque / saques × 100",
  },
  {
    nombre: "block_efficiency",
    patrones: ["eficiencia de bloqueo", "efectividad de bloqueo"],
    ayuda: "(puntos - errores) / intentos × 100",
  },
  {
    nombre: "dig_efficiency",
    patrones: ["eficiencia de defensa", "efectividad de defensa"],
    ayuda: "Defensas positivas / total × 100",
  },
];

export function buscarMetricaDef(nombre: string): MetricaDef | null {
  for (const m of METRICAS) if (m.nombre === nombre) return m;
  return null;
}

// ------------------------------------------------------------
// SUJETOS (jugador / equipo)
// ------------------------------------------------------------
// "nuestro", "del rival", "de Juan", etc.
// Se usan para armar filtros sobre `jugadoresPresentes` y `ganoPropio`.
// ------------------------------------------------------------

export type Sujeto =
  | { tipo: "equipo"; lado: "propio" }
  | { tipo: "equipo"; lado: "rival" }
  | { tipo: "jugador"; id: string }
  | { tipo: "cualquiera" };

export const PATRONES_SUJETO_PROPIO = [
  "nuestro equipo",
  "mi equipo",
  "nosotros",
  "propio",
  "nuestros",
];

export const PATRONES_SUJETO_RIVAL = [
  "rival",
  "el otro equipo",
  "el contrario",
  "ellos",
  "rivales",
  "otro lado",
];

// ------------------------------------------------------------
// OPERADORES
// ------------------------------------------------------------
// Los que el compilador va a buscar en el texto.
// ------------------------------------------------------------

export const PATRONES_MAYOR = ["mas de", "más de", "mayor a", "mayor que", ">"];
export const PATRONES_MENOR = ["menos de", "menor a", "menor que", "<"];
export const PATRONES_IGUAL = ["igual a", "igual que", "es exactamente", "==", "="];
export const PATRONES_MAYOR_IGUAL = ["al menos", "minimo", "mínimo", "o mas", "o más", ">="];
export const PATRONES_MENOR_IGUAL = ["hasta", "como maximo", "como máximo", "o menos", "<="];

export const PATRONES_AND = [" y ", " ademas ", " además "];
export const PATRONES_OR = [" o ", " o bien "];

// ------------------------------------------------------------
// MULTIPLICADORES
// ------------------------------------------------------------
// "la mitad" → * 0.5
// "el doble" → * 2
// "el triple" → * 3
// etc.
// ------------------------------------------------------------

export const MULTIPLICADORES: { patrones: string[]; factor: number }[] = [
  { patrones: ["la mitad", "medio", "0.5"], factor: 0.5 },
  { patrones: ["un tercio", "1/3"], factor: 1 / 3 },
  { patrones: ["un cuarto", "1/4"], factor: 0.25 },
  { patrones: ["el doble", "dos veces", "2x"], factor: 2 },
  { patrones: ["el triple", "tres veces", "3x"], factor: 3 },
  { patrones: ["igual cantidad", "lo mismo", "la misma cantidad"], factor: 1 },
];

// ------------------------------------------------------------
// CONECTORES DE COMPARACIÓN (compare_to_baseline)
// ------------------------------------------------------------
// Disparan la construcción de un `compare_to_baseline`.
// ------------------------------------------------------------

export const PATRONES_COMPARE_TO_BASELINE = [
  "como varia",
  "cómo varía",
  "como cambia",
  "cómo cambia",
  "respecto a",
  "respecto de",
  "comparado con",
  "comparado a",
  "en comparacion con",
  "en comparación con",
  "vs el general",
  "vs general",
  "contra el general",
  "contra la general",
];

export const PATRONES_BASELINE_GENERAL = [
  "el general",
  "la general",
  "general",
  "todos los puntos",
  "el total",
  "total",
  "sin filtro",
  "en todos",
];

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

/**
 * Aplica un multiplicador al texto y devuelve el factor o null.
 * Ej: "la mitad" → 0.5
 */
export function buscarMultiplicador(textoNorm: string): number | null {
  for (const m of MULTIPLICADORES) {
    for (const p of m.patrones) {
      if (textoNorm.includes(p)) return m.factor;
    }
  }
  return null;
}

/**
 * Devuelve el patrón de comparación detectado (o null).
 */
export function buscarComparacion(
  textoNorm: string
): ">" | "<" | ">=" | "<=" | "==" | null {
  for (const p of PATRONES_MAYOR_IGUAL) if (textoNorm.includes(p)) return ">=";
  for (const p of PATRONES_MENOR_IGUAL) if (textoNorm.includes(p)) return "<=";
  for (const p of PATRONES_MAYOR) if (textoNorm.includes(p)) return ">";
  for (const p of PATRONES_MENOR) if (textoNorm.includes(p)) return "<";
  for (const p of PATRONES_IGUAL) if (textoNorm.includes(p)) return "==";
  return null;
}

/**
 * Devuelve el primer multiplicador si el texto lo menciona.
 * Si no, null. Usado en "la mitad de puntos que...".
 */
export function extraerFactorTexto(textoNorm: string): number | null {
  return buscarMultiplicador(textoNorm);
}

// ------------------------------------------------------------
// BUILDERS DE ALTO NIVEL (los usa el compilador)
// ------------------------------------------------------------
// Estas funciones YA arman Expr válidas del AST. El compilador
// solo tiene que llamarlas.
// ------------------------------------------------------------

/**
 * Filtro: un campo booleano es true.
 * Ej: `setTerminado` → esTieBreak
 */
export function filtroBooleano(path: string): Expr {
  return igual(variable(path), numero(1));
}

/**
 * Filtro: `puntosParaCerrarSetRival == factor * puntosParaCerrarSetPropio`.
 * Ej: factor = 0.5 → "al rival le faltan la mitad de puntos que a nosotros".
 */
export function filtroMultiploRelativo(
  pathIzq: string,
  pathDer: string,
  factor: number
): Expr {
  return igual(
    variable(pathIzq),
    producto(numero(factor), variable(pathDer))
  );
}

/**
 * Filtro: `path op valor`.
 * Ej: rachaGanadosActual >= 3
 */
export function filtroComparacion(
  path: string,
  op: ">" | "<" | ">=" | "<=" | "==" | "!=",
  valor: number
): Expr {
  const v = variable(path);
  const n = numero(valor);
  switch (op) {
    case ">":
      return mayor(v, n);
    case "<":
      return menor(v, n);
    case ">=":
      return mayorIgual(v, n);
    case "<=":
      return menorIgual(v, n);
    case "==":
      return igual(v, n);
    case "!=":
      return no(igual(v, n));
  }
}

/**
 * Filtro: `has(arrayField, valor)`.
 * Ej: tiposPresentes contiene "bloqueo".
 */
export function filtroContiene(field: string, valor: string): Expr {
  return contiene(field, valor);
}

/**
 * Filtro: `count(arrayField) >= n`.
 * Ej: cantidad de jugadores presentes >= 2.
 */
export function filtroCantidadMayorIgual(
  field: string,
  n: number
): Expr {
  return mayorIgual(cantidad(field), numero(n));
}

/**
 * Compone dos filtros con AND.
 */
export function filtroAnd(a: Expr, b: Expr): Expr {
  return y(a, b);
}

/**
 * Compone dos filtros con OR.
 */
export function filtroOr(a: Expr, b: Expr): Expr {
  return o(a, b);
}

/**
 * Combina expresión aritmética de dos variables.
 * Ej: diferencia = puntosPropios - puntosRivales
 */
export function aritmetica(
  op: "+" | "-" | "*" | "/",
  a: string | number,
  b: string | number
): Expr {
  const izq = typeof a === "number" ? numero(a) : variable(a);
  const der = typeof b === "number" ? numero(b) : variable(b);
  switch (op) {
    case "+":
      return suma(izq, der);
    case "-":
      return resta(izq, der);
    case "*":
      return producto(izq, der);
    case "/":
      return division(izq, der);
  }
}

// ------------------------------------------------------------
// LISTA DE AYUDAS (para el mensaje "no entendí")
// ------------------------------------------------------------

export function ayudaVariables(): string[] {
  return VARIABLES.map(
    (v) => `${v.patrones[0]} → ${v.ayuda}`
  );
}

export function ayudaMetricas(): string[] {
  return METRICAS.map(
    (m) => `${m.patrones[0]} → ${m.ayuda}`
  );
}