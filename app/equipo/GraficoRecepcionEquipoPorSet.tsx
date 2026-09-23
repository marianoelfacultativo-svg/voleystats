"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { PromedioRecepcionSet } from "@/lib/estadisticas";

interface Props {
  promedios: PromedioRecepcionSet[];
}

export default function GraficoRecepcionEquipoPorSet({ promedios }: Props) {
  const datos = promedios.map((p) => ({
    set: `Set ${p.set}`,
    promedio: Number(p.promedio.toFixed(1)),
    totalRecepciones: p.totalRecepciones,
  }));

  const hayDatos = promedios.some((p) => p.totalRecepciones > 0);

  return (
    <div>
      <h4 className="font-semibold text-slate-800 mb-3">
        Recepción del equipo por set
      </h4>
      {!hayDatos ? (
        <p className="text-sm text-slate-500 text-center py-8">
          No hay recepciones en este partido
        </p>
      ) : (
        <>
          <div
            className="bg-white border border-slate-200 rounded-lg p-2"
            style={{ height: "200px", width: "100%" }}
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
                <Line
                  type="monotone"
                  dataKey="promedio"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ fill: "#10b981", r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Escala: 0 (Ace en contra) a 5 (2x Positiva). Promedio del equipo
            (sin armadores).
          </p>
        </>
      )}
    </div>
  );
}