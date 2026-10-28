"use client";

// ============================================================
// HEADER DEL PARTIDO — título dinámico + fecha + score + badges
// ============================================================
// Componente puro presentacional. Recibe todos los datos por
// props y devuelve el bloque de arriba del detalle.
//
// Ajusta el título según el modo principal:
//   - partido:             "EQUIPO vs RIVAL"
//   - comparar-partidos:   "Comparación de partidos · EQUIPO"
//   - jugador-por-partidos:"JUGADOR · EQUIPO"
// ============================================================

import { Calendar } from "lucide-react";
import { cardBase, type ModoPrincipal, type Partido } from "./types";

// ------------------------------------------------------------
// PROPS
// ------------------------------------------------------------

interface Props {
  modoPrincipal: ModoPrincipal;
  nombreEquipo: string;
  partidoDetalle: Partido | null;
  /** Nombre del jugador seleccionado en modo "jugador-por-partidos". */
  jugadorSeleccionadoJxP: string | null;
  /** Nombre del rival visible desde la perspectiva del equipo actual. */
  nombreRivalDe: (p: Partido) => string;
  /** Nombre a mostrar del jugador (o "?" si no lo encuentra). */
  nombreDe: (id: string) => string;
  /** Filtro de set activo (para mostrar el badge). */
  filtroSet: "todos" | "1" | "2" | "3" | "4" | "5";
  /** ¿Hay filtros tácticos activos? (para el badge violeta). */
  hayFiltrosTacticosActivos: boolean;
}

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

function scoreDe(p: Partido): string {
  const sets = [p.set1, p.set2, p.set3, p.set4, p.set5].filter(Boolean);
  return sets.length > 0 ? sets.join(" · ") : "Sin score";
}

// ------------------------------------------------------------
// COMPONENTE
// ------------------------------------------------------------

export default function HeaderPartido({
  modoPrincipal,
  nombreEquipo,
  partidoDetalle,
  jugadorSeleccionadoJxP,
  nombreRivalDe,
  nombreDe,
  filtroSet,
  hayFiltrosTacticosActivos,
}: Props) {
  // Título dinámico según el modo.
  const titulo =
    modoPrincipal === "partido" && partidoDetalle
      ? `${nombreEquipo} vs ${nombreRivalDe(partidoDetalle)}`
      : modoPrincipal === "comparar-partidos"
      ? `Comparación de partidos · ${nombreEquipo}`
      : modoPrincipal === "jugador-por-partidos"
      ? `${nombreDe(jugadorSeleccionadoJxP ?? "")} · ${nombreEquipo}`
      : `Partidos · ${nombreEquipo}`;

  const mostrarMeta = modoPrincipal === "partido" && partidoDetalle !== null;

  return (
    <div className="rounded-2xl p-4 sm:p-5" style={cardBase}>
      <h2 className="text-lg sm:text-xl font-black text-white break-words tracking-tight">
        {titulo}
      </h2>

      {mostrarMeta && partidoDetalle && (
        <p
          className="text-xs mt-1.5 flex items-center gap-2 flex-wrap"
          style={{ color: "var(--sx-text-secondary)" }}
        >
          {/* Fecha */}
          <span className="inline-flex items-center gap-1 font-medium">
            <Calendar size={13} style={{ color: "var(--sx-text-muted)" }} />
            {partidoDetalle.fecha}
          </span>

          {/* Score */}
          <span
            className="font-mono font-bold px-2 py-0.5 rounded text-[11px]"
            style={{
              background: "rgba(255,255,255,0.08)",
              color: "var(--sx-text-primary)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            {scoreDe(partidoDetalle)}
          </span>

          {/* Badge: solo set N */}
          {filtroSet !== "todos" && (
            <span
              className="px-2 py-0.5 rounded text-[11px] font-semibold"
              style={{
                background: "rgba(37,99,235,0.15)",
                color: "#93C5FD",
                border: "1px solid rgba(37,99,235,0.35)",
              }}
            >
              Solo Set {filtroSet}
            </span>
          )}

          {/* Badge: filtros tácticos activos */}
          {hayFiltrosTacticosActivos && (
            <span
              className="px-2 py-0.5 rounded text-[11px] font-semibold"
              style={{
                background: "rgba(167,139,250,0.15)",
                color: "#C4B5FD",
                border: "1px solid rgba(167,139,250,0.35)",
              }}
            >
              Filtros tácticos activos
            </span>
          )}
        </p>
      )}
    </div>
  );
}