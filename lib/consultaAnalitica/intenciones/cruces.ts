// ============================================================
// INTENCIONES · CRUCES DE RED (Cat. 6)
// ============================================================
// Detecta "más de N cruces de red", "N o más cruces",
// "rally largo", etc.
//
// ------------------------------------------------------------
// ¿Qué es un "cruce de red"?
// ------------------------------------------------------------
// Cada vez que la pelota pasa de un lado al otro del campo.
// Un OVERPASS también cuenta (la pelota cruzó la red, aunque
// haya sido un error). El cálculo por punto se hace en
// ejecutor.ts / bloqueTrigger.ts: cada cambio de `lado` entre
// acciones consecutivas visibles suma 1.
//
// ------------------------------------------------------------
// Semántica
// ------------------------------------------------------------
// "más de 3 cruces"      →  crucesMinimos = 4
// "3 o más cruces"       →  crucesMinimos = 3
// "menos de 3 cruces"    →  crucesMaximos = 2
// "hasta 5 cruces"       →  crucesMaximos = 5
// "exactamente 4"        →  crucesExactos = 4
// "entre 3 y 5"          →  crucesRango = [3, 5]
// "cruces de red" suelto →  crucesMinimos = 3 (ambiguo, con aviso)
// "rally largo"          →  crucesMinimos = 3 (ambiguo, con aviso)
// "rally corto"          →  crucesMaximos = 2 (ambiguo, con aviso)
//
// ------------------------------------------------------------
// Desambiguación OVERPASS
// ------------------------------------------------------------
// "pasa al otro lado" puede significar:
//
//   1. Overpass (recepción que cruza la red por error)
//   2. Cruce de red del rally (normal)
//
// Regla:
//   - Si el texto menciona explícitamente recepción
//     ("recepcion", "recibe", "recibio", "recibió", "recibieron")
//     → NO es cruce de rally (deja que extraerResultado lo
//     detecte como overpass).
//   - Si NO menciona recepción → es cruce de red.
// ============================================================

// ------------------------------------------------------------
// TIPO DE RESULTADO
// ------------------------------------------------------------
// Todos los campos son opcionales. El parser combina lo que
// venga con la CondicionFiltro existente.
//
// `ambiguo=true` significa que se usó un default (no había N
// explícito). El motor muestra un aviso al usuario.
// ------------------------------------------------------------

export interface ResultadoCruces {
  crucesMinimos?: number;
  crucesMaximos?: number;
  crucesExactos?: number;
  crucesRango?: [number, number];
  fragmento: string;
  ambiguo: boolean;
  aviso?: string;
}

// ------------------------------------------------------------
// CONSTANTES DE DEFAULT
// ------------------------------------------------------------
// Si el usuario dice "rally largo" / "rally corto" sin N,
// asumimos estos valores y avisamos.
// ------------------------------------------------------------

export const CRUCES_DEFAULT_LARGO = 3; // ≥ 3 cruces
export const CRUCES_DEFAULT_CORTO = 2; // ≤ 2 cruces

// ------------------------------------------------------------
// PALABRAS QUE PUEDEN APARECER EN LUGAR DE "CRUCES"
// ------------------------------------------------------------
// Construyo el regex con todas estas alternativas.
// "veces al otro lado" y "veces que cruza/pasa" se arman
// aparte porque tienen dos palabras + preposición.
// ------------------------------------------------------------

const PALABRAS_CRUCE =
  "(?:cruces?|pelotazos?|intercambios?|vuelos?|pasajes?)";

const PALABRAS_CRUCE_LARGO =
  "(?:cruces?|pelotazos?|intercambios?|vuelos?|pasajes?|veces\\s+(?:al?\\s+otro\\s+lado|que\\s+(?:cruza|pasa|va\\s+al?\\s+otro\\s+lado)))";

// ------------------------------------------------------------
// NÚMERO EN PALABRA O DÍGITO
// ------------------------------------------------------------

const NUMERO =
  "(\\d{1,2}|un[oa]?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)";

// ------------------------------------------------------------
// REGEX DE CADA FILTRO
// ------------------------------------------------------------

// "entre N y M cruces"
const RE_ENTRE = new RegExp(
  `\\bentre\\s+${NUMERO}\\s+y\\s+${NUMERO}\\s+${PALABRAS_CRUCE_LARGO}\\b`
);

// "exactamente N cruces"
const RE_EXACTO = new RegExp(
  `\\bexactamente\\s+${NUMERO}\\s+${PALABRAS_CRUCE_LARGO}\\b`
);

// "más de N cruces" / "mas de N"
const RE_MAS_DE = new RegExp(
  `\\b(?:mas|más)\\s+de\\s+${NUMERO}\\s+${PALABRAS_CRUCE_LARGO}\\b`
);

// "menos de N cruces"
const RE_MENOS_DE = new RegExp(
  `\\bmenos\\s+de\\s+${NUMERO}\\s+${PALABRAS_CRUCE_LARGO}\\b`
);

// "hasta N cruces"
const RE_HASTA = new RegExp(
  `\\bhasta\\s+${NUMERO}\\s+${PALABRAS_CRUCE_LARGO}\\b`
);

// "N o más cruces" / "al menos N cruces"
const RE_NO_MAS = new RegExp(
  `\\b(?:al\\s+menos\\s+)?${NUMERO}\\s*(?:o\\s+(?:mas|más))?\\s+${PALABRAS_CRUCE_LARGO}\\b`
);

// "cruces de red" / "pelotazos" / "intercambios" suelto
// (sin N) → default ambiguo.
const RE_SUELTO = new RegExp(
  `\\b(?:cruces?\\s+(?:de\\s+)?red|cruces?\\s+(?:por|en)\\s+(?:rally|punto)|${PALABRAS_CRUCE_LARGO})\\b`
);

// "rally largo" / "rallys largos" / "puntos largos"
const RE_RALLY_LARGO =
  /\brallys?\s+larg[oa]s?\b|\brallies?\s+larg[oa]s?\b|\bpuntos?\s+larg[oa]s?\b/;

// "rally corto" / "rallys cortos" / "puntos cortos"
const RE_RALLY_CORTO =
  /\brallys?\s+cort[oa]s?\b|\brallies?\s+cort[oa]s?\b|\bpuntos?\s+cort[oa]s?\b/;

// ------------------------------------------------------------
// DETECCIÓN DE CONTEXTO RECEPCIÓN (para desambiguar overpass)
// ------------------------------------------------------------

function esContextoRecepcion(textoNormalizado: string): boolean {
  return /\b(?:recepcion|recepciones|recibe|reciben|recibio|recibieron)\b/.test(
    textoNormalizado
  );
}

// ------------------------------------------------------------
// HELPER: convertir "N escrito en palabra" a número
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
    once: 11,
    doce: 12,
  };
  if (mapa[n] !== undefined) return mapa[n];
  const num = parseInt(n, 10);
  return isNaN(num) ? null : num;
}

// ------------------------------------------------------------
// HELPER PRINCIPAL: extraer cruces del texto normalizado
// ------------------------------------------------------------
// El texto viene SIN tildes (el parser ya llamó a normalizar).
//
// Orden de evaluación (más específico primero):
//   1. "entre N y M"
//   2. "exactamente N"
//   3. "más de N"
//   4. "menos de N"
//   5. "hasta N"
//   6. "N o más" / "al menos N"
//   7. "rally corto"        → crucesMaximos default 2, ambiguo
//   8. "rally largo"        → crucesMinimos default 3, ambiguo
//   9. "cruces de red" suelto → crucesMinimos default 3, ambiguo
//
// Si el texto menciona recepción Y "pasa al otro lado" /
// "cruza" / "cruce", devuelve null (lo maneja el resultado
// como overpass).
//
// Si no matchea nada, devuelve null.
// ------------------------------------------------------------

export function extraerCrucesDeTexto(
  textoNormalizado: string
): ResultadoCruces | null {
  // --- Desambiguación overpass ---
  // Si el texto es de recepción y dice "pasa al otro lado" /
  // "cruza" → es overpass, no cruce de rally.
  if (esContextoRecepcion(textoNormalizado)) {
    if (
      /\b(?:pasa|cruza|va)\s+(?:al?\s+otro\s+lado|para\s+el\s+otro\s+lado)\b/.test(
        textoNormalizado
      )
    ) {
      return null;
    }
  }

  // 1. entre N y M
  const mEntre = textoNormalizado.match(RE_ENTRE);
  if (mEntre) {
    const n = parsearNumeroCruces(mEntre[1]);
    const m = parsearNumeroCruces(mEntre[2]);
    if (n !== null && m !== null && n <= m) {
      return {
        crucesRango: [n, m],
        fragmento: mEntre[0],
        ambiguo: false,
      };
    }
  }

  // 2. exactamente N
  const mExacto = textoNormalizado.match(RE_EXACTO);
  if (mExacto) {
    const n = parsearNumeroCruces(mExacto[1]);
    if (n !== null) {
      return {
        crucesExactos: n,
        fragmento: mExacto[0],
        ambiguo: false,
      };
    }
  }

  // 3. más de N → N + 1 (estrictamente más)
  const mMasDe = textoNormalizado.match(RE_MAS_DE);
  if (mMasDe) {
    const n = parsearNumeroCruces(mMasDe[1]);
    if (n !== null) {
      return {
        crucesMinimos: n + 1,
        fragmento: mMasDe[0],
        ambiguo: false,
      };
    }
  }

  // 4. menos de N → N - 1 (estrictamente menos)
  const mMenosDe = textoNormalizado.match(RE_MENOS_DE);
  if (mMenosDe) {
    const n = parsearNumeroCruces(mMenosDe[1]);
    if (n !== null && n >= 1) {
      return {
        crucesMaximos: Math.max(0, n - 1),
        fragmento: mMenosDe[0],
        ambiguo: false,
      };
    }
  }

  // 5. hasta N → crucesMaximos = N (inclusive)
  const mHasta = textoNormalizado.match(RE_HASTA);
  if (mHasta) {
    const n = parsearNumeroCruces(mHasta[1]);
    if (n !== null) {
      return {
        crucesMaximos: n,
        fragmento: mHasta[0],
        ambiguo: false,
      };
    }
  }

  // 6. N o más / al menos N
  const mNoMas = textoNormalizado.match(RE_NO_MAS);
  if (mNoMas) {
    const n = parsearNumeroCruces(mNoMas[1]);
    if (n !== null) {
      return {
        crucesMinimos: n,
        fragmento: mNoMas[0],
        ambiguo: false,
      };
    }
  }

  // 7. rally corto → default ambiguo
  const mCorto = textoNormalizado.match(RE_RALLY_CORTO);
  if (mCorto) {
    return {
      crucesMaximos: CRUCES_DEFAULT_CORTO,
      fragmento: mCorto[0],
      ambiguo: true,
      aviso:
        `Asumí "rally corto" = hasta ${CRUCES_DEFAULT_CORTO} cruces. ` +
        `Si querés otro umbral, especificalo (ej: "menos de 3 cruces").`,
    };
  }

  // 8. rally largo → default ambiguo
  const mLargo = textoNormalizado.match(RE_RALLY_LARGO);
  if (mLargo) {
    return {
      crucesMinimos: CRUCES_DEFAULT_LARGO,
      fragmento: mLargo[0],
      ambiguo: true,
      aviso:
        `Asumí "rally largo" = ${CRUCES_DEFAULT_LARGO}+ cruces. ` +
        `Si querés otro umbral, especificalo (ej: "más de 4 cruces").`,
    };
  }

  // 9. "cruces de red" / "pelotazos" / "intercambios" suelto
  const mSuelto = textoNormalizado.match(RE_SUELTO);
  if (mSuelto) {
    return {
      crucesMinimos: CRUCES_DEFAULT_LARGO,
      fragmento: mSuelto[0],
      ambiguo: true,
      aviso:
        `Asumí "${CRUCES_DEFAULT_LARGO}+ cruces". ` +
        `Si querés otro umbral, especificalo (ej: "más de 4 cruces").`,
    };
  }

  return null;
}