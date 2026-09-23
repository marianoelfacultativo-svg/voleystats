"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { obtenerSesion, cerrarSesion, type Sesion } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  calcularEstadisticasEquipo,
  top3,
  type AccionDB,
} from "@/lib/estadisticas";

interface Equipo {
  id: string;
  nombre: string;
}

interface Jugador {
  id: string;
  nombre: string;
  numero: number | null;
}

interface Partido {
  id: string;
  equipo_id: string;
  rival: string;
  fecha: string;
}

const FUNDAMENTOS = ["saque", "recepcion", "ataque", "bloqueo", "defensa"];
const NOMBRES: Record<string, string> = {
  saque: "Saque",
  recepcion: "Recepción",
  ataque: "Ataque",
  bloqueo: "Bloqueo",
  defensa: "Defensa",
};

export default function EstadisticasPage() {
  const router = useRouter();
  const [sesion, setSesion] = useState<Sesion | null>(null);

  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [acciones, setAcciones] = useState<AccionDB[]>([]);

  const [equipoId, setEquipoId] = useState("");
  const [cargando, setCargando] = useState(false);

  // Filtros
  const [filtroRival, setFiltroRival] = useState("");
  const [filtroFechaDesde, setFiltroFechaDesde] = useState("");
  const [filtroFechaHasta, setFiltroFechaHasta] = useState("");
  const [filtroSet, setFiltroSet] = useState<
    "todos" | "1" | "2" | "3" | "4" | "5"
  >("todos");

  useEffect(() => {
    const s = obtenerSesion();
    if (!s || s.tipo !== "admin") {
      router.push("/");
      return;
    }
    setSesion(s);
  }, [router]);

  useEffect(() => {
    if (!sesion) return;
    supabase
      .from("equipos")
      .select("id, nombre")
      .order("nombre")
      .then(({ data }) => {
        if (data) setEquipos(data);
      });
  }, [sesion]);

  const limpiarFiltros = () => {
    setFiltroRival("");
    setFiltroFechaDesde("");
    setFiltroFechaHasta("");
    setFiltroSet("todos");
  };

  useEffect(() => {
    if (!equipoId) {
      setJugadores([]);
      setPartidos([]);
      setAcciones([]);
      setFiltroRival("");
      setFiltroFechaDesde("");
      setFiltroFechaHasta("");
      setFiltroSet("todos");
      return;
    }
    setCargando(true);
    setFiltroRival("");
    setFiltroFechaDesde("");
    setFiltroFechaHasta("");
    setFiltroSet("todos");

    Promise.all([
      supabase.from("jugadores").select("*").order("nombre"),
      supabase
        .from("partidos")
        .select("id, equipo_id, rival, fecha")
        .eq("equipo_id", equipoId)
        .order("fecha", { ascending: false }),
    ]).then(async ([jugRes, partRes]) => {
      if (!jugRes.data || !partRes.data) {
        setCargando(false);
        return;
      }
      setJugadores(jugRes.data);
      setPartidos(partRes.data);

      const idsPartidos = partRes.data.map((p) => p.id);
      if (idsPartidos.length === 0) {
        setAcciones([]);
        setCargando(false);
        return;
      }

      const { data: accData } = await supabase
        .from("acciones")
        .select(
          "jugador_id, partido_id, set_numero, fundamento, valoracion, cantidad"
        )
        .in("partido_id", idsPartidos);

      setAcciones((accData ?? []) as AccionDB[]);
      setCargando(false);
    });
  }, [equipoId]);

  const handleCerrar = () => {
    cerrarSesion();
    router.push("/");
  };

  if (!sesion) return null;

  // Rivales únicos para el dropdown
  const rivalesUnicos = Array.from(new Set(partidos.map((p) => p.rival))).sort();

  // Filtrar partidos según rival y fecha
  const partidosFiltrados = partidos.filter((p) => {
    if (filtroRival && p.rival !== filtroRival) return false;
    if (filtroFechaDesde && p.fecha < filtroFechaDesde) return false;
    if (filtroFechaHasta && p.fecha > filtroFechaHasta) return false;
    return true;
  });

  const idsPartidosFiltrados = new Set(partidosFiltrados.map((p) => p.id));

  // Filtrar acciones: por partido (rival/fecha) y por set
  const accionesFiltradas = acciones.filter((a) => {
    if (a.partido_id && !idsPartidosFiltrados.has(a.partido_id)) return false;
    if (filtroSet !== "todos" && String(a.set_numero) !== filtroSet)
      return false;
    return true;
  });

  // Calcular estadísticas con las acciones filtradas
  const jugadoresDelEquipo = jugadores.filter((j) =>
    accionesFiltradas.some((a) => a.jugador_id === j.id)
  );

  const { porJugador, totales } =
    jugadoresDelEquipo.length > 0
      ? calcularEstadisticasEquipo(
          jugadoresDelEquipo.map((j) => j.id),
          accionesFiltradas
        )
      : { porJugador: {}, totales: null };

  const nombreDe = (id: string) => {
    const j = jugadores.find((x) => x.id === id);
    return j ? j.nombre + (j.numero !== null ? ` #${j.numero}` : "") : "?";
  };

  const hayFiltrosActivos =
    filtroRival !== "" ||
    filtroFechaDesde !== "" ||
    filtroFechaHasta !== "" ||
    filtroSet !== "todos";

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <button
              onClick={() => router.push("/admin")}
              className="text-sm text-slate-500 hover:text-slate-700 mb-1"
            >
              ← Volver al panel
            </button>
            <h1 className="text-3xl font-bold text-slate-900">
              📊 Estadísticas acumuladas
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Todos los partidos del equipo sumados
            </p>
          </div>
          <button
            onClick={handleCerrar}
            className="px-4 py-2 text-sm bg-slate-200 hover:bg-slate-300 rounded-lg transition"
          >
            Cerrar sesión
          </button>
        </div>

        {/* Selector de equipo + filtros */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Equipo
              </label>
              <select
                value={equipoId}
                onChange={(e) => setEquipoId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
              >
                <option value="">Elegí un equipo</option>
                {equipos.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Set
              </label>
              <select
                value={filtroSet}
                onChange={(e) =>
                  setFiltroSet(
                    e.target.value as "todos" | "1" | "2" | "3" | "4" | "5"
                  )
                }
                disabled={!equipoId}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-slate-100"
              >
                <option value="todos">Todos los sets</option>
                <option value="1">Set 1</option>
                <option value="2">Set 2</option>
                <option value="3">Set 3</option>
                <option value="4">Set 4</option>
                <option value="5">Set 5</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Rival
              </label>
              <select
                value={filtroRival}
                onChange={(e) => setFiltroRival(e.target.value)}
                disabled={!equipoId}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-slate-100"
              >
                <option value="">Todos los rivales</option>
                {rivalesUnicos.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Desde
                </label>
                <input
                  type="date"
                  value={filtroFechaDesde}
                  onChange={(e) => setFiltroFechaDesde(e.target.value)}
                  disabled={!equipoId}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-slate-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Hasta
                </label>
                <input
                  type="date"
                  value={filtroFechaHasta}
                  onChange={(e) => setFiltroFechaHasta(e.target.value)}
                  disabled={!equipoId}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-slate-100"
                />
              </div>
            </div>
          </div>

          {equipoId && (
            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <p className="text-xs text-slate-500">
                {partidosFiltrados.length} de {partidos.length} partidos
                {" · "}
                {filtroSet === "todos"
                  ? "todos los sets"
                  : `solo set ${filtroSet}`}
              </p>
              {hayFiltrosActivos && (
                <button
                  onClick={limpiarFiltros}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          )}
        </div>

        {cargando && (
          <p className="text-slate-500 text-center py-12">Calculando...</p>
        )}

        {!cargando && !equipoId && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
            <p className="text-5xl mb-4">📊</p>
            <p className="text-slate-600 font-medium">
              Elegí un equipo para ver sus estadísticas
            </p>
          </div>
        )}

        {!cargando && equipoId && acciones.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
            <p className="text-5xl mb-4">📊</p>
            <p className="text-slate-600 font-medium">
              Este equipo todavía no tiene datos cargados
            </p>
            <p className="text-slate-500 text-sm mt-1">
              Andá a la Consola de Data Entry y guardá algún partido
            </p>
          </div>
        )}

        {!cargando &&
          equipoId &&
          acciones.length > 0 &&
          partidosFiltrados.length === 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
              <p className="text-5xl mb-4">🔍</p>
              <p className="text-slate-600 font-medium">
                Ningún partido cumple con los filtros
              </p>
              <button
                onClick={limpiarFiltros}
                className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Limpiar filtros
              </button>
            </div>
          )}

        {!cargando &&
          equipoId &&
          acciones.length > 0 &&
          partidosFiltrados.length > 0 &&
          totales && (
            <div className="space-y-8">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 mb-3">
                  Totales del equipo
                </h2>
                <div className="grid grid-cols-3 gap-3 mb-4">
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

              <div>
                <h2 className="text-xl font-semibold text-slate-900 mb-3">
                  🏆 Rankings del plantel
                </h2>
                <div className="grid grid-cols-3 gap-3">
                  <RankingCard
                    titulo="Más puntos"
                    items={top3(porJugador, (e) => e.totalPuntos)}
                    nombreDe={nombreDe}
                    color="green"
                  />
                  <RankingCard
                    titulo="Más acciones positivas"
                    items={top3(porJugador, (e) => e.totalPositivos)}
                    nombreDe={nombreDe}
                    color="blue"
                  />
                  <RankingCard
                    titulo="Mejor saldo"
                    items={top3(porJugador, (e) => e.saldoTotal)}
                    nombreDe={nombreDe}
                    color="violet"
                  />
                </div>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-slate-900 mb-3">
                  Ranking completo
                </h2>
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-slate-500">
                        <th className="py-2 px-3">Jugador</th>
                        <th className="py-2 px-3 text-right">Acciones</th>
                        <th className="py-2 px-3 text-right">Pos</th>
                        <th className="py-2 px-3 text-right">Neg</th>
                        <th className="py-2 px-3 text-right">Puntos</th>
                        <th className="py-2 px-3 text-right">Errores</th>
                        <th className="py-2 px-3 text-right">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.values(porJugador)
                        .filter((e) => e.totalAcciones > 0)
                        .sort((a, b) => b.saldoTotal - a.saldoTotal)
                        .map((e) => (
                          <tr
                            key={e.jugador_id}
                            className="border-b border-slate-100"
                          >
                            <td className="py-2 px-3 font-medium text-slate-700">
                              {nombreDe(e.jugador_id)}
                            </td>
                            <td className="py-2 px-3 text-right text-slate-600">
                              {e.totalAcciones}
                            </td>
                            <td className="py-2 px-3 text-right text-green-700">
                              {e.totalPositivos}
                            </td>
                            <td className="py-2 px-3 text-right text-red-700">
                              {e.totalNegativos}
                            </td>
                            <td className="py-2 px-3 text-right text-slate-600">
                              {e.totalPuntos}
                            </td>
                            <td className="py-2 px-3 text-right text-slate-600">
                              {e.totalErrores}
                            </td>
                            <td
                              className={`py-2 px-3 text-right font-semibold ${
                                e.saldoTotal > 0
                                  ? "text-green-700"
                                  : e.saldoTotal < 0
                                  ? "text-red-700"
                                  : "text-slate-600"
                              }`}
                            >
                              {e.saldoTotal > 0 ? "+" : ""}
                              {e.saldoTotal}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
      </div>
    </main>
  );
}

function RankingCard({
  titulo,
  items,
  nombreDe,
  color,
}: {
  titulo: string;
  items: { jugador_id: string; valor: number }[];
  nombreDe: (id: string) => string;
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
              <span className="text-slate-500 ml-2">({it.valor})</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}