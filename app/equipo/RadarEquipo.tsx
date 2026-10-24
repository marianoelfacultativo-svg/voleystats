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
// Escala LINEAL y SIMÉTRICA:
//
//   Real -2  → centro del radar
//   Real  0  → 1/6 del radio
//   Real  2  → 2/6 del radio
//   Real  4  → 3/6 del radio
//   Real  6  → 4/6 del radio
//   Real  8  → 5/6 del radio
//   Real 10  → borde
//
// Cada tramo de 2 unidades reales ocupa exactamente lo mismo.
// ------------------------------------------------------------

const REAL_MIN = -2;
const REAL_MAX = 10;

// Ticks visibles (7 valores → 6 tramos iguales).
const TICKS_REALES = [-2, 0, 2, 4, 6, 8, 10];

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
      // Clampeamos al rango [REAL_MIN, REAL_MAX] para evitar que un
      // valor fuera de rango deforme el radar.
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
            <PolarAngleAxis dataKey="fundamento" tick={renderTick} />
            <PolarRadiusAxis
              angle={90}
              domain={[REAL_MIN, REAL_MAX]}
              ticks={TICKS_REALES as any}
              tickFormatter={(v) => String(v)}
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
              <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
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
    </div>
  );
}