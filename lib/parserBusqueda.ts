// ============================================================
// PARSER DE BÚSQUEDA — v3.4
// Fix: "R" suelto = remate de segunda. Detección de R#, R+,
// R!, R-, R--, R/, R= sobre el texto ORIGINAL (antes de
// normalizar, porque normalizar() borra los símbolos).
// ============================================================

import {
  BLOQUE_TRIGGER_VACIO,
  CONTEXTO_PARTIDO_VACIO,
  FILTRO_ACCION_HISTORICA_VACIO,
  resultadosPorTipoAnalisis,
  type BloqueTriggerFiltro,
  type CierraPuntoFiltro,
  type FiltroAccionHistorica,
  type RachaHistorica,
  type RachaJugadorFiltro,
  type RelacionJugador,
  type TipoDisparador,
  type TipoRachaJugador,
  type UbicacionFiltro,
} from "./analisisConsecuencias";

// ------------------------------------------------------------
// TIPOS PÚBLICOS
// ------------------------------------------------------------

export type CategoriaMatch =
  | "tipo"
  | "resultado"
  | "jugador"
  | "set"
  | "punto"
  | "partido"
  | "rol"
  | "zona"
  | "rotacion"
  | "velocidad"
  | "tipo-saque"
  | "previa"
  | "racha-jugador"
  | "top"
  | "vs-promedio"
  | "contexto"
  | "posicion-set";

export interface MatchParser {
  clave: string;
  valor: string;
  categoria: CategoriaMatch;
  fragmento: string;
}

export interface ResultadoParser {
  filtro: BloqueTriggerFiltro;
  matches: MatchParser[];
  noReconocidas: string[];
  sugerencias: string[];
  aplicado: boolean;
}

export interface ContextoParser {
  jugadores?: { id: string; nombre: string }[];
  partidos?: { id: string; nombre: string }[];
}

// ------------------------------------------------------------
// UTILIDADES
// ------------------------------------------------------------

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,;:!?¡¿"“”‘’()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function contiene(texto: string, ...claves: string[]): boolean {
  return claves.some((c) => texto.includes(c));
}

// ------------------------------------------------------------
// DETECCIÓN DE SÍMBOLOS DE RECEPCIÓN (texto original)
// ------------------------------------------------------------
//
// Va sobre textoOriginal (con símbolos intactos). Si normalizamos
// antes, "R!" queda en "r" y perdemos la distinción.
//
// Orden: primero los símbolos más largos (R--) para no comerse
// "R-" antes de tiempo.

interface RecepcionSimbolo {
  valor: string;
  fragmento: string;
}

function detectarSimboloRecepcion(
  textoOriginal: string
): RecepcionSimbolo | null {
  const t = textoOriginal;

  // R doble negativa (R--)
  if (/R\s*--/.test(t)) return { valor: "doble_negativa", fragmento: "R--" };
  // R# perfecta
  if (/R\s*#/.test(t)) return { valor: "perfecta", fragmento: "R#" };
  // R+ positiva
  if (/R\s*\+/.test(t)) return { valor: "positiva", fragmento: "R+" };
  // R! exclamativa
  if (/R\s*!/.test(t)) return { valor: "intermedia", fragmento: "R!" };
  // R/ overpass
  if (/R\s*\//.test(t)) return { valor: "overpass", fragmento: "R/" };
  // R= error directo
  if (/R\s*=/.test(t)) return { valor: "error_directo", fragmento: "R=" };
  // R- negativa (después de R--)
  if (/R\s*-(?!-)/.test(t)) return { valor: "negativa", fragmento: "R-" };

  return null;
}

// ------------------------------------------------------------
// DETECCIÓN DE "R" SUELTO = REMATE DE SEGUNDA
// ------------------------------------------------------------
//
// "R" con límites de palabra, pero sin símbolo pegado detrás.
// Ejemplos que SÍ:
//   "r", "r de juan", "juan r", "r en cierre"
// Ejemplos que NO:
//   "r!" (lo captura detectarSimboloRecepcion primero)
//   "remate" (r pegada a letra)
//   "R1" (r pegada a número → rotación)

function detectarRSuelto(textoOriginal: string): boolean {
  // Word boundary manual: "r" entre no-alfanuméricos o en los extremos.
  // Excluye casos donde "r" tiene un símbolo pegado (R#, R!, etc.).
  const t = textoOriginal;
  return /(^|[^A-Za-z0-9])R(?![#+\-!=/A-Za-z0-9])/i.test(t);
}

// ------------------------------------------------------------
// DICCIONARIOS (mantengo la expansión de jerga)
// ------------------------------------------------------------

const SINONIMOS_TIPO: Record<TipoDisparador, string[]> = {
  saque: [
    "saque", "saques", "sacar", "saca", "servicio", "servir",
    "saque de tenis", "saque chino", "gancho", "gancho flotante",
    "saque flotante", "saque flotado", "flotado", "flotante",
    "salto flotante", "salto potencia", "en suspension",
    "mano baja", "seguridad", "saque de seguridad", "batida",
    "saque de abajo", "saque por encima", "saque en salto",
    "saque bomba", "bomba",
  ],
  recepcion: [
    "recepcion", "recepciones", "recibir", "recibe", "recibo",
    "pase de recepcion", "bagre", "plataforma", "antebrazos",
    "shank", "costura", "stack", "mancheta", "pala",
    "golpe de abajo", "golpe de antebrazos", "toque de antebrazos",
    "voleo bajo", "pase de antebrazos", "golpe de manos bajas",
    "recepcion alta", "recepcion media", "recepcion baja",
    "recepcion al bigote", "bigote",
  ],
  armado: [
    "armado", "armados", "armar", "arma", "set", "pase",
    "toque de dedos", "voleo", "colocacion", "colocada",
    "levantada", "levantamiento", "golpe de arriba",
    "toque de dedos (yema)", "voleo alto", "golpe de manos altas",
    "pase-colocacion", "colocacion en salto", "armado en suspension",
    "toque de dedos en salto", "dirigir la orquesta", "llevar la batuta",
    "cpu del equipo",
  ],
  ataque: [
    "ataque", "ataques", "atacar", "ataca", "remate", "remates",
    "spike", "kill", "clavar", "smash", "downball", "matar",
    "bombear", "finta", "dejada", "toque suave", "tipping",
    "avion", "iberia", "remate de segunda", "toque de segunda",
    "roll shot", "ataque de segunda", "remate de segundo tiempo",
    "paralela", "diagonal", "cruzado", "en linea", "tendido",
    "ataque por 4", "ataque por 2", "ataque por 6", "pipe",
    "mate", "galleta", "misil", "castaña", "palomo", "palomazo",
    "bombazo", "cañonazo",
  ],
  bloqueo: [
    "bloqueo", "bloqueos", "bloquear", "bloquea", "muro",
    "pantalla", "cortina", "pared", "muralla", "tapon", "cerrar",
    "bloqueo doble", "bloqueo triple", "toque de bloqueo",
    "bloqueo ofensivo", "bloqueo defensivo", "bloqueo activo",
    "bloqueo pasivo", "gorro", "chapa", "pincho", "techar",
    "gorrear", "bloqueo a fuego",
  ],
  defensa: [
    "defensa", "defensas", "defender", "defiende", "dig",
    "plancha", "pancake", "salvada", "atajada", "secante",
    "caida", "palomita", "rastrillada", "cavar", "pescar",
    "defensa de segunda linea", "defensa de campo",
    "defensa positiva", "defensa negativa", "defensa de bloqueo",
    "cobertura", "apoyo",
  ],
  libre: [
    "libre", "libres", "pelota libre", "pelotas libres",
    "free ball", "freeball", "entrega",
  ],
  "roce-red": [
    "roce red", "roce de red", "roce-red", "rocen la red",
    "toca la red", "invasion", "invasión", "pasarse de la red",
  ],
};

const SINONIMOS_RESULTADO: Record<TipoDisparador, Record<string, string[]>> = {
  saque: {
    ace: ["ace", "aces", "punto directo de saque", "as", "servicio directo"],
    positivo_mas: ["positivo+", "positivo mas", "pos+", "pos mas"],
    positivo: ["positivo", "pos"],
    neutro: ["neutro"],
    negativo: ["negativo", "neg", "error", "error de saque", "errar el saque", "afuera el saque", "palomo"],
  },
  recepcion: {
    perfecta: [
      "perfecta", "r#", "r perfecta", "doble positiva",
      "2x positiva", "2x_positiva", "mancheta perfecta",
      "recepcion al bigote", "bigote",
    ],
    positiva: ["positiva", "r+", "r positiva", "buena recepcion", "mancheta limpia"],
    intermedia: [
      "intermedia", "exclamativa", "exclamacion", "r!", "r exclamativa",
      "r intermedia", "!", "mancheta intermedia",
    ],
    negativa: ["negativa", "r-", "r negativa", "mala recepcion", "mancheta sucia"],
    doble_negativa: ["doble negativa", "r--", "r doble negativa", "2x negativa", "2x_negativa"],
    overpass: ["overpass", "r/", "pasa al rival", "se le fue para el otro lado"],
    error_directo: ["error directo", "r=", "ace en contra", "ace_contra", "no la toco"],
  },
  armado: {
    "1": ["1", "horrible", "malo", "desastre"],
    "2": ["2", "flojo", "impreciso"],
    "3": ["3", "regular", "aceptable"],
    "4": ["4", "correcto", "bueno"],
    "5": ["5", "perfecto", "excelente"],
    "6": ["6", "genial", "impecable"],
    R: ["rechazo", "no puede armar", "error de armado"],
  },
  ataque: {
    punto: ["punto", "punto directo", "kill", "termino en punto", "mato", "clavo", "bombeo", "mate"],
    neutro: ["neutro", "no termino", "siguio el rally", "defendido"],
    error: ["error", "errar", "erró", "erro", "afuera", "a la red", "gorro", "avion", "iberia", "desviado", "palomo", "galleta"],
    error_afuera_ataque: ["error afuera", "afuera", "se fue largo", "se fue ancho", "palomo", "palomazo"],
    error_red_ataque: ["error red", "a la red", "red", "toco la red"],
    gorro_ataque: ["gorro", "gorro_ataque", "tapada", "tapado", "chapa", "pincho"],
    use_rival_ataque: ["use rival", "block out", "block-out", "usa el bloqueo"],
    finta: ["finta", "dejada", "toque suave", "roll shot"],
    toque: [
      "toque",
      "remate de toque",
      "toque de segunda",
      "remate de segunda",
      "remate de 2da",
      "remate segunda",
    ],
  },
  bloqueo: {
    punto: ["punto", "punto directo", "tapon", "tapada", "gorro", "chapa", "pincho"],
    positivo_mas: ["positivo+", "pos+", "bloqueo positivo+"],
    positivo: ["positivo", "pos", "bloqueo positivo"],
    neutro: ["neutro", "bloqueo neutro"],
    use_rival: ["use rival", "usa el bloqueo", "desviado afuera"],
    red: ["red", "a la red", "toco la red"],
    filtrada: ["filtrada", "filtro", "filtrada por el bloqueo"],
  },
  defensa: {
    toque_positiva: ["toque positiva", "toque+", "defensa positiva"],
    toque_negativa: ["toque negativa", "toque-", "defensa negativa"],
    gran_def: ["gran defensa", "gran def", "gran-defensa", "defenson", "atijada", "salvada"],
    error_def: ["error defensa", "error def", "error_def", "no la levanto"],
    mala_libre: ["mala libre", "mala_libre", "libre malo"],
    cobertura_positiva: ["cobertura positiva", "cob+", "cobertura+"],
    cobertura_negativa: ["cobertura negativa", "cob-", "cobertura-"],
    errores_graves: ["error grave", "errores graves", "error grosero"],
    neutro: ["neutro", "defensa neutra"],
  },
  libre: {
    toque: ["toque", "toque libre"],
    libre: ["libre"],
  },
  "roce-red": {
    "ofensivo-propio": ["ofensivo propio", "roce ofensivo"],
    "invasion-zaguero": ["invasion zaguero", "invadio el zaguero"],
    "invasion-delantero": ["invasion delantero", "invadio el delantero"],
    "roce-red-rival": ["roce rival", "roce red rival"],
  },
};

const SINONIMOS_ROL: Record<string, string[]> = {
  A: ["armador", "levantador", "colocador", "setter", "pasador", "armadora"],
  O: ["opuesto", "opuesta"],
  C1: ["central 1", "central1", "c1"],
  C2: ["central 2", "central2", "c2"],
  P1: ["punta 1", "punta1", "p1"],
  P2: ["punta 2", "punta2", "p2"],
  L: ["libero", "líbero", "libera"],
};

const ROLES_GENERICOS: Record<string, string[]> = {
  central: ["central", "centrales", "bloqueador central"],
  punta: ["punta", "puntero", "ala", "punta receptor", "receptor-atacante"],
  zaguero: ["zaguero", "zaguera", "back row", "fondo"],
  delantero: ["delantero", "delantera", "front row", "red"],
};

interface LlamadaDef {
  nombre: string;
  sinonimos: string[];
  velocidad?: number;
  descripcion: string;
}

const LLAMADAS: LlamadaDef[] = [
  { nombre: "hatu", sinonimos: ["hatu", "jatu", "hut", "go"], velocidad: 1, descripcion: "Primer tiempo con el central" },
  { nombre: "corta atras", sinonimos: ["corta atras", "corta atrás", "hanati", "hanatí", "hanati corta"], velocidad: 1, descripcion: "Primer tiempo atrás del central" },
  { nombre: "shoot", sinonimos: ["shoot", "flecha", "seven", "siete", "odka", "blue"], velocidad: 1, descripcion: "Primer tiempo por 4 o 2" },
  { nombre: "superfast", sinonimos: ["superfast", "super fast", "super rapida"], velocidad: 1, descripcion: "Rápida a 4" },
  { nombre: "v", sinonimos: [" v ", "uve", "bola v", "pelota v"], velocidad: 1, descripcion: "Rápida en V por 2" },
  { nombre: "bic", sinonimos: ["bic", "pipe rapida", "pipe rápida", "bick"], velocidad: 1, descripcion: "Pipe rápida" },
  { nombre: "pipe", sinonimos: ["pipe", "paip"], velocidad: 1.5, descripcion: "Semi por 6 con el punta zaguero" },
  { nombre: "pipe semi", sinonimos: ["pipe semi", "pipe lenta", "pipe alto"], velocidad: 1.5, descripcion: "Pipe semi" },
  { nombre: "hanati volada", sinonimos: ["hanati volada", "hanatí volada", "volada"], velocidad: 1.5, descripcion: "Semi con el central por atrás" },
  { nombre: "slide", sinonimos: ["slide", "vti", "veti", "salida en v"], velocidad: 1.5, descripcion: "Salida en V por atrás con central" },
  { nombre: "quick", sinonimos: ["quick", "rapida", "rápida"], velocidad: 1, descripcion: "Rápida genérica" },
  { nombre: "alta", sinonimos: ["alta", "bola alta", "pelota alta"], velocidad: 5, descripcion: "Pelota alta a la punta" },
  { nombre: "v con c", sinonimos: ["v con c", "v y c", "combinacion v c"], velocidad: 1, descripcion: "Combinación V + C" },
  { nombre: "doble v", sinonimos: ["doble v", "doble uve"], velocidad: 1, descripcion: "Combinación doble V" },
];

const SINONIMOS_VELOCIDAD: { patrones: string[]; valor: number }[] = [
  { patrones: ["muy alta", "alta lejana", "bola muy alta"], valor: 5 },
  { patrones: ["rapida", "rápida", "primer tiempo", "quick"], valor: 1 },
  { patrones: ["semi", "semi rapida", "semi rápida"], valor: 1.5 },
  { patrones: ["alta", "bola alta", "pelota alta"], valor: 2 },
  { patrones: ["segundo tiempo", "segunda linea"], valor: 2 },
  { patrones: ["tercer tiempo"], valor: 3 },
];

const SINONIMOS_FASE_RALLY: Record<string, string[]> = {
  "side-out": ["side-out", "side out", "k1", "ki", "lado saque", "complejo 1"],
  "free-ball": ["free ball", "freeball", "free-ball", "entrega"],
};

const SINONIMOS_INICIO_PUNTO: Record<string, string[]> = {
  ace_propio: ["ace propio", "ace nuestro", "ace de mi equipo"],
  ace_rival: ["ace rival", "ace del rival", "ace en contra"],
  recepcion_positiva: ["recepcion positiva al inicio", "inicio con recepcion positiva"],
  recepcion_neutra: ["recepcion neutra al inicio"],
  recepcion_negativa: ["recepcion negativa al inicio"],
  overpass: ["overpass al inicio", "inicio con overpass"],
  error_directo: ["error directo al inicio"],
};

const SINONIMOS_K2K3: Record<string, string[]> = {
  k2: ["k2", "k 2", "contraataque desde defensa", "contraataque de defensa", "break point", "break-point"],
  k3: ["k3", "k 3", "contraataque desde cobertura", "contraataque de cobertura", "complejo 3"],
};

const SINONIMOS_CONTEXTO = {
  cierre: [
    { texto: ["cierre de set", "cierre del set", "puntos para cerrar", "para cerrar el set"], valor: "<=3" as const },
    { texto: ["match point", "punto de partido", "matchpoint", "punto de set"], valor: "<=1" as const },
    { texto: ["puntos para cerrar el partido"], valor: "<=3" as const },
  ],
  criticos: ["punto critico", "puntos criticos", "critico", "criticos"],
  estado: [
    { texto: ["empatado", "empatados", "empatar"], valor: "empatado" as const },
    { texto: ["ganando", "arriba en el marcador"], valor: "ganando" as const },
    { texto: ["perdiendo", "abajo en el marcador"], valor: "perdiendo" as const },
  ],
  primerPunto: ["primer punto", "primer punto del set", "primer rally"],
  ultimoPunto: ["ultimo punto", "último punto", "ultimo punto del set", "cierre del set"],
};

// ------------------------------------------------------------
// EXTRACTORES
// ------------------------------------------------------------

interface ExtractionState {
  matches: MatchParser[];
  noReconocidas: string[];
  texto: string;
  tokensConsumidos: Set<string>;
}

function agregarMatch(
  st: ExtractionState,
  clave: string,
  valor: string,
  categoria: CategoriaMatch,
  fragmento: string
) {
  if (st.matches.some((m) => m.clave === clave && m.valor === valor)) return;
  st.matches.push({ clave, valor, categoria, fragmento });
}

function extraerJugador(
  st: ExtractionState,
  jugadores: { id: string; nombre: string }[] | undefined
): string | null {
  if (!jugadores || jugadores.length === 0) return null;
  const ordenados = [...jugadores].sort((a, b) => b.nombre.length - a.nombre.length);
  for (const j of ordenados) {
    const nNorm = normalizar(j.nombre);
    if (!nNorm) continue;
    if (st.texto.includes(nNorm)) {
      agregarMatch(st, "jugador", j.nombre, "jugador", nNorm);
      for (const t of nNorm.split(" ")) if (t.length >= 3) st.tokensConsumidos.add(t);
      return j.id;
    }
  }
  return null;
}

function extraerTipo(st: ExtractionState): TipoDisparador | null {
  const texto = st.texto;
  for (const [tipo, sinonimos] of Object.entries(SINONIMOS_TIPO) as [TipoDisparador, string[]][]) {
    for (const s of sinonimos) {
      if (texto.includes(s)) {
        agregarMatch(st, "tipo", tipo, "tipo", s);
        for (const t of s.split(" ")) if (t.length >= 3) st.tokensConsumidos.add(t);
        return tipo;
      }
    }
  }
  return null;
}

function extraerResultado(st: ExtractionState, tipo: TipoDisparador | null): string | null {
  if (!tipo) return null;
  const mapa = SINONIMOS_RESULTADO[tipo];
  if (!mapa) return null;
  for (const [valor, sinonimos] of Object.entries(mapa)) {
    for (const s of sinonimos) {
      if (st.texto.includes(s)) {
        agregarMatch(st, "resultado", valor, "resultado", s);
        for (const t of s.split(" ")) if (t.length >= 3) st.tokensConsumidos.add(t);
        return valor;
      }
    }
  }
  return null;
}

function extraerRol(st: ExtractionState): string[] {
  const roles: string[] = [];
  const texto = st.texto;
  for (const [grupo, sinonimos] of Object.entries(ROLES_GENERICOS)) {
    for (const s of sinonimos) {
      if (texto.includes(s)) {
        agregarMatch(st, "rol", grupo, "rol", s);
        for (const t of s.split(" ")) if (t.length >= 3) st.tokensConsumidos.add(t);
        if (grupo === "central") roles.push("C1", "C2");
        else if (grupo === "punta") roles.push("P1", "P2");
        else if (grupo === "zaguero") roles.push("P1", "P2", "L", "C1", "C2");
        else if (grupo === "delantero") roles.push("A", "O", "P1", "P2", "C1", "C2");
      }
    }
  }
  for (const [rol, sinonimos] of Object.entries(SINONIMOS_ROL)) {
    for (const s of sinonimos) {
      if (texto.includes(s)) {
        if (!roles.includes(rol)) roles.push(rol);
        agregarMatch(st, "rol", rol, "rol", s);
        for (const t of s.split(" ")) if (t.length >= 3) st.tokensConsumidos.add(t);
      }
    }
  }
  return roles;
}

function extraerSets(st: ExtractionState): number[] {
  const sets: number[] = [];
  const regex = /\bset\s*([1-5])\b/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(st.texto)) !== null) {
    const n = parseInt(m[1], 10);
    if (!sets.includes(n)) sets.push(n);
    agregarMatch(st, "set", String(n), "set", m[0]);
    st.tokensConsumidos.add("set");
  }
  const regexS = /\bs([1-5])\b/g;
  while ((m = regexS.exec(st.texto)) !== null) {
    const n = parseInt(m[1], 10);
    if (!sets.includes(n)) sets.push(n);
    agregarMatch(st, "set", String(n), "set", m[0]);
  }
  return sets;
}

function extraerPuntos(st: ExtractionState): number[] {
  const puntos: number[] = [];
  const regex = /\bpunto\s*(\d+)\b/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(st.texto)) !== null) {
    const n = parseInt(m[1], 10);
    if (!puntos.includes(n)) puntos.push(n);
    agregarMatch(st, "punto", String(n), "punto", m[0]);
    st.tokensConsumidos.add("punto");
  }
  const regexP = /\bp(\d+)\b/g;
  while ((m = regexP.exec(st.texto)) !== null) {
    const n = parseInt(m[1], 10);
    if (!puntos.includes(n)) puntos.push(n);
    agregarMatch(st, "punto", String(n), "punto", m[0]);
  }
  return puntos;
}

function extraerPartidos(
  st: ExtractionState,
  partidos: { id: string; nombre: string }[] | undefined
): string[] {
  if (!partidos || partidos.length === 0) return [];
  const out: string[] = [];
  const ordenados = [...partidos].sort((a, b) => b.nombre.length - a.nombre.length);
  for (const p of ordenados) {
    const nNorm = normalizar(p.nombre);
    if (!nNorm) continue;
    if (st.texto.includes(nNorm)) {
      if (!out.includes(p.id)) out.push(p.id);
      agregarMatch(st, "partido", p.nombre, "partido", nNorm);
      for (const t of nNorm.split(" ")) if (t.length >= 3) st.tokensConsumidos.add(t);
    }
  }
  return out;
}

function extraerZonas(st: ExtractionState): number[] {
  const zonas: number[] = [];
  const regex = /\bz(?:ona)?\s*([1-6])\b/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(st.texto)) !== null) {
    const n = parseInt(m[1], 10);
    if (!zonas.includes(n)) zonas.push(n);
    agregarMatch(st, "zona", String(n), "zona", m[0]);
  }
  if (contiene(st.texto, "olla", "la olla")) {
    if (!zonas.includes(6)) zonas.push(6);
    agregarMatch(st, "zona", "6", "zona", "olla");
    st.tokensConsumidos.add("olla");
  }
  return zonas;
}

function extraerRotaciones(st: ExtractionState): number[] {
  const rots: number[] = [];
  const regex = /\br(?:otacion|otación)?\s*([1-6])\b/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(st.texto)) !== null) {
    const n = parseInt(m[1], 10);
    if (!rots.includes(n)) rots.push(n);
    agregarMatch(st, "rotacion", String(n), "rotacion", m[0]);
  }
  return rots;
}

function extraerVelocidad(st: ExtractionState): number | null {
  for (const { patrones, valor } of SINONIMOS_VELOCIDAD) {
    for (const p of patrones) {
      if (st.texto.includes(p)) {
        agregarMatch(st, "velocidad", String(valor), "velocidad", p);
        for (const t of p.split(" ")) if (t.length >= 3) st.tokensConsumidos.add(t);
        return valor;
      }
    }
  }
  return null;
}

function extraerTipoSaque(st: ExtractionState): "potencia" | "flotado" | null {
  const texto = st.texto;
  if (contiene(texto, "potencia", "de potencia", "saque potente", "saque fuerte", "saltado", "salto", "saque de tenis", "salto potencia", "saque en salto", "saque bomba", "bomba")) {
    agregarMatch(st, "tipo-saque", "potencia", "tipo-saque", "potencia");
    return "potencia";
  }
  if (contiene(texto, "flotado", "flotante", "saque flotante", "saque flotado", "mano baja", "seguridad", "salto flotante", "gancho flotante", "batida", "saque de abajo")) {
    agregarMatch(st, "tipo-saque", "flotado", "tipo-saque", "flotado");
    return "flotado";
  }
  return null;
}

function extraerPrevia(st: ExtractionState, tipoDetectado: TipoDisparador | null): FiltroAccionHistorica | null {
  const texto = st.texto;
  const triggers = ["despues de", "después de", "tras ", "luego de", "viene de", "venia de", "que viene de", "que venia de"];
  let encontrado = false;
  for (const t of triggers) {
    if (texto.includes(t)) {
      encontrado = true;
      st.tokensConsumidos.add("despues");
      st.tokensConsumidos.add("después");
      st.tokensConsumidos.add("tras");
      break;
    }
  }
  if (!encontrado) return null;

  let previaTipo: TipoDisparador | null = null;
  let mejorIdx = Infinity;
  for (const [tipo, sinonimos] of Object.entries(SINONIMOS_TIPO) as [TipoDisparador, string[]][]) {
    for (const s of sinonimos) {
      const i = texto.indexOf(s);
      if (i >= 0 && i < mejorIdx && tipo !== tipoDetectado) {
        mejorIdx = i;
        previaTipo = tipo;
      }
    }
  }

  if (!previaTipo) {
    if (contiene(texto, "errar", "error", "erró", "erro")) {
      previaTipo = tipoDetectado ?? "ataque";
      agregarMatch(st, "previa", "error", "previa", "error/errar");
    } else if (contiene(texto, "acierto", "punto", "positiva", "perfecta")) {
      previaTipo = tipoDetectado ?? "ataque";
      agregarMatch(st, "previa", "punto", "previa", "acierto/punto");
    } else {
      return null;
    }
  }

  const mapa = SINONIMOS_RESULTADO[previaTipo];
  let previaResultado: string | null = null;
  if (mapa) {
    for (const [valor, sinonimos] of Object.entries(mapa)) {
      for (const s of sinonimos) {
        if (texto.includes(s)) {
          previaResultado = valor;
          break;
        }
      }
      if (previaResultado) break;
    }
  }

  if (previaTipo) {
    agregarMatch(st, "previa", `${previaTipo}${previaResultado ? `·${previaResultado}` : ""}`, "previa", `${previaTipo} previo`);
  }

  return {
    ...FILTRO_ACCION_HISTORICA_VACIO,
    tipos: previaTipo ? [previaTipo] : [],
    resultados: previaResultado ? [previaResultado] : [],
    relacionJugador: "mismo",
  };
}

function extraerRachaJugador(st: ExtractionState): RachaJugadorFiltro | null {
  const texto = st.texto;
  const m = texto.match(/(?:despues de|después de|tras|luego de)\s+(\d+|un|una|dos|tres|cuatro|cinco)\s+([a-z]+(?:\s+[a-z]+)?)/);
  if (!m) return null;
  const numStr = m[1];
  const num = numStr === "un" || numStr === "una" ? 1 : numStr === "dos" ? 2 : numStr === "tres" ? 3 : numStr === "cuatro" ? 4 : numStr === "cinco" ? 5 : parseInt(numStr, 10);
  const que = m[2];

  let tipo: TipoRachaJugador | null = null;
  if (que.includes("error") || que.includes("errar")) tipo = "errores_seguidos";
  else if (que.includes("punto") && que.includes("perdid")) tipo = "puntos_perdidos";
  else if (que.includes("punto") && que.includes("ganad")) tipo = "puntos_ganados";
  else if (que.includes("acierto") || que.includes("positiv")) tipo = "aciertos_seguidos";
  if (!tipo) return null;

  agregarMatch(st, "racha-jugador", `${num} ${tipo}`, "racha-jugador", m[0]);

  return { jugadorId: null, tipo, minimo: num, ambito: "puntos_del_set" };
}

function extraerTop(st: ExtractionState): number | null {
  const texto = st.texto;
  const m = texto.match(/top\s*(\d{1,2})\s*%?/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n > 0 && n <= 100) {
      agregarMatch(st, "top", `top ${n}%`, "top", m[0]);
      return n;
    }
  }
  if (contiene(texto, "mejores", "mejor", "los mejores", "el mejor")) {
    agregarMatch(st, "top", "top 20%", "top", "mejores");
    return 20;
  }
  return null;
}

function extraerVsPromedio(st: ExtractionState): "por_encima" | "por_debajo" | null {
  const texto = st.texto;
  if (contiene(texto, "por encima del promedio", "sobre el promedio", "arriba del promedio", "mejor que el promedio", "por encima", "buenos")) {
    agregarMatch(st, "vs-promedio", "por_encima", "vs-promedio", "por encima");
    return "por_encima";
  }
  if (contiene(texto, "por debajo del promedio", "bajo el promedio", "abajo del promedio", "peor que el promedio", "por debajo", "peores")) {
    agregarMatch(st, "vs-promedio", "por_debajo", "vs-promedio", "por debajo");
    return "por_debajo";
  }
  return null;
}

interface ContextoExtraido {
  cierre?: "<=1" | "<=3" | "<=5";
  criticos: boolean;
  estado?: "empatado" | "ganando" | "perdiendo";
  primerPunto: boolean;
  ultimoPunto: boolean;
  rachaPuntos: number | null;
  fase: "side-out" | "free-ball" | null;
  k2: boolean;
  k3: boolean;
  inicioPunto: string | null;
}

function extraerContexto(st: ExtractionState): ContextoExtraido {
  const texto = st.texto;
  const ctx: ContextoExtraido = {
    criticos: false,
    primerPunto: false,
    ultimoPunto: false,
    rachaPuntos: null,
    fase: null,
    k2: false,
    k3: false,
    inicioPunto: null,
  };

  for (const g of SINONIMOS_CONTEXTO.cierre) {
    if (g.texto.some((t) => texto.includes(t))) {
      ctx.cierre = g.valor;
      agregarMatch(st, "contexto.cierre", g.valor, "contexto", g.texto[0]);
      st.tokensConsumidos.add("cierre");
      break;
    }
  }

  if (SINONIMOS_CONTEXTO.criticos.some((t) => texto.includes(t))) {
    ctx.criticos = true;
    agregarMatch(st, "contexto.critico", "si", "contexto", "criticos");
    st.tokensConsumidos.add("critico");
    st.tokensConsumidos.add("criticos");
  }

  for (const g of SINONIMOS_CONTEXTO.estado) {
    if (g.texto.some((t) => texto.includes(t))) {
      ctx.estado = g.valor;
      agregarMatch(st, "contexto.estado", g.valor, "contexto", g.texto[0]);
      break;
    }
  }

  if (SINONIMOS_CONTEXTO.primerPunto.some((t) => texto.includes(t))) {
    ctx.primerPunto = true;
    agregarMatch(st, "contexto.posicion", "primero", "posicion-set", "primer punto");
  }
  if (SINONIMOS_CONTEXTO.ultimoPunto.some((t) => texto.includes(t))) {
    ctx.ultimoPunto = true;
    agregarMatch(st, "contexto.posicion", "ultimo", "posicion-set", "último punto");
  }

  const mRacha = texto.match(/racha\s*(?:de\s*)?(\d+)?/);
  if (mRacha) {
    const n = mRacha[1] ? parseInt(mRacha[1], 10) : 2;
    ctx.rachaPuntos = n;
    agregarMatch(st, "contexto.racha", `>=${n}`, "contexto", mRacha[0]);
    st.tokensConsumidos.add("racha");
  }

  for (const [fase, sinonimos] of Object.entries(SINONIMOS_FASE_RALLY)) {
    if (sinonimos.some((s) => texto.includes(s))) {
      ctx.fase = fase as "side-out" | "free-ball";
      agregarMatch(st, "contexto.fase", fase, "contexto", sinonimos[0]);
      st.tokensConsumidos.add(fase);
      break;
    }
  }
  for (const k of Object.keys(SINONIMOS_K2K3)) {
    if (SINONIMOS_K2K3[k].some((s) => texto.includes(s))) {
      if (k === "k2") ctx.k2 = true;
      if (k === "k3") ctx.k3 = true;
      agregarMatch(st, "contexto.fase", k.toUpperCase(), "contexto", k);
      st.tokensConsumidos.add(k);
    }
  }

  for (const [inicio, sinonimos] of Object.entries(SINONIMOS_INICIO_PUNTO)) {
    if (sinonimos.some((s) => texto.includes(s))) {
      ctx.inicioPunto = inicio;
      agregarMatch(st, "contexto.inicio", inicio, "contexto", sinonimos[0]);
      break;
    }
  }

  return ctx;
}

function extraerLlamadas(st: ExtractionState): { llamadas: LlamadaDef[]; velocidad: number | null } {
  const llamadas: LlamadaDef[] = [];
  let velocidad: number | null = null;
  for (const l of LLAMADAS) {
    for (const s of l.sinonimos) {
      if (st.texto.includes(s)) {
        if (l.nombre === "v" && s.trim() === "v") continue;
        if (!llamadas.some((x) => x.nombre === l.nombre)) {
          llamadas.push(l);
          agregarMatch(st, "llamada", l.nombre, "resultado", s);
          if (velocidad === null && l.velocidad !== undefined) velocidad = l.velocidad;
          for (const t of s.split(" ")) if (t.length >= 3) st.tokensConsumidos.add(t);
        }
        break;
      }
    }
  }
  return { llamadas, velocidad };
}

interface ToqueSegunda {
  detectado: boolean;
  jugadorId: string | null;
  excluirArmador: boolean;
}

function extraerToqueDeSegunda(
  st: ExtractionState,
  jugadores: { id: string; nombre: string }[] | undefined,
  viaRSuelto: boolean
): ToqueSegunda {
  const texto = st.texto;
  const detectadoPorTexto = contiene(
    texto,
    "toque de segunda",
    "remate de segunda",
    "toque de 2da",
    "remate de 2da"
  );
  const detectado = detectadoPorTexto || viaRSuelto;
  if (!detectado) return { detectado: false, jugadorId: null, excluirArmador: false };

  const excluirArmador = contiene(
    texto,
    "que no sea del armador",
    "que no sea armador",
    "sin armador",
    "excluyendo al armador"
  );

  let jugadorId: string | null = null;
  if (!excluirArmador && jugadores) {
    const ordenados = [...jugadores].sort((a, b) => b.nombre.length - a.nombre.length);
    for (const j of ordenados) {
      const nNorm = normalizar(j.nombre);
      if (nNorm && texto.includes(nNorm)) {
        jugadorId = j.id;
        agregarMatch(st, "jugador", j.nombre, "jugador", nNorm);
        break;
      }
    }
  }

  agregarMatch(
    st,
    "toque-segunda",
    excluirArmador ? "no-armador" : jugadorId ? "de-jugador" : "solo",
    "resultado",
    viaRSuelto ? "R (remate de segunda)" : "remate de segunda"
  );

  return { detectado: true, jugadorId, excluirArmador };
}

function extraerRecepcionZona(st: ExtractionState): {
  destino: number | null;
  origen: number | null;
  adelante: boolean;
  atras: boolean;
} {
  const texto = st.texto;
  const r = { destino: null as number | null, origen: null as number | null, adelante: false, atras: false };

  const mDestino = texto.match(/recepcion\s+en\s+([234])/);
  if (mDestino) {
    r.destino = parseInt(mDestino[1], 10);
    agregarMatch(st, "recepcion.zonaDestino", String(r.destino), "zona", mDestino[0]);
  }

  const mOrigen = texto.match(/recepcion\s+en\s+([561])/);
  if (mOrigen) {
    r.origen = parseInt(mOrigen[1], 10);
    agregarMatch(st, "recepcion.zonaOrigen", String(r.origen), "zona", mOrigen[0]);
  }

  if (contiene(texto, "recepcion de adelante", "recepcion adelante", "de adelante")) {
    r.adelante = true;
    agregarMatch(st, "recepcion.columna", "adelante", "zona", "de adelante");
  }
  if (contiene(texto, "recepcion de atras", "recepcion de atrás", "recepcion atras", "de atras", "de atrás")) {
    r.atras = true;
    agregarMatch(st, "recepcion.columna", "atras", "zona", "de atrás");
  }

  return r;
}

// ------------------------------------------------------------
// ENSAMBLADO DEL FILTRO
// ------------------------------------------------------------

interface Piezas {
  tipo: TipoDisparador | null;
  resultado: string | null;
  jugadorId: string | null;
  sets: number[];
  puntos: number[];
  partidos: string[];
  roles: string[];
  zonas: number[];
  rotaciones: number[];
  velocidad: number | null;
  tipoSaque: "potencia" | "flotado" | null;
  previa: FiltroAccionHistorica | null;
  rachaJugador: RachaJugadorFiltro | null;
  top: number | null;
  vsPromedio: "por_encima" | "por_debajo" | null;
  contexto: ContextoExtraido;
  toqueSegunda: ToqueSegunda;
  recepcionZona: { destino: number | null; origen: number | null; adelante: boolean; atras: boolean };
  recepcionSimbolo: RecepcionSimbolo | null;
}

function construirFiltro(p: Piezas): BloqueTriggerFiltro {
  const base: BloqueTriggerFiltro = { ...BLOQUE_TRIGGER_VACIO };

  // --- Tipo ---
  let tipoFinal: TipoDisparador = p.tipo ?? "ataque";
  if (!p.tipo && p.toqueSegunda.detectado) tipoFinal = "ataque";
  if (!p.tipo && (p.recepcionZona.adelante || p.recepcionZona.atras)) tipoFinal = "recepcion";
  if (p.recepcionSimbolo !== null) tipoFinal = "recepcion";

  // --- Resultado ---
  let resultadoFinal: string | "cualquiera" = p.resultado ?? "cualquiera";
  if (p.recepcionSimbolo !== null) {
    resultadoFinal = p.recepcionSimbolo.valor;
  }
  // Validar contra el catálogo del motor
  const resultadosValidos = resultadosPorTipoAnalisis(tipoFinal);
  if (resultadoFinal !== "cualquiera" && !resultadosValidos.includes(resultadoFinal)) {
    resultadoFinal = "cualquiera";
  }

  // --- Jugador ---
  let jugadorId: string | null = p.jugadorId;
  if (p.toqueSegunda.detectado && p.toqueSegunda.jugadorId) jugadorId = p.toqueSegunda.jugadorId;

  // --- Roles (per A2 del PDF) ---
  const roles = [...p.roles];
  if (p.toqueSegunda.detectado) {
    if (p.toqueSegunda.excluirArmador) {
      for (const r of ["O", "C1", "C2", "P1", "P2", "L"]) if (!roles.includes(r)) roles.push(r);
    } else if (!jugadorId) {
      if (!roles.includes("A")) roles.push("A");
    }
  }

  // --- Zonas jugador ---
  const zonasJugador = [...p.zonas];
  if (p.recepcionZona.origen !== null && !zonasJugador.includes(p.recepcionZona.origen)) {
    zonasJugador.push(p.recepcionZona.origen);
  }

  // --- Contexto del partido ---
  let contextoPartido: BloqueTriggerFiltro["contextoPartido"] = null;
  const ctx = p.contexto;
  const hayContexto =
    ctx.cierre !== undefined ||
    ctx.criticos ||
    ctx.estado !== undefined ||
    ctx.primerPunto ||
    ctx.ultimoPunto ||
    ctx.rachaPuntos !== null ||
    ctx.fase !== null ||
    ctx.k2 ||
    ctx.k3 ||
    ctx.inicioPunto !== null;

  if (hayContexto) {
    const cp = { ...CONTEXTO_PARTIDO_VACIO };
    if (ctx.cierre !== undefined) cp.marcador = { ...cp.marcador, puntosParaCerrar: ctx.cierre };
    if (ctx.criticos) cp.marcador = { ...cp.marcador, soloCriticos: true };
    if (ctx.estado !== undefined) cp.marcador = { ...cp.marcador, estado: ctx.estado };
    if (ctx.rachaPuntos !== null) cp.rachaPuntos = ctx.rachaPuntos;
    if (ctx.fase !== null) cp.faseRally = ctx.fase;
    if (ctx.inicioPunto !== null) cp.inicioPunto = ctx.inicioPunto as typeof cp.inicioPunto;
    if (ctx.primerPunto) cp.posicionEnSet = "primero";
    else if (ctx.ultimoPunto) cp.posicionEnSet = "ultimo";
    contextoPartido = cp;
  }

  return {
    ...base,
    tipo: tipoFinal,
    jugadorId,
    resultado: resultadoFinal,
    sets: p.sets,
    puntos: p.puntos,
    partidos: p.partidos,
    roles,
    zonasJugador,
    rotaciones: p.rotaciones,
    rachas: base.rachas,
    accionPreviaDirecta: p.previa,
    rachaJugador: p.rachaJugador,
    patronPrevio: null,
    topPorcentaje: p.top,
    vsPromedio: p.vsPromedio,
    contextoPartido,
  };
}

function generarSugerencias(
  st: ExtractionState,
  tipoDetectado: TipoDisparador | null,
  hayMatches: boolean
): string[] {
  const sug: string[] = [];
  if (!hayMatches) {
    sug.push("ataques de Juan después de errar");
    sug.push("recepciones exclamativas en cierre de set");
    sug.push("bloqueos que terminaron en punto");
    return sug;
  }
  if (tipoDetectado && st.matches.every((m) => m.categoria === "tipo")) {
    sug.push(`Puntos de ${tipoDetectado}`);
    sug.push(`${tipoDetectado} en cierre de set`);
    sug.push(`${tipoDetectado} en contraataque`);
    return sug;
  }
  if (!tipoDetectado) {
    sug.push("aclará el tipo (saque, recepción, armado, ataque, bloqueo, defensa)");
    sug.push("ataque después de recepción negativa");
    sug.push("recepción en cierre de set");
  }
  return sug;
}

// ------------------------------------------------------------
// PARSER PRINCIPAL
// ------------------------------------------------------------

export function parsearBusqueda(
  texto: string,
  contexto: ContextoParser = {}
): ResultadoParser {
  const textoOriginal = texto;
  const st: ExtractionState = {
    matches: [],
    noReconocidas: [],
    texto: normalizar(texto),
    tokensConsumidos: new Set(),
  };

  if (!st.texto) {
    return {
      filtro: { ...BLOQUE_TRIGGER_VACIO },
      matches: [],
      noReconocidas: [],
      sugerencias: [
        "ataques de Juan después de errar",
        "recepciones exclamativas en cierre de set",
        "pipes que terminaron en punto",
      ],
      aplicado: false,
    };
  }

  // 1. Símbolos de recepción (R#, R+, R!, R-, R--, R/, R=) sobre texto original
  const recepcionSimbolo = detectarSimboloRecepcion(textoOriginal);
  if (recepcionSimbolo) {
    agregarMatch(
      st,
      "resultado",
      recepcionSimbolo.valor,
      "resultado",
      recepcionSimbolo.fragmento
    );
  }

  // 2. Extracción estándar
  const jugadorId = extraerJugador(st, contexto.jugadores);
  const tipo = extraerTipo(st);
  const resultadoPorTexto = extraerResultado(st, tipo);
  const roles = extraerRol(st);
  const sets = extraerSets(st);
  const puntos = extraerPuntos(st);
  const partidos = extraerPartidos(st, contexto.partidos);
  const zonas = extraerZonas(st);
  const rotaciones = extraerRotaciones(st);
  const velocidad = extraerVelocidad(st);
  const tipoSaque = extraerTipoSaque(st);
  const previa = extraerPrevia(st, tipo);
  const rachaJugador = extraerRachaJugador(st);
  const top = extraerTop(st);
  const vsPromedio = extraerVsPromedio(st);
  const ctx = extraerContexto(st);
  const { velocidad: velLlamada } = extraerLlamadas(st);

  // 3. ¿R suelto? Solo si no hay tipo ya detectado y no hay símbolo R pegado
  const viaRSuelto =
    !tipo && !recepcionSimbolo && detectarRSuelto(textoOriginal);

  // 4. Toque de segunda (por texto o por R suelto)
  const toqueSegunda = extraerToqueDeSegunda(
    st,
    contexto.jugadores,
    viaRSuelto
  );
  const recepcionZona = extraerRecepcionZona(st);

  const velocidadFinal = velocidad ?? velLlamada ?? null;

  const filtro = construirFiltro({
    tipo,
    resultado: recepcionSimbolo ? recepcionSimbolo.valor : resultadoPorTexto,
    jugadorId,
    sets,
    puntos,
    partidos,
    roles,
    zonas,
    rotaciones,
    velocidad: velocidadFinal,
    tipoSaque,
    previa,
    rachaJugador,
    top,
    vsPromedio,
    contexto: ctx,
    toqueSegunda,
    recepcionZona,
    recepcionSimbolo,
  });

  // 5. Palabras no reconocidas
  const tokens = st.texto.split(/\s+/).filter((t) => t.length >= 3);
  const vistas = new Set<string>();
  for (const t of tokens) {
    if (st.tokensConsumidos.has(t)) continue;
    if (vistas.has(t)) continue;
    vistas.add(t);
    st.noReconocidas.push(t);
  }

  const aplicado =
    !!tipo ||
    !!resultadoPorTexto ||
    !!jugadorId ||
    !!recepcionSimbolo ||
    sets.length > 0 ||
    puntos.length > 0 ||
    partidos.length > 0 ||
    roles.length > 0 ||
    zonas.length > 0 ||
    rotaciones.length > 0 ||
    !!velocidad ||
    !!tipoSaque ||
    !!previa ||
    !!rachaJugador ||
    top !== null ||
    !!vsPromedio ||
    ctx.cierre !== undefined ||
    ctx.criticos ||
    ctx.estado !== undefined ||
    ctx.primerPunto ||
    ctx.ultimoPunto ||
    ctx.rachaPuntos !== null ||
    ctx.fase !== null ||
    ctx.k2 ||
    ctx.k3 ||
    ctx.inicioPunto !== null ||
    toqueSegunda.detectado ||
    recepcionZona.adelante ||
    recepcionZona.atras ||
    recepcionZona.destino !== null ||
    recepcionZona.origen !== null ||
    viaRSuelto;

  const sugerencias = generarSugerencias(st, tipo, st.matches.length > 0);

  return {
    filtro,
    matches: st.matches,
    noReconocidas: st.noReconocidas,
    sugerencias,
    aplicado,
  };
}