// ============================================================
// CATÁLOGO DE SUBTIPOS — fuente única de verdad
// ============================================================
// Jerarquía: Resultado (punto/error/neutro) → Fundamento → Subtipo.
//
// `categoria` = clasificación del rally (¿cerró el punto? ¿para quién?).
// `puntaje`   = escala -2..10 (misma que BASE_SCORES de estadisticas.ts).
//
// Los consumidores DEBEN leer de acá:
//   - lib/analisis/clasificacion.ts      → clasificarResultado, puntajeDeAccion
//   - lib/estadisticas.ts                → puntajeBase, BASE_SCORES, VALORES_*
//   - lib/consultaAnalitica/metricasVoley.ts → killPct, attackEfficiency, accionesPunto
//   - lib/partidos/helpers.ts            → promedios de recepción
//   - app/equipo/MiEquipo.tsx            → calcularBarrasPorFundamento
//
// Las listas UI (ACCIONES_POSITIVAS, DISPLAY_ERRORES, SALDO_*)
// NO se derivan del catálogo: responden preguntas distintas
// ("¿es positiva?" ≠ "¿cerró el punto?"). Esas se actualizan a
// mano cuando aparecen subtipos nuevos.
// ============================================================

export type CategoriaResultado = "punto" | "error" | "neutro";

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
  puntaje: number;
}

type MapaSubtipos = Record<string, SubtipoInfo>;

export const CATALOGO: Record<Fundamento, MapaSubtipos> = {
  saque: {
    ace: { categoria: "punto", puntaje: 10 },
    positivo_mas: { categoria: "punto", puntaje: 8 },
    positivo: { categoria: "punto", puntaje: 6 },
    neutro: { categoria: "neutro", puntaje: 5 },
    negativo: { categoria: "error", puntaje: 2 },
  },

  recepcion: {
    perfecta: { categoria: "punto", puntaje: 10 },
    positiva: { categoria: "punto", puntaje: 8 },
    intermedia: { categoria: "neutro", puntaje: 5 },
    negativa: { categoria: "error", puntaje: 4 },
    doble_negativa: { categoria: "error", puntaje: 2 },
    overpass: { categoria: "error", puntaje: 1 },
    error_directo: { categoria: "error", puntaje: 0 },
    // Alias legacy: nunca llega desde DataEntry V2 pero puede
    // venir de partidos viejos guardados como V1.
    ace_contra: { categoria: "error", puntaje: 0 },
  },

  ataque: {
    punto: { categoria: "punto", puntaje: 10 },
    punto_directo_ataque: { categoria: "punto", puntaje: 10 },
    punto_desviado_ataque: { categoria: "punto", puntaje: 10 },
    use_rival_ataque: { categoria: "punto", puntaje: 10 },
    neutro: { categoria: "neutro", puntaje: 2 },
    neutro_bloqueo_cobertura_ataque: { categoria: "neutro", puntaje: 2 },
    neutro_desvio_bloqueo_defensa_ataque: { categoria: "neutro", puntaje: 2 },
    neutro_defensa_ataque: { categoria: "neutro", puntaje: 2 },
    error: { categoria: "error", puntaje: 0 },
    error_red_ataque: { categoria: "error", puntaje: 0 },
    error_afuera_ataque: { categoria: "error", puntaje: 0 },
    gorro_ataque: { categoria: "error", puntaje: 0 },
  },

  bloqueo: {
    punto: { categoria: "punto", puntaje: 10 },
    positivo_mas: { categoria: "neutro", puntaje: 8 },
    positivo: { categoria: "neutro", puntaje: 6 },
    neutro: { categoria: "neutro", puntaje: 5 },
    use_rival: { categoria: "error", puntaje: 3 },
    filtrada: { categoria: "neutro", puntaje: 2 },
    red: { categoria: "error", puntaje: 0 },
  },

  defensa: {
    gran_def: { categoria: "punto", puntaje: 10 },
    toque_positiva: { categoria: "punto", puntaje: 10 },
    cobertura_positiva: { categoria: "punto", puntaje: 10 },
    neutro: { categoria: "neutro", puntaje: 5 },
    toque_negativa: { categoria: "neutro", puntaje: 0 },
    cobertura_negativa: { categoria: "neutro", puntaje: 0 },
    error_def: { categoria: "error", puntaje: 0 },
    errores_graves: { categoria: "error", puntaje: 0 },
    mala_libre: { categoria: "error", puntaje: -2 },
  },

  armados: {
    genial: { categoria: "punto", puntaje: 10 },
    perfecto: { categoria: "punto", puntaje: 8 },
    correcto: { categoria: "punto", puntaje: 6 },
    flojo: { categoria: "neutro", puntaje: 3 },
    malo: { categoria: "error", puntaje: 1 },
    horrible: { categoria: "error", puntaje: 0 },
    // Alias numéricos canónicos (partidos viejos).
    "1": { categoria: "error", puntaje: 0 },
    "2": { categoria: "error", puntaje: 1 },
    "3": { categoria: "neutro", puntaje: 3 },
    "4": { categoria: "punto", puntaje: 6 },
    "5": { categoria: "punto", puntaje: 8 },
    "6": { categoria: "punto", puntaje: 10 },
  },

  toque: {
    punto: { categoria: "punto", puntaje: 10 },
    neutro: { categoria: "neutro", puntaje: 5 },
    error: { categoria: "error", puntaje: 0 },
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

export function infoDeSubtipo(
  fundamento: string,
  subtipo: string | number | null | undefined
): SubtipoInfo | null {
  const mapa = CATALOGO[fundamento as Fundamento];
  if (!mapa) return null;
  return mapa[normalizarSubtipo(subtipo)] ?? null;
}

export function clasificarSubtipo(
  fundamento: string,
  subtipo: string | number | null | undefined
): CategoriaResultado | null {
  return infoDeSubtipo(fundamento, subtipo)?.categoria ?? null;
}

export function puntajeDeSubtipo(
  fundamento: string,
  subtipo: string | number | null | undefined
): number | null {
  return infoDeSubtipo(fundamento, subtipo)?.puntaje ?? null;
}

// ------------------------------------------------------------
// LISTAS DERIVADAS (para consumo puntual)
// ------------------------------------------------------------

export function subtiposDeFundamento(fundamento: Fundamento): string[] {
  const mapa = CATALOGO[fundamento];
  if (!mapa) return [];
  return Object.keys(mapa).filter((k) => !/^\d+$/.test(k));
}