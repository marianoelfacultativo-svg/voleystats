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

const COLORES_NIVEL_HEX: Record<NivelValoracion, string> = {
  bajo: "#dc2626",
  cumple: "#eab308",
  bien: "#16a34a",
  destaca: "#0284c7",
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

interface EjesColoreadosProps {
  cx?: number;
  cy?: number;
  outerRadius?: number;
  radius?: number;
  fundamentos?: string[];
  valoresPorFundamento?: Record<string, number>;
  accionesPorFundamento?: Record<string, number>;
}

function EjesColoreados({
  cx,
  cy,
  outerRadius,
  radius,
  fundamentos,
  valoresPorFundamento,
  accionesPorFundamento,
}: EjesColoreadosProps) {
  if (!cx || !cy || !fundamentos || fundamentos.length === 0) return null;

  const rFinal = outerRadius ?? radius ?? 0;
  if (rFinal === 0) return null;

  const n = fundamentos.length;

  return (
    <g>
      {fundamentos.map((f, i) => {
        const count = accionesPorFundamento?.[f] ?? 0;
        if (count === 0) return null;

        const valor = valoresPorFundamento?.[f] ?? 0;
        const nivel = nivelDeValoracion(f, valor);
        const color = COLORES_NIVEL_HEX[nivel];

        const angulo = -90 + (360 / n) * i;
        const rad = (angulo * Math.PI) / 180;
        const anchoMedia = (Math.PI / n) * 0.9;

        const x1 = cx + rFinal * Math.cos(rad - anchoMedia);
        const y1 = cy + rFinal * Math.sin(rad - anchoMedia);
        const x2 = cx + rFinal * Math.cos(rad + anchoMedia);
        const y2 = cy + rFinal * Math.sin(rad + anchoMedia);

        return (
          <path
            key={`sector-${f}`}
            d={`M ${cx} ${cy} L ${x1} ${y1} A ${rFinal} ${rFinal} 0 0 1 ${x2} ${y2} Z`}
            fill={color}
            opacity={0.12}
          />
        );
      })}

      {fundamentos.map((f, i) => {
        const count = accionesPorFundamento?.[f] ?? 0;
        if (count === 0) return null;

        const valor = valoresPorFundamento?.[f] ?? 0;
        const nivel = nivelDeValoracion(f, valor);
        const color = COLORES_NIVEL_HEX[nivel];

        const angulo = -90 + (360 / n) * i;
        const rad = (angulo * Math.PI) / 180;
        const x2 = cx + rFinal * Math.cos(rad);
        const y2 = cy + rFinal * Math.sin(rad);

        return (
          <line
            key={`eje-${f}`}
            x1={cx}
            y1={cy}
            x2={x2}
            y2={y2}
            stroke={color}
            strokeWidth={3}
            strokeLinecap="round"
            opacity={0.9}
          />
        );
      })}
    </g>
  );
}

export default function RadarEquipo({ equipo, series, titulo }: Props) {
  const fundamentos = [
    "saque",
    "defensa",
    "recepcion",
    "bloqueo",
    "ataque",
  ];

  const seriesFinales: SerieRadarEquipo[] = series
    ? series
    : equipo
    ? [{ id: "main", nombre: "Equipo", color: "#F59E0B", equipo }]
    : [];

  const esMultiple = seriesFinales.length > 1;

  const datos = fundamentos.map((f) => {
    const fila: Record<string, string | number> = {
      fundamento: ETIQUETAS[f],
    };
    for (const s of seriesFinales) {
      const valorOriginal = s.equipo.valoracionPromedioNormalizado[f] ?? 0;
      fila[s.id] = transformarParaRadar(valorOriginal);
    }
    return fila;
  });

  // Valores y acciones del primer equipo (para colorear los ejes)
  const primera = seriesFinales[0];
  const valoresPorFundamento: Record<string, number> = {};
  const accionesPorFundamento: Record<string, number> = {};
  for (const f of fundamentos) {
    valoresPorFundamento[f] =
      primera?.equipo.valoracionPromedioNormalizado[f] ?? 0;
    accionesPorFundamento[f] = primera?.equipo.porFundamento[f]?.total ?? 0;
  }

  return (
    <div>
      <h4 className="font-semibold text-slate-800 mb-3">
        {titulo ?? "Perfil del equipo"}
      </h4>
      <div className="w-full h-80">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={datos} outerRadius="75%">
            <PolarGrid stroke="#C9DBC6" />
            <PolarAngleAxis
              dataKey="fundamento"
              tick={{ fill: "#2F4A3A", fontSize: 12, fontWeight: 500 }}
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
                fillOpacity={esMultiple ? 0 : 0.4}
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
                <EjesColoreados
                  {...props}
                  fundamentos={fundamentos}
                  valoresPorFundamento={valoresPorFundamento}
                  accionesPorFundamento={accionesPorFundamento}
                />
              )}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-5 gap-2 mt-4">
        {fundamentos.map((f) => {
          const count = primera?.equipo.porFundamento[f]?.total ?? 0;
          return (
            <div
              key={f}
              className="p-2 bg-amber-50 border border-amber-200 rounded text-center"
            >
              <p className="text-xs text-amber-700">
                {ETIQUETAS[f]}
                <span className="text-amber-500 ml-1">({count})</span>
              </p>
              {seriesFinales.map((s) => {
                const val = s.equipo.valoracionPromedioNormalizado[f] ?? 0;
                return (
                  <p
                    key={s.id}
                    className="font-semibold text-sm"
                    style={{ color: esMultiple ? s.color : undefined }}
                  >
                    {esMultiple
                      ? val.toFixed(2)
                      : `${val > 0 ? "+" : ""}${val.toFixed(2)}`}
                  </p>
                );
              })}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-400 mt-3 text-center">
        Valoración normalizada por fundamento. Cada eje se colorea según su nivel.
      </p>
    </div>
  );
}