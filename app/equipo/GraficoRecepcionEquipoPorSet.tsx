"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { PromedioRecepcionSet } from "@/lib/estadisticas";

export interface SerieRecepcionEquipo {
  id: string;
  nombre: string;
  color: string;
  promedios: PromedioRecepcionSet[];
}

interface Props {
  promedios?: PromedioRecepcionSet[];
  series?: SerieRecepcionEquipo[];
}

export default function GraficoRecepcionEquipoPorSet({
  promedios,
  series,
}: Props) {
  const seriesFinales: SerieRecepcionEquipo[] = series
    ? series
    : promedios
    ? [{ id: "main", nombre: "Equipo", color: "#10b981", promedios }]
    : [];

  const esMultiple = seriesFinales.length > 1;

  const datos = [1, 2, 3, 4, 5].map((s) => {
    const fila: Record<string, string | number> = { set: `Set ${s}` };
    for (const serie of seriesFinales) {
      const p = serie.promedios.find((x) => x.set === s);
      fila[serie.id] = p ? Number(p.promedio.toFixed(1)) : 0;
    }
    return fila;
  });

  const hayDatos = seriesFinales.some((s) =>
    s.promedios.some((p) => p.totalRecepciones > 0)
  );

  return (
    <div>
      <h4 className="font-semibold text-white mb-3">
        Recepción del equipo por set
      </h4>
      {!hayDatos ? (
        <p
          className="text-sm text-center py-8"
          style={{ color: "var(--sx-text-secondary)" }}
        >
          No hay recepciones
        </p>
      ) : (
        <>
          <div
            className="rounded-xl p-2"
            style={{
              background: "var(--sx-surface-1)",
              border: "1px solid var(--sx-border)",
              height: esMultiple ? "220px" : "200px",
              width: "100%",
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={datos}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  stroke="rgba(255,255,255,0.08)"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="set"
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  tickLine={{ stroke: "rgba(255,255,255,0.1)" }}
                />
                <YAxis
                  domain={[0, 10]}
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  tickLine={{ stroke: "rgba(255,255,255,0.1)" }}
                />
                <Tooltip
                  labelStyle={{ color: "#94a3b8", fontSize: 12 }}
                  contentStyle={{
                    backgroundColor: "#0F1D35",
                    borderColor: "rgba(255,255,255,0.15)",
                    borderRadius: "8px",
                    color: "#F0F4FF",
                    fontSize: 12,
                  }}
                  itemStyle={{ color: "#F0F4FF" }}
                />
                {seriesFinales.map((s) => (
                  <Line
                    key={s.id}
                    type="monotone"
                    dataKey={s.id}
                    name={s.nombre}
                    stroke={s.color}
                    strokeWidth={2.5}
                    dot={{
                      fill: s.color,
                      r: 4,
                      stroke: "#0F1D35",
                      strokeWidth: 1.5,
                    }}
                    activeDot={{ r: 6 }}
                  />
                ))}
                {esMultiple && (
                  <Legend
                    wrapperStyle={{ fontSize: 11, color: "#94a3b8" }}
                    iconType="line"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p
            className="text-xs mt-2"
            style={{ color: "var(--sx-text-secondary)" }}
          >
            Escala: 0 (Ace en contra) a 10 (2x Positiva).
          </p>
        </>
      )}
    </div>
  );
}