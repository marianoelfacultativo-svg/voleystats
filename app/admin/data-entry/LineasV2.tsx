"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  getRectMiniLayout,
  hitTestV2,
  type Orientacion,
} from "./CanchaV2";

// ============================================================
// TIPOS
// ============================================================

export interface PuntoV2 {
  celda: string;
  mini: string;
}

export interface LineaV2 {
  id: string;
  origen: PuntoV2;
  destino: PuntoV2;
  tipo?: string;
  esRival?: boolean;
  color?: string;
  pendiente?: boolean;
}

interface Props {
  lineas: LineaV2[];
  origenActivo: PuntoV2 | null;
  circulosAbandonados?: PuntoV2[];
  orientacion: Orientacion;
  onCrearLinea: (destino: PuntoV2) => void;
  radioCirculoActivo?: number;
  radioCirculoUsado?: number;
}

// ============================================================
// HELPERS
// ============================================================

function centroLayout(celda: string, mini: string): { x: number; y: number } | null {
  const r = getRectMiniLayout(celda, mini);
  if (!r) return null;
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

function colorPorTipo(tipo?: string, esRival?: boolean): string {
  if (esRival) return "#94a3b8";
  switch (tipo) {
    case "saque":
      return "#2563eb";
    case "recepcion":
      return "#16a34a";
    case "armado":
      return "#8b5cf6";
    case "ataque":
      return "#dc2626";
    case "bloqueo":
      return "#ea580c";
    case "defensa":
      return "#0891b2";
    case "libre":
      return "#a16207";
    default:
      return "#64748b";
  }
}

// ============================================================
// COMPONENTE
// ============================================================

export default function LineasV2({
  lineas,
  origenActivo,
  circulosAbandonados = [],
  orientacion,
  onCrearLinea,
  radioCirculoActivo = 10,
  radioCirculoUsado = 5,
}: Props) {
  const [arrastrando, setArrastrando] = useState(false);
  const [posCursor, setPosCursor] = useState<{ x: number; y: number } | null>(
    null
  );
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Círculos usados (chicos): todos los orígenes y destinos de líneas +
  // abandonados, menos el origen activo.
  const circulos = useMemo(() => {
    const map = new Map<string, PuntoV2>();
    for (const l of lineas) {
      const k1 = `${l.origen.celda}|${l.origen.mini}`;
      if (!map.has(k1)) map.set(k1, l.origen);
      const k2 = `${l.destino.celda}|${l.destino.mini}`;
      if (!map.has(k2)) map.set(k2, l.destino);
    }
    for (const a of circulosAbandonados) {
      const k = `${a.celda}|${a.mini}`;
      if (!map.has(k)) map.set(k, a);
    }
    if (origenActivo) {
      map.delete(`${origenActivo.celda}|${origenActivo.mini}`);
    }
    return Array.from(map.values());
  }, [lineas, circulosAbandonados, origenActivo]);

  const posOrigen = origenActivo
    ? centroLayout(origenActivo.celda, origenActivo.mini)
    : null;

  // Pointer down sobre el círculo activo: empieza el drag
  const handlePointerDownCirculo = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const svg = (e.currentTarget as Element).closest("svg") as SVGSVGElement | null;
    if (!svg) return;
    svgRef.current = svg;
    setArrastrando(true);
    setPosCursor(null);
  };

  // Durante el drag: capturar pointermove/up globales
  useEffect(() => {
    if (!arrastrando) return;

    const onMove = (e: PointerEvent) => {
      const svg = svgRef.current;
      if (!svg) return;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const inv = ctm.inverse();
      const local = pt.matrixTransform(inv);
      setPosCursor({ x: local.x, y: local.y });
    };

    const onUp = (e: PointerEvent) => {
      setArrastrando(false);
      const svg = svgRef.current;
      if (!svg) {
        setPosCursor(null);
        return;
      }
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) {
        setPosCursor(null);
        return;
      }
      const inv = ctm.inverse();
      const local = pt.matrixTransform(inv);
      const hit = hitTestV2(local.x, local.y, orientacion);
      if (hit) {
        onCrearLinea({ celda: hit.celda, mini: hit.mini });
      }
      setPosCursor(null);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [arrastrando, orientacion, onCrearLinea]);

  return (
    <g>
      {/* ---------- LÍNEAS YA CREADAS ---------- */}
      {lineas.map((l) => {
        const o = centroLayout(l.origen.celda, l.origen.mini);
        const d = centroLayout(l.destino.celda, l.destino.mini);
        if (!o || !d) return null;
        const color = l.color ?? colorPorTipo(l.tipo, l.esRival);
        const esPendiente = l.pendiente;
        return (
          <line
            key={l.id}
            x1={o.x}
            y1={o.y}
            x2={d.x}
            y2={d.y}
            stroke={color}
            strokeWidth={esPendiente ? 2 : 3}
            strokeLinecap="round"
            strokeDasharray={esPendiente ? "5 4" : undefined}
            opacity={esPendiente ? 0.75 : 1}
            pointerEvents="none"
          />
        );
      })}

      {/* ---------- LÍNEA PROVISIONAL DURANTE EL DRAG ---------- */}
      {arrastrando && posOrigen && posCursor && (
        <line
          x1={posOrigen.x}
          y1={posOrigen.y}
          x2={posCursor.x}
          y2={posCursor.y}
          stroke="#0ea5e9"
          strokeWidth={2}
          strokeDasharray="6 4"
          strokeLinecap="round"
          opacity={0.85}
          pointerEvents="none"
        />
      )}

      {/* ---------- CÍRCULOS USADOS (chicos) ---------- */}
      {circulos.map((c, i) => {
        const p = centroLayout(c.celda, c.mini);
        if (!p) return null;
        return (
          <circle
            key={`${c.celda}-${c.mini}-${i}`}
            cx={p.x}
            cy={p.y}
            r={radioCirculoUsado}
            fill="#cbd5e1"
            stroke="#64748b"
            strokeWidth={0.8}
            opacity={0.85}
            pointerEvents="none"
          />
        );
      })}

      {/* ---------- CÍRCULO ACTIVO (grande, clickeable) ---------- */}
      {posOrigen && (
        <g
          onPointerDown={handlePointerDownCirculo}
          style={{ cursor: "grab", pointerEvents: "auto" }}
        >
          {/* Anillo pulsante */}
          <circle
            cx={posOrigen.x}
            cy={posOrigen.y}
            r={radioCirculoActivo + 5}
            fill="none"
            stroke="#0ea5e9"
            strokeWidth={1.5}
            opacity={0.6}
            pointerEvents="none"
          >
            <animate
              attributeName="r"
              values={`${radioCirculoActivo + 3};${radioCirculoActivo + 8};${radioCirculoActivo + 3}`}
              dur="1.4s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.6;0.1;0.6"
              dur="1.4s"
              repeatCount="indefinite"
            />
          </circle>

          {/* Círculo principal */}
          <circle
            cx={posOrigen.x}
            cy={posOrigen.y}
            r={radioCirculoActivo}
            fill="#ffffff"
            stroke="#000000"
            strokeWidth={2}
          />
        </g>
      )}
    </g>
  );
}