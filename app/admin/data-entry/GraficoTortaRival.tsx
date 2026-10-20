"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface Props {
  erroresRivales: number;
  buenasRivales: number;
}

export default function GraficoTortaRival({
  erroresRivales,
  buenasRivales,
}: Props) {
  const total = erroresRivales + buenasRivales;

  const datos = [
    { name: "Buenas rivales", value: buenasRivales, color: "#3b82f6" },
    { name: "Errores rivales", value: erroresRivales, color: "#ef4444" },
  ].filter((d) => d.value > 0);

  return (
    <div>
      <h4 className="font-semibold text-slate-800 mb-3">Puntos del rival</h4>
      {total === 0 ? (
        <p className="text-sm text-slate-500 text-center py-8">
          No se cargaron datos del rival en este partido
        </p>
      ) : (
        <>
          <div
            className="bg-white border border-slate-200 rounded-lg p-2"
            style={{ height: "200px", width: "100%" }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={datos}
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={65}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {datos.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [
                    `${value} (${Math.round(
                      (Number(value) / total) * 100
                    )}%)`,
                    name,
                  ]}
                  labelStyle={{ fontSize: 12 }}
                  contentStyle={{ fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Total: {total} puntos del rival
          </p>
        </>
      )}
    </div>
  );
}