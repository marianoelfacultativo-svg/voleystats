// ============================================================
// CLASIFICACIÓN V2 — helpers + motor de tipos de acción
// ============================================================

export type TipoAccion =
  | "saque"
  | "recepcion"
  | "armado"
  | "ataque"
  | "bloqueo"
  | "defensa"
  | "cobertura"
  | "libre"
  | "toque-red"
  | "invasion"
  | "sin-clasificar";

export type Lado = "propio" | "rival";

// ------------------------------------------------------------
// HELPERS DE CELDA
// ------------------------------------------------------------

export function ladoDeCelda(celda: string): Lado | null {
  if (/^F[123]-/.test(celda)) return "propio";
  if (/^F[456]-/.test(celda)) return "rival";
  if (celda.startsWith("BLOQ-P-")) return "propio";
  if (celda.startsWith("BLOQ-R-")) return "rival";
  if (celda.startsWith("RED-")) return null; // zona neutral
  if (celda.startsWith("FUERA-ARR-")) return "rival";
  if (celda.startsWith("FUERA-ABA-")) return "propio";
  return null;
}

export function esRed(celda: string): boolean {
  return celda.startsWith("RED-");
}

export function esBloqueoPropio(celda: string): boolean {
  return celda.startsWith("BLOQ-P-");
}

export function esBloqueoRival(celda: string): boolean {
  return celda.startsWith("BLOQ-R-");
}

export function esBloqueo(celda: string): boolean {
  return esBloqueoPropio(celda) || esBloqueoRival(celda);
}

export function esFuera(celda: string): boolean {
  return celda.startsWith("FUERA-");
}

export function esCancha(celda: string): boolean {
  return /^F[1-6]-/.test(celda);
}

// ------------------------------------------------------------
// COLORES POR TIPO
// ------------------------------------------------------------

export const COLOR_POR_TIPO: Record<TipoAccion, string> = {
  saque: "#2563eb",
  recepcion: "#16a34a",
  armado: "#8b5cf6",
  ataque: "#dc2626",
  bloqueo: "#ea580c",
  defensa: "#0891b2",
  cobertura: "#7c3aed",
  libre: "#a16207",
  "toque-red": "#0f172a",
  invasion: "#0f172a",
  "sin-clasificar": "#475569",
};

// ------------------------------------------------------------
// ESTADO Y RESULTADO
// ------------------------------------------------------------

export interface LineaClasificada {
  id: string;
  tipo: TipoAccion;
  esRival: boolean;
  origen: { celda: string; mini: string };
  destino: { celda: string; mini: string };
}

export interface EstadoClasificacion {
  saqueInicial: "propio" | "rival" | null;
  lineas: LineaClasificada[];
}

export interface ResultadoClasificacion {
  tipo: TipoAccion;
  esRival: boolean;
  // Si hay que abrir un popup para refinar la valoración
  popup: "armado" | "defensa" | null;
  // Si la línea cierra el punto automáticamente
  cierraPunto?: "propio" | "rival";
  // Si la línea suma a contadores rivales
  sumaErrorRival?: boolean;
  sumaBuenaRival?: boolean;
}

// ------------------------------------------------------------
// CLASIFICACIÓN PRINCIPAL
// ------------------------------------------------------------
// Recibe el estado actual del punto + la línea recién dibujada.
// Devuelve el tipo que corresponde a esa línea según el flujo.
//
// Cubre: saque → recepción → armado → ataque → bloqueo → defensa
// No cubre todavía: libre, posición del defensor, toque-red/invasión.

export function clasificarLinea(
  estado: EstadoClasificacion,
  linea: {
    origen: { celda: string; mini: string };
    destino: { celda: string; mini: string };
  }
): ResultadoClasificacion {
  const ladoOrigen = ladoDeCelda(linea.origen.celda);
  const ladoDestino = ladoDeCelda(linea.destino.celda);

  // ---------- CASO 0: primera línea = SAQUE ----------
  if (!estado.saqueInicial) {
    if (ladoOrigen === "propio") {
      return { tipo: "saque", esRival: false, popup: null };
    }
    if (ladoOrigen === "rival") {
      return { tipo: "saque", esRival: true, popup: null };
    }
    // Origen en red o zona inválida → no se clasifica
    return { tipo: "sin-clasificar", esRival: false, popup: null };
  }

  // ---------- CASO 1: segunda línea = RECEPCIÓN ----------
  if (estado.lineas.length === 0) {
    if (estado.saqueInicial === "propio") {
      // Yo saqué → el rival recibe
      return { tipo: "recepcion", esRival: true, popup: null };
    }
    // Rival sacó → yo recibo
    return { tipo: "recepcion", esRival: false, popup: null };
  }

  // ---------- CASO GENERAL: miramos la última línea ----------
  const ultima = estado.lineas[estado.lineas.length - 1];

  // Recepción → Armado
  if (ultima.tipo === "recepcion") {
    return {
      tipo: "armado",
      esRival: ultima.esRival,
      popup: "armado",
    };
  }

  // Armado → Ataque
  if (ultima.tipo === "armado") {
    return {
      tipo: "ataque",
      esRival: ultima.esRival,
      popup: null,
    };
  }

  // Ataque → siguientes opciones
  if (ultima.tipo === "ataque") {
    // Si la nueva línea empieza desde la red o desde zona de bloqueo
    if (esBloqueo(linea.origen.celda)) {
      return {
        tipo: "bloqueo",
        esRival: !ultima.esRival, // el bloqueo es del equipo opuesto al atacante
        popup: null,
      };
    }
    // Ataque rival → cae en mi cancha → defensa mía
    if (ultima.esRival && ladoDestino === "propio") {
      return { tipo: "defensa", esRival: false, popup: "defensa" };
    }
    // Ataque propio → cae en cancha rival → defensa rival
    if (!ultima.esRival && ladoDestino === "rival") {
      return { tipo: "defensa", esRival: true, popup: null };
    }
    // Si cae afuera o a la red → sin clasificar (el usuario tendrá que
    // decidir si fue error o el punto sigue)
    return { tipo: "sin-clasificar", esRival: ultima.esRival, popup: null };
  }

  // Bloqueo → siguientes opciones
  if (ultima.tipo === "bloqueo") {
    // Después del bloqueo, si la pelota cae en cancha propia → defensa mía
    if (!ultima.esRival && ladoDestino === "propio") {
      return { tipo: "defensa", esRival: false, popup: "defensa" };
    }
    // Si cae en cancha rival después de bloqueo mío → pelota sigue
    if (!ultima.esRival && ladoDestino === "rival") {
      return { tipo: "sin-clasificar", esRival: true, popup: null };
    }
    // Si cae en mi cancha después de bloqueo rival → defensa mía
    if (ultima.esRival && ladoDestino === "propio") {
      return { tipo: "defensa", esRival: false, popup: "defensa" };
    }
    return { tipo: "sin-clasificar", esRival: ultima.esRival, popup: null };
  }

  // Defensa → Armado
  if (ultima.tipo === "defensa") {
    return {
      tipo: "armado",
      esRival: ultima.esRival,
      popup: "armado",
    };
  }

  // Cobertura → sigue el juego
  if (ultima.tipo === "cobertura") {
    return { tipo: "sin-clasificar", esRival: ultima.esRival, popup: null };
  }

  return { tipo: "sin-clasificar", esRival: false, popup: null };
}