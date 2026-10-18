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
// HELPERS DE CONVERSIÓN V2 → V1
// ------------------------------------------------------------

/**
 * Convierte celdas V2 (FUERA-ARR-*, FUERA-ABA-*, BLOQ-*, RED-*)
 * a celdas V1 aproximadas (F1..F6) para que los visualizadores
 * puedan dibujarlas.
 */
function normalizarCelda(celda: string | null): string {
  if (!celda) return "";
  if (celda.startsWith("FUERA-ARR-")) return "F6-" + celda.slice(10);
  if (celda.startsWith("FUERA-ABA-")) return "F3-" + celda.slice(10);
  if (celda.startsWith("BLOQ-P-")) return "F1-" + celda.slice(7);
  if (celda.startsWith("BLOQ-R-")) return "F4-" + celda.slice(7);
  if (celda.startsWith("RED-")) return "F4-" + celda.slice(4);
  return celda;
}

/**
 * Convierte minis V2 (m1-5, grid 9×9) a minis V1 (fXcY, grid 3×3
 * o 3×2) aproximando el cuadrante. Si ya es f-format, lo deja igual.
 */
function convertirMiniV1(
  mini: string | null,
  celda: string
): string | null {
  if (!mini) return null;
  const match = mini.match(/^m(\d+)-(\d+)$/);
  if (!match) return mini;
  const fil = parseInt(match[1]);
  const col = parseInt(match[2]);
  const celdaCol = celda.split("-").slice(-1)[0] ?? "C3";
  const numCols = celdaCol === "C1" || celdaCol === "C5" ? 2 : 3;
  const numFils = 3;
  const f = Math.min(
    numFils,
    Math.max(1, Math.ceil((fil / 9) * numFils))
  );
  const c = Math.min(
    numCols,
    Math.max(1, Math.ceil((col / 9) * numCols))
  );
  return `f${f}c${c}`;
}

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
    if (a.subtipo === "R") continue;
    if (!a.jugador_id) continue;

    const calidad =
      typeof a.subtipo === "number"
        ? a.subtipo
        : parseInt(String(a.subtipo), 10);
    if (isNaN(calidad) || calidad < 1 || calidad > 6) continue;

    const origenCelda = normalizarCelda(a.origen_celda);
    const destinoCelda = normalizarCelda(a.destino_celda);

    out.push({
      id: a.id,
      jugador_id: a.jugador_id,
      set_numero: a.set_numero,
      punto_numero: a.punto_numero,
      origen_celda: origenCelda,
      origen_mini: convertirMiniV1(a.origen_mini, origenCelda),
      destino_celda: destinoCelda,
      destino_mini: convertirMiniV1(a.destino_mini, destinoCelda),
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

    const origenCelda = normalizarCelda(a.origen_celda);
    const destinoCelda = normalizarCelda(a.destino_celda);

    out.push({
      id: a.id,
      partido_id: a.partido_id,
      jugador_id: a.jugador_id,
      set_numero: a.set_numero,
      punto_numero: a.punto_numero,
      origen_celda: origenCelda,
      destino_celda: destinoCelda,
      destino_mini: convertirMiniV1(a.destino_mini, destinoCelda),
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

    const origenCelda = normalizarCelda(a.origen_celda);
    const destinoCelda = normalizarCelda(a.destino_celda);

    out.push({
      id: a.id,
      partido_id: a.partido_id,
      jugador_id: a.jugador_id,
      set_numero: a.set_numero,
      punto_numero: a.punto_numero,
      origen_celda: origenCelda,
      origen_mini: convertirMiniV1(a.origen_mini, origenCelda),
      destino_celda: destinoCelda,
      destino_mini: convertirMiniV1(a.destino_mini, destinoCelda),
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
    if (subtipo.startsWith("toque:")) subtipo = subtipo.slice(6);
    if (!["punto", "neutro", "error"].includes(subtipo)) continue;

    const origenCelda = normalizarCelda(a.origen_celda);
    const destinoCelda = normalizarCelda(a.destino_celda);

    out.push({
      id: a.id,
      partido_id: a.partido_id,
      jugador_id: a.jugador_id,
      set_numero: a.set_numero,
      punto_numero: a.punto_numero,
      origen_celda: origenCelda,
      origen_mini: convertirMiniV1(a.origen_mini, origenCelda),
      destino_celda: destinoCelda,
      destino_mini: convertirMiniV1(a.destino_mini, destinoCelda),
      desvios: (a.desvios ?? []).map((d) => {
        const dc = normalizarCelda(d.celda);
        return {
          celda: dc,
          mini: convertirMiniV1(d.mini, dc),
        };
      }),
      zona: a.zona ?? null,
      valoracion: subtipo as "punto" | "error" | "neutro",
    });
  }

  return out;
}