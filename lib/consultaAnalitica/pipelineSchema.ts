// ============================================================
// PIPELINE SCHEMA — Esquema semántico y operaciones analíticas
// ============================================================

export type EntidadBase = "acciones" | "puntos";

export type Operador =
  | "eq" | "neq" | "in" | "nin" | "gt" | "gte" | "lt" | "lte" | "between" | "contains";

export type TipoMetrica = "count" | "sum" | "avg" | "percentage" | "efficiency";
export type DesenlaceAccion = "punto" | "error" | "en_juego";
export type ValoracionAccion = "pos" | "neu" | "neg";

export interface InfoSubtipo {
  desenlace: DesenlaceAccion;
  valoracion: ValoracionAccion;
  puntaje: number;
}

export interface Filtro {
  campo: string;
  operador: Operador;
  valor: string | number | boolean | Array<string | number | boolean>;
}

export interface Metrica {
  tipo: TipoMetrica;
  campo?: string;
  filtros_numerador?: Filtro[];
  filtros_denominador_negativo?: Filtro[];
}

export interface Agrupacion {
  campo: string;
}

export interface ConsultaPipeline {
  entidad_base: EntidadBase;
  filtros?: Filtro[];
  agrupacion?: Agrupacion;
  metrica: Metrica;
  orden?: "asc" | "desc";
  limite?: number;
  needsClarification?: boolean;
  preguntaClarificacion?: string;
}

export const CAMPOS_ACCION = [
  "tipo", "subtipo", "es_rival", "jugador_id", "set_numero", "punto_numero",
  "rotacion_numero", "rol_jugador", "zona_origen", "zona_destino",
  "zona_jugador", "fase_rally", "tipo_saque", "variante", "velocidad",
  "es_error", "lado", "equipo_id", "partido_id", "desenlace", "valoracion", "puntaje",
] as const;

export const CAMPOS_PUNTO = [
  "set_numero", "punto_numero", "partido_id", "fase", "ganador",
  "es_tie_break", "resultado_set", "resultado_partido", "cruces",
  "diferencia_marcador", "es_primer_toque",
] as const;

// ------------------------------------------------------------
// CATÁLOGO SEMÁNTICO DE 3 RAMAS (Fuente única de verdad)
// ------------------------------------------------------------

export const CATALOGO_PIPELINE: Record<string, Record<string, InfoSubtipo>> = {
  saque: {
    ace: { desenlace: "punto", valoracion: "pos", puntaje: 10 },
    positivo_mas: { desenlace: "en_juego", valoracion: "pos", puntaje: 8 },
    positivo: { desenlace: "en_juego", valoracion: "pos", puntaje: 6 },
    neutro: { desenlace: "en_juego", valoracion: "neu", puntaje: 5 },
    negativo: { desenlace: "error", valoracion: "neg", puntaje: 2 },
  },
  recepcion: {
    perfecta: { desenlace: "en_juego", valoracion: "pos", puntaje: 10 },
    positiva: { desenlace: "en_juego", valoracion: "pos", puntaje: 8 },
    intermedia: { desenlace: "en_juego", valoracion: "neu", puntaje: 5 },
    negativa: { desenlace: "en_juego", valoracion: "neg", puntaje: 4 },
    doble_negativa: { desenlace: "en_juego", valoracion: "neg", puntaje: 2 },
    overpass: { desenlace: "en_juego", valoracion: "neg", puntaje: 1 },
    error_directo: { desenlace: "error", valoracion: "neg", puntaje: 0 },
    ace_contra: { desenlace: "error", valoracion: "neg", puntaje: 0 },
  },
  ataque: {
    punto_directo_ataque: { desenlace: "punto", valoracion: "pos", puntaje: 10 },
    punto_desviado_ataque: { desenlace: "punto", valoracion: "pos", puntaje: 10 },
    use_rival_ataque: { desenlace: "punto", valoracion: "pos", puntaje: 10 },
    neutro_defensa_ataque: { desenlace: "en_juego", valoracion: "neu", puntaje: 2 },
    neutro_bloqueo_cobertura_ataque: { desenlace: "en_juego", valoracion: "neu", puntaje: 2 },
    neutro_desvio_bloqueo_defensa_ataque: { desenlace: "en_juego", valoracion: "neu", puntaje: 2 },
    error_red_ataque: { desenlace: "error", valoracion: "neg", puntaje: 0 },
    error_afuera_ataque: { desenlace: "error", valoracion: "neg", puntaje: 0 },
    gorro_ataque: { desenlace: "error", valoracion: "neg", puntaje: 0 },
    buena_rival: { desenlace: "punto", valoracion: "pos", puntaje: 10 },
    error_rival: { desenlace: "error", valoracion: "neg", puntaje: 0 },
    simple: { desenlace: "en_juego", valoracion: "neu", puntaje: 2 },
    peligroso: { desenlace: "en_juego", valoracion: "pos", puntaje: 8 },
    toque: { desenlace: "en_juego", valoracion: "neu", puntaje: 2 },
    libre: { desenlace: "en_juego", valoracion: "neu", puntaje: 2 },
    punto: { desenlace: "punto", valoracion: "pos", puntaje: 10 },
    error: { desenlace: "error", valoracion: "neg", puntaje: 0 },
  },
  bloqueo: {
    punto: { desenlace: "punto", valoracion: "pos", puntaje: 10 },
    positivo_mas: { desenlace: "en_juego", valoracion: "pos", puntaje: 8 },
    positivo: { desenlace: "en_juego", valoracion: "pos", puntaje: 6 },
    neutro: { desenlace: "en_juego", valoracion: "neu", puntaje: 5 },
    filtrada: { desenlace: "en_juego", valoracion: "neu", puntaje: 2 },
    use_rival: { desenlace: "en_juego", valoracion: "neg", puntaje: 3 },
    red: { desenlace: "error", valoracion: "neg", puntaje: 0 },
  },
  defensa: {
    gran_def: { desenlace: "en_juego", valoracion: "pos", puntaje: 10 },
    toque_positiva: { desenlace: "en_juego", valoracion: "pos", puntaje: 10 },
    cobertura_positiva: { desenlace: "en_juego", valoracion: "pos", puntaje: 10 },
    neutro: { desenlace: "en_juego", valoracion: "neu", puntaje: 5 },
    toque_negativa: { desenlace: "en_juego", valoracion: "neg", puntaje: 0 },
    cobertura_negativa: { desenlace: "en_juego", valoracion: "neg", puntaje: 0 },
    error_def: { desenlace: "error", valoracion: "neg", puntaje: 0 },
    errores_graves: { desenlace: "error", valoracion: "neg", puntaje: 0 },
    mala_libre: { desenlace: "error", valoracion: "neg", puntaje: -2 },
  },
  armado: {
    genial: { desenlace: "en_juego", valoracion: "pos", puntaje: 10 },
    "6": { desenlace: "en_juego", valoracion: "pos", puntaje: 10 },
    perfecto: { desenlace: "en_juego", valoracion: "pos", puntaje: 8 },
    "5": { desenlace: "en_juego", valoracion: "pos", puntaje: 8 },
    correcto: { desenlace: "en_juego", valoracion: "pos", puntaje: 6 },
    "4": { desenlace: "en_juego", valoracion: "pos", puntaje: 6 },
    flojo: { desenlace: "en_juego", valoracion: "neu", puntaje: 3 },
    "3": { desenlace: "en_juego", valoracion: "neu", puntaje: 3 },
    malo: { desenlace: "en_juego", valoracion: "neg", puntaje: 1 },
    "2": { desenlace: "en_juego", valoracion: "neg", puntaje: 1 },
    horrible: { desenlace: "en_juego", valoracion: "neg", puntaje: 0 },
    "1": { desenlace: "en_juego", valoracion: "neg", puntaje: 0 },
  },
  armados: {
    genial: { desenlace: "en_juego", valoracion: "pos", puntaje: 10 },
    "6": { desenlace: "en_juego", valoracion: "pos", puntaje: 10 },
    perfecto: { desenlace: "en_juego", valoracion: "pos", puntaje: 8 },
    "5": { desenlace: "en_juego", valoracion: "pos", puntaje: 8 },
    correcto: { desenlace: "en_juego", valoracion: "pos", puntaje: 6 },
    "4": { desenlace: "en_juego", valoracion: "pos", puntaje: 6 },
    flojo: { desenlace: "en_juego", valoracion: "neu", puntaje: 3 },
    "3": { desenlace: "en_juego", valoracion: "neu", puntaje: 3 },
    malo: { desenlace: "en_juego", valoracion: "neg", puntaje: 1 },
    "2": { desenlace: "en_juego", valoracion: "neg", puntaje: 1 },
    horrible: { desenlace: "en_juego", valoracion: "neg", puntaje: 0 },
    "1": { desenlace: "en_juego", valoracion: "neg", puntaje: 0 },
  },
  toque: {
    punto: { desenlace: "punto", valoracion: "pos", puntaje: 10 },
    neutro: { desenlace: "en_juego", valoracion: "neu", puntaje: 5 },
    error: { desenlace: "error", valoracion: "neg", puntaje: 0 },
  },
};

// ------------------------------------------------------------
// HELPERS SEMÁNTICOS
// ------------------------------------------------------------

export function normalizarSubtipoParaPipeline(subtipo: unknown): string {
  if (subtipo === null || subtipo === undefined) return "";
  let s = String(subtipo).trim().toLowerCase();
  if (s.startsWith("toque:")) s = s.slice(6);
  return s;
}

export function infoDeSubtipoPipeline(
  tipo: string | null | undefined,
  subtipo: unknown,
  esErrorFallback = false
): InfoSubtipo {
  const t = (tipo ?? "").toLowerCase();
  const s = normalizarSubtipoParaPipeline(subtipo);
  const entradaTipo = CATALOGO_PIPELINE[t];
  if (entradaTipo && s && entradaTipo[s]) return entradaTipo[s];
  if (esErrorFallback) return { desenlace: "error", valoracion: "neg", puntaje: 0 };
  return { desenlace: "en_juego", valoracion: "neu", puntaje: 5 };
}

export function desenlaceDeAccion(
  tipo: string | null | undefined,
  subtipo: unknown,
  esError = false
): DesenlaceAccion {
  return infoDeSubtipoPipeline(tipo, subtipo, esError).desenlace;
}

export function valoracionDeAccion(
  tipo: string | null | undefined,
  subtipo: unknown,
  esError = false
): ValoracionAccion {
  return infoDeSubtipoPipeline(tipo, subtipo, esError).valoracion;
}

export function puntajeDeAccionPipeline(
  tipo: string | null | undefined,
  subtipo: unknown,
  esError = false
): number {
  return infoDeSubtipoPipeline(tipo, subtipo, esError).puntaje;
}

// ------------------------------------------------------------
// VALIDACIÓN DEL ESQUEMA
// ------------------------------------------------------------

export function esConsultaPipelineValida(v: unknown): v is ConsultaPipeline {
  if (!v || typeof v !== "object") return false;
  const c = v as Record<string, unknown>;
  if (c.needsClarification === true) return typeof c.preguntaClarificacion === "string";
  if (c.entidad_base !== "acciones" && c.entidad_base !== "puntos") return false;
  if (!c.metrica || typeof c.metrica !== "object") return false;

  const m = c.metrica as Record<string, unknown>;
  const metricasValidas: TipoMetrica[] = ["count", "sum", "avg", "percentage", "efficiency"];
  if (!metricasValidas.includes(m.tipo as TipoMetrica)) return false;

  if (c.filtros !== undefined) {
    if (!Array.isArray(c.filtros)) return false;
    for (const f of c.filtros) {
      if (!f || typeof f !== "object") return false;
      if (typeof f.campo !== "string" || typeof f.operador !== "string" || f.valor === undefined) {
        return false;
      }
    }
  }

  if (c.agrupacion !== undefined) {
    if (!c.agrupacion || typeof c.agrupacion !== "object") return false;
    if (typeof (c.agrupacion as Record<string, unknown>).campo !== "string") return false;
  }

  return true;
}

// ------------------------------------------------------------
// SYSTEM PROMPT PIPELINE PARA GROQ
// ------------------------------------------------------------

export const SYSTEM_PROMPT_PIPELINE = `Sos el Intérprete Universal de Consultas Analíticas para Voleystats (vóley profesional).
Tu tarea es traducir una pregunta en lenguaje natural a un JSON con estructura ConsultaPipeline.

REGLAS DE ORO:
1. Devuelve ÚNICAMENTE un objeto JSON válido. Sin markdown, sin explicaciones, sin \`\`\`.
2. ENTIDADES:
   - "acciones": cuando se pregunta por toques/acciones individuales (ataques, saques, bloqueos, defensas, recepciones, armados, toques, errores, etc.).
   - "puntos": cuando se pregunta por rallies o puntos ganados/perdidos como unidad ("puntos ganados", "puntos en k1", "partidos", etc.).
3. DISTINCIÓN SEMÁNTICA DE 3 RAMAS (CRUCIAL):
   - "puntos" en acciones = desenlace: "punto" (cerraron el rally sumando punto).
   - "positivos" en acciones = valoracion: "pos" (calidad positiva, ¡incluye puntos y jugadas que siguen!).
   - "errores" en acciones = desenlace: "error" (o valoracion: "neg").
   - "en juego" = desenlace: "en_juego".
   Todo punto es positivo, pero no todo positivo es punto.
4. CAMPOS DISPONIBLES EN ACCIONES:
   tipo, subtipo, es_rival, jugador_id, set_numero, punto_numero, rotacion_numero, rol_jugador,
   zona_origen, zona_destino, zona_jugador, fase_rally, tipo_saque, variante, velocidad,
   es_error, lado, desenlace, valoracion, puntaje.
5. CAMPOS DISPONIBLES EN PUNTOS:
   set_numero, punto_numero, partido_id, fase, ganador ("propio" | "rival"), es_tie_break,
   resultado_set, resultado_partido, cruces, diferencia_marcador, es_primer_toque.
6. OPERADORES: "eq", "neq", "in", "nin", "gt", "gte", "lt", "lte", "between", "contains".
7. MÉTRICAS:
   - "count": para contar filas.
   - "sum": para sumar campo numérico (requiere "campo").
   - "avg": para promediar campo numérico (requiere "campo", ej. "puntaje").
   - "percentage": porcentaje de éxito. Usa "filtros_numerador" sobre el total filtrado (ej. desenlace: "punto").
   - "efficiency": eficiencia ((puntos - errores) / total * 100).
8. SI LA PREGUNTA ES AMBIGUA O FALTA DATO CRÍTICO:
   { "needsClarification": true, "preguntaClarificacion": "¿Podrías especificar...?" }
9. ACCIONES PROPIAS vs RIVALES (CRÍTICO):
   Cuando entidad_base es "acciones", SIEMPRE agregar el filtro:
   { "campo": "es_rival", "operador": "eq", "valor": false }
   por DEFECTO, salvo que el usuario indique lo contrario:
   - "cuántos ataques en k2" → filtros: tipo=ataque, fase_rally=k2, es_rival=false
   - "cuántos aces" → filtros: tipo=saque, subtipo=ace, es_rival=false
   - "cuántas recepciones" → filtros: tipo=recepcion, es_rival=false

   Excepciones (NO agregar es_rival=false):
   - Si el usuario dice "rivales", "del rival", "contrincante", "otro equipo" → usar es_rival=true.
   - Si dice "de los dos equipos", "todos", "ambos" → NO agregar el filtro (cuenta las dos).

   Entidad "puntos": NO lleva es_rival (los puntos ya son propios o rivales según "ganador").

EJEMPLOS:
Prompt: "cuántos ataques en k2"
JSON:
{
  "entidad_base": "acciones",
  "filtros": [
    { "campo": "tipo", "operador": "eq", "valor": "ataque" },
    { "campo": "fase_rally", "operador": "eq", "valor": "k2" },
    { "campo": "es_rival", "operador": "eq", "valor": false }
  ],
  "metrica": { "tipo": "count" }
}

Prompt: "cuántos aces rivales"
JSON:
{
  "entidad_base": "acciones",
  "filtros": [
    { "campo": "tipo", "operador": "eq", "valor": "saque" },
    { "campo": "subtipo", "operador": "eq", "valor": "ace" },
    { "campo": "es_rival", "operador": "eq", "valor": true }
  ],
  "metrica": { "tipo": "count" }
}

Prompt: "cuántos puntos ganamos en k1"
JSON:
{
  "entidad_base": "puntos",
  "filtros": [
    { "campo": "fase", "operador": "eq", "valor": "side-out" },
    { "campo": "ganador", "operador": "eq", "valor": "propio" }
  ],
  "metrica": { "tipo": "count" }
}

Prompt: "cuántos aces"
JSON:
{
  "entidad_base": "acciones",
  "filtros": [
    { "campo": "tipo", "operador": "eq", "valor": "saque" },
    { "campo": "subtipo", "operador": "eq", "valor": "ace" },
    { "campo": "es_rival", "operador": "eq", "valor": false }
  ],
  "metrica": { "tipo": "count" }
}

Prompt: "cuántos positivos de saque"
JSON:
{
  "entidad_base": "acciones",
  "filtros": [
    { "campo": "tipo", "operador": "eq", "valor": "saque" },
    { "campo": "valoracion", "operador": "eq", "valor": "pos" },
    { "campo": "es_rival", "operador": "eq", "valor": false }
  ],
  "metrica": { "tipo": "count" }
}

Prompt: "distribución de errores por rotación"
JSON:
{
  "entidad_base": "acciones",
  "filtros": [
    { "campo": "desenlace", "operador": "eq", "valor": "error" },
    { "campo": "es_rival", "operador": "eq", "valor": false }
  ],
  "agrupacion": { "campo": "rotacion_numero" },
  "metrica": { "tipo": "count" }
}

Prompt: "kill % del punta 1"
JSON:
{
  "entidad_base": "acciones",
  "filtros": [
    { "campo": "tipo", "operador": "eq", "valor": "ataque" },
    { "campo": "rol_jugador", "operador": "eq", "valor": "P1" },
    { "campo": "es_rival", "operador": "eq", "valor": false }
  ],
  "metrica": {
    "tipo": "percentage",
    "filtros_numerador": [
      { "campo": "desenlace", "operador": "eq", "valor": "punto" }
    ]
  }
}

Prompt: "ranking de jugadores por puntos"
JSON:
{
  "entidad_base": "acciones",
  "filtros": [
    { "campo": "desenlace", "operador": "eq", "valor": "punto" },
    { "campo": "es_rival", "operador": "eq", "valor": false }
  ],
  "agrupacion": { "campo": "jugador_id" },
  "metrica": { "tipo": "count" },
  "orden": "desc"
}

Prompt: "promedio de puntaje de recepción por jugador"
JSON:
{
  "entidad_base": "acciones",
  "filtros": [
    { "campo": "tipo", "operador": "eq", "valor": "recepcion" },
    { "campo": "es_rival", "operador": "eq", "valor": false }
  ],
  "agrupacion": { "campo": "jugador_id" },
  "metrica": { "tipo": "avg", "campo": "puntaje" }
}`;
