"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { obtenerSesion } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { guardarPuntoV2, type PuntoV2Data, type AccionV2Data } from "@/lib/dbV2";
import { rotacionVacia } from "@/lib/rotaciones";

interface Equipo { id: string; nombre: string }
interface Jugador { id: string; nombre: string }

type MensajeTipo = "success" | "error" | null;

export default function TestE2EPage() {
  const router = useRouter();

  useEffect(() => {
    const s = obtenerSesion();
    if (!s || s.tipo !== "admin") {
      router.push("/");
    }
  }, [router]);

  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [equipoId, setEquipoId] = useState("");
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [mensaje, setMensaje] = useState<{ texto: string; tipo: MensajeTipo } | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    supabase.from("equipos").select("id, nombre").order("nombre")
      .then(({ data }) => data && setEquipos(data));
  }, []);

  useEffect(() => {
    if (!equipoId) { setJugadores([]); return; }
    supabase.from("jugador_equipo").select("jugador_id")
      .eq("equipo_id", equipoId).eq("activo", true)
      .then(async ({ data }) => {
        if (!data || data.length === 0) { setJugadores([]); return; }
        const ids = data.map((x: { jugador_id: string }) => x.jugador_id);
        const { data: jugs } = await supabase.from("jugadores").select("id, nombre").in("id", ids);
        setJugadores((jugs ?? []) as Jugador[]);
      });
  }, [equipoId]);

  const crearPartidoYPuntos = async () => {
    if (!equipoId) {
      setMensaje({ texto: "Elegí un equipo primero", tipo: "error" });
      return;
    }
    setCargando(true);
    setMensaje(null);

    try {
      const primerJugadorId = jugadores.length > 0 ? jugadores[0].id : null;

      const { data: partido, error: errPartido } = await supabase
        .from("partidos")
        .insert({
          equipo_id: equipoId,
          rival: `TEST-E2E-${Date.now()}`,
          equipo_rival_id: null,
          fecha: new Date().toISOString().slice(0, 10),
        })
        .select("id")
        .single();

      if (errPartido || !partido) {
        setMensaje({ texto: `❌ Error creando partido: ${errPartido?.message ?? "desconocido"}`, tipo: "error" });
        return;
      }

      const partidoId = partido.id as string;

      const accion = (
        orden: number,
        tipo: string,
        subtipo: string | number | null,
        esRival: boolean,
        origen: string | null,
        destino: string | null,
        velocidad?: number | null,
        tipoSaque?: string | null,
      ): AccionV2Data => ({
        orden, tipo, subtipo, es_rival: esRival,
        jugador_id: primerJugadorId,
        lado: esRival ? "rival" : "propio",
        origen_celda: origen, origen_mini: null,
        destino_celda: destino, destino_mini: null,
        desvios: [], zona: null,
        velocidad: velocidad ?? null, tipo_saque: tipoSaque ?? null,
        equipo_id: null,
      });

      const punto = (
        setNumero: number,
        saqueEquipo: "propio" | "rival",
        situacion: "saque" | "recepcion",
        ganador: "propio" | "rival" | null,
      ): PuntoV2Data => ({
        set_numero: setNumero, punto_numero: 1,
        saque_equipo: saqueEquipo, situacion, ganador,
        rotacion: rotacionVacia(1, setNumero, 1, saqueEquipo) as unknown as Record<string, unknown>,
        liberos: [], cambios: [], posiciones_punto: {}, equipo_id: null,
      });

      const resultados: { punto: number; ok: boolean; error?: string }[] = [];

      // P1 - K1 punto (set 1)
      {
        const r = await guardarPuntoV2(partidoId, punto(1, "rival", "recepcion", "propio"), [
          accion(1, "saque", "positivo", true, "F4-C3", "F1-C3", null, "flotado"),
          accion(2, "recepcion", "positiva", false, "F1-C3", "F2-C3"),
          accion(3, "armado", 5, false, null, "F1-C2", 1),
          accion(4, "ataque", "punto_directo_ataque", false, "F1-C2", "F4-C3"),
        ]);
        resultados.push({ punto: 1, ok: r.ok, error: r.error });
      }

      // P2 - K1 error (set 2)
      {
        const r = await guardarPuntoV2(partidoId, punto(2, "rival", "recepcion", "rival"), [
          accion(1, "saque", "positivo", true, "F4-C3", "F1-C3", null, "flotado"),
          accion(2, "recepcion", "positiva", false, "F1-C3", "F2-C3"),
          accion(3, "armado", 5, false, null, "F1-C2", 1),
          accion(4, "ataque", "error_afuera_ataque", false, "F1-C2", "FUERA-ARR-C3"),
        ]);
        resultados.push({ punto: 2, ok: r.ok, error: r.error });
      }

      // P3 - K1 neutro (set 3)
      {
        const r = await guardarPuntoV2(partidoId, punto(3, "rival", "recepcion", "propio"), [
          accion(1, "saque", "positivo", true, "F4-C3", "F1-C3", null, "flotado"),
          accion(2, "recepcion", "positiva", false, "F1-C3", "F2-C3"),
          accion(3, "armado", 5, false, null, "F1-C2", 1),
          accion(4, "ataque", "neutro_defensa_ataque", false, "F1-C2", "F5-C3"),
          accion(5, "defensa", "toque_positiva", true, "F5-C3", "F5-C3"),
        ]);
        resultados.push({ punto: 3, ok: r.ok, error: r.error });
      }

      // P4 - K2 punto (set 4)
      {
        const r = await guardarPuntoV2(partidoId, punto(4, "propio", "saque", "propio"), [
          accion(1, "saque", "positivo", false, null, "F4-C3", null, "flotado"),
          accion(2, "recepcion", "positiva", true, "F4-C3", "F5-C3"),
          accion(3, "armado", 5, true, null, "F4-C2", 1),
          accion(4, "ataque", "neutro", true, "F4-C2", "F1-C3"),
          accion(5, "defensa", "toque_positiva", false, "F1-C3", "F1-C2"),
          accion(6, "armado", 5, false, null, "F1-C1", 1),
          accion(7, "ataque", "punto_directo_ataque", false, "F1-C1", "F4-C3"),
        ]);
        resultados.push({ punto: 4, ok: r.ok, error: r.error });
      }

      // P5 - K3 punto (set 5)
      {
        const r = await guardarPuntoV2(partidoId, punto(5, "propio", "saque", "propio"), [
          accion(1, "saque", "positivo", false, null, "F4-C3", null, "flotado"),
          accion(2, "recepcion", "positiva", true, "F4-C3", "F5-C3"),
          accion(3, "armado", 5, true, null, "F4-C2", 1),
          accion(4, "ataque", "neutro", true, "F4-C2", "F1-C2"),
          accion(5, "bloqueo", "positivo", false, "F1-C2", "F2-C2"),
          accion(6, "defensa", "cobertura_positiva", false, "F2-C2", "F2-C2"),
          accion(7, "armado", 5, false, null, "F1-C4", 1),
          accion(8, "ataque", "punto_directo_ataque", false, "F1-C4", "F4-C2"),
        ]);
        resultados.push({ punto: 5, ok: r.ok, error: r.error });
      }

      // P6 - Free-ball punto (set 6)
      {
        const r = await guardarPuntoV2(partidoId, punto(6, "propio", "saque", "propio"), [
          accion(1, "saque", "positivo", false, null, "F4-C3", null, "flotado"),
          accion(2, "recepcion", "positiva", true, "F4-C3", "F5-C3"),
          accion(3, "armado", 5, true, null, "F4-C2", 1),
          accion(4, "ataque", "neutro", true, "F4-C2", "F1-C3"),
          accion(5, "libre", "libre", true, "F1-C3", "F2-C3"),
          accion(6, "recepcion", "positiva", false, "F2-C3", "F1-C2"),
          accion(7, "armado", 5, false, null, "F1-C1", 1),
          accion(8, "ataque", "punto_directo_ataque", false, "F1-C1", "F4-C3"),
        ]);
        resultados.push({ punto: 6, ok: r.ok, error: r.error });
      }

      const fallidos = resultados.filter((x) => !x.ok);
      if (fallidos.length > 0) {
        const detalle = fallidos.map((f) => `P${f.punto}: ${f.error ?? "sin error"}`).join(" | ");
        setMensaje({ texto: `❌ ${fallidos.length}/6 fallaron. ${detalle}`, tipo: "error" });
      } else {
        setMensaje({ texto: `✅ Partido TEST-E2E creado con 6 puntos. Andá a Partidos y verificá.`, tipo: "success" });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "desconocido";
      setMensaje({ texto: `❌ Error: ${msg}`, tipo: "error" });
    } finally {
      setCargando(false);
    }
  };

  const borrarTodoTEST = async () => {
    if (!equipoId) {
      setMensaje({ texto: "Elegí un equipo primero", tipo: "error" });
      return;
    }
    setCargando(true);
    setMensaje(null);
    try {
      const { data: partidos, error } = await supabase
        .from("partidos").select("id").eq("equipo_id", equipoId).like("rival", "TEST-E2E-%");
      if (error) {
        setMensaje({ texto: `❌ Error buscando: ${error.message}`, tipo: "error" });
        return;
      }
      const ids = (partidos ?? []).map((p: { id: string }) => p.id);
      if (ids.length === 0) {
        setMensaje({ texto: "No hay partidos TEST-E2E.", tipo: "success" });
        return;
      }
      await supabase.from("acciones_v2").delete().in("partido_id", ids);
      await supabase.from("puntos_v2").delete().in("partido_id", ids);
      await supabase.from("partidos").delete().in("id", ids);
      setMensaje({ texto: `✅ ${ids.length} partidos TEST-E2E borrados.`, tipo: "success" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "desconocido";
      setMensaje({ texto: `❌ Error borrando: ${msg}`, tipo: "error" });
    } finally {
      setCargando(false);
    }
  };

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <button onClick={() => router.push("/admin")} className="text-sm text-slate-500 hover:text-slate-700 mb-1">← Volver al panel</button>
          <h1 className="text-3xl font-bold text-slate-900">🧪 Test E2E</h1>
          <p className="text-slate-600 text-sm">Crea un partido TEST-E2E con 6 puntos (1 por set) y valida el flujo completo.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">Equipo</label>
          <select value={equipoId} onChange={(e) => setEquipoId(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
            <option value="">Elegí un equipo</option>
            {equipos.map((eq) => <option key={eq.id} value={eq.id}>{eq.nombre}</option>)}
          </select>
          {equipoId && jugadores.length === 0 && (
            <p className="text-xs text-amber-600 mt-2">⚠️ Este equipo no tiene jugadores. Los puntos se insertarán con jugador_id = null.</p>
          )}
        </div>

        {equipoId && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex gap-2 flex-wrap">
            <button onClick={crearPartidoYPuntos} disabled={cargando} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium disabled:opacity-50">
              {cargando ? "Creando..." : "Crear partido TEST + insertar 6 puntos"}
            </button>
            <button onClick={borrarTodoTEST} disabled={cargando} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium disabled:opacity-50">
              Borrar todo lo de TEST
            </button>
          </div>
        )}

        {mensaje && (
          <div className={`mt-4 p-4 rounded-lg border ${mensaje.tipo === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"}`}>
            {mensaje.texto}
          </div>
        )}
      </div>
    </main>
  );
}