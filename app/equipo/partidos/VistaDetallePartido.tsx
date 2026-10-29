"use client";

// ============================================================
// VISTA: DETALLE DE UN PARTIDO
// ============================================================
// Las 4 tabs del detalle:
//   - Análisis
//   - Comparar jugadores
//   - Estadísticas crudas
//   - Consecuencias
//
// Tiene su propio estado de `modoDetalle` y `jugadoresComparados`
// (no vive en el contenedor). Se resetea al cambiar de partido.
// ============================================================

import { useEffect, useState } from "react";
import {
  calcularPromedioPonderadoPorSet,
  calcularPromedioArmadosPonderadoPorSet,
  VALORES_SAQUE,
  VALORES_RECEPCION,
  VALORES_BLOQUEO,
  type EstadisticasJugador,
} from "@/lib/estadisticas";
import type { AccionDB } from "@/lib/db";
import type { AccionVisual } from "../adaptadorUnificadoV2";
import AnalisisConsecuencias from "../AnalisisConsecuencias";
import RadarJugador from "../RadarJugador";
import RadarEquipo from "../RadarEquipo";
import GraficoSaquePorSet from "../GraficoSaquePorSet";
import GraficoRecepcionPorSet from "../GraficoRecepcionPorSet";
import GraficoBloqueoPorSet from "../GraficoBloqueoPorSet";
import GraficoArmadosPorSet from "../GraficoArmadosPorSet";
import GraficoRecepcionEquipoPorSet from "../GraficoRecepcionEquipoPorSet";
import GraficoTortaRival from "../GraficoTortaRival";
import GraficoBarrasFundamentoPartidos from "../GraficoBarrasFundamentoPartidos";
import TablaJugadoresPorSet from "../TablaJugadoresPorSet";
import TablaEstadisticasCrudas from "../TablaEstadisticasCrudas";
import IconoVoley from "../IconoVoley";
import { calcularPromediosRecepcionEquipo } from "./helpers";
import {
  COLORES_COMPARACION,
  FUNDAMENTOS,
  FUNDAMENTOS_BARRAS,
  NOMBRES,
  cardBase,
  cardTerracota,
  type DatosRival,
  type Jugador,
  type ModoDetalle,
  type Partido,
} from "./types";

// ------------------------------------------------------------
// PROPS
// ------------------------------------------------------------

interface Props {
  partidoDetalle: Partido;
  statsPartido: {
    porJugador: Record<string, EstadisticasJugador>;
    totales: EstadisticasJugador;
  };
  accionesDelPartido: AccionDB[];
  /** Acciones unificadas (propias + rivales, con flip resueltos)
   *  para el análisis de consecuencias. Ya vienen del padre. */
  accionesVisualesParaAnalisis: AccionVisual[];
  idsJugadores: string[];
  armadores: Set<string>;
  jugadores: Jugador[];
  nombresJugadoresMap: Record<string, string>;
  datosRivalPartido: DatosRival;
  filtroSet: "todos" | "1" | "2" | "3" | "4" | "5";
  nombreEquipo: string;
  nombreRivalDe: (p: Partido) => string;
  nombreDe: (id: string) => string;
  hayFiltrosTacticosActivos: boolean;
  crudasEnPDF: boolean;
  onIrAPunto?: (set: number, punto: number) => void;
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

export default function VistaDetallePartido({
  partidoDetalle,
  statsPartido,
  accionesDelPartido,
  accionesVisualesParaAnalisis,
  idsJugadores,
  armadores,
  jugadores,
  nombresJugadoresMap,
  datosRivalPartido,
  filtroSet,
  nombreEquipo,
  nombreRivalDe,
  nombreDe,
  hayFiltrosTacticosActivos,
  crudasEnPDF,
  onIrAPunto,
}: Props) {
  // -------- Estado local --------
  const [modoDetalle, setModoDetalle] = useState<ModoDetalle>("analisis");
  const [jugadoresComparados, setJugadoresComparados] = useState<string[]>([]);

  // Reset al cambiar de partido.
  useEffect(() => {
    setModoDetalle("analisis");
    setJugadoresComparados([]);
  }, [partidoDetalle.id]);

  // -------- Handlers --------
  const handleToggleJugadorComparado = (id: string) => {
    if (jugadoresComparados.includes(id)) {
      setJugadoresComparados(jugadoresComparados.filter((x) => x !== id));
      return;
    }
    if (jugadoresComparados.length >= 3) return;

    if (jugadoresComparados.length > 0) {
      const primerEsArm = armadores.has(jugadoresComparados[0]);
      const esteEsArm = armadores.has(id);
      if (primerEsArm !== esteEsArm) return;
    }

    setJugadoresComparados([...jugadoresComparados, id]);
  };

  // -------- Cálculos --------
  const promediosRecepcionEquipo = calcularPromediosRecepcionEquipo(
    accionesDelPartido,
    armadores
  );

  const jugadoresComparadosData = jugadoresComparados.map((id, idx) => ({
    id,
    nombre: nombreDe(id),
    color: COLORES_COMPARACION[idx],
    est: statsPartido.porJugador[id],
  }));

  const esComparacionArmador =
    jugadoresComparadosData.length > 0 &&
    armadores.has(jugadoresComparadosData[0].id);

  const statsJugadoresComparados = jugadoresComparadosData
    .filter((s) => s.est)
    .map((s) => ({ ...s, est: s.est! }));

  const seriesRadarJugadores = statsJugadoresComparados.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    color: s.color,
    jugador: s.est,
  }));

  const seriesSaqueJugadores = statsJugadoresComparados.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    color: s.color,
    promedios: calcularPromedioPonderadoPorSet(
      s.id,
      accionesDelPartido,
      idsJugadores,
      "saque",
      VALORES_SAQUE
    ),
  }));

  const seriesRecepcionJugadores = statsJugadoresComparados.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    color: s.color,
    promedios: calcularPromedioPonderadoPorSet(
      s.id,
      accionesDelPartido,
      idsJugadores,
      "recepcion",
      VALORES_RECEPCION
    ),
  }));

  const seriesBloqueoJugadores = statsJugadoresComparados.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    color: s.color,
    promedios: calcularPromedioPonderadoPorSet(
      s.id,
      accionesDelPartido,
      idsJugadores,
      "bloqueo",
      VALORES_BLOQUEO
    ),
  }));

  const seriesArmadosJugadores = statsJugadoresComparados.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    color: s.color,
    promedios: calcularPromedioArmadosPonderadoPorSet(
      s.id,
      accionesDelPartido,
      idsJugadores
    ),
  }));

  // Lista de jugadores para el dropdown de "jugador específico"
  // en el panel de consecuencias.
  const jugadoresDisponibles = jugadores.map((j) => ({
    id: j.id,
    nombre: nombreDe(j.id),
  }));

  return (
    <div className="space-y-4">
      {/* ---------- BARRA DE TABS ---------- */}
      <div className="flex flex-wrap justify-end gap-2" data-pdf-ignorar>
        <button
          onClick={() => setModoDetalle("analisis")}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition border ${
            modoDetalle === "analisis"
              ? "bg-emerald-500 text-white border-emerald-500"
              : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white"
          }`}
        >
          <IconoVoley
            tipo="dashboard"
            size={14}
            className={
              modoDetalle === "analisis" ? "text-white" : "text-slate-400"
            }
          />
          Análisis
        </button>
        <button
          onClick={() => setModoDetalle("comparar-jugadores")}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition border ${
            modoDetalle === "comparar-jugadores"
              ? "bg-emerald-500 text-white border-emerald-500"
              : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white"
          }`}
        >
          <IconoVoley
            tipo="comparar"
            size={14}
            className={
              modoDetalle === "comparar-jugadores"
                ? "text-white"
                : "text-slate-400"
            }
          />
          Comparar jugadores ({jugadoresComparados.length}/3)
        </button>
        <button
          onClick={() => setModoDetalle("crudas")}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition border ${
            modoDetalle === "crudas"
              ? "bg-emerald-500 text-white border-emerald-500"
              : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white"
          }`}
        >
          <IconoVoley
            tipo="crudas"
            size={14}
            className={
              modoDetalle === "crudas" ? "text-white" : "text-slate-400"
            }
          />
          Estadísticas crudas
        </button>
        <button
          onClick={() => setModoDetalle("consecuencias")}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition border ${
            modoDetalle === "consecuencias"
              ? "bg-emerald-500 text-white border-emerald-500"
              : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white"
          }`}
        >
          <span className="text-sm">🔍</span>
          Consecuencias
        </button>
      </div>

      {/* ---------- CARD TERRACOTA (header del partido) ---------- */}
      <div className="rounded-2xl p-3 sm:p-5" style={cardTerracota}>
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0">
            <h3 className="text-lg sm:text-xl font-bold text-white break-words">
              {nombreEquipo} vs {nombreRivalDe(partidoDetalle)}
            </h3>
            <p
              className="text-sm mt-1"
              style={{ color: "var(--sx-text-secondary)" }}
            >
              📅 {partidoDetalle.fecha}
            </p>
            <p
              className="text-sm mt-1 font-semibold"
              style={{ color: "#FBBF24" }}
            >
              {scoreDe(partidoDetalle)}
            </p>
            {filtroSet !== "todos" && (
              <p
                className="text-xs mt-2 px-2 py-1 rounded inline-block"
                style={{
                  background: "rgba(245,158,11,0.15)",
                  color: "#FBBF24",
                  border: "1px solid rgba(245,158,11,0.35)",
                }}
              >
                Filtrando solo Set {filtroSet}
              </p>
            )}
          </div>
        </div>
        {partidoDetalle.notas && (
          <p
            className="text-xs mt-3 pt-3 italic"
            style={{
              color: "var(--sx-text-secondary)",
              borderTop: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            &quot;{partidoDetalle.notas}&quot;
          </p>
        )}
      </div>

      {/* ---------- TAB: CONSECUENCIAS ---------- */}
      {modoDetalle === "consecuencias" && (
        <div className="rounded-2xl p-3 sm:p-5" style={cardBase}>
          <AnalisisConsecuencias
            acciones={accionesVisualesParaAnalisis}
            nombreDeJugador={(id) => (id ? nombreDe(id) : "—")}
            jugadoresDisponibles={jugadoresDisponibles}
            onIrAPunto={onIrAPunto}
            titulo="Análisis de consecuencias del partido"
          />
        </div>
      )}

      {/* ---------- TAB: COMPARAR JUGADORES ---------- */}
      {modoDetalle === "comparar-jugadores" && (
        <>
          <div
            className="rounded-2xl p-3 sm:p-5"
            style={cardBase}
            data-pdf-ignorar
          >
            <h4 className="font-semibold text-white mb-3">
              Elegí hasta 3 jugadores (mismo rol)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {jugadores
                .filter((j) =>
                  accionesDelPartido.some((a) => a.jugador_id === j.id)
                )
                .map((j) => {
                  const idx = jugadoresComparados.indexOf(j.id);
                  const colorComp =
                    idx !== -1 ? COLORES_COMPARACION[idx] : null;

                  let bloqueado = false;
                  if (jugadoresComparados.length > 0 && idx === -1) {
                    const primerEsArm = armadores.has(jugadoresComparados[0]);
                    const esteEsArm = armadores.has(j.id);
                    if (primerEsArm !== esteEsArm) bloqueado = true;
                  }
                  const puedeAgregarMas =
                    jugadoresComparados.length >= 3 && idx === -1;

                  return (
                    <button
                      key={j.id}
                      onClick={() => handleToggleJugadorComparado(j.id)}
                      disabled={bloqueado || puedeAgregarMas}
                      className={`text-left px-3 py-2 rounded-lg border transition text-sm ${
                        colorComp
                          ? "border-2"
                          : bloqueado || puedeAgregarMas
                          ? "bg-white/5 text-slate-600 cursor-not-allowed opacity-50 border-white/10"
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
                      <div className="flex items-center gap-2">
                        {colorComp && (
                          <span
                            className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                            style={{ backgroundColor: colorComp }}
                          >
                            {idx + 1}
                          </span>
                        )}
                        <span className="font-medium truncate text-white">
                          {nombreDe(j.id)}
                          {j.rol === "armador" && " (Arm)"}
                        </span>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>

          {statsJugadoresComparados.length > 0 ? (
            <div className="rounded-2xl p-4 sm:p-6" style={cardBase}>
              <div className="mb-6">
                <RadarJugador
                  series={seriesRadarJugadores}
                  esArmador={esComparacionArmador}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <div className="rounded-2xl p-3 sm:p-4" style={cardBase}>
                  <GraficoSaquePorSet series={seriesSaqueJugadores} />
                </div>

                {!esComparacionArmador && (
                  <div className="rounded-2xl p-3 sm:p-4" style={cardBase}>
                    <GraficoRecepcionPorSet
                      series={seriesRecepcionJugadores}
                    />
                  </div>
                )}

                {esComparacionArmador && (
                  <div className="rounded-2xl p-3 sm:p-4" style={cardBase}>
                    <GraficoArmadosPorSet series={seriesArmadosJugadores} />
                  </div>
                )}

                <div
                  className={`rounded-2xl p-3 sm:p-4 ${
                    esComparacionArmador ? "" : "md:col-span-2"
                  }`}
                  style={cardBase}
                >
                  <GraficoBloqueoPorSet series={seriesBloqueoJugadores} />
                </div>
              </div>

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
                      <th className="py-2 px-3">Jugador</th>
                      <th className="py-2 px-3 text-right">Acciones</th>
                      <th className="py-2 px-3 text-right">Puntos</th>
                      <th className="py-2 px-3 text-right">Errores</th>
                      <th className="py-2 px-3 text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statsJugadoresComparados.map((s) => (
                      <tr
                        key={s.id}
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                        }}
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div
              className="rounded-2xl p-8 sm:p-12 text-center"
              style={cardBase}
            >
              <p className="text-4xl mb-3">👆</p>
              <p
                className="font-medium"
                style={{ color: "var(--sx-text-primary)" }}
              >
                Elegí jugadores arriba para ver la comparación
              </p>
            </div>
          )}
        </>
      )}

      {/* ---------- TAB: CRUDAS ---------- */}
      {modoDetalle === "crudas" && (
        <div className="rounded-2xl p-3 sm:p-6" style={cardBase}>
          <TablaEstadisticasCrudas
            acciones={accionesDelPartido}
            jugadoresIds={idsJugadores}
            nombresJugadores={nombresJugadoresMap}
            armadores={armadores}
            contexto={`Solo este partido · vs ${nombreRivalDe(partidoDetalle)} · ${
              partidoDetalle.fecha
            }${filtroSet !== "todos" ? ` · Set ${filtroSet}` : ""}${
              hayFiltrosTacticosActivos ? " · con filtros tácticos" : ""
            }`}
          />
        </div>
      )}

      {/* ---------- TAB: ANALISIS ---------- */}
      {modoDetalle === "analisis" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
            <div
              className="rounded-2xl p-3 sm:p-4 text-center"
              style={cardBase}
            >
              <p
                className="text-xs uppercase tracking-wider font-semibold"
                style={{ color: "var(--sx-text-secondary)" }}
              >
                Acciones
              </p>
              <p className="text-xl sm:text-2xl font-black text-white">
                {statsPartido.totales.totalAcciones}
              </p>
            </div>
            <div
              className="rounded-2xl p-3 sm:p-4 text-center"
              style={{
                background: "rgba(16,185,129,0.1)",
                border: "1px solid rgba(16,185,129,0.3)",
              }}
            >
              <p
                className="text-xs uppercase tracking-wider font-semibold"
                style={{ color: "#34D399" }}
              >
                Puntos
              </p>
              <p className="text-xl sm:text-2xl font-black text-emerald-400">
                {statsPartido.totales.totalPuntos}
              </p>
            </div>
            <div
              className="rounded-2xl p-3 sm:p-4 text-center"
              style={{
                background: "rgba(229,62,77,0.1)",
                border: "1px solid rgba(229,62,77,0.3)",
              }}
            >
              <p
                className="text-xs uppercase tracking-wider font-semibold"
                style={{ color: "#F87171" }}
              >
                Errores
              </p>
              <p className="text-xl sm:text-2xl font-black text-rose-400">
                {statsPartido.totales.totalErrores}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-2xl p-2 col-span-1" style={cardBase}>
              <RadarEquipo equipo={statsPartido.totales} />
            </div>
            {FUNDAMENTOS_BARRAS.map((f) => (
              <GraficoBarrasFundamentoPartidos
                key={f}
                fundamento={f}
                acciones={accionesDelPartido}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <div className="rounded-2xl p-3 sm:p-5" style={cardBase}>
              <GraficoRecepcionEquipoPorSet
                promedios={promediosRecepcionEquipo}
              />
            </div>
            <div className="rounded-2xl p-3 sm:p-5" style={cardBase}>
              <GraficoTortaRival
                erroresRivales={datosRivalPartido.errores}
                buenasRivales={datosRivalPartido.buenas}
              />
            </div>
          </div>

          <TablaJugadoresPorSet
            jugadoresIds={jugadores.map((j) => j.id)}
            nombresJugadores={Object.fromEntries(
              jugadores.map((j) => [j.id, nombreDe(j.id)])
            )}
            acciones={accionesDelPartido}
            armadores={armadores}
            statsEquipoTotales={statsPartido.totales}
          />

          <div
            className="rounded-2xl p-3 sm:p-5 overflow-x-auto"
            style={cardBase}
          >
            <h4 className="font-semibold text-white mb-3">
              Por fundamento (equipo)
            </h4>
            <table className="w-full text-sm min-w-[600px] border-collapse">
              <thead>
                <tr
                  className="text-left text-[11px] font-bold uppercase tracking-wider"
                  style={{
                    color: "var(--sx-text-secondary)",
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <th className="py-2.5 px-3">Fundamento</th>
                  <th className="py-2.5 px-3 text-right">Total</th>
                  <th
                    className="py-2.5 px-3 text-right"
                    style={{ color: "#34D399" }}
                  >
                    Pos
                  </th>
                  <th
                    className="py-2.5 px-3 text-right"
                    style={{ color: "#F87171" }}
                  >
                    Neg
                  </th>
                  <th className="py-2.5 px-3 text-right">Puntos</th>
                  <th className="py-2.5 px-3 text-right">Errores</th>
                  <th className="py-2.5 px-3 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {FUNDAMENTOS.map((f) => {
                  const e = statsPartido.totales.porFundamento[f];
                  if (!e || e.total === 0) return null;
                  return (
                    <tr
                      key={f}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                      }}
                    >
                      <td className="py-2.5 px-3 font-bold text-white">
                        {NOMBRES[f]}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-200 font-mono tabular-nums">
                        {e.total}
                      </td>
                      <td
                        className="py-2.5 px-3 text-right font-mono tabular-nums font-bold"
                        style={{ color: "#34D399" }}
                      >
                        {e.positivos}
                      </td>
                      <td
                        className="py-2.5 px-3 text-right font-mono tabular-nums font-bold"
                        style={{ color: "#F87171" }}
                      >
                        {e.negativos}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-200 font-mono tabular-nums">
                        {e.puntos}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-200 font-mono tabular-nums">
                        {e.errores}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-black tabular-nums ${
                          e.saldo > 0
                            ? "text-emerald-400"
                            : e.saldo < 0
                            ? "text-rose-400"
                            : "text-slate-400"
                        }`}
                      >
                        {e.saldo > 0 ? "+" : ""}
                        {e.saldo}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {crudasEnPDF && (
            <div className="rounded-2xl p-3 sm:p-6" style={cardBase}>
              <TablaEstadisticasCrudas
                acciones={accionesDelPartido}
                jugadoresIds={idsJugadores}
                nombresJugadores={nombresJugadoresMap}
                armadores={armadores}
                contexto={`Solo este partido · vs ${nombreRivalDe(
                  partidoDetalle
                )} · ${partidoDetalle.fecha}${
                  filtroSet !== "todos" ? ` · Set ${filtroSet}` : ""
                }`}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}