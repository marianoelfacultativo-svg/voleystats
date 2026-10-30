"use client";

// ============================================================
// BLOQUE EDITOR — Análisis de consecuencias
// ============================================================
// Editor de un bloque trigger: tipo, jugador, resultado, y todas
// las sub-secciones (scope, previa, racha, patrón, top%, contexto).
// ============================================================

import {
  etiquetaResultado,
  hayFiltrosAvanzadosEnBloque,
  resultadosPorTipoAnalisis,
  type BloqueTrigger,
  type BloqueTriggerFiltro,
  type TipoDisparador,
  type VarianteAtaque,
} from "@/lib/analisisConsecuencias";
import { TIPOS, VARIANTES, OPCIONES_DIRECCION, OPCIONES_LLAMADA } from "./constantes";
import { selectCls } from "./helpers";
import AccionPreviaSection from "./AccionPreviaSection";
import RachaJugadorSection from "./RachaJugadorSection";
import PatronSection from "./PatronSection";
import RachasSection from "./RachasSection";
import ContextoSection from "./ContextoSection";
import ScopeSection from "./ScopeSection";

// ------------------------------------------------------------
// PROPS
// ------------------------------------------------------------

interface Props {
  bloque: BloqueTrigger;
  idx: number;
  totalBloques: number;
  nombre: (id: string | null) => string;
  jugadoresParaDropdown: { id: string; nombre: string }[];
  setsUnicos: number[];
  puntosUnicos: number[];
  partidosDisponibles?: { id: string; nombre: string }[];
  onCambiarFiltro: (cambios: Partial<BloqueTriggerFiltro>) => void;
  onEliminar: () => void;
}

// ------------------------------------------------------------
// COMPONENTE
// ------------------------------------------------------------

export default function BloqueEditor({
  bloque,
  idx,
  totalBloques,
  nombre,
  jugadoresParaDropdown,
  setsUnicos,
  puntosUnicos,
  partidosDisponibles,
  onCambiarFiltro,
  onEliminar,
}: Props) {
  const f = bloque.filtro;
  const avanzadoActivo = hayFiltrosAvanzadosEnBloque(f);

  // `nombre` se mantiene en la firma por compatibilidad con la API
  // del componente original; no se usa directamente.
  void nombre;

  return (
    <div className="rounded-lg border border-white/10 bg-slate-900/30 p-2 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
            Cuando #{idx + 1}
          </span>
          {avanzadoActivo && (
            <span className="text-[8px] px-1 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/40">
              ⚙️
            </span>
          )}
        </div>
        {totalBloques > 1 && (
          <button
            onClick={onEliminar}
            className="text-[10px] text-rose-400 hover:text-rose-300"
          >
            ✕
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1">
        <select
          value={f.tipo}
          onChange={(e) =>
            onCambiarFiltro({
              tipo: e.target.value as TipoDisparador,
              resultado: "cualquiera",
              variante: null,
              llamadasInferidas: [],
              direccionAtaqueInferida: [],
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
          value={f.jugadorId ?? "todos"}
          onChange={(e) =>
            onCambiarFiltro({
              jugadorId: e.target.value === "todos" ? null : e.target.value,
            })
          }
          className={selectCls}
        >
          <option value="todos">Todo el equipo</option>
          {jugadoresParaDropdown.map((j) => (
            <option key={j.id} value={j.id}>
              {j.nombre}
            </option>
          ))}
        </select>
      </div>

      <details
        className={`rounded border ${
          avanzadoActivo
            ? "border-violet-500/40 bg-violet-500/[0.04]"
            : "border-white/10 bg-white/[0.02]"
        }`}
      >
        <summary className="px-2 py-1 cursor-pointer text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
          <span>Filtros del bloque {avanzadoActivo && "✓"}</span>
          <span className="text-slate-500 text-[9px]">▼</span>
        </summary>
        <div className="p-2 pt-0 space-y-2">
          <div>
            <label className="block text-[9px] font-bold uppercase text-slate-500 mb-0.5">
              Resultado del trigger
            </label>
            <select
              value={f.resultado}
              onChange={(e) => onCambiarFiltro({ resultado: e.target.value })}
              className={selectCls}
            >
              {resultadosPorTipoAnalisis(f.tipo).map((r) => (
                <option key={r} value={r}>
                  {etiquetaResultado(r)}
                </option>
              ))}
            </select>
          </div>

          {/* ============ NUEVO v6: ATAQUE ============ */}
          {f.tipo === "ataque" && (
            <div className="rounded border border-emerald-500/30 bg-emerald-500/[0.04] p-1.5 space-y-1.5">
              <p className="text-[9px] font-bold uppercase text-emerald-300">
                🎯 Ataque — variante y dirección
              </p>

              <div>
                <label className="block text-[9px] font-bold uppercase text-slate-500 mb-0.5">
                  Variante
                </label>
                <select
                  value={f.variante ?? ""}
                  onChange={(e) =>
                    onCambiarFiltro({
                      variante:
                        e.target.value === ""
                          ? null
                          : (e.target.value as VarianteAtaque),
                    })
                  }
                  className={selectCls}
                >
                  {VARIANTES.map((v) => (
                    <option key={String(v.v)} value={v.v ?? ""}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              <MultiChipInline
                label="Dirección inferida"
                opciones={OPCIONES_DIRECCION}
                seleccionados={f.direccionAtaqueInferida}
                onChange={(vals) =>
                  onCambiarFiltro({ direccionAtaqueInferida: vals })
                }
              />
            </div>
          )}

          {/* ============ NUEVO v6: ARMADO ============ */}
          {f.tipo === "armado" && (
            <div className="rounded border border-emerald-500/30 bg-emerald-500/[0.04] p-1.5 space-y-1.5">
              <p className="text-[9px] font-bold uppercase text-emerald-300">
                🎯 Armado — llamadas inferidas
              </p>
              <MultiChipInline
                label="Llamadas"
                opciones={OPCIONES_LLAMADA}
                seleccionados={f.llamadasInferidas}
                onChange={(vals) => onCambiarFiltro({ llamadasInferidas: vals })}
              />
              <p className="text-[8px] italic text-slate-500">
                La llamada se infiere en el motor desde velocidad + destino.
                No requiere filtro adicional.
              </p>
            </div>
          )}

          <ScopeSection
            filtro={f}
            onChange={onCambiarFiltro}
            setsUnicos={setsUnicos}
            puntosUnicos={puntosUnicos}
            partidosDisponibles={partidosDisponibles}
          />

          <AccionPreviaSection
            previa={f.accionPreviaDirecta}
            onCambiar={(p) => onCambiarFiltro({ accionPreviaDirecta: p })}
          />

          <RachaJugadorSection
            racha={f.rachaJugador}
            onCambiar={(r) => onCambiarFiltro({ rachaJugador: r })}
            jugadoresParaDropdown={jugadoresParaDropdown}
          />

          <PatronSection
            patron={f.patronPrevio}
            onCambiar={(p) => onCambiarFiltro({ patronPrevio: p })}
          />

          <div className="grid grid-cols-2 gap-1">
            <div>
              <label className="block text-[9px] font-bold uppercase text-slate-500 mb-0.5">
                Top % del tipo
              </label>
              <select
                value={f.topPorcentaje === null ? "" : String(f.topPorcentaje)}
                onChange={(e) =>
                  onCambiarFiltro({
                    topPorcentaje:
                      e.target.value === ""
                        ? null
                        : parseInt(e.target.value, 10),
                  })
                }
                className={selectCls}
              >
                <option value="">Sin filtro</option>
                <option value="10">Top 10%</option>
                <option value="20">Top 20%</option>
                <option value="30">Top 30%</option>
                <option value="50">Top 50%</option>
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-bold uppercase text-slate-500 mb-0.5">
                Vs promedio
              </label>
              <select
                value={f.vsPromedio ?? ""}
                onChange={(e) =>
                  onCambiarFiltro({
                    vsPromedio:
                      e.target.value === ""
                        ? null
                        : (e.target.value as "por_encima" | "por_debajo"),
                  })
                }
                className={selectCls}
              >
                <option value="">Sin filtro</option>
                <option value="por_encima">Por encima</option>
                <option value="por_debajo">Por debajo</option>
              </select>
            </div>
          </div>

          <RachasSection
            rachas={f.rachas}
            onCambiar={(rachas) => onCambiarFiltro({ rachas })}
          />

          <ContextoSection
            contexto={f.contextoPartido}
            onCambiar={(c) => onCambiarFiltro({ contextoPartido: c })}
          />
        </div>
      </details>
    </div>
  );
}

// ------------------------------------------------------------
// SUBCOMPONENTE LOCAL: MultiChip (versión inline para evitar
// dependencia circular con ScopeSection)
// ------------------------------------------------------------

function MultiChipInline({
  label,
  opciones,
  seleccionados,
  onChange,
}: {
  label: string;
  opciones: { v: string; label: string }[];
  seleccionados: string[];
  onChange: (vals: string[]) => void;
}) {
  const toggle = (v: string) => {
    if (seleccionados.includes(v)) {
      onChange(seleccionados.filter((x) => x !== v));
    } else {
      onChange([...seleccionados, v]);
    }
  };
  return (
    <div>
      <label className="block text-[9px] font-bold uppercase text-slate-500 mb-0.5">
        {label}
        {seleccionados.length > 0 && ` (${seleccionados.length})`}
      </label>
      <div className="flex flex-wrap gap-0.5">
        {opciones.map((o) => {
          const sel = seleccionados.includes(o.v);
          return (
            <button
              key={o.v}
              onClick={() => toggle(o.v)}
              className={`px-1.5 py-0.5 text-[9px] font-semibold rounded border transition ${
                sel
                  ? "bg-violet-500/30 border-violet-400/60 text-violet-200"
                  : "bg-white/[0.02] border-white/10 text-slate-400 hover:text-white"
              }`}
              title={o.label}
            >
              {o.label}
            </button>
          );
        })}
        {opciones.length === 0 && (
          <span className="text-[9px] text-slate-500 italic">Sin opciones</span>
        )}
      </div>
    </div>
  );
}