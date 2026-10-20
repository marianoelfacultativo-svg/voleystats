// ============================================================
// CARGA DB V2 — DataEntryV2
// Funciones para reconstruir el estado de la consola a partir
// de los datos guardados en Supabase (puntos_v2 + acciones_v2).
//
// NOTA: los 12 campos analíticos (es_error, zona_origen,
// zona_destino, rotacion_numero, rol_jugador, zona_jugador,
// origen_x/y, destino_x/y, posicion_inicial_x/y) se calculan
// al GUARDAR (en guardarSupabaseV2.ts) y NO se necesitan
// reconstruir acá para la edición. Siguen persistidos en DB y
// disponibles para consultas SQL / panel de filtros.
// ============================================================

import { cargarPuntosV2 } from "@/lib/dbV2";
import type { LineaClasificada } from "@/lib/clasificacionV2";
import type { PuntoCerrado } from "./tiposV2";

/** Qué subtipos se conservan al recargar. */
export function subtipoPreservado(tipo: string, subtipo: any): any {
  if (tipo === "recepcion") return subtipo;
  if (tipo === "armado") return subtipo;
  if (tipo === "roce-red") return subtipo;
  if (tipo === "defensa") {
    // Preserva tanto los "raw" (elegidos por el usuario en el popup) como
    // los "finales" (ya calculados por la pipeline). El recálculo de
    // calcularSubtiposDefensa en guardarSupabaseV2 es idempotente para los
    // valores finales, así que es seguro.
    const validos = new Set<string>([
      // raw
      "toque",
      "gran-defensa",
      "libre",
      "cobertura",
      // finales
      "toque_positiva",
      "toque_negativa",
      "gran_def",
      "error_def",
      "mala_libre",
      "buena_rival",
      "neutro",
      "cobertura_positiva",
      "cobertura_negativa",
      "errores_graves",
    ]);
    return typeof subtipo === "string" && validos.has(subtipo)
      ? subtipo
      : null;
  }
  return null;
}

/** Reconstruye los PuntoCerrado a partir de puntos_v2 + acciones_v2. */
export async function cargarPuntosCerradosDesdeDB(
  partidoId: string,
  setActivo: number
): Promise<Record<number, PuntoCerrado>> {
  const res = await cargarPuntosV2(partidoId);
  if (!res.ok || !res.puntos) return {};

  const cerrados: Record<number, PuntoCerrado> = {};

  for (const p of res.puntos) {
    if (p.set_numero !== setActivo) continue;
    if (p.ganador !== "propio" && p.ganador !== "rival") continue;

    const acciones = [...p.acciones].sort((a, b) => a.orden - b.orden);

    const lineas: LineaClasificada[] = acciones.map((a) => {
      let variante: any = a.variante ?? null;
      let subtipoRaw: any = a.subtipo;
      if (typeof subtipoRaw === "string" && subtipoRaw.startsWith("toque:")) {
        variante = variante ?? "toque";
        subtipoRaw = subtipoRaw.slice(6);
      }

      return {
        id: `db-${a.id}`,
        tipo: a.tipo as any,
        esRival: a.es_rival,
        jugadorId: a.jugador_id ?? null,
        origen: {
          celda: a.origen_celda ?? "",
          mini: a.origen_mini ?? "",
        },
        destino: {
          celda: a.destino_celda ?? "",
          mini: a.destino_mini ?? "",
        },
        desvios: (a.desvios ?? []).map((d: any) => ({
          celda: d.celda,
          mini: d.mini,
          jugadorId: d.jugador_id ?? null,
        })),
        subtipo: subtipoPreservado(a.tipo, subtipoRaw),
        variante,
        velocidad: a.velocidad ?? null,
        tipoSaque: (a.tipo_saque as any) ?? null,
        x2: a.x2 ?? undefined,
        oculta: a.oculta ?? undefined,
        posicionInicial: a.posicion_inicial_celda
          ? {
              celda: a.posicion_inicial_celda,
              mini: a.posicion_inicial_mini ?? "",
            }
          : null,
        equipoId: a.equipo_id ?? null,
      };
    });

    cerrados[p.punto_numero] = {
      numero: p.punto_numero,
      lineas,
      saqueInicial: p.saque_equipo as any,
      situacion: p.situacion as any,
      ganador: p.ganador as any,
      rotacion: p.rotacion as any,
      liberos: (p.liberos ?? []) as any,
      posicionesPunto: (p.posiciones_punto ?? {}) as any,
      cambios: (p.cambios ?? []) as any,
      equipoId: p.equipo_id ?? undefined,
      estadoRival: p.estado_rival ? (p.estado_rival as any) : undefined,
    };
  }

  return cerrados;
}