"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

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
  children?: React.ReactNode;
}

// ============================================================
// CONFIGURACIÓN
// ============================================================

const ANCHO_CELDA = 84;
const ALTO_FUERA = 42;
const ALTO_CANCHA = 42;
const ALTO_BLOQUEO = 14;
const ALTO_RED = 14;

const COLS = ["C1", "C2", "C3", "C4", "C5"] as const;

const ZOOM_MIN = 0.3;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.15;

// ============================================================
// DEFINICIÓN DE CELDAS
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

  // FUERA ARRIBA
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

  // CANCHA RIVAL (F6, F5, F4)
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

  // BLOQUEO RIVAL
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
      miniFils: esBloqueo ? 2 : 3,
    });
  });
  y += ALTO_BLOQUEO;

  // RED
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
      miniFils: esRed ? 1 : 3,
    });
  });
  y += ALTO_RED;

  // BLOQUEO PROPIO
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
      miniFils: esBloqueo ? 2 : 3,
    });
  });
  y += ALTO_BLOQUEO;

  // CANCHA PROPIA (F1, F2, F3)
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

  // FUERA ABAJO
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
const TOTAL_ALTO = CELDAS.reduce((max, c) => Math.max(max, c.y + c.alto), 0);

// ---------- MARCO EXTERIOR ----------
const MARGEN = ALTO_CANCHA;

const TOTAL_ANCHO_EXT = TOTAL_ANCHO + 2 * MARGEN;
const TOTAL_ALTO_EXT = TOTAL_ALTO + 2 * MARGEN;

export const CANCHA_V2_DIMS = {
  ancho: TOTAL_ANCHO,
  alto: TOTAL_ALTO,
  anchoCelda: ANCHO_CELDA,
  margen: MARGEN,
};

// ============================================================
// COLORES POR ZONA
// ============================================================

const COLORES_ZONA: Record<
  ZonaCancha,
  { fondo: string; borde: string; texto: string }
> = {
  fuera: { fondo: "#f8fafc", borde: "#cbd5e1", texto: "#475569" },
  "cancha-rival": { fondo: "#fed7aa", borde: "#fb923c", texto: "#7c2d12" },
  "bloqueo-rival": { fondo: "#fdba74", borde: "#ea580c", texto: "#7c2d12" },
  red: { fondo: "#334155", borde: "#1e293b", texto: "#f1f5f9" },
  "bloqueo-propio": { fondo: "#86efac", borde: "#16a34a", texto: "#14532d" },
  "cancha-propia": { fondo: "#bbf7d0", borde: "#22c55e", texto: "#14532d" },
};

// Marco exterior: celeste claro
const COLOR_MARCO = "#bae6fd";

// ============================================================
// HELPERS GEOMÉTRICOS
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

function svgToLayoutCoords(
  sx: number,
  sy: number,
  orientacion: Orientacion
): { x: number; y: number } {
  if (orientacion === "vertical") {
    return { x: sx - MARGEN, y: sy - MARGEN };
  }
  return { x: sy - MARGEN, y: MARGEN + TOTAL_ALTO - sx };
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
// EXPORTS PARA LA CAPA DE LÍNEAS
// ============================================================

export function getRectMiniLayout(
  celdaId: string,
  mini: string
): { x: number; y: number; w: number; h: number } | null {
  const c = CELDAS.find((x) => x.id === celdaId);
  if (!c) return null;
  const m = mini.match(/^m(\d+)-(\d+)$/);
  if (!m) return null;
  const fil = parseInt(m[1]);
  const col = parseInt(m[2]);
  return rectMini(c, fil, col);
}

export function hitTestV2(
  sx: number,
  sy: number,
  orientacion: Orientacion
): CoordsV2 | null {
  const p = svgToLayoutCoords(sx, sy, orientacion);
  const celda = buscarCelda(p.x, p.y);
  if (!celda) return null;
  const mini = miniDesdeCoords(celda, p.x, p.y);
  if (!mini) return null;
  return { zona: celda.zona, celda: celda.id, mini };
}

// ============================================================
// COMPONENTE
// ============================================================

export default function CanchaV2({
  orientacion = "vertical",
  onMiniClick,
  celdasAtenuadas,
  celdasResaltadas,
  maxAlto = 900,
  children,
}: Props) {
  const [hover, setHover] = useState<{ celda: string; mini: string } | null>(
    null
  );
  const [escalaAncho, setEscalaAncho] = useState(1);
  const [escalaAlto, setEscalaAlto] = useState(1);
  const [enPantallaCompleta, setEnPantallaCompleta] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onFsChange = () => {
      setEnPantallaCompleta(
        document.fullscreenElement === containerRef.current
      );
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Al entrar en fullscreen, calculamos un fit óptimo
  useEffect(() => {
    if (!enPantallaCompleta) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const anchoBase =
      orientacion === "vertical" ? TOTAL_ANCHO_EXT : TOTAL_ALTO_EXT;
    const altoBase =
      orientacion === "vertical" ? TOTAL_ALTO_EXT : TOTAL_ANCHO_EXT;
    const padding = 100;
    const fa = Math.max(
      ZOOM_MIN,
      Math.min(ZOOM_MAX, (vw - padding) / anchoBase)
    );
    const fb = Math.max(
      ZOOM_MIN,
      Math.min(ZOOM_MAX, (vh - padding) / altoBase)
    );
    setEscalaAncho(+fa.toFixed(2));
    setEscalaAlto(+fb.toFixed(2));
  }, [enPantallaCompleta, orientacion]);

  const togglePantallaCompleta = async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      /* noop */
    }
  };

  const paso = ZOOM_STEP;
  const cambiar = (
    setter: React.Dispatch<React.SetStateAction<number>>,
    dir: 1 | -1
  ) => {
    setter((v) =>
      Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, +(v + dir * paso).toFixed(2)))
    );
  };

  // Restablecer: vuelve a 100% ancho y alto. Si está en fullscreen,
  // además recalcula el fit para pantalla completa.
  const reestablecer = () => {
    if (enPantallaCompleta) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const anchoBase =
        orientacion === "vertical" ? TOTAL_ANCHO_EXT : TOTAL_ALTO_EXT;
      const altoBase =
        orientacion === "vertical" ? TOTAL_ALTO_EXT : TOTAL_ANCHO_EXT;
      const padding = 100;
      const fa = Math.max(
        ZOOM_MIN,
        Math.min(ZOOM_MAX, (vw - padding) / anchoBase)
      );
      const fb = Math.max(
        ZOOM_MIN,
        Math.min(ZOOM_MAX, (vh - padding) / altoBase)
      );
      setEscalaAncho(+fa.toFixed(2));
      setEscalaAlto(+fb.toFixed(2));
    } else {
      setEscalaAncho(1);
      setEscalaAlto(1);
    }
  };

  const handleMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const sp = svgCoordsDesdeMouse(e);
    if (!sp) {
      setHover(null);
      return;
    }
    const p = svgToLayoutCoords(sp.x, sp.y, orientacion);
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
    const sp = svgCoordsDesdeMouse(e);
    if (!sp) return;
    const p = svgToLayoutCoords(sp.x, sp.y, orientacion);
    const celda = buscarCelda(p.x, p.y);
    if (!celda) return;
    if (celdasAtenuadas?.has(celda.id)) return;
    const mini = miniDesdeCoords(celda, p.x, p.y);
    if (!mini) return;
    onMiniClick({ zona: celda.zona, celda: celda.id, mini });
  };

  const anchoBase =
    orientacion === "vertical" ? TOTAL_ANCHO_EXT : TOTAL_ALTO_EXT;
  const altoBase =
    orientacion === "vertical" ? TOTAL_ALTO_EXT : TOTAL_ANCHO_EXT;

  const anchoRender = anchoBase * escalaAncho;
  const altoRender = altoBase * escalaAlto;

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
    return rectMini(hoverCelda, fil, col);
  }, [hoverCelda, hover]);

  const hayStretch = escalaAncho !== escalaAlto;

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{
        width: "100%",
        maxHeight: enPantallaCompleta ? "100vh" : maxAlto,
        overflow: "auto",
        background: enPantallaCompleta ? "#0b1220" : "transparent",
        display: "flex",
        justifyContent: "center",
        alignItems: enPantallaCompleta ? "center" : "flex-start",
      }}
    >
      {/* Toolbar flotante */}
      <div
        className="sticky top-2 z-20 flex flex-col items-end gap-1 ml-auto mr-2"
        style={{ pointerEvents: "auto", alignSelf: "flex-start" }}
      >
        {/* Fila: Ancho */}
        <div className="flex items-center gap-1 bg-white/95 border border-slate-300 rounded shadow px-1.5 py-0.5">
          <span className="text-[10px] font-bold text-slate-500 uppercase mr-0.5">
            Ancho
          </span>
          <button
            onClick={() => cambiar(setEscalaAncho, -1)}
            disabled={escalaAncho <= ZOOM_MIN}
            className="w-6 h-6 rounded border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40"
            title="Achicar ancho"
          >
            −
          </button>
          <span className="w-10 text-center text-[11px] font-semibold text-slate-700 tabular-nums">
            {Math.round(escalaAncho * 100)}%
          </span>
          <button
            onClick={() => cambiar(setEscalaAncho, 1)}
            disabled={escalaAncho >= ZOOM_MAX}
            className="w-6 h-6 rounded border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40"
            title="Agrandar ancho"
          >
            +
          </button>
        </div>

        {/* Fila: Alto */}
        <div className="flex items-center gap-1 bg-white/95 border border-slate-300 rounded shadow px-1.5 py-0.5">
          <span className="text-[10px] font-bold text-slate-500 uppercase mr-0.5">
            Alto
          </span>
          <button
            onClick={() => cambiar(setEscalaAlto, -1)}
            disabled={escalaAlto <= ZOOM_MIN}
            className="w-6 h-6 rounded border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40"
            title="Achicar alto"
          >
            −
          </button>
          <span className="w-10 text-center text-[11px] font-semibold text-slate-700 tabular-nums">
            {Math.round(escalaAlto * 100)}%
          </span>
          <button
            onClick={() => cambiar(setEscalaAlto, 1)}
            disabled={escalaAlto >= ZOOM_MAX}
            className="w-6 h-6 rounded border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40"
            title="Agrandar alto"
          >
            +
          </button>
        </div>

        {/* Fila: acciones */}
        <div className="flex items-center gap-1">
          <button
            onClick={reestablecer}
            className="px-2 h-7 rounded bg-white/95 border border-slate-300 text-slate-700 text-[11px] font-semibold hover:bg-white shadow"
            title="Restablecer ancho y alto"
          >
            ↺ Restablecer
          </button>
          <button
            onClick={togglePantallaCompleta}
            className="px-2 h-7 rounded bg-white/95 border border-slate-300 text-slate-700 text-[11px] font-semibold hover:bg-white shadow"
            title={
              enPantallaCompleta
                ? "Salir de pantalla completa"
                : "Pantalla completa"
            }
          >
            {enPantallaCompleta ? "⤢ Salir" : "⛶ Pantalla completa"}
          </button>
        </div>

        {hayStretch && (
          <span className="text-[9px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
            ⚠️ Estirado (ancho ≠ alto)
          </span>
        )}
      </div>

      <svg
        width={anchoRender}
        height={altoRender}
        viewBox={
          orientacion === "vertical"
            ? `0 0 ${TOTAL_ANCHO_EXT} ${TOTAL_ALTO_EXT}`
            : `0 0 ${TOTAL_ALTO_EXT} ${TOTAL_ANCHO_EXT}`
        }
        preserveAspectRatio="none"
        style={{
          userSelect: "none",
          touchAction: "manipulation",
          cursor: onMiniClick ? "crosshair" : "default",
          flexShrink: 0,
          margin: "auto",
        }}
        onPointerMove={handleMove}
        onPointerLeave={handleLeave}
        onPointerDown={handleClick}
      >
        {/* MARCO EXTERIOR (celeste claro) */}
        <rect
          x={0}
          y={0}
          width={anchoBase}
          height={altoBase}
          fill={COLOR_MARCO}
          pointerEvents="none"
        />

        <g
          transform={
            orientacion === "horizontal"
              ? `translate(${MARGEN + TOTAL_ALTO} ${MARGEN}) rotate(90)`
              : `translate(${MARGEN} ${MARGEN})`
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
                  strokeWidth={1}
                />

                {Array.from({ length: c.miniFils }).map((_, f) =>
                  Array.from({ length: c.miniCols }).map((_, col) => {
                    const r = rectMini(c, f + 1, col + 1);
                    return (
                      <rect
                        key={`${c.id}-m-${f}-${col}`}
                        x={r.x}
                        y={r.y}
                        width={r.w}
                        height={r.h}
                        fill="transparent"
                        stroke={colores.borde}
                        strokeWidth={0.25}
                        opacity={0.4}
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
              fillOpacity={0.4}
              stroke="#0284c7"
              strokeWidth={1}
              pointerEvents="none"
            />
          )}

          {children}

          <rect
            x={0}
            y={0}
            width={TOTAL_ANCHO}
            height={TOTAL_ALTO}
            fill="none"
            stroke="#1e293b"
            strokeWidth={1.5}
            pointerEvents="none"
          />
        </g>
      </svg>
    </div>
  );
}