"use client";

import type { DistribucionTendencia } from "@/lib/estadisticas";

interface Props {
  distribucion: DistribucionTendencia;
}

interface Celda {
  key: keyof DistribucionTendencia;
  label: string;
}

const CELDAS: Celda[] = [
  { key: "zona_4", label: "4" },
  { key: "zona_3", label: "3" },
  { key: "zona_2", label: "2" },
  { key: "toque", label: "T" },
  { key: "zona_6", label: "6" },
  { key: "zona_1", label: "1" },
];

function calcularColor(pct: number) {
  if (pct <= 0) return { r: 219, g: 234, b: 254 }; // azul muy claro
  if (pct < 20) {
    // azul → celeste
    const t = pct / 20;
    return {
      r: Math.round(96 + t * (147 - 96)),
      g: Math.round(165 + t * (197 - 165)),
      b: Math.round(250 + t * (253 - 250)),
    };
  }
  if (pct < 35) {
    // celeste → amarillo
    const t = (pct - 20) / 15;
    return {
      r: Math.round(147 + t * (250 - 147)),
      g: Math.round(197 + t * (204 - 197)),
      b: Math.round(253 + t * (21 - 253)),
    };
  }
  if (pct < 50) {
    // amarillo → rojo
    const t = (pct - 35) / 15;
    return {
      r: Math.round(250 + t * (239 - 250)),
      g: Math.round(204 + t * (68 - 204)),
      b: Math.round(21 + t * (68 - 21)),
    };
  }
  if (pct < 75) {
    // rojo → rojo oscuro
    const t = (pct - 50) / 25;
    return {
      r: Math.round(239 - t * 60),
      g: Math.round(68 - t * 40),
      b: Math.round(68 - t * 40),
    };
  }
  // muy rojo → rojo más oscuro
  const t = (pct - 75) / 25;
  return {
    r: Math.round(179 - t * 60),
    g: Math.round(28 - t * 15),
    b: Math.round(28 - t * 15),
  };
}

export default function MapaCalorTendencia({ distribucion }: Props) {
  const total = distribucion.total;

  const pcts = CELDAS.map((c) => {
    const valor = distribucion[c.key] as number;
    return total > 0 ? (valor / total) * 100 : 0;
  });
  const maxPct = Math.max(...pcts, 1);

  const tamañoMax = 70;
  const tamañoMin = 12;

  return (
    <div>
      <h4 className="font-semibold text-slate-800 mb-3">
        Distribución de tendencia
      </h4>

      {total === 0 ? (
        <p className="text-sm text-slate-500 text-center py-8">
          Todavía no hay tendencias cargadas
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            {CELDAS.map((c) => {
              const valor = distribucion[c.key] as number;
              const pct = (valor / total) * 100;
              const tamaño =
                valor === 0
                  ? tamañoMin
                  : tamañoMin + (pct / maxPct) * (tamañoMax - tamañoMin);
              const color = calcularColor(pct);
              const rgb = `rgb(${color.r}, ${color.g}, ${color.b})`;
              const esToque = c.key === "toque";

              return (
                <div
                  key={String(c.key)}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border ${
                    esToque
                      ? "bg-pink-50 border-pink-200"
                      : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div
                    className="flex items-center justify-center rounded-full transition-all"
                    style={{
                      width: `${tamaño}px`,
                      height: `${tamaño}px`,
                      backgroundColor: rgb,
                      border: "2px solid rgba(0,0,0,0.08)",
                    }}
                  >
                    <span
                      className={`font-bold ${
                        pct > 40 ? "text-white" : "text-slate-700"
                      }`}
                      style={{ fontSize: `${Math.max(10, tamaño / 5)}px` }}
                    >
                      {c.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-2 font-medium">
                    {valor} · {pct.toFixed(0)}%
                  </p>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-400 mt-3 text-center">
            Tamaño y color según % de uso. Azul = poco usado, rojo = muy usado.
            "T" = toques.
          </p>
        </>
      )}
    </div>
  );
}