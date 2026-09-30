// ============================================
// SISTEMA DE ROTACIONES 5-1
// ============================================

export type Rol = "P" | "L" | "A" | "C" | "O";
export type Zona = 1 | 2 | 3 | 4 | 5 | 6;
export type SaqueEquipo = "propio" | "rival";
export type TipoLogico = "A" | "O" | "C1" | "C2" | "P1" | "P2";

export interface AsignacionZona {
  zona: Zona;
  jugador_id: string | null;
  rol: Rol;
  tipo: TipoLogico;
}

export interface Libero {
  jugador_id: string;
  tipo: "defensa" | "recepcion";
}

export interface RotacionPunto {
  set_numero: number;
  punto_numero: number;
  saque_equipo: SaqueEquipo;
  posiciones: Record<Zona, AsignacionZona>;
  liberos: Libero[];
}

// ------------------------------------------------------------
// ROTACIÓN BASE ESTÁNDAR 5-1
// Fila delantera (red): 4 - 3 - 2
// Fila trasera:         5 - 6 - 1
// ------------------------------------------------------------
export const ROTACION_BASE: Record<
  number,
  Record<Zona, TipoLogico>
> = {
  1: { 1: "A", 2: "P1", 3: "C1", 4: "O", 5: "P2", 6: "C2" },
  2: { 1: "P1", 2: "C1", 3: "O", 4: "P2", 5: "C2", 6: "A" },
  3: { 1: "C1", 2: "O", 3: "P2", 4: "C2", 5: "A", 6: "P1" },
  4: { 1: "O", 2: "P2", 3: "C2", 4: "A", 5: "P1", 6: "C1" },
  5: { 1: "P2", 2: "C2", 3: "A", 4: "P1", 5: "C1", 6: "O" },
  6: { 1: "C2", 2: "A", 3: "P1", 4: "C1", 5: "O", 6: "P2" },
};

export const ROL_DE_TIPO: Record<TipoLogico, Rol> = {
  A: "A",
  O: "O",
  C1: "C",
  C2: "C",
  P1: "P",
  P2: "P",
};

export const ETIQUETA_ROL: Record<Rol, string> = {
  P: "Punta",
  L: "Líbero",
  A: "Armador",
  C: "Central",
  O: "Opuesto",
};

export const ETIQUETA_TIPO: Record<TipoLogico, string> = {
  A: "Armador",
  O: "Opuesto",
  C1: "Central 1",
  C2: "Central 2",
  P1: "Punta 1",
  P2: "Punta 2",
};

export function girarRotacion(actual: number, dir: 1 | -1): number {
  return ((actual - 1 + dir + 6) % 6) + 1;
}

export function rotacionVacia(
  numeroRotacion: number,
  set_numero: number,
  punto_numero: number,
  saque_equipo: SaqueEquipo = "propio"
): RotacionPunto {
  const base = ROTACION_BASE[numeroRotacion] ?? ROTACION_BASE[1];
  const posiciones: Partial<Record<Zona, AsignacionZona>> = {};
  (Object.keys(base) as unknown as Zona[]).forEach((z) => {
    const zona = Number(z) as Zona;
    const tipo = base[zona];
    posiciones[zona] = {
      zona,
      jugador_id: null,
      rol: ROL_DE_TIPO[tipo],
      tipo,
    };
  });
  return {
    set_numero,
    punto_numero,
    saque_equipo,
    posiciones: posiciones as Record<Zona, AsignacionZona>,
    liberos: [],
  };
}

export function asignarJugador(
  rot: RotacionPunto,
  zona: Zona,
  jugador_id: string | null
): RotacionPunto {
  return {
    ...rot,
    posiciones: {
      ...rot.posiciones,
      [zona]: { ...rot.posiciones[zona], jugador_id },
    },
  };
}

export function zonaDeTipo(rot: RotacionPunto, tipo: TipoLogico): Zona | null {
  for (const z of Object.values(rot.posiciones)) {
    if (z.tipo === tipo) return z.zona;
  }
  return null;
}

export function jugadorDeTipo(
  rot: RotacionPunto,
  tipo: TipoLogico
): string | null {
  for (const z of Object.values(rot.posiciones)) {
    if (z.tipo === tipo) return z.jugador_id;
  }
  return null;
}

export function atacanteDeZona(
  rot: RotacionPunto,
  zona: number
): string | null {
  const z = rot.posiciones[zona as Zona];
  if (!z) return null;
  return z.jugador_id;
}

// ------------------------------------------------------------
// Helper: derivar número de rotación desde las posiciones
// ------------------------------------------------------------
export function numeroRotacionDesdePosiciones(rot: RotacionPunto): number {
  for (let i = 1; i <= 6; i++) {
    const base = ROTACION_BASE[i];
    let match = true;
    for (const zona of Object.keys(base) as unknown as Zona[]) {
      const z = Number(zona) as Zona;
      if (base[z] !== rot.posiciones[z]?.tipo) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return 1;
}

// ------------------------------------------------------------
// Helper: girar una rotación manteniendo los jugadores en sus tipos
// ------------------------------------------------------------
export function girarRotacionPunto(
  rot: RotacionPunto,
  dir: 1 | -1
): { rotacion: RotacionPunto; nuevoNumero: number } {
  const numeroActual = numeroRotacionDesdePosiciones(rot);
  const nuevoNumero = girarRotacion(numeroActual, dir);

  const jugadorPorTipo: Partial<Record<TipoLogico, string | null>> = {};
  Object.values(rot.posiciones).forEach((p) => {
    jugadorPorTipo[p.tipo] = p.jugador_id;
  });

  const base = ROTACION_BASE[nuevoNumero] ?? ROTACION_BASE[1];
  const nuevasPosiciones: Partial<Record<Zona, AsignacionZona>> = {};
  (Object.keys(base) as unknown as Zona[]).forEach((z) => {
    const zona = Number(z) as Zona;
    const tipo = base[zona];
    nuevasPosiciones[zona] = {
      zona,
      jugador_id: jugadorPorTipo[tipo] ?? null,
      rol: ROL_DE_TIPO[tipo],
      tipo,
    };
  });

  return {
    rotacion: {
      ...rot,
      posiciones: nuevasPosiciones as Record<Zona, AsignacionZona>,
    },
    nuevoNumero,
  };
}