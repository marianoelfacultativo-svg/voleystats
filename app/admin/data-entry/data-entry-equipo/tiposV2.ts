// ============================================================
// TIPOS LOCALES V2 — DataEntryV2
// Solo tipos, cero lógica.
// ============================================================

import type { Libero, RotacionPunto, Zona } from "@/lib/rotaciones";
import type { Situacion, PopupRequerido } from "@/lib/clasificacionV2";
import type { CambioPendiente } from "./PanelRotacionV2";
import type { PopupPos } from "./PopupValoracion";

export type Lado = "propio" | "rival";

export interface Jugador {
  id: string;
  nombre: string;
  numero: number | null;
}

export interface PopupEnCola {
  tipo: Exclude<PopupRequerido, null> | "velocidad";
  pos: PopupPos;
  lineaId: string;
  indiceDesvio?: number;
}

export interface PuntoCerrado {
  numero: number;
  lineas: import("@/lib/clasificacionV2").LineaClasificada[];
  saqueInicial: Lado;
  situacion: Situacion;
  ganador: Lado;
  rotacion: RotacionPunto;
  liberos: Libero[];
  posicionesPunto: Record<Zona, string>;
  cambios: CambioPendiente[];
}

export interface Props {
  partidoId: string;
  equipoId: string;
  nombreMiEquipo: string;
  nombreRival: string;
  jugadores: Jugador[];
  rotacionInicial?: RotacionPunto;
}

export const CLAVE_V2 = "voleystats_dataentry_v2_";
export const CLAVE_POSICIONES_FIJAS = "voleystats_posiciones_fijas_";

export const POSICIONES_VACIAS: Record<Zona, string> = {
  1: "",
  2: "",
  3: "",
  4: "",
  5: "",
  6: "",
};

export type PosicionesFijasMap = Record<string, Record<Zona, string>>;