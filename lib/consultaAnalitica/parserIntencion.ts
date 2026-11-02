// ============================================================
// PARSER DE INTENCIÓN — FASE 1
// ============================================================
// Convierte una frase en lenguaje natural en un IntencionQuery.
//
// v1.3 (FASE 7.5 — fixes de prioridad):
//   + El compilador (capa 4) corre ANTES que `extraerMetrica`
//     cuando `pareceCondicionCompleja` es true. Su métrica gana.
//   + Si el compilador marca `ignorarMetricaParser`, se descarta
//     la métrica detectada por `extraerMetrica` (fix "en sets
//     ganados" que daba `sets_ganados`).
//   + `expr` y `compararConBaseline` se propagan a `condicion`.
//   + Fix de "quiero ver como fueron X": si el texto empieza con
//     verbo de acción (quiero/mostrame/dame/listame/decime/
//     contame/muestrame/etc.) y hay `tipo: "trend"`, se degrada a
//     `count`. Así "quiero ver como fueron los ataques" no cae en
//     trend.
//   + `extraerMetrica` se ignora si el compilador ya decidió
//     `ignorarMetricaParser: true`.
//
// v1.2 (FASE 7.5 — AST compilado):
//   + Llama a `compilarCondicion()` cuando `pareceCondicionCompleja()`.
// ============================================================

import {
  DIAS_SEMANA,
  ORDEN_EVALUACION,
  SINONIMOS_CAMBIO,
  SINONIMOS_GROUPBY,
  SINONIMOS_METRICA,
  SINONIMOS_UBICACION,
  intencionVacia,
  type CondicionFiltro,
  type DiaSemana,
  type GroupBy,
  type IntencionQuery,
  type TiempoFiltro,
  type TiempoTipo,
} from "./intenciones";
import { SINONIMOS_FASE } from "./intenciones/fase";
import { SINONIMOS_SALIDA_ROL } from "./intenciones/salida";
import { extraerCrucesDeTexto } from "./intenciones/cruces";
import {
  compilarCondicion,
  pareceCondicionCompleja,
} from "./compiladorCondicion";

// ------------------------------------------------------------
// HELPERS INTERNOS
// ------------------------------------------------------------

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function ordenarPorLargoDesc(arr: string[]): string[] {
  return [...arr].sort((a, b) => b.length - a.length);
}

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

function palabraACalidad(palabra: string): number | null {
  const mapa: Record<string, number> = {
    horrible: 1, pesimo: 1, desastre: 1,
    malo: 2, impreciso: 2,
    flojo: 3, regular: 3, aceptable: 3,
    correcto: 4, bueno: 4,
    perfecto: 5, excelente: 5,
    genial: 6, impecable: 6, espectacular: 6,
  };
  return mapa[palabra] ?? null;
}

// ------------------------------------------------------------
// VERBOS DE ACCIÓN (fix "quiero ver como fueron X")
// ------------------------------------------------------------
// Si la frase empieza con un verbo así, el usuario QUIERE VER
// las acciones, no un análisis de tendencia. Forzamos count si
// el parser cae en `trend`.
// ------------------------------------------------------------

const VERBOS_ACCION = [
  "quiero ver",
  "quiero saber",
  "quiero listar",
  "quiero mostrar",
  "quiero conocer",
  "mostrame",
  "mostranos",
  "mostrame los",
  "mostrame las",
  "muestrame",
  "muestrame los",
  "muestrame las",
  "dame",
  "danos",
  "dame los",
  "dame las",
  "listame",
  "listame los",
  "listame las",
  "decime",
  "decime los",
  "decime las",
  "contame",
  "contame los",
  "contame las",
  "pasame",
  "pasame los",
  "pasame las",
  "mostrame como",
  "mostrame cuando",
  "mostrame donde",
  "decime como",
  "decime cuando",
  "contame como",
  "contame cuando",
];

function esVerboDeAccion(textoNorm: string): boolean {
  const t = textoNorm.trim();
  for (const v of VERBOS_ACCION) {
    if (t.startsWith(v)) return true;
  }
  return false;
}

// ------------------------------------------------------------
// 1) DETECCIÓN DE INTENCIÓN
// ------------------------------------------------------------

interface IntencionDetectada {
  tipo: IntencionQuery["tipo"];
  agregacion: IntencionQuery["agregacion"];
  fragmento: string;
}

function detectarIntencion(texto: string): IntencionDetectada | null {
  for (const entrada of ORDEN_EVALUACION) {
    const patrones = ordenarPorLargoDesc(entrada.sinonimos);
    for (const patron of patrones) {
      if (texto.includes(patron)) {
        return {
          tipo: entrada.tipo,
          agregacion: entrada.agregacion,
          fragmento: patron,
        };
      }
    }
  }
  return null;
}

// ------------------------------------------------------------
// 2) GROUP BY
// ------------------------------------------------------------

function extraerGroupBy(
  texto: string
): { groupBy: GroupBy; fragmento: string } | null {
  for (const entrada of SINONIMOS_GROUPBY) {
    const patrones = ordenarPorLargoDesc(entrada.patrones);
    for (const patron of patrones) {
      if (texto.includes(patron)) {
        return { groupBy: entrada.groupBy, fragmento: patron };
      }
    }
  }
  return null;
}

// ------------------------------------------------------------
// 3) MÉTRICA ESPECÍFICA
// ------------------------------------------------------------

function extraerMetrica(
  texto: string
): { metrica: string; fragmento: string } | null {
  for (const entrada of SINONIMOS_METRICA) {
    const patrones = ordenarPorLargoDesc(entrada.patrones);
    for (const patron of patrones) {
      if (texto.includes(patron)) {
        return { metrica: entrada.metrica, fragmento: patron };
      }
    }
  }
  return null;
}

// ------------------------------------------------------------
// 4) TIEMPO
// ------------------------------------------------------------

function extraerTiempo(
  texto: string
): { tiempo: TiempoFiltro; fragmentos: string[] } | null {
  const diaRe =
    /\b(?:el|los|un|alg[uú]n|este|ese)\s+(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/;
  const mDia = texto.match(diaRe);
  if (mDia) {
    const dia = mDia[1];
    if (DIAS_SEMANA.includes(dia as DiaSemana)) {
      return {
        tiempo: { tipo: "dia_semana", diaSemana: dia as DiaSemana },
        fragmentos: [mDia[0]],
      };
    }
  }

  const ultimosRe =
    /\b(?:los\s+|las\s+)?(?:ultimos|ultimas|ultimo|ultima|pasados|pasadas|pasado|pasada|recientes?|anteriores?)\s+(\d{1,2}|un[oa]?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(partidos?|sets?|jugadas?|puntos?|acciones?|juegos?)\b/;
  const mUlt = texto.match(ultimosRe);
  if (mUlt) {
    const n = parsearNumero(mUlt[1]) ?? 1;
    const unidad = mUlt[2].replace(/s$/, "");
    const tipo: TiempoTipo =
      unidad === "partido"
        ? "ultimos_n_partidos"
        : unidad === "set" || unidad === "juego"
        ? "ultimos_n_sets"
        : "ultimos_n_jugadas";
    return { tiempo: { tipo, n }, fragmentos: [mUlt[0]] };
  }

  const ultimoRe =
    /\b(?:el\s+|la\s+)?(ultimo|ultima)\s+(partido|set|juego|punto|semana|temporada)\b/;
  const mUlt2 = texto.match(ultimoRe);
  if (mUlt2) {
    const unidad = mUlt2[2];
    if (unidad === "partido") {
      return {
        tiempo: { tipo: "ultimos_n_partidos", n: 1 },
        fragmentos: [mUlt2[0]],
      };
    }
    if (unidad === "set" || unidad === "juego") {
      return {
        tiempo: { tipo: "ultimos_n_sets", n: 1 },
        fragmentos: [mUlt2[0]],
      };
    }
    if (unidad === "punto") {
      return {
        tiempo: { tipo: "punto_especifico" },
        fragmentos: [mUlt2[0]],
      };
    }
    if (unidad === "semana") {
      return {
        tiempo: { tipo: "esta_semana" },
        fragmentos: [mUlt2[0]],
      };
    }
    if (unidad === "temporada") {
      return {
        tiempo: { tipo: "temporada_pasada" },
        fragmentos: [mUlt2[0]],
      };
    }
  }

  const mapaTemporada: { patron: RegExp; tipo: TiempoTipo }[] = [
    { patron: /\besta\s+temporada\b/, tipo: "esta_temporada" },
    { patron: /\btemporada\s+actual\b/, tipo: "esta_temporada" },
    { patron: /\btemporada\s+en\s+curso\b/, tipo: "esta_temporada" },
    { patron: /\besta\s+semana\b/, tipo: "esta_semana" },
    { patron: /\bsemana\s+actual\b/, tipo: "esta_semana" },
    { patron: /\beste\s+mes\b/, tipo: "este_mes" },
    { patron: /\bmes\s+actual\b/, tipo: "este_mes" },
    { patron: /\beste\s+ano\b/, tipo: "este_ano" },
    { patron: /\beste\s+anio\b/, tipo: "este_ano" },
    { patron: /\bano\s+actual\b/, tipo: "este_ano" },
    { patron: /\btemporada\s+pasada\b/, tipo: "temporada_pasada" },
    { patron: /\btemporada\s+anterior\b/, tipo: "temporada_pasada" },
  ];
  for (const { patron, tipo } of mapaTemporada) {
    const m = texto.match(patron);
    if (m) return { tiempo: { tipo }, fragmentos: [m[0]] };
  }

  const setRe = /\b(?:en\s+el\s+)?set\s+(\d)\b/;
  const mSet = texto.match(setRe);
  if (mSet) {
    return {
      tiempo: { tipo: "set_especifico", set: parseInt(mSet[1], 10) },
      fragmentos: [mSet[0]],
    };
  }

  const puntoRe = /\b(?:en\s+el\s+)?punto\s+(\d{1,3})\b/;
  const mPunto = texto.match(puntoRe);
  if (mPunto) {
    return {
      tiempo: { tipo: "punto_especifico", punto: parseInt(mPunto[1], 10) },
      fragmentos: [mPunto[0]],
    };
  }

  const partidoRe = /\b(?:en\s+el\s+partido|en\s+el\s+encuentro)\b/;
  const mPartido = texto.match(partidoRe);
  if (mPartido) {
    return {
      tiempo: { tipo: "partido_especifico" },
      fragmentos: [mPartido[0]],
    };
  }

  return null;
}

// ------------------------------------------------------------
// 5) CONDICIÓN
// ------------------------------------------------------------

function extraerCondicion(
  texto: string
): { condicion: CondicionFiltro; fragmentos: string[] } | null {
  const cond: CondicionFiltro = {};
  const fragmentos: string[] = [];

  const marcadorRe = /(\d{1,2})\s*(?:-|a|al)\s*(\d{1,2})/;
  const mMarc = texto.match(marcadorRe);
  if (mMarc) {
    const a = parseInt(mMarc[1], 10);
    const b = parseInt(mMarc[2], 10);
    cond.marcador = `${a}-${b}`;
    fragmentos.push(mMarc[0]);
  }

  const difRe =
    /\b(?:por|de)\s+(un[oa]?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|\d{1,2})\s+puntos?\b/;
  const mDif = texto.match(difRe);
  if (mDif) {
    const n = parsearNumero(mDif[1]);
    if (n !== null) {
      cond.diferencia = n;
      fragmentos.push(mDif[0]);
    }
  }

  if (
    /\b(?:punto|puntos)\s+(?:critico|criticos)\b/.test(texto) ||
    /\b(?:match\s*point|punto\s+de\s+(?:partido|set))\b/.test(texto)
  ) {
    cond.puntoCritico = true;
    fragmentos.push("punto crítico");
  }

  const rachaRe =
    /\bracha\s+(?:de\s+)?(\d{1,2}|un[oa]?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b/;
  const mRacha = texto.match(rachaRe);
  if (mRacha) {
    const n = parsearNumero(mRacha[1]);
    if (n !== null) {
      cond.rachaMinima = n;
      fragmentos.push(mRacha[0]);
    }
  } else {
    const segRe =
      /\b(\d{1,2}|un[oa]?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(?:puntos?|errores?|aciertos?)\s+(?:seguidos?|consecutivos?)\b/;
    const mSeg = texto.match(segRe);
    if (mSeg) {
      const n = parsearNumero(mSeg[1]);
      if (n !== null) {
        cond.rachaMinima = n;
        fragmentos.push(mSeg[0]);
      }
    }
  }

  for (const entrada of SINONIMOS_FASE) {
    const patrones = ordenarPorLargoDesc(entrada.patrones);
    let match: string | null = null;
    for (const patron of patrones) {
      if (texto.includes(patron)) {
        match = patron;
        break;
      }
    }
    if (match) {
      cond.fase = entrada.fase;
      fragmentos.push(match);
      break;
    }
  }

  const toquesRe = /\bcon\s+(1|2|3|4)\s+toques?\b/;
  const mToques = texto.match(toquesRe);
  if (mToques) {
    cond.toquesMinimos = parseInt(mToques[1], 10);
    fragmentos.push(mToques[0]);
  }

  const calidadRe =
    /\b(?:con\s+)?(?:armado|calidad)\s+(?:de\s+)?(\d|malo|regular|flojo|bueno|correcto|excelente|perfecto|genial|horrible|pesimo|impreciso|aceptable|impecable|espectacular|desastre)\b/;
  const mCalidad = texto.match(calidadRe);
  if (mCalidad) {
    const val = mCalidad[1];
    const num = /^\d$/.test(val) ? parseInt(val, 10) : palabraACalidad(val);
    if (num !== null) {
      cond.calidadArmado = num;
      fragmentos.push(mCalidad[0]);
    }
  }

  if (
    /\b(?:despues|tras|luego)\s+de\s+(?:errar|un\s+error|errores|fallar|fallo)\b/.test(
      texto
    ) ||
    /\bcon\s+error\s+previo\b/.test(texto)
  ) {
    cond.conErrorPrevio = true;
    fragmentos.push("con error previo");
  }

  if (
    /\b(?:despues|tras|luego)\s+de\s+(?:un\s+punto|un\s+acierto|acertar|anotar|un\s+kill)\b/.test(
      texto
    ) ||
    /\bcon\s+acierto\s+previo\b/.test(texto)
  ) {
    cond.conAciertoPrevio = true;
    fragmentos.push("con acierto previo");
  }

  for (const { patrones, ubicacion } of SINONIMOS_UBICACION) {
    const ordenados = ordenarPorLargoDesc(patrones);
    let encontrado = false;
    for (const patron of ordenados) {
      if (texto.includes(patron)) {
        cond.ubicacion = ubicacion;
        fragmentos.push(patron);
        encontrado = true;
        break;
      }
    }
    if (encontrado) break;
  }

  const esPorZona = /\bpor\s+(?:zona|z)\s*[1-6]\b/.test(texto);
  if (!esPorZona) {
    const zonaRe = /\b(?:en\s+)?(?:zona|z)\s*([1-6])\b/;
    const mZona = texto.match(zonaRe);
    if (mZona) {
      cond.zonaJugador = [parseInt(mZona[1], 10)];
      fragmentos.push(mZona[0]);
    }
  }

  const cambioOrdenados = ordenarPorLargoDesc(SINONIMOS_CAMBIO);
  for (const patron of cambioOrdenados) {
    if (!texto.includes(patron)) continue;
    if (
      /despues|tras|luego/.test(patron) &&
      patron.includes("cambio")
    ) {
      cond.despuesDeCambio = true;
      cond.cambioEnPunto = true;
    } else if (patron.startsWith("sin ")) {
      cond.cambioEnPunto = false;
    } else {
      cond.cambioEnPunto = true;
    }
    fragmentos.push(patron);
    break;
  }

  for (const entrada of SINONIMOS_SALIDA_ROL) {
    const patrones = ordenarPorLargoDesc(entrada.patrones);
    let match: string | null = null;
    for (const patron of patrones) {
      if (texto.includes(patron)) {
        match = patron;
        break;
      }
    }
    if (match) {
      cond.salidaRol = entrada.rol;
      fragmentos.push(match);
      break;
    }
  }

  const cruces = extraerCrucesDeTexto(texto);
  if (cruces) {
    cond.crucesMinimos = cruces.crucesMinimos;
    fragmentos.push(cruces.fragmento);
  }

  if (Object.keys(cond).length === 0) return null;
  return { condicion: cond, fragmentos };
}

// ------------------------------------------------------------
// 6) COMPARACIÓN (X vs Y)
// ------------------------------------------------------------

function extraerComparacion(
  texto: string
): { a: string; b: string; fragmento: string } | null {
  const re = /\s+(?:vs\.?|versus|contra|frente\s+a)\s+/;
  const m = texto.match(re);
  if (!m || m.index === undefined) return null;
  const a = texto.slice(0, m.index).trim();
  const b = texto.slice(m.index + m[0].length).trim();
  if (!a || !b) return null;
  return { a, b, fragmento: `${a} vs ${b}` };
}

// ------------------------------------------------------------
// 7) ORDENAMIENTO
// ------------------------------------------------------------

function extraerOrdenamiento(
  texto: string
): "asc" | "desc" | null {
  if (
    /\b(?:de\s+)?mayor\s+a\s+menor\b/.test(texto) ||
    /\bde\s+mejor\s+a\s+peor\b/.test(texto) ||
    /\bdescendente\b/.test(texto) ||
    /\btop\s+\d+\b/.test(texto)
  ) {
    return "desc";
  }
  if (
    /\b(?:de\s+)?menor\s+a\s+mayor\b/.test(texto) ||
    /\bde\s+peor\s+a\s+mejor\b/.test(texto) ||
    /\bascendente\b/.test(texto)
  ) {
    return "asc";
  }
  return null;
}

// ------------------------------------------------------------
// 8) LÍMITE
// ------------------------------------------------------------

function extraerLimite(
  texto: string
): { valor: number; fragmento: string } | null {
  let m = texto.match(/\btop\s+(\d{1,2})\b/);
  if (m) return { valor: parseInt(m[1], 10), fragmento: m[0] };

  m = texto.match(
    /\b(?:los|las)\s+(\d{1,2})\s+(?:mejores|peores|primeros|ultimos)\b/
  );
  if (m) return { valor: parseInt(m[1], 10), fragmento: m[0] };

  m = texto.match(/\b(mejores|peores|primeros|ultimos)\s+(\d{1,2})\b/);
  if (m) return { valor: parseInt(m[2], 10), fragmento: m[0] };

  return null;
}

// ------------------------------------------------------------
// API PÚBLICA
// ------------------------------------------------------------

export function parsearIntencion(textoOriginal: string): IntencionQuery {
  const original = textoOriginal.trim();
  const resultado = intencionVacia();
  resultado.original = original;
  if (!original) return resultado;

  const texto = normalizar(original);

  // ============================================================
  // 0. COMPILADOR (capa 4) — corre PRIMERO si la frase es compleja
  // ============================================================
  // Esto garantiza que:
  //   - "en sets ganados" no se confunda con métrica `sets_ganados`.
  //   - "cuando X, cómo varía Y" produzca `expr` + baseline.
  //   - "en racha de 3+" produzca el filtro de racha.
  //   - "más de N cruces" produzca el filtro de cruces.
  //
  // El compilador puede decidir:
  //   - `filtro`: Expr del AST → va a `condicion.expr`.
  //   - `metrica`: MetricaDef → gana sobre `extraerMetrica`.
  //   - `compararConBaseline`: bool → va a `condicion.compararConBaseline`.
  //   - `ignorarMetricaParser`: bool → descartar `extraerMetrica`.
  //
  // Si la frase NO es compleja, no se llama al compilador y todo
  // sigue igual que v1.2.
  // ============================================================
  const compilado = pareceCondicionCompleja(texto)
    ? compilarCondicion(texto)
    : null;

  // --- GroupBy primero ---
  const gb = extraerGroupBy(texto);
  if (gb) {
    resultado.groupBy = gb.groupBy;
    resultado.fragmentos.push(gb.fragmento);
  }

  // --- Métrica del parser ---
  // Si el compilador dijo "ignorarMetricaParser", la descartamos.
  // Si el compilador tiene métrica propia, esa gana.
  let metricaFinal: string | null = null;
  if (compilado && compilado.metrica) {
    metricaFinal = compilado.metrica.nombre;
    resultado.fragmentos.push(...compilado.fragmentos);
  } else if (compilado && compilado.ignorarMetricaParser) {
    // No asignar métrica del parser.
    resultado.fragmentos.push(...compilado.fragmentos);
  } else {
    const met = extraerMetrica(texto);
    if (met) {
      metricaFinal = met.metrica;
      resultado.fragmentos.push(met.fragmento);
    }
  }
  resultado.metrica = metricaFinal;

  // --- Intención (count / percentage / average / etc.) ---
  const int = detectarIntencion(texto);
  if (int) {
    resultado.tipo = int.tipo;
    resultado.agregacion = int.agregacion;
    resultado.fragmentos.push(int.fragmento);
  }

  // ============================================================
  // FIX v1.3: "quiero ver como fueron X"
  // ============================================================
  // Si la frase empieza con un verbo de acción ("quiero ver",
  // "mostrame", etc.) y el parser cayó en `trend` por "como
  // fueron", degradamos a `count` porque el usuario quiere ver
  // las acciones, no la evolución.
  // ============================================================
  if (
    esVerboDeAccion(texto) &&
    resultado.tipo === "trend"
  ) {
    resultado.tipo = "count";
    resultado.agregacion = "count";
    // Sacar "trend" de los fragmentos para que no confunda al usuario.
    resultado.fragmentos = resultado.fragmentos.filter(
      (f) => f !== "como viene" && f !== "evolucion" && f !== "tendencia"
    );
  }

  // --- Comparación ---
  const comp = extraerComparacion(texto);
  if (comp) {
    resultado.comparacion = { a: comp.a, b: comp.b };
    if (resultado.tipo === "unknown") resultado.tipo = "comparison";
    resultado.fragmentos.push(comp.fragmento);
  }

  // --- Tiempo ---
  const tmp = extraerTiempo(texto);
  if (tmp) {
    resultado.tiempo = tmp.tiempo;
    resultado.fragmentos.push(...tmp.fragmentos);
  }

  // --- Condición (parser) ---
  const cond = extraerCondicion(texto);
  let condFinal: CondicionFiltro | null = cond ? cond.condicion : null;
  const fragmentosCond: string[] = cond ? [...cond.fragmentos] : [];

  // ============================================================
  // MERGE con el compilador (capa 4)
  // ============================================================
  if (compilado) {
    // 1. Filtro del compilador → `condicion.expr`.
    if (compilado.filtro) {
      if (!condFinal) condFinal = {};
      condFinal.expr = compilado.filtro;
      fragmentosCond.push("expr: " + compilado.fragmentos.join(" | "));
    }

    // 2. Comparación contra baseline.
    if (compilado.compararConBaseline) {
      if (!condFinal) condFinal = {};
      condFinal.compararConBaseline = true;
    }

    // 3. Métrica del compilador (si ya la asignamos arriba, no
    //    hace falta repetir).
    // 4. Ignorar métrica del parser ya se resolvió arriba.
  }

  if (condFinal && Object.keys(condFinal).length > 0) {
    resultado.condicion = condFinal;
    resultado.fragmentos.push(...fragmentosCond);
  }

  // --- Ordenamiento ---
  const ord = extraerOrdenamiento(texto);
  if (ord) {
    resultado.ordenamiento = ord;
    resultado.fragmentos.push(
      ord === "asc" ? "de menor a mayor" : "de mayor a menor"
    );
  }

  // --- Límite ---
  const lim = extraerLimite(texto);
  if (lim) {
    resultado.limite = lim.valor;
    resultado.fragmentos.push(lim.fragmento);
  }

  return resultado;
}