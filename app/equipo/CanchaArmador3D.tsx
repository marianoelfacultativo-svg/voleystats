"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

export interface ArmadoDetalle {
  id: string;
  jugador_id: string;
  set_numero: number;
  punto_numero: number;
  origen_celda: string;
  origen_mini: string | null;
  destino_celda: string;
  destino_mini: string | null;
  zona_tendencia: number | null;
  calidad: number;
  atacante_derecho: "arriba" | "abajo";
  armador_numero: number;
}

export type Vista =
  | "top"
  | "front"
  | "iso"
  | "iso-opuesta"
  | "paralela-izq"
  | "paralela-der";

interface Props {
  armados: ArmadoDetalle[];
  vista?: Vista;
  width?: number;
  height?: number;
  mostrarEstelas?: boolean;
}

const COLORES_CALIDAD: Record<number, string> = {
  1: "#dc2626",
  2: "#ea580c",
  3: "#eab308",
  4: "#84cc16",
  5: "#16a34a",
  6: "#059669",
};

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
};

const ALTURA_RED = 2.43;
const ALTURA_TOP_ARMADO = 2.7;
const ALTURA_DESTINO_MEDIA = 2.65;
const ALTURA_ORIGEN_ARMADO = 2.35;
const VARIANZA_GENERAL = 0.24;

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

function obtenerCoords(
  celda: string,
  mini: string | null
): { x: number; z: number } | null {
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

  return {
    x: rangoX[0] + (mc + 0.5) * anchoCelda,
    z: rangoZ[0] + (mf + 0.5) * altoCelda,
  };
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

function calcularDestinoYAltura(
  a: ArmadoDetalle,
  origen: { x: number; z: number },
  destinoBase: { x: number; z: number }
): { destino: { x: number; z: number }; hDestino: number } {
  const pegadaVarilla =
    a.calidad >= 5 &&
    esColumnaExterior(a.destino_celda, a.destino_mini, a.zona_tendencia);

  if (pegadaVarilla) {
    const rx = prand(a.id, "-varx");
    const rz = prand(a.id, "-varz");
    const distVarilla = 0.1 + rx * 0.2;

    let zVar: number;
    if (a.destino_celda.startsWith("F1")) {
      zVar = 0.1 + rz * 1.1;
    } else if (a.destino_celda.startsWith("F2")) {
      zVar = 3.1 + rz * 2.7;
    } else {
      zVar = 6.1 + rz * 2.7;
    }

    if (a.zona_tendencia === 4) {
      return {
        destino: { x: 2 + distVarilla, z: zVar },
        hDestino: ALTURA_TOP_ARMADO,
      };
    }
    return {
      destino: { x: 11 - distVarilla, z: zVar },
      hDestino: ALTURA_TOP_ARMADO,
    };
  }

  const rx = prand(a.id, "-varx");
  const rz = prand(a.id, "-varz");
  const ry = prand(a.id, "-vary");

  const destino = {
    x: destinoBase.x + (rx - 0.5) * VARIANZA_GENERAL,
    z: destinoBase.z + (rz - 0.5) * VARIANZA_GENERAL,
  };
  const hDestino = ALTURA_DESTINO_MEDIA + (ry - 0.5) * VARIANZA_GENERAL;

  return { destino, hDestino };
}

function calcularApex(
  origen: { x: number; z: number },
  destino: { x: number; z: number },
  celda: string,
  mini: string | null,
  calidad: number,
  seed: string
): number {
  const distancia = Math.sqrt(
    (destino.x - origen.x) ** 2 + (destino.z - origen.z) ** 2
  );
  const [fila, col] = celda.split("-");
  const r = prand(seed, "-apex");

  let base: number;

  if (calidad >= 5) {
    base = ALTURA_TOP_ARMADO;
  } else if (distancia > 5) base = 4.5 + r * 0.5;
  else if (fila === "F3") base = 4.5 + r * 0.5;
  else if (fila === "F1" && mini && mini.startsWith("f1")) {
    if (calidad === 1 || calidad === 2) base = 2.4;
    else if (calidad === 3) {
      if (col === "C3" && mini === "f1c1") base = 3.5;
      else if (col === "C2" || col === "C4") base = 2.55;
      else base = 2.4;
    } else base = 3.0 + r * 0.5;
  } else if (fila === "F1") {
    if (calidad === 1 || calidad === 2) base = 2.4;
    else if (calidad === 3) base = 2.55;
    else base = 3.0 + r * 0.5;
  } else if (calidad >= 4) base = 3.5 + r * 1.0;
  else base = 2.4;

  if (base > ALTURA_TOP_ARMADO) {
    base = base * 0.85;
  }

  base = base * 1.05;

  if (base <= 2.75) {
    base = base + 0.55;
  }

  if (calidad >= 5 && base < ALTURA_RED) base = ALTURA_RED + 0.3;

  return base;
}

function generarCurvaArmado(
  origen: { x: number; z: number },
  destino: { x: number; z: number },
  hApex: number,
  hDestino: number,
  calidad: number
): [number, number, number][] {
  const hOrigen = ALTURA_ORIGEN_ARMADO;
  const pasos = 40;
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= pasos; i++) {
    const t = i / pasos;
    const x = origen.x + t * (destino.x - origen.x);
    const z = origen.z + t * (destino.z - origen.z);
    const hBase = hOrigen + t * (hDestino - hOrigen);
    let altura =
      hBase + 4 * t * (1 - t) * (hApex - (hOrigen + hDestino) / 2);

    if (calidad >= 5 && altura < ALTURA_RED && t > 0.4) {
      altura = ALTURA_RED;
    }

    pts.push([x, altura, z]);
  }
  return pts;
}

const Trajectory = React.memo(function Trajectory({
  armado,
  mostrarEstelas,
}: {
  armado: ArmadoDetalle;
  mostrarEstelas: boolean;
}) {
  const data = useMemo(() => {
    const origen = obtenerCoords(armado.origen_celda, armado.origen_mini);
    const destinoBase = obtenerCoords(
      armado.destino_celda,
      armado.destino_mini
    );
    if (!origen || !destinoBase) return null;

    const { destino, hDestino } = calcularDestinoYAltura(
      armado,
      origen,
      destinoBase
    );
    const hApex = calcularApex(
      origen,
      destino,
      armado.origen_celda,
      armado.origen_mini,
      armado.calidad,
      armado.id
    );

    const points = generarCurvaArmado(origen, destino, hApex, hDestino, armado.calidad);

    return {
      origen,
      destino,
      hDestino,
      points,
      color: COLORES_CALIDAD[armado.calidad] ?? "#64748b",
    };
  }, [armado]);

  if (!data) return null;

  const { origen, destino, hDestino, points, color } = data;
  const inicio = points[0];
  const fin = points[points.length - 1];

  const inicioGround: [number, number, number] = [inicio[0], 0.05, inicio[2]];
  const finBall: [number, number, number] = [
    fin[0],
    Math.max(0.15, hDestino),
    fin[2],
  ];
  const finGround: [number, number, number] = [destino.x, 0.05, destino.z];

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

      <Line
        points={[inicioGround, inicio]}
        color={color}
        lineWidth={1}
        transparent
        opacity={0.45}
        dashed
        dashSize={0.15}
        gapSize={0.1}
      />

      <Line
        points={[finGround, finBall]}
        color={color}
        lineWidth={1}
        transparent
        opacity={0.45}
        dashed
        dashSize={0.15}
        gapSize={0.1}
      />

      <mesh position={inicioGround}>
        <octahedronGeometry args={[0.2, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.6}
        />
      </mesh>

      <mesh position={finBall}>
        <sphereGeometry args={[0.16, 20, 20]} />
        <meshStandardMaterial
          color="#f8fafc"
          emissive={color}
          emissiveIntensity={0.5}
          metalness={0.1}
          roughness={0.4}
        />
      </mesh>

      <mesh
        position={[destino.x, 0.02, destino.z]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.22, 0.3, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} />
      </mesh>
    </group>
  );
});

const Court = React.memo(function Court() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[6.5, -0.02, 4.5]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#1e3a8a" />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[6.5, 0, 4.5]}>
        <planeGeometry args={[9, 9]} />
        <meshStandardMaterial color="#2563eb" />
      </mesh>

      <Line
        points={[
          [2, 0.01, 0],
          [11, 0.01, 0],
          [11, 0.01, 9],
          [2, 0.01, 9],
          [2, 0.01, 0],
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
          [2, 0.01, 6],
          [11, 0.01, 6],
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
      top: [6.5, 26, 4.51],
      front: [6.5, 6, 22],
      iso: [-10, 14, 16],
      "iso-opuesta": [23, 14, 16],
      "paralela-izq": [-15, 8, 4.5],
      "paralela-der": [28, 8, 4.5],
    };
    const pos = positions[vista];
    camera.position.set(pos[0], pos[1], pos[2]);
    camera.lookAt(6.5, 1.5, 4.5);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.updateProjectionMatrix();
    }
    if (controlsRef.current) {
      controlsRef.current.target.set(6.5, 1.5, 4.5);
      controlsRef.current.update();
    }
  }, [vista, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      target={[6.5, 1.5, 4.5]}
      enablePan
      enableZoom
      enableRotate
      minDistance={5}
      maxDistance={50}
      maxPolarAngle={Math.PI / 2 - 0.02}
    />
  );
});

export default function CanchaArmador3D({
  armados,
  vista = "iso",
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
        camera={{ position: [-10, 14, 16], fov: 45, near: 0.1, far: 200 }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.9} />
        <directionalLight position={[10, 15, 5]} intensity={0.8} />
        <directionalLight position={[-10, 10, -5]} intensity={0.4} />

        <Court />
        <Net />

        {armados.map((a) => (
          <Trajectory
            key={a.id}
            armado={a}
            mostrarEstelas={mostrarEstelas}
          />
        ))}

        <CameraController vista={vista} />
      </Canvas>
    </div>
  );
}