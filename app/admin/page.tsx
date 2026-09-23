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

interface Jugador {
  id: string;
  nombre: string;
  numero: number | null;
  imagen_url: string | null;
}

interface JugadorEquipo {
  id: string;
  jugador_id: string;
  equipo_id: string;
  activo: boolean;
}

export default function AdminPage() {
  const router = useRouter();
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [seccion, setSeccion] = useState<Seccion>("equipos");

  // Equipos
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [cargandoEquipos, setCargandoEquipos] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [creandoEquipo, setCreandoEquipo] = useState(false);
  const [editandoEquipoId, setEditandoEquipoId] = useState<string | null>(null);
  const [nombreEditandoEquipo, setNombreEditandoEquipo] = useState("");

  // Jugadores
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [asignaciones, setAsignaciones] = useState<JugadorEquipo[]>([]);
  const [cargandoJugadores, setCargandoJugadores] = useState(false);
  const [nombreNuevoJug, setNombreNuevoJug] = useState("");
  const [numeroNuevoJug, setNumeroNuevoJug] = useState("");
  const [imagenNuevaJug, setImagenNuevaJug] = useState("");
  const [equipoNuevoJug, setEquipoNuevoJug] = useState("");
  const [creandoJugador, setCreandoJugador] = useState(false);
  const [editandoJugId, setEditandoJugId] = useState<string | null>(null);
  const [editNombreJug, setEditNombreJug] = useState("");
  const [editNumeroJug, setEditNumeroJug] = useState("");
  const [editImagenJug, setEditImagenJug] = useState("");
  const [editEquipoJug, setEditEquipoJug] = useState("");

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

  const cargarJugadores = async () => {
    setCargandoJugadores(true);
    const [jugRes, asigRes] = await Promise.all([
      supabase.from("jugadores").select("*").order("nombre"),
      supabase.from("jugador_equipo").select("*").eq("activo", true),
    ]);
    setCargandoJugadores(false);
    if (!jugRes.error && jugRes.data) setJugadores(jugRes.data);
    if (!asigRes.error && asigRes.data) setAsignaciones(asigRes.data);
  };

  useEffect(() => {
    if (!sesion) return;
    if (seccion === "equipos") cargarEquipos();
    if (seccion === "jugadores") {
      cargarEquipos();
      cargarJugadores();
    }
  }, [sesion, seccion]);

  const handleCerrar = () => {
    cerrarSesion();
    router.push("/");
  };

  // ========== EQUIPOS ==========
  const crearEquipo = async () => {
    const nombre = nombreNuevo.trim();
    if (!nombre) return;
    setCreandoEquipo(true);
    const { error } = await supabase.from("equipos").insert({ nombre });
    setCreandoEquipo(false);
    if (error) {
      alert("Error al crear: " + error.message);
      return;
    }
    setNombreNuevo("");
    cargarEquipos();
  };

  const guardarEdicionEquipo = async (id: string) => {
    const nombre = nombreEditandoEquipo.trim();
    if (!nombre) return;
    const { error } = await supabase
      .from("equipos")
      .update({ nombre })
      .eq("id", id);
    if (error) {
      alert("Error al editar: " + error.message);
      return;
    }
    setEditandoEquipoId(null);
    setNombreEditandoEquipo("");
    cargarEquipos();
  };

  const borrarEquipo = async (id: string, nombre: string) => {
    if (!confirm(`¿Borrar el equipo "${nombre}"?`)) return;
    const { error } = await supabase.from("equipos").delete().eq("id", id);
    if (error) {
      alert("Error al borrar: " + error.message);
      return;
    }
    cargarEquipos();
  };

  // ========== JUGADORES ==========
  const crearJugador = async () => {
    const nombre = nombreNuevoJug.trim();
    if (!nombre) return;

    setCreandoJugador(true);

    const { data, error } = await supabase
      .from("jugadores")
      .insert({
        nombre,
        numero: numeroNuevoJug ? parseInt(numeroNuevoJug) : null,
        imagen_url: imagenNuevaJug.trim() || null,
      })
      .select()
      .single();

    if (error || !data) {
      setCreandoJugador(false);
      alert("Error al crear jugador: " + (error?.message ?? "desconocido"));
      return;
    }

    if (equipoNuevoJug) {
      const { error: errAsig } = await supabase
        .from("jugador_equipo")
        .insert({ jugador_id: data.id, equipo_id: equipoNuevoJug });
      if (errAsig) {
        alert("Jugador creado, pero falló la asignación: " + errAsig.message);
      }
    }

    setCreandoJugador(false);
    setNombreNuevoJug("");
    setNumeroNuevoJug("");
    setImagenNuevaJug("");
    setEquipoNuevoJug("");
    cargarJugadores();
  };

  const guardarEdicionJugador = async (id: string) => {
    const nombre = editNombreJug.trim();
    if (!nombre) return;

    const { error } = await supabase
      .from("jugadores")
      .update({
        nombre,
        numero: editNumeroJug ? parseInt(editNumeroJug) : null,
        imagen_url: editImagenJug.trim() || null,
      })
      .eq("id", id);

    if (error) {
      alert("Error al editar: " + error.message);
      return;
    }

    // Actualizar asignación: borrar las viejas y crear la nueva
    await supabase.from("jugador_equipo").delete().eq("jugador_id", id);

    if (editEquipoJug) {
      const { error: errAsig } = await supabase
        .from("jugador_equipo")
        .insert({ jugador_id: id, equipo_id: editEquipoJug });
      if (errAsig) {
        alert("Editado, pero falló la asignación: " + errAsig.message);
      }
    }

    setEditandoJugId(null);
    cargarJugadores();
  };

  const borrarJugador = async (id: string, nombre: string) => {
    if (!confirm(`¿Borrar a "${nombre}"? Se borrarán todas sus asignaciones.`)) return;
    const { error } = await supabase.from("jugadores").delete().eq("id", id);
    if (error) {
      alert("Error al borrar: " + error.message);
      return;
    }
    cargarJugadores();
  };

  const nombreEquipoDe = (jugadorId: string) => {
    const asig = asignaciones.find((a) => a.jugador_id === jugadorId);
    if (!asig) return null;
    const eq = equipos.find((e) => e.id === asig.equipo_id);
    return eq?.nombre ?? null;
  };

  const idEquipoDe = (jugadorId: string) => {
    const asig = asignaciones.find((a) => a.jugador_id === jugadorId);
    return asig?.equipo_id ?? "";
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

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          {/* ============ EQUIPOS ============ */}
          {seccion === "equipos" && (
            <div>
              <h2 className="text-xl font-semibold text-slate-900 mb-6">
                Equipos
              </h2>

              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  value={nombreNuevo}
                  onChange={(e) => setNombreNuevo(e.target.value)}
                  placeholder="Nombre del nuevo equipo"
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                  onKeyDown={(e) => e.key === "Enter" && crearEquipo()}
                />
                <button
                  onClick={crearEquipo}
                  disabled={creandoEquipo || !nombreNuevo.trim()}
                  className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 text-white font-medium rounded-lg transition"
                >
                  {creandoEquipo ? "Creando..." : "+ Agregar"}
                </button>
              </div>

              {cargandoEquipos ? (
                <p className="text-slate-500 text-center py-8">Cargando...</p>
              ) : equipos.length === 0 ? (
                <p className="text-slate-500 text-center py-8">
                  No hay equipos. Creá el primero. 🏐
                </p>
              ) : (
                <div className="space-y-2">
                  {equipos.map((eq) => (
                    <div
                      key={eq.id}
                      className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200"
                    >
                      {editandoEquipoId === eq.id ? (
                        <>
                          <input
                            type="text"
                            value={nombreEditandoEquipo}
                            onChange={(e) =>
                              setNombreEditandoEquipo(e.target.value)
                            }
                            className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter")
                                guardarEdicionEquipo(eq.id);
                              if (e.key === "Escape") setEditandoEquipoId(null);
                            }}
                          />
                          <button
                            onClick={() => guardarEdicionEquipo(eq.id)}
                            className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg"
                          >
                            Guardar
                          </button>
                          <button
                            onClick={() => setEditandoEquipoId(null)}
                            className="px-3 py-1.5 bg-slate-300 hover:bg-slate-400 text-slate-700 text-sm rounded-lg"
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
                              setEditandoEquipoId(eq.id);
                              setNombreEditandoEquipo(eq.nombre);
                            }}
                            className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm rounded-lg"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => borrarEquipo(eq.id, eq.nombre)}
                            className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-sm rounded-lg"
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

          {/* ============ JUGADORES ============ */}
          {seccion === "jugadores" && (
            <div>
              <h2 className="text-xl font-semibold text-slate-900 mb-6">
                Jugadores
              </h2>

              {equipos.length === 0 && (
                <p className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  ⚠️ Primero creá al menos un equipo en la pestaña "Equipos".
                </p>
              )}

              <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <p className="text-sm font-medium text-slate-700 mb-2">
                  Nuevo jugador
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={nombreNuevoJug}
                    onChange={(e) => setNombreNuevoJug(e.target.value)}
                    placeholder="Nombre"
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="number"
                    value={numeroNuevoJug}
                    onChange={(e) => setNumeroNuevoJug(e.target.value)}
                    placeholder="Número (opcional)"
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="text"
                    value={imagenNuevaJug}
                    onChange={(e) => setImagenNuevaJug(e.target.value)}
                    placeholder="URL de imagen (opcional)"
                    className="col-span-2 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                  <select
                    value={equipoNuevoJug}
                    onChange={(e) => setEquipoNuevoJug(e.target.value)}
                    className="col-span-2 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Sin equipo asignado</option>
                    {equipos.map((eq) => (
                      <option key={eq.id} value={eq.id}>
                        {eq.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={crearJugador}
                  disabled={creandoJugador || !nombreNuevoJug.trim()}
                  className="w-full mt-2 px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 text-white font-medium rounded-lg transition"
                >
                  {creandoJugador ? "Creando..." : "+ Agregar jugador"}
                </button>
              </div>

              {cargandoJugadores ? (
                <p className="text-slate-500 text-center py-8">Cargando...</p>
              ) : jugadores.length === 0 ? (
                <p className="text-slate-500 text-center py-8">
                  No hay jugadores. Creá el primero arriba. 👤
                </p>
              ) : (
                <div className="space-y-2">
                  {jugadores.map((jug) => {
                    const equipoNombre = nombreEquipoDe(jug.id);
                    return (
                      <div
                        key={jug.id}
                        className="p-3 bg-slate-50 rounded-lg border border-slate-200"
                      >
                        {editandoJugId === jug.id ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editNombreJug}
                              onChange={(e) => setEditNombreJug(e.target.value)}
                              placeholder="Nombre"
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="number"
                                value={editNumeroJug}
                                onChange={(e) =>
                                  setEditNumeroJug(e.target.value)
                                }
                                placeholder="Número"
                                className="px-3 py-2 border border-slate-300 rounded-lg"
                              />
                              <select
                                value={editEquipoJug}
                                onChange={(e) =>
                                  setEditEquipoJug(e.target.value)
                                }
                                className="px-3 py-2 border border-slate-300 rounded-lg"
                              >
                                <option value="">Sin equipo</option>
                                {equipos.map((eq) => (
                                  <option key={eq.id} value={eq.id}>
                                    {eq.nombre}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <input
                              type="text"
                              value={editImagenJug}
                              onChange={(e) =>
                                setEditImagenJug(e.target.value)
                              }
                              placeholder="URL de imagen"
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                            />
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => guardarEdicionJugador(jug.id)}
                                className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg"
                              >
                                Guardar
                              </button>
                              <button
                                onClick={() => setEditandoJugId(null)}
                                className="px-3 py-1.5 bg-slate-300 hover:bg-slate-400 text-slate-700 text-sm rounded-lg"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <span className="flex-1 font-medium text-slate-800">
                              👤 {jug.nombre}
                              {jug.numero !== null && (
                                <span className="text-slate-500 font-normal">
                                  {" "}
                                  #{jug.numero}
                                </span>
                              )}
                              {equipoNombre && (
                                <span className="text-slate-500 text-sm font-normal">
                                  {" "}
                                  · {equipoNombre}
                                </span>
                              )}
                            </span>
                            <button
                              onClick={() => {
                                setEditandoJugId(jug.id);
                                setEditNombreJug(jug.nombre);
                                setEditNumeroJug(
                                  jug.numero !== null ? String(jug.numero) : ""
                                );
                                setEditImagenJug(jug.imagen_url ?? "");
                                setEditEquipoJug(idEquipoDe(jug.id));
                              }}
                              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm rounded-lg"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => borrarJugador(jug.id, jug.nombre)}
                              className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-sm rounded-lg"
                            >
                              Borrar
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
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