"use client";

// ============================================================
// LISTA DE PARTIDOS + FILTROS (panel izquierdo)
// ============================================================
// Componente presentacional puro. Recibe todos los datos y
// handlers por props. Sin estado propio.
//
// Se adapta al modo principal:
//   - "partido" / "comparar-partidos": muestra filtros + lista
//     de partidos seleccionables.
//   - "jugador-por-partidos": muestra lista de jugadores.
//
// El contenedor controla qué está seleccionado y qué está
// comparado; acá solo se renderiza.
// ============================================================

import { CalendarDays, GitCompare, User } from "lucide-react";
import type { AccionDB } from "@/lib/db";
import type { FiltrosTacticos as FiltrosTacticosTipo } from "@/lib/filtrosTacticos";
import FiltrosTacticos from "../FiltrosTacticos";
import {
  COLORES_COMPARACION,
  cardBase,
  labelStyle,
  type Jugador,
  type ModoPrincipal,
  type Partido,
} from "./types";

// ------------------------------------------------------------
// PROPS
// ------------------------------------------------------------

interface Props {
  modoPrincipal: ModoPrincipal;
  nombreEquipo: string;

  // ---------- Filtros ----------
  filtroRival: string;
  onFiltroRival: (v: string) => void;
  filtroFechaDesde: string;
  onFiltroFechaDesde: (v: string) => void;
  filtroFechaHasta: string;
  onFiltroFechaHasta: (v: string) => void;
  filtroSet: "todos" | "1" | "2" | "3" | "4" | "5";
  onFiltroSet: (v: "todos" | "1" | "2" | "3" | "4" | "5") => void;

  // ---------- Filtros tácticos ----------
  filtrosTacticos: FiltrosTacticosTipo;
  onFiltrosTacticos: (f: FiltrosTacticosTipo) => void;
  hayFiltrosActivos: boolean;
  onLimpiarFiltros: () => void;

  // ---------- Partidos ----------
  partidosFiltrados: Partido[];
  rivalesUnicos: string[];
  partidoSeleccionado: string | null;
  onPartidoSeleccionado: (id: string) => void;
  partidosComparados: string[];
  onTogglePartidoComparado: (id: string) => void;

  // ---------- Jugadores (modo JxP) ----------
  jugadores: Jugador[];
  acciones: AccionDB[];
  jugadorSeleccionadoJxP: string | null;
  onJugadorSeleccionadoJxP: (id: string) => void;

  // ---------- Helpers ----------
  nombreRivalDe: (p: Partido) => string;
  scoreDe: (p: Partido) => string;
}

// ------------------------------------------------------------
// COMPONENTE
// ------------------------------------------------------------

export default function ListaPartidos({
  modoPrincipal,
  nombreEquipo,
  filtroRival,
  onFiltroRival,
  filtroFechaDesde,
  onFiltroFechaDesde,
  filtroFechaHasta,
  onFiltroFechaHasta,
  filtroSet,
  onFiltroSet,
  filtrosTacticos,
  onFiltrosTacticos,
  hayFiltrosActivos,
  onLimpiarFiltros,
  partidosFiltrados,
  rivalesUnicos,
  partidoSeleccionado,
  onPartidoSeleccionado,
  partidosComparados,
  onTogglePartidoComparado,
  jugadores,
  acciones,
  jugadorSeleccionadoJxP,
  onJugadorSeleccionadoJxP,
  nombreRivalDe,
  scoreDe,
}: Props) {
  const esJxP = modoPrincipal === "jugador-por-partidos";

  return (
    <div className="col-span-1 space-y-3" data-pdf-ignorar>
      {/* ---------- FILTROS (solo partido / comparar) ---------- */}
      {!esJxP && (
        <div
          className="rounded-2xl p-3 sm:p-4 space-y-3"
          style={cardBase}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={labelStyle}
              >
                Rival
              </label>
              <select
                value={filtroRival}
                onChange={(e) => onFiltroRival(e.target.value)}
                className="input-dark text-sm"
              >
                <option value="">Todos</option>
                {rivalesUnicos.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={labelStyle}
              >
                Desde
              </label>
              <input
                type="date"
                value={filtroFechaDesde}
                onChange={(e) => onFiltroFechaDesde(e.target.value)}
                className="input-dark text-sm"
              />
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={labelStyle}
              >
                Hasta
              </label>
              <input
                type="date"
                value={filtroFechaHasta}
                onChange={(e) => onFiltroFechaHasta(e.target.value)}
                className="input-dark text-sm"
              />
            </div>
            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={labelStyle}
              >
                Set (en detalle)
              </label>
              <select
                value={filtroSet}
                onChange={(e) =>
                  onFiltroSet(
                    e.target.value as "todos" | "1" | "2" | "3" | "4" | "5"
                  )
                }
                className="input-dark text-sm"
              >
                <option value="todos">Todos</option>
                <option value="1">Set 1</option>
                <option value="2">Set 2</option>
                <option value="3">Set 3</option>
                <option value="4">Set 4</option>
                <option value="5">Set 5</option>
              </select>
            </div>
          </div>

          {/* Filtros tácticos (8 secciones) */}
          <FiltrosTacticos
            filtros={filtrosTacticos}
            onChange={onFiltrosTacticos}
            jugadorFiltradoNombre={null}
            titulo="Conducta / Secuencia del partido"
          />

          {hayFiltrosActivos && (
            <div className="text-right">
              <button
                onClick={onLimpiarFiltros}
                className="text-xs font-medium"
                style={{ color: "#34D399" }}
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
      )}

      {/* ---------- LISTA DE JUGADORES (modo JxP) ---------- */}
      {esJxP && (
        <>
          <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
            <User size={16} />
            <span>Elegí un jugador</span>
          </h3>
          <div className="space-y-2">
            {jugadores
              .filter((j) => acciones.some((a) => a.jugador_id === j.id))
              .map((j) => {
                const sel = jugadorSeleccionadoJxP === j.id;
                return (
                  <button
                    key={j.id}
                    onClick={() => onJugadorSeleccionadoJxP(j.id)}
                    className={`w-full text-left p-3 rounded-lg border transition ${
                      sel
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <p
                      className={`font-medium text-sm ${
                        sel ? "text-white" : "text-slate-200"
                      }`}
                    >
                      {j.nombre}
                      {j.numero !== null && ` #${j.numero}`}
                      {j.rol === "armador" && (
                        <span
                          className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full ${
                            sel
                              ? "bg-white/20 text-white"
                              : "bg-violet-500/20 text-violet-300"
                          }`}
                        >
                          Arm
                        </span>
                      )}
                    </p>
                  </button>
                );
              })}
          </div>
        </>
      )}

      {/* ---------- LISTA DE PARTIDOS ---------- */}
      {!esJxP && (
        <>
          <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
            <CalendarDays size={16} />
            <span>
              {partidosFiltrados.length} partido
              {partidosFiltrados.length !== 1 ? "s" : ""}
              {modoPrincipal === "comparar-partidos" && " — elegí hasta 3"}
            </span>
          </h3>

          {partidosFiltrados.length === 0 ? (
            <div className="rounded-2xl p-6 text-center" style={cardBase}>
              <GitCompare
                size={24}
                className="mx-auto mb-2"
                style={{ color: "var(--sx-text-muted)" }}
              />
              <p
                className="text-sm"
                style={{ color: "var(--sx-text-secondary)" }}
              >
                Ningún partido cumple los filtros
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {partidosFiltrados.map((p) => {
                const idxComparado = partidosComparados.indexOf(p.id);
                const seleccionadoIndividual =
                  modoPrincipal === "partido" && partidoSeleccionado === p.id;
                const colorComp =
                  idxComparado !== -1
                    ? COLORES_COMPARACION[idxComparado]
                    : null;

                return (
                  <button
                    key={p.id}
                    onClick={() =>
                      modoPrincipal === "partido"
                        ? onPartidoSeleccionado(p.id)
                        : onTogglePartidoComparado(p.id)
                    }
                    className={`w-full text-left p-3 rounded-lg border transition relative ${
                      seleccionadoIndividual
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : colorComp
                        ? "border-2 text-white"
                        : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white"
                    }`}
                    style={
                      colorComp
                        ? {
                            backgroundColor: colorComp + "20",
                            borderColor: colorComp,
                          }
                        : undefined
                    }
                  >
                    {idxComparado !== -1 && (
                      <span
                        className="absolute top-2 right-2 w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center border-2 border-white shadow"
                        style={{ backgroundColor: colorComp! }}
                      >
                        {idxComparado + 1}
                      </span>
                    )}
                    <p
                      className={`font-medium text-sm ${
                        seleccionadoIndividual
                          ? "text-white"
                          : "text-slate-200"
                      }`}
                    >
                      vs {nombreRivalDe(p)}
                    </p>
                    <p
                      className={`text-xs mt-1 ${
                        seleccionadoIndividual
                          ? "text-emerald-100"
                          : "text-slate-400"
                      }`}
                    >
                      📅 {p.fecha}
                    </p>
                    <p
                      className={`text-xs mt-1 ${
                        seleccionadoIndividual
                          ? "text-emerald-100"
                          : "text-slate-400"
                      }`}
                    >
                      {scoreDe(p)}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}