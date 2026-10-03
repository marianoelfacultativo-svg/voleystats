"use client";

import { useEffect, useRef, useState } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
} from "recharts";
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

const COLORES_NIVEL_HEX: Record<NivelValoracion, string> = {
  bajo: "#dc2626",
  cumple: "#eab308",
  bien: "#16a34a",
  destaca: "#0284c7",
};

function transformarParaRadar(valor: number): number {
  const v = Math.max(0, valor);
  if (v <= 5) return (v / 5) * 25;
  return 25 + ((v - 5) / 5) * 75;
}

function desTransformar(v: number): number {
  if (v <= 25) return (v / 25) * 5;
  return 5 + ((v - 25) / 75) * 5;
}

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

  const esMultiple = seriesFinales.length > 1;

  const datos = FUNDAMENTOS_EQUIPO.map((f) => {
    const fila: Record<string, string | number> = {
      fundamento: ETIQUETAS[f],
    };
    for (const s of seriesFinales) {
      const valorOriginal = s.equipo.valoracionPromedioNormalizado[f] ?? 0;
      fila[s.id] = transformarParaRadar(valorOriginal);
    }
    return fila;
  });

  const primera = seriesFinales[0];
  const valoresPorFundamento: Record<string, number> = {};
  const accionesPorFundamento: Record<string, number> = {};
  for (const f of FUNDAMENTOS_EQUIPO) {
    valoresPorFundamento[f] =
      primera?.equipo.valoracionPromedioNormalizado[f] ?? 0;
    accionesPorFundamento[f] = primera?.equipo.porFundamento[f]?.total ?? 0;
  }

  // Cálculo del centro y radio igual al que usa recharts internamente.
  // Recharts: outerRadius (75%) * min(cx, cy) donde cx = w/2, cy = h/2.
  const cxPx = size.w / 2;
  const cyPx = size.h / 2;
  const radioPx = 0.75 * Math.min(cxPx, cyPx);

  const n = FUNDAMENTOS_EQUIPO.length;

  return (
    <div>
      <h4 className="font-semibold text-slate-800 mb-3">
        {titulo ?? "Perfil del equipo"}
      </h4>
      <div ref={wrapperRef} className="relative w-full h-80">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={datos} outerRadius="75%">
            <PolarGrid stroke="#C9DBC6" />
            <PolarAngleAxis
              dataKey="fundamento"
              tick={{ fill: "#2F4A3A", fontSize: 12, fontWeight: 500 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tickCount={5}
              tickFormatter={(v) => desTransformar(v as number).toFixed(1)}
              tick={{ fill: "#8FA398", fontSize: 10 }}
            />
            {seriesFinales.map((s) => (
              <Radar
                key={s.id}
                name={s.nombre}
                dataKey={s.id}
                stroke={s.color}
                fill={s.color}
                fillOpacity={esMultiple ? 0 : 0.4}
                strokeWidth={esMultiple ? 3 : 2}
              />
            ))}
            {esMultiple && (
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                iconType="line"
              />
            )}
          </RadarChart>
        </ResponsiveContainer>

        {size.w > 0 && size.h > 0 && (
          <svg
            className="absolute inset-0 pointer-events-none"
            width={size.w}
            height={size.h}
            viewBox={`0 0 ${size.w} ${size.h}`}
            style={{ width: "100%", height: "100%" }}
          >
            {FUNDAMENTOS_EQUIPO.map((f, i) => {
              const count = accionesPorFundamento[f] ?? 0;
              if (count === 0) return null;

              const valor = valoresPorFundamento[f] ?? 0;
              const nivel = nivelDeValoracion(f, valor);
              const color = COLORES_NIVEL_HEX[nivel];

              const angulo = -90 + (360 / n) * i;
              const rad = (angulo * Math.PI) / 180;
              const x2 = cxPx + radioPx * Math.cos(rad);
              const y2 = cyPx + radioPx * Math.sin(rad);

              return (
                <line
                  key={`eje-${f}`}
                  x1={cxPx}
                  y1={cyPx}
                  x2={x2}
                  y2={y2}
                  stroke={color}
                  strokeWidth={3}
                  strokeLinecap="round"
                  opacity={0.9}
                />
              );
            })}
          </svg>
        )}
      </div>

      <div className="grid grid-cols-5 gap-2 mt-4">
        {FUNDAMENTOS_EQUIPO.map((f) => {
          const count = primera?.equipo.porFundamento[f]?.total ?? 0;
          return (
            <div
              key={f}
              className="p-2 bg-amber-50 border border-amber-200 rounded text-center"
            >
              <p className="text-xs text-amber-700">
                {ETIQUETAS[f]}
                <span className="text-amber-500 ml-1">({count})</span>
              </p>
              {seriesFinales.map((s) => {
                const val = s.equipo.valoracionPromedioNormalizado[f] ?? 0;
                return (
                  <p
                    key={s.id}
                    className="font-semibold text-sm"
                    style={{ color: esMultiple ? s.color : undefined }}
                  >
                    {esMultiple
                      ? val.toFixed(2)
                      : `${val > 0 ? "+" : ""}${val.toFixed(2)}`}
                  </p>
                );
              })}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-400 mt-3 text-center">
        Valoración normalizada por fundamento. Cada eje se colorea según su nivel.
      </p>
    </div>
  );
}