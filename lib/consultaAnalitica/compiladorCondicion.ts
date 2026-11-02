// ============================================================
// COMPILADOR DE CONDICIÓN — capa 4 (AST)
// ============================================================
// Convierte una frase en lenguaje natural (castellano) en una
// `Expr` del AST que el motor puede evaluar punto por punto.
//
// v1.1 (FASE 7.5 — fixes de bugs reportados):
//   + Auto-marcado de `compararConBaseline=true` cuando hay
//     filtro + métrica (aunque el texto no diga "como varia").
//     → Arregla "cuando al rival le faltan 5 puntos, cuántos
//       puntos ganamos", "en racha de 3+, cómo varía...", etc.
//   + Regla "en sets ganados/perdidos" devuelve ahora un filtro
//     real sobre `setsPropios` vs `setsRivales`. Antes se
//     colaba como métrica `sets_ganados` (no implementada).
//   + Regla "cuando ganamos/perdimos" más robusta.
//   + Regla de cruces: la del caso "más de N cruces" ya no se
//     pisa con la de "N o más".
//   + `detectarCompareToBaseline` exportada (para que
//     `parserIntencion` pueda reusarla).
//   + `pareceCondicionCompleja` reescrita:
//       · `tieneMetrica && tieneFiltro` → true (auto-baseline)
//       · "cuando" + cualquier regla → true
//       · "en sets ganados/perdidos" → true
//       · "racha de N" → true
//   + Regla "más de N cruces" corregida (antes "N o más"
//     capturaba "más de 4" y devolvía >=4 en vez de >=5).
//
// Determinista: si la frase no matchea ninguna regla, devuelve
// `null` y el parser hace lo de siempre. Si matchea, la `Expr`
// producida es la única respuesta posible.
// ============================================================

import {
  igual,
  mayor,
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
  /**
   * Si true, `parserIntencion` debe IGNORAR la métrica detectada
   * por `extraerMetrica` y usar la del compilador (o ninguna).
   * Se usa para casos como "en sets ganados" que el parser
   * confunde con la métrica `sets_ganados`.
   */
  ignorarMetricaParser: boolean;
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
    un: 1, uno: 1, una: 1,
    dos: 2, tres: 3, cuatro: 4, cinco: 5,
    seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
    once: 11, doce: 12,
  };
  if (mapa[n] !== undefined) return mapa[n];
  const num = parseInt(n, 10);
  return isNaN(num) ? null : num;
}

// ------------------------------------------------------------
// DETECCIÓN DE MÉTRICA
// ------------------------------------------------------------

function detectarMetrica(textoNorm: string): {
  metrica: MetricaDef;
  fragmento: string;
} | null {
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

export function detectarCompareToBaseline(textoNorm: string): boolean {
  for (const p of PATRONES_COMPARE) {
    if (textoNorm.includes(p)) return true;
  }
  return false;
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
  /** Si true, `parserIntencion` debe ignorar `extraerMetrica`. */
  ignorarMetricaParser?: boolean;
} | null;

const REGLAS: ReglaCompiladora[] = [
  // ----------------------------------------------------------
  // "cuando al rival le faltan [factor] de puntos que a nosotros"
  // ----------------------------------------------------------
  (texto) => {
    const mAlRival =
      /(?:cuando\s+)?(?:al\s+)?rival\s+(?:le\s+)?faltan\s+(.+?)(?:\s+de\s+puntos|\s+puntos|\s+para\s+cerrar|,|$)/.exec(
        texto
      ) ||
      /(?:cuando\s+)?(?:al\s+)?otro\s+(?:le\s+)?faltan\s+(.+?)(?:\s+de\s+puntos|\s+puntos|\s+para\s+cerrar|,|$)/.exec(
        texto
      );

    if (!mAlRival) return null;

    const cola = mAlRival[1];

    // Factor explícito: "la mitad", "el doble", etc.
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

    // Número explícito
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
  // "cuando al rival le faltan X puntos" (forma directa)
  // ----------------------------------------------------------
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
  // "en sets ganados" / "en sets perdidos" (FILTRO, no métrica)
  // ----------------------------------------------------------
  // Se marca `ignorarMetricaParser: true` para que `parserIntencion`
  // no confunda esto con la métrica `sets_ganados`.
  (texto) => {
    if (
      /en\s+sets?\s+ganados?/.test(texto) ||
      /en\s+los\s+sets\s+que\s+ganamos/.test(texto)
    ) {
      return {
        filtro: mayor(variable("setsPropios"), variable("setsRivales")),
        fragmentos: ["en sets ganados"],
        ignorarMetricaParser: true,
      };
    }
    if (
      /en\s+sets?\s+perdidos?/.test(texto) ||
      /en\s+los\s+sets\s+que\s+perdimos/.test(texto)
    ) {
      return {
        filtro: mayor(variable("setsRivales"), variable("setsPropios")),
        fragmentos: ["en sets perdidos"],
        ignorarMetricaParser: true,
      };
    }
    return null;
  },

  // ----------------------------------------------------------
  // "en partidos ganados" / "en partidos perdidos"
  // ----------------------------------------------------------
  (texto) => {
    if (/en\s+partidos?\s+ganados?/.test(texto)) {
      return {
        filtro: mayorIgual(variable("setsPropios"), numero(2)),
        fragmentos: ["en partidos ganados"],
        ignorarMetricaParser: true,
      };
    }
    if (/en\s+partidos?\s+perdidos?/.test(texto)) {
      return {
        filtro: mayorIgual(variable("setsRivales"), numero(2)),
        fragmentos: ["en partidos perdidos"],
        ignorarMetricaParser: true,
      };
    }
    return null;
  },

  // ----------------------------------------------------------
  // "en racha de N+" / "racha de N o mas"
  // ----------------------------------------------------------
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
  // CRUCES (orden de evaluación importa)
  // ----------------------------------------------------------
  // 1. "entre N y M cruces"
  // 2. "exactamente N cruces"
  // 3. "más de N cruces"      → > N (estricto)
  // 4. "menos de N cruces"    → < N (estricto)
  // 5. "hasta N cruces"       → <= N
  // 6. "N o más / al menos N" → >= N
  // 7. "N cruces" (suelto)    → == N
  // ----------------------------------------------------------
  (texto) => {
    const NUM =
      "(\\d{1,2}|un[oa]?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)";

    // 1. entre N y M
    const mEntre = new RegExp(
      `\\bentre\\s+${NUM}\\s+y\\s+${NUM}\\s+(?:cruces?|pelotazos?|intercambios?)`
    ).exec(texto);
    if (mEntre) {
      const n = parsearNumero(mEntre[1]);
      const m = parsearNumero(mEntre[2]);
      if (n !== null && m !== null && n <= m) {
        return {
          filtro: y(
            mayorIgual(variable("cruces"), numero(n)),
            menorIgual(variable("cruces"), numero(m))
          ),
          fragmentos: [`cruces entre ${n} y ${m}`],
        };
      }
    }

    // 2. exactamente N
    const mExacto = new RegExp(
      `\\bexactamente\\s+${NUM}\\s+(?:cruces?|pelotazos?|intercambios?)`
    ).exec(texto);
    if (mExacto) {
      const n = parsearNumero(mExacto[1]);
      if (n !== null) {
        return {
          filtro: igual(variable("cruces"), numero(n)),
          fragmentos: [`cruces ==${n}`],
        };
      }
    }

    // 3. "más de N" → > N (estricto)
    // OJO: matchear "más de" ANTES que "N o más" para no confundir.
    const mMasDe = new RegExp(
      `\\b(?:mas|más)\\s+de\\s+${NUM}\\s+(?:cruces?|pelotazos?|intercambios?)`
    ).exec(texto);
    if (mMasDe) {
      const n = parsearNumero(mMasDe[1]);
      if (n !== null) {
        return {
          filtro: mayor(variable("cruces"), numero(n)),
          fragmentos: [`cruces >${n}`],
        };
      }
    }

    // 4. "menos de N" → < N (estricto)
    const mMenosDe = new RegExp(
      `\\bmenos\\s+de\\s+${NUM}\\s+(?:cruces?|pelotazos?|intercambios?)`
    ).exec(texto);
    if (mMenosDe) {
      const n = parsearNumero(mMenosDe[1]);
      if (n !== null) {
        return {
          filtro: menorIgual(variable("cruces"), numero(Math.max(0, n - 1))),
          fragmentos: [`cruces <${n}`],
        };
      }
    }

    // 5. "hasta N" → <= N
    const mHasta = new RegExp(
      `\\bhasta\\s+${NUM}\\s+(?:cruces?|pelotazos?|intercambios?)`
    ).exec(texto);
    if (mHasta) {
      const n = parsearNumero(mHasta[1]);
      if (n !== null) {
        return {
          filtro: menorIgual(variable("cruces"), numero(n)),
          fragmentos: [`cruces <=${n}`],
        };
      }
    }

    // 6. "N o más" / "al menos N" → >= N
    const mNoMas = new RegExp(
      `\\b(?:al\\s+menos\\s+)?${NUM}\\s*(?:o\\s+(?:mas|más))?\\s+(?:cruces?|pelotazos?|intercambios?)`
    ).exec(texto);
    if (mNoMas) {
      const n = parsearNumero(mNoMas[1]);
      if (n !== null) {
        return {
          filtro: mayorIgual(variable("cruces"), numero(n)),
          fragmentos: [`cruces >=${n}`],
        };
      }
    }

    // 7. "rally corto" / "rally largo"
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
  // "cuando ganamos" / "cuando perdimos"
  // ----------------------------------------------------------
  (texto) => {
    if (
      /cuando\s+ganamos/.test(texto) ||
      /cuando\s+(?:ganamos|ganó)\s+el\s+punto/.test(texto) ||
      /puntos?\s+que\s+ganamos/.test(texto) ||
      /cuando\s+ganamos\s+el\s+rally/.test(texto)
    ) {
      return {
        filtro: igual(variable("ganoPropio"), numero(1)),
        fragmentos: ["cuando ganamos"],
      };
    }
    if (
      /cuando\s+perdimos/.test(texto) ||
      /cuando\s+(?:perdimos|perdió)\s+el\s+punto/.test(texto) ||
      /puntos?\s+que\s+perdimos/.test(texto) ||
      /cuando\s+perdimos\s+el\s+rally/.test(texto)
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
    ignorarMetricaParser: false,
    fragmentos: [],
    noReconocidas: [],
    error: null,
  };

  if (!texto) return res;

  // 1. Métrica (primero, para saber si la frase habla de una).
  const met = detectarMetrica(texto);
  if (met) {
    res.metrica = met.metrica;
    res.fragmentos.push(met.fragmento);
  }

  // 2. Compare-to-baseline EXPLÍCITO en el texto.
  const compareExplicito = detectarCompareToBaseline(texto);

  // 3. Filtros (reglas en orden).
  const filtros: Expr[] = [];
  let textoRestante = texto;
  let algunFiltroMarcaIgnorar = false;

  for (const regla of REGLAS) {
    const r = regla(textoRestante);
    if (!r) continue;
    filtros.push(r.filtro);
    if (r.ignorarMetricaParser) {
      algunFiltroMarcaIgnorar = true;
    }
    res.fragmentos.push(...r.fragmentos);
    for (const f of r.fragmentos) {
      const idx = textoRestante.indexOf(f);
      if (idx >= 0) {
        textoRestante =
          textoRestante.slice(0, idx) + textoRestante.slice(idx + f.length);
      }
    }
  }

  // 4. Componer filtros con AND.
  if (filtros.length === 1) {
    res.filtro = filtros[0];
  } else if (filtros.length > 1) {
    let acc = filtros[0];
    for (let i = 1; i < filtros.length; i++) {
      acc = y(acc, filtros[i]);
    }
    res.filtro = acc;
  }

  // 5. Auto-marcado de compare_to_baseline:
  //    - Si el texto dice "como varia" / "respecto a" → true.
  //    - Si hay filtro + métrica → true (auto).
  //    Esto resuelve "cuando X, cuántos Y" / "en racha de 3+, cómo
  //    varía Z" / "más de N cruces, cuántos W".
  if (compareExplicito) {
    res.compararConBaseline = true;
    res.fragmentos.push("compare_to_baseline");
  } else if (res.filtro !== null && res.metrica !== null) {
    res.compararConBaseline = true;
  }

  // 6. Si alguna regla marcó ignorarMetricaParser, respetarlo.
  if (algunFiltroMarcaIgnorar) {
    res.ignorarMetricaParser = true;
  }

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

  const tieneMetrica = METRICAS.some((m) =>
    m.patrones.some((p) => texto.includes(p))
  );
  const tieneCompare = detectarCompareToBaseline(texto);

  // Métrica + conector de comparación
  if (tieneMetrica && tieneCompare) return true;

  // "cuando" + alguna regla
  if (/\bcuando\b/.test(texto)) {
    for (const regla of REGLAS) {
      if (regla(texto)) return true;
    }
  }

  // "en sets ganados/perdidos"
  if (/en\s+sets?\s+(ganado|perdido)/.test(texto)) return true;

  // "racha de N"
  if (/racha\s+de\s+\d/.test(texto)) return true;

  // "más/menos/hasta/exactamente N cruces"
  if (/\b(?:mas|más|menos|hasta|exactamente|al\s+menos)\s+(?:\d+|un)/.test(texto) &&
      /(?:cruces?|pelotazos?|intercambios?)/.test(texto)) {
    return true;
  }

  // "N o más cruces"
  if (/\b\d+\s+o\s+(?:mas|más)\s+cruces?/.test(texto)) return true;

  // "en tie-break"
  if (/tie\s*-?\s*break/.test(texto)) return true;

  // "en side-out" / "en k2" / "en k3" / "en free-ball"
  if (/\ben\s+(?:side[\s-]?out|k1|k2|k3|free[\s-]?ball)\b/.test(texto)) {
    return true;
  }

  // Métrica + alguna regla (aunque no haya "cuando")
  if (tieneMetrica) {
    for (const regla of REGLAS) {
      if (regla(texto)) return true;
    }
  }

  return false;
}