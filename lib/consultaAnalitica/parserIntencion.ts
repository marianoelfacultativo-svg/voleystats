// ============================================================
// PARSER DE INTENCIÓN — FASE 1
// ============================================================
// Convierte una frase en lenguaje natural ("¿cuántos ataques erró
// Juan en los últimos 3 partidos?") en un IntencionQuery tipado
// (tipo, agregación, groupBy, métrica, tiempo, condición, etc.).
//
// NO resuelve el QUÉ (eso lo hace FASE 2 con el filtro extendido)
// ni el CÓMO (eso lo hace FASE 3 con el motor de cálculo).
// Solo detecta la INTENCIÓN de la consulta.
//
// Reutiliza:
//   - ORDEN_EVALUACION      (qué tipo gana)
//   - SINONIMOS_GROUPBY     (por X)
//   - SINONIMOS_METRICA     (kill %, sideout %, etc.)
//   - SINONIMOS_ULTIMOS, SINONIMOS_TEMPORADA, DIAS_SEMANA
//   - SINONIMOS_UBICACION   (delantero / zaguero / líbero)
//   - SINONIMOS_CAMBIO      (cambio / cambios / después de cambio)
//   - SINONIMOS_CONDICION   (conectores de condición, informativos)
//
// API pública:
//   parsearIntencion(texto: string): IntencionQuery
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

/**
 * Convierte "1", "un", "dos", "tres"… en un número.
 * Devuelve null si no es parseable.
 */
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

/** "malo" → 2, "perfecto" → 5, "genial" → 6, etc. */
function palabraACalidad(palabra: string): number | null {
  const mapa: Record<string, number> = {
    horrible: 1,
    pesimo: 1,
    desastre: 1,
    malo: 2,
    impreciso: 2,
    flojo: 3,
    regular: 3,
    aceptable: 3,
    correcto: 4,
    bueno: 4,
    perfecto: 5,
    excelente: 5,
    genial: 6,
    impecable: 6,
    espectacular: 6,
  };
  return mapa[palabra] ?? null;
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
  // --- Día de la semana ("el lunes", "los sábados", "un martes") ---
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

  // --- Últimos N partidos / sets / jugadas ---
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

  // --- Último partido / set / punto (sin número) ---
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

  // --- Esta temporada / semana / mes / año ---
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

  // --- Set específico ("en el set 3", "set 2") ---
  const setRe = /\b(?:en\s+el\s+)?set\s+(\d)\b/;
  const mSet = texto.match(setRe);
  if (mSet) {
    return {
      tiempo: { tipo: "set_especifico", set: parseInt(mSet[1], 10) },
      fragmentos: [mSet[0]],
    };
  }

  // --- Punto específico ("en el punto 5", "punto 12") ---
  const puntoRe = /\b(?:en\s+el\s+)?punto\s+(\d{1,3})\b/;
  const mPunto = texto.match(puntoRe);
  if (mPunto) {
    return {
      tiempo: { tipo: "punto_especifico", punto: parseInt(mPunto[1], 10) },
      fragmentos: [mPunto[0]],
    };
  }

  // --- Partido específico (sin resolver el rival todavía) ---
  // El motor de FASE 2 resuelve el rival con contexto.partidos.
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

  // --- Marcador exacto: "20-18", "20 a 18", "20 al 18" ---
  const marcadorRe = /(\d{1,2})\s*(?:-|a|al)\s*(\d{1,2})/;
  const mMarc = texto.match(marcadorRe);
  if (mMarc) {
    const a = parseInt(mMarc[1], 10);
    const b = parseInt(mMarc[2], 10);
    // Filtramos falsos positivos muy bajos (ej "1 a 1" es ambiguo)
    // pero igual los dejamos como marcador; el motor decide.
    cond.marcador = `${a}-${b}`;
    fragmentos.push(mMarc[0]);
  }

  // --- Diferencia de marcador: "por 2 puntos", "de 3 puntos" ---
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

  // --- Punto crítico ---
  if (
    /\b(?:punto|puntos)\s+(?:critico|criticos)\b/.test(texto) ||
    /\b(?:match\s*point|punto\s+de\s+(?:partido|set))\b/.test(texto)
  ) {
    cond.puntoCritico = true;
    fragmentos.push("punto crítico");
  }

  // --- Racha mínima: "racha de 3", "3 puntos seguidos" ---
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

  // --- Fase del rally ---
  const fases: { patron: RegExp; fase: string }[] = [
    { patron: /\b(?:side[-\s]?out|k1)\b/, fase: "side-out" },
    { patron: /\bk\s*2\b/, fase: "k2" },
    { patron: /\bk\s*3\b/, fase: "k3" },
    { patron: /\b(?:free[-\s]?ball|freeball)\b/, fase: "free-ball" },
    { patron: /\bcontraataque\b/, fase: "contraataque" },
  ];
  for (const { patron, fase } of fases) {
    const m = texto.match(patron);
    if (m) {
      cond.fase = fase;
      fragmentos.push(m[0]);
      break;
    }
  }

  // --- Toques mínimos del equipo ---
  const toquesRe = /\bcon\s+(1|2|3|4)\s+toques?\b/;
  const mToques = texto.match(toquesRe);
  if (mToques) {
    cond.toquesMinimos = parseInt(mToques[1], 10);
    fragmentos.push(mToques[0]);
  }

  // --- Calidad de armado previo ---
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

  // --- Error previo ---
  if (
    /\b(?:despues|tras|luego)\s+de\s+(?:errar|un\s+error|errores|fallar|fallo)\b/.test(
      texto
    ) ||
    /\bcon\s+error\s+previo\b/.test(texto)
  ) {
    cond.conErrorPrevio = true;
    fragmentos.push("con error previo");
  }

  // --- Acierto previo ---
  if (
    /\b(?:despues|tras|luego)\s+de\s+(?:un\s+punto|un\s+acierto|acertar|anotar|un\s+kill)\b/.test(
      texto
    ) ||
    /\bcon\s+acierto\s+previo\b/.test(texto)
  ) {
    cond.conAciertoPrevio = true;
    fragmentos.push("con acierto previo");
  }

  // --- Ubicación (delantero / zaguero / líbero) ---
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

  // --- Zona del jugador (solo si NO es un "por zona") ---
  // "en zona 4", "en Z4" → filtro.
  // "por zona 4" → es groupBy, no filtro.
  const esPorZona = /\bpor\s+(?:zona|z)\s*[1-6]\b/.test(texto);
  if (!esPorZona) {
    const zonaRe = /\b(?:en\s+)?(?:zona|z)\s*([1-6])\b/;
    const mZona = texto.match(zonaRe);
    if (mZona) {
      cond.zonaJugador = [parseInt(mZona[1], 10)];
      fragmentos.push(mZona[0]);
    }
  }

  // --- Cambio de jugador ---
  // Buscamos el patrón más largo primero para no quedar con "cambio"
  // cuando en realidad era "después de un cambio".
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
// 8) LÍMITE (top N, los N mejores, etc.)
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

/**
 * Parsea una frase en lenguaje natural y devuelve un IntencionQuery
 * listo para que el motor de FASE 3 lo ejecute.
 *
 * Ejemplos:
 *   "¿cuántos ataques erró Juan en los últimos 3 partidos?"
 *     → { tipo: "count", agregacion: "count",
 *         tiempo: { tipo: "ultimos_n_partidos", n: 3 }, ... }
 *
 *   "porcentaje de recepciones perfectas por set esta temporada"
 *     → { tipo: "percentage", agregacion: "percentage",
 *         groupBy: "set", tiempo: { tipo: "esta_temporada" }, ... }
 *
 *   "¿cuántos puntos por rotación cuando está 20-18?"
 *     → { tipo: "count", groupBy: "rotacion",
 *         condicion: { marcador: "20-18" }, ... }
 *
 *   "evolución de puntos por set de los delanteros tras un cambio"
 *     → { tipo: "trend", agregacion: "avg", groupBy: "set",
 *         condicion: { ubicacion: "delantero",
 *                      despuesDeCambio: true,
 *                      cambioEnPunto: true }, ... }
 */
export function parsearIntencion(textoOriginal: string): IntencionQuery {
  const original = textoOriginal.trim();
  const resultado = intencionVacia();
  resultado.original = original;
  if (!original) return resultado;

  const texto = normalizar(original);

  // --- GroupBy primero (antes que intención, para no perder "por X") ---
  const gb = extraerGroupBy(texto);
  if (gb) {
    resultado.groupBy = gb.groupBy;
    resultado.fragmentos.push(gb.fragmento);
  }

  // --- Métrica específica (ej "kill %", "sideout %", "puntos por set") ---
  const met = extraerMetrica(texto);
  if (met) {
    resultado.metrica = met.metrica;
    resultado.fragmentos.push(met.fragmento);
  }

  // --- Intención (count / percentage / average / etc.) ---
  const int = detectarIntencion(texto);
  if (int) {
    resultado.tipo = int.tipo;
    resultado.agregacion = int.agregacion;
    resultado.fragmentos.push(int.fragmento);
  }

  // --- Comparación (solo si hay vs/versus/contra/frente a) ---
  const comp = extraerComparacion(texto);
  if (comp) {
    resultado.comparacion = { a: comp.a, b: comp.b };
    if (resultado.tipo === "unknown") resultado.tipo = "comparison";
    resultado.fragmentos.push(comp.fragmento);
  }

  // --- Tiempo (días, últimos N, set N, etc.) ---
  const tmp = extraerTiempo(texto);
  if (tmp) {
    resultado.tiempo = tmp.tiempo;
    resultado.fragmentos.push(...tmp.fragmentos);
  }

  // --- Condición (marcador, racha, ubicación, cambio, etc.) ---
  const cond = extraerCondicion(texto);
  if (cond) {
    resultado.condicion = cond.condicion;
    resultado.fragmentos.push(...cond.fragmentos);
  }

  // --- Ordenamiento (de mayor a menor / ascendente / top N) ---
  const ord = extraerOrdenamiento(texto);
  if (ord) {
    resultado.ordenamiento = ord;
    resultado.fragmentos.push(
      ord === "asc" ? "de menor a mayor" : "de mayor a menor"
    );
  }

  // --- Límite (top 5, los 3 mejores, etc.) ---
  const lim = extraerLimite(texto);
  if (lim) {
    resultado.limite = lim.valor;
    resultado.fragmentos.push(lim.fragmento);
  }

  return resultado;
}