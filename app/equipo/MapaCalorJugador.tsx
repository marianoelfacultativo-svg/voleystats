"use client";

import { useMemo, useState } from "react";
import type { AccionDB } from "@/lib/db";

// ============================================================
// MAPA DE CALOR POR JUGADOR — Cancha de Vóley
// 4 fundamentos: saque, ataque, defensa, recepción.
// Filtro general por nivel (pos / neu / neg).
// ============================================================

interface Props {
  acciones: AccionDB[];
  jugadorId: string;
}

type Fundamento = "saque" | "ataque" | "defensa" | "recepcion";
type Nivel = "todas" | "pos" | "neu" | "neg";

const TABS: { id: Fundamento; label: string; icono: string }[] = [
  { id: "saque", label: "Saque", icono: "🔥" },
  { id: "ataque", label: "Ataque", icono: "⚡" },
  { id: "defensa", label: "Defensa", icono: "🛡️" },
  { id: "recepcion", label: "Recepción", icono: "🙌" },
];

const COL_X: Record<string, [number, number]> = {
  C1: [0, 2],
  C2: [2, 5],
  C3: [5, 8],
  C4: [8, 11],
  C5: [11, 13],
};

const FILA_Z: Record<string, [number, number]> = {
  F1: [0, 3],
  F2: [3, 6],
  F3: [6, 9],
  F4: [-3, 0],
  F5: [-6, -3],
  F6: [-9, -6],
};

function getCoords(
  celda: string | null | undefined,
  mini: string | null | undefined
): { x: number; z: number } | null {
  if (!celda) return null;
  const partes = celda.split("-");
  if (partes.length !== 2) return null;
  const [fila, col] = partes;
  const rangoX = COL_X[col];
  const rangoZ = FILA_Z[fila];
  if (!rangoX || !rangoZ) return null;

  if (!mini) {
    return {
      x: (rangoX[0] + rangoX[1]) / 2,
      z: (rangoZ[0] + rangoZ[1]) / 2,
    };
  }

  let mf = 0;
  let mc = 0;

  const matchM = mini.match(/^m(\d+)-(\d+)$/);
  if (matchM) {
    mf = parseInt(matchM[1]) - 1;
    mc = parseInt(matchM[2]) - 1;
  } else {
    const matchF = mini.match(/^f(\d)c(\d)$/);
    if (matchF) {
      mf = (parseInt(matchF[1]) - 1) * 3 + 1;
      mc = (parseInt(matchF[2]) - 1) * 3 + 1;
    } else {
      return {
        x: (rangoX[0] + rangoX[1]) / 2,
        z: (rangoZ[0] + rangoZ[1]) / 2,
      };
    }
  }

  const numCols = 9;
  const numFils = 9;
  const anchoCelda = (rangoX[1] - rangoX[0]) / numCols;
  const altoCelda = (rangoZ[1] - rangoZ[0]) / numFils;

  const esRival = parseInt(fila.slice(1)) >= 4;
  const mfFinal = esRival ? numFils - 1 - mf : mf;

  return {
    x: rangoX[0] + (mc + 0.5) * anchoCelda,
    z: rangoZ[0] + (mfFinal + 0.5) * altoCelda,
  };
}

const W = 13;
const H = 18;
const scaleX = 260 / W;
const scaleY = 360 / H;

function toPx(x: number, z: number): { px: number; py: number } {
  return {
    px: x * scaleX,
    py: (z + 9) * scaleY,
  };
}

function clasificarNivel(
  fundamento: string,
  valoracion: string
): "pos" | "neu" | "neg" {
  if (fundamento === "saque") {
    if (
      valoracion === "ace" ||
      valoracion === "positivo_mas" ||
      valoracion === "positivo"
    )
      return "pos";
    if (valoracion === "negativo") return "neg";
    return "neu";
  }
  if (fundamento === "ataque") {
    if (valoracion === "punto") return "pos";
    if (valoracion === "error") return "neg";
    return "neu";
  }
  if (fundamento === "recepcion") {
    if (valoracion === "positiva" || valoracion === "2x_positiva") return "pos";
    if (
      ["negativa", "2x_negativa", "3x_negativa", "ace_contra"].includes(
        valoracion
      )
    )
      return "neg";
    return "neu";
  }
  if (fundamento === "defensa") {
    if (
      ["gran_def", "toque_positiva", "cobertura_positiva"].includes(valoracion)
    )
      return "pos";
    if (
      [
        "toque_negativa",
        "mala_libre",
        "error_def",
        "errores_graves",
        "cobertura_negativa",
      ].includes(valoracion)
    )
      return "neg";
    return "neu";
  }
  return "neu";
}

export default function MapaCalorJugador({ acciones, jugadorId }: Props) {
  const [fundamento, setFundamento] = useState<Fundamento>("saque");
  const [nivel, setNivel] = useState<Nivel>("todas");

  const puntos = useMemo(() => {
    let filtradas = acciones.filter(
      (a) => a.jugador_id === jugadorId && a.fundamento === fundamento
    );
    if (nivel !== "todas") {
      filtradas = filtradas.filter(
        (a) => clasificarNivel(fundamento, a.valoracion) === nivel
      );
    }
    return filtradas;
  }, [acciones, jugadorId, fundamento, nivel]);

  const heatPoints = useMemo(() => {
    const pts: { px: number; py: number; peso: number }[] = [];

    for (const a of puntos) {
      let celda: string | null | undefined = null;
      let mini: string | null | undefined = null;

      if (fundamento === "saque" || fundamento === "ataque") {
        celda = a.destino_celda;
        mini = a.destino_mini;
      } else {
        celda = a.origen_celda;
        mini = a.origen_mini;
      }

      const coord = getCoords(celda, mini);
      if (!coord) continue;

      const { px, py } = toPx(coord.x, coord.z);
      pts.push({ px, py, peso: a.cantidad });
    }

    return pts;
  }, [puntos, fundamento]);

  const stars = useMemo(() => {
    if (fundamento !== "defensa" && fundamento !== "recepcion") return [];

    const pts: { px: number; py: number }[] = [];
    const vistos = new Set<string>();

    for (const a of puntos) {
      const coord = getCoords(a.posicion_inicial_celda, a.posicion_inicial_mini);
      if (!coord) continue;

      const key = `${coord.x}-${coord.z}`;
      if (vistos.has(key)) continue;
      vistos.add(key);

      const { px, py } = toPx(coord.x, coord.z);
      pts.push({ px, py });
    }

    return pts;
  }, [puntos, fundamento]);

  const tieneDatos = heatPoints.length > 0 || stars.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setFundamento(t.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
              fundamento === t.id
                ? "bg-emerald-500 text-white border-emerald-600"
                : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
            }`}
          >
            {t.icono} {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <span className="text-[10px] font-semibold text-slate-500 uppercase mr-1">
          Nivel:
        </span>
        {(["todas", "pos", "neu", "neg"] as Nivel[]).map((n) => {
          const labels: Record<Nivel, string> = {
            todas: "Todas",
            pos: "Positivas",
            neu: "Neutras",
            neg: "Negativas",
          };
          const colores: Record<Nivel, string> = {
            todas: "bg-slate-100 text-slate-700 border-slate-300",
            pos: "bg-green-100 text-green-800 border-green-400",
            neu: "bg-slate-100 text-slate-700 border-slate-400",
            neg: "bg-red-100 text-red-800 border-red-400",
          };
          const activo = nivel === n;
          return (
            <button
              key={n}
              onClick={() => setNivel(n)}
              className={`px-2 py-1 text-[11px] font-semibold rounded border-2 transition ${
                activo
                  ? "bg-emerald-500 text-white border-emerald-600"
                  : `${colores[n]} hover:brightness-95`
              }`}
            >
              {labels[n]}
            </button>
          );
        })}
      </div>

      <div className="bg-slate-900 rounded-xl overflow-hidden flex justify-center p-4">
        {!tieneDatos ? (
          <div className="h-[360px] flex items-center justify-center text-slate-400 text-sm text-center px-4">
            Sin datos de {TABS.find((t) => t.id === fundamento)?.label} para
            este jugador con los filtros actuales
          </div>
        ) : (
          <svg
            width="100%"
            height="auto"
            viewBox="0 0 260 360"
            className="max-w-[320px] rounded-lg shadow-2xl"
          >
            <defs>
              <radialGradient id="heatColor" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ff0000" stopOpacity="0.85" />
                <stop offset="25%" stopColor="#ff4500" stopOpacity="0.65" />
                <stop offset="50%" stopColor="#ffa500" stopOpacity="0.45" />
                <stop offset="75%" stopColor="#ffff00" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#00ff00" stopOpacity="0" />
              </radialGradient>
              <filter id="heatBlur">
                <feGaussianBlur stdDeviation="8" />
              </filter>
            </defs>

            <rect x={0} y={0} width={260} height={360} fill="#1e293b" />

            <g stroke="#ffffff" strokeWidth="1.5" fill="none" opacity="0.4">
              <rect x={0} y={0} width={260} height={360} />
              <line
                x1={0}
                y1={180}
                x2={260}
                y2={180}
                strokeWidth="4"
                opacity="0.8"
              />
              <line x1={0} y1={120} x2={260} y2={120} />
              <line x1={0} y1={240} x2={260} y2={240} />
              <line
                x1={130}
                y1={0}
                x2={130}
                y2={360}
                strokeDasharray="4 4"
                opacity="0.2"
              />
            </g>

            <g stroke="#ffffff" strokeWidth="0.5" opacity="0.15">
              {Array.from({ length: 13 }).map((_, i) => (
                <line
                  key={`v-${i}`}
                  x1={i * 20}
                  y1={174}
                  x2={i * 20}
                  y2={186}
                />
              ))}
              {Array.from({ length: 3 }).map((_, i) => (
                <line
                  key={`h-${i}`}
                  x1={0}
                  y1={174 + i * 6}
                  x2={260}
                  y2={174 + i * 6}
                />
              ))}
            </g>

            <g filter="url(#heatBlur)" opacity="0.85">
              {heatPoints.map((p, i) => (
                <circle
                  key={`h-${i}`}
                  cx={p.px}
                  cy={p.py}
                  r={p.peso > 1 ? 20 + p.peso * 3 : 20}
                  fill="url(#heatColor)"
                />
              ))}
            </g>

            <g>
              {stars.map((s, i) => (
                <text
                  key={`star-${i}`}
                  x={s.px}
                  y={s.py}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={16}
                  style={{
                    filter: "drop-shadow(0px 2px 2px rgba(0,0,0,0.6))",
                  }}
                >
                  ⭐
                </text>
              ))}
            </g>

            <text
              x={130}
              y={16}
              textAnchor="middle"
              fill="#ffffff"
              opacity="0.5"
              fontSize={10}
              fontWeight="bold"
            >
              CANCHA RIVAL
            </text>
            <text
              x={130}
              y={352}
              textAnchor="middle"
              fill="#ffffff"
              opacity="0.5"
              fontSize={10}
              fontWeight="bold"
            >
              CANCHA PROPIA
            </text>
          </svg>
        )}
      </div>

      <p className="text-[10px] text-slate-500 text-center">
        {fundamento === "saque" || fundamento === "ataque"
          ? "El mapa muestra los destinos de las acciones."
          : "El mapa muestra los orígenes de las acciones y las estrellas indican la posición inicial."}
      </p>
    </div>
  );
}