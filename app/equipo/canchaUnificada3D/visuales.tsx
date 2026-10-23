"use client";

// ============================================================
// COMPONENTES VISUALES 3D — CanchaUnificada3D
// Sub-componentes de Three.js: trayectorias, pelota animada,
// cancha, red, bloqueadores y control de cámara.
// ============================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

import type { AccionVisual } from "../adaptadorUnificadoV2";
import { colorPorValoracion } from "../adaptadorUnificadoV2";

import {
  ALTURA_BANDA_INFERIOR,
  ALTURA_BLOQUEO_M1,
  ALTURA_BLOQUEO_M2,
  ALTURA_RED,
  COL_X,
  RED_X_MAX,
  RED_X_MIN,
  SEGUNDOS_POR_ACCION,
  Z_BLOQUEO,
  type Vista,
} from "./helpers";

// ============================================================
// TRAJECTORY — línea estática de una acción
// ============================================================

export const Trajectory = React.memo(function Trajectory({
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

// ============================================================
// ANIMATED POINT PLAYBACK — pelota + dibujo acción por acción
// ============================================================

export const AnimatedPointPlayback = React.memo(
  function AnimatedPointPlayback({
    trayectorias,
    velocidadAnimacion = 1,
  }: {
    trayectorias: {
      id: string;
      puntos: [number, number, number][];
      color: string;
    }[];
    velocidadAnimacion?: number;
  }) {
    const ballRef = useRef<THREE.Mesh>(null);
    const tRef = useRef(0);
    const snapRef = useRef({ idx: 0, hasta: 2 });
    const [, forceUpdate] = useState(0);

    const n = trayectorias.length;

    useFrame((_, delta) => {
      if (n === 0) return;
      const d = (delta * velocidadAnimacion) / SEGUNDOS_POR_ACCION;
      tRef.current = (tRef.current + d) % n;

      const idx = Math.min(n - 1, Math.floor(tRef.current));
      const tLocal = tRef.current - idx;
      const it = trayectorias[idx];
      if (!it || it.puntos.length < 2) return;

      const totalSeg = it.puntos.length - 1;
      const exact = tLocal * totalSeg;
      const iBall = Math.min(totalSeg - 1, Math.floor(exact));
      const tBall = exact - iBall;
      const p1 = it.puntos[iBall];
      const p2 = it.puntos[iBall + 1];
      if (ballRef.current) {
        ballRef.current.position.set(
          p1[0] + tBall * (p2[0] - p1[0]),
          Math.max(0.05, p1[1] + tBall * (p2[1] - p1[1])),
          p1[2] + tBall * (p2[2] - p1[2])
        );
      }

      const hasta = Math.max(2, Math.ceil(tLocal * it.puntos.length));
      if (snapRef.current.idx !== idx || snapRef.current.hasta !== hasta) {
        snapRef.current = { idx, hasta };
        forceUpdate((x) => (x + 1) % 100000);
      }
    });

    if (n === 0) return null;

    const { idx: idxSnap, hasta } = snapRef.current;

    return (
      <group>
        {trayectorias.map((it, i) => {
          if (it.puntos.length < 2) return null;

          if (i < idxSnap) {
            return (
              <React.Fragment key={it.id}>
                <Line
                  points={it.puntos}
                  color={it.color}
                  lineWidth={10}
                  transparent
                  opacity={0.1}
                />
                <Line
                  points={it.puntos}
                  color={it.color}
                  lineWidth={4}
                  transparent
                  opacity={0.35}
                />
                <Line
                  points={it.puntos}
                  color={it.color}
                  lineWidth={2}
                  transparent
                  opacity={0.95}
                />
              </React.Fragment>
            );
          }

          if (i === idxSnap) {
            const corte = Math.min(hasta, it.puntos.length);
            const parcial = it.puntos.slice(0, corte);
            if (parcial.length < 2) return null;
            return (
              <React.Fragment key={it.id}>
                <Line
                  points={parcial}
                  color={it.color}
                  lineWidth={12}
                  transparent
                  opacity={0.12}
                />
                <Line
                  points={parcial}
                  color={it.color}
                  lineWidth={4}
                  transparent
                  opacity={0.4}
                />
                <Line
                  points={parcial}
                  color={it.color}
                  lineWidth={2.5}
                  transparent
                  opacity={1}
                />
              </React.Fragment>
            );
          }

          return null;
        })}

        <mesh ref={ballRef}>
          <sphereGeometry args={[0.22, 24, 24]} />
          <meshStandardMaterial
            color="#fef3c7"
            emissive="#f59e0b"
            emissiveIntensity={0.9}
            metalness={0.2}
            roughness={0.35}
          />
        </mesh>
      </group>
    );
  }
);

// ============================================================
// COURT — piso, canchas y líneas
// ============================================================

export const Court = React.memo(function Court() {
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

// ============================================================
// NET — red (postes, banda, malla)
// ============================================================

export const Net = React.memo(function Net() {
  const postHeight = ALTURA_RED;
  const bandaInferior = ALTURA_BANDA_INFERIOR;
  const anchoRed = RED_X_MAX - RED_X_MIN;
  const centroX = (RED_X_MIN + RED_X_MAX) / 2;
  const alturaRed = postHeight - bandaInferior;
  const centroY = bandaInferior + alturaRed / 2;

  return (
    <group>
      <mesh position={[RED_X_MIN, postHeight / 2, 0]}>
        <cylinderGeometry args={[0.06, 0.06, postHeight, 12]} />
        <meshStandardMaterial color="#f1f5f9" />
      </mesh>
      <mesh position={[RED_X_MAX, postHeight / 2, 0]}>
        <cylinderGeometry args={[0.06, 0.06, postHeight, 12]} />
        <meshStandardMaterial color="#f1f5f9" />
      </mesh>

      <mesh
        position={[centroX, postHeight, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.04, 0.04, anchoRed, 10]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>

      <mesh
        position={[centroX, bandaInferior, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.03, 0.03, anchoRed, 10]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>

      <mesh position={[centroX, centroY, 0]}>
        <planeGeometry args={[anchoRed, alturaRed]} />
        <meshStandardMaterial
          color="#e2e8f0"
          transparent
          opacity={0.18}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {Array.from({ length: 37 }).map((_, i) => {
        const x = RED_X_MIN + (i / 36) * anchoRed;
        return (
          <Line
            key={`v-${i}`}
            points={[
              [x, bandaInferior, 0],
              [x, postHeight, 0],
            ]}
            color="#ffffff"
            lineWidth={0.5}
            transparent
            opacity={0.55}
          />
        );
      })}

      {Array.from({ length: 7 }).map((_, i) => {
        const y = bandaInferior + (i / 6) * alturaRed;
        return (
          <Line
            key={`h-${i}`}
            points={[
              [RED_X_MIN, y, 0],
              [RED_X_MAX, y, 0],
            ]}
            color="#ffffff"
            lineWidth={0.5}
            transparent
            opacity={0.55}
          />
        );
      })}
    </group>
  );
});

// ============================================================
// MANO — geometría simple (palma + 5 dedos)
// ============================================================

const HandMesh = React.memo(function HandMesh({
  color,
  esDerecha,
}: {
  color: string;
  esDerecha: boolean;
}) {
  const thumbX = esDerecha ? 0.105 : -0.105;
  const thumbRot = esDerecha ? -0.6 : 0.6;

  const matProps = {
    color,
    emissive: color,
    emissiveIntensity: 0.35,
    transparent: true,
    opacity: 0.78,
  };

  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.15, 0.2, 0.06]} />
        <meshStandardMaterial {...matProps} />
      </mesh>
      <mesh
        position={[thumbX, 0.045, 0]}
        rotation={[0, 0, thumbRot]}
      >
        <boxGeometry args={[0.04, 0.13, 0.05]} />
        <meshStandardMaterial {...matProps} />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const h = [0.13, 0.16, 0.155, 0.12][i];
        const x = (i - 1.5) * 0.037;
        return (
          <mesh key={i} position={[x, 0.1 + h / 2, 0]}>
            <boxGeometry args={[0.028, h, 0.045]} />
            <meshStandardMaterial {...matProps} />
          </mesh>
        );
      })}
    </group>
  );
});

const HandPair = React.memo(function HandPair({
  color,
  rotationX,
}: {
  color: string;
  rotationX: number;
}) {
  return (
    <group rotation={[rotationX, 0, 0]}>
      <group position={[-0.12, 0, 0]}>
        <HandMesh color={color} esDerecha={false} />
      </group>
      <group position={[0.12, 0, 0]}>
        <HandMesh color={color} esDerecha={true} />
      </group>
    </group>
  );
});

// ============================================================
// BLOQUEADORES VISUAL — manos en la red
// ============================================================
//
// Reglas (v19.5):
//   - UN par de manos POR ACCIÓN DE BLOQUEO.
//   - X según la MINI-COLUMNA (9 columnas a lo ancho de cada celda
//     BLOQ). La red es horizontal → la escala es solo de ancho.
//   - Y según la MINI-FILA:
//       * m1 (arriba) → 2.75, inclinadas hacia la red.
//       * m2 (abajo)  → 2.55, inclinación leve.
//     Valores exactos vienen de helpers.ts
//     (ALTURA_BLOQUEO_M1 / ALTURA_BLOQUEO_M2).
//   - Z = ±Z_BLOQUEO (0.1 m), MUY pegado a la red.
//     Propias → +Z, rivales → -Z. Coincide con lo que usa
//     helpers.ts para el waypoint del codo en el bloqueo.
//   - Fallback: si el bloqueo viene de un ataque sin acción de
//     bloqueo separada (datos pre-split) o si estás filtrando
//     "solo rivales" (la acción de bloqueo no está en pantalla),
//     se detecta por destino_celda BLOQ o por desvío BLOQ.

interface ManoItem {
  key: string;
  celda: string;
  mini: string | null;
  color: string;
  esPropio: boolean;
}

const MINI_COLS_BLOQUEO = 9;

const INCLINACION_ARRIBA = 0.55;
const INCLINACION_ABAJO = 0.25;

function xDesdeCeldaMini(celda: string, mini: string | null): number | null {
  const col = celda.split("-")[2] || "C3";
  const rango = COL_X[col];
  if (!rango) return null;
  const [x0, x1] = rango;
  const ancho = x1 - x0;

  if (!mini) return (x0 + x1) / 2;

  const match = mini.match(/^m(\d+)-(\d+)$/);
  if (!match) return (x0 + x1) / 2;

  const miniCol = parseInt(match[2], 10);
  const frac = (miniCol - 0.5) / MINI_COLS_BLOQUEO;
  return x0 + frac * ancho;
}

function yDesdeMiniRow(mini: string | null): number {
  if (!mini) return ALTURA_BLOQUEO_M2;
  const match = mini.match(/^m(\d+)-(\d+)$/);
  if (!match) return ALTURA_BLOQUEO_M2;
  const fila = parseInt(match[1], 10);
  return fila === 1 ? ALTURA_BLOQUEO_M1 : ALTURA_BLOQUEO_M2;
}

function rotationXDesdeMini(mini: string | null, esPropio: boolean): number {
  const esFilaArriba = mini?.startsWith("m1-") ?? false;
  const inclinacion = esFilaArriba ? INCLINACION_ARRIBA : INCLINACION_ABAJO;
  return esPropio ? -inclinacion : inclinacion;
}

export const BloqueadoresVisual = React.memo(function BloqueadoresVisual({
  acciones,
}: {
  acciones: AccionVisual[];
}) {
  const items = useMemo<ManoItem[]>(() => {
    const out: ManoItem[] = [];
    const covered = new Set<string>();

    // 1) Una acción de bloqueo → un par en el ORIGEN.
    for (const a of acciones) {
      if (a.tipo !== "bloqueo") continue;
      const celdaOrig = a.origen_celda;
      if (!celdaOrig || !celdaOrig.startsWith("BLOQ-")) continue;
      const mini = a.origen_mini ?? null;
      covered.add(`${celdaOrig}|${mini ?? ""}`);
      out.push({
        key: `bloq-${a.id}`,
        celda: celdaOrig,
        mini,
        color: colorPorValoracion(a),
        esPropio: celdaOrig.startsWith("BLOQ-P-"),
      });
    }

    // 2) Fallback: ataque post-split con DESTINO en el bloqueo.
    for (const a of acciones) {
      const celdaDest = a.destino_celda;
      if (!celdaDest || !celdaDest.startsWith("BLOQ-")) continue;
      const mini = a.destino_mini ?? null;
      const key = `${celdaDest}|${mini ?? ""}`;
      if (covered.has(key)) continue;
      covered.add(key);
      out.push({
        key: `dst-${a.id}`,
        celda: celdaDest,
        mini,
        color: colorPorValoracion(a),
        esPropio: celdaDest.startsWith("BLOQ-P-"),
      });
    }

    // 3) Fallback: desvío en BLOQ (datos pre-split).
    for (const a of acciones) {
      const color = colorPorValoracion(a);
      const desvios = a.desvios ?? [];
      for (let i = 0; i < desvios.length; i++) {
        const d = desvios[i];
        if (!d.celda.startsWith("BLOQ-")) continue;
        const mini = d.mini ?? null;
        const key = `${d.celda}|${mini ?? ""}`;
        if (covered.has(key)) continue;
        covered.add(key);
        out.push({
          key: `dv-${a.id}-${i}`,
          celda: d.celda,
          mini,
          color,
          esPropio: d.celda.startsWith("BLOQ-P-"),
        });
      }
    }

    return out;
  }, [acciones]);

  return (
    <group>
      {items.map((it) => {
        const centroX = xDesdeCeldaMini(it.celda, it.mini);
        if (centroX === null) return null;

        const centroY = yDesdeMiniRow(it.mini);
        const rotationX = rotationXDesdeMini(it.mini, it.esPropio);

        // Z = ±Z_BLOQUEO (0.1 m), pegado a la red.
        // Coincide con el waypoint del codo en helpers.ts.
        const z = it.esPropio ? Z_BLOQUEO : -Z_BLOQUEO;

        return (
          <group
            key={it.key}
            position={[centroX, centroY, z]}
          >
            <HandPair color={it.color} rotationX={rotationX} />
          </group>
        );
      })}
    </group>
  );
});

// ============================================================
// CAMERA CONTROLLER — posiciona la cámara según vista
// ============================================================

export const CameraController = React.memo(function CameraController({
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