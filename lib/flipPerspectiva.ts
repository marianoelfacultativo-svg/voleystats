// ============================================================
// FLIP DE PERSPECTIVA — utilidades compartidas
// ============================================================
//
// Cuando un equipo mira un partido donde es el "rival" (es decir,
// no es el `equipo_id` del partido sino el `equipo_rival_id`),
// las acciones guardadas están desde la perspectiva del equipo
// local. Este módulo centraliza el flip de perspectivas y el
// recálculo de subtipos para que todos los consumidores
// (adaptadorUnificadoV2, cargarAccionesCompatibles,
// contarPuntosRival) vean los datos como si ese equipo hubiera
// cargado el partido desde su propia consola.
//
// Nada de esto modifica Supabase. Todo es en memoria.
// ============================================================

import { supabase } from "./supabase";
import type { AccionV2Row, PuntoV2Completo } from "./dbV2";
import {
  calcularErroresRival,
  calcularSubtiposAtaque,
  calcularSubtiposAtaqueRival,
  calcularSubtiposBloqueo,
  calcularSubtiposDefensa,
  calcularSubtiposSaque,
  type Lado,
  type LineaClasificada,
} from "./clasificacionV2";

// ------------------------------------------------------------
// 1. INVERTIR CELDAS
// ------------------------------------------------------------

export function invertirCelda(celda: string): string {
  if (celda.startsWith("F1-")) return "F4-" + celda.slice(3);
  if (celda.startsWith("F2-")) return "F5-" + celda.slice(3);
  if (celda.startsWith("F3-")) return "F6-" + celda.slice(3);
  if (celda.startsWith("F4-")) return "F1-" + celda.slice(3);
  if (celda.startsWith("F5-")) return "F2-" + celda.slice(3);
  if (celda.startsWith("F6-")) return "F3-" + celda.slice(3);
  if (celda.startsWith("BLOQ-P-")) return "BLOQ-R-" + celda.slice(7);
  if (celda.startsWith("BLOQ-R-")) return "BLOQ-P-" + celda.slice(7);
  if (celda.startsWith("FUERA-ARR-")) return "FUERA-ABA-" + celda.slice(10);
  if (celda.startsWith("FUERA-ABA-")) return "FUERA-ARR-" + celda.slice(10);
  return celda;
}

// ------------------------------------------------------------
// 2. ¿HAY QUE FLIPEAR?
// ------------------------------------------------------------

/**
 * Devuelve true si `equipoId` es el `equipo_rival_id` del partido
 * (es decir, el usuario está mirando desde el lado rival del
 * equipo que originalmente cargó los datos).
 */
export async function debeFlipear(
  partidoId: string,
  equipoId?: string
): Promise<boolean> {
  if (!partidoId || !equipoId) return false;
  const { data } = await supabase
    .from("partidos")
    .select("equipo_id, equipo_rival_id")
    .eq("id", partidoId)
    .maybeSingle();
  return !!data && data.equipo_rival_id === equipoId;
}

// ------------------------------------------------------------
// 3. FLIP DE ACCIONES
// ------------------------------------------------------------

export function flipAccionV2Row(a: AccionV2Row): AccionV2Row {
  return {
    ...a,
    es_rival: !a.es_rival,
    lado: a.lado === "propio" ? "rival" : "propio",
    origen_celda: a.origen_celda ? invertirCelda(a.origen_celda) : null,
    destino_celda: a.destino_celda ? invertirCelda(a.destino_celda) : null,
    desvios: (a.desvios ?? []).map((d) => ({
      ...d,
      celda: invertirCelda(d.celda),
    })),
    posicion_inicial_celda: a.posicion_inicial_celda
      ? invertirCelda(a.posicion_inicial_celda)
      : null,
  };
}

// ------------------------------------------------------------
// 4. CONVERSIÓN DE SUBTIPOS GUARDADOS → RAW
// ------------------------------------------------------------

/**
 * Convierte los subtipos "finales" (los que ya pasaron por la
 * cadena de cálculo al guardar) de vuelta a sus valores "raw"
 * originales, para poder re-correr la cadena desde cero.
 *
 * - saque / ataque / bloqueo: siempre null. La cadena los
 *   recalcula mirando el destino y el contexto.
 * - defensa: convierte finales a raw.
 * - recepción / armado / libre / roce-red: pasan tal cual.
 */
function aSubtipoRawParaRecalculo(
  tipo: string,
  subtipo: string | number | null | undefined
): string | number | null {
  if (tipo === "saque" || tipo === "ataque" || tipo === "bloqueo") {
    return null;
  }
  if (tipo === "defensa") {
    const s = typeof subtipo === "string" ? subtipo : null;
    if (
      s === "toque" ||
      s === "gran-defensa" ||
      s === "libre" ||
      s === "cobertura"
    ) {
      return s;
    }
    if (s === "toque_positiva" || s === "toque_negativa") return "toque";
    if (s === "gran_def") return "gran-defensa";
    if (s === "error_def" || s === "mala_libre" || s === "errores_graves") {
      return "libre";
    }
    if (s === "cobertura_positiva" || s === "cobertura_negativa") {
      return "cobertura";
    }
    return null;
  }
  return subtipo ?? null;
}

/**
 * Reconstruye una LineaClasificada desde una AccionV2Row (ya
 * flipeada), lista para re-correr la cadena de cálculo.
 */
function rowALineaParaRecalculo(row: AccionV2Row): LineaClasificada {
  let variante = row.variante ?? null;
  let subtipo: string | number | null = row.subtipo ?? null;

  if (typeof subtipo === "string" && subtipo.startsWith("toque:")) {
    variante = variante ?? "toque";
    subtipo = subtipo.slice(6);
  }

  subtipo = aSubtipoRawParaRecalculo(row.tipo, subtipo);

  return {
    id: row.id,
    tipo: row.tipo as LineaClasificada["tipo"],
    esRival: row.es_rival,
    jugadorId: row.jugador_id ?? null,
    origen: {
      celda: row.origen_celda ?? "",
      mini: row.origen_mini ?? "",
    },
    destino: {
      celda: row.destino_celda ?? "",
      mini: row.destino_mini ?? "",
    },
    desvios: (row.desvios ?? []).map((d) => ({
      celda: d.celda,
      mini: d.mini ?? "",
      jugadorId: d.jugador_id ?? null,
    })),
    subtipo,
    variante:
      variante === "toque" || variante === "remate" ? variante : null,
    velocidad: row.velocidad ?? null,
    tipoSaque: (row.tipo_saque as LineaClasificada["tipoSaque"]) ?? null,
    x2: row.x2 ?? undefined,
    oculta: row.oculta ?? undefined,
    posicionInicial: row.posicion_inicial_celda
      ? {
          celda: row.posicion_inicial_celda,
          mini: row.posicion_inicial_mini ?? "",
        }
      : null,
    equipoId: row.equipo_id ?? null,
  };
}

// ------------------------------------------------------------
// 5. RECÁLCULO DE SUBTIPOS
// ------------------------------------------------------------

/**
 * Recalcula los subtipos de todas las acciones del partido después
 * de flipear la perspectiva. Devuelve un Map<id, subtipoNuevo>.
 *
 * @param rows      Acciones YA flipeadas.
 * @param ganadores Map de `${set}-${punto}` → ganador (ya flipeado).
 */
export function recalcularSubtiposPostFlip(
  rows: AccionV2Row[],
  ganadores: Map<string, Lado | null>
): Map<string, string | number | null> {
  const out = new Map<string, string | number | null>();

  const porPunto = new Map<string, AccionV2Row[]>();
  for (const r of rows) {
    const k = `${r.set_numero}-${r.punto_numero}`;
    let arr = porPunto.get(k);
    if (!arr) {
      arr = [];
      porPunto.set(k, arr);
    }
    arr.push(r);
  }

  for (const [k, arr] of porPunto) {
    arr.sort((a, b) => a.orden - b.orden);

    let lineas: LineaClasificada[] = arr.map(rowALineaParaRecalculo);

    lineas = calcularSubtiposSaque(lineas);
    lineas = calcularSubtiposAtaqueRival(lineas);
    lineas = calcularSubtiposBloqueo(lineas);
    lineas = calcularSubtiposDefensa(lineas);

    const ganador = ganadores.get(k) ?? "propio";
    lineas = calcularSubtiposAtaque(lineas, ganador);

    lineas = calcularErroresRival(lineas);

    for (const l of lineas) {
      out.set(l.id, l.subtipo ?? null);
    }
  }

  return out;
}

// ------------------------------------------------------------
// 6. PREPARAR PUNTOS COMPLETOS
// ------------------------------------------------------------

/**
 * Si `debeFlipear` es true, devuelve una copia de `puntos` con:
 *   - ganador invertido (propio ↔ rival)
 *   - cada acción flipeada
 *   - subtipos recalculados con la cadena completa
 *
 * Si `debeFlipear` es false, devuelve `puntos` sin tocar.
 */
export function prepararPuntos(
  puntos: PuntoV2Completo[],
  debeFlipear: boolean
): PuntoV2Completo[] {
  if (!debeFlipear) return puntos;

  // Primero flipeamos todas las acciones y el ganador.
  const puntosFlipeados: PuntoV2Completo[] = puntos.map((p) => {
    const accionesFlip = p.acciones.map(flipAccionV2Row);
    const ganadorFlip: Lado | null =
      p.ganador === "propio"
        ? "rival"
        : p.ganador === "rival"
        ? "propio"
        : null;
    return {
      ...p,
      ganador: ganadorFlip,
      acciones: accionesFlip,
    };
  });

  // Recalculamos subtipos por punto.
  return puntosFlipeados.map((p) => {
    const ganadores = new Map<string, Lado | null>();
    ganadores.set(`${p.set_numero}-${p.punto_numero}`, p.ganador);
    const subtiposNuevos = recalcularSubtiposPostFlip(p.acciones, ganadores);
    const accionesRecalc = p.acciones.map((a) =>
      subtiposNuevos.has(a.id)
        ? { ...a, subtipo: subtiposNuevos.get(a.id) ?? null }
        : a
    );
    return { ...p, acciones: accionesRecalc };
  });
}