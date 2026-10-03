"use client";

import { useEffect, useRef, useState } from "react";
import type { EstadisticasJugador } from "@/lib/estadisticas";
import { nivelDeValoracion, type NivelValoracion } from "@/lib/estadisticas";

export interface SerieRadarEquipo {
  id: string;
  nombre: string;
  color: string;
  equipo: EstadisticasJugador;
}

interface Props {
  equipo?: EstadisticasJugador;
  series?: SerieRadarEquipo[];
  titulo?: string;
}

const ETIQUETAS: Record<string, string> = {
  saque: "Saque",
  recepcion: "Recepción",
  ataque: "Ataque",
  bloqueo: "Bloqueo",
  defensa: "Defensa",
};

const SOFT_COLORS: Record<NivelValoracion, string> = {
  bajo: "#fee2e2",
  cumple: "#fef9c3",
  bien: "#dcfce7",
  destaca: "#dbeafe",
};

const STRONG_COLORS: Record<NivelValoracion, string> = {
  bajo: "#dc2626",
  cumple: "#eab308",
  bien: "#16a34a",
  destaca: "#0284c7",
};

const FUNDAMENTOS_EQUIPO = [
  "saque",
  "defensa",
  "recepcion",
  "bloqueo",
  "ataque",
];

export default function RadarEquipo({ equipo, series, titulo }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (!wrapperRef.current) return;
    const update = () => {
      const r = wrapperRef.current!.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, []);

  const seriesFinales: SerieRadarEquipo[] = series
    ? series
    : equipo
    ? [{ id: "main", nombre: "Equipo", color: "#F59E0B", equipo }]
    : [];

  const primera = seriesFinales[0];

  const cx = size.w / 2;
  const cy = size.h / 2;
  const maxR = Math.min(cx, cy) * 0.62;

  const n = FUNDAMENTOS_EQUIPO.length;
  const angleStep = (Math.PI * 2) / n;
  const halfWedge = angleStep / 2;

  // Slice por fundamento
  const slices = FUNDAMENTOS_EQUIPO.map((f, i) => {
    const angleCenter = -Math.PI / 2 + i * angleStep;
    const angleStart = angleCenter - halfWedge;
    const angleEnd = angleCenter + halfWedge;
    const valor = primera?.equipo.valoracionPromedioNormalizado[f] ?? 0;
    const count = primera?.equipo.porFundamento[f]?.total ?? 0;
    const nivel = nivelDeValoracion(f, valor);
    const r = (Math.max(0, Math.min(10, valor)) / 10) * maxR;
    return { f, i, angleCenter, angleStart, angleEnd, valor, count, nivel, r };
  });

  return (
    <div>
      <h4 className="font-semibold text-slate-800 mb-3">
        {titulo ?? "Perfil del equipo"}
      </h4>

      <div ref={wrapperRef} className="relative w-full h-96">
        {size.w > 0 && size.h > 0 && (
          <svg
            width={size.w}
            height={size.h}
            viewBox={`0 0 ${size.w} ${size.h}`}
            style={{ width: "100%", height: "100%" }}
          >
            {/* Fondo (disco grande) */}
            <circle cx={cx} cy={cy} r={maxR} fill="#e2e8f0" />

            {/* Anillos concéntricos de grid */}
            {[0.2, 0.4, 0.6, 0.8, 1.0].map((t) => (
              <circle
                key={t}
                cx={cx}
                cy={cy}
                r={t * maxR}
                fill="none"
                stroke="#f8fafc"
                strokeWidth={1.5}
              />
            ))}

            {/* Líneas radiales del grid (en los bordes de cada sector) */}
            {slices.map((s) => {
              const x = cx + maxR * Math.cos(s.angleStart);
              const y = cy + maxR * Math.sin(s.angleStart);
              return (
                <line
                  key={`grid-${s.f}`}
                  x1={cx}
                  y1={cy}
                  x2={x}
                  y2={y}
                  stroke="#f8fafc"
                  strokeWidth={1.5}
                />
              );
            })}

            {/* Sectores (fill suave según nivel) */}
            {slices.map((s) => {
              if (s.count === 0) return null;
              const x1 = cx + s.r * Math.cos(s.angleStart);
              const y1 = cy + s.r * Math.sin(s.angleStart);
              const x2 = cx + s.r * Math.cos(s.angleEnd);
              const y2 = cy + s.r * Math.sin(s.angleEnd);
              const largeArc = s.angleEnd - s.angleStart > Math.PI ? 1 : 0;
              return (
                <path
                  key={`sector-${s.f}`}
                  d={`M ${cx} ${cy} L ${x1} ${y1} A ${s.r} ${s.r} 0 ${largeArc} 1 ${x2} ${y2} Z`}
                  fill={SOFT_COLORS[s.nivel]}
                  opacity={0.9}
                />
              );
            })}

            {/* Ejes radiales con color fuerte según nivel (del centro al vértice) */}
            {slices.map((s) => {
              if (s.count === 0) return null;
              const x2 = cx + maxR * Math.cos(s.angleCenter);
              const y2 = cy + maxR * Math.sin(s.angleCenter);
              const color = STRONG_COLORS[s.nivel];
              return (
                <line
                  key={`eje-${s.f}`}
                  x1={cx}
                  y1={cy}
                  x2={x2}
                  y2={y2}
                  stroke={color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  opacity={0.35}
                />
              );
            })}

            {/* Polígono (líneas fuertes entre vértices) */}
            {slices.length > 1 && (
              <polygon
                points={slices
                  .filter((s) => s.count > 0)
                  .map((s) => {
                    const vx = cx + s.r * Math.cos(s.angleCenter);
                    const vy = cy + s.r * Math.sin(s.angleCenter);
                    return `${vx},${vy}`;
                  })
                  .join(" ")}
                fill="none"
                stroke="#1e3a8a"
                strokeWidth={2}
              />
            )}

            {/* Puntos en cada vértice + etiquetas */}
            {slices.map((s) => {
              const vx = cx + s.r * Math.cos(s.angleCenter);
              const vy = cy + s.r * Math.sin(s.angleCenter);
              const labelR = maxR + 30;
              const lx = cx + labelR * Math.cos(s.angleCenter);
              const ly = cy + labelR * Math.sin(s.angleCenter);
              const cos = Math.cos(s.angleCenter);
              const anchor =
                cos > 0.3 ? "start" : cos < -0.3 ? "end" : "middle";
              const color = STRONG_COLORS[s.nivel];
              const sin = Math.sin(s.angleCenter);
              const dy = sin < -0.7 ? -8 : sin > 0.7 ? 14 : 4;

              return (
                <g key={`vert-${s.f}`}>
                  {s.count > 0 && (
                    <circle
                      cx={vx}
                      cy={vy}
                      r={5}
                      fill={color}
                      stroke="white"
                      strokeWidth={2}
                    />
                  )}
                  <text
                    x={lx}
                    y={ly + dy}
                    textAnchor={anchor}
                    fontSize={12}
                    fontWeight={600}
                    fill={color}
                  >
                    {ETIQUETAS[s.f]}
                  </text>
                  <text
                    x={lx}
                    y={ly + dy + 14}
                    textAnchor={anchor}
                    fontSize={11}
                    fill="#64748b"
                  >
                    {s.count > 0
                      ? `${s.valor.toFixed(2)} (${s.count})`
                      : "sin datos"}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* Cuadros de valores con color por nivel */}
      <div className="grid grid-cols-5 gap-2 mt-4">
        {FUNDAMENTOS_EQUIPO.map((f) => {
          const valor =
            primera?.equipo.valoracionPromedioNormalizado[f] ?? 0;
          const nivel = nivelDeValoracion(f, valor);
          const count = primera?.equipo.porFundamento[f]?.total ?? 0;
          return (
            <div
              key={f}
              className="p-2 rounded border-2 text-center"
              style={{
                backgroundColor: SOFT_COLORS[nivel],
                borderColor: STRONG_COLORS[nivel],
              }}
            >
              <p className="text-xs text-slate-600 font-medium">
                {ETIQUETAS[f]}
                <span className="text-slate-400 ml-1">({count})</span>
              </p>
              <p
                className="font-bold text-sm"
                style={{ color: STRONG_COLORS[nivel] }}
              >
                {valor > 0 ? "+" : ""}
                {valor.toFixed(2)}
              </p>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-400 mt-3 text-center">
        Cada sector se rellena con el tono del nivel. Los ejes radiales y
        vértices usan el color fuerte del nivel.
      </p>
    </div>
  );
}