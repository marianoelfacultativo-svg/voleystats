"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { obtenerSesion, cerrarSesion, type Sesion } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  rotacionVacia,
  type RotacionPunto,
} from "@/lib/rotaciones";

import DataEntryV2 from "./DataEntryV2";

interface Equipo { id: string; nombre: string }
interface Jugador { id: string; nombre: string; numero: number | null; rol: string }
interface Partido { id: string; equipo_id: string; rival: string; fecha: string }
interface JugadorEquipo { id: string; jugador_id: string; equipo_id: string; activo: boolean }

export default function DataEntryEquipoPage() {
  const router = useRouter();
  const [sesion, setSesion] = useState<Sesion | null>(null);

  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [asignaciones, setAsignaciones] = useState<JugadorEquipo[]>([]);

  const [equipoId, setEquipoId] = useState("");
  const [partidoId, setPartidoId] = useState("");

  const [cargando, setCargando] = useState(false);

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
      .then(({ data }) => data && setEquipos(data));
  }, [sesion]);

  useEffect(() => {
    if (!equipoId) {
      setPartidos([]);
      setPartidoId("");
      return;
    }
    supabase
      .from("partidos")
      .select("id, equipo_id, rival, fecha")
      .eq("equipo_id", equipoId)
      .order("fecha", { ascending: false })
      .then(({ data }) => data && setPartidos(data));
    setPartidoId("");
  }, [equipoId]);

  useEffect(() => {
    if (!equipoId) {
      setJugadores([]);
      setAsignaciones([]);
      return;
    }
    setCargando(true);
    Promise.all([
      supabase
        .from("jugador_equipo")
        .select("*")
        .eq("equipo_id", equipoId)
        .eq("activo", true),
      supabase.from("jugadores").select("*").order("nombre"),
    ]).then(([a, j]) => {
      setCargando(false);
      if (a.data) setAsignaciones(a.data);
      if (j.data) setJugadores(j.data);
    });
  }, [equipoId]);

  const jugadoresDelEquipo = asignaciones
    .map((a) => jugadores.find((j) => j.id === a.jugador_id))
    .filter((j): j is Jugador => !!j);

  const handleCerrar = () => {
    cerrarSesion();
    router.push("/");
  };

  if (!sesion) return null;

  const noHayPartido = !partidoId;

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <button
              onClick={() => router.push("/admin")}
              className="text-sm text-slate-500 hover:text-slate-700 mb-1"
            >
              ← Volver al panel
            </button>
            <h1 className="text-3xl font-bold text-slate-900">
              🧪 Consola de Data Entry (Equipo)
            </h1>
          </div>
          <button
            onClick={handleCerrar}
            className="px-4 py-2 text-sm bg-slate-200 hover:bg-slate-300 rounded-lg transition"
          >
            Cerrar sesión
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Equipo
              </label>
              <select
                value={equipoId}
                onChange={(e) => setEquipoId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
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
                Partido
              </label>
              <select
                value={partidoId}
                onChange={(e) => setPartidoId(e.target.value)}
                disabled={!equipoId}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg disabled:bg-slate-100"
              >
                <option value="">
                  {equipoId ? "Elegí un partido" : "Primero elegí un equipo"}
                </option>
                {partidos.map((p) => (
                  <option key={p.id} value={p.id}>
                    vs {p.rival} · {p.fecha}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {noHayPartido && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
            <p className="text-5xl mb-4">🧪</p>
            <p className="text-slate-600 font-medium">
              Elegí un equipo y un partido arriba
            </p>
          </div>
        )}

        {!noHayPartido && (
          <div className="bg-white rounded-2xl shadow-sm border-2 border-fuchsia-300 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-fuchsia-800">
                🧪 Consola V2
              </h2>
              <p className="text-xs text-slate-500">
                Consola nueva unificada
              </p>
            </div>
            <DataEntryV2
              key={partidoId}
              partidoId={partidoId}
              equipoId={equipoId}
              nombreMiEquipo={
                equipos.find((e) => e.id === equipoId)?.nombre ?? "Mi equipo"
              }
              nombreRival={
                partidos.find((p) => p.id === partidoId)?.rival ?? "Rival"
              }
              jugadores={jugadoresDelEquipo.map((j) => ({
                id: j.id,
                nombre: j.nombre,
                numero: j.numero,
              }))}
              rotacionInicial={rotacionVacia(1, 1, 1, "propio")}
              equiposDisponibles={equipos.map((e) => ({
                id: e.id,
                nombre: e.nombre,
              }))}
            />
          </div>
        )}
      </div>
    </main>
  );
}