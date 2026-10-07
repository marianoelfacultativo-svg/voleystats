"use client";

import { useMemo, useRef, useState } from "react";

// ============================================================
// TIPOS
// ============================================================

export type ZonaCancha =
  | "fuera"
  | "cancha-rival"
  | "bloqueo-rival"
  | "red"
  | "bloqueo-propio"
  | "cancha-propia";

export type Orientacion = "vertical" | "horizontal";

export interface CoordsV2 {
  zona: ZonaCancha;
  celda: string;
  mini: string;
}

interface Props {
  orientacion?: Orientacion;
  onMiniClick?: (coords: CoordsV2) => void;
  celdasAtenuadas?: Set<string>;
  celdasResaltadas?: Set<string>;
  maxAlto?: number;
}

// ============================================================
// CONFIGURACIÓN
// ============================================================

const ANCHO_CELDA = 84;

const ALTO_FUERA = 42;
const ALTO_CANCHA = 42;
const ALTO_BLOQUEO = 14; // mitad que antes
const ALTO_RED = 14; // mitad que antes

const COLS = ["C1", "C2", "C3", "C4", "C5"] as const;

// ============================================================
// CELDAS
// ============================================================

interface CeldaDef {
  id: string;
  zona: ZonaCancha;
  x: number;
  y: number;
  ancho: number;
  alto: number;
  miniCols: number;
  miniFils: number;
}

function generarCeldas(): CeldaDef[] {
  const out: CeldaDef[] = [];
  let y = 0;

  // --- FUERA ARRIBA (5 celdas) ---
  COLS.forEach((c, i) => {
    out.push({
      id: `FUERA-ARR-${c}`,
      zona: "fuera",
      x: i * ANCHO_CELDA,
      y,
      ancho: ANCHO_CELDA,
      alto: ALTO_FUERA,
      miniCols: 9,
      miniFils: 9,
    });
  });
  y += ALTO_FUERA;

  // --- CANCHA RIVAL (F6, F5, F4) ---
  (["F6", "F5", "F4"] as const).forEach((f) => {
    COLS.forEach((c, i) => {
      const esCancha = c === "C2" || c === "C3" || c === "C4";
      out.push({
        id: `${f}-${c}`,
        zona: esCancha ? "cancha-rival" : "fuera",
        x: i * ANCHO_CELDA,
        y,
        ancho: ANCHO_CELDA,
        alto: ALTO_CANCHA,
        miniCols: 9,
        miniFils: 9,
      });
    });
    y += ALTO_CANCHA;
  });

  // --- BLOQUEO RIVAL ---
  COLS.forEach((c, i) => {
    const esBloqueo = c === "C2" || c === "C3" || c === "C4";
    out.push({
      id: `BLOQ-R-${c}`,
      zona: esBloqueo ? "bloqueo-rival" : "fuera",
      x: i * ANCHO_CELDA,
      y,
      ancho: ANCHO_CELDA,
      alto: ALTO_BLOQUEO,
      miniCols: 9,
      miniFils: esBloqueo ? 2 : 9, // fuera siempre 9
    });
  });
  y += ALTO_BLOQUEO;

  // --- RED ---
  COLS.forEach((c, i) => {
    const esRed = c === "C2" || c === "C3" || c === "C4";
    out.push({
      id: `RED-${c}`,
      zona: esRed ? "red" : "fuera",
      x: i * ANCHO_CELDA,
      y,
      ancho: ANCHO_CELDA,
      alto: ALTO_RED,
      miniCols: 9,
      miniFils: esRed ? 1 : 9, // fuera siempre 9
    });
  });
  y += ALTO_RED;

  // --- BLOQUEO PROPIO ---
  COLS.forEach((c, i) => {
    const esBloqueo = c === "C2" || c === "C3" || c === "C4";
    out.push({
      id: `BLOQ-P-${c}`,
      zona: esBloqueo ? "bloqueo-propio" : "fuera",
      x: i * ANCHO_CELDA,
      y,
      ancho: ANCHO_CELDA,
      alto: ALTO_BLOQUEO,
      miniCols: 9,
      miniFils: esBloqueo ? 2 : 9, // fuera siempre 9
    });
  });
  y += ALTO_BLOQUEO;

  // --- CANCHA PROPIA (F1, F2, F3) ---
  (["F1", "F2", "F3"] as const).forEach((f) => {
    COLS.forEach((c, i) => {
      const esCancha = c === "C2" || c === "C3" || c === "C4";
      out.push({
        id: `${f}-${c}`,
        zona: esCancha ? "cancha-propia" : "fuera",
        x: i * ANCHO_CELDA,
        y,
        ancho: ANCHO_CELDA,
        alto: ALTO_CANCHA,
        miniCols: 9,
        miniFils: 9,
      });
    });
    y += ALTO_CANCHA;
  });

  // --- FUERA ABAJO (5 celdas) ---
  COLS.forEach((c, i) => {
    out.push({
      id: `FUERA-ABA-${c}`,
      zona: "fuera",
      x: i * ANCHO_CELDA,
      y,
      ancho: ANCHO_CELDA,
      alto: ALTO_FUERA,
      miniCols: 9,
      miniFils: 9,
    });
  });

  return out;
}

const CELDAS = generarCeldas();
const TOTAL_ANCHO = 5 * ANCHO_CELDA;
const TOTAL_ALTO = CELDAS.reduce(
  (max, c) => Math.max(max, c.y + c.alto),
  0
);

// ============================================================
// COLORES
// ============================================================

const COLORES_ZONA: Record<
  ZonaCancha,
  { fondo: string; borde: string; texto: string }
> = {
  fuera: {
    fondo: "#f8fafc",
    borde: "#cbd5e1",
    texto: "#475569",
  },
  "cancha-rival": {
    fondo: "#fed7aa",
    borde: "#fb923c",
    texto: "#7c2d12",
  },
  "bloqueo-rival": {
    fondo: "#fdba74",
    borde: "#ea580c",
    texto: "#7c2d12",
  },
  red: {
    fondo: "#334155",
    borde: "#1e293b",
    texto: "#f1f5f9",
  },
  "bloqueo-propio": {
    fondo: "#86efac",
    borde: "#16a34a",
    texto: "#14532d",
  },
  "cancha-propia": {
    fondo: "#bbf7d0",
    borde: "#22c55e",
    texto: "#14532d",
  },
};

// ============================================================
// HELPERS
// ============================================================

function svgCoordsDesdeMouse(
  e: React.PointerEvent<SVGSVGElement>
): { x: number; y: number } | null {
  const svg = e.currentTarget;
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const inv = ctm.inverse();
  const local = pt.matrixTransform(inv);
  return { x: local.x, y: local.y };
}

function buscarCelda(x: number, y: number): CeldaDef | null {
  for (const c of CELDAS) {
    if (x >= c.x && x < c.x + c.ancho && y >= c.y && y < c.y + c.alto) {
      return c;
    }
  }
  return null;
}

function miniDesdeCoords(
  celda: CeldaDef,
  x: number,
  y: number
): string | null {
  const relX = x - celda.x;
  const relY = y - celda.y;
  const miniAncho = celda.ancho / celda.miniCols;
  const miniAlto = celda.alto / celda.miniFils;
  const col = Math.floor(relX / miniAncho) + 1;
  const fil = Math.floor(relY / miniAlto) + 1;
  if (col < 1 || col > celda.miniCols) return null;
  if (fil < 1 || fil > celda.miniFils) return null;
  return `m${fil}-${col}`;
}

function rectMini(
  celda: CeldaDef,
  fil: number,
  col: number
): { x: number; y: number; w: number; h: number } {
  const miniAncho = celda.ancho / celda.miniCols;
  const miniAlto = celda.alto / celda.miniFils;
  return {
    x: celda.x + (col - 1) * miniAncho,
    y: celda.y + (fil - 1) * miniAlto,
    w: miniAncho,
    h: miniAlto,
  };
}

// ============================================================
// COMPONENTE
// ============================================================

export default function CanchaV2({
  orientacion = "vertical",
  onMiniClick,
  celdasAtenuadas,
  celdasResaltadas,
  maxAlto = 720,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{
    celda: string;
    mini: string;
  } | null>(null);

  const handleMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = svgCoordsDesdeMouse(e);
    if (!p) {
      setHover(null);
      return;
    }
    const celda = buscarCelda(p.x, p.y);
    if (!celda) {
      setHover(null);
      return;
    }
    const mini = miniDesdeCoords(celda, p.x, p.y);
    if (!mini) {
      setHover(null);
      return;
    }
    setHover({ celda: celda.id, mini });
  };

  const handleLeave = () => setHover(null);

  const handleClick = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!onMiniClick) return;
    const p = svgCoordsDesdeMouse(e);
    if (!p) return;
    const celda = buscarCelda(p.x, p.y);
    if (!celda) return;
    if (celdasAtenuadas?.has(celda.id)) return;
    const mini = miniDesdeCoords(celda, p.x, p.y);
    if (!mini) return;
    onMiniClick({ zona: celda.zona, celda: celda.id, mini });
  };

  const rotacion = orientacion === "horizontal" ? 90 : 0;
  const anchoRender = orientacion === "vertical" ? TOTAL_ANCHO : TOTAL_ALTO;
  const altoRender = orientacion === "vertical" ? TOTAL_ALTO : TOTAL_ANCHO;

  const hoverCelda = useMemo(
    () => (hover ? CELDAS.find((c) => c.id === hover.celda) : null),
    [hover]
  );

  const hoverMiniRect = useMemo(() => {
    if (!hoverCelda || !hover) return null;
    const m = hover.mini.match(/^m(\d+)-(\d+)$/);
    if (!m) return null;
    const fil = parseInt(m[1]);
    const col = parseInt(m[2]);
    const r = rectMini(hoverCelda, fil, col);
    if (rotacion === 0) return r;
    return {
      x: TOTAL_ANCHO - r.y - r.h,
      y: r.x,
      w: r.h,
      h: r.w,
    };
  }, [hoverCelda, hover, rotacion]);

  return (
    <div
      style={{
        width: "100%",
        maxHeight: maxAlto,
        overflow: "auto",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
      }}
    >
      <svg
        ref={svgRef}
        width={anchoRender}
        height={altoRender}
        viewBox={
          orientacion === "vertical"
            ? `0 0 ${TOTAL_ANCHO} ${TOTAL_ALTO}`
            : `0 0 ${TOTAL_ALTO} ${TOTAL_ANCHO}`
        }
        style={{
          userSelect: "none",
          touchAction: "manipulation",
          cursor: onMiniClick ? "crosshair" : "default",
          flexShrink: 0,
        }}
        onPointerMove={handleMove}
        onPointerLeave={handleLeave}
        onPointerDown={handleClick}
      >
        <g
          transform={
            orientacion === "horizontal"
              ? `translate(${TOTAL_ALTO} 0) rotate(90)`
              : undefined
          }
        >
          {CELDAS.map((c) => {
            const colores = COLORES_ZONA[c.zona];
            const atenuada = celdasAtenuadas?.has(c.id) ?? false;
            const resaltada = celdasResaltadas?.has(c.id) ?? false;

            return (
              <g key={c.id} opacity={atenuada ? 0.35 : 1}>
                <rect
                  x={c.x}
                  y={c.y}
                  width={c.ancho}
                  height={c.alto}
                  fill={colores.fondo}
                  stroke={colores.borde}
                  strokeWidth={resaltada ? 2 : 1}
                />

                {Array.from({ length: c.miniFils }).map((_, f) =>
                  Array.from({ length: c.miniCols }).map((_, col) => {
                    const r = rectMini(c, f + 1, col + 1);
                    return (
                      <rect
                        key={`${c.id}-${f}-${col}`}
                        x={r.x}
                        y={r.y}
                        width={r.w}
                        height={r.h}
                        fill="transparent"
                        stroke={colores.borde}
                        strokeWidth={0.25}
                        opacity={0.35}
                        pointerEvents="none"
                      />
                    );
                  })
                )}

                {resaltada && (
                  <rect
                    x={c.x}
                    y={c.y}
                    width={c.ancho}
                    height={c.alto}
                    fill="none"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    pointerEvents="none"
                  />
                )}

                {c.alto >= 20 && (
                  <text
                    x={c.x + c.ancho / 2}
                    y={c.y + c.alto / 2 + 3}
                    textAnchor="middle"
                    fontSize={7}
                    fontWeight={700}
                    fill={colores.texto}
                    opacity={0.55}
                    pointerEvents="none"
                  >
                    {c.id}
                  </text>
                )}
              </g>
            );
          })}

          {hoverMiniRect && (
            <rect
              x={hoverMiniRect.x}
              y={hoverMiniRect.y}
              width={hoverMiniRect.w}
              height={hoverMiniRect.h}
              fill="#0ea5e9"
              fillOpacity={0.35}
              stroke="#0284c7"
              strokeWidth={1}
              pointerEvents="none"
            />
          )}
        </g>
      </svg>
    </div>
  );
}