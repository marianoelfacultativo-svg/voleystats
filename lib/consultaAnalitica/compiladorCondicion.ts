// ============================================================
// COMPILADOR DE CONDICIÓN — capa 4 (AST)
// ============================================================
// Convierte una frase en lenguaje natural (castellano) en una
// `Expr` del AST que el motor puede evaluar punto por punto.
//
// Se usa desde `parserIntencion.ts` para dos cosas:
//   1) Detectar condiciones que el parser "de sinónimos" no
//      entiende ("cuando al rival le faltan la mitad de puntos",
//      "en racha de 3+", etc.).
//   2) Producir una `Expr` que el ejecutor aplica sobre
//      `VariablesPunto` antes de calcular la métrica.
//
// Determinista: si la frase no matchea ninguna regla, devuelve
// `null` y el parser hace lo de siempre. Si matchea, la `Expr`
// producida es la única respuesta posible.
//
// NO ejecuta: solo compila. La evaluación la hace
// `expresiones.evaluarBooleano(expr, vars)`.
// ============================================================

import {
  igual,
  mayorIgual,
  menorIgual,
  variable,
  numero,
  no,
  y,
  o,
  contiene,
  type Expr,
} from "./expresiones";
import {
  buscarMultiplicador,
  buscarMetricaDef,
  METRICAS,
  type MetricaDef,
} from "./semanticLayer";

// ------------------------------------------------------------
// RESULTADO
// ------------------------------------------------------------

export interface ResultadoCompilacion {
  /** Expresión booleana del filtro. null si no se detectó nada. */
  filtro: Expr | null;
  /** Métrica detectada (si la frase la menciona). */
  metrica: MetricaDef | null;
  /** ¿La frase pide comparar contra un baseline general? */
  compararConBaseline: boolean;
  /** Fragmentos que matchearon. */
  fragmentos: string[];
  /** Texto que NO se reconoció. */
  noReconocidas: string[];
  /** Error de compilación (raro: significa bug interno). */
  error: string | null;
}

// ------------------------------------------------------------
// NORMALIZACIÓN
// ------------------------------------------------------------

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,;:!?¡¿"“”‘’()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ordenarPorLargoDesc(arr: string[]): string[] {
  return [...arr].sort((a, b) => b.length - a.length);
}

// ------------------------------------------------------------
// NÚMEROS
// ------------------------------------------------------------

function parsearNumero(s: string): number | null {
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
// REGLAS DE COMPILACIÓN
// ------------------------------------------------------------
// Cada regla devuelve una `Expr` o null. Se evalúan en orden
// hasta que una matchea. La primera que gana, gana.
//
// El orden importa: las más específicas primero.
// ------------------------------------------------------------

type ReglaCompiladora = (texto: string) => {
  filtro: Expr;
  fragmentos: string[];
} | null;

const REGLAS: ReglaCompiladora[] = [
  // ----------------------------------------------------------
  // "cuando al rival le faltan [factor] de puntos que a nosotros"
  // ----------------------------------------------------------
  // → puntosParaCerrarSetRival == factor * puntosParaCerrarSetPropio
  (texto) => {
    // Detectar "al rival le faltan" o "al otro le faltan"
    const mAlRival =
      /(?:cuando\s+)?(?:al\s+)?rival\s+(?:le\s+)?faltan\s+(.+?)(?:\s+de\s+puntos|\s+puntos|\s+para\s+cerrar|,|$)/.exec(
        texto
      ) ||
      /(?:cuando\s+)?(?:al\s+)?otro\s+(?:le\s+)?faltan\s+(.+?)(?:\s+de\s+puntos|\s+puntos|\s+para\s+cerrar|,|$)/.exec(
        texto
      );

    if (!mAlRival) return null;

    const cola = mAlRival[1];

    // Factor explícito: "la mitad", "el doble", "un tercio", etc.
    const factor = buscarMultiplicador(cola);
    if (factor !== null) {
      return {
        filtro: igual(
          variable("puntosParaCerrarSetRival"),
          {
            kind: "op",
            op: "*",
            l: numero(factor),
            r: variable("puntosParaCerrarSetPropio"),
          }
        ),
        fragmentos: [`rival faltan ${factor}x que nosotros`],
      };
    }

    // Número explícito: "5 puntos" → comparar contra constante
    const numMatch = cola.match(
      /\b(\d{1,2}|un[oa]?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\b/
    );
    if (numMatch) {
      const n = parsearNumero(numMatch[1]);
      if (n !== null) {
        return {
          filtro: menorIgual(variable("puntosParaCerrarSetRival"), numero(n)),
          fragmentos: [`rival faltan <=${n}`],
        };
      }
    }

    return null;
  },

  // ----------------------------------------------------------
  // "cuando al rival le faltan X puntos"
  // ----------------------------------------------------------
  // → puntosParaCerrarSetRival <= X
  (texto) => {
    const m =
      /rival\s+(?:le\s+)?faltan\s+(\d{1,2}|un[oa]?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+puntos?/.exec(
        texto
      );
    if (!m) return null;
    const n = parsearNumero(m[1]);
    if (n === null) return null;
    return {
      filtro: menorIgual(variable("puntosParaCerrarSetRival"), numero(n)),
      fragmentos: [`rival faltan <=${n}`],
    };
  },

  // ----------------------------------------------------------
  // "cuando nos faltan X puntos" / "para cerrar"
  // ----------------------------------------------------------
  // → puntosParaCerrarSetPropio <= X
  (texto) => {
    const m =
      /(?:nos\s+)?faltan\s+(\d{1,2}|un[oa]?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+puntos?/.exec(
        texto
      ) || /para\s+cerrar\s+(\d{1,2}|un[oa]?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+puntos?/.exec(
        texto
      );
    if (!m) return null;
    const n = parsearNumero(m[1]);
    if (n === null) return null;
    return {
      filtro: menorIgual(variable("puntosParaCerrarSetPropio"), numero(n)),
      fragmentos: [`nos faltan <=${n}`],
    };
  },

  // ----------------------------------------------------------
  // "en sets ganados" / "en sets perdidos"
  // ----------------------------------------------------------
  // → setsPropios > setsRivales (o al revés)
  (texto) => {
    if (/en\s+sets\s+ganados/.test(texto) || /set\s+ganado/.test(texto)) {
      return {
        filtro: {
          kind: "cmp",
          op: ">",
          l: variable("setsPropios"),
          r: variable("setsRivales"),
        },
        fragmentos: ["en sets ganados"],
      };
    }
    if (/en\s+sets\s+perdidos/.test(texto) || /set\s+perdido/.test(texto)) {
      return {
        filtro: {
          kind: "cmp",
          op: "<",
          l: variable("setsPropios"),
          r: variable("setsRivales"),
        },
        fragmentos: ["en sets perdidos"],
      };
    }
    return null;
  },

  // ----------------------------------------------------------
  // "en partidos ganados" / "en partidos perdidos"
  // ----------------------------------------------------------
  // → no hay una variable directa, pero podemos usar setsPropios vs setsRivales
  //    del partido actual. Si el usuario quiere "en partidos ganados" a nivel
  //    histórico, eso se resuelve en `ejecutor` con `resultadosPartido`.
  //    Por ahora: si en el punto actual ya se cerró el partido a favor, aplica.
  (texto) => {
    if (/en\s+partidos?\s+ganados?/.test(texto)) {
      // Aproximación: setsPropios ya alcanzaron para ganar
      return {
        filtro: mayorIgual(
          {
            kind: "op",
            op: "+",
            l: variable("setsPropios"),
            r: numero(0),
          },
          {
            kind: "op",
            op: "-",
            l: numero(2),
            r: numero(0),
          }
        ),
        fragmentos: ["en partidos ganados"],
      };
    }
    return null;
  },

  // ----------------------------------------------------------
  // "en racha de N+" / "racha de N o mas"
  // ----------------------------------------------------------
  // → rachaGanadosActual >= N OR rachaPerdidosActual >= N
  (texto) => {
    const m =
      /racha\s+(?:de\s+)?(\d{1,2}|un[oa]?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s*(?:\+|o\s+mas|o\s+más|seguidos|consecutivos)?/.exec(
        texto
      );
    if (!m) return null;
    const n = parsearNumero(m[1]);
    if (n === null) return null;
    return {
      filtro: o(
        mayorIgual(variable("rachaGanadosActual"), numero(n)),
        mayorIgual(variable("rachaPerdidosActual"), numero(n))
      ),
      fragmentos: [`racha >=${n}`],
    };
  },

  // ----------------------------------------------------------
  // "con N+ cruces" / "mas de N cruces" / "menos de N cruces"
  // ----------------------------------------------------------
  (texto) => {
    // "más de N cruces"
    const mMas =
      /(?:mas|más)\s+de\s+(\d{1,2}|un[oa]?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(?:cruces?|pelotazos?)/.exec(
        texto
      );
    if (mMas) {
      const n = parsearNumero(mMas[1]);
      if (n !== null) {
        return {
          filtro: mayorIgual(variable("cruces"), numero(n + 1)),
          fragmentos: [`cruces >${n}`],
        };
      }
    }

    // "menos de N cruces"
    const mMenos =
      /menos\s+de\s+(\d{1,2}|un[oa]?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(?:cruces?|pelotazos?)/.exec(
        texto
      );
    if (mMenos) {
      const n = parsearNumero(mMenos[1]);
      if (n !== null && n >= 1) {
        return {
          filtro: menorIgual(variable("cruces"), numero(n - 1)),
          fragmentos: [`cruces <${n}`],
        };
      }
    }

    // "N o más cruces"
    const mNoMas =
      /(\d{1,2}|un[oa]?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s*(?:o\s+(?:mas|más))?\s+(?:cruces?|pelotazos?)/.exec(
        texto
      );
    if (mNoMas) {
      const n = parsearNumero(mNoMas[1]);
      if (n !== null) {
        return {
          filtro: mayorIgual(variable("cruces"), numero(n)),
          fragmentos: [`cruces >=${n}`],
        };
      }
    }

    // "en racha corta / larga"
    if (/rally\s+corto|punto\s+corto/.test(texto)) {
      return {
        filtro: menorIgual(variable("cruces"), numero(2)),
        fragmentos: ["rally corto"],
      };
    }
    if (/rally\s+largo|punto\s+largo/.test(texto)) {
      return {
        filtro: mayorIgual(variable("cruces"), numero(3)),
        fragmentos: ["rally largo"],
      };
    }

    return null;
  },

  // ----------------------------------------------------------
  // "en tie-break" / "en el set decisivo"
  // ----------------------------------------------------------
  (texto) => {
    if (/tie\s*-?\s*break/.test(texto) || /set\s+(decisivo|final)/.test(texto)) {
      return {
        filtro: igual(variable("esTieBreak"), numero(1)),
        fragmentos: ["en tie-break"],
      };
    }
    return null;
  },

  // ----------------------------------------------------------
  // "cuando ganamos" / "cuando perdimos" / "puntos ganados"
  // ----------------------------------------------------------
  (texto) => {
    if (
      /cuando\s+(?:ganamos|ganó\s+el\s+punto|ganamos\s+el\s+punto)/.test(
        texto
      ) ||
      /puntos?\s+que\s+ganamos/.test(texto)
    ) {
      return {
        filtro: igual(variable("ganoPropio"), numero(1)),
        fragmentos: ["cuando ganamos"],
      };
    }
    if (
      /cuando\s+(?:perdimos|perdió\s+el\s+punto|perdimos\s+el\s+punto)/.test(
        texto
      )
    ) {
      return {
        filtro: no(igual(variable("ganoPropio"), numero(1))),
        fragmentos: ["cuando perdimos"],
      };
    }
    return null;
  },

  // ----------------------------------------------------------
  // "en side-out" / "en k2" / "en k3" / "en free-ball"
  // ----------------------------------------------------------
  (texto) => {
    if (/side[\s-]?out|en\s+k1/.test(texto)) {
      return {
        filtro: contiene("tiposPresentes", "recepcion"),
        fragmentos: ["side-out"],
      };
    }
    if (/en\s+k2/.test(texto)) {
      return {
        filtro: contiene("tiposPresentes", "defensa"),
        fragmentos: ["k2"],
      };
    }
    if (/en\s+k3/.test(texto)) {
      return {
        filtro: contiene("tiposPresentes", "defensa"),
        fragmentos: ["k3"],
      };
    }
    if (/free[\s-]?ball|pelota\s+libre/.test(texto)) {
      return {
        filtro: contiene("tiposPresentes", "libre"),
        fragmentos: ["free-ball"],
      };
    }
    return null;
  },
];

// ------------------------------------------------------------
// DETECCIÓN DE MÉTRICA
// ------------------------------------------------------------

function detectarMetrica(textoNorm: string): {
  metrica: MetricaDef;
  fragmento: string;
} | null {
  // Buscar por METRICAS (los patrones más largos primero)
  for (const m of METRICAS) {
    const patrones = ordenarPorLargoDesc(m.patrones);
    for (const p of patrones) {
      if (textoNorm.includes(p)) {
        return { metrica: m, fragmento: p };
      }
    }
  }
  return null;
}

// ------------------------------------------------------------
// DETECCIÓN DE COMPARE_TO_BASELINE
// ------------------------------------------------------------

const PATRONES_COMPARE = [
  "como varia",
  "como cambia",
  "respecto a",
  "respecto de",
  "comparado con",
  "comparado a",
  "en comparacion con",
  "vs el general",
  "vs general",
  "contra el general",
  "contra la general",
];

function detectarCompareToBaseline(textoNorm: string): boolean {
  for (const p of PATRONES_COMPARE) {
    if (textoNorm.includes(p)) return true;
  }
  return false;
}

// ------------------------------------------------------------
// API PÚBLICA
// ------------------------------------------------------------

export function compilarCondicion(
  textoOriginal: string
): ResultadoCompilacion {
  const texto = normalizar(textoOriginal);

  const res: ResultadoCompilacion = {
    filtro: null,
    metrica: null,
    compararConBaseline: false,
    fragmentos: [],
    noReconocidas: [],
    error: null,
  };

  if (!texto) return res;

  // 1. Métrica (primero, para que el compilador sepa si la frase
  //    habla de "efectividad" o "porcentaje", etc.)
  const met = detectarMetrica(texto);
  if (met) {
    res.metrica = met.metrica;
    res.fragmentos.push(met.fragmento);
  }

  // 2. Compare-to-baseline
  if (detectarCompareToBaseline(texto)) {
    res.compararConBaseline = true;
    res.fragmentos.push("compare_to_baseline");
  }

  // 3. Filtros (reglas en orden)
  const filtros: Expr[] = [];
  let textoRestante = texto;

  for (const regla of REGLAS) {
    const r = regla(textoRestante);
    if (!r) continue;
    filtros.push(r.filtro);
    res.fragmentos.push(...r.fragmentos);
    // Quitar el fragmento del texto para no matchear dos veces
    for (const f of r.fragmentos) {
      const idx = textoRestante.indexOf(f);
      if (idx >= 0) {
        textoRestante =
          textoRestante.slice(0, idx) + textoRestante.slice(idx + f.length);
      }
    }
  }

  // 4. Componer filtros con AND
  if (filtros.length === 1) {
    res.filtro = filtros[0];
  } else if (filtros.length > 1) {
    let acc = filtros[0];
    for (let i = 1; i < filtros.length; i++) {
      acc = y(acc, filtros[i]);
    }
    res.filtro = acc;
  }

  // 5. Devolver
  return res;
}

// ------------------------------------------------------------
// HELPERS DE INTROSPECCIÓN
// ------------------------------------------------------------

/**
 * Devuelve true si el texto tiene pinta de ser una "condición
 * compleja" (necesita el AST, no alcanza con el parser de
 * sinónimos). Útil para decidir si vale la pena llamar al
 * compilador o no.
 */
export function pareceCondicionCompleja(textoOriginal: string): boolean {
  const texto = normalizar(textoOriginal);
  if (!texto) return false;

  // Menciona métrica + conector de comparación
  const tieneMetrica = METRICAS.some((m) =>
    m.patrones.some((p) => texto.includes(p))
  );
  const tieneCompare = detectarCompareToBaseline(texto);
  if (tieneMetrica && tieneCompare) return true;

  // Menciona "cuando" + algún patrón de filtro conocido
  if (/\bcuando\b/.test(texto)) {
    for (const regla of REGLAS) {
      if (regla(texto)) return true;
    }
  }

  // Menciona "en sets ganados/perdidos"
  if (/en\s+sets?\s+(ganado|perdido)/.test(texto)) return true;

  // Menciona "racha de N"
  if (/racha\s+de\s+\d/.test(texto)) return true;

  return false;
}