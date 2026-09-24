"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { PromedioPorSet } from "@/lib/estadisticas";

interface Props {
  promedios: PromedioPorSet[];
}

export default function GraficoSaquePorSet({ promedios }: Props) {
  const datos = promedios.map((p) => ({
    set: `Set ${p.set}`,
    promedio: Number(p.promedio.toFixed(1)),
    total: p.total,
  }));

  const hayDatos = promedios.some((p) => p.total > 0);

  return (
    <div>
      <h4 className="font-semibold text-slate-800 mb-3">Saque por set</h4>
      {!hayDatos ? (
        <p className="text-sm text-slate-500 text-center py-8">
          Todavía no hay saques cargados
        </p>
      ) : (
        <>
          <div
            className="bg-white border border-slate-200 rounded-lg p-2"
            style={{ height: "200px", width: "100%", maxWidth: "280px" }}
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
                  domain={[-2, 5]}
                  ticks={[-2, -1, 0, 1, 2, 3, 4, 5]}
                  tick={{ fill: "#64748b", fontSize: 10 }}
                />
                <Tooltip
                  labelStyle={{ fontSize: 12 }}
                  contentStyle={{ fontSize: 12 }}
                />
                <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={1} />
                <Line
                  type="monotone"
                  dataKey="promedio"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: "#3b82f6", r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Escala: -2 (Error) a 5 (Ace).
          </p>
        </>
      )}
    </div>
  );
}