"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { obtenerSesion, cerrarSesion, type Sesion } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  cargarDetalles,
  guardarDetalles,
  type AtaqueRow,
  type DefensaRow,
  type BloqueoRow,
  type SaqueRow,
  type RecepcionRow,
  type CambioRow,
} from "@/lib/db";
import {
  rotacionVacia,
  jugadorDeTipo,
  type RotacionPunto,
} from "@/lib/rotaciones";

import PanelRotacion from "./PanelRotacion";
import TableroArmadorPunto, {
  type ArmadoLinea,
  calcularZonaTendencia,
} from "./TableroArmadorPunto";
import CanchaAtaque from "./CanchaAtaque";
import CanchaDefensa from "./CanchaDefensa";
import CanchaBloqueo from "./CanchaBloqueo";
import CanchaSaque from "./CanchaSaque";
import CanchaRecepcion from "./CanchaRecepcion";

interface Equipo { id: string; nombre: string }
interface Jugador { id: string; nombre: string; numero: number | null; rol: string }
interface Partido { id: string; equipo_id: string; rival: string; fecha: string }
interface JugadorEquipo { id: string; jugador_id: string; equipo_id: string; activo: boolean }

type Pestana = "armado" | "ataque" | "defensa" | "bloqueo" | "saque" | "recepcion";

interface EstadoLocal {
  ts: number;
  rotaciones: Record<string, RotacionPunto>;
  armados: Record<string, ArmadoLinea[]>;
  ataques: AtaqueRow[];
  defensas: DefensaRow[];
  bloqueos: BloqueoRow[];
  saques: SaqueRow[];
  recepciones: RecepcionRow[];
  cambios: CambioRow[];
}

const CLAVE_LOCAL = "voleystats_dataentry_";
const TTL_MS = 3 * 24 * 60 * 60 * 1000;

const PESTANAS: { id: Pestana; nombre: string; icono: string }[] = [
  { id: "armado", nombre: "Armado", icono: "🎯" },
  { id: "ataque", nombre: "Ataque", icono: "⚡" },
  { id: "defensa", nombre: "Defensa", icono: "🛡️" },
  { id: "bloqueo", nombre: "Bloqueo", icono: "🧱" },
  { id: "saque", nombre: "Saque", icono: "🎯" },
  { id: "recepcion", nombre: "Recepción", icono: "🙌" },
];

export default function DataEntryPage() {
  const router = useRouter();
  const [sesion, setSesion] = useState<Sesion | null>(null);

  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [asignaciones, setAsignaciones] = useState<JugadorEquipo[]>([]);

  const [equipoId, setEquipoId] = useState("");
  const [partidoId, setPartidoId] = useState("");
  const [setActivo, setSetActivo] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [puntoActual, setPuntoActual] = useState(1);
  const [pestana, setPestana] = useState<Pestana>("armado");

  const [rotaciones, setRotaciones] = useState<Record<string, RotacionPunto>>({});
  const [armados, setArmados] = useState<Record<string, ArmadoLinea[]>>({});
  const [ataques, setAtaques] = useState<AtaqueRow[]>([]);
  const [defensas, setDefensas] = useState<DefensaRow[]>([]);
  const [bloqueos, setBloqueos] = useState<BloqueoRow[]>([]);
  const [saques, setSaques] = useState<SaqueRow[]>([]);
  const [recepciones, setRecepciones] = useState<RecepcionRow[]>([]);
  const [cambios, setCambios] = useState<CambioRow[]>([]);

  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const keyPuntoActual = `${setActivo}-${puntoActual}`;

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

  useEffect(() => {
    if (!partidoId) return;
    setCargando(true);
    limpiarTodo();

    const raw = typeof window !== "undefined" ? localStorage.getItem(CLAVE_LOCAL + partidoId) : null;
    if (raw) {
      try {
        const data: EstadoLocal = JSON.parse(raw);
        if (Date.now() - data.ts < TTL_MS) {
          if (confirm("Hay datos sin guardar de este partido. ¿Recuperarlos?")) {
            setRotaciones(data.rotaciones ?? {});
            setArmados(data.armados ?? {});
            setAtaques(data.ataques ?? []);
            setDefensas(data.defensas ?? []);
            setBloqueos(data.bloqueos ?? []);
            setSaques(data.saques ?? []);
            setRecepciones(data.recepciones ?? []);
            setCambios(data.cambios ?? []);
            setCargando(false);
            return;
          } else {
            localStorage.removeItem(CLAVE_LOCAL + partidoId);
          }
        } else {
          localStorage.removeItem(CLAVE_LOCAL + partidoId);
        }
      } catch {
        localStorage.removeItem(CLAVE_LOCAL + partidoId);
      }
    }

    cargarDetalles(partidoId).then((d) => {
      setCargando(false);

      const rot: Record<string, RotacionPunto> = {};
      (d.rotaciones as any[]).forEach((r) => {
        rot[`${r.set_numero}-${r.punto_numero}`] = {
          set_numero: r.set_numero,
          punto_numero: r.punto_numero,
          saque_equipo: r.saque_equipo,
          posiciones: r.posiciones,
          liberos: r.liberos,
        };
      });
      setRotaciones(rot);

      supabase
        .from("armados_detalle")
        .select("*")
        .eq("partido_id", partidoId)
        .order("created_at")
        .then(({ data }) => {
          if (!data) return;
          const porPunto: Record<string, ArmadoLinea[]> = {};
          data.forEach((a: any) => {
            const k = `${a.set_numero}-${a.punto_numero}`;
            porPunto[k] = porPunto[k] ?? [];
            porPunto[k].push({
              origen: { celda: a.origen_celda, mini: a.origen_mini },
              destino: { celda: a.destino_celda, mini: a.destino_mini },
              calidad: a.calidad,
            });
          });
          setArmados(porPunto);
        });

      setAtaques(d.ataques);
      setDefensas(d.defensas);
      setBloqueos(d.bloqueos);
      setSaques(d.saques);
      setRecepciones(d.recepciones);
      setCambios(d.cambios);

      const puntos = new Set<number>();
      [...d.ataques, ...d.defensas, ...d.bloqueos, ...d.saques, ...d.recepciones].forEach((x: any) => {
        if (x.set_numero === setActivo) puntos.add(x.punto_numero);
      });
      const maxP = puntos.size > 0 ? Math.max(...puntos) : 1;
      setPuntoActual(maxP);
    });
  }, [partidoId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!partidoId) return;
    const t = setTimeout(() => {
      const data: EstadoLocal = {
        ts: Date.now(),
        rotaciones,
        armados,
        ataques,
        defensas,
        bloqueos,
        saques,
        recepciones,
        cambios,
      };
      try {
        localStorage.setItem(CLAVE_LOCAL + partidoId, JSON.stringify(data));
      } catch {
        /* noop */
      }
    }, 800);
    return () => clearTimeout(t);
  }, [partidoId, rotaciones, armados, ataques, defensas, bloqueos, saques, recepciones, cambios]);

  // Teclas 1-6 → cambiar pestaña (solo si NO hay popup abierto)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (typeof document !== "undefined" && document.querySelector("[data-popup]")) return;
      const n = parseInt(e.key);
      if (n >= 1 && n <= 6) {
        setPestana(PESTANAS[n - 1].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const guardarRef = useRef<() => void>(() => {});
  guardarRef.current = guardarTodo;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "g") {
        e.preventDefault();
        guardarRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const limpiarTodo = () => {
    setRotaciones({});
    setArmados({});
    setAtaques([]);
    setDefensas([]);
    setBloqueos([]);
    setSaques([]);
    setRecepciones([]);
    setCambios([]);
    setPuntoActual(1);
  };

  const jugadoresDelEquipo = asignaciones
    .map((a) => jugadores.find((j) => j.id === a.jugador_id))
    .filter((j): j is Jugador => !!j);

  const nombreDe = (id: string | null) => {
    if (!id) return null;
    const j = jugadores.find((x) => x.id === id);
    return j ? `${j.nombre}${j.numero !== null ? ` #${j.numero}` : ""}` : "?";
  };

  const rotActual: RotacionPunto =
    rotaciones[keyPuntoActual] ??
    rotacionVacia(1, setActivo, puntoActual, "propio");

  const setRotActual = (r: RotacionPunto) =>
    setRotaciones((prev) => ({ ...prev, [keyPuntoActual]: r }));

  const filtrar = <T extends { set_numero: number; punto_numero: number }>(arr: T[]) =>
    arr.filter((x) => x.set_numero === setActivo && x.punto_numero === puntoActual);

  const atacanteSugerido: string | null = null;

  const agregarAtaque = (
    a: Omit<AtaqueRow, "id" | "partido_id" | "jugador_id" | "set_numero" | "punto_numero">
  ) => {
    const jugId = jugadorDeTipo(rotActual, "O") ?? jugadoresDelEquipo[0]?.id;
    if (!jugId) return;
    const row: AtaqueRow = {
      ...a,
      partido_id: partidoId,
      jugador_id: jugId,
      set_numero: setActivo,
      punto_numero: puntoActual,
    };
    setAtaques((prev) => [...prev, row]);
  };

  const agregarDefensa = (
    d: Omit<DefensaRow, "id" | "partido_id" | "jugador_id" | "set_numero" | "punto_numero">
  ) => {
    const jugId = jugadoresDelEquipo[0]?.id;
    if (!jugId) return;
    const row: DefensaRow = {
      ...d,
      partido_id: partidoId,
      jugador_id: jugId,
      set_numero: setActivo,
      punto_numero: puntoActual,
    };
    setDefensas((prev) => [...prev, row]);
  };

  const agregarBloqueo = (
    b: Omit<BloqueoRow, "id" | "partido_id" | "set_numero" | "punto_numero">
  ) => {
    const row: BloqueoRow = {
      ...b,
      partido_id: partidoId,
      set_numero: setActivo,
      punto_numero: puntoActual,
    };
    setBloqueos((prev) => [...prev, row]);
  };

  const agregarSaque = (
    s: Omit<SaqueRow, "id" | "partido_id" | "jugador_id" | "set_numero" | "punto_numero">
  ) => {
    const jugId = jugadorDeTipo(rotActual, "A") ?? jugadoresDelEquipo[0]?.id;
    if (!jugId) return;
    const row: SaqueRow = {
      ...s,
      partido_id: partidoId,
      jugador_id: jugId,
      set_numero: setActivo,
      punto_numero: puntoActual,
    };
    setSaques((prev) => [...prev, row]);
  };

  const agregarRecepcion = (
    r: Omit<RecepcionRow, "id" | "partido_id" | "jugador_id" | "set_numero" | "punto_numero">
  ) => {
    const jugId = jugadoresDelEquipo[0]?.id;
    if (!jugId) return;
    const row: RecepcionRow = {
      ...r,
      partido_id: partidoId,
      jugador_id: jugId,
      set_numero: setActivo,
      punto_numero: puntoActual,
    };
    setRecepciones((prev) => [...prev, row]);
  };

  async function guardarTodo() {
    if (!partidoId) return;
    if (!confirm("¿Guardar los datos de este partido en la base?")) return;

    setGuardando(true);
    setMensaje("");

    const filasArmados: any[] = [];
    for (const [k, lineas] of Object.entries(armados)) {
      const [sStr, pStr] = k.split("-");
      const s = parseInt(sStr);
      const p = parseInt(pStr);
      lineas.forEach((l) => {
        const zona = calcularZonaTendencia(l.destino.celda);
        filasArmados.push({
          partido_id: partidoId,
          jugador_id: jugadorDeTipo(
            rotaciones[k] ?? rotacionVacia(1, s, p),
            "A"
          ) ?? jugadoresDelEquipo[0]?.id,
          set_numero: s,
          punto_numero: p,
          origen_celda: l.origen.celda,
          origen_mini: l.origen.mini,
          destino_celda: l.destino.celda,
          destino_mini: l.destino.mini,
          zona_tendencia: zona,
          calidad: l.calidad,
          atacante_derecho: "arriba",
          armador_numero: 1,
        });
      });
    }

    await supabase.from("armados_detalle").delete().eq("partido_id", partidoId);

    if (filasArmados.length > 0) {
      const { error } = await supabase.from("armados_detalle").insert(filasArmados);
      if (error) {
        setGuardando(false);
        setMensaje("❌ Error armados: " + error.message);
        return;
      }
    }

    const rots = Object.values(rotaciones).map((r) => ({
      ...r,
      partido_id: partidoId,
    }));

    const res = await guardarDetalles(partidoId, {
      rotaciones: rots,
      ataques,
      defensas,
      bloqueos,
      saques,
      recepciones,
      cambios,
    });

    setGuardando(false);

    if (!res.ok) {
      setMensaje("❌ " + res.error);
      return;
    }

    localStorage.removeItem(CLAVE_LOCAL + partidoId);
    setMensaje("✅ Datos guardados");
  }

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
                <option value="">{equipoId ? "Elegí un partido" : "Primero elegí un equipo"}</option>
                {partidos.map((p) => (
                  <option key={p.id} value={p.id}>vs {p.rival} · {p.fecha}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {noHayPartido && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
            <p className="text-5xl mb-4">🎯</p>
            <p className="text-slate-600 font-medium">Elegí un equipo y un partido arriba</p>
          </div>
        )}

        {!noHayPartido && (
          <>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold text-slate-500 uppercase mr-2">Set:</span>
                  {([1, 2, 3, 4, 5] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => { setSetActivo(s); setPuntoActual(1); }}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                        setActivo === s
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold text-slate-500 uppercase mr-2">Punto:</span>
                  <button
                    onClick={() => setPuntoActual((p) => Math.max(1, p - 1))}
                    disabled={puntoActual === 1}
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm disabled:opacity-40"
                  >
                    ◀
                  </button>
                  <input
                    type="number"
                    value={puntoActual}
                    onChange={(e) => setPuntoActual(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 px-2 py-1.5 text-center border border-slate-300 rounded-lg text-sm"
                  />
                  <button
                    onClick={() => setPuntoActual((p) => p + 1)}
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm"
                  >
                    ▶
                  </button>
                </div>
              </div>
            </div>

            <div className="mb-4 flex justify-start">
              <PanelRotacion
                rotacion={rotActual}
                jugadores={jugadoresDelEquipo}
                onChange={setRotActual}
                numeroRotacion={1}
                onCambioRotacion={() => {}}
              />
            </div>

            <div className="flex flex-wrap gap-2 mb-4 border-b border-slate-200">
              {PESTANAS.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => setPestana(p.id)}
                  className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px flex items-center gap-2 ${
                    pestana === p.id
                      ? "border-emerald-500 text-emerald-600"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <span className="w-5 h-5 rounded bg-slate-200 text-slate-600 text-[10px] font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span>{p.icono} {p.nombre}</span>
                </button>
              ))}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
              {pestana === "armado" && (
                <TableroArmadorPunto
                  punto={{
                    numero: puntoActual,
                    lineas: armados[keyPuntoActual] ?? [],
                    armadorNumero: 1,
                  }}
                  onChange={(p) =>
                    setArmados((prev) => ({ ...prev, [keyPuntoActual]: p.lineas }))
                  }
                />
              )}

              {pestana === "ataque" && (
                <CanchaAtaque
                  ataquesDelPunto={filtrar(ataques)}
                  onAgregar={agregarAtaque}
                  onBorrarUltimo={() => {
                    const idx = ataques.findLastIndex(
                      (x) => x.set_numero === setActivo && x.punto_numero === puntoActual
                    );
                    if (idx >= 0) setAtaques((prev) => prev.filter((_, i) => i !== idx));
                  }}
                  atacanteSugerido={atacanteSugerido}
                />
              )}

              {pestana === "defensa" && (
                <CanchaDefensa
                  defensasDelPunto={filtrar(defensas)}
                  onAgregar={agregarDefensa}
                  onBorrarUltimo={() => {
                    const idx = defensas.findLastIndex(
                      (x) => x.set_numero === setActivo && x.punto_numero === puntoActual
                    );
                    if (idx >= 0) setDefensas((prev) => prev.filter((_, i) => i !== idx));
                  }}
                  onLimpiarPunto={() =>
                    setDefensas((prev) =>
                      prev.filter(
                        (x) =>
                          !(x.set_numero === setActivo && x.punto_numero === puntoActual)
                      )
                    )
                  }
                />
              )}

              {pestana === "bloqueo" && (
                <CanchaBloqueo
                  bloqueosDelPunto={filtrar(bloqueos)}
                  jugadoresRed={
                    [
                      { zona: 4 as const, jugador_id: rotActual.posiciones[4]?.jugador_id ?? "", nombre: nombreDe(rotActual.posiciones[4]?.jugador_id ?? null) ?? "Z4" },
                      { zona: 3 as const, jugador_id: rotActual.posiciones[3]?.jugador_id ?? "", nombre: nombreDe(rotActual.posiciones[3]?.jugador_id ?? null) ?? "Z3" },
                      { zona: 2 as const, jugador_id: rotActual.posiciones[2]?.jugador_id ?? "", nombre: nombreDe(rotActual.posiciones[2]?.jugador_id ?? null) ?? "Z2" },
                    ].filter((j) => j.jugador_id)
                  }
                  onAgregar={agregarBloqueo}
                  onBorrarUltimo={() => {
                    const idx = bloqueos.findLastIndex(
                      (x) => x.set_numero === setActivo && x.punto_numero === puntoActual
                    );
                    if (idx >= 0) setBloqueos((prev) => prev.filter((_, i) => i !== idx));
                  }}
                />
              )}

              {pestana === "saque" && (
                <CanchaSaque
                  saquesDelPunto={filtrar(saques)}
                  onAgregar={agregarSaque}
                  onBorrarUltimo={() => {
                    const idx = saques.findLastIndex(
                      (x) => x.set_numero === setActivo && x.punto_numero === puntoActual
                    );
                    if (idx >= 0) setSaques((prev) => prev.filter((_, i) => i !== idx));
                  }}
                />
              )}

              {pestana === "recepcion" && (
                <CanchaRecepcion
                  recepcionesDelPunto={filtrar(recepciones)}
                  onAgregar={agregarRecepcion}
                  onBorrarUltimo={() => {
                    const idx = recepciones.findLastIndex(
                      (x) => x.set_numero === setActivo && x.punto_numero === puntoActual
                    );
                    if (idx >= 0) setRecepciones((prev) => prev.filter((_, i) => i !== idx));
                  }}
                />
              )}
            </div>

            <div className="sticky bottom-4 bg-white rounded-2xl shadow-lg border border-slate-200 p-4 flex items-center justify-between">
              <p className="text-sm text-slate-600">
                {mensaje || "Ctrl+G para guardar. Teclas 1-6 cambian de pestaña. Autoguardado local."}
              </p>
              <button
                onClick={guardarTodo}
                disabled={guardando}
                className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white font-medium rounded-lg transition"
              >
                {guardando ? "Guardando..." : "💾 Guardar Datos (Ctrl+G)"}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}