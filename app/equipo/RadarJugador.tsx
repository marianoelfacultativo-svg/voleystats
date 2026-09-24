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
  equipo: EstadisticasJugador;
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

export default function RadarJugador({ jugador, equipo, esArmador }: Props) {
  // ORDEN: sentido horario desde arriba
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

  const datos = fundamentos.map((f) => {
    const valJug = jugador.valoracionPorFundamento[f] ?? 0;
    const valEq = equipo.valoracionPorFundamento[f] ?? 0;
    const acciones = jugador.porFundamento[f]?.total ?? 0;

    return {
      fundamento: ETIQUETAS[f],
      valor: valJug,
      valorRaw: valJug,
      valorEquipo: valEq,
      acciones,
    };
  });

  const minEje = -8;
  const maxEje = 5;

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
          esArmador ? "grid-cols-5" : "grid-cols-5"
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
                d.valorRaw > 0
                  ? "text-green-700"
                  : d.valorRaw < 0
                  ? "text-red-700"
                  : "text-slate-800"
              }`}
            >
              {d.valorRaw > 0 ? "+" : ""}
              {d.valorRaw.toFixed(1)}
            </p>
            <p className="text-[10px] text-slate-400">{d.acciones} acc.</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400 mt-3 text-center">
        El radar muestra la <strong>valoración media</strong> de cada
        fundamento. Escala: -8 a +5.
      </p>
    </div>
  );
}