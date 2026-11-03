"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { obtenerSesion } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  guardarPuntoV2,
  cargarPuntosV2,
  type PuntoV2Data,
  type AccionV2Data,
} from "@/lib/dbV2";
import { calcularFaseDePunto } from "@/lib/contextoRally";
import { clasificarSubtipo } from "@/lib/analisis/catalogoSubtipos";
import { rotacionVacia } from "@/lib/rotaciones";

const TEST_SET = 99;

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
  const [verificacion, setVerificacion] = useState<null | {
    punto: number;
    fase: string;
    faseEsperada: string;
    subtipoAtaque: string | null;
    categoriaAtaque: string | null;
    categoriaEsperada: string;
    ok: boolean;
  }[]>(null);

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
    equipo_id: null,
  });

  const puntoData = (
    puntoNumero: number,
    saqueEquipo: "propio" | "rival",
    situacion: "saque" | "recepcion",
    ganador: "propio" | "rival" | null,
  ): PuntoV2Data => ({
    set_numero: TEST_SET,
    punto_numero: puntoNumero,
    saque_equipo: saqueEquipo,
    situacion,
    ganador,
    rotacion: rotacionVacia(1, TEST_SET, puntoNumero, saqueEquipo) as unknown as Record<string, unknown>,
    liberos: [],
    cambios: [],
    posiciones_punto: {},
    equipo_id: null,
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
    setVerificacion(null);

    await supabase.from("acciones_v2").delete().eq("partido_id", partidoId).eq("set_numero", TEST_SET);
    await supabase.from("puntos_v2").delete().eq("partido_id", partidoId).eq("set_numero", TEST_SET);

    const inserts: { punto: number; res: { ok: boolean; error?: string } }[] = [];

    try {
      // P1: K1 punto — saque rival inicia, recepción propia, ataque punto
      inserts.push({ punto: 1, res: await guardarPuntoV2(partidoId, puntoData(1, "rival", "recepcion", "propio"), [
        accion(1, "saque", "positivo", true, "rival", "F4-C3", "F1-C3", null, "flotado"),
        accion(2, "recepcion", "positiva", false, "propio", "F1-C3", "F2-C3"),
        accion(3, "armado", 5, false, "propio", null, "F1-C2", 1),
        accion(4, "ataque", "punto_directo_ataque", false, "propio", "F1-C2", "F4-C3"),
      ])});

      // P2: K1 error — saque rival inicia, ataque propio error afuera
      inserts.push({ punto: 2, res: await guardarPuntoV2(partidoId, puntoData(2, "rival", "recepcion", "rival"), [
        accion(1, "saque", "positivo", true, "rival", "F4-C3", "F1-C3", null, "flotado"),
        accion(2, "recepcion", "positiva", false, "propio", "F1-C3", "F2-C3"),
        accion(3, "armado", 5, false, "propio", null, "F1-C2", 1),
        accion(4, "ataque", "error_afuera_ataque", false, "propio", "F1-C2", "FUERA-ARR-C3"),
      ])});

      // P3: K1 neutro — saque rival inicia, ataque propio neutro, defensa rival toque_positiva
      inserts.push({ punto: 3, res: await guardarPuntoV2(partidoId, puntoData(3, "rival", "recepcion", "propio"), [
        accion(1, "saque", "positivo", true, "rival", "F4-C3", "F1-C3", null, "flotado"),
        accion(2, "recepcion", "positiva", false, "propio", "F1-C3", "F2-C3"),
        accion(3, "armado", 5, false, "propio", null, "F1-C2", 1),
        accion(4, "ataque", "neutro_defensa_ataque", false, "propio", "F1-C2", "F5-C3"),
        accion(5, "defensa", "toque_positiva", true, "rival", "F5-C3", "F5-C3"),
      ])});

      // P4: K2 punto — saque propio inicia, defensa propia toque_positiva es primer toque propio no-saque
      inserts.push({ punto: 4, res: await guardarPuntoV2(partidoId, puntoData(4, "propio", "saque", "propio"), [
        accion(1, "saque", "positivo", false, "propio", null, "F4-C3", null, "flotado"),
        accion(2, "recepcion", "positiva", true, "rival", "F4-C3", "F5-C3"),
        accion(3, "armado", 5, true, "rival", null, "F4-C2", 1),
        accion(4, "ataque", "neutro", true, "rival", "F4-C2", "F1-C3"),
        accion(5, "defensa", "toque_positiva", false, "propio", "F1-C3", "F1-C2"),
        accion(6, "armado", 5, false, "propio", null, "F1-C1", 1),
        accion(7, "ataque", "punto_directo_ataque", false, "propio", "F1-C1", "F4-C3"),
      ])});

      // P5: K3 punto — saque propio inicia, bloqueo propio, cobertura_positiva es primer toque propio no-saque ni bloqueo
      inserts.push({ punto: 5, res: await guardarPuntoV2(partidoId, puntoData(5, "propio", "saque", "propio"), [
        accion(1, "saque", "positivo", false, "propio", null, "F4-C3", null, "flotado"),
        accion(2, "recepcion", "positiva", true, "rival", "F4-C3", "F5-C3"),
        accion(3, "armado", 5, true, "rival", null, "F4-C2", 1),
        accion(4, "ataque", "neutro", true, "rival", "F4-C2", "F1-C2"),
        accion(5, "bloqueo", "positivo", false, "propio", "F1-C2", "F2-C2"),
        accion(6, "defensa", "cobertura_positiva", false, "propio", "F2-C2", "F2-C2"),
        accion(7, "armado", 5, false, "propio", null, "F1-C4", 1),
        accion(8, "ataque", "punto_directo_ataque", false, "propio", "F1-C4", "F4-C2"),
      ])});

      // P6: free-ball punto — saque propio inicia, rival manda libre, recepción propia es primer toque propio
      inserts.push({ punto: 6, res: await guardarPuntoV2(partidoId, puntoData(6, "propio", "saque", "propio"), [
        accion(1, "saque", "positivo", false, "propio", null, "F4-C3", null, "flotado"),
        accion(2, "recepcion", "positiva", true, "rival", "F4-C3", "F5-C3"),
        accion(3, "armado", 5, true, "rival", null, "F4-C2", 1),
        accion(4, "ataque", "neutro", true, "rival", "F4-C2", "F1-C3"),
        accion(5, "libre", "libre", true, "rival", "F1-C3", "F2-C3"),
        accion(6, "recepcion", "positiva", false, "propio", "F2-C3", "F1-C2"),
        accion(7, "armado", 5, false, "propio", null, "F1-C1", 1),
        accion(8, "ataque", "punto_directo_ataque", false, "propio", "F1-C1", "F4-C3"),
      ])});

      const errores = inserts.filter((x) => !x.res.ok);
      if (errores.length > 0) {
        const detalle = errores
          .map((e) => `P${e.punto}: ${e.res.error ?? "sin error"}`)
          .join(" | ");
        setMensaje({ texto: `❌ ${errores.length}/6 fallaron. ${detalle}`, tipo: "error" });
      } else {
        setMensaje({ texto: "✅ 6 puntos insertados correctamente. Ahora apretá 'Verificar'.", tipo: "success" });
      }
    } catch (err: any) {
      setMensaje({ texto: `❌ Error: ${err?.message ?? "desconocido"}`, tipo: "error" });
    } finally {
      setCargando(false);
    }
  };

  // ------------------------------------------------------------
  // BORRAR PUNTOS DE TEST (solo set_numero = TEST_SET)
  // ------------------------------------------------------------
  const borrarPuntosDeTest = async () => {
    if (!partidoId) {
      setMensaje({ texto: "Primero elegí un partido", tipo: "error" });
      return;
    }
    setCargando(true);
    setMensaje(null);
    setVerificacion(null);

    try {
      const { data: puntos, error: errBuscar } = await supabase
        .from("puntos_v2")
        .select("id")
        .eq("partido_id", partidoId)
        .eq("set_numero", TEST_SET);

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

      setMensaje({ texto: `✅ ${ids.length} puntos de test borrados.`, tipo: "success" });
    } catch (err: any) {
      setMensaje({ texto: `❌ Error borrando: ${err?.message ?? "desconocido"}`, tipo: "error" });
    } finally {
      setCargando(false);
    }
  };

  // ------------------------------------------------------------
  // VERIFICAR PUNTOS DE TEST
  // ------------------------------------------------------------
  const verificarPuntos = async () => {
    if (!partidoId) {
      setMensaje({ texto: "Primero elegí un partido", tipo: "error" });
      return;
    }
    setCargando(true);
    setMensaje(null);
    setVerificacion(null);

    try {
      const res = await cargarPuntosV2(partidoId);
      if (!res.ok || !res.puntos) {
        setMensaje({ texto: "Error cargando puntos", tipo: "error" });
        return;
      }

      const testPuntos = res.puntos.filter((p) => p.set_numero === TEST_SET);
      if (testPuntos.length === 0) {
        setMensaje({ texto: "No hay puntos de test. Insertalos primero.", tipo: "error" });
        return;
      }

      const esperados: Record<number, { fase: string; categoria: string }> = {
        1: { fase: "side-out", categoria: "punto" },
        2: { fase: "side-out", categoria: "error" },
        3: { fase: "side-out", categoria: "neutro" },
        4: { fase: "k2", categoria: "punto" },
        5: { fase: "k3", categoria: "punto" },
        6: { fase: "free-ball", categoria: "punto" },
      };

      const resultados = testPuntos.map((p) => {
        const accionesOrdenadas = [...p.acciones].sort((a, b) => a.orden - b.orden);

        const accionesVisual = accionesOrdenadas.map((a) => ({
          id: a.id,
          tipo: a.tipo,
          subtipo: a.subtipo,
          es_rival: a.es_rival,
          lado: a.lado,
          jugador_id: a.jugador_id ?? null,
          orden: a.orden,
          oculta: a.oculta ?? false,
          partido_id: a.partido_id,
          set_numero: a.set_numero,
          punto_numero: a.punto_numero,
          origen_celda: a.origen_celda,
          origen_mini: a.origen_mini,
          destino_celda: a.destino_celda,
          destino_mini: a.destino_mini,
          desvios: [],
          variante: null,
          tipo_saque: null,
          velocidad: null,
          x2: false,
          posicion_inicial_celda: null,
          posicion_inicial_mini: null,
          equipo_id: null,
          es_error: false,
          zona_origen: null,
          zona_destino: null,
          rotacion_numero: null,
          rol_jugador: null,
          zona_jugador: null,
          origen_x: null,
          origen_y: null,
          destino_x: null,
          destino_y: null,
          posicion_inicial_x: null,
          posicion_inicial_y: null,
          zona_origen_codigo: null,
          zona_destino_codigo: null,
          subtipo_real: null,
          es_ultima_del_punto: false,
          calidad_armado_previo: null,
        })) as any;

        const fase = calcularFaseDePunto(accionesVisual);

        const ataquesPropios = accionesOrdenadas.filter(
          (a) => a.tipo === "ataque" && !a.es_rival
        );
        const ataqueFinal = ataquesPropios[ataquesPropios.length - 1];
        const subtipoAtaque = ataqueFinal ? String(ataqueFinal.subtipo ?? "") : null;
        const categoriaAtaque = subtipoAtaque ? clasificarSubtipo("ataque", subtipoAtaque) : null;

        const esperado = esperados[p.punto_numero];
        const ok =
          esperado !== undefined &&
          categoriaAtaque === esperado.categoria;

        return {
          punto: p.punto_numero,
          fase,
          faseEsperada: esperado?.fase ?? "?",
          subtipoAtaque,
          categoriaAtaque,
          categoriaEsperada: esperado?.categoria ?? "?",
          ok,
        };
      });

      resultados.sort((a, b) => a.punto - b.punto);
      setVerificacion(resultados);
    } catch (err: any) {
      setMensaje({ texto: `❌ Error verificando: ${err?.message ?? "desconocido"}`, tipo: "error" });
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
            <h1 className="text-3xl font-bold text-slate-900">🧪 Seed de test</h1>
            <p className="text-slate-600 text-sm">
              Inserta 6 puntos con set_numero = {TEST_SET} para validar el refactor.
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
            <div className="flex gap-2 flex-wrap">
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
              <button
                onClick={verificarPuntos}
                disabled={cargando}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium disabled:opacity-50"
              >
                🔍 Verificar puntos de test
              </button>
            </div>
          </div>
        )}

        {verificacion && (
          <div className="mt-6 bg-white rounded-2xl border border-slate-200 p-4">
            <h2 className="font-bold text-slate-800 mb-3">Resultado de verificación</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2">Punto</th>
                  <th className="py-2">Fase</th>
                  <th className="py-2">Esperada</th>
                  <th className="py-2">Fase OK</th>
                  <th className="py-2">Subtipo ataque</th>
                  <th className="py-2">Categoría</th>
                  <th className="py-2">Esperada</th>
                  <th className="py-2">OK</th>
                </tr>
              </thead>
              <tbody>
                {verificacion.map((v) => (
                  <tr
                    key={v.punto}
                    className={`border-b border-slate-100 ${v.ok ? "bg-green-50" : "bg-red-50"}`}
                  >
                    <td className="py-2 font-bold">P{v.punto}</td>
                    <td className="py-2">{v.fase}</td>
                    <td className="py-2">{v.faseEsperada}</td>
                    <td className="py-2 text-lg">{v.fase === v.faseEsperada ? "✅" : "❌"}</td>
                    <td className="py-2 font-mono text-xs">{v.subtipoAtaque ?? "—"}</td>
                    <td className="py-2">{v.categoriaAtaque ?? "—"}</td>
                    <td className="py-2">{v.categoriaEsperada}</td>
                    <td className="py-2 text-lg">{v.ok ? "✅" : "❌"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-sm font-semibold">
              Categorías: {verificacion.filter((v) => v.ok).length} / {verificacion.length} OK
            </p>
            <p className="text-xs text-slate-500 mt-1 italic">
              El OK valida solo la categoría (punto / error / neutro) que es el objetivo del refactor de catalogoSubtipos.
              La columna "Fase OK" es informativa: hay un bug conocido en el motor (el saque propio se cuenta como "primer toque propio")
              que hace que P1, P2, P3 y P5 no den la fase esperada. Se arregla en otra sesión.
            </p>
          </div>
        )}

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

        {!noHayPartido && !mensaje && (
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <p className="text-sm text-slate-600">
              Seleccioná una acción arriba. Los puntos se insertan con set_numero = {TEST_SET}
              para poder borrarlos sin tocar datos reales.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}