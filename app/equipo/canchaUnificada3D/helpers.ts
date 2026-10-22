// ============================================================
// HELPERS PUROS — CanchaUnificada3D
// Funciones sin React, sin estado. Solo transformación de datos
// y cálculo de trayectorias/alturas.
// ============================================================

import * as THREE from "three";
import type { AccionVisual } from "../adaptadorUnificadoV2";

// ============================================================
// TIPOS
// ============================================================

export type Vista =
  | "top"
  | "front"
  | "front-rival"
  | "iso"
  | "iso-opuesta"
  | "iso-izq"
  | "iso-der"
  | "paralela-izq"
  | "paralela-der";

export interface PuntoConAcciones {
  set_numero: number;
  punto_numero: number;
  acciones: AccionVisual[];
}

// ============================================================
// CONFIGURACIÓN
// ============================================================

export const COL_X: Record<string, [number, number]> = {
  C1: [0, 2],
  C2: [2, 5],
  C3: [5, 8],
  C4: [8, 11],
  C5: [11, 13],
};

export const FILA_Z: Record<string, [number, number]> = {
  F1: [0, 3],
  F2: [3, 6],
  F3: [6, 9],
  F4: [-3, 0],
  F5: [-6, -3],
  F6: [-9, -6],
};

export const ALTURA_RED = 2.43;
export const ALTURA_BANDA_INFERIOR = 1.43;
export const ALTURA_TOP_ARMADO = 2.7;
export const ALTURA_DESTINO_MEDIA = 2.65;
export const ALTURA_ORIGEN_ARMADO = 2.35;
export const VARIANZA_GENERAL = 0.24;

export const RED_X_MIN = 2;
export const RED_X_MAX = 11;

// Segundos que dura cada acción en el modo "punto completo".
// Si el usuario lo siente muy rápido, subir este número.
export const SEGUNDOS_POR_ACCION = 2.2;

// Distancia máxima del sistema (FUERA-ARR-C1 a FUERA-ABA-C5):
//   |dx| = 12 - 1 = 11 (centros extremos de C1..C5)
//   |dz| = 10.5 - (-10.5) = 21
//   diagonal = sqrt(11² + 21²) ≈ 23.71 m
// Se usa para normalizar el apex de las acciones "libre".
const DISTANCIA_MAXIMA_LIBRE = 23.71;
const APEX_LIBRE_MIN = 3.0; // 300 cm
const APEX_LIBRE_MAX = 9.0; // 900 cm

// Altura mínima para pasar la red (red + 10 cm).
const ALTURA_MIN_RED_CRUCE = ALTURA_RED + 0.1; // 2.53

// ============================================================
// HELPERS DE COORDENADAS
// ============================================================

function servicioPos(s: string): { x: number; z: number } | null {
  const m = s.match(/^S(\d)$/);
  if (!m) return null;
  const idx = parseInt(m[1]);
  if (idx < 1 || idx > 9) return null;
  const x = 2 + (idx - 1) * (9 / 8);
  return { x, z: 9.5 };
}

function destinoSaquePos(d: string): { x: number; z: number } | null {
  const m = d.match(/^D(\d)$/);
  if (!m) return null;
  const idx = parseInt(m[1]);
  if (idx < 1 || idx > 9) return null;
  const x = 2 + (idx - 1) * (9 / 8);
  return { x, z: -1.5 };
}

export function obtenerCoords(
  celda: string | null,
  mini: string | null
): { x: number; z: number } | null {
  if (!celda) return null;
  if (celda.startsWith("S")) return servicioPos(celda);
  if (celda.startsWith("D")) return destinoSaquePos(celda);

  if (celda.startsWith("BLOQ-P-") || celda.startsWith("BLOQ-R-")) {
    const col = celda.split("-")[2] || "C3";
    const rangoX = COL_X[col];
    if (!rangoX) return null;
    const z = celda.startsWith("BLOQ-P-") ? 0.3 : -0.3;
    return { x: (rangoX[0] + rangoX[1]) / 2, z };
  }

  if (celda.startsWith("RED-")) {
    const col = celda.split("-")[1] || "C3";
    const rangoX = COL_X[col];
    if (!rangoX) return null;
    return { x: (rangoX[0] + rangoX[1]) / 2, z: 0 };
  }

  if (celda.startsWith("FUERA-ARR-") || celda.startsWith("FUERA-ABA-")) {
    const col = celda.split("-")[2] || "C3";
    const rangoX = COL_X[col];
    if (!rangoX) return null;
    const z = celda.startsWith("FUERA-ARR-") ? -10.5 : 10.5;
    return { x: (rangoX[0] + rangoX[1]) / 2, z };
  }

  const partes = celda.split("-");
  if (partes.length !== 2) return null;
  const [fila, col] = partes;
  const rangoX = COL_X[col];
  const rangoZ = FILA_Z[fila];
  if (!rangoX || !rangoZ) return null;

  if (!mini) {
    return {
      x: (rangoX[0] + rangoX[1]) / 2,
      z: (rangoZ[0] + rangoZ[1]) / 2,
    };
  }

  const match = mini.match(/^f(\d)c(\d)$/);
  if (!match) {
    const m2 = mini.match(/^m(\d+)-(\d+)$/);
    if (m2) {
      const fil = parseInt(m2[1]);
      const col2 = parseInt(m2[2]);
      const numCols = col === "C1" || col === "C5" ? 2 : 3;
      const numFils = 3;
      const f = Math.min(numFils, Math.max(1, Math.ceil((fil / 9) * numFils)));
      const c = Math.min(numCols, Math.max(1, Math.ceil((col2 / 9) * numCols)));
      const mf = f - 1;
      const mc = c - 1;
      const anchoCelda = (rangoX[1] - rangoX[0]) / numCols;
      const altoCelda = (rangoZ[1] - rangoZ[0]) / numFils;
      const esRival = parseInt(fila.slice(1)) >= 4;
      const mfFinal = esRival ? numFils - 1 - mf : mf;
      return {
        x: rangoX[0] + (mc + 0.5) * anchoCelda,
        z: rangoZ[0] + (mfFinal + 0.5) * altoCelda,
      };
    }
    return null;
  }

  const mf = parseInt(match[1]) - 1;
  const mc = parseInt(match[2]) - 1;

  const numCols = col === "C1" || col === "C5" ? 2 : 3;
  const numFils = 3;
  const anchoCelda = (rangoX[1] - rangoX[0]) / numCols;
  const altoCelda = (rangoZ[1] - rangoZ[0]) / numFils;

  const esRival = parseInt(fila.slice(1)) >= 4;
  const mfFinal = esRival ? numFils - 1 - mf : mf;

  return {
    x: rangoX[0] + (mc + 0.5) * anchoCelda,
    z: rangoZ[0] + (mfFinal + 0.5) * altoCelda,
  };
}

export function ladoDeCelda(celda: string | null): "propio" | "rival" | null {
  if (!celda) return null;
  if (/^F[123]-/.test(celda)) return "propio";
  if (/^F[456]-/.test(celda)) return "rival";
  if (celda.startsWith("BLOQ-P-")) return "propio";
  if (celda.startsWith("BLOQ-R-")) return "rival";
  if (celda.startsWith("FUERA-ARR-")) return "rival";
  if (celda.startsWith("FUERA-ABA-")) return "propio";
  return null;
}

export function esCeldaEnRed(celda: string | null | undefined): boolean {
  if (!celda) return false;
  return celda.startsWith("RED-") || celda.startsWith("BLOQ-");
}

function hashSeed(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) + h + str.charCodeAt(i);
    h = h & h;
  }
  return Math.abs(h);
}

function prand(seed: string, key: string): number {
  const h = hashSeed(seed + key);
  return (h % 100000) / 100000;
}

// ============================================================
// ALTURA DEL PUNTO DE CONTACTO DEL REMATE
// ============================================================
//
// La altura del remate depende de la calidad del armado previo (1-6).
// Se sortea de forma determinística por acción (mismo id → misma altura
// entre re-renders), pero el valor es 100% aleatorio dentro del rango.
//
// Rangos (en metros, al centro de la pelota):
//   5-6 (genial/perfecto) → 2.75 – 2.85
//   4   (correcto)        → 2.55 – 2.70
//   3   (flojo)           → 2.50 – 2.55
//   2   (malo)            → 2.50 – 2.55
//   1   (horrible)        → 2.00 – 2.35
//   sin armado previo     → 2.80 fijo
//
function rangoAlturaRemate(
  calidad: number | null | undefined
): { min: number; max: number } | null {
  if (calidad === null || calidad === undefined) return null;
  if (calidad >= 5) return { min: 2.75, max: 2.85 };
  if (calidad === 4) return { min: 2.55, max: 2.7 };
  if (calidad === 3) return { min: 2.5, max: 2.55 };
  if (calidad === 2) return { min: 2.5, max: 2.55 };
  if (calidad === 1) return { min: 2.0, max: 2.35 };
  return null;
}

function alturaRemate(a: AccionVisual): number {
  const rango = rangoAlturaRemate(a.calidad_armado_previo);
  if (!rango) return 2.8;
  const r = prand(a.id, "-altura-remate");
  return rango.min + r * (rango.max - rango.min);
}

// ============================================================
// RANGO DE APEX DEL ARMADO SEGÚN VELOCIDAD
// ============================================================
//
// La velocidad del armado define el apex del arco:
//   1   → 2.75 fijo
//   1.5 → 3.00 – 3.15
//   2   → 3.40 – 3.80
//   3   → 4.00 – 5.00
//   5   → 7.00 – 9.00
//
// Dentro del rango, cuanto más lejos va la pelota, más alto el apex
// (normalizado contra ~9 m de recorrido).
//
function rangoAlturaVelocidad(v: number): { min: number; max: number } | null {
  if (v === 1) return { min: 2.75, max: 2.75 };
  if (v === 1.5) return { min: 3.0, max: 3.15 };
  if (v === 2) return { min: 3.4, max: 3.8 };
  if (v === 3) return { min: 4.0, max: 5.0 };
  if (v === 5) return { min: 7.0, max: 9.0 };
  return null;
}

// ============================================================
// ALTURAS POR TIPO
// ============================================================

export function hOrigenPorTipo(a: AccionVisual): number {
  switch (a.tipo) {
    case "saque":
      return 2.8;
    case "recepcion":
      return 0.3;
    case "armado":
      return ALTURA_ORIGEN_ARMADO;
    case "ataque":
      return alturaRemate(a);
    case "bloqueo":
      return 2.6;
    case "defensa":
      return 0.3;
    case "libre":
      return 1.5;
    case "roce-red":
      return ALTURA_RED;
    default:
      return 1.5;
  }
}

function hDestinoDefaultPorTipo(a: AccionVisual): number {
  switch (a.tipo) {
    case "saque":
      return 0.5;
    case "recepcion":
      return 2.0;
    case "armado":
      return 2.0;
    case "ataque":
      return 0.5;
    case "bloqueo":
      return 0.3;
    case "defensa":
      return 2.0;
    case "libre":
      return 1.5;
    case "roce-red":
      return ALTURA_RED;
    default:
      return 1.0;
  }
}

function alturaDeCeldaEspecial(celda: string | null | undefined): number {
  if (!celda) return 1.5;
  if (celda.startsWith("RED-")) return ALTURA_RED;
  if (celda.startsWith("BLOQ-")) return 2.6;
  if (celda.startsWith("FUERA-ARR-") || celda.startsWith("FUERA-ABA-"))
    return 0.5;
  return 1.5;
}

// ============================================================
// PARÁBOLA / CATMULLROM
// ============================================================

function parabolaSegmento(
  w1: { x: number; z: number; h: number },
  w2: { x: number; z: number; h: number },
  apexExtra: number,
  curvatura: number = 1,
  pasos: number = 30
): [number, number, number][] {
  const dx = w2.x - w1.x;
  const dz = w2.z - w1.z;
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= pasos; i++) {
    const t = i / pasos;
    const x = w1.x + t * dx;
    const z = w1.z + t * dz;
    const hBase = w1.h + t * (w2.h - w1.h);
    const arco = Math.pow(4 * t * (1 - t), curvatura);
    const h = hBase + arco * apexExtra;
    pts.push([x, Math.max(0, h), z]);
  }
  return pts;
}

function catmullRom3(
  points: [number, number, number][],
  pasos: number = 24
): [number, number, number][] {
  if (points.length < 2) return points;
  if (points.length === 2) {
    const [a, b] = points;
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= pasos; i++) {
      const t = i / pasos;
      pts.push([
        a[0] + t * (b[0] - a[0]),
        a[1] + t * (b[1] - a[1]),
        a[2] + t * (b[2] - a[2]),
      ]);
    }
    return pts;
  }
  const vecs = points.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const curve = new THREE.CatmullRomCurve3(vecs, false, "catmullrom", 0.5);
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= pasos; i++) {
    const v = curve.getPoint(i / pasos);
    pts.push([v.x, v.y, v.z]);
  }
  return pts;
}

// ============================================================
// ARMADOS — LÓGICA ESPECIAL (calidad, varilla, velocidad)
// ============================================================

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

function esColumnaExterior(
  celda: string,
  mini: string | null,
  zona: number | null
): boolean {
  if (!mini || zona === null) return false;
  const match = mini.match(/^f(\d)c(\d)$/);
  if (!match) return false;
  const miniCol = parseInt(match[2]);
  if (zona === 4 && miniCol === 1) return true;
  if ((zona === 2 || zona === 1) && miniCol === 3) return true;
  return false;
}

function generarPuntosArmado(
  a: AccionVisual,
  hDestinoOverride?: number
): [number, number, number][] {
  const origen = obtenerCoords(a.origen_celda, a.origen_mini);
  const destinoBase = obtenerCoords(a.destino_celda, a.destino_mini);
  if (!origen || !destinoBase) return [];

  const calidad =
    typeof a.subtipo === "number"
      ? a.subtipo
      : parseInt(String(a.subtipo ?? "3"), 10) || 3;

  const zonaTendencia = calcularZonaTendencia(a.destino_celda);
  const seed = a.id;

  const rx = prand(seed, "-varx");
  const rz = prand(seed, "-varz");
  const ry = prand(seed, "-vary");

  const pegadaVarilla =
    calidad >= 5 &&
    esColumnaExterior(
      a.destino_celda ?? "",
      a.destino_mini,
      zonaTendencia
    );

  let destino: { x: number; z: number };
  let hDestino: number;

  if (pegadaVarilla) {
    const distVarilla = 0.1 + rx * 0.2;
    let zVar: number;
    if ((a.destino_celda ?? "").startsWith("F1")) zVar = 0.1 + rz * 1.1;
    else if ((a.destino_celda ?? "").startsWith("F2"))
      zVar = 3.1 + rz * 2.7;
    else zVar = 6.1 + rz * 2.7;

    if (zonaTendencia === 4) {
      destino = { x: 2 + distVarilla, z: zVar };
    } else {
      destino = { x: 11 - distVarilla, z: zVar };
    }
    hDestino = ALTURA_TOP_ARMADO;
  } else {
    destino = {
      x: destinoBase.x + (rx - 0.5) * VARIANZA_GENERAL,
      z: destinoBase.z + (rz - 0.5) * VARIANZA_GENERAL,
    };
    hDestino = ALTURA_DESTINO_MEDIA + (ry - 0.5) * VARIANZA_GENERAL;
  }

  // En modo punto-completo, el armado termina a la altura del punto de
  // contacto del siguiente ataque (para que la pelota no caiga al piso).
  if (hDestinoOverride !== undefined) {
    hDestino = hDestinoOverride;
  }

  const distancia = Math.sqrt(
    (destino.x - origen.x) ** 2 + (destino.z - origen.z) ** 2
  );
  const [fila] = (a.origen_celda ?? "F3").split("-");
  const rApex = prand(seed, "-apex");

  // Apex según velocidad (si está definida) o según calidad (fallback).
  let apex: number;
  const rangoVel =
    a.velocidad !== null && a.velocidad !== undefined
      ? rangoAlturaVelocidad(a.velocidad)
      : null;

  if (rangoVel) {
    const distNorm = Math.min(1, distancia / 9);
    apex = rangoVel.min + distNorm * (rangoVel.max - rangoVel.min);
  } else {
    if (calidad >= 5) apex = ALTURA_TOP_ARMADO;
    else if (distancia > 5) apex = 4.5 + rApex * 0.5;
    else if (fila === "F3") apex = 4.5 + rApex * 0.5;
    else if (fila === "F1" && a.origen_mini?.startsWith("f1")) {
      if (calidad === 1 || calidad === 2) apex = 2.4;
      else if (calidad === 3) {
        if (a.origen_celda === "F1-C3" && a.origen_mini === "f1c1")
          apex = 3.5;
        else if (a.origen_celda === "F1-C2" || a.origen_celda === "F1-C4")
          apex = 2.55;
        else apex = 2.4;
      } else apex = 3.0 + rApex * 0.5;
    } else if (fila === "F1") {
      if (calidad === 1 || calidad === 2) apex = 2.4;
      else if (calidad === 3) apex = 2.55;
      else apex = 3.0 + rApex * 0.5;
    } else if (calidad >= 4) apex = 3.5 + rApex * 1.0;
    else apex = 2.4;

    if (apex > ALTURA_TOP_ARMADO) apex = apex * 0.85;
    apex = apex * 1.05;
    if (apex <= 2.75) apex += 0.55;
    if (calidad >= 5 && apex < ALTURA_RED) apex = ALTURA_RED + 0.3;
  }

  const hOrigen = ALTURA_ORIGEN_ARMADO;
  const pasos = 40;
  const pts: [number, number, number][] = [];

  // Si el apex queda por debajo del destino (altura del ataque), la
  // pelota no puede bajar: se dibuja solo la mitad ascendente del arco
  // (ease-out) hasta el punto de contacto.
  if (hDestinoOverride !== undefined && apex < hDestino) {
    for (let i = 0; i <= pasos; i++) {
      const t = i / pasos;
      const x = origen.x + t * (destino.x - origen.x);
      const z = origen.z + t * (destino.z - origen.z);
      const p = 1 - Math.pow(1 - t, 1.6);
      const h = hOrigen + p * (hDestino - hOrigen);
      pts.push([x, Math.max(0.05, h), z]);
    }
    return pts;
  }

  for (let i = 0; i <= pasos; i++) {
    const t = i / pasos;
    const x = origen.x + t * (destino.x - origen.x);
    const z = origen.z + t * (destino.z - origen.z);
    const hBase = hOrigen + t * (hDestino - hOrigen);
    let altura =
      hBase + 4 * t * (1 - t) * (apex - (hOrigen + hDestino) / 2);
    if (calidad >= 5 && !rangoVel && altura < ALTURA_RED && t > 0.4) {
      altura = ALTURA_RED;
    }
    pts.push([x, Math.max(0.05, altura), z]);
  }
  return pts;
}

// ============================================================
// ATAQUE / TOQUE — MEDIO ARCO DESCENDENTE
// ============================================================
//
// Ataque y toque se dibujan como un medio arco descendente:
//
// - Si el punto de contacto (h0) está por encima de 2.53 (red + 10 cm),
//   la pelota baja desde el origen hasta el destino.
//
// - Si el punto de contacto queda por debajo de 2.53, la pelota sube
//   a 2.53 al cruzar la red y después baja al destino.
//
// - Excepción: si el destino es la red misma (RED-*) o el ataque no
//   cruza la red, no se fuerza la altura de red.
//
// El tramo descendente usa un exponente distinto para cada variante:
//   - Ataque (p = 0.7): caída rápida al principio, achatada al final
//     → visualmente "caída más horizontal".
//   - Toque (p = 1.8): se mantiene alto al principio, cae empinado
//     al final → visualmente "caída más vertical".
//
function generarPuntosAtaque(
  a: AccionVisual,
  hDestinoOverride?: number
): [number, number, number][] {
  const origen = obtenerCoords(a.origen_celda, a.origen_mini);
  const destino = obtenerCoords(a.destino_celda, a.destino_mini);
  if (!origen || !destino) return [];

  const h0 = hOrigenPorTipo(a);
  const hT =
    hDestinoOverride !== undefined
      ? hDestinoOverride
      : a.es_ultima_del_punto
      ? 0
      : hDestinoDefaultPorTipo(a);

  const esToque = a.variante === "toque";
  const destinoEnRed = (a.destino_celda ?? "").startsWith("RED-");

  const ladoO = ladoDeCelda(a.origen_celda);
  const ladoD = ladoDeCelda(a.destino_celda);
  const cruzaRed = ladoO !== null && ladoD !== null && ladoO !== ladoD;

  const pDesc = esToque ? 1.8 : 0.7;
  const pAsc = 1.2;

  // Caso 1: destino en la red, o no cruza la red → arco simple descendente.
  if (destinoEnRed || !cruzaRed) {
    const pts: [number, number, number][] = [];
    const pasos = 40;
    for (let i = 0; i <= pasos; i++) {
      const t = i / pasos;
      const x = origen.x + t * (destino.x - origen.x);
      const z = origen.z + t * (destino.z - origen.z);
      const h = h0 - (h0 - hT) * Math.pow(t, pDesc);
      pts.push([x, Math.max(0.05, h), z]);
    }
    return pts;
  }

  // Caso 2: cruza la red → 2 tramos para respetar el mínimo en la red.
  const dz = destino.z - origen.z;
  const tRed = dz !== 0 ? Math.abs(origen.z) / Math.abs(dz) : 0.5;
  const xRed = origen.x + tRed * (destino.x - origen.x);

  const pasos = 50;
  const pasosAsc = Math.max(4, Math.round(pasos * tRed));
  const pasosDesc = Math.max(4, pasos - pasosAsc);

  const pts: [number, number, number][] = [];

  if (h0 >= ALTURA_MIN_RED_CRUCE) {
    // Tramo 1: origen → red, baja de h0 a 2.53.
    for (let i = 0; i <= pasosAsc; i++) {
      const t = i / pasosAsc;
      const x = origen.x + t * (xRed - origen.x);
      const z = origen.z + t * (0 - origen.z);
      const h =
        h0 - (h0 - ALTURA_MIN_RED_CRUCE) * Math.pow(t, pAsc);
      pts.push([x, Math.max(0.05, h), z]);
    }
    // Tramo 2: red → destino, baja de 2.53 a hT.
    for (let i = 1; i <= pasosDesc; i++) {
      const t = i / pasosDesc;
      const x = xRed + t * (destino.x - xRed);
      const z = 0 + t * (destino.z - 0);
      const h =
        ALTURA_MIN_RED_CRUCE -
        (ALTURA_MIN_RED_CRUCE - hT) * Math.pow(t, pDesc);
      pts.push([x, Math.max(0.05, h), z]);
    }
    return pts;
  }

  // h0 < 2.53: sube a 2.53 en la red y después baja al destino.
  // Tramo 1: origen → red (ascendente lineal).
  for (let i = 0; i <= pasosAsc; i++) {
    const t = i / pasosAsc;
    const x = origen.x + t * (xRed - origen.x);
    const z = origen.z + t * (0 - origen.z);
    const h = h0 + t * (ALTURA_MIN_RED_CRUCE - h0);
    pts.push([x, Math.max(0.05, h), z]);
  }
  // Tramo 2: red → destino (descendente con pDesc).
  for (let i = 1; i <= pasosDesc; i++) {
    const t = i / pasosDesc;
    const x = xRed + t * (destino.x - xRed);
    const z = 0 + t * (destino.z - 0);
    const h =
      ALTURA_MIN_RED_CRUCE -
      (ALTURA_MIN_RED_CRUCE - hT) * Math.pow(t, pDesc);
    pts.push([x, Math.max(0.05, h), z]);
  }
  return pts;
}

// ============================================================
// TRAYECTORIA GENERAL
// ============================================================

/**
 * Apex "extra" por tipo de acción (se suma a la altura base de la
 * parábola). Para "libre" se calcula aparte (ver accionAPuntos) usando
 * la distancia real recorrida entre origen y destino.
 */
function calcularApexExtra(a: AccionVisual, cruzaRed: boolean): number {
  const esToque = a.tipo === "ataque" && a.variante === "toque";

  if (a.tipo === "libre") {
    // Fallback: si la libre tiene desvíos (no es un tramo simple), se
    // usa un valor fijo según cruce de red. El caso "sin desvíos" tiene
    // su propio cálculo de apex absoluto en accionAPuntos.
    return cruzaRed ? 4.2 : 3.6;
  }
  if (esToque) {
    return cruzaRed ? 0.2 : 0.3;
  }
  if (a.tipo === "saque") return 0.4;
  if (a.tipo === "ataque") return 0.4;
  return 0.4;
}

function calcularCurvatura(a: AccionVisual): number {
  if (a.tipo === "libre") return 1.8;
  return 1;
}

/**
 * Apex absoluto de una acción "libre" (sin desvíos) según su recorrido.
 *
 * - Recorrido mínimo → APEX_LIBRE_MIN (3 m).
 * - Recorrido máximo (≈ 23.71 m, de FUERA-ARR-C1 a FUERA-ABA-C5)
 *   → APEX_LIBRE_MAX (9 m).
 *
 * Se normaliza de forma lineal contra la distancia máxima del sistema.
 */
function apexLibreAbsoluto(
  origen: { x: number; z: number },
  destino: { x: number; z: number }
): number {
  const dx = destino.x - origen.x;
  const dz = destino.z - origen.z;
  const distancia = Math.sqrt(dx * dx + dz * dz);
  const distNorm = Math.min(1, distancia / DISTANCIA_MAXIMA_LIBRE);
  return APEX_LIBRE_MIN + distNorm * (APEX_LIBRE_MAX - APEX_LIBRE_MIN);
}

export function accionAPuntos(
  a: AccionVisual,
  hDestinoOverride?: number
): [number, number, number][] {
  // El armado siempre se dibuja con su lógica especial (calidad +
  // velocidad + regla de no bajar). Si hay override, lo usamos como
  // altura del destino (modo punto-completo).
  if (a.tipo === "armado") {
    return generarPuntosArmado(a, hDestinoOverride);
  }

  // El ataque / toque se dibuja con su lógica especial (2 tramos si
  // cruza la red, exponente distinto para remate vs toque).
  if (a.tipo === "ataque") {
    return generarPuntosAtaque(a, hDestinoOverride);
  }

  const origen = obtenerCoords(a.origen_celda, a.origen_mini);
  const destino = obtenerCoords(a.destino_celda, a.destino_mini);
  if (!origen || !destino) return [];

  const h0 = hOrigenPorTipo(a);
  const hT =
    hDestinoOverride !== undefined
      ? hDestinoOverride
      : a.es_ultima_del_punto
      ? 0
      : hDestinoDefaultPorTipo(a);

  const ladoO = ladoDeCelda(a.origen_celda);
  const ladoD = ladoDeCelda(a.destino_celda);
  const cruzaRed = ladoO !== null && ladoD !== null && ladoO !== ladoD;

  // ---- Cálculo del apexExtra ----
  // Para "libre" sin desvíos: apex absoluto depende del recorrido.
  // Para el resto (o libres con desvíos): regla por tipo.
  const desviosArr = a.desvios ?? [];
  let apexExtra: number;
  if (a.tipo === "libre" && desviosArr.length === 0) {
    const apexAbs = apexLibreAbsoluto(origen, destino);
    // parabolaSegmento aplica: h = hBase + arco * apexExtra
    // con arco máx = 1 en t=0.5 y hBase en t=0.5 = (h0 + hT) / 2.
    // Entonces el apex final = (h0 + hT) / 2 + apexExtra.
    // Para que apex final = apexAbs: apexExtra = apexAbs - (h0+hT)/2.
    apexExtra = Math.max(0, apexAbs - (h0 + hT) / 2);
  } else {
    apexExtra = calcularApexExtra(a, cruzaRed);
  }

  const curvatura = calcularCurvatura(a);

  const waypoints: {
    x: number;
    z: number;
    h: number;
    celda: string | null;
  }[] = [
    {
      x: origen.x,
      z: origen.z,
      h: h0,
      celda: a.origen_celda,
    },
  ];

  for (const d of desviosArr) {
    const dc = obtenerCoords(d.celda, d.mini);
    if (!dc) continue;
    waypoints.push({
      x: dc.x,
      z: dc.z,
      h: alturaDeCeldaEspecial(d.celda),
      celda: d.celda,
    });
  }

  waypoints.push({
    x: destino.x,
    z: destino.z,
    h: hT,
    celda: a.destino_celda,
  });

  const pts: [number, number, number][] = [];

  for (let i = 0; i < waypoints.length - 1; i++) {
    const w1 = waypoints[i];
    const w2 = waypoints[i + 1];

    const ladoW1 = ladoDeCelda(w1.celda);
    const ladoW2 = ladoDeCelda(w2.celda);
    const subCross =
      ladoW1 !== null && ladoW2 !== null && ladoW1 !== ladoW2;

    let segPts: [number, number, number][];

    if (subCross && !esCeldaEnRed(w1.celda) && !esCeldaEnRed(w2.celda)) {
      const dz = w2.z - w1.z;
      const tRed = dz !== 0 ? Math.abs(w1.z) / Math.abs(dz) : 0.5;
      const xRed = w1.x + tRed * (w2.x - w1.x);
      segPts = catmullRom3(
        [
          [w1.x, w1.h, w1.z],
          [xRed, ALTURA_RED + 0.1, 0],
          [w2.x, w2.h, w2.z],
        ],
        20
      );
    } else {
      segPts = parabolaSegmento(w1, w2, apexExtra, curvatura, 20);
    }

    if (i > 0 && segPts.length > 0) segPts.shift();
    pts.push(...segPts);
  }

  return pts;
}