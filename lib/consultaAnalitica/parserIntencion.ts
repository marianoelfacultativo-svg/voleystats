// ============================================================
// PARSER DE INTENCIÓN — FASE 1
// ============================================================
// Convierte una frase en lenguaje natural en un IntencionQuery.
//
// v1.4 (FASE 7.5 — paso 9/10):
//   + B8:  `extraerCondicion` NO matchea "cuando ganamos" ni
//          "cuando perdimos". Lo deja al compilador (que ya lo
//          hacía vía regla y produce `expr`). Antes el parser
//          duplicaba el filtro.
//   + B10: `extraerTiempo` ya NO corta en el primer match. Recolecta
//          TODO (día, últimos_n_X, temporada, set N, punto N,
//          partido) y los combina. Antes "el set 3 del último
//          mes" descartaba uno.
//   + B15: idem B10 para "aceptar set 3 + últimos 5 partidos" en
//          el mismo `TiempoFiltro` sin perder ninguno.
//   + B16: "cuántos puntos" (sin "ganó", "perdió", "hizo", "%",
//          "promedio", "por") → se infiere `metrica = "puntos_ganados"`.
//          Antes caía en `count` de acciones (~5x el valor real).
//   + B21: `extraerComparacion` rechaza "vs RIVAL" cuando el texto
//          contiene un verbo de consulta a la izquierda
//          ("cuántos X vs Boca", "dig efficiency en el partido vs
//          Boca"). Solo cuenta como comparación si ambos lados
//          parecen entidades comparables.
//   + B23: `extraerComparacion` acepta "entre X y Y" (X, Y no
//          numéricos).
//   + B24: `extraerComparacion` acepta "quién/quiénes es/son
//          mejor(es)/peor(es), X o Y" y "cuál es mejor, X o Y".
//   + B27: `extraerComparacion` acepta "comparar X con Y" y
//          "comparar a X con Y".
//
// v1.3:
//   + Compilador corre primero. Su métrica gana.
//   + Si el compilador marca `ignorarMetricaParser`, se descarta
//     `extraerMetrica`.
//   + Fix de "quiero ver como fueron X": degrada trend a count.
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

const VERBOS_ACCION = [
  "quiero ver", "quiero saber", "quiero listar", "quiero mostrar",
  "quiero conocer", "mostrame", "mostranos", "mostrame los",
  "mostrame las", "muestrame", "muestrame los", "muestrame las",
  "dame", "danos", "dame los", "dame las", "listame",
  "listame los", "listame las", "decime", "decime los",
  "decime las", "contame", "contame los", "contame las",
  "pasame", "pasame los", "pasame las", "mostrame como",
  "mostrame cuando", "mostrame donde", "decime como",
  "decime cuando", "contame como", "contame cuando",
];

function esVerboDeAccion(textoNorm: string): boolean {
  const t = textoNorm.trim();
  for (const v of VERBOS_ACCION) if (t.startsWith(v)) return true;
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
// 3) MÉTRICA ESPECÍFICA + B16
// ------------------------------------------------------------
// Primero busca en SINONIMOS_METRICA (más específico).
// Si no encuentra nada y el texto dice "cuántos puntos" sin
// contexto de %, promedio, "por set", etc., infiere
// `puntos_ganados`.
// ------------------------------------------------------------

function inferirPuntosGanados(texto: string): boolean {
  if (!/cuant[oa]s?\s+puntos?\b/.test(texto)) return false;
  if (/\bpuntos?\s+por\b/.test(texto)) return false;
  if (/\bporcentaje\b/.test(texto)) return false;
  if (/%/.test(texto)) return false;
  if (/\bpromedio\b/.test(texto)) return false;
  if (/\btasa\b/.test(texto)) return false;
  return true;
}

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
  // B16: fallback "cuántos puntos"
  if (inferirPuntosGanados(texto)) {
    return { metrica: "puntos_ganados", fragmento: "cuántos puntos" };
  }
  return null;
}

// ------------------------------------------------------------
// 4) TIEMPO — B10, B15
// ------------------------------------------------------------
// Combina MÚLTIPLES time filters. Antes cortaba en el primero.
//
// Prioridad si hay varios:
//   - Si hay `ultimos_n_X` y `set_especifico`, devuelve el tipo
//     dominante pero guarda el `set` como campo extra.
//   - Si hay `ultimos_n_X` y `ultimos_n_Y`, combina con el más
//     específico (sets dentro de partidos).
//   - Si hay `dia_semana` + otro, combina el día con el resto.
// ------------------------------------------------------------

interface TiempoExtraido {
  tiempo: TiempoFiltro;
  fragmentos: string[];
}

function extraerTiempo(texto: string): TiempoExtraido | null {
  const fragmentos: string[] = [];
  let tiempoBase: TiempoFiltro | null = null;

  // -- Día de la semana --
  const diaRe =
    /\b(?:el|los|un|alg[uú]n|este|ese|del)\s+(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/;
  const mDia = texto.match(diaRe);
  if (mDia && DIAS_SEMANA.includes(mDia[1] as DiaSemana)) {
    tiempoBase = {
      tipo: "dia_semana",
      diaSemana: mDia[1] as DiaSemana,
    };
    fragmentos.push(mDia[0]);
  }

  // -- Últimos N X --
  const ultimosRe =
    /\b(?:los\s+|las\s+)?(?:ultimos|ultimas|ultimo|ultima|pasados|pasadas|pasado|pasada|recientes?|anteriores?)\s+(\d{1,2}|un[oa]?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(partidos?|sets?|jugadas?|puntos?|acciones?|juegos?|meses?|mes|semanas?|semana|anos?|ano|anios?|anio)\b/;
  const mUlt = texto.match(ultimosRe);
  if (mUlt) {
    const n = parsearNumero(mUlt[1]) ?? 1;
    const unidad = mUlt[2].replace(/s$/, "");
    let tipo: TiempoTipo;
    if (unidad === "partido") tipo = "ultimos_n_partidos";
    else if (unidad === "set" || unidad === "juego") tipo = "ultimos_n_sets";
    else if (unidad === "mes" || unidad === "semana" || unidad === "ano" || unidad === "anio")
      tipo = "este_mes"; // aproximación
    else tipo = "ultimos_n_jugadas";

    if (!tiempoBase) tiempoBase = { tipo, n };
    fragmentos.push(mUlt[0]);
  }

  // -- Último / última X --
  if (!tiempoBase) {
    const ultimoRe =
      /\b(?:el\s+|la\s+)?(ultimo|ultima)\s+(partido|set|juego|punto|semana|mes|temporada|ano|anio|torneo)\b/;
    const mUlt2 = texto.match(ultimoRe);
    if (mUlt2) {
      const unidad = mUlt2[2];
      if (unidad === "partido") tiempoBase = { tipo: "ultimos_n_partidos", n: 1 };
      else if (unidad === "set" || unidad === "juego") tiempoBase = { tipo: "ultimos_n_sets", n: 1 };
      else if (unidad === "punto") tiempoBase = { tipo: "punto_especifico" };
      else if (unidad === "semana") tiempoBase = { tipo: "esta_semana" };
      else if (unidad === "mes") tiempoBase = { tipo: "este_mes" };
      else if (unidad === "ano" || unidad === "anio") tiempoBase = { tipo: "este_ano" };
      else if (unidad === "temporada") tiempoBase = { tipo: "temporada_pasada" };
      else if (unidad === "torneo") tiempoBase = { tipo: "esta_temporada" };
      if (tiempoBase) fragmentos.push(mUlt2[0]);
    }
  }

  // -- Temporada actual / pasada --
  if (!tiempoBase) {
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
      { patron: /\bano\s+pasado\b/, tipo: "temporada_pasada" },
      { patron: /\banio\s+pasado\b/, tipo: "temporada_pasada" },
      { patron: /\btemporada\s+pasada\b/, tipo: "temporada_pasada" },
      { patron: /\btemporada\s+anterior\b/, tipo: "temporada_pasada" },
    ];
    for (const { patron, tipo } of mapaTemporada) {
      const m = texto.match(patron);
      if (m) {
        tiempoBase = { tipo };
        fragmentos.push(m[0]);
        break;
      }
    }
  }

  // -- Set específico (SIEMPRE agrega el campo `set` aunque haya otro) --
  const setRe = /\b(?:en\s+el\s+|del\s+|el\s+)?set\s+(\d)\b/;
  const mSet = texto.match(setRe);
  if (mSet) {
    const setNum = parseInt(mSet[1], 10);
    if (tiempoBase) {
      if (tiempoBase.tipo === "ultimos_n_partidos" || tiempoBase.tipo === "ultimos_n_sets") {
        tiempoBase = { ...tiempoBase, set: setNum };
      } else if (tiempoBase.tipo === "esta_temporada" || tiempoBase.tipo === "esta_semana" || tiempoBase.tipo === "este_mes" || tiempoBase.tipo === "este_ano") {
        // Preferimos el set específico sobre el rango amplio
        tiempoBase = { tipo: "set_especifico", set: setNum };
      }
    } else {
      tiempoBase = { tipo: "set_especifico", set: setNum };
    }
    fragmentos.push(mSet[0]);
  }

  // -- Punto específico --
  if (!tiempoBase) {
    const puntoRe = /\b(?:en\s+el\s+|del\s+)?punto\s+(\d{1,3})\b/;
    const mPunto = texto.match(puntoRe);
    if (mPunto) {
      tiempoBase = {
        tipo: "punto_especifico",
        punto: parseInt(mPunto[1], 10),
      };
      fragmentos.push(mPunto[0]);
    }
  }

  // -- "en el partido" / "en el encuentro" (partido específico) --
  if (!tiempoBase) {
    const partidoRe = /\b(?:en\s+el\s+partido|en\s+el\s+encuentro)\b/;
    const mPartido = texto.match(partidoRe);
    if (mPartido) {
      tiempoBase = { tipo: "partido_especifico" };
      fragmentos.push(mPartido[0]);
    }
  }

  if (!tiempoBase) return null;
  return { tiempo: tiempoBase, fragmentos };
}

// ------------------------------------------------------------
// 5) CONDICIÓN — B8
// ------------------------------------------------------------
// B8: NO matchear "cuando ganamos/perdimos" acá.
// El compilador ya produce `expr` para "cuando ganamos". Antes
// el parser duplicaba el filtro con `ganamos: bool` en
// `CondicionFiltro`, generando conflictos.
// ------------------------------------------------------------

function extraerCondicion(
  texto: string
): { condicion: CondicionFiltro; fragmentos: string[] } | null {
  const cond: CondicionFiltro = {};
  const fragmentos: string[] = [];

  const marcadorRe = /(\d{1,2})\s*(?:-|a|al)\s*(\d{1,2})/;
  const mMarc = texto.match(marcadorRe);
  if (mMarc) {
    cond.marcador = `${parseInt(mMarc[1], 10)}-${parseInt(mMarc[2], 10)}`;
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
    /\b(?:despues|tras|luego)\s+de\s+(?:errar|un\s+error|errores|fallar|fallo)\b/.test(texto) ||
    /\bcon\s+error\s+previo\b/.test(texto)
  ) {
    cond.conErrorPrevio = true;
    fragmentos.push("con error previo");
  }

  if (
    /\b(?:despues|tras|luego)\s+de\s+(?:un\s+punto|un\s+acierto|acertar|anotar|un\s+kill)\b/.test(texto) ||
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
    if (/despues|tras|luego/.test(patron) && patron.includes("cambio")) {
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
// 6) COMPARACIÓN — B21, B23, B24, B27
// ------------------------------------------------------------
// 5 formas soportadas:
//   a) X vs / versus / contra / frente a Y  (con guard B21)
//   b) entre X y Y                          (B23)
//   c) comparar X con Y / comparar a X con Y (B27)
//   d) quién es mejor, X o Y / cuál es mejor, X o Y (B24)
//   e) X es mejor/peor que Y
// ------------------------------------------------------------

// Verbos de consulta que NO deben confundirse con comparación.
const VERBOS_CONSULTA =
  /\b(cuant[oa]s?|porcentaje|promedio|media|tasa|distribucion|evolucion|tendencia|ranking|top|frecuencia|cada\s+cuanto|mejor|peor|maximo|minimo|total)\b/;

// Conector de comparación suelto "vs X" seguido de una entidad
// (nombre, equipo). Solo es comparación si el lado izq. NO es
// una consulta.
function pareceConsultaNoComparacion(a: string): boolean {
  return VERBOS_CONSULTA.test(a);
}

function extraerComparacion(
  texto: string
): { a: string; b: string; fragmento: string } | null {
  // (a) X vs Y — con guard B21
  const reVs = /\s+(?:vs\.?|versus|contra|frente\s+a)\s+/;
  const mVs = texto.match(reVs);
  if (mVs && mVs.index !== undefined) {
    const a = texto.slice(0, mVs.index).trim();
    const b = texto.slice(mVs.index + mVs[0].length).trim();
    // B21: si `a` es una consulta (cuántos/porcentaje/promedio), NO
    // es comparación. Es filtro de rival.
    if (a && b && !pareceConsultaNoComparacion(a)) {
      return { a, b, fragmento: `${a} vs ${b}` };
    }
  }

  // (b) entre X y Y — B23 (solo si X, Y no son números)
  const reEntre = /\bentre\s+([A-Za-zÁÉÍÓÚáéíóúñÑ][^,]*?)\s+y\s+([A-Za-zÁÉÍÓÚáéíóúñÑ][^,]*?)(?:$|[.,;?])/;
  const mEntre = texto.match(reEntre);
  if (mEntre) {
    const a = mEntre[1].trim();
    const b = mEntre[2].trim();
    if (a && b && !/^\d/.test(a) && !/^\d/.test(b)) {
      return { a, b, fragmento: `entre ${a} y ${b}` };
    }
  }

  // (c) comparar X con Y — B27
  const reComparar =
    /\bcompar(?:ar|ando|a|e|en|emos)\s+(?:a\s+|al\s+|la\s+|el\s+)?(.+?)\s+con\s+(.+?)(?:$|[.,;?]|\s+en\s+|\s+por\s+)/;
  const mComparar = texto.match(reComparar);
  if (mComparar) {
    const a = mComparar[1].trim();
    const b = mComparar[2].trim();
    if (a && b) {
      return { a, b, fragmento: `comparar ${a} con ${b}` };
    }
  }

  // (d) quién/quiénes es/son mejor(es)/peor(es), X o Y — B24
  const reQuienMejor =
    /\b(?:quien|quienes|cu[aá]l|cu[aá]les)\s+(?:es|son)\s+(?:mejor|peor)(?:es)?,?\s+(.+?)\s+o\s+(.+?)(?:$|[.,;?])/;
  const mQuienMejor = texto.match(reQuienMejor);
  if (mQuienMejor) {
    const a = mQuienMejor[1].trim();
    const b = mQuienMejor[2].trim();
    if (a && b) {
      return { a, b, fragmento: `${a} o ${b}` };
    }
  }

  // (e) X es mejor/peor que Y
  const reEsMejor =
    /(.+?)\s+(?:es|fue|resulta)\s+(?:mejor|peor)\s+que\s+(.+?)(?:$|[.,;?])/;
  const mEsMejor = texto.match(reEsMejor);
  if (mEsMejor) {
    const a = mEsMejor[1].trim();
    const b = mEsMejor[2].trim();
    if (a && b) {
      return { a, b, fragmento: `${a} mejor/peor que ${b}` };
    }
  }

  return null;
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

  // 0. COMPILADOR (capa 4) corre PRIMERO si la frase es compleja.
  const compilado = pareceCondicionCompleja(texto)
    ? compilarCondicion(texto)
    : null;

  // --- GroupBy primero ---
  const gb = extraerGroupBy(texto);
  if (gb) {
    resultado.groupBy = gb.groupBy;
    resultado.fragmentos.push(gb.fragmento);
  }

  // --- Métrica del parser (con B16) ---
  let metricaFinal: string | null = null;
  if (compilado && compilado.metrica) {
    metricaFinal = compilado.metrica.nombre;
    resultado.fragmentos.push(...compilado.fragmentos);
  } else if (compilado && compilado.ignorarMetricaParser) {
    resultado.fragmentos.push(...compilado.fragmentos);
  } else {
    const met = extraerMetrica(texto);
    if (met) {
      metricaFinal = met.metrica;
      resultado.fragmentos.push(met.fragmento);
    }
  }
  resultado.metrica = metricaFinal;

  // --- Intención ---
  const int = detectarIntencion(texto);
  if (int) {
    resultado.tipo = int.tipo;
    resultado.agregacion = int.agregacion;
    resultado.fragmentos.push(int.fragmento);
  }

  // FIX v1.3: "quiero ver como fueron X" → degrada trend a count
  if (esVerboDeAccion(texto) && resultado.tipo === "trend") {
    resultado.tipo = "count";
    resultado.agregacion = "count";
    resultado.fragmentos = resultado.fragmentos.filter(
      (f) => f !== "como viene" && f !== "evolucion" && f !== "tendencia"
    );
  }

  // --- Comparación (con B21, B23, B24, B27) ---
  const comp = extraerComparacion(texto);
  if (comp) {
    resultado.comparacion = { a: comp.a, b: comp.b };
    if (resultado.tipo === "unknown") resultado.tipo = "comparison";
    resultado.fragmentos.push(comp.fragmento);
  }

  // --- Tiempo (con B10, B15) ---
  const tmp = extraerTiempo(texto);
  if (tmp) {
    resultado.tiempo = tmp.tiempo;
    resultado.fragmentos.push(...tmp.fragmentos);
  }

  // --- Condición (con B8: NO matchea "cuando ganamos/perdimos") ---
  const cond = extraerCondicion(texto);
  let condFinal: CondicionFiltro | null = cond ? cond.condicion : null;
  const fragmentosCond: string[] = cond ? [...cond.fragmentos] : [];

  // --- MERGE con el compilador (capa 4) ---
  if (compilado) {
    if (compilado.filtro) {
      if (!condFinal) condFinal = {};
      condFinal.expr = compilado.filtro;
      fragmentosCond.push("expr: " + compilado.fragmentos.join(" | "));
    }
    if (compilado.compararConBaseline) {
      if (!condFinal) condFinal = {};
      condFinal.compararConBaseline = true;
    }
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