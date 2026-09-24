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
  armados: "Armados",
  toque: "Toque",
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
  const fundamentosArmador = [
    "saque",
    "defensa",
    "bloqueo",
    "armados",
    "toque",
  ];

  const fundamentos = esArmador ? fundamentosArmador : fundamentosNormal;

  // Calcular max y min para la escala (sumando todos los jugadores para comparar)
  const grupo = todosJugadores && todosJugadores.length > 0
    ? todosJugadores
    : [jugador];

  let maxPos = 0;
  let maxNeg = 0;

  for (const est of grupo) {
    for (const f of fundamentos) {
      const v = est.valoracionTotalPorFundamento[f] ?? 0;
      if (v > maxPos) maxPos = v;
      if (v < maxNeg) maxNeg = v;
    }
  }

  // Redondear para que la escala no quede rarísima
  maxPos = Math.max(1, Math.ceil(maxPos));
  maxNeg = Math.min(-1, Math.floor(maxNeg));

  const datos = fundamentos.map((f) => {
    const total = jugador.valoracionTotalPorFundamento[f] ?? 0;
    const acciones = jugador.porFundamento[f]?.total ?? 0;

    return {
      fundamento: ETIQUETAS[f],
      valor: total,
      valorRaw: total,
      acciones,
    };
  });

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
              domain={[maxNeg, maxPos]}
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

      <div className="grid grid-cols-5 gap-2 mt-4">
        {datos.map((d) => (
          <div
            key={d.fundamento}
            className="p-2 bg-slate-50 border border-slate-200 rounded text-center"
          >
            <p className="text-xs text-slate-500">{d.fundamento}</p>
            <p
              className={`font-semibold text-sm ${
                d.valorRaw > 0
                  ? "text-green-700"
                  : d.valorRaw < 0
                  ? "text-red-700"
                  : "text-slate-800"
              }`}
            >
              {d.valorRaw > 0 ? "+" : ""}
              {d.valorRaw.toFixed(0)}
            </p>
            <p className="text-[10px] text-slate-400">{d.acciones} acc.</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400 mt-3 text-center">
        Suma total de valores de cada fundamento.
      </p>
    </div>
  );
}