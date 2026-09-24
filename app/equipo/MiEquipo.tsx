"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  calcularEstadisticasEquipo,
  calcularPodios,
  rankingDeJugador,
  calcularPromedioPonderadoPorSet,
  calcularPromedioArmadosPonderadoPorSet,
  VALORES_SAQUE,
  VALORES_RECEPCION,
  VALORES_BLOQUEO,
  type AccionDB,
  type EstadisticasJugador,
} from "@/lib/estadisticas";
import RadarJugador from "./RadarJugador";
import GraficoArmadosPorSet from "./GraficoArmadosPorSet";
import GraficoRecepcionPorSet from "./GraficoRecepcionPorSet";
import GraficoSaquePorSet from "./GraficoSaquePorSet";
import GraficoBloqueoPorSet from "./GraficoBloqueoPorSet";
import MapaCalorTendencia from "./MapaCalorTendencia";
import ImagenAmpliable from "./ImagenAmpliable";

interface Jugador {
  id: string;
  nombre: string;
  numero: number | null;
  imagen_url: string | null;
  rol: string;
}

interface Props {
  equipoId: string;
  nombreEquipo: string;
}

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

export default function MiEquipo({ equipoId, nombreEquipo }: Props) {
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [acciones, setAcciones] = useState<AccionDB[]>([]);
  const [jugadorSeleccionado, setJugadorSeleccionado] = useState<string | null>(
    null
  );
  const [modo, setModo] = useState<"individual" | "comparar">("individual");
  const [comparados, setComparados] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!equipoId) return;
    setCargando(true);

    Promise.all([
      supabase.from("jugadores").select("*").order("nombre"),
      supabase.from("partidos").select("id").eq("equipo_id", equipoId),
    ]).then(async ([jugRes, partRes]) => {
      if (!jugRes.data || !partRes.data) {
        setCargando(false);
        return;
      }

      const idsPartidos = partRes.data.map((p) => p.id);
      if (idsPartidos.length === 0) {
        setJugadores(jugRes.data);
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

      setJugadores(jugRes.data);
      setAcciones((accData ?? []) as AccionDB[]);
      setCargando(false);
    });
  }, [equipoId]);

  if (cargando) {
    return <p className="text-slate-500 text-center py-12">Cargando...</p>;
  }

  const idsJugadores = jugadores.map((j) => j.id);
  const armadores = new Set(
    jugadores.filter((j) => j.rol === "armador").map((j) => j.id)
  );

  const { porJugador, totales } = calcularEstadisticasEquipo(
    idsJugadores,
    acciones,
    armadores
  );

  const podios = calcularPodios(porJugador, acciones);

  const jugadorActual: EstadisticasJugador | null = jugadorSeleccionado
    ? porJugador[jugadorSeleccionado] ?? null
    : null;
  const datosJugador = jugadores.find((j) => j.id === jugadorSeleccionado);
  const esArmador = datosJugador?.rol === "armador";

  const textosRanking = jugadorSeleccionado
    ? rankingDeJugador(jugadorSeleccionado, porJugador, acciones)
    : {};

  const handleToggleModo = (nuevo: "individual" | "comparar") => {
    setModo(nuevo);
    if (nuevo === "individual") {
      setComparados([]);
    }
  };

  const handleClickComparar = (jugadorId: string) => {
    const jugador = jugadores.find((j) => j.id === jugadorId);
    if (!jugador) return;

    const yaSeleccionado = comparados.includes(jugadorId);

    if (yaSeleccionado) {
      setComparados(comparados.filter((id) => id !== jugadorId));
      return;
    }

    if (comparados.length >= 3) return;

    if (comparados.length > 0) {
      const primerSel = jugadores.find((j) => j.id === comparados[0]);
      const ambosArmadores =
        primerSel?.rol === "armador" && jugador.rol === "armador";
      const ambosNormales =
        primerSel?.rol !== "armador" && jugador.rol !== "armador";
      if (!ambosArmadores && !ambosNormales) return;
    }

    setComparados([...comparados, jugadorId]);
  };

  // Build comparison series
  const comparadosData = comparados
    .map((id, idx) => ({
      id,
      nombre:
        jugadores.find((j) => j.id === id)?.nombre ?? "?",
      color: COLORES_COMPARACION[idx] ?? "#94a3b8",
      jugador: porJugador[id],
    }))
    .filter((s) => s.jugador);

  const esComparacionArmador =
    comparadosData.length > 0 &&
    armadores.has(comparadosData[0].id);

  const seriesRadar = comparadosData.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    color: s.color,
    jugador: s.jugador,
  }));

  const seriesSaque = comparadosData.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    color: s.color,
    promedios: calcularPromedioPonderadoPorSet(
      s.id,
      acciones,
      idsJugadores,
      "saque",
      VALORES_SAQUE
    ),
  }));

  const seriesRecepcion = comparadosData.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    color: s.color,
    promedios: calcularPromedioPonderadoPorSet(
      s.id,
      acciones,
      idsJugadores,
      "recepcion",
      VALORES_RECEPCION
    ),
  }));

  const seriesBloqueo = comparadosData.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    color: s.color,
    promedios: calcularPromedioPonderadoPorSet(
      s.id,
      acciones,
      idsJugadores,
      "bloqueo",
      VALORES_BLOQUEO
    ),
  }));

  const seriesArmados = comparadosData.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    color: s.color,
    promedios: calcularPromedioArmadosPonderadoPorSet(
      s.id,
      acciones,
      idsJugadores
    ),
  }));

  if (jugadores.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
        <p className="text-4xl mb-3">👥</p>
        <p className="text-slate-600 font-medium">
          {nombreEquipo} todavía no tiene jugadores cargados
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toggle de modo */}
      <div className="flex justify-end gap-2">
        <button
          onClick={() => handleToggleModo("individual")}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition border ${
            modo === "individual"
              ? "bg-emerald-500 text-white border-emerald-500"
              : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
          }`}
        >
          👤 Ver jugador
        </button>
        <button
          onClick={() => handleToggleModo("comparar")}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition border ${
            modo === "comparar"
              ? "bg-emerald-500 text-white border-emerald-500"
              : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
          }`}
        >
          ⚖️ Comparar ({comparados.length}/3)
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Panel izquierdo: plantel */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 col-span-1">
          <h3 className="font-semibold text-slate-800 mb-3">
            {modo === "individual" ? "Plantel" : "Elegí hasta 3 jugadores"}
          </h3>
          {modo === "comparar" && (
            <p className="text-xs text-slate-500 mb-3">
              Armadores con armadores, jugadores de cancha con jugadores de cancha.
            </p>
          )}
          <div className="space-y-1">
            {jugadores.map((j) => {
              const est = porJugador[j.id];
              const accionesJ = est?.totalAcciones ?? 0;
              const colorIdx = comparados.indexOf(j.id);
              const seleccionadoIndividual =
                modo === "individual" && jugadorSeleccionado === j.id;

              // En modo comparar, no permitir click si es rol distinto al primero
              let bloqueado = false;
              if (modo === "comparar" && comparados.length > 0 && colorIdx === -1) {
                const primerSel = jugadores.find(
                  (x) => x.id === comparados[0]
                );
                const ambosArm =
                  primerSel?.rol === "armador" && j.rol === "armador";
                const ambosNorm =
                  primerSel?.rol !== "armador" && j.rol !== "armador";
                bloqueado = !ambosArm && !ambosNorm;
              }
              const puedeAgregarMas =
                modo === "comparar" &&
                comparados.length >= 3 &&
                colorIdx === -1;

              return (
                <button
                  key={j.id}
                  onClick={() =>
                    modo === "individual"
                      ? setJugadorSeleccionado(j.id)
                      : handleClickComparar(j.id)
                  }
                  disabled={bloqueado || puedeAgregarMas}
                  className={`w-full flex items-center gap-3 text-left px-3 py-2 rounded-lg transition text-sm ${
                    seleccionadoIndividual
                      ? "bg-emerald-500 text-white"
                      : colorIdx !== -1
                      ? "text-white"
                      : bloqueado || puedeAgregarMas
                      ? "bg-slate-50 text-slate-300 cursor-not-allowed opacity-50"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-700"
                  }`}
                  style={
                    colorIdx !== -1
                      ? { backgroundColor: COLORES_COMPARACION[colorIdx] }
                      : undefined
                  }
                >
                  <span className="relative">
                    <ImagenAmpliable
                      src={j.imagen_url}
                      alt={j.nombre}
                      inicial={j.nombre.charAt(0).toUpperCase()}
                      tamaño="sm"
                    />
                    {colorIdx !== -1 && (
                      <span
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center border-2 border-white"
                        style={{ backgroundColor: COLORES_COMPARACION[colorIdx] }}
                      >
                        {colorIdx + 1}
                      </span>
                    )}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="font-medium block truncate">
                      {j.nombre}
                      {j.numero !== null && ` #${j.numero}`}
                    </span>
                    {j.rol === "armador" && (
                      <span
                        className={`block text-xs ${
                          seleccionadoIndividual || colorIdx !== -1
                            ? "text-white/90"
                            : "text-violet-600"
                        }`}
                      >
                        Armador
                      </span>
                    )}
                    <span
                      className={`block text-xs ${
                        seleccionadoIndividual || colorIdx !== -1
                          ? "text-white/80"
                          : "text-slate-400"
                      }`}
                    >
                      {accionesJ} acciones
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Panel derecho */}
        <div className="col-span-2">
          {modo === "individual" ? (
            !jugadorSeleccionado || !jugadorActual || !datosJugador ? (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center h-full flex items-center justify-center">
                <div>
                  <p className="text-4xl mb-3">👈</p>
                  <p className="text-slate-600 font-medium">
                    Elegí un jugador para ver su perfil
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-200">
                  <ImagenAmpliable
                    src={datosJugador.imagen_url}
                    alt={datosJugador.nombre}
                    inicial={datosJugador.nombre.charAt(0).toUpperCase()}
                    tamaño="lg"
                  />
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-slate-900">
                      {datosJugador.nombre}
                    </h3>
                    {datosJugador.numero !== null && (
                      <p className="text-slate-500">
                        #{datosJugador.numero}
                      </p>
                    )}
                    <p className="text-sm text-slate-500 mt-1">
                      {nombreEquipo}
                    </p>
                    {esArmador && (
                      <span className="inline-block mt-1 text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
                        Armador
                      </span>
                    )}
                  </div>
                </div>

                <div className="mb-6">
                  <h4 className="font-semibold text-slate-800 mb-3">
                    Perfil de rendimiento
                  </h4>
                  <RadarJugador
                    jugador={jugadorActual}
                    esArmador={esArmador}
                  />
                </div>

                {Object.keys(jugadorActual.valoracionPonderadaPorFundamento)
                  .length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-semibold text-slate-800 mb-3">
                      Valoración ponderada por fundamento
                    </h4>
                    <div className="grid grid-cols-5 gap-2">
                      {Object.entries(
                        jugadorActual.valoracionPonderadaPorFundamento
                      ).map(([fund, val]) => {
                        const puesto =
                          podios[jugadorActual.jugador_id]?.[fund];
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
                    <h4 className="font-semibold text-slate-800 mb-3">
                      Sus números en el plantel
                    </h4>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg divide-y divide-slate-200">
                      {ORDEN_RANKINGS.map((r) => {
                        const texto = textosRanking[r.id];
                        const puesto =
                          podios[jugadorActual.jugador_id]?.[r.id];
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

                {esArmador && jugadorActual.armador && (
                  <div className="mb-6 grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                      <GraficoSaquePorSet
                        promedios={calcularPromedioPonderadoPorSet(
                          jugadorActual.jugador_id,
                          acciones,
                          idsJugadores,
                          "saque",
                          VALORES_SAQUE
                        )}
                      />
                    </div>
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                      <GraficoBloqueoPorSet
                        promedios={calcularPromedioPonderadoPorSet(
                          jugadorActual.jugador_id,
                          acciones,
                          idsJugadores,
                          "bloqueo",
                          VALORES_BLOQUEO
                        )}
                      />
                    </div>
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                      <GraficoArmadosPorSet
                        promedios={calcularPromedioArmadosPonderadoPorSet(
                          jugadorActual.jugador_id,
                          acciones,
                          idsJugadores
                        )}
                      />
                    </div>
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                      <MapaCalorTendencia
                        distribucion={
                          jugadorActual.armador.distribucionTendencia
                        }
                      />
                    </div>
                  </div>
                )}

                {!esArmador && (
                  <div className="mb-6 grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                      <GraficoSaquePorSet
                        promedios={calcularPromedioPonderadoPorSet(
                          jugadorActual.jugador_id,
                          acciones,
                          idsJugadores,
                          "saque",
                          VALORES_SAQUE
                        )}
                      />
                    </div>
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                      <GraficoRecepcionPorSet
                        promedios={calcularPromedioPonderadoPorSet(
                          jugadorActual.jugador_id,
                          acciones,
                          idsJugadores,
                          "recepcion",
                          VALORES_RECEPCION
                        )}
                      />
                    </div>
                    <div className="col-span-2 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                      <GraficoBloqueoPorSet
                        promedios={calcularPromedioPonderadoPorSet(
                          jugadorActual.jugador_id,
                          acciones,
                          idsJugadores,
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
                        jugadorActual.saldoTotal > 0
                          ? "text-green-700"
                          : jugadorActual.saldoTotal < 0
                          ? "text-red-700"
                          : "text-slate-700"
                      }`}
                    >
                      {jugadorActual.saldoTotal > 0 ? "+" : ""}
                      {jugadorActual.saldoTotal}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                    <p className="text-xs text-slate-500 uppercase">
                      Saldo Defensivo
                    </p>
                    <p
                      className={`text-2xl font-bold ${
                        jugadorActual.saldoDefensivo > 0
                          ? "text-green-700"
                          : jugadorActual.saldoDefensivo < 0
                          ? "text-red-700"
                          : "text-slate-700"
                      }`}
                    >
                      {jugadorActual.saldoDefensivo > 0 ? "+" : ""}
                      {jugadorActual.saldoDefensivo}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                    <p className="text-xs text-slate-500 uppercase">
                      Valoración Media
                    </p>
                    <p
                      className={`text-2xl font-bold ${
                        jugadorActual.valoracionMediaNormalizada > 0
                          ? "text-green-700"
                          : jugadorActual.valoracionMediaNormalizada < 0
                          ? "text-red-700"
                          : "text-slate-700"
                      }`}
                    >
                      {jugadorActual.valoracionMediaNormalizada > 0 ? "+" : ""}
                      {jugadorActual.valoracionMediaNormalizada.toFixed(2)}
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                    <p className="text-xs text-slate-500 uppercase">
                      Acciones
                    </p>
                    <p className="text-2xl font-bold text-slate-800">
                      {jugadorActual.totalAcciones}
                    </p>
                  </div>
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                    <p className="text-xs text-green-700 uppercase">Puntos</p>
                    <p className="text-2xl font-bold text-green-800">
                      {jugadorActual.totalPuntos}
                    </p>
                  </div>
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-center">
                    <p className="text-xs text-red-700 uppercase">Errores</p>
                    <p className="text-2xl font-bold text-red-800">
                      {jugadorActual.totalErrores}
                    </p>
                  </div>
                </div>
              </div>
            )
          ) : (
            // MODO COMPARAR
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              {comparadosData.length === 0 ? (
                <div className="p-12 text-center h-full flex items-center justify-center">
                  <div>
                    <p className="text-4xl mb-3">⚖️</p>
                    <p className="text-slate-600 font-medium">
                      Elegí hasta 3 jugadores del plantel para comparar
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Leyenda */}
                  <div className="mb-6 pb-4 border-b border-slate-200">
                    <h3 className="text-xl font-bold text-slate-900 mb-3">
                      Comparando{" "}
                      {comparadosData.length === 1
                        ? "1 jugador"
                        : `${comparadosData.length} jugadores`}
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      {comparadosData.map((s) => (
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

                  {/* Radar */}
                  <div className="mb-6">
                    <h4 className="font-semibold text-slate-800 mb-3">
                      Radar comparativo
                    </h4>
                    <RadarJugador
                      series={seriesRadar}
                      esArmador={esComparacionArmador}
                    />
                  </div>

                  {/* Gráficos por set */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                      <GraficoSaquePorSet series={seriesSaque} />
                    </div>

                    {!esComparacionArmador && (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                        <GraficoRecepcionPorSet series={seriesRecepcion} />
                      </div>
                    )}

                    {esComparacionArmador && (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                        <GraficoArmadosPorSet series={seriesArmados} />
                      </div>
                    )}

                    <div
                      className={`p-4 bg-slate-50 border border-slate-200 rounded-lg ${
                        esComparacionArmador ? "" : "col-span-2"
                      }`}
                    >
                      <GraficoBloqueoPorSet series={seriesBloqueo} />
                    </div>
                  </div>

                  {/* Stats resumen por jugador */}
                  <div className="mt-6 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-slate-500 border-b border-slate-200">
                          <th className="py-2 px-3">Jugador</th>
                          <th className="py-2 px-3 text-right">Acciones</th>
                          <th className="py-2 px-3 text-right">Puntos</th>
                          <th className="py-2 px-3 text-right">Errores</th>
                          <th className="py-2 px-3 text-right">Saldo</th>
                          <th className="py-2 px-3 text-right">Val. Media</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparadosData.map((s) => {
                          const est = s.jugador;
                          return (
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
                              <td
                                className={`py-2 px-3 text-right font-semibold ${
                                  est.valoracionMediaNormalizada > 0
                                    ? "text-green-700"
                                    : est.valoracionMediaNormalizada < 0
                                    ? "text-red-700"
                                    : "text-slate-600"
                                }`}
                              >
                                {est.valoracionMediaNormalizada > 0 ? "+" : ""}
                                {est.valoracionMediaNormalizada.toFixed(2)}
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