"use client";

// ============================================================
// PARTIDOS — contenedor principal
// ============================================================
// Orquesta la lógica y delega el render a subcomponentes.
// Todos los useMemo / useEffect / useState van ANTES de los
// returns condicionales → sin errores de hooks condicionales.
//
// Carga dos datasets paralelos:
//   1. `acciones`         → propias del equipo (cargarAccionesCompatibles)
//                          para gráficos, tablas, rankings.
//   2. `accionesVisuales` → propias + rivales, con flip resueltos
//                          (cargarAccionesUnificadas) para el panel
//                          de Consecuencias y el análisis de contexto.
//
// FASE 5: agrega `ConsultaPanel` arriba del detalle cuando el modo
// es "partido" (un solo partido seleccionado). El panel responde
// consultas libres usando SOLO las acciones de ese partido.
// ============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, FileDown } from "lucide-react";
import { descargarComoPDF } from "@/lib/exportarPDF";
import {
  calcularEstadisticasEquipo,
  calcularPromedioPonderadoPorSet,
  calcularPromedioArmadosPonderadoPorSet,
  VALORES_SAQUE,
  VALORES_RECEPCION,
  VALORES_BLOQUEO,
} from "@/lib/estadisticas";
import {
  aplicarFiltrosTacticos,
  hayFiltrosTacticos,
  FILTROS_TACTICOS_VACIO,
  type FiltrosTacticos as FiltrosTacticosTipo,
} from "@/lib/filtrosTacticos";
import {
  cargarAccionesUnificadas,
  type AccionVisual,
  type PuntoConAcciones,
} from "./adaptadorUnificadoV2";
import ConsultaPanel from "./analisisConsecuencias/ConsultaPanel";

import { usePartidosData } from "./partidos/usePartidosData";
import HeaderPartido from "./partidos/HeaderPartido";
import ListaPartidos from "./partidos/ListaPartidos";
import VistaDetallePartido from "./partidos/VistaDetallePartido";
import VistaCompararPartidos from "./partidos/VistaCompararPartidos";
import VistaJugadorPorPartidos from "./partidos/VistaJugadorPorPartidos";
import {
  accionesDBaVisualParaTactico,
  calcularPartidosComparadosData,
  calcularPartidosJxPData,
  aplanarAccionesDePartidos,
  aplanarAccionesDeJxP,
  seriesRecepcionDePartidos,
  datosRivalDePartido,
} from "./partidos/helpers";
import {
  cardBase,
  type ModoPrincipal,
  type Partido,
} from "./partidos/types";

// ------------------------------------------------------------
// PROPS
// ------------------------------------------------------------

interface Props {
  equipoId: string;
  nombreEquipo: string;
}

// ------------------------------------------------------------
// COMPONENTE
// ------------------------------------------------------------

export default function Partidos({ equipoId, nombreEquipo }: Props) {
  // ============ HOOK: CARGA DE DATOS ============
  const {
    partidos,
    jugadores,
    acciones,
    datosRival,
    cargando,
    nombreDe,
    nombreRivalDe,
  } = usePartidosData(equipoId);

  // ============ ESTADOS DE UI ============
  const [filtroRival, setFiltroRival] = useState("");
  const [filtroFechaDesde, setFiltroFechaDesde] = useState("");
  const [filtroFechaHasta, setFiltroFechaHasta] = useState("");
  const [filtroSet, setFiltroSet] = useState<
    "todos" | "1" | "2" | "3" | "4" | "5"
  >("todos");

  const [filtrosTacticos, setFiltrosTacticos] =
    useState<FiltrosTacticosTipo>(() => ({ ...FILTROS_TACTICOS_VACIO }));

  const [modoPrincipal, setModoPrincipal] =
    useState<ModoPrincipal>("partido");
  const [partidoSeleccionado, setPartidoSeleccionado] = useState<
    string | null
  >(null);
  const [partidosComparados, setPartidosComparados] = useState<string[]>([]);

  const [jugadorSeleccionadoJxP, setJugadorSeleccionadoJxP] = useState<
    string | null
  >(null);
  const [partidosJxP, setPartidosJxP] = useState<string[]>([]);

  const [crudasEnPDF, setCrudasEnPDF] = useState(false);
  const [descargando, setDescargando] = useState(false);

  const refPDF = useRef<HTMLDivElement>(null);

  // ---------- Dataset paralelo para el análisis de consecuencias ----------
  // Se carga EAGER por cada partido activo (una sola query extra).
  const [accionesVisuales, setAccionesVisuales] = useState<AccionVisual[]>([]);
  const [puntosCompletosPartido, setPuntosCompletosPartido] = useState<
    PuntoConAcciones[]
  >([]);
  const [cargandoVisuales, setCargandoVisuales] = useState(false);

  // ============ EFFECTS ============
  // Reset filtros tácticos al cambiar de partido activo.
  useEffect(() => {
    setFiltrosTacticos({ ...FILTROS_TACTICOS_VACIO });
  }, [partidoSeleccionado]);

  // Cargar accionesVisuales + puntos del partido activo (todas:
  // propias + rivales, con flip y es_ultima_del_punto resueltos).
  useEffect(() => {
    if (!partidoSeleccionado || !equipoId) {
      setAccionesVisuales([]);
      setPuntosCompletosPartido([]);
      return;
    }
    let cancelled = false;
    setCargandoVisuales(true);
    cargarAccionesUnificadas(partidoSeleccionado, equipoId)
      .then((res) => {
        if (cancelled) return;
        setAccionesVisuales(res.acciones);
        setPuntosCompletosPartido(res.puntos);
        setCargandoVisuales(false);
      })
      .catch(() => {
        if (cancelled) return;
        setCargandoVisuales(false);
      });
    return () => {
      cancelled = true;
    };
  }, [partidoSeleccionado, equipoId]);

  // ============ CÁLCULOS DERIVADOS (no hooks) ============
  const partidoDetalle = partidoSeleccionado
    ? partidos.find((p) => p.id === partidoSeleccionado) ?? null
    : null;

  const jugadorJxP = jugadorSeleccionadoJxP
    ? jugadores.find((j) => j.id === jugadorSeleccionadoJxP) ?? null
    : null;
  const esArmadorJxP = jugadorJxP?.rol === "armador";

  // ============ HOOKS MEMOIZADOS ============
  const idsJugadores = useMemo(
    () => jugadores.map((j) => j.id),
    [jugadores]
  );

  const armadores = useMemo(
    () =>
      new Set(
        jugadores.filter((j) => j.rol === "armador").map((j) => j.id)
      ),
    [jugadores]
  );

  const partidosFiltrados = useMemo(
    () =>
      partidos.filter((p) => {
        if (filtroRival && nombreRivalDe(p) !== filtroRival) return false;
        if (filtroFechaDesde && p.fecha < filtroFechaDesde) return false;
        if (filtroFechaHasta && p.fecha > filtroFechaHasta) return false;
        return true;
      }),
    [partidos, filtroRival, filtroFechaDesde, filtroFechaHasta, nombreRivalDe]
  );

  const rivalesUnicos = useMemo(
    () => Array.from(new Set(partidos.map((p) => nombreRivalDe(p)))).sort(),
    [partidos, nombreRivalDe]
  );

  const hayFiltrosTacticosActivos = filtrosTacticos
    ? hayFiltrosTacticos(filtrosTacticos)
    : false;

  const hayFiltrosActivos =
    filtroRival !== "" ||
    filtroFechaDesde !== "" ||
    filtroFechaHasta !== "" ||
    hayFiltrosTacticosActivos;

  const accionesDelPartidoBase = useMemo(() => {
    if (!partidoDetalle) return [];
    return acciones.filter((a) => {
      if (a.partido_id !== partidoDetalle.id) return false;
      if (filtroSet !== "todos" && String(a.set_numero) !== filtroSet)
        return false;
      return true;
    });
  }, [acciones, partidoDetalle, filtroSet]);

  const accionesDelPartido = useMemo(() => {
    if (!filtrosTacticos || !hayFiltrosTacticos(filtrosTacticos)) {
      return accionesDelPartidoBase;
    }
    try {
      const visuales = accionesDBaVisualParaTactico(accionesDelPartidoBase);
      const filtradas = aplicarFiltrosTacticos(
        visuales,
        visuales,
        filtrosTacticos,
        null
      );
      const idsOk = new Set(filtradas.map((v) => v.id));
      const contadorPorPunto = new Map<string, number>();
      return accionesDelPartidoBase.filter((a) => {
        const k = `${a.set_numero}-${a.punto_numero ?? 0}`;
        const orden = (contadorPorPunto.get(k) ?? 0) + 1;
        contadorPorPunto.set(k, orden);
        return idsOk.has(
          `${a.jugador_id}|${a.set_numero}|${a.punto_numero ?? 0}|${orden}`
        );
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Error aplicando filtros tácticos:", err);
      return accionesDelPartidoBase;
    }
  }, [accionesDelPartidoBase, filtrosTacticos]);

  const statsPartido = useMemo(
    () =>
      partidoDetalle
        ? calcularEstadisticasEquipo(
            idsJugadores,
            accionesDelPartido,
            armadores
          )
        : null,
    [partidoDetalle, idsJugadores, accionesDelPartido, armadores]
  );

  const datosRivalPartido = useMemo(
    () => datosRivalDePartido(partidoDetalle?.id, datosRival),
    [partidoDetalle, datosRival]
  );

  const nombresJugadoresMap = useMemo(() => {
    const out: Record<string, string> = {};
    for (const j of jugadores) {
      out[j.id] = j.nombre + (j.numero !== null ? ` #${j.numero}` : "");
    }
    return out;
  }, [jugadores]);

  const partidosComparadosData = useMemo(
    () =>
      calcularPartidosComparadosData(
        partidosComparados,
        partidos,
        acciones,
        idsJugadores,
        armadores,
        nombreRivalDe
      ),
    [
      partidosComparados,
      partidos,
      acciones,
      idsJugadores,
      armadores,
      nombreRivalDe,
    ]
  );

  const accionesPartidosComparados = useMemo(
    () => aplanarAccionesDePartidos(partidosComparadosData),
    [partidosComparadosData]
  );

  const seriesRadarPartidos = useMemo(
    () =>
      partidosComparadosData.map((s) => ({
        id: s.id,
        nombre: s.nombre,
        color: s.color,
        equipo: s.stats,
      })),
    [partidosComparadosData]
  );

  const seriesRecepcionPartidos = useMemo(
    () => seriesRecepcionDePartidos(partidosComparadosData, armadores),
    [partidosComparadosData, armadores]
  );

  const partidosJxPData = useMemo(
    () =>
      calcularPartidosJxPData(
        jugadorSeleccionadoJxP,
        esArmadorJxP ?? false,
        partidosJxP,
        partidos,
        acciones,
        idsJugadores,
        nombreRivalDe
      ),
    [
      jugadorSeleccionadoJxP,
      esArmadorJxP,
      partidosJxP,
      partidos,
      acciones,
      idsJugadores,
      nombreRivalDe,
    ]
  );

  const accionesJxPCombinadas = useMemo(
    () => aplanarAccionesDeJxP(partidosJxPData),
    [partidosJxPData]
  );

  const seriesRadarJxP = useMemo(
    () =>
      partidosJxPData.map((s) => ({
        id: s.id,
        nombre: s.nombre,
        color: s.color,
        jugador: s.est,
      })),
    [partidosJxPData]
  );

  const seriesSaqueJxP = useMemo(
    () =>
      jugadorSeleccionadoJxP
        ? partidosJxPData.map((s) => ({
            id: s.id,
            nombre: s.nombre,
            color: s.color,
            promedios: calcularPromedioPonderadoPorSet(
              jugadorSeleccionadoJxP,
              s.accPartido,
              idsJugadores,
              "saque",
              VALORES_SAQUE
            ),
          }))
        : [],
    [jugadorSeleccionadoJxP, partidosJxPData, idsJugadores]
  );

  const seriesRecepcionJxP = useMemo(
    () =>
      jugadorSeleccionadoJxP
        ? partidosJxPData.map((s) => ({
            id: s.id,
            nombre: s.nombre,
            color: s.color,
            promedios: calcularPromedioPonderadoPorSet(
              jugadorSeleccionadoJxP,
              s.accPartido,
              idsJugadores,
              "recepcion",
              VALORES_RECEPCION
            ),
          }))
        : [],
    [jugadorSeleccionadoJxP, partidosJxPData, idsJugadores]
  );

  const seriesBloqueoJxP = useMemo(
    () =>
      jugadorSeleccionadoJxP
        ? partidosJxPData.map((s) => ({
            id: s.id,
            nombre: s.nombre,
            color: s.color,
            promedios: calcularPromedioPonderadoPorSet(
              jugadorSeleccionadoJxP,
              s.accPartido,
              idsJugadores,
              "bloqueo",
              VALORES_BLOQUEO
            ),
          }))
        : [],
    [jugadorSeleccionadoJxP, partidosJxPData, idsJugadores]
  );

  const seriesArmadosJxP = useMemo(
    () =>
      jugadorSeleccionadoJxP
        ? partidosJxPData.map((s) => ({
            id: s.id,
            nombre: s.nombre,
            color: s.color,
            promedios: calcularPromedioArmadosPonderadoPorSet(
              jugadorSeleccionadoJxP,
              s.accPartido,
              idsJugadores
            ),
          }))
        : [],
    [jugadorSeleccionadoJxP, partidosJxPData, idsJugadores]
  );

  // ---- Jugadores y partidos para el ConsultaPanel (modo partido) ----
  const jugadoresParaConsulta = useMemo(
    () =>
      jugadores.map((j) => ({
        id: j.id,
        nombre: j.nombre + (j.numero !== null ? ` #${j.numero}` : ""),
      })),
    [jugadores]
  );

  const partidosParaConsulta = useMemo(() => {
    if (!partidoDetalle) return [];
    return [
      {
        id: partidoDetalle.id,
        nombre: `vs ${nombreRivalDe(partidoDetalle)} (${partidoDetalle.fecha})`,
        fecha: partidoDetalle.fecha,
      },
    ];
  }, [partidoDetalle, nombreRivalDe]);

  // ============ EARLY RETURNS (después de todos los hooks) ============

  if (cargando) {
    return (
      <p
        className="text-center py-12"
        style={{ color: "var(--sx-text-secondary)" }}
      >
        Cargando...
      </p>
    );
  }

  if (partidos.length === 0) {
    return (
      <div
        className="rounded-2xl p-8 sm:p-12 text-center max-w-md mx-auto"
        style={cardBase}
      >
        <CalendarDays
          size={36}
          className="mx-auto mb-3"
          style={{ color: "var(--sx-text-muted)" }}
        />
        <h3 className="text-white font-bold text-base">
          Sin partidos cargados
        </h3>
        <p
          className="text-xs mt-1"
          style={{ color: "var(--sx-text-secondary)" }}
        >
          {nombreEquipo} todavía no tiene partidos registrados en el sistema.
        </p>
      </div>
    );
  }

  // ============ HANDLERS ============

  const limpiarFiltros = () => {
    setFiltroRival("");
    setFiltroFechaDesde("");
    setFiltroFechaHasta("");
    setFiltroSet("todos");
    setFiltrosTacticos({ ...FILTROS_TACTICOS_VACIO });
  };

  const handleToggleModoPrincipal = (nuevo: ModoPrincipal) => {
    setModoPrincipal(nuevo);
    if (nuevo === "comparar-partidos") {
      setPartidoSeleccionado(null);
      setJugadorSeleccionadoJxP(null);
      setPartidosJxP([]);
    } else if (nuevo === "jugador-por-partidos") {
      setPartidoSeleccionado(null);
      setPartidosComparados([]);
    } else {
      setPartidosComparados([]);
      setJugadorSeleccionadoJxP(null);
      setPartidosJxP([]);
    }
  };

  const handleTogglePartidoComparado = (id: string) => {
    if (partidosComparados.includes(id)) {
      setPartidosComparados(partidosComparados.filter((x) => x !== id));
      return;
    }
    if (partidosComparados.length >= 3) return;
    setPartidosComparados([...partidosComparados, id]);
  };

  const handleTogglePartidoJxP = (id: string) => {
    if (partidosJxP.includes(id)) {
      setPartidosJxP(partidosJxP.filter((x) => x !== id));
      return;
    }
    if (partidosJxP.length >= 3) return;
    setPartidosJxP([...partidosJxP, id]);
  };

  const scoreDe = (p: Partido): string => {
    const sets = [p.set1, p.set2, p.set3, p.set4, p.set5].filter(Boolean);
    return sets.length > 0 ? sets.join(" · ") : "Sin score";
  };

  const handleDescargarPDF = async () => {
    if (!refPDF.current) return;

    if (modoPrincipal === "partido" && !partidoSeleccionado) {
      alert("Elegí un partido antes de descargar el PDF.");
      return;
    }
    if (
      modoPrincipal === "comparar-partidos" &&
      partidosComparados.length === 0
    ) {
      alert("Elegí al menos un partido para comparar antes de descargar.");
      return;
    }
    if (
      modoPrincipal === "jugador-por-partidos" &&
      (!jugadorSeleccionadoJxP || partidosJxP.length === 0)
    ) {
      alert("Elegí un jugador y al menos un partido antes de descargar.");
      return;
    }

    setDescargando(true);

    const agregarCrudas = modoPrincipal === "partido";
    if (agregarCrudas) {
      setCrudasEnPDF(true);
      await new Promise((r) => setTimeout(r, 200));
    }

    try {
      let nombre = "partidos";
      let titulo = `Partidos · ${nombreEquipo}`;

      if (modoPrincipal === "partido" && partidoDetalle) {
        nombre = `partido-vs-${nombreRivalDe(partidoDetalle)}-${
          partidoDetalle.fecha
        }`;
        titulo = `${nombreEquipo} vs ${nombreRivalDe(
          partidoDetalle
        )} · ${partidoDetalle.fecha}`;
      } else if (modoPrincipal === "comparar-partidos") {
        nombre = `comparacion-partidos-${nombreEquipo}`;
        titulo = `Comparación de partidos · ${nombreEquipo}`;
      } else if (modoPrincipal === "jugador-por-partidos") {
        nombre = `jugador-${nombreDe(
          jugadorSeleccionadoJxP ?? ""
        )}-${nombreEquipo}`;
        titulo = `${nombreDe(jugadorSeleccionadoJxP ?? "")} · ${nombreEquipo}`;
      }

      await descargarComoPDF(refPDF.current, nombre, titulo);
    } finally {
      if (agregarCrudas) setCrudasEnPDF(false);
      setDescargando(false);
    }
  };

  // ============ RENDER ============

  return (
    <div className="space-y-4">
      {/* ---------- BOTÓN EXPORTAR PDF ---------- */}
      <div className="flex justify-end" data-pdf-ignorar>
        <button
          onClick={handleDescargarPDF}
          disabled={descargando}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl shadow-sm transition-all disabled:opacity-50 w-full sm:w-auto"
          style={{
            background: "rgba(15,29,53,0.8)",
            color: "var(--sx-text-primary)",
            border: "1px solid var(--sx-border-bright)",
          }}
        >
          <FileDown size={14} style={{ color: "var(--sx-teal)" }} />
          <span>
            {descargando ? "Generando PDF..." : "Exportar Informe PDF"}
          </span>
        </button>
      </div>

      {/* ---------- CONTENIDO EXPORTABLE ---------- */}
      <div ref={refPDF} className="space-y-4">
        <HeaderPartido
          modoPrincipal={modoPrincipal}
          nombreEquipo={nombreEquipo}
          partidoDetalle={partidoDetalle}
          jugadorSeleccionadoJxP={jugadorSeleccionadoJxP}
          nombreRivalDe={nombreRivalDe}
          nombreDe={nombreDe}
          filtroSet={filtroSet}
          hayFiltrosTacticosActivos={hayFiltrosTacticosActivos}
        />

        {/* Barra de modos principales */}
        <div className="flex flex-wrap justify-end gap-2" data-pdf-ignorar>
          <button
            onClick={() => handleToggleModoPrincipal("partido")}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition border ${
              modoPrincipal === "partido"
                ? "bg-emerald-500 text-white border-emerald-500"
                : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white"
            }`}
          >
            Ver partido
          </button>
          <button
            onClick={() => handleToggleModoPrincipal("comparar-partidos")}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition border ${
              modoPrincipal === "comparar-partidos"
                ? "bg-emerald-500 text-white border-emerald-500"
                : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white"
            }`}
          >
            Comparar partidos ({partidosComparados.length}/3)
          </button>
          <button
            onClick={() => handleToggleModoPrincipal("jugador-por-partidos")}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition border ${
              modoPrincipal === "jugador-por-partidos"
                ? "bg-emerald-500 text-white border-emerald-500"
                : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white"
            }`}
          >
            Jugador por partidos
          </button>
        </div>

        {/* Layout de 3 columnas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
          <ListaPartidos
            modoPrincipal={modoPrincipal}
            nombreEquipo={nombreEquipo}
            filtroRival={filtroRival}
            onFiltroRival={setFiltroRival}
            filtroFechaDesde={filtroFechaDesde}
            onFiltroFechaDesde={setFiltroFechaDesde}
            filtroFechaHasta={filtroFechaHasta}
            onFiltroFechaHasta={setFiltroFechaHasta}
            filtroSet={filtroSet}
            onFiltroSet={setFiltroSet}
            filtrosTacticos={filtrosTacticos}
            onFiltrosTacticos={setFiltrosTacticos}
            hayFiltrosActivos={hayFiltrosActivos}
            onLimpiarFiltros={limpiarFiltros}
            partidosFiltrados={partidosFiltrados}
            rivalesUnicos={rivalesUnicos}
            partidoSeleccionado={partidoSeleccionado}
            onPartidoSeleccionado={setPartidoSeleccionado}
            partidosComparados={partidosComparados}
            onTogglePartidoComparado={handleTogglePartidoComparado}
            jugadores={jugadores}
            acciones={acciones}
            jugadorSeleccionadoJxP={jugadorSeleccionadoJxP}
            onJugadorSeleccionadoJxP={setJugadorSeleccionadoJxP}
            nombreRivalDe={nombreRivalDe}
            scoreDe={scoreDe}
          />

          {/* Columna derecha: vista según modo */}
          <div className="col-span-1 lg:col-span-2">
            {/* MODO PARTIDO */}
            {modoPrincipal === "partido" && (
              <>
                {!partidoDetalle || !statsPartido ? (
                  <div
                    className="rounded-2xl p-8 sm:p-12 text-center h-full flex items-center justify-center"
                    style={cardBase}
                  >
                    <div>
                      <p className="text-4xl mb-3">👈</p>
                      <p
                        className="font-medium"
                        style={{ color: "var(--sx-text-primary)" }}
                      >
                        Elegí un partido para ver el detalle
                      </p>
                    </div>
                  </div>
                ) : cargandoVisuales ? (
                  <p
                    className="text-center py-12"
                    style={{ color: "var(--sx-text-secondary)" }}
                  >
                    Cargando datos del análisis...
                  </p>
                ) : (
                  <div className="space-y-4">
                    {/* ============ CONSULTAS ANALÍTICAS (solo este partido) ============ */}
                    <section
                      data-pdf-ignorar
                      className="rounded-2xl p-3 sm:p-4"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(8,24,40,0.95) 0%, rgba(15,29,53,0.92) 100%)",
                        border: "1px solid rgba(14,165,201,0.3)",
                        boxShadow:
                          "0 8px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(14,165,201,0.15)",
                      }}
                    >
                      <ConsultaPanel
                        acciones={accionesVisuales}
                        puntos={puntosCompletosPartido}
                        jugadores={jugadoresParaConsulta}
                        partidos={partidosParaConsulta}
                        nombreDeJugador={nombreDe}
                      />
                    </section>

                    {/* ============ DETALLE DEL PARTIDO ============ */}
                    <VistaDetallePartido
                      partidoDetalle={partidoDetalle}
                      statsPartido={statsPartido}
                      accionesDelPartido={accionesDelPartido}
                      accionesVisualesParaAnalisis={accionesVisuales}
                      idsJugadores={idsJugadores}
                      armadores={armadores}
                      jugadores={jugadores}
                      nombresJugadoresMap={nombresJugadoresMap}
                      datosRivalPartido={datosRivalPartido}
                      filtroSet={filtroSet}
                      nombreEquipo={nombreEquipo}
                      nombreRivalDe={nombreRivalDe}
                      nombreDe={nombreDe}
                      hayFiltrosTacticosActivos={hayFiltrosTacticosActivos}
                      crudasEnPDF={crudasEnPDF}
                    />
                  </div>
                )}
              </>
            )}

            {/* MODO COMPARAR PARTIDOS */}
            {modoPrincipal === "comparar-partidos" && (
              <VistaCompararPartidos
                partidosComparadosData={partidosComparadosData.map((s) => ({
                  id: s.id,
                  nombre: s.nombre,
                  color: s.color,
                  stats: s.stats,
                }))}
                seriesRadarPartidos={seriesRadarPartidos}
                seriesRecepcionPartidos={seriesRecepcionPartidos}
                accionesPartidosComparados={accionesPartidosComparados}
              />
            )}

            {/* MODO JUGADOR POR PARTIDOS */}
            {modoPrincipal === "jugador-por-partidos" && (
              <VistaJugadorPorPartidos
                jugadorSeleccionadoJxP={jugadorSeleccionadoJxP}
                jugadorNombre={nombreDe(jugadorSeleccionadoJxP ?? "")}
                esArmadorJxP={esArmadorJxP ?? false}
                partidos={partidos}
                partidosJxP={partidosJxP}
                onTogglePartidoJxP={handleTogglePartidoJxP}
                partidosJxPData={partidosJxPData}
                seriesRadarJxP={seriesRadarJxP}
                seriesSaqueJxP={seriesSaqueJxP}
                seriesRecepcionJxP={seriesRecepcionJxP}
                seriesBloqueoJxP={seriesBloqueoJxP}
                seriesArmadosJxP={seriesArmadosJxP}
                accionesJxPCombinadas={accionesJxPCombinadas}
                acciones={acciones}
                nombreDe={nombreDe}
                nombreRivalDe={nombreRivalDe}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}