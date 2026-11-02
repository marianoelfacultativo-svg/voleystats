"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { obtenerSesion, type Sesion } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { guardarPuntoV2, borrarTodosV2, type PuntoV2Data, type AccionV2Data } from "@/lib/dbV2";

interface Equipo { id: string; nombre: string }
interface Partido { id: string; equipo_id: string; rival: string; fecha: string }
interface Jugador { id: string; nombre: string; numero: number | null; rol: string }

type MensajeTipo = "success" | "error" | null;

export default function TestSeedPage() {
  const router = useRouter();

  // ------------------------------------------------------------
  // Auth: solo admin
  // ------------------------------------------------------------
  useEffect(() => {
    const s = obtenerSesion();
    if (!s || s.tipo !== "admin") {
      router.push("/");
      return;
    }
  }, [router]);

  // ------------------------------------------------------------
  // Estado
  // ------------------------------------------------------------
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [equipoId, setEquipoId] = useState("");
  const [partidoId, setPartidoId] = useState("");
  const [mensaje, setMensaje] = useState<{ texto: string; tipo: MensajeTipo } | null>(null);
  const [cargando, setCargando] = useState(false);

  // ------------------------------------------------------------
  // Cargar equipos
  // ------------------------------------------------------------
  useEffect(() => {
    supabase
      .from("equipos")
      .select("id, nombre")
      .order("nombre")
      .then(({ data }) => data && setEquipos(data));
  }, []);

  // ------------------------------------------------------------
  // Cargar partidos del equipo seleccionado
  // ------------------------------------------------------------
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

  // ------------------------------------------------------------
  // Cargar jugadores del equipo (para jugador_id de las acciones)
  // ------------------------------------------------------------
  useEffect(() => {
    if (!equipoId) {
      setJugadores([]);
      return;
    }
    supabase
      .from("jugadores")
      .select("*")
      .order("nombre")
      .then(({ data }) => data && setJugadores(data));
  }, [equipoId]);

  const primerJugador = jugadores.length > 0 ? jugadores[0].id : null;

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------
  const accion = (
    orden: number,
    tipo: string,
    subtipo: string | number | null,
    esRival: boolean,
    lado: "propio" | "rival",
    origen: string | null,
    destino: string | null,
    velocidad?: number | null,
    tipoSaque?: string | null,
  ): AccionV2Data => ({
    orden,
    tipo,
    subtipo,
    es_rival: esRival,
    jugador_id: primerJugador,
    lado,
    origen_celda: origen,
    origen_mini: null,
    destino_celda: destino,
    destino_mini: null,
    desvios: [],
    zona: null,
    velocidad: velocidad ?? null,
    tipo_saque: tipoSaque ?? null,
    equipo_id: "TEST_SEED",
  });

  const puntoData = (
    puntoNumero: number,
    saqueEquipo: "propio" | "rival",
    situacion: "saque" | "recepcion",
    ganador: "propio" | "rival" | null,
  ): PuntoV2Data => ({
    set_numero: 1,
    punto_numero: puntoNumero,
    saque_equipo: saqueEquipo,
    situacion,
    ganador,
    rotacion: null,
    liberos: [],
    cambios: [],
    posiciones_punto: {},
    equipo_id: "TEST_SEED",
  });

  // ------------------------------------------------------------
  // INSERTAR 6 PUNTOS DE TEST
  // ------------------------------------------------------------
  const insertarPuntosDeTest = async () => {
    if (!partidoId) {
      setMensaje({ texto: "Primero elegí un partido", tipo: "error" });
      return;
    }
    setCargando(true);
    setMensaje(null);

    try {
      // ---------- Punto 1: K1 + Ataque punto ----------
      await guardarPuntoV2(partidoId, puntoData(1, "propio", "saque", "propio"), [
        accion(1, "saque", "positivo", false, "propio", null, "F4-C3", null, "flotado"),
        accion(2, "recepcion", "perfecta", true, "rival", null, "F2-C3"),
        accion(3, "armado", 5, false, "propio", null, "F1-C2", 1),
        accion(4, "ataque", "punto_directo_ataque", false, "propio", "F1-C2", "F4-C3"),
      ]);

      // ---------- Punto 2: K1 + Ataque error ----------
      await guardarPuntoV2(partidoId, puntoData(2, "propio", "saque", "rival"), [
        accion(1, "saque", "positivo", false, "propio", null, "F4-C3", null, "flotado"),
        accion(2, "recepcion", "perfecta", true, "rival", null, "F2-C3"),
        accion(3, "armado", 5, false, "propio", null, "F1-C2", 1),
        accion(4, "ataque", "error_afuera_ataque", false, "propio", "F1-C2", "FUERA-ARR-C3"),
      ]);

      // ---------- Punto 3: K1 + Ataque neutro ----------
      await guardarPuntoV2(partidoId, puntoData(3, "propio", "saque", "propio"), [
        accion(1, "saque", "positivo", false, "propio", null, "F4-C3", null, "flotado"),
        accion(2, "recepcion", "perfecta", true, "rival", null, "F2-C3"),
        accion(3, "armado", 5, false, "propio", null, "F1-C2", 1),
        accion(4, "ataque", "neutro_defensa_ataque", false, "propio", "F1-C2", "F5-C3"),
        accion(5, "defensa", "toque_positiva", true, "rival", "F5-C3", "F5-C3"),
      ]);

      // ---------- Punto 4: K2 (contraataque desde defensa) ----------
      await guardarPuntoV2(partidoId, puntoData(4, "rival", "recepcion", "propio"), [
        accion(1, "saque", "positivo", true, "rival", "F4-C3", "F1-C3", null, "flotado"),
        accion(2, "recepcion", "negativa", false, "propio", "F1-C3", "F1-C3"),
        accion(3, "armado", 4, false, "propio", null, "F1-C2", 2),
        accion(4, "ataque", "neutro", true, "rival", "F1-C2", "F4-C3"),
        accion(5, "defensa", "toque_positiva", false, "propio", "F1-C2", "F1-C2"),
        accion(6, "armado", 5, false, "propio", null, "F1-C1", 1),
        accion(7, "ataque", "punto_directo_ataque", false, "propio", "F1-C1", "F4-C3"),
      ]);

      // ---------- Punto 5: K3 (contraataque desde cobertura) ----------
      await guardarPuntoV2(partidoId, puntoData(5, "propio", "saque", "propio"), [
        accion(1, "saque", "positivo", false, "propio", null, "F4-C3", null, "flotado"),
        accion(2, "recepcion", "perfecta", true, "rival", null, "F2-C3"),
        accion(3, "armado", 5, false, "propio", null, "F1-C2", 1),
        accion(4, "ataque", "gorro_ataque", false, "propio", "F1-C2", "F2-C2", null, null),
        accion(5, "defensa", "cobertura_positiva", false, "propio", "F2-C2", "F2-C2"),
        accion(6, "armado", 5, false, "propio", null, "F1-C4", 1),
        accion(7, "ataque", "punto_directo_ataque", false, "propio", "F1-C4", "F4-C2"),
      ]);

      // ---------- Punto 6: Free-ball ----------
      await guardarPuntoV2(partidoId, puntoData(6, "rival", "recepcion", "propio"), [
        accion(1, "saque", "positivo", true, "rival", "F4-C3", "F1-C3", null, "flotado"),
        accion(2, "recepcion", "doble_negativa", false, "propio", "F1-C3", "F1-C3"),
        accion(3, "armado", 4, false, "propio", null, "F1-C2", 5),
        accion(4, "ataque", "neutro", true, "rival", "F1-C2", "F4-C3"),
        accion(5, "defensa", "toque_positiva", false, "propio", "F1-C2", "F1-C2"),
        accion(6, "armado", 5, false, "propio", null, "F1-C4", 1),
        accion(7, "ataque", "neutro", true, "rival", "F1-C4", "F4-C2"),
        accion(8, "defensa", "libre", false, "propio", "F1-C4", "F1-C4"),
        accion(9, "armado", 5, false, "propio", null, "F1-C2", 1),
        accion(10, "ataque", "punto_directo_ataque", false, "propio", "F1-C2", "F4-C3"),
      ]);

      setCargando(false);
      setMensaje({
        texto: "✅ 6 puntos insertados. Ahora andá a Partidos → detalle del partido → Consecuencias y verificá las fases esperadas.",
        tipo: "success",
      });
    } catch (err: any) {
      setMensaje({ texto: `❌ Error: ${err.message ?? "desconocido"}`, tipo: "error" });
    } finally {
      setCargando(false);
    }
  };

  // ------------------------------------------------------------
  // BORRAR PUNTOS DE TEST (solo equipo_id = "TEST_SEED")
  // ------------------------------------------------------------
  const borrarPuntosDeTest = async () => {
    if (!partidoId) {
      setMensaje({ texto: "Primero elegí un partido", tipo: "error" });
      return;
    }
    setCargando(true);
    setMensaje(null);

    try {
      const { data: puntos, error: errBuscar } = await supabase
        .from("puntos_v2")
        .select("id")
        .eq("partido_id", partidoId)
        .eq("equipo_id", "TEST_SEED");

      if (errBuscar) throw errBuscar;

      const ids = (puntos ?? []).map((p: { id: string }) => p.id);

      if (ids.length > 0) {
        const { error: errAcc } = await supabase
          .from("acciones_v2")
          .delete()
          .in("punto_id", ids);
        if (errAcc) throw errAcc;

        const { error: errPuntos } = await supabase
          .from("puntos_v2")
          .delete()
          .in("id", ids);
        if (errPuntos) throw errPuntos;
      }

      setMensaje({ texto: "✅ Puntos de test borrados.", tipo: "success" });
    } catch (err: any) {
      setMensaje({ texto: `❌ Error borrando: ${err.message ?? "desconocido"}`, tipo: "error" });
    } finally {
      setCargando(false);
    }
  };

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------
  const noHayPartido = !partidoId;

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <button
              onClick={() => router.push("/admin")}
              className="text-sm text-slate-500 hover:text-slate-700 mb-1"
            >
              ← Volver al panel
            </button>
            <h1 className="text-3xl font-bold text-slate-900">🧪 Seed de test (temporal)</h1>
            <p className="text-slate-600 text-sm">
              Esta página es temporal. Solo para validar el refactor de catalogoSubtipos. Borrar cuando termines.
            </p>
          </div>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 text-sm bg-slate-200 hover:bg-slate-300 rounded-lg transition"
          >
            Cerrar sesión
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Equipo</label>
              <select
                value={equipoId}
                onChange={(e) => setEquipoId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value="">Elegí un equipo</option>
                {equipos.map((eq) => (
                  <option key={eq.id} value={eq.id}>{eq.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Partido</label>
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
            <p className="text-slate-600 font-medium">Elegí un equipo y un partido arriba</p>
          </div>
        )}

        {!noHayPartido && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Acciones de test</h2>
              {cargando && (
                <span className="text-xs text-slate-500 animate-pulse">Cargando...</span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={insertarPuntosDeTest}
                disabled={cargando}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium disabled:opacity-50"
              >
                Insertar 6 puntos de test
              </button>
              <button
                onClick={borrarPuntosDeTest}
                disabled={cargando}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium disabled:opacity-50"
              >
                Borrar puntos de test
              </button>
            </div>
          </div>
        )}

        {mensaje && (
          <div
            className={`p-4 rounded-lg border ${
              mensaje.tipo === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            {mensaje.texto}
          </div>
        )}

        {!noHayPartido && !mensaje && (
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <p className="text-sm text-slate-600">
              Seleccioná una acción arriba. Los puntos se insertan con equipo_id = "TEST_SEED"
              para poder borrarlos sin tocar datos reales.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}