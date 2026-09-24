"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  calcularEstadisticasEquipo,
  calcularPromediosEquipoPorSet,
  calcularPromediosEquipoArmadosPorSet,
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

type ModoPrincipal = "partido" | "comparar-partidos";
type ModoDetalle = "analisis" | "comparar-jugadores";

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

  const handleToggleModoPrincipal = (nuevo: ModoPrincipal) => {
    setModoPrincipal(nuevo);
    if (nuevo === "comparar-partidos") {
      setPartidoSeleccionado(null);
    } else {
      setPartidosComparados([]);
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

  const handleToggleJugadorComparado = (id: string) => {
    if (jugadoresComparados.includes(id)) {
      setJugadoresComparados(jugadoresComparados.filter((x) => x !== id));
      return;
    }
    if (jugadoresComparados.length >= 3) return;

    // Regla: armadores con armadores, normales con normales
    if (jugadoresComparados.length > 0) {
      const armadores = new Set(
        jugadores.filter((j) => j.rol === "armador").map((j) => j.id)
      );
      const primerEsArm = armadores.has(jugadoresComparados[0]);
      const esteEsArm = armadores.has(id);
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

  // ==== COMPARAR PARTIDOS ====
  const partidosComparadosData = partidosComparados
    .map((id, idx) => {
      const partido = partidos.find((p) => p.id === id);
      if (!partido) return null;
      const accPartido = acciones.filter(
        (a) => a.partido_id === id
      );
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

  // ==== COMPARAR JUGADORES DENTRO DE UN PARTIDO ====
  const jugadoresComparadosData = jugadoresComparados
    .map((id, idx) => ({
      id,
      nombre: nombreDe(id),
      color: COLORES_COMPARACION[idx],
    }))
    .filter((x) => x !== null);

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
      {/* Toggle principal */}
      <div className="flex justify-end gap-2">
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
      </div>

      {/* Filtros */}
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

      <div className="grid grid-cols-3 gap-4">
        {/* Panel izquierdo: lista de partidos */}
        <div className="col-span-1">
          <h3 className="font-semibold text-slate-800 mb-3">
            {partidosFiltrados.length} partido
            {partidosFiltrados.length !== 1 ? "s" : ""}
            {modoPrincipal === "comparar-partidos" && " — elegí hasta 3"}
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
                          : colorComp
                          ? "text-slate-900"
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
        </div>

        {/* Panel derecho */}
        <div className="col-span-2">
          {modoPrincipal === "comparar-partidos" ? (
            // ===== COMPARAR PARTIDOS =====
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
                              <span className="text-slate-800">{s.nombre}</span>
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
            // Sin partido seleccionado
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center h-full flex items-center justify-center">
              <div>
                <p className="text-4xl mb-3">👈</p>
                <p className="text-slate-600 font-medium">
                  Elegí un partido para ver el detalle
                </p>
              </div>
            </div>
          ) : (
            // ===== VER PARTIDO =====
            <div className="space-y-4">
              {/* Sub-toggle análisis / comparar jugadores */}
              <div className="flex justify-end gap-2">
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
              </div>

              {/* Header del partido */}
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

              {/* MODO COMPARAR JUGADORES */}
              {modoDetalle === "comparar-jugadores" && (
                <>
                  {/* Selector de jugadores */}
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
                                  ? "border-2 text-white"
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

                  {/* Gráficos comparativos de los jugadores */}
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

              {/* MODO ANÁLISIS (el de siempre) */}
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