// ============================================================
// CONSTANTES — Análisis de consecuencias (UI)
// ============================================================
// Todos los arrays de opciones que alimentan los <select>,
// multi-chips y listas de la UI. Puro datos, sin lógica.
//
// v2: agregada categoría "secuencia" al mapa de colores
// (para los chips del parser v3.8 que detecta "que defiende
// el rival", "que bloquea un compañero", "vuelve libre", etc.)
// ============================================================

import type {
  AmbitoRacha,
  CierraPuntoFiltro,
  ConDesplazamiento,
  OperadorBloque,
  PosicionEnSet,
  RelacionJugador,
  RelacionJugadorObservado,
  TipoDisparador,
  TipoRachaJugador,
  UbicacionFiltro,
  VarianteAtaque,
} from "@/lib/analisisConsecuencias";
import type { CategoriaMatch } from "@/lib/parserBusqueda";

// ------------------------------------------------------------
// TIPOS DE TRIGGER
// ------------------------------------------------------------

export const TIPOS: { v: TipoDisparador; label: string }[] = [
  { v: "ataque", label: "Ataque" },
  { v: "saque", label: "Saque" },
  { v: "recepcion", label: "Recepción" },
  { v: "bloqueo", label: "Bloqueo" },
  { v: "armado", label: "Armado" },
  { v: "defensa", label: "Defensa" },
  { v: "libre", label: "Pelota libre" },
  { v: "roce-red", label: "Roce red" },
];

// ------------------------------------------------------------
// TIPOS OBSERVADOS
// ------------------------------------------------------------

export const TIPOS_OBSERVADOS: {
  v: TipoDisparador | "cualquiera";
  label: string;
}[] = [
  { v: "cualquiera", label: "1ª acción siguiente" },
  { v: "ataque", label: "Sig. ataque" },
  { v: "saque", label: "Sig. saque" },
  { v: "recepcion", label: "Sig. recepción" },
  { v: "bloqueo", label: "Sig. bloqueo" },
  { v: "armado", label: "Sig. armado" },
  { v: "defensa", label: "Sig. defensa" },
];

// ------------------------------------------------------------
// RELACIONES DEL JUGADOR OBSERVADO
// ------------------------------------------------------------

export const RELACIONES_OBSERVADO: {
  v: RelacionJugadorObservado;
  label: string;
}[] = [
  { v: "cualquiera", label: "Cualquier jugador" },
  { v: "mismo", label: "Mismo que el trigger" },
  { v: "companero", label: "Un compañero" },
  { v: "rival", label: "Un rival" },
];

// ------------------------------------------------------------
// ALCANCES
// ------------------------------------------------------------

export const ALANCES = [
  { v: "partido" as const, label: "En el partido" },
  { v: "mismo_punto" as const, label: "Solo en el mismo punto" },
];

// ------------------------------------------------------------
// OPERADORES
// ------------------------------------------------------------

export const OPERADORES: { v: OperadorBloque; label: string }[] = [
  { v: "AND", label: "Y" },
  { v: "OR", label: "O" },
  { v: "NOT", label: "Y NO" },
];

// ------------------------------------------------------------
// AMBITOS DE RACHA
// ------------------------------------------------------------

export const AMBITOS: { v: AmbitoRacha; label: string }[] = [
  { v: "mismo_punto", label: "Mismo punto" },
  { v: "puntos_del_set", label: "Este set" },
  { v: "partido", label: "Todo el partido" },
];

// ------------------------------------------------------------
// UBICACIONES
// ------------------------------------------------------------

export const UBICACIONES: { v: UbicacionFiltro; label: string }[] = [
  { v: "cualquiera", label: "Cualquiera" },
  { v: "delantero", label: "Delantero" },
  { v: "zaguero", label: "Zaguero" },
  { v: "libero", label: "Líbero" },
  { v: "otro", label: "Otro" },
];

// ------------------------------------------------------------
// RELACIONES DE ACCIÓN PREVIA
// ------------------------------------------------------------

export const RELACIONES_PREVIA: { v: RelacionJugador; label: string }[] = [
  { v: "cualquiera", label: "Cualquier jugador" },
  { v: "mismo", label: "Mismo jugador" },
  { v: "companero", label: "Compañero" },
  { v: "rival", label: "Rival" },
];

// ------------------------------------------------------------
// CIERRAS PUNTO
// ------------------------------------------------------------

export const CIERRAS: { v: CierraPuntoFiltro; label: string }[] = [
  { v: "cualquiera", label: "Cualquiera" },
  { v: "si", label: "Cerró el punto" },
  { v: "no", label: "NO cerró el punto" },
];

// ------------------------------------------------------------
// VELOCIDADES
// ------------------------------------------------------------

export const VELOCIDADES: { v: number | null; label: string }[] = [
  { v: null, label: "Cualquiera" },
  { v: 1, label: "1" },
  { v: 1.5, label: "1.5" },
  { v: 2, label: "2" },
  { v: 3, label: "3" },
  { v: 5, label: "5" },
];

// ------------------------------------------------------------
// TIPOS DE SAQUE
// ------------------------------------------------------------

export const TIPOS_SAQUE: {
  v: "potencia" | "flotado" | null;
  label: string;
}[] = [
  { v: null, label: "Cualquiera" },
  { v: "potencia", label: "Potencia" },
  { v: "flotado", label: "Flotado" },
];

// ------------------------------------------------------------
// ZONAS
// ------------------------------------------------------------

export const ZONAS_JUGADOR: { v: number; label: string }[] = [
  { v: 1, label: "Z1" },
  { v: 2, label: "Z2" },
  { v: 3, label: "Z3" },
  { v: 4, label: "Z4" },
  { v: 5, label: "Z5" },
  { v: 6, label: "Z6" },
];

export const ZONAS_DESTINO = [1, 2, 3, 4, 5, 6];

// ------------------------------------------------------------
// ROLES / ROTACIONES
// ------------------------------------------------------------

export const ROLES = ["A", "O", "C1", "C2", "P1", "P2", "L"];
export const ROTACIONES = [1, 2, 3, 4, 5, 6];

// ------------------------------------------------------------
// VARIANTES DE ATAQUE
// ------------------------------------------------------------

export const VARIANTES: { v: VarianteAtaque | null; label: string }[] = [
  { v: null, label: "Cualquiera" },
  { v: "remate", label: "Remate" },
  { v: "toque", label: "Toque" },
];

// ------------------------------------------------------------
// LLAMADAS DEL ARMADO (inferidas)
// ------------------------------------------------------------

export const OPCIONES_LLAMADA: { v: string; label: string }[] = [
  { v: "hatu", label: "Hatu" },
  { v: "corta_atras", label: "Corta atrás" },
  { v: "shoot", label: "Shoot / Flecha" },
  { v: "superfast", label: "Superfast" },
  { v: "v", label: "V por 2" },
  { v: "bic", label: "Bic" },
  { v: "pipe", label: "Pipe" },
  { v: "hanati_volada", label: "Hanatí volada" },
  { v: "slide", label: "Slide" },
  { v: "alta_a_4", label: "Alta a 4" },
  { v: "alta_a_2", label: "Alta a 2" },
  { v: "alta_al_central", label: "Alta al central" },
  { v: "pipe_alto", label: "Pipe alto" },
];

// ------------------------------------------------------------
// DIRECCIONES DE ATAQUE (legacy)
// ------------------------------------------------------------

export const OPCIONES_DIRECCION: { v: string; label: string }[] = [
  { v: "paralela", label: "Paralela" },
  { v: "diagonal", label: "Diagonal" },
  { v: "en_linea", label: "En línea" },
  { v: "sobre_6", label: "Sobre 6" },
  { v: "desde_zaguero", label: "Desde zaguero" },
];

// ------------------------------------------------------------
// DESPLAZAMIENTO
// ------------------------------------------------------------

export const OPCIONES_DESPLAZAMIENTO: {
  v: ConDesplazamiento;
  label: string;
}[] = [
  { v: "cualquiera", label: "Cualquiera" },
  { v: "si", label: "Con desplazamiento" },
  { v: "no", label: "Sin desplazamiento" },
];

// ------------------------------------------------------------
// ESTADOS DEL MARCADOR
// ------------------------------------------------------------

export const ESTADOS_MARCADOR = [
  { v: "cualquiera" as const, label: "Cualquier estado" },
  { v: "empatado" as const, label: "Empatado" },
  { v: "ganando" as const, label: "Ganando" },
  { v: "perdiendo" as const, label: "Perdiendo" },
];

export const DIFERENCIAS_MARCADOR = [
  { v: "cualquiera" as const, label: "Cualquiera" },
  { v: "0" as const, label: "Empate (0)" },
  { v: "1-2" as const, label: "1-2 pts" },
  { v: "3-5" as const, label: "3-5 pts" },
  { v: "6+" as const, label: "6+ pts" },
];

export const PUNTOS_CERRAR = [
  { v: "cualquiera" as const, label: "Cualquiera" },
  { v: "<=1" as const, label: "≤ 1 (match)" },
  { v: "<=3" as const, label: "≤ 3" },
  { v: "<=5" as const, label: "≤ 5" },
];

// ------------------------------------------------------------
// FASES DEL RALLY
// ------------------------------------------------------------

export const FASES_RALLY = [
  { v: "cualquiera" as const, label: "Cualquier fase" },
  { v: "side-out" as const, label: "Side-out (K1)" },
  { v: "k2" as const, label: "Contraataque defensa (K2)" },
  { v: "k3" as const, label: "Contraataque cobertura (K3)" },
  { v: "contraataque" as const, label: "Contraataque (legacy)" },
  { v: "free-ball" as const, label: "Free ball" },
  { v: "otro" as const, label: "Otro" },
];

// ------------------------------------------------------------
// INICIOS DEL PUNTO
// ------------------------------------------------------------

export const INICIOS_PUNTO = [
  { v: "cualquiera" as const, label: "Cualquiera" },
  { v: "ace_propio" as const, label: "Ace propio" },
  { v: "ace_rival" as const, label: "Ace rival" },
  { v: "recepcion_positiva" as const, label: "Recepción +" },
  { v: "recepcion_neutra" as const, label: "Recepción !" },
  { v: "recepcion_negativa" as const, label: "Recepción -" },
  { v: "overpass" as const, label: "Overpass" },
  { v: "error_directo" as const, label: "Error directo" },
  { v: "otro" as const, label: "Otro" },
];

// ------------------------------------------------------------
// POSICIÓN EN SET
// ------------------------------------------------------------

export const POSICIONES_SET: { v: PosicionEnSet; label: string }[] = [
  { v: "cualquiera", label: "Cualquiera" },
  { v: "primero", label: "Primer punto del set" },
  { v: "ultimo", label: "Último punto del set" },
];

// ------------------------------------------------------------
// RACHA DE JUGADOR
// ------------------------------------------------------------

export const TIPOS_RACHA_JUGADOR: { v: TipoRachaJugador; label: string }[] = [
  { v: "puntos_ganados", label: "Puntos ganados seguidos" },
  { v: "puntos_perdidos", label: "Puntos perdidos seguidos" },
  { v: "errores_seguidos", label: "Errores seguidos" },
  { v: "aciertos_seguidos", label: "Aciertos seguidos" },
];

// ------------------------------------------------------------
// COMPARADORES
// ------------------------------------------------------------

export const COMPARADORES: {
  key:
    | "mismaZonaTriggerDestino"
    | "mismaZonaTriggerOrigen"
    | "mismaVelocidadAnterior";
  etiqueta: string;
}[] = [
  { key: "mismaZonaTriggerDestino", etiqueta: "Misma zona destino" },
  { key: "mismaZonaTriggerOrigen", etiqueta: "Misma zona origen" },
  { key: "mismaVelocidadAnterior", etiqueta: "Misma velocidad" },
];

// ------------------------------------------------------------
// COLORES POR CATEGORÍA DE MATCH DEL PARSER
// ------------------------------------------------------------
// v2: agregada la categoría "secuencia" (para los chips de
// "que defiende el rival", "vuelve libre", etc.)
// ------------------------------------------------------------

export const CATEGORIA_COLOR: Record<CategoriaMatch, string> = {
  tipo: "bg-blue-500/20 text-blue-200 border-blue-500/40",
  resultado: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40",
  jugador: "bg-amber-500/20 text-amber-200 border-amber-500/40",
  set: "bg-violet-500/20 text-violet-200 border-violet-500/40",
  punto: "bg-violet-500/20 text-violet-200 border-violet-500/40",
  partido: "bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-500/40",
  rol: "bg-cyan-500/20 text-cyan-200 border-cyan-500/40",
  zona: "bg-cyan-500/20 text-cyan-200 border-cyan-500/40",
  rotacion: "bg-cyan-500/20 text-cyan-200 border-cyan-500/40",
  velocidad: "bg-sky-500/20 text-sky-200 border-sky-500/40",
  "tipo-saque": "bg-orange-500/20 text-orange-200 border-orange-500/40",
  previa: "bg-rose-500/20 text-rose-200 border-rose-500/40",
  "racha-jugador": "bg-rose-500/20 text-rose-200 border-rose-500/40",
  top: "bg-yellow-500/20 text-yellow-200 border-yellow-500/40",
  "vs-promedio": "bg-yellow-500/20 text-yellow-200 border-yellow-500/40",
  contexto: "bg-slate-500/20 text-slate-200 border-slate-500/40",
  "posicion-set": "bg-slate-500/20 text-slate-200 border-slate-500/40",
  secuencia: "bg-pink-500/20 text-pink-200 border-pink-500/40",
};