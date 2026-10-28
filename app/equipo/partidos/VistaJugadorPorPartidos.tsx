"use client";

// ============================================================
// VISTA: JUGADOR POR PARTIDOS
// ============================================================
// Componente presentacional puro. Recibe todos los datos ya
// calculados por el contenedor y renderiza el análisis de un
// jugador a través de 1-3 partidos seleccionados.
//
// Sin estado propio, sin cálculos internos.
// ============================================================

import { GitCompare } from "lucide-react";
import type { AccionDB } from "@/lib/db";
import type { SerieRadar } from "../RadarJugador";
import type { SerieSaque } from "../GraficoSaquePorSet";
import type { SerieRecepcion } from "../GraficoRecepcionPorSet";
import type { SerieBloqueo } from "../GraficoBloqueoPorSet";
import type { SerieArmados } from "../GraficoArmadosPorSet";
import RadarJugador from "../RadarJugador";
import GraficoSaquePorSet from "../GraficoSaquePorSet";
import GraficoRecepcionPorSet from "../GraficoRecepcionPorSet";
import GraficoBloqueoPorSet from "../GraficoBloqueoPorSet";
import GraficoArmadosPorSet from "../GraficoArmadosPorSet";
import GraficoBarrasFundamentoPartidos from "../GraficoBarrasFundamentoPartidos";
import {
  COLORES_COMPARACION,
  FUNDAMENTOS_BARRAS,
  NOMBRES,
  cardBase,
  type Partido,
} from "./types";
import type { PartidoJxPData } from "./helpers";

// ------------------------------------------------------------
// PROPS
// ------------------------------------------------------------

interface Props {
  // ----- Jugador -----
  jugadorSeleccionadoJxP: string | null;
  /** Nombre ya calculado en el contenedor. */
  jugadorNombre: string;
  esArmadorJxP: boolean;

  // ----- Selector de partidos -----
  partidos: Partido[];
  partidosJxP: string[];
  onTogglePartidoJxP: (id: string) => void;

  // ----- Datos ya calculados -----
  partidosJxPData: PartidoJxPData[];
  seriesRadarJxP: SerieRadar[];
  seriesSaqueJxP: SerieSaque[];
  seriesRecepcionJxP: SerieRecepcion[];
  seriesBloqueoJxP: SerieBloqueo[];
  seriesArmadosJxP: SerieArmados[];
  accionesJxPCombinadas: AccionDB[];
  acciones: AccionDB[];

  // ----- Helpers -----
  nombreDe: (id: string) => string;
  nombreRivalDe: (p: Partido) => string;
}

// ------------------------------------------------------------
// COMPONENTE
// ------------------------------------------------------------

export default function VistaJugadorPorPartidos({
  jugadorSeleccionadoJxP,
  jugadorNombre,
  esArmadorJxP,
  partidos,
  partidosJxP,
  onTogglePartidoJxP,
  partidosJxPData,
  seriesRadarJxP,
  seriesSaqueJxP,
  seriesRecepcionJxP,
  seriesBloqueoJxP,
  seriesArmadosJxP,
  accionesJxPCombinadas,
  acciones,
  nombreDe,
  nombreRivalDe,
}: Props) {
  // ---------- Empty state: sin jugador elegido ----------
  if (!jugadorSeleccionadoJxP) {
    return (
      <div className="rounded-2xl p-8 sm:p-12 text-center" style={cardBase}>
        <p className="text-4xl mb-3">👈</p>
        <p
          className="font-medium"
          style={{ color: "var(--sx-text-primary)" }}
        >
          Elegí un jugador a la izquierda para empezar
        </p>
      </div>
    );
  }

  // ---------- Render principal ----------
  return (
    <div className="space-y-4">
      {/* ---------- SELECTOR DE PARTIDOS ---------- */}
      <div className="rounded-2xl p-3 sm:p-5" style={cardBase} data-pdf-ignorar>
        <h4 className="font-semibold text-white mb-3">
          Elegí hasta 3 partidos para comparar a {jugadorNombre}
        </h4>
        <div className="flex gap-2 flex-wrap">
          {partidos.map((p) => {
            const idx = partidosJxP.indexOf(p.id);
            const color = idx !== -1 ? COLORES_COMPARACION[idx] : null;
            const tieneAcciones = acciones.some(
              (a) => a.partido_id === p.id && a.jugador_id === jugadorSeleccionadoJxP
            );
            return (
              <button
                key={p.id}
                onClick={() => onTogglePartidoJxP(p.id)}
                disabled={!tieneAcciones && idx === -1}
                className={`px-3 py-2 text-xs font-medium rounded-lg transition border flex items-center gap-2 ${
                  color
                    ? "border-2 text-white"
                    : !tieneAcciones
                    ? "bg-white/5 text-slate-600 cursor-not-allowed border-white/10 opacity-50"
                    : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white"
                }`}
                style={
                  color
                    ? {
                        backgroundColor: color + "20",
                        borderColor: color,
                      }
                    : undefined
                }
              >
                {color && (
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                    style={{ backgroundColor: color }}
                  >
                    {idx + 1}
                  </span>
                )}
                vs {nombreRivalDe(p)} · {p.fecha}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---------- EMPTY STATE: sin partidos seleccionados ---------- */}
      {partidosJxPData.length === 0 ? (
        <div
          className="rounded-2xl p-8 sm:p-12 text-center max-w-sm mx-auto"
          style={cardBase}
        >
          <GitCompare
            size={36}
            className="mx-auto mb-3"
            style={{ color: "var(--sx-text-muted)" }}
          />
          <h4 className="text-white font-bold text-sm">
            Sin partidos seleccionados
          </h4>
          <p
            className="text-xs mt-1"
            style={{ color: "var(--sx-text-secondary)" }}
          >
            Elegí partidos arriba para analizar la evolución del jugador.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl p-4 sm:p-6" style={cardBase}>
          {/* ---------- HEADER CON CHIPS ---------- */}
          <div
            className="mb-6 pb-4"
            style={{ borderBottom: "1px solid var(--sx-border)" }}
          >
            <h3 className="text-lg sm:text-xl font-bold text-white mb-3">
              {jugadorNombre} en {partidosJxPData.length} partido
              {partidosJxPData.length !== 1 ? "s" : ""}
            </h3>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {partidosJxPData.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                  style={{
                    border: "1px solid var(--sx-border)",
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-sm font-medium text-slate-200">
                    {s.nombre}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ---------- RADAR + 5 BARRAS ---------- */}
          <div className="mb-6">
            <h4 className="font-semibold text-white mb-3">
              Radar comparado
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
              <div className="rounded-2xl p-2 col-span-1" style={cardBase}>
                <RadarJugador series={seriesRadarJxP} esArmador={esArmadorJxP} />
              </div>
              {FUNDAMENTOS_BARRAS.map((f) => (
                <GraficoBarrasFundamentoPartidos
                  key={f}
                  fundamento={f}
                  acciones={accionesJxPCombinadas}
                  jugadorId={jugadorSeleccionadoJxP}
                  tituloOverride={`${NOMBRES[f]} (total)`}
                />
              ))}
            </div>
          </div>

          {/* ---------- VALORACIÓN PONDERADA POR PARTIDO ---------- */}
          <div className="mb-6">
            <h4 className="font-semibold text-white mb-3">
              Valoración ponderada por partido
            </h4>
            <div
              className="overflow-x-auto rounded-lg"
              style={{ border: "1px solid var(--sx-border)" }}
            >
              <table className="w-full text-sm min-w-[500px]">
                <thead
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    borderBottom: "1px solid var(--sx-border)",
                  }}
                >
                  <tr
                    className="text-left"
                    style={{ color: "var(--sx-text-secondary)" }}
                  >
                    <th className="py-2 px-3">Fundamento</th>
                    {partidosJxPData.map((s) => (
                      <th
                        key={s.id}
                        className="py-2 px-3 text-right"
                        style={{ color: s.color }}
                      >
                        {s.nombre}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(
                    partidosJxPData[0].est.valoracionPonderadaPorFundamento
                  ).map((f) => (
                    <tr
                      key={f}
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                    >
                      <td className="py-2 px-3 font-medium text-white">
                        {NOMBRES[f] ?? f}
                      </td>
                      {partidosJxPData.map((s) => {
                        const val =
                          s.est.valoracionPonderadaPorFundamento[f] ?? 0;
                        return (
                          <td
                            key={s.id}
                            className="py-2 px-3 text-right font-semibold tabular-nums"
                            style={{ color: s.color }}
                          >
                            {val > 0 ? "+" : ""}
                            {val.toFixed(2)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ---------- GRÁFICOS POR SET ---------- */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <div className="rounded-2xl p-3 sm:p-4" style={cardBase}>
              <GraficoSaquePorSet series={seriesSaqueJxP} />
            </div>

            {!esArmadorJxP && (
              <div className="rounded-2xl p-3 sm:p-4" style={cardBase}>
                <GraficoRecepcionPorSet series={seriesRecepcionJxP} />
              </div>
            )}

            {esArmadorJxP && (
              <div className="rounded-2xl p-3 sm:p-4" style={cardBase}>
                <GraficoArmadosPorSet series={seriesArmadosJxP} />
              </div>
            )}

            <div
              className={`rounded-2xl p-3 sm:p-4 ${
                esArmadorJxP ? "" : "md:col-span-2"
              }`}
              style={cardBase}
            >
              <GraficoBloqueoPorSet series={seriesBloqueoJxP} />
            </div>
          </div>

          {/* ---------- TABLA RESUMEN POR PARTIDO ---------- */}
          <div
            className="mt-6 overflow-x-auto rounded-lg"
            style={{ border: "1px solid var(--sx-border)" }}
          >
            <table className="w-full text-sm min-w-[500px]">
              <thead
                style={{
                  background: "rgba(255,255,255,0.04)",
                  borderBottom: "1px solid var(--sx-border)",
                }}
              >
                <tr
                  className="text-left"
                  style={{ color: "var(--sx-text-secondary)" }}
                >
                  <th className="py-2 px-3">Partido</th>
                  <th className="py-2 px-3 text-right">Acciones</th>
                  <th className="py-2 px-3 text-right">Puntos</th>
                  <th className="py-2 px-3 text-right">Errores</th>
                  <th className="py-2 px-3 text-right">Saldo</th>
                  <th className="py-2 px-3 text-right">Val. Media</th>
                </tr>
              </thead>
              <tbody>
                {partidosJxPData.map((s) => (
                  <tr
                    key={s.id}
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                  >
                    <td className="py-2 px-3 font-medium">
                      <span
                        className="inline-block w-3 h-3 rounded-full mr-2 align-middle"
                        style={{ backgroundColor: s.color }}
                      />
                      <span className="text-white">{s.nombre}</span>
                    </td>
                    <td className="py-2 px-3 text-right text-slate-300 font-mono tabular-nums">
                      {s.est.totalAcciones}
                    </td>
                    <td className="py-2 px-3 text-right text-emerald-400 font-mono tabular-nums">
                      {s.est.totalPuntos}
                    </td>
                    <td className="py-2 px-3 text-right text-rose-400 font-mono tabular-nums">
                      {s.est.totalErrores}
                    </td>
                    <td
                      className={`py-2 px-3 text-right font-semibold tabular-nums ${
                        s.est.saldoTotal > 0
                          ? "text-emerald-400"
                          : s.est.saldoTotal < 0
                          ? "text-rose-400"
                          : "text-slate-400"
                      }`}
                    >
                      {s.est.saldoTotal > 0 ? "+" : ""}
                      {s.est.saldoTotal}
                    </td>
                    <td
                      className={`py-2 px-3 text-right font-semibold tabular-nums ${
                        s.est.valoracionMediaNormalizada > 0
                          ? "text-emerald-400"
                          : s.est.valoracionMediaNormalizada < 0
                          ? "text-rose-400"
                          : "text-slate-400"
                      }`}
                    >
                      {s.est.valoracionMediaNormalizada > 0 ? "+" : ""}
                      {s.est.valoracionMediaNormalizada.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}