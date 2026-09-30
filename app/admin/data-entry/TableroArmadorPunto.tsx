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

export interface PuntoArmador {
  numero: number;
  lineas: ArmadoLinea[];
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
  }, [punto.lineas.length, punto.numero]);

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
              className="absolute pointer-events-none flex items-center justify-center text-white text-[9px] font-bold rounded-full"
              style={{
                left: d.x,
                top: d.y,
                transform: "translate(-50%, -50%)",
                width: "14px",
                height: "14px",
                backgroundColor: color,
                boxShadow: "0 0 0 1.5px white",
                zIndex: 10,
              }}
            >
              {l.calidad}
            </div>
          );
        })}

        {selector && (
          <div
            data-popup
            className="absolute z-50 bg-white border-2 border-slate-300 rounded-lg shadow-lg p-1.5 flex gap-1"
            style={{
              left: selector.x,
              top: selector.y,
              transform: "translate(-50%, calc(-100% - 6px))",
            }}
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                onClick={() => elegirCalidad(n)}
                className="w-7 h-7 rounded text-white font-bold text-[11px] transition hover:scale-110"
                style={{ backgroundColor: COLORES_CALIDAD[n] }}
              >
                {n}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="text-[10px] text-slate-400 mt-2 text-center">
        Clic origen → clic destino (o clic derecho). Elegí calidad con 1-6.
      </p>

      {punto.lineas.length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-200">
          <p className="text-[10px] text-slate-500 mb-1">
            Armados del punto ({punto.lineas.length}):
          </p>
          <div className="flex flex-wrap gap-1">
            {punto.lineas.map((l, i) => {
              const color = COLORES_CALIDAD[l.calidad] ?? "#64748b";
              return (
                <div
                  key={i}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px]"
                  style={{ borderColor: color, color }}
                >
                  <span className="font-semibold">C{l.calidad}</span>
                  <span className="text-slate-500">{coordDe(l)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface MiniTablaProps {
  celdaId: string;
  subs: string[];
  cols: number;
  registrar: (key: string, el: HTMLDivElement | null) => void;
  origenPendiente: string | null;
  zona: "afuera" | "medio";
  onClick: (mini: string) => void;
  onContextMenu: (e: React.MouseEvent, mini: string) => void;
}

function MiniTabla({
  celdaId,
  subs,
  cols,
  registrar,
  origenPendiente,
  zona,
  onClick,
  onContextMenu,
}: MiniTablaProps) {
  const bordeCelda =
    zona === "medio" ? "border-emerald-600" : "border-slate-300";
  const bgCelda = zona === "medio" ? "bg-emerald-200" : "bg-white";
  const bgSub = zona === "medio" ? "bg-emerald-400" : "bg-slate-100";
  const bgSubHover =
    zona === "medio" ? "hover:bg-emerald-500" : "hover:bg-emerald-100";

  return (
    <div
      className={`grid gap-[2px] p-0.5 ${bgCelda} border-2 ${bordeCelda} rounded-md w-full h-full`}
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
    >
      {subs.map((sub) => {
        const key = `${celdaId}-${sub}`;
        const activa = origenPendiente === key;
        return (
          <div
            key={sub}
            ref={(el) => registrar(key, el)}
            onClick={() => onClick(sub)}
            onContextMenu={(e) => onContextMenu(e, sub)}
            className={`rounded-sm cursor-pointer transition min-h-[14px] ${
              activa
                ? "bg-emerald-500 ring-2 ring-emerald-700"
                : `${bgSub} ${bgSubHover}`
            }`}
          />
        );
      })}
    </div>
  );
}

interface CeldaSimpleProps {
  celdaId: string;
  registrar: (key: string, el: HTMLDivElement | null) => void;
  activa: boolean;
  zona: "afuera" | "medio";
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

function CeldaSimple({
  celdaId,
  registrar,
  activa,
  zona,
  onClick,
  onContextMenu,
}: CeldaSimpleProps) {
  const bordeBase =
    zona === "medio" ? "border-emerald-600" : "border-slate-300";
  const bgBase = zona === "medio" ? "bg-emerald-200" : "bg-white";
  const bgHover =
    zona === "medio" ? "hover:bg-emerald-300" : "hover:bg-emerald-50";

  return (
    <div
      ref={(el) => registrar(celdaId, el)}
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`w-full h-full rounded-md cursor-pointer transition border-2 ${
        activa
          ? "bg-emerald-500 border-emerald-700"
          : `${bgBase} ${bordeBase} ${bgHover}`
      }`}
    />
  );
}