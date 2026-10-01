"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

export interface ArmadoLinea {
  origen: { celda: string; mini: string | null };
  destino: { celda: string; mini: string | null };
  calidad: number;
}

export type ValoracionToque = "punto" | "neutro" | "error";

export interface PuntoArmador {
  numero: number;
  lineas: ArmadoLinea[];
  toques: ValoracionToque[];
  armadorNumero: 1 | 2 | null;
}

interface Props {
  punto: PuntoArmador;
  onChange: (p: PuntoArmador) => void;
}

const CELDAS: {
  id: string;
  tipo: "mini32" | "mini33" | "single";
  zona: "afuera" | "medio";
}[] = [
  { id: "F1-C1", tipo: "mini32", zona: "afuera" },
  { id: "F1-C2", tipo: "mini33", zona: "medio" },
  { id: "F1-C3", tipo: "mini33", zona: "medio" },
  { id: "F1-C4", tipo: "mini33", zona: "medio" },
  { id: "F1-C5", tipo: "mini32", zona: "afuera" },
  { id: "F2-C1", tipo: "mini32", zona: "afuera" },
  { id: "F2-C2", tipo: "mini33", zona: "medio" },
  { id: "F2-C3", tipo: "mini33", zona: "medio" },
  { id: "F2-C4", tipo: "mini33", zona: "medio" },
  { id: "F2-C5", tipo: "mini32", zona: "afuera" },
  { id: "F3-C1", tipo: "single", zona: "afuera" },
  { id: "F3-C2", tipo: "single", zona: "medio" },
  { id: "F3-C3", tipo: "single", zona: "medio" },
  { id: "F3-C4", tipo: "single", zona: "medio" },
  { id: "F3-C5", tipo: "single", zona: "afuera" },
];

const MINI32_SUBS = ["f1c1", "f1c2", "f2c1", "f2c2", "f3c1", "f3c2"];
const MINI33_SUBS = [
  "f1c1", "f1c2", "f1c3",
  "f2c1", "f2c2", "f2c3",
  "f3c1", "f3c2", "f3c3",
];

const COLORES_CALIDAD: Record<number, string> = {
  1: "#dc2626",
  2: "#f97316",
  3: "#eab308",
  4: "#84cc16",
  5: "#22c55e",
  6: "#10b981",
};

const COLORES_TOQUE: Record<ValoracionToque, string> = {
  punto: "#16a34a",
  neutro: "#64748b",
  error: "#dc2626",
};

const ETIQUETAS_TOQUE: Record<ValoracionToque, string> = {
  punto: "Punto",
  neutro: "Neutro",
  error: "Error",
};

const ORDEN_TOQUES: ValoracionToque[] = ["punto", "neutro", "error"];

export function calcularZonaTendencia(celda: string): number | null {
  switch (celda) {
    case "F1-C1":
    case "F1-C2":
      return 4;
    case "F1-C3":
      return 3;
    case "F1-C4":
    case "F1-C5":
      return 2;
    case "F2-C3":
    case "F3-C3":
      return 6;
    case "F2-C4":
    case "F2-C5":
    case "F3-C4":
    case "F3-C5":
      return 2;
    default:
      return null;
  }
}

export default function TableroArmadorPunto({ punto, onChange }: Props) {
  const [origenPendiente, setOrigenPendiente] = useState<string | null>(null);
  const [selector, setSelector] = useState<{
    x: number;
    y: number;
    origen: string;
    destino: string;
  } | null>(null);
  const [preview, setPreview] = useState<{
    origen: string;
    x: number;
    y: number;
  } | null>(null);
  const [tick, setTick] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const refs = useRef<Record<string, HTMLDivElement | null>>({});

  const toques = punto.toques ?? [];

  const registrar = useCallback((key: string, el: HTMLDivElement | null) => {
    refs.current[key] = el;
  }, []);

  const posicion = useCallback((key: string) => {
    const el = refs.current[key];
    const cont = containerRef.current;
    if (!el || !cont) return null;
    const rEl = el.getBoundingClientRect();
    const rCont = cont.getBoundingClientRect();
    return {
      x: rEl.left + rEl.width / 2 - rCont.left,
      y: rEl.top + rEl.height / 2 - rCont.top,
    };
  }, []);

  useLayoutEffect(() => {
    setTick((t) => t + 1);
  }, [punto.lineas.length, toques.length, punto.numero]);

  useLayoutEffect(() => {
    const t = setTimeout(() => setTick((x) => x + 1), 0);
    const t2 = setTimeout(() => setTick((x) => x + 1), 150);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, []);

  const parseKey = (key: string): { celda: string; mini: string | null } => {
    const partes = key.split("-");
    if (partes.length === 2) return { celda: key, mini: null };
    return {
      celda: `${partes[0]}-${partes[1]}`,
      mini: partes.slice(2).join("-"),
    };
  };

  const abrirSelector = (origen: string, destino: string) => {
    const p = posicion(destino);
    if (!p) return;
    setSelector({ x: p.x, y: p.y, origen, destino });
    setOrigenPendiente(null);
    setPreview(null);
  };

  const elegirCalidad = (calidad: number) => {
    if (!selector) return;
    const o = parseKey(selector.origen);
    const d = parseKey(selector.destino);
    onChange({
      ...punto,
      lineas: [...punto.lineas, { origen: o, destino: d, calidad }],
    });
    setSelector(null);
  };

  const clickCelda = (key: string) => {
    if (selector) return;
    if (!origenPendiente) {
      setOrigenPendiente(key);
      return;
    }
    if (origenPendiente === key) {
      setOrigenPendiente(null);
      return;
    }
    abrirSelector(origenPendiente, key);
  };

  const clickDerecho = (e: React.MouseEvent, key: string) => {
    e.preventDefault();
    if (selector || !origenPendiente || origenPendiente === key) return;
    abrirSelector(origenPendiente, key);
  };

  useEffect(() => {
    if (!origenPendiente) {
      setPreview(null);
      return;
    }
    const onMove = (e: MouseEvent) => {
      const cont = containerRef.current;
      if (!cont) return;
      const r = cont.getBoundingClientRect();
      setPreview({
        origen: origenPendiente,
        x: e.clientX - r.left,
        y: e.clientY - r.top,
      });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [origenPendiente]);

  useEffect(() => {
    if (!selector) return;
    const onKey = (e: KeyboardEvent) => {
      const n = parseInt(e.key);
      if (n >= 1 && n <= 6) elegirCalidad(n);
      if (e.key === "Escape") setSelector(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selector, punto]);

  const agregarToque = (v: ValoracionToque) => {
    onChange({ ...punto, toques: [...toques, v] });
  };

  const borrarUltimoToque = () => {
    if (toques.length === 0) return;
    onChange({ ...punto, toques: toques.slice(0, -1) });
  };

  const borrarLinea = () => {
    if (punto.lineas.length === 0) return;
    onChange({ ...punto, lineas: punto.lineas.slice(0, -1) });
  };

  const coordDe = (l: ArmadoLinea) =>
    `${l.origen.celda}${l.origen.mini ? `-${l.origen.mini}` : ""} → ${
      l.destino.celda
    }${l.destino.mini ? `-${l.destino.mini}` : ""}`;

  return (
    <div className="max-w-xl mx-auto">
      {/* ======== PANEL DE TOQUES ======== */}
      <div className="mb-3 p-2.5 bg-pink-50 border-2 border-pink-300 rounded-lg">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-pink-700 uppercase tracking-wide mr-1">
            ✋ Toque
          </span>

          {ORDEN_TOQUES.map((v) => {
            const cant = toques.filter((t) => t === v).length;
            return (
              <button
                key={v}
                onClick={() => agregarToque(v)}
                className="px-3 py-1.5 rounded-lg text-white text-xs font-bold flex items-center gap-1.5 transition hover:scale-105 active:scale-95 shadow-sm"
                style={{ backgroundColor: COLORES_TOQUE[v] }}
                title={`Sumar 1 toque ${ETIQUETAS_TOQUE[v]}`}
              >
                <span>{ETIQUETAS_TOQUE[v]}</span>
                <span className="bg-white/30 rounded px-1.5 text-[10px] font-mono">
                  {cant}
                </span>
              </button>
            );
          })}

          <button
            onClick={borrarUltimoToque}
            disabled={toques.length === 0}
            className="ml-auto px-3 py-1.5 bg-white text-red-700 border border-red-300 rounded-lg text-xs font-medium hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Borra el último toque cargado"
          >
            🗑 Borrar último toque
          </button>
        </div>

        {toques.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            <span className="text-[10px] text-pink-700 font-semibold self-center mr-1">
              Secuencia:
            </span>
            {toques.map((t, i) => (
              <span
                key={i}
                className="text-[9px] font-bold text-white rounded px-1.5 py-0.5"
                style={{ backgroundColor: COLORES_TOQUE[t] }}
                title={`Toque #${i + 1}: ${ETIQUETAS_TOQUE[t]}`}
              >
                {ETIQUETAS_TOQUE[t]}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ======== TABLERO DE ARMADO ======== */}
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <button
          onClick={borrarLinea}
          disabled={punto.lineas.length === 0}
          className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded text-[10px] hover:bg-red-100 disabled:opacity-40"
        >
          🗑 Borrar última línea
        </button>
      </div>

      <div ref={containerRef} className="relative select-none">
        <div
          className="grid grid-cols-5 gap-1 p-1.5 rounded-lg border-2 border-emerald-400"
          style={{ background: "linear-gradient(180deg, #d1fae5 0%, #a7f3d0 100%)" }}
        >
          {CELDAS.map((c) => (
            <div key={c.id} className="min-h-[60px]">
              {c.tipo === "single" ? (
                <CeldaSimple
                  celdaId={c.id}
                  registrar={registrar}
                  activa={origenPendiente === c.id}
                  zona={c.zona}
                  onClick={() => clickCelda(c.id)}
                  onContextMenu={(e) => clickDerecho(e, c.id)}
                />
              ) : (
                <MiniTabla
                  celdaId={c.id}
                  subs={c.tipo === "mini32" ? MINI32_SUBS : MINI33_SUBS}
                  cols={c.tipo === "mini32" ? 2 : 3}
                  registrar={registrar}
                  origenPendiente={origenPendiente}
                  zona={c.zona}
                  onClick={(mini) => clickCelda(`${c.id}-${mini}`)}
                  onContextMenu={(e, mini) =>
                    clickDerecho(e, `${c.id}-${mini}`)
                  }
                />
              )}
            </div>
          ))}
        </div>

        <svg
          className="absolute inset-0 pointer-events-none"
          style={{ width: "100%", height: "100%" }}
        >
          {punto.lineas.map((l, i) => {
            const oKey = l.origen.mini
              ? `${l.origen.celda}-${l.origen.mini}`
              : l.origen.celda;
            const dKey = l.destino.mini
              ? `${l.destino.celda}-${l.destino.mini}`
              : l.destino.celda;
            const o = posicion(oKey);
            const d = posicion(dKey);
            if (!o || !d) return null;
            const color = COLORES_CALIDAD[l.calidad] ?? "#64748b";
            return (
              <line
                key={`${i}-${tick}`}
                x1={o.x}
                y1={o.y}
                x2={d.x}
                y2={d.y}
                stroke={color}
                strokeWidth={2.5}
                strokeLinecap="round"
              />
            );
          })}
          {preview &&
            (() => {
              const o = posicion(preview.origen);
              if (!o) return null;
              return (
                <line
                  x1={o.x}
                  y1={o.y}
                  x2={preview.x}
                  y2={preview.y}
                  stroke="#10b981"
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                  opacity={0.75}
                />
              );
            })()}
        </svg>

        {punto.lineas.map((l, i) => {
          const dKey = l.destino.mini
            ? `${l.destino.celda}-${l.destino.mini}`
            : l.destino.celda;
          const d = posicion(dKey);
          if (!d) return null;
          const color = COLORES_CALIDAD[l.calidad] ?? "#64748b";
          return (
            <div
              key={`${i}-${tick}`}
              className="absolute pointer-events-none flex items-center justify-center text-white text-[9