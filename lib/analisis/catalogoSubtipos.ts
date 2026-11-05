// ============================================================
// CATÁLOGO DE SUBTIPOS — fuente única de verdad
// ============================================================
// Jerarquía: Resultado (punto/error/neutro) → Fundamento → Subtipo.
//
// `categoria` = clasificación del rally (¿cerró el punto? ¿para quién?).
// `desenlace` = rama semántica del pipeline (punto/error/en_juego).
// `valoracion` = calidad visual (pos/neu/neg).
// `puntaje`   = escala -2..10 (misma que BASE_SCORES de estadisticas.ts).
//
// v2.1: `categoria` ahora se DERIVA de `desenlace` en `infoDeSubtipo()`
// para que nunca se desincronice. Los valores `categoria` del CATALOGO
// quedan solo como documentación; el valor real lo impone
// `categoriaDe(desenlace)`.
//
// Los consumidores DEBEN leer de acá:
//   - lib/analisis/clasificacion.ts      → clasificarResultado, puntajeDeAccion
//   - lib/estadisticas.ts                → puntajeBase, BASE_SCORES, VALORES_*
//   - lib/consultaAnalitica/metricasVoley.ts → killPct, attackEfficiency, accionesPunto
//   - lib/partidos/helpers.ts            → promedios de recepción
//   - app/equipo/MiEquipo.tsx            → calcularBarrasPorFundamento
// ============================================================

export type CategoriaResultado = "punto" | "error" | "neutro";

export type Desenlace = "punto" | "error" | "en_juego";
export type Valoracion = "pos" | "neu" | "neg";

export type Fundamento =
  | "saque"
  | "recepcion"
  | "ataque"
  | "bloqueo"
  | "defensa"
  | "armados"
  | "toque";

export interface SubtipoInfo {
  categoria: CategoriaResultado;
  desenlace: Desenlace;
  valoracion: Valoracion;
  puntaje: number;
}

type MapaSubtipos = Record<string, SubtipoInfo>;

export const CATALOGO: Record<Fundamento, MapaSubtipos> = {
  saque: {
    ace:           { categoria: "punto",  desenlace: "punto",    valoracion: "pos", puntaje: 10 },
    positivo_mas:  { categoria: "neutro", desenlace: "en_juego", valoracion: "pos", puntaje: 8 },
    positivo:      { categoria: "neutro", desenlace: "en_juego", valoracion: "pos", puntaje: 6 },
    neutro:        { categoria: "neutro", desenlace: "en_juego", valoracion: "neu", puntaje: 5 },
    negativo:      { categoria: "error",  desenlace: "error",    valoracion: "neg", puntaje: 2 },
  },

  recepcion: {
    perfecta:       { categoria: "neutro", desenlace: "en_juego", valoracion: "pos", puntaje: 10 },
    positiva:       { categoria: "neutro", desenlace: "en_juego", valoracion: "pos", puntaje: 8 },
    intermedia:     { categoria: "neutro", desenlace: "en_juego", valoracion: "neu", puntaje: 5 },
    negativa:       { categoria: "neutro", desenlace: "en_juego", valoracion: "neg", puntaje: 4 },
    doble_negativa: { categoria: "neutro", desenlace: "en_juego", valoracion: "neg", puntaje: 2 },
    overpass:       { categoria: "neutro", desenlace: "en_juego", valoracion: "neg", puntaje: 1 },
    error_directo:  { categoria: "error",  desenlace: "error",    valoracion: "neg", puntaje: 0 },
    ace_contra:     { categoria: "error",  desenlace: "error",    valoracion: "neg", puntaje: 0 },
  },

  ataque: {
    punto:                                { categoria: "punto",  desenlace: "punto",    valoracion: "pos", puntaje: 10 },
    punto_directo_ataque:                 { categoria: "punto",  desenlace: "punto",    valoracion: "pos", puntaje: 10 },
    punto_desviado_ataque:                { categoria: "punto",  desenlace: "punto",    valoracion: "pos", puntaje: 10 },
    use_rival_ataque:                     { categoria: "punto",  desenlace: "punto",    valoracion: "pos", puntaje: 10 },
    neutro:                               { categoria: "neutro", desenlace: "en_juego", valoracion: "neu", puntaje: 2 },
    neutro_bloqueo_cobertura_ataque:      { categoria: "neutro", desenlace: "en_juego", valoracion: "neu", puntaje: 2 },
    neutro_desvio_bloqueo_defensa_ataque: { categoria: "neutro", desenlace: "en_juego", valoracion: "neu", puntaje: 2 },
    neutro_defensa_ataque:                { categoria: "neutro", desenlace: "en_juego", valoracion: "neu", puntaje: 2 },
    error:                                { categoria: "error",  desenlace: "error",    valoracion: "neg", puntaje: 0 },
    error_red_ataque:                     { categoria: "error",  desenlace: "error",    valoracion: "neg", puntaje: 0 },
    error_afuera_ataque:                  { categoria: "error",  desenlace: "error",    valoracion: "neg", puntaje: 0 },
    gorro_ataque:                         { categoria: "error",  desenlace: "error",    valoracion: "neg", puntaje: 0 },
  },

  bloqueo: {
    punto:        { categoria: "punto",  desenlace: "punto",    valoracion: "pos", puntaje: 10 },
    positivo_mas: { categoria: "neutro", desenlace: "en_juego", valoracion: "pos", puntaje: 8 },
    positivo:     { categoria: "neutro", desenlace: "en_juego", valoracion: "pos", puntaje: 6 },
    neutro:       { categoria: "neutro", desenlace: "en_juego", valoracion: "neu", puntaje: 5 },
    use_rival:    { categoria: "error",  desenlace: "error",    valoracion: "neg", puntaje: 3 },
    filtrada:     { categoria: "error",  desenlace: "error",    valoracion: "neu", puntaje: 2 },
    red:          { categoria: "error",  desenlace: "error",    valoracion: "neg", puntaje: 0 },
  },

  defensa: {
    gran_def:           { categoria: "neutro", desenlace: "en_juego", valoracion: "pos", puntaje: 10 },
    toque_positiva:     { categoria: "neutro", desenlace: "en_juego", valoracion: "pos", puntaje: 10 },
    cobertura_positiva: { categoria: "neutro", desenlace: "en_juego", valoracion: "pos", puntaje: 10 },
    neutro:             { categoria: "neutro", desenlace: "en_juego", valoracion: "neu", puntaje: 5 },
    toque_negativa:     { categoria: "error",  desenlace: "error",    valoracion: "neg", puntaje: 0 },
    cobertura_negativa: { categoria: "error",  desenlace: "error",    valoracion: "neg", puntaje: 0 },
    error_def:          { categoria: "error",  desenlace: "error",    valoracion: "neg", puntaje: 0 },
    errores_graves:     { categoria: "error",  desenlace: "error",    valoracion: "neg", puntaje: 0 },
    mala_libre:         { categoria: "neutro", desenlace: "en_juego", valoracion: "neg", puntaje: -2 },
  },

  armados: {
    genial:    { categoria: "neutro", desenlace: "en_juego", valoracion: "pos", puntaje: 10 },
    perfecto:  { categoria: "neutro", desenlace: "en_juego", valoracion: "pos", puntaje: 8 },
    correcto:  { categoria: "neutro", desenlace: "en_juego", valoracion: "pos", puntaje: 6 },
    flojo:     { categoria: "neutro", desenlace: "en_juego", valoracion: "neu", puntaje: 3 },
    malo:      { categoria: "error",  desenlace: "error",    valoracion: "neg", puntaje: 1 },
    horrible:  { categoria: "error",  desenlace: "error",    valoracion: "neg", puntaje: 0 },
    "1":       { categoria: "error",  desenlace: "error",    valoracion: "neg", puntaje: 0 },
    "2":       { categoria: "error",  desenlace: "error",    valoracion: "neg", puntaje: 1 },
    "3":       { categoria: "neutro", desenlace: "en_juego", valoracion: "neu", puntaje: 3 },
    "4":       { categoria: "neutro", desenlace: "en_juego", valoracion: "pos", puntaje: 6 },
    "5":       { categoria: "neutro", desenlace: "en_juego", valoracion: "pos", puntaje: 8 },
    "6":       { categoria: "neutro", desenlace: "en_juego", valoracion: "pos", puntaje: 10 },
  },

  toque: {
    punto:   { categoria: "punto",  desenlace: "punto",    valoracion: "pos", puntaje: 10 },
    neutro:  { categoria: "neutro", desenlace: "en_juego", valoracion: "neu", puntaje: 5 },
    error:   { categoria: "error",  desenlace: "error",    valoracion: "neg", puntaje: 0 },
  },
};

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

export function normalizarSubtipo(
  subtipo: string | number | null | undefined
): string {
  if (subtipo === null || subtipo === undefined) return "";
  const s = String(subtipo);
  return s.startsWith("toque:") ? s.slice(6) : s;
}

/**
 * Deriva `categoria` desde `desenlace`. Invariante:
 *   punto    → "punto"
 *   error    → "error"
 *   en_juego → "neutro"
 */
function categoriaDe(d: Desenlace): CategoriaResultado {
  if (d === "punto") return "punto";
  if (d === "error") return "error";
  return "neutro";
}

export function infoDeSubtipo(
  fundamento: string,
  subtipo: string | number | null | undefined
): SubtipoInfo | null {
  const mapa = CATALOGO[fundamento as Fundamento];
  if (!mapa) return null;
  const raw = mapa[normalizarSubtipo(subtipo)];
  if (!raw) return null;
  // Forzamos coherencia: categoria siempre derivada de desenlace.
  return { ...raw, categoria: categoriaDe(raw.desenlace) };
}

export function clasificarSubtipo(
  fundamento: string,
  subtipo: string | number | null | undefined
): CategoriaResultado | null {
  return infoDeSubtipo(fundamento, subtipo)?.categoria ?? null;
}

export function desenlaceDeSubtipo(
  fundamento: string,
  subtipo: string | number | null | undefined
): Desenlace | null {
  return infoDeSubtipo(fundamento, subtipo)?.desenlace ?? null;
}

export function valoracionDeSubtipo(
  fundamento: string,
  subtipo: string | number | null | undefined
): Valoracion | null {
  return infoDeSubtipo(fundamento, subtipo)?.valoracion ?? null;
}

export function puntajeDeSubtipo(
  fundamento: string,
  subtipo: string | number | null | undefined
): number | null {
  return infoDeSubtipo(fundamento, subtipo)?.puntaje ?? null;
}

export function subtiposDeFundamento(fundamento: Fundamento): string[] {
  const mapa = CATALOGO[fundamento];
  if (!mapa) return [];
  return Object.keys(mapa).filter((k) => !/^\d+$/.test(k));
}