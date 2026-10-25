"use client";

import { useMemo, useState } from "react";
import {
  VALORES_POR_FUNDAMENTO,
  calcularEstadisticasEquipo,
  type AccionDB,
} from "@/lib/estadisticas";

interface ColumnaValoracion {
  key: string;
  label: string;
  tipo: "pos" | "neg" | "neu";
}

const COLUMNAS: Record<string, ColumnaValoracion[]> = {
  saque: [
    { key: "ace", label: "Ace", tipo: "pos" },
    { key: "positivo_mas", label: "Pos+", tipo: "pos" },
    { key: "positivo", label: "Pos", tipo: "pos" },
    { key: "neutro", label: "Neu", tipo: "neu" },
    { key: "negativo", label: "Neg", tipo: "neg" },
  ],
  recepcion: [
    { key: "2x_positiva", label: "2x+", tipo: "pos" },
    { key: "positiva", label: "Pos", tipo: "pos" },
    { key: "negativa", label: "Neg", tipo: "neg" },
    { key: "2x_negativa", label: "2x-", tipo: "neg" },
    { key: "3x_negativa", label: "3x-", tipo: "neg" },
    { key: "ace_contra", label: "AceC", tipo: "neg" },
  ],
  ataque: [
    { key: "punto", label: "Punto", tipo: "pos" },
    { key: "neutro", label: "Neu", tipo: "neu" },
    { key: "error", label: "Error", tipo: "neg" },
  ],
  bloqueo: [
    { key: "punto", label: "Punto", tipo: "pos" },
    { key: "positivo_mas", label: "Pos+", tipo: "pos" },
    { key: "positivo", label: "Pos", tipo: "pos" },
    { key: "use_rival", label: "UseR", tipo: "neg" },
    { key: "red", label: "Red", tipo: "neg" },
    { key: "filtrada", label: "Filt", tipo: "neg" },
  ],
  defensa: [
    { key: "toque_positiva", label: "Toq+", tipo: "pos" },
    { key: "gran_def", label: "GranD", tipo: "pos" },
    { key: "cobertura_positiva", label: "Cob+", tipo: "pos" },
    { key: "toque_negativa", label: "Toq-", tipo: "neg" },
    { key: "cobertura_negativa", label: "Cob-", tipo: "neg" },
    { key: "error_def", label: "ErrD", tipo: "neg" },
    { key: "errores_graves", label: "ErrG", tipo: "neg" },
    { key: "mala_libre", label: "MalaL", tipo: "neg" },
  ],
  armados: [
    { key: "perfecto", label: "Perf", tipo: "pos" },
    { key: "correcto", label: "Corr", tipo: "pos" },
    { key: "flojo", label: "Flojo", tipo: "neu" },
    { key: "malo", label: "Malo", tipo: "neg" },
    { key: "horrible", label: "Horr", tipo: "neg" },
  ],
  toque: [
    { key: "punto", label: "Punto", tipo: "pos" },
    { key: "neutro", label: "Neu", tipo: "neu" },
    { key: "error", label: "Error", tipo: "neg" },
  ],
};

const NOMBRES_FUNDAMENTO: Record<string, string> = {
  saque: "Saque",
  recepcion: "Recepción",
  ataque: "Ataque",
  bloqueo: "Bloqueo",
  defensa: "Defensa",
  armados: "Armados",
  toque: "Toque",
};

const ORDEN_FUNDAMENTOS = [
  "saque",
  "recepcion",
  "ataque",
  "bloqueo",
  "defensa",
  "armados",
  "toque",
];

const selectCls =
  "w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-emerald-500";
const labelCls =
  "block text-[10px] font-semibold text-slate-500 uppercase mb-1 tracking-wide";

interface Props {
  acciones: AccionDB[];
  jugadoresIds: string[];
  nombresJugadores: Record<string, string>;
  armadores?: Set<string>;
  soloJugadorId?: string;
}

function colorTipo(tipo: "pos" | "neg" | "neu"): string {
  if (tipo === "pos") return "text-green-700";
  if (tipo === "neg") return "text-red-700";
  return "text-slate-500";
}

export default function TablaEstadisticasCrudas({
  acciones,
  jugadoresIds,
  nombresJugadores,
  armadores,
  soloJugadorId,
}: Props) {
  const [filtroJugador, setFiltroJugador] = useState<string>("todos");
  const [filtroFundamento, setFiltroFundamento] = useState<string>("todos");

  const armadoresSet = armadores ?? new Set<string>();
  const jugadoresAMostrar = soloJugadorId ? [soloJugadorId] : jugadoresIds;
  const jugadorEfectivo = soloJugadorId ? soloJugadorId : filtroJugador;

  const nombreDe = (id: string) => nombresJugadores[id] ?? id;
  const esArmadorId = (id: string) => armadoresSet.has(id);

  // Acciones para la tabla de detalle (TODOS los filtros aplicados)
  const accionesDetalle = useMemo(() => {
    return acciones.filter((a) => {
      if (
        jugadorEfectivo !== "todos" &&
        a.jugador_id !== jugadorEfectivo
      )
        return false;
      if (
        filtroFundamento !== "todos" &&
        a.fundamento !== filtroFundamento
      )
        return false;
      return true;
    });
  }, [acciones, jugadorEfectivo, filtroFundamento]);

  // Acciones para el resumen del equipo (sin filtro de jugador)
  const accionesResumen = useMemo(() => {
    return acciones.filter((a) => {
      if (
        filtroFundamento !== "todos" &&
        a.fundamento !== filtroFundamento
      )
        return false;
      return true;
    });
  }, [acciones, filtroFundamento]);

  const totales = useMemo(() => {
    if (jugadoresAMostrar.length === 0) return null;
    return calcularEstadisticasEquipo(
      jugadoresAMostrar,
      accionesResumen,
      armadoresSet
    ).totales;
  }, [jugadoresAMostrar, accionesResumen, armadoresSet]);

  const fundamentosConDatos = ORDEN_FUNDAMENTOS.filter((f) =>
    accionesDetalle.some(
      (a) => a.fundamento === f && jugadoresAMostrar.includes(a.jugador_id)
    )
  );

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-semibold text-slate-800 mb-1">
          📋 Estadísticas crudas
        </h4>
        <p className="text-xs text-slate-500">
          Cantidad exacta de cada valoración por jugador y promedio crudo
          (sin ponderar). Usá los filtros para acotar.
        </p>
      </div>

      {/* ---------- FILTROS ---------- */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
        <div className="grid grid-cols-2 gap-2">
          {!soloJugadorId && (
            <div>
              <label className={labelCls}>Jugador</label>
              <select
                value={filtroJugador}
                onChange={(e) => setFiltroJugador(e.target.value)}
                className={selectCls}
              >
                <option value="todos">Todos</option>
                {jugadoresIds.map((id) => (
                  <option key={id} value={id}>
                    {nombreDe(id)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className={labelCls}>Fundamento</label>
            <select
              value={filtroFundamento}
              onChange={(e) => setFiltroFundamento(e.target.value)}
              className={selectCls}
            >
              <option value="todos">Todos</option>
              {ORDEN_FUNDAMENTOS.map((f) => (
                <option key={f} value={f}>
                  {NOMBRES_FUNDAMENTO[f]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-[10px] text-slate-400 mt-2">
          {accionesDetalle.length} acción
          {accionesDetalle.length !== 1 ? "es" : ""} con los filtros
          actuales
        </p>
      </div>

      {/* ---------- RESUMEN DEL EQUIPO ---------- */}
      {totales && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <h5 className="font-semibold text-slate-800 mb-3 text-sm">
            Resumen del equipo (sin filtro de jugador)
          </h5>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500 text-xs">
                  <th className="py-2 px-2">Fundamento</th>
                  <th className="py-2 px-2 text-right">Total</th>
                  <th className="py-2 px-2 text-right">Pos</th>
                  <th className="py-2 px-2 text-right">Neg</th>
                  <th className="py-2 px-2 text-right">Puntos</th>
                  <th className="py-2 px-2 text-right">Errores</th>
                  <th className="py-2 px-2 text-right">Saldo</th>
                  <th className="py-2 px-2 text-right">Efect.</th>
                </tr>
              </thead>
              <tbody>
                {ORDEN_FUNDAMENTOS.map((f) => {
                  const e = totales.porFundamento[f];
                  if (!e || e.total === 0) return null;
                  return (
                    <tr key={f} className="border-b border-slate-100">
                      <td className="py-2 px-2 font-medium text-slate-700">
                        {NOMBRES_FUNDAMENTO[f]}
                      </td>
                      <td className="py-2 px-2 text-right text-slate-600">
                        {e.total}
                      </td>
                      <td className="py-2 px-2 text-right text-green-700">
                        {e.positivos}
                      </td>
                      <td className="py-2 px-2 text-right text-red-700">
                        {e.negativos}
                      </td>
                      <td className="py-2 px-2 text-right text-slate-600">
                        {e.puntos}
                      </td>
                      <td className="py-2 px-2 text-right text-slate-600">
                        {e.errores}
                      </td>
                      <td
                        className={`py-2 px-2 text-right font-semibold ${
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
                      <td className="py-2 px-2 text-right text-slate-600">
                        {e.efectividad.toFixed(0)}%
                      </td>
                    </tr>
                  );
                })}
                {ORDEN_FUNDAMENTOS.every(
                  (f) =>
                    !totales.porFundamento[f] ||
                    totales.porFundamento[f].total === 0
                ) && (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-3 text-center text-xs text-slate-400"
                    >
                      No hay acciones con los filtros actuales.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------- DETALLE POR FUNDAMENTO ---------- */}
      {fundamentosConDatos.length === 0 ? (
        <div className="p-6 text-center text-sm text-slate-500">
          No hay acciones para mostrar
        </div>
      ) : (
        <div className="space-y-4">
          {fundamentosConDatos.map((fund) => {
            const cols = COLUMNAS[fund];
            if (!cols) return null;
            const valores = VALORES_POR_FUNDAMENTO[fund] ?? {};

            const porJugador: Record<string, Record<string, number>> = {};
            for (const jid of jugadoresAMostrar) {
              const fila: Record<string, number> = {};
              for (const c of cols) fila[c.key] = 0;
              porJugador[jid] = fila;
            }
            const totalesFund: Record<string, number> = {};
            for (const c of cols) totalesFund[c.key] = 0;

            for (const a of accionesDetalle) {
              if (a.fundamento !== fund) continue;
              if (!jugadoresAMostrar.includes(a.jugador_id)) continue;
              const col = cols.find((c) => c.key === a.valoracion);
              if (!col) continue;
              porJugador[a.jugador_id][col.key] += a.cantidad;
              totalesFund[col.key] += a.cantidad;
            }

            const jugadoresConDatos = jugadoresAMostrar.filter((jid) =>
              cols.some((c) => porJugador[jid][c.key] > 0)
            );

            if (jugadoresConDatos.length === 0) return null;

            const calcularTotal = (fila: Record<string, number>) =>
              cols.reduce((s, c) => s + fila[c.key], 0);

            const calcularPromedioCrudo = (fila: Record<string, number>) => {
              const total = calcularTotal(fila);
              if (total === 0) return 0;
              let suma = 0;
              for (const c of cols) {
                const v = valores[c.key] ?? 0;
                suma += v * fila[c.key];
              }
              return suma / total;
            };

            const totalTodas = calcularTotal(totalesFund);
            const promTotal = calcularPromedioCrudo(totalesFund);

            return (
              <div
                key={fund}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
              >
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <h5 className="font-semibold text-slate-800">
                    {NOMBRES_FUNDAMENTO[fund] ?? fund}
                  </h5>
                  <span className="text-xs text-slate-500">
                    {totalTodas} acción{totalTodas !== 1 ? "es" : ""}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500 border-b border-slate-200">
                        <th className="py-2 px-3">Jugador</th>
                        {cols.map((c) => (
                          <th
                            key={c.key}
                            className={`py-2 px-2 text-center ${colorTipo(
                              c.tipo
                            )}`}
                          >
                            {c.label}
                          </th>
                        ))}
                        <th className="py-2 px-3 text-right">Total</th>
                        <th className="py-2 px-3 text-right">Prom. crudo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jugadoresConDatos.map((jid) => {
                        const fila = porJugador[jid];
                        const total = calcularTotal(fila);
                        const prom = calcularPromedioCrudo(fila);
                        return (
                          <tr key={jid} className="border-b border-slate-100">
                            <td className="py-2 px-3 font-medium text-slate-700">
                              {nombreDe(jid)}
                              {esArmadorId(jid) && (
                                <span className="ml-1 text-[10px] text-violet-600 font-medium">
                                  (Arm)
                                </span>
                              )}
                            </td>
                            {cols.map((c) => {
                              const val = fila[c.key];
                              return (
                                <td
                                  key={c.key}
                                  className={`py-2 px-2 text-center font-mono ${
                                    val === 0
                                      ? "text-slate-300"
                                      : colorTipo(c.tipo)
                                  }`}
                                >
                                  {val}
                                </td>
                              );
                            })}
                            <td className="py-2 px-3 text-right font-semibold text-slate-700">
                              {total}
                            </td>
                            <td
                              className={`py-2 px-3 text-right font-semibold ${
                                prom > 0
                                  ? "text-green-700"
                                  : prom < 0
                                  ? "text-red-700"
                                  : "text-slate-500"
                              }`}
                            >
                              {prom > 0 ? "+" : ""}
                              {prom.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                      {jugadoresConDatos.length > 1 && (
                        <tr className="bg-slate-50 font-semibold border-t-2 border-slate-300">
                          <td className="py-2 px-3 text-slate-700">TOTAL</td>
                          {cols.map((c) => (
                            <td
                              key={c.key}
                              className={`py-2 px-2 text-center font-mono ${colorTipo(
                                c.tipo
                              )}`}
                            >
                              {totalesFund[c.key]}
                            </td>
                          ))}
                          <td className="py-2 px-3 text-right text-slate-700">
                            {totalTodas}
                          </td>
                          <td
                            className={`py-2 px-3 text-right ${
                              promTotal > 0
                                ? "text-green-700"
                                : promTotal < 0
                                ? "text-red-700"
                                : "text-slate-500"
                            }`}
                          >
                            {promTotal > 0 ? "+" : ""}
                            {promTotal.toFixed(2)}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}