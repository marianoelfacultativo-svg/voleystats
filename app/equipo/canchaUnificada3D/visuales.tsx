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
  ALTURA_BLOQUEO,
  ALTURA_RED,
  COL_X,
  RED_X_MAX,
  RED_X_MIN,
  SEGUNDOS_POR_ACCION,
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

/**
 * Animador de pelota con dibujo progresivo acción por acción.
 *
 * - Cada acción ocupa `SEGUNDOS_POR_ACCION` segundos.
 * - Mientras la pelota recorre la acción `i`, solo se dibuja la parte
 *   ya recorrida de esa acción.
 * - Las acciones anteriores se ven completas; las futuras no se ven.
 * - Al terminar la última acción, se reinicia automáticamente.
 */
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
    const tRef = useRef(0); // progreso global continuo: 0 .. n
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

      // Posición de la pelota
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

      // Longitud de la línea parcial de la acción actual
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
            // Acción ya completada → línea entera
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
            // Acción actual → solo tramo recorrido
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

          // Acción futura → no dibujar
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

/**
 * Una sola mano estilizada:
 *  - Palma: caja vertical.
 *  - 4 dedos: cajas verticales, apuntando hacia arriba.
 *  - Pulgar: caja lateral, apuntando hacia arriba.
 *
 * `esDerecha` espeja la posición del pulgar.
 *
 * El "centro" de la mano está a la altura de la palma. Para que el
 * bloqueo quede a la altura `ALTURA_BLOQUEO` (2.45 m), se posiciona
 * el grupo en esa Y y la palma queda centrada ahí.
 *
 * AJUSTE: tamaño ×1.4 respecto de la versión anterior. La mano ahora
 * mide ~15 cm de ancho por ~35 cm de alto (punta de dedos incluida).
 */
const HandMesh = React.memo(function HandMesh({
  color,
  esDerecha,
}: {
  color: string;
  esDerecha: boolean;
}) {
  const thumbX = esDerecha ? 0.105 : -0.105;
  const thumbRot = esDerecha ? -0.6 : 0.6;

  // Color y transparencia: los mismos que tenía la placa original.
  const matProps = {
    color,
    emissive: color,
    emissiveIntensity: 0.35,
    transparent: true,
    opacity: 0.78,
  };

  return (
    <group>
      {/* Palma (~15 × 20 × 6 cm) */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.15, 0.2, 0.06]} />
        <meshStandardMaterial {...matProps} />
      </mesh>
      {/* Pulgar (~4 × 13 × 5 cm) */}
      <mesh
        position={[thumbX, 0.045, 0]}
        rotation={[0, 0, thumbRot]}
      >
        <boxGeometry args={[0.04, 0.13, 0.05]} />
        <meshStandardMaterial {...matProps} />
      </mesh>
      {/* 4 dedos */}
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

/**
 * Par de manos (izquierda + derecha). Ancho total ≈ 0.40 m.
 * Se rota en X para que las manos se inclinen hacia la red
 * (arriba del bloqueo), y queda bien cerca de la malla.
 */
const HandPair = React.memo(function HandPair({
  color,
  haciaRed,
}: {
  color: string;
  /** +1 = inclinar hacia +z, -1 = inclinar hacia -z */
  haciaRed: 1 | -1;
}) {
  return (
    <group rotation={[haciaRed * -0.25, 0, 0]}>
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

export const BloqueadoresVisual = React.memo(function BloqueadoresVisual({
  acciones,
}: {
  acciones: AccionVisual[];
}) {
  const items = useMemo(() => {
    // Usamos un Map por celda para evitar duplicados: si un ataque
    // tiene desvío en BLOQ-R-C4 y además hay una acción de bloqueo
    // en esa misma celda, no queremos 2 pares de manos superpuestos.
    //
    // Orden de prioridad:
    //   1. Acciones tipo "bloqueo" (tienen su propio color de valoración)
    //   2. Desvíos de cualquier acción (ataque → BLOQ-R, etc.)
    //
    // Los desvíos son el caso "ataque que se desvió en el bloqueo":
    // con esto también se dibuja el bloqueador rival en el desvío.
    const porCelda = new Map<
      string,
      { key: string; celda: string; color: string; esPropio: boolean }
    >();

    for (const a of acciones) {
      if (a.tipo !== "bloqueo") continue;
      const color = colorPorValoracion(a);
      if (a.origen_celda?.startsWith("BLOQ-")) {
        porCelda.set(a.origen_celda, {
          key: `o-${a.id}`,
          celda: a.origen_celda,
          color,
          esPropio: a.origen_celda.startsWith("BLOQ-P-"),
        });
      }
      if (a.destino_celda?.startsWith("BLOQ-")) {
        porCelda.set(a.destino_celda, {
          key: `d-${a.id}`,
          celda: a.destino_celda,
          color,
          esPropio: a.destino_celda.startsWith("BLOQ-P-"),
        });
      }
    }

    for (const a of acciones) {
      const color = colorPorValoracion(a);
      for (const d of a.desvios ?? []) {
        if (!d.celda.startsWith("BLOQ-")) continue;
        if (porCelda.has(d.celda)) continue;
        porCelda.set(d.celda, {
          key: `dv-${a.id}-${d.celda}`,
          celda: d.celda,
          color,
          esPropio: d.celda.startsWith("BLOQ-P-"),
        });
      }
    }

    return Array.from(porCelda.values());
  }, [acciones]);

  return (
    <group>
      {items.map((it) => {
        const col = it.celda.split("-")[2] || "C3";
        const rango = COL_X[col];
        if (!rango) return null;

        const centroX = (rango[0] + rango[1]) / 2;
        // Las manos quedan muy cerca de la red: 0.28 m del plano z=0.
        // - Propias: lado +z (nuestra cancha), inclinadas hacia -z.
        // - Rivales: lado -z (cancha rival), inclinadas hacia +z.
        const z = it.esPropio ? 0.28 : -0.28;
        const haciaRed: 1 | -1 = it.esPropio ? -1 : 1;

        return (
          <group
            key={it.key}
            position={[centroX, ALTURA_BLOQUEO, z]}
          >
            <HandPair color={it.color} haciaRed={haciaRed} />
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