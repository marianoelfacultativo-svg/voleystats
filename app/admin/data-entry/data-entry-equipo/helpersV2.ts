// ============================================================
// HELPERS PUROS V2 — DataEntryV2
// Funciones sin estado, sin React. Solo transformación de datos.
// ============================================================

import { getRectMiniLayout } from "./CanchaV2";
import type { PuntoV2, LineaV2 } from "./LineasV2";
import type { LineaClasificada, Situacion } from "@/lib/clasificacionV2";
import type { AccionV2Data } from "@/lib/dbV2";
import {
  numeroRotacionDesdePosiciones,
  type RotacionPunto,
  type Zona,
} from "@/lib/rotaciones";
import { zonaCrudaDeCelda } from "@/lib/cancha";

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

// ------------------------------------------------------------
// CONTEXTO ANALÍTICO — para calcular los campos extra
// ------------------------------------------------------------

export interface ContextoAnalitico {
  rotacionPropia: RotacionPunto | null;
  rotacionRival: RotacionPunto | null;
  situacionPropia: Situacion;
  situacionRival: Situacion;
  equipoId: string;
  equipoRivalId: string | null;
}

// ------------------------------------------------------------
// Helpers internos analíticos
// ------------------------------------------------------------

/** Invierte solo la fila (F1↔F6, F2↔F5, F3↔F4) y bloqueos. */
function invertirFila(celda: string): string {
  if (celda.startsWith("F1-")) return "F6-" + celda.slice(3);
  if (celda.startsWith("F2-")) return "F5-" + celda.slice(3);
  if (celda.startsWith("F3-")) return "F4-" + celda.slice(3);
  if (celda.startsWith("F4-")) return "F3-" + celda.slice(3);
  if (celda.startsWith("F5-")) return "F2-" + celda.slice(3);
  if (celda.startsWith("F6-")) return "F1-" + celda.slice(3);
  if (celda.startsWith("BLOQ-P-")) return "BLOQ-R-" + celda.slice(7);
  if (celda.startsWith("BLOQ-R-")) return "BLOQ-P-" + celda.slice(7);
  return celda;
}

/**
 * Devuelve la zona "cruda" (4/3/2/6) normalizada al sistema de referencia
 * del equipo que la consulta. Si la celda está en el lado rival (F4/F5/F6),
 * se invierte la fila para traerla a F1/F2/F3 y así poder aplicar la
 * misma tabla.
 */
function zonaDeCeldaNormalizada(celda: string | null): number | null {
  if (!celda) return null;
  let c = celda;
  if (/^F[456]-/.test(c) || c.startsWith("BLOQ-R-")) {
    c = invertirFila(c);
  }
  return zonaCrudaDeCelda(c);
}

/**
 * Determina si una acción debe considerarse "error" del que la ejecuta.
 */
function esErrorDeAccion(
  tipo: string,
  subtipo: string | number | null | undefined
): boolean {
  if (subtipo === null || subtipo === undefined) return false;
  const s = String(subtipo);

  if (tipo === "saque") {
    return s === "negativo";
  }
  if (tipo === "recepcion") {
    const n = typeof subtipo === "number" ? subtipo : parseInt(s, 10);
    return n === 1;
  }
  if (tipo === "ataque") {
    const base = s.startsWith("toque:") ? s.slice(6) : s;
    return base === "error";
  }
  if (tipo === "bloqueo") {
    return s === "red" || s === "use_rival" || s === "filtrada";
  }
  if (tipo === "defensa") {
    return (
      s === "error_def" ||
      s === "toque_negativa" ||
      s === "mala_libre" ||
      s === "cobertura_negativa" ||
      s === "errores_graves"
    );
  }
  if (tipo === "armado") {
    const n = typeof subtipo === "number" ? subtipo : parseInt(s, 10);
    return n === 1;
  }
  if (tipo === "roce-red") {
    return s === "roce-red-rival";
  }
  return false;
}

/**
 * Devuelve { rol, zona } del jugador dentro de la rotación (del equipo que
 * hizo la acción). Si el jugador no está mapeado en la rotación (p. ej. un
 * líbero), se busca en `liberos` y se retorna rol "L" con la zona del
 * jugador al que reemplaza (si lo hubiese).
 */
function infoJugadorEnRotacion(
  rotacion: RotacionPunto | null,
  jugadorId: string | null
): { rol: string | null; zona: number | null } {
  if (!rotacion || !jugadorId) return { rol: null, zona: null };

  for (const asig of Object.values(rotacion.posiciones)) {
    if (asig.jugador_id === jugadorId) {
      return { rol: asig.tipo, zona: asig.zona };
    }
  }

  const lib = (rotacion.liberos ?? []).find(
    (l) => l.jugador_id === jugadorId
  );
  if (lib) return { rol: "L", zona: null };

  return { rol: null, zona: null };
}

/**
 * Devuelve las coordenadas (x, y) del centro de una mini en el sistema del
 * grid de CanchaV2. Devuelve null si la celda no es una celda con grilla
 * (p. ej. bloqueos, red).
 */
function coordsDeMini(
  celda: string | null,
  mini: string | null
): { x: number; y: number } | null {
  if (!celda || !mini) return null;
  if (
    celda.startsWith("BLOQ-") ||
    celda.startsWith("RED-") ||
    celda.startsWith("FUERA-")
  ) {
    return null;
  }
  const r = getRectMiniLayout(celda, mini);
  if (!r) return null;
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

// ------------------------------------------------------------
// Construcción de AccionV2Data con campos analíticos
// ------------------------------------------------------------

interface OverrideAccion {
  jugadorId?: string | null;
  subtipo?: string | null;
}

function construirAccion(
  l: LineaClasificada,
  orden: number,
  ctx: ContextoAnalitico,
  override?: OverrideAccion
): AccionV2Data {
  // Subtipo final (con prefijo "toque:" si es ataque con variante toque)
  let subtipoFinal: string | number | null =
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

  // Rotación de referencia (del equipo que hizo la acción)
  const rotacionRef = l.esRival ? ctx.rotacionRival : ctx.rotacionPropia;

  // Zona del origen: normalizada al sistema del que hace la acción
  const zona_origen = l.esRival
    ? zonaDeCeldaNormalizada(l.origen.celda)
    : zonaDeCeldaNormalizada(l.origen.celda);

  // Zona del destino: la celda cruda; si está en el lado opuesto al que
  // hace la acción, invertir para traerla al sistema del receptor.
  // → Convención: `zona_destino` = zona donde cayó, en el sistema del
  //   equipo RECEPTOR (el que defiende el destino).
  //   Si la acción es propia, el destino suele estar en cancha rival →
  //   invertimos para "traerlo" al sistema propio.
  //   Si es rival, el destino suele estar en cancha propia → ya está en
  //   sistema propio.
  //   Regla simple: normalizar SIEMPRE al sistema propio (F1-F3).
  const zona_destino = zonaDeCeldaNormalizada(l.destino.celda);

  const rotacion_numero = rotacionRef
    ? numeroRotacionDesdePosiciones(rotacionRef)
    : null;

  const { rol: rol_jugador, zona: zona_jugador } = infoJugadorEnRotacion(
    rotacionRef,
    jugadorFinal
  );

  const cOrigen = coordsDeMini(l.origen.celda, l.origen.mini);
  const cDestino = coordsDeMini(l.destino.celda, l.destino.mini);
  const cPosIni = l.posicionInicial
    ? coordsDeMini(l.posicionInicial.celda, l.posicionInicial.mini)
    : null;

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
    zona: zona_origen,
    posicion_inicial_celda: l.posicionInicial?.celda ?? null,
    posicion_inicial_mini: l.posicionInicial?.mini ?? null,
    velocidad: l.velocidad ?? null,
    tipo_saque: l.tipoSaque ?? null,
    variante: l.variante ?? null,
    x2: l.x2 ?? false,
    oculta: l.oculta ?? false,
    equipo_id: l.equipoId ?? null,

    // Analíticos
    es_error: esErrorDeAccion(l.tipo, subtipoFinal),
    zona_origen,
    zona_destino,
    rotacion_numero,
    rol_jugador,
    zona_jugador,
    origen_x: cOrigen?.x ?? null,
    origen_y: cOrigen?.y ?? null,
    destino_x: cDestino?.x ?? null,
    destino_y: cDestino?.y ?? null,
    posicion_inicial_x: cPosIni?.x ?? null,
    posicion_inicial_y: cPosIni?.y ?? null,
  };
}

export function lineasAAcciones(
  lineas: LineaClasificada[],
  contexto: ContextoAnalitico
): AccionV2Data[] {
  const acciones: AccionV2Data[] = [];
  let orden = 1;

  for (const l of lineas) {
    if (l.tipo === "bloqueo" && !l.esRival) {
      const desviosBLOQP = (l.desvios ?? []).filter((d) =>
        d.celda.startsWith("BLOQ-P-")
      );

      if (desviosBLOQP.length > 0) {
        const esOrigenRival = /^F[456]-/.test(l.origen.celda);

        if (esOrigenRival) {
          // 1. Ataque rival
          acciones.push(
            construirAccion(
              {
                ...l,
                tipo: "ataque",
                esRival: true,
                jugadorId: null,
                destino: desviosBLOQP[0],
                desvios: [],
                subtipo: "neutro",
              },
              orden++,
              contexto
            )
          );

          // 2. Bloqueo propio
          if (desviosBLOQP.length > 1) {
            const base = (l.subtipo ?? "positivo") as string;
            const esPositiva =
              base === "punto" ||
              base === "positivo_mas" ||
              base === "positivo";
            const sub = esPositiva ? "positivo" : "neutro";
            for (const d of desviosBLOQP) {
              acciones.push(
                construirAccion(
                  {
                    ...l,
                    tipo: "bloqueo",
                    esRival: false,
                    origen: d,
                    desvios: [],
                  },
                  orden++,
                  contexto,
                  {
                    jugadorId: d.jugadorId ?? null,
                    subtipo: sub,
                  }
                )
              );
            }
          } else {
            acciones.push(
              construirAccion(
                {
                  ...l,
                  tipo: "bloqueo",
                  esRival: false,
                  origen: desviosBLOQP[0],
                  desvios: [],
                },
                orden++,
                contexto
              )
            );
          }

          continue;
        }
      }

      // Lógica existente para múltiples bloqueos propios seguidos
      if (desviosBLOQP.length > 1) {
        const base = (l.subtipo ?? "positivo") as string;
        const esPositiva =
          base === "punto" ||
          base === "positivo_mas" ||
          base === "positivo";
        const sub = esPositiva ? "positivo" : "neutro";
        for (const d of desviosBLOQP) {
          acciones.push(
            construirAccion(l, orden++, contexto, {
              jugadorId: d.jugadorId ?? null,
              subtipo: sub,
            })
          );
        }
        continue;
      }
    }
    acciones.push(construirAccion(l, orden++, contexto));
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