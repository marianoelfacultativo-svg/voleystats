"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface Props {
  fundamento: string;
  positivas: number;
  neutras: number;
  negativas: number;
  tituloOverride?: string;
}

const NOMBRES: Record<string, string> = {
  saque: "Saque",
  recepcion: "Recepción",
  ataque: "Ataque",
  bloqueo: "Bloqueo",
  defensa: "Defensa",
};

const LABEL_POS: Record<string, string> = {
  saque: "Puntos",
  ataque: "Puntos",
  recepcion: "Positivas",
  bloqueo: "Positivas",
  defensa: "Positivas",
};

const LABEL_NEG: Record<string, string> = {
  saque: "Errores",
  ataque: "Errores",
  recepcion: "Negativas",
  bloqueo: "Negativas",
  defensa: "Negativas",
};

const COLOR_POS = "#16a34a";
const COLOR_NEU = "#94a3b8";
const COLOR_NEG = "#dc2626";

export default function GraficoBarrasFundamento({
  fundamento,
  positivas,
  neutras,
  negativas,
  tituloOverride,
}: Props) {
  const titulo = tituloOverride ?? NOMBRES[fundamento] ?? fundamento;
  const labelPos = LABEL_POS[fundamento] ?? "Positivas";
  const labelNeg = LABEL_NEG[fundamento] ?? "Negativas";

  const total = positivas + neutras + negativas;

  const datos = [
    { nombre: "Pos", valor: positivas, color: COLOR_POS },
    { nombre: "Neu", valor: neutras, color: COLOR_NEU },
    { nombre: "Neg", valor: negativas, color: COLOR_NEG },
  ];

  return (
    <div className="w-full h-full flex flex-col paper-chart rounded-lg p-3">
      <div className="flex items-baseline justify-between mb-1 shrink-0">
        <h4 className="font-semibold text-slate-800 text-sm">{titulo}</h4>
        <span className="text-[10px] text-slate-400">
          {total} acc.
        </span>
      </div>

      {total === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-slate-500">Sin datos</p>
        </div>
      ) : (
        <>
          <div className="flex-1 w-full min-h-0 relative">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={datos}
                margin={{ top: 6, right: 6, left: -22, bottom: 0 }}
              >
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis
                  dataKey="nombre"
                  tick={{ fill: "#64748b", fontSize: 10 }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "#64748b", fontSize: 10 }}
                />
                <Tooltip
                  cursor={{ fill: "rgba(0,0,0,0.04)" }}
                  formatter={(value, _name, payload) => {
                    const p = payload?.payload;
                    const nombre =
                      p?.nombre === "Pos"
                        ? labelPos
                        : p?.nombre === "Neg"
                        ? labelNeg
                        : "Neutras";
                    return [Number(value), nombre];
                  }}
                  labelStyle={{ fontSize: 11 }}
                  contentStyle={{ fontSize: 11 }}
                />
                <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                  {datos.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-1 mt-1 shrink-0">
            <div className="text-center">
              <p className="text-[9px] text-slate-500 uppercase">
                {labelPos}
              </p>
              <p
                className="text-sm font-bold"
                style={{ color: COLOR_POS }}
              >
                {positivas}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-slate-500 uppercase">
                Neutras
              </p>
              <p
                className="text-sm font-bold"
                style={{ color: COLOR_NEU }}
              >
                {neutras}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-slate-500 uppercase">
                {labelNeg}
              </p>
              <p
                className="text-sm font-bold"
                style={{ color: COLOR_NEG }}
              >
                {negativas}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}