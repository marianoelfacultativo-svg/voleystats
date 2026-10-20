"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

export type TipoFundamento = "saque" | "recepcion" | "ataque";

export type Vista = "top" | "front" | "front-rival" | "iso-izq" | "iso-der";

export interface PuntoVisual {
  celda: string;
  mini: string | null;
}

export interface ItemVisual {
  id: string;
  origen: PuntoVisual;
  desvios?: PuntoVisual[];
  destino: PuntoVisual;
  color: string;
  calidad?: number | string;
  randomizar?: boolean;
  esError?: boolean;
}

interface Props {
  tipo: TipoFundamento;
  items: ItemVisual[];
  vista?: Vista;
  width?: number;
  height?: number;
  mostrarEstelas?: boolean;
}

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
  celda: string,
  mini: string | null
): { x: number; z: number } | null {
  if (celda.startsWith("S")) return servicioPos(celda);
  if (celda.startsWith("D")) return destinoSaquePos(celda);

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
  if (!match) return null;
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

function extensionPorBorde(
  celda: string,
  _mini: string | null
): { dx: number; dz: number } | null {
  const partes = celda.split("-");
  if (partes.length !== 2) return null;
  const [fila, col] = partes;

  let dx = 0;
  let dz = 0;

  if (fila === "F6") dz = -3.0;
  else if (fila === "F3") dz = 3.0;

  if (col === "C1") dx = -3.0;
  else if (col === "C5") dx = 3.0;

  if (dx === 0 && dz === 0) return null;
  return { dx, dz };
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

interface ParametrosTrayectoria {
  hOrigen: number;
  hDestino: number;
  esRecto: boolean;
}

function getParametros(
  tipo: TipoFundamento,
  item: ItemVisual
): ParametrosTrayectoria {
  if (tipo === "saque") {
    const esPotencia = item.calidad === "potencia";
    return {
      hOrigen: 2.8,
      hDestino: 0,
      esRecto: esPotencia,
    };
  }
  if (tipo === "ataque") {
    return {
      hOrigen: 2.8,
      hDestino: 0,
      esRecto: false,
    };
  }
  return {
    hOrigen: 0.3,
    hDestino: 2.2,
    esRecto: false,
  };
}

const ALTURA_RED = 2.43;
const GRAVEDAD = 9.8;
const ALTURA_MAX_ARCO = 3.4;

function limitarAltura(
  pts: [number, number, number][]
): [number, number, number][] {
  return pts.map((p) => {
    if (p[1] > ALTURA_MAX_ARCO) {
      return [p[0], ALTURA_MAX_ARCO, p[2]];
    }
    return p;
  });
}

function generarSegmento(
  a: [number, number, number],
  b: [number, number, number],
  params: ParametrosTrayectoria,
  necesitaPasarRed: boolean,
  limitar: boolean
): [number, number, number][] {
  const { hOrigen, hDestino, esRecto } = params;

  const dx = b[0] - a[0];
  const dz = b[2] - a[2];
  const distH = Math.sqrt(dx * dx + dz * dz);

  if (distH < 0.001) return [a, b];

  if (esRecto) {
    const pasos = 40;
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= pasos; i++) {
      const t = i / pasos;
      pts.push([
        a[0] + t * dx,
        Math.max(0, hOrigen + t * (hDestino - hOrigen)),
        a[2] + t * dz,
      ]);
    }
    return pts;
  }

  const cruzandoRed = (a[2] >= 0 && b[2] < 0) || (a[2] < 0 && b[2] >= 0);

  let T: number;

  if (necesitaPasarRed && cruzandoRed) {
    const tRedRatio = -a[2] / (b[2] - a[2]);

    if (tRedRatio > 0.05 && tRedRatio < 0.95) {
      const hRedMin = ALTURA_RED + 0.05;
      const num = (hDestino - hOrigen) - (hRedMin - hOrigen) / tRedRatio;
      const den = 0.5 * GRAVEDAD * (tRedRatio - 1);

      if (Math.abs(den) > 0.001) {
        const T2 = num / den;
        if (T2 > 0) {
          T = Math.sqrt(T2);
        } else {
          T = distH / 8;
        }
      } else {
        T = distH / 8;
      }
    } else {
      T = distH / 8;
    }
  } else {
    T = distH / 8;
  }

  const vy = (hDestino - hOrigen + 0.5 * GRAVEDAD * T * T) / T;
  const vx = dx / T;
  const vz = dz / T;

  const pasos = 40;
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= pasos; i++) {
    const t = (i / pasos) * T;
    const x = a[0] + vx * t;
    const y = hOrigen + vy * t - 0.5 * GRAVEDAD * t * t;
    const z = a[2] + vz * t;
    pts.push([x, Math.max(0, y), z]);
  }

  if (limitar) return limitarAltura(pts);
  return pts;
}

function generarCurvaAtaque(
  a: [number, number, number],
  b: [number, number, number]
): [number, number, number][] {
  const pasos = 40;
  const pts: [number, number, number][] = [];
  const hOrigen = a[1];
  const hDestino = b[1];
  const zOrigen = a[2];
  const zDestino = b[2];
  const delta = hDestino - hOrigen;
  const cruzaRed =
    (zOrigen > 0 && zDestino < 0) || (zOrigen < 0 && zDestino > 0);

  // Curvatura: p > 1 da una curva que baja lento al principio y cae al final.
  // p = 1 es recta. p grande = más curvada. Siempre monótona decreciente
  // (siempre baja, nunca sube) si delta < 0.
  let p = 1.8;

  if (cruzaRed) {
    // Verificar que la pelota pase por encima de la red. Si no, reducir p.
    const tRed = Math.abs(zOrigen) / Math.abs(zDestino - zOrigen);
    const hRedMin = ALTURA_RED + 0.05;
    while (p > 1.05) {
      const yRed = hOrigen + delta * Math.pow(tRed, p);
      if (yRed >= hRedMin) break;
      p -= 0.05;
    }
  }

  for (let i = 0; i <= pasos; i++) {
    const t = i / pasos;
    const x = a[0] + t * (b[0] - a[0]);
    const z = a[2] + t * (b[2] - a[2]);
    const y = Math.max(0, hOrigen + delta * Math.pow(t, p));
    pts.push([x, y, z]);
  }
  return pts;
}

function generarPuntosAtaque(
  origen: { x: number; z: number },
  destino: { x: number; z: number },
  desvios: { x: number; z: number }[]
): [number, number, number][] {
  const origenPropio = origen.z >= 0;
  const destinoPropio = destino.z >= 0;

  // CASO A: ataque a la red (origen y destino propio, sin desvíos)
  if (origenPropio && destinoPropio && desvios.length === 0) {
    const puntoRed: [number, number, number] = [
      origen.x,
      ALTURA_RED - 0.3,
      0,
    ];
    const puntoCaida: [number, number, number] = [
      destino.x,
      0,
      Math.max(2.0, destino.z),
    ];

    const seg1: [number, number, number][] = [];
    const pasos1 = 30;
    for (let i = 0; i <= pasos1; i++) {
      const t = i / pasos1;
      const x = origen.x + t * (puntoRed[0] - origen.x);
      const z = origen.z + t * (puntoRed[2] - origen.z);
      const hBase = 2.8 + t * (puntoRed[1] - 2.8);
      const y = Math.max(0, hBase + 4 * t * (1 - t) * 0.15);
      seg1.push([x, y, z]);
    }

    const seg2: [number, number, number][] = [];
    const pasos2 = 20;
    for (let i = 0; i <= pasos2; i++) {
      const t = i / pasos2;
      const x = puntoRed[0] + t * (puntoCaida[0] - puntoRed[0]);
      const z = puntoRed[2] + t * (puntoCaida[2] - puntoRed[2]);
      const hBase = puntoRed[1] + t * (puntoCaida[1] - puntoRed[1]);
      const y = Math.max(0, hBase - 4 * t * (1 - t) * 0.1);
      seg2.push([x, y, z]);
    }

    return [...seg1, ...seg2.slice(1)];
  }

  // CASO B: bloqueo rival.
  // Cualquier desvío en la fila pegada a la red del lado rival (F4, z entre -3 y 0)
  // se considera toque de bloqueo. El punto de bloqueo queda pegado a la red
  // (z=-0.2) y a la MISMA altura del origen del ataque (2.8m).
  // El tramo origen → bloqueo es RECTO y no toca el piso.
  const desvioBloqueo = desvios.find((d) => d.z >= -3 && d.z <= 0);
  if (desvioBloqueo) {
    const puntoBloqueo: [number, number, number] = [
      desvioBloqueo.x,
      2.8,
      -0.2,
    ];
    const puntoCaida: [number, number, number] = [
      destino.x,
      0,
      destino.z,
    ];

    const seg1: [number, number, number][] = [];
    const pasos1 = 30;
    for (let i = 0; i <= pasos1; i++) {
      const t = i / pasos1;
      seg1.push([
        origen.x + t * (puntoBloqueo[0] - origen.x),
        2.8 + t * (puntoBloqueo[1] - 2.8),
        origen.z + t * (puntoBloqueo[2] - origen.z),
      ]);
    }

    return [
      ...seg1,
      ...generarCurvaAtaque(puntoBloqueo, puntoCaida).slice(1),
    ];
  }

  // CASO C: ataque normal
  const waypoints: { x: number; z: number; y: number }[] = [
    { x: origen.x, z: origen.z, y: 2.8 },
    ...desvios.map((d) => ({
      x: d.x,
      z: d.z,
      y: d.z >= -3 && d.z <= 0 ? 2.8 : 0,
    })),
    { x: destino.x, z: destino.z, y: 0 },
  ];

  const puntos: [number, number, number][] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const segPts = generarCurvaAtaque(
      [waypoints[i].x, waypoints[i].y, waypoints[i].z],
      [waypoints[i + 1].x, waypoints[i + 1].y, waypoints[i + 1].z]
    );
    if (i > 0) segPts.shift();
    puntos.push(...segPts);
  }
  return puntos;
}

function generarPuntos3D(
  tipo: TipoFundamento,
  item: ItemVisual
): [number, number, number][] {
  const origenBase = obtenerCoords(item.origen.celda, item.origen.mini);
  const destinoBase = obtenerCoords(item.destino.celda, item.destino.mini);
  if (!origenBase || !destinoBase) return [];

  const desviosBase =
    item.desvios
      ?.map((d) => obtenerCoords(d.celda, d.mini))
      .filter((p): p is { x: number; z: number } => p !== null) ?? [];

  const debeRandomizar = item.randomizar !== false;

  const rand = (
    c: { x: number; z: number },
    key: string
  ): { x: number; z: number } => {
    if (!debeRandomizar) return c;
    const rx = prand(item.id, key + "-x");
    const rz = prand(item.id, key + "-z");
    return {
      x: c.x + (rx - 0.5) * 0.6,
      z: c.z + (rz - 0.5) * 0.6,
    };
  };

  let origen = rand(origenBase, "-origen");

  if (tipo === "saque") {
    origen = { x: origen.x, z: 9.5 };
    if (origen.x < 2 || origen.x > 11) {
      origen = { x: 6.5, z: 9.5 };
    }
  }

  let destino = rand(destinoBase, "-destino");

  const ext = item.esError
    ? extensionPorBorde(item.destino.celda, item.destino.mini)
    : null;
  if (ext) {
    destino = { x: destino.x + ext.dx, z: destino.z + ext.dz };
  }

  const desvios = desviosBase.map((d, i) => rand(d, `-desvio-${i}`));

  if (tipo === "ataque") {
    return generarPuntosAtaque(origen, destino, desvios);
  }

  const params = getParametros(tipo, item);
  const necesitaPasarRed = tipo === "saque";
  const limitarAlturaSaque = tipo === "saque";

  const quedoEnRed =
    tipo === "saque" &&
    (destino.z > -0.5 ||
      (destino.z >= -2.5 && item.esError === true));

  if (quedoEnRed) {
    const puntoRed: [number, number, number] = [
      destino.x,
      ALTURA_RED - 0.5,
      0,
    ];
    const puntoCaida: [number, number, number] = [destino.x, 0, 2.5];

    const seg1: [number, number, number][] = [];
    const pasos1 = 30;
    for (let i = 0; i <= pasos1; i++) {
      const t = i / pasos1;
      const x = origen.x + t * (puntoRed[0] - origen.x);
      const z = origen.z + t * (puntoRed[2] - origen.z);
      const hBase = 2.8 + t * (puntoRed[1] - 2.8);
      const y = Math.max(0, hBase + 4 * t * (1 - t) * 0.15);
      seg1.push([x, y, z]);
    }

    const seg2: [number, number, number][] = [];
    const pasos2 = 20;
    for (let i = 0; i <= pasos2; i++) {
      const t = i / pasos2;
      const x = puntoRed[0] + t * (puntoCaida[0] - puntoRed[0]);
      const z = puntoRed[2] + t * (puntoCaida[2] - puntoRed[2]);
      const hBase = puntoRed[1] + t * (puntoCaida[1] - puntoRed[1]);
      const y = Math.max(0, hBase - 4 * t * (1 - t) * 0.1);
      seg2.push([x, y, z]);
    }

    return [...seg1, ...seg2.slice(1)];
  }

  const waypoints: [number, number, number][] = [
    [origen.x, 0, origen.z],
    ...desvios.map((d): [number, number, number] => [d.x, 0, d.z]),
    [destino.x, 0, destino.z],
  ];

  const puntos: [number, number, number][] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const segPts = generarSegmento(
      waypoints[i],
      waypoints[i + 1],
      params,
      necesitaPasarRed,
      limitarAlturaSaque
    );
    if (i > 0) segPts.shift();
    puntos.push(...segPts);
  }
  return puntos;
}

const Trajectory = React.memo(function Trajectory({
  tipo,
  item,
  mostrarEstelas,
}: {
  tipo: TipoFundamento;
  item: ItemVisual;
  mostrarEstelas: boolean;
}) {
  const points = useMemo(() => generarPuntos3D(tipo, item), [tipo, item]);
  if (points.length < 2) return null;

  const inicio = points[0];
  const fin = points[points.length - 1];

  const inicioGround: [number, number, number] = [inicio[0], 0.05, inicio[2]];
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
            color={item.color}
            lineWidth={10}
            transparent
            opacity={0.12}
          />
          <Line
            points={points}
            color={item.color}
            lineWidth={4}
            transparent
            opacity={0.35}
          />
          <Line
            points={points}
            color={item.color}
            lineWidth={2}
            transparent
            opacity={0.95}
          />
        </>
      )}

      {inicio[1] > 0.2 && (
        <Line
          points={[inicioGround, inicio]}
          color={item.color}
          lineWidth={1}
          transparent
          opacity={0.45}
          dashed
          dashSize={0.15}
          gapSize={0.1}
        />
      )}

      <mesh position={inicioGround}>
        <octahedronGeometry args={[0.18, 0]} />
        <meshStandardMaterial
          color={item.color}
          emissive={item.color}
          emissiveIntensity={0.6}
        />
      </mesh>

      <mesh position={finBall}>
        <sphereGeometry args={[0.15, 20, 20]} />
        <meshStandardMaterial
          color="#f8fafc"
          emissive={item.color}
          emissiveIntensity={0.4}
          metalness={0.1}
          roughness={0.4}
        />
      </mesh>
    </group>
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
      front: [6.5, 6, 20],
      top: [6.5, 26, 0.01],
      "front-rival": [6.5, 6, -20],
      "iso-izq": [-10, 14, 14],
      "iso-der": [23, 14, 14],
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

export default function CanchaVisualizacion3D({
  tipo,
  items,
  vista = "top",
  width = 1000,
  height = 760,
  mostrarEstelas = true,
}: Props) {
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

        {items.map((it) => (
          <Trajectory
            key={it.id}
            tipo={tipo}
            item={it}
            mostrarEstelas={mostrarEstelas}
          />
        ))}

        <CameraController vista={vista} />
      </Canvas>
    </div>
  );
}