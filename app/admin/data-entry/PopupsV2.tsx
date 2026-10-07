"use client";

import { useEffect, useRef } from "react";

// ============================================================
// TIPOS
// ============================================================

export interface PopupPos {
  x: number;
  y: number;
}

export type ResultadoPopupArmado = {
  tipo: "armado";
  calidad: 1 | 2 | 3 | 4 | 5 | 6 | "T";
};

export type ResultadoPopupDefensa = {
  tipo: "defensa";
  subtipo: "toque" | "gran-defensa" | "libre";
  jugadorId: string | null;
};

export type ResultadoPopupLibre = {
  tipo: "libre";
  jugadorId: string | null;
};

export type ResultadoPopupToqueRed = {
  tipo: "toque-red";
  resultado:
    | "ofensivo-propio"
    | "invasión-zaguero-propio"
    | "invasión-delantero-propio"
    | "toque-red-rival";
};

export type ResultadoPopup =
  | ResultadoPopupArmado
  | ResultadoPopupDefensa
  | ResultadoPopupLibre
  | ResultadoPopupToqueRed;

// ============================================================
// ESTILOS
// ============================================================

const SOMBRA =
  "0 8px 20px rgba(0,0,0,0.25), 0 0 0 2px rgba(0,0,0,0.05)";

const COLOR_ARMADO: Record<number, string> = {
  1: "#dc2626",
  2: "#f97316",
  3: "#eab308",
  4: "#84cc16",
  5: "#22c55e",
  6: "#10b981",
};

// ============================================================
// WRAPPER
// ============================================================

interface WrapperProps {
  pos: PopupPos;
  titulo: string;
  children: React.ReactNode;
  onCancelar: () => void;
}

function PopupWrapper({ pos, titulo, children, onCancelar }: WrapperProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancelar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancelar]);

  return (
    <div
      ref={ref}
      data-popup
      className="absolute z-[200] bg-white rounded-xl p-3"
      style={{
        left: pos.x,
        top: pos.y,
        transform: "translate(-50%, calc(-100% - 8px))",
        boxShadow: SOMBRA,
        minWidth: 220,
      }}
    >
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide text-center mb-2">
        {titulo}
      </p>
      {children}
    </div>
  );
}

// ============================================================
// POPUP ARMADO
// ============================================================

interface PropsArmado {
  pos: PopupPos;
  onConfirmar: (calidad: ResultadoPopupArmado["calidad"]) => void;
  onCancelar: () => void;
}

export function PopupArmado({ pos, onConfirmar, onCancelar }: PropsArmado) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "t") onConfirmar("T");
      const n = parseInt(e.key);
      if (n >= 1 && n <= 6) onConfirmar(n as 1 | 2 | 3 | 4 | 5 | 6);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onConfirmar]);

  return (
    <PopupWrapper pos={pos} titulo="Armado — Calidad" onCancelar={onCancelar}>
      <div className="flex flex-wrap gap-1.5 justify-center">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <button
            key={n}
            onClick={() => onConfirmar(n as 1 | 2 | 3 | 4 | 5 | 6)}
            className="w-9 h-9 rounded-lg text-white font-bold text-sm hover:scale-110 transition"
            style={{ backgroundColor: COLOR_ARMADO[n] }}
          >
            {n}
          </button>
        ))}
        <button
          onClick={() => onConfirmar("T")}
          className="w-9 h-9 rounded-lg bg-slate-700 text-white font-bold text-sm hover:scale-110 transition"
          title="Toque de segunda"
        >
          T
        </button>
      </div>
      <button
        onClick={onCancelar}
        className="w-full mt-2 py-1 text-[10px] text-slate-400 hover:text-slate-600"
      >
        Cancelar (Esc)
      </button>
    </PopupWrapper>
  );
}

// ============================================================
// POPUP DEFENSA
// ============================================================

interface PropsDefensa {
  pos: PopupPos;
  jugadores: { id: string; nombre: string }[];
  onConfirmar: (r: ResultadoPopupDefensa) => void;
  onCancelar: () => void;
}

const TIPOS_DEFENSA: {
  id: ResultadoPopupDefensa["subtipo"];
  label: string;
  color: string;
}[] = [
  { id: "toque", label: "Toque", color: "#f59e0b" },
  { id: "gran-defensa", label: "Gran defensa", color: "#16a34a" },
  { id: "libre", label: "Libre", color: "#a16207" },
];

export function PopupDefensa({
  pos,
  jugadores,
  onConfirmar,
  onCancelar,
}: PropsDefensa) {
  return (
    <PopupWrapper
      pos={pos}
      titulo="Defensa — Tipo y responsable"
      onCancelar={onCancelar}
    >
      <div className="grid grid-cols-3 gap-1.5 mb-2">
        {TIPOS_DEFENSA.map((t) => (
          <button
            key={t.id}
            onClick={() =>
              onConfirmar({ tipo: "defensa", subtipo: t.id, jugadorId: null })
            }
            className="py-1.5 rounded text-white text-[10px] font-semibold hover:scale-105 transition"
            style={{ backgroundColor: t.color }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="text-[9px] text-slate-500 uppercase tracking-wide text-center mb-1">
        ¿Quién la hizo?
      </p>
      <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
        {jugadores.map((j) => (
          <button
            key={j.id}
            onClick={() =>
              onConfirmar({
                tipo: "defensa",
                subtipo: "toque",
                jugadorId: j.id,
              })
            }
            className="px-2 py-0.5 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-300"
          >
            {j.nombre}
          </button>
        ))}
      </div>
      <button
        onClick={onCancelar}
        className="w-full mt-2 py-1 text-[10px] text-slate-400 hover:text-slate-600"
      >
        Saltar (Esc)
      </button>
    </PopupWrapper>
  );
}

// ============================================================
// POPUP LIBRE
// ============================================================

interface PropsLibre {
  pos: PopupPos;
  jugadores: { id: string; nombre: string }[];
  onConfirmar: (r: ResultadoPopupLibre) => void;
  onCancelar: () => void;
}

export function PopupLibre({
  pos,
  jugadores,
  onConfirmar,
  onCancelar,
}: PropsLibre) {
  return (
    <PopupWrapper pos={pos} titulo="Libre — ¿Quién la pasó?" onCancelar={onCancelar}>
      <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto">
        {jugadores.map((j) => (
          <button
            key={j.id}
            onClick={() =>
              onConfirmar({ tipo: "libre", jugadorId: j.id })
            }
            className="px-2 py-0.5 text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-800 rounded border border-amber-300"
          >
            {j.nombre}
          </button>
        ))}
      </div>
      <button
        onClick={() => onConfirmar({ tipo: "libre", jugadorId: null })}
        className="w-full mt-2 py-1 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 rounded"
      >
        Sin asignar
      </button>
      <button
        onClick={onCancelar}
        className="w-full mt-1 py-1 text-[10px] text-slate-400 hover:text-slate-600"
      >
        Cancelar (Esc)
      </button>
    </PopupWrapper>
  );
}

// ============================================================
// POPUP TOQUE DE RED / INVASIÓN
// ============================================================

interface PropsToqueRed {
  pos: PopupPos;
  onConfirmar: (r: ResultadoPopupToqueRed) => void;
  onCancelar: () => void;
}

const OPCIONES_TOQUE_RED: {
  id: ResultadoPopupToqueRed["resultado"];
  label: string;
  color: string;
}[] = [
  {
    id: "ofensivo-propio",
    label: "Ofensivo (toque red propio)",
    color: "#dc2626",
  },
  {
    id: "invasión-zaguero-propio",
    label: "Invasión propia — zaguero",
    color: "#f97316",
  },
  {
    id: "invasión-delantero-propio",
    label: "Invasión propia — delantero",
    color: "#ea580c",
  },
  {
    id: "toque-red-rival",
    label: "Toque de red rival",
    color: "#0284c7",
  },
];

export function PopupToqueRed({
  pos,
  onConfirmar,
  onCancelar,
}: PropsToqueRed) {
  return (
    <PopupWrapper
      pos={pos}
      titulo="Toque de red / Invasión"
      onCancelar={onCancelar}
    >
      <div className="grid grid-cols-1 gap-1">
        {OPCIONES_TOQUE_RED.map((o) => (
          <button
            key={o.id}
            onClick={() =>
              onConfirmar({ tipo: "toque-red", resultado: o.id })
            }
            className="py-1.5 rounded text-white text-[10px] font-semibold hover:scale-[1.02] transition"
            style={{ backgroundColor: o.color }}
          >
            {o.label}
          </button>
        ))}
      </div>
      <button
        onClick={onCancelar}
        className="w-full mt-2 py-1 text-[10px] text-slate-400 hover:text-slate-600"
      >
        Cancelar (Esc)
      </button>
    </PopupWrapper>
  );
}

// ============================================================
// EXPORTS
// ============================================================

export type { PopupPos as PopupPosicion };