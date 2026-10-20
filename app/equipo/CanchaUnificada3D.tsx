"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

import type { AccionVisual } from "./adaptadorUnificadoV2";
import { colorPorTipo } from "./adaptadorUnificadoV2";

// ============================================================
// TIPOS
// ============================================================

export type ModoUnificado = "fundamento" | "armados" | "punto-completo";

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

interface Props {
  modo: ModoUnificado;
  acciones: AccionVisual[];
  puntos?: PuntoConAcciones[];
  puntoSeleccionado?: { set: number; punto: number } | null;
  vista?: Vista;
  width?: number;
  height?: number;
  mostrarEstelas?: boolean;
  velocidadAnimacion?: number;
}

// ============================================================
// CONFIGURACIÓN
// ============================================================

const COL_X: Record<string, [number, number]> = {
  C1: [0, 2],
  C2: [2, 5],
  C3: [5, 8],
  C4: [8, 11],
  C5: [11, 13],
};

const FILA_Z: Record<string, [number, number]> = {
  F1: [0, 3],
  F2: [3, 6],
  F3: [6, 9],
  F4: [-3, 0],
  F5: [-6, -3],
  F6: [-9, -6],
};

const ALTURA_RED = 2.43;
const ALTURA_TOP_ARMADO = 2.7;
const ALTURA_DESTINO_MEDIA = 2.65;
const ALTURA_ORIGEN_ARMADO = 2.35;
const VARIANZA_GENERAL = 0.24;

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

function obtenerCoords(
  celda: string | null,
  mini: string | null
): { x: number; z: number } | null {
  if (!celda) return null;
  if (celda.startsWith("S")) return servicioPos(celda);
  if (celda.startsWith("D")) return destinoSaquePos(celda);

  // Bloqueos: usan C1..C5 y una z pegada a la red
  if (celda.startsWith("BLOQ-P-") || celda.startsWith("BLOQ-R-")) {
    const col = celda.split("-")[2] || "C3";
    const rangoX = COL_X[col];
    if (!rangoX) return null;
    const z = celda.startsWith("BLOQ-P-") ? 0.3 : -0.3;
    return { x: (rangoX[0] + rangoX[1]) / 2, z };
  }

  // Red
  if (celda.startsWith("RED-")) {
    const col = celda.split("-")[1] || "C3";
    const rangoX = COL_X[col];
    if (!rangoX) return null;
    return { x: (rangoX[0] + rangoX[1]) / 2, z: 0 };
  }

  // Fuera
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
// HELPERS DE ARMADO
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

// ============================================================
// GENERADORES DE TRAYECTORIA
// ============================================================

function generarPuntosArmado(a: AccionVisual): [number, number, number][] {
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

  const distancia = Math.sqrt(
    (destino.x - origen.x) ** 2 + (destino.z - origen.z) ** 2
  );
  const [fila] = (a.origen_celda ?? "F3").split("-");
  const rApex = prand(seed, "-apex");

  let apex: number;
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

  const hOrigen = ALTURA_ORIGEN_ARMADO;
  const pasos = 40;
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= pasos; i++) {
    const t = i / pasos;
    const x = origen.x + t * (destino.x - origen.x);
    const z = origen.z + t * (destino.z - origen.z);
    const hBase = hOrigen + t * (hDestino - hOrigen);
    let altura =
      hBase + 4 * t * (1 - t) * (apex - (hOrigen + hDestino) / 2);
    if (calidad >= 5 && altura < ALTURA_RED && t > 0.4) {
      altura = ALTURA_RED;
    }
    pts.push([x, Math.max(0.05, altura), z]);
  }
  return pts;
}

function alturaPorTipo(a: AccionVisual): {
  hOrigen: number;
  hDestino: number;
  apexExtra: number;
} {
  if (a.tipo === "saque") return { hOrigen: 2.8, hDestino: 0, apexExtra: 1.2 };
  if (a.tipo === "ataque")
    return { hOrigen: 2.8, hDestino: 0, apexExtra: 0.4 };
  if (a.tipo === "recepcion")
    return { hOrigen: 0.3, hDestino: 2.2, apexExtra: 0.6 };
  if (a.tipo === "bloqueo")
    return { hOrigen: 2.6, hDestino: 0, apexExtra: 0.3 };
  if (a.tipo === "defensa")
    return { hOrigen: 0.3, hDestino: 2.0, apexExtra: 0.5 };
  if (a.tipo === "libre")
    return { hOrigen: 1.5, hDestino: 1.5, apexExtra: 0.4 };
  if (a.tipo === "roce-red")
    return { hOrigen: 2.4, hDestino: 2.4, apexExtra: 0.2 };
  return { hOrigen: 0.5, hDestino: 0.5, apexExtra: 0.5 };
}

function generarPuntosGenerales(
  a: AccionVisual
): [number, number, number][] {
  const origen = obtenerCoords(a.origen_celda, a.origen_mini);
  const destino = obtenerCoords(a.destino_celda, a.destino_mini);
  if (!origen || !destino) return [];

  const { hOrigen, hDestino, apexExtra } = alturaPorTipo(a);

  const rx1 = prand(a.id, "-ox");
  const rz1 = prand(a.id, "-oz");
  const rx2 = prand(a.id, "-dx");
  const rz2 = prand(a.id, "-dz");

  const origenR = {
    x: origen.x + (rx1 - 0.5) * 0.4,
    z: origen.z + (rz1 - 0.5) * 0.4,
  };
  const destinoR = {
    x: destino.x + (rx2 - 0.5) * 0.4,
    z: destino.z + (rz2 - 0.5) * 0.4,
  };

  // Waypoints: origen → desvios → destino
  const waypoints: { x: number; z: number; h: number }[] = [
    { x: origenR.x, z: origenR.z, h: hOrigen },
  ];

  for (const d of a.desvios ?? []) {
    const dc = obtenerCoords(d.celda, d.mini);
    if (!dc) continue;
    let hD = 1.5;
    if (d.celda.startsWith("BLOQ-")) hD = 2.8;
    else if (d.celda.startsWith("RED-")) hD = ALTURA_RED;
    waypoints.push({ x: dc.x, z: dc.z, h: hD });
  }

  waypoints.push({ x: destinoR.x, z: destinoR.z, h: hDestino });

  const nSeg = waypoints.length - 1;
  const pasosPorSeg = Math.max(12, Math.floor(40 / nSeg));
  const pts: [number, number, number][] = [];

  for (let i = 0; i < nSeg; i++) {
    const w1 = waypoints[i];
    const w2 = waypoints[i + 1];
    const inicio = i === 0 ? 0 : 1;
    for (let s = inicio; s <= pasosPorSeg; s++) {
      const t = s / pasosPorSeg;
      const x = w1.x + t * (w2.x - w1.x);
      const z = w1.z + t * (w2.z - w1.z);
      const hBase = w1.h + t * (w2.h - w1.h);
      const altura = hBase + 4 * t * (1 - t) * apexExtra;
      pts.push([x, Math.max(0.05, altura), z]);
    }
  }
  return pts;
}

function accionAPuntos(a: AccionVisual): [number, number, number][] {
  if (a.tipo === "armado") return generarPuntosArmado(a);
  return generarPuntosGenerales(a);
}

// ============================================================
// COMPONENTES 3D
// ============================================================

const Trajectory = React.memo(function Trajectory({
  points,
  color,
  mostrarEstelas,
}: {
  points: [number, number, number][];
  color: string;
  mostrarEstelas: boolean;
}) {
  if (points.length < 2) return null;

  const inicio = points[0];
  const fin = points[points.length - 1];
  const inicioGround: [number, number, number] = [
    inicio[0],
    0.05,
    inicio[2],
  ];
  const finBall: [number, number, number] = [
    fin[0],
    Math.max(0.15, fin[1]),
    fin[2],
  ];

  return (
    <group>
      {mostrarEstelas && (
        <>
          <Line
            points={points}
            color={color}
            lineWidth={10}
            transparent
            opacity={0.12}
          />
          <Line
            points={points}
            color={color}
            lineWidth={4}
            transparent
            opacity={0.35}
          />
          <Line
            points={points}
            color={color}
            lineWidth={2}
            transparent
            opacity={0.95}
          />
        </>
      )}

      <mesh position={inicioGround}>
        <octahedronGeometry args={[0.18, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.6}
        />
      </mesh>

      <mesh position={finBall}>
        <sphereGeometry args={[0.15, 20, 20]} />
        <meshStandardMaterial
          color="#f8fafc"
          emissive={color}
          emissiveIntensity={0.4}
          metalness={0.1}
          roughness={0.4}
        />
      </mesh>
    </group>
  );
});

const BallAnimator = React.memo(function BallAnimator({
  points,
  color,
  speed = 1,
}: {
  points: [number, number, number][];
  color: string;
  speed?: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const tRef = useRef(0);

  const curve = useMemo(() => {
    if (points.length < 2) return null;
    const vecs = points.map(([x, y, z]) => new THREE.Vector3(x, y, z));
    // Filtramos puntos consecutivos iguales para evitar NaN en CatmullRom
    const filtrados = vecs.filter(
      (v, i) => i === 0 || v.distanceTo(vecs[i - 1]) > 0.001
    );
    if (filtrados.length < 2) return null;
    return new THREE.CatmullRomCurve3(filtrados);
  }, [points]);

  useFrame((_, delta) => {
    if (!meshRef.current || !curve) return;
    tRef.current = (tRef.current + delta * speed * 0.18) % 1;
    const pos = curve.getPointAt(tRef.current);
    meshRef.current.position.copy(pos);
  });

  if (!curve) return null;

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.22, 24, 24]} />
      <meshStandardMaterial
        color="#fef3c7"
        emissive={color}
        emissiveIntensity={0.9}
        metalness={0.2}
        roughness={0.35}
      />
    </mesh>
  );
});

const Court = React.memo(function Court() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[6.5, -0.02, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#1e3a8a" />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[6.5, 0, 4.5]}>
        <planeGeometry args={[9, 9]} />
        <meshStandardMaterial color="#2563eb" />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[6.5, 0, -4.5]}>
        <planeGeometry args={[9, 9]} />
        <meshStandardMaterial color="#2563eb" />
      </mesh>

      <Line
        points={[
          [2, 0.01, -9],
          [11, 0.01, -9],
          [11, 0.01, 9],
          [2, 0.01, 9],
          [2, 0.01, -9],
        ]}
        color="white"
        lineWidth={2}
      />
      <Line
        points={[
          [2, 0.01, 0],
          [11, 0.01, 0],
        ]}
        color="white"
        lineWidth={2}
      />
      <Line
        points={[
          [2, 0.01, 3],
          [11, 0.01, 3],
        ]}
        color="white"
        lineWidth={1.5}
      />
      <Line
        points={[
          [2, 0.01, -3],
          [11, 0.01, -3],
        ]}
        color="white"
        lineWidth={1.5}
      />
    </group>
  );
});

const Net = React.memo(function Net() {
  const postHeight = 2.43;
  return (
    <group>
      <mesh position={[2, postHeight / 2, 0]}>
        <cylinderGeometry args={[0.06, 0.06, postHeight, 12]} />
        <meshStandardMaterial color="#f1f5f9" />
      </mesh>
      <mesh position={[11, postHeight / 2, 0]}>
        <cylinderGeometry args={[0.06, 0.06, postHeight, 12]} />
        <meshStandardMaterial color="#f1f5f9" />
      </mesh>

      <mesh position={[6.5, postHeight, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, 9, 8]} />
        <meshStandardMaterial color="#f1f5f9" />
      </mesh>
      <mesh position={[6.5, 1.43, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, 9, 8]} />
        <meshStandardMaterial color="#f1f5f9" />
      </mesh>

      {Array.from({ length: 25 }).map((_, i) => {
        const x = 2 + (i / 24) * 9;
        return (
          <Line
            key={`v-${i}`}
            points={[
              [x, 1.43, 0],
              [x, 2.43, 0],
            ]}
            color="#e2e8f0"
            lineWidth={0.6}
            transparent
            opacity={0.5}
          />
        );
      })}
      {Array.from({ length: 5 }).map((_, i) => {
        const y = 1.43 + (i / 4) * 1;
        return (
          <Line
            key={`h-${i}`}
            points={[
              [2, y, 0],
              [11, y, 0],
            ]}
            color="#e2e8f0"
            lineWidth={0.6}
            transparent
            opacity={0.5}
          />
        );
      })}
    </group>
  );
});

const CameraController = React.memo(function CameraController({
  vista,
}: {
  vista: Vista;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    const positions: Record<Vista, [number, number, number]> = {
      top: [6.5, 26, 0.01],
      front: [6.5, 6, 20],
      "front-rival": [6.5, 6, -20],
      iso: [-10, 14, 16],
      "iso-opuesta": [23, 14, 16],
      "iso-izq": [-10, 14, 14],
      "iso-der": [23, 14, 14],
      "paralela-izq": [-15, 8, 4.5],
      "paralela-der": [28, 8, 4.5],
    };
    const pos = positions[vista];
    camera.position.set(pos[0], pos[1], pos[2]);
    camera.lookAt(6.5, 1.5, 0);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.updateProjectionMatrix();
    }
    if (controlsRef.current) {
      controlsRef.current.target.set(6.5, 1.5, 0);
      controlsRef.current.update();
    }
  }, [vista, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      target={[6.5, 1.5, 0]}
      enablePan
      enableZoom
      enableRotate
      minDistance={5}
      maxDistance={50}
      maxPolarAngle={Math.PI / 2 - 0.02}
    />
  );
});

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export default function CanchaUnificada3D({
  modo,
  acciones,
  puntos = [],
  puntoSeleccionado = null,
  vista = "iso-izq",
  width = 1000,
  height = 760,
  mostrarEstelas = true,
  velocidadAnimacion = 1,
}: Props) {
  // ---------- Resolver las acciones a mostrar ----------
  const accionesAMostrar: AccionVisual[] = useMemo(() => {
    if (modo === "armados") {
      return acciones.filter((a) => a.tipo === "armado");
    }
    if (modo === "punto-completo") {
      if (!puntoSeleccionado) {
        // Sin punto seleccionado → mostramos el primero disponible
        if (puntos.length === 0) return [];
        return puntos[0].acciones;
      }
      const grupo = puntos.find(
        (p) =>
          p.set_numero === puntoSeleccionado.set &&
          p.punto_numero === puntoSeleccionado.punto
      );
      return grupo?.acciones ?? [];
    }
    // modo === "fundamento"
    return acciones;
  }, [modo, acciones, puntos, puntoSeleccionado]);

  // ---------- Pre-calcular puntos 3D ----------
  const trayectorias = useMemo(() => {
    if (modo === "punto-completo") {
      // Concatenamos todas las trayectorias del punto
      const todas: [number, number, number][] = [];
      const colores: string[] = [];
      for (const a of accionesAMostrar) {
        const pts = accionAPuntos(a);
        if (pts.length < 2) continue;
        if (todas.length > 0) {
          // Unir con el último punto
          pts.shift();
        }
        todas.push(...pts);
        colores.push(colorPorTipo(a.tipo, a.es_rival));
      }
      return { tipo: "concatenado" as const, puntos: todas, colores };
    }

    // Modos normales: cada acción independiente
    const items: {
      id: string;
      puntos: [number, number, number][];
      color: string;
    }[] = [];
    for (const a of accionesAMostrar) {
      const pts = accionAPuntos(a);
      if (pts.length < 2) continue;
      items.push({
        id: a.id,
        puntos: pts,
        color: colorPorTipo(a.tipo, a.es_rival),
      });
    }
    return { tipo: "individual" as const, items };
  }, [modo, accionesAMostrar]);

  const colorPrincipal = "#f59e0b";

  return (
    <div
      style={{ width: `${width}px`, height: `${height}px` }}
      className="rounded-xl overflow-hidden bg-gradient-to-b from-sky-100 to-sky-200"
    >
      <Canvas
        camera={{ position: [6.5, 26, 0.01], fov: 45, near: 0.1, far: 200 }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.9} />
        <directionalLight position={[10, 15, 5]} intensity={0.8} />
        <directionalLight position={[-10, 10, -5]} intensity={0.4} />

        <Court />
        <Net />

        {trayectorias.tipo === "individual" &&
          trayectorias.items.map((it) => (
            <Trajectory
              key={it.id}
              points={it.puntos}
              color={it.color}
              mostrarEstelas={mostrarEstelas}
            />
          ))}

        {trayectorias.tipo === "concatenado" && (
          <>
            {trayectorias.puntos.length >= 2 && (
              <Trajectory
                points={trayectorias.puntos}
                color={colorPrincipal}
                mostrarEstelas={mostrarEstelas}
              />
            )}
            {trayectorias.puntos.length >= 2 && (
              <BallAnimator
                points={trayectorias.puntos}
                color={colorPrincipal}
                speed={velocidadAnimacion}
              />
            )}
          </>
        )}

        <CameraController vista={vista} />
      </Canvas>
    </div>
  );
}