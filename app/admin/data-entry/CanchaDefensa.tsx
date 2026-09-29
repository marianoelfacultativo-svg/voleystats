"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { celdasDeContexto, keyPunto, minisDeCelda, type Celda } from "@/lib/cancha";
import type { DefensaRow } from "@/lib/db";

type Rol = "L" | "A" | "O" | "Pd" | "Pz" | "C";
type Modo = "parado" | "salvada" | "error";

const ROLES: { id: Rol; label: string }[] = [
  { id: "L", label: "Líbero" },
  { id: "A", label: "Armador" },
  { id: "O", label: "Opuesto" },
  { id: "Pd", label: "Punta delantero" },
  { id: "Pz", label: "Punta zaguero" },
  { id: "C", label: "Central" },
];

const COLORES_MODO: Record<Modo, string> = {
  parado: "#64748b",
  salvada: "#16a34a",
  error: "#dc2626",
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
  const [modo, setModo] = useState<Modo>("parado");
  const [rolActivo, setRolActivo] = useState<Rol>("L");

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

  const clickPunto = (p: Punto) => {
    onAgregar({
      celda: p.celda,
      mini: p.mini,
      rol: rolActivo,
      tipo: modo,
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT") return;
      if (e.key === "1") setModo("parado");
      if (e.key === "2") setModo("salvada");
      if (e.key === "3") setModo("error");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-2 text-[10px] flex-wrap gap-1">
        <div className="flex items-center gap-1">
          <span className="font-semibold text-slate-600">Modo:</span>
          <button
            onClick={() => setModo("parado")}
            className={`px-2 py-0.5 rounded ${modo === "parado" ? "bg-slate-700 text-white" : "bg-slate-200 hover:bg-slate-300"}`}
          >
            ⭐ Parado (1)
          </button>
          <button
            onClick={() => setModo("salvada")}
            className={`px-2 py-0.5 rounded ${modo === "salvada" ? "bg-green-600 text-white" : "bg-slate-200 hover:bg-slate-300"}`}
          >
            ✓ Salvada (2)
          </button>
          <button
            onClick={() => setModo("error")}
            className={`px-2 py-0.5 rounded ${modo === "error" ? "bg-red-600 text-white" : "bg-slate-200 hover:bg-slate-300"}`}
          >
            ✗ Error (3)
          </button>
        </div>
        <div className="flex gap-1">
          <button
            onClick={onBorrarTodasParadas}
            className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 rounded"
          >
            🧹
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

      {modo === "parado" && (
        <div className="mb-2 p-1.5 bg-slate-50 border border-slate-200 rounded-md">
          <p className="text-[9px] font-semibold text-slate-500 uppercase mb-1">
            Rol:
          </p>
          <div className="flex flex-wrap gap-1">
            {ROLES.map((r) => (
              <button
                key={r.id}
                onClick={() => setRolActivo(r.id)}
                className={`px-1.5 py-0.5 text-[9px] font-medium rounded border transition ${
                  rolActivo === r.id
                    ? "bg-slate-800 text-white border-slate-800"
                    : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span className="font-bold mr-0.5">{r.id}</span>
              </button>
            ))}
          </div>
        </div>
      )}

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
                <circle
                  key={`salvada-${i}`}
                  cx={p.x + dx}
                  cy={p.y + 5}
                  r={4}
                  fill={COLORES_MODO.salvada}
                  stroke="white"
                  strokeWidth={1}
                />
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
      </div>

      <p className="text-[10px] text-slate-400 mt-2 text-center">
        Elegí modo (1-2-3) → clic. Pueden coexistir parado + salvada/error.
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
