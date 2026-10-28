// ============================================================
// PRESETS DE FILTROS — configuración guardable
// ============================================================
// El usuario puede guardar combinaciones de filtros tácticos como
// "presets" y recuperarlas después.
//
// También hay una lista de PRESETS PREDEFINIDOS que cubren los
// análisis más comunes (contraataque del opuesto, armados en punto
// crítico, ataques de zaguero, etc.).
//
// Persistencia: localStorage con versionado.
// Sin Supabase, sin server, sin login.
// ============================================================

import type { FiltrosTacticos as FiltrosTacticosTipo } from "./filtrosTacticos";
import { FILTROS_TACTICOS_VACIO } from "./filtrosTacticos";

// ------------------------------------------------------------
// TIPOS
// ------------------------------------------------------------

/**
 * Estructura de un preset. El `patch` solo contiene los campos que
 * el preset quiere sobrescribir. El resto se resetea a valores
 * vacíos al aplicar (para que sea predecible).
 */
export interface PresetFiltro {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
  patch: {
    tipos?: string[];
    subtipos?: string[];
    valoraciones?: string[];
    zonasOrigen?: string[];
    zonasDestino?: string[];
    rol?: string;
    zonaJugador?: number | "todas";
    soloErrores?: boolean;
    acciones?: "propias" | "rivales" | "ambas";
    tacticos?: Partial<FiltrosTacticosTipo>;
  };
}

/**
 * Tipo estructural mínimo que necesita `aplicarPreset()`. Es un
 * subconjunto de `Filtros3D` sin importar el archivo de la app
 * (evita dependencias circulares).
 */
export interface PresetTargetFiltros {
  tipos: string[];
  subtipos: string[];
  valoraciones: string[];
  zonasOrigen: string[];
  zonasDestino: string[];
  rol: string;
  zonaJugador: number | "todas";
  soloErrores: boolean;
  acciones: "propias" | "rivales" | "ambas";
  tacticos: FiltrosTacticosTipo;
}

// ------------------------------------------------------------
// PRESETS PREDEFINIDOS
// ------------------------------------------------------------

export const PRESETS_PREDEFINIDOS: PresetFiltro[] = [
  {
    id: "contraataque-opuesto",
    nombre: "Contraataques del opuesto",
    descripcion:
      "Ataques del opuesto en fase de contraataque (después de defensa o bloqueo propio).",
    icono: "⚡",
    patch: {
      tipos: ["ataque"],
      rol: "O",
      tacticos: {
        rally: {
          fase: "contraataque",
          esPrimerToque: "cualquiera",
          toquesMinimo: null,
          inicioPunto: "cualquiera",
        },
      },
    },
  },
  {
    id: "side-out-primer-toque",
    nombre: "Side-out primeras pelotas",
    descripcion:
      "Ataques en side-out en el primer toque del equipo (primera pelota después de recepción).",
    icono: "🎯",
    patch: {
      tipos: ["ataque"],
      tacticos: {
        rally: {
          fase: "side-out",
          esPrimerToque: "si",
          toquesMinimo: null,
          inicioPunto: "cualquiera",
        },
      },
    },
  },
  {
    id: "armados-criticos",
    nombre: "Armados en punto crítico",
    descripcion:
      "Armados en puntos críticos (≤ 5 puntos para cerrar el set).",
    icono: "🔥",
    patch: {
      tipos: ["armado"],
      tacticos: {
        marcador: {
          estado: "cualquiera",
          diferencia: "cualquiera",
          soloCriticos: true,
        },
      },
    },
  },
  {
    id: "ataques-zaguero",
    nombre: "Ataques de zaguero",
    descripcion:
      "Ataques de jugadores zagueros (Z1, Z5, Z6) — pipe, C, zaguero por 6.",
    icono: "🚀",
    patch: {
      tipos: ["ataque"],
      tacticos: {
        ubicacion: "zaguero",
      },
    },
  },
  {
    id: "racha-3",
    nombre: "Racha de 3+",
    descripcion:
      "Acciones durante rachas de 3+ puntos ganados o perdidos consecutivos.",
    icono: "📈",
    patch: {
      tacticos: {
        rachaMinima: 3,
      },
    },
  },
  {
    id: "errores-propios",
    nombre: "Solo errores propios",
    descripcion:
      "Todas las acciones del equipo propio que terminaron en error.",
    icono: "❌",
    patch: {
      soloErrores: true,
      acciones: "propias",
    },
  },
  {
    id: "ataques-top",
    nombre: "Ataques por encima del promedio",
    descripcion:
      "Ataques con puntaje por encima del promedio del equipo.",
    icono: "⭐",
    patch: {
      tipos: ["ataque"],
      tacticos: {
        vsPromedio: "por_encima",
      },
    },
  },
  {
    id: "free-ball",
    nombre: "Free ball (libre rival)",
    descripcion:
      "Ataques en free ball (después de una libre del rival).",
    icono: "🆓",
    patch: {
      tipos: ["ataque"],
      tacticos: {
        rally: {
          fase: "free-ball",
          esPrimerToque: "cualquiera",
          toquesMinimo: null,
          inicioPunto: "cualquiera",
        },
      },
    },
  },
  {
    id: "bloqueo-contraataque",
    nombre: "Bloqueo en contraataque",
    descripcion:
      "Bloqueos propios durante contraataques (después de defensa).",
    icono: "🛡️",
    patch: {
      tipos: ["bloqueo"],
      tacticos: {
        rally: {
          fase: "contraataque",
          esPrimerToque: "cualquiera",
          toquesMinimo: null,
          inicioPunto: "cualquiera",
        },
      },
    },
  },
  {
    id: "recepciones-negativas",
    nombre: "Recepciones negativas",
    descripcion:
      "Recepciones negativas del equipo propio (R-, R--, R=).",
    icono: "🙌",
    patch: {
      tipos: ["recepcion"],
      valoraciones: ["negativa", "doble_negativa", "error_directo"],
    },
  },
];

// ------------------------------------------------------------
// APLICAR UN PRESET
// ------------------------------------------------------------

/**
 * Aplica un preset sobre un objeto de filtros base.
 *
 * - Los campos NO especificados por el preset se resetean a vacío
 *   (tacticos, tipos, etc.) para que el resultado sea predecible.
 * - Los campos de "contexto" que el preset NO toca (set, punto,
 *   jugador, rotación) se PRESERVAN del base.
 * - Se marca `presetActivoId` con el id del preset aplicado.
 */
export function aplicarPreset<T extends PresetTargetFiltros>(
  base: T,
  preset: PresetFiltro
): T {
  const patch = preset.patch;
  return {
    ...base,
    tipos: patch.tipos ?? [],
    subtipos: patch.subtipos ?? [],
    valoraciones: patch.valoraciones ?? [],
    zonasOrigen: patch.zonasOrigen ?? [],
    zonasDestino: patch.zonasDestino ?? [],
    rol: patch.rol ?? "todos",
    zonaJugador: patch.zonaJugador ?? "todas",
    soloErrores: patch.soloErrores ?? false,
    acciones: patch.acciones ?? "propias",
    tacticos: {
      ...FILTROS_TACTICOS_VACIO,
      ...(patch.tacticos ?? {}),
      presetActivoId: preset.id,
    },
  };
}

// ------------------------------------------------------------
// CREAR UN PRESET DESDE EL ESTADO ACTUAL
// ------------------------------------------------------------

export function crearPresetDesdeFiltros(
  nombre: string,
  filtrosActuales: PresetTargetFiltros,
  descripcion: string = "Preset guardado por el usuario",
  icono: string = "💾"
): PresetFiltro {
  return {
    id: generarIdPreset(nombre),
    nombre: nombre.trim(),
    descripcion,
    icono,
    patch: {
      tipos: [...filtrosActuales.tipos],
      subtipos: [...filtrosActuales.subtipos],
      valoraciones: [...filtrosActuales.valoraciones],
      zonasOrigen: [...filtrosActuales.zonasOrigen],
      zonasDestino: [...filtrosActuales.zonasDestino],
      rol: filtrosActuales.rol,
      zonaJugador: filtrosActuales.zonaJugador,
      soloErrores: filtrosActuales.soloErrores,
      acciones: filtrosActuales.acciones,
      tacticos: { ...filtrosActuales.tacticos },
    },
  };
}

// ------------------------------------------------------------
// ID GENERATION
// ------------------------------------------------------------

export function generarIdPreset(nombre: string): string {
  const base = nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const sufijo = Date.now().toString(36).slice(-4);
  return `user-${base || "preset"}-${sufijo}`;
}

// ------------------------------------------------------------
// PERSISTENCIA EN LOCALSTORAGE
// ------------------------------------------------------------

const STORAGE_KEY = "voleystats_presets_filtros_v1";
const VERSION_KEY = "voleystats_presets_filtros_version";
const PRESET_VERSION = 1;

function esPresetValido(p: unknown): p is PresetFiltro {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.nombre === "string" &&
    typeof o.icono === "string" &&
    typeof o.patch === "object" &&
    o.patch !== null
  );
}

/**
 * Carga los presets guardados por el usuario en localStorage.
 * Si la versión del schema cambió, descarta los presets viejos.
 */
export function cargarPresetsUsuario(): PresetFiltro[] {
  if (typeof window === "undefined") return [];
  try {
    const version = window.localStorage.getItem(VERSION_KEY);
    if (version !== String(PRESET_VERSION)) {
      // Schema viejo → descartar para evitar crashes
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.setItem(VERSION_KEY, String(PRESET_VERSION));
      return [];
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(esPresetValido);
  } catch {
    return [];
  }
}

/**
 * Guarda (o actualiza) un preset. Si ya existe el mismo id, lo
 * reemplaza.
 */
export function guardarPreset(preset: PresetFiltro): boolean {
  if (typeof window === "undefined") return false;
  try {
    const actuales = cargarPresetsUsuario();
    const idx = actuales.findIndex((p) => p.id === preset.id);
    if (idx >= 0) {
      actuales[idx] = preset;
    } else {
      actuales.push(preset);
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(actuales));
    window.localStorage.setItem(VERSION_KEY, String(PRESET_VERSION));
    return true;
  } catch {
    return false;
  }
}

/**
 * Borra un preset por id.
 */
export function borrarPreset(id: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const actuales = cargarPresetsUsuario();
    const filtrados = actuales.filter((p) => p.id !== id);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filtrados));
    return true;
  } catch {
    return false;
  }
}

/**
 * Devuelve todos los presets disponibles (predefinidos + usuario),
 * sin duplicados. Si el usuario guardó uno con el mismo id que uno
 * predefinido, el del usuario gana.
 */
export function todosLosPresets(): PresetFiltro[] {
  const usuario = cargarPresetsUsuario();
  const idsUsuario = new Set(usuario.map((p) => p.id));
  const predefinidosFiltrados = PRESETS_PREDEFINIDOS.filter(
    (p) => !idsUsuario.has(p.id)
  );
  return [...predefinidosFiltrados, ...usuario];
}

/**
 * ¿Es un preset predefinido (no del usuario)?
 */
export function esPredefinido(preset: PresetFiltro): boolean {
  return PRESETS_PREDEFINIDOS.some((p) => p.id === preset.id);
}

/**
 * Limpia TODOS los presets del usuario (no toca los predefinidos).
 */
export function borrarTodosLosPresetsUsuario(): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.setItem(VERSION_KEY, String(PRESET_VERSION));
    return true;
  } catch {
    return false;
  }
}