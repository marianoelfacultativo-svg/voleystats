"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { obtenerSesion, cerrarSesion, type Sesion } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import ContadorSaque from "./ContadorSaque";

interface Equipo {
  id: string;
  nombre: string;
}

interface Jugador {
  id: string;
  nombre: string;
  numero: number | null;
}

interface JugadorEquipo {
  id: string;
  jugador_id: string;
  equipo_id: string;
  activo: boolean;
}

interface Partido {
  id: string;
  equipo_id: string;
  rival: string;
  fecha: string;
}

type SetActivo = 1 | 2 | 3 | 4 | 5 | "partido";

// Estructura: datos[jugadorId][setNumero][fundamento][valoracion] = cantidad
type Datos = Record<string, Record<string, Record<string, Record<string, number>>>>;

export default function DataEntryPage() {
  const router = useRouter();
  const [sesion, setSesion] = useState<Sesion | null>(null);

  // Datos
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [asignaciones, setAsignaciones] = useState<JugadorEquipo[]>([]);

  // Selección
  const [equipoId, setEquipoId] = useState("");
  const [partidoId, setPartidoId] = useState("");
  const [jugadorId, setJugadorId] = useState("");
  const [setActivo, setSetActivo] = useState<SetActivo>(1);

  // Datos cargados en memoria
  const [datos, setDatos] = useState<Datos>({});

  // UI
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
      .then(({ data }) => {
        if (data) setEquipos(data);
      });
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
      .then(({ data }) => {
        if (data) setPartidos(data);
      });
    setPartidoId("");
    setJugadorId("");
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
    ]).then(([asigRes, jugRes]) => {
      setCargando(false);
      if (asigRes.data) setAsignaciones(asigRes.data);
      if (jugRes.data) setJugadores(jugRes.data);
    });
    setJugadorId("");
  }, [equipoId]);

  const jugadoresDelEquipo = asignaciones
    .map((a) => jugadores.find((j) => j.id === a.jugador_id))
    .filter((j): j is Jugador => j !== undefined);

  const handleCerrar = () => {
    cerrarSesion();
    router.push("/");
  };

  const volverAlPanel = () => {
    router.push("/admin");
  };

  // Actualizar un valor en los datos
  const setValor = (
    jugId: string,
    set: string,
    fundamento: string,
    valoracion: string,
    cantidad: number
  ) => {
    setDatos((prev) => {
      const copia = { ...prev };
      copia[jugId] = { ...(copia[jugId] ?? {}) };
      copia[jugId][set] = { ...(copia[jugId][set] ?? {}) };
      copia[jugId][set][fundamento] = {
        ...(copia[jugId][set][fundamento] ?? {}),
      };
      copia[jugId][set][fundamento][valoracion] = cantidad;
      return copia;
    });
  };

  // Obtener valores de un fundamento
  const getValores = (
    jugId: string,
    set: string,
    fundamento: string
  ): Record<string, number> => {
    return datos[jugId]?.[set]?.[fundamento] ?? {};
  };

  // Sumar todos los sets para la vista "Partido"
  const getValoresTotales = (
    jugId: string,
    fundamento: string
  ): Record<string, number> => {
    const totales: Record<string, number> = {};
    for (let s = 1; s <= 5; s++) {
      const vals = datos[jugId]?.[String(s)]?.[fundamento] ?? {};
      for (const [k, v] of Object.entries(vals)) {
        totales[k] = (totales[k] ?? 0) + v;
      }
    }
    return totales;
  };

  if (!sesion) return null;

  const setActual = setActivo === "partido" ? "partido" : String(setActivo);

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        {/* Encabezado */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <button
              onClick={volverAlPanel}
              className="text-sm text-slate-500 hover:text-slate-700 mb-1"
            >
              ← Volver al panel
            </button>
            <h1 className="text-3xl font-bold text-slate-900">
              🎯 Consola de Data Entry
            </h1>
          </div>
          <button
            onClick={handleCerrar}
            className="px-4 py-2 text-sm bg-slate-200 hover:bg-slate-300 rounded-lg transition"
          >
            Cerrar sesión
          </button>
        </div>

        {/* Selección de partido */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="grid grid-cols-2 gap-4">
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
                Partido
              </label>
              <select
                value={partidoId}
                onChange={(e) => setPartidoId(e.target.value)}
                disabled={!equipoId}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-slate-100"
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

        {/* Aviso si no hay partido seleccionado */}
        {!partidoId && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
            <p className="text-5xl mb-4">🎯</p>
            <p className="text-slate-600 font-medium mb-2">
              Elegí un equipo y un partido arriba
            </p>
            <p className="text-slate-500 text-sm">
              Ahí se habilita la carga de datos
            </p>
          </div>
        )}

        {/* Consola activa */}
        {partidoId && (
          <>
            {/* Pestañas de set */}
            <div className="flex gap-2 mb-4 border-b border-slate-200">
              {([1, 2, 3, 4, 5, "partido"] as const).map((s) => (
                <button
                  key={String(s)}
                  onClick={() => setSetActivo(s)}
                  className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
                    setActivo === s
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {s === "partido" ? "📊 Partido" : `Set ${s}`}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-4">
              {/* Lista de jugadores */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 col-span-1">
                <h3 className="font-semibold text-slate-800 mb-3">
                  Jugadores
                </h3>

                {cargando ? (
                  <p className="text-sm text-slate-500">Cargando...</p>
                ) : jugadoresDelEquipo.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Este equipo no tiene jugadores asignados.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {jugadoresDelEquipo.map((j) => (
                      <button
                        key={j.id}
                        onClick={() => setJugadorId(j.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg transition text-sm ${
                          jugadorId === j.id
                            ? "bg-blue-500 text-white"
                            : "bg-slate-50 hover:bg-slate-100 text-slate-700"
                        }`}
                      >
                        <span className="font-medium">
                          {j.nombre}
                          {j.numero !== null && ` #${j.numero}`}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Panel de acciones */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 col-span-2">
                {!jugadorId ? (
                  <div className="text-center py-16">
                    <p className="text-4xl mb-3">👈</p>
                    <p className="text-slate-600 font-medium">
                      Elegí un jugador de la izquierda
                    </p>
                    <p className="text-slate-500 text-sm mt-1">
                      Después vas a ver los contadores acá
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="mb-4 pb-4 border-b border-slate-200">
                      <p className="text-sm text-slate-500">Jugador</p>
                      <p className="font-semibold text-slate-800">
                        {
                          jugadoresDelEquipo.find((j) => j.id === jugadorId)
                            ?.nombre
                        }
                      </p>
                      <p className="text-sm text-slate-500 mt-2">
                        Set activo:{" "}
                        <span className="font-medium text-slate-700">
                          {setActivo === "partido"
                            ? "Partido (solo lectura)"
                            : `Set ${setActivo}`}
                        </span>
                      </p>
                    </div>

                    <ContadorSaque
                      valores={
                        setActivo === "partido"
                          ? getValoresTotales(jugadorId, "saque")
                          : getValores(jugadorId, setActual, "saque")
                      }
                      onCambio={(valoracion, cantidad) =>
                        setValor(
                          jugadorId,
                          setActual,
                          "saque",
                          valoracion,
                          cantidad
                        )
                      }
                      soloLectura={setActivo === "partido"}
                    />
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}