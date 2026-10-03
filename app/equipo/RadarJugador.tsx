"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Customized,
} from "recharts";
import type { EstadisticasJugador } from "@/lib/estadisticas";
import {
  nivelDeValoracion,
  COLORES_NIVEL_CLASES,
} from "@/lib/estadisticas";
import LeyendaColores from "./LeyendaColores";

export interface SerieRadar {
  id: string;
  nombre: string;
  color: string;
  jugador: EstadisticasJugador;
}

interface Props {
  jugador?: EstadisticasJugador;
  series?: SerieRadar[];
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

// Cortes de nivel por fundamento (idénticos a CORTES_NIVEL en estadisticas.ts)
const CORTES_POR_FUNDAMENTO: Record<
  string,
  { valor: number; color: string }[]
> = {
  saque: [
    { valor: 7.5, color: "#0284c7" },
    { valor: 6.0, color: "#16a34a" },
    { valor: 4.0, color: "#eab308" },
  ],
  recepcion: [
    { valor: 8.0, color: "#0284c7" },
    { valor: 6.5, color: "#16a34a" },
    { valor: 4.0, color: "#eab308" },
  ],
  ataque: [
    { valor: 7.5, color: "#0284c7" },
    { valor: 5.5, color: "#16a34a" },
    { valor: 3.5, color: "#eab308" },
  ],
  bloqueo: [
    { valor: 7.5, color: "#0284c7" },
    { valor: 5.5, color: "#16a34a" },
    { valor: 3.5, color: "#eab308" },
  ],
  defensa: [
    { valor: 7.5, color: "#0284c7" },
    { valor: 6.0, color: "#16a34a" },
    { valor: 4.0, color: "#eab308" },
  ],
};

function transformarParaRadar(valor: number): number {
  const v = Math.max(0, valor);
  if (v <= 5) return (v / 5) * 25;
  return 25 + ((v - 5) / 5) * 75;
}

function desTransformar(v: number): number {
  if (v <= 25) return (v / 25) * 5;
  return 5 + ((v - 25) / 75) * 5;
}

interface CortesProps {
  cx?: number;
  cy?: number;
  radius?: number;
  outerRadius?: number;
  fundamentos?: string[];
  accionesPorFundamento?: Record<string, number>;
}

function CortesRadar({
  cx,
  cy,
  radius,
  outerRadius,
  fundamentos,
  accionesPorFundamento,
}: CortesProps) {
  if (
    !cx ||
    !cy ||
    !fundamentos ||
    fundamentos.length === 0
  )
    return null;

  const rFinal = outerRadius ?? radius ?? 0;
  if (rFinal === 0) return null;

  const n = fundamentos.length;
  const anchoAngulo = 0.16;

  return (
    <g>
      {fundamentos.map((f, i) => {
        const count = accionesPorFundamento?.[f] ?? 0;
        if (count === 0) return null;

        const cortes = CORTES_POR_FUNDAMENTO[f] ?? [];
        const angulo = -90 + (360 / n) * i;
        const rad = (angulo * Math.PI) / 180;

        return cortes.map((c, j) => {
          const posRadar = transformarParaRadar(c.valor);
          const r = (rFinal * posRadar) / 100;
          const x1 = cx + r * Math.cos(rad - anchoAngulo);
          const y1 = cy + r * Math.sin(rad - anchoAngulo);
          const x2 = cx + r * Math.cos(rad + anchoAngulo);
          const y2 = cy + r * Math.sin(rad + anchoAngulo);
          return (
            <path
              key={`corte-${i}-${j}`}
              d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`}
              stroke={c.color}
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
              opacity={0.85}
            />
          );
        });
      })}
    </g>
  );
}

export default function RadarJugador({
  jugador,
  series,
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

  const seriesFinales: SerieRadar[] = series
    ? series
    : jugador
    ? [
        {
          id: "main",
          nombre: "Jugador",
          color: "#10B981",
          jugador,
        },
      ]
    : [];

  const esMultiple = seriesFinales.length > 1;

  const datos = fundamentos.map((f) => {
    const fila: Record<string, string | number> = {
      fundamento: ETIQUETAS[f],
    };
    for (const s of seriesFinales) {
      const valorOriginal =
        s.jugador.valoracionPonderadaPorFundamento[f] ?? 0;
      fila[s.id] = transformarParaRadar(valorOriginal);
    }
    return fila;
  });

  // Cantidad de acciones por fundamento (del primer jugador, para los cortes)
  const accionesPorFundamento: Record<string, number> = {};
  const primera = seriesFinales[0];
  if (primera) {
    for (const f of fundamentos) {
      accionesPorFundamento[f] = primera.jugador.porFundamento[f]?.total ?? 0;
    }
  }

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
              domain={[0, 100]}
              tickCount={5}
              tickFormatter={(v) => desTransformar(v as number).toFixed(1)}
              tick={{ fill: "#8FA398", fontSize: 10 }}
            />
            {seriesFinales.map((s) => (
              <Radar
                key={s.id}
                name={s.nombre}
                dataKey={s.id}
                stroke={s.color}
                fill={s.color}
                fillOpacity={esMultiple ? 0 : 0.45}
                strokeWidth={esMultiple ? 3 : 2}
              />
            ))}
            {esMultiple && (
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                iconType="line"
              />
            )}
            <Customized
              component={(props: any) => (
                <CortesRadar
                  {...props}
                  fundamentos={fundamentos}
                  accionesPorFundamento={accionesPorFundamento}
                />
              )}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Cuadros de valores con color por nivel */}
      <div
        className={`grid gap-2 mt-4 ${
          esArmador ? "grid-cols-3" : "grid-cols-5"
        }`}
      >
        {fundamentos.map((f) => {
          const valor =
            primera?.jugador.valoracionPonderadaPorFundamento[f] ?? 0;
          const nivel = nivelDeValoracion(f, valor);
          const col = COLORES_NIVEL_CLASES[nivel];
          const count = primera?.jugador.porFundamento[f]?.total ?? 0;

          return (
            <div
              key={f}
              className={`p-2 rounded border-2 text-center ${col.bg} ${col.border}`}
            >
              <p className="text-xs text-slate-500 font-medium">
                {ETIQUETAS[f]}
                <span className="text-slate-400 ml-1">
                  ({count})
                </span>
              </p>
              {seriesFinales.map((s) => {
                const val =
                  s.jugador.valoracionPonderadaPorFundamento[f] ?? 0;
                const nivelS = nivelDeValoracion(f, val);
                const colS = COLORES_NIVEL_CLASES[nivelS];
                return (
                  <p
                    key={s.id}
                    className={`font-bold text-sm ${colS.text}`}
                  >
                    {val > 0 ? "+" : ""}
                    {val.toFixed(2)}
                  </p>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Leyenda de colores */}
      <div className="mt-4">
        <LeyendaColores />
      </div>

      <p className="text-xs text-slate-400 mt-3 text-center">
        Valoración ponderada por volumen (por fundamento).
      </p>
    </div>
  );
}