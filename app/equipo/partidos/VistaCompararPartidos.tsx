"use client";

// ============================================================
// VISTA: COMPARAR PARTIDOS
// ============================================================
// Componente presentacional puro. Recibe los datos ya calculados
// por el contenedor y renderiza la comparativa de 2-3 partidos.
//
// No tiene estado propio ni cálculos internos.
// ============================================================

import { GitCompare } from "lucide-react";
import type { AccionDB } from "@/lib/db";
import type { EstadisticasJugador, PromedioRecepcionSet } from "@/lib/estadisticas";
import RadarEquipo from "../RadarEquipo";
import GraficoBarrasFundamentoPartidos from "../GraficoBarrasFundamentoPartidos";
import GraficoRecepcionEquipoPorSet from "../GraficoRecepcionEquipoPorSet";
import {
  FUNDAMENTOS_BARRAS,
  NOMBRES,
  cardBase,
} from "./types";

// ------------------------------------------------------------
// PROPS
// ------------------------------------------------------------

export interface SerieRadarEquipoData {
  id: string;
  nombre: string;
  color: string;
  equipo: EstadisticasJugador;
}

export interface SerieRecepcionEquipoData {
  id: string;
  nombre: string;
  color: string;
  promedios: PromedioRecepcionSet[];
}

export interface PartidoComparadoItem {
  id: string;
  nombre: string;
  color: string;
  stats: EstadisticasJugador;
}

interface Props {
  partidosComparadosData: PartidoComparadoItem[];
  seriesRadarPartidos: SerieRadarEquipoData[];
  seriesRecepcionPartidos: SerieRecepcionEquipoData[];
  accionesPartidosComparados: AccionDB[];
}

// ------------------------------------------------------------
// COMPONENTE
// ------------------------------------------------------------

export default function VistaCompararPartidos({
  partidosComparadosData,
  seriesRadarPartidos,
  seriesRecepcionPartidos,
  accionesPartidosComparados,
}: Props) {
  // Empty state: ningún partido seleccionado todavía.
  if (partidosComparadosData.length === 0) {
    return (
      <div className="rounded-2xl p-4 sm:p-6" style={cardBase}>
        <div className="p-8 sm:p-12 text-center max-w-sm mx-auto">
          <GitCompare
            size={36}
            className="mx-auto mb-3"
            style={{ color: "var(--sx-text-muted)" }}
          />
          <h4 className="text-white font-bold text-sm">
            Comparativa de partidos
          </h4>
          <p
            className="text-xs mt-1"
            style={{ color: "var(--sx-text-secondary)" }}
          >
            Elegí hasta 3 partidos en el panel izquierdo para contrastar
            rendimiento del equipo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-4 sm:p-6" style={cardBase}>
      {/* ---------- HEADER CON CHIPS ---------- */}
      <div
        className="mb-6 pb-4"
        style={{ borderBottom: "1px solid var(--sx-border)" }}
      >
        <h3 className="text-lg sm:text-xl font-bold text-white mb-3">
          Comparando {partidosComparadosData.length} partido
          {partidosComparadosData.length !== 1 ? "s" : ""}
        </h3>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {partidosComparadosData.map((s) => (
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

      {/* ---------- RADAR + 5 BARRAS POR FUNDAMENTO ---------- */}
      <div className="mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-2xl p-2 col-span-1" style={cardBase}>
            <RadarEquipo
              series={seriesRadarPartidos}
              titulo="Radar comparativo del equipo"
            />
          </div>
          {FUNDAMENTOS_BARRAS.map((f) => (
            <GraficoBarrasFundamentoPartidos
              key={f}
              fundamento={f}
              acciones={accionesPartidosComparados}
              tituloOverride={`${NOMBRES[f]} (total)`}
            />
          ))}
        </div>
      </div>

      {/* ---------- RECEPCIÓN EQUIPO POR SET ---------- */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4">
        <div className="rounded-2xl p-3 sm:p-4" style={cardBase}>
          <GraficoRecepcionEquipoPorSet series={seriesRecepcionPartidos} />
        </div>
      </div>

      {/* ---------- TABLA RESUMEN ---------- */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm min-w-[500px]">
          <thead>
            <tr
              className="text-left"
              style={{
                color: "var(--sx-text-secondary)",
                borderBottom: "1px solid var(--sx-border)",
              }}
            >
              <th className="py-2 px-3">Partido</th>
              <th className="py-2 px-3 text-right">Acciones</th>
              <th className="py-2 px-3 text-right">Puntos</th>
              <th className="py-2 px-3 text-right">Errores</th>
              <th className="py-2 px-3 text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {partidosComparadosData.map((s) => (
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
                  {s.stats.totalAcciones}
                </td>
                <td className="py-2 px-3 text-right text-emerald-400 font-mono tabular-nums">
                  {s.stats.totalPuntos}
                </td>
                <td className="py-2 px-3 text-right text-rose-400 font-mono tabular-nums">
                  {s.stats.totalErrores}
                </td>
                <td
                  className={`py-2 px-3 text-right font-semibold tabular-nums ${
                    s.stats.saldoTotal > 0
                      ? "text-emerald-400"
                      : s.stats.saldoTotal < 0
                      ? "text-rose-400"
                      : "text-slate-400"
                  }`}
                >
                  {s.stats.saldoTotal > 0 ? "+" : ""}
                  {s.stats.saldoTotal}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}