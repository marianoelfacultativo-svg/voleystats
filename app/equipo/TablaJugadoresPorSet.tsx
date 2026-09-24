"use client";

import { useState } from "react";
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

export default function TablaJugadoresPorSet({
  jugadoresIds,
  nombresJugadores,
  acciones,
  armadores,
  statsEquipoTotales,
}: Props) {
  const [expandido, setExpandido] = useState<string | null>(null);

  const nombreDe = (id: string) => nombresJugadores[id] ?? "?";

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-5 border-b border-slate-200">
        <h4 className="font-semibold text-slate-800">
          Estadísticas por jugador
        </h4>
        <p className="text-xs text-slate-500 mt-1">
          Click en "Ver detalle" para ver el análisis completo del jugador en
          este partido
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-slate-500">
              <th className="py-2 px-3">Jugador</th>
              <th className="py-2 px-3 text-right">Acc</th>
              <th className="py-2 px-3 text-right">Pts</th>
              <th className="py-2 px-3 text-right">Err</th>
              <th className="py-2 px-3 text-right">Saldo</th>
              <th className="py-2 px-3 text-right">S.Def</th>
              <th className="py-2 px-3 text-right">Val.Med</th>
              <th className="py-2 px-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {jugadoresIds.map((id) => {
              const esArm = armadores.has(id);
              const est = calcularEstadisticasJugador(id, acciones, esArm);
              if (est.totalAcciones === 0) return null;

              const abierto = expandido === id;

              return (
                <>
                  <tr
                    key={id}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="py-2 px-3 font-medium text-slate-700">
                      {nombreDe(id)}
                      {esArm && (
                        <span className="ml-2 text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
                          Armador
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-600">
                      {est.totalAcciones}
                    </td>
                    <td className="py-2 px-3 text-right text-green-700">
                      {est.totalPuntos}
                    </td>
                    <td className="py-2 px-3 text-right text-red-700">
                      {est.totalErrores}
                    </td>
                    <td
                      className={`py-2 px-3 text-right font-semibold ${
                        est.saldoTotal > 0
                          ? "text-green-700"
                          : est.saldoTotal < 0
                          ? "text-red-700"
                          : "text-slate-600"
                      }`}
                    >
                      {est.saldoTotal > 0 ? "+" : ""}
                      {est.saldoTotal}
                    </td>
                    <td
                      className={`py-2 px-3 text-right font-semibold ${
                        est.saldoDefensivo > 0
                          ? "text-green-700"
                          : est.saldoDefensivo < 0
                          ? "text-red-700"
                          : "text-slate-600"
                      }`}
                    >
                      {est.saldoDefensivo > 0 ? "+" : ""}
                      {est.saldoDefensivo}
                    </td>
                    <td
                      className={`py-2 px-3 text-right font-semibold ${
                        est.valoracionMediaNormalizada > 0
                          ? "text-green-700"
                          : est.valoracionMediaNormalizada < 0
                          ? "text-red-700"
                          : "text-slate-600"
                      }`}
                    >
                      {est.valoracionMediaNormalizada > 0 ? "+" : ""}
                      {est.valoracionMediaNormalizada.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button
                        onClick={() => setExpandido(abierto ? null : id)}
                        className="px-3 py-1 text-xs bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg transition"
                      >
                        {abierto ? "Ocultar" : "Ver detalle"}
                      </button>
                    </td>
                  </tr>

                  {abierto && (
                    <tr key={`${id}-detalle`} className="bg-slate-50">
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
                </>
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

  // Acciones del equipo filtradas por set (si aplica) → para calcular máximos correctos
  const accionesEquipoFiltradas =
    setFiltro === "todos"
      ? acciones
      : acciones.filter((a) => a.set_numero === setFiltro);

  // Calcular máximos de referencia
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

  // Stats del jugador con contexto de volumen
  const est = calcularEstadisticasJugador(
    jugadorId,
    accionesEquipoFiltradas,
    esArmador,
    maxPorFund,
    maxAccionesEquipo
  );

  const fundamentos = esArmador ? FUNDAMENTOS_ARMADOR : FUNDAMENTOS_NORMAL;

  // Gráficos por set (siempre muestran todos los sets)
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
      <div className="flex gap-2 flex-wrap">
        <span className="text-sm text-slate-600 self-center mr-2">Ver:</span>
        {(["todos", 1, 2, 3, 4, 5] as const).map((s) => (
          <button
            key={String(s)}
            onClick={() => setSetFiltro(s)}
            className={`px-3 py-1 text-xs font-medium rounded-lg transition border ${
              setFiltro === s
                ? "bg-emerald-500 text-white border-emerald-500"
                : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
            }`}
          >
            {s === "todos" ? "Todos" : `Set ${s}`}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 bg-white border border-slate-200 rounded-lg text-center">
          <p className="text-xs text-slate-500 uppercase">Saldo</p>
          <p
            className={`text-xl font-bold ${
              est.saldoTotal > 0
                ? "text-green-700"
                : est.saldoTotal < 0
                ? "text-red-700"
                : "text-slate-700"
            }`}
          >
            {est.saldoTotal > 0 ? "+" : ""}
            {est.saldoTotal}
          </p>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-lg text-center">
          <p className="text-xs text-slate-500 uppercase">Saldo Defensivo</p>
          <p
            className={`text-xl font-bold ${
              est.saldoDefensivo > 0
                ? "text-green-700"
                : est.saldoDefensivo < 0
                ? "text-red-700"
                : "text-slate-700"
            }`}
          >
            {est.saldoDefensivo > 0 ? "+" : ""}
            {est.saldoDefensivo}
          </p>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-lg text-center">
          <p className="text-xs text-slate-500 uppercase">Valoración Media</p>
          <p
            className={`text-xl font-bold ${
              est.valoracionMediaNormalizada > 0
                ? "text-green-700"
                : est.valoracionMediaNormalizada < 0
                ? "text-red-700"
                : "text-slate-700"
            }`}
          >
            {est.valoracionMediaNormalizada > 0 ? "+" : ""}
            {est.valoracionMediaNormalizada.toFixed(2)}
          </p>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded-lg text-center">
          <p className="text-xs text-slate-500 uppercase">Acciones</p>
          <p className="text-xl font-bold text-slate-800">
            {est.totalAcciones}
          </p>
        </div>
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
          <p className="text-xs text-green-700 uppercase">Puntos</p>
          <p className="text-xl font-bold text-green-800">
            {est.totalPuntos}
          </p>
        </div>
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-center">
          <p className="text-xs text-red-700 uppercase">Errores</p>
          <p className="text-xl font-bold text-red-800">
            {est.totalErrores}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100">
            <tr className="text-left text-slate-500">
              <th className="py-2 px-3">Fundamento</th>
              <th className="py-2 px-3 text-right">Total</th>
              <th className="py-2 px-3 text-right">Pos</th>
              <th className="py-2 px-3 text-right">Neg</th>
              <th className="py-2 px-3 text-right">Puntos</th>
              <th className="py-2 px-3 text-right">Errores</th>
              <th className="py-2 px-3 text-right">Saldo</th>
              <th className="py-2 px-3 text-right">Val.Pond</th>
              <th className="py-2 px-3 text-right"></th>
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
                <>
                  <tr key={f} className="border-b border-slate-100">
                    <td className="py-2 px-3 font-medium text-slate-700">
                      {NOMBRES_F[f]}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-600">
                      {e.total}
                    </td>
                    <td className="py-2 px-3 text-right text-green-700">
                      {e.positivos}
                    </td>
                    <td className="py-2 px-3 text-right text-red-700">
                      {e.negativos}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-600">
                      {e.puntos}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-600">
                      {e.errores}
                    </td>
                    <td
                      className={`py-2 px-3 text-right font-semibold ${
                        e.saldo > 0
                          ? "text-green-700"
                          : e.saldo < 0
                          ? "text-red-700"
                          : "text-slate-600"
                      }`}
                    >
                      {e.saldo > 0 ? "+" : ""}
                      {e.saldo}
                    </td>
                    <td
                      className={`py-2 px-3 text-right font-semibold ${
                        valPond > 0
                          ? "text-green-700"
                          : valPond < 0
                          ? "text-red-700"
                          : "text-slate-600"
                      }`}
                    >
                      {valPond > 0 ? "+" : ""}
                      {valPond.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button
                        onClick={() => toggleValoraciones(f)}
                        className="px-2 py-1 text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-700 rounded transition"
                      >
                        {abierto ? "Ocultar" : "Valoraciones"}
                      </button>
                    </td>
                  </tr>
                  {abierto && (
                    <tr key={`${f}-valoraciones`} className="bg-slate-100">
                      <td colSpan={9} className="p-3">
                        <div className="flex gap-2 flex-wrap">
                          {detalle.length === 0 ? (
                            <p className="text-xs text-slate-500">
                              Sin datos
                            </p>
                          ) : (
                            detalle.map((v) => (
                              <div
                                key={v.key}
                                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                              >
                                <span className="text-slate-500">
                                  {ETIQUETAS_VALORACION[v.key] ?? v.key}:
                                </span>{" "}
                                <span className="font-semibold text-slate-800">
                                  {v.cantidad}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <h5 className="font-semibold text-slate-800 mb-3 text-sm">
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
          <div className="p-3 bg-white border border-slate-200 rounded-lg">
            <GraficoSaquePorSet promedios={promediosSaque} />
          </div>
          <div className="p-3 bg-white border border-slate-200 rounded-lg">
            <GraficoRecepcionPorSet promedios={promediosRecepcion} />
          </div>
          <div className="p-3 bg-white border border-slate-200 rounded-lg">
            <GraficoBloqueoPorSet promedios={promediosBloqueo} />
          </div>
        </div>
      )}

      {esArmador && (
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 bg-white border border-slate-200 rounded-lg">
            <GraficoSaquePorSet promedios={promediosSaque} />
          </div>
          <div className="p-3 bg-white border border-slate-200 rounded-lg">
            <GraficoBloqueoPorSet promedios={promediosBloqueo} />
          </div>
          <div className="p-3 bg-white border border-slate-200 rounded-lg">
            <GraficoArmadosPorSet promedios={promediosArmados} />
          </div>
          {est.armador && (
            <div className="col-span-3 p-3 bg-white border border-slate-200 rounded-lg">
              <MapaCalorTendencia
                distribucion={est.armador.distribucionTendencia}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}