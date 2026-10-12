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
  oculta?: boolean;
}

interface Props {
  lineas: LineaV2[];
  origenActivo: PuntoV2 | null;
  armado?: boolean;
  desviosPendientes?: PuntoV2[];
  estrella?: PuntoV2 | null;
  circulosAbandonados?: PuntoV2[];
  orientacion: Orientacion;
  onClickCirculo?: () => void;
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

function estrellaPts(
  cx: number,
  cy: number,
  rExt: number,
  rInt: number
): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? rExt : rInt;
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${cx + r * Math.cos(ang)},${cy + r * Math.sin(ang)}`);
  }
  return pts.join(" ");
}

// ============================================================
// COMPONENTE
// ============================================================

export default function LineasV2({
  lineas,
  origenActivo,
  armado = false,
  desviosPendientes = [],
  estrella = null,
  circulosAbandonados = [],
  orientacion,
  onClickCirculo,
  radioCirculoActivo = 12,
  radioCirculoUsado = 5,
}: Props) {
  const circulos = useMemo(() => {
    const map = new Map<string, PuntoV2>();
    for (const l of lineas) {
      if (l.oculta) continue;
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

  const posEstrella = estrella
    ? centroLayout(estrella.celda, estrella.mini)
    : null;

  void orientacion;

  const colorHalo = armado ? "#ea580c" : "#0ea5e9";
  const colorRelleno = armado ? "#fb923c" : "#ffffff";
  const colorBorde = armado ? "#7c2d12" : "#000000";
  const grosorBorde = armado ? 3 : 2;
  const grosorHalo = armado ? 2.5 : 1.5;
  const radioExtra = armado ? 6 : 4;

  return (
    <g>
      {/* ---------- LÍNEAS YA CREADAS ---------- */}
      {lineas.map((l) => {
        if (l.oculta) return null;
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

      {/* ---------- DESVÍOS PENDIENTES (tramo en curso, dashed) ---------- */}
      {origenActivo &&
        desviosPendientes.map((d, i) => {
          const prev =
            i === 0
              ? centroLayout(origenActivo.celda, origenActivo.mini)
              : centroLayout(
                  desviosPendientes[i - 1].celda,
                  desviosPendientes[i - 1].mini
                );
          const p = centroLayout(d.celda, d.mini);
          if (!prev || !p) return null;
          return (
            <path
              key={`dp-${i}`}
              d={`M ${prev.x} ${prev.y} L ${p.x} ${p.y}`}
              stroke="#ea580c"
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray="6 4"
              fill="none"
              opacity={0.9}
              pointerEvents="none"
            />
          );
        })}

      {/* ---------- CÍRCULOS USADOS ---------- */}
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

      {/* ---------- ESTRELLA ---------- */}
      {posEstrella && (
        <g pointerEvents="none">
          <polygon
            points={estrellaPts(posEstrella.x, posEstrella.y, 9, 4)}
            fill="#fbbf24"
            stroke="#78350f"
            strokeWidth={1.2}
            opacity={0.9}
          />
        </g>
      )}

      {/* ---------- CÍRCULO ACTIVO ---------- */}
      {posOrigen && (
        <g
          style={{ cursor: onClickCirculo ? "pointer" : "default" }}
          onPointerDown={(e) => {
            if (!onClickCirculo) return;
            e.stopPropagation();
            onClickCirculo();
          }}
          pointerEvents={onClickCirculo ? "auto" : "none"}
        >
          <circle
            cx={posOrigen.x}
            cy={posOrigen.y}
            r={radioCirculoActivo + radioExtra}
            fill="none"
            stroke={colorHalo}
            strokeWidth={grosorHalo}
            opacity={0.65}
          >
            <animate
              attributeName="r"
              values={`${radioCirculoActivo + radioExtra - 2};${radioCirculoActivo + radioExtra + 3};${radioCirculoActivo + radioExtra - 2}`}
              dur="1.4s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values={armado ? "0.85;0.25;0.85" : "0.6;0.1;0.6"}
              dur="1.4s"
              repeatCount="indefinite"
            />
          </circle>

          <circle
            cx={posOrigen.x}
            cy={posOrigen.y}
            r={radioCirculoActivo}
            fill={colorRelleno}
            stroke={colorBorde}
            strokeWidth={grosorBorde}
          />

          {armado && (
            <text
              x={posOrigen.x}
              y={posOrigen.y + 4}
              textAnchor="middle"
              fontSize={12}
              fontWeight="bold"
              fill="#7c2d12"
              pointerEvents="none"
            >
              ✓
            </text>
          )}
        </g>
      )}
    </g>
  );
}