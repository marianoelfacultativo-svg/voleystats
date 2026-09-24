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
import type { PromedioPorSet } from "@/lib/estadisticas";

export interface SerieRecepcion {
  id: string;
  nombre: string;
  color: string;
  promedios: PromedioPorSet[];
}

interface Props {
  promedios?: PromedioPorSet[];
  series?: SerieRecepcion[];
}

export default function GraficoRecepcionPorSet({ promedios, series }: Props) {
  const seriesFinales: SerieRecepcion[] = series
    ? series
    : promedios
    ? [{ id: "main", nombre: "Recepción", color: "#10b981", promedios }]
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
    s.promedios.some((p) => p.total > 0)
  );

  return (
    <div>
      <h4 className="font-semibold text-slate-800 mb-3">
        Calidad de recepción por set
      </h4>
      {!hayDatos ? (
        <p className="text-sm text-slate-500 text-center py-8">
          Todavía no hay recepciones cargadas
        </p>
      ) : (
        <>
          <div
            className="bg-white border border-slate-200 rounded-lg p-2"
            style={{ height: esMultiple ? "220px" : "200px", width: "100%" }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={datos}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis
                  dataKey="set"
                  tick={{ fill: "#64748b", fontSize: 10 }}
                />
                <YAxis
                  domain={[0, 5]}
                  ticks={[0, 1, 2, 3, 4, 5]}
                  tick={{ fill: "#64748b", fontSize: 10 }}
                />
                <Tooltip
                  labelStyle={{ fontSize: 12 }}
                  contentStyle={{ fontSize: 12 }}
                />
                {seriesFinales.map((s) => (
                  <Line
                    key={s.id}
                    type="monotone"
                    dataKey={s.id}
                    name={s.nombre}
                    stroke={s.color}
                    strokeWidth={2}
                    dot={{ fill: s.color, r: 4 }}
                  />
                ))}
                {esMultiple && (
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    iconType="line"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Escala: 0 (Ace en contra) a 5 (2x Positiva). Ponderado por volumen.
          </p>
        </>
      )}
    </div>
  );
}