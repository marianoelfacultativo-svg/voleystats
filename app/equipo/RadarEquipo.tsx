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

export default function RadarEquipo({ equipo, series, titulo }: Props) {
  const fundamentos = [
    "saque",
    "defensa",
    "recepcion",
    "bloqueo",
    "ataque",
  ];

  const seriesFinales: SerieRadarEquipo[] = series
    ? series
    : equipo
    ? [{ id: "main", nombre: "Equipo", color: "#F59E0B", equipo }]
    : [];

  const esMultiple = seriesFinales.length > 1;

  const datos = fundamentos.map((f) => {
    const fila: Record<string, string | number> = {
      fundamento: ETIQUETAS[f],
    };
    for (const s of seriesFinales) {
      fila[s.id] = s.equipo.valoracionPromedioNormalizado[f] ?? 0;
    }
    return fila;
  });

  const minEje = -3;
  const maxEje = 11;

  return (
    <div>
      <h4 className="font-semibold text-slate-800 mb-3">
        {titulo ?? "Perfil del equipo"}
      </h4>
      <div className="w-full h-80">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={datos} outerRadius="75%">
            <PolarGrid stroke="#C9DBC6" />
            <PolarAngleAxis
              dataKey="fundamento"
              tick={{ fill: "#2F4A3A", fontSize: 12, fontWeight: 500 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[minEje, maxEje]}
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
      </div>

      <div className="grid grid-cols-5 gap-2 mt-4">
        {fundamentos.map((f) => (
          <div
            key={f}
            className="p-2 bg-amber-50 border border-amber-200 rounded text-center"
          >
            <p className="text-xs text-amber-700">{ETIQUETAS[f]}</p>
            {seriesFinales.map((s) => {
              const val = s.equipo.valoracionPromedioNormalizado[f] ?? 0;
              return (
                <p
                  key={s.id}
                  className="font-semibold text-sm"
                  style={{ color: esMultiple ? s.color : undefined }}
                >
                  {esMultiple ? val.toFixed(2) : `${val > 0 ? "+" : ""}${val.toFixed(2)}`}
                </p>
              );
            })}
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400 mt-3 text-center">
        Valoración normalizada por fundamento.
      </p>
    </div>
  );
}