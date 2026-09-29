"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  celdasDeContexto,
  keyPunto,
  minisDeCelda,
  type Celda,
} from "@/lib/cancha";
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
    d: Omit<
      DefensaRow,
      "id" | "partido_id" | "jugador_id" | "set_numero" | "punto_numero"
    >
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
    if (modo === "parado") {
      // Si ya hay una marca "parado" en esta mini, reemplazarla
      onAgregar({
        celda: p.celda,
        mini: p.mini,
        rol: rolActivo,
        tipo: "parado",
      });
    } else {
      onAgregar({
        celda: p.celda,
        mini: p.mini,
        rol: rolActivo,
        tipo: modo,
      });
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (
        t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.tagName === "SELECT"
      )
        return;
      // Atajos de modo
      if (e.key === "1") setModo("parado");
      if (e.key === "2") setModo("salvada");
      if (e.key === "3") setModo("error");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const celdas = useMemo(() => celdasDeContexto("defensa"), []);

  const renderCelda = (
    celda: Celda,
    tipo: "mini33" | "mini32" | "single"
  ) => {
    const minis = tipo === "single" ? [] : minisDeCelda(celda, "defensa");
    const bgBase = "bg-blue-50 border-blue-400";
    const bgMini = "bg-blue-200 hover:bg-blue-300";

    if (tipo === "single") {
      return (
        <div
          key={celda}
          ref={(el) => registrar(celda, el)}
          onClick={() => clickPunto({ celda, mini: null })}
          className={`rounded-lg cursor-pointer border-2 min-h-[80px] ${bgBase} hover:brightness-95`}
        />
      );
    }

    const cols = tipo === "mini32" ? 2 : 3;

    return (
      <div
        key={celda}
        className={`rounded-lg border-2 p-1 ${bgBase}`}
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: 2,
        }}
      >
        {minis.map((m) => {
          const k = `${celda}-${m}`;
          return (
            <div
              key={m}
              ref={(el) => registrar(k, el)}
              onClick={() => clickPunto({ celda, mini: m })}
              className={`min-h-[24px] rounded-sm cursor-pointer ${bgMini}`}
            />
          );
        })}
      </div>
    );
  };

  // Agrupar defensas por key para renderizar marcas
  const marcasPorCelda = useMemo(() => {
    const map: Record<
      string,
      { parado: DefensaRow[]; salvada: DefensaRow[]; error: DefensaRow[] }
    > = {};
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
    <div>
      <div className="flex items-center justify-between mb-3 text-xs flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-600">Modo:</span>
          <button
            onClick={() => setModo("parado")}
            className={`px-3 py-1 rounded ${
              modo === "parado"
                ? "bg-slate-700 text-white"
                : "bg-slate-200 hover:bg-slate-300"
            }`}
            title="Tecla 1"
          >
            ⭐ Parado (1)
          </button>
          <button
            onClick={() => setModo("salvada")}
            className={`px-3 py-1 rounded ${
              modo === "salvada"
                ? "bg-green-600 text-white"
                : "bg-slate-200 hover:bg-slate-300"
            }`}
            title="Tecla 2"
          >
            ✓ Salvada (2)
          </button>
          <button
            onClick={() => setModo("error")}
            className={`px-3 py-1 rounded ${
              modo === "error"
                ? "bg-red-600 text-white"
                : "bg-slate-200 hover:bg-slate-300"
            }`}
            title="Tecla 3"
          >
            ✗ Error (3)
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onBorrarTodasParadas}
            className="px-3 py-1 bg-slate-200 hover:bg-slate-300 rounded"
          >
            🧹 Limpiar parados
          </button>
          <button
            onClick={onBorrarUltimo}
            disabled={defensasDelPunto.length === 0}
            className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded disabled:opacity-40"
          >
            🗑 Borrar último
          </button>
        </div>
      </div>

      {/* Roles para modo parado */}
      {modo === "parado" && (
        <div className="mb-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <p className="text-xs font-semibold text-slate-500 uppercase mb-2">
            Rol del jugador parado:
          </p>
          <div className="flex flex-wrap gap-1">
            {ROLES.map((r) => (
              <button
                key={r.id}
                onClick={() => setRolActivo(r.id)}
                className={`px-3 py-1 text-xs font-medium rounded-lg border transition ${
                  rolActivo === r.id
                    ? "bg-slate-800 text-white border-slate-800"
                    : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span className="font-bold mr-1">{r.id}</span>
                <span className="text-slate-400">{r.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div ref={containerRef} className="relative select-none">
        <div className="grid grid-cols-5 gap-1.5">
          {celdas.map(({ celda, tipo }) => renderCelda(celda, tipo))}
        </div>

        {/* Marcas */}
        <svg
          className="absolute inset-0 pointer-events-none"
          style={{ width: "100%", height: "100%" }}
        >
          {Object.entries(marcasPorCelda).map(([k, marcas]) => {
            const p = posicion(k);
            if (!p) return null;

            // Offset para que no se superpongan
            const tieneMultiples =
              marcas.parado.length +
                marcas.salvada.length +
                marcas.error.length >
              1;

            const elementos: JSX.Element[] = [];

            marcas.parado.forEach((d, i) => {
              const dx = tieneMultiples ? -6 + i * 3 : 0;
              elementos.push(
                <g key={`parado-${i}`} transform={`translate(${p.x + dx}, ${p.y - 6})`}>
                  {/* Estrella gris */}
                  <polygon
                    points={estrella(0, 0, 7, 4)}
                    fill={COLORES_MODO.parado}
                    stroke="white"
                    strokeWidth={1.2}
                  />
                  <text
                    x={0}
                    y={2.5}
                    textAnchor="middle"
                    fontSize={6}
                    fontWeight="bold"
                    fill="white"
                  >
                    {d.rol}
                  </text>
                </g>
              );
            });

            marcas.salvada.forEach((_, i) => {
              const dx = tieneMultiples ? -5 + i * 10 : 0;
              elementos.push(
                <circle
                  key={`salvada-${i}`}
                  cx={p.x + dx}
                  cy={p.y + 6}
                  r={5}
                  fill={COLORES_MODO.salvada}
                  stroke="white"
                  strokeWidth={1.5}
                />
              );
            });

            marcas.error.forEach((_, i) => {
              const dx = tieneMultiples ? -5 + i * 10 : 0;
              const cy = p.y + 6;
              elementos.push(
                <g key={`error-${i}`} transform={`translate(${p.x + dx}, ${cy})`}>
                  <line
                    x1={-4}
                    y1={-4}
                    x2={4}
                    y2={4}
                    stroke={COLORES_MODO.error}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                  />
                  <line
                    x1={4}
                    y1={-4}
                    x2={-4}
                    y2={4}
                    stroke={COLORES_MODO.error}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                  />
                </g>
              );
            });

            return <g key={k}>{elementos}</g>;
          })}
        </svg>
      </div>

      <p className="text-[11px] text-slate-400 mt-3 text-center">
        Elegí modo (1-2-3) → clic en la cancha. Modo parado: elegís rol y
        marcás dónde estaba. Pueden coexistir parado + salvada/error en la
        misma mini.
      </p>

      {/* Leyenda */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORES_MODO.parado }} />
          Parado
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORES_MODO.salvada }} />
          Salvada
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 relative">
            <span className="absolute inset-0 flex items-center justify-center text-red-600 font-bold">✗</span>
          </span>
          Error
        </span>
      </div>

      {defensasDelPunto.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-200">
          <p className="text-xs text-slate-500 mb-2">
            Marcas del punto ({defensasDelPunto.length}):
          </p>
          <div className="flex flex-wrap gap-2">
            {defensasDelPunto.map((d, i) => (
              <div
                key={i}
                className="flex items-center gap-1 px-2 py-1 rounded border text-xs"
                style={{
                  borderColor: COLORES_MODO[d.tipo],
                  color: COLORES_MODO[d.tipo],
                }}
              >
                <span className="font-semibold">
                  {d.tipo === "parado"
                    ? `⭐${d.rol}`
                    : d.tipo === "salvada"
                    ? "✓"
                    : "✗"}
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

// Genera los puntos de una estrella
function estrella(cx: number, cy: number, rExt: number, rInt: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? rExt : rInt;
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${cx + r * Math.cos(ang)},${cy + r * Math.sin(ang)}`);
  }
  return pts.join(" ");
}
