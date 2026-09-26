"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface ArmadoLinea {
  origen: { celda: string; mini: string | null };
  destino: { celda: string; mini: string | null };
  calidad: number;
}

export interface PuntoArmador {
  numero: number;
  lineas: ArmadoLinea[];
  atacanteDerecho: "arriba" | "abajo";
  armadorNumero: 1 | 2;
}

interface Props {
  puntos: PuntoArmador[];
  onPuntosChange: (puntos: PuntoArmador[]) => void;
}

const CELDAS: { id: string; tipo: "mini32" | "mini33" | "single" }[] = [
  { id: "F1-C1", tipo: "mini32" },
  { id: "F1-C2", tipo: "mini33" },
  { id: "F1-C3", tipo: "mini33" },
  { id: "F1-C4", tipo: "mini33" },
  { id: "F1-C5", tipo: "mini32" },
  { id: "F2-C1", tipo: "mini32" },
  { id: "F2-C2", tipo: "mini33" },
  { id: "F2-C3", tipo: "mini33" },
  { id: "F2-C4", tipo: "mini33" },
  { id: "F2-C5", tipo: "mini32" },
  { id: "F3-C1", tipo: "single" },
  { id: "F3-C2", tipo: "single" },
  { id: "F3-C3", tipo: "single" },
  { id: "F3-C4", tipo: "single" },
  { id: "F3-C5", tipo: "single" },
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

export function calcularZonaTendencia(
  celda: string,
  atacante: "arriba" | "abajo"
): number | null {
  const arriba = atacante === "arriba";
  switch (celda) {
    case "F1-C1": return 4;
    case "F1-C2": return 4;
    case "F1-C3": return 3;
    case "F1-C4": return arriba ? 2 : 1;
    case "F1-C5": return arriba ? 2 : 1;
    case "F2-C1": return null;
    case "F2-C2": return null;
    case "F2-C3": return 6;
    case "F2-C4": return arriba ? 2 : 1;
    case "F2-C5": return arriba ? 2 : 1;
    case "F3-C1": return null;
    case "F3-C2": return null;
    case "F3-C3": return 6;
    case "F3-C4": return arriba ? 2 : 1;
    case "F3-C5": return arriba ? 2 : 1;
    default: return null;
  }
}

export default function TableroArmador({ puntos, onPuntosChange }: Props) {
  const [puntoIdx, setPuntoIdx] = useState(0);
  const [ocultarViejos, setOcultarViejos] = useState(true);
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

  const containerRef = useRef<HTMLDivElement>(null);
  const refs = useRef<Record<string, HTMLDivElement | null>>({});

  const puntoActual = puntos[puntoIdx] ?? {
    numero: 1,
    lineas: [],
    atacanteDerecho: "arriba" as const,
    armadorNumero: 1 as const,
  };

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
    const nuevos = [...puntos];
    while (nuevos.length <= puntoIdx) {
      nuevos.push({
        numero: nuevos.length + 1,
        lineas: [],
        atacanteDerecho: "arriba",
        armadorNumero: 1,
      });
    }
    nuevos[puntoIdx] = {
      ...nuevos[puntoIdx],
      lineas: [
        ...nuevos[puntoIdx].lineas,
        { origen: o, destino: d, calidad },
      ],
    };
    onPuntosChange(nuevos);
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

  const clickDerechoCelda = (e: React.MouseEvent, key: string) => {
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
  }, [selector]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "a" || selector) return;
      const t = e.target as HTMLElement;
      if (
        t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.tagName === "SELECT"
      )
        return;
      const nuevos = [...puntos];
      while (nuevos.length <= puntoIdx) {
        nuevos.push({
          numero: nuevos.length + 1,
          lineas: [],
          atacanteDerecho: "arriba",
          armadorNumero: 1,
        });
      }
      nuevos[puntoIdx] = {
        ...nuevos[puntoIdx],
        atacanteDerecho:
          nuevos[puntoIdx].atacanteDerecho === "arriba" ? "abajo" : "arriba",
      };
      onPuntosChange(nuevos);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [puntos, puntoIdx, onPuntosChange, selector]);

  const cambiarPunto = (dir: number) => {
    const target = puntoIdx + dir;
    if (target < 0) return;
    if (target >= puntos.length) {
      const nuevos = [...puntos];
      nuevos.push({
        numero: nuevos.length + 1,
        lineas: [],
        atacanteDerecho: "arriba",
        armadorNumero: 1,
      });
      onPuntosChange(nuevos);
      setPuntoIdx(nuevos.length - 1);
    } else {
      setPuntoIdx(target);
    }
    setOrigenPendiente(null);
    setSelector(null);
  };

  const borrarLinea = () => {
    if (puntoActual.lineas.length === 0) return;
    const nuevos = [...puntos];
    nuevos[puntoIdx] = {
      ...nuevos[puntoIdx],
      lineas: nuevos[puntoIdx].lineas.slice(0, -1),
    };
    onPuntosChange(nuevos);
  };

  const borrarPunto = () => {
    if (puntos.length <= 1) {
      const nuevos: PuntoArmador[] = [
        {
          numero: 1,
          lineas: [],
          atacanteDerecho: "arriba",
          armadorNumero: 1,
        },
      ];
      onPuntosChange(nuevos);
      setPuntoIdx(0);
      return;
    }
    const nuevos = puntos.filter((_, i) => i !== puntoIdx);
    onPuntosChange(nuevos);
    setPuntoIdx(Math.max(0, puntoIdx - 1));
  };

  const cambiarAtacante = (v: "arriba" | "abajo") => {
    const nuevos = [...puntos];
    while (nuevos.length <= puntoIdx) {
      nuevos.push({
        numero: nuevos.length + 1,
        lineas: [],
        atacanteDerecho: "arriba",
        armadorNumero: 1,
      });
    }
    nuevos[puntoIdx] = { ...nuevos[puntoIdx], atacanteDerecho: v };
    onPuntosChange(nuevos);
  };

  const cambiarArmador = (v: 1 | 2) => {
    const nuevos = [...puntos];
    while (nuevos.length <= puntoIdx) {
      nuevos.push({
        numero: nuevos.length + 1,
        lineas: [],
        atacanteDerecho: "arriba",
        armadorNumero: 1,
      });
    }
    nuevos[puntoIdx] = { ...nuevos[puntoIdx], armadorNumero: v };
    onPuntosChange(nuevos);
  };

  const lineasRender = useMemo(() => {
    const out: {
      origenKey: string;
      destinoKey: string;
      color: string;
      calidad: number;
      esActual: boolean;
    }[] = [];
    puntos.forEach((p, pi) => {
      p.lineas.forEach((l) => {
        const origenKey = l.origen.mini
          ? `${l.origen.celda}-${l.origen.mini}`
          : l.origen.celda;
        const destinoKey = l.destino.mini
          ? `${l.destino.celda}-${l.destino.mini}`
          : l.destino.celda;
        out.push({
          origenKey,
          destinoKey,
          color: COLORES_CALIDAD[l.calidad] ?? "#64748b",
          calidad: l.calidad,
          esActual: pi === puntoIdx,
        });
      });
    });
    return out;
  }, [puntos, puntoIdx]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button
          onClick={() => cambiarPunto(-1)}
          disabled={puntoIdx === 0}
          className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-40"
        >
          ◀
        </button>
        <button
          onClick={() => cambiarPunto(1)}
          className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm hover:bg-slate-50"
        >
          ▶
        </button>
        <span className="text-sm font-medium text-slate-700">
          Punto {puntoIdx + 1} de {puntos.length}
        </span>
        <button
          onClick={() => setOcultarViejos(!ocultarViejos)}
          className={`px-3 py-1.5 rounded-lg text-xs border transition ${
            ocultarViejos
              ? "bg-slate-800 text-white border-slate-800"
              : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
          }`}
        >
          {ocultarViejos ? "Mostrar viejos" : "Ocultar viejos"}
        </button>
        <button
          onClick={borrarLinea}
          disabled={puntoActual.lineas.length === 0}
          className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs hover:bg-red-100 disabled:opacity-40"
        >
          🗑 Borrar línea
        </button>
        <button
          onClick={borrarPunto}
          className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs hover:bg-red-100"
        >
          ✕ Borrar punto
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-slate-500 uppercase">
            Atacante derecho:
          </span>
          <div className="flex rounded-lg overflow-hidden border border-slate-300">
            <button
              onClick={() => cambiarAtacante("arriba")}
              className={`px-3 py-1 text-xs font-medium transition ${
                puntoActual.atacanteDerecho === "arriba"
                  ? "bg-emerald-500 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              Arriba (2)
            </button>
            <button
              onClick={() => cambiarAtacante("abajo")}
              className={`px-3 py-1 text-xs font-medium transition ${
                puntoActual.atacanteDerecho === "abajo"
                  ? "bg-emerald-500 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              Abajo (1)
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-slate-500 uppercase">
            Armador:
          </span>
          <div className="flex rounded-lg overflow-hidden border border-slate-300">
            <button
              onClick={() => cambiarArmador(1)}
              className={`px-3 py-1 text-xs font-medium transition ${
                puntoActual.armadorNumero === 1
                  ? "bg-violet-500 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              Armador 1
            </button>
            <button
              onClick={() => cambiarArmador(2)}
              className={`px-3 py-1 text-xs font-medium transition ${
                puntoActual.armadorNumero === 2
                  ? "bg-violet-500 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              Armador 2
            </button>
          </div>
        </div>
      </div>

      <div ref={containerRef} className="relative select-none">
        <div className="grid grid-cols-5 gap-1.5 bg-emerald-50 p-2 rounded-xl border-2 border-emerald-300">
          {CELDAS.map((c) => (
            <div key={c.id} className="min-h-[90px]">
              {c.tipo === "single" ? (
                <CeldaSimple
                  celdaId={c.id}
                  registrar={registrar}
                  activa={origenPendiente === c.id}
                  onClick={() => clickCelda(c.id)}
                  onContextMenu={(e) => clickDerechoCelda(e, c.id)}
                />
              ) : (
                <MiniTabla
                  celdaId={c.id}
                  subs={c.tipo === "mini32" ? MINI32_SUBS : MINI33_SUBS}
                  cols={c.tipo === "mini32" ? 2 : 3}
                  registrar={registrar}
                  origenPendiente={origenPendiente}
                  onClick={(mini) => clickCelda(`${c.id}-${mini}`)}
                  onContextMenu={(e, mini) =>
                    clickDerechoCelda(e, `${c.id}-${mini}`)
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
          {lineasRender.map((l, i) => {
            if (!l.esActual && ocultarViejos) return null;
            const o = posicion(l.origenKey);
            const d = posicion(l.destinoKey);
            if (!o || !d) return null;
            return (
              <line
                key={i}
                x1={o.x}
                y1={o.y}
                x2={d.x}
                y2={d.y}
                stroke={l.color}
                strokeWidth={3}
                strokeLinecap="round"
                opacity={l.esActual ? 1 : 0.15}
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
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  opacity={0.75}
                />
              );
            })()}
        </svg>

        {lineasRender.map((l, i) => {
          if (!l.esActual && ocultarViejos) return null;
          const d = posicion(l.destinoKey);
          if (!d) return null;
          return (
            <div
              key={i}
              className="absolute pointer-events-none flex items-center justify-center text-white text-[10px] font-bold rounded-full"
              style={{
                left: d.x,
                top: d.y,
                transform: "translate(-50%, -50%)",
                width: "18px",
                height: "18px",
                backgroundColor: l.color,
                opacity: l.esActual ? 1 : 0.25,
                boxShadow: "0 0 0 2px white",
                zIndex: 10,
              }}
            >
              {l.calidad}
            </div>
          );
        })}

        {selector && (
          <div
            className="absolute z-50 bg-white border-2 border-slate-300 rounded-xl shadow-lg p-2 flex gap-1"
            style={{
              left: selector.x,
              top: selector.y,
              transform: "translate(-50%, calc(-100% - 8px))",
            }}
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                onClick={() => elegirCalidad(n)}
                className="w-9 h-9 rounded-lg text-white font-bold text-sm transition hover:scale-110"
                style={{ backgroundColor: COLORES_CALIDAD[n] }}
              >
                {n}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-400 mt-3 text-center">
        Clic origen → clic destino (o clic derecho). Elegí calidad con 1-6.
        Tecla &quot;a&quot; alterna atacante derecho.
      </p>
    </div>
  );
}

interface MiniTablaProps {
  celdaId: string;
  subs: string[];
  cols: number;
  registrar: (key: string, el: HTMLDivElement | null) => void;
  origenPendiente: string | null;
  onClick: (mini: string) => void;
  onContextMenu: (e: React.MouseEvent, mini: string) => void;
}

function MiniTabla({
  celdaId,
  subs,
  cols,
  registrar,
  origenPendiente,
  onClick,
  onContextMenu,
}: MiniTablaProps) {
  return (
    <div
      className="grid gap-[2px] p-1 bg-white border-2 border-slate-300 rounded-lg w-full h-full"
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
            className={`rounded-sm cursor-pointer transition min-h-[20px] ${
              activa
                ? "bg-emerald-500 ring-2 ring-emerald-700"
                : "bg-slate-100 hover:bg-emerald-100"
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
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

function CeldaSimple({
  celdaId,
  registrar,
  activa,
  onClick,
  onContextMenu,
}: CeldaSimpleProps) {
  return (
    <div
      ref={(el) => registrar(celdaId, el)}
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`w-full h-full rounded-lg cursor-pointer transition border-2 ${
        activa
          ? "bg-emerald-500 border-emerald-700"
          : "bg-white border-slate-300 hover:bg-emerald-50"
      }`}
    />
  );
}