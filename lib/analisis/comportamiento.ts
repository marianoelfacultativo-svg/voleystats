// ============================================================
// COMPORTAMIENTO DEL TRIGGER — distribuciones
// ============================================================
// Extraído de lib/analisisConsecuencias.ts (v9).
//
// Calcula las distribuciones del conjunto de acciones trigger:
//   - porSubtipo
//   - porZonaDestino
//   - porVelocidad
//   - porJugador
//   - porSet
//   - porBloque (cumplimiento por cada bloque del trigger)
//   - porLlamada (inferida del armado)
//   - porDireccionAtaque (legacy)
//   - porSectorAtaque (los 10 sectores del nuevo sistema)
// ============================================================

import type { AccionVisual } from "../../app/equipo/adaptadorUnificadoV2";
import { baseSubtipo } from "./clasificacion";
import {
  inferirDireccionAtaque,
  inferirLlamadaArmado,
} from "./inferencias";
import { calificarSectorAtaque } from "./sectores";
import type { BloqueTrigger, ComportamientoTrigger } from "./tipos";

export function calcularComportamientoTrigger(
  triggers: AccionVisual[],
  bloques: BloqueTrigger[],
  cumplePorBloque: Map<string, Set<string>>
): ComportamientoTrigger {
  const total = triggers.length;
  const subtiposCount: Record<string, number> = {};
  const zonasCount: Record<string, number> = {};
  const velocidadesCount: Record<string, number> = {};
  const jugadoresCount: Record<string, number> = {};
  const setsCount: Record<string, number> = {};
  const llamadasCount: Record<string, number> = {};
  const direccionesCount: Record<string, number> = {};
  const sectoresCount: Record<string, number> = {};

  for (const a of triggers) {
    const sub = baseSubtipo(a) || "—";
    subtiposCount[sub] = (subtiposCount[sub] ?? 0) + 1;
    const zk =
      a.zona_destino !== null && a.zona_destino !== undefined
        ? String(a.zona_destino)
        : "null";
    zonasCount[zk] = (zonasCount[zk] ?? 0) + 1;
    const vk =
      a.velocidad !== null && a.velocidad !== undefined
        ? String(a.velocidad)
        : "null";
    velocidadesCount[vk] = (velocidadesCount[vk] ?? 0) + 1;
    if (a.jugador_id) {
      jugadoresCount[a.jugador_id] =
        (jugadoresCount[a.jugador_id] ?? 0) + 1;
    }
    setsCount[String(a.set_numero)] =
      (setsCount[String(a.set_numero)] ?? 0) + 1;

    const llamada = inferirLlamadaArmado(a);
    if (llamada) {
      llamadasCount[llamada] = (llamadasCount[llamada] ?? 0) + 1;
    }
    const direccion = inferirDireccionAtaque(a);
    if (direccion) {
      direccionesCount[direccion] = (direccionesCount[direccion] ?? 0) + 1;
    }
    const sector = calificarSectorAtaque(a);
    if (sector) {
      sectoresCount[sector] = (sectoresCount[sector] ?? 0) + 1;
    }
  }

  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const porBloque: {
    bloqueId: string;
    tipo: string;
    count: number;
    pct: number;
  }[] = bloques.map((b) => {
    const set = cumplePorBloque.get(b.id) ?? new Set();
    return {
      bloqueId: b.id,
      tipo: b.filtro.tipo,
      count: set.size,
      pct: pct(set.size),
    };
  });

  return {
    totalTriggers: total,
    porSubtipo: Object.entries(subtiposCount)
      .map(([subtipo, count]) => ({ subtipo, count, pct: pct(count) }))
      .sort((a, b) => b.count - a.count),
    porZonaDestino: Object.entries(zonasCount)
      .map(([k, count]) => ({
        zona: k === "null" ? null : Number(k),
        count,
        pct: pct(count),
      }))
      .sort((a, b) => b.count - a.count),
    porVelocidad: Object.entries(velocidadesCount)
      .map(([k, count]) => ({
        velocidad: k === "null" ? null : Number(k),
        count,
        pct: pct(count),
      }))
      .sort((a, b) => b.count - a.count),
    porJugador: Object.entries(jugadoresCount)
      .map(([jugadorId, count]) => ({ jugadorId, count, pct: pct(count) }))
      .sort((a, b) => b.count - a.count),
    porSet: Object.entries(setsCount)
      .map(([k, count]) => ({ set: Number(k), count, pct: pct(count) }))
      .sort((a, b) => a.set - b.set),
    porBloque,
    porLlamada: Object.entries(llamadasCount)
      .map(([llamada, count]) => ({ llamada, count, pct: pct(count) }))
      .sort((a, b) => b.count - a.count),
    porDireccionAtaque: Object.entries(direccionesCount)
      .map(([direccion, count]) => ({ direccion, count, pct: pct(count) }))
      .sort((a, b) => b.count - a.count),
    porSectorAtaque: Object.entries(sectoresCount)
      .map(([sector, count]) => ({ sector, count, pct: pct(count) }))
      .sort((a, b) => b.count - a.count),
  };
}