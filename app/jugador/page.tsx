"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileDown,
  LogOut,
  BarChart2,
  Calendar,
  UserX,
  Layers,
  GitCompare,
  Activity,
  Table,
} from "lucide-react";
import { obtenerSesion, cerrarSesion, type Sesion } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { cargarAccionesCompatibles, type AccionDB } from "@/lib/db";
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
  nivelDeValoracion,
  COLORES_NIVEL_CLASES,
  type EstadisticasJugador,
} from "@/lib/estadisticas";
import RadarJugador from "../equipo/RadarJugador";
import GraficoArmadosPorSet from "../equipo/GraficoArmadosPorSet";
import GraficoRecepcionPorSet from "../equipo/GraficoRecepcionPorSet";
import GraficoSaquePorSet from "../equipo/GraficoSaquePorSet";
import GraficoBloqueoPorSet from "../equipo/GraficoBloqueoPorSet";
import MapaCalorTendencia from "../equipo/MapaCalorTendencia";
import ImagenAmpliable from "../equipo/ImagenAmpliable";
import TablaEstadisticasCrudas from "../equipo/TablaEstadisticasCrudas";
import MapaCalorJugador from "../equipo/MapaCalorJugador";
import IconoVoley from "../equipo/IconoVoley";
import IconoPelota from "../equipo/IconoPelota";
import { descargarComoPDF } from "@/lib/exportarPDF";

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
  equipo_id: string;
  equipo_rival_id: string | null;
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
}[] = [
  { id: "recepcion", titulo: "Recepción" },
  { id: "ataque", titulo: "Ataque" },
  { id: "bloqueo", titulo: "Bloqueo" },
  { id: "saque", titulo: "Saque" },
  { id: "defensa", titulo: "Defensa" },
  { id: "consistencia", titulo: "Consistencia" },
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
  const [equipoId, setEquipoId] = useState("");
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [acciones, setAcciones] = useState<AccionDB[]>([]);
  const [idsJugadoresEquipo, setIdsJugadoresEquipo] = useState<string[]>([]);
  const [porJugadorEquipo, setPorJugadorEquipo] = useState<
    Record<string, EstadisticasJugador>
  >({});
  const [cargando, setCargando] = useState(true);

  const [vista, setVista] = useState<Vista>("general");
  const [partidoSeleccionado, setPartidoSeleccionado] = useState<string>("");

  const [modoPartido, setModoPartido] = useState<ModoPartido>("individual");
  const [partidosComparados, setPartidosComparados] = useState<string[]>([]);

  const [verCrudas, setVerCrudas] = useState(false);

  const [crudasEnPDF, setCrudasEnPDF] = useState(false);

  const [descargando, setDescargando] = useState(false);
  const refPDF = useRef<HTMLDivElement>(null);

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
            setEquipoId(asig.equipo_id);

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
              .select("id, rival, fecha, equipo_id, equipo_rival_id")
              .or(
                `equipo_id.eq.${asig.equipo_id},equipo_rival_id.eq.${asig.equipo_id}`
              )
              .order("fecha", { ascending: false });

            if (!partRes || partRes.length === 0) {
              setCargando(false);
              return;
            }

            setPartidos(partRes);
            const idsPartidos = partRes.map((p) => p.id);

            const resultados = await Promise.all(
              idsPartidos.map((pid) =>
                cargarAccionesCompatibles(pid, asig.equipo_id)
              )
            );

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

            const acc = resultados.flat();
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
    setVerCrudas(false);
    if (nuevo === "individual") {
      setPartidosComparados([]);
    } else {
      setPartidoSeleccionado("");
    }
  };

  const handleDescargarPDF = async () => {
    if (!refPDF.current) return;

    if (vista === "por-partido" && modoPartido === "comparar") {
      if (partidosComparados.length === 0) {
        alert("Elegí al menos un partido para comparar antes de descargar.");
        return;
      }
    }

    setDescargando(true);

    const agregarCrudas =
      !(vista === "por-partido" && modoPartido === "comparar") && !verCrudas;

    if (agregarCrudas) {
      setCrudasEnPDF(true);
      await new Promise((r) => setTimeout(r, 200));
    }

    try {
      let nombre = `jugador-${jugador?.nombre ?? "perfil"}`;
      let titulo = jugador?.nombre ?? "Perfil";

      if (vista === "por-partido" && modoPartido === "comparar") {
        nombre = `jugador-${jugador?.nombre ?? ""}-comparacion-partidos`;
        titulo = `${jugador?.nombre ?? ""} · Comparación de partidos`;
      } else if (vista === "por-partido" && partidoActual) {
        nombre = `jugador-${jugador?.nombre ?? ""}-vs-${partidoActual.rival}-${
          partidoActual.fecha
        }`;
        titulo = `${jugador?.nombre ?? ""} · vs ${
          partidoActual.rival
        } · ${partidoActual.fecha}`;
      }

      await descargarComoPDF(refPDF.current, nombre, titulo);
    } finally {
      if (agregarCrudas) setCrudasEnPDF(false);
      setDescargando(false);
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
    <main className="min-h-screen bg-slate-50/70 p-3 sm:p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* ─── HEADER PRO ATHLETIC ─── */}
        <header className="card border border-white/10 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-white/5 border border-white/10 shadow-sm shrink-0">
              <IconoPelota size={26} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xl sm:text-2xl font-black tracking-tight text-white leading-none">
                  SALIDA<span className="text-rose-500 font-black">x</span>5
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-slate-300 border border-white/10">
                  Jugador
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-200 truncate mt-1">
                {jugador ? jugador.nombre : "Cargando perfil..."}
                {nombreEquipo && (
                  <span className="text-slate-400 font-normal ml-1.5">
                    · {nombreEquipo}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div
            className="flex items-center gap-2.5 w-full sm:w-auto justify-end"
            data-pdf-ignorar
          >
            <button
              onClick={handleDescargarPDF}
              disabled={descargando}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white border border-white/10 rounded-xl shadow-sm transition-all disabled:opacity-50"
            >
              <FileDown size={14} className="text-slate-400" />
              <span>{descargando ? "Generando PDF..." : "Exportar PDF"}</span>
            </button>
            <button
              onClick={handleCerrar}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 border border-white/10 hover:border-rose-500/30 rounded-xl transition-all"
            >
              <LogOut size={13} />
              <span className="hidden sm:inline">Cerrar sesión</span>
            </button>
          </div>
        </header>

        {cargando && (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-2.5 text-slate-500 font-medium text-sm">
              <div className="w-4 h-4 border-2 border-slate-300 border-t-[#163A85] rounded-full animate-spin" />
              <span>Cargando perfil y estadísticas...</span>
            </div>
          </div>
        )}

        {!cargando && !jugador && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 p-8 sm:p-12 text-center max-w-md mx-auto">
            <UserX size={36} className="text-slate-300 mx-auto mb-3" />
            <h3 className="text-slate-800 font-bold text-base">
              Perfil no encontrado
            </h3>
            <p className="text-slate-500 text-xs mt-1">
              No se encontraron datos vinculados al código de acceso.
            </p>
          </div>
        )}

        {!cargando && jugador && stats && (
          <div ref={refPDF} className="space-y-4">
            <div
              className="nav-pill inline-flex gap-1"
              data-pdf-ignorar
            >
              <button
                onClick={() => {
                  setVista("general");
                  setVerCrudas(false);
                }}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  vista === "general"
                    ? "bg-[var(--sx-blue-bright)] text-white shadow-sm border border-blue-400/30"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <BarChart2
                  size={14}
                  className={vista === "general" ? "text-white" : "text-slate-400"}
                />
                <span>Rendimiento General</span>
              </button>
              <button
                onClick={() => {
                  setVista("por-partido");
                  setVerCrudas(false);
                }}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  vista === "por-partido"
                    ? "bg-[var(--sx-blue-bright)] text-white shadow-sm border border-blue-400/30"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Calendar
                  size={14}
                  className={vista === "por-partido" ? "text-white" : "text-slate-400"}
                />
                <span>Por Partido</span>
              </button>
            </div>

            {vista === "por-partido" && partidos.length > 0 && (
              <div className="space-y-3" data-pdf-ignorar>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    onClick={() => handleCambiarModoPartido("individual")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition border ${
                      modoPartido === "individual"
                        ? "bg-[var(--sx-blue-bright)] text-white border-blue-400/40 shadow-sm"
                        : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span>Ver un partido</span>
                  </button>
                  <button
                    onClick={() => handleCambiarModoPartido("comparar")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition border ${
                      modoPartido === "comparar"
                        ? "bg-[var(--sx-blue-bright)] text-white border-blue-400/40 shadow-sm"
                        : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <GitCompare size={13} />
                    <span>Comparar partidos ({partidosComparados.length}/3)</span>
                  </button>
                </div>

                {modoPartido === "individual" && (
                  <div>
                    <div className="flex justify-end mb-2">
                      <button
                        onClick={() => setVerCrudas(!verCrudas)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition border ${
                          verCrudas
                            ? "bg-[var(--sx-blue-bright)] text-white border-blue-400/40 shadow-sm"
                            : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <Table size={13} />
                        <span>{verCrudas ? "Ver Gráficos" : "Ver Estadísticas Crudas"}</span>
                      </button>
                    </div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Elegí un partido:
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {partidos.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setPartidoSeleccionado(p.id)}
                          className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition border ${
                            partidoActivo === p.id
                              ? "bg-[var(--sx-blue-bright)] text-white border-blue-400/40 shadow-sm"
                              : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white"
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
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Elegí hasta 3 partidos para compararte:
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {partidos.map((p) => {
                        const idx = partidosComparados.indexOf(p.id);
                        const color =
                          idx !== -1 ? COLORES_COMPARACION[idx] : null;
                        return (
                          <button
                            key={p.id}
                            onClick={() => handleTogglePartidoComparado(p.id)}
                            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition border flex items-center gap-2 ${
                              color
                                ? "border-2 text-white font-bold shadow-md"
                                : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white"
                            }`}
                            style={
                              color
                                ? {
                                    backgroundColor: color + "30",
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

            <div className="card rounded-2xl border border-white/10 p-3 sm:p-6 shadow-xl">
              <div className="flex items-center gap-3 sm:gap-4 mb-6 pb-6 border-b border-white/10">
                <ImagenAmpliable
                  src={jugador.imagen_url}
                  alt={jugador.nombre}
                  inicial={jugador.nombre.charAt(0).toUpperCase()}
                  tamaño="lg"
                />
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl sm:text-3xl font-bold text-white truncate">
                    {jugador.nombre}
                  </h2>
                  {jugador.numero !== null && (
                    <p className="text-slate-300 text-base sm:text-lg">
                      #{jugador.numero}
                    </p>
                  )}
                  {nombreEquipo && (
                    <p className="text-sm text-slate-400 mt-1">
                      {nombreEquipo}
                    </p>
                  )}
                  {esArmador && (
                    <span className="inline-block mt-2 text-xs bg-violet-950/40 text-violet-300 border border-violet-500/30 px-2 py-0.5 rounded-full font-medium">
                      Armador
                    </span>
                  )}
                  {vista === "por-partido" && partidoActual && (
                    <p className="text-xs text-emerald-400 mt-2 font-semibold flex items-center gap-1.5">
                      <Calendar size={13} className="text-emerald-400 shrink-0" />
                      <span>vs {partidoActual.rival} · {partidoActual.fecha}</span>
                    </p>
                  )}
                </div>
              </div>

              {vista === "por-partido" && modoPartido === "comparar" ? (
                <>
                  {partidosComparadosData.length === 0 ? (
                    <div className="p-8 sm:p-12 text-center max-w-sm mx-auto">
                      <GitCompare size={36} className="text-slate-400 mx-auto mb-3" />
                      <p className="text-slate-200 font-semibold text-sm">
                        Elegí partidos arriba para ver tu evolución
                      </p>
                      <p className="text-slate-400 text-xs mt-1">
                        Podés seleccionar hasta 3 partidos para comparar fundamentos.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="mb-6 pb-4 border-b border-white/10">
                        <h3 className="text-lg sm:text-xl font-bold text-white mb-3">
                          Comparando {partidosComparadosData.length} partido
                          {partidosComparadosData.length !== 1 ? "s" : ""}
                        </h3>
                        <div className="flex flex-wrap gap-2 sm:gap-3">
                          {partidosComparadosData.map((s) => (
                            <div
                              key={s.id}
                              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 card"
                            >
                              <span
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: s.color }}
                              />
                              <span className="text-sm font-medium text-slate-200">
                                {s.nombre}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mb-6">
                        <h3 className="font-semibold text-white mb-3">
                          Tu radar comparado
                        </h3>
                        <div className="card rounded-xl p-3 border border-white/10">
                          <RadarJugador
                            series={seriesRadarPartidos}
                            esArmador={esArmador}
                          />
                        </div>
                      </div>

                      <div className="mb-6">
                        <h3 className="font-semibold text-white mb-3">
                          Tu valoración ponderada por partido
                        </h3>
                        <div className="overflow-x-auto rounded-xl border border-white/10 card">
                          <table className="w-full text-sm min-w-[500px]">
                            <thead className="bg-white/5 border-b border-white/10">
                              <tr className="text-left text-slate-400">
                                <th className="py-2.5 px-3">Fundamento</th>
                                {partidosComparadosData.map((s) => (
                                  <th
                                    key={s.id}
                                    className="py-2.5 px-3 text-right"
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
                                <tr
                                  key={f}
                                  className="border-b border-white/5 hover:bg-white/5 transition-colors"
                                >
                                  <td className="py-2.5 px-3 font-medium text-slate-200">
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
                                        className="py-2.5 px-3 text-right font-semibold tabular-nums"
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

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                        <div className="p-3 sm:p-4 card rounded-xl border border-white/10">
                          <GraficoSaquePorSet series={seriesSaquePartidos} />
                        </div>

                        {!esArmador && (
                          <div className="p-3 sm:p-4 card rounded-xl border border-white/10">
                            <GraficoRecepcionPorSet
                              series={seriesRecepcionPartidos}
                            />
                          </div>
                        )}

                        {esArmador && (
                          <div className="p-3 sm:p-4 card rounded-xl border border-white/10">
                            <GraficoArmadosPorSet
                              series={seriesArmadosPartidos}
                            />
                          </div>
                        )}

                        <div
                          className={`p-3 sm:p-4 card rounded-xl border border-white/10 ${
                            esArmador ? "" : "md:col-span-2"
                          }`}
                        >
                          <GraficoBloqueoPorSet
                            series={seriesBloqueoPartidos}
                          />
                        </div>
                      </div>

                      <div className="mt-6 overflow-x-auto rounded-xl border border-white/10 card">
                        <table className="w-full text-sm min-w-[500px]">
                          <thead className="bg-white/5 border-b border-white/10">
                            <tr className="text-left text-slate-400">
                              <th className="py-2.5 px-3">Partido</th>
                              <th className="py-2.5 px-3 text-right">Acciones</th>
                              <th className="py-2.5 px-3 text-right">Puntos</th>
                              <th className="py-2.5 px-3 text-right">Errores</th>
                              <th className="py-2.5 px-3 text-right">Saldo</th>
                              <th className="py-2.5 px-3 text-right">
                                Val. Media
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {partidosComparadosData.map((s) => (
                              <tr
                                key={s.id}
                                className="border-b border-white/5 hover:bg-white/5 transition-colors"
                              >
                                <td className="py-2.5 px-3 font-medium">
                                  <span
                                    className="inline-block w-3 h-3 rounded-full mr-2 align-middle"
                                    style={{ backgroundColor: s.color }}
                                  />
                                  <span className="text-white">
                                    {s.nombre}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right text-slate-300 tabular-nums">
                                  {s.est.totalAcciones}
                                </td>
                                <td className="py-2.5 px-3 text-right text-emerald-400 font-semibold tabular-nums">
                                  {s.est.totalPuntos}
                                </td>
                                <td className="py-2.5 px-3 text-right text-rose-400 font-semibold tabular-nums">
                                  {s.est.totalErrores}
                                </td>
                                <td
                                  className={`py-2.5 px-3 text-right font-semibold tabular-nums ${
                                    s.est.saldoTotal > 0
                                      ? "text-emerald-400"
                                      : s.est.saldoTotal < 0
                                      ? "text-rose-400"
                                      : "text-slate-300"
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
              ) : verCrudas ? (
                <div className="bg-white border border-slate-200 rounded-lg p-3 sm:p-4">
                  <TablaEstadisticasCrudas
                    acciones={accionesFiltradas}
                    jugadoresIds={[jugador.id]}
                    nombresJugadores={{ [jugador.id]: jugador.nombre }}
                    soloJugadorId={jugador.id}
                  />
                </div>
              ) : (
                <>
                  <div className="mb-6">
                    <h3 className="font-semibold text-white mb-3">
                      Perfil de rendimiento
                    </h3>
                    <div className="card rounded-xl p-2 border border-white/10">
                      <RadarJugador
                        jugador={stats}
                        todosJugadores={[stats]}
                        esArmador={esArmador}
                      />
                    </div>
                  </div>

                  <div className="mb-6">
                    <h3 className="font-semibold text-white mb-3">
                      Mapa de calor
                    </h3>
                    <div className="card rounded-xl p-3 sm:p-4 border border-white/10">
                      <MapaCalorJugador
                        acciones={accionesFiltradas}
                        jugadorId={jugador.id}
                      />
                    </div>
                  </div>

                  {Object.keys(stats.valoracionPonderadaPorFundamento)
                    .length > 0 && (
                    <div className="mb-6">
                      <h3 className="font-semibold text-white mb-3">
                        Valoración ponderada por fundamento
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                        {Object.entries(
                          stats.valoracionPonderadaPorFundamento
                        ).map(([fund, val]) => {
                          const puesto = jugador
                            ? podios[jugador.id]?.[fund]
                            : undefined;
                          const nivel = nivelDeValoracion(fund, val);
                          const col = COLORES_NIVEL_CLASES[nivel];
                          return (
                            <div
                              key={fund}
                              className={`p-3 rounded-xl text-center relative border ${col.bg} ${col.border} backdrop-blur-sm shadow-sm`}
                            >
                              {puesto !== undefined && (
                                <span
                                  className={`absolute -top-2 -right-2 inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shadow-sm border border-white/20 ${colorPodio(
                                    puesto
                                  )}`}
                                  title={`${puesto}° puesto del plantel`}
                                >
                                  ⭐{puesto}
                                </span>
                              )}
                              <p className="text-xs text-slate-300 font-medium">
                                {NOMBRES_FUNDAMENTO[fund] ?? fund}
                              </p>
                              <p className={`text-lg font-bold ${col.text}`}>
                                {val > 0 ? "+" : ""}
                                {val.toFixed(2)}
                              </p>
                              <p
                                className={`text-[9px] uppercase font-semibold ${col.text} opacity-70`}
                              >
                                {col.nombre}
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
                      <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-200">
                        {ORDEN_RANKINGS.map((r) => {
                          const texto = textosRanking[r.id];
                          const puesto = jugador
                            ? podios[jugador.id]?.[r.id]
                            : undefined;
                          return (
                            <div
                              key={r.id}
                              className="flex items-start gap-3 px-3 sm:px-4 py-3"
                            >
                              <div className="mt-0.5 shrink-0">
                                <IconoVoley
                                  tipo={r.id}
                                  size={20}
                                  className="text-slate-800"
                                />
                              </div>
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
                                <p className="text-xs text-slate-500 break-words">
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
                    <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                      <div className="p-3 sm:p-4 bg-white border border-slate-200 rounded-lg">
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
                      <div className="p-3 sm:p-4 bg-white border border-slate-200 rounded-lg">
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
                      <div className="p-3 sm:p-4 bg-white border border-slate-200 rounded-lg">
                        <GraficoArmadosPorSet
                          promedios={calcularPromedioArmadosPonderadoPorSet(
                            jugador.id,
                            accionesFiltradas,
                            idsJugadoresEquipo
                          )}
                        />
                      </div>
                      <div className="p-3 sm:p-4 bg-white border border-slate-200 rounded-lg">
                        <MapaCalorTendencia
                          distribucion={stats.armador.distribucionTendencia}
                          acciones={accionesFiltradas}
                          jugadorId={jugador.id}
                        />
                      </div>
                    </div>
                  )}

                  {!esArmador && (
                    <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                      <div className="p-3 sm:p-4 bg-white border border-slate-200 rounded-lg">
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
                      <div className="p-3 sm:p-4 bg-white border border-slate-200 rounded-lg">
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
                      <div className="md:col-span-2 p-3 sm:p-4 bg-white border border-slate-200 rounded-lg">
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

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                    <div className="card p-3 rounded-xl text-center border border-white/10 shadow-sm">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Saldo</p>
                      <p
                        className={`text-xl sm:text-2xl font-bold tabular-nums ${
                          stats.saldoTotal > 0
                            ? "text-emerald-400"
                            : stats.saldoTotal < 0
                            ? "text-rose-400"
                            : "text-slate-300"
                        }`}
                      >
                        {stats.saldoTotal > 0 ? "+" : ""}
                        {stats.saldoTotal}
                      </p>
                    </div>
                    <div className="card p-3 rounded-xl text-center border border-white/10 shadow-sm">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Saldo Defensivo
                      </p>
                      <p
                        className={`text-xl sm:text-2xl font-bold tabular-nums ${
                          stats.saldoDefensivo > 0
                            ? "text-emerald-400"
                            : stats.saldoDefensivo < 0
                            ? "text-rose-400"
                            : "text-slate-300"
                        }`}
                      >
                        {stats.saldoDefensivo > 0 ? "+" : ""}
                        {stats.saldoDefensivo}
                      </p>
                    </div>
                    <div className="card p-3 rounded-xl text-center border border-white/10 shadow-sm">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Valoración Media
                      </p>
                      <p
                        className={`text-xl sm:text-2xl font-bold tabular-nums ${
                          stats.valoracionMediaNormalizada > 0
                            ? "text-emerald-400"
                            : stats.valoracionMediaNormalizada < 0
                            ? "text-rose-400"
                            : "text-slate-300"
                        }`}
                      >
                        {stats.valoracionMediaNormalizada > 0 ? "+" : ""}
                        {stats.valoracionMediaNormalizada.toFixed(2)}
                      </p>
                    </div>

                    <div className="card p-3 rounded-xl text-center border border-white/10 shadow-sm">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Acciones
                      </p>
                      <p className="text-xl sm:text-2xl font-bold text-white tabular-nums">
                        {stats.totalAcciones}
                      </p>
                    </div>
                    <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-center shadow-sm">
                      <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
                        Puntos
                      </p>
                      <p className="text-xl sm:text-2xl font-bold text-emerald-300 tabular-nums">
                        {stats.totalPuntos}
                      </p>
                    </div>
                    <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-center shadow-sm">
                      <p className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider">Errores</p>
                      <p className="text-xl sm:text-2xl font-bold text-rose-300 tabular-nums">
                        {stats.totalErrores}
                      </p>
                    </div>
                  </div>

                  {vista === "por-partido" && stats.totalAcciones === 0 && (
                    <div className="mt-6 p-4 bg-amber-950/30 border border-amber-500/30 rounded-xl text-center">
                      <p className="text-sm text-amber-300 font-medium">
                        No tenés acciones cargadas en ese partido
                      </p>
                    </div>
                  )}

                  {crudasEnPDF && (
                    <div className="mt-6 bg-white border border-slate-200 rounded-lg p-3 sm:p-4">
                      <TablaEstadisticasCrudas
                        acciones={accionesFiltradas}
                        jugadoresIds={[jugador.id]}
                        nombresJugadores={{ [jugador.id]: jugador.nombre }}
                        soloJugadorId={jugador.id}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}