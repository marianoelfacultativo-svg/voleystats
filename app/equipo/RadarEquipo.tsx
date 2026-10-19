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

export interface SerieRadarEquipo {
  id: string;
  nombre: string;
  color: string;
  equipo: EstadisticasJugador;
}

interface Props {
  equipo?: EstadisticasJugador;
  series?: SerieRadarEquipo[];
  titulo?: string;
}

const ETIQUETAS: Record<string, string> = {
  saque: "Saque",
  recepcion: "Recepción",
  ataque: "Ataque",
  bloqueo: "Bloqueo",
  defensa: "Defensa",
};

const BG_NIVEL: Record<NivelValoracion, string> = {
  bajo: "#fee2e2",
  cumple: "#fef9c3",
  bien: "#dcfce7",
  destaca: "#dbeafe",
};

const TEXTO_NIVEL: Record<NivelValoracion, string> = {
  bajo: "#dc2626",
  cumple: "#eab308",
  bien: "#16a34a",
  destaca: "#0284c7",
};

// ------------------------------------------------------------
// Escala no lineal: 0-6 ocupa 35% del radio, 6-10 ocupa 65%.
// ------------------------------------------------------------

const VISUAL_MAX = 10;
const FRACCION_LIMITE = 0.35;
const REAL_LIMITE = 6;
const VISUAL_LIMITE = VISUAL_MAX * FRACCION_LIMITE; // 3.5

function realAVisual(v: number): number {
  if (v <= REAL_LIMITE) return (v / REAL_LIMITE) * VISUAL_LIMITE;
  return (
    VISUAL_LIMITE +
    ((v - REAL_LIMITE) / (10 - REAL_LIMITE)) * (VISUAL_MAX - VISUAL_LIMITE)
  );
}

function visualAReal(v: number): number {
  if (v <= VISUAL_LIMITE) return (v / VISUAL_LIMITE) * REAL_LIMITE;
  return (
    REAL_LIMITE +
    ((v - VISUAL_LIMITE) / (VISUAL_MAX - VISUAL_LIMITE)) * (10 - REAL_LIMITE)
  );
}

const TICKS_REALES = [0, 2, 4, 6, 8, 10];
const TICKS_VISUALES = TICKS_REALES.map(realAVisual);

const FUNDAMENTOS_EQUIPO = [
  "saque",
  "defensa",
  "recepcion",
  "bloqueo",
  "ataque",
];

export default function RadarEquipo({ equipo, series, titulo }: Props) {
  const seriesFinales: SerieRadarEquipo[] = series
    ? series
    : equipo
    ? [{ id: "main", nombre: "Equipo", color: "#F59E0B", equipo }]
    : [];

  const esMultiple = seriesFinales.length > 1;
  const primera = seriesFinales[0];

  const datos = FUNDAMENTOS_EQUIPO.map((f) => {
    const count = primera?.equipo.porFundamento[f]?.total ?? 0;
    const valorPrimera =
      primera?.equipo.valoracionPonderadaPorFundamento[f] ?? 0;
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
      const real = s.equipo.valoracionPonderadaPorFundamento[f] ?? 0;
      row[s.id] = Number(realAVisual(real).toFixed(3));
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

    const colorNombre = nivel ? TEXTO_NIVEL[nivel] : "#475569";
    const colorNumero = nivel ? TEXTO_NIVEL[nivel] : "#94a3b8";

    return (
      <text
        x={x}
        y={y}
        textAnchor={textAnchor}
        fontSize={12}
        fontWeight={600}
      >
        <tspan fill={colorNombre}>{nombre}</tspan>
        <tspan fill={colorNumero}> ({count})</tspan>
      </text>
    );
  };

  return (
    <div>
      <h4 className="font-semibold text-slate-800 mb-3">
        {titulo ?? "Perfil del equipo"}
      </h4>

      <div className="w-full" style={{ height: 380 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={datos} outerRadius="72%">
            <PolarGrid stroke="#cbd5e1" gridType="polygon" />
            <PolarAngleAxis
              dataKey="fundamento"
              tick={renderTick}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, VISUAL_MAX]}
              ticks={TICKS_VISUALES as any}
              tickFormatter={(v) =>
                String(Math.round(visualAReal(Number(v))))
              }
              tick={{ fill: "#94a3b8", fontSize: 10 }}
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
                wrapperStyle={{ fontSize: 12 }}
                iconType="circle"
              />
            )}
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-5 gap-2 mt-4">
        {FUNDAMENTOS_EQUIPO.map((f) => {
          const count = primera?.equipo.porFundamento[f]?.total ?? 0;
          const valorPrimera =
            primera?.equipo.valoracionPonderadaPorFundamento[f] ?? 0;
          const evaluadoPrimera = valorPrimera > 0;
          const nivelPrimera = nivelDeValoracion(f, valorPrimera);

          return (
            <div
              key={f}
              className="p-2 rounded border-2 text-center"
              style={{
                backgroundColor: esMultiple
                  ? "#f8fafc"
                  : evaluadoPrimera
                  ? BG_NIVEL[nivelPrimera]
                  : "#f1f5f9",
                borderColor: esMultiple
                  ? "#cbd5e1"
                  : evaluadoPrimera
                  ? TEXTO_NIVEL[nivelPrimera]
                  : "#cbd5e1",
              }}
            >
              <p
                className={`text-xs font-medium ${
                  evaluadoPrimera ? "text-slate-500" : "text-slate-400"
                }`}
              >
                {ETIQUETAS[f]}
                <span className="ml-1">{`(${count})`}</span>
              </p>
              {seriesFinales.map((s) => {
                const val =
                  s.equipo.valoracionPonderadaPorFundamento[f] ?? 0;
                const evaluado = val > 0;
                const colorText = evaluado
                  ? esMultiple
                    ? s.color
                    : TEXTO_NIVEL[nivelDeValoracion(f, val)]
                  : "#94a3b8";
                return (
                  <p
                    key={s.id}
                    className="font-bold text-sm"
                    style={{ color: colorText }}
                  >
                    {evaluado
                      ? `${val > 0 ? "+" : ""}${val.toFixed(2)}`
                      : "—"}
                  </p>
                );
              })}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-400 mt-3 text-center">
        Cada vértice usa el promedio de valoración ponderada de los jugadores
        del equipo en ese fundamento.
      </p>
    </div>
  );
}