"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  calcularEstadisticasEquipo,
  calcularPromedioPonderadoPorSet,
  calcularPromedioArmadosPonderadoPorSet,
  VALORES_SAQUE,
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

export default function MiEquipo({ equipoId, nombreEquipo }: Props) {
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [acciones, setAcciones] = useState<AccionDB[]>([]);
  const [jugadorSeleccionado, setJugadorSeleccionado] = useState<string | null>(
    null
  );
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

  const jugadorActual: EstadisticasJugador | null = jugadorSeleccionado
    ? porJugador[jugadorSeleccionado] ?? null
    : null;
  const datosJugador = jugadores.find((j) => j.id === jugadorSeleccionado);
  const esArmador = datosJugador?.rol === "armador";

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
    <div className="grid grid-cols-3 gap-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 col-span-1">
        <h3 className="font-semibold text-slate-800 mb-3">Plantel</h3>
        <div className="space-y-1">
          {jugadores.map((j) => {
            const est = porJugador[j.id];
            const accionesJ = est?.totalAcciones ?? 0;
            return (
              <button
                key={j.id}
                onClick={() => setJugadorSeleccionado(j.id)}
                className={`w-full flex items-center gap-3 text-left px-3 py-2 rounded-lg transition text-sm ${
                  jugadorSeleccionado === j.id
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-700"
                }`}
              >
                <ImagenAmpliable
                  src={j.imagen_url}
                  alt={j.nombre}
                  inicial={j.nombre.charAt(0).toUpperCase()}
                  tamaño="sm"
                />
                <span className="flex-1 min-w-0">
                  <span className="font-medium block truncate">
                    {j.nombre}
                    {j.numero !== null && ` #${j.numero}`}
                  </span>
                  {j.rol === "armador" && (
                    <span
                      className={`block text-xs ${
                        jugadorSeleccionado === j.id
                          ? "text-emerald-100"
                          : "text-violet-600"
                      }`}
                    >
                      Armador
                    </span>
                  )}
                  <span
                    className={`block text-xs ${
                      jugadorSeleccionado === j.id
                        ? "text-emerald-100"
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

      <div className="col-span-2">
        {!jugadorSeleccionado || !jugadorActual || !datosJugador ? (
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
                  <p className="text-slate-500">#{datosJugador.numero}</p>
                )}
                <p className="text-sm text-slate-500 mt-1">{nombreEquipo}</p>
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
                todosJugadores={Object.values(porJugador)}
                esArmador={esArmador}
              />
            </div>

            {Object.keys(jugadorActual.valoracionPonderadaPorFundamento).length >
              0 && (
              <div className="mb-6">
                <h4 className="font-semibold text-slate-800 mb-3">
                  Valoración ponderada por fundamento
                </h4>
                <div className="grid grid-cols-5 gap-2">
                  {Object.entries(
                    jugadorActual.valoracionPonderadaPorFundamento
                  ).map(([fund, val]) => (
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
                        {val.toFixed(2)}
                      </p>
                    </div>
                  ))}
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
                    distribucion={jugadorActual.armador.distribucionTendencia}
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
                      {
                        "2x_positiva": 5,
                        positiva: 4,
                        negativa: 3,
                        "2x_negativa": 2,
                        "3x_negativa": 1,
                        ace_contra: 0,
                      }
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
                <p className="text-xs text-slate-500 uppercase">Acciones</p>
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
        )}
      </div>
    </div>
  );
}