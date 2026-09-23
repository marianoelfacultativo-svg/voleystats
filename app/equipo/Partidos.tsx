"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  calcularEstadisticasEquipo,
  top3,
  type AccionDB,
  type PromedioRecepcionSet,
} from "@/lib/estadisticas";
import GraficoRecepcionEquipoPorSet from "./GraficoRecepcionEquipoPorSet";
import GraficoTortaRival from "./GraficoTortaRival";

interface Partido {
  id: string;
  rival: string;
  fecha: string;
  set1: string | null;
  set2: string | null;
  set3: string | null;
  set4: string | null;
  set5: string | null;
  errores_rivales: number | null;
  buenas_rivales: number | null;
  notas: string | null;
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

const VALORES_RECEPCION: Record<string, number> = {
  "2x_positiva": 5,
  positiva: 4,
  negativa: 3,
  "2x_negativa": 2,
  "3x_negativa": 1,
  ace_contra: 0,
};

export default function Partidos({ equipoId, nombreEquipo }: Props) {
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [acciones, setAcciones] = useState<AccionDB[]>([]);
  const [cargando, setCargando] = useState(true);

  const [filtroRival, setFiltroRival] = useState("");
  const [filtroFechaDesde, setFiltroFechaDesde] = useState("");
  const [filtroFechaHasta, setFiltroFechaHasta] = useState("");
  const [filtroSet, setFiltroSet] = useState<
    "todos" | "1" | "2" | "3" | "4" | "5"
  >("todos");

  const [partidoSeleccionado, setPartidoSeleccionado] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (!equipoId) return;
    setCargando(true);

    Promise.all([
      supabase
        .from("partidos")
        .select("*")
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

  const limpiarFiltros = () => {
    setFiltroRival("");
    setFiltroFechaDesde("");
    setFiltroFechaHasta("");
    setFiltroSet("todos");
  };

  const nombreDe = (id: string) => {
    const j = jugadores.find((x) => x.id === id);
    return j ? j.nombre + (j.numero !== null ? ` #${j.numero}` : "") : "?";
  };

  if (cargando) {
    return <p className="text-slate-500 text-center py-12">Cargando...</p>;
  }

  if (partidos.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
        <p className="text-4xl mb-3">📅</p>
        <p className="text-slate-600 font-medium">
          {nombreEquipo} todavía no tiene partidos cargados
        </p>
      </div>
    );
  }

  const partidosFiltrados = partidos.filter((p) => {
    if (filtroRival && p.rival !== filtroRival) return false;
    if (filtroFechaDesde && p.fecha < filtroFechaDesde) return false;
    if (filtroFechaHasta && p.fecha > filtroFechaHasta) return false;
    return true;
  });

  const rivalesUnicos = Array.from(new Set(partidos.map((p) => p.rival))).sort();
  const hayFiltrosActivos =
    filtroRival !== "" || filtroFechaDesde !== "" || filtroFechaHasta !== "";

  const scoreDe = (p: Partido) => {
    const sets = [p.set1, p.set2, p.set3, p.set4, p.set5].filter(Boolean);
    return sets.length > 0 ? sets.join(" · ") : "Sin score";
  };

  const partidoDetalle = partidoSeleccionado
    ? partidos.find((p) => p.id === partidoSeleccionado)
    : null;

  const accionesDelPartido = partidoDetalle
    ? acciones.filter((a) => {
        if (a.partido_id !== partidoDetalle.id) return false;
        if (filtroSet !== "todos" && String(a.set_numero) !== filtroSet)
          return false;
        return true;
      })
    : [];

  const idsJugadores = jugadores.map((j) => j.id);
  const armadores = new Set(
    jugadores.filter((j) => j.rol === "armador").map((j) => j.id)
  );
  const statsPartido = partidoDetalle
    ? calcularEstadisticasEquipo(idsJugadores, accionesDelPartido, armadores)
    : null;

  const esArmadorId = (id: string) => armadores.has(id);

  const promediosRecepcionEquipo: PromedioRecepcionSet[] = [1, 2, 3, 4, 5].map(
    (s) => {
      const delSet = accionesDelPartido.filter(
        (a) =>
          a.fundamento === "recepcion" &&
          a.set_numero === s &&
          !armadores.has(a.jugador_id)
      );
      let suma = 0;
      let total = 0;
      for (const a of delSet) {
        const v = VALORES_RECEPCION[a.valoracion] ?? 0;
        suma += v * a.cantidad;
        total += a.cantidad;
      }
      return {
        set: s,
        promedio: total > 0 ? suma / total : 0,
        totalRecepciones: total,
      };
    }
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Rival
            </label>
            <select
              value={filtroRival}
              onChange={(e) => setFiltroRival(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
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
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Desde
            </label>
            <input
              type="date"
              value={filtroFechaDesde}
              onChange={(e) => setFiltroFechaDesde(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Hasta
            </label>
            <input
              type="date"
              value={filtroFechaHasta}
              onChange={(e) => setFiltroFechaHasta(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Set (solo en detalle)
            </label>
            <select
              value={filtroSet}
              onChange={(e) =>
                setFiltroSet(
                  e.target.value as "todos" | "1" | "2" | "3" | "4" | "5"
                )
              }
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
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
        {hayFiltrosActivos && (
          <div className="mt-2 text-right">
            <button
              onClick={limpiarFiltros}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-1">
          <h3 className="font-semibold text-slate-800 mb-3">
            {partidosFiltrados.length} partido
            {partidosFiltrados.length !== 1 ? "s" : ""}
          </h3>

          {partidosFiltrados.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-center">
              <p className="text-sm text-slate-500">
                Ningún partido cumple los filtros
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {partidosFiltrados.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPartidoSeleccionado(p.id)}
                  className={`w-full text-left p-3 rounded-lg border transition ${
                    partidoSeleccionado === p.id
                      ? "bg-blue-500 border-blue-500 text-white"
                      : "bg-white border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <p
                    className={`font-medium text-sm ${
                      partidoSeleccionado === p.id
                        ? "text-white"
                        : "text-slate-800"
                    }`}
                  >
                    vs {p.rival}
                  </p>
                  <p
                    className={`text-xs mt-1 ${
                      partidoSeleccionado === p.id
                        ? "text-blue-100"
                        : "text-slate-500"
                    }`}
                  >
                    📅 {p.fecha}
                  </p>
                  <p
                    className={`text-xs mt-1 ${
                      partidoSeleccionado === p.id
                        ? "text-blue-100"
                        : "text-slate-500"
                    }`}
                  >
                    {scoreDe(p)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="col-span-2">
          {!partidoDetalle || !statsPartido ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center h-full flex items-center justify-center">
              <div>
                <p className="text-4xl mb-3">👈</p>
                <p className="text-slate-600 font-medium">
                  Elegí un partido para ver el detalle
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">
                      {nombreEquipo} vs {partidoDetalle.rival}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                      📅 {partidoDetalle.fecha}
                    </p>
                    <p className="text-sm text-slate-600 mt-1">
                      {scoreDe(partidoDetalle)}
                    </p>
                    {filtroSet !== "todos" && (
                      <p className="text-xs text-amber-700 mt-2 bg-amber-50 border border-amber-200 rounded px-2 py-1 inline-block">
                        Filtrando solo Set {filtroSet}
                      </p>
                    )}
                  </div>
                </div>
                {partidoDetalle.notas && (
                  <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-200 italic">
                    "{partidoDetalle.notas}"
                  </p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-center">
                  <p className="text-xs text-slate-500 uppercase">Acciones</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {statsPartido.totales.totalAcciones}
                  </p>
                </div>
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                  <p className="text-xs text-green-700 uppercase">Puntos</p>
                  <p className="text-2xl font-bold text-green-800">
                    {statsPartido.totales.totalPuntos}
                  </p>
                </div>
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-center">
                  <p className="text-xs text-red-700 uppercase">Errores</p>
                  <p className="text-2xl font-bold text-red-800">
                    {statsPartido.totales.totalErrores}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                  <GraficoRecepcionEquipoPorSet
                    promedios={promediosRecepcionEquipo}
                  />
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                  <GraficoTortaRival
                    erroresRivales={partidoDetalle.errores_rivales ?? 0}
                    buenasRivales={partidoDetalle.buenas_rivales ?? 0}
                  />
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 overflow-x-auto">
                <h4 className="font-semibold text-slate-800 mb-3">
                  Por fundamento
                </h4>
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
                    </tr>
                  </thead>
                  <tbody>
                    {FUNDAMENTOS.map((f) => {
                      const e = statsPartido.totales.porFundamento[f];
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
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <RankingCard
                  titulo="Más puntos"
                  items={top3(statsPartido.porJugador, (e) => e.totalPuntos)}
                  nombreDe={nombreDe}
                  esArmadorId={esArmadorId}
                  color="green"
                />
                <RankingCard
                  titulo="Más acciones positivas"
                  items={top3(
                    statsPartido.porJugador,
                    (e) => e.totalPositivos
                  )}
                  nombreDe={nombreDe}
                  esArmadorId={esArmadorId}
                  color="blue"
                />
                <RankingCard
                  titulo="Mejor saldo"
                  items={top3(statsPartido.porJugador, (e) => e.saldoTotal)}
                  nombreDe={nombreDe}
                  esArmadorId={esArmadorId}
                  color="violet"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RankingCard({
  titulo,
  items,
  nombreDe,
  esArmadorId,
  color,
}: {
  titulo: string;
  items: { jugador_id: string; valor: number }[];
  nombreDe: (id: string) => string;
  esArmadorId: (id: string) => boolean;
  color: "green" | "blue" | "violet";
}) {
  const colores = {
    green: "bg-green-50 border-green-200",
    blue: "bg-blue-50 border-blue-200",
    violet: "bg-violet-50 border-violet-200",
  };
  return (
    <div className={`p-4 rounded-lg border ${colores[color]}`}>
      <p className="text-sm font-medium text-slate-700 mb-2">{titulo}</p>
      {items.length === 0 ? (
        <p className="text-xs text-slate-500">Sin datos</p>
      ) : (
        <ol className="space-y-1">
          {items.map((it, i) => (
            <li key={it.jugador_id} className="text-sm text-slate-800">
              <span className="font-bold text-slate-500 mr-2">{i + 1}.</span>
              {nombreDe(it.jugador_id)}
              {esArmadorId(it.jugador_id) && (
                <span className="ml-1 text-[10px] text-violet-600 font-medium">
                  (Armador)
                </span>
              )}
              <span className="text-slate-500 ml-2">({it.valor})</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}