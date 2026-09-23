"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { obtenerSesion, cerrarSesion, type Sesion } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import ImagenAmpliable from "../equipo/ImagenAmpliable";

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
  rol: string;
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
  set1: string | null;
  set2: string | null;
  set3: string | null;
  set4: string | null;
  set5: string | null;
  errores_rivales: number | null;
  buenas_rivales: number | null;
  notas: string | null;
}

interface Acceso {
  id: string;
  codigo: string;
  tipo: "admin" | "club" | "jugador";
  equipo_id: string | null;
  jugador_id: string | null;
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
  const [archivoImagenNuevo, setArchivoImagenNuevo] = useState<File | null>(
    null
  );
  const [previewNuevo, setPreviewNuevo] = useState("");
  const [equipoNuevoJug, setEquipoNuevoJug] = useState("");
  const [rolNuevoJug, setRolNuevoJug] = useState<"normal" | "armador">("normal");
  const [creandoJugador, setCreandoJugador] = useState(false);

  const [editandoJugId, setEditandoJugId] = useState<string | null>(null);
  const [editNombreJug, setEditNombreJug] = useState("");
  const [editNumeroJug, setEditNumeroJug] = useState("");
  const [editArchivoImagen, setEditArchivoImagen] = useState<File | null>(null);
  const [editPreview, setEditPreview] = useState("");
  const [editImagenActual, setEditImagenActual] = useState("");
  const [editEquipoJug, setEditEquipoJug] = useState("");
  const [editRolJug, setEditRolJug] = useState<"normal" | "armador">("normal");

  // Partidos
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [cargandoPartidos, setCargandoPartidos] = useState(false);
  const [nuevoPartido, setNuevoPartido] = useState({
    equipo_id: "",
    rival: "",
    fecha: "",
    set1: "",
    set2: "",
    set3: "",
    set4: "",
    set5: "",
    errores_rivales: "",
    buenas_rivales: "",
    notas: "",
  });
  const [creandoPartido, setCreandoPartido] = useState(false);
  const [editandoPartidoId, setEditandoPartidoId] = useState<string | null>(null);
  const [editPartido, setEditPartido] = useState<Partido | null>(null);

  // Códigos
  const [accesos, setAccesos] = useState<Acceso[]>([]);
  const [cargandoAccesos, setCargandoAccesos] = useState(false);
  const [nuevoCodigo, setNuevoCodigo] = useState("");
  const [nuevoTipo, setNuevoTipo] = useState<"club" | "jugador">("club");
  const [nuevoEquipoId, setNuevoEquipoId] = useState("");
  const [nuevoJugadorId, setNuevoJugadorId] = useState("");
  const [creandoCodigo, setCreandoCodigo] = useState(false);

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

  const cargarPartidos = async () => {
    setCargandoPartidos(true);
    const { data, error } = await supabase
      .from("partidos")
      .select("*")
      .order("fecha", { ascending: false });
    setCargandoPartidos(false);
    if (!error && data) setPartidos(data);
  };

  const cargarAccesos = async () => {
    setCargandoAccesos(true);
    const { data, error } = await supabase
      .from("accesos")
      .select("*")
      .order("created_at", { ascending: false });
    setCargandoAccesos(false);
    if (!error && data) setAccesos(data);
  };

  useEffect(() => {
    if (!sesion) return;
    if (seccion === "equipos") cargarEquipos();
    if (seccion === "jugadores") {
      cargarEquipos();
      cargarJugadores();
    }
    if (seccion === "partidos") {
      cargarEquipos();
      cargarPartidos();
    }
    if (seccion === "codigos") {
      cargarEquipos();
      cargarJugadores();
      cargarAccesos();
    }
  }, [sesion, seccion]);

  const handleCerrar = () => {
    cerrarSesion();
    router.push("/");
  };

  const subirImagen = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `jugadores/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${ext}`;

    const { error } = await supabase.storage
      .from("imagenes")
      .upload(path, file);

    if (error) {
      alert("Error al subir imagen: " + error.message);
      return null;
    }

    const { data } = supabase.storage.from("imagenes").getPublicUrl(path);
    return data.publicUrl;
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

    let imagenUrl: string | null = null;
    if (archivoImagenNuevo) {
      imagenUrl = await subirImagen(archivoImagenNuevo);
      if (!imagenUrl) {
        setCreandoJugador(false);
        return;
      }
    }

    const { data, error } = await supabase
      .from("jugadores")
      .insert({
        nombre,
        numero: numeroNuevoJug ? parseInt(numeroNuevoJug) : null,
        imagen_url: imagenUrl,
        rol: rolNuevoJug,
      })
      .select()
      .single();

    if (error || !data) {
      setCreandoJugador(false);
      alert("Error al crear jugador: " + (error?.message ?? "desconocido"));
      return;
    }

    if (equipoNuevoJug) {
      await supabase
        .from("jugador_equipo")
        .insert({ jugador_id: data.id, equipo_id: equipoNuevoJug });
    }

    setCreandoJugador(false);
    setNombreNuevoJug("");
    setNumeroNuevoJug("");
    setArchivoImagenNuevo(null);
    setPreviewNuevo("");
    setEquipoNuevoJug("");
    setRolNuevoJug("normal");
    cargarJugadores();
  };

  const guardarEdicionJugador = async (id: string) => {
    const nombre = editNombreJug.trim();
    if (!nombre) return;

    let imagenUrl: string | null = editImagenActual || null;

    if (editArchivoImagen) {
      const urlSubida = await subirImagen(editArchivoImagen);
      if (!urlSubida) return;
      imagenUrl = urlSubida;
    }

    const { error } = await supabase
      .from("jugadores")
      .update({
        nombre,
        numero: editNumeroJug ? parseInt(editNumeroJug) : null,
        imagen_url: imagenUrl,
        rol: editRolJug,
      })
      .eq("id", id);

    if (error) {
      alert("Error al editar: " + error.message);
      return;
    }

    await supabase.from("jugador_equipo").delete().eq("jugador_id", id);
    if (editEquipoJug) {
      await supabase
        .from("jugador_equipo")
        .insert({ jugador_id: id, equipo_id: editEquipoJug });
    }

    setEditandoJugId(null);
    setEditArchivoImagen(null);
    setEditPreview("");
    cargarJugadores();
  };

  const borrarJugador = async (id: string, nombre: string) => {
    if (!confirm(`¿Borrar a "${nombre}"?`)) return;
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
    return equipos.find((e) => e.id === asig.equipo_id)?.nombre ?? null;
  };

  const idEquipoDe = (jugadorId: string) => {
    return (
      asignaciones.find((a) => a.jugador_id === jugadorId)?.equipo_id ?? ""
    );
  };

  // ========== PARTIDOS ==========
  const crearPartido = async () => {
    if (!nuevoPartido.equipo_id) {
      alert("Elegí un equipo");
      return;
    }
    if (!nuevoPartido.rival.trim()) {
      alert("Ingresá el rival");
      return;
    }
    if (!nuevoPartido.fecha) {
      alert("Elegí la fecha");
      return;
    }
    setCreandoPartido(true);
    const { error } = await supabase.from("partidos").insert({
      equipo_id: nuevoPartido.equipo_id,
      rival: nuevoPartido.rival.trim(),
      fecha: nuevoPartido.fecha,
      set1: nuevoPartido.set1.trim() || null,
      set2: nuevoPartido.set2.trim() || null,
      set3: nuevoPartido.set3.trim() || null,
      set4: nuevoPartido.set4.trim() || null,
      set5: nuevoPartido.set5.trim() || null,
      errores_rivales: nuevoPartido.errores_rivales
        ? parseInt(nuevoPartido.errores_rivales)
        : 0,
      buenas_rivales: nuevoPartido.buenas_rivales
        ? parseInt(nuevoPartido.buenas_rivales)
        : 0,
      notas: nuevoPartido.notas.trim() || null,
    });
    setCreandoPartido(false);
    if (error) {
      alert("Error al crear partido: " + error.message);
      return;
    }
    setNuevoPartido({
      equipo_id: "",
      rival: "",
      fecha: "",
      set1: "",
      set2: "",
      set3: "",
      set4: "",
      set5: "",
      errores_rivales: "",
      buenas_rivales: "",
      notas: "",
    });
    cargarPartidos();
  };

  const guardarEdicionPartido = async () => {
    if (!editPartido) return;
    if (
      !editPartido.equipo_id ||
      !editPartido.rival.trim() ||
      !editPartido.fecha
    ) {
      alert("Completá equipo, rival y fecha");
      return;
    }
    const { error } = await supabase
      .from("partidos")
      .update({
        equipo_id: editPartido.equipo_id,
        rival: editPartido.rival.trim(),
        fecha: editPartido.fecha,
        set1: editPartido.set1?.trim() || null,
        set2: editPartido.set2?.trim() || null,
        set3: editPartido.set3?.trim() || null,
        set4: editPartido.set4?.trim() || null,
        set5: editPartido.set5?.trim() || null,
        errores_rivales: editPartido.errores_rivales ?? 0,
        buenas_rivales: editPartido.buenas_rivales ?? 0,
        notas: editPartido.notas?.trim() || null,
      })
      .eq("id", editPartido.id);
    if (error) {
      alert("Error al editar: " + error.message);
      return;
    }
    setEditandoPartidoId(null);
    setEditPartido(null);
    cargarPartidos();
  };

  const borrarPartido = async (id: string, rival: string, fecha: string) => {
    if (!confirm(`¿Borrar el partido vs "${rival}" del ${fecha}?`)) return;
    const { error } = await supabase.from("partidos").delete().eq("id", id);
    if (error) {
      alert("Error al borrar: " + error.message);
      return;
    }
    cargarPartidos();
  };

  const nombreEquipoPartido = (equipoId: string) => {
    return equipos.find((e) => e.id === equipoId)?.nombre ?? "(sin equipo)";
  };

  // ========== CÓDIGOS ==========
  const crearCodigo = async () => {
    const codigo = nuevoCodigo.trim();
    if (!codigo) {
      alert("Ingresá un código");
      return;
    }
    if (nuevoTipo === "club" && !nuevoEquipoId) {
      alert("Elegí un equipo");
      return;
    }
    if (nuevoTipo === "jugador" && !nuevoJugadorId) {
      alert("Elegí un jugador");
      return;
    }

    setCreandoCodigo(true);
    const { error } = await supabase.from("accesos").insert({
      codigo,
      tipo: nuevoTipo,
      equipo_id: nuevoTipo === "club" ? nuevoEquipoId : null,
      jugador_id: nuevoTipo === "jugador" ? nuevoJugadorId : null,
    });
    setCreandoCodigo(false);

    if (error) {
      if (error.message.includes("duplicate")) {
        alert("Ese código ya existe. Probá con otro.");
      } else {
        alert("Error al crear código: " + error.message);
      }
      return;
    }

    setNuevoCodigo("");
    setNuevoEquipoId("");
    setNuevoJugadorId("");
    cargarAccesos();
  };

  const toggleActivo = async (id: string, activo: boolean) => {
    const { error } = await supabase
      .from("accesos")
      .update({ activo: !activo })
      .eq("id", id);
    if (error) {
      alert("Error: " + error.message);
      return;
    }
    cargarAccesos();
  };

  const borrarCodigo = async (id: string, codigo: string) => {
    if (
      !confirm(`¿Borrar el código "${codigo}"? El usuario ya no podrá entrar.`)
    )
      return;
    const { error } = await supabase.from("accesos").delete().eq("id", id);
    if (error) {
      alert("Error al borrar: " + error.message);
      return;
    }
    cargarAccesos();
  };

  const descripcionCodigo = (a: Acceso) => {
    if (a.tipo === "admin") return "Administrador";
    if (a.tipo === "club") {
      const eq = equipos.find((e) => e.id === a.equipo_id);
      return eq ? `Equipo: ${eq.nombre}` : "Equipo (sin asignar)";
    }
    const jug = jugadores.find((j) => j.id === a.jugador_id);
    return jug ? `Jugador: ${jug.nombre}` : "Jugador (sin asignar)";
  };

  if (!sesion) return null;

  const secciones: { id: Seccion; nombre: string; icono: string }[] = [
    { id: "equipos", nombre: "Equipos", icono: "🏐" },
    { id: "jugadores", nombre: "Jugadores", icono: "👤" },
    { id: "partidos", nombre: "Partidos", icono: "📅" },
    { id: "codigos", nombre: "Códigos", icono: "🔑" },
  ];

  const inputBase =
    "px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500";

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
          <div className="flex gap-2">
            <button
              onClick={() => router.push("/admin/data-entry")}
              className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition"
            >
              🎯 Consola de Data Entry
            </button>
            <button
              onClick={() => router.push("/admin/estadisticas")}
              className="px-4 py-2 text-sm bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition"
            >
              📊 Estadísticas
            </button>
            <button
              onClick={handleCerrar}
              className="px-4 py-2 text-sm bg-slate-200 hover:bg-slate-300 rounded-lg transition"
            >
              Cerrar sesión
            </button>
          </div>
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
                  className={`flex-1 ${inputBase}`}
                  onKeyDown={(e) => e.key === "Enter" && crearEquipo()}
                />
                <button
                  onClick={crearEquipo}
                  disabled={creandoEquipo || !nombreNuevo.trim()}
                  className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 text-white font-medium rounded-lg"
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
                            className={`flex-1 ${inputBase}`}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter")
                                guardarEdicionEquipo(eq.id);
                              if (e.key === "Escape")
                                setEditandoEquipoId(null);
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
                  ⚠️ Primero creá al menos un equipo.
                </p>
              )}
              <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                <p className="text-sm font-medium text-slate-700 mb-2">
                  Nuevo jugador
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={nombreNuevoJug}
                    onChange={(e) => setNombreNuevoJug(e.target.value)}
                    placeholder="Nombre"
                    className={inputBase}
                  />
                  <input
                    type="number"
                    value={numeroNuevoJug}
                    onChange={(e) => setNumeroNuevoJug(e.target.value)}
                    placeholder="Número (opcional)"
                    className={inputBase}
                  />
                  <div className="col-span-2">
                    <label className="block text-xs text-slate-500 mb-1">
                      Imagen del jugador (opcional)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setArchivoImagenNuevo(file);
                            setPreviewNuevo(URL.createObjectURL(file));
                          }
                        }}
                        className="text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 file:cursor-pointer"
                      />
                      {previewNuevo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={previewNuevo}
                          alt="preview"
                          className="w-12 h-12 rounded-full object-cover border-2 border-slate-200"
                        />
                      )}
                    </div>
                  </div>
                  <select
                    value={equipoNuevoJug}
                    onChange={(e) => setEquipoNuevoJug(e.target.value)}
                    className={inputBase}
                  >
                    <option value="">Sin equipo asignado</option>
                    {equipos.map((eq) => (
                      <option key={eq.id} value={eq.id}>
                        {eq.nombre}
                      </option>
                    ))}
                  </select>
                  <select
                    value={rolNuevoJug}
                    onChange={(e) =>
                      setRolNuevoJug(e.target.value as "normal" | "armador")
                    }
                    className={inputBase}
                  >
                    <option value="normal">Rol: Jugador normal</option>
                    <option value="armador">Rol: Armador</option>
                  </select>
                </div>
                <button
                  onClick={crearJugador}
                  disabled={creandoJugador || !nombreNuevoJug.trim()}
                  className="w-full mt-2 px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 text-white font-medium rounded-lg"
                >
                  {creandoJugador ? "Creando..." : "+ Agregar jugador"}
                </button>
              </div>
              {cargandoJugadores ? (
                <p className="text-slate-500 text-center py-8">Cargando...</p>
              ) : jugadores.length === 0 ? (
                <p className="text-slate-500 text-center py-8">
                  No hay jugadores. 👤
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
                              onChange={(e) =>
                                setEditNombreJug(e.target.value)
                              }
                              placeholder="Nombre"
                              className={`w-full ${inputBase}`}
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="number"
                                value={editNumeroJug}
                                onChange={(e) =>
                                  setEditNumeroJug(e.target.value)
                                }
                                placeholder="Número"
                                className={inputBase}
                              />
                              <select
                                value={editEquipoJug}
                                onChange={(e) =>
                                  setEditEquipoJug(e.target.value)
                                }
                                className={inputBase}
                              >
                                <option value="">Sin equipo</option>
                                {equipos.map((eq) => (
                                  <option key={eq.id} value={eq.id}>
                                    {eq.nombre}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <select
                              value={editRolJug}
                              onChange={(e) =>
                                setEditRolJug(
                                  e.target.value as "normal" | "armador"
                                )
                              }
                              className={`w-full ${inputBase}`}
                            >
                              <option value="normal">
                                Rol: Jugador normal
                              </option>
                              <option value="armador">Rol: Armador</option>
                            </select>

                            <div>
                              <label className="block text-xs text-slate-500 mb-1">
                                Imagen (opcional)
                              </label>
                              <div className="flex items-center gap-3">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      setEditArchivoImagen(file);
                                      setEditPreview(
                                        URL.createObjectURL(file)
                                      );
                                    }
                                  }}
                                  className="text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 file:cursor-pointer"
                                />
                                {editPreview ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={editPreview}
                                    alt="preview"
                                    className="w-12 h-12 rounded-full object-cover border-2 border-blue-300"
                                  />
                                ) : editImagenActual ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={editImagenActual}
                                    alt="actual"
                                    className="w-12 h-12 rounded-full object-cover border-2 border-slate-200"
                                  />
                                ) : null}
                              </div>
                            </div>

                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() =>
                                  guardarEdicionJugador(jug.id)
                                }
                                className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg"
                              >
                                Guardar
                              </button>
                              <button
                                onClick={() => {
                                  setEditandoJugId(null);
                                  setEditArchivoImagen(null);
                                  setEditPreview("");
                                }}
                                className="px-3 py-1.5 bg-slate-300 hover:bg-slate-400 text-slate-700 text-sm rounded-lg"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <ImagenAmpliable
                              src={jug.imagen_url}
                              alt={jug.nombre}
                              inicial={jug.nombre.charAt(0).toUpperCase()}
                              tamaño="sm"
                            />
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
                              {jug.rol === "armador" && (
                                <span className="ml-2 text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
                                  Armador
                                </span>
                              )}
                            </span>
                            <button
                              onClick={() => {
                                setEditandoJugId(jug.id);
                                setEditNombreJug(jug.nombre);
                                setEditNumeroJug(
                                  jug.numero !== null
                                    ? String(jug.numero)
                                    : ""
                                );
                                setEditImagenActual(jug.imagen_url ?? "");
                                setEditArchivoImagen(null);
                                setEditPreview("");
                                setEditEquipoJug(idEquipoDe(jug.id));
                                setEditRolJug(
                                  jug.rol === "armador"
                                    ? "armador"
                                    : "normal"
                                );
                              }}
                              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm rounded-lg"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() =>
                                borrarJugador(jug.id, jug.nombre)
                              }
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

          {/* ============ PARTIDOS ============ */}
          {seccion === "partidos" && (
            <div>
              <h2 className="text-xl font-semibold text-slate-900 mb-6">
                Partidos
              </h2>
              {equipos.length === 0 && (
                <p className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  ⚠️ Primero creá al menos un equipo.
                </p>
              )}
              <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                <p className="text-sm font-medium text-slate-700">
                  Nuevo partido
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={nuevoPartido.equipo_id}
                    onChange={(e) =>
                      setNuevoPartido({
                        ...nuevoPartido,
                        equipo_id: e.target.value,
                      })
                    }
                    className={inputBase}
                  >
                    <option value="">Elegí equipo</option>
                    {equipos.map((eq) => (
                      <option key={eq.id} value={eq.id}>
                        {eq.nombre}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={nuevoPartido.rival}
                    onChange={(e) =>
                      setNuevoPartido({
                        ...nuevoPartido,
                        rival: e.target.value,
                      })
                    }
                    placeholder="Rival"
                    className={inputBase}
                  />
                  <input
                    type="date"
                    value={nuevoPartido.fecha}
                    onChange={(e) =>
                      setNuevoPartido({
                        ...nuevoPartido,
                        fecha: e.target.value,
                      })
                    }
                    className={`col-span-2 ${inputBase}`}
                  />
                </div>
                <p className="text-sm font-medium text-slate-700 pt-2">
                  Score por set (opcional)
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {(["set1", "set2", "set3", "set4", "set5"] as const).map(
                    (k, i) => (
                      <input
                        key={k}
                        type="text"
                        value={nuevoPartido[k]}
                        onChange={(e) =>
                          setNuevoPartido({
                            ...nuevoPartido,
                            [k]: e.target.value,
                          })
                        }
                        placeholder={`S${i + 1}`}
                        className={inputBase}
                      />
                    )
                  )}
                </div>
                <p className="text-sm font-medium text-slate-700 pt-2">
                  Rival (informativo)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={nuevoPartido.errores_rivales}
                    onChange={(e) =>
                      setNuevoPartido({
                        ...nuevoPartido,
                        errores_rivales: e.target.value,
                      })
                    }
                    placeholder="Errores rivales"
                    className={inputBase}
                  />
                  <input
                    type="number"
                    value={nuevoPartido.buenas_rivales}
                    onChange={(e) =>
                      setNuevoPartido({
                        ...nuevoPartido,
                        buenas_rivales: e.target.value,
                      })
                    }
                    placeholder="Buenas rivales"
                    className={inputBase}
                  />
                </div>
                <textarea
                  value={nuevoPartido.notas}
                  onChange={(e) =>
                    setNuevoPartido({
                      ...nuevoPartido,
                      notas: e.target.value,
                    })
                  }
                  placeholder="Notas (opcional)"
                  rows={2}
                  className={`w-full ${inputBase}`}
                />
                <button
                  onClick={crearPartido}
                  disabled={creandoPartido}
                  className="w-full px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 text-white font-medium rounded-lg"
                >
                  {creandoPartido ? "Creando..." : "+ Agregar partido"}
                </button>
              </div>
              {cargandoPartidos ? (
                <p className="text-slate-500 text-center py-8">Cargando...</p>
              ) : partidos.length === 0 ? (
                <p className="text-slate-500 text-center py-8">
                  No hay partidos cargados. 📅
                </p>
              ) : (
                <div className="space-y-2">
                  {partidos.map((p) => (
                    <div
                      key={p.id}
                      className="p-4 bg-slate-50 rounded-lg border border-slate-200"
                    >
                      {editandoPartidoId === p.id && editPartido ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={editPartido.equipo_id}
                              onChange={(e) =>
                                setEditPartido({
                                  ...editPartido,
                                  equipo_id: e.target.value,
                                })
                              }
                              className={inputBase}
                            >
                              {equipos.map((eq) => (
                                <option key={eq.id} value={eq.id}>
                                  {eq.nombre}
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              value={editPartido.rival}
                              onChange={(e) =>
                                setEditPartido({
                                  ...editPartido,
                                  rival: e.target.value,
                                })
                              }
                              placeholder="Rival"
                              className={inputBase}
                            />
                            <input
                              type="date"
                              value={editPartido.fecha}
                              onChange={(e) =>
                                setEditPartido({
                                  ...editPartido,
                                  fecha: e.target.value,
                                })
                              }
                              className={`col-span-2 ${inputBase}`}
                            />
                          </div>
                          <div className="grid grid-cols-5 gap-2">
                            {(
                              [
                                "set1",
                                "set2",
                                "set3",
                                "set4",
                                "set5",
                              ] as const
                            ).map((k, i) => (
                              <input
                                key={k}
                                type="text"
                                value={editPartido[k] ?? ""}
                                onChange={(e) =>
                                  setEditPartido({
                                    ...editPartido,
                                    [k]: e.target.value,
                                  })
                                }
                                placeholder={`S${i + 1}`}
                                className={inputBase}
                              />
                            ))}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="number"
                              value={editPartido.errores_rivales ?? 0}
                              onChange={(e) =>
                                setEditPartido({
                                  ...editPartido,
                                  errores_rivales: parseInt(
                                    e.target.value || "0"
                                  ),
                                })
                              }
                              placeholder="Errores rivales"
                              className={inputBase}
                            />
                            <input
                              type="number"
                              value={editPartido.buenas_rivales ?? 0}
                              onChange={(e) =>
                                setEditPartido({
                                  ...editPartido,
                                  buenas_rivales: parseInt(
                                    e.target.value || "0"
                                  ),
                                })
                              }
                              placeholder="Buenas rivales"
                              className={inputBase}
                            />
                          </div>
                          <textarea
                            value={editPartido.notas ?? ""}
                            onChange={(e) =>
                              setEditPartido({
                                ...editPartido,
                                notas: e.target.value,
                              })
                            }
                            placeholder="Notas"
                            rows={2}
                            className={`w-full ${inputBase}`}
                          />
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={guardarEdicionPartido}
                              className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg"
                            >
                              Guardar
                            </button>
                            <button
                              onClick={() => {
                                setEditandoPartidoId(null);
                                setEditPartido(null);
                              }}
                              className="px-3 py-1.5 bg-slate-300 hover:bg-slate-400 text-slate-700 text-sm rounded-lg"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3">
                          <div className="flex-1">
                            <p className="font-medium text-slate-800">
                              🏐 {nombreEquipoPartido(p.equipo_id)} vs {p.rival}
                            </p>
                            <p className="text-sm text-slate-500 mt-1">
                              📅 {p.fecha}
                            </p>
                            {(p.set1 ||
                              p.set2 ||
                              p.set3 ||
                              p.set4 ||
                              p.set5) && (
                              <p className="text-sm text-slate-600 mt-1">
                                {[p.set1, p.set2, p.set3, p.set4, p.set5]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              setEditandoPartidoId(p.id);
                              setEditPartido({ ...p });
                            }}
                            className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm rounded-lg"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() =>
                              borrarPartido(p.id, p.rival, p.fecha)
                            }
                            className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-sm rounded-lg"
                          >
                            Borrar
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ============ CÓDIGOS ============ */}
          {seccion === "codigos" && (
            <div>
              <h2 className="text-xl font-semibold text-slate-900 mb-6">
                Códigos de acceso
              </h2>

              <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                <p className="text-sm font-medium text-slate-700">
                  Nuevo código
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={nuevoCodigo}
                    onChange={(e) => setNuevoCodigo(e.target.value)}
                    placeholder="Código (ej: quilmes-2025)"
                    className={`col-span-2 ${inputBase}`}
                  />
                  <select
                    value={nuevoTipo}
                    onChange={(e) => {
                      setNuevoTipo(e.target.value as "club" | "jugador");
                      setNuevoEquipoId("");
                      setNuevoJugadorId("");
                    }}
                    className={inputBase}
                  >
                    <option value="club">Para un equipo</option>
                    <option value="jugador">Para un jugador</option>
                  </select>
                  {nuevoTipo === "club" ? (
                    <select
                      value={nuevoEquipoId}
                      onChange={(e) => setNuevoEquipoId(e.target.value)}
                      className={inputBase}
                    >
                      <option value="">Elegí equipo</option>
                      {equipos.map((eq) => (
                        <option key={eq.id} value={eq.id}>
                          {eq.nombre}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={nuevoJugadorId}
                      onChange={(e) => setNuevoJugadorId(e.target.value)}
                      className={inputBase}
                    >
                      <option value="">Elegí jugador</option>
                      {jugadores.map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.nombre}
                          {j.numero !== null ? ` #${j.numero}` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <button
                  onClick={crearCodigo}
                  disabled={creandoCodigo || !nuevoCodigo.trim()}
                  className="w-full px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 text-white font-medium rounded-lg"
                >
                  {creandoCodigo ? "Creando..." : "+ Agregar código"}
                </button>
              </div>

              {cargandoAccesos ? (
                <p className="text-slate-500 text-center py-8">Cargando...</p>
              ) : accesos.length === 0 ? (
                <p className="text-slate-500 text-center py-8">
                  No hay códigos. 🔑
                </p>
              ) : (
                <div className="space-y-2">
                  {accesos.map((a) => (
                    <div
                      key={a.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${
                        a.activo
                          ? "bg-slate-50 border-slate-200"
                          : "bg-slate-100 border-slate-300 opacity-60"
                      }`}
                    >
                      <div className="flex-1">
                        <p className="font-mono font-medium text-slate-800">
                          🔑 {a.codigo}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {descripcionCodigo(a)}
                          {!a.activo && " · Inactivo"}
                        </p>
                      </div>
                      <button
                        onClick={() => toggleActivo(a.id, a.activo)}
                        className={`px-3 py-1.5 text-sm rounded-lg ${
                          a.activo
                            ? "bg-amber-100 hover:bg-amber-200 text-amber-800"
                            : "bg-green-100 hover:bg-green-200 text-green-800"
                        }`}
                      >
                        {a.activo ? "Desactivar" : "Activar"}
                      </button>
                      <button
                        onClick={() => borrarCodigo(a.id, a.codigo)}
                        className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-sm rounded-lg"
                      >
                        Borrar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}