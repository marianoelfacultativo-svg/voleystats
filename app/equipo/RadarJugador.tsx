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
import {
  nivelDeValoracion,
  COLORES_NIVEL_CLASES,
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

  const datos = fundamentos.map((f) => {
    const fila: Record<string, string | number> = {
      fundamento: ETIQUETAS[f],
    };
    for (const s of seriesFinales) {
      const valorOriginal =
        s.jugador.valoracionPonderadaPorFundamento[f] ?? 0;
      fila[s.id] = transformarParaRadar(valorOriginal);
    }
    return fila;
  });

  const primera = seriesFinales[0];
  const valoresPorFundamento: Record<string, number> = {};
  const accionesPorFundamento: Record<string, number> = {};
  for (const f of fundamentos) {
    valoresPorFundamento[f] =
      primera?.jugador.valoracionPonderadaPorFundamento[f] ?? 0;
    accionesPorFundamento[f] = primera?.jugador.porFundamento[f]?.total ?? 0;
  }

  // Centro y radio igual que recharts: 75% * min(cx, cy)
  const cxPx = size.w / 2;
  const cyPx = size.h / 2;
  const radioPx = 0.75 * Math.min(cxPx, cyPx);

  const n = fundamentos.length;

  return (
    <div>
      <div ref={wrapperRef} className="relative w-full h-96">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={datos} outerRadius="75%">
            <PolarGrid stroke="#C9DBC6" />
            <PolarAngleAxis
              dataKey="fundamento"
              tick={{ fill: "#2F4A3A", fontSize: 13, fontWeight: 500 }}
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
                fillOpacity={esMultiple ? 0 : 0.45}
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
            {fundamentos.map((f, i) => {
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

      {/* Cuadros de valores con color por nivel */}
      <div
        className={`grid gap-2 mt-4 ${
          esArmador ? "grid-cols-3" : "grid-cols-5"
        }`}
      >
        {fundamentos.map((f) => {
          const valor =
            primera?.jugador.valoracionPonderadaPorFundamento[f] ?? 0;
          const nivel = nivelDeValoracion(f, valor);
          const col = COLORES_NIVEL_CLASES[nivel];
          const count = primera?.jugador.porFundamento[f]?.total ?? 0;

          return (
            <div
              key={f}
              className={`p-2 rounded border-2 text-center ${col.bg} ${col.border}`}
            >
              <p className="text-xs text-slate-500 font-medium">
                {ETIQUETAS[f]}
                <span className="text-slate-400 ml-1">({count})</span>
              </p>
              {seriesFinales.map((s) => {
                const val =
                  s.jugador.valoracionPonderadaPorFundamento[f] ?? 0;
                const nivelS = nivelDeValoracion(f, val);
                const colS = COLORES_NIVEL_CLASES[nivelS];
                return (
                  <p
                    key={s.id}
                    className={`font-bold text-sm ${colS.text}`}
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

      {/* Leyenda de colores */}
      <div className="mt-4">
        <LeyendaColores />
      </div>

      <p className="text-xs text-slate-400 mt-3 text-center">
        Cada eje del radar se colorea según el nivel del fundamento.
      </p>
    </div>
  );
}