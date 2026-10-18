// ============================================================
// HELPERS PUROS V2 — DataEntryV2
// Funciones sin estado, sin React. Solo transformación de datos.
// ============================================================

import { getRectMiniLayout } from "./CanchaV2";
import type { PuntoV2, LineaV2 } from "./LineasV2";
import type {
  LineaClasificada,
} from "@/lib/clasificacionV2";
import type { AccionV2Data } from "@/lib/dbV2";
import type { Zona } from "@/lib/rotaciones";

// ------------------------------------------------------------
// Coordenadas / popups
// ------------------------------------------------------------

export function centroDePunto(p: PuntoV2): { x: number; y: number } {
  const r = getRectMiniLayout(p.celda, p.mini);
  if (!r) return { x: 0, y: 0 };
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

export function posicionPopup(p: PuntoV2): { x: number; y: number } {
  const c = centroDePunto(p);
  return { x: c.x, y: c.y - 4 };
}

// ------------------------------------------------------------
// Conversiones de línea
// ------------------------------------------------------------

export function aLineaV2(l: LineaClasificada): LineaV2 {
  return {
    id: l.id,
    origen: l.origen,
    destino: l.destino,
    desvios: l.desvios,
    tipo: l.tipo,
    esRival: l.esRival,
    oculta: l.oculta,
  };
}

export function aAccionV2(
  l: LineaClasificada,
  orden: number,
  override?: { jugadorId?: string | null; subtipo?: string | null }
): AccionV2Data {
  let subtipoFinal =
    override?.subtipo !== undefined ? override.subtipo : l.subtipo ?? null;

  if (
    override?.subtipo === undefined &&
    l.tipo === "ataque" &&
    l.variante === "toque" &&
    subtipoFinal !== null
  ) {
    subtipoFinal = `toque:${subtipoFinal}`;
  }

  const jugadorFinal =
    override?.jugadorId !== undefined ? override.jugadorId : l.jugadorId;
  return {
    orden,
    tipo: l.tipo,
    subtipo: subtipoFinal,
    es_rival: l.esRival,
    jugador_id: jugadorFinal,
    lado: l.esRival ? "rival" : "propio",
    origen_celda: l.origen.celda,
    origen_mini: l.origen.mini,
    destino_celda: l.destino.celda,
    destino_mini: l.destino.mini,
    desvios: (l.desvios ?? []).map((d) => ({
      celda: d.celda,
      mini: d.mini,
      jugador_id: d.jugadorId ?? null,
    })),
    zona: null,
    posicion_inicial_celda: l.posicionInicial?.celda ?? null,
    posicion_inicial_mini: l.posicionInicial?.mini ?? null,
    velocidad: l.velocidad ?? null,
    tipo_saque: l.tipoSaque ?? null,
    variante: l.variante ?? null,
    x2: l.x2 ?? false,
    oculta: l.oculta ?? false,
    equipo_id: l.equipoId ?? null,
  };
}

export function lineasAAcciones(lineas: LineaClasificada[]): AccionV2Data[] {
  const acciones: AccionV2Data[] = [];
  let orden = 1;
  for (const l of lineas) {
    if (l.tipo === "bloqueo" && !l.esRival) {
      const desviosBLOQP = (l.desvios ?? []).filter((d) =>
        d.celda.startsWith("BLOQ-P-")
      );
      if (desviosBLOQP.length > 1) {
        const base = (l.subtipo ?? "positivo") as string;
        const esPositiva =
          base === "punto" || base === "positivo_mas" || base === "positivo";
        const sub = esPositiva ? "positivo" : "neutro";
        for (const d of desviosBLOQP) {
          acciones.push(
            aAccionV2(l, orden++, {
              jugadorId: d.jugadorId ?? null,
              subtipo: sub,
            })
          );
        }
        continue;
      }
    }
    acciones.push(aAccionV2(l, orden++));
  }
  return acciones;
}

// ------------------------------------------------------------
// Checks rápidos
// ------------------------------------------------------------

export function esCeldaBloqueo(celda: string): boolean {
  return celda.startsWith("BLOQ-P-") || celda.startsWith("BLOQ-R-");
}

export function mismaMini(a: PuntoV2, b: PuntoV2): boolean {
  return a.celda === b.celda && a.mini === b.mini;
}

// ------------------------------------------------------------
// Contadores / mapa de overrides
// ------------------------------------------------------------

export function maxIdLineas(lineas: LineaClasificada[]): number {
  let max = 0;
  for (const l of lineas) {
    const m = l.id.match(/^l-(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1]));
  }
  return max;
}

export function calcularRecepcionOverrides(
  posicionesFijas: Record<Zona, string>,
  posicionesPunto: Record<Zona, string>
): Partial<Record<Zona, string | null>> {
  const out: Partial<Record<Zona, string | null>> = {};
  for (const z of [5, 6, 1] as Zona[]) {
    const fijo = posicionesFijas[z];
    if (fijo) out[z] = fijo;
  }
  for (const z of [5, 6, 1] as Zona[]) {
    const pto = posicionesPunto[z];
    if (pto) out[z] = pto;
  }
  return out;
}

// ------------------------------------------------------------
// UI
// ------------------------------------------------------------

export function rolCortoParaUI(rol: string): string {
  if (rol === "C1" || rol === "C2") return "C";
  if (rol === "P1" || rol === "P2") return "P";
  return rol;
}