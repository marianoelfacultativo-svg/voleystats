"use client";

import { useMemo } from "react";
import { getRectMiniLayout, type Orientacion } from "./CanchaV2";

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
  desvios?: PuntoV2[];
  tipo?: string;
  esRival?: boolean;
  color?: string;
}

interface Props {
  lineas: LineaV2[];
  origenActivo: PuntoV2 | null;
  circulosAbandonados?: PuntoV2[];
  orientacion: Orientacion;
  radioCirculoActivo?: number;
  radioCirculoUsado?: number;
}

// ============================================================
// HELPERS
// ============================================================

function centroLayout(
  celda: string,
  mini: string
): { x: number; y: number } | null {
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
  radioCirculoActivo = 10,
  radioCirculoUsado = 5,
}: Props) {
  // Círculos usados (chicos): todos los orígenes, destinos y desvíos
  // de líneas + abandonados, menos el origen activo.
  const circulos = useMemo(() => {
    const map = new Map<string, PuntoV2>();
    for (const l of lineas) {
      const k1 = `${l.origen.celda}|${l.origen.mini}`;
      if (!map.has(k1)) map.set(k1, l.origen);
      const k2 = `${l.destino.celda}|${l.destino.mini}`;
      if (!map.has(k2)) map.set(k2, l.destino);
      for (const d of l.desvios ?? []) {
        const kd = `${d.celda}|${d.mini}`;
        if (!map.has(kd)) map.set(kd, d);
      }
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

  // Silenciamos el prop `orientacion` para no romper la firma; los
  // paths se construyen en coords layout y el <g> padre se encarga
  // de la rotación.
  void orientacion;

  return (
    <g>
      {/* ---------- LÍNEAS YA CREADAS (con desvíos como polyline) ---------- */}
      {lineas.map((l) => {
        const puntos: PuntoV2[] = [
          l.origen,
          ...(l.desvios ?? []),
          l.destino,
        ];
        const coords = puntos
          .map((p) => centroLayout(p.celda, p.mini))
          .filter((c): c is { x: number; y: number } => c !== null);
        if (coords.length < 2) return null;

        const color = l.color ?? colorPorTipo(l.tipo, l.esRival);
        const dAttr = coords
          .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`)
          .join(" ");

        return (
          <path
            key={l.id}
            d={dAttr}
            stroke={color}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={1}
            pointerEvents="none"
          />
        );
      })}

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

      {/* ---------- CÍRCULO ACTIVO (visual, no clickeable acá) ---------- */}
      {posOrigen && (
        <g pointerEvents="none">
          <circle
            cx={posOrigen.x}
            cy={posOrigen.y}
            r={radioCirculoActivo + 5}
            fill="none"
            stroke="#0ea5e9"
            strokeWidth={1.5}
            opacity={0.6}
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