// ============================================================
// PRESETS DE ANÁLISIS — persistencia en localStorage
// ============================================================
// Guarda la configuración completa de un panel de análisis
// (bloques CUANDO con operadores, acción observada, alcance,
// comparadores) para recuperarla después.
//
// Cada preset incluye:
//   - 10 presets PREDEFINIDOS tácticos (listos para usar).
//   - Los presets GUARDADOS POR EL USUARIO (persistidos en
//     localStorage con versionado).
// ============================================================

import {
  BLOQUE_TRIGGER_VACIO,
  CONTEXTO_PARTIDO_VACIO,
  COINCIDENCIA_VACIA,
  FILTRO_ACCION_HISTORICA_VACIO,
  type BloqueTrigger,
  type CoincidenciaFiltro,
  type TipoDisparador,
} from "./analisisConsecuencias";

// ------------------------------------------------------------
// TIPO ESTRUCTURAL
// ------------------------------------------------------------

export interface PresetTargetConfig {
  bloques: BloqueTrigger[];
  tipoObservado: TipoDisparador | "cualquiera";
  jugadorObservadoFiltro: string;
  alcance: "partido" | "mismo_punto";
  coincidencias: CoincidenciaFiltro;
}

// ------------------------------------------------------------
// TIPO PRESET
// ------------------------------------------------------------

export interface PresetAnalisis {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
  config: PresetTargetConfig;
}

// ------------------------------------------------------------
// HELPERS INTERNOS
// ------------------------------------------------------------

let _blockCounter = 0;
function generarIdBloque(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `b-${crypto.randomUUID()}`;
  }
  _blockCounter += 1;
  return `b-${Date.now()}-${_blockCounter}`;
}

let _rachaCounter = 0;
function generarIdRacha(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `r-${crypto.randomUUID()}`;
  }
  _rachaCounter += 1;
  return `r-${Date.now()}-${_rachaCounter}`;
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

function regenerarIds(config: PresetTargetConfig): PresetTargetConfig {
  return {
    ...config,
    bloques: config.bloques.map((b) => ({
      ...b,
      id: generarIdBloque(),
      filtro: {
        ...b.filtro,
        rachas: b.filtro.rachas.map((r) => ({
          ...r,
          id: generarIdRacha(),
        })),
      },
    })),
  };
}

// ------------------------------------------------------------
// PRESETS PREDEFINIDOS
// ------------------------------------------------------------

export const PRESETS_PREDEFINIDOS: PresetAnalisis[] = [
  {
    id: "armados-cierre-set",
    nombre: "Armados en cierre de set",
    descripcion:
      "Cómo arma el equipo en los puntos críticos del set (≤3 para cerrar).",
    icono: "🔥",
    config: {
      bloques: [
        {
          id: "auto-1",
          operador: "AND",
          filtro: {
            ...BLOQUE_TRIGGER_VACIO,
            tipo: "armado",
            contextoPartido: {
              ...CONTEXTO_PARTIDO_VACIO,
              marcador: {
                ...CONTEXTO_PARTIDO_VACIO.marcador,
                puntosParaCerrar: "<=3",
              },
            },
          },
        },
      ],
      tipoObservado: "ataque",
      jugadorObservadoFiltro: "companero",
      alcance: "partido",
      coincidencias: { ...COINCIDENCIA_VACIA },
    },
  },
  {
    id: "ataque-tras-error-propio",
    nombre: "Ataque tras error propio",
    descripcion:
      "Cómo ataca el mismo jugador después de que erró el ataque anterior.",
    icono: "❌",
    config: {
      bloques: [
        {
          id: "auto-1",
          operador: "AND",
          filtro: {
            ...BLOQUE_TRIGGER_VACIO,
            tipo: "ataque",
            accionPreviaDirecta: {
              ...FILTRO_ACCION_HISTORICA_VACIO,
              tipos: ["ataque"],
              resultados: ["error"],
              relacionJugador: "mismo",
            },
          },
        },
      ],
      tipoObservado: "ataque",
      jugadorObservadoFiltro: "mismo",
      alcance: "partido",
      coincidencias: { ...COINCIDENCIA_VACIA },
    },
  },
  {
    id: "bloqueo-tras-recep-negativa",
    nombre: "Bloqueo tras recepción negativa rival",
    descripcion:
      "Bloqueos propios cuando el rival recibió negativa o doble negativa.",
    icono: "🛡️",
    config: {
      bloques: [
        {
          id: "auto-1",
          operador: "AND",
          filtro: {
            ...BLOQUE_TRIGGER_VACIO,
            tipo: "bloqueo",
            accionPreviaDirecta: {
              ...FILTRO_ACCION_HISTORICA_VACIO,
              tipos: ["recepcion"],
              resultados: ["negativa", "doble_negativa"],
              relacionJugador: "rival",
            },
          },
        },
      ],
      tipoObservado: "defensa",
      jugadorObservadoFiltro: "companero",
      alcance: "partido",
      coincidencias: { ...COINCIDENCIA_VACIA },
    },
  },
  {
    id: "saque-racha-negativa",
    nombre: "Saque en racha negativa",
    descripcion:
      "Cómo saca el equipo cuando viene de perder 2+ puntos seguidos.",
    icono: "📉",
    config: {
      bloques: [
        {
          id: "auto-1",
          operador: "AND",
          filtro: {
            ...BLOQUE_TRIGGER_VACIO,
            tipo: "saque",
            rachaJugador: {
              jugadorId: null,
              tipo: "puntos_perdidos",
              minimo: 2,
              ambito: "puntos_del_set",
            },
          },
        },
      ],
      tipoObservado: "recepcion",
      jugadorObservadoFiltro: "cualquiera",
      alcance: "partido",
      coincidencias: { ...COINCIDENCIA_VACIA },
    },
  },
  {
    id: "recepcion-tras-ace-rival",
    nombre: "Recepción tras ace rival",
    descripcion:
      "Cómo recibe el equipo después de comerse un ace del rival.",
    icono: "🎯",
    config: {
      bloques: [
        {
          id: "auto-1",
          operador: "AND",
          filtro: {
            ...BLOQUE_TRIGGER_VACIO,
            tipo: "recepcion",
            contextoPartido: {
              ...CONTEXTO_PARTIDO_VACIO,
              inicioPunto: "ace_rival",
            },
          },
        },
      ],
      tipoObservado: "armado",
      jugadorObservadoFiltro: "companero",
      alcance: "partido",
      coincidencias: { ...COINCIDENCIA_VACIA },
    },
  },
  {
    id: "armador-empatado",
    nombre: "Armador con marcador empatado",
    descripcion:
      "Cómo distribuye el armador cuando el set está empatado.",
    icono: "🟰",
    config: {
      bloques: [
        {
          id: "auto-1",
          operador: "AND",
          filtro: {
            ...BLOQUE_TRIGGER_VACIO,
            tipo: "armado",
            contextoPartido: {
              ...CONTEXTO_PARTIDO_VACIO,
              marcador: {
                ...CONTEXTO_PARTIDO_VACIO.marcador,
                diferenciaExacta: 0,
              },
            },
          },
        },
      ],
      tipoObservado: "ataque",
      jugadorObservadoFiltro: "companero",
      alcance: "partido",
      coincidencias: { ...COINCIDENCIA_VACIA },
    },
  },
  {
    id: "ataque-tras-2-errores",
    nombre: "Ataque tras 2 errores seguidos",
    descripcion:
      "Cómo ataca un jugador cuando viene de errar 2 veces seguidas.",
    icono: "🚨",
    config: {
      bloques: [
        {
          id: "auto-1",
          operador: "AND",
          filtro: {
            ...BLOQUE_TRIGGER_VACIO,
            tipo: "ataque",
            rachaJugador: {
              jugadorId: null,
              tipo: "errores_seguidos",
              minimo: 2,
              ambito: "puntos_del_set",
            },
          },
        },
      ],
      tipoObservado: "ataque",
      jugadorObservadoFiltro: "mismo",
      alcance: "partido",
      coincidencias: { ...COINCIDENCIA_VACIA },
    },
  },
  {
    id: "top-20-ataques",
    nombre: "Mejores ataques (top 20%)",
    descripcion:
      "Los ataques con mayor puntaje del equipo (top 20%) y qué pasa después.",
    icono: "⭐",
    config: {
      bloques: [
        {
          id: "auto-1",
          operador: "AND",
          filtro: {
            ...BLOQUE_TRIGGER_VACIO,
            tipo: "ataque",
            topPorcentaje: 20,
          },
        },
      ],
      tipoObservado: "ataque",
      jugadorObservadoFiltro: "cualquiera",
      alcance: "partido",
      coincidencias: { ...COINCIDENCIA_VACIA },
    },
  },
  {
    id: "ataque-primer-punto",
    nombre: "Ataque en primer punto del set",
    descripcion:
      "Cómo arranca el equipo en el primer rally de cada set.",
    icono: "🚦",
    config: {
      bloques: [
        {
          id: "auto-1",
          operador: "AND",
          filtro: {
            ...BLOQUE_TRIGGER_VACIO,
            tipo: "ataque",
            contextoPartido: {
              ...CONTEXTO_PARTIDO_VACIO,
              posicionEnSet: "primero",
            },
          },
        },
      ],
      tipoObservado: "ataque",
      jugadorObservadoFiltro: "mismo",
      alcance: "partido",
      coincidencias: { ...COINCIDENCIA_VACIA },
    },
  },
  {
    id: "ataque-o-bloqueo-punto",
    nombre: "Puntos por ataque O bloqueo",
    descripcion:
      "Cómo termina el siguiente ataque cuando el equipo metió punto por ataque o bloqueo (ejemplo de OR).",
    icono: "⚔️",
    config: {
      bloques: [
        {
          id: "auto-1",
          operador: "AND",
          filtro: {
            ...BLOQUE_TRIGGER_VACIO,
            tipo: "ataque",
            resultado: "punto",
          },
        },
        {
          id: "auto-2",
          operador: "OR",
          filtro: {
            ...BLOQUE_TRIGGER_VACIO,
            tipo: "bloqueo",
            resultado: "punto",
          },
        },
      ],
      tipoObservado: "ataque",
      jugadorObservadoFiltro: "cualquiera",
      alcance: "partido",
      coincidencias: { ...COINCIDENCIA_VACIA },
    },
  },
];

// ------------------------------------------------------------
// CREAR PRESET DESDE UNA CONFIG ACTUAL
// ------------------------------------------------------------

export function crearPresetDesdeConfig(
  nombre: string,
  config: PresetTargetConfig,
  descripcion: string = "Preset guardado por el usuario",
  icono: string = "💾"
): PresetAnalisis {
  return {
    id: generarIdPreset(nombre),
    nombre: nombre.trim(),
    descripcion,
    icono,
    config: deepClone(config),
  };
}

// ------------------------------------------------------------
// APLICAR UN PRESET
// ------------------------------------------------------------

export function aplicarPresetAnalisis<T extends PresetTargetConfig>(
  base: T,
  preset: PresetAnalisis
): T {
  const clonado = deepClone(preset.config);
  const conIdsNuevos = regenerarIds(clonado);

  return {
    ...base,
    bloques: conIdsNuevos.bloques,
    tipoObservado: conIdsNuevos.tipoObservado,
    jugadorObservadoFiltro: conIdsNuevos.jugadorObservadoFiltro,
    alcance: conIdsNuevos.alcance,
    coincidencias: conIdsNuevos.coincidencias,
  } as T;
}

// ------------------------------------------------------------
// GENERACIÓN DE ID
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
// PERSISTENCIA
// ------------------------------------------------------------

const STORAGE_KEY = "voleystats_presets_analisis_v1";
const VERSION_KEY = "voleystats_presets_analisis_version";
const PRESET_VERSION = 1;

function esPresetValido(p: unknown): p is PresetAnalisis {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  if (typeof o.id !== "string") return false;
  if (typeof o.nombre !== "string") return false;
  if (typeof o.icono !== "string") return false;
  if (!o.config || typeof o.config !== "object") return false;
  const c = o.config as Record<string, unknown>;
  if (!Array.isArray(c.bloques)) return false;
  return true;
}

export function cargarPresetsUsuario(): PresetAnalisis[] {
  if (typeof window === "undefined") return [];
  try {
    const version = window.localStorage.getItem(VERSION_KEY);
    if (version !== String(PRESET_VERSION)) {
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

export function guardarPreset(preset: PresetAnalisis): boolean {
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

export function todosLosPresets(): PresetAnalisis[] {
  const usuario = cargarPresetsUsuario();
  const idsUsuario = new Set(usuario.map((p) => p.id));
  const predefinidosFiltrados = PRESETS_PREDEFINIDOS.filter(
    (p) => !idsUsuario.has(p.id)
  );
  return [...predefinidosFiltrados, ...usuario];
}

export function esPredefinido(preset: PresetAnalisis): boolean {
  return PRESETS_PREDEFINIDOS.some((p) => p.id === preset.id);
}

// ------------------------------------------------------------
// UTILIDADES ADICIONALES
// ------------------------------------------------------------

export function contarBloques(preset: PresetAnalisis): number {
  return preset.config.bloques.length;
}

export function resumenPreset(preset: PresetAnalisis): string {
  const partes: string[] = [];
  for (let i = 0; i < preset.config.bloques.length; i++) {
    const b = preset.config.bloques[i];
    if (i > 0) {
      partes.push(
        b.operador === "AND" ? "Y" : b.operador === "OR" ? "O" : "Y NO"
      );
    }
    partes.push(b.filtro.tipo);
  }
  partes.push("→");
  partes.push(
    preset.config.tipoObservado === "cualquiera"
      ? "sig. acción"
      : `sig. ${preset.config.tipoObservado}`
  );
  return partes.join(" ");
}