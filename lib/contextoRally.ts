// ============================================================
// CONTEXTO DEL RALLY — motor puro
// ============================================================
// A partir de las acciones ya cargadas (AccionVisual[]), deriva
// POR ACCIÓN:
//
//   - Fase del rally: side-out / contraataque / free-ball
//   - ¿Es el primer toque del equipo en el punto?
//   - Número de toque del equipo en el punto (1, 2, 3, 4+)
//   - Cómo empezó el punto (ace propio/rival, recepción pos/neg, overpass…)
//   - Delantero / zaguero / líbero (según zona_jugador)
//   - Marcador del set al momento de la acción (parcial, diferencia,
//     punto crítico, estado ganando/perdiendo/empatado)
//   - Rachas (puntos consecutivos ganados/perdidos)
//
// NO modifica las acciones. Devuelve un Map<accionId, ContextoRally>.
//
// IMPORTANTE: la agrupación por punto usa `${partido_id}|${set}|${punto}`
// para que funcione bien cuando se pasan acciones de varios partidos
// juntos (caso "historial completo del equipo" en MiEquipo).
// Antes era `${set}-${punto}` y mezclaba los marcadores entre partidos.
// ============================================================

import type { AccionVisual } from "../app/equipo/adaptadorUnificadoV2";

// ------------------------------------------------------------
// TIPOS
// ------------------------------------------------------------

export type FaseRally = "side-out" | "contraataque" | "free-ball" | "otro";

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

function calcularFaseRally(idx: number, lineas: AccionVisual[]): FaseRally {
  if (idx === 0) return "side-out";

  const anterior = lineas[idx - 1];

  if (anterior.tipo === "recepcion" && !anterior.es_rival) {
    return "side-out";
  }
  if (anterior.tipo === "libre" && anterior.es_rival) {
    return "free-ball";
  }
  if (
    (anterior.tipo === "defensa" && !anterior.es_rival) ||
    (anterior.tipo === "bloqueo" && !anterior.es_rival)
  ) {
    return "contraataque";
  }
  if (anterior.tipo === "ataque" && anterior.es_rival) {
    return "contraataque";
  }
  if (anterior.tipo === "libre" && !anterior.es_rival) {
    return "side-out";
  }

  return "otro";
}

// ------------------------------------------------------------
// CÁLCULO PRINCIPAL
// ------------------------------------------------------------

interface GrupoPunto {
  partidoId: string;
  set: number;
  punto: number;
  lista: AccionVisual[];
}

/**
 * Devuelve un Map<accionId, ContextoRally> con todo el contexto
 * derivado de cada acción.
 *
 * @param acciones Puede ser el universo de UN partido o de varios
 *                 partidos juntos. Los puntos se identifican por
 *                 `${partido_id}|${set}|${punto}` para no mezclar
 *                 partidos entre sí.
 */
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
      g = {
        partidoId,
        set: a.set_numero,
        punto: a.punto_numero,
        lista: [],
      };
      gruposMap.set(k, g);
    }
    g.lista.push(a);
  }

  for (const g of gruposMap.values()) {
    g.lista.sort((x, y) => x.orden - y.orden);
  }

  // 2. Ordenar los puntos por (partido, set, punto).
  const puntosOrdenados = Array.from(gruposMap.values()).sort((a, b) => {
    if (a.partidoId !== b.partidoId) {
      return a.partidoId.localeCompare(b.partidoId);
    }
    if (a.set !== b.set) return a.set - b.set;
    return a.punto - b.punto;
  });

  // 3. Marcador por (partido, set) y rachas globales.
  //    Las rachas se resetean al cambiar de partido o de set.
  const marcadorPorSet = new Map<
    string,
    { propios: number; rivales: number }
  >();
  let rachaGanados = 0;
  let rachaPerdidos = 0;
  let ultimoPartido = "";
  let ultimoSet = -1;

  for (const grupo of puntosOrdenados) {
    const { lista, set, partidoId } = grupo;

    // Reset al cambiar de partido o de set.
    if (partidoId !== ultimoPartido || set !== ultimoSet) {
      const k = `${partidoId}|${set}`;
      marcadorPorSet.set(k, { propios: 0, rivales: 0 });
      rachaGanados = 0;
      rachaPerdidos = 0;
      ultimoPartido = partidoId;
      ultimoSet = set;
    }

    const setKey = `${partidoId}|${set}`;
    const marcador = marcadorPorSet.get(setKey) ?? {
      propios: 0,
      rivales: 0,
    };

    const inicioPunto = calcularInicioPunto(lista);

    // ¿Cómo terminó este punto? Para actualizar marcador y rachas.
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

    // Asignar contexto a cada acción del punto.
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

    // Actualizar marcador y rachas para el próximo punto.
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
// Duplicada chiquita para no importar el motor de consecuencias
// (evita dependencias circulares). Solo se usa acá.

function clasificarResultadoFin(a: AccionVisual): string {
  const sub = baseSubtipo(a);
  if (a.tipo === "saque") {
    if (sub === "ace") return "ace";
    if (sub === "negativo") return "error_propio";
    return "neutro";
  }
  if (a.tipo === "recepcion") {
    if (sub === "error_directo") return "ace_contra";
    if (
      sub === "negativa" ||
      sub === "doble_negativa" ||
      sub === "overpass"
    ) {
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
// ETIQUETAS
// ------------------------------------------------------------

export function etiquetaFase(f: FaseRally): string {
  const map: Record<FaseRally, string> = {
    "side-out": "Side-out",
    contraataque: "Contraataque",
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