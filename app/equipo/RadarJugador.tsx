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
  nombreEquipo: string;
}

const FUNDAMENTOS = ["saque", "recepcion", "ataque", "bloqueo", "defensa"];
const ETIQUETAS: Record<string, string> = {
  saque: "Saque",
  recepcion: "Recepción",
  ataque: "Ataque",
  bloqueo: "Bloqueo",
  defensa: "Defensa",
};

export default function RadarJugador({ jugador, equipo }: Props) {
  // Para cada fundamento, calculamos el "valor" del jugador
  // Valor = efectividad × factor_volumen (relativo al equipo)
  // factor_volumen = √(acciones_jugador / acciones_max_equipo_en_fundamento)
  // El eje va de 0 al máximo del equipo (así el jugador con más valor toca el borde)

  const datos = FUNDAMENTOS.map((f) => {
    const ej = jugador.porFundamento[f];
    const ee = equipo.porFundamento[f];

    // Factor de volumen: qué tan cerca está su volumen del máximo del equipo en ese fundamento
    const accionesMax = Math.max(ee.total, 1);
    const factorVolumen = Math.sqrt(ej.total / accionesMax);

    // Valor combinado
    // Si tiene efectividad negativa, el valor es negativo (queda cerca del centro)
    // Escalamos para que quepa de 0 a 100 aprox
    const valorJugador = ej.efectividad * factorVolumen;

    return {
      fundamento: ETIQUETAS[f],
      valor: Math.max(0, valorJugador),
      valorRaw: valorJugador,
      acciones: ej.total,
      efectividad: ej.efectividad,
    };
  });

  // El máximo del eje es el máximo del equipo (calculado igual para todos)
  // Para simplicidad, usamos un máximo de 100 (efectividad perfecta con volumen completo)
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

      {/* Detalle por eje */}
      <div className="grid grid-cols-5 gap-2 mt-4">
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
        Pocas acciones = cerca del centro, aunque tengas buena efectividad.
      </p>
    </div>
  );
}