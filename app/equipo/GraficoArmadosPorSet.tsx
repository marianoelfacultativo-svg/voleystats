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
import type { PromedioArmadosSet } from "@/lib/estadisticas";

export interface SerieArmados {
  id: string;
  nombre: string;
  color: string;
  promedios: PromedioArmadosSet[];
}

interface Props {
  promedios?: PromedioArmadosSet[];
  series?: SerieArmados[];
}

export default function GraficoArmadosPorSet({ promedios, series }: Props) {
  const seriesFinales: SerieArmados[] = series
    ? series
    : promedios
    ? [{ id: "main", nombre: "Armados", color: "#8b5cf6", promedios }]
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
    s.promedios.some((p) => p.totalArmados > 0)
  );

  return (
    <div>
      <h4 className="font-semibold text-slate-800 mb-3">
        Calidad de armado por set
      </h4>
      {!hayDatos ? (
        <p className="text-sm text-slate-500 text-center py-8">
          Todavía no hay armados cargados
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
                  domain={[1, 5]}
                  ticks={[1, 2, 3, 4, 5]}
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
            Escala: 1 (Horrible) a 5 (Perfecto). Promedio de cada set.
          </p>
        </>
      )}
    </div>
  );
}