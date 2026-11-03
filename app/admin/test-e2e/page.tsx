"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { obtenerSesion } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { guardarPuntoV2, type PuntoV2Data, type AccionV2Data } from "@/lib/dbV2";
import { rotacionVacia } from "@/lib/rotaciones";

interface Equipo { id: string; nombre: string }
interface Partido { id: string; equipo_id: string; rival: string; fecha: string }
interface Jugador { id: string; nombre: string; numero: number | null; rol: string }

type MensajeTipo = "success" | "error" | null;

export default function TestE2EPage() {
  const router = useRouter();

  // ------------------------------------------------------------
  // Auth: solo admin
  // ------------------------------------------------------------
  useEffect(() => {
    const s = obtenerSesion();
    if (!s || s.tipo !== "admin") {
      router.push("/");
    }
  }, [router]);

  // ------------------------------------------------------------
  // Estado
  // ------------------------------------------------------------
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [equipoId, setEquipoId] = useState("");
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
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
  // Cargar jugadores del equipo seleccionado
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

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------
  const primerJugador = jugadores.length > 0 ? jugadores[0].id : null;

  const accionConJugador = (
    orden: number,
    tipo: string,
    subtipo: string | number | null,
    esRival: boolean,
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
    lado: esRival ? "rival" : "propio",
    origen_celda: origen,
    origen_mini: null,
    destino_celda: destino,
    destino_mini: null,
    desvios: [],
    zona: null,
    velocidad: velocidad ?? null,
    tipo_saque: tipoSaque ?? null,
    equipo_id: null,
  });

  const puntoData = (
    setNumero: number,
    saqueEquipo: "propio" | "rival",
    situacion: "saque" | "recepcion",
    ganador: "propio" | "rival" | null,
  ): PuntoV2Data => ({
    set_numero: setNumero,
    punto_numero: 1,
    saque_equipo: saqueEquipo,
    situacion,
    ganador,
    rotacion: rotacionVacia(1, setNumero, 1, saqueEquipo) as unknown as Record<string, unknown>,
    liberos: [],
    cambios: [],
    posiciones_punto: {},
    equipo_id: null,
  });

  // ------------------------------------------------------------
  // CREAR PARTIDO TEST + INSERTAR 6 PUNTOS
  // ------------------------------------------------------------
  const crearPartidoYPuntos = async () => {
    if (!equipoId) {
      setMensaje({ texto: "Primero elegí un equipo", tipo: "error" });
      return;
    }
    setCargando(true);
    setMensaje(null);

    try {
      // 1. Crear partido TEST
      const { data: partido, error } = await supabase
        .from("partidos")
        .insert({
          equipo_id: equipoId,
          rival: `TEST-E2E-${Date.now()}`,
          equipo_rival_id: null,
          fecha: new Date().toISOString().slice(0, 10),
        })
        .select("id")
        .single();

      if (error || !partido) {
        setMensaje({ texto: `❌ Error creando partido: ${error?.message ?? "desconocido"}`, tipo: "error" });
        return;
      }

      const partidoId = partido.id;

      // Cargar jugadores para jugador_id
      const { data: jugadores } = await supabase
        .from("jugadores")
        .select("*")
        .order("nombre");
      const pj = primerJugador(jugadores ?? []);

      // Sobrescribir jugador_id en accion si hay jugadores
      const accionConJugador = (
        orden: number,
        tipo: string,
        subtipo: string | number | null,
        esRival: boolean,
        origen: string | null,
        destino: string | null,
        velocidad?: number | null,
        tipoSaque?: string | null,
      ): AccionV2Data => ({
        ...accion(orden, tipo, subtipo, esRival, origen, destino, velocidad, tipoSaque),
        jugador_id: pj,
      });

      const inserts: { punto: number; res: { ok: boolean; error?: string } }[] = [];

      try {
        // P1: K1 punto (set 1)
        inserts.push({ punto: 1, res: await guardarPuntoV2(partidoId, puntoData(1, "rival", "recepcion", "propio"), [
          accionConJugador(1, "saque", "positivo", true, "F4-C3", "F1-C3", null, "flotado"),
          accionConJugador(2, "recepcion", "positiva", false, "F1-C3", "F2-C3"),
          accionConJugador(3, "armado", 5, false, null, "F1-C2", 1),
          accionConJugador(4, "ataque", "punto_directo_ataque", false, "F1-C2", "F4-C3"),
        ])});

        // P2: K1 error (set 2)
        inserts.push({ punto: 2, res: await guardarPuntoV2(partidoId, puntoData(2, "rival", "recepcion", "rival"), [
          accionConJugador(1, "saque", "positivo", true, "F4-C3", "F1-C3", null, "flotado"),
          accionConJugador(2, "recepcion", "positiva", false, "F1-C3", "F2-C3"),
          accionConJugador(3, "armado", 5, false, null, "F1-C2", 1),
          accionConJugador(4, "ataque", "error_afuera_ataque", false, "F1-C2", "FUERA-ARR-C3"),
        ])});

        // P4: K2 punto (set 4)
        inserts.push({ punto: 4, res: await guardarPuntoV2(partidoId, puntoData(4, "propio", "saque", "propio"), [
          accionConJugador(1, "saque", "positivo", false, null, "F4-C3", null, "flotado"),
          accionConJugador(2, "recepcion", "positiva", true, "F4-C3", "F5-C3"),
          accionConJugador(3, "armado", 5, true, null, "F4-C2", 1),
          accionConJugador(4, "ataque", "neutro", true, "F4-C2", "F1-C3"),
          accionConJugador(5, "defensa", "toque_positiva", false, "F1-C3", "F1-C2"),
          accionConJugador(6, "armado", 5, false, null, "F1-C1", 1),
          accionConJugador(7, "ataque", "punto_directo_ataque", false, "F1-C1", "F4-C3"),
        ])});

        // P5: K3 punto (set 5)
        inserts.push({ punto: 5, res: await guardarPuntoV2(partidoId, puntoData(5, "propio", "saque", "propio"), [
          accionConJugador(1, "saque", "positivo", false, null, "F4-C3", null, "flotado"),
          accionConJugador(2, "recepcion", "positiva", true, "F4-C3", "F5-C3"),
          accionConJugador(3, "armado", 5, true, null, "F4-C2", 1),
          accionConJugador(4, "ataque", "neutro", true, "F4-C2", "F1-C2"),
          accionConJugador(5, "bloqueo", "positivo", false, "F1-C2", "F2-C2"),
          accionConJugador(6, "defensa", "cobertura_positiva", false, "F2-C2", "F2-C2"),
          accionConJugador(7, "armado", 5, false, null, "F1-C4", 1),
          accionConJugador(8, "ataque", "punto_directo_ataque", false, "F1-C4", "F4-C2"),
        ])});

        // P6: Free-ball punto (set 6)
        inserts.push({ punto: 6, res: await guardarPuntoV2(partidoId, puntoData(6, "propio", "saque", "propio"), [
          accionConJugador(1, "saque", "positivo", false, null, "F4-C3", null, "flotado"),
          accionConJugador(2, "recepcion", "positiva", true, "F4-C3", "F5-C3"),
          accionConJugador(3, "armado", 5, true, null, "F4-C2", 1),
          accionConJugador(4, "ataque", "neutro", true, "F4-C2", "F1-C3"),
          accionConJugador(5, "libre", "libre", true, "F1-C3", "F2-C3"),
          accionConJugador(6, "recepcion", "positiva", false, "F2-C3", "F1-C2"),
          accionConJugador(7, "armado", 5, false, null, "F1-C1", 1),
          accionConJugador(8, "ataque", "punto_directo_ataque", false, "F1-C1", "F4-C3"),
        ])});

        const errores = inserts.filter((x) => !x.res.ok);
        if (errores.length > 0) {
          const detalle = errores
            .map((e) => `P${e.punto}: ${e.res.error ?? "sin error"}`)
            .join(" | ");
          setMensaje({ texto: `❌ Puntos fallidos: ${detalle}`, tipo: "error" });
        } else {
          setMensaje({ texto: "✅ Partido TEST-E2E creado con 6 puntos. Andá a Partidos y verificá.", tipo: "success" });
        }
      } catch (err: any) {
        setMensaje({ texto: `❌ Error insertando puntos: ${err?.message ?? "desconocido"}`, tipo: "error" });
      }
    } catch (err: any) {
      setMensaje({ texto: `❌ Error: ${err?.message ?? "desconocido"}`, tipo: "error" });
    } finally {
      setCargando(false);
    }
  };

  // ------------------------------------------------------------
  // BORRAR TODO LO DE TEST
  // ------------------------------------------------------------
  const borrarTodoTEST = async () => {
    if (!equipoId) {
      setMensaje({ texto: "Primero elegí un equipo", tipo: "error" });
      return;
    }
    setCargando(true);
    setMensaje(null);

    try {
      // 1. Buscar partidos TEST-E2E del equipo
      const { data: partidosTEST, error: errBuscar } = await supabase
        .from("partidos")
        .select("id")
        .eq("equipo_id", equipoId)
        .like("rival", "TEST-E2E-%");

      if (errBuscar) throw errBuscar;

      if (!partidosTEST || partidosTEST.length === 0) {
        setMensaje({ texto: "No hay partidos TEST-E2E.", tipo: "success" });
        return;
      }

      let borrados = 0;
      for (const p of partidosTEST) {
        // Borrar acciones_v2 del partido
        const { error: errAcc } = await supabase
          .from("acciones_v2")
          .delete()
          .eq("partido_id", p.id);
        if (errAcc) throw errAcc;

        // Borrar puntos_v2 del partido
        const { error: errPuntos } = await supabase
          .from("puntos_v2")
          .delete()
          .eq("partido_id", p.id);
        if (errPuntos) throw errPuntos;

        // Borrar el partido
        const { error: errPartido } = await supabase
          .from("partidos")
          .delete()
          .eq("id", p.id);
        if (errPartido) throw errPartido;

        borrados++;
      }

      setMensaje({ texto: `✅ ${borrados} partidos TEST-E2E borrados.`, tipo: "success" });
    } catch (err: any) {
      setMensaje({ texto: `❌ Error borrando: ${err?.message ?? "desconocido"}`, tipo: "error" });
    } finally {
      setCargando(false);
    }
  };

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
            <h1 className="text-3xl font-bold text-slate-900">🧪 Test E2E</h1>
            <p className="text-slate-600 text-sm">
              Crea un partido TEST-E2E con 6 puntos (1 por set) y valida el flujo completo.
            </p>
          </div>
        </div>

        {/* Selector de Equipo */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>
        </div>

        {!equipoId && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
            <p className="text-5xl mb-4">🧪</p>
            <p className="text-slate-600 font-medium">Elegí un equipo arriba</p>
          </div>
        )}

        {equipoId && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Acciones de test E2E</h2>
              {cargando && (
                <span className="text-xs text-slate-500 animate-pulse">Cargando...</span>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={crearPartidoYPuntos}
                disabled={cargando}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium disabled:opacity-50"
              >
                Crear partido TEST + insertar 6 puntos
              </button>
              <button
                onClick={borrarTodoTEST}
                disabled={cargando}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium disabled:opacity-50"
              >
                Borrar todo lo de TEST
              </button>
            </div>
          </div>
        )}

        {/* Panel de resultado */}
        {mensaje && (
          <div
            className={`mt-4 p-4 rounded-lg border whitespace-pre-wrap ${
              mensaje.tipo === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            {mensaje.texto}
          </div>
        )}
      </div>
    </main>
  );
}