"use client";

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Legend,
} from "recharts";
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

const BG_NIVEL: Record<NivelValoracion, string> = {
  bajo: "#fee2e2",
  cumple: "#fef9c3",
  bien: "#dcfce7",
  destaca: "#dbeafe",
};

const TEXTO_NIVEL: Record<NivelValoracion, string> = {
  bajo: "#dc2626",
  cumple: "#eab308",
  bien: "#16a34a",
  destaca: "#0284c7",
};

// ------------------------------------------------------------
// Escala no lineal: 0-6 ocupa 35% del radio, 6-10 ocupa 65%.
// Trabajamos con "visual" en dominio [0, 10]:
//   real 0  -> visual 0
//   real 6  -> visual 3.5
//   real 10 -> visual 10
// ------------------------------------------------------------

const VISUAL_MAX = 10;
const FRACCION_LIMITE = 0.35;
const REAL_LIMITE = 6;
const VISUAL_LIMITE = VISUAL_MAX * FRACCION_LIMITE; // 3.5

function realAVisual(v: number): number {
  if (v <= REAL_LIMITE) return (v / REAL_LIMITE) * VISUAL_LIMITE;
  return (
    VISUAL_LIMITE +
    ((v - REAL_LIMITE) / (10 - REAL_LIMITE)) * (VISUAL_MAX - VISUAL_LIMITE)
  );
}

function visualAReal(v: number): number {
  if (v <= VISUAL_LIMITE) return (v / VISUAL_LIMITE) * REAL_LIMITE;
  return (
    REAL_LIMITE +
    ((v - VISUAL_LIMITE) / (VISUAL_MAX - VISUAL_LIMITE)) * (10 - REAL_LIMITE)
  );
}

const TICKS_REALES = [0, 2, 4, 6, 8, 10];
const TICKS_VISUALES = TICKS_REALES.map(realAVisual);

export default function RadarJugador({
  jugador,
  series,
  esArmador,
}: Props) {
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
    ? [{ id: "main", nombre: "Jugador", color: "#10B981", jugador }]
    : [];

  const esMultiple = seriesFinales.length > 1;
  const primera = seriesFinales[0];

  const datos = fundamentos.map((f) => {
    const row: Record<string, string | number> = {
      fundamento: ETIQUETAS[f],
      key: f,
    };
    for (const s of seriesFinales) {
      const real = s.jugador.valoracionPonderadaPorFundamento[f] ?? 0;
      row[s.id] = Number(realAVisual(real).toFixed(3));
    }
    return row;
  });

  return (
    <div>
      <div className="w-full" style={{ height: 380 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={datos} outerRadius="72%">
            <PolarGrid stroke="#cbd5e1" gridType="polygon" />
            <PolarAngleAxis
              dataKey="fundamento"
              tick={{
                fill: "#475569",
                fontSize: 12,
                fontWeight: 600,
              }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, VISUAL_MAX]}
              ticks={TICKS_VISUALES}
              tickFormatter={(v) => String(Math.round(visualAReal(Number(v))))}
              tick={{ fill: "#94a3b8", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            {seriesFinales.map((s) => (
              <Radar
                key={s.id}
                name={s.nombre}
                dataKey={s.id}
                stroke={s.color}
                fill={s.color}
                fillOpacity={0.15}
                strokeWidth={2}
                dot={{
                  r: 5,
                  fill: s.color,
                  stroke: "#ffffff",
                  strokeWidth: 2,
                }}
                isAnimationActive={false}
              />
            ))}
            {esMultiple && (
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                iconType="circle"
              />
            )}
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div
        className={`grid gap-2 mt-4 ${
          esArmador ? "grid-cols-3" : "grid-cols-5"
        }`}
      >
        {fundamentos.map((f) => {
          const count = primera?.jugador.porFundamento[f]?.total ?? 0;
          const valorPrimera =
            primera?.jugador.valoracionPonderadaPorFundamento[f] ?? 0;
          const nivelPrimera = nivelDeValoracion(f, valorPrimera);

          return (
            <div
              key={f}
              className="p-2 rounded border-2 text-center"
              style={{
                backgroundColor: esMultiple
                  ? "#f8fafc"
                  : BG_NIVEL[nivelPrimera],
                borderColor: esMultiple
                  ? "#cbd5e1"
                  : TEXTO_NIVEL[nivelPrimera],
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
                  : TEXTO_NIVEL[nivelDeValoracion(f, val)];
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
    </div>
  );
}