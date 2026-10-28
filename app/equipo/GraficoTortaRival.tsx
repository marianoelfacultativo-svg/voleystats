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
      <h4 className="font-semibold text-white mb-3">Puntos del rival</h4>
      {total === 0 ? (
        <p
          className="text-sm text-center py-8"
          style={{ color: "var(--sx-text-secondary)" }}
        >
          No se cargaron datos del rival en este partido
        </p>
      ) : (
        <>
          <div
            className="rounded-xl p-2"
            style={{
              background: "var(--sx-surface-1)",
              border: "1px solid var(--sx-border)",
              height: "200px",
              width: "100%",
            }}
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
                  stroke="#0F1D35"
                  strokeWidth={2}
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
                <Legend
                  wrapperStyle={{ fontSize: 11, color: "#94a3b8" }}
                  iconType="circle"
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p
            className="text-xs mt-2"
            style={{ color: "var(--sx-text-secondary)" }}
          >
            Total: {total} puntos del rival
          </p>
        </>
      )}
    </div>
  );
}