"use client";

// ============================================================
// SCOPE SECTION — Análisis de consecuencias
// ============================================================
// Filtros de alcance del bloque: sets, puntos, partidos, roles,
// zonas del jugador, rotaciones.
//
// También exporta `MultiChip`, reutilizado por AccionPreviaSection
// y BloqueEditor.
// ============================================================

import type { BloqueTriggerFiltro } from "@/lib/analisisConsecuencias";
import { ROLES, ROTACIONES, ZONAS_JUGADOR } from "./constantes";

// ------------------------------------------------------------
// PROPS
// ------------------------------------------------------------

interface Props {
  filtro: BloqueTriggerFiltro;
  onChange: (cambios: Partial<BloqueTriggerFiltro>) => void;
  setsUnicos: number[];
  puntosUnicos: number[];
  partidosDisponibles?: { id: string; nombre: string }[];
}

// ------------------------------------------------------------
// COMPONENTE
// ------------------------------------------------------------

export default function ScopeSection({
  filtro,
  onChange,
  setsUnicos,
  puntosUnicos,
  partidosDisponibles,
}: Props) {
  const activo =
    filtro.sets.length > 0 ||
    filtro.puntos.length > 0 ||
    filtro.partidos.length > 0 ||
    filtro.roles.length > 0 ||
    filtro.zonasJugador.length > 0 ||
    filtro.rotaciones.length > 0;

  return (
    <details
      className={`rounded border ${
        activo
          ? "border-violet-500/40 bg-violet-500/[0.04]"
          : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <summary className="px-2 py-1 cursor-pointer text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
        <span>Scope {activo && "✓"}</span>
        <span className="text-slate-500 text-[9px]">▼</span>
      </summary>
      <div className="p-2 pt-0 space-y-1.5">
        <MultiChip
          label="Sets"
          opciones={setsUnicos.map((s) => ({ v: String(s), label: `S${s}` }))}
          seleccionados={filtro.sets.map(String)}
          onChange={(vals) =>
            onChange({ sets: vals.map((v) => parseInt(v, 10)) })
          }
        />
        <MultiChip
          label="Puntos"
          opciones={puntosUnicos.map((p) => ({
            v: String(p),
            label: `P${p}`,
          }))}
          seleccionados={filtro.puntos.map(String)}
          onChange={(vals) =>
            onChange({ puntos: vals.map((v) => parseInt(v, 10)) })
          }
        />
        {partidosDisponibles && partidosDisponibles.length > 0 && (
          <MultiChip
            label="Partidos"
            opciones={partidosDisponibles.map((p) => ({
              v: p.id,
              label: p.nombre,
            }))}
            seleccionados={filtro.partidos}
            onChange={(vals) => onChange({ partidos: vals })}
          />
        )}
        <MultiChip
          label="Roles"
          opciones={ROLES.map((r) => ({ v: r, label: r }))}
          seleccionados={filtro.roles}
          onChange={(vals) => onChange({ roles: vals })}
        />
        <MultiChip
          label="Zonas jugador"
          opciones={ZONAS_JUGADOR.map((z) => ({
            v: String(z.v),
            label: z.label,
          }))}
          seleccionados={filtro.zonasJugador.map(String)}
          onChange={(vals) =>
            onChange({ zonasJugador: vals.map((v) => parseInt(v, 10)) })
          }
        />
        <MultiChip
          label="Rotaciones"
          opciones={ROTACIONES.map((r) => ({
            v: String(r),
            label: `R${r}`,
          }))}
          seleccionados={filtro.rotaciones.map(String)}
          onChange={(vals) =>
            onChange({ rotaciones: vals.map((v) => parseInt(v, 10)) })
          }
        />
      </div>
    </details>
  );
}

// ------------------------------------------------------------
// MULTI-CHIP (export nombrado)
// ------------------------------------------------------------
// Reutilizado por AccionPreviaSection y BloqueEditor.
// ------------------------------------------------------------

export function MultiChip({
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