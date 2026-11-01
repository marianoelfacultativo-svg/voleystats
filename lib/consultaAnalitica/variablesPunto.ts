// ============================================================
// VARIABLES POR PUNTO — semantic layer (capa 3)
// ============================================================
// Calcula, para CADA PUNTO del universo, un objeto plano con
// todas las variables que el motor de consultas puede usar en
// filtros y comparaciones.
//
// Estas variables son la base del lenguaje natural complejo:
//   "cuando al rival le faltan la mitad de puntos que a nosotros..."
//     → puntosParaCerrarSetRival == 0.5 * puntosParaCerrarSetPropio
//   "en sets ganados..."
//     → setGanado == true
//   "en racha de 3+ puntos..."
//     → rachaGanadosActual >= 3 OR rachaPerdidosActual >= 3
//
// REGLA DE ORO: se calcula SOBRE EL UNIVERSO COMPLETO (no sobre el
// subset filtrado). Así los filtros compuestos son consistentes
// aunque el usuario aplique varios a la vez.
//
// Depende de:
//   - lib/contextoRally.ts (v4) → puntosParaCerrarSet, esSetTerminado
//   - lib/clasificacionV2.ts → ganadorDelPunto
//   - lib/mapeoV2.ts → zonaCrudaDeCelda
// ============================================================

import type {
  AccionVisual,
  PuntoConAcciones,
} from "../../app/equipo/adaptadorUnificadoV2";
import {
  esSetTerminado,
  puntosParaCerrarSet,
  targetDelSet,
} from "../contextoRally";

// ------------------------------------------------------------
// TIPO DE SALIDA
// ------------------------------------------------------------

export interface VariablesPunto {
  // --- Identificación ---
  partidoId: string;
  setNumero: number;
  puntoNumero: number;
  clave: string; // "partido|set|punto"

  // --- Marcador al final del punto (ya con el punto sumado) ---
  puntosPropios: number;
  puntosRivales: number;
  diferencia: number; // propios - rivales (con signo)
  diferenciaAbs: number; // |propios - rivales|

  // --- Cierre del set (target correcto: 25 o 15 en tie-break) ---
  target: number; // 25 o 15
  puntosParaCerrarSetPropio: number; // cuántos le faltan a MI equipo
  puntosParaCerrarSetRival: number; // cuántos le faltan al RIVAL
  esTieBreak: boolean;
  setTerminado: boolean; // ¿el set ya terminó con este punto?

  // --- Sets (partido) ---
  setsPropios: number; // sets ganados por MI equipo hasta este set (inclusive)
  setsRivales: number;
  setsParaGanarPropio: number; // cuántos más necesita mi equipo para cerrar el partido
  setsParaGanarRival: number;
  formatoPartido: "bo3" | "bo5";

  // --- Resultado del punto ---
  ganador: "propio" | "rival" | null;
  ganoPropio: boolean; // atajo: ganador === "propio"

  // --- Rotación y fase ---
  rotacionPropia: number | null;
  rotacionRival: number | null;
  faseRally: string; // "side-out" | "k2" | "k3" | "free-ball" | "contraataque" | "otro"
  inicioPunto: string; // "ace_propio" | "recepcion_positiva" | ...

  // --- Composiciones del punto ---
  tiposPresentes: string[]; // tipos únicos de acciones visibles
  resultadosPresentes: string[]; // subtipos únicos de acciones visibles
  jugadoresPresentes: string[]; // jugador_id únicos
  cruces: number; // cambios de lado (incluye overpass)
  toquesPropios: number; // acciones propias visibles
  toquesRivales: number; // acciones rivales visibles

  // --- Rachas (al inicio del punto, no al final) ---
  rachaGanadosActual: number;
  rachaPerdidosActual: number;
}

// ------------------------------------------------------------
// HELPERS INTERNOS
// ------------------------------------------------------------

function claveDePunto(p: PuntoConAcciones): string {
  const pid =
    p.acciones.find((a) => a.partido_id)?.partido_id ?? "";
  return `${pid}|${p.set_numero}|${p.punto_numero}`;
}

function calcularGanador(
  acciones: AccionVisual[]
): "propio" | "rival" | null {
  const visibles = acciones
    .filter((a) => !a.oculta)
    .sort((x, y) => x.orden - y.orden);
  if (visibles.length === 0) return null;

  const ultima = visibles[visibles.length - 1];
  const sub = String(ultima.subtipo ?? "").toLowerCase();

  // Ataque
  if (ultima.tipo === "ataque") {
    if (
      sub === "punto" ||
      sub === "punto_directo_ataque" ||
      sub === "punto_desviado_ataque" ||
      sub === "use_rival_ataque" ||
      sub === "buena_rival"
    ) {
      return ultima.es_rival ? "rival" : "propio";
    }
    if (
      sub === "error" ||
      sub === "error_red_ataque" ||
      sub === "error_afuera_ataque" ||
      sub === "gorro_ataque" ||
      sub === "error_rival"
    ) {
      return ultima.es_rival ? "propio" : "rival";
    }
    return null;
  }

  // Saque
  if (ultima.tipo === "saque") {
    if (sub === "ace") return ultima.es_rival ? "rival" : "propio";
    if (sub === "negativo" || sub === "error_rival")
      return ultima.es_rival ? "propio" : "rival";
    return null;
  }

  // Recepción
  if (ultima.tipo === "recepcion") {
    if (sub === "error_directo" || sub === "ace_contra")
      return ultima.es_rival ? "propio" : "rival";
    return null;
  }

  // Bloqueo
  if (ultima.tipo === "bloqueo") {
    if (sub === "punto") return ultima.es_rival ? "rival" : "propio";
    if (sub === "red" || sub === "use_rival" || sub === "filtrada")
      return ultima.es_rival ? "propio" : "rival";
    return null;
  }

  // Roce de red
  if (ultima.tipo === "roce-red") {
    if (sub === "roce-red-rival") return "propio";
    if (
      sub === "ofensivo-propio" ||
      sub === "invasion-zaguero" ||
      sub === "invasion-delantero" ||
      sub === "error_rival"
    ) {
      return ultima.es_rival ? "propio" : "rival";
    }
    return null;
  }

  return null;
}

function calcularCruces(acciones: AccionVisual[]): number {
  const visibles = acciones
    .filter((a) => !a.oculta)
    .sort((x, y) => x.orden - y.orden);
  let cruces = 0;
  for (let i = 1; i < visibles.length; i++) {
    if (visibles[i].lado !== visibles[i - 1].lado) cruces += 1;
  }
  return cruces;
}

function calcularFaseSimple(acciones: AccionVisual[]): string {
  const visibles = acciones
    .filter((a) => !a.oculta)
    .sort((x, y) => x.orden - y.orden);
  if (visibles.length === 0) return "otro";

  // Primer toque propio no-bloqueo
  let primerToque: AccionVisual | null = null;
  let idx = -1;
  for (let i = 0; i < visibles.length; i++) {
    if (visibles[i].es_rival) continue;
    if (visibles[i].tipo === "bloqueo") continue;
    primerToque = visibles[i];
    idx = i;
    break;
  }
  if (!primerToque) return "otro";

  // ¿Rival mandó libre antes?
  for (let i = idx - 1; i >= 0; i--) {
    if (visibles[i].es_rival && visibles[i].tipo === "libre") {
      return "free-ball";
    }
  }

  if (primerToque.tipo === "recepcion") return "side-out";
  if (primerToque.tipo === "libre") return "side-out";
  if (primerToque.tipo === "defensa") {
    const sub = String(primerToque.subtipo ?? "");
    if (
      sub === "cobertura" ||
      sub === "cobertura_positiva" ||
      sub === "cobertura_negativa"
    ) {
      return "k3";
    }
    return "k2";
  }
  return "otro";
}

function calcularInicioPunto(acciones: AccionVisual[]): string {
  const visibles = acciones
    .filter((a) => !a.oculta)
    .sort((x, y) => x.orden - y.orden);
  const saque = visibles.find((a) => a.tipo === "saque");
  if (!saque) return "otro";
  const subSaque = String(saque.subtipo ?? "").toLowerCase();
  if (subSaque === "ace") {
    return saque.es_rival ? "ace_rival" : "ace_propio";
  }
  const recep = visibles.find((a) => a.tipo === "recepcion");
  if (!recep) {
    if (subSaque === "negativo") return "error_directo";
    return "otro";
  }
  const subRec = String(recep.subtipo ?? "").toLowerCase();
  if (subRec === "perfecta" || subRec === "positiva")
    return "recepcion_positiva";
  if (subRec === "intermedia") return "recepcion_neutra";
  if (subRec === "negativa" || subRec === "doble_negativa")
    return "recepcion_negativa";
  if (subRec === "overpass") return "overpass";
  if (subRec === "error_directo") return "error_directo";
  return "otro";
}

// ------------------------------------------------------------
// CÁLCULO PRINCIPAL
// ------------------------------------------------------------

export interface OpcionesVariablesPunto {
  formatoPartido?: "bo3" | "bo5";
  /**
   * Resultado de cada partido (para saber setsPropios / setsRivales).
   * Clave: partido_id. Valor: "ganado" | "perdido" | null.
   * Si no se pasa, setsPropios/setsRivales quedan en 0.
   */
  resultadosPartido?: Map<string, "ganado" | "perdido" | null>;
  /**
   * Resultado de cada set (para saber qué sets ganó cada equipo).
   * Clave: "partido|set". Valor: true (propio) | false (rival) | null.
   */
  resultadosSet?: Map<string, boolean | null>;
}

export function calcularVariablesPunto(
  puntos: PuntoConAcciones[],
  opciones: OpcionesVariablesPunto = {}
): Map<string, VariablesPunto> {
  const {
    formatoPartido = "bo3",
    resultadosPartido,
    resultadosSet,
  } = opciones;

  const out = new Map<string, VariablesPunto>();

  // Agrupar por (partido|set) para trackear marcador y rachas.
  const porSet = new Map<string, PuntoConAcciones[]>();
  for (const p of puntos) {
    const pid = p.acciones.find((a) => a.partido_id)?.partido_id ?? "";
    const k = `${pid}|${p.set_numero}`;
    let arr = porSet.get(k);
    if (!arr) {
      arr = [];
      porSet.set(k, arr);
    }
    arr.push(p);
  }

  // Sets ganados por partido (acumulados)
  const setsGanadosPorPartido = new Map<
    string,
    { propios: number; rivales: number }
  >();
  // Racha global (atraviesa sets del mismo partido)
  const rachaPorPartido = new Map<
    string,
    { ganados: number; perdidos: number }
  >();

  for (const [setKey, puntosDelSet] of porSet) {
    const [partidoId, setStr] = setKey.split("|");
    const setNumero = parseInt(setStr, 10);

    // Ordenar puntos del set
    const ordenados = [...puntosDelSet].sort(
      (a, b) => a.punto_numero - b.punto_numero
    );

    // Estado del marcador al inicio del set
    let marcadorPropios = 0;
    let marcadorRivales = 0;

    // Racha al inicio del set
    let rachaGanados =
      rachaPorPartido.get(partidoId)?.ganados ?? 0;
    let rachaPerdidos =
      rachaPorPartido.get(partidoId)?.perdidos ?? 0;

    // Sets ganados acumulados antes de este set
    const setsAcum = setsGanadosPorPartido.get(partidoId) ?? {
      propios: 0,
      rivales: 0,
    };
    let setsPropiosAcum = setsAcum.propios;
    let setsRivalesAcum = setsAcum.rivales;

    const target = targetDelSet(setNumero, formatoPartido);
    const esTieBreak = target === 15;

    // Resultado de ESTE set (para saber si el set terminó)
    const resultadoSet = resultadosSet?.get(`${partidoId}|${setNumero}`);

    for (const p of ordenados) {
      const clave = claveDePunto(p);
      const acciones = p.acciones;

      const ganador = calcularGanador(acciones);
      const ganoPropio = ganador === "propio";

      // Marcador ANTES de sumar este punto
      const propiosAntes = marcadorPropios;
      const rivalesAntes = marcadorRivales;

      // Avanzar marcador
      if (ganoPropio) {
        marcadorPropios += 1;
      } else if (ganador === "rival") {
        marcadorRivales += 1;
      }

      // Avanzar racha
      if (ganoPropio) {
        rachaGanados += 1;
        rachaPerdidos = 0;
      } else if (ganador === "rival") {
        rachaPerdidos += 1;
        rachaGanados = 0;
      }

      const visibles = acciones.filter((a) => !a.oculta);

      const tiposPresentes = Array.from(
        new Set(visibles.map((a) => a.tipo))
      );
      const resultadosPresentes = Array.from(
        new Set(
          visibles.map((a) => {
            const s = String(a.subtipo ?? "");
            return s.startsWith("toque:") ? s.slice(6) : s;
          })
        )
      ).filter((s) => s.length > 0);
      const jugadoresPresentes = Array.from(
        new Set(
          visibles
            .map((a) => a.jugador_id)
            .filter((id): id is string => !!id)
        )
      );

      const toquesPropios = visibles.filter((a) => !a.es_rival).length;
      const toquesRivales = visibles.filter((a) => a.es_rival).length;

      // Rotación propia: la del primer ataque propio (o la primera acción)
      const accionPropia = visibles.find((a) => !a.es_rival);
      const accionRival = visibles.find((a) => a.es_rival);

      const faseRally = calcularFaseSimple(acciones);
      const inicioPunto = calcularInicioPunto(acciones);

      // Sets para ganar el partido
      const setsParaGanar = formatoPartido === "bo3" ? 2 : 3;

      const vars: VariablesPunto = {
        partidoId,
        setNumero,
        puntoNumero: p.punto_numero,
        clave,

        puntosPropios: marcadorPropios,
        puntosRivales: marcadorRivales,
        diferencia: marcadorPropios - marcadorRivales,
        diferenciaAbs: Math.abs(marcadorPropios - marcadorRivales),

        target,
        puntosParaCerrarSetPropio: puntosParaCerrarSet(
          marcadorPropios,
          marcadorRivales,
          setNumero,
          formatoPartido
        ),
        puntosParaCerrarSetRival: puntosParaCerrarSet(
          marcadorRivales,
          marcadorPropios,
          setNumero,
          formatoPartido
        ),
        esTieBreak,
        setTerminado: esSetTerminado(
          marcadorPropios,
          marcadorRivales,
          setNumero,
          formatoPartido
        ),

        setsPropios: setsPropiosAcum,
        setsRivales: setsRivalesAcum,
        setsParaGanarPropio: Math.max(0, setsParaGanar - setsPropiosAcum),
        setsParaGanarRival: Math.max(0, setsParaGanar - setsRivalesAcum),
        formatoPartido,

        ganador,
        ganoPropio,

        rotacionPropia: accionPropia?.rotacion_numero ?? null,
        rotacionRival: accionRival?.rotacion_numero ?? null,
        faseRally,
        inicioPunto,

        tiposPresentes,
        resultadosPresentes,
        jugadoresPresentes,
        cruces: calcularCruces(acciones),
        toquesPropios,
        toquesRivales,

        // Racha al INICIO del punto (antes de sumarlo)
        rachaGanadosActual:
          ganoPropio ? rachaGanados - 1 : rachaGanados,
        rachaPerdidosActual:
          ganador === "rival" ? rachaPerdidos - 1 : rachaPerdidos,
      };

      out.set(clave, vars);

      // Silenciar variables no usadas pero disponibles para debug
      void propiosAntes;
      void rivalesAntes;
    }

    // Al terminar el set: actualizar sets acumulados si el set terminó
    if (resultadoSet !== null && resultadoSet !== undefined) {
      if (resultadoSet === true) {
        setsPropiosAcum += 1;
      } else {
        setsRivalesAcum += 1;
      }
      setsGanadosPorPartido.set(partidoId, {
        propios: setsPropiosAcum,
        rivales: setsRivalesAcum,
      });
    }

    // Actualizar racha al final del set
    rachaPorPartido.set(partidoId, {
      ganados: rachaGanados,
      perdidos: rachaPerdidos,
    });
  }

  return out;
}

// ------------------------------------------------------------
// HELPERS DE CONSULTA
// ------------------------------------------------------------

/**
 * Devuelve el valor de una variable para un punto, o `null` si
 * no existe.
 */
export function leerVariable(
  vars: VariablesPunto | undefined,
  path: string
): number | string | boolean | null {
  if (!vars) return null;
  const partes = path.split(".");
  let cur: unknown = vars;
  for (const p of partes) {
    if (cur === null || cur === undefined) return null;
    if (typeof cur !== "object") return null;
    cur = (cur as Record<string, unknown>)[p];
  }
  if (typeof cur === "number") return cur;
  if (typeof cur === "string") return cur;
  if (typeof cur === "boolean") return cur;
  return null;
}

/**
 * Filtra un Map de VariablesPunto por una condición arbitraria.
 * Devuelve las claves que cumplen.
 */
export function filtrarPuntos(
  variables: Map<string, VariablesPunto>,
  predicado: (v: VariablesPunto) => boolean
): Set<string> {
  const out = new Set<string>();
  for (const [k, v] of variables) {
    if (predicado(v)) out.add(k);
  }
  return out;
}