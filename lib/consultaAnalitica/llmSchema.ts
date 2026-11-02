// ============================================================
// LLM SCHEMA — capa de traducción (LLM → IntencionQuery)
// ============================================================
// Define QUÉ puede pedir el LLM y CÓMO lo debe devolver.
//
// Este archivo NO ejecuta nada. Es solo:
//   1. El schema (qué campos, qué valores permitidos).
//   2. El system prompt completo para Groq.
//   3. Los tipos TS que reflejan el schema.
//
// La función `traducirPrompt()` (en llmTranslator.ts) usa esto
// para llamar a Groq y validar el output.
//
// Para agregar un filtro nuevo (ej: `zonaDestino`, `rival`):
//   1. Sumarlo acá al schema + al system prompt + al type.
//   2. Sumarlo en `llmToIntencion.ts` (conversión a IntencionQuery).
//   3. Si el motor no lo soporta todavía, agregarlo también en
//      `intenciones/tipos.ts` (CondicionFiltro) y en el ejecutor.
// ============================================================

// ------------------------------------------------------------
// TIPOS DEL SCHEMA (reflejan el JSON que devuelve el LLM)
// ------------------------------------------------------------

export type FaseRallyLLM =
  | "side-out"
  | "k1"
  | "k2"
  | "k3"
  | "contraataque"
  | "free-ball"
  | "cualquiera";

export type TipoAccionLLM =
  | "saque"
  | "recepcion"
  | "armado"
  | "ataque"
  | "bloqueo"
  | "defensa"
  | "libre"
  | "cualquiera";

export type ResultadoLLM =
  | "punto"
  | "error"
  | "neutro"
  | "ace"
  | "perfecta"
  | "positiva"
  | "negativa"
  | "cualquiera";

export type GroupByLLM =
  | "jugador"
  | "set"
  | "rotacion"
  | "fase"
  | "subtipo"
  | "zona_origen"
  | "zona_destino";

export type MetricaLLM =
  | "count"
  | "puntos_ganados"
  | "kill_pct"
  | "attack_efficiency"
  | "reception_pct"
  | "ace_pct"
  | "sideout_pct"
  | "break_point_pct"
  | "block_efficiency"
  | "dig_efficiency";

export type DesgloseLLM =
  | "positivo"
  | "negativo"
  | "neutro"
  | "punto"
  | "error";

export type TiempoTipoLLM =
  | "ultimos_n_partidos"
  | "ultimos_n_sets"
  | "ultimos_n_jugadas"
  | "este_ano"
  | "este_mes"
  | "esta_semana"
  | "temporada_pasada"
  | "set_especifico"
  | "dia_semana";

export type DiaSemanaLLM =
  | "lunes"
  | "martes"
  | "miercoles"
  | "jueves"
  | "viernes"
  | "sabado"
  | "domingo";

export interface FiltrosLLM {
  faseRally?: FaseRallyLLM;
  tipoAccion?: TipoAccionLLM;
  resultado?: ResultadoLLM;
  jugador?: string | null;
  set?: number | null;
  rotacion?: number | null;
  zonaJugador?: number | null;
}

export interface TiempoLLM {
  tipo: TiempoTipoLLM;
  n?: number | null;
  set?: number | null;
  diaSemana?: DiaSemanaLLM | null;
}

export interface ConsultaLLM {
  filtros?: FiltrosLLM;
  tiempo?: TiempoLLM;
  groupBy?: GroupByLLM[];
  metrica?: MetricaLLM;
  desglose?: DesgloseLLM[];
  orden?: "asc" | "desc";
  limite?: number | null;
  needsClarification?: boolean;
  pregunta?: string | null;
}

// ------------------------------------------------------------
// SYSTEM PROMPT (v2 — incluye `tiempo`)
// ------------------------------------------------------------
// Este string va TAL CUAL al campo `system` del chat completion.
// El LLM lo lee y devuelve JSON siguiendo el schema.
//
// Cambios respecto a la v1 (que probaste en el playground):
//   + Se agrega `tiempo` al schema.
//   + Se agrega un ejemplo con `tiempo`.
// ============================================================

export const SYSTEM_PROMPT = `Sos un traductor de consultas de vóley a JSON estructurado.
Tu ÚNICO trabajo es leer el pedido del usuario y devolver un JSON
que cumpla el schema que te paso abajo. NO inventes campos nuevos.
NO expliques. Devolvés SOLO el JSON.

═══════════════════════════════════════════
SCHEMA (todos los campos son opcionales)
═══════════════════════════════════════════

{
  "filtros": {
    "faseRally": "side-out" | "k1" | "k2" | "k3" | "contraataque" | "free-ball" | "cualquiera",
    "tipoAccion": "saque" | "recepcion" | "armado" | "ataque" | "bloqueo" | "defensa" | "libre" | "cualquiera",
    "resultado": "punto" | "error" | "neutro" | "ace" | "perfecta" | "positiva" | "negativa" | "cualquiera",
    "jugador": "nombre o apodo del jugador o null",
    "set": número 1-5 o null,
    "rotacion": número 1-6 o null,
    "zonaJugador": número 1-6 o null
  },
  "tiempo": {
    "tipo": "ultimos_n_partidos" | "ultimos_n_sets" | "ultimos_n_jugadas" | "este_ano" | "este_mes" | "esta_semana" | "temporada_pasada" | "set_especifico" | "dia_semana",
    "n": número o null,
    "set": número 1-5 o null,
    "diaSemana": "lunes" | "martes" | "miercoles" | "jueves" | "viernes" | "sabado" | "domingo" | null
  },
  "groupBy": ["jugador" | "set" | "rotacion" | "fase" | "subtipo" | "zona_origen" | "zona_destino"],
  "metrica": "count" | "puntos_ganados" | "kill_pct" | "attack_efficiency" | "reception_pct" | "ace_pct" | "sideout_pct" | "break_point_pct" | "block_efficiency" | "dig_efficiency",
  "desglose": ["positivo", "negativo", "neutro", "punto", "error"],
  "orden": "asc" | "desc",
  "limite": número o null,
  "needsClarification": boolean,
  "pregunta": "pregunta para aclarar la ambigüedad o null"
}

═══════════════════════════════════════════
GLOSARIO DE VÓLEY
═══════════════════════════════════════════

FASES DE RALLY:
- "k1" / "side-out" / "complejo 1" → faseRally: "k1"
- "k2" / "contraataque desde defensa" → faseRally: "k2"
- "k3" / "contraataque desde cobertura" → faseRally: "k3"
- "free ball" / "pelota libre" → faseRally: "free-ball"
- "contraataque" (genérico) → faseRally: "contraataque"

TIPOS DE ACCIÓN:
- saque, recepción, armado/colocación, ataque/remate,
  bloqueo, defensa, libre/entrega.

MÉTRICAS:
- "cuántos X" → metrica: "count"
- "cuántos puntos" (sin más contexto) → metrica: "puntos_ganados"
- "% de kill" / "porcentaje de punto de ataque" → "kill_pct"
- "eficiencia de ataque" / "efectividad atacando" → "attack_efficiency"
- "calidad de recepción" / "% de recepción" → "reception_pct"
- "% de aces" → "ace_pct"
- "% de side-out" → "sideout_pct"
- "% de break point" → "break_point_pct"
- "eficiencia de bloqueo" → "block_efficiency"
- "eficiencia de defensa" → "dig_efficiency"

TIEMPO:
- "últimos N partidos" → tiempo.tipo: "ultimos_n_partidos", n: N
- "últimos N sets" → tiempo.tipo: "ultimos_n_sets", n: N
- "último mes" → tiempo.tipo: "este_mes"
- "este año" → tiempo.tipo: "este_ano"
- "esta semana" → tiempo.tipo: "esta_semana"
- "el año pasado" → tiempo.tipo: "temporada_pasada"
- "el set 3" (aislado) → tiempo.tipo: "set_especifico", set: 3
- "los viernes" → tiempo.tipo: "dia_semana", diaSemana: "viernes"
- IMPORTANTE: si dice "en el set 3 de los últimos 5 partidos",
  devolver tiempo.tipo: "ultimos_n_partidos", n: 5, set: 3 (combinado).

═══════════════════════════════════════════
REGLAS DE AMBIGÜEDAD
═══════════════════════════════════════════

Si el pedido es ambiguo, NO adivines. Devolvé:
{
  "needsClarification": true,
  "pregunta": "pregunta concreta con 2-3 opciones"
}

Casos que SIEMPRE requieren clarificación:
- "cuántos puntos" sin contexto → ¿ganados, totales, o ataques punto?
- "el mejor" sin decir en qué métrica → ¿kill %, eficiencia, puntaje?
- "cómo jugamos" sin métrica → ¿cuántas acciones, % de éxito, o distribución?
- "efectividad" sin decir de qué (ataque, bloqueo, defensa) →
  preguntar cuál, PERO SI VIENE CON TIEMPO, incluir el tiempo en
  el contexto de la pregunta (ej: "¿efectividad de ataque, bloqueo
  o defensa, de los últimos 3 partidos?").

═══════════════════════════════════════════
EJEMPLOS
═══════════════════════════════════════════

Input: "cómo atacan en k1, cuántos ataques positivos, negativos y neutros"
Output: {
  "filtros": { "faseRally": "k1", "tipoAccion": "ataque" },
  "groupBy": ["subtipo"],
  "metrica": "count",
  "desglose": ["positivo", "negativo", "neutro"]
}

Input: "qué salida es más eficaz"
Output: {
  "groupBy": ["zona_origen"],
  "metrica": "attack_efficiency",
  "orden": "desc",
  "limite": 1
}

Input: "qué fase del juego nos da menos puntos"
Output: {
  "groupBy": ["fase"],
  "metrica": "puntos_ganados",
  "orden": "asc",
  "limite": 1
}

Input: "cuántos puntos hizo Joaco en el set 3"
Output: {
  "filtros": { "jugador": "Joaco", "set": 3 },
  "metrica": "puntos_ganados"
}

Input: "cuántos puntos"
Output: {
  "needsClarification": true,
  "pregunta": "¿Querés saber puntos ganados, puntos totales jugados, o ataques que terminaron en punto?"
}

Input: "cómo viene la efectividad en los últimos 3 partidos"
Output: {
  "tiempo": { "tipo": "ultimos_n_partidos", "n": 3 },
  "metrica": "attack_efficiency"
}

Input: "distribución de saques por zona destino"
Output: {
  "filtros": { "tipoAccion": "saque" },
  "groupBy": ["zona_destino"],
  "metrica": "count"
}

Input: "aces del set 3 de los últimos 5 partidos"
Output: {
  "filtros": { "tipoAccion": "saque", "resultado": "ace" },
  "tiempo": { "tipo": "ultimos_n_partidos", "n": 5, "set": 3 },
  "metrica": "count"
}
`;

// ------------------------------------------------------------
// VALIDADOR BÁSICO (defensivo)
// ------------------------------------------------------------
// Verifica que el JSON del LLM tenga forma de `ConsultaLLM`.
// NO valida semántica profunda (eso lo hace el motor existente).
// ------------------------------------------------------------

export function esConsultaLLMValida(v: unknown): v is ConsultaLLM {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;

  // Si pide aclaración, exigimos la pregunta.
  if (o.needsClarification === true) {
    return typeof o.pregunta === "string" && o.pregunta.length > 0;
  }

  // Si no pide aclaración, tiene que haber algo útil.
  if (o.filtros && typeof o.filtros !== "object") return false;
  if (o.tiempo && typeof o.tiempo !== "object") return false;
  if (o.groupBy !== undefined && !Array.isArray(o.groupBy)) return false;
  if (o.desglose !== undefined && !Array.isArray(o.desglose)) return false;
  if (o.orden !== undefined && o.orden !== "asc" && o.orden !== "desc") {
    return false;
  }
  if (o.limite !== undefined && o.limite !== null && typeof o.limite !== "number") {
    return false;
  }

  return true;
}