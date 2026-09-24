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

export default function RadarJugador({ jugador, esArmador }: Props) {
  const fundamentosNormal = [
    "saque",
    "defensa",
    "recepcion",
    "bloqueo",
    "ataque",
  ];
  const fundamentosArmador = ["saque", "defensa", "bloqueo"];

  const fundamentos = esArmador ? fundamentosArmador : fundamentosNormal;

  const datos = fundamentos.map((f) => {
    const norm = jugador.valoracionPromedioNormalizado[f] ?? 0;
    const real = jugador.valoracionPorFundamento[f] ?? 0;
    const acciones = jugador.porFundamento[f]?.total ?? 0;

    return {
      fundamento: ETIQUETAS[f],
      valor: norm,
      valorNorm: norm,
      valorReal: real,
      acciones,
    };
  });

  const minEje = -3;
  const maxEje = 11;

  return (
    <div>
      <div className="w-full h-[500px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={datos} outerRadius="85%">
            <PolarGrid stroke="#C9DBC6" />
            <PolarAngleAxis
              dataKey="fundamento"
              tick={{ fill: "#2F4A3A", fontSize: 14, fontWeight: 600 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[minEje, maxEje]}
              tick={{ fill: "#8FA398", fontSize: 11 }}
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
                d.valorNorm > 0
                  ? "text-green-700"
                  : d.valorNorm < 0
                  ? "text-red-700"
                  : "text-slate-800"
              }`}
            >
              {d.valorNorm > 0 ? "+" : ""}
              {d.valorNorm.toFixed(2)}
            </p>
            <p className="text-[10px] text-slate-400">{d.acciones} acc.</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400 mt-3 text-center">
        Valoración normalizada por fundamento.
      </p>
    </div>
  );
}