"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { obtenerSesion, cerrarSesion, type Sesion } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  calcularEstadisticasJugador,
  calcularEstadisticasEquipo,
  calcularPromedioPorSet,
  VALORES_SAQUE,
  VALORES_BLOQUEO,
  type AccionDB,
  type EstadisticasJugador,
} from "@/lib/estadisticas";
import RadarJugador from "../equipo/RadarJugador";
import GraficoArmadosPorSet from "../equipo/GraficoArmadosPorSet";
import GraficoRecepcionPorSet from "../equipo/GraficoRecepcionPorSet";
import GraficoSaquePorSet from "../equipo/GraficoSaquePorSet";
import GraficoBloqueoPorSet from "../equipo/GraficoBloqueoPorSet";
import MapaCalorTendencia from "../equipo/MapaCalorTendencia";
import ImagenAmpliable from "../equipo/ImagenAmpliable";

interface Jugador {
  id: string;
  nombre: string;
  numero: number | null;
  imagen_url: string | null;
  rol: string;
}

interface JugadorEquipo {
  id: string;
  jugador_id: string;
  equipo_id: string;
}

interface Partido {
  id: string;
  rival: string;
  fecha: string;
}

type Vista = "general" | "por-partido";

const NOMBRES_FUNDAMENTO: Record<string, string> = {
  saque: "Saque",
  recepcion: "Recepción",
  ataque: "Ataque",
  bloqueo: "Bloqueo",
  defensa: "Defensa",
  armados: "Armados",
  toque: "Toque",
};

export default function JugadorPage() {
  const router = useRouter();
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [jugador, setJugador] = useState<Jugador | null>(null);
  const [nombreEquipo, setNombreEquipo] = useState("");
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [acciones, setAcciones] = useState<AccionDB[]>([]);
  const [statsEquipo, setStatsEquipo] = useState<EstadisticasJugador | null>(
    null
  );
  const [cargando, setCargando] = useState(true);

  const [vista, setVista] = useState<Vista>("general");
  const [partidoSeleccionado, setPartidoSeleccionado] = useState<string>("");

  useEffect(() => {
    const s = obtenerSesion();
    if (!s || s.tipo !== "jugador") {
      router.push("/");
      return;
    }
    setSesion(s);
  }, [router]);

  useEffect(() => {
    if (!sesion) return;
    if (!sesion.jugador_id) {
      setCargando(false);
      return;
    }
    setCargando(true);

    const jugadorId = sesion.jugador_id;

    supabase
      .from("jugadores")
      .select("*")
      .eq("id", jugadorId)
      .maybeSingle()
      .then(({ data: jugData }) => {
        if (!jugData) {
          setCargando(false);
          return;
        }
        setJugador(jugData);

        supabase
          .from("jugador_equipo")
          .select("*")
          .eq("jugador_id", jugadorId)
          .eq("activo", true)
          .maybeSingle()
          .then(async ({ data: asigData }) => {
            if (!asigData) {
              setCargando(false);
              return;
            }
            const asig = asigData as JugadorEquipo;

            supabase
              .from("equipos")
              .select("nombre")
              .eq("id", asig.equipo_id)
              .maybeSingle()
              .then(({ data: eqData }) => {
                if (eqData) setNombreEquipo(eqData.nombre);
              });

            const { data: partRes } = await supabase
              .from("partidos")
              .select("id, rival, fecha")
              .eq("equipo_id", asig.equipo_id)
              .order("fecha", { ascending: false });

            if (!partRes || partRes.length === 0) {
              setCargando(false);
              return;
            }

            setPartidos(partRes);
            const idsPartidos = partRes.map((p) => p.id);

            const { data: accData } = await supabase
              .from("acciones")
              .select(
                "jugador_id, partido_id, set_numero, fundamento, valoracion, cantidad"
              )
              .in("partido_id", idsPartidos);

            const { data: jugRes } = await supabase
              .from("jugador_equipo")
              .select("jugador_id")
              .eq("equipo_id", asig.equipo_id)
              .eq("activo", true);

            const idsJugadoresEquipo = (jugRes ?? []).map(
              (j: { jugador_id: string }) => j.jugador_id
            );

            const { data: jugDataAll } = await supabase
              .from("jugadores")
              .select("id, rol")
              .in("id", idsJugadoresEquipo);

            const armadores = new Set(
              ((jugDataAll ?? []) as { id: string; rol: string }[])
                .filter((j) => j.rol === "armador")
                .map((j) => j.id)
            );

            const acc = (accData ?? []) as AccionDB[];
            setAcciones(acc);

            const { totales } = calcularEstadisticasEquipo(
              idsJugadoresEquipo,
              acc,
              armadores
            );
            setStatsEquipo(totales);

            setCargando(false);
          });
      });
  }, [sesion]);

  const handleCerrar = () => {
    cerrarSesion();
    router.push("/");
  };

  if (!sesion) return null;

  const partidoActivo =
    vista === "general"
      ? null
      : partidoSeleccionado || partidos[0]?.id || null;

  const accionesFiltradas = partidoActivo
    ? acciones.filter((a) => a.partido_id === partidoActivo)
    : acciones;

  const stats: EstadisticasJugador | null = jugador
    ? calcularEstadisticasJugador(
        jugador.id,
        accionesFiltradas,
        jugador.rol === "armador"
      )
    : null;

  const esArmador = jugador?.rol === "armador";
  const partidoActual = partidos.find((p) => p.id === partidoActivo);

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              🏐 Mi Perfil
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {jugador
                ? `Bienvenido ${jugador.nombre}`
                : "Cargando perfil..."}
            </p>
          </div>
          <button
            onClick={handleCerrar}
            className="px-4 py-2 text-sm bg-slate-200 hover:bg-slate-300 rounded-lg transition"
          >
            Cerrar sesión
          </button>
        </div>

        {cargando && (
          <p className="text-slate-500 text-center py-12">Cargando...</p>
        )}

        {!cargando && !jugador && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
            <p className="text-4xl mb-3">👤</p>
            <p className="text-slate-600 font-medium">
              No encontramos tu perfil
            </p>
          </div>
        )}

        {!cargando && jugador && stats && (
          <>
            <div className="flex gap-2 mb-4 border-b border-slate-200">
              <button
                onClick={() => setVista("general")}
                className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
                  vista === "general"
                    ? "border-emerald-500 text-emerald-600"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                📊 General
              </button>
              <button
                onClick={() => setVista("por-partido")}
                className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
                  vista === "por-partido"
                    ? "border-emerald-500 text-emerald-600"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                📅 Por partido
              </button>
            </div>

            {vista === "por-partido" && partidos.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Elegí un partido:
                </label>
                <div className="flex gap-2 flex-wrap">
                  {partidos.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPartidoSeleccionado(p.id)}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition border ${
                        partidoActivo === p.id
                          ? "bg-emerald-500 text-white border-emerald-500"
                          : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      vs {p.rival} · {p.fecha}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-200">
                <ImagenAmpliable
                  src={jugador.imagen_url}
                  alt={jugador.nombre}
                  inicial={jugador.nombre.charAt(0).toUpperCase()}
                  tamaño="lg"
                />
                <div className="flex-1">
                  <h2 className="text-3xl font-bold text-slate-900">
                    {jugador.nombre}
                  </h2>
                  {jugador.numero !== null && (
                    <p className="text-slate-500 text-lg">
                      #{jugador.numero}
                    </p>
                  )}
                  {nombreEquipo && (
                    <p className="text-sm text-slate-500 mt-1">
                      {nombreEquipo}
                    </p>
                  )}
                  {esArmador && (
                    <span className="inline-block mt-2 text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
                      Armador
                    </span>
                  )}
                  {vista === "por-partido" && partidoActual && (
                    <p className="text-xs text-emerald-600 mt-2 font-medium">
                      📅 {partidoActual.rival} · {partidoActual.fecha}
                    </p>
                  )}
                </div>
              </div>

              <div className="mb-6">
                <h3 className="font-semibold text-slate-800 mb-3">
                  Perfil de rendimiento
                </h3>
                <RadarJugador
                  jugador={stats}
                  todosJugadores={[stats]}
                  esArmador={esArmador}
                />
              </div>

              {Object.keys(stats.valoracionPromedioNormalizado).length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold text-slate-800 mb-3">
                    Valoración normalizada por fundamento
                  </h3>
                  <div className="grid grid-cols-5 gap-2">
                    {Object.entries(stats.valoracionPromedioNormalizado).map(
                      ([fund, val]) => (
                        <div
                          key={fund}
                          className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center"
                        >
                          <p className="text-xs text-slate-500">
                            {NOMBRES_FUNDAMENTO[fund] ?? fund}
                          </p>
                          <p
                            className={`text-lg font-bold ${
                              val > 0
                                ? "text-green-700"
                                : val < 0
                                ? "text-red-700"
                                : "text-slate-700"
                            }`}
                          >
                            {val > 0 ? "+" : ""}
                            {val.toFixed(1)}
                          </p>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {esArmador && stats.armador && (
                <div className="mb-6 grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <GraficoSaquePorSet
                      promedios={calcularPromedioPorSet(
                        jugador.id,
                        accionesFiltradas,
                        "saque",
                        VALORES_SAQUE
                      )}
                    />
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <GraficoBloqueoPorSet
                      promedios={calcularPromedioPorSet(
                        jugador.id,
                        accionesFiltradas,
                        "bloqueo",
                        VALORES_BLOQUEO
                      )}
                    />
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <GraficoArmadosPorSet
                      promedios={stats.armador.promediosArmados}
                    />
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <MapaCalorTendencia
                      distribucion={stats.armador.distribucionTendencia}
                    />
                  </div>
                </div>
              )}

              {!esArmador && (
                <div className="mb-6 grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <GraficoSaquePorSet
                      promedios={calcularPromedioPorSet(
                        jugador.id,
                        accionesFiltradas,
                        "saque",
                        VALORES_SAQUE
                      )}
                    />
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <GraficoRecepcionPorSet
                      promedios={stats.recepcion?.promediosPorSet ?? []}
                    />
                  </div>
                  <div className="col-span-2 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <GraficoBloqueoPorSet
                      promedios={calcularPromedioPorSet(
                        jugador.id,
                        accionesFiltradas,
                        "bloqueo",
                        VALORES_BLOQUEO
                      )}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                  <p className="text-xs text-slate-500 uppercase">Saldo</p>
                  <p
                    className={`text-2xl font-bold ${
                      stats.saldoTotal > 0
                        ? "text-green-700"
                        : stats.saldoTotal < 0
                        ? "text-red-700"
                        : "text-slate-700"
                    }`}
                  >
                    {stats.saldoTotal > 0 ? "+" : ""}
                    {stats.saldoTotal}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                  <p className="text-xs text-slate-500 uppercase">
                    Saldo Defensivo
                  </p>
                  <p
                    className={`text-2xl font-bold ${
                      stats.saldoDefensivo > 0
                        ? "text-green-700"
                        : stats.saldoDefensivo < 0
                        ? "text-red-700"
                        : "text-slate-700"
                    }`}
                  >
                    {stats.saldoDefensivo > 0 ? "+" : ""}
                    {stats.saldoDefensivo}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                  <p className="text-xs text-slate-500 uppercase">
                    Valoración Media
                  </p>
                  <p
                    className={`text-2xl font-bold ${
                      stats.valoracionMediaNormalizada > 0
                        ? "text-green-700"
                        : stats.valoracionMediaNormalizada < 0
                        ? "text-red-700"
                        : "text-slate-700"
                    }`}
                  >
                    {stats.valoracionMediaNormalizada > 0 ? "+" : ""}
                    {stats.valoracionMediaNormalizada.toFixed(1)}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                  <p className="text-xs text-slate-500 uppercase">Acciones</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {stats.totalAcciones}
                  </p>
                </div>
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                  <p className="text-xs text-green-700 uppercase">Puntos</p>
                  <p className="text-2xl font-bold text-green-800">
                    {stats.totalPuntos}
                  </p>
                </div>
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-center">
                  <p className="text-xs text-red-700 uppercase">Errores</p>
                  <p className="text-2xl font-bold text-red-800">
                    {stats.totalErrores}
                  </p>
                </div>
              </div>

              {vista === "por-partido" && stats.totalAcciones === 0 && (
                <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-center">
                  <p className="text-sm text-amber-800">
                    Este jugador no tiene acciones cargadas en ese partido
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}