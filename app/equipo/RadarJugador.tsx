"use client";

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { EstadisticasJugador } from "@/lib/estadisticas";
import {
  nivelDeValoracion,
  type NivelValoracion,
} from "@/lib/estadisticas";

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
  saque: "S",
  recepcion: "R",
  ataque: "A",
  bloqueo: "B",
  defensa: "D",
};

const TEXTO_NIVEL: Record<NivelValoracion, string> = {
  bajo: "#F87171",
  cumple: "#FBBF24",
  bien: "#34D399",
  destaca: "#38BDF8",
};

const REAL_MIN = -2;
const REAL_MAX = 10;
const TICKS_REALES = [-2, 0, 2, 4, 6, 8, 10];

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
    ? [{ id: "main", nombre: "Jugador", color: "#10B981", jugador }]
    : [];

  const esMultiple = seriesFinales.length > 1;
  const primera = seriesFinales[0];

  const datos = fundamentos.map((f) => {
    const count = primera?.jugador.porFundamento[f]?.total ?? 0;
    const valorPrimera =
      primera?.jugador.valoracionPonderadaPorFundamento[f] ?? 0;
    const evaluado = valorPrimera > 0;
    const nivel: NivelValoracion | null = evaluado
      ? nivelDeValoracion(f, valorPrimera)
      : null;

    const row: Record<string, string | number | NivelValoracion | null> = {
      fundamento: ETIQUETAS[f],
      key: f,
      count,
      nivel,
    };
    for (const s of seriesFinales) {
      const real = s.jugador.valoracionPonderadaPorFundamento[f] ?? 0;
      const clamped = Math.max(REAL_MIN, Math.min(REAL_MAX, real));
      row[s.id] = Number(clamped.toFixed(3));
    }
    return row;
  });

  const renderTick = (props: any) => {
    const { x, y, textAnchor, index } = props;
    const fila = datos[index];
    if (!fila) return <g />;

    const nombre = fila.fundamento as string;
    const count = fila.count as number;
    const nivel = fila.nivel as NivelValoracion | null;

    const colorNombre = nivel ? TEXTO_NIVEL[nivel] : "#94A3B8";
    const colorNumero = nivel ? TEXTO_NIVEL[nivel] : "#64748B";

    return (
      <text
        x={x}
        y={y}
        textAnchor={textAnchor}
        fontSize={12}
        fontWeight={700}
      >
        <tspan fill={colorNombre}>{nombre}</tspan>
        <tspan fill={colorNumero}> ({count})</tspan>
      </text>
    );
  };

  return (
    <div className="w-full h-full flex flex-col rounded-lg p-2">
      <div className="flex-1 w-full min-h-0 relative">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={datos} outerRadius="70%">
            <PolarGrid stroke="rgba(255,255,255,0.12)" gridType="polygon" />
            <PolarAngleAxis dataKey="fundamento" tick={renderTick} />
            <PolarRadiusAxis
              angle={90}
              domain={[REAL_MIN, REAL_MAX]}
              ticks={TICKS_REALES as any}
              tickFormatter={(v) => String(v)}
              tick={{ fill: "#94a3b8", fontSize: 9 }}
              axisLine={false}
              tickLine={false}
            />
            {seriesFinales.map((s) => (
              <Radar
                key={s.id}
                name={s.nombre}
                dataKey={s.id}
                stroke={s.color}
                fill={s.color}
                fillOpacity={0.15}
                strokeWidth={2}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            ))}
            {esMultiple && (
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: "4px" }}
                iconType="circle"
              />
            )}
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}