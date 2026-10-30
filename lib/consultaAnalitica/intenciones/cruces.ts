// ============================================================
// INTENCIONES · CRUCES DE RED (Cat. 6)
// ============================================================
// Detecta "más de N cruces de red", "N o más cruces",
// "rally largo", etc.
//
// El parser setea `CondicionFiltro.crucesMinimos` con un número.
// El motor (ejecutor.ts) filtra los puntos por esa cantidad.
//
// ------------------------------------------------------------
// ¿Qué es un "cruce de red"?
// ------------------------------------------------------------
// Cada vez que la pelota pasa de un lado al otro del campo.
// Se calcula por la secuencia de acciones del punto: cada
// cambio de `lado` ("propio" → "rival" o viceversa) suma 1.
//
//   Acción 1: saque (lado propio) → la pelota cruza a rival
//   Acción 2: recepción (lado rival) → no cruza todavía
//   Acción 3: armado (lado rival) → no cruza todavía
//   Acción 4: ataque (lado rival) → cruza a propio
//   Acción 5: defensa (lado propio) → no cruza todavía
//   ...
//
// Cada cambio de lado = 1 cruce. La cantidad de cruces es
// el número de "vuelos" de la pelota entre los dos lados.
//
// Un rally "corto" (típico) tiene 2-4 cruces.
// Un rally "largo" tiene 5+.
//
// ------------------------------------------------------------
// Semántica de "más de N cruces"
// ------------------------------------------------------------
// "más de 3 cruces"  →  crucesMinimos = 4 (estrictamente más)
// "3 o más cruces"   →  crucesMinimos = 3 (inclusive)
// "al menos 3 cruces"→  crucesMinimos = 3 (inclusive)
// "rally largo"      →  crucesMinimos = 3 (default razonable)
//
// Si el usuario dice "más de 3" queremos 4 o más. Si dice
// "3 o más" queremos 3 o más. La diferencia es de 1 cruce.
//
// ------------------------------------------------------------
// Uso desde el parser
// ------------------------------------------------------------
// El parser hace primero una pasada con regex para "más de
// N cruces", después otra para "N o más cruces" / "al menos
// N cruces", después por "cruces de red" suelto (default 3),
// y por último por "rally largo" (default 3).
//
// El primer match gana.
// ============================================================

// ------------------------------------------------------------
// TIPO DE EXTRACCIÓN
// ------------------------------------------------------------

export interface ResultadoCruces {
  /** Mínimo de cruces (inclusive). */
  crucesMinimos: number;
  /** El fragmento del texto que matcheó. */
  fragmento: string;
}

// ------------------------------------------------------------
// PATRÓN 1: "más de N cruces"
// ------------------------------------------------------------
// "más de 3 cruces" → 4 (estrictamente más)
// "mas de 5 cruces" → 6
// Acepta variantes sin tilde y con número escrito en palabra.
// ------------------------------------------------------------

export const REGEX_MAS_DE_CRUCES: RegExp =
  /\b(?:mas|más)\s+de\s+(\d{1,2}|un[oa]?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+cruces?\b/;

// ------------------------------------------------------------
// PATRÓN 2: "N o más cruces" / "al menos N cruces"
// ------------------------------------------------------------
// "3 o más cruces"     → 3
// "al menos 5 cruces"  → 5
// ------------------------------------------------------------

export const REGEX_N_O_MAS_CRUCES: RegExp =
  /\b(?:al\s+menos\s+)?(\d{1,2}|un[oa]?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s*(?:o\s+mas|o\s+más)?\s+cruces?\b/;

// ------------------------------------------------------------
// PATRÓN 3: "cruces de red" suelto (sin N)
// ------------------------------------------------------------
// El usuario pregunta "cuántos rallys tienen cruces de red"
// sin especificar N. Usamos 3 como default (rally "largo").
// ------------------------------------------------------------

export const REGEX_CRUCES_SUELTO: RegExp = /\bcruces?\s+(?:de\s+)?red\b|\bcruce\s+(?:de\s+)?red\b/;

// ------------------------------------------------------------
// PATRÓN 4: "rally largo" / "rallys largos"
// ------------------------------------------------------------
// Default: 3 cruces o más (rally largo).
// ------------------------------------------------------------

export const REGEX_RALLY_LARGO: RegExp =
  /\brallys?\s+larg[oa]s?\b|\brallies?\s+larg[oa]s?\b|\bpuntos?\s+larg[oa]s?\b/;

// ------------------------------------------------------------
// CONSTANTE: default de "rally largo" / "cruces de red" suelto
// ------------------------------------------------------------

export const CRUCES_DEFAULT_LARGO = 3;

// ------------------------------------------------------------
// HELPER: convertir "N escrito en palabra" a número
// ------------------------------------------------------------
// Misma lógica que parserIntencion.ts usa para otras palabras
// numéricas. Lo dejamos acá para no duplicar la tabla.
// ------------------------------------------------------------

export function parsearNumeroCruces(s: string): number | null {
  const n = s.toLowerCase().trim();
  const mapa: Record<string, number> = {
    un: 1,
    uno: 1,
    una: 1,
    dos: 2,
    tres: 3,
    cuatro: 4,
    cinco: 5,
    seis: 6,
    siete: 7,
    ocho: 8,
    nueve: 9,
    diez: 10,
  };
  if (mapa[n] !== undefined) return mapa[n];
  const num = parseInt(n, 10);
  return isNaN(num) ? null : num;
}

// ------------------------------------------------------------
// HELPER PRINCIPAL: extraer cruces del texto normalizado
// ------------------------------------------------------------
// El texto viene SIN tildes (el parser ya llamó a normalizar).
// Devuelve el primer match en este orden:
//   1. "más de N cruces"       → N + 1
//   2. "N o más cruces"        → N
//   3. "cruces de red" suelto  → CRUCES_DEFAULT_LARGO
//   4. "rally largo"           → CRUCES_DEFAULT_LARGO
//
// Si no matchea nada, devuelve null.
// ------------------------------------------------------------

export function extraerCrucesDeTexto(
  textoNormalizado: string
): ResultadoCruces | null {
  // 1. "más de N cruces" → N + 1
  const mMasDe = textoNormalizado.match(REGEX_MAS_DE_CRUCES);
  if (mMasDe) {
    const n = parsearNumeroCruces(mMasDe[1]);
    if (n !== null) {
      return {
        crucesMinimos: n + 1,
        fragmento: mMasDe[0],
      };
    }
  }

  // 2. "N o más cruces" / "al menos N cruces" → N
  const mNoMas = textoNormalizado.match(REGEX_N_O_MAS_CRUCES);
  if (mNoMas) {
    const n = parsearNumeroCruces(mNoMas[1]);
    if (n !== null) {
      return {
        crucesMinimos: n,
        fragmento: mNoMas[0],
      };
    }
  }

  // 3. "cruces de red" suelto → default
  const mSuelto = textoNormalizado.match(REGEX_CRUCES_SUELTO);
  if (mSuelto) {
    return {
      crucesMinimos: CRUCES_DEFAULT_LARGO,
      fragmento: mSuelto[0],
    };
  }

  // 4. "rally largo" → default
  const mLargo = textoNormalizado.match(REGEX_RALLY_LARGO);
  if (mLargo) {
    return {
      crucesMinimos: CRUCES_DEFAULT_LARGO,
      fragmento: mLargo[0],
    };
  }

  return null;
}