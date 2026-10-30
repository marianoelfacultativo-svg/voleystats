"use client";

// ============================================================
// RACHAS SECTION — Análisis de consecuencias
// ============================================================
// Lista de rachas históricas configurables (múltiples). Cada racha
// tiene ámbito, mínimo, salto y un filtro de acción histórica.
// ============================================================

import {
  etiquetaResultado,
  resultadosPorTipoAnalisis,
  FILTRO_ACCION_HISTORICA_VACIO,
  type AmbitoRacha,
  type RachaHistorica,
  type TipoDisparador,
} from "@/lib/analisisConsecuencias";
import { AMBITOS, TIPOS } from "./constantes";
import { inputCls, selectCls, resumenRacha } from "./helpers";

// ------------------------------------------------------------
// PROPS
// ------------------------------------------------------------

interface Props {
  rachas: RachaHistorica[];
  onCambiar: (r: RachaHistorica[]) => void;
}

// ------------------------------------------------------------
// COMPONENTE
// ------------------------------------------------------------

export default function RachasSection({ rachas, onCambiar }: Props) {
  let _c = 0;
  const nuevo = (): RachaHistorica => {
    _c += 1;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? `r-${crypto.randomUUID()}`
        : `r-${Date.now()}-${_c}`;
    return {
      id,
      ambito: "mismo_punto",
      desdeAtras: 0,
      minimo: 1,
      filtro: { ...FILTRO_ACCION_HISTORICA_VACIO },
    };
  };

  return (
    <details
      className={`rounded border ${
        rachas.length > 0
          ? "border-violet-500/40 bg-violet-500/[0.04]"
          : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <summary className="px-2 py-1 cursor-pointer text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
        <span>📜 Historia previa ({rachas.length})</span>
        <span className="text-slate-500 text-[9px]">▼</span>
      </summary>
      <div className="p-2 pt-0 space-y-1">
        {rachas.map((r, i) => (
          <RachaFila
            key={r.id}
            idx={i}
            racha={r}
            onCambiar={(c) =>
              onCambiar(
                rachas.map((x) => (x.id === r.id ? { ...x, ...c } : x))
              )
            }
            onEliminar={() => onCambiar(rachas.filter((x) => x.id !== r.id))}
          />
        ))}
        <button
          onClick={() => onCambiar([...rachas, nuevo()])}
          className="w-full px-2 py-1 text-[9px] font-semibold rounded border border-violet-500/40 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20"
        >
          + Añadir racha
        </button>
      </div>
    </details>
  );
}

// ------------------------------------------------------------
// SUBCOMPONENTE: RachaFila
// ------------------------------------------------------------

function RachaFila({
  idx,
  racha,
  onCambiar,
  onEliminar,
}: {
  idx: number;
  racha: RachaHistorica;
  onCambiar: (c: Partial<RachaHistorica>) => void;
  onEliminar: () => void;
}) {
  const tipoActual = racha.filtro.tipos[0] ?? "";
  return (
    <div className="rounded border border-white/10 bg-slate-900/40 p-1 space-y-1">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[9px] font-bold text-violet-300">#{idx + 1}</span>
        <span className="text-[8px] text-slate-400 truncate flex-1">
          {resumenRacha(racha)}
        </span>
        <button
          onClick={onEliminar}
          className="text-rose-400 hover:text-rose-300 text-[9px]"
        >
          ✕
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1">
        <select
          value={racha.ambito}
          onChange={(e) => onCambiar({ ambito: e.target.value as AmbitoRacha })}
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
              minimo: Math.max(1, parseInt(e.target.value || "1", 10)),
            })
          }
          className={inputCls}
          placeholder="Mínimo"
        />
        <select
          value={tipoActual}
          onChange={(e) =>
            onCambiar({
              filtro: {
                ...racha.filtro,
                tipos: e.target.value
                  ? [e.target.value as TipoDisparador]
                  : [],
                resultados: [],
              },
            })
          }
          className={selectCls}
        >
          <option value="">Cualquier tipo</option>
          {TIPOS.map((t) => (
            <option key={t.v} value={t.v}>
              {t.label}
            </option>
          ))}
        </select>
        {tipoActual ? (
          <select
            value={racha.filtro.resultados[0] ?? ""}
            onChange={(e) =>
              onCambiar({
                filtro: {
                  ...racha.filtro,
                  resultados: e.target.value ? [e.target.value] : [],
                },
              })
            }
            className={selectCls}
          >
            <option value="">Cualquier resultado</option>
            {resultadosPorTipoAnalisis(tipoActual as TipoDisparador)
              .filter((r) => r !== "cualquiera")
              .map((r) => (
                <option key={r} value={r}>
                  {etiquetaResultado(r)}
                </option>
              ))}
          </select>
        ) : (
          <div />
        )}
        <input
          type="number"
          min={0}
          max={10}
          value={racha.desdeAtras}
          onChange={(e) =>
            onCambiar({
              desdeAtras: Math.max(0, parseInt(e.target.value || "0", 10)),
            })
          }
          className={`${inputCls} col-span-2`}
          placeholder="Saltar N del tipo"
        />
      </div>
    </div>
  );
}