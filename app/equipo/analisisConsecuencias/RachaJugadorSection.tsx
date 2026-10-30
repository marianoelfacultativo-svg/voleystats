"use client";

// ============================================================
// RACHA JUGADOR SECTION — Análisis de consecuencias
// ============================================================
// Filtro de racha específica de un jugador: puntos ganados/perdidos
// seguidos, errores/aciertos seguidos.
// ============================================================

import {
  type AmbitoRacha,
  type RachaJugadorFiltro,
  type TipoRachaJugador,
} from "@/lib/analisisConsecuencias";
import { AMBITOS, TIPOS_RACHA_JUGADOR } from "./constantes";
import { inputCls, selectCls } from "./helpers";

// ------------------------------------------------------------
// PROPS
// ------------------------------------------------------------

interface Props {
  racha: RachaJugadorFiltro | null;
  onCambiar: (r: RachaJugadorFiltro | null) => void;
  jugadoresParaDropdown: { id: string; nombre: string }[];
}

// ------------------------------------------------------------
// COMPONENTE
// ------------------------------------------------------------

export default function RachaJugadorSection({
  racha,
  onCambiar,
  jugadoresParaDropdown,
}: Props) {
  const activo = !!racha;

  return (
    <details
      className={`rounded border ${
        activo
          ? "border-violet-500/40 bg-violet-500/[0.04]"
          : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <summary className="px-2 py-1 cursor-pointer text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
        <span>🔥 Racha de jugador {activo && "✓"}</span>
        <span className="text-slate-500 text-[9px]">▼</span>
      </summary>
      <div className="p-2 pt-0 space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-[9px] text-slate-500 italic">
            Ej: &quot;después de 2 errores seguidos&quot;
          </p>
          <button
            onClick={() =>
              onCambiar(
                activo
                  ? null
                  : {
                      jugadorId: null,
                      tipo: "errores_seguidos",
                      minimo: 2,
                      ambito: "puntos_del_set",
                    }
              )
            }
            className={`shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded border ${
              activo
                ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                : "bg-violet-500/20 text-violet-300 border-violet-500/40"
            }`}
          >
            {activo ? "✕" : "+"}
          </button>
        </div>

        {racha && (
          <div className="grid grid-cols-2 gap-1">
            <select
              value={racha.tipo}
              onChange={(e) =>
                onCambiar({
                  ...racha,
                  tipo: e.target.value as TipoRachaJugador,
                })
              }
              className={`${selectCls} col-span-2`}
            >
              {TIPOS_RACHA_JUGADOR.map((t) => (
                <option key={t.v} value={t.v}>
                  {t.label}
                </option>
              ))}
            </select>
            <select
              value={racha.ambito}
              onChange={(e) =>
                onCambiar({
                  ...racha,
                  ambito: e.target.value as AmbitoRacha,
                })
              }
              className={selectCls}
            >
              {AMBITOS.map((a) => (
                <option key={a.v} value={a.v}>
                  {a.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              max={10}
              value={racha.minimo}
              onChange={(e) =>
                onCambiar({
                  ...racha,
                  minimo: Math.max(1, parseInt(e.target.value || "1", 10)),
                })
              }
              className={inputCls}
              placeholder="Mínimo"
            />
            <select
              value={racha.jugadorId ?? "trigger"}
              onChange={(e) =>
                onCambiar({
                  ...racha,
                  jugadorId:
                    e.target.value === "trigger" ? null : e.target.value,
                })
              }
              className={`${selectCls} col-span-2`}
            >
              <option value="trigger">Jugador del trigger</option>
              {jugadoresParaDropdown.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.nombre}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </details>
  );
}