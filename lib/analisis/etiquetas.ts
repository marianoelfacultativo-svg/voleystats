// ============================================================
// ETIQUETAS
// ============================================================
// Extraído de lib/analisisConsecuencias.ts (v9).
// Todas las etiquetas visibles en la UI.
// ============================================================

import type {
  AmbitoRacha,
  CierraPuntoFiltro,
  ConDesplazamiento,
  OperadorBloque,
  RelacionJugador,
  RelacionJugadorObservado,
  TipoDisparador,
  UbicacionFiltro,
  VarianteAtaque,
} from "./tipos";

export function etiquetaTipoDisparador(t: TipoDisparador): string {
  const map: Record<TipoDisparador, string> = {
    saque: "Saque",
    recepcion: "Recepción",
    armado: "Armado",
    ataque: "Ataque",
    bloqueo: "Bloqueo",
    defensa: "Defensa",
    libre: "Libre",
    "roce-red": "Roce red",
  };
  return map[t] ?? t;
}

export function etiquetaResultado(r: string): string {
  if (r === "cualquiera") return "Cualquier resultado";
  return r.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function etiquetaAmbito(a: AmbitoRacha): string {
  const map: Record<AmbitoRacha, string> = {
    mismo_punto: "Mismo punto",
    puntos_del_set: "Este set",
    partido: "Todo el partido",
  };
  return map[a];
}

export function etiquetaUbicacion(u: UbicacionFiltro): string {
  const map: Record<UbicacionFiltro, string> = {
    cualquiera: "Cualquier ubicación",
    delantero: "Delantero",
    zaguero: "Zaguero",
    libero: "Líbero",
    otro: "Otro",
  };
  return map[u];
}

export function etiquetaRelacion(r: RelacionJugador): string {
  const map: Record<RelacionJugador, string> = {
    cualquiera: "Cualquier jugador",
    mismo: "El mismo jugador",
    companero: "Un compañero",
    rival: "Un rival",
  };
  return map[r];
}

export function etiquetaRelacionObservado(r: RelacionJugadorObservado): string {
  const map: Record<RelacionJugadorObservado, string> = {
    cualquiera: "Cualquier jugador",
    mismo: "El mismo jugador",
    companero: "Un compañero",
    rival: "Un rival",
  };
  return map[r];
}

export function etiquetaCierraPunto(c: CierraPuntoFiltro): string {
  const map: Record<CierraPuntoFiltro, string> = {
    cualquiera: "Cualquiera",
    si: "Solo si cerró",
    no: "Solo si NO cerró",
  };
  return map[c];
}

export function etiquetaOperador(op: OperadorBloque): string {
  const map: Record<OperadorBloque, string> = {
    AND: "Y",
    OR: "O",
    NOT: "Y NO",
  };
  return map[op];
}

export function etiquetaVariante(v: VarianteAtaque | null): string {
  if (v === null) return "Cualquiera";
  return v === "remate" ? "Remate" : "Toque";
}

export function etiquetaConDesplazamiento(c: ConDesplazamiento): string {
  const map: Record<ConDesplazamiento, string> = {
    cualquiera: "Cualquiera",
    si: "Con desplazamiento",
    no: "Sin desplazamiento",
  };
  return map[c];
}

export function etiquetaLlamadaInferida(l: string): string {
  const map: Record<string, string> = {
    hatu: "Hatu",
    corta_atras: "Corta atrás",
    shoot: "Shoot / Flecha",
    superfast: "Superfast",
    v: "V por 2",
    bic: "Bic",
    pipe: "Pipe",
    hanati_volada: "Hanatí volada",
    slide: "Slide",
    alta_a_4: "Alta a 4",
    alta_a_2: "Alta a 2",
    alta_al_central: "Alta al central",
    pipe_alto: "Pipe alto",
  };
  return map[l] ?? l;
}

export function etiquetaDireccionAtaque(d: string): string {
  const map: Record<string, string> = {
    paralela: "Paralela",
    diagonal: "Diagonal",
    en_linea: "En línea",
    sobre_6: "Sobre 6",
    desde_zaguero: "Desde zaguero",
  };
  return map[d] ?? d;
}