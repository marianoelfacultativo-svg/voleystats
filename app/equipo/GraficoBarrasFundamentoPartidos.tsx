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
import type { AccionDB } from "@/lib/estadisticas";

// ------------------------------------------------------------
// Clasificación de valoraciones en Pos / Neu / Neg.
// Recepción ahora usa el sistema nuevo de 7 valores.
// ------------------------------------------------------------
export function clasificarValoracion(
  fundamento: string,
  valoracion: string
): "pos" | "neu" | "neg" {
  if (fundamento === "saque") {
    if (valoracion === "ace") return "pos";
    if (valoracion === "negativo") return "neg";
    return "neu";
  }
  if (fundamento === "ataque") {
    if (valoracion === "punto") return "pos";
    if (valoracion === "error") return "neg";
    return "neu";
  }
  if (fundamento === "recepcion") {
    if (valoracion === "perfecta" || valoracion === "positiva") return "pos";
    if (
      valoracion === "negativa" ||
      valoracion === "doble_negativa" ||
      valoracion === "overpass" ||
      valoracion === "error_directo"
    )
      return "neg";
    return "neu";
  }
  if (fundamento === "bloqueo") {
    if (
      valoracion === "punto" ||
      valoracion === "positivo_mas" ||
      valoracion === "positivo"
    )
      return "pos";
    if (
      valoracion === "use_rival" ||
      valoracion === "red" ||
      valoracion === "filtrada"
    )
      return "neg";
    return "neu";
  }
  if (fundamento === "defensa") {
    if (
      valoracion === "gran_def" ||
      valoracion === "toque_positiva" ||
      valoracion === "cobertura_positiva"
    )
      return "pos";
    if (
      valoracion === "toque_negativa" ||
      valoracion === "mala_libre" ||
      valoracion === "error_def" ||
      valoracion === "errores_graves" ||
      valoracion === "cobertura_negativa"
    )
      return "neg";
    return "neu";
  }
  return "neu";
}

export interface ConteoBarras {
  positivas: number;
  neutras: number;
  negativas: number;
  total: number;
}

export function contarBarras(
  acciones: AccionDB[],
  fundamento: string,
  jugadorId?: string
): ConteoBarras {
  let positivas = 0;
  let neutras = 0;
  let negativas = 0;

  for (const a of acciones) {
    if (a.fundamento !== fundamento) continue;
    if (jugadorId && a.jugador_id !== jugadorId) continue;
    const cat = clasificarValoracion(a.fundamento, a.valoracion);
    if (cat === "pos") positivas += a.cantidad;
    else if (cat === "neg") negativas += a.cantidad;
    else neutras += a.cantidad;
  }

  return {
    positivas,
    neutras,
    negativas,
    total: positivas + neutras + negativas,
  };
}

// ------------------------------------------------------------
// Nombres visibles
// ------------------------------------------------------------

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

// ============================================================
// COMPONENTE
// ============================================================

interface Props {
  fundamento: string;
  acciones: AccionDB[];
  jugadorId?: string;
  tituloOverride?: string;
  alto?: number;
}

export default function GraficoBarrasFundamentoPartidos({
  fundamento,
  acciones,
  jugadorId,
  tituloOverride,
  alto = 120,
}: Props) {
  const { positivas, neutras, negativas, total } = contarBarras(
    acciones,
    fundamento,
    jugadorId
  );

  const titulo = tituloOverride ?? NOMBRES[fundamento] ?? fundamento;
  const labelPos = LABEL_POS[fundamento] ?? "Positivas";
  const labelNeg = LABEL_NEG[fundamento] ?? "Negativas";

  const datos = [
    { nombre: "Pos", valor: positivas, color: COLOR_POS },
    { nombre: "Neu", valor: neutras, color: COLOR_NEU },
    { nombre: "Neg", valor: negativas, color: COLOR_NEG },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-2">
      <div className="flex items-baseline justify-between mb-1">
        <h5 className="font-semibold text-slate-800 text-xs">{titulo}</h5>
        <span className="text-[9px] text-slate-400">{total} acc.</span>
      </div>

      {total === 0 ? (
        <p className="text-[10px] text-slate-500 text-center py-4">
          Sin datos
        </p>
      ) : (
        <>
          <div style={{ width: "100%", height: alto }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={datos}
                margin={{ top: 4, right: 4, left: -26, bottom: 0 }}
              >
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis
                  dataKey="nombre"
                  tick={{ fill: "#64748b", fontSize: 9 }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "#64748b", fontSize: 9 }}
                />
                <Tooltip
                  cursor={{ fill: "#f8fafc" }}
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
                  labelStyle={{ fontSize: 10 }}
                  contentStyle={{ fontSize: 10 }}
                />
                <Bar dataKey="valor" radius={[3, 3, 0, 0]}>
                  {datos.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-1 mt-1 text-center">
            <div>
              <p className="text-[8px] text-slate-500 uppercase">
                {labelPos}
              </p>
              <p
                className="text-xs font-bold"
                style={{ color: COLOR_POS }}
              >
                {positivas}
              </p>
            </div>
            <div>
              <p className="text-[8px] text-slate-500 uppercase">
                Neutras
              </p>
              <p
                className="text-xs font-bold"
                style={{ color: COLOR_NEU }}
              >
                {neutras}
              </p>
            </div>
            <div>
              <p className="text-[8px] text-slate-500 uppercase">
                {labelNeg}
              </p>
              <p
                className="text-xs font-bold"
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