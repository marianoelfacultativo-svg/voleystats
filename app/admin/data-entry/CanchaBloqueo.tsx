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

const VALORACIONES: {
  id: Valoracion;
  label: string;
  color: string;
}[] = [
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

// Zonas de la red: 4 (izq), 3 (centro), 2 (der)
const ZONAS: { zona: 4 | 3 | 2; x: number; label: string }[] = [
  { zona: 4, x: 0.17, label: "Zona 4" },
  { zona: 3, x: 0.5, label: "Zona 3" },
  { zona: 2, x: 0.83, label: "Zona 2" },
];

interface BloqueadorActivo {
  zona: 4 | 3 | 2;
  x: number; // 0..1
}

interface Props {
  bloqueosDelPunto: BloqueoRow[];
  onAgregar: (
    b: Omit<
      BloqueoRow,
      "id" | "partido_id" | "jugador_id" | "set_numero" | "punto_numero"
    >
  ) => void;
  onBorrarUltimo: () => void;
}

function zonaDesdeX(x: number): 4 | 3 | 2 {
  if (x < 0.34) return 4;
  if (x > 0.66) return 2;
  return 3;
}

export default function CanchaBloqueo({
  bloqueosDelPunto,
  onAgregar,
  onBorrarUltimo,
}: Props) {
  const [activo, setActivo] = useState<BloqueadorActivo | null>({
    zona: 3,
    x: 0.5,
  });
  const [selector, setSelector] = useState(false);
  const barraRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ inicioX: number; movido: boolean } | null>(null);

  // ---- Drag ----
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { inicioX: e.clientX, movido: false };
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current || !activo || !barraRef.current) return;
      const dx = Math.abs(e.clientX - dragRef.current.inicioX);
      if (dx > 4) dragRef.current.movido = true;

      const rect = barraRef.current.getBoundingClientRect();
      const xRel = (e.clientX - rect.left) / rect.width;
      const x = Math.max(0, Math.min(1, xRel));
      setActivo({ zona: zonaDesdeX(x), x });
    };
    const onUp = () => {
      if (!dragRef.current) return;
      const movido = dragRef.current.movido;
      dragRef.current = null;
      if (!movido) {
        // fue un click → abrir selector
        setSelector(true);
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [activo]);

  // ---- Confirmar valoración ----
  const elegir = (v: Valoracion) => {
    if (!activo) return;
    onAgregar({
      posicion_x: activo.x,
      zona: activo.zona,
      valoracion: v,
    });
    setSelector(false);
    // nuevo muñequito en el centro
    setActivo({ zona: 3, x: 0.5 });
  };

  // Posición de bloqueos guardados
  const guardados = useMemo(() => {
    return bloqueosDelPunto.map((b) => ({
      ...b,
      color: COLOR_VAL[b.valoracion as Valoracion] ?? "#64748b",
      label: ETIQUETA_VAL[b.valoracion as Valoracion] ?? b.valoracion,
    }));
  }, [bloqueosDelPunto]);

  // Atajos de teclado para valoración
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selector) return;
      const t = e.target as HTMLElement;
      if (
        t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.tagName === "SELECT"
      )
        return;
      const n = parseInt(e.key);
      if (n >= 1 && n <= 6) {
        elegir(VALORACIONES[n - 1].id);
      }
      if (e.key === "Escape") setSelector(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selector, activo]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-600">
            Arrastrá el muñequito, soltá sin mover para valorar.
          </span>
        </div>
        <button
          onClick={onBorrarUltimo}
          disabled={bloqueosDelPunto.length === 0}
          className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded disabled:opacity-40"
        >
          🗑 Borrar último
        </button>
      </div>

      {/* Red */}
      <div className="relative">
        {/* Etiquetas de zonas */}
        <div className="flex justify-between text-[10px] text-slate-400 mb-1 px-1">
          {ZONAS.map((z) => (
            <span key={z.zona} className="flex-1 text-center">
              {z.label}
            </span>
          ))}
        </div>

        {/* Barra de la red */}
        <div
          ref={barraRef}
          className="relative h-32 rounded-xl border-4 border-slate-700 overflow-hidden"
          style={{
            background:
              "repeating-linear-gradient(90deg, #f1f5f9 0px, #f1f5f9 6px, #e2e8f0 6px, #e2e8f0 12px)",
          }}
        >
          {/* Líneas verticales de zona */}
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
                className="mt-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full text-white"
                style={{ backgroundColor: b.color }}
              >
                {b.label}
              </span>
            </div>
          ))}

          {/* Muñequito activo */}
          {activo && !selector && (
            <div
              onMouseDown={onMouseDown}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-grab active:cursor-grabbing"
              style={{ left: `${activo.x * 100}%` }}
            >
              <div className="w-12 h-12 rounded-full bg-slate-800 border-4 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold select-none">
                {activo.zona}
              </div>
              <span className="block text-center text-[9px] text-slate-500 mt-1">
                arrastrá
              </span>
            </div>
          )}
        </div>

        {/* Selector de valoración flotante */}
        {selector && activo && (
          <div className="absolute z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white border-2 border-slate-300 rounded-xl shadow-lg p-3 w-[320px]">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2 text-center">
              Valoración del bloqueo
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
                  <span className="text-[9px] opacity-80 mt-0.5">
                    tecla {i + 1}
                  </span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setSelector(false)}
              className="w-full mt-2 py-1 text-xs text-slate-500 hover:text-slate-700"
            >
              Cancelar (Esc)
            </button>
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-400 mt-3 text-center">
        El muñequito vuelve al centro después de cada valoración. Se reinicia
        con cada rotación.
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
                <span>{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
