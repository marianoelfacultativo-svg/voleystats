// ============================================================
// CONTEXTO DEL RALLY — motor puro (v4)
// ============================================================
// Cambios v4 (FASE 7.5 — Pendiente #0: fix de cierre de set):
//   + Nuevas funciones EXPORTADAS:
//       · targetDelSet(set, formato)           → 25 o 15 (tie-break)
//       · puntosParaCerrarSet(propios, rivales, set, formato)
//       · esSetTerminado(propios, rivales, set, formato)
//     Reemplazan la fórmula hardcoded (25 - max) que tenía el bug:
//     no consideraba tie-break ni la regla de 2 puntos de diferencia.
//   + ContextoRally suma 2 campos: setNumero y formatoPartido.
//   + calcularContextoRally acepta `formatoPartido: "bo3" | "bo5"`.
//   + `esPuntoCritico` y `puntosParaCerrar` (privadas) se ELIMINAN.
//     Ahora `esPuntoCritico` = puntosParaCerrarSet(...) <= 5.
//
// Cambios v3 (FASE 7.4 — problema C):
//   + Nuevo `calcularFaseDePunto(accionesDelPunto)`: clasifica el
//     PUNTO ENTERO por cómo arrancó el rally, no cada acción.
//   + Nuevo `calcularFasesPorPunto(acciones)`: Map<clave, fase>
//     sobre el universo. Clave `partido|set|punto`, mismo formato
//     que `calcularResultadosPunto` y `calcularCrucesPorPunto`.
//
// v2:
//   + FaseRally ahora incluye "k2" y "k3" además de "side-out",
//     "contraataque", "free-ball" y "otro".
// ============================================================

import type { AccionVisual } from "../app/equipo/adaptadorUnificadoV2";
import {
  desenlaceDeSubtipo,
  valoracionDeSubtipo,
} from "./analisis/catalogoSubtipos";

// ------------------------------------------------------------
// TIPOS
// ------------------------------------------------------------

export type FaseRally =
  | "side-out"
  | "k2"
  | "k3"
  | "contraataque"
  | "free-ball"
  | "otro";

export type InicioPunto =
  | "ace_propio"
  | "ace_rival"
  | "recepcion_positiva"
  | "recepcion_neutra"
  | "recepcion_negativa"
  | "overpass"
  | "error_directo"
  | "otro";

export type UbicacionJugador = "delantero" | "zaguero" | "libero" | "otro";

export type EstadoMarcador = "empatado" | "ganando" | "perdiendo";

export type DiferenciaMarcador = "0" | "1-2" | "3-5" | "6+";

// ------------------------------------------------------------
// CIERRE DE SET — regla correcta (Pendiente #0)
// ------------------------------------------------------------
// target = 25 normal, 15 en tie-break (BO3 set 3 / BO5 set 5).
// Para ganar: llegar al target con 2+ de diferencia.
// ------------------------------------------------------------

export function targetDelSet(
  set: number,
  formato: "bo3" | "bo5"
): number {
  if (formato === "bo3" && set === 3) return 15;
  if (formato === "bo5" && set === 5) return 15;
  return 25;
}

export function puntosParaCerrarSet(
  puntosPropios: number,
  puntosRivales: number,
  set: number,
  formato: "bo3" | "bo5"
): number {
  const target = targetDelSet(set, formato);
  const minimoParaGanar = Math.max(target, puntosRivales + 2);
  return Math.max(0, minimoParaGanar - puntosPropios);
}

export function esSetTerminado(
  puntosPropios: number,
  puntosRivales: number,
  set: number,
  formato: "bo3" | "bo5"
): boolean {
  const target = targetDelSet(set, formato);
  const max = Math.max(puntosPropios, puntosRivales);
  const min = Math.min(puntosPropios, puntosRivales);
  return max >= target && max - min >= 2;
}

export interface ContextoRally {
  // --- Rally ---
  fase: FaseRally;
  esPrimerToqueDelEquipo: boolean;
  toquesDelEquipoEnPunto: number;
  // --- Inicio del punto ---
  inicioPunto: InicioPunto;
  // --- Ubicación ---
  ubicacion: UbicacionJugador;
  // --- Marcador al momento de la acción ---
  puntosPropios: number;
  puntosRivales: number;
  estadoMarcador: EstadoMarcador;
  diferencia: DiferenciaMarcador;
  esPuntoCritico: boolean;
  // --- Rachas ---
  rachaGanadosActual: number;
  rachaPerdidosActual: number;
  // --- Set y formato (para tie-break / regla de 2) ---
  setNumero: number;
  formatoPartido: "bo3" | "bo5";
}

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

function baseSubtipo(a: AccionVisual): string {
  const s =
    a.subtipo !== null && a.subtipo !== undefined ? String(a.subtipo) : "";
  return s.startsWith("toque:") ? s.slice(6) : s;
}

/**
 * ¿La acción es una cobertura de defensa? (K3)
 *
 * Se acepta tanto el subtipo "raw" que usa la consola como los
 * subtipos "finales" que se guardan en Supabase.
 */
export function esCobertura(a: AccionVisual): boolean {
  if (a.tipo !== "defensa") return false;
  const sub = baseSubtipo(a);
  return (
    sub === "cobertura" ||
    sub === "cobertura_positiva" ||
    sub === "cobertura_negativa"
  );
}

function ubicacionPorZona(zona: number | null): UbicacionJugador {
  if (zona === null) return "otro";
  if (zona === 1 || zona === 5 || zona === 6) return "zaguero";
  if (zona === 2 || zona === 3 || zona === 4) return "delantero";
  return "otro";
}

function tramoDiferencia(
  puntosPropios: number,
  puntosRivales: number
): DiferenciaMarcador {
  const diff = Math.abs(puntosPropios - puntosRivales);
  if (diff === 0) return "0";
  if (diff <= 2) return "1-2";
  if (diff <= 5) return "3-5";
  return "6+";
}

function calcularInicioPunto(lineas: AccionVisual[]): InicioPunto {
  if (lineas.length === 0) return "otro";

  const saque = lineas.find((a) => a.tipo === "saque");
  if (!saque) return "otro";

  const saquePropio = !saque.es_rival;
  const subSaque = baseSubtipo(saque);

  if (subSaque === "ace") {
    return saquePropio ? "ace_propio" : "ace_rival";
  }

  const recepcion = lineas.find((a) => a.tipo === "recepcion");
  if (!recepcion) {
    if (subSaque === "negativo") {
      return saquePropio ? "error_directo" : "error_directo";
    }
    return "otro";
  }

    const subRec = baseSubtipo(recepcion);
  const desRec = desenlaceDeSubtipo("recepcion", subRec);
  const valRec = valoracionDeSubtipo("recepcion", subRec);

  if (desRec === "error") {
    return "error_directo";
  }
  if (valRec === "pos") {
    return "recepcion_positiva";
  }
  if (valRec === "neu") {
    return "recepcion_neutra";
  }
  if (subRec.startsWith("over")) {
    return "overpass";
  }
  if (valRec === "neg") {
    return "recepcion_negativa";
  }

  return "otro";
}

// ------------------------------------------------------------
// FASES DEL RALLY — K1 / K2 / K3 / Free-ball
// ------------------------------------------------------------
//
// Reglas:
//
//   1. Buscar el primer toque PROPIO del rally, ignorando los
//      bloqueos (los bloqueos no cuentan como uno de los 3 toques
//      del equipo en el vóley, y sirven para cubrir el ataque rival
//      o responder al ataque rival, pero no "inician" la secuencia
//      atacante propia).
//
//   2. Si no hay toque propio todavía, la fase es "otro" (la acción
//      actual es del rival o es un bloqueo que cerró el punto).
//
//   3. Free ball: si la acción rival inmediatamente anterior al
//      primer toque propio es una "libre", el rally es free ball.
//
//   4. Side-out / K1: si el primer toque propio es recepción o libre.
//
//   5. K3: si el primer toque propio es una cobertura (defensa con
//      subtipo cobertura). Contraataque desde cobertura.
//
//   6. K2: si el primer toque propio es una defensa "normal"
//      (subtipo no-cobertura). Contraataque desde defensa.
//
//   7. "contraataque" genérico se mantiene en el tipo por compat
//      pero este detector NUNCA lo devuelve. Solo aparece en datos
//      viejos guardados antes de v2.
// ------------------------------------------------------------

function calcularFaseRally(idx: number, lineas: AccionVisual[]): FaseRally {
  if (idx === 0) return "side-out";

  // 1. Primer toque propio no-bloqueo del rally.
  let primerToquePropioIdx = -1;
  for (let i = 0; i <= idx; i++) {
    const l = lineas[i];
    if (l.es_rival) continue;
    if (l.tipo === "bloqueo") continue;
    if (l.tipo === "saque") continue;
    primerToquePropioIdx = i;
    break;
  }

  if (primerToquePropioIdx < 0) return "otro";

  const primerToquePropio = lineas[primerToquePropioIdx];

  // 2. ¿Acción rival inmediatamente anterior al primer toque propio?
  let accionRivalPrevia: AccionVisual | null = null;
  for (let i = primerToquePropioIdx - 1; i >= 0; i--) {
    if (lineas[i].es_rival) {
      accionRivalPrevia = lineas[i];
      break;
    }
  }

  // 3. Free ball: el rival mandó una libre antes de que toquemos.
  if (accionRivalPrevia?.tipo === "libre") {
    return "free-ball";
  }

  // 4. Side-out / K1.
  if (primerToquePropio.tipo === "recepcion") return "side-out";
  if (primerToquePropio.tipo === "libre") return "side-out";

  // 5. K3: contraataque desde cobertura.
  if (esCobertura(primerToquePropio)) return "k3";

  // 6. K2: contraataque desde defensa "normal".
  if (primerToquePropio.tipo === "defensa") return "k2";

  return "otro";
}

// ------------------------------------------------------------
// CÁLCULO PRINCIPAL (por acción)
// ------------------------------------------------------------

interface GrupoPunto {
  partidoId: string;
  set: number;
  punto: number;
  lista: AccionVisual[];
}

export function calcularContextoRally(
  acciones: AccionVisual[],
  formatoPartido: "bo3" | "bo5" = "bo3"
): Map<string, ContextoRally> {
  const resultado = new Map<string, ContextoRally>();

  // 1. Agrupar por (partido, set, punto).
  const gruposMap = new Map<string, GrupoPunto>();
  for (const a of acciones) {
    if (a.oculta) continue;
    const partidoId = a.partido_id || "sin-partido";
    const k = `${partidoId}|${a.set_numero}|${a.punto_numero}`;
    let g = gruposMap.get(k);
    if (!g) {
      g = { partidoId, set: a.set_numero, punto: a.punto_numero, lista: [] };
      gruposMap.set(k, g);
    }
    g.lista.push(a);
  }

  for (const g of gruposMap.values()) {
    g.lista.sort((x, y) => x.orden - y.orden);
  }

  // 2. Ordenar los puntos por (partido, set, punto).
  const puntosOrdenados = Array.from(gruposMap.values()).sort((a, b) => {
    if (a.partidoId !== b.partidoId) return a.partidoId.localeCompare(b.partidoId);
    if (a.set !== b.set) return a.set - b.set;
    return a.punto - b.punto;
  });

  // 3. Marcador por (partido, set) y rachas globales.
  const marcadorPorSet = new Map<string, { propios: number; rivales: number }>();
  let rachaGanados = 0;
  let rachaPerdidos = 0;
  let ultimoPartido = "";
  let ultimoSet = -1;

  for (const grupo of puntosOrdenados) {
    const { lista, set, partidoId } = grupo;

    if (partidoId !== ultimoPartido || set !== ultimoSet) {
      const k = `${partidoId}|${set}`;
      marcadorPorSet.set(k, { propios: 0, rivales: 0 });
      rachaGanados = 0;
      rachaPerdidos = 0;
      ultimoPartido = partidoId;
      ultimoSet = set;
    }

    const setKey = `${partidoId}|${set}`;
    const marcador = marcadorPorSet.get(setKey) ?? { propios: 0, rivales: 0 };

    const inicioPunto = calcularInicioPunto(lista);

    const ultima = lista.length > 0 ? lista[lista.length - 1] : null;
    let ganoPropio = false;
    if (ultima) {
      const res = clasificarResultadoFin(ultima);
      if (res === "punto" || res === "ace") {
        ganoPropio = !ultima.es_rival;
      } else if (res === "error_propio" || res === "error_rival") {
        ganoPropio = ultima.es_rival;
      } else if (res === "ace_contra") {
        ganoPropio = ultima.es_rival;
      } else {
        ganoPropio = !ultima.es_rival;
      }
    }

    for (let i = 0; i < lista.length; i++) {
      const a = lista[i];

      const primerToquePropio =
        !a.es_rival && lista.findIndex((x) => !x.es_rival) === i;

      let toquesPropiosHasta = 0;
      for (let j = 0; j <= i; j++) {
        if (!lista[j].es_rival) toquesPropiosHasta++;
      }

      const fase = calcularFaseRally(i, lista);
      const ubicacion = ubicacionPorZona(a.zona_jugador);

      resultado.set(a.id, {
        fase,
        esPrimerToqueDelEquipo: primerToquePropio,
        toquesDelEquipoEnPunto: toquesPropiosHasta,
        inicioPunto,
        ubicacion,
        puntosPropios: marcador.propios,
        puntosRivales: marcador.rivales,
        estadoMarcador:
          marcador.propios === marcador.rivales
            ? "empatado"
            : marcador.propios > marcador.rivales
            ? "ganando"
            : "perdiendo",
        diferencia: tramoDiferencia(marcador.propios, marcador.rivales),
        esPuntoCritico:
          puntosParaCerrarSet(
            marcador.propios,
            marcador.rivales,
            set,
            formatoPartido
          ) <= 5,
        rachaGanadosActual: rachaGanados,
        rachaPerdidosActual: rachaPerdidos,
        setNumero: set,
        formatoPartido,
      });
    }

    if (ganoPropio) {
      marcador.propios++;
      rachaGanados++;
      rachaPerdidos = 0;
    } else if (ultima) {
      marcador.rivales++;
      rachaPerdidos++;
      rachaGanados = 0;
    }
    marcadorPorSet.set(setKey, marcador);
  }

  return resultado;
}

// ------------------------------------------------------------
// CLASIFICACIÓN RÁPIDA DEL FIN DEL PUNTO
// ------------------------------------------------------------

function clasificarResultadoFin(a: AccionVisual): string {
  const sub = baseSubtipo(a);

  if (a.tipo === "roce-red") {
    if (sub === "roce-red-rival") return "punto";
    return a.es_rival ? "error_rival" : "error_propio";
  }

  if (a.es_error) {
    return a.es_rival ? "error_rival" : "error_propio";
  }

  const fundamento = a.tipo === "armado" ? "armados" : a.tipo;
  const desenlace = desenlaceDeSubtipo(fundamento, sub);

  if (desenlace === "punto") {
    return a.tipo === "saque" ? "ace" : "punto";
  }

  if (desenlace === "error") {
    if (a.tipo === "recepcion" && (sub === "error_directo" || sub === "ace_contra")) {
      return "ace_contra";
    }
    return a.es_rival ? "error_rival" : "error_propio";
  }

  if (sub === "buena_rival") return "punto";
  if (sub === "error_rival") return a.es_rival ? "error_rival" : "error_propio";

  return "neutro";
}

// ------------------------------------------------------------
// FASE POR PUNTO (FASE 7.4 — problema C)
// ------------------------------------------------------------
// A diferencia de `calcularFaseRally`, que clasifica CADA ACCIÓN
// según el momento del rally, `calcularFaseDePunto` clasifica el
// PUNTO ENTERO por cómo empezó el rally.
//
// Regla:
//   - Mira la primera acción PROPIA no-bloqueo del punto.
//   - Si es recepción o libre → side-out.
//   - Si es cobertura → k3.
//   - Si es defensa normal → k2.
//   - Si el rival mandó una libre antes → free-ball.
//   - Sin primer toque propio → otro.
// ------------------------------------------------------------

export function calcularFaseDePunto(
  accionesDelPunto: AccionVisual[]
): FaseRally {
  const visibles = accionesDelPunto
    .filter((a) => !a.oculta)
    .sort((a, b) => a.orden - b.orden);

  if (visibles.length === 0) return "otro";

  // Primer toque propio no-bloqueo.
  let primerToquePropio: AccionVisual | null = null;
  let idxPrimerToquePropio = -1;
  for (let i = 0; i < visibles.length; i++) {
    const a = visibles[i];
    if (a.es_rival) continue;
    if (a.tipo === "bloqueo") continue;
    if (a.tipo === "saque") continue;
    primerToquePropio = a;
    idxPrimerToquePropio = i;
    break;
  }

  if (!primerToquePropio) return "otro";

  // Acción rival inmediatamente anterior al primer toque propio.
  let accionRivalPrevia: AccionVisual | null = null;
  for (let i = idxPrimerToquePropio - 1; i >= 0; i--) {
    if (visibles[i].es_rival) {
      accionRivalPrevia = visibles[i];
      break;
    }
  }

  // Free ball: el rival mandó una libre antes de que toquemos.
  if (accionRivalPrevia?.tipo === "libre") return "free-ball";

  // Side-out: primer toque propio es recepción o libre.
  if (primerToquePropio.tipo === "recepcion") return "side-out";
  if (primerToquePropio.tipo === "libre") return "side-out";

  // K3: primer toque propio es cobertura.
  if (esCobertura(primerToquePropio)) return "k3";

  // K2: primer toque propio es defensa normal.
  if (primerToquePropio.tipo === "defensa") return "k2";

  return "otro";
}

/**
 * Calcula la fase de CADA punto del universo y devuelve un
 * `Map<clave, FaseRally>`, con clave `partido_id|set_numero|punto_numero`
 * (mismo formato que `calcularResultadosPunto` y `calcularCrucesPorPunto`).
 */
export function calcularFasesPorPunto(
  acciones: AccionVisual[]
): Map<string, FaseRally> {
  const porPunto = new Map<string, AccionVisual[]>();
  for (const a of acciones) {
    if (a.oculta) continue;
    const k = `${a.partido_id || ""}|${a.set_numero}|${a.punto_numero}`;
    let arr = porPunto.get(k);
    if (!arr) {
      arr = [];
      porPunto.set(k, arr);
    }
    arr.push(a);
  }

  const out = new Map<string, FaseRally>();
  for (const [k, lista] of porPunto) {
    out.set(k, calcularFaseDePunto(lista));
  }
  return out;
}

// ------------------------------------------------------------
// ETIQUETAS
// ------------------------------------------------------------

export function etiquetaFase(f: FaseRally): string {
  const map: Record<FaseRally, string> = {
    "side-out": "Side-out (K1)",
    k2: "Contraataque desde defensa (K2)",
    k3: "Contraataque desde cobertura (K3)",
    contraataque: "Contraataque (legacy)",
    "free-ball": "Free ball",
    otro: "Otro",
  };
  return map[f];
}

export function etiquetaInicioPunto(i: InicioPunto): string {
  const map: Record<InicioPunto, string> = {
    ace_propio: "Ace propio",
    ace_rival: "Ace rival",
    recepcion_positiva: "Recepción positiva",
    recepcion_neutra: "Recepción neutra",
    recepcion_negativa: "Recepción negativa",
    overpass: "Overpass",
    error_directo: "Error directo",
    otro: "Otro",
  };
  return map[i];
}

export function etiquetaUbicacion(u: UbicacionJugador): string {
  const map: Record<UbicacionJugador, string> = {
    delantero: "Delantero",
    zaguero: "Zaguero",
    libero: "Líbero",
    otro: "Otro",
  };
  return map[u];
}

export function etiquetaEstadoMarcador(e: EstadoMarcador): string {
  const map: Record<EstadoMarcador, string> = {
    empatado: "Empatado",
    ganando: "Ganando",
    perdiendo: "Perdiendo",
  };
  return map[e];
}