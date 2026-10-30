"use client";

// ============================================================
// ACCIÓN PREVIA SECTION — Análisis de consecuencias
// ============================================================
// Filtra la acción inmediatamente anterior al trigger, con soporte
// para zonas destino y con/sin desplazamiento.
// ============================================================

import {
  etiquetaResultado,
  resultadosPorTipoAnalisis,
  FILTRO_ACCION_HISTORICA_VACIO,
  type ConDesplazamiento,
  type FiltroAccionHistorica,
  type RelacionJugador,
  type TipoDisparador,
} from "@/lib/analisisConsecuencias";
import {
  OPCIONES_DESPLAZAMIENTO,
  RELACIONES_PREVIA,
  TIPOS,
  ZONAS_DESTINO,
} from "./constantes";
import { selectCls } from "./helpers";
import { MultiChip } from "./ScopeSection";

// ------------------------------------------------------------
// PROPS
// ------------------------------------------------------------

interface Props {
  previa: FiltroAccionHistorica | null;
  onCambiar: (p: FiltroAccionHistorica | null) => void;
}

// ------------------------------------------------------------
// COMPONENTE
// ------------------------------------------------------------

export default function AccionPreviaSection({ previa, onCambiar }: Props) {
  const activo = !!previa;

  return (
    <details
      className={`rounded border ${
        activo
          ? "border-violet-500/40 bg-violet-500/[0.04]"
          : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <summary className="px-2 py-1 cursor-pointer text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
        <span>⏮️ Acción previa {activo && "✓"}</span>
        <span className="text-slate-500 text-[9px]">▼</span>
      </summary>
      <div className="p-2 pt-0 space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-[9px] text-slate-500 italic">
            Filtra la acción inmediatamente anterior.
          </p>
          <button
            onClick={() =>
              onCambiar(
                activo ? null : { ...FILTRO_ACCION_HISTORICA_VACIO }
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

        {previa && (
          <div className="space-y-1.5">
            <div className="grid grid-cols-2 gap-1">
              <select
                value={previa.tipos[0] ?? ""}
                onChange={(e) =>
                  onCambiar({
                    ...previa,
                    tipos: e.target.value
                      ? [e.target.value as TipoDisparador]
                      : [],
                    resultados: [],
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
              {previa.tipos.length > 0 ? (
                <select
                  value={previa.resultados[0] ?? ""}
                  onChange={(e) =>
                    onCambiar({
                      ...previa,
                      resultados: e.target.value ? [e.target.value] : [],
                    })
                  }
                  className={selectCls}
                >
                  <option value="">Cualquier resultado</option>
                  {resultadosPorTipoAnalisis(previa.tipos[0])
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
              <select
                value={previa.relacionJugador}
                onChange={(e) =>
                  onCambiar({
                    ...previa,
                    relacionJugador: e.target.value as RelacionJugador,
                  })
                }
                className={`${selectCls} col-span-2`}
              >
                {RELACIONES_PREVIA.map((r) => (
                  <option key={r.v} value={r.v}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Zonas destino */}
            <MultiChip
              label="Zonas destino"
              opciones={ZONAS_DESTINO.map((z) => ({
                v: String(z),
                label: `Z${z}`,
              }))}
              seleccionados={previa.zonasDestino.map(String)}
              onChange={(vals) =>
                onCambiar({
                  ...previa,
                  zonasDestino: vals.map((v) => parseInt(v, 10)),
                })
              }
            />

            {/* Con/sin desplazamiento */}
            <div>
              <label className="block text-[9px] font-bold uppercase text-slate-500 mb-0.5">
                Desplazamiento (defensa/recepción)
              </label>
              <select
                value={previa.conDesplazamiento}
                onChange={(e) =>
                  onCambiar({
                    ...previa,
                    conDesplazamiento: e.target.value as ConDesplazamiento,
                  })
                }
                className={selectCls}
              >
                {OPCIONES_DESPLAZAMIENTO.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
    </details>
  );
}