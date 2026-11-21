// ============================================================
// PIPELINE SCHEMA — Esquema semántico y operaciones analíticas
// ============================================================
// v48.1 (Bloque 3a): agrega `explain?: string` a ConsultaPipeline
//   y regla 1b al SYSTEM_PROMPT pidiendo explicación en 1 frase.
// ============================================================

export type EntidadBase = "acciones" | "puntos";
export type Operador = "eq" | "neq" | "in" | "nin" | "gt" | "gte" | "lt" | "lte" | "between" | "contains";
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

// ------------------------------------------------------------
// AST DE FILTROS (v48 — Fase 1)
// ------------------------------------------------------------
// Un filtro puede expresarse como:
//   - Filtro[]    → legacy, se interpreta como AND de todos.
//   - FiltroExpr  → AST con and/or/not/filter.
// El motor SIEMPRE normaliza a FiltroExpr antes de evaluar.

export type FiltroExpr =
  | { kind: "filter"; campo: string; operador: Operador; valor: string | number | boolean | Array<string | number | boolean> }
  | { kind: "and"; children: FiltroExpr[] }
  | { kind: "or";  children: FiltroExpr[] }
  | { kind: "not"; child: FiltroExpr };

export type FiltroInput = Filtro[] | FiltroExpr;

export function normalizarFiltros(input?: FiltroInput | null): FiltroExpr | null {
  if (!input) return null;
  if (Array.isArray(input)) {
    if (input.length === 0) return null;
    return {
      kind: "and",
      children: input.map(f => ({ kind: "filter", campo: f.campo, operador: f.operador, valor: f.valor })),
    };
  }
  return input;
}

export function esFiltroExprValido(v: unknown): v is FiltroExpr {
  if (!v || typeof v !== "object") return false;
  const e = v as Record<string, unknown>;
  if (e.kind === "filter") {
    return typeof e.campo === "string" && typeof e.operador === "string" && e.valor !== undefined;
  }
  if (e.kind === "and" || e.kind === "or") {
    return Array.isArray(e.children) && e.children.every(esFiltroExprValido);
  }
  if (e.kind === "not") {
    return esFiltroExprValido(e.child);
  }
  return false;
}

export interface Metrica {
  tipo: TipoMetrica;
  campo?: string;
  filtros_numerador?: FiltroInput;             // antes: Filtro[]
  filtros_denominador_negativo?: FiltroInput;  // antes: Filtro[]
}

export interface Agrupacion {
  campo: string;
}

export interface ConsultaPipeline {
  entidad_base: EntidadBase;
  filtro?: FiltroInput;   // NUEVO — AST o array (preferido)
  filtros?: Filtro[];     // legacy, deprecado, se normaliza a AND
  agrupacion?: Agrupacion;
  metrica: Metrica;
  orden?: "asc" | "desc";
  limite?: number;
  needsClarification?: boolean;
  preguntaClarificacion?: string;
  // v48.1 (Bloque 3a) — Explicación en 1 frase de cómo se interpretó la consulta.
  // Opcional en el tipo (resiliencia), pero el SYSTEM_PROMPT la pide SIEMPRE.
  explain?: string;
}

export const CAMPOS_ACCION = [
  "tipo", "subtipo", "es_rival", "jugador_id", "set_numero", "punto_numero",
  "rotacion_numero", "rol_jugador", "zona_origen", "zona_destino",
  "zona_jugador", "fase_rally", "tipo_saque", "variante", "velocidad",
  "es_error", "lado", "equipo_id", "partido_id", "desenlace", "valoracion", "puntaje",
  "resultado_set", "resultado_partido", "ganador_punto", "calidad_recepcion",
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
    error: { desenlace: "error", valoracion: "neg", puntaje: 0 },
    error_rival: { desenlace: "error", valoracion: "neg", puntaje: 0 },
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
    filtrada: { desenlace: "error", valoracion: "neu", puntaje: 2 },
    use_rival: { desenlace: "error", valoracion: "neg", puntaje: 3 },
    red: { desenlace: "error", valoracion: "neg", puntaje: 0 },
    error: { desenlace: "error", valoracion: "neg", puntaje: 0 },
  },
  defensa: {
    gran_def: { desenlace: "en_juego", valoracion: "pos", puntaje: 10 },
    toque_positiva: { desenlace: "en_juego", valoracion: "pos", puntaje: 10 },
    cobertura_positiva: { desenlace: "en_juego", valoracion: "pos", puntaje: 10 },
    neutro: { desenlace: "en_juego", valoracion: "neu", puntaje: 5 },
    toque_negativa: { desenlace: "error", valoracion: "neg", puntaje: 0 },
    cobertura_negativa: { desenlace: "error", valoracion: "neg", puntaje: 0 },
    error_def: { desenlace: "error", valoracion: "neg", puntaje: 0 },
    errores_graves: { desenlace: "error", valoracion: "neg", puntaje: 0 },
    error: { desenlace: "error", valoracion: "neg", puntaje: 0 },
    mala_libre: { desenlace: "en_juego", valoracion: "neg", puntaje: -2 },
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
    malo: { desenlace: "error", valoracion: "neg", puntaje: 1 },
    "2": { desenlace: "error", valoracion: "neg", puntaje: 1 },
    horrible: { desenlace: "error", valoracion: "neg", puntaje: 0 },
    "1": { desenlace: "error", valoracion: "neg", puntaje: 0 },
    R: { desenlace: "error", valoracion: "neg", puntaje: 0 },
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
    malo: { desenlace: "error", valoracion: "neg", puntaje: 1 },
    "2": { desenlace: "error", valoracion: "neg", puntaje: 1 },
    horrible: { desenlace: "error", valoracion: "neg", puntaje: 0 },
    "1": { desenlace: "error", valoracion: "neg", puntaje: 0 },
    R: { desenlace: "error", valoracion: "neg", puntaje: 0 },
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
  esErrorFallback: boolean | null | undefined = false
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
  esError: boolean | null | undefined = false
): DesenlaceAccion {
  return infoDeSubtipoPipeline(tipo, subtipo, esError).desenlace;
}

export function valoracionDeAccion(
  tipo: string | null | undefined,
  subtipo: unknown,
  esError: boolean | null | undefined = false
): ValoracionAccion {
  return infoDeSubtipoPipeline(tipo, subtipo, esError).valoracion;
}

export function puntajeDeAccionPipeline(
  tipo: string | null | undefined,
  subtipo: unknown,
  esError: boolean | null | undefined = false
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

  // Legacy: filtros: Filtro[]
  if (c.filtros !== undefined) {
    if (!Array.isArray(c.filtros)) return false;
    for (const f of c.filtros) {
      if (!f || typeof f !== "object") return false;
      if (typeof f.campo !== "string" || typeof f.operador !== "string" || f.valor === undefined) {
        return false;
      }
    }
  }

  // Nuevo: filtro: FiltroInput (array o AST)
  if (c.filtro !== undefined) {
    if (Array.isArray(c.filtro)) {
      for (const f of c.filtro) {
        if (!f || typeof f !== "object") return false;
        if (typeof f.campo !== "string" || typeof f.operador !== "string" || f.valor === undefined) {
          return false;
        }
      }
    } else {
      if (!esFiltroExprValido(c.filtro)) return false;
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
1b. EXPLAIN (OBLIGATORIO): incluí SIEMPRE el campo "explain" con una frase corta EN ESPAÑOL (máximo 20 palabras) que explique cómo interpretaste la consulta. Ej: "Entendí: contar ataques del punta 1 con desenlace punto (kill %)."
   - "explain" NO reemplaza la lógica: es un resumen legible para que el usuario vea qué entendiste.
   - Va al final del objeto JSON, después de "metrica" (y después de "orden"/"limite" si existen).
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
   es_error, lado, desenlace, valoracion, puntaje,
   resultado_set ("set_ganado" | "set_perdido"), resultado_partido ("partido_ganado" | "partido_perdido"),
   ganador_punto ("propio" | "rival"), calidad_recepcion ("perfecta" | "positiva" | "intermedia" | "negativa" | "error").
5. CAMPOS DISPONIBLES EN PUNTOS:
   set_numero, punto_numero, partido_id, fase, ganador ("propio" | "rival"), es_tie_break,
   resultado_set, resultado_partido, cruces, diferencia_marcador, es_primer_toque.
   ⚠️ VALORES EXACTOS (no inventar variantes):
   - resultado_set:     "set_ganado"     | "set_perdido"     | "sin_resultado"
   - resultado_partido: "partido_ganado" | "partido_perdido" | "sin_resultado"
   - fase:              "side-out" | "k2" | "k3" | "free-ball" | "otro"
   - ganador:           "propio" | "rival"
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
   Excepciones:
   - Si dice "rivales", "del rival", "contrincante", "otro equipo" → usar es_rival=true.
   - Si dice "de los dos equipos", "todos", "ambos" → NO agregar el filtro (cuenta las dos).
   Entidad "puntos": NO lleva es_rival (se define por ganador="propio"|"rival").

10. "PUNTOS" COMO ACCIÓN vs COMO RALLY:
Hay DOS formas válidas de contar "puntos":
A) "cuántos puntos hizo X" → ACCIONES con desenlace=punto (aces, ataques punto, bloqueos punto, toques punto).
   - entidad_base: "acciones", filtros: jugador_id=X, desenlace=punto, es_rival=false, metrica: count.
B) "cuántos puntos ganamos en k1" / "cuántos puntos ganó el equipo" → RALLIES cerrados a favor del equipo.
   - entidad_base: "puntos", filtros: ganador=propio [+ fase, set, etc.], metrica: count.
Regla práctica:
- Si dice "el jugador" / "Fulano" / nombre propio → (A).
- Si dice "el equipo" / "nosotros" / "ganamos" → (B).

11. MÉTRICAS ESPECIALES:
- "kill %" (porcentaje de kill / punto de ataque):
  entidad_base: "acciones", filtros: tipo=ataque, es_rival=false
  metrica: { tipo: "percentage", filtros_numerador: [{ campo: "desenlace", operador: "eq", valor: "punto" }] }
- "side-out %" / "efectividad recibiendo" (k1):
  entidad_base: "puntos", filtros: fase=side-out
  metrica: { tipo: "percentage", filtros_numerador: [{ campo: "ganador", operador: "eq", valor: "propio" }] }
- "efectividad sacando" / "break point %":
  entidad_base: "puntos", filtros: fase IN ["k2","k3","contraataque"]
  metrica: { tipo: "percentage", filtros_numerador: [{ campo: "ganador", operador: "eq", valor: "propio" }] }
- "eficiencia de ataque" / "attack efficiency":
  entidad_base: "acciones", filtros: tipo=ataque, es_rival=false, metrica: { tipo: "efficiency" }
- "porcentaje de recepciones perfectas":
  entidad_base: "acciones", filtros: tipo=recepcion, es_rival=false
  metrica: { tipo: "percentage", filtros_numerador: [{ campo: "subtipo", operador: "eq", valor: "perfecta" }] }
- "calidad de recepción" / "% de recepciones positivas":
  entidad_base: "acciones", filtros: tipo=recepcion, es_rival=false
  metrica: { tipo: "percentage", filtros_numerador: [{ campo: "valoracion", operador: "eq", valor: "pos" }] }

12. FILTROS ESPECÍFICOS:
- "errores de X" → tipo=X, desenlace=error, es_rival=false
- "positivos de X" → tipo=X, valoracion=pos, es_rival=false
- "puntos de X (fundamento)" → tipo=X, desenlace=punto, es_rival=false
- "neutros de X" → tipo=X, valoracion=neu, es_rival=false
- "en k1" / "en side-out" → fase_rally=side-out (acciones) o fase=side-out (puntos).
- "en k2" → k2. "en k3" → k3. "en free ball" → free-ball.

13. REGLA FUNDAMENTAL DE DESENLACE:
Lo que determina error o punto es siempre la finalización del punto.
Las acciones intermedias en el rally tienen desenlace "en_juego", salvo que cierren el punto directamente (desenlace "punto" a favor o "error" en contra).

14. FUNDAMENTOS CLAVE Y SUBTIPOS:
- SAQUE:
  * subtipos: ace (S#), positivo_mas (S/), positivo (S+), neutro (S!), negativo (S=).
  * "aces" → tipo: "saque", subtipo: "ace", es_rival: false
  * "saques neutros" → tipo: "saque", valoracion: "neu", es_rival: false
  * "saques positivos" → tipo: "saque", valoracion: "pos", es_rival: false
  * "errores de saque" → tipo: "saque", desenlace: "error", es_rival: false
- BLOQUEO:
  * subtipos: punto (B#), positivo_mas (B/), positivo (B+), neutro (B!), filtrada, use_rival, red.
  * ¡NO EXISTE bloqueo negativo! Es siempre punto, positivo, neutro o error.
  * "bloqueos punto" → tipo: "bloqueo", desenlace: "punto", es_rival: false
  * "bloqueos neutros" → tipo: "bloqueo", valoracion: "neu", es_rival: false
  * "bloqueos positivos" → tipo: "bloqueo", valoracion: "pos", es_rival: false
  * "errores de bloqueo" → tipo: "bloqueo", desenlace: "error", es_rival: false (agrupa filtrada cuando cuesta punto, red y use_rival)
  * "filtradas" → tipo: "bloqueo", subtipo: "filtrada", es_rival: false
  * "use rival en bloqueo" → tipo: "bloqueo", subtipo: "use_rival", es_rival: false
- DEFENSA (dos capas: semántica y variante):
  * subtipos semánticos: gran_def, toque_positiva, cobertura_positiva, neutro, toque_negativa, cobertura_negativa, error_def, mala_libre.
  * campo "variante" (tipo físico para filtros): "toque", "remate", "cobertura".
  * "defensas positivas" → tipo: "defensa", valoracion: "pos", es_rival: false
  * "defensas neutras" → tipo: "defensa", valoracion: "neu", es_rival: false
  * "errores de defensa" → tipo: "defensa", desenlace: "error", es_rival: false
  * "defensas de toque" → tipo: "defensa", variante: "toque", es_rival: false
  * "defensas de remate" → tipo: "defensa", variante: "remate", es_rival: false
  * "coberturas" → tipo: "defensa", variante: "cobertura", es_rival: false

EJEMPLOS (todos incluyen "explain" obligatorio):

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
    "filtros_numerador": [{ "campo": "desenlace", "operador": "eq", "valor": "punto" }]
  },
  "explain": "Kill % del punta 1: ataques del P1 con desenlace punto sobre el total de sus ataques."
}

Prompt: "efectividad recibiendo"
JSON:
{
  "entidad_base": "puntos",
  "filtros": [{ "campo": "fase", "operador": "eq", "valor": "side-out" }],
  "metrica": {
    "tipo": "percentage",
    "filtros_numerador": [{ "campo": "ganador", "operador": "eq", "valor": "propio" }]
  },
  "explain": "Efectividad en recepción: puntos ganados en fase side-out (k1) sobre el total."
}

Prompt: "cuántos puntos hizo Mariano"
JSON:
{
  "entidad_base": "acciones",
  "filtros": [
    { "campo": "jugador_id", "operador": "eq", "valor": "Mariano" },
    { "campo": "desenlace", "operador": "eq", "valor": "punto" },
    { "campo": "es_rival", "operador": "eq", "valor": false }
  ],
  "metrica": { "tipo": "count" },
  "explain": "Puntos de Mariano: acciones suyas con desenlace punto."
}

Prompt: "cuántos puntos ganamos en k1"
JSON:
{
  "entidad_base": "puntos",
  "filtros": [
    { "campo": "fase", "operador": "eq", "valor": "side-out" },
    { "campo": "ganador", "operador": "eq", "valor": "propio" }
  ],
  "metrica": { "tipo": "count" },
  "explain": "Puntos ganados en k1: rallies cerrados a favor en fase side-out."
}

Prompt: "cuántas recepciones perfectas"
JSON:
{
  "entidad_base": "acciones",
  "filtros": [
    { "campo": "tipo", "operador": "eq", "valor": "recepcion" },
    { "campo": "subtipo", "operador": "eq", "valor": "perfecta" },
    { "campo": "es_rival", "operador": "eq", "valor": false }
  ],
  "metrica": { "tipo": "count" },
  "explain": "Recepciones perfectas: acciones propias de recepción con subtipo perfecta."
}

Prompt: "errores de recepción"
JSON:
{
  "entidad_base": "acciones",
  "filtros": [
    { "campo": "tipo", "operador": "eq", "valor": "recepcion" },
    { "campo": "desenlace", "operador": "eq", "valor": "error" },
    { "campo": "es_rival", "operador": "eq", "valor": false }
  ],
  "metrica": { "tipo": "count" },
  "explain": "Errores de recepción: acciones propias de recepción con desenlace error."
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
  "metrica": { "tipo": "avg", "campo": "puntaje" },
  "explain": "Promedio de puntaje de recepción por jugador: promedio del campo puntaje."
}

Prompt: "top 3 jugadores por puntos"
JSON:
{
  "entidad_base": "acciones",
  "filtros": [
    { "campo": "desenlace", "operador": "eq", "valor": "punto" },
    { "campo": "es_rival", "operador": "eq", "valor": false }
  ],
  "agrupacion": { "campo": "jugador_id" },
  "metrica": { "tipo": "count" },
  "orden": "desc",
  "limite": 3,
  "explain": "Top 3 jugadores por puntos: ranking desc por cantidad de acciones con desenlace punto."
}

Prompt: "distribución de ataques por zona destino"
JSON:
{
  "entidad_base": "acciones",
  "filtros": [
    { "campo": "tipo", "operador": "eq", "valor": "ataque" },
    { "campo": "es_rival", "operador": "eq", "valor": false }
  ],
  "agrupacion": { "campo": "zona_destino" },
  "metrica": { "tipo": "count" },
  "explain": "Distribución de ataques por zona destino: conteo agrupado por zona_destino."
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
  "metrica": { "tipo": "count" },
  "explain": "Aces rivales: saques del rival con subtipo ace."
}`;