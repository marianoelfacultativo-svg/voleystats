"use client";

import { useMemo, useState } from "react";
import type { AccionDB } from "@/lib/db";

// ============================================================
// MAPA DE CALOR POR JUGADOR
// ============================================================

interface Props {
  acciones: AccionDB[];
  jugadorId: string;
}

type Fundamento = "saque" | "ataque" | "defensa" | "recepcion";

const TABS: { id: Fundamento; label: string; icono: string }[] = [
  { id: "saque", label: "Saque", icono: "🔥" },
  { id: "ataque", label: "Ataque", icono: "⚡" },
  { id: "defensa", label: "Defensa", icono: "🛡️" },
  { id: "recepcion", label: "Recepción", icono: "🙌" },
];

// ------------------------------------------------------------
// Coordenadas base de la cancha (mismas que CanchaV2)
// ------------------------------------------------------------

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
      // Adapta grillas viejas de 3x3 a 9x9
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

// ------------------------------------------------------------
// Dimensiones del SVG
// ------------------------------------------------------------

const W = 13; // ancho cancha en unidades
const H = 18; // alto total en unidades (-9 a 9)
const scaleX = 600 / W;
const scaleY = 900 / H;

function toPx(x: number, z: number): { px: number; py: number } {
  return {
    px: x * scaleX,
    py: (z + 9) * scaleY,
  };
}

// ============================================================
// COMPONENTE
// ============================================================

export default function MapaCalorJugador({ acciones, jugadorId }: Props) {
  const [fundamento, setFundamento] = useState<Fundamento>("saque");

  const puntos = useMemo(() => {
    return acciones.filter(
      (a) => a.jugador_id === jugadorId && a.fundamento === fundamento
    );
  }, [acciones, jugadorId, fundamento]);

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

      <div className="bg-[#1a472a] rounded-xl overflow-hidden flex justify-center p-4">
        {!tieneDatos ? (
          <div className="h-[400px] flex items-center justify-center text-emerald-200/70 text-sm">
            Sin datos de {TABS.find((t) => t.id === fundamento)?.label} para este jugador
          </div>
        ) : (
          <svg
            width="100%"
            height="auto"
            viewBox="0 0 600 900"
            className="max-w-[500px] rounded-lg shadow-2xl"
          >
            {/* Definiciones para el gradiente y el blur */}
            <defs>
              <radialGradient id="heatColor" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ff0000" stopOpacity="0.8" />
                <stop offset="20%" stopColor="#ff4500" stopOpacity="0.6" />
                <stop offset="40%" stopColor="#ffa500" stopOpacity="0.45" />
                <stop offset="60%" stopColor="#ffff00" stopOpacity="0.3" />
                <stop offset="80%" stopColor="#00ff00" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#0000ff" stopOpacity="0" />
              </radialGradient>
              <filter id="heatBlur">
                <feGaussianBlur stdDeviation="15" />
              </filter>
            </defs>

            {/* Fondo de la cancha */}
            <rect x={0} y={0} width={600} height={900} fill="#1a472a" />

            {/* Líneas de la cancha */}
            <g stroke="#ffffff" strokeWidth="2" fill="none" opacity="0.4">
              {/* Borde exterior */}
              <rect x={0} y={0} width={600} height={900} />
              {/* Línea de red (z=0) */}
              <line x1={0} y1={450} x2={600} y2={450} strokeWidth="4" />
              {/* Líneas de ataque (z=-3 y z=3) */}
              <line x1={0} y1={300} x2={600} y2={300} />
              <line x1={0} y1={600} x2={600} y2={600} />
              {/* Línea central de la cancha */}
              <line x1={300} y1={0} x2={300} y2={900} />
              {/* Círculo central (opcional, ayuda a la referencia) */}
              <circle cx={300} cy={450} r={80} />
            </g>

            {/* Malla de la red */}
            <g stroke="#ffffff" strokeWidth="0.5" opacity="0.2">
              {Array.from({ length: 20 }).map((_, i) => (
                <line
                  key={`v-${i}`}
                  x1={i * 30}
                  y1={440}
                  x2={i * 30}
                  y2={460}
                />
              ))}
              {Array.from({ length: 3 }).map((_, i) => (
                <line
                  key={`h-${i}`}
                  x1={0}
                  y1={440 + i * 7}
                  x2={600}
                  y2={440 + i * 7}
                />
              ))}
            </g>

            {/* Capa de calor */}
            <g filter="url(#heatBlur)" opacity="0.8">
              {heatPoints.map((p, i) => (
                <circle
                  key={`h-${i}`}
                  cx={p.px}
                  cy={p.py}
                  r={p.peso > 1 ? 45 + p.peso * 5 : 45}
                  fill="url(#heatColor)"
                />
              ))}
            </g>

            {/* Estrellas (posiciones iniciales) */}
            <g>
              {stars.map((s, i) => (
                <text
                  key={`star-${i}`}
                  x={s.px}
                  y={s.py}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={24}
                  style={{
                    filter: "drop-shadow(0px 2px 2px rgba(0,0,0,0.5))",
                  }}
                >
                  ⭐
                </text>
              ))}
            </g>

            {/* Indicador de "Arriba" (Cancha Rival) y "Abajo" (Cancha Propia) */}
            <text
              x={300}
              y={30}
              textAnchor="middle"
              fill="#ffffff"
              opacity="0.5"
              fontSize={14}
              fontWeight="bold"
            >
              CANCHA RIVAL
            </text>
            <text
              x={300}
              y={880}
              textAnchor="middle"
              fill="#ffffff"
              opacity="0.5"
              fontSize={14}
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