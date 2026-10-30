"use client";

// ============================================================
// CONTEXTO SECTION — Análisis de consecuencias
// ============================================================
// Filtro de contexto del partido: marcador, rally, ubicación,
// racha, posición en set.
// ============================================================

import {
  hayContextoPartidoActivo,
  CONTEXTO_PARTIDO_VACIO,
  type ContextoPartidoFiltro,
  type MarcadorFiltro,
  type PosicionEnSet,
} from "@/lib/analisisConsecuencias";
import {
  DIFERENCIAS_MARCADOR,
  ESTADOS_MARCADOR,
  FASES_RALLY,
  INICIOS_PUNTO,
  POSICIONES_SET,
  PUNTOS_CERRAR,
  UBICACIONES,
} from "./constantes";
import { inputCls, selectCls } from "./helpers";

// ------------------------------------------------------------
// PROPS
// ------------------------------------------------------------

interface Props {
  contexto: ContextoPartidoFiltro | null;
  onCambiar: (c: ContextoPartidoFiltro | null) => void;
}

// ------------------------------------------------------------
// COMPONENTE
// ------------------------------------------------------------

export default function ContextoSection({ contexto, onCambiar }: Props) {
  const activo = !!contexto && hayContextoPartidoActivo(contexto);

  return (
    <details
      className={`rounded border ${
        activo
          ? "border-violet-500/40 bg-violet-500/[0.04]"
          : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <summary className="px-2 py-1 cursor-pointer text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
        <span>📊 Contexto del partido {activo && "✓"}</span>
        <span className="text-slate-500 text-[9px]">▼</span>
      </summary>
      <div className="p-2 pt-0 space-y-1.5">
        <div className="flex justify-end">
          <button
            onClick={() =>
              onCambiar(contexto ? null : { ...CONTEXTO_PARTIDO_VACIO })
            }
            className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${
              contexto
                ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                : "bg-violet-500/20 text-violet-300 border-violet-500/40"
            }`}
          >
            {contexto ? "✕ Quitar" : "+ Activar"}
          </button>
        </div>

        {contexto && (
          <>
            <div>
              <p className="text-[9px] font-bold uppercase text-slate-500 mb-0.5">
                Marcador
              </p>
              <div className="grid grid-cols-2 gap-1">
                <select
                  value={contexto.marcador.estado}
                  onChange={(e) =>
                    onCambiar({
                      ...contexto,
                      marcador: {
                        ...contexto.marcador,
                        estado: e.target.value as MarcadorFiltro["estado"],
                      },
                    })
                  }
                  className={selectCls}
                >
                  {ESTADOS_MARCADOR.map((s) => (
                    <option key={s.v} value={s.v}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <select
                  value={contexto.marcador.diferencia}
                  onChange={(e) =>
                    onCambiar({
                      ...contexto,
                      marcador: {
                        ...contexto.marcador,
                        diferencia: e.target
                          .value as MarcadorFiltro["diferencia"],
                      },
                    })
                  }
                  className={selectCls}
                >
                  {DIFERENCIAS_MARCADOR.map((d) => (
                    <option key={d.v} value={d.v}>
                      {d.label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={
                    contexto.marcador.diferenciaExacta === null
                      ? ""
                      : contexto.marcador.diferenciaExacta
                  }
                  onChange={(e) =>
                    onCambiar({
                      ...contexto,
                      marcador: {
                        ...contexto.marcador,
                        diferenciaExacta:
                          e.target.value === ""
                            ? null
                            : parseInt(e.target.value, 10),
                      },
                    })
                  }
                  placeholder="Diff exacta"
                  className={inputCls}
                />
                <select
                  value={contexto.marcador.puntosParaCerrar}
                  onChange={(e) =>
                    onCambiar({
                      ...contexto,
                      marcador: {
                        ...contexto.marcador,
                        puntosParaCerrar: e.target
                          .value as MarcadorFiltro["puntosParaCerrar"],
                      },
                    })
                  }
                  className={selectCls}
                >
                  {PUNTOS_CERRAR.map((p) => (
                    <option key={p.v} value={p.v}>
                      {p.v === "cualquiera"
                        ? "Sin filtro de cierre"
                        : p.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() =>
                    onCambiar({
                      ...contexto,
                      marcador: {
                        ...contexto.marcador,
                        soloCriticos: !contexto.marcador.soloCriticos,
                      },
                    })
                  }
                  className={`px-2 py-1 text-[10px] font-semibold rounded border transition col-span-2 ${
                    contexto.marcador.soloCriticos
                      ? "bg-amber-500/20 text-amber-200 border-amber-500/50"
                      : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"
                  }`}
                >
                  {contexto.marcador.soloCriticos
                    ? "✓ Solo críticos"
                    : "Solo críticos"}
                </button>
              </div>
            </div>

            <div>
              <p className="text-[9px] font-bold uppercase text-slate-500 mb-0.5">
                Rally
              </p>
              <div className="grid grid-cols-2 gap-1">
                <select
                  value={contexto.faseRally}
                  onChange={(e) =>
                    onCambiar({
                      ...contexto,
                      faseRally: e.target
                        .value as ContextoPartidoFiltro["faseRally"],
                    })
                  }
                  className={selectCls}
                >
                  {FASES_RALLY.map((f) => (
                    <option key={f.v} value={f.v}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <select
                  value={contexto.inicioPunto}
                  onChange={(e) =>
                    onCambiar({
                      ...contexto,
                      inicioPunto: e.target
                        .value as ContextoPartidoFiltro["inicioPunto"],
                    })
                  }
                  className={selectCls}
                >
                  {INICIOS_PUNTO.map((i) => (
                    <option key={i.v} value={i.v}>
                      {i.label}
                    </option>
                  ))}
                </select>
                <select
                  value={contexto.esPrimerToque}
                  onChange={(e) =>
                    onCambiar({
                      ...contexto,
                      esPrimerToque: e.target
                        .value as ContextoPartidoFiltro["esPrimerToque"],
                    })
                  }
                  className={selectCls}
                >
                  <option value="cualquiera">Primer toque: cualq.</option>
                  <option value="si">Sí (primer toque)</option>
                  <option value="no">No (2° o 3er)</option>
                </select>
                <select
                  value={contexto.toquesMinimo ?? "cualquiera"}
                  onChange={(e) =>
                    onCambiar({
                      ...contexto,
                      toquesMinimo:
                        e.target.value === "cualquiera"
                          ? null
                          : parseInt(e.target.value, 10),
                    })
                  }
                  className={selectCls}
                >
                  <option value="cualquiera">Toques: cualq.</option>
                  <option value="2">≥ 2</option>
                  <option value="3">≥ 3</option>
                  <option value="4">≥ 4</option>
                </select>
              </div>
            </div>

            <div>
              <p className="text-[9px] font-bold uppercase text-slate-500 mb-0.5">
                Jugador / set
              </p>
              <div className="grid grid-cols-2 gap-1">
                <select
                  value={contexto.ubicacionTrigger}
                  onChange={(e) =>
                    onCambiar({
                      ...contexto,
                      ubicacionTrigger: e.target
                        .value as ContextoPartidoFiltro["ubicacionTrigger"],
                    })
                  }
                  className={selectCls}
                >
                  {UBICACIONES.map((u) => (
                    <option key={u.v} value={u.v}>
                      {u.v === "cualquiera"
                        ? "Cualquier ubicación"
                        : u.label}
                    </option>
                  ))}
                </select>
                <select
                  value={contexto.rachaPuntos ?? "cualquiera"}
                  onChange={(e) =>
                    onCambiar({
                      ...contexto,
                      rachaPuntos:
                        e.target.value === "cualquiera"
                          ? null
                          : parseInt(e.target.value, 10),
                    })
                  }
                  className={selectCls}
                >
                  <option value="cualquiera">Racha: cualq.</option>
                  <option value="2">≥ 2 seguidos</option>
                  <option value="3">≥ 3 seguidos</option>
                  <option value="4">≥ 4 seguidos</option>
                  <option value="5">≥ 5 seguidos</option>
                </select>
                <select
                  value={contexto.posicionEnSet}
                  onChange={(e) =>
                    onCambiar({
                      ...contexto,
                      posicionEnSet: e.target.value as PosicionEnSet,
                    })
                  }
                  className={`${selectCls} col-span-2`}
                >
                  {POSICIONES_SET.map((p) => (
                    <option key={p.v} value={p.v}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}
      </div>
    </details>
  );
}