"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { obtenerSesion, cerrarSesion, type Sesion } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type Seccion = "equipos" | "jugadores" | "partidos" | "codigos";

interface Equipo {
  id: string;
  nombre: string;
  logo_url: string | null;
}

export default function AdminPage() {
  const router = useRouter();
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [seccion, setSeccion] = useState<Seccion>("equipos");

  // Estado equipos
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [cargandoEquipos, setCargandoEquipos] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [creando, setCreando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombreEditando, setNombreEditando] = useState("");

  useEffect(() => {
    const s = obtenerSesion();
    if (!s || s.tipo !== "admin") {
      router.push("/");
      return;
    }
    setSesion(s);
  }, [router]);

  const cargarEquipos = async () => {
    setCargandoEquipos(true);
    const { data, error } = await supabase
      .from("equipos")
      .select("*")
      .order("nombre");
    setCargandoEquipos(false);
    if (!error && data) setEquipos(data);
  };

  useEffect(() => {
    if (sesion && seccion === "equipos") {
      cargarEquipos();
    }
  }, [sesion, seccion]);

  const handleCerrar = () => {
    cerrarSesion();
    router.push("/");
  };

  const crearEquipo = async () => {
    const nombre = nombreNuevo.trim();
    if (!nombre) return;

    setCreando(true);
    const { error } = await supabase.from("equipos").insert({ nombre });
    setCreando(false);

    if (error) {
      alert("Error al crear: " + error.message);
      return;
    }

    setNombreNuevo("");
    cargarEquipos();
  };

  const guardarEdicion = async (id: string) => {
    const nombre = nombreEditando.trim();
    if (!nombre) return;

    const { error } = await supabase
      .from("equipos")
      .update({ nombre })
      .eq("id", id);

    if (error) {
      alert("Error al editar: " + error.message);
      return;
    }

    setEditandoId(null);
    setNombreEditando("");
    cargarEquipos();
  };

  const borrarEquipo = async (id: string, nombre: string) => {
    if (!confirm(`¿Borrar el equipo "${nombre}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    const { error } = await supabase.from("equipos").delete().eq("id", id);

    if (error) {
      alert("Error al borrar: " + error.message);
      return;
    }

    cargarEquipos();
  };

  if (!sesion) return null;

  const secciones: { id: Seccion; nombre: string; icono: string }[] = [
    { id: "equipos", nombre: "Equipos", icono: "🏐" },
    { id: "jugadores", nombre: "Jugadores", icono: "👤" },
    { id: "partidos", nombre: "Partidos", icono: "📅" },
    { id: "codigos", nombre: "Códigos", icono: "🔑" },
  ];

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              🏐 Panel de Admin
            </h1>
            <p className="text-slate-500 text-sm mt-1">Bienvenido admin</p>
          </div>
          <button
            onClick={handleCerrar}
            className="px-4 py-2 text-sm bg-slate-200 hover:bg-slate-300 rounded-lg transition"
          >
            Cerrar sesión
          </button>
        </div>

        {/* Pestañas */}
        <div className="flex gap-2 mb-6 border-b border-slate-200">
          {secciones.map((s) => (
            <button
              key={s.id}
              onClick={() => setSeccion(s.id)}
              className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
                seccion === s.id
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {s.icono} {s.nombre}
            </button>
          ))}
        </div>

        {/* Contenido */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          {seccion === "equipos" && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-slate-900">
                  Equipos
                </h2>
              </div>

              {/* Formulario nuevo equipo */}
              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  value={nombreNuevo}
                  onChange={(e) => setNombreNuevo(e.target.value)}
                  placeholder="Nombre del nuevo equipo"
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") crearEquipo();
                  }}
                />
                <button
                  onClick={crearEquipo}
                  disabled={creando || !nombreNuevo.trim()}
                  className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 text-white font-medium rounded-lg transition"
                >
                  {creando ? "Creando..." : "+ Agregar"}
                </button>
              </div>

              {/* Lista */}
              {cargandoEquipos ? (
                <p className="text-slate-500 text-center py-8">
                  Cargando equipos...
                </p>
              ) : equipos.length === 0 ? (
                <p className="text-slate-500 text-center py-8">
                  No hay equipos todavía. Creá el primero arriba. 🏐
                </p>
              ) : (
                <div className="space-y-2">
                  {equipos.map((eq) => (
                    <div
                      key={eq.id}
                      className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200"
                    >
                      {editandoId === eq.id ? (
                        <>
                          <input
                            type="text"
                            value={nombreEditando}
                            onChange={(e) => setNombreEditando(e.target.value)}
                            className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") guardarEdicion(eq.id);
                              if (e.key === "Escape") {
                                setEditandoId(null);
                                setNombreEditando("");
                              }
                            }}
                          />
                          <button
                            onClick={() => guardarEdicion(eq.id)}
                            className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg transition"
                          >
                            Guardar
                          </button>
                          <button
                            onClick={() => {
                              setEditandoId(null);
                              setNombreEditando("");
                            }}
                            className="px-3 py-1.5 bg-slate-300 hover:bg-slate-400 text-slate-700 text-sm rounded-lg transition"
                          >
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 font-medium text-slate-800">
                            🏐 {eq.nombre}
                          </span>
                          <button
                            onClick={() => {
                              setEditandoId(eq.id);
                              setNombreEditando(eq.nombre);
                            }}
                            className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm rounded-lg transition"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => borrarEquipo(eq.id, eq.nombre)}
                            className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-sm rounded-lg transition"
                          >
                            Borrar
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {seccion === "jugadores" && (
            <div className="text-center py-12">
              <p className="text-4xl mb-4">👤</p>
              <p className="text-slate-600 font-medium mb-2">
                Gestión de Jugadores
              </p>
              <p className="text-slate-500 text-sm">
                🚧 En construcción — Sección 3
              </p>
            </div>
          )}

          {seccion === "partidos" && (
            <div className="text-center py-12">
              <p className="text-4xl mb-4">📅</p>
              <p className="text-slate-600 font-medium mb-2">
                Gestión de Partidos
              </p>
              <p className="text-slate-500 text-sm">
                🚧 En construcción — Sección 4
              </p>
            </div>
          )}

          {seccion === "codigos" && (
            <div className="text-center py-12">
              <p className="text-4xl mb-4">🔑</p>
              <p className="text-slate-600 font-medium mb-2">
                Gestión de Códigos
              </p>
              <p className="text-slate-500 text-sm">
                🚧 En construcción — Sección 5
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}