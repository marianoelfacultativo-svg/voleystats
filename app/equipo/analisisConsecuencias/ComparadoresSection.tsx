"use client";

// ============================================================
// COMPARADORES SECTION — Análisis de consecuencias
// ============================================================
// Comparadores activos contra el trigger / acción anterior.
// ============================================================

import type { CoincidenciaFiltro } from "@/lib/analisisConsecuencias";
import { COMPARADORES } from "./constantes";

// ------------------------------------------------------------
// PROPS
// ------------------------------------------------------------

interface Props {
  coincidencias: CoincidenciaFiltro;
  setCoincidencias: (c: CoincidenciaFiltro) => void;
}

// ------------------------------------------------------------
// COMPONENTE
// ------------------------------------------------------------

export default function ComparadoresSection({
  coincidencias,
  setCoincidencias,
}: Props) {
  const cantActivos = Object.values(coincidencias).filter(Boolean).length;

  const toggle = (key: keyof CoincidenciaFiltro) => {
    setCoincidencias({ ...coincidencias, [key]: !coincidencias[key] });
  };

  return (
    <details
      className={`rounded border ${
        cantActivos > 0
          ? "border-violet-500/40 bg-violet-500/[0.04]"
          : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <summary className="px-2 py-1 cursor-pointer text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
        <span>🔗 Comparadores ({cantActivos})</span>
        <span className="text-slate-500 text-[9px]">▼</span>
      </summary>
      <div className="p-2 pt-0 flex flex-wrap gap-1">
        {COMPARADORES.map((c) => {
          const act = coincidencias[c.key];
          return (
            <button
              key={c.key}
              onClick={() => toggle(c.key)}
              className={`px-2 py-0.5 text-[10px] font-semibold rounded border transition flex items-center gap-1 ${
                act
                  ? "bg-violet-500/30 border-violet-400/60 text-violet-200"
                  : "bg-white/[0.02] border-white/10 text-slate-400 hover:text-white"
              }`}
            >
              <span>{act ? "✓" : "+"}</span>
              <span>{c.etiqueta}</span>
            </button>
          );
        })}
      </div>
    </details>
  );
}