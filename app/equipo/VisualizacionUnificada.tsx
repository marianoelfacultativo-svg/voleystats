"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import {
  cargarAccionesUnificadas,
  type AccionVisual,
  type PuntoConAcciones,
} from "./adaptadorUnificadoV2";
import PanelFiltros3D, {
  aplicarFiltros,
  FILTROS3D_VACIO,
  type Filtros3D,
} from "./PanelFiltros3D";
import type { ModoUnificado, Vista } from "./CanchaUnificada3D";

const CanchaUnificada3D = dynamic(
  () => import("./CanchaUnificada3D"),
  { ssr: false }
);

// ============================================================
// TIPOS Y CONSTANTES
// ============================================================

interface Props {
  equipoId: string;
  nombreEquipo?: string;
  jugadorId?: string | null;
}

interface Partido {
  id: string;
  rival: string;
  fecha: string;
  equipo_id: string;
  equipo_rival_id: string | null;
}

interface Jugador {
  id: string;
  nombre: string;
  numero: number | null;
}

interface Equipo {
  id: string;
  nombre: string;
}

const MODOS: { id: ModoUnificado; label: string; icono: string }[] = [
  { id: "fundamento", label: "Por fundamento", icono: "🎯" },
  { id: "armados", label: "Armados", icono: "🧠" },
  { id: "punto-completo", label: "Punto completo", icono: "🎬" },
];

const VISTAS: { id: Vista; label: string }[] = [
  { id: "iso-izq", label: "Iso izq." },
  { id: "iso-der", label: "Iso der." },
  { id: "top", label: "Superior" },
  { id: "front", label: "Frontal" },
  { id: "front-rival", label: "Frontal rival" },
  { id: "paralela-izq", label: "Paralela izq." },
  { id: "paralela-der", label: "Paralela der." },
];

// ============================================================
// VELOCIDAD DE ANIMACIÓN — 3 niveles
// ============================================================
//
// nivel 1 (▶)     → lento      → velocidadAnimacion 0.5
// nivel 2 (▶▶)    → normal     → velocidadAnimacion 1.0
// nivel 3 (▶▶▶)   → rápido     → velocidadAnimacion 2.0
//
type NivelVelocidad = 1 | 2 | 3;

const VELOCIDAD_POR_NIVEL: Record<NivelVelocidad, number> = {
  1: 0.5,
  2: 1.0,
  3: 2.0,
};

function detectarWebGL(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    return !!gl;
  } catch {
    return false;
  }
}

// ============================================================
// COMPONENTE
// ============================================================

export default function VisualizacionUnificada({
  equipoId,
  nombreEquipo,
  jugadorId,
}: Props) {
  // -------- Selector de partido --------
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [partidoSeleccionado, setPartidoSeleccionado] = useState<string>("");
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);

  // -------- Datos cargados --------
  const [accionesPartido, setAccionesPartido] = useState<AccionVisual[]>([]);
  const [cargando, setCargando] = useState(false);

  // -------- Modo + vista --------
  const [modo, setModo] = useState<ModoUnificado>("fundamento");
  const [vista, setVista] = useState<Vista>("iso-izq");
  const [mostrarEstelas, setMostrarEstelas] = useState(true);

  // -------- Velocidad de animación (solo punto-completo) --------
  const [nivelVelocidad, setNivelVelocidad] = useState<NivelVelocidad>(2);

  // -------- Filtros --------
  const [filtros, setFiltros] = useState<Filtros3D>({ ...FILTROS3D_VACIO });

  // -------- Punto seleccionado (modo punto-completo) --------
  const [setActivo, setSetActivo] = useState<number | null>(null);
  const [puntoActivo, setPuntoActivo] = useState<number | null>(null);

  // -------- WebGL --------
  const [webglOk, setWebglOk] = useState<boolean | null>(null);

  // ============================================================
  // CARGA INICIAL
  // ============================================================

  useEffect(() => {
    setWebglOk(detectarWebGL());
  }, []);

  useEffect(() => {
    if (!equipoId) return;

    (async () => {
      const { data: partRes } = await supabase
        .from("partidos")
        .select("id, rival, fecha, equipo_id, equipo_rival_id")
        .or(`equipo_id.eq.${equipoId},equipo_rival_id.eq.${equipoId}`)
        .order("fecha", { ascending: false });

      setPartidos(partRes ?? []);

      const { data: eqRes } = await supabase
        .from("equipos")
        .select("id, nombre");
      setEquipos(eqRes ?? []);

      const { data: jeRes } = await supabase
        .from("jugador_equipo")
        .select("jugador_id")
        .eq("equipo_id", equipoId)
        .eq("activo", true);

      const ids = (jeRes ?? []).map((x: any) => x.jugador_id);
      if (ids.length > 0) {
        const { data: jugRes } = await supabase
          .from("jugadores")
          .select("id, nombre, numero")
          .in("id", ids);
        setJugadores((jugRes ?? []) as Jugador[]);
      } else {
        setJugadores([]);
      }
    })();
  }, [equipoId]);

  // ============================================================
  // NOMBRE DEL RIVAL VISIBLE
  // ============================================================
  //
  // Si soy el equipo_rival_id del partido, el rival visible es el
  // equipo local (equipo_id), no el texto guardado en partido.rival.
  const nombreRivalDe = (p: Partido) => {
    if (p.equipo_rival_id === equipoId) {
      const local = equipos.find((e) => e.id === p.equipo_id);
      if (local) return local.nombre;
    }
    return p.rival;
  };

  // ============================================================
  // CARGA DE ACCIONES DEL PARTIDO
  // ============================================================
  //
  // Se pasa equipoId a cargarAccionesUnificadas para que el
  // adaptador flipee la perspectiva (y recalcule subtipos) si
  // el equipo actual es el rival del partido.

  useEffect(() => {
    if (!partidoSeleccionado) {
      setAccionesPartido([]);
      setSetActivo(null);
      setPuntoActivo(null);
      return;
    }
    setCargando(true);

    (async () => {
      const res = await cargarAccionesUnificadas(
        partidoSeleccionado,
        equipoId
      );
      setAccionesPartido(res.acciones);

      if (res.puntos.length > 0) {
        const primero = res.puntos[0];
        setSetActivo(primero.set_numero);
        setPuntoActivo(primero.punto_numero);
      } else {
        setSetActivo(null);
        setPuntoActivo(null);
      }

      setCargando(false);
    })();
  }, [partidoSeleccionado, equipoId]);

  // ============================================================
  // FILTRADO
  // ============================================================
  //
  // `accionesPartido` se pasa como TERCER argumento a
  // `aplicarFiltros` para que los filtros tácticos (prev/next/
  // repetición) vean el universo COMPLETO del partido, aunque
  // `base` venga prefiltrado por `jugadorId`.

  const accionesFiltradas = useMemo(() => {
    let base = accionesPartido;
    if (jugadorId) {
      base = base.filter((a) => a.jugador_id === jugadorId);
    }
    return aplicarFiltros(base, filtros, accionesPartido);
  }, [accionesPartido, filtros, jugadorId]);

  // Sets disponibles: derivados del partido SIN filtros para que cambiar
  // un set no haga desaparecer los demás del selector.
  const setsDisponibles = useMemo(() => {
    const s = new Set<number>();
    accionesPartido.forEach((a) => s.add(a.set_numero));
    return Array.from(s).sort();
  }, [accionesPartido]);

  // Puntos disponibles: dependen solo del set (para no perder puntos
  // si se aplican otros filtros).
  const puntosDisponibles = useMemo(() => {
    const p = new Set<number>();
    accionesPartido
      .filter(
        (a) => filtros.set === "todos" || a.set_numero === filtros.set
      )
      .forEach((a) => p.add(a.punto_numero));
    return Array.from(p).sort((a, b) => a - b);
  }, [accionesPartido, filtros.set]);

  const jugadoresParaFiltro = useMemo(
    () =>
      jugadores
        .map((j) => ({
          id: j.id,
          nombre: j.nombre + (j.numero !== null ? ` #${j.numero}` : ""),
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [jugadores]
  );

  // Puntos agrupados (para modo punto-completo), tras filtros
  const puntosAgrupados = useMemo<PuntoConAcciones[]>(() => {
    const map = new Map<string, PuntoConAcciones>();
    for (const a of accionesFiltradas) {
      const k = `${a.set_numero}-${a.punto_numero}`;
      let p = map.get(k);
      if (!p) {
        p = {
          set_numero: a.set_numero,
          punto_numero: a.punto_numero,
          acciones: [],
        };
        map.set(k, p);
      }
      p.acciones.push(a);
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.set_numero !== b.set_numero) return a.set_numero - b.set_numero;
      return a.punto_numero - b.punto_numero;
    });
  }, [accionesFiltradas]);

  // Sets/puntos para el selector de punto-completo
  const setsDelPartido = useMemo(() => {
    const s = new Set<number>();
    for (const p of puntosAgrupados) s.add(p.set_numero);
    return Array.from(s).sort();
  }, [puntosAgrupados]);

  const puntosDelSetActivo = useMemo(() => {
    if (setActivo === null) return [];
    return puntosAgrupados
      .filter((p) => p.set_numero === setActivo)
      .map((p) => p.punto_numero);
  }, [puntosAgrupados, setActivo]);

  // Auto-selección de set/punto válidos
  useEffect(() => {
    if (modo !== "punto-completo") return;
    if (puntosAgrupados.length === 0) {
      if (setActivo !== null) setSetActivo(null);
      if (puntoActivo !== null) setPuntoActivo(null);
      return;
    }
    const setValido =
      setActivo !== null && setsDelPartido.includes(setActivo)
        ? setActivo
        : setsDelPartido[0];
    if (setValido !== setActivo) {
      setSetActivo(setValido);
    }
    const puntosSet = puntosAgrupados
      .filter((p) => p.set_numero === setValido)
      .map((p) => p.punto_numero);
    if (puntoActivo === null || !puntosSet.includes(puntoActivo)) {
      setPuntoActivo(puntosSet[0] ?? null);
    }
  }, [modo, puntosAgrupados, setsDelPartido, setActivo, puntoActivo]);

  // ============================================================
  // ACCIONES PARA EL 3D
  // ============================================================

  const accionesPara3D: AccionVisual[] = useMemo(() => {
    if (modo === "punto-completo") {
      return [];
    }
    if (modo === "armados") {
      return accionesFiltradas.filter((a) => a.tipo === "armado");
    }
    return accionesFiltradas;
  }, [modo, accionesFiltradas]);

  const puntoSeleccionado3D = useMemo(() => {
    if (modo !== "punto-completo") return null;
    if (setActivo === null || puntoActivo === null) return null;
    return { set: setActivo, punto: puntoActivo };
  }, [modo, setActivo, puntoActivo]);

  const velocidadAnimacion = VELOCIDAD_POR_NIVEL[nivelVelocidad];

  // ============================================================
  // HANDLERS DE UI
  // ============================================================

  const cambiarModo = (m: ModoUnificado) => setModo(m);

  const irPunto = (dir: -1 | 1) => {
    if (setActivo === null || puntoActivo === null) return;
    const idx = puntosDelSetActivo.indexOf(puntoActivo);
    if (idx < 0) return;
    const nuevoIdx = idx + dir;
    if (nuevoIdx < 0 || nuevoIdx >= puntosDelSetActivo.length) return;
    setPuntoActivo(puntosDelSetActivo[nuevoIdx]);
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="space-y-3">
      {/* ============ SELECTOR DE PARTIDO ============ */}
      <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-4">
        <label className="block text-sm font-bold text-emerald-900 mb-2">
          📅 Elegí un partido para visualizar
          {nombreEquipo ? ` · ${nombreEquipo}` : ""}
        </label>
        <select
          value={partidoSeleccionado}
          onChange={(e) => setPartidoSeleccionado(e.target.value)}
          className="w-full px-3 py-2.5 text-base font-medium border-2 border-emerald-400 rounded-lg focus:outline-none focus:border-emerald-600 bg-white"
        >
          <option value="">— Seleccioná un partido —</option>
          {partidos.map((p) => (
            <option key={p.id} value={p.id}>
              vs {nombreRivalDe(p)} · {p.fecha}
            </option>
          ))}
        </select>
        {partidos.length === 0 && (
          <p className="text-xs text-emerald-700 mt-2">
            Este equipo todavía no tiene partidos cargados.
          </p>
        )}
      </div>

      {/* ============ EMPTY STATE ============ */}
      {!partidoSeleccionado && (
        <div className="card rounded-2xl border border-white/10 shadow-xl p-12 text-center">
          <p className="text-5xl mb-4">🔭</p>
          <p className="text-slate-600 font-medium">
            Elegí un partido arriba para ver las visualizaciones
          </p>
          <p className="text-slate-400 text-sm mt-2">
            Se carga un partido a la vez para que sea rápido
          </p>
        </div>
      )}

      {partidoSeleccionado && (
        <>
          {/* ============ TABS DE MODO ============ */}
          <div className="card rounded-2xl border border-white/10 shadow-xl p-2 flex flex-wrap gap-1">
            {MODOS.map((m) => (
              <button
                key={m.id}
                onClick={() => cambiarModo(m.id)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                  modo === m.id
                    ? "bg-emerald-500 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {m.icono} {m.label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1">
              {/* Selector de velocidad — solo en modo punto-completo */}
              {modo === "punto-completo" && (
                <div
                  className="flex items-center gap-0.5 bg-white border border-slate-300 rounded-lg overflow-hidden"
                  title="Velocidad de la animación"
                >
                  {([1, 2, 3] as NivelVelocidad[]).map((nivel) => {
                    const activo = nivelVelocidad === nivel;
                    return (
                      <button
                        key={nivel}
                        onClick={() => setNivelVelocidad(nivel)}
                        className={`px-2 h-7 text-[11px] font-bold transition ${
                          activo
                            ? "bg-emerald-500 text-white"
                            : "bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                        title={
                          nivel === 1
                            ? "Lento (0.5x)"
                            : nivel === 2
                            ? "Normal (1x)"
                            : "Rápido (2x)"
                        }
                      >
                        {"▶".repeat(nivel)}
                      </button>
                    );
                  })}
                </div>
              )}

              <button
                onClick={() => setMostrarEstelas((v) => !v)}
                className={`px-2.5 py-1 text-xs rounded-lg border transition ${
                  mostrarEstelas
                    ? "bg-emerald-500 text-white border-emerald-500"
                    : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                }`}
                title="Mostrar u ocultar líneas de trayectoria"
              >
                {mostrarEstelas ? "✓ Estelas" : "Estelas ocultas"}
              </button>
            </div>
          </div>

          {/* ============ VISTAS ============ */}
          <div className="card rounded-2xl border border-white/10 shadow-xl p-2 flex flex-wrap gap-1">
            <span className="text-[10px] font-semibold text-slate-500 uppercase self-center mr-2">
              Vista:
            </span>
            {VISTAS.map((v) => (
              <button
                key={v.id}
                onClick={() => setVista(v.id)}
                className={`px-2.5 py-1 text-xs rounded-lg border transition ${
                  vista === v.id
                    ? "bg-slate-800 text-white border-slate-800"
                    : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          {/* ============ PANEL DE FILTROS ============ */}
          <PanelFiltros3D
            filtros={filtros}
            onChange={setFiltros}
            setsDisponibles={setsDisponibles}
            puntosDisponibles={puntosDisponibles}
            jugadores={jugadoresParaFiltro}
            totalAcciones={accionesPartido.length}
            accionesFiltradas={accionesFiltradas.length}
          />

          {/* ============ SELECTOR DE PUNTO (solo punto-completo) ============ */}
          {modo === "punto-completo" && (
            <div className="bg-fuchsia-50 border-2 border-fuchsia-300 rounded-2xl p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-bold text-fuchsia-900">
                  🎬 Punto a reproducir
                </p>
                <span className="text-[10px] text-fuchsia-700">
                  {puntosAgrupados.length} puntos disponibles
                </span>
              </div>

              {puntosAgrupados.length === 0 ? (
                <p className="text-xs text-fuchsia-700 italic">
                  No hay puntos con los filtros actuales.
                </p>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={setActivo ?? ""}
                    onChange={(e) => {
                      const s = parseInt(e.target.value);
                      setSetActivo(s);
                      const primerosPuntos = puntosAgrupados
                        .filter((p) => p.set_numero === s)
                        .map((p) => p.punto_numero);
                      setPuntoActivo(primerosPuntos[0] ?? null);
                    }}
                    className="px-2 py-1 text-xs border border-fuchsia-300 rounded-lg bg-white"
                  >
                    {setsDelPartido.map((s) => (
                      <option key={s} value={s}>
                        Set {s}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => irPunto(-1)}
                    disabled={
                      puntoActivo === null ||
                      puntosDelSetActivo.indexOf(puntoActivo) === 0
                    }
                    className="px-2 py-1 text-xs bg-white border border-fuchsia-300 rounded-lg hover:bg-fuchsia-100 disabled:opacity-40"
                  >
                    ◀
                  </button>

                  <select
                    value={puntoActivo ?? ""}
                    onChange={(e) =>
                      setPuntoActivo(
                        e.target.value === ""
                          ? null
                          : parseInt(e.target.value)
                      )
                    }
                    className="px-2 py-1 text-xs border border-fuchsia-300 rounded-lg bg-white"
                  >
                    {puntosDelSetActivo.map((p) => (
                      <option key={p} value={p}>
                        Punto {p}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => irPunto(1)}
                    disabled={
                      puntoActivo === null ||
                      puntosDelSetActivo.indexOf(puntoActivo) ===
                        puntosDelSetActivo.length - 1
                    }
                    className="px-2 py-1 text-xs bg-white border border-fuchsia-300 rounded-lg hover:bg-fuchsia-100 disabled:opacity-40"
                  >
                    ▶
                  </button>

                  {puntoActivo !== null && (
                    <span className="text-xs text-fuchsia-800 font-semibold ml-2">
                      Punto{" "}
                      {puntosDelSetActivo.indexOf(puntoActivo) + 1} de{" "}
                      {puntosDelSetActivo.length}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ============ CANCHA 3D ============ */}
          <div className="card rounded-2xl border border-white/10 shadow-xl p-4 flex items-center justify-center">
            {cargando ? (
              <p className="text-sm text-slate-500 py-12">Cargando...</p>
            ) : accionesFiltradas.length === 0 ? (
              <p className="text-sm text-slate-500 py-12">
                No hay acciones que cumplan los filtros
              </p>
            ) : webglOk === null ? (
              <p className="text-sm text-slate-500 py-12">
                Cargando cancha...
              </p>
            ) : webglOk ? (
              <CanchaUnificada3D
                modo={modo}
                acciones={accionesPara3D}
                puntos={puntosAgrupados}
                puntoSeleccionado={puntoSeleccionado3D}
                vista={vista}
                width={1000}
                height={760}
                mostrarEstelas={mostrarEstelas}
                velocidadAnimacion={velocidadAnimacion}
              />
            ) : (
              <div className="w-full p-6 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 text-center">
                ⚠️ Tu navegador no soporta WebGL. Para ver la cancha 3D,
                activá la aceleración por hardware en la configuración de tu
                navegador.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}