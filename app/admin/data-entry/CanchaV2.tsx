"use client";

import { useMemo, useRef, useState } from "react";

// ============================================================
// TIPOS
// ============================================================

export type ZonaCancha =
  | "fuera-rival"
  | "cancha-rival"
  | "bloqueo-rival"
  | "red"
  | "bloqueo-propio"
  | "cancha-propia"
  | "fuera-propio";

export type Orientacion = "vertical" | "horizontal";

export interface CoordsV2 {
  zona: ZonaCancha;
  celda: string; // "F1-C2" | "FUERA-RIVAL-C3" | "BLOQ-RIVAL-C2" | "RED-C3"
  mini: string; // "m5-3" (fila 5, col 3)
}

interface Props {
  orientacion?: Orientacion;
  onMiniClick?: (coords: CoordsV2) => void;
  /** Celdas a atenuar (el usuario no puede clickearlas) */
  celdasAtenuadas?: Set<string>;
  /** Celdas a resaltar (por ejemplo las que el flujo espera que se clickeen) */
  celdasResaltadas?: Set<string>;
  /** Ancho máximo del contenedor. Si no entra, hace scroll. */
  maxAlto?: number;
}

// ============================================================
// CONFIGURACIÓN DE TAMAÑOS
// ============================================================

const ANCHO_CELDA = 84;
const ALTO_CANCHA = 42;
const ALTO_FUERA = 42;
const ALTO_BLOQUEO = 28;
const ALTO_RED = 28;

const COLS = ["C1", "C2", "C3", "C4", "C5"] as const;
const COLS_MEDIO = ["C2", "C3", "C4"] as const;

// ============================================================
// DEFINICIÓN DE CELDAS (generadas una sola vez)
// ============================================================

interface CeldaDef {
  zona: ZonaCancha;
  celda: string;
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

  // FUERA RIVAL (5 celdas)
  COLS.forEach((c, i) => {
    out.push({
      zona: "fuera-rival",
      celda: `FUERA-RIVAL-${c}`,
      x: i * ANCHO_CELDA,
      y,
      ancho: ANCHO_CELDA,
      alto: ALTO_FUERA,
      miniCols: 9,
      miniFils: 9,
    });
  });
  y += ALTO_FUERA;

  // CANCHA RIVAL (F6, F5, F4 — de arriba hacia abajo)
  (["F6", "F5", "F4"] as const).forEach((f) => {
    COLS.forEach((c, i) => {
      out.push({
        zona: "cancha-rival",
        celda: `${f}-${c}`,
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

  // BLOQUEO RIVAL (3 celdas centrales)
  COLS_MEDIO.forEach((c, i) => {
    out.push({
      zona: "bloqueo-rival",
      celda: `BLOQ-RIVAL-${c}`,
      x: (i + 1) * ANCHO_CELDA,
      y,
      ancho: ANCHO_CELDA,
      alto: ALTO_BLOQUEO,
      miniCols: 9,
      miniFils: 3,
    });
  });
  y += ALTO_BLOQUEO;

  // RED (3 celdas centrales)
  COLS_MEDIO.forEach((c, i) => {
    out.push({
      zona: "red",
      celda: `RED-${c}`,
      x: (i + 1) * ANCHO_CELDA,
      y,
      ancho: ANCHO_CELDA,
      alto: ALTO_RED,
      miniCols: 9,
      miniFils: 3,
    });
  });
  y += ALTO_RED;

  // BLOQUEO PROPIO (3 celdas centrales)
  COLS_MEDIO.forEach((c, i) => {
    out.push({
      zona: "bloqueo-propio",
      celda: `BLOQ-PROPIO-${c}`,
      x: (i + 1) * ANCHO_CELDA,
      y,
      ancho: ANCHO_CELDA,
      alto: ALTO_BLOQUEO,
      miniCols: 9,
      miniFils: 3,
    });
  });
  y += ALTO_BLOQUEO;

  // CANCHA PROPIA (F1, F2, F3)
  (["F1", "F2", "F3"] as const).forEach((f) => {
    COLS.forEach((c, i) => {
      out.push({
        zona: "cancha-propia",
        celda: `${f}-${c}`,
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

  // FUERA PROPIO (5 celdas)
  COLS.forEach((c, i) => {
    out.push({
      zona: "fuera-propio",
      celda: `FUERA-PROPIO-${c}`,
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
// COLORES POR ZONA
// ============================================================

const COLORES_ZONA: Record<
  ZonaCancha,
  { fondo: string; borde: string; texto: string }
> = {
  "fuera-rival": {
    fondo: "#fff7ed",
    borde: "#fdba74",
    texto: "#9a3412",
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
  "fuera-propio": {
    fondo: "#ecfdf5",
    borde: "#6ee7b7",
    texto: "#064e3b",
  },
};

// ============================================================
// ETIQUETAS DE ZONA (para mostrar al costado de cada bloque)
// ============================================================

const ETIQUETAS_ZONA: { zona: ZonaCancha; texto: string }[] = [
  { zona: "fuera-rival", texto: "FUERA RIVAL" },
  { zona: "cancha-rival", texto: "CANCHA RIVAL" },
  { zona: "bloqueo-rival", texto: "BLOQUEO RIVAL" },
  { zona: "red", texto: "RED" },
  { zona: "bloqueo-propio", texto: "BLOQUEO PROPIO" },
  { zona: "cancha-propia", texto: "MI CANCHA" },
  { zona: "fuera-propio", texto: "FUERA PROPIO" },
];

// ============================================================
// HELPERS DE GEOMETRÍA
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
    setHover({ celda: celda.celda, mini });
  };

  const handleLeave = () => setHover(null);

  const handleClick = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!onMiniClick) return;
    const p = svgCoordsDesdeMouse(e);
    if (!p) return;
    const celda = buscarCelda(p.x, p.y);
    if (!celda) return;
    if (celdasAtenuadas?.has(celda.celda)) return;
    const mini = miniDesdeCoords(celda, p.x, p.y);
    if (!mini) return;
    onMiniClick({ zona: celda.zona, celda: celda.celda, mini });
  };

  const rotacion = orientacion === "horizontal" ? 90 : 0;
  const anchoRender = orientacion === "vertical" ? TOTAL_ANCHO : TOTAL_ALTO;
  const altoRender = orientacion === "vertical" ? TOTAL_ALTO : TOTAL_ANCHO;

  // Buscamos el hover activo para dibujar el highlight
  const hoverCelda = useMemo(
    () => (hover ? CELDAS.find((c) => c.celda === hover.celda) : null),
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
    // Para horizontal, aplicamos la misma rotación que al grupo
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
        alignItems: "center",
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
          {/* ---------- Celdas + minis ---------- */}
          {CELDAS.map((c) => {
            const colores = COLORES_ZONA[c.zona];
            const atenuada = celdasAtenuadas?.has(c.celda) ?? false;
            const resaltada = celdasResaltadas?.has(c.celda) ?? false;

            return (
              <g key={c.celda} opacity={atenuada ? 0.35 : 1}>
                {/* Fondo de la celda */}
                <rect
                  x={c.x}
                  y={c.y}
                  width={c.ancho}
                  height={c.alto}
                  fill={colores.fondo}
                  stroke={colores.borde}
                  strokeWidth={resaltada ? 2 : 1}
                />

                {/* Minis */}
                {Array.from({ length: c.miniFils }).map((_, f) =>
                  Array.from({ length: c.miniCols }).map((_, col) => {
                    const r = rectMini(c, f + 1, col + 1);
                    return (
                      <rect
                        key={`${c.celda}-${f}-${col}`}
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

                {/* Resaltado si viene por prop */}
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

                {/* Etiqueta de la celda (F1-C2, RED-C3, etc.) */}
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
                  {c.celda}
                </text>
              </g>
            );
          })}

          {/* ---------- Etiquetas de zona (al costado izquierdo) ---------- */}
          {ETIQUETAS_ZONA.map((e) => {
            // Buscamos la y promedio de las celdas de la zona
            const celdas = CELDAS.filter((c) => c.zona === e.zona);
            if (celdas.length === 0) return null;
            const yMin = Math.min(...celdas.map((c) => c.y));
            const yMax = Math.max(...celdas.map((c) => c.y + c.alto));
            const yMid = (yMin + yMax) / 2;

            return (
              <text
                key={e.zona}
                x={-6}
                y={yMid}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={9}
                fontWeight={800}
                fill={COLORES_ZONA[e.zona].texto}
                opacity={0.7}
                pointerEvents="none"
              >
                {e.texto}
              </text>
            );
          })}

          {/* ---------- Highlight del hover ---------- */}
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