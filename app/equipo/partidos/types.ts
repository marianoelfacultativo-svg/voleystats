// ============================================================
// TIPOS Y CONSTANTES COMPARTIDAS — Partidos
// ============================================================
// Todo lo que es solo tipos, interfaces y constantes puras.
// ============================================================

import type { CSSProperties } from "react";

// ------------------------------------------------------------
// INTERFACES DE DATOS
// ------------------------------------------------------------

export interface Partido {
  id: string;
  rival: string;
  fecha: string;
  set1: string | null;
  set2: string | null;
  set3: string | null;
  set4: string | null;
  set5: string | null;
  errores_rivales: number | null;
  buenas_rivales: number | null;
  notas: string | null;
  equipo_id: string;
  equipo_rival_id: string | null;
}

export interface Jugador {
  id: string;
  nombre: string;
  numero: number | null;
  rol: string;
}

export interface Equipo {
  id: string;
  nombre: string;
}

export interface DatosRival {
  buenas: number;
  errores: number;
}

// ------------------------------------------------------------
// TIPOS DE MODO / VISTA
// ------------------------------------------------------------

export type ModoPrincipal =
  | "partido"
  | "comparar-partidos"
  | "jugador-por-partidos";

export type ModoDetalle =
  | "analisis"
  | "comparar-jugadores"
  | "crudas"
  | "consecuencias";

// ------------------------------------------------------------
// CONSTANTES DE FUNDAMENTOS
// ------------------------------------------------------------

export const FUNDAMENTOS = [
  "saque",
  "recepcion",
  "ataque",
  "bloqueo",
  "defensa",
];

export const FUNDAMENTOS_BARRAS = [
  "saque",
  "recepcion",
  "ataque",
  "bloqueo",
  "defensa",
] as const;

export const NOMBRES: Record<string, string> = {
  saque: "Saque",
  recepcion: "Recepción",
  ataque: "Ataque",
  bloqueo: "Bloqueo",
  defensa: "Defensa",
};

// ------------------------------------------------------------
// COLORES DE COMPARACIÓN (2-3 series en gráficos)
// ------------------------------------------------------------

export const COLORES_COMPARACION = ["#EF4444", "#8B5CF6", "#3B82F6"];

// ------------------------------------------------------------
// ESTILOS BASE COMPARTIDOS
// ------------------------------------------------------------

export const cardBase: CSSProperties = {
  background: "var(--sx-surface-1)",
  border: "1px solid var(--sx-border)",
  boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
};

export const cardTerracota: CSSProperties = {
  background:
    "linear-gradient(135deg, rgba(22,14,24,0.95) 0%, rgba(15,29,53,0.92) 100%)",
  border: "1px solid rgba(229,62,77,0.3)",
  boxShadow:
    "0 8px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(229,62,77,0.15)",
};

export const labelStyle: CSSProperties = {
  color: "var(--sx-text-secondary)",
};
