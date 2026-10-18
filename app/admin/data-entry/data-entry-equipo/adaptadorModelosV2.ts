// ============================================================
// ADAPTADOR MODELOS: acciones_v2 → filas V1 (para las visualizaciones)
// Solo LECTURA. La consola V2 sigue guardando en las tablas V2.
// La consola V1 sigue guardando en las tablas V1.
// ============================================================

import { supabase } from "@/lib/supabase";
import type { AccionV2Row } from "@/lib/dbV2";
import type { AtaqueRow, RecepcionRow, SaqueRow } from "@/lib/db";
import type { ArmadoDetalle } from "./CanchaArmador3D";

// ------------------------------------------------------------
// Helper interno: carga todas las acciones V2 del partido,
// filtrando por equipo si se pasa equipoId.
// ------------------------------------------------------------
async function cargarAccionesV2(
  partidoId: string,
  equipoId?: string
): Promise<AccionV2Row[]> {
  let q = supabase
    .from("acciones_v2")
    .select("*")
    .eq("partido_id", partidoId)
    .order("orden", { ascending: true });

  if (equipoId) q = q.eq("equipo_id", equipoId);

  const { data, error } = await q;
  if (error || !data) return [];
  return data as AccionV2Row[];
}

// ------------------------------------------------------------
// Zona de tendencia a partir del destino del armado
// (misma lógica que TableroArmadorPunto)
// ------------------------------------------------------------
function calcularZonaTendencia(celda: string | null): number | null {
  if (!celda) return null;
  switch (celda) {
    case "F1-C1":
    case "F1-C2":
      return 4;
    case "F1-C3":
      return 3;
    case "F1-C4":
    case "F1-C5":
      return 2;
    case "F2-C3":
    case "F3-C3":
      return 6;
    case "F2-C4":
    case "F2-C5":
    case "F3-C4":
    case "F3-C5":
      return 2;
    default:
      return null;
  }
}

// ------------------------------------------------------------
// ARMADOS
// ------------------------------------------------------------
export async function cargarArmadosV2(
  partidoId: string,
  equipoId?: string
): Promise<ArmadoDetalle[]> {
  const acciones = await cargarAccionesV2(partidoId, equipoId);
  const out: ArmadoDetalle[] = [];

  for (const a of acciones) {
    if (a.tipo !== "armado") continue;
    if (a.subtipo === null || a.subtipo === undefined) continue;
    if (a.subtipo === "R") continue; // recepción de segunda, no es armado
    if (!a.jugador_id) continue;

    const calidad =
      typeof a.subtipo === "number"
        ? a.subtipo
        : parseInt(String(a.subtipo), 10);
    if (isNaN(calidad) || calidad < 1 || calidad > 6) continue;

    out.push({
      id: a.id,
      jugador_id: a.jugador_id,
      set_numero: a.set_numero,
      punto_numero: a.punto_numero,
      origen_celda: a.origen_celda ?? "",
      origen_mini: a.origen_mini,
      destino_celda: a.destino_celda ?? "",
      destino_mini: a.destino_mini,
      zona_tendencia: calcularZonaTendencia(a.destino_celda),
      calidad,
      atacante_derecho: "arriba",
      armador_numero: 1,
    });
  }

  return out;
}

// ------------------------------------------------------------
// SAQUES
// ------------------------------------------------------------
export async function cargarSaquesV2(
  partidoId: string,
  equipoId?: string
): Promise<SaqueRow[]> {
  const acciones = await cargarAccionesV2(partidoId, equipoId);
  const out: SaqueRow[] = [];

  const valoracionesValidas = [
    "ace",
    "positivo_mas",
    "positivo",
    "neutro",
    "negativo",
  ];

  for (const a of acciones) {
    if (a.tipo !== "saque") continue;
    if (typeof a.subtipo !== "string") continue;
    if (!a.jugador_id) continue;
    if (!valoracionesValidas.includes(a.subtipo)) continue;

    out.push({
      id: a.id,
      partido_id: a.partido_id,
      jugador_id: a.jugador_id,
      set_numero: a.set_numero,
      punto_numero: a.punto_numero,
      origen_celda: a.origen_celda ?? "",
      destino_celda: a.destino_celda ?? "",
      destino_mini: a.destino_mini,
      tipo:
        (a.tipo_saque as "flotado" | "potencia" | null | undefined) ?? null,
      valoracion: a.subtipo as SaqueRow["valoracion"],
    });
  }

  return out;
}

// ------------------------------------------------------------
// RECEPCIONES
// ------------------------------------------------------------
export async function cargarRecepcionesV2(
  partidoId: string,
  equipoId?: string
): Promise<RecepcionRow[]> {
  const acciones = await cargarAccionesV2(partidoId, equipoId);
  const out: RecepcionRow[] = [];

  for (const a of acciones) {
    if (a.tipo !== "recepcion") continue;
    if (a.subtipo === null || a.subtipo === undefined) continue;
    if (!a.jugador_id) continue;

    const valoracion =
      typeof a.subtipo === "number"
        ? a.subtipo
        : parseInt(String(a.subtipo), 10);
    if (isNaN(valoracion) || valoracion < 1 || valoracion > 6) continue;

    out.push({
      id: a.id,
      partido_id: a.partido_id,
      jugador_id: a.jugador_id,
      set_numero: a.set_numero,
      punto_numero: a.punto_numero,
      origen_celda: a.origen_celda ?? "",
      origen_mini: a.origen_mini,
      destino_celda: a.destino_celda ?? "",
      destino_mini: a.destino_mini,
      valoracion,
    });
  }

  return out;
}

// ------------------------------------------------------------
// ATAQUES
// ------------------------------------------------------------
export async function cargarAtaquesV2(
  partidoId: string,
  equipoId?: string
): Promise<AtaqueRow[]> {
  const acciones = await cargarAccionesV2(partidoId, equipoId);
  const out: AtaqueRow[] = [];

  for (const a of acciones) {
    if (a.tipo !== "ataque") continue;
    if (a.subtipo === null || a.subtipo === undefined) continue;
    if (!a.jugador_id) continue;

    let subtipo = String(a.subtipo);
    // Ataque con toque: "toque:punto", "toque:error", "toque:neutro"
    if (subtipo.startsWith("toque:")) subtipo = subtipo.slice(6);

    // El visualizador entiende solo estos 3 valores para ataque propio
    if (!["punto", "neutro", "error"].includes(subtipo)) continue;

    out.push({
      id: a.id,
      partido_id: a.partido_id,
      jugador_id: a.jugador_id,
      set_numero: a.set_numero,
      punto_numero: a.punto_numero,
      origen_celda: a.origen_celda ?? "",
      origen_mini: a.origen_mini,
      destino_celda: a.destino_celda ?? "",
      destino_mini: a.destino_mini,
      desvios: a.desvios ?? [],
      zona: a.zona ?? null,
      valoracion: subtipo as "punto" | "error" | "neutro",
    });
  }

  return out;
}