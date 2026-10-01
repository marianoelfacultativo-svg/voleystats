"use client";

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

// Transforma valor (0-10) a posición (0-100) donde 5 → 25%
function transformarParaRadar(valor: number): number {
  const v = Math.max(0, valor);
  if (v <= 5) return (v / 5) * 25;
  return 25 + ((v - 5) / 5) * 75;
}

// Inversa: posición (0-100) → valor (0-10)
function desTransformar(v: number): number {
  if (v <= 25) return (v / 25) * 5;
  return 5 + ((v - 25) / 75) * 5;
}

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

  return (
    <div>
      <div className="w-full h-96">
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
              ticks={[0, 25, 50, 75, 100]}
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
      </div>

      <div
        className={`grid gap-2 mt-4 ${
          esArmador ? "grid-cols-3" : "grid-cols-5"
        }`}
      >
        {fundamentos.map((f) => (
          <div
            key={f}
            className="p-2 bg-slate-50 border border-slate-200 rounded text-center"
          >
            <p className="text-xs text-slate-500">{ETIQUETAS[f]}</p>
            {seriesFinales.map((s) => (
              <p
                key={s.id}
                className="font-semibold text-sm"
                style={{ color: seriesFinales.length > 1 ? s.color : undefined }}
              >
                {seriesFinales.length === 1
                  ? `${
                      (s.jugador.valoracionPonderadaPorFundamento[f] ?? 0) > 0
                        ? "+"
                        : ""
                    }${(
                      s.jugador.valoracionPonderadaPorFundamento[f] ?? 0
                    ).toFixed(2)}`
                  : `${(s.jugador.valoracionPonderadaPorFundamento[f] ?? 0).toFixed(
                      2
                    )}`}
              </p>
            ))}
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400 mt-3 text-center">
        Valoración ponderada por volumen (por fundamento).
      </p>
    </div>
  );
}