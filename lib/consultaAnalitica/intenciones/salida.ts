// ============================================================
// INTENCIONES · SALIDA POR ROL (Cat. 3)
// ============================================================
// Detecta frases del tipo "salida del opuesto", "por dónde
// ataca más el central", "cuántos puntos hace el punta desde
// la 4", etc.
//
// El parser setea `CondicionFiltro.salidaRol` con el rol
// detectado. El motor, en respuesta.ts, lo traduce a un filtro
// efectivo:
//
//   rol:  "opuesto"  →  rol_jugador === "O", zona_origen ∈ {1, 2}
//   rol:  "central"  →  rol_jugador ∈ {"C1","C2"}, zona_origen ∈ {3, 6}
//   rol:  "punta"    →  rol_jugador ∈ {"P1","P2"}, zona_origen ∈ {4, 5}
//   rol:  "armador"  →  rol_jugador === "A", zona_origen ∈ {1..6}
//
// ------------------------------------------------------------
// ¿Por qué hay roles con múltiples zonas?
// ------------------------------------------------------------
// El opuesto ataca por la banda derecha: si está delantero
// sale por 2, si está zaguero sale por 1. Los dos son "salida
// del opuesto".
//
// Los centrales atacan por el centro: si están adelante salen
// por 3, si están atrás salen por 6 (o por 3 si es pipe corto
// desde la posición de central zaguero). Los dos son "salida
// del central".
//
// Los puntas salen por 4 (delantero izq) o por 5 (zaguero
// izq). Los dos son "salida del punta".
// ============================================================

export type RolSalida = "opuesto" | "central" | "punta" | "armador";

export const SINONIMOS_SALIDA_ROL: {
  patrones: string[];
  rol: RolSalida;
}[] = [
  // ----------------------------------------------------------
  // OPUESTO
  // ----------------------------------------------------------
  {
    patrones: [
      "salida del opuesto", "salida de los opuestos",
      "salida de la opuesta", "salida de las opuestas",
      "salidas del opuesto", "salidas de los opuestos",
      "salida del opuesto por", "salida de los opuestos por",
      "por donde sale el opuesto", "por donde salen los opuestos",
      "por donde ataca el opuesto", "por donde atacan los opuestos",
      "por donde ataca mas el opuesto", "por donde atacan mas los opuestos",
      "el opuesto ataca por", "los opuestos atacan por",
      "el opuesto ataca mas por", "los opuestos atacan mas por",
      "el opuesto ataca mas", "los opuestos atacan mas",
      "el opuesto sale por", "los opuestos salen por",
      "el opuesto sale mas por", "los opuestos salen mas por",
      "cuantos puntos hace el opuesto",
      "cuantos puntos hacen los opuestos",
      "cuantos puntos del opuesto",
      "cuantos ataques hace el opuesto",
      "cuantos ataques del opuesto",
      "cuantos puntos hace el opuesto desde",
      "cuantos puntos hacen los opuestos desde",
      "como ataca el opuesto", "como atacan los opuestos",
      "como ataca el opuesto desde",
      "del opuesto", "de los opuestos",
      "los opuestos",
    ],
    rol: "opuesto",
  },

  // ----------------------------------------------------------
  // CENTRAL
  // ----------------------------------------------------------
  {
    patrones: [
      "salida del central", "salida de los centrales",
      "salida de la central", "salida de las centrales",
      "salidas del central", "salidas de los centrales",
      "salida del central por", "salida de los centrales por",
      "por donde sale el central", "por donde salen los centrales",
      "por donde ataca el central", "por donde atacan los centrales",
      "por donde ataca mas el central",
      "por donde atacan mas los centrales",
      "el central ataca por", "los centrales atacan por",
      "el central ataca mas por", "los centrales atacan mas por",
      "el central ataca mas", "los centrales atacan mas",
      "el central sale por", "los centrales salen por",
      "el central sale mas por", "los centrales salen mas por",
      "cuantos puntos hace el central",
      "cuantos puntos hacen los centrales",
      "cuantos puntos del central",
      "cuantos puntos de los centrales",
      "cuantos ataques hace el central",
      "cuantos ataques del central",
      "cuantos puntos hace el central desde",
      "cuantos puntos hacen los centrales desde",
      "como ataca el central", "como atacan los centrales",
      "como ataca el central desde",
      "del central", "de los centrales", "de la central",
      "los centrales", "las centrales",
    ],
    rol: "central",
  },

  // ----------------------------------------------------------
  // PUNTA
  // ----------------------------------------------------------
  {
    patrones: [
      "salida del punta", "salida de los puntas",
      "salida de la punta", "salida de las puntas",
      "salidas del punta", "salidas de los puntas",
      "salida del punta por", "salida de los puntas por",
      "por donde sale el punta", "por donde salen los puntas",
      "por donde ataca el punta", "por donde atacan los puntas",
      "por donde ataca mas el punta", "por donde atacan mas los puntas",
      "el punta ataca por", "los puntas atacan por",
      "el punta ataca mas por", "los puntas atacan mas por",
      "el punta ataca mas", "los puntas atacan mas",
      "el punta sale por", "los puntas salen por",
      "el punta sale mas por", "los puntas salen mas por",
      "cuantos puntos hace el punta",
      "cuantos puntos hacen los puntas",
      "cuantos puntos del punta",
      "cuantos puntos de los puntas",
      "cuantos ataques hace el punta",
      "cuantos ataques del punta",
      "cuantos puntos hace el punta desde",
      "cuantos puntos hacen los puntas desde",
      "como ataca el punta", "como atacan los puntas",
      "como ataca el punta desde",
      "salida del puntero", "salida de los punteros",
      "por donde ataca el puntero", "por donde atacan los punteros",
      "el puntero ataca por", "los punteros atacan por",
      "por donde ataca mas el puntero",
      "cuantos puntos hace el puntero",
      "cuantos puntos de los punteros",
      "del puntero", "de los punteros",
      "salida del ala", "salida de las alas",
      "por donde ataca el ala",
      "del ala", "de las alas",
      "salida del receptor-atacante",
      "salida de los receptores-atacantes",
      "del punta", "de los puntas", "de la punta",
      "los puntas", "las puntas",
    ],
    rol: "punta",
  },

  // ----------------------------------------------------------
  // ARMADOR
  // ----------------------------------------------------------
  {
    patrones: [
      "salida del armador", "salida de los armadores",
      "salida de la armadora", "salida de las armadoras",
      "por donde sale el armador", "por donde salen los armadores",
      "por donde ataca el armador", "por donde atacan los armadores",
      "por donde ataca mas el armador",
      "el armador ataca por", "los armadores atacan por",
      "el armador ataca mas por",
      "el armador sale por",
      "cuantos puntos hace el armador",
      "cuantos puntos hacen los armadores",
      "cuantos puntos del armador",
      "cuantos ataques hace el armador",
      "cuantos ataques del armador",
      "como ataca el armador", "como atacan los armadores",
      "del armador", "de los armadores",
      "los armadores",
    ],
    rol: "armador",
  },
];

// ------------------------------------------------------------
// MAPEO ROL → ZONAS DE ORIGEN VÁLIDAS
// ------------------------------------------------------------

export const ZONAS_POR_ROL: Record<RolSalida, number[]> = {
  opuesto: [1, 2],
  central: [3, 6],
  punta: [4, 5],
  armador: [1, 2, 3, 4, 5, 6],
};

// ------------------------------------------------------------
// ROL JUGADOR → ROL SALIDA
// ------------------------------------------------------------

export const ROL_JUGADOR_A_SALIDA: Record<string, RolSalida> = {
  O: "opuesto",
  C1: "central",
  C2: "central",
  P1: "punta",
  P2: "punta",
  A: "armador",
};

// ------------------------------------------------------------
// HELPER: ¿una acción (rol + zona) matchea el filtro de salida?
// ------------------------------------------------------------

export function matcheaSalidaRol(
  rolJugador: string | null,
  zonaOrigen: number | null,
  salidaRol: RolSalida
): boolean {
  if (!rolJugador || zonaOrigen === null) return false;
  const rolAccion = ROL_JUGADOR_A_SALIDA[rolJugador];
  if (rolAccion !== salidaRol) return false;
  const zonasValidas = ZONAS_POR_ROL[salidaRol];
  return zonasValidas.includes(zonaOrigen);
}