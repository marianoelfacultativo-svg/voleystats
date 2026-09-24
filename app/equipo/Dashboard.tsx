"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  calcularEstadisticasEquipo,
  rankingRecepcion,
  rankingAtaque,
  rankingBloqueo,
  rankingSaque,
  rankingDefensa,
  rankingConsistencia,
  type AccionDB,
  type RankingCompletoItem,
} from "@/lib/estadisticas";

interface Partido {
  id: string;
  rival: string;
  fecha: string;
  set1: string | null;
  set2: string | null;
  set3: string | null;
  set4: string | null;
  set5: string | null;
}

interface Jugador {
  id: string;
  nombre: string;
  numero: number | null;
  rol: string;
}

interface Props {
  equipoId: string;
  nombreEquipo: string;
}

const FUNDAMENTOS = ["saque", "recepcion", "ataque", "bloqueo", "defensa"];
const NOMBRES: Record<string, string> = {
  saque: "Saque",
  recepcion: "Recepción",
  ataque: "Ataque",
  bloqueo: "Bloqueo",
  defensa: "Defensa",
};

type RankingTipo =
  | "recepcion"
  | "ataque"
  | "bloqueo"
  | "saque"
  | "defensa"
  | "consistencia";

const RANKINGS: { id: RankingTipo; titulo: string; icono: string }[] = [
  { id: "recepcion", titulo: "Recepción", icono: "🙌" },
  { id: "ataque", titulo: "Ataque", icono: "⚡" },
  { id: "bloqueo", titulo: "Bloqueo", icono: "🧱" },
  { id: "saque", titulo: "Saque", icono: "🎯" },
  { id: "defensa", titulo: "Defensa", icono: "🛡️" },
  { id: "consistencia", titulo: "Consistencia", icono: "📈" },
];

export default function Dashboard({ equipoId, nombreEquipo }: Props) {
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [acciones, setAcciones] = useState<AccionDB[]>([]);
  const [cargando, setCargando] = useState(true);
  const [rankingAbierto, setRankingAbierto] = useState<RankingTipo | null>(
    null
  );

  useEffect(() => {
    if (!equipoId) return;
    setCargando(true);

    Promise.all([
      supabase
        .from("partidos")
        .select("id, rival, fecha, set1, set2, set3, set4, set5")
        .eq("equipo_id", equipoId)
        .order("fecha", { ascending: false }),
      supabase
        .from("jugadores")
        .select("id, nombre, numero, rol")
        .order("nombre"),
    ]).then(async ([partRes, jugRes]) => {
      if (!partRes.data || !jugRes.data) {
        setCargando(false);
        return;
      }
      setPartidos(partRes.data);
      setJugadores(jugRes.data);

      const ids = partRes.data.map((p) => p.id);
      if (ids.length === 0) {
        setAcciones([]);
        setCargando(false);
        return;
      }

      const { data: accData } = await supabase
        .from("acciones")
        .select(
          "jugador_id, partido_id, set_numero, fundamento, valoracion, cantidad"
        )
        .in("partido_id", ids);

      setAcciones((accData ?? []) as AccionDB[]);
      setCargando(false);
    });
  }, [equipoId]);

  if (cargando) {
    return <p className="text-slate-500 text-center py-12">Cargando...</p>;
  }

  const ultimoPartido = partidos[0];

  const jugadoresDelEquipo = jugadores.filter((j) =>
    acciones.some((a) => a.jugador_id === j.id)
  );

  const armadores = new Set(
    jugadoresDelEquipo.filter((j) => j.rol === "armador").map((j) => j.id)
  );

  const statsUltimo = ultimoPartido
    ? calcularEstadisticasEquipo(
        jugadoresDelEquipo.map((j) => j.id),
        acciones.filter((a) => a.partido_id === ultimoPartido.id),
        armadores
      )
    : null;

  const { porJugador, totales } =
    jugadoresDelEquipo.length > 0
      ? calcularEstadisticasEquipo(
          jugadoresDelEquipo.map((j) => j.id),
          acciones,
          armadores
        )
      : { porJugador: {}, totales: null };

  const nombreDe = (id: string) => {
    const j = jugadores.find((x) => x.id === id);
    return j
      ? j.nombre + (j.numero !== null ? ` #${j.numero}` : "")
      : "?";
  };

  const esArmadorId = (id: string) => armadores.has(id);

  const scoreDe = (p: Partido) => {
    const sets = [p.set1, p.set2, p.set3, p.set4, p.set5].filter(Boolean);
    return sets.length > 0 ? sets.join(" · ") : "Sin score cargado";
  };

  const rankings: Record<RankingTipo, RankingCompletoItem[]> = {
    recepcion: rankingRecepcion(porJugador, acciones),
    ataque: rankingAtaque(porJugador, acciones),
    bloqueo: rankingBloqueo(porJugador, acciones),
    saque: rankingSaque(porJugador, acciones),
    defensa: rankingDefensa(porJugador, acciones),
    consistencia: rankingConsistencia(porJugador, acciones),
  };

  if (partidos.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
        <p className="text-5xl mb-4">📊</p>
        <p className="text-slate-600 font-medium">
          Todavía no hay partidos cargados para {nombreEquipo}
        </p>
        <p className="text-slate-500 text-sm mt-1">
          Pedile al analista que cargue el primer partido
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {ultimoPartido && statsUltimo && (
        <div>
          <h2 className="text-xl font-semibold text-slate-900 mb-3">
            Último partido
          </h2>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-lg font-semibold text-slate-800">
                  🏐 {nombreEquipo} vs {ultimoPartido.rival}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  📅 {ultimoPartido.fecha}
                </p>
                <p className="text-sm text-slate-600 mt-1">
                  {scoreDe(ultimoPartido)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                <p className="text-xs text-slate-500 uppercase">Acciones</p>
                <p className="text-2xl font-bold text-slate-800">
                  {statsUltimo.totales.totalAcciones}
                </p>
              </div>
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                <p className="text-xs text-green-700 uppercase">Puntos</p>
                <p className="text-2xl font-bold text-green-800">
                  {statsUltimo.totales.totalPuntos}
                </p>
              </div>
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-center">
                <p className="text-xs text-red-700 uppercase">Errores</p>
                <p className="text-2xl font-bold text-red-800">
                  {statsUltimo.totales.totalErrores}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {totales && (
        <div>
          <h2 className="text-xl font-semibold text-slate-900 mb-3">
            Totales acumulados
          </h2>
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="text-xs text-slate-500 uppercase">Partidos</p>
              <p className="text-2xl font-bold text-slate-800">
                {partidos.length}
              </p>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="text-xs text-slate-500 uppercase">Acciones</p>
              <p className="text-2xl font-bold text-slate-800">
                {totales.totalAcciones}
              </p>
            </div>
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-xs text-green-700 uppercase">Puntos</p>
              <p className="text-2xl font-bold text-green-800">
                {totales.totalPuntos}
              </p>
            </div>
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs text-red-700 uppercase">Errores</p>
              <p className="text-2xl font-bold text-red-800">
                {totales.totalErrores}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 px-3">Fundamento</th>
                  <th className="py-2 px-3 text-right">Total</th>
                  <th className="py-2 px-3 text-right">Pos</th>
                  <th className="py-2 px-3 text-right">Neg</th>
                  <th className="py-2 px-3 text-right">Puntos</th>
                  <th className="py-2 px-3 text-right">Errores</th>
                  <th className="py-2 px-3 text-right">Saldo</th>
                  <th className="py-2 px-3 text-right">Efect.</th>
                </tr>
              </thead>
              <tbody>
                {FUNDAMENTOS.map((f) => {
                  const e = totales.porFundamento[f];
                  if (!e || e.total === 0) return null;
                  return (
                    <tr key={f} className="border-b border-slate-100">
                      <td className="py-2 px-3 font-medium text-slate-700">
                        {NOMBRES[f]}
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
                      <td className="py-2 px-3 text-right text-slate-600">
                        {e.efectividad.toFixed(0)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-3">
          🏆 Rankings del plantel
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Clic en cualquier ranking para ver la tabla completa
        </p>
        <div className="grid grid-cols-2 gap-3">
          {RANKINGS.map((r) => {
            const items = rankings[r.id];
            const abierto = rankingAbierto === r.id;
            const top1 = items[0];

            return (
              <div
                key={r.id}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
              >
                <button
                  onClick={() => setRankingAbierto(abierto ? null : r.id)}
                  className="w-full text-left p-4 hover:bg-slate-50 transition"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{r.icono}</span>
                      <p className="font-semibold text-slate-800">
                        {r.titulo}
                      </p>
                    </div>
                    <span
                      className={`text-slate-400 transition-transform ${
                        abierto ? "rotate-180" : ""
                      }`}
                    >
                      ▼
                    </span>
                  </div>
                  {top1 ? (
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {nombreDe(top1.jugador_id)}
                        {esArmadorId(top1.jugador_id) && (
                          <span className="ml-1 text-[10px] text-violet-600 font-medium">
                            (Armador)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {top1.texto}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">Sin datos</p>
                  )}
                </button>

                {abierto && items.length > 0 && (
                  <div className="border-t border-slate-200 bg-slate-50 p-3">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-slate-500 text-xs">
                          <th className="py-1.5 px-2 w-8">#</th>
                          <th className="py-1.5 px-2">Jugador</th>
                          <th className="py-1.5 px-2 text-right">Detalle</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((it, i) => (
                          <tr
                            key={it.jugador_id}
                            className="border-t border-slate-200"
                          >
                            <td className="py-1.5 px-2">
                              <span
                                className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                                  i === 0
                                    ? "bg-yellow-400 text-yellow-900"
                                    : i === 1
                                    ? "bg-slate-300 text-slate-800"
                                    : i === 2
                                    ? "bg-amber-700 text-amber-100"
                                    : "bg-slate-100 text-slate-500"
                                }`}
                              >
                                {i + 1}
                              </span>
                            </td>
                            <td className="py-1.5 px-2 font-medium text-slate-700">
                              {nombreDe(it.jugador_id)}
                              {esArmadorId(it.jugador_id) && (
                                <span className="ml-1 text-[10px] text-violet-600 font-medium">
                                  (Armador)
                                </span>
                              )}
                            </td>
                            <td className="py-1.5 px-2 text-right text-xs text-slate-600">
                              {it.texto}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}