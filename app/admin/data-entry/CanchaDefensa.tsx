"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { celdasDeContexto, keyPunto, minisDeCelda, type Celda } from "@/lib/cancha";
import type { DefensaRow } from "@/lib/db";

type Rol = "L" | "A" | "O" | "Pd" | "Pz" | "C";
type Paso = "parado" | "evaluacion";
type Evaluacion = "salvada" | "error" | "neutro";

const ROLES: { id: Rol; label: string; tecla: string }[] = [
  { id: "L", label: "Líbero", tecla: "L" },
  { id: "A", label: "Armador", tecla: "A" },
  { id: "O", label: "Opuesto", tecla: "O" },
  { id: "C", label: "Central", tecla: "C" },
  { id: "Pz", label: "Punta zaguero", tecla: "Z" },
  { id: "Pd", label: "Punta delantero", tecla: "D" },
];

const EVALUACIONES: { id: Evaluacion; label: string; color: string; tecla: string }[] = [
  { id: "salvada", label: "Salvada", color: "#16a34a", tecla: "S" },
  { id: "error", label: "Error", color: "#dc2626", tecla: "E" },
  { id: "neutro", label: "Neutro", color: "#64748b", tecla: "N" },
];

const COLORES_MODO: Record<string, string> = {
  parado: "#64748b",
  salvada: "#16a34a",
  error: "#dc2626",
  neutro: "#94a3b8",
};

interface Punto {
  celda: string;
  mini: string | null;
}

interface Props {
  defensasDelPunto: DefensaRow[];
  onAgregar: (
    d: Omit<DefensaRow, "id" | "partido_id" | "jugador_id" | "set_numero" | "punto_numero">
  ) => void;
  onBorrarUltimo: () => void;
  onBorrarTodasParadas: () => void;
}

export default function CanchaDefensa({
  defensasDelPunto,
  onAgregar,
  onBorrarUltimo,
  onBorrarTodasParadas,
}: Props) {
  const [paso, setPaso] = useState<Paso>("parado");
  const [celdaPendiente, setCeldaPendiente] = useState<Punto | null>(null);
  const [miniPendiente, setMiniPendiente] = useState<Punto | null>(null);

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

  // ---- Click en celda ----
  const clickPunto = (p: Punto) => {
    if (paso === "parado") {
      // Abrir globo de roles en esa celda
      setCeldaPendiente(p);
    } else if (paso === "evaluacion" && miniPendiente) {
      // Guardar evaluación en la celda del jugador parado
      onAgregar({
        celda: miniPendiente.celda,
        mini: miniPendiente.mini,
        rol: "L", // placeholder, no aplica
        tipo: "salvada", // se reemplaza abajo
      });
      // La evaluación se maneja con elegirEvaluacion
      setCeldaPendiente(p);
    }
  };

  // ---- Elegir rol → guarda "parado" y pasa a evaluación ----
  const elegirRol = (rol: Rol) => {
    if (!celdaPendiente) return;
    onAgregar({
      celda: celdaPendiente.celda,
      mini: celdaPendiente.mini,
      rol,
      tipo: "parado",
    });
    setMiniPendiente(celdaPendiente);
    setCeldaPendiente(null);
    setPaso("evaluacion");
  };

  // ---- Elegir evaluación → guarda y vuelve a parado ----
  const elegirEvaluacion = (ev: Evaluacion) => {
    if (!miniPendiente) return;
    if (ev !== "neutro") {
      onAgregar({
        celda: miniPendiente.celda,
        mini: miniPendiente.mini,
        rol: "L",
        tipo: ev,
      });
    }
    setMiniPendiente(null);
    setPaso("parado");
  };

  const saltarEvaluacion = () => {
    setMiniPendiente(null);
    setPaso("parado");
  };

  const cancelar = () => {
    setCeldaPendiente(null);
    setMiniPendiente(null);
    setPaso("parado");
  };

  // ---- Teclado ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT") return;
      const k = e.key.toUpperCase();

      if (e.key === "Escape") {
        cancelar();
        return;
      }

      if (paso === "parado" && celdaPendiente) {
        const r = ROLES.find((x) => x.tecla === k);
        if (r) elegirRol(r.id);
      }

      if (paso === "evaluacion" && miniPendiente) {
        const ev = EVALUACIONES.find((x) => x.tecla === k);
        if (ev) elegirEvaluacion(ev.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paso, celdaPendiente, miniPendiente]);

  const celdas = useMemo(() => celdasDeContexto("defensa"), []);

  const esColumnaMedia = (celda: string) => {
    const col = celda.split("-")[1];
    return col === "C2" || col === "C3" || col === "C4";
  };

  const renderCelda = (celda: Celda, tipo: "mini33" | "mini32" | "single") => {
    const minis = tipo === "single" ? [] : minisDeCelda(celda, "defensa");
    const esMedia = esColumnaMedia(celda);
    const bgBase = esMedia ? "bg-blue-100 border-blue-500" : "bg-blue-50 border-blue-300";
    const bgMini = esMedia ? "bg-blue-300 hover:bg-blue-400" : "bg-blue-200 hover:bg-blue-300";

    if (tipo === "single") {
      return (
        <div
          key={celda}
          ref={(el) => registrar(celda, el)}
          onClick={() => clickPunto({ celda, mini: null })}
          className={`rounded-md cursor-pointer border-2 min-h-[60px] ${bgBase} hover:brightness-95`}
        />
      );
    }

    const cols = tipo === "mini32" ? 2 : 3;

    return (
      <div
        key={celda}
        className={`rounded-md border-2 p-0.5 ${bgBase}`}
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: 1,
        }}
      >
        {minis.map((m) => {
          const k = `${celda}-${m}`;
          return (
            <div
              key={m}
              ref={(el) => registrar(k, el)}
              onClick={() => clickPunto({ celda, mini: m })}
              className={`min-h-[18px] rounded-sm cursor-pointer ${bgMini}`}
            />
          );
        })}
      </div>
    );
  };

  const marcasPorCelda = useMemo(() => {
    const map: Record<string, { parado: DefensaRow[]; salvada: DefensaRow[]; error: DefensaRow[] }> = {};
    for (const d of defensasDelPunto) {
      const k = keyPunto(d.celda, d.mini);
      if (!map[k]) map[k] = { parado: [], salvada: [], error: [] };
      if (d.tipo === "parado") map[k].parado.push(d);
      else if (d.tipo === "salvada") map[k].salvada.push(d);
      else if (d.tipo === "error") map[k].error.push(d);
    }
    return map;
  }, [defensasDelPunto]);

  const celdaPendientePos = celdaPendiente ? posicion(keyPunto(celdaPendiente.celda, celdaPendiente.mini)) : null;
  const evalPendientePos = miniPendiente ? posicion(keyPunto(miniPendiente.celda, miniPendiente.mini)) : null;

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-2 text-[10px]">
        <div className="flex items-center gap-1.5">
          <span className={`px-1.5 py-0.5 rounded font-semibold ${paso === "parado" ? "bg-slate-700 text-white" : "bg-slate-200"}`}>
            1. Dónde estaba parado
          </span>
          <span className={`px-1.5 py-0.5 rounded font-semibold ${paso === "evaluacion" ? "bg-emerald-600 text-white" : "bg-slate-200"}`}>
            2. Evaluación de la acción
          </span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={onBorrarTodasParadas}
            className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 rounded"
            title="Borrar todos los parados del punto"
          >
            🧹 Parados
          </button>
          <button
            onClick={onBorrarUltimo}
            disabled={defensasDelPunto.length === 0}
            className="px-2 py-0.5 bg-red-100 hover:bg-red-200 text-red-700 rounded disabled:opacity-40"
          >
            🗑
          </button>
        </div>
      </div>

      <div ref={containerRef} className="relative select-none">
        <div className="grid grid-cols-5 gap-0.5">
          {celdas.map(({ celda, tipo }) => renderCelda(celda, tipo))}
        </div>

        <svg className="absolute inset-0 pointer-events-none" style={{ width: "100%", height: "100%" }}>
          {Object.entries(marcasPorCelda).map(([k, marcas]) => {
            const p = posicion(k);
            if (!p) return null;

            const total = marcas.parado.length + marcas.salvada.length + marcas.error.length;
            const tieneMultiples = total > 1;
            const elementos: JSX.Element[] = [];

            marcas.parado.forEach((d, i) => {
              const dx = tieneMultiples ? -5 + i * 3 : 0;
              elementos.push(
                <g key={`parado-${i}`} transform={`translate(${p.x + dx}, ${p.y - 5})`}>
                  <polygon points={estrella(0, 0, 5.5, 3)} fill={COLORES_MODO.parado} stroke="white" strokeWidth={1} />
                  <text x={0} y={2} textAnchor="middle" fontSize={5} fontWeight="bold" fill="white">
                    {d.rol}
                  </text>
                </g>
              );
            });

            marcas.salvada.forEach((_, i) => {
              const dx = tieneMultiples ? -4 + i * 8 : 0;
              elementos.push(
                <circle key={`salvada-${i}`} cx={p.x + dx} cy={p.y + 5} r={4} fill={COLORES_MODO.salvada} stroke="white" strokeWidth={1} />
              );
            });

            marcas.error.forEach((_, i) => {
              const dx = tieneMultiples ? -4 + i * 8 : 0;
              const cy = p.y + 5;
              elementos.push(
                <g key={`error-${i}`} transform={`translate(${p.x + dx}, ${cy})`}>
                  <line x1={-3} y1={-3} x2={3} y2={3} stroke={COLORES_MODO.error} strokeWidth={2} strokeLinecap="round" />
                  <line x1={3} y1={-3} x2={-3} y2={3} stroke={COLORES_MODO.error} strokeWidth={2} strokeLinecap="round" />
                </g>
              );
            });

            return <g key={k}>{elementos}</g>;
          })}
        </svg>

        {/* Globo de roles (paso 1) */}
        {paso === "parado" && celdaPendiente && celdaPendientePos && (
          <div
            className="absolute z-50 bg-white border-2 border-slate-300 rounded-lg shadow-lg p-2 w-[260px]"
            style={{
              left: celdaPendientePos.x,
              top: celdaPendientePos.y,
              transform: "translate(-50%, calc(-100% - 8px))",
            }}
          >
            <p className="text-[10px] font-bold text-slate-500 uppercase mb-1 text-center">
              Rol del jugador
            </p>
            <div className="grid grid-cols-3 gap-1">
              {ROLES.map((r) => (
                <button
                  key={r.id}
                  onClick={() => elegirRol(r.id)}
                  className="py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-semibold flex flex-col items-center"
                >
                  <span className="font-bold">{r.id}</span>
                  <span className="text-[8px] text-slate-500">({r.tecla})</span>
                </button>
              ))}
            </div>
            <button
              onClick={cancelar}
              className="w-full mt-1 py-0.5 text-[9px] text-slate-400 hover:text-slate-600"
            >
              Cancelar (Esc)
            </button>
          </div>
        )}

        {/* Globo de evaluación (paso 2) */}
        {paso === "evaluacion" && evalPendientePos && (
          <div
            className="absolute z-50 bg-white border-2 border-emerald-400 rounded-lg shadow-lg p-2 w-[220px]"
            style={{
              left: evalPendientePos.x,
              top: evalPendientePos.y,
              transform: "translate(-50%, calc(-100% - 8px))",
            }}
          >
            <p className="text-[10px] font-bold text-emerald-700 uppercase mb-1 text-center">
              ¿Cómo salió la acción?
            </p>
            <div className="grid grid-cols-3 gap-1">
              {EVALUACIONES.map((ev) => (
                <button
                  key={ev.id}
                  onClick={() => elegirEvaluacion(ev.id)}
                  className="py-1.5 rounded text-white text-[10px] font-semibold flex flex-col items-center"
                  style={{ backgroundColor: ev.color }}
                >
                  <span>{ev.label}</span>
                  <span className="text-[8px] opacity-80">({ev.tecla})</span>
                </button>
              ))}
            </div>
            <button
              onClick={saltarEvaluacion}
              className="w-full mt-1 py-0.5 text-[9px] text-slate-400 hover:text-slate-600"
            >
              Saltar (sin guardar)
            </button>
          </div>
        )}
      </div>

      <p className="text-[10px] text-slate-400 mt-2 text-center">
        Clic celda → rol (L/A/O/C/Z/D) → evaluación (S/E/N). Esc cancela.
      </p>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORES_MODO.parado }} />
          Parado
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORES_MODO.salvada }} />
          Salvada
        </span>
        <span className="flex items-center gap-1 text-red-600 font-bold">✗ Error</span>
      </div>

      {defensasDelPunto.length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-200">
          <p className="text-[10px] text-slate-500 mb-1">
            Marcas ({defensasDelPunto.length}):
          </p>
          <div className="flex flex-wrap gap-1">
            {defensasDelPunto.map((d, i) => (
              <div
                key={i}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px]"
                style={{ borderColor: COLORES_MODO[d.tipo], color: COLORES_MODO[d.tipo] }}
              >
                <span className="font-semibold">
                  {d.tipo === "parado" ? `⭐${d.rol}` : d.tipo === "salvada" ? "✓" : "✗"}
                </span>
                <span className="text-slate-500">
                  {d.celda}
                  {d.mini ? `-${d.mini}` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function estrella(cx: number, cy: number, rExt: number, rInt: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? rExt : rInt;
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${cx + r * Math.cos(ang)},${cy + r * Math.sin(ang)}`);
  }
  return pts.join(" ");
}
