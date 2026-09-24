"use client";

import { useState } from "react";
import {
  calcularEstadisticasJugador,
  type AccionDB,
} from "@/lib/estadisticas";

interface Props {
  jugadoresIds: string[];
  nombresJugadores: Record<string, string>;
  acciones: AccionDB[];
  armadores: Set<string>;
}

export default function TablaJugadoresPorSet({
  jugadoresIds,
  nombresJugadores,
  acciones,
  armadores,
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
          Click en "Ver por set" para ver el detalle de cada set
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-slate-500">
              <th className="py-2 px-3">Jugador</th>
              <th className="py-2 px-3 text-right">Acciones</th>
              <th className="py-2 px-3 text-right">Puntos</th>
              <th className="py-2 px-3 text-right">Errores</th>
              <th className="py-2 px-3 text-right">Saldo</th>
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
                    <td className="py-2 px-3 text-right">
                      <button
                        onClick={() => setExpandido(abierto ? null : id)}
                        className="px-3 py-1 text-xs bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg transition"
                      >
                        {abierto ? "Ocultar" : "Ver por set"}
                      </button>
                    </td>
                  </tr>

                  {abierto && (
                    <tr key={`${id}-detalle`} className="bg-slate-50">
                      <td colSpan={6} className="p-3">
                        <div className="grid grid-cols-5 gap-2">
                          {[1, 2, 3, 4, 5].map((s) => {
                            const delSet = acciones.filter(
                              (a) =>
                                a.jugador_id === id && a.set_numero === s
                            );
                            const estSet = calcularEstadisticasJugador(
                              id,
                              delSet,
                              esArm
                            );
                            return (
                              <div
                                key={s}
                                className="p-3 bg-white border border-slate-200 rounded-lg text-center"
                              >
                                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">
                                  Set {s}
                                </p>
                                {estSet.totalAcciones === 0 ? (
                                  <p className="text-xs text-slate-400">
                                    Sin datos
                                  </p>
                                ) : (
                                  <>
                                    <p className="text-xs text-slate-500">
                                      {estSet.totalAcciones} acc.
                                    </p>
                                    <p className="text-xs text-green-700">
                                      {estSet.totalPuntos} pts
                                    </p>
                                    <p className="text-xs text-red-700">
                                      {estSet.totalErrores} err
                                    </p>
                                    <p
                                      className={`text-sm font-bold mt-1 ${
                                        estSet.saldoTotal > 0
                                          ? "text-green-700"
                                          : estSet.saldoTotal < 0
                                          ? "text-red-700"
                                          : "text-slate-700"
                                      }`}
                                    >
                                      {estSet.saldoTotal > 0 ? "+" : ""}
                                      {estSet.saldoTotal}
                                    </p>
                                  </>
                                )}
                              </div>
                            );
                          })}
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
    </div>
  );
}