"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { obtenerSesion, cerrarSesion, type Sesion } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  calcularEstadisticasJugador,
  calcularEstadisticasEquipo,
  calcularPodios,
  rankingDeJugador,
  calcularPromedioPonderadoPorSet,
  calcularPromedioArmadosPonderadoPorSet,
  calcularMaxAccionesPorFundamento,
  VALORES_SAQUE,
  VALORES_RECEPCION,
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
type ModoPartido = "individual" | "comparar";

const NOMBRES_FUNDAMENTO: Record<string, string> = {
  saque: "Saque",
  recepcion: "Recepción",
  ataque: "Ataque",
  bloqueo: "Bloqueo",
  defensa: "Defensa",
  armados: "Armados",
  toque: "Toque",
};

const ORDEN_RANKINGS: {
  id: string;
  titulo: string;
  icono: string;
}[] = [
  { id: "recepcion", titulo: "Recepción", icono: "🙌" },
  { id: "ataque", titulo: "Ataque", icono: "⚡" },
  { id: "bloqueo", titulo: "Bloqueo", icono: "🧱" },
  { id: "saque", titulo: "Saque", icono: "🎯" },
  { id: "defensa", titulo: "Defensa", icono: "🛡️" },
  { id: "consistencia", titulo: "Consistencia", icono: "📈" },
];

const COLORES_COMPARACION = ["#EF4444", "#8B5CF6", "#3B82F6"];

function colorPodio(puesto: number): string {
  if (puesto === 1) return "bg-yellow-400 text-yellow-900";
  if (puesto === 2) return "bg-slate-300 text-slate-800";
  return "bg-amber-700 text-amber-100";
}

export default function JugadorPage() {
  const router = useRouter();
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [jugador, setJugador] = useState<Jugador | null>(null);
  const [nombreEquipo, setNombreEquipo] = useState("");
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [acciones, setAcciones] = useState<AccionDB[]>([]);
  const [idsJugadoresEquipo, setIdsJugadoresEquipo] = useState<string[]>([]);
  const [porJugadorEquipo, setPorJugadorEquipo] = useState<
    Record<string, EstadisticasJugador>
  >({});
  const [cargando, setCargando] = useState(true);

  const [vista, setVista] = useState<Vista>("general");
  const [partidoSeleccionado, setPartidoSeleccionado] = useState<string>("");

  // Modo comparar partidos
  const [modoPartido, setModoPartido] = useState<ModoPartido>("individual");
  const [partidosComparados, setPartidosComparados] = useState<string[]>([]);

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

            const idsEq = (jugRes ?? []).map(
              (j: { jugador_id: string }) => j.jugador_id
            );
            setIdsJugadoresEquipo(idsEq);

            const { data: jugDataAll } = await supabase
              .from("jugadores")
              .select("id, rol")
              .in("id", idsEq);

            const armadores = new Set(
              ((jugDataAll ?? []) as { id: string; rol: string }[])
                .filter((j) => j.rol === "armador")
                .map((j) => j.id)
            );

            const acc = (accData ?? []) as AccionDB[];
            setAcciones(acc);

            const { porJugador } = calcularEstadisticasEquipo(
              idsEq,
              acc,
              armadores
            );
            setPorJugadorEquipo(porJugador);

            setCargando(false);
          });
      });
  }, [sesion]);

  const handleCerrar = () => {
    cerrarSesion();
    router.push("/");
  };

  const handleTogglePartidoComparado = (id: string) => {
    if (partidosComparados.includes(id)) {
      setPartidosComparados(partidosComparados.filter((x) => x !== id));
      return;
    }
    if (partidosComparados.length >= 3) return;
    setPartidosComparados([...partidosComparados, id]);
  };

  const handleCambiarModoPartido = (nuevo: ModoPartido) => {
    setModoPartido(nuevo);
    if (nuevo === "individual") {
      setPartidosComparados([]);
    } else {
      setPartidoSeleccionado("");
    }
  };

  if (!sesion) return null;

  const partidoActivo =
    vista === "general" || modoPartido === "comparar"
      ? null
      : partidoSeleccionado || partidos[0]?.id || null;

  const accionesFiltradas = partidoActivo
    ? acciones.filter((a) => a.partido_id === partidoActivo)
    : acciones;

  // Calcular máximos del equipo con el contexto correcto
  let maxPorFund: Record<string, number> = {};
  let maxAccionesEquipo = 1;
  if (jugador && idsJugadoresEquipo.length > 0) {
    maxPorFund = calcularMaxAccionesPorFundamento(
      accionesFiltradas,
      idsJugadoresEquipo
    );
    for (const jid of idsJugadoresEquipo) {
      const total = accionesFiltradas
        .filter((a) => a.jugador_id === jid)
        .reduce((s, a) => s + a.cantidad, 0);
      if (total > maxAccionesEquipo) maxAccionesEquipo = total;
    }
  }

  const stats: EstadisticasJugador | null = jugador
    ? calcularEstadisticasJugador(
        jugador.id,
        accionesFiltradas,
        jugador.rol === "armador",
        maxPorFund,
        maxAccionesEquipo
      )
    : null;

  const podios = jugador
    ? calcularPodios(porJugadorEquipo, accionesFiltradas)
    : {};

  const textosRanking = jugador
    ? rankingDeJugador(jugador.id, porJugadorEquipo, accionesFiltradas)
    : {};

  const esArmador = jugador?.rol === "armador";
  const partidoActual = partidos.find((p) => p.id === partidoActivo);

  // ==== DATOS COMPARACIÓN DE PARTIDOS ====
  const partidosComparadosData =
    vista === "por-partido" && modoPartido === "comparar" && jugador
      ? partidosComparados
          .map((pid, idx) => {
            const partido = partidos.find((p) => p.id === pid);
            if (!partido) return null;
            const accPartido = acciones.filter((a) => a.partido_id === pid);

            const maxPorFundP = calcularMaxAccionesPorFundamento(
              accPartido,
              idsJugadoresEquipo
            );
            let maxAccP = 1;
            for (const jid of idsJugadoresEquipo) {
              const total = accPartido
                .filter((a) => a.jugador_id === jid)
                .reduce((s, a) => s + a.cantidad, 0);
              if (total > maxAccP) maxAccP = total;
            }

            const est = calcularEstadisticasJugador(
              jugador.id,
              accPartido,
              jugador.rol === "armador",
              maxPorFundP,
              maxAccP
            );

            return {
              id: pid,
              nombre: `vs ${partido.rival} (${partido.fecha})`,
              color: COLORES_COMPARACION[idx],
              partido,
              accPartido,
              est,
            };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null)
      : [];

  const seriesRadarPartidos =
    vista === "por-partido" && modoPartido === "comparar" && jugador
      ? partidosComparadosData.map((s) => ({
          id: s.id,
          nombre: s.nombre,
          color: s.color,
          jugador: s.est,
        }))
      : [];

  const seriesSaquePartidos =
    vista === "por-partido" && modoPartido === "comparar" && jugador
      ? partidosComparadosData.map((s) => ({
          id: s.id,
          nombre: s.nombre,
          color: s.color,
          promedios: calcularPromedioPonderadoPorSet(
            jugador.id,
            s.accPartido,
            idsJugadoresEquipo,
            "saque",
            VALORES_SAQUE
          ),
        }))
      : [];

  const seriesRecepcionPartidos =
    vista === "por-partido" && modoPartido === "comparar" && jugador
      ? partidosComparadosData.map((s) => ({
          id: s.id,
          nombre: s.nombre,
          color: s.color,
          promedios: calcularPromedioPonderadoPorSet(
            jugador.id,
            s.accPartido,
            idsJugadoresEquipo,
            "recepcion",
            VALORES_RECEPCION
          ),
        }))
      : [];

  const seriesBloqueoPartidos =
    vista === "por-partido" && modoPartido === "comparar" && jugador
      ? partidosComparadosData.map((s) => ({
          id: s.id,
          nombre: s.nombre,
          color: s.color,
          promedios: calcularPromedioPonderadoPorSet(
            jugador.id,
            s.accPartido,
            idsJugadoresEquipo,
            "bloqueo",
            VALORES_BLOQUEO
          ),
        }))
      : [];

  const seriesArmadosPartidos =
    vista === "por-partido" && modoPartido === "comparar" && jugador
      ? partidosComparadosData.map((s) => ({
          id: s.id,
          nombre: s.nombre,
          color: s.color,
          promedios: calcularPromedioArmadosPonderadoPorSet(
            jugador.id,
            s.accPartido,
            idsJugadoresEquipo
          ),
        }))
      : [];

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
              <div className="mb-4 space-y-3">
                {/* Sub-toggle: individual / comparar */}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => handleCambiarModoPartido("individual")}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition border ${
                      modoPartido === "individual"
                        ? "bg-emerald-500 text-white border-emerald-500"
                        : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    👁️ Ver un partido
                  </button>
                  <button
                    onClick={() => handleCambiarModoPartido("comparar")}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition border ${
                      modoPartido === "comparar"
                        ? "bg-emerald-500 text-white border-emerald-500"
                        : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    ⚖️ Comparar partidos ({partidosComparados.length}/3)
                  </button>
                </div>

                {/* Selector de partidos */}
                {modoPartido === "individual" && (
                  <div>
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

                {modoPartido === "comparar" && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Elegí hasta 3 partidos para compararte:
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {partidos.map((p) => {
                        const idx = partidosComparados.indexOf(p.id);
                        const color = idx !== -1 ? COLORES_COMPARACION[idx] : null;
                        return (
                          <button
                            key={p.id}
                            onClick={() => handleTogglePartidoComparado(p.id)}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition border flex items-center gap-2 ${
                              color
                                ? "border-2 text-slate-900"
                                : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                            }`}
                            style={
                              color
                                ? {
                                    backgroundColor: color + "20",
                                    borderColor: color,
                                  }
                                : undefined
                            }
                          >
                            {color && (
                              <span
                                className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                                style={{ backgroundColor: color }}
                              >
                                {idx + 1}
                              </span>
                            )}
                            vs {p.rival} · {p.fecha}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
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

              {/* COMPARAR PARTIDOS */}
              {vista === "por-partido" && modoPartido === "comparar" ? (
                <>
                  {partidosComparadosData.length === 0 ? (
                    <div className="p-12 text-center">
                      <p className="text-4xl mb-3">⚖️</p>
                      <p className="text-slate-600 font-medium">
                        Elegí partidos arriba para ver tu evolución
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="mb-6 pb-4 border-b border-slate-200">
                        <h3 className="text-xl font-bold text-slate-900 mb-3">
                          Comparando {partidosComparadosData.length} partido
                          {partidosComparadosData.length !== 1 ? "s" : ""}
                        </h3>
                        <div className="flex flex-wrap gap-3">
                          {partidosComparadosData.map((s) => (
                            <div
                              key={s.id}
                              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50"
                            >
                              <span
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: s.color }}
                              />
                              <span className="text-sm font-medium text-slate-700">
                                {s.nombre}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mb-6">
                        <h3 className="font-semibold text-slate-800 mb-3">
                          Tu radar comparado
                        </h3>
                        <RadarJugador
                          series={seriesRadarPartidos}
                          esArmador={esArmador}
                        />
                      </div>

                      <div className="mb-6">
                        <h3 className="font-semibold text-slate-800 mb-3">
                          Tu valoración ponderada por partido
                        </h3>
                        <div className="overflow-x-auto rounded-lg border border-slate-200">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-100">
                              <tr className="text-left text-slate-500">
                                <th className="py-2 px-3">Fundamento</th>
                                {partidosComparadosData.map((s) => (
                                  <th
                                    key={s.id}
                                    className="py-2 px-3 text-right"
                                    style={{ color: s.color }}
                                  >
                                    {s.nombre}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {Object.keys(
                                partidosComparadosData[0].est
                                  .valoracionPonderadaPorFundamento
                              ).map((f) => (
                                <tr key={f} className="border-b border-slate-100">
                                  <td className="py-2 px-3 font-medium text-slate-700">
                                    {NOMBRES_FUNDAMENTO[f] ?? f}
                                  </td>
                                  {partidosComparadosData.map((s) => {
                                    const val =
                                      s.est.valoracionPonderadaPorFundamento[
                                        f
                                      ] ?? 0;
                                    return (
                                      <td
                                        key={s.id}
                                        className="py-2 px-3 text-right font-semibold"
                                        style={{ color: s.color }}
                                      >
                                        {val > 0 ? "+" : ""}
                                        {val.toFixed(2)}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                          <GraficoSaquePorSet series={seriesSaquePartidos} />
                        </div>

                        {!esArmador && (
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                            <GraficoRecepcionPorSet
                              series={seriesRecepcionPartidos}
                            />
                          </div>
                        )}

                        {esArmador && (
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                            <GraficoArmadosPorSet
                              series={seriesArmadosPartidos}
                            />
                          </div>
                        )}

                        <div
                          className={`p-4 bg-slate-50 border border-slate-200 rounded-lg ${
                            esArmador ? "" : "col-span-2"
                          }`}
                        >
                          <GraficoBloqueoPorSet series={seriesBloqueoPartidos} />
                        </div>
                      </div>

                      <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-100">
                            <tr className="text-left text-slate-500">
                              <th className="py-2 px-3">Partido</th>
                              <th className="py-2 px-3 text-right">Acciones</th>
                              <th className="py-2 px-3 text-right">Puntos</th>
                              <th className="py-2 px-3 text-right">Errores</th>
                              <th className="py-2 px-3 text-right">Saldo</th>
                              <th className="py-2 px-3 text-right">Val. Media</th>
                            </tr>
                          </thead>
                          <tbody>
                            {partidosComparadosData.map((s) => (
                              <tr key={s.id} className="border-b border-slate-100">
                                <td className="py-2 px-3 font-medium">
                                  <span
                                    className="inline-block w-3 h-3 rounded-full mr-2 align-middle"
                                    style={{ backgroundColor: s.color }}
                                  />
                                  <span className="text-slate-800">
                                    {s.nombre}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-right text-slate-600">
                                  {s.est.totalAcciones}
                                </td>
                                <td className="py-2 px-3 text-right text-green-700">
                                  {s.est.totalPuntos}
                                </td>
                                <td className="py-2 px-3 text-right text-red-700">
                                  {s.est.totalErrores}
                                </td>
                                <td
                                  className={`py-2 px-3 text-right font-semibold ${
                                    s.est.saldoTotal > 0
                                      ? "text-green-700"
                                      : s.est.saldoTotal < 0
                                      ? "text-red-700"
                                      : "text-slate-600"
                                  }`}
                                >
                                  {s.est.saldoTotal > 0 ? "+" : ""}
                                  {s.est.saldoTotal}
                                </td>
                                <td
                                  className={`py-2 px-3 text-right font-semibold ${
                                    s.est.valoracionMediaNormalizada > 0
                                      ? "text-green-700"
                                      : s.est.valoracionMediaNormalizada < 0
                                      ? "text-red-700"
                                      : "text-slate-600"
                                  }`}
                                >
                                  {s.est.valoracionMediaNormalizada > 0
                                    ? "+"
                                    : ""}
                                  {s.est.valoracionMediaNormalizada.toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <>
                  {/* VISTA INDIVIDUAL (ya existente) */}
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

                  {Object.keys(stats.valoracionPonderadaPorFundamento)
                    .length > 0 && (
                    <div className="mb-6">
                      <h3 className="font-semibold text-slate-800 mb-3">
                        Valoración ponderada por fundamento
                      </h3>
                      <div className="grid grid-cols-5 gap-2">
                        {Object.entries(
                          stats.valoracionPonderadaPorFundamento
                        ).map(([fund, val]) => {
                          const puesto = jugador
                            ? podios[jugador.id]?.[fund]
                            : undefined;
                          return (
                            <div
                              key={fund}
                              className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center relative"
                            >
                              {puesto !== undefined && (
                                <span
                                  className={`absolute -top-2 -right-2 inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shadow-sm border-2 border-white ${colorPodio(
                                    puesto
                                  )}`}
                                  title={`${puesto}° puesto del plantel`}
                                >
                                  ⭐{puesto}
                                </span>
                              )}
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
                                {val.toFixed(2)}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {Object.keys(textosRanking).length > 0 && (
                    <div className="mb-6">
                      <h3 className="font-semibold text-slate-800 mb-3">
                        Tus números en el plantel
                      </h3>
                      <div className="bg-slate-50 border border-slate-200 rounded-lg divide-y divide-slate-200">
                        {ORDEN_RANKINGS.map((r) => {
                          const texto = textosRanking[r.id];
                          const puesto = jugador
                            ? podios[jugador.id]?.[r.id]
                            : undefined;
                          return (
                            <div
                              key={r.id}
                              className="flex items-start gap-3 px-4 py-3"
                            >
                              <span className="text-xl leading-none mt-0.5">
                                {r.icono}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <p className="text-sm font-semibold text-slate-700">
                                    {r.titulo}
                                  </p>
                                  {puesto !== undefined && (
                                    <span
                                      className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${colorPodio(
                                        puesto
                                      )}`}
                                      title={`${puesto}° puesto`}
                                    >
                                      {puesto}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-500">
                                  {texto ?? "Sin datos en este fundamento"}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {esArmador && stats.armador && (
                    <div className="mb-6 grid grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                        <GraficoSaquePorSet
                          promedios={calcularPromedioPonderadoPorSet(
                            jugador.id,
                            accionesFiltradas,
                            idsJugadoresEquipo,
                            "saque",
                            VALORES_SAQUE
                          )}
                        />
                      </div>
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                        <GraficoBloqueoPorSet
                          promedios={calcularPromedioPonderadoPorSet(
                            jugador.id,
                            accionesFiltradas,
                            idsJugadoresEquipo,
                            "bloqueo",
                            VALORES_BLOQUEO
                          )}
                        />
                      </div>
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                        <GraficoArmadosPorSet
                          promedios={calcularPromedioArmadosPonderadoPorSet(
                            jugador.id,
                            accionesFiltradas,
                            idsJugadoresEquipo
                          )}
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
                          promedios={calcularPromedioPonderadoPorSet(
                            jugador.id,
                            accionesFiltradas,
                            idsJugadoresEquipo,
                            "saque",
                            VALORES_SAQUE
                          )}
                        />
                      </div>
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                        <GraficoRecepcionPorSet
                          promedios={calcularPromedioPonderadoPorSet(
                            jugador.id,
                            accionesFiltradas,
                            idsJugadoresEquipo,
                            "recepcion",
                            VALORES_RECEPCION
                          )}
                        />
                      </div>
                      <div className="col-span-2 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                        <GraficoBloqueoPorSet
                          promedios={calcularPromedioPonderadoPorSet(
                            jugador.id,
                            accionesFiltradas,
                            idsJugadoresEquipo,
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
                        {stats.valoracionMediaNormalizada.toFixed(2)}
                      </p>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                      <p className="text-xs text-slate-500 uppercase">
                        Acciones
                      </p>
                      <p className="text-2xl font-bold text-slate-800">
                        {stats.totalAcciones}
                      </p>
                    </div>
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                      <p className="text-xs text-green-700 uppercase">
                        Puntos
                      </p>
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
                        No tenés acciones cargadas en ese partido
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}