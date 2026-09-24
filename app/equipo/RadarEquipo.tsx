"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import type { EstadisticasJugador } from "@/lib/estadisticas";

interface Props {
  equipo: EstadisticasJugador;
}

const ETIQUETAS: Record<string, string> = {
  saque: "Saque",
  recepcion: "Recepción",
  ataque: "Ataque",
  bloqueo: "Bloqueo",
  defensa: "Defensa",
};

export default function RadarEquipo({ equipo }: Props) {
  const fundamentos = [
    "saque",
    "defensa",
    "recepcion",
    "bloqueo",
    "ataque",
  ];

  const datos = fundamentos.map((f) => {
    const total = equipo.valoracionTotalPorFundamento[f] ?? 0;
    const acciones = equipo.porFundamento[f]?.total ?? 0;

    return {
      fundamento: ETIQUETAS[f],
      valor: total,
      valorRaw: total,
      acciones,
    };
  });

  // Escala dinámica según los valores del equipo
  const valores = datos.map((d) => d.valorRaw);
  const maxPos = Math.max(1, Math.ceil(Math.max(0, ...valores)));
  const maxNeg = Math.min(-1, Math.floor(Math.min(0, ...valores)));

  return (
    <div>
      <h4 className="font-semibold text-slate-800 mb-3">Perfil del equipo</h4>
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
              domain={[maxNeg, maxPos]}
              tick={{ fill: "#8FA398", fontSize: 10 }}
            />
            <Radar
              name="Equipo"
              dataKey="valor"
              stroke="#F59E0B"
              fill="#F59E0B"
              fillOpacity={0.4}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-5 gap-2 mt-4">
        {datos.map((d) => (
          <div
            key={d.fundamento}
            className="p-2 bg-amber-50 border border-amber-200 rounded text-center"
          >
            <p className="text-xs text-amber-700">{d.fundamento}</p>
            <p
              className={`font-semibold text-sm ${
                d.valorRaw > 0
                  ? "text-green-700"
                  : d.valorRaw < 0
                  ? "text-red-700"
                  : "text-amber-900"
              }`}
            >
              {d.valorRaw > 0 ? "+" : ""}
              {d.valorRaw.toFixed(0)}
            </p>
            <p className="text-[10px] text-amber-600">{d.acciones} acc.</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-400 mt-3 text-center">
        Suma total de valores del equipo.
      </p>
    </div>
  );
}