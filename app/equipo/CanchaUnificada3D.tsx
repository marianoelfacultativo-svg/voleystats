"use client";

// ============================================================
// CANCHA UNIFICADA 3D — componente principal
// Orquesta las trayectorias y los sub-componentes visuales.
// ============================================================

import React, { useMemo } from "react";
import { Canvas } from "@react-three/fiber";

import type { AccionVisual } from "./adaptadorUnificadoV2";
import { colorPorValoracion } from "./adaptadorUnificadoV2";

import {
  accionAPuntos,
  hOrigenPorTipo,
  type PuntoConAcciones,
  type Vista,
} from "./canchaUnificada3D/helpers";
import {
  AnimatedPointPlayback,
  BloqueadoresVisual,
  CameraController,
  Court,
  Net,
  Trajectory,
} from "./canchaUnificada3D/visuales";

export type ModoUnificado = "fundamento" | "armados" | "punto-completo";

export type { PuntoConAcciones, Vista };

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
  /** Filtro actual de acciones para que el 3D sea coherente con la UI */
  filtroAcciones?: "propias" | "rivales" | "ambas";
}

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
  filtroAcciones = "ambas",
}: Props) {
  const accionesAMostrar: AccionVisual[] = useMemo(() => {
    if (modo === "armados") {
      return acciones.filter((a) => a.tipo === "armado");
    }
    if (modo === "punto-completo") {
      if (!puntoSeleccionado) {
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
    return acciones;
  }, [modo, acciones, puntos, puntoSeleccionado]);

  const trayectorias = useMemo(() => {
    if (modo === "punto-completo") {
      const heights: number[] = [];
      for (let i = 0; i < accionesAMostrar.length; i++) {
        const next = accionesAMostrar[i + 1];
        heights.push(next ? hOrigenPorTipo(next) : 0);
      }

      const items: {
        id: string;
        puntos: [number, number, number][];
        color: string;
      }[] = [];
      for (let i = 0; i < accionesAMostrar.length; i++) {
        const a = accionesAMostrar[i];
        const pts = accionAPuntos(a, heights[i]);
        if (pts.length < 2) continue;
        items.push({
          id: a.id,
          puntos: pts,
          color: colorPorValoracion(a),
        });
      }
      return { tipo: "punto-completo" as const, items };
    }

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
        color: colorPorValoracion(a),
      });
    }
    return { tipo: "individual" as const, items };
  }, [modo, accionesAMostrar]);

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
        <BloqueadoresVisual
          acciones={accionesAMostrar}
          filtroAcciones={filtroAcciones}
        />

        {trayectorias.tipo === "individual" &&
          trayectorias.items.map((it) => (
            <Trajectory
              key={it.id}
              points={it.puntos}
              color={it.color}
              mostrarEstelas={mostrarEstelas}
            />
          ))}

        {trayectorias.tipo === "punto-completo" && (
          <AnimatedPointPlayback
            key={`pc-${puntoSeleccionado?.set ?? 0}-${
              puntoSeleccionado?.punto ?? 0
            }`}
            trayectorias={trayectorias.items}
            velocidadAnimacion={velocidadAnimacion}
          />
        )}

        <CameraController vista={vista} />
      </Canvas>
    </div>
  );
}