"use client";

import { useEffect, useRef, useState } from "react";
import {
  FileDown,
  Calendar,
  CalendarDays,
  GitCompare,
  BarChart2,
  Table,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  cargarAccionesCompatibles,
  contarPuntosRival,
  type AccionDB,
} from "@/lib/db";
import {
  calcularEstadisticasEquipo,
  calcularEstadisticasJugador,
  calcularMaxAccionesPorFundamento,
  calcularPromedioPonderadoPorSet,
  calcularPromedioArmadosPonderadoPorSet,
  VALORES_SAQUE,
  VALORES_RECEPCION,
  VALORES_BLOQUEO,
  type PromedioRecepcionSet,
} from "@/lib/estadisticas";
import GraficoRecepcionEquipoPorSet from "./GraficoRecepcionEquipoPorSet";
import GraficoTortaRival from "./GraficoTortaRival";
import RadarEquipo from "./RadarEquipo";
import RadarJugador from "./RadarJugador";
import GraficoSaquePorSet from "./GraficoSaquePorSet";
import GraficoRecepcionPorSet from "./GraficoRecepcionPorSet";
import GraficoBloqueoPorSet from "./GraficoBloqueoPorSet";
import GraficoArmadosPorSet from "./GraficoArmadosPorSet";
import TablaJugadoresPorSet from "./TablaJugadoresPorSet";
import TablaEstadisticasCrudas from "./TablaEstadisticasCrudas";
import GraficoBarrasFundamentoPartidos from "./GraficoBarrasFundamentoPartidos";
import IconoVoley from "./IconoVoley";
import { descargarComoPDF } from "@/lib/exportarPDF";

interface Partido {
  id: string;
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
  equipo_id: string;
  equipo_rival_id: string | null;
}

interface Jugador {
  id: string;
  nombre: string;
  numero: number | null;
  rol: string;
}

interface Equipo {
  id: string;
  nombre: string;
}

interface Props {
  equipoId: string;
  nombreEquipo: string;
}

interface DatosRival {
  buenas: number;
  errores: number;
}

const FUNDAMENTOS = ["saque", "recepcion", "ataque", "bloqueo", "defensa"];
const FUNDAMENTOS_BARRAS = [
  "saque",
  "recepcion",
  "ataque",
  "bloqueo",
  "defensa",
] as const;
const NOMBRES: Record<string, string> = {
  saque: "Saque",
  recepcion: "Recepción",
  ataque: "Ataque",
  bloqueo: "Bloqueo",
  defensa: "Defensa",
};

const COLORES_COMPARACION = ["#EF4444", "#8B5CF6", "#3B82F6"];

type ModoPrincipal =
  | "partido"
  | "comparar-partidos"
  | "jugador-por-partidos";
type ModoDetalle = "analisis" | "comparar-jugadores" | "crudas";

const cardBase: React.CSSProperties = {
  background: "var(--sx-surface-1)",
  border: "1px solid var(--sx-border)",
  boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
};

const labelStyle: React.CSSProperties = {
  color: "var(--sx-text-secondary)",
};

export default function Partidos({ equipoId, nombreEquipo }: Props) {
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [acciones, setAcciones] = useState<AccionDB[]>([]);
  const [datosRival, setDatosRival] = useState<Record<string, DatosRival>>({});
  const [cargando, setCargando] = useState(true);

  const [filtroRival, setFiltroRival] = useState("");
  const [filtroFechaDesde, setFiltroFechaDesde] = useState("");
  const [filtroFechaHasta, setFiltroFechaHasta] = useState("");
  const [filtroSet, setFiltroSet] = useState<
    "todos" | "1" | "2" | "3" | "4" | "5"
  >("todos");

  const [modoPrincipal, setModoPrincipal] =
    useState<ModoPrincipal>("partido");
  const [partidoSeleccionado, setPartidoSeleccionado] = useState<string | null>(
    null
  );
  const [partidosComparados, setPartidosComparados] = useState<string[]>([]);

  const [jugadorSeleccionadoJxP, setJugadorSeleccionadoJxP] = useState<
    string | null
  >(null);
  const [partidosJxP, setPartidosJxP] = useState<string[]>([]);

  const [modoDetalle, setModoDetalle] = useState<ModoDetalle>("analisis");
  const [jugadoresComparados, setJugadoresComparados] = useState<string[]>([]);

  const [crudasEnPDF, setCrudasEnPDF] = useState(false);

  const [descargando, setDescargando] = useState(false);
  const refPDF = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!equipoId) return;
    setCargando(true);

    Promise.all([
      supabase
        .from("partidos")
        .select("*")
        .or(`equipo_id.eq.${equipoId},equipo_rival_id.eq.${equipoId}`)
        .order("fecha", { ascending: false }),
      supabase
        .from("jugadores")
        .select("id, nombre, numero, rol")
        .order("nombre"),
      supabase.from("equipos").select("id, nombre"),
    ]).then(async ([partRes, jugRes, eqRes]) => {
      if (!partRes.data || !jugRes.data) {
        setCargando(false);
        return;
      }
      setPartidos(partRes.data);
      setJugadores(jugRes.data);
      if (eqRes.data) setEquipos(eqRes.data);

      const ids = partRes.data.map((p) => p.id);
      if (ids.length === 0) {
        setAcciones([]);
        setDatosRival({});
        setCargando(false);
        return;
      }

      const [resultadosAcciones, resultadosRival] = await Promise.all([
        Promise.all(
          ids.map((pid) => cargarAccionesCompatibles(pid, equipoId))
        ),
        Promise.all(ids.map((pid) => contarPuntosRival(pid, equipoId))),
      ]);

      const mapaRival: Record<string, DatosRival> = {};
      ids.forEach((pid, idx) => {
        mapaRival[pid] = resultadosRival[idx];
      });

      setAcciones(resultadosAcciones.flat());
      setDatosRival(mapaRival);
      setCargando(false);
    });
  }, [equipoId]);

  const limpiarFiltros = () => {
    setFiltroRival("");
    setFiltroFechaDesde("");
    setFiltroFechaHasta("");
    setFiltroSet("todos");
  };

  const nombreDe = (id: string) => {
    const j = jugadores.find((x) => x.id === id);
    return j ? j.nombre + (j.numero !== null ? ` #${j.numero}` : "") : "?";
  };

  const nombreRivalDe = (p: Partido) => {
    if (p.equipo_rival_id === equipoId) {
      const local = equipos.find((e) => e.id === p.equipo_id);
      if (local) return local.nombre;
    }
    return p.rival;
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
    setModoDetalle("analisis");
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

  const handleToggleJugadorComparado = (id: string) => {
    if (jugadoresComparados.includes(id)) {
      setJugadoresComparados(jugadoresComparados.filter((x) => x !== id));
      return;
    }
    if (jugadoresComparados.length >= 3) return;

    if (jugadoresComparados.length > 0) {
      const armadoresSet = new Set(
        jugadores.filter((j) => j.rol === "armador").map((j) => j.id)
      );
      const primerEsArm = armadoresSet.has(jugadoresComparados[0]);
      const esteEsArm = armadoresSet.has(id);
      if (primerEsArm !== esteEsArm) return;
    }

    setJugadoresComparados([...jugadoresComparados, id]);
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

    const agregarCrudas =
      modoPrincipal === "partido" && modoDetalle === "analisis";
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

  const partidosFiltrados = partidos.filter((p) => {
    if (filtroRival && nombreRivalDe(p) !== filtroRival) return false;
    if (filtroFechaDesde && p.fecha < filtroFechaDesde) return false;
    if (filtroFechaHasta && p.fecha > filtroFechaHasta) return false;
    return true;
  });

  const rivalesUnicos = Array.from(
    new Set(partidos.map((p) => nombreRivalDe(p)))
  ).sort();
  const hayFiltrosActivos =
    filtroRival !== "" || filtroFechaDesde !== "" || filtroFechaHasta !== "";

  const scoreDe = (p: Partido) => {
    const sets = [p.set1, p.set2, p.set3, p.set4, p.set5].filter(Boolean);
    return sets.length > 0 ? sets.join(" · ") : "Sin score";
  };

  const partidoDetalle = partidoSeleccionado
    ? partidos.find((p) => p.id === partidoSeleccionado)
    : null;

  const accionesDelPartido = partidoDetalle
    ? acciones.filter((a) => {
        if (a.partido_id !== partidoDetalle.id) return false;
        if (filtroSet !== "todos" && String(a.set_numero) !== filtroSet)
          return false;
        return true;
      })
    : [];

  const idsJugadores = jugadores.map((j) => j.id);
  const armadores = new Set(
    jugadores.filter((j) => j.rol === "armador").map((j) => j.id)
  );
  const statsPartido = partidoDetalle
    ? calcularEstadisticasEquipo(idsJugadores, accionesDelPartido, armadores)
    : null;

  const promediosRecepcionEquipo: PromedioRecepcionSet[] = [1, 2, 3, 4, 5].map(
    (s) => {
      const delSet = accionesDelPartido.filter(
        (a) =>
          a.fundamento === "recepcion" &&
          a.set_numero === s &&
          !armadores.has(a.jugador_id)
      );
      let suma = 0;
      let total = 0;
      for (const a of delSet) {
        const v = VALORES_RECEPCION[a.valoracion] ?? 0;
        suma += v * a.cantidad;
        total += a.cantidad;
      }
      return {
        set: s,
        promedio: total > 0 ? suma / total : 0,
        totalRecepciones: total,
      };
    }
  );

  const partidosComparadosData = partidosComparados
    .map((id, idx) => {
      const partido = partidos.find((p) => p.id === id);
      if (!partido) return null;
      const accPartido = acciones.filter((a) => a.partido_id === id);
      const stats = calcularEstadisticasEquipo(
        idsJugadores,
        accPartido,
        armadores
      ).totales;
      return {
        id,
        nombre: `vs ${nombreRivalDe(partido)} (${partido.fecha})`,
        color: COLORES_COMPARACION[idx],
        partido,
        stats,
        acciones: accPartido,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const accionesPartidosComparados: AccionDB[] = partidosComparadosData.flatMap(
    (s) => s.acciones
  );

  const seriesRadarPartidos = partidosComparadosData.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    color: s.color,
    equipo: s.stats,
  }));

  const seriesRecepcionPartidos = partidosComparadosData.map((s) => {
    const proms: PromedioRecepcionSet[] = [1, 2, 3, 4, 5].map((set) => {
      const delSet = s.acciones.filter(
        (a) =>
          a.fundamento === "recepcion" &&
          a.set_numero === set &&
          !armadores.has(a.jugador_id)
      );
      let suma = 0;
      let total = 0;
      for (const a of delSet) {
        const v = VALORES_RECEPCION[a.valoracion] ?? 0;
        suma += v * a.cantidad;
        total += a.cantidad;
      }
      return {
        set,
        promedio: total > 0 ? suma / total : 0,
        totalRecepciones: total,
      };
    });
    return {
      id: s.id,
      nombre: s.nombre,
      color: s.color,
      promedios: proms,
    };
  });

  const jugadorJxP = jugadorSeleccionadoJxP
    ? jugadores.find((j) => j.id === jugadorSeleccionadoJxP)
    : null;
  const esArmadorJxP = jugadorJxP?.rol === "armador";

  const partidosJxPData = jugadorSeleccionadoJxP
    ? partidosJxP
        .map((pid, idx) => {
          const partido = partidos.find((p) => p.id === pid);
          if (!partido) return null;
          const accPartido = acciones.filter((a) => a.partido_id === pid);

          const maxPorFundP = calcularMaxAccionesPorFundamento(
            accPartido,
            idsJugadores
          );
          let maxAccP = 1;
          for (const jid of idsJugadores) {
            const total = accPartido
              .filter((a) => a.jugador_id === jid)
              .reduce((s, a) => s + a.cantidad, 0);
            if (total > maxAccP) maxAccP = total;
          }

          const est = calcularEstadisticasJugador(
            jugadorSeleccionadoJxP,
            accPartido,
            esArmadorJxP ?? false,
            maxPorFundP,
            maxAccP
          );

          return {
            id: pid,
            nombre: `vs ${nombreRivalDe(partido)} (${partido.fecha})`,
            color: COLORES_COMPARACION[idx],
            partido,
            accPartido,
            est,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
    : [];

  const accionesJxPCombinadas: AccionDB[] = partidosJxPData.flatMap(
    (s) => s.accPartido
  );

  const seriesRadarJxP = partidosJxPData.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    color: s.color,
    jugador: s.est,
  }));

  const seriesSaqueJxP = jugadorSeleccionadoJxP
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
    : [];

  const seriesRecepcionJxP = jugadorSeleccionadoJxP
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
    : [];

  const seriesBloqueoJxP = jugadorSeleccionadoJxP
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
    : [];

  const seriesArmadosJxP = jugadorSeleccionadoJxP
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
    : [];

  const jugadoresComparadosData = jugadoresComparados.map((id, idx) => ({
    id,
    nombre: nombreDe(id),
    color: COLORES_COMPARACION[idx],
  }));

  const esComparacionArmador =
    jugadoresComparadosData.length > 0 &&
    armadores.has(jugadoresComparadosData[0].id);

  const statsJugadoresComparados = jugadoresComparadosData.map((s) => {
    const est = calcularEstadisticasEquipo(
      idsJugadores,
      accionesDelPartido,
      armadores
    ).porJugador[s.id];
    return { ...s, est };
  });

  const seriesRadarJugadores = statsJugadoresComparados
    .filter((s) => s.est)
    .map((s) => ({
      id: s.id,
      nombre: s.nombre,
      color: s.color,
      jugador: s.est,
    }));

  const seriesSaqueJugadores = statsJugadoresComparados
    .filter((s) => s.est)
    .map((s) => ({
      id: s.id,
      nombre: s.nombre,
      color: s.color,
      promedios: calcularPromedioPonderadoPorSet(
        s.id,
        accionesDelPartido,
        idsJugadores,
        "saque",
        VALORES_SAQUE
      ),
    }));

  const seriesRecepcionJugadores = statsJugadoresComparados
    .filter((s) => s.est)
    .map((s) => ({
      id: s.id,
      nombre: s.nombre,
      color: s.color,
      promedios: calcularPromedioPonderadoPorSet(
        s.id,
        accionesDelPartido,
        idsJugadores,
        "recepcion",
        VALORES_RECEPCION
      ),
    }));

  const seriesBloqueoJugadores = statsJugadoresComparados
    .filter((s) => s.est)
    .map((s) => ({
      id: s.id,
      nombre: s.nombre,
      color: s.color,
      promedios: calcularPromedioPonderadoPorSet(
        s.id,
        accionesDelPartido,
        idsJugadores,
        "bloqueo",
        VALORES_BLOQUEO
      ),
    }));

  const seriesArmadosJugadores = statsJugadoresComparados
    .filter((s) => s.est)
    .map((s) => ({
      id: s.id,
      nombre: s.nombre,
      color: s.color,
      promedios: calcularPromedioArmadosPonderadoPorSet(
        s.id,
        accionesDelPartido,
        idsJugadores
      ),
    }));

  const datosRivalPartido = partidoDetalle
    ? datosRival[partidoDetalle.id] ?? { buenas: 0, errores: 0 }
    : { buenas: 0, errores: 0 };

  const nombresJugadoresMap: Record<string, string> = {};
  for (const j of jugadores) {
    nombresJugadoresMap[j.id] =
      j.nombre + (j.numero !== null ? ` #${j.numero}` : "");
  }

  return (
    <div className="space-y-4">
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
          <span>{descargando ? "Generando PDF..." : "Exportar Informe PDF"}</span>
        </button>
      </div>

      <div ref={refPDF} className="space-y-4">
        <div
          className="rounded-2xl p-4 sm:p-5"
          style={cardBase}
        >
          <h2 className="text-lg sm:text-xl font-black text-white break-words tracking-tight">
            {modoPrincipal === "partido" && partidoDetalle
              ? `${nombreEquipo} vs ${nombreRivalDe(partidoDetalle)}`
              : modoPrincipal === "comparar-partidos"
              ? `Comparación de partidos · ${nombreEquipo}`
              : modoPrincipal === "jugador-por-partidos"
              ? `${nombreDe(jugadorSeleccionadoJxP ?? "")} · ${nombreEquipo}`
              : `Partidos · ${nombreEquipo}`}
          </h2>
          {modoPrincipal === "partido" && partidoDetalle && (
            <p
              className="text-xs mt-1.5 flex items-center gap-2 flex-wrap"
              style={{ color: "var(--sx-text-secondary)" }}
            >
              <span className="inline-flex items-center gap-1 font-medium">
                <Calendar
                  size={13}
                  style={{ color: "var(--sx-text-muted)" }}
                />
                {partidoDetalle.fecha}
              </span>
              <span
                className="font-mono font-bold px-2 py-0.5 rounded text-[11px]"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  color: "var(--sx-text-primary)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                {scoreDe(partidoDetalle)}
              </span>
              {filtroSet !== "todos" && (
                <span
                  className="px-2 py-0.5 rounded text-[11px] font-semibold"
                  style={{
                    background: "rgba(37,99,235,0.15)",
                    color: "#93C5FD",
                    border: "1px solid rgba(37,99,235,0.35)",
                  }}
                >
                  Solo Set {filtroSet}
                </span>
              )}
            </p>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2" data-pdf-ignorar>
          <button
            onClick={() => handleToggleModoPrincipal("partido")}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition border ${
              modoPrincipal === "partido"
                ? "bg-emerald-500 text-white border-emerald-500"
                : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white"
            }`}
          >
            <IconoVoley
              tipo="partido"
              size={18}
              className={
                modoPrincipal === "partido" ? "text-white" : "text-slate-400"
              }
            />
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
            <IconoVoley
              tipo="comparar"
              size={18}
              className={
                modoPrincipal === "comparar-partidos"
                  ? "text-white"
                  : "text-slate-400"
              }
            />
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
            <IconoVoley
              tipo="jugador"
              size={18}
              className={
                modoPrincipal === "jugador-por-partidos"
                  ? "text-white"
                  : "text-slate-400"
              }
            />
            Jugador por partidos
          </button>
        </div>

        {modoPrincipal !== "jugador-por-partidos" && (
          <div
            className="rounded-2xl p-3 sm:p-4"
            style={cardBase}
            data-pdf-ignorar
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={labelStyle}>
                  Rival
                </label>
                <select
                  value={filtroRival}
                  onChange={(e) => setFiltroRival(e.target.value)}
                  className="input-dark text-sm"
                >
                  <option value="">Todos</option>
                  {rivalesUnicos.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={labelStyle}>
                  Desde
                </label>
                <input
                  type="date"
                  value={filtroFechaDesde}
                  onChange={(e) => setFiltroFechaDesde(e.target.value)}
                  className="input-dark text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={labelStyle}>
                  Hasta
                </label>
                <input
                  type="date"
                  value={filtroFechaHasta}
                  onChange={(e) => setFiltroFechaHasta(e.target.value)}
                  className="input-dark text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={labelStyle}>
                  Set (en detalle)
                </label>
                <select
                  value={filtroSet}
                  onChange={(e) =>
                    setFiltroSet(
                      e.target.value as "todos" | "1" | "2" | "3" | "4" | "5"
                    )
                  }
                  className="input-dark text-sm"
                >
                  <option value="todos">Todos</option>
                  <option value="1">Set 1</option>
                  <option value="2">Set 2</option>
                  <option value="3">Set 3</option>
                  <option value="4">Set 4</option>
                  <option value="5">Set 5</option>
                </select>
              </div>
            </div>
            {hayFiltrosActivos && (
              <div className="mt-2 text-right">
                <button
                  onClick={limpiarFiltros}
                  className="text-xs font-medium"
                  style={{ color: "#34D399" }}
                >
                  Limpiar filtros
                </button>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
          <div className="col-span-1" data-pdf-ignorar>
            {modoPrincipal === "jugador-por-partidos" ? (
              <>
                <h3 className="font-semibold text-white mb-3">
                  Elegí un jugador
                </h3>
                <div className="space-y-2">
                  {jugadores
                    .filter((j) =>
                      acciones.some((a) => a.jugador_id === j.id)
                    )
                    .map((j) => {
                      const sel = jugadorSeleccionadoJxP === j.id;
                      return (
                        <button
                          key={j.id}
                          onClick={() => setJugadorSeleccionadoJxP(j.id)}
                          className={`w-full text-left p-3 rounded-lg border transition ${
                            sel
                              ? "bg-emerald-500 border-emerald-500 text-white"
                              : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          <p
                            className={`font-medium text-sm ${
                              sel ? "text-white" : "text-slate-200"
                            }`}
                          >
                            {j.nombre}
                            {j.numero !== null && ` #${j.numero}`}
                            {j.rol === "armador" && (
                              <span
                                className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full ${
                                  sel
                                    ? "bg-white/20 text-white"
                                    : "bg-violet-500/20 text-violet-300"
                                }`}
                              >
                                Arm
                              </span>
                            )}
                          </p>
                        </button>
                      );
                    })}
                </div>
              </>
            ) : (
              <>
                <h3 className="font-semibold text-white mb-3">
                  {partidosFiltrados.length} partido
                  {partidosFiltrados.length !== 1 ? "s" : ""}
                  {modoPrincipal === "comparar-partidos" &&
                    " — elegí hasta 3"}
                </h3>

                {partidosFiltrados.length === 0 ? (
                  <div
                    className="rounded-2xl p-6 text-center"
                    style={cardBase}
                  >
                    <p
                      className="text-sm"
                      style={{ color: "var(--sx-text-secondary)" }}
                    >
                      Ningún partido cumple los filtros
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {partidosFiltrados.map((p) => {
                      const idxComparado = partidosComparados.indexOf(p.id);
                      const seleccionadoIndividual =
                        modoPrincipal === "partido" &&
                        partidoSeleccionado === p.id;
                      const colorComp =
                        idxComparado !== -1
                          ? COLORES_COMPARACION[idxComparado]
                          : null;

                      return (
                        <button
                          key={p.id}
                          onClick={() =>
                            modoPrincipal === "partido"
                              ? setPartidoSeleccionado(p.id)
                              : handleTogglePartidoComparado(p.id)
                          }
                          className={`w-full text-left p-3 rounded-lg border transition relative ${
                            seleccionadoIndividual
                              ? "bg-emerald-500 border-emerald-500 text-white"
                              : colorComp
                              ? "border-2 text-white"
                              : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white"
                          }`}
                          style={
                            colorComp
                              ? {
                                  backgroundColor: colorComp + "20",
                                  borderColor: colorComp,
                                }
                              : undefined
                          }
                        >
                          {idxComparado !== -1 && (
                            <span
                              className="absolute top-2 right-2 w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center border-2 border-white shadow"
                              style={{ backgroundColor: colorComp! }}
                            >
                              {idxComparado + 1}
                            </span>
                          )}
                          <p
                            className={`font-medium text-sm ${
                              seleccionadoIndividual
                                ? "text-white"
                                : "text-slate-200"
                            }`}
                          >
                            vs {nombreRivalDe(p)}
                          </p>
                          <p
                            className={`text-xs mt-1 ${
                              seleccionadoIndividual
                                ? "text-emerald-100"
                                : "text-slate-400"
                            }`}
                          >
                            📅 {p.fecha}
                          </p>
                          <p
                            className={`text-xs mt-1 ${
                              seleccionadoIndividual
                                ? "text-emerald-100"
                                : "text-slate-400"
                            }`}
                          >
                            {scoreDe(p)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="col-span-1 lg:col-span-2">
            {modoPrincipal === "jugador-por-partidos" ? (
              <div className="space-y-4">
                {!jugadorSeleccionadoJxP ? (
                  <div
                    className="rounded-2xl p-8 sm:p-12 text-center"
                    style={cardBase}
                  >
                    <p className="text-4xl mb-3">👈</p>
                    <p
                      className="font-medium"
                      style={{ color: "var(--sx-text-primary)" }}
                    >
                      Elegí un jugador a la izquierda para empezar
                    </p>
                  </div>
                ) : (
                  <>
                    <div
                      className="rounded-2xl p-3 sm:p-5"
                      style={cardBase}
                      data-pdf-ignorar
                    >
                      <h4 className="font-semibold text-white mb-3">
                        Elegí hasta 3 partidos para comparar a{" "}
                        {nombreDe(jugadorSeleccionadoJxP)}
                      </h4>
                      <div className="flex gap-2 flex-wrap">
                        {partidos.map((p) => {
                          const idx = partidosJxP.indexOf(p.id);
                          const color =
                            idx !== -1 ? COLORES_COMPARACION[idx] : null;
                          const tieneAcciones = acciones.some(
                            (a) =>
                              a.partido_id === p.id &&
                              a.jugador_id === jugadorSeleccionadoJxP
                          );
                          return (
                            <button
                              key={p.id}
                              onClick={() => handleTogglePartidoJxP(p.id)}
                              disabled={!tieneAcciones && idx === -1}
                              className={`px-3 py-2 text-xs font-medium rounded-lg transition border flex items-center gap-2 ${
                                color
                                  ? "border-2 text-white"
                                  : !tieneAcciones
                                  ? "bg-white/5 text-slate-600 cursor-not-allowed border-white/10 opacity-50"
                                  : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white"
                              }`}
                              style={
                                color
                                  ? {
                                      backgroundColor: color + "20",
                                      borderColor: color,
                                    }
                                  : undefined
                              }
                            >
                              {color && (
                                <span
                                  className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                                  style={{ backgroundColor: color }}
                                >
                                  {idx + 1}
                                </span>
                              )}
                              vs {nombreRivalDe(p)} · {p.fecha}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {partidosJxPData.length === 0 ? (
                      <div
                        className="rounded-2xl p-8 sm:p-12 text-center max-w-sm mx-auto"
                        style={cardBase}
                      >
                        <GitCompare
                          size={36}
                          className="mx-auto mb-3"
                          style={{ color: "var(--sx-text-muted)" }}
                        />
                        <h4 className="text-white font-bold text-sm">
                          Sin partidos seleccionados
                        </h4>
                        <p
                          className="text-xs mt-1"
                          style={{ color: "var(--sx-text-secondary)" }}
                        >
                          Elegí partidos arriba para analizar la evolución del jugador.
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-2xl p-4 sm:p-6" style={cardBase}>
                        <div
                          className="mb-6 pb-4"
                          style={{ borderBottom: "1px solid var(--sx-border)" }}
                        >
                          <h3 className="text-lg sm:text-xl font-bold text-white mb-3">
                            {nombreDe(jugadorSeleccionadoJxP)} en{" "}
                            {partidosJxPData.length} partido
                            {partidosJxPData.length !== 1 ? "s" : ""}
                          </h3>
                          <div className="flex flex-wrap gap-2 sm:gap-3">
                            {partidosJxPData.map((s) => (
                              <div
                                key={s.id}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                                style={{
                                  border: "1px solid var(--sx-border)",
                                  background: "rgba(255,255,255,0.03)",
                                }}
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
                            Radar comparado
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                            <div
                              className="rounded-2xl p-2 col-span-1"
                              style={cardBase}
                            >
                              <RadarJugador
                                series={seriesRadarJxP}
                                esArmador={esArmadorJxP}
                              />
                            </div>
                            {FUNDAMENTOS_BARRAS.map((f) => (
                              <GraficoBarrasFundamentoPartidos
                                key={f}
                                fundamento={f}
                                acciones={accionesJxPCombinadas}
                                jugadorId={jugadorSeleccionadoJxP ?? undefined}
                                tituloOverride={`${NOMBRES[f]} (total)`}
                              />
                            ))}
                          </div>
                        </div>

                        <div className="mb-6">
                          <h4 className="font-semibold text-white mb-3">
                            Valoración ponderada por partido
                          </h4>
                          <div
                            className="overflow-x-auto rounded-lg"
                            style={{ border: "1px solid var(--sx-border)" }}
                          >
                            <table className="w-full text-sm min-w-[500px]">
                              <thead
                                style={{
                                  background: "rgba(255,255,255,0.04)",
                                  borderBottom: "1px solid var(--sx-border)",
                                }}
                              >
                                <tr
                                  className="text-left"
                                  style={{ color: "var(--sx-text-secondary)" }}
                                >
                                  <th className="py-2 px-3">Fundamento</th>
                                  {partidosJxPData.map((s) => (
                                    <th
                                      key={s.id}
                                      className="py-2 px-3 text-right"
                                      style={{ color: s.color }}
                                    >
                                      {s.nombre}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {Object.keys(
                                  partidosJxPData[0].est
                                    .valoracionPonderadaPorFundamento
                                ).map((f) => (
                                  <tr
                                    key={f}
                                    style={{
                                      borderBottom:
                                        "1px solid rgba(255,255,255,0.04)",
                                    }}
                                  >
                                    <td className="py-2 px-3 font-medium text-white">
                                      {NOMBRES[f] ?? f}
                                    </td>
                                    {partidosJxPData.map((s) => {
                                      const val =
                                        s.est.valoracionPonderadaPorFundamento[
                                          f
                                        ] ?? 0;
                                      return (
                                        <td
                                          key={s.id}
                                          className="py-2 px-3 text-right font-semibold tabular-nums"
                                          style={{ color: s.color }}
                                        >
                                          {val > 0 ? "+" : ""}
                                          {val.toFixed(2)}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                          <div
                            className="rounded-2xl p-3 sm:p-4"
                            style={cardBase}
                          >
                            <GraficoSaquePorSet series={seriesSaqueJxP} />
                          </div>

                          {!esArmadorJxP && (
                            <div
                              className="rounded-2xl p-3 sm:p-4"
                              style={cardBase}
                            >
                              <GraficoRecepcionPorSet
                                series={seriesRecepcionJxP}
                              />
                            </div>
                          )}

                          {esArmadorJxP && (
                            <div
                              className="rounded-2xl p-3 sm:p-4"
                              style={cardBase}
                            >
                              <GraficoArmadosPorSet series={seriesArmadosJxP} />
                            </div>
                          )}

                          <div
                            className={`rounded-2xl p-3 sm:p-4 ${
                              esArmadorJxP ? "" : "md:col-span-2"
                            }`}
                            style={cardBase}
                          >
                            <GraficoBloqueoPorSet series={seriesBloqueoJxP} />
                          </div>
                        </div>

                        <div
                          className="mt-6 overflow-x-auto rounded-lg"
                          style={{ border: "1px solid var(--sx-border)" }}
                        >
                          <table className="w-full text-sm min-w-[500px]">
                            <thead
                              style={{
                                background: "rgba(255,255,255,0.04)",
                                borderBottom: "1px solid var(--sx-border)",
                              }}
                            >
                              <tr
                                className="text-left"
                                style={{ color: "var(--sx-text-secondary)" }}
                              >
                                <th className="py-2 px-3">Partido</th>
                                <th className="py-2 px-3 text-right">Acciones</th>
                                <th className="py-2 px-3 text-right">Puntos</th>
                                <th className="py-2 px-3 text-right">Errores</th>
                                <th className="py-2 px-3 text-right">Saldo</th>
                                <th className="py-2 px-3 text-right">
                                  Val. Media
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {partidosJxPData.map((s) => (
                                <tr
                                  key={s.id}
                                  style={{
                                    borderBottom:
                                      "1px solid rgba(255,255,255,0.04)",
                                  }}
                                >
                                  <td className="py-2 px-3 font-medium">
                                    <span
                                      className="inline-block w-3 h-3 rounded-full mr-2 align-middle"
                                      style={{ backgroundColor: s.color }}
                                    />
                                    <span className="text-white">
                                      {s.nombre}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-right text-slate-300 font-mono tabular-nums">
                                    {s.est.totalAcciones}
                                  </td>
                                  <td className="py-2 px-3 text-right text-emerald-400 font-mono tabular-nums">
                                    {s.est.totalPuntos}
                                  </td>
                                  <td className="py-2 px-3 text-right text-rose-400 font-mono tabular-nums">
                                    {s.est.totalErrores}
                                  </td>
                                  <td
                                    className={`py-2 px-3 text-right font-semibold tabular-nums ${
                                      s.est.saldoTotal > 0
                                        ? "text-emerald-400"
                                        : s.est.saldoTotal < 0
                                        ? "text-rose-400"
                                        : "text-slate-400"
                                    }`}
                                  >
                                    {s.est.saldoTotal > 0 ? "+" : ""}
                                    {s.est.saldoTotal}
                                  </td>
                                  <td
                                    className={`py-2 px-3 text-right font-semibold tabular-nums ${
                                      s.est.valoracionMediaNormalizada > 0
                                        ? "text-emerald-400"
                                        : s.est.valoracionMediaNormalizada < 0
                                        ? "text-rose-400"
                                        : "text-slate-400"
                                    }`}
                                  >
                                    {s.est.valoracionMediaNormalizada > 0
                                      ? "+"
                                      : ""}
                                    {s.est.valoracionMediaNormalizada.toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : modoPrincipal === "comparar-partidos" ? (
              <div className="rounded-2xl p-4 sm:p-6" style={cardBase}>
                {partidosComparadosData.length === 0 ? (
                  <div className="p-8 sm:p-12 text-center max-w-sm mx-auto">
                    <GitCompare
                      size={36}
                      className="mx-auto mb-3"
                      style={{ color: "var(--sx-text-muted)" }}
                    />
                    <h4 className="text-white font-bold text-sm">
                      Comparativa de partidos
                    </h4>
                    <p
                      className="text-xs mt-1"
                      style={{ color: "var(--sx-text-secondary)" }}
                    >
                      Elegí hasta 3 partidos arriba para contrastar rendimiento del equipo.
                    </p>
                  </div>
                ) : (
                  <>
                    <div
                      className="mb-6 pb-4"
                      style={{ borderBottom: "1px solid var(--sx-border)" }}
                    >
                      <h3 className="text-lg sm:text-xl font-bold text-white mb-3">
                        Comparando {partidosComparadosData.length} partido
                        {partidosComparadosData.length !== 1 ? "s" : ""}
                      </h3>
                      <div className="flex flex-wrap gap-2 sm:gap-3">
                        {partidosComparadosData.map((s) => (
                          <div
                            key={s.id}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                            style={{
                              border: "1px solid var(--sx-border)",
                              background: "rgba(255,255,255,0.03)",
                            }}
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                        <div
                          className="rounded-2xl p-2 col-span-1"
                          style={cardBase}
                        >
                          <RadarEquipo
                            series={seriesRadarPartidos}
                            titulo="Radar comparativo del equipo"
                          />
                        </div>
                        {FUNDAMENTOS_BARRAS.map((f) => (
                          <GraficoBarrasFundamentoPartidos
                            key={f}
                            fundamento={f}
                            acciones={accionesPartidosComparados}
                            tituloOverride={`${NOMBRES[f]} (total)`}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:gap-4">
                      <div
                        className="rounded-2xl p-3 sm:p-4"
                        style={cardBase}
                      >
                        <GraficoRecepcionEquipoPorSet
                          series={seriesRecepcionPartidos}
                        />
                      </div>
                    </div>

                    <div className="mt-6 overflow-x-auto">
                      <table className="w-full text-sm min-w-[500px]">
                        <thead>
                          <tr
                            className="text-left"
                            style={{
                              color: "var(--sx-text-secondary)",
                              borderBottom: "1px solid var(--sx-border)",
                            }}
                          >
                            <th className="py-2 px-3">Partido</th>
                            <th className="py-2 px-3 text-right">Acciones</th>
                            <th className="py-2 px-3 text-right">Puntos</th>
                            <th className="py-2 px-3 text-right">Errores</th>
                            <th className="py-2 px-3 text-right">Saldo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {partidosComparadosData.map((s) => (
                            <tr
                              key={s.id}
                              style={{
                                borderBottom:
                                  "1px solid rgba(255,255,255,0.04)",
                              }}
                            >
                              <td className="py-2 px-3 font-medium">
                                <span
                                  className="inline-block w-3 h-3 rounded-full mr-2 align-middle"
                                  style={{ backgroundColor: s.color }}
                                />
                                <span className="text-white">
                                  {s.nombre}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right text-slate-300 font-mono tabular-nums">
                                {s.stats.totalAcciones}
                              </td>
                              <td className="py-2 px-3 text-right text-emerald-400 font-mono tabular-nums">
                                {s.stats.totalPuntos}
                              </td>
                              <td className="py-2 px-3 text-right text-rose-400 font-mono tabular-nums">
                                {s.stats.totalErrores}
                              </td>
                              <td
                                className={`py-2 px-3 text-right font-semibold tabular-nums ${
                                  s.stats.saldoTotal > 0
                                    ? "text-emerald-400"
                                    : s.stats.saldoTotal < 0
                                    ? "text-rose-400"
                                    : "text-slate-400"
                                }`}
                              >
                                {s.stats.saldoTotal > 0 ? "+" : ""}
                                {s.stats.saldoTotal}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            ) : !partidoDetalle || !statsPartido ? (
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
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap justify-end gap-2" data-pdf-ignorar>
                  <button
                    onClick={() => {
                      setModoDetalle("analisis");
                      setJugadoresComparados([]);
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition border ${
                      modoDetalle === "analisis"
                        ? "bg-emerald-500 text-white border-emerald-500"
                        : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <IconoVoley
                      tipo="dashboard"
                      size={14}
                      className={
                        modoDetalle === "analisis"
                          ? "text-white"
                          : "text-slate-400"
                      }
                    />
                    Análisis
                  </button>
                  <button
                    onClick={() => setModoDetalle("comparar-jugadores")}
                    className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition border ${
                      modoDetalle === "comparar-jugadores"
                        ? "bg-emerald-500 text-white border-emerald-500"
                        : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <IconoVoley
                      tipo="comparar"
                      size={14}
                      className={
                        modoDetalle === "comparar-jugadores"
                          ? "text-white"
                          : "text-slate-400"
                      }
                    />
                    Comparar jugadores ({jugadoresComparados.length}/3)
                  </button>
                  <button
                    onClick={() => setModoDetalle("crudas")}
                    className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition border ${
                      modoDetalle === "crudas"
                        ? "bg-emerald-500 text-white border-emerald-500"
                        : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <IconoVoley
                      tipo="crudas"
                      size={14}
                      className={
                        modoDetalle === "crudas"
                          ? "text-white"
                          : "text-slate-400"
                      }
                    />
                    Estadísticas crudas
                  </button>
                </div>

                <div
                  className="rounded-2xl p-3 sm:p-5"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(22,14,24,0.95) 0%, rgba(15,29,53,0.92) 100%)",
                    border: "1px solid rgba(229,62,77,0.3)",
                    boxShadow:
                      "0 8px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(229,62,77,0.15)",
                  }}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <h3 className="text-lg sm:text-xl font-bold text-white break-words">
                        {nombreEquipo} vs {nombreRivalDe(partidoDetalle)}
                      </h3>
                      <p
                        className="text-sm mt-1"
                        style={{ color: "var(--sx-text-secondary)" }}
                      >
                        📅 {partidoDetalle.fecha}
                      </p>
                      <p
                        className="text-sm mt-1 font-semibold"
                        style={{ color: "#FBBF24" }}
                      >
                        {scoreDe(partidoDetalle)}
                      </p>
                      {filtroSet !== "todos" && (
                        <p
                          className="text-xs mt-2 px-2 py-1 rounded inline-block"
                          style={{
                            background: "rgba(245,158,11,0.15)",
                            color: "#FBBF24",
                            border: "1px solid rgba(245,158,11,0.35)",
                          }}
                        >
                          Filtrando solo Set {filtroSet}
                        </p>
                      )}
                    </div>
                  </div>
                  {partidoDetalle.notas && (
                    <p
                      className="text-xs mt-3 pt-3 italic"
                      style={{
                        color: "var(--sx-text-secondary)",
                        borderTop: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      &quot;{partidoDetalle.notas}&quot;
                    </p>
                  )}
                </div>

                {modoDetalle === "comparar-jugadores" && (
                  <>
                    <div
                      className="rounded-2xl p-3 sm:p-5"
                      style={cardBase}
                      data-pdf-ignorar
                    >
                      <h4 className="font-semibold text-white mb-3">
                        Elegí hasta 3 jugadores (mismo rol)
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {jugadores
                          .filter((j) =>
                            accionesDelPartido.some((a) => a.jugador_id === j.id)
                          )
                          .map((j) => {
                            const idx = jugadoresComparados.indexOf(j.id);
                            const colorComp =
                              idx !== -1 ? COLORES_COMPARACION[idx] : null;

                            let bloqueado = false;
                            if (
                              jugadoresComparados.length > 0 &&
                              idx === -1
                            ) {
                              const primerEsArm = armadores.has(
                                jugadoresComparados[0]
                              );
                              const esteEsArm = armadores.has(j.id);
                              if (primerEsArm !== esteEsArm) bloqueado = true;
                            }
                            const puedeAgregarMas =
                              jugadoresComparados.length >= 3 && idx === -1;

                            return (
                              <button
                                key={j.id}
                                onClick={() => handleToggleJugadorComparado(j.id)}
                                disabled={bloqueado || puedeAgregarMas}
                                className={`text-left px-3 py-2 rounded-lg border transition text-sm ${
                                  colorComp
                                    ? "border-2"
                                    : bloqueado || puedeAgregarMas
                                    ? "bg-white/5 text-slate-600 cursor-not-allowed opacity-50 border-white/10"
                                    : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white"
                                }`}
                                style={
                                  colorComp
                                    ? {
                                        backgroundColor: colorComp + "20",
                                        borderColor: colorComp,
                                      }
                                    : undefined
                                }
                              >
                                <div className="flex items-center gap-2">
                                  {colorComp && (
                                    <span
                                      className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                                      style={{ backgroundColor: colorComp }}
                                    >
                                      {idx + 1}
                                    </span>
                                  )}
                                  <span className="font-medium truncate text-white">
                                    {nombreDe(j.id)}
                                    {j.rol === "armador" && " (Arm)"}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                      </div>
                    </div>

                    {statsJugadoresComparados.length > 0 ? (
                      <div className="rounded-2xl p-4 sm:p-6" style={cardBase}>
                        <div className="mb-6">
                          <RadarJugador
                            series={seriesRadarJugadores}
                            esArmador={esComparacionArmador}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                          <div
                            className="rounded-2xl p-3 sm:p-4"
                            style={cardBase}
                          >
                            <GraficoSaquePorSet series={seriesSaqueJugadores} />
                          </div>

                          {!esComparacionArmador && (
                            <div
                              className="rounded-2xl p-3 sm:p-4"
                              style={cardBase}
                            >
                              <GraficoRecepcionPorSet
                                series={seriesRecepcionJugadores}
                              />
                            </div>
                          )}

                          {esComparacionArmador && (
                            <div
                              className="rounded-2xl p-3 sm:p-4"
                              style={cardBase}
                            >
                              <GraficoArmadosPorSet
                                series={seriesArmadosJugadores}
                              />
                            </div>
                          )}

                          <div
                            className={`rounded-2xl p-3 sm:p-4 ${
                              esComparacionArmador ? "" : "md:col-span-2"
                            }`}
                            style={cardBase}
                          >
                            <GraficoBloqueoPorSet
                              series={seriesBloqueoJugadores}
                            />
                          </div>
                        </div>

                        <div className="mt-6 overflow-x-auto">
                          <table className="w-full text-sm min-w-[500px]">
                            <thead>
                              <tr
                                className="text-left"
                                style={{
                                  color: "var(--sx-text-secondary)",
                                  borderBottom: "1px solid var(--sx-border)",
                                }}
                              >
                                <th className="py-2 px-3">Jugador</th>
                                <th className="py-2 px-3 text-right">Acciones</th>
                                <th className="py-2 px-3 text-right">Puntos</th>
                                <th className="py-2 px-3 text-right">Errores</th>
                                <th className="py-2 px-3 text-right">Saldo</th>
                              </tr>
                            </thead>
                            <tbody>
                              {statsJugadoresComparados
                                .filter((s) => s.est)
                                .map((s) => (
                                  <tr
                                    key={s.id}
                                    style={{
                                      borderBottom:
                                        "1px solid rgba(255,255,255,0.04)",
                                    }}
                                  >
                                    <td className="py-2 px-3 font-medium">
                                      <span
                                        className="inline-block w-3 h-3 rounded-full mr-2 align-middle"
                                        style={{ backgroundColor: s.color }}
                                      />
                                      <span className="text-white">
                                        {s.nombre}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 text-right text-slate-300 font-mono tabular-nums">
                                      {s.est!.totalAcciones}
                                    </td>
                                    <td className="py-2 px-3 text-right text-emerald-400 font-mono tabular-nums">
                                      {s.est!.totalPuntos}
                                    </td>
                                    <td className="py-2 px-3 text-right text-rose-400 font-mono tabular-nums">
                                      {s.est!.totalErrores}
                                    </td>
                                    <td
                                      className={`py-2 px-3 text-right font-semibold tabular-nums ${
                                        s.est!.saldoTotal > 0
                                          ? "text-emerald-400"
                                          : s.est!.saldoTotal < 0
                                          ? "text-rose-400"
                                          : "text-slate-400"
                                      }`}
                                    >
                                      {s.est!.saldoTotal > 0 ? "+" : ""}
                                      {s.est!.saldoTotal}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="rounded-2xl p-8 sm:p-12 text-center"
                        style={cardBase}
                      >
                        <p className="text-4xl mb-3">👆</p>
                        <p
                          className="font-medium"
                          style={{ color: "var(--sx-text-primary)" }}
                        >
                          Elegí jugadores arriba para ver la comparación
                        </p>
                      </div>
                    )}
                  </>
                )}

                {modoDetalle === "crudas" && (
                  <div
                    className="rounded-2xl p-3 sm:p-6"
                    style={cardBase}
                  >
                    <TablaEstadisticasCrudas
                      acciones={accionesDelPartido}
                      jugadoresIds={idsJugadores}
                      nombresJugadores={nombresJugadoresMap}
                      armadores={armadores}
                      contexto={`Solo este partido · vs ${nombreRivalDe(
                        partidoDetalle
                      )} · ${partidoDetalle.fecha}${
                        filtroSet !== "todos"
                          ? ` · Set ${filtroSet}`
                          : ""
                      }`}
                    />
                  </div>
                )}

                {modoDetalle === "analisis" && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                      <div
                        className="rounded-2xl p-3 sm:p-4 text-center"
                        style={cardBase}
                      >
                        <p
                          className="text-xs uppercase tracking-wider font-semibold"
                          style={{ color: "var(--sx-text-secondary)" }}
                        >
                          Acciones
                        </p>
                        <p className="text-xl sm:text-2xl font-black text-white">
                          {statsPartido.totales.totalAcciones}
                        </p>
                      </div>
                      <div
                        className="rounded-2xl p-3 sm:p-4 text-center"
                        style={{
                          background: "rgba(16,185,129,0.1)",
                          border: "1px solid rgba(16,185,129,0.3)",
                        }}
                      >
                        <p
                          className="text-xs uppercase tracking-wider font-semibold"
                          style={{ color: "#34D399" }}
                        >
                          Puntos
                        </p>
                        <p className="text-xl sm:text-2xl font-black text-emerald-400">
                          {statsPartido.totales.totalPuntos}
                        </p>
                      </div>
                      <div
                        className="rounded-2xl p-3 sm:p-4 text-center"
                        style={{
                          background: "rgba(229,62,77,0.1)",
                          border: "1px solid rgba(229,62,77,0.3)",
                        }}
                      >
                        <p
                          className="text-xs uppercase tracking-wider font-semibold"
                          style={{ color: "#F87171" }}
                        >
                          Errores
                        </p>
                        <p className="text-xl sm:text-2xl font-black text-rose-400">
                          {statsPartido.totales.totalErrores}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                      <div
                        className="rounded-2xl p-2 col-span-1"
                        style={cardBase}
                      >
                        <RadarEquipo equipo={statsPartido.totales} />
                      </div>
                      {FUNDAMENTOS_BARRAS.map((f) => (
                        <GraficoBarrasFundamentoPartidos
                          key={f}
                          fundamento={f}
                          acciones={accionesDelPartido}
                        />
                      ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                      <div className="rounded-2xl p-3 sm:p-5" style={cardBase}>
                        <GraficoRecepcionEquipoPorSet
                          promedios={promediosRecepcionEquipo}
                        />
                      </div>
                      <div className="rounded-2xl p-3 sm:p-5" style={cardBase}>
                        <GraficoTortaRival
                          erroresRivales={datosRivalPartido.errores}
                          buenasRivales={datosRivalPartido.buenas}
                        />
                      </div>
                    </div>

                    <TablaJugadoresPorSet
                      jugadoresIds={jugadores.map((j) => j.id)}
                      nombresJugadores={Object.fromEntries(
                        jugadores.map((j) => [j.id, nombreDe(j.id)])
                      )}
                      acciones={accionesDelPartido}
                      armadores={armadores}
                      statsEquipoTotales={statsPartido.totales}
                    />

                    <div
                      className="rounded-2xl p-3 sm:p-5 overflow-x-auto"
                      style={cardBase}
                    >
                      <h4 className="font-semibold text-white mb-3">
                        Por fundamento (equipo)
                      </h4>
                      <table className="w-full text-sm min-w-[600px] border-collapse">
                        <thead>
                          <tr
                            className="text-left text-[11px] font-bold uppercase tracking-wider"
                            style={{
                              color: "var(--sx-text-secondary)",
                              borderBottom: "1px solid rgba(255,255,255,0.08)",
                            }}
                          >
                            <th className="py-2.5 px-3">Fundamento</th>
                            <th className="py-2.5 px-3 text-right">Total</th>
                            <th
                              className="py-2.5 px-3 text-right"
                              style={{ color: "#34D399" }}
                            >
                              Pos
                            </th>
                            <th
                              className="py-2.5 px-3 text-right"
                              style={{ color: "#F87171" }}
                            >
                              Neg
                            </th>
                            <th className="py-2.5 px-3 text-right">Puntos</th>
                            <th className="py-2.5 px-3 text-right">Errores</th>
                            <th className="py-2.5 px-3 text-right">Saldo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {FUNDAMENTOS.map((f) => {
                            const e = statsPartido.totales.porFundamento[f];
                            if (!e || e.total === 0) return null;
                            return (
                              <tr
                                key={f}
                                style={{
                                  borderBottom:
                                    "1px solid rgba(255,255,255,0.04)",
                                }}
                              >
                                <td className="py-2.5 px-3 font-bold text-white">
                                  {NOMBRES[f]}
                                </td>
                                <td className="py-2.5 px-3 text-right text-slate-200 font-mono tabular-nums">
                                  {e.total}
                                </td>
                                <td
                                  className="py-2.5 px-3 text-right font-mono tabular-nums font-bold"
                                  style={{ color: "#34D399" }}
                                >
                                  {e.positivos}
                                </td>
                                <td
                                  className="py-2.5 px-3 text-right font-mono tabular-nums font-bold"
                                  style={{ color: "#F87171" }}
                                >
                                  {e.negativos}
                                </td>
                                <td className="py-2.5 px-3 text-right text-slate-200 font-mono tabular-nums">
                                  {e.puntos}
                                </td>
                                <td className="py-2.5 px-3 text-right text-slate-200 font-mono tabular-nums">
                                  {e.errores}
                                </td>
                                <td
                                  className={`py-2.5 px-3 text-right font-black tabular-nums ${
                                    e.saldo > 0
                                      ? "text-emerald-400"
                                      : e.saldo < 0
                                      ? "text-rose-400"
                                      : "text-slate-400"
                                  }`}
                                >
                                  {e.saldo > 0 ? "+" : ""}
                                  {e.saldo}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {crudasEnPDF && (
                      <div
                        className="rounded-2xl p-3 sm:p-6"
                        style={cardBase}
                      >
                        <TablaEstadisticasCrudas
                          acciones={accionesDelPartido}
                          jugadoresIds={idsJugadores}
                          nombresJugadores={nombresJugadoresMap}
                          armadores={armadores}
                          contexto={`Solo este partido · vs ${nombreRivalDe(
                            partidoDetalle
                          )} · ${partidoDetalle.fecha}${
                            filtroSet !== "todos"
                              ? ` · Set ${filtroSet}`
                              : ""
                          }`}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}