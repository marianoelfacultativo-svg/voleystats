"use client";

// ============================================================
// PATRÓN SECTION — Análisis de consecuencias
// ============================================================
// Secuencia exacta de hasta 3 acciones previas al trigger.
// ============================================================

import {
  etiquetaResultado,
  resultadosPorTipoAnalisis,
  type ItemPatron,
  type PatronPrevioFiltro,
  type TipoDisparador,
} from "@/lib/analisisConsecuencias";
import { TIPOS } from "./constantes";
import { selectCls } from "./helpers";

// ------------------------------------------------------------
// PROPS
// ------------------------------------------------------------

interface Props {
  patron: PatronPrevioFiltro | null;
  onCambiar: (p: PatronPrevioFiltro | null) => void;
}

// ------------------------------------------------------------
// COMPONENTE
// ------------------------------------------------------------

export default function PatronSection({ patron, onCambiar }: Props) {
  const activo = !!patron;

  const agregar = () => {
    if (!patron) {
      onCambiar({
        acciones: [{ tipo: "recepcion", resultado: "cualquiera" }],
      });
      return;
    }
    if (patron.acciones.length >= 3) return;
    onCambiar({
      acciones: [
        ...patron.acciones,
        { tipo: "armado", resultado: "cualquiera" },
      ],
    });
  };

  const eliminar = (i: number) => {
    if (!patron) return;
    if (patron.acciones.length <= 1) {
      onCambiar(null);
      return;
    }
    onCambiar({
      acciones: patron.acciones.filter((_, idx) => idx !== i),
    });
  };

  const actualizar = (i: number, cambios: Partial<ItemPatron>) => {
    if (!patron) return;
    onCambiar({
      acciones: patron.acciones.map((a, idx) =>
        idx === i ? { ...a, ...cambios } : a
      ),
    });
  };

  return (
    <details
      className={`rounded border ${
        activo
          ? "border-violet-500/40 bg-violet-500/[0.04]"
          : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <summary className="px-2 py-1 cursor-pointer text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
        <span>
          🎯 Patrón previo {activo && `(${patron!.acciones.length})`}
        </span>
        <span className="text-slate-500 text-[9px]">▼</span>
      </summary>
      <div className="p-2 pt-0 space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-[9px] text-slate-500 italic">
            Secuencia exacta de hasta 3 acciones previas.
          </p>
          <div className="flex gap-1">
            {activo && (
              <button
                onClick={() => onCambiar(null)}
                className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded border bg-rose-500/20 text-rose-300 border-rose-500/40"
              >
                ✕
              </button>
            )}
            <button
              onClick={agregar}
              disabled={activo && patron!.acciones.length >= 3}
              className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded border bg-violet-500/20 text-violet-300 border-violet-500/40 disabled:opacity-40"
            >
              + Acción
            </button>
          </div>
        </div>

        {patron && patron.acciones.length > 0 && (
          <div className="space-y-1">
            {patron.acciones.map((item, i) => (
              <div
                key={i}
                className="grid grid-cols-[auto_1fr_auto] gap-1 items-center"
              >
                <span className="text-[9px] text-slate-500">{i + 1}.</span>
                <div className="grid grid-cols-2 gap-1">
                  <select
                    value={item.tipo}
                    onChange={(e) =>
                      actualizar(i, {
                        tipo: e.target.value as TipoDisparador,
                        resultado: "cualquiera",
                      })
                    }
                    className={selectCls}
                  >
                    {TIPOS.map((t) => (
                      <option key={t.v} value={t.v}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={item.resultado}
                    onChange={(e) =>
                      actualizar(i, { resultado: e.target.value })
                    }
                    className={selectCls}
                  >
                    {resultadosPorTipoAnalisis(item.tipo).map((r) => (
                      <option key={r} value={r}>
                        {etiquetaResultado(r)}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => eliminar(i)}
                  className="text-rose-400 hover:text-rose-300 text-[10px]"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}