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
};

export default function RadarJugador({ jugador, equipo, esArmador }: Props) {
  const fundamentos = esArmador
    ? ["saque", "bloqueo", "defensa"]
    : ["saque", "recepcion", "ataque", "bloqueo", "defensa"];

  const datos = fundamentos.map((f) => {
    const ej = jugador.porFundamento[f];
    const ee = equipo.porFundamento[f];
    const accionesMax = Math.max(ee?.total ?? 0, 1);
    const factorVolumen = Math.sqrt((ej?.total ?? 0) / accionesMax);
    const efectividad = ej?.efectividad ?? 0;
    const valorJugador = efectividad * factorVolumen;

    return {
      fundamento: ETIQUETAS[f],
      valor: Math.max(0, valorJugador),
      valorRaw: valorJugador,
      acciones: ej?.total ?? 0,
    };
  });

  const maxEje = 100;

  return (
    <div>
      <div className="w-full h-80">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={datos}>
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis
              dataKey="fundamento"
              tick={{ fill: "#475569", fontSize: 12 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, maxEje]}
              tick={{ fill: "#94a3b8", fontSize: 10 }}
            />
            <Radar
              name={jugador.jugador_id}
              dataKey="valor"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.4}
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
            <p className="font-semibold text-slate-800 text-sm">
              {d.valorRaw > 0 ? "+" : ""}
              {d.valorRaw.toFixed(0)}
            </p>
            <p className="text-[10px] text-slate-400">{d.acciones} acc.</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400 mt-3 text-center">
        El tamaño del radar refleja <strong>volumen + efectividad</strong>.
      </p>
    </div>
  );
}