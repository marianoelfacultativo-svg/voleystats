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
  jugador: EstadisticasJugador;
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

export default function RadarJugador({
  jugador,
  todosJugadores,
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

  const grupo =
    todosJugadores && todosJugadores.length > 0 ? todosJugadores : [jugador];

  // Máximo del equipo por fundamento
  const maxPorFundamento: Record<string, number> = {};
  for (const f of fundamentos) {
    let max = 0;
    for (const est of grupo) {
      const v = est.valoracionTotalPorFundamento[f] ?? 0;
      if (v > max) max = v;
    }
    maxPorFundamento[f] = max;
  }

  // Normalizar a escala 0-100 (relativo al máximo del equipo)
  const datos = fundamentos.map((f) => {
    const real = jugador.valoracionTotalPorFundamento[f] ?? 0;
    const max = maxPorFundamento[f];
    let normalizado = max > 0 ? (real / max) * 100 : 0;

    return {
      fundamento: ETIQUETAS[f],
      valor: normalizado,
      valorReal: real,
      acciones: jugador.porFundamento[f]?.total ?? 0,
    };
  });

  const minEje = -25;
  const maxEje = 110;

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
              domain={[minEje, maxEje]}
              tick={{ fill: "#8FA398", fontSize: 10 }}
            />
            <Radar
              name={jugador.jugador_id}
              dataKey="valor"
              stroke="#10B981"
              fill="#10B981"
              fillOpacity={0.45}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div
        className={`grid gap-2 mt-4 ${
          esArmador ? "grid-cols-3" : "grid-cols-5"
        }`}
      >
        {datos.map((d) => (
          <div
            key={d.fundamento}
            className="p-2 bg-slate-50 border border-slate-200 rounded text-center"
          >
            <p className="text-xs text-slate-500">{d.fundamento}</p>
            <p
              className={`font-semibold text-sm ${
                d.valorReal > 0
                  ? "text-green-700"
                  : d.valorReal < 0
                  ? "text-red-700"
                  : "text-slate-800"
              }`}
            >
              {d.valorReal > 0 ? "+" : ""}
              {d.valorReal.toFixed(0)}
            </p>
            <p className="text-[10px] text-slate-400">
              {d.valor.toFixed(0)}% · {d.acciones} acc.
            </p>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400 mt-3 text-center">
        Escala -25 a 110. Cada eje es el valor del jugador relativo al{" "}
        <strong>máximo del equipo</strong>.
      </p>
    </div>
  );
}