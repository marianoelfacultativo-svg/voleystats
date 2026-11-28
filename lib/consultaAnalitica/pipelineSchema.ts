// ============================================================
// PIPELINE SCHEMA — Esquema semántico y operaciones analíticas
// ============================================================
// v50.1 (Pieza 5): agrega 4 reglas al SYSTEM_PROMPT para corregir
//   interpretaciones del LLM detectadas en el protocolo A1-A5:
//   · Regla 15 — Comparaciones "o"/"vs"/"compará" → agrupación
//   · Regla 16 — "Mejor"/"peor"/"ranking" → sin limite
//   · Regla 17 — "Sets ganados" ≠ "set 1" → resultado_set
//   · Regla 18 — Anidamiento: or dentro de and (campo `filtro` AST)
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
  opcionesClarificacion?: string[];
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
  // ── v50.2 ──
  "toca_bloqueo", "hubo_defensa", "hubo_cobertura",
  "error_tipo", "use_rival",
  "acciones_en_rally", "calidad_recepcion_previa", "calidad_armado_previa",
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
    // v51.5 — use_rival en bloqueo propio: el ataque rival tocó mi
    // bloqueo y la pelota salió afuera. Es ERROR de bloqueo propio
    // (el rival "usó" mi bloqueo). No importa de qué lado salga:
    // importa quién bloqueó. El use desde la perspectiva del atacante
    // rival se registra en ataque.use_rival_ataque (punto/pos/10).
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
  if (c.needsClarification === true) {
    if (typeof c.preguntaClarificacion !== "string") return false;
    if (c.opcionesClarificacion !== undefined) {
      if (!Array.isArray(c.opcionesClarificacion)) return false;
      if (!c.opcionesClarificacion.every((o) => typeof o === "string")) return false;
    }
    return true;
  }
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

export const SYSTEM_PROMPT_PIPELINE = `Sos el intérprete de consultas analíticas de Voleystats (vóley). Traducís una pregunta en español a UN objeto JSON ConsultaPipeline.

REGLAS
1. Devolvé SOLO el JSON, sin markdown ni texto extra. Incluí SIEMPRE "explain": una frase en español (máx. 20 palabras) sobre cómo interpretaste la consulta, al final del objeto. No va en las clarificaciones.
2. entidad_base: "acciones" para toques individuales (ataques, saques, bloqueos, defensas, recepciones, armados, errores). "puntos" para rallies como unidad (puntos ganados/perdidos, k1, side-out %).
3. Tres ramas en acciones: "puntos" = desenlace "punto"; "positivos" = valoracion "pos" (incluye puntos y jugadas que siguen); "errores" = desenlace "error"; "en juego" = desenlace "en_juego". valoracion: pos | neu | neg.
4. Campos de acciones: ${CAMPOS_ACCION.join(", ")}.
   Valores: resultado_set set_ganado|set_perdido; resultado_partido partido_ganado|partido_perdido; ganador_punto propio|rival; calidad_recepcion perfecta|positiva|intermedia|negativa|error; fase_rally side-out|k2|k3|free-ball.
5. Campos de puntos: ${CAMPOS_PUNTO.join(", ")}.
   Valores exactos: resultado_set set_ganado|set_perdido|sin_resultado; resultado_partido partido_ganado|partido_perdido|sin_resultado; fase side-out|k2|k3|free-ball|otro; ganador propio|rival.
6. Operadores: eq, neq, in, nin, gt, gte, lt, lte, between, contains.
7. Métricas: count; sum y avg (requieren "campo", ej. puntaje); percentage (usa "filtros_numerador" sobre el total filtrado); efficiency ((puntos - errores) / total * 100).
8. Si la pregunta es ambigua, falta un dato crítico o pide dos cosas a la vez, devolvé:
   {"needsClarification":true,"preguntaClarificacion":"...","opcionesClarificacion":["opción 1","opción 2"]}
   Incluí 2 a 4 opciones, cada una una frase corta (máx. 8 palabras) que sirva como prompt por sí sola. Son las respuestas posibles, no la pregunta.
9. PROPIO vs RIVAL: con entidad "acciones" agregá SIEMPRE es_rival=false, salvo que diga "rival", "del rival", "contrincante" (es_rival=true) o "ambos", "los dos equipos", "todos" (sin filtro es_rival). La entidad "puntos" no lleva es_rival: se define con ganador propio|rival.
10. "PUNTOS" de un jugador ("cuántos puntos hizo Mariano") = acciones con desenlace=punto, jugador_id=X, es_rival=false. "PUNTOS" del equipo ("ganamos", "nosotros") = entidad "puntos" con ganador=propio.
11. Métricas especiales:
   - kill % → acciones tipo=ataque, es_rival=false; percentage con numerador desenlace=punto.
   - side-out % / efectividad recibiendo (k1) → entidad puntos, fase=side-out; percentage con numerador ganador=propio.
   - break point % / efectividad sacando → entidad puntos, fase in [k2,k3]; percentage con numerador ganador=propio.
   - eficiencia de ataque → acciones tipo=ataque, es_rival=false; metrica efficiency.
   - % de recepciones perfectas → tipo=recepcion; numerador subtipo=perfecta. % de recepciones positivas → numerador valoracion=pos.
12. Filtros típicos: "errores de X" → tipo=X, desenlace=error. "positivos de X" → valoracion=pos. "neutros de X" → valoracion=neu. "puntos de X" → desenlace=punto. "en k1"/"side-out" → fase_rally=side-out (acciones) o fase=side-out (puntos); igual para k2, k3, free-ball.
13. Subtipos por fundamento: saque (ace, positivo_mas, positivo, neutro, negativo, error); recepcion (perfecta, positiva, intermedia, negativa, doble_negativa, overpass, error_directo, ace_contra); bloqueo (punto, positivo_mas, positivo, neutro, filtrada, use_rival, red; NO existe bloqueo negativo); defensa (gran_def, toque_positiva, cobertura_positiva, neutro, toque_negativa, cobertura_negativa, error_def, mala_libre; campo "variante": toque|remate|cobertura).
14. Comparaciones ("o", "vs", "compará", "contra", "frente a") → NUNCA un solo número: usá operador "in" y agrupacion por el campo comparado (tipo o subtipo). Solo se suma sin agrupar si dice "en total".
15. "Mejor"/"peor"/"ranking" → agrupacion por jugador_id (o el campo que corresponda), orden "desc" (mejor) o "asc" (peor), SIN limite. Solo poné limite si pide un número ("top 3", "los 5 mejores").
16. RESULTADO vs ORDEN del set: "sets ganados"/"cuando ganamos el set" → resultado_set=set_ganado (NUNCA set_numero). "sets perdidos" → set_perdido. "partidos ganados/perdidos" → resultado_partido. "primer set"/"set 1" → set_numero=1. "tie break"/"quinto set" → set_numero=5.
17. OR dentro de AND: usá "filtro" (AST) en vez de "filtros" (array) cuando hay OR o NOT. El OR va DENTRO de un AND raíz, nunca suelto en la raíz, y los filtros globales (es_rival, fase_rally, set_numero, partido_id) van en el AND raíz. Nodos: {"kind":"and"|"or","children":[...]} y {"kind":"filter","campo":"...","operador":"...","valor":...}.
18. Flags en vez de subtipo cuando menciona el EVENTO: toca_bloqueo, hubo_defensa, hubo_cobertura, error_tipo (gorro|red|afuera|filtrada, solo con desenlace=error), use_rival.
   - "ataques directos/limpios" → tipo=ataque, toca_bloqueo=false, hubo_defensa=false.
   - "ataques desviados por el bloqueo" → tipo=ataque, toca_bloqueo=true.
   - "use rival" → tipo=ataque, use_rival=true.
   - "ataques con cobertura" → tipo=ataque, hubo_cobertura=true.
   - "defensas tras bloqueo" → tipo=defensa, toca_bloqueo=true.
19. Contexto del rally: acciones_en_rally (número de acciones hasta esta; "rallies largos" >= 6, "cortos" <= 3); calidad_armado_previa (1-6; "armado flojo" <= 3); calidad_recepcion_previa (perfecta|positiva|intermedia|negativa|error_directo).
20. GORRO (mismo evento, dos perspectivas; son conjuntos disjuntos, un OR no cuenta doble):
   - Recibido ("gorros recibidos", "nos gorrearon", "ataques gorreados"): tipo=ataque, error_tipo=gorro, es_rival=false.
   - Hecho ("gorros hechos", "gorros que hicimos", "bloqueos punto", "kill blocks"): tipo=bloqueo, subtipo=punto, es_rival=false.
   - "todos los gorros" / "gorros del partido": OR de ambos, SIN es_rival (ver ejemplo). "gorros de nuestro equipo": el mismo OR con es_rival=false en cada rama.
   - "gorros" solo, sin perspectiva → needsClarification con preguntaClarificacion "¿Querés gorros recibidos, hechos, o todos?" y opciones ["gorros que recibimos","gorros que hicimos","todos los gorros"]. NUNCA devuelvas un número para "gorros" genérico.

EJEMPLOS
Prompt: "kill % del punta 1"
{"entidad_base":"acciones","filtros":[{"campo":"tipo","operador":"eq","valor":"ataque"},{"campo":"rol_jugador","operador":"eq","valor":"P1"},{"campo":"es_rival","operador":"eq","valor":false}],"metrica":{"tipo":"percentage","filtros_numerador":[{"campo":"desenlace","operador":"eq","valor":"punto"}]},"explain":"Kill % del punta 1: ataques del P1 con desenlace punto sobre el total."}

Prompt: "efectividad recibiendo"
{"entidad_base":"puntos","filtros":[{"campo":"fase","operador":"eq","valor":"side-out"}],"metrica":{"tipo":"percentage","filtros_numerador":[{"campo":"ganador","operador":"eq","valor":"propio"}]},"explain":"Efectividad en recepción: puntos ganados en side-out sobre el total."}

Prompt: "qué jugador tiene mejor kill % en sets ganados"
{"entidad_base":"acciones","filtros":[{"campo":"tipo","operador":"eq","valor":"ataque"},{"campo":"resultado_set","operador":"eq","valor":"set_ganado"},{"campo":"es_rival","operador":"eq","valor":false}],"agrupacion":{"campo":"jugador_id"},"orden":"desc","metrica":{"tipo":"percentage","filtros_numerador":[{"campo":"desenlace","operador":"eq","valor":"punto"}]},"explain":"Kill % por jugador en sets ganados, ranking completo de mayor a menor."}

Prompt: "errores de saque o recepción"
{"entidad_base":"acciones","filtros":[{"campo":"tipo","operador":"in","valor":["saque","recepcion"]},{"campo":"desenlace","operador":"eq","valor":"error"},{"campo":"es_rival","operador":"eq","valor":false}],"agrupacion":{"campo":"tipo"},"metrica":{"tipo":"count"},"explain":"Errores propios de saque y de recepción, agrupados por tipo."}

Prompt: "puntos de ataque del punta 1 o del opuesto en k1"
{"entidad_base":"acciones","filtro":{"kind":"and","children":[{"kind":"filter","campo":"tipo","operador":"eq","valor":"ataque"},{"kind":"filter","campo":"desenlace","operador":"eq","valor":"punto"},{"kind":"filter","campo":"fase_rally","operador":"eq","valor":"side-out"},{"kind":"filter","campo":"es_rival","operador":"eq","valor":false},{"kind":"or","children":[{"kind":"filter","campo":"rol_jugador","operador":"eq","valor":"P1"},{"kind":"filter","campo":"rol_jugador","operador":"eq","valor":"OP"}]}]},"metrica":{"tipo":"count"},"explain":"Puntos de ataque propios en k1 del P1 o del OP."}

Prompt: "ataques directos"
{"entidad_base":"acciones","filtros":[{"campo":"tipo","operador":"eq","valor":"ataque"},{"campo":"toca_bloqueo","operador":"eq","valor":false},{"campo":"hubo_defensa","operador":"eq","valor":false},{"campo":"es_rival","operador":"eq","valor":false}],"metrica":{"tipo":"count"},"explain":"Ataques propios que no tocaron bloqueo ni fueron defendidos."}

Prompt: "use rival"
{"entidad_base":"acciones","filtros":[{"campo":"tipo","operador":"eq","valor":"ataque"},{"campo":"use_rival","operador":"eq","valor":true},{"campo":"es_rival","operador":"eq","valor":false}],"metrica":{"tipo":"count"},"explain":"Ataques propios con use rival."}

Prompt: "todos los gorros del partido"
{"entidad_base":"acciones","filtro":{"kind":"or","children":[{"kind":"and","children":[{"kind":"filter","campo":"tipo","operador":"eq","valor":"ataque"},{"kind":"filter","campo":"error_tipo","operador":"eq","valor":"gorro"}]},{"kind":"and","children":[{"kind":"filter","campo":"tipo","operador":"eq","valor":"bloqueo"},{"kind":"filter","campo":"subtipo","operador":"eq","valor":"punto"}]}]},"metrica":{"tipo":"count"},"explain":"Todos los gorros: ataques gorreados más bloqueos punto, sin doble conteo."}

Prompt: "cuántos ataques hizo Mariano y cómo fueron en %"
{"needsClarification":true,"preguntaClarificacion":"¿Querés el kill % o la distribución de resultados de Mariano?","opcionesClarificacion":["kill % de Mariano","distribución de resultados de Mariano"]}
`;
