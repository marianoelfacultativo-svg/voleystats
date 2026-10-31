// ============================================================
// PARSER DE BÚSQUEDA — v4.1
// Fix (FASE 7.4 cierre):
//   + Wording del aviso de ambigüedad cambiado de
//     "Hay varios jugadores que matchean… Especificá cuál…"
//     a "Ambigüedad: "X" coincide con varios jugadores. …".
//     El resto del archivo es idéntico a v4.0.
//
// v4.0 (FASE 7.4):
//   + Resolución de jugadores por apodo / apellido / nombre de
//     pila / nombre completo, con desambiguación explícita.
//     Delegado a `lib/consultaAnalitica/resolverJugador.ts`.
//   + Nuevos campos en `ResultadoParser`:
//       · jugadorAmbiguo: boolean
//       · jugadorCandidatos: JugadorParaResolver[]
//       · jugadorAviso: string | null
//   + Nueva tabla `SINONIMOS_TIPO_RESULTADO` que infiere tipo +
//     resultado desde la palabra sola.
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
  type RelacionJugadorObservado,
  type TipoDisparador,
  type TipoRachaJugador,
  type UbicacionFiltro,
} from "./analisisConsecuencias";
import type { FaseRally } from "./contextoRally";

import { parsearIntencion } from "./consultaAnalitica/parserIntencion";
import type { IntencionQuery } from "./consultaAnalitica/intenciones";
import { intencionVacia } from "./consultaAnalitica/intenciones";

import {
  resolverJugador,
  resolverJugadorAId,
  describirCandidatos,
  type JugadorParaResolver,
} from "./consultaAnalitica/resolverJugador";

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
  | "posicion-set"
  | "secuencia";

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
  tipoObservadoSugerido: TipoDisparador | "cualquiera" | null;
  relacionObservadoSugerido: RelacionJugadorObservado | null;
  faseRallySugerida: FaseRally | null;
  intencion: IntencionQuery;
  jugadorAmbiguo: boolean;
  jugadorCandidatos: JugadorParaResolver[];
  jugadorAviso: string | null;
}

export interface ContextoParser {
  jugadores?: JugadorParaResolver[];
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

function ordenarPorLargoDesc(arr: string[]): string[] {
  return [...arr].sort((a, b) => b.length - a.length);
}

// ------------------------------------------------------------
// DETECCIÓN DE SÍMBOLOS DE RECEPCIÓN (texto original)
// ------------------------------------------------------------

interface RecepcionSimbolo {
  valor: string;
  fragmento: string;
}

function detectarSimboloRecepcion(
  textoOriginal: string
): RecepcionSimbolo | null {
  const t = textoOriginal;

  if (/R\s*--/.test(t)) return { valor: "doble_negativa", fragmento: "R--" };
  if (/R\s*#/.test(t)) return { valor: "perfecta", fragmento: "R#" };
  if (/R\s*\+/.test(t)) return { valor: "positiva", fragmento: "R+" };
  if (/R\s*!/.test(t)) return { valor: "intermedia", fragmento: "R!" };
  if (/R\s*\//.test(t)) return { valor: "overpass", fragmento: "R/" };
  if (/R\s*=/.test(t)) return { valor: "error_directo", fragmento: "R=" };
  if (/R\s*-(?!-)/.test(t)) return { valor: "negativa", fragmento: "R-" };

  return null;
}

// ------------------------------------------------------------
// DETECCIÓN DE "R" SUELTO = REMATE DE SEGUNDA
// ------------------------------------------------------------

function detectarRSuelto(textoOriginal: string): boolean {
  const t = textoOriginal;
  return /(^|[^A-Za-z0-9])R(?![#+\-!=/A-Za-z0-9])/i.test(t);
}

// ------------------------------------------------------------
// DICCIONARIOS — TIPO
// ------------------------------------------------------------

const SINONIMOS_TIPO: Record<TipoDisparador, string[]> = {
  saque: [
    "saque", "saques", "sacada", "sacadas", "sacado", "sacados",
    "sacar", "saca", "sacan", "sacamos", "sacaron", "sacando", "saquen",
    "saco", "sacó", "sacaste", "sacaba", "sacabamos", "sacábamos",
    "sacaran", "sacarán", "sacaria", "sacaría", "sacarias", "sacarías",
    "sacaremos", "sacare", "sacaré", "sacaba", "sacaban",
    "servicio", "servicios", "servir", "sirve", "sirven", "sirviendo",
    "saque de tenis", "saques de tenis",
    "saque chino", "saques chinos",
    "gancho", "ganchos", "gancho flotante", "ganchos flotantes",
    "saque flotante", "saques flotantes",
    "saque flotado", "saques flotados",
    "flotado", "flotados", "flotante", "flotantes",
    "salto flotante", "salto potencia",
    "en suspension", "en suspensión",
    "mano baja", "manos bajas",
    "seguridad", "saque de seguridad", "saques de seguridad", "saque seguro",
    "batida", "batidas",
    "saque de abajo", "saques de abajo",
    "saque por encima", "saques por encima",
    "saque en salto", "saques en salto",
    "saque bomba", "saques bomba", "bomba", "bombas",
    "saque potente", "saque fuerte", "saques fuertes", "saque duro",
    "saque picado", "saque corto", "saque profundo",
    "primer saque", "segundo saque",
  ],
  recepcion: [
    "recepcion", "recepciones", "recepcionar", "recepciona",
    "recepcionan", "recepcionamos", "recepcionaron", "recepcionando",
    "recibir", "recibe", "reciben", "recibimos", "recibieron",
    "recibiendo", "reciban", "recibida", "recibidas", "recibido", "recibidos",
    "recibi", "recibí", "recibiste", "recibio", "recibió",
    "recibia", "recibía", "recibiamos", "recibíamos",
    "recibian", "recibían", "recibire", "recibiré",
    "recibira", "recibirá", "recibiria", "recibiría",
    "pase de recepcion", "pases de recepcion", "pases de recepción",
    "bagre", "bagres", "plataforma", "plataformas",
    "antebrazos", "antebrazo",
    "shank", "shanks", "costura", "costuras", "stack", "stacks",
    "mancheta", "manchetas", "pala", "palas",
    "golpe de abajo", "golpes de abajo",
    "golpe de antebrazos", "golpes de antebrazos",
    "toque de antebrazos", "toques de antebrazos",
    "voleo bajo", "voleos bajos",
    "pase de antebrazos", "pases de antebrazos",
    "golpe de manos bajas", "golpes de manos bajas",
    "recepcion alta", "recepciones altas",
    "recepcion media", "recepciones medias",
    "recepcion baja", "recepciones bajas",
    "recepcion al bigote", "recepciones al bigote",
    "bigote", "bigotes",
    "recepcion corta", "recepcion larga",
    "recepcion fuerte", "recepcion facil",
    "primera linea", "segunda linea",
  ],
  armado: [
    "armado", "armados", "armada", "armadas",
    "armar", "arma", "arman", "armamos", "armaron", "armando", "armen",
    "arme", "armé", "armaste", "armo", "armó",
    "armaba", "armabamos", "armábamos",
    "armare", "armaré", "armara", "armará", "armaria", "armaría",
    "set", "sets", "pase", "pases",
    "toque de dedos", "toques de dedos",
    "toque de dedos (yema)", "toque de yema",
    "voleo", "voleos", "voleo alto", "voleos altos",
    "colocacion", "colocaciones", "colocada", "colocadas",
    "colocacion en salto", "colocaciones en salto",
    "levantada", "levantadas", "levantamiento", "levantamientos",
    "levantando", "levantar", "levanta", "levantan", "levantamos",
    "golpe de arriba", "golpes de arriba",
    "golpe de manos altas", "golpes de manos altas",
    "pase-colocacion", "pase-colocaciones",
    "armado en suspension", "armados en suspension",
    "toque de dedos en salto",
    "dirigir la orquesta", "llevar la batuta", "cpu del equipo",
    "asistencia", "asistencias",
    "distribuir", "distribuyendo", "distribucion", "distribuciones",
  ],
  ataque: [
    "ataque", "ataques", "atacada", "atacadas", "atacado", "atacados",
    "atacar", "ataca", "atacan", "atacamos", "atacaron", "atacando", "ataquen",
    "atacaste", "atacaba", "atacabamos", "atacábamos",
    "atacare", "atacaré", "atacara", "atacará", "atacaria", "atacaría",
    "remate", "remates", "rematada", "rematadas", "rematado", "rematados",
    "rematar", "remata", "rematan", "rematamos", "remataron",
    "rematando", "rematen",
    "remataste", "remataba", "rematabamos", "rematábamos",
    "rematare", "remataré", "rematara", "rematará", "remataria", "remataría",
    "pegar", "pega", "pegan", "pegamos", "pegaron", "pegando", "peguen",
    "pegue", "pegué", "pegaste", "pego", "pegó",
    "pegaba", "pegabamos", "pegábamos",
    "pegare", "pegaré", "pegara", "pegará", "pegaria", "pegaría",
    "pegarle", "pegarle a la pelota",
    "spike", "spikes", "spikear", "spikeando", "spikee", "spikeó",
    "kill", "kills", "killar", "killeando",
    "clavar", "clava", "clavan", "clavamos", "clavaron", "clavando", "claven",
    "clave", "clavé", "clavaste", "clavo", "clavó",
    "smash", "smashes",
    "downball", "downballs",
    "matar", "mata", "matan", "matamos", "mataron", "matando", "maten",
    "mate", "maté", "mataste", "mato", "mató",
    "bombear", "bombea", "bombean", "bombeando",
    "bombee", "bombeé", "bombeaste", "bombeo", "bombeó",
    "finta", "fintas", "dejada", "dejadas",
    "toque suave", "toques suaves",
    "tipping", "tips", "tipper",
    "avion", "aviones", "iberia", "iberias",
    "remate de segunda", "remates de segunda",
    "toque de segunda", "toques de segunda",
    "ataque de segunda", "ataques de segunda",
    "remate de segundo tiempo",
    "roll shot", "roll shots",
    "paralela", "paralelas", "diagonal", "diagonales",
    "cruzado", "cruzados", "cruzada", "cruzadas",
    "en linea", "en línea", "en lineas", "en líneas",
    "tendido", "tendidos",
    "ataque por 4", "ataque por 2", "ataque por 6",
    "pipe", "pipes",
    "mate", "mates", "galleta", "galletas",
    "misil", "misiles", "castaña", "castañas",
    "palomo", "palomos", "palomazo", "palomazos",
    "bombazo", "bombazos", "cañonazo", "cañonazos",
  ],
  bloqueo: [
    "bloqueo", "bloqueos", "bloqueada", "bloqueadas",
    "bloqueado", "bloqueados",
    "bloquear", "bloquea", "bloquean", "bloqueamos", "bloquearon",
    "bloqueando", "bloqueen",
    "bloquee", "bloqueé", "bloqueaste", "bloqueo", "bloqueó",
    "bloqueaba", "bloqueabamos", "bloqueábamos",
    "bloqueare", "bloquearé", "bloqueara", "bloqueará",
    "bloquearia", "bloquearía",
    "muro", "muros", "pantalla", "pantallas",
    "cortina", "cortinas", "pared", "paredes",
    "muralla", "murallas", "tapon", "tapones",
    "cerrar", "cierra", "cierran", "cerramos", "cerraron",
    "cerrando", "cierren",
    "bloqueo doble", "bloqueos dobles",
    "bloqueo triple", "bloqueos triples",
    "toque de bloqueo", "toques de bloqueo",
    "bloqueo ofensivo", "bloqueos ofensivos",
    "bloqueo defensivo", "bloqueos defensivos",
    "bloqueo activo", "bloqueo pasivo",
    "bloqueo a fuego",
    "gorro", "gorros", "chapa", "chapas",
    "pincho", "pinchos", "techar", "techando",
    "gorrear", "gorreando",
    "tapada", "tapadas", "tapado", "tapados",
  ],
  defensa: [
    "defensa", "defensas", "defendida", "defendidas",
    "defendido", "defendidos",
    "defender", "defiende", "defienden", "defendemos",
    "defendieron", "defendiendo", "defiendan",
    "defendi", "defendí", "defendiste", "defendio", "defendió",
    "defendia", "defendía", "defendiamos", "defendíamos",
    "defendere", "defenderé", "defendera", "defenderá",
    "defenderia", "defendería",
    "dig", "digs",
    "plancha", "planchas", "pancake", "pancakes",
    "salvada", "salvadas", "salvar", "salva", "salvan",
    "salvamos", "salvaron", "salvando",
    "atajada", "atajadas",
    "secante", "secantes", "caida", "caidas",
    "palomita", "palomitas", "rastrillada", "rastrilladas",
    "cavar", "cava", "cavan", "cavamos", "cavaron", "cavando",
    "pescar", "pesca", "pescan", "pescamos", "pescaron", "pescando",
    "defensa de segunda linea", "defensas de segunda linea",
    "defensa de campo", "defensas de campo",
    "defensa positiva", "defensas positivas",
    "defensa negativa", "defensas negativas",
    "defensa de bloqueo", "defensas de bloqueo",
    "cobertura", "coberturas", "apoyo", "apoyos",
    "levantar", "levanta", "levantan", "levantamos", "levantaron",
    "sacar la pelota", "sacarla",
  ],
  libre: [
    "libre", "libres",
    "pelota libre", "pelotas libres",
    "bola libre", "bolas libres",
    "balon libre", "balones libres",
    "free ball", "freeball", "free-ball",
    "entrega", "entregas", "entregan", "entregaron", "entregando",
    "entrego", "entregué", "entregaste", "entrego", "entregó",
    "entregaba", "entregabamos", "entregábamos",
    "entregare", "entregaré", "entregara", "entregará",
    "entregaria", "entregaría",
    "pelota facil", "pelotas faciles",
    "pelota entregada", "pelotas entregadas",
    "bola entregada", "bolas entregadas",
  ],
  "roce-red": [
    "roce red", "roce de red", "roce-red",
    "roces de red", "roce en la red", "roces en la red",
    "rocen la red", "rosar la red", "rosando la red",
    "toca la red", "tocan la red", "tocamos la red",
    "tocaron la red", "tocando la red",
    "invasion", "invasión", "invasiones", "invadir",
    "invadimos", "invadieron", "invadiendo", "invadan",
    "invadio", "invadió", "invadia", "invadía",
    "pasarse de la red",
    "pisar la red", "pisamos la red", "pisaron la red",
    "cruzo la linea", "cruzó la línea",
    "cruzaron la línea", "cruzando la línea",
  ],
};

// ------------------------------------------------------------
// SINÓNIMOS QUE IMPLICAN TIPO + RESULTADO (FASE 7.4)
// ------------------------------------------------------------

interface SinonimoTipoResultado {
  patrones: string[];
  tipo: TipoDisparador;
  resultado: string | null;
}

const SINONIMOS_TIPO_RESULTADO: SinonimoTipoResultado[] = [
  {
    patrones: [
      "gorro", "gorros", "gorro recibido", "gorros recibidos",
      "lo taparon", "tapada", "tapadas", "tapado", "tapados",
      "chapa", "chapas", "pincho", "pinchos",
      "techada", "techadas", "techado", "techados",
      "lo techó", "lo techno", "lo techó el rival",
      "me lo taparon", "nos taparon",
    ],
    tipo: "ataque",
    resultado: "gorro_ataque",
  },
  {
    patrones: [
      "ace", "aces",
      "punto directo de saque",
      "ace de saque", "aces de saque",
      "servicio directo", "servicios directos",
    ],
    tipo: "saque",
    resultado: "ace",
  },
  {
    patrones: [
      "use rival", "use-rival", "block out", "block-out",
      "blockout", "blockouts",
      "usa el bloqueo", "usó el bloqueo", "uso el bloqueo",
      "pega el bloqueo", "pega en el bloqueo",
      "rebota en el bloqueo", "rebotó en el bloqueo",
      "toca el bloqueo", "tocó el bloqueo",
      "sale por afuera", "sale desviado", "salen desviados",
      "pasa por el bloqueo",
    ],
    tipo: "ataque",
    resultado: "use_rival_ataque",
  },
  {
    patrones: [
      "overpass", "overpasses",
      "recepcion overpass", "recepciones overpass",
    ],
    tipo: "recepcion",
    resultado: "overpass",
  },
  {
    patrones: [
      "doble falta", "doble falta de saque",
      "error de saque", "errores de saque",
      "saque errado", "saques errados",
    ],
    tipo: "saque",
    resultado: "negativo",
  },
  {
    patrones: [
      "bloqueo a la red", "bloqueos a la red",
      "toque de red del bloqueo",
    ],
    tipo: "bloqueo",
    resultado: "red",
  },
  {
    patrones: [
      "ace en contra", "aces en contra",
      "error directo en recepcion", "error directo de recepcion",
    ],
    tipo: "recepcion",
    resultado: "error_directo",
  },
];

// ------------------------------------------------------------
// DICCIONARIOS — RESULTADO
// ------------------------------------------------------------

const SINONIMOS_RESULTADO: Record<TipoDisparador, Record<string, string[]>> = {
  saque: {
    ace: [
      "ace", "aces", "as",
      "punto directo de saque", "servicio directo",
      "punto directo", "directo de saque",
      "winner de saque", "ace de saque", "aces de saque",
    ],
    positivo_mas: [
      "positivo+", "positivo mas", "positivo más",
      "pos+", "pos mas", "pos más",
    ],
    positivo: ["positivo", "pos", "positiva"],
    neutro: ["neutro", "neutra"],
    negativo: [
      "negativo", "negativa", "neg",
      "error", "error de saque", "error de saques",
      "errores de saque", "errores de saques",
      "errar el saque", "afuera el saque", "palomo",
      "sacó afuera", "sacó a la red",
      "mal saque", "saque errado", "saque fallado",
      "erró el saque", "se fue el saque",
    ],
  },
  recepcion: {
    perfecta: [
      "perfecta", "perfectas", "r#", "r perfecta",
      "doble positiva", "2x positiva", "2x_positiva",
      "mancheta perfecta",
      "recepcion al bigote", "bigote",
      "recepcion perfecta", "recepciones perfectas",
    ],
    positiva: [
      "positiva", "positivas", "r+", "r positiva",
      "buena recepcion", "mancheta limpia",
      "recepcion positiva", "recepciones positivas",
    ],
    intermedia: [
      "intermedia", "intermedias", "exclamativa", "exclamativas",
      "exclamacion", "exclamaciones",
      "r!", "r exclamativa", "r intermedia", "!",
      "mancheta intermedia", "recepcion intermedia",
    ],
    negativa: [
      "negativa", "negativas", "r-", "r negativa",
      "mala recepcion", "mancheta sucia",
      "recepcion negativa", "recepciones negativas",
    ],
    doble_negativa: [
      "doble negativa", "dobles negativas", "r--", "r doble negativa",
      "2x negativa", "2x_negativa",
      "recepcion doble negativa",
    ],
    overpass: [
      "overpass", "overpasses", "r/",
      "pasa al rival", "se le fue para el otro lado",
      "recepcion que paso la red",
    ],
    error_directo: [
      "error directo", "errores directos", "r=", "ace en contra",
      "ace_contra", "no la toco", "no la tocó",
      "recepcion errada",
    ],
  },
  armado: {
    "1": ["1", "horrible", "malo", "desastre", "pesimo", "pésimo"],
    "2": ["2", "flojo", "impreciso", "malo"],
    "3": ["3", "regular", "aceptable"],
    "4": ["4", "correcto", "bueno"],
    "5": ["5", "perfecto", "excelente"],
    "6": ["6", "genial", "impecable", "espectacular"],
    R: [
      "rechazo", "no puede armar", "error de armado",
      "rechazo de armado",
    ],
  },
  ataque: {
    punto: [
      "punto", "puntos", "punto directo",
      "kill", "kills",
      "termino en punto", "mato", "clavo",
      "bombeo", "mate",
      "atacó al piso", "ataco al piso",
    ],
    neutro: [
      "neutro", "neutros", "no termino", "siguio el rally",
      "defendido", "no termino el rally",
    ],
    error: [
      "error", "errores", "errar", "erró", "erro",
      "afuera", "a la red", "gorro", "gorros",
      "avion", "iberia", "desviado",
      "palomo", "galleta",
      "ataque errado", "ataque fallado",
    ],
    error_afuera_ataque: [
      "error afuera", "afuera",
      "se fue largo", "se fue ancho",
      "palomo", "palomazo",
      "atacó afuera", "ataco afuera",
      "atacó afuera de la cancha",
    ],
    error_red_ataque: [
      "error red", "a la red", "red",
      "toco la red", "tocó la red",
      "atacó a la red", "ataco a la red",
    ],
    gorro_ataque: [
      "gorro", "gorros", "gorro_ataque", "tapada", "tapado",
      "chapa", "pincho",
      "taparon", "lo taparon",
      "queda en el bloqueo", "quedó en el bloqueo",
    ],
    use_rival_ataque: [
      "use rival", "block out", "block-out", "blockout", "blockouts",
      "usa el bloqueo", "usó el bloqueo", "uso el bloqueo",
      "usan el bloqueo",
      "pega en el bloqueo", "pegan en el bloqueo", "pegó en el bloqueo",
      "pega el bloqueo", "pegan el bloqueo",
      "rebota en el bloqueo", "rebotan en el bloqueo", "rebotó en el bloqueo",
      "toca el bloqueo", "tocan el bloqueo", "tocó el bloqueo",
      "pasa al otro lado", "pasan al otro lado", "pasó al otro lado",
      "pasa al campo rival", "pasan al campo rival",
      "sale por afuera", "sale desviado", "salen desviados",
      "pasa por el bloqueo",
      "pega en el bloqueo y pasa",
      "pega en el bloqueo y sale",
      "toca el bloqueo y sale",
      "rebota en el bloqueo y sale",
    ],
    finta: [
      "finta", "fintas", "dejada", "dejadas",
      "toque suave", "roll shot",
    ],
    toque: [
      "toque", "toques",
      "remate de toque",
      "toque de segunda",
      "remate de segunda",
      "remate de 2da",
      "remate segunda",
    ],
  },
  bloqueo: {
    punto: [
      "punto", "puntos", "punto directo", "tapon", "tapones",
      "tapada", "gorro", "gorros", "chapa", "pincho",
      "bloqueo punto",
    ],
    positivo_mas: [
      "positivo+", "pos+", "bloqueo positivo+",
    ],
    positivo: ["positivo", "pos", "bloqueo positivo"],
    neutro: ["neutro", "bloqueo neutro"],
    use_rival: [
      "use rival", "usa el bloqueo",
      "desviado afuera", "desvió afuera",
    ],
    red: ["red", "a la red", "toco la red", "tocó la red"],
    filtrada: [
      "filtrada", "filtradas", "filtro",
      "filtrada por el bloqueo",
    ],
  },
  defensa: {
    toque_positiva: [
      "toque positiva", "toques positivas", "toque+",
      "defensa positiva", "defensas positivas",
    ],
    toque_negativa: [
      "toque negativa", "toques negativas", "toque-",
      "defensa negativa", "defensas negativas",
    ],
    gran_def: [
      "gran defensa", "grandes defensas",
      "gran def", "gran-defensa",
      "defenson", "defensón", "atijada", "atijadas",
      "salvada", "salvadas",
      "defensorazo", "defensorazos",
    ],
    error_def: [
      "error defensa", "errores de defensa",
      "error def", "error_def",
      "no la levanto", "no la levantó",
      "no la pudo levantar",
    ],
    mala_libre: [
      "mala libre", "malas libres", "mala_libre", "libre malo",
    ],
    cobertura_positiva: [
      "cobertura positiva", "coberturas positivas",
      "cob+", "cobertura+",
    ],
    cobertura_negativa: [
      "cobertura negativa", "coberturas negativas",
      "cob-", "cobertura-",
    ],
    errores_graves: [
      "error grave", "errores graves", "error grosero",
      "errores groseros",
    ],
    neutro: ["neutro", "defensa neutra"],
  },
  libre: {
    toque: ["toque", "toques", "toque libre"],
    libre: ["libre", "libres"],
  },
  "roce-red": {
    "ofensivo-propio": ["ofensivo propio", "roce ofensivo"],
    "invasion-zaguero": [
      "invasion zaguero", "invadió el zaguero",
      "invadio el zaguero",
    ],
    "invasion-delantero": [
      "invasion delantero", "invadió el delantero",
      "invadio el delantero",
    ],
    "roce-red-rival": ["roce rival", "roce red rival"],
  },
};

// ------------------------------------------------------------
// DICCIONARIOS — ROL
// ------------------------------------------------------------

const SINONIMOS_ROL: Record<string, string[]> = {
  A: [
    "armador", "armadores", "armadora", "armadoras",
    "levantador", "levantadores", "levantadora",
    "colocador", "colocadores", "colocadora",
    "setter", "setters",
    "pasador", "pasadores", "pasadora",
  ],
  O: [
    "opuesto", "opuestos", "opuesta", "opuestas",
    "diagonal", "diagonales",
  ],
  C1: [
    "central 1", "central1", "c1",
    "central uno", "primer central",
  ],
  C2: [
    "central 2", "central2", "c2",
    "central dos", "segundo central",
  ],
  P1: [
    "punta 1", "punta1", "p1",
    "punta uno", "primer punta",
  ],
  P2: [
    "punta 2", "punta2", "p2",
    "punta dos", "segundo punta",
  ],
  L: [
    "libero", "liberos", "líbero", "líberos",
    "libera", "libero defensivo",
  ],
};

const ROLES_GENERICOS: Record<string, string[]> = {
  central: [
    "central", "centrales",
    "bloqueador central", "bloqueadores centrales",
  ],
  punta: [
    "punta", "puntas", "puntero", "punteros",
    "ala", "alas",
    "punta receptor", "puntas receptores",
    "receptor-atacante", "receptores-atacantes",
  ],
  zaguero: [
    "zaguero", "zagueros", "zaguera", "zagueras",
    "back row", "fondo",
  ],
  delantero: [
    "delantero", "delanteros", "delantera", "delanteras",
    "front row", "red",
  ],
};

// ------------------------------------------------------------
// LLAMADAS DEL ARMADO
// ------------------------------------------------------------

interface LlamadaDef {
  nombre: string;
  sinonimos: string[];
  velocidad?: number;
  descripcion: string;
}

const LLAMADAS: LlamadaDef[] = [
  {
    nombre: "hatu",
    sinonimos: ["hatu", "jatu", "hut", "go"],
    velocidad: 1,
    descripcion: "Primer tiempo con el central",
  },
  {
    nombre: "corta atras",
    sinonimos: ["corta atras", "corta atrás", "hanati", "hanatí", "hanati corta"],
    velocidad: 1,
    descripcion: "Primer tiempo atrás del central",
  },
  {
    nombre: "shoot",
    sinonimos: ["shoot", "flecha", "seven", "siete", "odka", "blue"],
    velocidad: 1,
    descripcion: "Primer tiempo por 4 o 2",
  },
  {
    nombre: "superfast",
    sinonimos: ["superfast", "super fast", "super rapida", "super rápida"],
    velocidad: 1,
    descripcion: "Rápida a 4",
  },
  {
    nombre: "v",
    sinonimos: [" v ", "uve", "bola v", "pelota v"],
    velocidad: 1,
    descripcion: "Rápida en V por 2",
  },
  {
    nombre: "bic",
    sinonimos: ["bic", "pipe rapida", "pipe rápida", "bick"],
    velocidad: 1,
    descripcion: "Pipe rápida",
  },
  {
    nombre: "pipe",
    sinonimos: ["pipe", "paip", "pipes"],
    velocidad: 1.5,
    descripcion: "Semi por 6 con el punta zaguero",
  },
  {
    nombre: "pipe semi",
    sinonimos: ["pipe semi", "pipe lenta", "pipe alto"],
    velocidad: 1.5,
    descripcion: "Pipe semi",
  },
  {
    nombre: "hanati volada",
    sinonimos: ["hanati volada", "hanatí volada", "volada"],
    velocidad: 1.5,
    descripcion: "Semi con el central por atrás",
  },
  {
    nombre: "slide",
    sinonimos: ["slide", "vti", "veti", "salida en v"],
    velocidad: 1.5,
    descripcion: "Salida en V por atrás con central",
  },
  {
    nombre: "quick",
    sinonimos: ["quick", "rapida", "rápida"],
    velocidad: 1,
    descripcion: "Rápida genérica",
  },
  {
    nombre: "alta",
    sinonimos: ["alta", "bola alta", "pelota alta"],
    velocidad: 5,
    descripcion: "Pelota alta a la punta",
  },
  {
    nombre: "v con c",
    sinonimos: ["v con c", "v y c", "combinacion v c"],
    velocidad: 1,
    descripcion: "Combinación V + C",
  },
  {
    nombre: "doble v",
    sinonimos: ["doble v", "doble uve"],
    velocidad: 1,
    descripcion: "Combinación doble V",
  },
];

// ------------------------------------------------------------
// DICCIONARIOS — VELOCIDAD
// ------------------------------------------------------------

const SINONIMOS_VELOCIDAD: { patrones: string[]; valor: number }[] = [
  { patrones: ["muy alta", "alta lejana", "bola muy alta"], valor: 5 },
  { patrones: ["rapida", "rápida", "primer tiempo", "quick"], valor: 1 },
  { patrones: ["semi", "semi rapida", "semi rápida"], valor: 1.5 },
  { patrones: ["alta", "bola alta", "pelota alta"], valor: 2 },
  { patrones: ["segundo tiempo", "segunda linea", "segunda línea"], valor: 2 },
  { patrones: ["tercer tiempo"], valor: 3 },
];

// ------------------------------------------------------------
// DICCIONARIOS — FASE RALLY
// ------------------------------------------------------------

const SINONIMOS_FASE_RALLY: Record<string, string[]> = {
  "side-out": [
    "side-out", "side out", "k1", "ki",
    "lado saque", "complejo 1",
  ],
  "free-ball": [
    "free ball", "freeball", "free-ball",
    "entrega", "pelota libre",
  ],
};

const SINONIMOS_INICIO_PUNTO: Record<string, string[]> = {
  ace_propio: [
    "ace propio", "ace nuestro",
    "ace de mi equipo", "ace de nuestro equipo",
  ],
  ace_rival: [
    "ace rival", "ace del rival", "ace en contra",
  ],
  recepcion_positiva: [
    "recepcion positiva al inicio",
    "inicio con recepcion positiva",
  ],
  recepcion_neutra: [
    "recepcion neutra al inicio",
    "recepcion intermedia al inicio",
  ],
  recepcion_negativa: [
    "recepcion negativa al inicio",
    "recepcion doble negativa al inicio",
  ],
  overpass: [
    "overpass al inicio", "inicio con overpass",
  ],
  error_directo: [
    "error directo al inicio",
    "inicio con error directo",
  ],
};

const SINONIMOS_K2K3: Record<string, string[]> = {
  k2: [
    "k2", "k 2",
    "contraataque desde defensa",
    "contraataque de defensa",
    "break point", "break-point",
  ],
  k3: [
    "k3", "k 3",
    "contraataque desde cobertura",
    "contraataque de cobertura",
    "complejo 3",
  ],
};

const SINONIMOS_CONTEXTO = {
  cierre: [
    {
      texto: [
        "cierre de set", "cierre del set",
        "puntos para cerrar", "para cerrar el set",
      ],
      valor: "<=3" as const,
    },
    {
      texto: [
        "match point", "punto de partido",
        "matchpoint", "punto de set",
      ],
      valor: "<=1" as const,
    },
    {
      texto: ["puntos para cerrar el partido"],
      valor: "<=3" as const,
    },
  ],
  criticos: [
    "punto critico", "puntos criticos",
    "critico", "criticos",
  ],
  estado: [
    {
      texto: ["empatado", "empatados", "empatar"],
      valor: "empatado" as const,
    },
    {
      texto: ["ganando", "arriba en el marcador"],
      valor: "ganando" as const,
    },
    {
      texto: ["perdiendo", "abajo en el marcador"],
      valor: "perdiendo" as const,
    },
  ],
  primerPunto: [
    "primer punto", "primer punto del set",
    "primer rally",
  ],
  ultimoPunto: [
    "ultimo punto", "último punto",
    "ultimo punto del set", "cierre del set",
  ],
};

// ------------------------------------------------------------
// STOPWORDS
// ------------------------------------------------------------

const STOPWORDS: string[] = [
  "del", "los", "las", "una", "unos", "unas",
  "por", "para", "con", "sin", "entre", "hacia",
  "desde", "hasta", "sobre", "bajo", "segun", "según",
  "tras", "ante", "contra", "durante",
  "pero", "sino", "aunque", "mientras", "porque", "pues",
  "entonces", "tambien", "también", "ademas", "además",
  "incluso", "salvo", "excepto", "luego", "asi", "así",
  "entretanto", "mientras tanto",
  "solo", "solamente", "unicamente", "únicamente",
  "muy", "mas", "más", "menos", "mucho", "mucha",
  "muchos", "muchas", "poco", "poca", "pocos", "pocas",
  "tanto", "tanta", "tantos", "tantas",
  "todo", "toda", "todos", "todas",
  "algun", "algún", "alguna", "algunos", "algunas",
  "ningun", "ningún", "ninguna", "ninguno", "ningunos", "ningunas",
  "otro", "otra", "otros", "otras",
  "mismo", "misma", "mismos", "mismas",
  "ambos", "ambas", "cada",
  "aca", "acá", "ahi", "ahí", "alli", "allí",
  "aqui", "aquí", "ahora", "antes", "despues", "después",
  "siempre", "nunca", "jamas", "jamás", "casi",
  "aun", "aún", "quiza", "quizás", "tal", "vez", "veces",
  "lado", "lados", "campo", "campos",
  "rival", "rivales", "contrario", "contrarios",
  "oponente", "oponentes", "equipo", "equipos",
  "adversario", "adversarios",
  "vuelve", "vuelven", "vuelto", "vuelta",
  "devuelve", "devuelven", "devolvio", "devolvió",
  "devuelto", "devuelta", "devueltas", "devueltos",
  "que", "qué", "cual", "cuál", "cuales", "cuáles",
  "cuanto", "cuánto", "cuanta", "cuánta",
  "cuantos", "cuántos", "cuantas", "cuántas",
  "quien", "quién", "quienes", "quiénes",
  "donde", "dónde", "cuando", "cuándo",
  "como", "cómo",
  "este", "esta", "estos", "estas",
  "ese", "esa", "esos", "esas",
  "aquel", "aquella", "aquellos", "aquellas",
  "esto", "eso", "aquello",
  "mostrame", "mostranos", "mostrar", "muestra", "muestrame",
  "muestranos", "muestro", "muestren", "muestrenme",
  "dame", "danos", "darme", "dar", "da", "doy",
  "busca", "buscame", "buscanos", "buscar", "busco",
  "buscamos", "busquen", "busquenme",
  "quiero", "queria", "quería", "quieres", "quiere",
  "queremos", "quieren",
  "ver", "veo", "veamos", "vemos", "vernos",
  "filtra", "filtrame", "filtrar", "filtro",
  "decime", "decirme", "decir", "dime", "digo",
  "contame", "contarme", "contar", "conta", "cuento",
  "listame", "listar", "listo", "lista",
  "revisa", "revisame", "revisar", "reviso",
  "traeme", "traer", "trae", "traigo",
  "sabes", "saber", "sabemos", "sepa",
  "es", "son", "era", "eran", "fue", "fueron",
  "ser", "estar", "esta", "estan", "están",
  "estuvo", "estuvieron", "estaba", "estaban",
  "hay", "hubo", "habia", "había", "haber",
  "tiene", "tienen", "tenia", "tenía",
  "tuvo", "tuvieron", "tener", "tenemos",
  "hacer", "hace", "hacen", "hizo", "hicieron",
  "hice", "hacemos", "haciendo",
  "jugo", "jugó", "juega", "juegan",
  "jugando", "jugaron", "jugar",
  "paso", "pasó", "pasa", "pasan", "pasando", "pasen",
  "ocurre", "ocurrió", "ocurrio", "ocurren", "ocurriendo",
  "termina", "termino", "terminó", "terminaron",
  "terminando", "acaba", "acabo", "acabó",
  "empezo", "empezó", "empezar", "empieza", "empiezan",
  "siguio", "siguió", "sigue", "siguen", "siguiendo",
  "anduvo", "anduvieron", "anda", "andan",
  "quedo", "quedó", "queda", "quedan",
  "llego", "llegó", "llega", "llegan",
  "salio", "salió", "sale", "salen",
  "entro", "entró", "entra", "entran",
  "fue por", "fue de",
  "bueno", "entonces", "listo", "dale", "vamos",
  "va", "ok", "bien", "che",
];

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
  jugadores: JugadorParaResolver[] | undefined
): ReturnType<typeof resolverJugador> {
  if (!jugadores || jugadores.length === 0) {
    return {
      ids: [],
      ambiguo: false,
      candidatos: [],
      motivo: "no_encontrado",
      match: null,
    };
  }

  const resolucion = resolverJugador(st.texto, jugadores);

  if (resolucion.motivo === "unico") {
    const j = jugadores.find((x) => x.id === resolucion.ids[0]);
    if (j) {
      agregarMatch(
        st,
        "jugador",
        j.nombre,
        "jugador",
        resolucion.match ?? normalizar(j.nombre)
      );
      const tokens = new Set<string>();
      for (const t of normalizar(j.nombre).split(" ")) {
        if (t.length >= 3) tokens.add(t);
      }
      if (j.apodo) {
        for (const t of normalizar(j.apodo).split(" ")) {
          if (t.length >= 3) tokens.add(t);
        }
      }
      const matchTokens = (resolucion.match ?? "").split(" ");
      for (const t of matchTokens) {
        if (t.length >= 3) st.tokensConsumidos.add(t);
      }
      for (const t of tokens) st.tokensConsumidos.add(t);
    }
  } else if (resolucion.motivo === "ambiguo") {
    for (const t of (resolucion.match ?? "").split(" ")) {
      if (t.length >= 3) st.tokensConsumidos.add(t);
    }
  }

  return resolucion;
}

function extraerTipo(st: ExtractionState): TipoDisparador | null {
  const texto = st.texto;
  for (const [tipo, sinonimos] of Object.entries(SINONIMOS_TIPO) as [
    TipoDisparador,
    string[]
  ][]) {
    const ordenados = ordenarPorLargoDesc(sinonimos);
    for (const s of ordenados) {
      if (texto.includes(s)) {
        agregarMatch(st, "tipo", tipo, "tipo", s);
        for (const t of s.split(" "))
          if (t.length >= 3) st.tokensConsumidos.add(t);
        return tipo;
      }
    }
  }
  return null;
}

interface InferenciaTipoResultado {
  tipo: TipoDisparador;
  resultado: string | null;
  fragmento: string;
}

function inferirTipoResultado(
  st: ExtractionState
): InferenciaTipoResultado | null {
  for (const entrada of SINONIMOS_TIPO_RESULTADO) {
    const ordenados = ordenarPorLargoDesc(entrada.patrones);
    for (const patron of ordenados) {
      if (st.texto.includes(patron)) {
        for (const t of patron.split(" "))
          if (t.length >= 3) st.tokensConsumidos.add(t);
        agregarMatch(st, "tipo", entrada.tipo, "tipo", patron);
        if (entrada.resultado) {
          agregarMatch(
            st,
            "resultado",
            entrada.resultado,
            "resultado",
            patron
          );
        }
        return {
          tipo: entrada.tipo,
          resultado: entrada.resultado,
          fragmento: patron,
        };
      }
    }
  }
  return null;
}

function consumirTiposSecundarios(
  st: ExtractionState,
  tipoPrincipal: TipoDisparador | null
) {
  for (const [tipo, sinonimos] of Object.entries(SINONIMOS_TIPO) as [
    TipoDisparador,
    string[]
  ][]) {
    if (tipo === tipoPrincipal) continue;
    const ordenados = ordenarPorLargoDesc(sinonimos);
    for (const s of ordenados) {
      if (st.texto.includes(s)) {
        for (const t of s.split(" ")) {
          if (t.length >= 3) st.tokensConsumidos.add(t);
        }
      }
    }
  }
}

// ============================================================
// v3.8: EXTRACTOR DE SECUENCIA
// ============================================================

interface SecuenciaExtraida {
  tipoObservado: TipoDisparador | null;
  relacionObservado: RelacionJugadorObservado | null;
  faseRally: FaseRally | null;
}

const VERBOS_SECUENCIA: { patrones: string[]; tipo: TipoDisparador }[] = [
  {
    patrones: ["defiende", "defienden", "defendio", "defendió", "defendia", "defendía"],
    tipo: "defensa",
  },
  {
    patrones: ["bloquea", "bloquean", "bloqueo", "bloqueó"],
    tipo: "bloqueo",
  },
  {
    patrones: ["ataca", "atacan", "ataco", "atacó"],
    tipo: "ataque",
  },
  {
    patrones: ["remata", "rematan", "remato", "remató"],
    tipo: "ataque",
  },
  {
    patrones: ["pega", "pegan", "pego", "pegó"],
    tipo: "ataque",
  },
  {
    patrones: ["saca", "sacan", "saco", "sacó"],
    tipo: "saque",
  },
  {
    patrones: ["recibe", "reciben", "recibio", "recibió"],
    tipo: "recepcion",
  },
  {
    patrones: ["arma", "arman", "armo", "armó"],
    tipo: "armado",
  },
  {
    patrones: ["levanta", "levantan", "levanto", "levantó"],
    tipo: "defensa",
  },
  {
    patrones: ["devuelve", "devuelven", "devolvio", "devolvió"],
    tipo: "libre",
  },
  {
    patrones: ["toca", "tocan", "toco", "tocó"],
    tipo: "defensa",
  },
];

const SUJETOS_SECUENCIA: {
  patrones: string[];
  relacion: RelacionJugadorObservado;
}[] = [
  {
    patrones: ["el rival", "del rival", "por el rival"],
    relacion: "rival",
  },
  {
    patrones: ["el contrario", "del contrario", "por el contrario"],
    relacion: "rival",
  },
  {
    patrones: ["el oponente", "del oponente", "por el oponente"],
    relacion: "rival",
  },
  {
    patrones: ["el otro equipo", "del otro equipo"],
    relacion: "rival",
  },
  {
    patrones: ["un companero", "un compañero", "del companero", "del compañero"],
    relacion: "companero",
  },
  {
    patrones: ["el mismo jugador", "del mismo jugador", "mismo jugador"],
    relacion: "mismo",
  },
];

function extraerSecuencia(st: ExtractionState): SecuenciaExtraida {
  const texto = st.texto;
  const resultado: SecuenciaExtraida = {
    tipoObservado: null,
    relacionObservado: null,
    faseRally: null,
  };

  for (const verbo of VERBOS_SECUENCIA) {
    let encontradoVerbo: string | null = null;
    for (const patron of verbo.patrones) {
      if (texto.includes(patron)) {
        encontradoVerbo = patron;
        break;
      }
    }
    if (!encontradoVerbo) continue;

    for (const sujeto of SUJETOS_SECUENCIA) {
      let encontradoSujeto: string | null = null;
      for (const patron of sujeto.patrones) {
        if (texto.includes(patron)) {
          encontradoSujeto = patron;
          break;
        }
      }
      if (!encontradoSujeto) continue;

      resultado.tipoObservado = verbo.tipo;
      resultado.relacionObservado = sujeto.relacion;

      for (const t of encontradoVerbo.split(" "))
        if (t.length >= 3) st.tokensConsumidos.add(t);
      for (const t of encontradoSujeto.split(" "))
        if (t.length >= 3) st.tokensConsumidos.add(t);
      st.tokensConsumidos.add("que");

      agregarMatch(
        st,
        "secuencia.tipoObservado",
        verbo.tipo,
        "secuencia",
        encontradoVerbo
      );
      agregarMatch(
        st,
        "secuencia.relacionObservado",
        sujeto.relacion,
        "secuencia",
        encontradoSujeto
      );

      break;
    }
    if (resultado.tipoObservado) break;
  }

  const patronesVuelveLibre = [
    "vuelve libre", "vuelven libres",
    "vuelve de libre", "vuelven de libres",
    "vuelve como libre", "vuelven como libres",
    "devuelve libre", "devuelven libres",
    "devuelve de libre", "devuelven de libres",
    "vuelve una libre", "vuelven unas libres",
    "vuelve la libre", "vuelven las libres",
    "vuelve la pelota libre", "vuelve una pelota libre",
    "vuelve una bola libre", "vuelve la bola libre",
  ];
  for (const p of patronesVuelveLibre) {
    if (texto.includes(p)) {
      resultado.faseRally = "free-ball";
      for (const t of p.split(" "))
        if (t.length >= 3) st.tokensConsumidos.add(t);
      agregarMatch(
        st,
        "secuencia.faseRally",
        "free-ball",
        "secuencia",
        p
      );
      break;
    }
  }

  return resultado;
}

function extraerResultado(
  st: ExtractionState,
  tipo: TipoDisparador | null
): string | null {
  if (!tipo) return null;
  const mapa = SINONIMOS_RESULTADO[tipo];
  if (!mapa) return null;
  for (const [valor, sinonimos] of Object.entries(mapa)) {
    const ordenados = ordenarPorLargoDesc(sinonimos);
    for (const s of ordenados) {
      if (st.texto.includes(s)) {
        agregarMatch(st, "resultado", valor, "resultado", s);
        for (const t of s.split(" "))
          if (t.length >= 3) st.tokensConsumidos.add(t);
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
    const ordenados = ordenarPorLargoDesc(sinonimos);
    for (const s of ordenados) {
      if (texto.includes(s)) {
        agregarMatch(st, "rol", grupo, "rol", s);
        for (const t of s.split(" "))
          if (t.length >= 3) st.tokensConsumidos.add(t);
        if (grupo === "central") roles.push("C1", "C2");
        else if (grupo === "punta") roles.push("P1", "P2");
        else if (grupo === "zaguero") roles.push("P1", "P2", "L", "C1", "C2");
        else if (grupo === "delantero")
          roles.push("A", "O", "P1", "P2", "C1", "C2");
      }
    }
  }
  for (const [rol, sinonimos] of Object.entries(SINONIMOS_ROL)) {
    const ordenados = ordenarPorLargoDesc(sinonimos);
    for (const s of ordenados) {
      if (texto.includes(s)) {
        if (!roles.includes(rol)) roles.push(rol);
        agregarMatch(st, "rol", rol, "rol", s);
        for (const t of s.split(" "))
          if (t.length >= 3) st.tokensConsumidos.add(t);
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
  const ordenados = [...partidos].sort(
    (a, b) => b.nombre.length - a.nombre.length
  );
  for (const p of ordenados) {
    const nNorm = normalizar(p.nombre);
    if (!nNorm) continue;
    if (st.texto.includes(nNorm)) {
      if (!out.includes(p.id)) out.push(p.id);
      agregarMatch(st, "partido", p.nombre, "partido", nNorm);
      for (const t of nNorm.split(" "))
        if (t.length >= 3) st.tokensConsumidos.add(t);
    }
  }
  return out;
}

// ============================================================
// v3.9: extraerZonas con soporte para "verbo + en + N"
// ============================================================

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

  const VERBOS_POSICION = [
    "estan", "están", "esta", "está", "estaban", "estaba",
    "estuvo", "estuvieron",
    "juega", "juegan", "jugaba", "jugaban", "jugo", "jugó",
    "parado", "parada", "parados", "paradas",
    "ubicado", "ubicada", "ubicados", "ubicadas",
    "posicionado", "posicionada", "posicionados", "posicionadas",
  ];
  const verboRe = VERBOS_POSICION.join("|");
  const regexPosicion = new RegExp(
    `\\b(?:${verboRe})\\s+en\\s+([1-6])\\b`,
    "g"
  );
  while ((m = regexPosicion.exec(st.texto)) !== null) {
    const n = parseInt(m[1], 10);
    if (!zonas.includes(n)) zonas.push(n);
    agregarMatch(st, "zona", String(n), "zona", m[0]);
    const verboMatch = m[0].match(new RegExp(`^(${verboRe})`));
    if (verboMatch) st.tokensConsumidos.add(verboMatch[1]);
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
    const ordenados = ordenarPorLargoDesc(patrones);
    for (const p of ordenados) {
      if (st.texto.includes(p)) {
        agregarMatch(st, "velocidad", String(valor), "velocidad", p);
        for (const t of p.split(" "))
          if (t.length >= 3) st.tokensConsumidos.add(t);
        return valor;
      }
    }
  }
  return null;
}

function extraerTipoSaque(
  st: ExtractionState
): "potencia" | "flotado" | null {
  const texto = st.texto;
  if (
    contiene(
      texto,
      "potencia", "de potencia", "saque potente", "saque fuerte",
      "saltado", "salto", "saque de tenis",
      "salto potencia", "saque en salto", "saque bomba", "bomba"
    )
  ) {
    agregarMatch(st, "tipo-saque", "potencia", "tipo-saque", "potencia");
    return "potencia";
  }
  if (
    contiene(
      texto,
      "flotado", "flotante", "saque flotante", "saque flotado",
      "mano baja", "seguridad",
      "salto flotante", "gancho flotante", "batida", "saque de abajo"
    )
  ) {
    agregarMatch(st, "tipo-saque", "flotado", "tipo-saque", "flotado");
    return "flotado";
  }
  return null;
}

function extraerPrevia(
  st: ExtractionState,
  tipoDetectado: TipoDisparador | null
): FiltroAccionHistorica | null {
  const texto = st.texto;
  const triggers = [
    "despues de", "después de", "tras ", "luego de",
    "viene de", "venia de", "que viene de", "que venia de",
  ];
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
  for (const [tipo, sinonimos] of Object.entries(SINONIMOS_TIPO) as [
    TipoDisparador,
    string[]
  ][]) {
    for (const s of sinonimos) {
      const i = texto.indexOf(s);
      if (i >= 0 && i < mejorIdx && tipo !== tipoDetectado) {
        mejorIdx = i;
        previaTipo = tipo;
      }
    }
  }

  if (!previaTipo) {
    if (contiene(texto, "errar", "error", "erró", "erro", "errores")) {
      previaTipo = tipoDetectado ?? "ataque";
      agregarMatch(st, "previa", "error", "previa", "error/errar");
    } else if (
      contiene(texto, "acierto", "punto", "positiva", "perfecta")
    ) {
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
    agregarMatch(
      st,
      "previa",
      `${previaTipo}${previaResultado ? `·${previaResultado}` : ""}`,
      "previa",
      `${previaTipo} previo`
    );
  }

  return {
    ...FILTRO_ACCION_HISTORICA_VACIO,
    tipos: previaTipo ? [previaTipo] : [],
    resultados: previaResultado ? [previaResultado] : [],
    relacionJugador: "mismo",
  };
}

function extraerRachaJugador(
  st: ExtractionState
): RachaJugadorFiltro | null {
  const texto = st.texto;
  const m = texto.match(
    /(?:despues de|después de|tras|luego de)\s+(\d+|un|una|dos|tres|cuatro|cinco)\s+([a-z]+(?:\s+[a-z]+)?)/
  );
  if (!m) return null;
  const numStr = m[1];
  const num =
    numStr === "un" || numStr === "una"
      ? 1
      : numStr === "dos"
      ? 2
      : numStr === "tres"
      ? 3
      : numStr === "cuatro"
      ? 4
      : numStr === "cinco"
      ? 5
      : parseInt(numStr, 10);
  const que = m[2];

  let tipo: TipoRachaJugador | null = null;
  if (que.includes("error") || que.includes("errar"))
    tipo = "errores_seguidos";
  else if (que.includes("punto") && que.includes("perdid"))
    tipo = "puntos_perdidos";
  else if (que.includes("punto") && que.includes("ganad"))
    tipo = "puntos_ganados";
  else if (que.includes("acierto") || que.includes("positiv"))
    tipo = "aciertos_seguidos";
  if (!tipo) return null;

  agregarMatch(st, "racha-jugador", `${num} ${tipo}`, "racha-jugador", m[0]);

  return {
    jugadorId: null,
    tipo,
    minimo: num,
    ambito: "puntos_del_set",
  };
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
  if (
    contiene(texto, "mejores", "mejor", "los mejores", "el mejor")
  ) {
    agregarMatch(st, "top", "top 20%", "top", "mejores");
    return 20;
  }
  return null;
}

function extraerVsPromedio(
  st: ExtractionState
): "por_encima" | "por_debajo" | null {
  const texto = st.texto;
  if (
    contiene(
      texto,
      "por encima del promedio",
      "sobre el promedio",
      "arriba del promedio",
      "mejor que el promedio",
      "por encima",
      "buenos"
    )
  ) {
    agregarMatch(st, "vs-promedio", "por_encima", "vs-promedio", "por encima");
    return "por_encima";
  }
  if (
    contiene(
      texto,
      "por debajo del promedio",
      "bajo el promedio",
      "abajo del promedio",
      "peor que el promedio",
      "por debajo",
      "peores"
    )
  ) {
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
    agregarMatch(
      st,
      "contexto.posicion",
      "primero",
      "posicion-set",
      "primer punto"
    );
  }
  if (SINONIMOS_CONTEXTO.ultimoPunto.some((t) => texto.includes(t))) {
    ctx.ultimoPunto = true;
    agregarMatch(
      st,
      "contexto.posicion",
      "ultimo",
      "posicion-set",
      "último punto"
    );
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

function extraerLlamadas(st: ExtractionState): {
  llamadas: LlamadaDef[];
  velocidad: number | null;
} {
  const llamadas: LlamadaDef[] = [];
  let velocidad: number | null = null;
  for (const l of LLAMADAS) {
    for (const s of l.sinonimos) {
      if (st.texto.includes(s)) {
        if (l.nombre === "v" && s.trim() === "v") continue;
        if (!llamadas.some((x) => x.nombre === l.nombre)) {
          llamadas.push(l);
          agregarMatch(st, "llamada", l.nombre, "resultado", s);
          if (velocidad === null && l.velocidad !== undefined)
            velocidad = l.velocidad;
          for (const t of s.split(" "))
            if (t.length >= 3) st.tokensConsumidos.add(t);
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
  jugadores: JugadorParaResolver[] | undefined,
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
  if (!detectado)
    return { detectado: false, jugadorId: null, excluirArmador: false };

  const excluirArmador = contiene(
    texto,
    "que no sea del armador",
    "que no sea armador",
    "sin armador",
    "excluyendo al armador"
  );

  let jugadorId: string | null = null;
  if (!excluirArmador && jugadores) {
    jugadorId = resolverJugadorAId(texto, jugadores);
    if (jugadorId) {
      const j = jugadores.find((x) => x.id === jugadorId);
      if (j) {
        agregarMatch(
          st,
          "jugador",
          j.nombre,
          "jugador",
          normalizar(j.nombre)
        );
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
  const r = {
    destino: null as number | null,
    origen: null as number | null,
    adelante: false,
    atras: false,
  };

  const mDestino = texto.match(/recepcion\s+en\s+([234])/);
  if (mDestino) {
    r.destino = parseInt(mDestino[1], 10);
    agregarMatch(
      st,
      "recepcion.zonaDestino",
      String(r.destino),
      "zona",
      mDestino[0]
    );
  }

  const mOrigen = texto.match(/recepcion\s+en\s+([561])/);
  if (mOrigen) {
    r.origen = parseInt(mOrigen[1], 10);
    agregarMatch(
      st,
      "recepcion.zonaOrigen",
      String(r.origen),
      "zona",
      mOrigen[0]
    );
  }

  if (
    contiene(
      texto,
      "recepcion de adelante",
      "recepcion adelante",
      "de adelante"
    )
  ) {
    r.adelante = true;
    agregarMatch(
      st,
      "recepcion.columna",
      "adelante",
      "zona",
      "de adelante"
    );
  }
  if (
    contiene(
      texto,
      "recepcion de atras",
      "recepcion de atrás",
      "recepcion atras",
      "de atras",
      "de atrás"
    )
  ) {
    r.atras = true;
    agregarMatch(st, "recepcion.columna", "atras", "zona", "de atrás");
  }

  return r;
}

function limpiarStopwords(st: ExtractionState) {
  for (const sw of STOPWORDS) {
    for (const t of sw.split(" ")) {
      if (t.length < 3) continue;
      if (!st.tokensConsumidos.has(t)) {
        st.tokensConsumidos.add(t);
      }
    }
  }
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
  recepcionZona: {
    destino: number | null;
    origen: number | null;
    adelante: boolean;
    atras: boolean;
  };
  recepcionSimbolo: RecepcionSimbolo | null;
  inferencia: InferenciaTipoResultado | null;
}

function construirFiltro(p: Piezas): BloqueTriggerFiltro {
  const base: BloqueTriggerFiltro = { ...BLOQUE_TRIGGER_VACIO };

  let tipoFinal: TipoDisparador = p.tipo ?? "ataque";
  if (!p.tipo && p.toqueSegunda.detectado) tipoFinal = "ataque";
  if (
    !p.tipo &&
    (p.recepcionZona.adelante || p.recepcionZona.atras)
  )
    tipoFinal = "recepcion";
  if (p.recepcionSimbolo !== null) tipoFinal = "recepcion";

  if (!p.tipo && p.inferencia) {
    tipoFinal = p.inferencia.tipo;
  }

  let resultadoFinal: string | "cualquiera" =
    p.resultado ?? "cualquiera";
  if (p.recepcionSimbolo !== null) {
    resultadoFinal = p.recepcionSimbolo.valor;
  }
  if (
    resultadoFinal === "cualquiera" &&
    p.inferencia &&
    p.inferencia.resultado
  ) {
    resultadoFinal = p.inferencia.resultado;
  }
  const resultadosValidos = resultadosPorTipoAnalisis(tipoFinal);
  if (
    resultadoFinal !== "cualquiera" &&
    !resultadosValidos.includes(resultadoFinal)
  ) {
    resultadoFinal = "cualquiera";
  }

  let jugadorId: string | null = p.jugadorId;
  if (p.toqueSegunda.detectado && p.toqueSegunda.jugadorId)
    jugadorId = p.toqueSegunda.jugadorId;

  const roles = [...p.roles];
  if (p.toqueSegunda.detectado) {
    if (p.toqueSegunda.excluirArmador) {
      for (const r of ["O", "C1", "C2", "P1", "P2", "L"])
        if (!roles.includes(r)) roles.push(r);
    } else if (!jugadorId) {
      if (!roles.includes("A")) roles.push("A");
    }
  }

  const zonasJugador = [...p.zonas];
  if (
    p.recepcionZona.origen !== null &&
    !zonasJugador.includes(p.recepcionZona.origen)
  ) {
    zonasJugador.push(p.recepcionZona.origen);
  }

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
    if (ctx.cierre !== undefined)
      cp.marcador = { ...cp.marcador, puntosParaCerrar: ctx.cierre };
    if (ctx.criticos)
      cp.marcador = { ...cp.marcador, soloCriticos: true };
    if (ctx.estado !== undefined)
      cp.marcador = { ...cp.marcador, estado: ctx.estado };
    if (ctx.rachaPuntos !== null) cp.rachaPuntos = ctx.rachaPuntos;
    if (ctx.fase !== null) cp.faseRally = ctx.fase;
    if (ctx.inicioPunto !== null)
      cp.inicioPunto = ctx.inicioPunto as typeof cp.inicioPunto;
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
    sug.push(
      "aclará el tipo (saque, recepción, armado, ataque, bloqueo, defensa)"
    );
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
      tipoObservadoSugerido: null,
      relacionObservadoSugerido: null,
      faseRallySugerida: null,
      intencion: intencionVacia(),
      jugadorAmbiguo: false,
      jugadorCandidatos: [],
      jugadorAviso: null,
    };
  }

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

  // FASE 7.4 — resolver jugador
  const resolucionJugador = extraerJugador(st, contexto.jugadores);
  const jugadorId =
    resolucionJugador.motivo === "unico"
      ? resolucionJugador.ids[0]
      : null;
  const jugadorAmbiguo = resolucionJugador.motivo === "ambiguo";
  const jugadorCandidatos = jugadorAmbiguo
    ? resolucionJugador.candidatos
    : [];

  // ============================================================
  // FASE 7.4 cierre — Wording "Ambigüedad"
  // ============================================================
  // Antes: "Hay varios jugadores que matchean "X". Especificá cuál: …"
  // Ahora: "Ambigüedad: "X" coincide con varios jugadores. Candidatos: …"
  // ============================================================
  const jugadorAviso = jugadorAmbiguo
    ? `Ambigüedad: "${resolucionJugador.match ?? ""}" coincide con varios jugadores. ` +
      `Candidatos: ${describirCandidatos(jugadorCandidatos)}.`
    : null;

  const tipo = extraerTipo(st);
  const resultadoPorTexto = extraerResultado(st, tipo);
  consumirTiposSecundarios(st, tipo);

  const inferencia = tipo === null ? inferirTipoResultado(st) : null;

  const secuencia = extraerSecuencia(st);

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

  const viaRSuelto =
    !tipo && !recepcionSimbolo && detectarRSuelto(textoOriginal);

  const toqueSegunda = extraerToqueDeSegunda(
    st,
    contexto.jugadores,
    viaRSuelto
  );
  const recepcionZona = extraerRecepcionZona(st);

  limpiarStopwords(st);

  const velocidadFinal = velocidad ?? velLlamada ?? null;

  const filtro = construirFiltro({
    tipo,
    resultado: recepcionSimbolo
      ? recepcionSimbolo.valor
      : resultadoPorTexto,
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
    inferencia,
  });

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
    viaRSuelto ||
    secuencia.tipoObservado !== null ||
    secuencia.faseRally !== null ||
    inferencia !== null;

  const sugerencias = generarSugerencias(
    st,
    tipo,
    st.matches.length > 0
  );

  const intencion = parsearIntencion(textoOriginal);

  let filtroFinal: BloqueTriggerFiltro = filtro;
  if (intencion.condicion?.ubicacion) {
    filtroFinal = {
      ...filtroFinal,
      ubicacion: intencion.condicion.ubicacion as UbicacionFiltro,
    };
  }
  if (intencion.condicion?.cambioEnPunto !== undefined) {
    filtroFinal = {
      ...filtroFinal,
      cambioEnPunto: intencion.condicion.cambioEnPunto,
    };
  } else if (intencion.condicion?.despuesDeCambio === true) {
    filtroFinal = { ...filtroFinal, cambioEnPunto: true };
  }

  return {
    filtro: filtroFinal,
    matches: st.matches,
    noReconocidas: st.noReconocidas,
    sugerencias,
    aplicado,
    tipoObservadoSugerido: secuencia.tipoObservado,
    relacionObservadoSugerido: secuencia.relacionObservado,
    faseRallySugerida: secuencia.faseRally,
    intencion,
    jugadorAmbiguo,
    jugadorCandidatos,
    jugadorAviso,
  };
}