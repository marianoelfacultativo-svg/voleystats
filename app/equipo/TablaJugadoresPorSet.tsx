"use client";

import React, { useState } from "react";
import {
  calcularEstadisticasJugador,
  calcularPromedioPonderadoPorSet,
  calcularPromedioArmadosPonderadoPorSet,
  calcularMaxAccionesPorFundamento,
  VALORES_SAQUE,
  VALORES_RECEPCION,
  VALORES_BLOQUEO,
  ETIQUETAS_VALORACION,
  type AccionDB,
  type EstadisticasFundamento,
} from "@/lib/estadisticas";
import RadarJugador from "./RadarJugador";
import GraficoRecepcionPorSet from "./GraficoRecepcionPorSet";
import GraficoSaquePorSet from "./GraficoSaquePorSet";
import GraficoBloqueoPorSet from "./GraficoBloqueoPorSet";
import GraficoArmadosPorSet from "./GraficoArmadosPorSet";
import MapaCalorTendencia from "./MapaCalorTendencia";

interface Props {
  jugadoresIds: string[];
  nombresJugadores: Record<string, string>;
  acciones: AccionDB[];
  armadores: Set<string>;
  statsEquipoTotales: ReturnType<typeof calcularEstadisticasJugador>;
}

type SetFiltro = "todos" | 1 | 2 | 3 | 4 | 5;

const FUNDAMENTOS_NORMAL = [
  "saque",
  "recepcion",
  "ataque",
  "bloqueo",
  "defensa",
];
const FUNDAMENTOS_ARMADOR = ["saque", "bloqueo", "defensa"];

const NOMBRES_F: Record<string, string> = {
  saque: "Saque",
  recepcion: "Recepción",
  ataque: "Ataque",
  bloqueo: "Bloqueo",
  defensa: "Defensa",
};

const cardBase: React.CSSProperties = {
  background: "var(--sx-surface-1)",
  border: "1px solid var(--sx-border)",
  boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
};

const borderSuave = "1px solid rgba(255,255,255,0.04)";

export default function TablaJugadoresPorSet({
  jugadoresIds,
  nombresJugadores,
  acciones,
  armadores,
  statsEquipoTotales,
}: Props) {
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  const toggleExpandido = (id: string) => {
    setExpandidos((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  };

  const nombreDe = (id: string) => nombresJugadores[id] ?? "?";

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={cardBase}
    >
      <div
        className="p-5"
        style={{ borderBottom: "1px solid var(--sx-border)" }}
      >
        <h4 className="font-semibold text-white">
          Estadísticas por jugador
        </h4>
        <p
          className="text-xs mt-1"
          style={{ color: "var(--sx-text-secondary)" }}
        >
          Click en &quot;Ver detalle&quot; para ver el análisis completo del
          jugador en este partido
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr
              className="text-left text-[11px] font-bold uppercase tracking-wider"
              style={{
                background: "rgba(255,255,255,0.04)",
                color: "var(--sx-text-secondary)",
                borderBottom: "1px solid var(--sx-border)",
              }}
            >
              <th className="py-2.5 px-3">Jugador</th>
              <th className="py-2.5 px-3 text-right">Acc</th>
              <th className="py-2.5 px-3 text-right">Pts</th>
              <th className="py-2.5 px-3 text-right">Err</th>
              <th className="py-2.5 px-3 text-right">Saldo</th>
              <th className="py-2.5 px-3 text-right">S.Def</th>
              <th className="py-2.5 px-3 text-right">Val.Med</th>
              <th className="py-2.5 px-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {jugadoresIds.map((id) => {
              const esArm = armadores.has(id);
              const est = calcularEstadisticasJugador(id, acciones, esArm);
              if (est.totalAcciones === 0) return null;

              const abierto = expandidos.has(id);

              return (
                <React.Fragment key={id}>
                  <tr
                    className="hover:bg-white/[0.03] transition-colors"
                    style={{ borderBottom: borderSuave }}
                  >
                    <td className="py-2.5 px-3 font-bold text-white">
                      {nombreDe(id)}
                      {esArm && (
                        <span
                          className="ml-2 text-[10px] px-2 py-0.5 rounded-full font-medium"
                          style={{
                            background: "rgba(124,58,237,0.2)",
                            color: "#C4B5FD",
                            border: "1px solid rgba(124,58,237,0.4)",
                          }}
                        >
                          Armador
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-200 font-mono tabular-nums">
                      {est.totalAcciones}
                    </td>
                    <td
                      className="py-2.5 px-3 text-right font-mono tabular-nums font-bold"
                      style={{ color: "#34D399" }}
                    >
                      {est.totalPuntos}
                    </td>
                    <td
                      className="py-2.5 px-3 text-right font-mono tabular-nums font-bold"
                      style={{ color: "#F87171" }}
                    >
                      {est.totalErrores}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right tabular-nums font-black ${
                        est.saldoTotal > 0
                          ? "text-emerald-400"
                          : est.saldoTotal < 0
                          ? "text-rose-400"
                          : "text-slate-400"
                      }`}
                    >
                      {est.saldoTotal > 0 ? "+" : ""}
                      {est.saldoTotal}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right tabular-nums font-semibold ${
                        est.saldoDefensivo > 0
                          ? "text-emerald-400"
                          : est.saldoDefensivo < 0
                          ? "text-rose-400"
                          : "text-slate-400"
                      }`}
                    >
                      {est.saldoDefensivo > 0 ? "+" : ""}
                      {est.saldoDefensivo}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right tabular-nums font-semibold ${
                        est.valoracionMediaNormalizada > 0
                          ? "text-emerald-400"
                          : est.valoracionMediaNormalizada < 0
                          ? "text-rose-400"
                          : "text-slate-400"
                      }`}
                    >
                      {est.valoracionMediaNormalizada > 0 ? "+" : ""}
                      {est.valoracionMediaNormalizada.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => toggleExpandido(id)}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition border ${
                          abierto
                            ? "bg-emerald-500 text-white border-emerald-500"
                            : "bg-white/5 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/10"
                        }`}
                        data-pdf-acordeon
                        data-pdf-cerrado={abierto ? undefined : "true"}
                      >
                        {abierto ? "Ocultar" : "Ver detalle"}
                      </button>
                    </td>
                  </tr>

                  {abierto && (
                    <tr
                      style={{
                        background: "rgba(255,255,255,0.02)",
                        borderBottom: borderSuave,
                      }}
                    >
                      <td colSpan={8} className="p-4">
                        <DetalleJugador
                          jugadorId={id}
                          nombre={nombreDe(id)}
                          esArmador={esArm}
                          acciones={acciones}
                          jugadoresIds={jugadoresIds}
                          statsEquipoTotales={statsEquipoTotales}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DetalleJugador({
  jugadorId,
  nombre,
  esArmador,
  acciones,
  jugadoresIds,
  statsEquipoTotales,
}: {
  jugadorId: string;
  nombre: string;
  esArmador: boolean;
  acciones: AccionDB[];
  jugadoresIds: string[];
  statsEquipoTotales: ReturnType<typeof calcularEstadisticasJugador>;
}) {
  const [setFiltro, setSetFiltro] = useState<SetFiltro>("todos");
  const [valoresAbiertos, setValoresAbiertos] = useState<Set<string>>(
    new Set()
  );

  const toggleValoraciones = (fund: string) => {
    setValoresAbiertos((prev) => {
      const copia = new Set(prev);
      if (copia.has(fund)) copia.delete(fund);
      else copia.add(fund);
      return copia;
    });
  };

  const accionesEquipoFiltradas =
    setFiltro === "todos"
      ? acciones
      : acciones.filter((a) => a.set_numero === setFiltro);

  const maxPorFund = calcularMaxAccionesPorFundamento(
    accionesEquipoFiltradas,
    jugadoresIds
  );
  let maxAccionesEquipo = 1;
  for (const jid of jugadoresIds) {
    const total = accionesEquipoFiltradas
      .filter((a) => a.jugador_id === jid)
      .reduce((s, a) => s + a.cantidad, 0);
    if (total > maxAccionesEquipo) maxAccionesEquipo = total;
  }

  const est = calcularEstadisticasJugador(
    jugadorId,
    accionesEquipoFiltradas,
    esArmador,
    maxPorFund,
    maxAccionesEquipo,
    3
  );

  const fundamentos = esArmador ? FUNDAMENTOS_ARMADOR : FUNDAMENTOS_NORMAL;

  const promediosSaque = calcularPromedioPonderadoPorSet(
    jugadorId,
    acciones,
    jugadoresIds,
    "saque",
    VALORES_SAQUE
  );
  const promediosRecepcion = calcularPromedioPonderadoPorSet(
    jugadorId,
    acciones,
    jugadoresIds,
    "recepcion",
    VALORES_RECEPCION
  );
  const promediosBloqueo = calcularPromedioPonderadoPorSet(
    jugadorId,
    acciones,
    jugadoresIds,
    "bloqueo",
    VALORES_BLOQUEO
  );
  const promediosArmados = calcularPromedioArmadosPonderadoPorSet(
    jugadorId,
    acciones,
    jugadoresIds
  );

  const accionesJugadorFiltradas =
    setFiltro === "todos"
      ? acciones.filter((a) => a.jugador_id === jugadorId)
      : acciones.filter(
          (a) => a.jugador_id === jugadorId && a.set_numero === setFiltro
        );

  const valoracionesDe = (
    fund: string
  ): { key: string; cantidad: number }[] => {
    const valores = accionesJugadorFiltradas.filter(
      (a) => a.fundamento === fund
    );
    const mapa: Record<string, number> = {};
    for (const a of valores) {
      mapa[a.valoracion] = (mapa[a.valoracion] ?? 0) + a.cantidad;
    }
    return Object.entries(mapa).map(([key, cantidad]) => ({ key, cantidad }));
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap" data-pdf-ignorar>
        <span
          className="text-xs uppercase tracking-wider font-semibold self-center mr-2"
          style={{ color: "var(--sx-text-secondary)" }}
        >
          Ver:
        </span>
        {(["todos", 1, 2, 3, 4, 5] as const).map((s) => (
          <button
            key={String(s)}
            onClick={() => setSetFiltro(s)}
            className={`px-3 py-1 text-xs font-medium rounded-lg transition border ${
              setFiltro === s
                ? "bg-emerald-500 text-white border-emerald-500"
                : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white"
            }`}
          >
            {s === "todos" ? "Todos" : `Set ${s}`}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div
          className="p-3 rounded-xl text-center"
          style={cardBase}
        >
          <p
            className="text-[10px] uppercase tracking-wider font-semibold"
            style={{ color: "var(--sx-text-secondary)" }}
          >
            Saldo
          </p>
          <p
            className={`text-xl font-black tabular-nums ${
              est.saldoTotal > 0
                ? "text-emerald-400"
                : est.saldoTotal < 0
                ? "text-rose-400"
                : "text-slate-300"
            }`}
          >
            {est.saldoTotal > 0 ? "+" : ""}
            {est.saldoTotal}
          </p>
        </div>
        <div
          className="p-3 rounded-xl text-center"
          style={cardBase}
        >
          <p
            className="text-[10px] uppercase tracking-wider font-semibold"
            style={{ color: "var(--sx-text-secondary)" }}
          >
            Saldo Defensivo
          </p>
          <p
            className={`text-xl font-black tabular-nums ${
              est.saldoDefensivo > 0
                ? "text-emerald-400"
                : est.saldoDefensivo < 0
                ? "text-rose-400"
                : "text-slate-300"
            }`}
          >
            {est.saldoDefensivo > 0 ? "+" : ""}
            {est.saldoDefensivo}
          </p>
        </div>
        <div
          className="p-3 rounded-xl text-center"
          style={cardBase}
        >
          <p
            className="text-[10px] uppercase tracking-wider font-semibold"
            style={{ color: "var(--sx-text-secondary)" }}
          >
            Valoración Media
          </p>
          <p
            className={`text-xl font-black tabular-nums ${
              est.valoracionMediaNormalizada > 0
                ? "text-emerald-400"
                : est.valoracionMediaNormalizada < 0
                ? "text-rose-400"
                : "text-slate-300"
            }`}
          >
            {est.valoracionMediaNormalizada > 0 ? "+" : ""}
            {est.valoracionMediaNormalizada.toFixed(2)}
          </p>
        </div>

        <div
          className="p-3 rounded-xl text-center"
          style={cardBase}
        >
          <p
            className="text-[10px] uppercase tracking-wider font-semibold"
            style={{ color: "var(--sx-text-secondary)" }}
          >
            Acciones
          </p>
          <p className="text-xl font-black text-white tabular-nums">
            {est.totalAcciones}
          </p>
        </div>
        <div
          className="p-3 rounded-xl text-center"
          style={{
            background: "rgba(16,185,129,0.1)",
            border: "1px solid rgba(16,185,129,0.3)",
          }}
        >
          <p
            className="text-[10px] uppercase tracking-wider font-semibold"
            style={{ color: "#34D399" }}
          >
            Puntos
          </p>
          <p className="text-xl font-black text-emerald-400 tabular-nums">
            {est.totalPuntos}
          </p>
        </div>
        <div
          className="p-3 rounded-xl text-center"
          style={{
            background: "rgba(229,62,77,0.1)",
            border: "1px solid rgba(229,62,77,0.3)",
          }}
        >
          <p
            className="text-[10px] uppercase tracking-wider font-semibold"
            style={{ color: "#F87171" }}
          >
            Errores
          </p>
          <p className="text-xl font-black text-rose-400 tabular-nums">
            {est.totalErrores}
          </p>
        </div>
      </div>

      <div
        className="overflow-x-auto rounded-lg"
        style={{
          background: "var(--sx-surface-1)",
          border: "1px solid var(--sx-border)",
        }}
      >
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr
              className="text-left text-[11px] font-bold uppercase tracking-wider"
              style={{
                background: "rgba(255,255,255,0.04)",
                color: "var(--sx-text-secondary)",
                borderBottom: "1px solid var(--sx-border)",
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
              <th className="py-2.5 px-3 text-right">Val.Pond</th>
              <th className="py-2.5 px-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {fundamentos.map((f) => {
              const e: EstadisticasFundamento | undefined =
                est.porFundamento[f];
              if (!e || e.total === 0) return null;
              const abierto = valoresAbiertos.has(f);
              const detalle = valoracionesDe(f);
              const valPond = est.valoracionPonderadaPorFundamento[f] ?? 0;

              return (
                <React.Fragment key={f}>
                  <tr
                    className="hover:bg-white/[0.03] transition-colors"
                    style={{ borderBottom: borderSuave }}
                  >
                    <td className="py-2.5 px-3 font-bold text-white">
                      {NOMBRES_F[f]}
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
                      className={`py-2.5 px-3 text-right tabular-nums font-black ${
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
                    <td
                      className={`py-2.5 px-3 text-right tabular-nums font-black ${
                        valPond > 0
                          ? "text-emerald-400"
                          : valPond < 0
                          ? "text-rose-400"
                          : "text-slate-400"
                      }`}
                    >
                      {valPond > 0 ? "+" : ""}
                      {valPond.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => toggleValoraciones(f)}
                        className={`px-2 py-1 text-[10px] font-semibold rounded transition border ${
                          abierto
                            ? "bg-slate-500 text-white border-slate-500"
                            : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"
                        }`}
                        data-pdf-acordeon
                        data-pdf-cerrado={abierto ? undefined : "true"}
                      >
                        {abierto ? "Ocultar" : "Valoraciones"}
                      </button>
                    </td>
                  </tr>
                  {abierto && (
                    <tr
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        borderBottom: borderSuave,
                      }}
                    >
                      <td colSpan={9} className="p-3">
                        <div className="flex gap-2 flex-wrap">
                          {detalle.length === 0 ? (
                            <p
                              className="text-xs"
                              style={{ color: "var(--sx-text-muted)" }}
                            >
                              Sin datos
                            </p>
                          ) : (
                            detalle.map((v) => (
                              <div
                                key={v.key}
                                className="px-3 py-1.5 rounded-lg text-xs"
                                style={{
                                  background: "rgba(255,255,255,0.04)",
                                  border: "1px solid var(--sx-border-bright)",
                                }}
                              >
                                <span
                                  style={{ color: "var(--sx-text-secondary)" }}
                                >
                                  {ETIQUETAS_VALORACION[v.key] ?? v.key}:
                                </span>{" "}
                                <span className="font-bold text-white">
                                  {v.cantidad}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div
        className="rounded-xl p-4"
        style={cardBase}
      >
        <h5 className="font-semibold text-white mb-3 text-sm">
          Radar en este partido
        </h5>
        <RadarJugador
          jugador={est}
          todosJugadores={[est]}
          esArmador={esArmador}
        />
      </div>

      {!esArmador && (
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-xl" style={cardBase}>
            <GraficoSaquePorSet promedios={promediosSaque} />
          </div>
          <div className="p-3 rounded-xl" style={cardBase}>
            <GraficoRecepcionPorSet promedios={promediosRecepcion} />
          </div>
          <div className="p-3 rounded-xl" style={cardBase}>
            <GraficoBloqueoPorSet promedios={promediosBloqueo} />
          </div>
        </div>
      )}

      {esArmador && (
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-xl" style={cardBase}>
            <GraficoSaquePorSet promedios={promediosSaque} />
          </div>
          <div className="p-3 rounded-xl" style={cardBase}>
            <GraficoBloqueoPorSet promedios={promediosBloqueo} />
          </div>
          <div className="p-3 rounded-xl" style={cardBase}>
            <GraficoArmadosPorSet promedios={promediosArmados} />
          </div>
          {est.armador && (
            <div className="col-span-3 p-3 rounded-xl" style={cardBase}>
              <MapaCalorTendencia
                distribucion={est.armador.distribucionTendencia}
                acciones={accionesJugadorFiltradas}
                jugadorId={jugadorId}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}