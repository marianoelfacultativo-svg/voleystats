"use client";

// ============================================================
// PANEL DE ANÁLISIS (A o B) — Análisis de consecuencias
// ============================================================
// Renderiza un panel completo de análisis con:
//   - Header con etiqueta A/B y cantidad de casos
//   - PanelBusqueda
//   - Bloques CUANDO (con operadores entre ellos)
//   - Sección "Mirar"
//   - Avanzado del análisis (alcance + comparadores)
//   - Comportamiento del trigger + Consecuencia
// ============================================================

import { useMemo } from "react";
import {
  analizarConsecuencias,
  etiquetaOperador,
  etiquetaRelacionObservado,
  etiquetaTipoDisparador,
  type BloqueTrigger,
  type BloqueTriggerFiltro,
  type OperadorBloque,
  type RelacionJugadorObservado,
  type TipoDisparador,
} from "@/lib/analisisConsecuencias";
import type { AccionVisual } from "../adaptadorUnificadoV2";
import {
  ALANCES,
  RELACIONES_OBSERVADO,
  TIPOS_OBSERVADOS,
} from "./constantes";
import { selectCls, construirFiltros, resumenBloque } from "./helpers";
import { bloqueVacio, type ConfiguracionPanel } from "./types";
import PanelBusqueda from "./PanelBusqueda";
import BloqueEditor from "./BloqueEditor";
import ComparadoresSection from "./ComparadoresSection";
import SeccionComportamiento from "./SeccionComportamiento";
import SeccionConsecuencia from "./SeccionConsecuencia";

// ------------------------------------------------------------
// PROPS
// ------------------------------------------------------------

interface Props {
  acciones: AccionVisual[];
  config: ConfiguracionPanel;
  setConfig: (c: ConfiguracionPanel) => void;
  nombre: (id: string | null) => string;
  jugadoresParaDropdown: { id: string; nombre: string }[];
  setsUnicos: number[];
  puntosUnicos: number[];
  partidosDisponibles?: { id: string; nombre: string }[];
  onIrAPunto?: (set: number, punto: number) => void;
  etiqueta: string;
  onRestablecer?: () => void;
}

// ------------------------------------------------------------
// COMPONENTE
// ------------------------------------------------------------

export default function PanelAnalisis({
  acciones,
  config,
  setConfig,
  nombre,
  jugadoresParaDropdown,
  setsUnicos,
  puntosUnicos,
  partidosDisponibles,
  onIrAPunto,
  etiqueta,
  onRestablecer,
}: Props) {
  const resultado = useMemo(
    () => analizarConsecuencias(acciones, construirFiltros(config)),
    [acciones, config]
  );

  const esRelacion =
    config.jugadorObservadoFiltro === "cualquiera" ||
    config.jugadorObservadoFiltro === "mismo" ||
    config.jugadorObservadoFiltro === "companero" ||
    config.jugadorObservadoFiltro === "rival";

  const receta = useMemo(() => {
    const partes: string[] = [];
    config.bloques.forEach((b, i) => {
      if (i > 0) partes.push(etiquetaOperador(b.operador).toUpperCase());
      partes.push(resumenBloque(b.filtro));
    });
    partes.push("→");
    const tipoObs =
      config.tipoObservado === "cualquiera"
        ? "siguiente acción"
        : `sig. ${etiquetaTipoDisparador(config.tipoObservado)}`;
    const jugObs = esRelacion
      ? etiquetaRelacionObservado(
          config.jugadorObservadoFiltro as RelacionJugadorObservado
        )
      : nombre(config.jugadorObservadoFiltro);
    partes.push(`${tipoObs} · ${jugObs}`);
    return partes.join(" ");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  // ----------------------------------------------------------
  // Handlers de bloques
  // ----------------------------------------------------------

  const agregarBloque = () => {
    setConfig({
      ...config,
      bloques: [...config.bloques, bloqueVacio("AND")],
    });
  };

  const eliminarBloque = (id: string) => {
    if (config.bloques.length <= 1) return;
    setConfig({
      ...config,
      bloques: config.bloques.filter((b) => b.id !== id),
    });
  };

  const actualizarBloque = (id: string, cambios: Partial<BloqueTrigger>) => {
    setConfig({
      ...config,
      bloques: config.bloques.map((b) =>
        b.id === id ? { ...b, ...cambios } : b
      ),
    });
  };

  const actualizarFiltroBloque = (
    id: string,
    cambios: Partial<BloqueTriggerFiltro>
  ) => {
    setConfig({
      ...config,
      bloques: config.bloques.map((b) =>
        b.id === id ? { ...b, filtro: { ...b.filtro, ...cambios } } : b
      ),
    });
  };

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/40">
      <div className="px-3 py-2 border-b border-white/10 flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-700 text-slate-100 border border-white/10">
              {etiqueta}
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-white/10 text-slate-300 bg-white/5">
              {resultado.totalOcurrencias} caso
              {resultado.totalOcurrencias !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 truncate" title={receta}>
            {receta}
          </p>
        </div>
        {onRestablecer && (
          <button
            onClick={onRestablecer}
            className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 shrink-0"
            title="Restablecer"
          >
            ↻
          </button>
        )}
      </div>

      <div className="p-3 space-y-2">
        <PanelBusqueda
          acciones={acciones}
          config={config}
          setConfig={setConfig}
          jugadoresParaDropdown={jugadoresParaDropdown}
          partidosDisponibles={partidosDisponibles}
        />

        <div className="space-y-1.5">
          {config.bloques.map((b, idx) => (
            <div key={b.id}>
              {idx > 0 && (
                <div className="flex items-center gap-1 mb-1 ml-2">
                  <span className="text-slate-500 text-[10px]">└</span>
                  <select
                    value={b.operador}
                    onChange={(e) =>
                      actualizarBloque(b.id, {
                        operador: e.target.value as OperadorBloque,
                      })
                    }
                    className="bg-slate-900 text-white text-[10px] font-bold uppercase rounded px-1.5 py-0.5 border border-white/10 cursor-pointer"
                  >
                    <option value="AND">Y</option>
                    <option value="OR">O</option>
                    <option value="NOT">Y NO</option>
                  </select>
                </div>
              )}

              <BloqueEditor
                bloque={b}
                idx={idx}
                totalBloques={config.bloques.length}
                nombre={nombre}
                jugadoresParaDropdown={jugadoresParaDropdown}
                setsUnicos={setsUnicos}
                puntosUnicos={puntosUnicos}
                partidosDisponibles={partidosDisponibles}
                onCambiarFiltro={(cambios) =>
                  actualizarFiltroBloque(b.id, cambios)
                }
                onEliminar={() => eliminarBloque(b.id)}
              />
            </div>
          ))}

          <button
            onClick={agregarBloque}
            className="w-full px-2 py-1 text-[10px] font-semibold rounded border border-dashed border-violet-500/40 bg-violet-500/5 text-violet-300 hover:bg-violet-500/15"
          >
            + Añadir otro CUANDO
          </button>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
              Mirar
            </span>
            <span className="text-[10px] text-slate-400">qué pasa después</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <select
              value={config.tipoObservado}
              onChange={(e) =>
                setConfig({
                  ...config,
                  tipoObservado: e.target.value as
                    | TipoDisparador
                    | "cualquiera",
                })
              }
              className={selectCls}
            >
              {TIPOS_OBSERVADOS.map((t) => (
                <option key={t.v} value={t.v}>
                  {t.label}
                </option>
              ))}
            </select>

            <select
              value={config.jugadorObservadoFiltro}
              onChange={(e) =>
                setConfig({
                  ...config,
                  jugadorObservadoFiltro: e.target.value,
                })
              }
              className={selectCls}
            >
              {RELACIONES_OBSERVADO.map((r) => (
                <option key={r.v} value={r.v}>
                  {r.label}
                </option>
              ))}
              {jugadoresParaDropdown.length > 0 && (
                <optgroup label="Jugador específico">
                  {jugadoresParaDropdown.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.nombre}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
        </div>

        <details className="rounded-lg border border-white/10 bg-white/[0.02]">
          <summary className="px-2 py-1.5 cursor-pointer text-[11px] font-bold uppercase text-slate-300 flex items-center justify-between">
            <span>⚙️ Avanzado del análisis</span>
            <span className="text-slate-500 text-[10px]">▼</span>
          </summary>
          <div className="p-2 pt-0 space-y-2">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                Alcance
              </label>
              <select
                value={config.alcance}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    alcance: e.target.value as "partido" | "mismo_punto",
                  })
                }
                className={selectCls}
              >
                {ALANCES.map((a) => (
                  <option key={a.v} value={a.v}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>

            <ComparadoresSection
              coincidencias={config.coincidencias}
              setCoincidencias={(c) =>
                setConfig({ ...config, coincidencias: c })
              }
            />
          </div>
        </details>

        {resultado.totalOcurrencias === 0 ? (
          <div className="rounded-lg border border-white/10 p-4 text-center text-xs text-slate-400">
            No hay casos que cumplan los criterios.
          </div>
        ) : (
          <>
            {resultado.comportamientoTrigger && (
              <SeccionComportamiento
                comportamiento={resultado.comportamientoTrigger}
                nombreDeJugador={(id) => nombre(id)}
              />
            )}
            {resultado.estadisticasObservadas && (
              <SeccionConsecuencia
                resultado={resultado}
                tipoObservado={config.tipoObservado}
                jugadorObservadoFiltro={config.jugadorObservadoFiltro}
                nombre={nombre}
                coincidencias={config.coincidencias}
                onIrAPunto={onIrAPunto}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}