"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  calcularEstadisticasEquipo,
  type AccionDB,
  type EstadisticasJugador,
} from "@/lib/estadisticas";
import RadarJugador from "./RadarJugador";

interface Jugador {
  id: string;
  nombre: string;
  numero: number | null;
  imagen_url: string | null;
}

interface Props {
  equipoId: string;
  nombreEquipo: string;
}

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
  const { porJugador, totales } = calcularEstadisticasEquipo(
    idsJugadores,
    acciones
  );

  const jugadorActual: EstadisticasJugador | null = jugadorSeleccionado
    ? porJugador[jugadorSeleccionado] ?? null
    : null;
  const datosJugador = jugadores.find((j) => j.id === jugadorSeleccionado);

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
      {/* Lista de jugadores */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 col-span-1">
        <h3 className="font-semibold text-slate-800 mb-3">Plantel</h3>
        <div className="space-y-1">
          {jugadores.map((j) => {
            const est = porJugador[j.id];
            const acciones = est?.totalAcciones ?? 0;
            return (
              <button
                key={j.id}
                onClick={() => setJugadorSeleccionado(j.id)}
                className={`w-full text-left px-3 py-2 rounded-lg transition text-sm ${
                  jugadorSeleccionado === j.id
                    ? "bg-blue-500 text-white"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-700"
                }`}
              >
                <span className="font-medium">
                  {j.nombre}
                  {j.numero !== null && ` #${j.numero}`}
                </span>
                <span
                  className={`block text-xs ${
                    jugadorSeleccionado === j.id
                      ? "text-blue-100"
                      : "text-slate-400"
                  }`}
                >
                  {acciones} acciones
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Perfil */}
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
            {/* Encabezado del jugador */}
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-200">
              {datosJugador.imagen_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={datosJugador.imagen_url}
                  alt={datosJugador.nombre}
                  className="w-20 h-20 rounded-full object-cover border-2 border-slate-200"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-blue-100 border-2 border-blue-200 flex items-center justify-center text-2xl font-bold text-blue-600">
                  {datosJugador.nombre.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-slate-900">
                  {datosJugador.nombre}
                </h3>
                {datosJugador.numero !== null && (
                  <p className="text-slate-500">#{datosJugador.numero}</p>
                )}
                <p className="text-sm text-slate-500 mt-1">{nombreEquipo}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 uppercase">Saldo total</p>
                <p
                  className={`text-3xl font-bold ${
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
            </div>

            {/* Radar */}
            <div className="mb-6">
              <h4 className="font-semibold text-slate-800 mb-3">
                Perfil de rendimiento
              </h4>
              <RadarJugador
                jugador={jugadorActual}
                equipo={totales}
                nombreEquipo={nombreEquipo}
              />
            </div>

            {/* Totales del jugador */}
            <div className="grid grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                <p className="text-xs text-slate-500 uppercase">Acciones</p>
                <p className="text-xl font-bold text-slate-800">
                  {jugadorActual.totalAcciones}
                </p>
              </div>
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                <p className="text-xs text-green-700 uppercase">Puntos</p>
                <p className="text-xl font-bold text-green-800">
                  {jugadorActual.totalPuntos}
                </p>
              </div>
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-center">
                <p className="text-xs text-red-700 uppercase">Errores</p>
                <p className="text-xl font-bold text-red-800">
                  {jugadorActual.totalErrores}
                </p>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                <p className="text-xs text-slate-500 uppercase">Positivas</p>
                <p className="text-xl font-bold text-slate-800">
                  {jugadorActual.totalPositivos}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}