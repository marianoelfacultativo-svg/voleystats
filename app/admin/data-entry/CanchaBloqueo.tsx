"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BloqueoRow } from "@/lib/db";

type Valoracion =
  | "punto"
  | "positivo_mas"
  | "positivo"
  | "use_rival"
  | "red"
  | "filtrada";

const VALORACIONES: { id: Valoracion; label: string; color: string }[] = [
  { id: "punto", label: "Punto", color: "#16a34a" },
  { id: "positivo_mas", label: "Positivo +", color: "#65a30d" },
  { id: "positivo", label: "Positivo", color: "#84cc16" },
  { id: "use_rival", label: "Use Rival", color: "#eab308" },
  { id: "filtrada", label: "Filtrada", color: "#ea580c" },
  { id: "red", label: "Red", color: "#dc2626" },
];

const COLOR_VAL: Record<Valoracion, string> = VALORACIONES.reduce(
  (acc, v) => ({ ...acc, [v.id]: v.color }),
  {} as Record<Valoracion, string>
);

const ETIQUETA_VAL: Record<Valoracion, string> = VALORACIONES.reduce(
  (acc, v) => ({ ...acc, [v.id]: v.label }),
  {} as Record<Valoracion, string>
);

interface JugadorRed {
  zona: 4 | 3 | 2;
  jugador_id: string;
  nombre: string;
}

interface Bloqueador {
  zona: 4 | 3 | 2;
  x: number; // 0..1
  jugador_id: string;
  nombre: string;
}

interface Props {
  bloqueosDelPunto: BloqueoRow[];
  jugadoresRed: JugadorRed[];
  onAgregar: (
    b: Omit<
      BloqueoRow,
      "id" | "partido_id" | "set_numero" | "punto_numero"
    >
  ) => void;
  onBorrarUltimo: () => void;
}

function zonaDesdeX(x: number): 4 | 3 | 2 {
  if (x < 0.34) return 4;
  if (x > 0.66) return 2;
  return 3;
}

function xDeZona(z: 4 | 3 | 2): number {
  if (z === 4) return 0.17;
  if (z === 2) return 0.83;
  return 0.5;
}

export default function CanchaBloqueo({
  bloqueosDelPunto,
  jugadoresRed,
  onAgregar,
  onBorrarUltimo,
}: Props) {
  // 3 bloqueadores, uno por cada jugador de red
  const [bloqueadores, setBloqueadores] = useState<Bloqueador[]>([]);

  // Inicializar/reiniciar cuando cambia la rotación (jugadoresRed)
  useEffect(() => {
    setBloqueadores(
      jugadoresRed.map((j) => ({
        zona: j.zona,
        x: xDeZona(j.zona),
        jugador_id: j.jugador_id,
        nombre: j.nombre,
      }))
    );
  }, [jugadoresRed]);

  const [selectorIdx, setSelectorIdx] = useState<number | null>(null);
  const barraRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ idx: number; inicioX: number; movido: boolean } | null>(null);

  // ---- Drag ----
  const onMouseDown = (idx: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { idx, inicioX: e.clientX, movido: false };
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const dr = dragRef.current;
      if (!dr || !barraRef.current) return;
      const dx = Math.abs(e.clientX - dr.inicioX);
      if (dx > 4) dr.movido = true;

      const rect = barraRef.current.getBoundingClientRect();
      const xRel = (e.clientX - rect.left) / rect.width;
      const x = Math.max(0.05, Math.min(0.95, xRel));

      setBloqueadores((prev) =>
        prev.map((b, i) => (i === dr.idx ? { ...b, x, zona: zonaDesdeX(x) } : b))
      );
    };
    const onUp = () => {
      const dr = dragRef.current;
      if (!dr) return;
      const movido = dr.movido;
      const idx = dr.idx;
      dragRef.current = null;
      if (!movido) setSelectorIdx(idx);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  // ---- Confirmar valoración ----
  const elegir = (v: Valoracion) => {
    if (selectorIdx === null) return;
    const b = bloqueadores[selectorIdx];
    if (!b) return;

    onAgregar({
      jugador_id: b.jugador_id,
      posicion_x: b.x,
      zona: b.zona,
      valoracion: v,
    });

    // Volver el muñequito a su zona base
    setBloqueadores((prev) =>
      prev.map((bb, i) =>
        i === selectorIdx ? { ...bb, x: xDeZona(bb.zona), zona: bb.zona } : bb
      )
    );
    setSelectorIdx(null);
  };

  // Atajos teclado
  useEffect(() => {
    if (selectorIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT") return;
      const n = parseInt(e.key);
      if (n >= 1 && n <= 6) elegir(VALORACIONES[n - 1].id);
      if (e.key === "Escape") setSelectorIdx(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectorIdx, bloqueadores]);

  // Posición de bloqueos guardados
  const guardados = useMemo(() => {
    return bloqueosDelPunto.map((b) => ({
      ...b,
      color: COLOR_VAL[b.valoracion as Valoracion] ?? "#64748b",
      label: ETIQUETA_VAL[b.valoracion as Valoracion] ?? b.valoracion,
      nombre:
        jugadoresRed.find((j) => j.jugador_id === b.jugador_id)?.nombre ?? "?",
    }));
  }, [bloqueosDelPunto, jugadoresRed]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3 text-xs">
        <span className="font-semibold text-slate-600">
          Arrastrá cada muñequito. Soltá sin mover para valorar.
        </span>
        <button
          onClick={onBorrarUltimo}
          disabled={bloqueosDelPunto.length === 0}
          className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded disabled:opacity-40"
        >
          🗑 Borrar último
        </button>
      </div>

      <div className="relative">
        <div className="flex justify-between text-[10px] text-slate-400 mb-1 px-1">
          <span className="flex-1 text-center">Zona 4</span>
          <span className="flex-1 text-center">Zona 3</span>
          <span className="flex-1 text-center">Zona 2</span>
        </div>

        <div
          ref={barraRef}
          className="relative h-32 rounded-xl border-4 border-slate-700 overflow-hidden"
          style={{
            background:
              "repeating-linear-gradient(90deg, #f1f5f9 0px, #f1f5f9 6px, #e2e8f0 6px, #e2e8f0 12px)",
          }}
        >
          {[0.34, 0.66].map((x) => (
            <div
              key={x}
              className="absolute top-0 bottom-0 border-l-2 border-dashed border-slate-400 opacity-60"
              style={{ left: `${x * 100}%` }}
            />
          ))}

          {/* Bloqueos guardados */}
          {guardados.map((b, i) => (
            <div
              key={b.id ?? i}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none"
              style={{ left: `${b.posicion_x * 100}%` }}
            >
              <div
                className="w-10 h-10 rounded-full border-2 border-white shadow-md flex items-center justify-center text-white text-[10px] font-bold"
                style={{ backgroundColor: b.color }}
                title={b.label}
              >
                {b.zona}
              </div>
              <span
                className="mt-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full text-white whitespace-nowrap"
                style={{ backgroundColor: b.color }}
              >
                {b.label}
              </span>
            </div>
          ))}

          {/* 3 muñequitos activos */}
          {selectorIdx === null &&
            bloqueadores.map((b, i) => (
              <div
                key={i}
                onMouseDown={onMouseDown(i)}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-grab active:cursor-grabbing flex flex-col items-center"
                style={{ left: `${b.x * 100}%` }}
              >
                <div className="w-11 h-11 rounded-full bg-slate-800 border-4 border-white shadow-lg flex items-center justify-center text-white text-[10px] font-bold select-none">
                  {b.zona}
                </div>
                <span className="text-[9px] text-slate-600 bg-white/90 px-1 rounded whitespace-nowrap mt-0.5">
                  {b.nombre}
                </span>
              </div>
            ))}

          {/* Selector */}
          {selectorIdx !== null && bloqueadores[selectorIdx] && (
            <div className="absolute z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white border-2 border-slate-300 rounded-xl shadow-lg p-3 w-[320px]">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-2 text-center">
                Bloqueo de {bloqueadores[selectorIdx].nombre} (Z{bloqueadores[selectorIdx].zona})
              </p>
              <div className="grid grid-cols-3 gap-2">
                {VALORACIONES.map((v, i) => (
                  <button
                    key={v.id}
                    onClick={() => elegir(v.id)}
                    className="py-2 rounded-lg text-white text-xs font-semibold transition hover:scale-105 flex flex-col items-center"
                    style={{ backgroundColor: v.color }}
                  >
                    <span>{v.label}</span>
                    <span className="text-[9px] opacity-80 mt-0.5">tecla {i + 1}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setSelectorIdx(null)}
                className="w-full mt-2 py-1 text-xs text-slate-500 hover:text-slate-700"
              >
                Cancelar (Esc)
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="text-[11px] text-slate-400 mt-3 text-center">
        Los muñequitos se reinician con cada rotación.
      </p>

      {bloqueosDelPunto.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-200">
          <p className="text-xs text-slate-500 mb-2">
            Bloqueos del punto ({bloqueosDelPunto.length}):
          </p>
          <div className="flex flex-wrap gap-2">
            {guardados.map((b, i) => (
              <div
                key={b.id ?? i}
                className="flex items-center gap-1 px-2 py-1 rounded border text-xs"
                style={{ borderColor: b.color, color: b.color }}
              >
                <span className="font-semibold">Z{b.zona}</span>
                <span>{b.nombre}</span>
                <span>·</span>
                <span>{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
