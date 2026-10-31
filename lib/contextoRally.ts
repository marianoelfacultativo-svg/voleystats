// ============================================================
// CONTEXTO DEL RALLY — motor puro (v3)
// ============================================================
// Cambios v3 (FASE 7.4 — problema C):
//   + Nuevo `calcularFaseDePunto(accionesDelPunto)`: clasifica el
//     PUNTO ENTERO por cómo arrancó el rally, no cada acción.
//   + Nuevo `calcularFasesPorPunto(acciones)`: Map<clave, fase>
//     sobre el universo. Clave `partido|set|punto`, mismo formato
//     que `calcularResultadosPunto` y `calcularCrucesPorPunto`.
//   + Se usa para que "cómo terminan los puntos en side-out"
//     filtre PUNTOS completos (no acciones sueltas) y así el
//     resultado del punto se calcule sobre la última acción real.
//
// v2:
//   + FaseRally ahora incluye "k2" y "k3" además de "side-out",
//     "contraataque", "free-ball" y "otro".
//   + calcularFaseRally distingue:
//       · K1 / side-out            → primer toque propio del rally
//                                    es recepción o libre.
//       · Free ball                → el rival mandó una libre antes
//                                    de que el equipo toque la pelota.
//       · K3 / contraataque cobre. → primer toque propio es una
//                                    cobertura (defensa con subtipo
//                                    cobertura).
//       · K2 / contraataque def.   → primer toque propio es defensa
//                                    normal (subtipo no-cobertura).
//       · "contraataque" (legacy)  → queda como fallback para datos
//                                    muy viejos que no se pueden
//                                    clasificar mejor. El motor v6 lo
//                                    trata como equivalente a k2 o k3
//                                    cuando filtra.
//   + Se agregó el helper `esCobertura(a)` (export) para reusar la
//     detección en otros módulos.
//   + La detección de cobertura ignora el prefijo "toque:" que el
//     analizador agrega a algunos subtipos de ataque.
//
// El resto del archivo (marcador, rachas, inicio del punto, etc.)
// queda igual que en v1.
// ============================================================

import type { AccionVisual } from "../app/equipo/adaptadorUnificadoV2";

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

function esPuntoCritico(puntosPropios: number, puntosRivales: number): boolean {
  const max = Math.max(puntosPropios, puntosRivales);
  return max >= 20;
}

function puntosParaCerrar(
  puntosPropios: number,
  puntosRivales: number
): number {
  const propio = Math.max(puntosPropios, puntosRivales);
  return Math.max(0, 25 - propio);
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

  if (subRec === "perfecta" || subRec === "positiva") {
    return "recepcion_positiva";
  }
  if (subRec === "intermedia") {
    return "recepcion_neutra";
  }
  if (subRec === "negativa" || subRec === "doble_negativa") {
    return "recepcion_negativa";
  }
  if (subRec === "overpass") {
    return "overpass";
  }
  if (subRec === "error_directo") {
    return "error_directo";
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
  acciones: AccionVisual[]
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
          esPuntoCritico(marcador.propios, marcador.rivales) &&
          puntosParaCerrar(marcador.propios, marcador.rivales) <= 5,
        rachaGanadosActual: rachaGanados,
        rachaPerdidosActual: rachaPerdidos,
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
  if (a.tipo === "saque") {
    if (sub === "ace") return "ace";
    if (sub === "negativo") return "error_propio";
    return "neutro";
  }
  if (a.tipo === "recepcion") {
    if (sub === "error_directo") return "ace_contra";
    if (sub === "negativa" || sub === "doble_negativa" || sub === "overpass") {
      return "error_propio";
    }
    return "neutro";
  }
  if (a.tipo === "ataque") {
    if (
      sub === "punto" ||
      sub === "punto_directo_ataque" ||
      sub === "punto_desviado_ataque" ||
      sub === "use_rival_ataque"
    ) {
      return "punto";
    }
    if (
      sub === "error" ||
      sub === "error_red_ataque" ||
      sub === "error_afuera_ataque" ||
      sub === "gorro_ataque"
    ) {
      return a.es_rival ? "error_rival" : "error_propio";
    }
    return "neutro";
  }
  if (a.tipo === "bloqueo") {
    if (sub === "punto") return "punto";
    if (sub === "red" || sub === "use_rival" || sub === "filtrada") {
      return a.es_rival ? "error_rival" : "error_propio";
    }
    return "neutro";
  }
  if (a.tipo === "roce-red") {
    if (sub === "roce-red-rival") return "punto";
    return "error_propio";
  }
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
//
// Ventaja: si el rally arrancó en side-out, TODO el punto es
// side-out, sin importar desvíos, bloqueos, defensas posteriores
// ni cuántas acciones siga. Eso permite filtrar PUNTOS completos
// (no acciones sueltas) por fase, que es lo que necesita
// "cómo terminan los puntos en side-out".
//
// Nota sobre `punto_desviado_ataque`, `use_rival_ataque`,
// `gorro_ataque` y `punto_directo_ataque`: son variantes de
// "punto propio". NO cambian la fase. La fase queda fijada por
// cómo arrancó el rally.
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
 *
 * Se calcula sobre el UNIVERSO COMPLETO (no sobre el subset filtrado)
 * para que el filtro por fase sea consistente aunque el usuario haya
 * aplicado otros filtros antes.
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