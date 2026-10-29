"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { User, GitCompare, FileDown, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cargarAccionesCompatibles, type AccionDB } from "@/lib/db";
import {
  calcularEstadisticasEquipo,
  calcularPodios,
  rankingDeJugador,
  calcularPromedioPonderadoPorSet,
  calcularPromedioArmadosPonderadoPorSet,
  VALORES_SAQUE,
  VALORES_RECEPCION,
  VALORES_BLOQUEO,
  nivelDeValoracion,
  COLORES_NIVEL_CLASES,
  type EstadisticasJugador,
} from "@/lib/estadisticas";
import {
  cargarAccionesUnificadas,
  type AccionVisual,
} from "./adaptadorUnificadoV2";
import RadarJugador from "./RadarJugador";
import GraficoArmadosPorSet from "./GraficoArmadosPorSet";
import GraficoRecepcionPorSet from "./GraficoRecepcionPorSet";
import GraficoSaquePorSet from "./GraficoSaquePorSet";
import GraficoBloqueoPorSet from "./GraficoBloqueoPorSet";
import MapaCalorTendencia from "./MapaCalorTendencia";
import ImagenAmpliable from "./ImagenAmpliable";
import GraficoBarrasFundamento from "./GraficoBarrasFundamento";
import MapaCalorJugador from "./MapaCalorJugador";
import AnalisisConsecuencias from "./AnalisisConsecuencias";
import IconoVoley from "./IconoVoley";
import { descargarComoPDF } from "@/lib/exportarPDF";

interface Jugador {
  id: string;
  nombre: string;
  numero: number | null;
  imagen_url: string | null;
  rol: string;
}

interface Props {
  equipoId: string;
  nombreEquipo: string;
}

const NOMBRES_FUNDAMENTO: Record<string, string> = {
  saque: "Saque",
  recepcion: "Recepción",
  ataque: "Ataque",
  bloqueo: "Bloqueo",
  defensa: "Defensa",
  armados: "Armados",
  toque: "Toque",
};

const FUNDAMENTOS_BARRAS = [
  "saque",
  "recepcion",
  "ataque",
  "bloqueo",
  "defensa",
] as const;

const ORDEN_RANKINGS: { id: string; titulo: string }[] = [
  { id: "recepcion", titulo: "Recepción" },
  { id: "ataque", titulo: "Ataque" },
  { id: "bloqueo", titulo: "Bloqueo" },
  { id: "saque", titulo: "Saque" },
  { id: "defensa", titulo: "Defensa" },
  { id: "consistencia", titulo: "Consistencia" },
];

const COLORES_COMPARACION = ["#EF4444", "#8B5CF6", "#3B82F6"];

function colorPodio(puesto: number): string {
  if (puesto === 1)
    return "bg-amber-400/20 text-amber-300 border border-amber-400/50";
  if (puesto === 2)
    return "bg-slate-300/20 text-slate-200 border border-slate-300/40";
  return "bg-amber-700/25 text-amber-200 border border-amber-700/40";
}

function calcularBarrasPorFundamento(
  acciones: AccionDB[],
  jugadorId?: string
): Record<
  string,
  { positivas: number; neutras: number; negativas: number }
> {
  const out: Record<
    string,
    { positivas: number; neutras: number; negativas: number }
  > = {};
  for (const f of FUNDAMENTOS_BARRAS) {
    out[f] = { positivas: 0, neutras: 0, negativas: 0 };
  }

  for (const a of acciones) {
    if (jugadorId && a.jugador_id !== jugadorId) continue;
    const fund = a.fundamento;
    if (!out[fund]) continue;

    let cat: "positivas" | "neutras" | "negativas" = "neutras";
    const v = a.valoracion;

    if (fund === "saque") {
      if (v === "ace") cat = "positivas";
      else if (v === "negativo") cat = "negativas";
    } else if (fund === "ataque") {
      if (v === "punto") cat = "positivas";
      else if (v === "error") cat = "negativas";
    } else if (fund === "recepcion") {
      if (v === "positiva" || v === "2x_positiva" || v === "perfecta")
        cat = "positivas";
      else if (
        v === "negativa" ||
        v === "2x_negativa" ||
        v === "3x_negativa" ||
        v === "ace_contra" ||
        v === "doble_negativa" ||
        v === "overpass" ||
        v === "error_directo"
      )
        cat = "negativas";
    } else if (fund === "bloqueo") {
      if (v === "punto" || v === "positivo_mas" || v === "positivo")
        cat = "positivas";
      else if (v === "use_rival" || v === "red" || v === "filtrada")
        cat = "negativas";
    } else if (fund === "defensa") {
      if (
        v === "gran_def" ||
        v === "toque_positiva" ||
        v === "cobertura_positiva"
      )
        cat = "positivas";
      else if (
        v === "toque_negativa" ||
        v === "mala_libre" ||
        v === "error_def" ||
        v === "errores_graves" ||
        v === "cobertura_negativa"
      )
        cat = "negativas";
    }

    out[fund][cat] += a.cantidad;
  }

  return out;
}

export default function MiEquipo({ equipoId, nombreEquipo }: Props) {
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [acciones, setAcciones] = useState<AccionDB[]>([]);
  const [jugadorSeleccionado, setJugadorSeleccionado] = useState<string | null>(
    null
  );
  const [modo, setModo] = useState<"individual" | "comparar">("individual");
  const [comparados, setComparados] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);
  const [descargando, setDescargando] = useState(false);

  // ---------- Dataset paralelo para el análisis de consecuencias ----------
  // Se carga LAZY (solo cuando el usuario selecciona un jugador) y
  // solo una vez por montaje (cacheado con `visualesCargadasRef`).
  const [partidosIds, setPartidosIds] = useState<string[]>([]);
  const [accionesVisuales, setAccionesVisuales] = useState<AccionVisual[]>([]);
  const [cargandoVisuales, setCargandoVisuales] = useState(false);
  const visualesCargadasRef = useRef(false);

  const refPDF = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!equipoId) return;
    setCargando(true);

    Promise.all([
      supabase
        .from("jugador_equipo")
        .select("jugador_id")
        .eq("equipo_id", equipoId)
        .eq("activo", true),
      supabase
        .from("partidos")
        .select("id, equipo_id, equipo_rival_id")
        .or(`equipo_id.eq.${equipoId},equipo_rival_id.eq.${equipoId}`),
    ]).then(async ([jeRes, partRes]) => {
      if (!jeRes.data || !partRes.data) {
        setCargando(false);
        return;
      }

      const idsJugadores = jeRes.data.map((x) => x.jugador_id);
      let jugadoresData: Jugador[] = [];

      if (idsJugadores.length > 0) {
        const { data: jugRes } = await supabase
          .from("jugadores")
          .select("*")
          .in("id", idsJugadores)
          .order("nombre");
        if (jugRes) jugadoresData = jugRes;
      }

      const idsPartidos = partRes.data.map((p) => p.id);
      setPartidosIds(idsPartidos);

      if (idsPartidos.length === 0) {
        setJugadores(jugadoresData);
        setAcciones([]);
        setCargando(false);
        return;
      }

      const resultados = await Promise.all(
        idsPartidos.map((pid) => cargarAccionesCompatibles(pid, equipoId))
      );

      setJugadores(jugadoresData);
      setAcciones(resultados.flat());
      setCargando(false);
    });
  }, [equipoId]);

  // ---------- Carga LAZY de accionesVisuales ----------
  // Se dispara la primera vez que el usuario selecciona un jugador.
  // Trae TODAS las acciones del partido (propias + rivales) con
  // es_ultima_del_punto y flip resueltos por `cargarAccionesUnificadas`.
  useEffect(() => {
    if (!jugadorSeleccionado) return;
    if (partidosIds.length === 0 || !equipoId) return;
    if (visualesCargadasRef.current) return;

    let cancelled = false;
    setCargandoVisuales(true);

    Promise.all(
      partidosIds.map((pid) => cargarAccionesUnificadas(pid, equipoId))
    )
      .then((results) => {
        if (cancelled) return;
        setAccionesVisuales(results.flatMap((r) => r.acciones));
        setCargandoVisuales(false);
        visualesCargadasRef.current = true;
      })
      .catch(() => {
        if (cancelled) return;
        setCargandoVisuales(false);
      });

    return () => {
      cancelled = true;
    };
  }, [jugadorSeleccionado, partidosIds, equipoId]);

  if (cargando) {
    return <p className="text-slate-500 text-center py-12">Cargando...</p>;
  }

  const idsJugadores = jugadores.map((j) => j.id);
  const armadores = new Set(
    jugadores.filter((j) => j.rol === "armador").map((j) => j.id)
  );

  const { porJugador } = calcularEstadisticasEquipo(
    idsJugadores,
    acciones,
    armadores
  );

  const podios = calcularPodios(porJugador, acciones);

  const jugadorActual: EstadisticasJugador | null = jugadorSeleccionado
    ? porJugador[jugadorSeleccionado] ?? null
    : null;
  const datosJugador = jugadores.find((j) => j.id === jugadorSeleccionado);
  const esArmador = datosJugador?.rol === "armador";

  const textosRanking = jugadorSeleccionado
    ? rankingDeJugador(jugadorSeleccionado, porJugador, acciones)
    : {};

  const barrasJugadorActual = jugadorSeleccionado
    ? calcularBarrasPorFundamento(acciones, jugadorSeleccionado)
    : null;

  const nombreDeJugador = (id: string | null): string => {
    if (!id) return "—";
    const j = jugadores.find((x) => x.id === id);
    if (!j) return id.slice(0, 8);
    return j.nombre + (j.numero !== null ? ` #${j.numero}` : "");
  };

  const handleToggleModo = (nuevo: "individual" | "comparar") => {
    setModo(nuevo);
    if (nuevo === "individual") {
      setComparados([]);
    }
  };

  const handleClickComparar = (jugadorId: string) => {
    const jugador = jugadores.find((j) => j.id === jugadorId);
    if (!jugador) return;

    const yaSeleccionado = comparados.includes(jugadorId);

    if (yaSeleccionado) {
      setComparados(comparados.filter((id) => id !== jugadorId));
      return;
    }

    if (comparados.length >= 3) return;

    if (comparados.length > 0) {
      const primerSel = jugadores.find((j) => j.id === comparados[0]);
      const ambosArmadores =
        primerSel?.rol === "armador" && jugador.rol === "armador";
      const ambosNormales =
        primerSel?.rol !== "armador" && jugador.rol !== "armador";
      if (!ambosArmadores && !ambosNormales) return;
    }

    setComparados([...comparados, jugadorId]);
  };

  const comparadosData = comparados
    .map((id, idx) => ({
      id,
      nombre: jugadores.find((j) => j.id === id)?.nombre ?? "?",
      color: COLORES_COMPARACION[idx] ?? "#94a3b8",
      jugador: porJugador[id],
    }))
    .filter((s) => s.jugador);

  const esComparacionArmador =
    comparadosData.length > 0 && armadores.has(comparadosData[0].id);

  const seriesRadar = comparadosData.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    color: s.color,
    jugador: s.jugador,
  }));

  const seriesSaque = comparadosData.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    color: s.color,
    promedios: calcularPromedioPonderadoPorSet(
      s.id,
      acciones,
      idsJugadores,
      "saque",
      VALORES_SAQUE
    ),
  }));

  const seriesRecepcion = comparadosData.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    color: s.color,
    promedios: calcularPromedioPonderadoPorSet(
      s.id,
      acciones,
      idsJugadores,
      "recepcion",
      VALORES_RECEPCION
    ),
  }));

  const seriesBloqueo = comparadosData.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    color: s.color,
    promedios: calcularPromedioPonderadoPorSet(
      s.id,
      acciones,
      idsJugadores,
      "bloqueo",
      VALORES_BLOQUEO
    ),
  }));

  const seriesArmados = comparadosData.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    color: s.color,
    promedios: calcularPromedioArmadosPonderadoPorSet(
      s.id,
      acciones,
      idsJugadores
    ),
  }));

  const handleDescargarPDF = async () => {
    if (modo === "individual" && !jugadorSeleccionado) {
      alert("Elegí un jugador antes de descargar el PDF.");
      return;
    }
    if (modo === "comparar" && comparadosData.length === 0) {
      alert("Elegí al menos un jugador para comparar antes de descargar.");
      return;
    }
    if (!refPDF.current) return;

    setDescargando(true);
    try {
      const nombre =
        modo === "individual" && datosJugador
          ? `jugador-${datosJugador.nombre}-${nombreEquipo}`
          : `comparacion-${nombreEquipo}`;
      const titulo =
        modo === "individual" && datosJugador
          ? `${datosJugador.nombre} · ${nombreEquipo}`
          : `Comparación · ${nombreEquipo}`;
      await descargarComoPDF(refPDF.current, nombre, titulo);
    } finally {
      setDescargando(false);
    }
  };

  const jugadoresDisponibles = jugadores.map((j) => ({
    id: j.id,
    nombre: nombreDeJugador(j.id),
  }));

  if (jugadores.length === 0) {
    return (
      <div
        className="card p-8 sm:p-12 text-center max-w-lg mx-auto"
        style={{
          background:
            "linear-gradient(145deg, rgba(15,29,53,0.9), rgba(10,22,40,0.95))",
          borderColor: "var(--sx-border-bright)",
        }}
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{
            background: "rgba(37,99,235,0.12)",
            border: "1px solid rgba(37,99,235,0.25)",
            color: "var(--sx-teal)",
          }}
        >
          <Users size={26} />
        </div>
        <h3 className="text-lg font-bold text-white">
          Sin jugadores registrados
        </h3>
        <p
          className="text-sm mt-1.5"
          style={{ color: "var(--sx-text-secondary)" }}
        >
          <span className="text-white font-semibold">{nombreEquipo}</span>{" "}
          todavía no tiene jugadores cargados en la plantilla.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div className="nav-pill inline-flex gap-1">
          <button
            onClick={() => handleToggleModo("individual")}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              modo === "individual"
                ? "tab-active"
                : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
            }`}
          >
            <User
              size={13}
              className={modo === "individual" ? "text-white" : "text-slate-400"}
            />
            <span>Ficha Individual</span>
          </button>
          <button
            onClick={() => handleToggleModo("comparar")}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              modo === "comparar"
                ? "tab-active"
                : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
            }`}
          >
            <GitCompare
              size={13}
              className={modo === "comparar" ? "text-white" : "text-slate-400"}
            />
            <span>Comparar ({comparados.length}/3)</span>
          </button>
        </div>
        <button
          onClick={handleDescargarPDF}
          disabled={descargando}
          className="btn-outline flex items-center justify-center gap-2"
          style={{
            background: "rgba(15,29,53,0.8)",
            color: "var(--sx-text-primary)",
            borderColor: "var(--sx-border-bright)",
          }}
          data-pdf-ignorar
        >
          <FileDown size={14} style={{ color: "var(--sx-teal)" }} />
          <span>{descargando ? "Generando PDF..." : "Exportar Informe PDF"}</span>
        </button>
      </div>

      <div
        ref={refPDF}
        className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4"
      >
        <div
          className="rounded-2xl p-3 sm:p-4 col-span-1"
          style={{
            background: "var(--sx-surface-1)",
            border: "1px solid var(--sx-border)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
          }}
        >
          <h3 className="font-bold text-white mb-2 text-sm">
            {modo === "individual" ? "Plantel" : "Elegí hasta 3 jugadores"}
          </h3>
          {modo === "comparar" && (
            <p
              className="text-xs mb-3"
              style={{ color: "var(--sx-text-secondary)" }}
            >
              Armadores con armadores, jugadores de cancha con jugadores de
              cancha.
            </p>
          )}
          <div className="space-y-1.5">
            {jugadores.map((j) => {
              const est = porJugador[j.id];
              const accionesJ = est?.totalAcciones ?? 0;
              const colorIdx = comparados.indexOf(j.id);
              const seleccionadoIndividual =
                modo === "individual" && jugadorSeleccionado === j.id;

              let bloqueado = false;
              if (
                modo === "comparar" &&
                comparados.length > 0 &&
                colorIdx === -1
              ) {
                const primerSel = jugadores.find(
                  (x) => x.id === comparados[0]
                );
                const ambosArm =
                  primerSel?.rol === "armador" && j.rol === "armador";
                const ambosNorm =
                  primerSel?.rol !== "armador" && j.rol !== "armador";
                bloqueado = !ambosArm && !ambosNorm;
              }
              const puedeAgregarMas =
                modo === "comparar" &&
                comparados.length >= 3 &&
                colorIdx === -1;

              return (
                <button
                  key={j.id}
                  onClick={() =>
                    modo === "individual"
                      ? setJugadorSeleccionado(j.id)
                      : handleClickComparar(j.id)
                  }
                  disabled={bloqueado || puedeAgregarMas}
                  className={`w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-xl transition-all text-sm ${
                    seleccionadoIndividual
                      ? "text-white shadow-md font-bold"
                      : colorIdx !== -1
                      ? "text-white shadow-md font-bold"
                      : bloqueado || puedeAgregarMas
                      ? "opacity-30 cursor-not-allowed text-slate-500"
                      : "text-slate-300 hover:text-white hover:bg-white/[0.04]"
                  }`}
                  style={{
                    background: seleccionadoIndividual
                      ? "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)"
                      : colorIdx !== -1
                      ? COLORES_COMPARACION[colorIdx]
                      : "rgba(255,255,255,0.02)",
                    border: seleccionadoIndividual
                      ? "1px solid rgba(255,255,255,0.25)"
                      : colorIdx !== -1
                      ? "1px solid rgba(255,255,255,0.3)"
                      : "1px solid rgba(255,255,255,0.04)",
                  }}
                >
                  <span className="relative shrink-0">
                    <ImagenAmpliable
                      src={j.imagen_url}
                      alt={j.nombre}
                      inicial={j.nombre.charAt(0).toUpperCase()}
                      tamaño="sm"
                    />
                    {colorIdx !== -1 && (
                      <span
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center border-2 border-slate-900"
                        style={{
                          backgroundColor: COLORES_COMPARACION[colorIdx],
                        }}
                      >
                        {colorIdx + 1}
                      </span>
                    )}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="font-semibold block truncate">
                      {j.nombre}
                      {j.numero !== null && (
                        <span className="ml-1 text-xs opacity-75 font-mono">
                          #{j.numero}
                        </span>
                      )}
                    </span>
                    {j.rol === "armador" && (
                      <span
                        className={`block text-[11px] font-medium ${
                          seleccionadoIndividual || colorIdx !== -1
                            ? "text-white/90"
                            : "text-violet-400"
                        }`}
                      >
                        Armador
                      </span>
                    )}
                    <span
                      className={`block text-[10px] ${
                        seleccionadoIndividual || colorIdx !== -1
                          ? "text-white/80"
                          : "text-slate-400"
                      }`}
                    >
                      {accionesJ} acciones
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="col-span-1 lg:col-span-2">
          {modo === "individual" ? (
            !jugadorSeleccionado || !jugadorActual || !datosJugador ? (
              <div
                className="rounded-2xl p-8 sm:p-12 text-center h-full flex items-center justify-center"
                style={{
                  background: "var(--sx-surface-1)",
                  border: "1px dashed var(--sx-border-bright)",
                }}
              >
                <div>
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                    style={{
                      background: "rgba(37,99,235,0.12)",
                      border: "1px solid rgba(37,99,235,0.25)",
                      color: "var(--sx-teal)",
                    }}
                  >
                    <User size={26} />
                  </div>
                  <p className="text-white font-bold text-base">
                    Elegí un jugador del plantel
                  </p>
                  <p
                    className="text-xs mt-1"
                    style={{ color: "var(--sx-text-secondary)" }}
                  >
                    Seleccioná una ficha en la lista izquierda para visualizar
                    su radar, mapa de calor y desglose estadístico.
                  </p>
                </div>
              </div>
            ) : (
              <div
                className="rounded-2xl p-4 sm:p-6 space-y-6"
                style={{
                  background: "var(--sx-surface-1)",
                  border: "1px solid var(--sx-border-bright)",
                  boxShadow:
                    "0 8px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
                }}
              >
                {/* Header de la ficha */}
                <div
                  className="flex items-center gap-4 pb-5"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <ImagenAmpliable
                    src={datosJugador.imagen_url}
                    alt={datosJugador.nombre}
                    inicial={datosJugador.nombre.charAt(0).toUpperCase()}
                    tamaño="lg"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight truncate">
                        {datosJugador.nombre}
                      </h3>
                      {datosJugador.numero !== null && (
                        <span
                          className="px-2 py-0.5 rounded-md text-xs font-mono font-bold"
                          style={{
                            background: "rgba(245,158,11,0.15)",
                            color: "#FBBF24",
                            border: "1px solid rgba(245,158,11,0.3)",
                          }}
                        >
                          #{datosJugador.numero}
                        </span>
                      )}
                      {esArmador && (
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-md"
                          style={{
                            background: "rgba(124,58,237,0.2)",
                            color: "#C4B5FD",
                            border: "1px solid rgba(124,58,237,0.4)",
                          }}
                        >
                          Armador
                        </span>
                      )}
                    </div>
                    <p
                      className="text-xs mt-1 font-semibold"
                      style={{ color: "var(--sx-text-secondary)" }}
                    >
                      {nombreEquipo}
                    </p>
                  </div>
                </div>

                {/* Perfil de rendimiento */}
                <div>
                  <h4 className="font-bold text-white text-sm mb-3">
                    Perfil de Rendimiento
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div
                      className="rounded-xl p-2 flex flex-col aspect-square justify-center"
                      style={{
                        background: "rgba(8,15,30,0.65)",
                        border: "1px solid var(--sx-border)",
                      }}
                    >
                      <RadarJugador
                        jugador={jugadorActual}
                        esArmador={esArmador}
                      />
                    </div>
                    {barrasJugadorActual &&
                      FUNDAMENTOS_BARRAS.map((f) => (
                        <div
                          key={f}
                          className="rounded-xl p-3 flex flex-col aspect-square"
                          style={{
                            background: "rgba(8,15,30,0.65)",
                            border: "1px solid var(--sx-border)",
                          }}
                        >
                          <GraficoBarrasFundamento
                            fundamento={f}
                            positivas={barrasJugadorActual[f].positivas}
                            neutras={barrasJugadorActual[f].neutras}
                            negativas={barrasJugadorActual[f].negativas}
                          />
                        </div>
                      ))}
                  </div>
                </div>

                {/* Mapa de calor */}
                <div>
                  <h4 className="font-bold text-white text-sm mb-3">
                    Mapa de Calor en Cancha
                  </h4>
                  <div
                    className="rounded-xl p-3 sm:p-4"
                    style={{
                      background: "rgba(8,15,30,0.65)",
                      border: "1px solid var(--sx-border)",
                    }}
                  >
                    <MapaCalorJugador
                      acciones={acciones}
                      jugadorId={jugadorActual.jugador_id}
                    />
                  </div>
                </div>

                {/* Valoración ponderada */}
                {Object.keys(jugadorActual.valoracionPonderadaPorFundamento)
                  .length > 0 && (
                  <div>
                    <h4 className="font-bold text-white text-sm mb-3">
                      Valoración Ponderada por Fundamento
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                      {Object.entries(
                        jugadorActual.valoracionPonderadaPorFundamento
                      ).map(([fund, val]) => {
                        const puesto =
                          podios[jugadorActual.jugador_id]?.[fund];
                        const nivel = nivelDeValoracion(fund, val);
                        const col = COLORES_NIVEL_CLASES[nivel];
                        return (
                          <div
                            key={fund}
                            className={`p-3 rounded-xl text-center relative border ${col.bg} ${col.border}`}
                            style={{
                              boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                            }}
                          >
                            {puesto !== undefined && (
                              <span
                                className={`absolute -top-2 -right-2 inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold shadow-md ${colorPodio(
                                  puesto
                                )}`}
                                title={`${puesto}° puesto del plantel`}
                              >
                                #{puesto}
                              </span>
                            )}
                            <p className="text-xs font-semibold text-slate-300">
                              {NOMBRES_FUNDAMENTO[fund] ?? fund}
                            </p>
                            <p
                              className={`text-lg font-black mt-0.5 ${col.text}`}
                            >
                              {val > 0 ? "+" : ""}
                              {val.toFixed(2)}
                            </p>
                            <p
                              className={`text-[9px] uppercase font-bold tracking-wider ${col.text} opacity-80`}
                            >
                              {col.nombre}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Sus números en el plantel */}
                {Object.keys(textosRanking).length > 0 && (
                  <div>
                    <h4 className="font-bold text-white text-sm mb-3">
                      Sus Números en el Plantel
                    </h4>
                    <div
                      className="rounded-xl divide-y"
                      style={{
                        background: "rgba(8,15,30,0.65)",
                        border: "1px solid var(--sx-border)",
                        borderColor: "rgba(255,255,255,0.06)",
                      }}
                    >
                      {ORDEN_RANKINGS.map((r) => {
                        const texto = textosRanking[r.id];
                        const puesto = podios[jugadorActual.jugador_id]?.[r.id];
                        return (
                          <div
                            key={r.id}
                            className="flex items-start gap-3 px-3.5 sm:px-4 py-3"
                          >
                            <div className="mt-0.5 shrink-0">
                              <IconoVoley
                                tipo={r.id}
                                size={18}
                                className="text-[#38BDF8]"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <p className="text-sm font-bold text-white">
                                  {r.titulo}
                                </p>
                                {puesto !== undefined && (
                                  <span
                                    className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${colorPodio(
                                      puesto
                                    )}`}
                                    title={`${puesto}° puesto`}
                                  >
                                    {puesto}
                                  </span>
                                )}
                              </div>
                              <p
                                className="text-xs break-words"
                                style={{ color: "var(--sx-text-secondary)" }}
                              >
                                {texto ?? "Sin datos en este fundamento"}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {esArmador && jugadorActual.armador && (
                  <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    <div className="p-3 sm:p-4 card rounded-xl border border-white/10">
                      <GraficoSaquePorSet
                        promedios={calcularPromedioPonderadoPorSet(
                          jugadorActual.jugador_id,
                          acciones,
                          idsJugadores,
                          "saque",
                          VALORES_SAQUE
                        )}
                      />
                    </div>
                    <div className="p-3 sm:p-4 card rounded-xl border border-white/10">
                      <GraficoBloqueoPorSet
                        promedios={calcularPromedioPonderadoPorSet(
                          jugadorActual.jugador_id,
                          acciones,
                          idsJugadores,
                          "bloqueo",
                          VALORES_BLOQUEO
                        )}
                      />
                    </div>
                    <div className="p-3 sm:p-4 card rounded-xl border border-white/10">
                      <GraficoArmadosPorSet
                        promedios={calcularPromedioArmadosPonderadoPorSet(
                          jugadorActual.jugador_id,
                          acciones,
                          idsJugadores
                        )}
                      />
                    </div>
                    <div className="p-3 sm:p-4 card rounded-xl border border-white/10">
                      <MapaCalorTendencia
                        distribucion={
                          jugadorActual.armador.distribucionTendencia
                        }
                        acciones={acciones}
                        jugadorId={jugadorActual.jugador_id}
                      />
                    </div>
                  </div>
                )}

                {!esArmador && (
                  <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    <div className="p-3 sm:p-4 card rounded-xl border border-white/10">
                      <GraficoSaquePorSet
                        promedios={calcularPromedioPonderadoPorSet(
                          jugadorActual.jugador_id,
                          acciones,
                          idsJugadores,
                          "saque",
                          VALORES_SAQUE
                        )}
                      />
                    </div>
                    <div className="p-3 sm:p-4 card rounded-xl border border-white/10">
                      <GraficoRecepcionPorSet
                        promedios={calcularPromedioPonderadoPorSet(
                          jugadorActual.jugador_id,
                          acciones,
                          idsJugadores,
                          "recepcion",
                          VALORES_RECEPCION
                        )}
                      />
                    </div>
                    <div className="md:col-span-2 p-3 sm:p-4 card rounded-xl border border-white/10">
                      <GraficoBloqueoPorSet
                        promedios={calcularPromedioPonderadoPorSet(
                          jugadorActual.jugador_id,
                          acciones,
                          idsJugadores,
                          "bloqueo",
                          VALORES_BLOQUEO
                        )}
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                  <div className="card p-3 rounded-xl text-center border border-white/10 shadow-sm">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Saldo
                    </p>
                    <p
                      className={`text-xl sm:text-2xl font-bold tabular-nums ${
                        jugadorActual.saldoTotal > 0
                          ? "text-emerald-400"
                          : jugadorActual.saldoTotal < 0
                          ? "text-rose-400"
                          : "text-slate-300"
                      }`}
                    >
                      {jugadorActual.saldoTotal > 0 ? "+" : ""}
                      {jugadorActual.saldoTotal}
                    </p>
                  </div>
                  <div className="card p-3 rounded-xl text-center border border-white/10 shadow-sm">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Saldo Defensivo
                    </p>
                    <p
                      className={`text-xl sm:text-2xl font-bold tabular-nums ${
                        jugadorActual.saldoDefensivo > 0
                          ? "text-emerald-400"
                          : jugadorActual.saldoDefensivo < 0
                          ? "text-rose-400"
                          : "text-slate-300"
                      }`}
                    >
                      {jugadorActual.saldoDefensivo > 0 ? "+" : ""}
                      {jugadorActual.saldoDefensivo}
                    </p>
                  </div>
                  <div className="card p-3 rounded-xl text-center border border-white/10 shadow-sm">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Valoración Media
                    </p>
                    <p
                      className={`text-xl sm:text-2xl font-bold tabular-nums ${
                        jugadorActual.valoracionMediaNormalizada > 0
                          ? "text-emerald-400"
                          : jugadorActual.valoracionMediaNormalizada < 0
                          ? "text-rose-400"
                          : "text-slate-300"
                      }`}
                    >
                      {jugadorActual.valoracionMediaNormalizada > 0 ? "+" : ""}
                      {jugadorActual.valoracionMediaNormalizada.toFixed(2)}
                    </p>
                  </div>

                  <div className="card p-3 rounded-xl text-center border border-white/10 shadow-sm">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Acciones
                    </p>
                    <p className="text-xl sm:text-2xl font-bold text-white tabular-nums">
                      {jugadorActual.totalAcciones}
                    </p>
                  </div>
                  <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-center shadow-sm">
                    <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
                      Puntos
                    </p>
                    <p className="text-xl sm:text-2xl font-bold text-emerald-300 tabular-nums">
                      {jugadorActual.totalPuntos}
                    </p>
                  </div>
                  <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-center shadow-sm">
                    <p className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider">
                      Errores
                    </p>
                    <p className="text-xl sm:text-2xl font-bold text-rose-300 tabular-nums">
                      {jugadorActual.totalErrores}
                    </p>
                  </div>
                </div>

                {/* ANÁLISIS DE CONSECUENCIAS */}
                <div
                  className="pt-6"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
                  data-pdf-ignorar
                >
                  {cargandoVisuales ? (
                    <p className="text-xs text-slate-500 text-center py-3">
                      Cargando datos para el análisis...
                    </p>
                  ) : (
                    <AnalisisConsecuencias
                      acciones={accionesVisuales}
                      jugadorId={jugadorSeleccionado ?? undefined}
                      nombreDeJugador={nombreDeJugador}
                      jugadoresDisponibles={jugadoresDisponibles}
                      titulo={`Consecuencias tácticas · ${datosJugador.nombre}`}
                    />
                  )}
                </div>
              </div>
            )
          ) : (
            <div className="card rounded-2xl border border-white/10 p-4 sm:p-6 shadow-xl">
              {comparadosData.length === 0 ? (
                <div className="p-8 sm:p-12 text-center h-full flex items-center justify-center">
                  <div>
                    <GitCompare
                      size={36}
                      className="text-slate-400 mx-auto mb-3"
                    />
                    <p className="text-slate-200 font-semibold text-sm">
                      Elegí hasta 3 jugadores del plantel para comparar
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-6 pb-4 border-b border-white/10">
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-3">
                      Comparando{" "}
                      {comparadosData.length === 1
                        ? "1 jugador"
                        : `${comparadosData.length} jugadores`}
                    </h3>
                    <div className="flex flex-wrap gap-2 sm:gap-3">
                      {comparadosData.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 card"
                        >
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: s.color }}
                          />
                          <span className="text-sm font-medium text-slate-200">
                            {s.nombre}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mb-6">
                    <h4 className="font-semibold text-white mb-3">
                      Radar comparativo
                    </h4>
                    <RadarJugador
                      series={seriesRadar}
                      esArmador={esComparacionArmador}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    <div className="p-3 sm:p-4 card rounded-xl border border-white/10">
                      <GraficoSaquePorSet series={seriesSaque} />
                    </div>

                    {!esComparacionArmador && (
                      <div className="p-3 sm:p-4 card rounded-xl border border-white/10">
                        <GraficoRecepcionPorSet series={seriesRecepcion} />
                      </div>
                    )}

                    {esComparacionArmador && (
                      <div className="p-3 sm:p-4 card rounded-xl border border-white/10">
                        <GraficoArmadosPorSet series={seriesArmados} />
                      </div>
                    )}

                    <div
                      className={`p-3 sm:p-4 card rounded-xl border border-white/10 ${
                        esComparacionArmador ? "" : "md:col-span-2"
                      }`}
                    >
                      <GraficoBloqueoPorSet series={seriesBloqueo} />
                    </div>
                  </div>

                  <div className="mt-6 overflow-x-auto rounded-xl border border-white/10 card">
                    <table className="w-full text-sm min-w-[500px]">
                      <thead className="bg-white/5 border-b border-white/10">
                        <tr className="text-left text-slate-400">
                          <th className="py-2.5 px-3">Jugador</th>
                          <th className="py-2.5 px-3 text-right">Acciones</th>
                          <th className="py-2.5 px-3 text-right">Puntos</th>
                          <th className="py-2.5 px-3 text-right">Errores</th>
                          <th className="py-2.5 px-3 text-right">Saldo</th>
                          <th className="py-2.5 px-3 text-right">
                            Val. Media
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparadosData.map((s) => {
                          const est = s.jugador;
                          return (
                            <tr
                              key={s.id}
                              className="border-b border-white/5 hover:bg-white/5 transition-colors"
                            >
                              <td className="py-2.5 px-3 font-medium">
                                <span
                                  className="inline-block w-3 h-3 rounded-full mr-2 align-middle"
                                  style={{ backgroundColor: s.color }}
                                />
                                <span className="text-white">{s.nombre}</span>
                              </td>
                              <td className="py-2.5 px-3 text-right text-slate-300 tabular-nums">
                                {est.totalAcciones}
                              </td>
                              <td className="py-2.5 px-3 text-right text-emerald-400 font-semibold tabular-nums">
                                {est.totalPuntos}
                              </td>
                              <td className="py-2.5 px-3 text-right text-rose-400 font-semibold tabular-nums">
                                {est.totalErrores}
                              </td>
                              <td
                                className={`py-2.5 px-3 text-right font-semibold tabular-nums ${
                                  est.saldoTotal > 0
                                    ? "text-emerald-400"
                                    : est.saldoTotal < 0
                                    ? "text-rose-400"
                                    : "text-slate-300"
                                }`}
                              >
                                {est.saldoTotal > 0 ? "+" : ""}
                                {est.saldoTotal}
                              </td>
                              <td
                                className={`py-2.5 px-3 text-right font-semibold tabular-nums ${
                                  est.valoracionMediaNormalizada > 0
                                    ? "text-emerald-400"
                                    : est.valoracionMediaNormalizada < 0
                                    ? "text-rose-400"
                                    : "text-slate-300"
                                }`}
                              >
                                {est.valoracionMediaNormalizada > 0 ? "+" : ""}
                                {est.valoracionMediaNormalizada.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}