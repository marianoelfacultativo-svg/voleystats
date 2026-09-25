"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  calcularEstadisticasEquipo,
  calcularEstadisticasJugador,
  calcularMaxAccionesPorFundamento,
  calcularPromedioPonderadoPorSet,
  calcularPromedioArmadosPonderadoPorSet,
  VALORES_SAQUE,
  VALORES_RECEPCION,
  VALORES_BLOQUEO,
  type AccionDB,
  type PromedioRecepcionSet,
} from "@/lib/estadisticas";
import GraficoRecepcionEquipoPorSet from "./GraficoRecepcionEquipoPorSet";
import GraficoTortaRival from "./GraficoTortaRival";
import RadarEquipo from "./RadarEquipo";
import RadarJugador from "./RadarJugador";
import GraficoSaquePorSet from "./GraficoSaquePorSet";
import GraficoRecepcionPorSet from "./GraficoRecepcionPorSet";
import GraficoBloqueoPorSet from "./GraficoBloqueoPorSet";
import GraficoArmadosPorSet from "./GraficoArmadosPorSet";
import TablaJugadoresPorSet from "./TablaJugadoresPorSet";
import TablaEstadisticasCrudas from "./TablaEstadisticasCrudas";

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

const COLORES_COMPARACION = ["#EF4444", "#8B5CF6", "#3B82F6"];

type ModoPrincipal =
  | "partido"
  | "comparar-partidos"
  | "jugador-por-partidos";
type ModoDetalle = "analisis" | "comparar-jugadores" | "crudas";

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

  const [modoPrincipal, setModoPrincipal] =
    useState<ModoPrincipal>("partido");
  const [partidoSeleccionado, setPartidoSeleccionado] = useState<string | null>(
    null
  );
  const [partidosComparados, setPartidosComparados] = useState<string[]>([]);

  const [jugadorSeleccionadoJxP, setJugadorSeleccionadoJxP] = useState<
    string | null
  >(null);
  const [partidosJxP, setPartidosJxP] = useState<string[]>([]);

  const [modoDetalle, setModoDetalle] = useState<ModoDetalle>("analisis");
  const [jugadoresComparados, setJugadoresComparados] = useState<string[]>([]);

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

      const resultados = await Promise.all(
        ids.map((pid) =>
          supabase
            .from("acciones")
            .select(
              "jugador_id, partido_id, set_numero, fundamento, valoracion, cantidad"
            )
            .eq("partido_id", pid)
            .range(0, 49999)
        )
      );

      const accData = resultados.flatMap((r) => r.data ?? []);

      setAcciones(accData as AccionDB[]);
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

  const handleToggleModoPrincipal = (nuevo: ModoPrincipal) => {
    setModoPrincipal(nuevo);
    if (nuevo === "comparar-partidos") {
      setPartidoSeleccionado(null);
      setJugadorSeleccionadoJxP(null);
      setPartidosJxP([]);
    } else if (nuevo === "jugador-por-partidos") {
      setPartidoSeleccionado(null);
      setPartidosComparados([]);
    } else {
      setPartidosComparados([]);
      setJugadorSeleccionadoJxP(null);
      setPartidosJxP([]);
    }
  };

  const handleTogglePartidoComparado = (id: string) => {
    if (partidosComparados.includes(id)) {
      setPartidosComparados(partidosComparados.filter((x) => x !== id));
      return;
    }
    if (partidosComparados.length >= 3) return;
    setPartidosComparados([...partidosComparados, id]);
  };

  const handleTogglePartidoJxP = (id: string) => {
    if (partidosJxP.includes(id)) {
      setPartidosJxP(partidosJxP.filter((x) => x !== id));
      return;
    }
    if (partidosJxP.length >= 3) return;
    setPartidosJxP([...partidosJxP, id]);
  };

  const handleToggleJugadorComparado = (id: string) => {
    if (jugadoresComparados.includes(id)) {
      setJugadoresComparados(jugadoresComparados.filter((x) => x !== id));
      return;
    }
    if (jugadoresComparados.length >= 3) return;

    if (jugadoresComparados.length > 0) {
      const armadoresSet = new Set(
        jugadores.filter((j) => j.rol === "armador").map((j) => j.id)
      );
      const primerEsArm = armadoresSet.has(jugadoresComparados[0]);
      const esteEsArm = armadoresSet.has(id);
      if (primerEsArm !== esteEsArm) return;
    }

    setJugadoresComparados([...jugadoresComparados, id]);
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

  const partidosComparadosData = partidosComparados
    .map((id, idx) => {
      const partido = partidos.find((p) => p.id === id);
      if (!partido) return null;
      const accPartido = acciones.filter((a) => a.partido_id === id);
      const stats = calcularEstadisticasEquipo(
        idsJugadores,
        accPartido,
        armadores
      ).totales;
      return {
        id,
        nombre: `vs ${partido.rival} (${partido.fecha})`,
        color: COLORES_COMPARACION[idx],
        partido,
        stats,
        acciones: accPartido,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const seriesRadarPartidos = partidosComparadosData.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    color: s.color,
    equipo: s.stats,
  }));

  const seriesRecepcionPartidos = partidosComparadosData.map((s) => {
    const proms: PromedioRecepcionSet[] = [1, 2, 3, 4, 5].map((set) => {
      const delSet = s.acciones.filter(
        (a) =>
          a.fundamento === "recepcion" &&
          a.set_numero === set &&
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
        set,
        promedio: total > 0 ? suma / total : 0,
        totalRecepciones: total,
      };
    });
    return {
      id: s.id,
      nombre: s.nombre,
      color: s.color,
      promedios: proms,
    };
  });

  const jugadorJxP = jugadorSeleccionadoJxP
    ? jugadores.find((j) => j.id === jugadorSeleccionadoJxP)
    : null;
  const esArmadorJxP = jugadorJxP?.rol === "armador";

  const partidosJxPData = jugadorSeleccionadoJxP
    ? partidosJxP
        .map((pid, idx) => {
          const partido = partidos.find((p) => p.id === pid);
          if (!partido) return null;
          const accPartido = acciones.filter((a) => a.partido_id === pid);

          const maxPorFundP = calcularMaxAccionesPorFundamento(
            accPartido,
            idsJugadores
          );
          let maxAccP = 1;
          for (const jid of idsJugadores) {
            const total = accPartido
              .filter((a) => a.jugador_id === jid)
              .reduce((s, a) => s + a.cantidad, 0);
            if (total > maxAccP) maxAccP = total;
          }

          const est = calcularEstadisticasJugador(
            jugadorSeleccionadoJxP,
            accPartido,
            esArmadorJxP ?? false,
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

  const seriesRadarJxP = partidosJxPData.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    color: s.color,
    jugador: s.est,
  }));

  const seriesSaqueJxP = jugadorSeleccionadoJxP
    ? partidosJxPData.map((s) => ({
        id: s.id,
        nombre: s.nombre,
        color: s.color,
        promedios: calcularPromedioPonderadoPorSet(
          jugadorSeleccionadoJxP,
          s.accPartido,
          idsJugadores,
          "saque",
          VALORES_SAQUE
        ),
      }))
    : [];

  const seriesRecepcionJxP = jugadorSeleccionadoJxP
    ? partidosJxPData.map((s) => ({
        id: s.id,
        nombre: s.nombre,
        color: s.color,
        promedios: calcularPromedioPonderadoPorSet(
          jugadorSeleccionadoJxP,
          s.accPartido,
          idsJugadores,
          "recepcion",
          VALORES_RECEPCION
        ),
      }))
    : [];

  const seriesBloqueoJxP = jugadorSeleccionadoJxP
    ? partidosJxPData.map((s) => ({
        id: s.id,
        nombre: s.nombre,
        color: s.color,
        promedios: calcularPromedioPonderadoPorSet(
          jugadorSeleccionadoJxP,
          s.accPartido,
          idsJugadores,
          "bloqueo",
          VALORES_BLOQUEO
        ),
      }))
    : [];

  const seriesArmadosJxP = jugadorSeleccionadoJxP
    ? partidosJxPData.map((s) => ({
        id: s.id,
        nombre: s.nombre,
        color: s.color,
        promedios: calcularPromedioArmadosPonderadoPorSet(
          jugadorSeleccionadoJxP,
          s.accPartido,
          idsJugadores
        ),
      }))
    : [];

  const jugadoresComparadosData = jugadoresComparados.map((id, idx) => ({
    id,
    nombre: nombreDe(id),
    color: COLORES_COMPARACION[idx],
  }));

  const esComparacionArmador =
    jugadoresComparadosData.length > 0 &&
    armadores.has(jugadoresComparadosData[0].id);

  const statsJugadoresComparados = jugadoresComparadosData.map((s) => {
    const est = calcularEstadisticasEquipo(
      idsJugadores,
      accionesDelPartido,
      armadores
    ).porJugador[s.id];
    return { ...s, est };
  });

  const seriesRadarJugadores = statsJugadoresComparados
    .filter((s) => s.est)
    .map((s) => ({
      id: s.id,
      nombre: s.nombre,
      color: s.color,
      jugador: s.est,
    }));

  const seriesSaqueJugadores = statsJugadoresComparados
    .filter((s) => s.est)
    .map((s) => ({
      id: s.id,
      nombre: s.nombre,
      color: s.color,
      promedios: calcularPromedioPonderadoPorSet(
        s.id,
        accionesDelPartido,
        idsJugadores,
        "saque",
        VALORES_SAQUE
      ),
    }));

  const seriesRecepcionJugadores = statsJugadoresComparados
    .filter((s) => s.est)
    .map((s) => ({
      id: s.id,
      nombre: s.nombre,
      color: s.color,
      promedios: calcularPromedioPonderadoPorSet(
        s.id,
        accionesDelPartido,
        idsJugadores,
        "recepcion",
        VALORES_RECEPCION
      ),
    }));

  const seriesBloqueoJugadores = statsJugadoresComparados
    .filter((s) => s.est)
    .map((s) => ({
      id: s.id,
      nombre: s.nombre,
      color: s.color,
      promedios: calcularPromedioPonderadoPorSet(
        s.id,
        accionesDelPartido,
        idsJugadores,
        "bloqueo",
        VALORES_BLOQUEO
      ),
    }));

  const seriesArmadosJugadores = statsJugadoresComparados
    .filter((s) => s.est)
    .map((s) => ({
      id: s.id,
      nombre: s.nombre,
      color: s.color,
      promedios: calcularPromedioArmadosPonderadoPorSet(
        s.id,
        accionesDelPartido,
        idsJugadores
      ),
    }));

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2 flex-wrap">
        <button
          onClick={() => handleToggleModoPrincipal("partido")}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition border ${
            modoPrincipal === "partido"
              ? "bg-emerald-500 text-white border-emerald-500"
              : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
          }`}
        >
          📅 Ver partido
        </button>
        <button
          onClick={() => handleToggleModoPrincipal("comparar-partidos")}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition border ${
            modoPrincipal === "comparar-partidos"
              ? "bg-emerald-500 text-white border-emerald-500"
              : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
          }`}
        >
          ⚖️ Comparar partidos ({partidosComparados.length}/3)
        </button>
        <button
          onClick={() => handleToggleModoPrincipal("jugador-por-partidos")}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition border ${
            modoPrincipal === "jugador-por-partidos"
              ? "bg-emerald-500 text-white border-emerald-500"
              : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
          }`}
        >
          👤 Jugador por partidos
        </button>
      </div>

      {modoPrincipal !== "jugador-por-partidos" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Rival
              </label>
              <select
                value={filtroRival}
                onChange={(e) => setFiltroRival(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500"
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
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500"
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
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Set (en detalle)
              </label>
              <select
                value={filtroSet}
                onChange={(e) =>
                  setFiltroSet(
                    e.target.value as "todos" | "1" | "2" | "3" | "4" | "5"
                  )
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500"
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
                className="text-xs text-emerald-600 hover:text-emerald-800 font-medium"
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-1">
          {modoPrincipal === "jugador-por-partidos" ? (
            <>
              <h3 className="font-semibold text-slate-800 mb-3">
                Elegí un jugador
              </h3>
              <div className="space-y-2">
                {jugadores
                  .filter((j) =>
                    acciones.some((a) => a.jugador_id === j.id)
                  )
                  .map((j) => {
                    const sel = jugadorSeleccionadoJxP === j.id;
                    return (
                      <button
                        key={j.id}
                        onClick={() => setJugadorSeleccionadoJxP(j.id)}
                        className={`w-full text-left p-3 rounded-lg border transition ${
                          sel
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "bg-white border-slate-200 hover:bg-slate-50 text-slate-800"
                        }`}
                      >
                        <p
                          className={`font-medium text-sm ${
                            sel ? "text-white" : "text-slate-800"
                          }`}
                        >
                          {j.nombre}
                          {j.numero !== null && ` #${j.numero}`}
                          {j.rol === "armador" && (
                            <span
                              className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full ${
                                sel
                                  ? "bg-white/20 text-white"
                                  : "bg-violet-100 text-violet-700"
                              }`}
                            >
                              Arm
                            </span>
                          )}
                        </p>
                      </button>
                    );
                  })}
              </div>
            </>
          ) : (
            <>
              <h3 className="font-semibold text-slate-800 mb-3">
                {partidosFiltrados.length} partido
                {partidosFiltrados.length !== 1 ? "s" : ""}
                {modoPrincipal === "comparar-partidos" &&
                  " — elegí hasta 3"}
              </h3>

              {partidosFiltrados.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-center">
                  <p className="text-sm text-slate-500">
                    Ningún partido cumple los filtros
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {partidosFiltrados.map((p) => {
                    const idxComparado = partidosComparados.indexOf(p.id);
                    const seleccionadoIndividual =
                      modoPrincipal === "partido" &&
                      partidoSeleccionado === p.id;
                    const colorComp =
                      idxComparado !== -1
                        ? COLORES_COMPARACION[idxComparado]
                        : null;

                    return (
                      <button
                        key={p.id}
                        onClick={() =>
                          modoPrincipal === "partido"
                            ? setPartidoSeleccionado(p.id)
                            : handleTogglePartidoComparado(p.id)
                        }
                        className={`w-full text-left p-3 rounded-lg border transition relative ${
                          seleccionadoIndividual
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : colorComp
                            ? "border-2 text-white"
                            : "bg-white border-slate-200 hover:bg-slate-50"
                        }`}
                        style={
                          colorComp
                            ? {
                                backgroundColor: colorComp + "20",
                                borderColor: colorComp,
                              }
                            : undefined
                        }
                      >
                        {idxComparado !== -1 && (
                          <span
                            className="absolute top-2 right-2 w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center border-2 border-white shadow"
                            style={{ backgroundColor: colorComp! }}
                          >
                            {idxComparado + 1}
                          </span>
                        )}
                        <p
                          className={`font-medium text-sm ${
                            seleccionadoIndividual
                              ? "text-white"
                              : "text-slate-800"
                          }`}
                        >
                          vs {p.rival}
                        </p>
                        <p
                          className={`text-xs mt-1 ${
                            seleccionadoIndividual
                              ? "text-emerald-100"
                              : "text-slate-500"
                          }`}
                        >
                          📅 {p.fecha}
                        </p>
                        <p
                          className={`text-xs mt-1 ${
                            seleccionadoIndividual
                              ? "text-emerald-100"
                              : "text-slate-500"
                          }`}
                        >
                          {scoreDe(p)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <div className="col-span-2">
          {modoPrincipal === "jugador-por-partidos" ? (
            <div className="space-y-4">
              {!jugadorSeleccionadoJxP ? (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
                  <p className="text-4xl mb-3">👈</p>
                  <p className="text-slate-600 font-medium">
                    Elegí un jugador a la izquierda para empezar
                  </p>
                </div>
              ) : (
                <>
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                    <h4 className="font-semibold text-slate-800 mb-3">
                      Elegí hasta 3 partidos para comparar a{" "}
                      {nombreDe(jugadorSeleccionadoJxP)}
                    </h4>
                    <div className="flex gap-2 flex-wrap">
                      {partidos.map((p) => {
                        const idx = partidosJxP.indexOf(p.id);
                        const color =
                          idx !== -1 ? COLORES_COMPARACION[idx] : null;
                        const tieneAcciones = acciones.some(
                          (a) =>
                            a.partido_id === p.id &&
                            a.jugador_id === jugadorSeleccionadoJxP
                        );
                        return (
                          <button
                            key={p.id}
                            onClick={() => handleTogglePartidoJxP(p.id)}
                            disabled={!tieneAcciones && idx === -1}
                            className={`px-3 py-2 text-xs font-medium rounded-lg transition border flex items-center gap-2 ${
                              color
                                ? "border-2 text-slate-900"
                                : !tieneAcciones
                                ? "bg-slate-50 text-slate-300 cursor-not-allowed border-slate-200 opacity-50"
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

                  {partidosJxPData.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
                      <p className="text-4xl mb-3">⚖️</p>
                      <p className="text-slate-600 font-medium">
                        Elegí partidos arriba para ver la evolución
                      </p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                      <div className="mb-6 pb-4 border-b border-slate-200">
                        <h3 className="text-xl font-bold text-slate-900 mb-3">
                          {nombreDe(jugadorSeleccionadoJxP)} en{" "}
                          {partidosJxPData.length} partido
                          {partidosJxPData.length !== 1 ? "s" : ""}
                        </h3>
                        <div className="flex flex-wrap gap-3">
                          {partidosJxPData.map((s) => (
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
                        <h4 className="font-semibold text-slate-800 mb-3">
                          Radar comparado
                        </h4>
                        <RadarJugador
                          series={seriesRadarJxP}
                          esArmador={esArmadorJxP}
                        />
                      </div>

                      <div className="mb-6">
                        <h4 className="font-semibold text-slate-800 mb-3">
                          Valoración ponderada por partido
                        </h4>
                        <div className="overflow-x-auto rounded-lg border border-slate-200">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-100">
                              <tr className="text-left text-slate-500">
                                <th className="py-2 px-3">Fundamento</th>
                                {partidosJxPData.map((s) => (
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
                                partidosJxPData[0].est
                                  .valoracionPonderadaPorFundamento
                              ).map((f) => (
                                <tr
                                  key={f}
                                  className="border-b border-slate-100"
                                >
                                  <td className="py-2 px-3 font-medium text-slate-700">
                                    {NOMBRES[f] ?? f}
                                  </td>
                                  {partidosJxPData.map((s) => {
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
                          <GraficoSaquePorSet series={seriesSaqueJxP} />
                        </div>

                        {!esArmadorJxP && (
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                            <GraficoRecepcionPorSet
                              series={seriesRecepcionJxP}
                            />
                          </div>
                        )}

                        {esArmadorJxP && (
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                            <GraficoArmadosPorSet series={seriesArmadosJxP} />
                          </div>
                        )}

                        <div
                          className={`p-4 bg-slate-50 border border-slate-200 rounded-lg ${
                            esArmadorJxP ? "" : "col-span-2"
                          }`}
                        >
                          <GraficoBloqueoPorSet series={seriesBloqueoJxP} />
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
                              <th className="py-2 px-3 text-right">
                                Val. Media
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {partidosJxPData.map((s) => (
                              <tr
                                key={s.id}
                                className="border-b border-slate-100"
                              >
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
                    </div>
                  )}
                </>
              )}
            </div>
          ) : modoPrincipal === "comparar-partidos" ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              {partidosComparadosData.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-4xl mb-3">⚖️</p>
                  <p className="text-slate-600 font-medium">
                    Elegí hasta 3 partidos para comparar
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
                    <RadarEquipo
                      series={seriesRadarPartidos}
                      titulo="Radar comparativo del equipo"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                      <GraficoRecepcionEquipoPorSet
                        series={seriesRecepcionPartidos}
                      />
                    </div>
                  </div>

                  <div className="mt-6 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-slate-500 border-b border-slate-200">
                          <th className="py-2 px-3">Partido</th>
                          <th className="py-2 px-3 text-right">Acciones</th>
                          <th className="py-2 px-3 text-right">Puntos</th>
                          <th className="py-2 px-3 text-right">Errores</th>
                          <th className="py-2 px-3 text-right">Saldo</th>
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
                              {s.stats.totalAcciones}
                            </td>
                            <td className="py-2 px-3 text-right text-green-700">
                              {s.stats.totalPuntos}
                            </td>
                            <td className="py-2 px-3 text-right text-red-700">
                              {s.stats.totalErrores}
                            </td>
                            <td
                              className={`py-2 px-3 text-right font-semibold ${
                                s.stats.saldoTotal > 0
                                  ? "text-green-700"
                                  : s.stats.saldoTotal < 0
                                  ? "text-red-700"
                                  : "text-slate-600"
                              }`}
                            >
                              {s.stats.saldoTotal > 0 ? "+" : ""}
                              {s.stats.saldoTotal}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          ) : !partidoDetalle || !statsPartido ? (
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
              <div className="flex justify-end gap-2 flex-wrap">
                <button
                  onClick={() => {
                    setModoDetalle("analisis");
                    setJugadoresComparados([]);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition border ${
                    modoDetalle === "analisis"
                      ? "bg-emerald-500 text-white border-emerald-500"
                      : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  📊 Análisis
                </button>
                <button
                  onClick={() => setModoDetalle("comparar-jugadores")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition border ${
                    modoDetalle === "comparar-jugadores"
                      ? "bg-emerald-500 text-white border-emerald-500"
                      : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  ⚖️ Comparar jugadores ({jugadoresComparados.length}/3)
                </button>
                <button
                  onClick={() => setModoDetalle("crudas")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition border ${
                    modoDetalle === "crudas"
                      ? "bg-emerald-500 text-white border-emerald-500"
                      : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  📋 Estadísticas crudas
                </button>
              </div>

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

              {modoDetalle === "comparar-jugadores" && (
                <>
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                    <h4 className="font-semibold text-slate-800 mb-3">
                      Elegí hasta 3 jugadores (mismo rol)
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {jugadores
                        .filter((j) =>
                          accionesDelPartido.some((a) => a.jugador_id === j.id)
                        )
                        .map((j) => {
                          const idx = jugadoresComparados.indexOf(j.id);
                          const colorComp =
                            idx !== -1 ? COLORES_COMPARACION[idx] : null;

                          let bloqueado = false;
                          if (
                            jugadoresComparados.length > 0 &&
                            idx === -1
                          ) {
                            const primerEsArm = armadores.has(
                              jugadoresComparados[0]
                            );
                            const esteEsArm = armadores.has(j.id);
                            if (primerEsArm !== esteEsArm) bloqueado = true;
                          }
                          const puedeAgregarMas =
                            jugadoresComparados.length >= 3 && idx === -1;

                          return (
                            <button
                              key={j.id}
                              onClick={() => handleToggleJugadorComparado(j.id)}
                              disabled={bloqueado || puedeAgregarMas}
                              className={`text-left px-3 py-2 rounded-lg border transition text-sm ${
                                colorComp
                                  ? "border-2"
                                  : bloqueado || puedeAgregarMas
                                  ? "bg-slate-50 text-slate-300 cursor-not-allowed opacity-50 border-slate-200"
                                  : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                              }`}
                              style={
                                colorComp
                                  ? {
                                      backgroundColor: colorComp + "20",
                                      borderColor: colorComp,
                                    }
                                  : undefined
                              }
                            >
                              <div className="flex items-center gap-2">
                                {colorComp && (
                                  <span
                                    className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                                    style={{ backgroundColor: colorComp }}
                                  >
                                    {idx + 1}
                                  </span>
                                )}
                                <span className="font-medium truncate text-slate-900">
                                  {nombreDe(j.id)}
                                  {j.rol === "armador" && " (Arm)"}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  </div>

                  {statsJugadoresComparados.length > 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                      <div className="mb-6">
                        <RadarJugador
                          series={seriesRadarJugadores}
                          esArmador={esComparacionArmador}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                          <GraficoSaquePorSet series={seriesSaqueJugadores} />
                        </div>

                        {!esComparacionArmador && (
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                            <GraficoRecepcionPorSet
                              series={seriesRecepcionJugadores}
                            />
                          </div>
                        )}

                        {esComparacionArmador && (
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                            <GraficoArmadosPorSet
                              series={seriesArmadosJugadores}
                            />
                          </div>
                        )}

                        <div
                          className={`p-4 bg-slate-50 border border-slate-200 rounded-lg ${
                            esComparacionArmador ? "" : "col-span-2"
                          }`}
                        >
                          <GraficoBloqueoPorSet
                            series={seriesBloqueoJugadores}
                          />
                        </div>
                      </div>

                      <div className="mt-6 overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-slate-500 border-b border-slate-200">
                              <th className="py-2 px-3">Jugador</th>
                              <th className="py-2 px-3 text-right">Acciones</th>
                              <th className="py-2 px-3 text-right">Puntos</th>
                              <th className="py-2 px-3 text-right">Errores</th>
                              <th className="py-2 px-3 text-right">Saldo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {statsJugadoresComparados
                              .filter((s) => s.est)
                              .map((s) => (
                                <tr
                                  key={s.id}
                                  className="border-b border-slate-100"
                                >
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
                                    {s.est!.totalAcciones}
                                  </td>
                                  <td className="py-2 px-3 text-right text-green-700">
                                    {s.est!.totalPuntos}
                                  </td>
                                  <td className="py-2 px-3 text-right text-red-700">
                                    {s.est!.totalErrores}
                                  </td>
                                  <td
                                    className={`py-2 px-3 text-right font-semibold ${
                                      s.est!.saldoTotal > 0
                                        ? "text-green-700"
                                        : s.est!.saldoTotal < 0
                                        ? "text-red-700"
                                        : "text-slate-600"
                                    }`}
                                  >
                                    {s.est!.saldoTotal > 0 ? "+" : ""}
                                    {s.est!.saldoTotal}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
                      <p className="text-4xl mb-3">👆</p>
                      <p className="text-slate-600 font-medium">
                        Elegí jugadores arriba para ver la comparación
                      </p>
                    </div>
                  )}
                </>
              )}

              {modoDetalle === "crudas" && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <TablaEstadisticasCrudas
                    acciones={accionesDelPartido}
                    jugadoresIds={idsJugadores}
                    nombresJugadores={Object.fromEntries(
                      jugadores.map((j) => [j.id, nombreDe(j.id)])
                    )}
                    armadores={armadores}
                  />
                </div>
              )}

              {modoDetalle === "analisis" && (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-center">
                      <p className="text-xs text-slate-500 uppercase">
                        Acciones
                      </p>
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

                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                    <RadarEquipo equipo={statsPartido.totales} />
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

                  <TablaJugadoresPorSet
                    jugadoresIds={jugadores.map((j) => j.id)}
                    nombresJugadores={Object.fromEntries(
                      jugadores.map((j) => [j.id, nombreDe(j.id)])
                    )}
                    acciones={accionesDelPartido}
                    armadores={armadores}
                    statsEquipoTotales={statsPartido.totales}
                  />

                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 overflow-x-auto">
                    <h4 className="font-semibold text-slate-800 mb-3">
                      Por fundamento (equipo)
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
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
