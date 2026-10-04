"use client";

import { useEffect, useRef, useState } from "react";
import type { EstadisticasJugador } from "@/lib/estadisticas";
import {
  nivelDeValoracion,
  type NivelValoracion,
} from "@/lib/estadisticas";
import LeyendaColores from "./LeyendaColores";

export interface SerieRadar {
  id: string;
  nombre: string;
  color: string;
  jugador: EstadisticasJugador;
}

interface Props {
  jugador?: EstadisticasJugador;
  series?: SerieRadar[];
  todosJugadores?: EstadisticasJugador[];
  esArmador?: boolean;
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

export default function RadarJugador({
  jugador,
  series,
  esArmador,
}: Props) {
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

  const fundamentosNormal = [
    "saque",
    "defensa",
    "recepcion",
    "bloqueo",
    "ataque",
  ];
  const fundamentosArmador = ["saque", "defensa", "bloqueo"];

  const fundamentos = esArmador ? fundamentosArmador : fundamentosNormal;

  const seriesFinales: SerieRadar[] = series
    ? series
    : jugador
    ? [
        {
          id: "main",
          nombre: "Jugador",
          color: "#10B981",
          jugador,
        },
      ]
    : [];

  const esMultiple = seriesFinales.length > 1;
  const primera = seriesFinales[0];

  const cx = size.w / 2;
  const cy = size.h / 2;
  const maxR = Math.min(cx, cy) * 0.62;

  const n = fundamentos.length;
  const angleStep = (Math.PI * 2) / n;
  const halfWedge = angleStep / 2;

  // Slices por fundamento (basados en el primer jugador, para colorear el fondo)
  const slices = fundamentos.map((f, i) => {
    const angleCenter = -Math.PI / 2 + i * angleStep;
    const angleStart = angleCenter - halfWedge;
    const angleEnd = angleCenter + halfWedge;
    const valor =
      primera?.jugador.valoracionPonderadaPorFundamento[f] ?? 0;
    const count = primera?.jugador.porFundamento[f]?.total ?? 0;
    const nivel = nivelDeValoracion(f, valor);
    const r = (Math.max(0, Math.min(10, valor)) / 10) * maxR;
    return { f, i, angleCenter, angleStart, angleEnd, valor, count, nivel, r };
  });

  return (
    <div>
      <div ref={wrapperRef} className="relative w-full h-96">
        {size.w > 0 && size.h > 0 && (
          <svg
            width={size.w}
            height={size.h}
            viewBox={`0 0 ${size.w} ${size.h}`}
            style={{ width: "100%", height: "100%" }}
          >
            {/* Fondo */}
            <circle cx={cx} cy={cy} r={maxR} fill="#e2e8f0" />

            {/* Anillos de grid */}
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

            {/* Líneas radiales del grid */}
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

            {/* Sectores con fill suave */}
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

            {/* Ejes radiales con color fuerte */}
            {slices.map((s) => {
              if (s.count === 0) return null;
              const x2 = cx + maxR * Math.cos(s.angleCenter);
              const y2 = cy + maxR * Math.sin(s.angleCenter);
              return (
                <line
                  key={`eje-${s.f}`}
                  x1={cx}
                  y1={cy}
                  x2={x2}
                  y2={y2}
                  stroke={STRONG_COLORS[s.nivel]}
                  strokeWidth={2}
                  strokeLinecap="round"
                  opacity={0.35}
                />
              );
            })}

            {/* Polígonos: uno por cada serie.
                Primera serie = azul oscuro (destacada).
                Series adicionales = con el color de cada serie. */}
            {seriesFinales.map((serie, idx) => {
              const puntos = fundamentos
                .map((f, i) => {
                  const count =
                    serie.jugador.porFundamento[f]?.total ?? 0;
                  if (count === 0) return null;
                  const valor =
                    serie.jugador.valoracionPonderadaPorFundamento[f] ?? 0;
                  const r =
                    (Math.max(0, Math.min(10, valor)) / 10) * maxR;
                  const angleCenter = -Math.PI / 2 + i * angleStep;
                  const vx = cx + r * Math.cos(angleCenter);
                  const vy = cy + r * Math.sin(angleCenter);
                  return `${vx},${vy}`;
                })
                .filter((p): p is string => p !== null);
              if (puntos.length < 2) return null;
              return (
                <polygon
                  key={`poly-${serie.id}`}
                  points={puntos.join(" ")}
                  fill={idx === 0 && !esMultiple ? "rgba(30,58,138,0.15)" : "none"}
                  stroke={esMultiple ? serie.color : "#1e3a8a"}
                  strokeWidth={2}
                />
              );
            })}

            {/* Puntos y etiquetas */}
            {slices.map((s) => {
              const labelR = maxR + 30;
              const lx = cx + labelR * Math.cos(s.angleCenter);
              const ly = cy + labelR * Math.sin(s.angleCenter);
              const cos = Math.cos(s.angleCenter);
              const sin = Math.sin(s.angleCenter);
              const anchor =
                cos > 0.3 ? "start" : cos < -0.3 ? "end" : "middle";
              const dy = sin < -0.7 ? -8 : sin > 0.7 ? 14 : 4;

              return (
                <g key={`vert-${s.f}`}>
                  {/* Un punto por cada serie */}
                  {seriesFinales.map((serie) => {
                    const count =
                      serie.jugador.porFundamento[s.f]?.total ?? 0;
                    if (count === 0) return null;
                    const valor =
                      serie.jugador.valoracionPonderadaPorFundamento[s.f] ??
                      0;
                    const r =
                      (Math.max(0, Math.min(10, valor)) / 10) * maxR;
                    const vx = cx + r * Math.cos(s.angleCenter);
                    const vy = cy + r * Math.sin(s.angleCenter);
                    return (
                      <circle
                        key={`pt-${serie.id}-${s.f}`}
                        cx={vx}
                        cy={vy}
                        r={5}
                        fill={esMultiple ? serie.color : STRONG_COLORS[s.nivel]}
                        stroke="white"
                        strokeWidth={2}
                      />
                    );
                  })}

                  {/* Etiqueta del fundamento */}
                  <text
                    x={lx}
                    y={ly + dy}
                    textAnchor={anchor}
                    fontSize={12}
                    fontWeight={600}
                    fill={
                      esMultiple ? "#2F4A3A" : STRONG_COLORS[s.nivel]
                    }
                  >
                    {ETIQUETAS[s.f]}
                  </text>

                  {/* Cantidad de acciones */}
                  <text
                    x={lx}
                    y={ly + dy + 14}
                    textAnchor={anchor}
                    fontSize={11}
                    fill="#64748b"
                  >
                    ({s.count})
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* Cuadros de valores */}
      <div
        className={`grid gap-2 mt-4 ${
          esArmador ? "grid-cols-3" : "grid-cols-5"
        }`}
      >
        {fundamentos.map((f) => {
          const count = primera?.jugador.porFundamento[f]?.total ?? 0;
          return (
            <div
              key={f}
              className="p-2 rounded border-2 text-center"
              style={{
                backgroundColor: esMultiple
                  ? "#f8fafc"
                  : SOFT_COLORS[
                      nivelDeValoracion(
                        f,
                        primera?.jugador.valoracionPonderadaPorFundamento[
                          f
                        ] ?? 0
                      )
                    ],
                borderColor: esMultiple
                  ? "#cbd5e1"
                  : STRONG_COLORS[
                      nivelDeValoracion(
                        f,
                        primera?.jugador.valoracionPonderadaPorFundamento[
                          f
                        ] ?? 0
                      )
                    ],
              }}
            >
              <p className="text-xs text-slate-500 font-medium">
                {ETIQUETAS[f]}
                <span className="text-slate-400 ml-1">({count})</span>
              </p>
              {seriesFinales.map((s) => {
                const val =
                  s.jugador.valoracionPonderadaPorFundamento[f] ?? 0;
                const colorText = esMultiple
                  ? s.color
                  : STRONG_COLORS[nivelDeValoracion(f, val)];
                return (
                  <p
                    key={s.id}
                    className="font-bold text-sm"
                    style={{ color: colorText }}
                  >
                    {val > 0 ? "+" : ""}
                    {val.toFixed(2)}
                  </p>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <LeyendaColores />
      </div>

      <p className="text-xs text-slate-400 mt-3 text-center">
        Cada sector se rellena con el tono del nivel. Los ejes y vértices usan
        el color fuerte del nivel.
      </p>
    </div>
  );
}