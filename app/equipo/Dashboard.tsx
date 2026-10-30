"use client";

import { useEffect, useRef, useState } from "react";
import {
  FileDown,
  Calendar,
  ChevronDown,
  Trophy,
  Activity,
  FileSpreadsheet,
  BarChart2,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cargarAccionesCompatibles, type AccionDB } from "@/lib/db";
import {
  calcularEstadisticasEquipo,
  rankingRecepcion,
  rankingAtaque,
  rankingBloqueo,
  rankingSaque,
  rankingDefensa,
  rankingConsistencia,
  type RankingCompletoItem,
} from "@/lib/estadisticas";
import {
  cargarAccionesUnificadas,
  type AccionVisual,
  type PuntoConAcciones,
} from "./adaptadorUnificadoV2";
import TablaEstadisticasCrudas from "./TablaEstadisticasCrudas";
import IconoVoley from "./IconoVoley";
import ConsultaPanel from "./analisisConsecuencias/ConsultaPanel";
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

const FUNDAMENTOS = ["saque", "recepcion", "ataque", "bloqueo", "defensa"];
const NOMBRES: Record<string, string> = {
  saque: "Saque",
  recepcion: "Recepción",
  ataque: "Ataque",
  bloqueo: "Bloqueo",
  defensa: "Defensa",
};

type RankingTipo =
  | "recepcion"
  | "ataque"
  | "bloqueo"
  | "saque"
  | "defensa"
  | "consistencia";

const RANKINGS: { id: RankingTipo; titulo: string }[] = [
  { id: "recepcion", titulo: "Recepción" },
  { id: "ataque", titulo: "Ataque" },
  { id: "bloqueo", titulo: "Bloqueo" },
  { id: "saque", titulo: "Saque" },
  { id: "defensa", titulo: "Defensa" },
  { id: "consistencia", titulo: "Consistencia" },
];

export default function Dashboard({ equipoId, nombreEquipo }: Props) {
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [acciones, setAcciones] = useState<AccionDB[]>([]);
  const [cargando, setCargando] = useState(true);

  // ---- Dataset extendido para el ConsultaPanel ----
  const [accionesVisuales, setAccionesVisuales] = useState<AccionVisual[]>([]);
  const [puntosCompletos, setPuntosCompletos] = useState<PuntoConAcciones[]>([]);

  const [rankingsAbiertos, setRankingsAbiertos] = useState<Set<RankingTipo>>(
    new Set()
  );

  const [descargando, setDescargando] = useState(false);
  const refPDF = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!equipoId) return;
    setCargando(true);

    Promise.all([
      supabase
        .from("partidos")
        .select(
          "id, rival, fecha, set1, set2, set3, set4, set5, equipo_id, equipo_rival_id"
        )
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
        setAccionesVisuales([]);
        setPuntosCompletos([]);
        setCargando(false);
        return;
      }

      // Carga en paralelo:
      //   - AccionDB (para los gráficos / rankings / stats del dashboard)
      //   - AccionVisual + PuntoConAcciones (para el ConsultaPanel)
      const [compatibles, unificadas] = await Promise.all([
        Promise.all(ids.map((pid) => cargarAccionesCompatibles(pid, equipoId))),
        Promise.all(ids.map((pid) => cargarAccionesUnificadas(pid, equipoId))),
      ]);

      setAcciones(compatibles.flat());
      setAccionesVisuales(unificadas.flatMap((r) => r.acciones));
      setPuntosCompletos(unificadas.flatMap((r) => r.puntos));
      setCargando(false);
    });
  }, [equipoId]);

  const toggleRanking = (id: RankingTipo) => {
    setRankingsAbiertos((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  };

  const handleDescargarPDF = async () => {
    if (!refPDF.current) return;
    setDescargando(true);
    try {
      await descargarComoPDF(
        refPDF.current,
        `dashboard-${nombreEquipo}`,
        `Dashboard · ${nombreEquipo}`
      );
    } finally {
      setDescargando(false);
    }
  };

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex items-center gap-2.5 font-medium text-sm" style={{ color: "var(--sx-text-secondary)" }}>
          <div
            className="w-4 h-4 border-2 rounded-full animate-spin"
            style={{ borderColor: "var(--sx-border-bright)", borderTopColor: "#2563EB" }}
          />
          <span>Cargando estadísticas de {nombreEquipo}...</span>
        </div>
      </div>
    );
  }

  const ultimoPartido = partidos[0];

  const nombreRivalDe = (p: Partido) => {
    if (p.equipo_rival_id === equipoId) {
      const local = equipos.find((e) => e.id === p.equipo_id);
      if (local) return local.nombre;
    }
    return p.rival;
  };

  const jugadoresDelEquipo = jugadores.filter((j) =>
    acciones.some((a) => a.jugador_id === j.id)
  );

  const armadores = new Set(
    jugadoresDelEquipo.filter((j) => j.rol === "armador").map((j) => j.id)
  );

  const statsUltimo = ultimoPartido
    ? calcularEstadisticasEquipo(
        jugadoresDelEquipo.map((j) => j.id),
        acciones.filter((a) => a.partido_id === ultimoPartido.id),
        armadores
      )
    : null;

  const { porJugador, totales } =
    jugadoresDelEquipo.length > 0
      ? calcularEstadisticasEquipo(
          jugadoresDelEquipo.map((j) => j.id),
          acciones,
          armadores
        )
      : { porJugador: {}, totales: null };

  const nombreDe = (id: string) => {
    const j = jugadores.find((x) => x.id === id);
    return j
      ? j.nombre + (j.numero !== null ? ` #${j.numero}` : "")
      : "?";
  };

  const esArmadorId = (id: string) => armadores.has(id);

  const scoreDe = (p: Partido) => {
    const sets = [p.set1, p.set2, p.set3, p.set4, p.set5].filter(Boolean);
    return sets.length > 0 ? sets.join(" · ") : "Sin score cargado";
  };

  const rankings: Record<RankingTipo, RankingCompletoItem[]> = {
    recepcion: rankingRecepcion(porJugador, acciones),
    ataque: rankingAtaque(porJugador, acciones),
    bloqueo: rankingBloqueo(porJugador, acciones),
    saque: rankingSaque(porJugador, acciones),
    defensa: rankingDefensa(porJugador, acciones),
    consistencia: rankingConsistencia(porJugador, acciones),
  };

  const nombresJugadores: Record<string, string> = {};
  for (const j of jugadoresDelEquipo) {
    nombresJugadores[j.id] =
      j.nombre + (j.numero !== null ? ` #${j.numero}` : "");
  }

  const jugadoresParaConsulta = jugadores.map((j) => ({
    id: j.id,
    nombre: j.nombre + (j.numero !== null ? ` #${j.numero}` : ""),
  }));

  const partidosParaConsulta = partidos.map((p) => ({
    id: p.id,
    nombre: `vs ${nombreRivalDe(p)} (${p.fecha})`,
    fecha: p.fecha,
  }));

  if (partidos.length === 0) {
    return (
      <div
        className="card p-8 sm:p-12 text-center max-w-lg mx-auto"
        style={{
          background: "linear-gradient(145deg, rgba(15,29,53,0.9), rgba(10,22,40,0.95))",
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
          <BarChart2 size={26} />
        </div>
        <h3 className="text-lg font-bold text-white">
          Sin partidos registrados
        </h3>
        <p className="text-sm mt-1.5" style={{ color: "var(--sx-text-secondary)" }}>
          Todavía no hay partidos cargados para <span className="text-white font-semibold">{nombreEquipo}</span>. Cuando el cuerpo técnico o analista registre el primer encuentro, aparecerán aquí las métricas de rendimiento.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ============ CONSULTAS ANALÍTICAS (arriba, fuera del PDF) ============ */}
      <section
        data-pdf-ignorar
        className="rounded-2xl p-4 sm:p-5"
        style={{
          background: "linear-gradient(135deg, rgba(8,24,40,0.95) 0%, rgba(15,29,53,0.92) 100%)",
          border: "1px solid rgba(14,165,201,0.3)",
          boxShadow:
            "0 8px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(14,165,201,0.15)",
        }}
      >
        <ConsultaPanel
          acciones={accionesVisuales}
          puntos={puntosCompletos}
          jugadores={jugadoresParaConsulta}
          partidos={partidosParaConsulta}
          nombreDeJugador={nombreDe}
        />
      </section>

      {/* Botón de exportación */}
      <div className="flex justify-end" data-pdf-ignorar>
        <button
          onClick={handleDescargarPDF}
          disabled={descargando}
          className="btn-outline flex items-center gap-2"
          style={{
            background: "rgba(15,29,53,0.8)",
            color: "var(--sx-text-primary)",
            borderColor: "var(--sx-border-bright)",
          }}
        >
          <FileDown size={14} style={{ color: "var(--sx-teal)" }} />
          <span>{descargando ? "Generando PDF..." : "Exportar Informe PDF"}</span>
        </button>
      </div>

      <div ref={refPDF} className="space-y-6">
        {/* ─── CARD ÚLTIMO PARTIDO (ESTILO ESTADIO / BROADCAST) ─── */}
        {ultimoPartido && statsUltimo && (
          <section
            className="rounded-2xl p-5 sm:p-6 transition-all"
            style={{
              background:
                "linear-gradient(135deg, rgba(22,14,24,0.95) 0%, rgba(15,29,53,0.92) 100%)",
              border: "1px solid rgba(229,62,77,0.3)",
              boxShadow:
                "0 8px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(229,62,77,0.15)",
            }}
          >
            <div
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full"
                    style={{
                      background: "rgba(229,62,77,0.18)",
                      color: "#F87171",
                      border: "1px solid rgba(229,62,77,0.35)",
                    }}
                  >
                    Último Partido
                  </span>
                  <span
                    className="text-xs font-semibold flex items-center gap-1.5"
                    style={{ color: "var(--sx-text-secondary)" }}
                  >
                    <Calendar size={13} style={{ color: "var(--sx-teal)" }} />
                    {ultimoPartido.fecha}
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2 flex-wrap">
                  <span>{nombreEquipo}</span>
                  <span
                    className="text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-md"
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      color: "var(--sx-text-secondary)",
                      border: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    VS
                  </span>
                  <span style={{ color: "#38BDF8" }}>
                    {nombreRivalDe(ultimoPartido)}
                  </span>
                </h3>
              </div>

              <div className="self-start sm:self-center">
                <span
                  className="inline-flex items-center px-4 py-2 rounded-xl text-xs sm:text-sm font-mono font-black tracking-wider"
                  style={{
                    background: "rgba(0,0,0,0.6)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "#FBBF24",
                    boxShadow: "inset 0 2px 4px rgba(0,0,0,0.5)",
                  }}
                >
                  {scoreDe(ultimoPartido)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div
                className="p-4 rounded-xl text-center"
                style={{
                  background: "rgba(14,165,201,0.08)",
                  border: "1px solid rgba(14,165,201,0.25)",
                }}
              >
                <p
                  className="text-[11px] font-bold uppercase tracking-wider"
                  style={{ color: "#38BDF8" }}
                >
                  Total Acciones
                </p>
                <p className="text-2xl sm:text-3xl font-black tabular-nums text-white mt-1">
                  {statsUltimo.totales.totalAcciones}
                </p>
              </div>

              <div
                className="p-4 rounded-xl text-center"
                style={{
                  background: "rgba(16,185,129,0.1)",
                  border: "1px solid rgba(16,185,129,0.3)",
                }}
              >
                <p
                  className="text-[11px] font-bold uppercase tracking-wider"
                  style={{ color: "#34D399" }}
                >
                  Puntos
                </p>
                <p className="text-2xl sm:text-3xl font-black tabular-nums text-emerald-400 mt-1">
                  {statsUltimo.totales.totalPuntos}
                </p>
              </div>

              <div
                className="p-4 rounded-xl text-center"
                style={{
                  background: "rgba(229,62,77,0.1)",
                  border: "1px solid rgba(229,62,77,0.3)",
                }}
              >
                <p
                  className="text-[11px] font-bold uppercase tracking-wider"
                  style={{ color: "#F87171" }}
                >
                  Errores
                </p>
                <p className="text-2xl sm:text-3xl font-black tabular-nums text-rose-400 mt-1">
                  {statsUltimo.totales.totalErrores}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ─── TOTALES ACUMULADOS ─── */}
        {totales && (
          <section className="space-y-3">
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <TrendingUp size={18} style={{ color: "var(--sx-teal)" }} />
              <span>Totales Acumulados</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
              <div
                className="p-3.5 rounded-xl"
                style={{
                  background: "var(--sx-surface-1)",
                  border: "1px solid var(--sx-border-bright)",
                }}
              >
                <p
                  className="text-[11px] font-bold uppercase tracking-wider"
                  style={{ color: "var(--sx-text-muted)" }}
                >
                  Partidos
                </p>
                <p className="text-xl sm:text-2xl font-black tabular-nums text-white mt-1">
                  {partidos.length}
                </p>
              </div>

              <div
                className="p-3.5 rounded-xl"
                style={{
                  background: "var(--sx-surface-1)",
                  border: "1px solid var(--sx-border-bright)",
                }}
              >
                <p
                  className="text-[11px] font-bold uppercase tracking-wider"
                  style={{ color: "var(--sx-text-muted)" }}
                >
                  Acciones
                </p>
                <p className="text-xl sm:text-2xl font-black tabular-nums text-white mt-1">
                  {totales.totalAcciones}
                </p>
              </div>

              <div
                className="p-3.5 rounded-xl"
                style={{
                  background: "rgba(16,185,129,0.08)",
                  border: "1px solid rgba(16,185,129,0.25)",
                }}
              >
                <p
                  className="text-[11px] font-bold uppercase tracking-wider"
                  style={{ color: "#34D399" }}
                >
                  Puntos
                </p>
                <p className="text-xl sm:text-2xl font-black tabular-nums text-emerald-400 mt-1">
                  {totales.totalPuntos}
                </p>
              </div>

              <div
                className="p-3.5 rounded-xl"
                style={{
                  background: "rgba(229,62,77,0.08)",
                  border: "1px solid rgba(229,62,77,0.25)",
                }}
              >
                <p
                  className="text-[11px] font-bold uppercase tracking-wider"
                  style={{ color: "#F87171" }}
                >
                  Errores
                </p>
                <p className="text-xl sm:text-2xl font-black tabular-nums text-rose-400 mt-1">
                  {totales.totalErrores}
                </p>
              </div>
            </div>

            {/* Tabla de Fundamentos */}
            <div
              className="rounded-2xl p-3 sm:p-5 overflow-x-auto"
              style={{
                background: "var(--sx-surface-1)",
                border: "1px solid var(--sx-border)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              }}
            >
              <table className="w-full text-sm min-w-[600px] border-collapse">
                <thead>
                  <tr
                    className="text-left text-[11px] font-bold uppercase tracking-wider"
                    style={{
                      borderBottom: "1px solid rgba(255,255,255,0.08)",
                      color: "var(--sx-text-secondary)",
                    }}
                  >
                    <th className="py-2.5 px-3">Fundamento</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                    <th className="py-2.5 px-3 text-right" style={{ color: "#34D399" }}>
                      Pos
                    </th>
                    <th className="py-2.5 px-3 text-right" style={{ color: "#F87171" }}>
                      Neg
                    </th>
                    <th className="py-2.5 px-3 text-right">Puntos</th>
                    <th className="py-2.5 px-3 text-right">Errores</th>
                    <th className="py-2.5 px-3 text-right">Saldo</th>
                    <th className="py-2.5 px-3 text-right">Efectividad</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                  {FUNDAMENTOS.map((f) => {
                    const e = totales.porFundamento[f];
                    if (!e || e.total === 0) return null;
                    return (
                      <tr
                        key={f}
                        className="hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="py-2.5 px-3 font-bold text-white">
                          {NOMBRES[f]}
                        </td>
                        <td
                          className="py-2.5 px-3 text-right tabular-nums font-semibold"
                          style={{ color: "var(--sx-text-primary)" }}
                        >
                          {e.total}
                        </td>
                        <td
                          className="py-2.5 px-3 text-right tabular-nums font-bold"
                          style={{ color: "#34D399" }}
                        >
                          {e.positivos}
                        </td>
                        <td
                          className="py-2.5 px-3 text-right tabular-nums font-bold"
                          style={{ color: "#F87171" }}
                        >
                          {e.negativos}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-slate-200 font-medium">
                          {e.puntos}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-slate-200 font-medium">
                          {e.errores}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right tabular-nums font-black ${
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
                        <td className="py-2.5 px-3 text-right tabular-nums font-bold text-white">
                          <span
                            className="inline-block px-2 py-0.5 rounded text-xs"
                            style={{
                              background:
                                e.efectividad >= 50
                                  ? "rgba(16,185,129,0.15)"
                                  : "rgba(255,255,255,0.06)",
                              color: e.efectividad >= 50 ? "#34D399" : "#F0F4FF",
                            }}
                          >
                            {e.efectividad.toFixed(0)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ─── RANKINGS DEL PLANTEL ─── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <Trophy size={18} style={{ color: "#FBBF24" }} />
                <span>Rankings de Rendimiento</span>
              </h3>
              <p className="text-xs mt-0.5" style={{ color: "var(--sx-text-secondary)" }}>
                Líderes por fundamento estadístico. Clic en cada tarjeta para desplegar el podio completo.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {RANKINGS.map((r) => {
              const items = rankings[r.id];
              const abierto = rankingsAbiertos.has(r.id);
              const top1 = items[0];

              return (
                <div
                  key={r.id}
                  className="rounded-xl overflow-hidden transition-all"
                  style={{
                    background: "var(--sx-surface-1)",
                    border: "1px solid var(--sx-border)",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                  }}
                >
                  <button
                    onClick={() => toggleRanking(r.id)}
                    className="w-full text-left p-3.5 sm:p-4 hover:bg-white/[0.03] transition flex flex-col justify-between"
                    data-pdf-acordeon
                    data-pdf-cerrado={abierto ? undefined : "true"}
                  >
                    <div className="flex items-center justify-between gap-2 w-full mb-2">
                      <div className="flex items-center gap-2">
                        <IconoVoley
                          tipo={r.id}
                          size={20}
                          className="text-[#38BDF8]"
                        />
                        <span className="font-bold text-white text-sm">
                          {r.titulo}
                        </span>
                      </div>
                      <ChevronDown
                        size={15}
                        className={`transition-transform ${
                          abierto ? "rotate-180 text-white" : "text-slate-400"
                        }`}
                      />
                    </div>

                    {top1 ? (
                      <div className="flex items-baseline justify-between gap-2 w-full pt-1">
                        <p className="text-sm font-bold text-white truncate">
                          {nombreDe(top1.jugador_id)}
                          {esArmadorId(top1.jugador_id) && (
                            <span
                              className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded"
                              style={{
                                background: "rgba(124,58,237,0.2)",
                                color: "#C4B5FD",
                                border: "1px solid rgba(124,58,237,0.4)",
                              }}
                            >
                              Armador
                            </span>
                          )}
                        </p>
                        <p
                          className="text-xs font-mono font-bold shrink-0"
                          style={{ color: "#FBBF24" }}
                        >
                          {top1.texto}
                        </p>
                      </div>
                    ) : (
                      <p
                        className="text-xs"
                        style={{ color: "var(--sx-text-muted)" }}
                      >
                        Sin datos registrados
                      </p>
                    )}
                  </button>

                  {abierto && items.length > 0 && (
                    <div
                      className="p-2 sm:p-3 overflow-x-auto"
                      style={{
                        borderTop: "1px solid rgba(255,255,255,0.08)",
                        background: "rgba(8,15,30,0.6)",
                      }}
                    >
                      <table className="w-full text-xs min-w-[380px]">
                        <thead>
                          <tr
                            className="text-left font-bold uppercase tracking-wider text-[10px]"
                            style={{ color: "var(--sx-text-secondary)" }}
                          >
                            <th className="py-1.5 px-2 w-8">#</th>
                            <th className="py-1.5 px-2">Jugador</th>
                            {r.id === "defensa" ? (
                              <>
                                <th
                                  className="py-1.5 px-2 text-right"
                                  style={{ color: "#34D399" }}
                                >
                                  Pos
                                </th>
                                <th
                                  className="py-1.5 px-2 text-right"
                                  style={{ color: "#F87171" }}
                                >
                                  Neg
                                </th>
                                <th className="py-1.5 px-2 text-right">Bal</th>
                                <th className="py-1.5 px-2 text-right">Valor</th>
                              </>
                            ) : (
                              <th className="py-1.5 px-2 text-right">
                                Rendimiento
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody
                          className="divide-y"
                          style={{ borderColor: "rgba(255,255,255,0.04)" }}
                        >
                          {items.map((it, i) => (
                            <tr
                              key={it.jugador_id}
                              className="hover:bg-white/[0.03] transition-colors"
                            >
                              <td className="py-1.5 px-2">
                                <span
                                  className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                                    i === 0
                                      ? "bg-amber-400/20 text-amber-300 border border-amber-400/50"
                                      : i === 1
                                      ? "bg-slate-300/20 text-slate-200 border border-slate-300/30"
                                      : i === 2
                                      ? "bg-amber-700/20 text-amber-200 border border-amber-700/30"
                                      : "text-slate-400"
                                  }`}
                                >
                                  {i + 1}
                                </span>
                              </td>
                              <td className="py-1.5 px-2 font-semibold text-white">
                                {nombreDe(it.jugador_id)}
                                {esArmadorId(it.jugador_id) && (
                                  <span
                                    className="ml-1 text-[10px] font-medium"
                                    style={{ color: "#C4B5FD" }}
                                  >
                                    (Armador)
                                  </span>
                                )}
                              </td>
                              {r.id === "defensa" ? (
                                <>
                                  <td
                                    className="py-1.5 px-2 text-right tabular-nums font-semibold"
                                    style={{ color: "#34D399" }}
                                  >
                                    {it.positivas ?? 0}
                                  </td>
                                  <td
                                    className="py-1.5 px-2 text-right tabular-nums font-semibold"
                                    style={{ color: "#F87171" }}
                                  >
                                    {it.negativas ?? 0}
                                  </td>
                                  <td
                                    className={`py-1.5 px-2 text-right tabular-nums font-black ${
                                      (it.balance ?? 0) > 0
                                        ? "text-emerald-400"
                                        : (it.balance ?? 0) < 0
                                        ? "text-rose-400"
                                        : "text-slate-400"
                                    }`}
                                  >
                                    {(it.balance ?? 0) > 0 ? "+" : ""}
                                    {it.balance ?? 0}
                                  </td>
                                  <td className="py-1.5 px-2 text-right tabular-nums font-bold text-white">
                                    {it.valor.toFixed(2)}
                                  </td>
                                </>
                              ) : (
                                <td
                                  className="py-1.5 px-2 text-right tabular-nums font-medium"
                                  style={{ color: "var(--sx-text-primary)" }}
                                >
                                  {it.texto}
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ─── ESTADÍSTICAS CRUDAS ─── */}
        {jugadoresDelEquipo.length > 0 && acciones.length > 0 && (
          <section className="space-y-3">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <FileSpreadsheet size={18} style={{ color: "var(--sx-teal)" }} />
                <span>Registro Detallado de Acciones</span>
              </h3>
              <p
                className="text-xs mt-0.5"
                style={{ color: "var(--sx-text-secondary)" }}
              >
                Suma acumulada de todos los partidos registrados de {nombreEquipo}.
              </p>
            </div>

            <div
              className="rounded-2xl p-3 sm:p-5"
              style={{
                background: "var(--sx-surface-1)",
                border: "1px solid var(--sx-border)",
              }}
            >
              <TablaEstadisticasCrudas
                acciones={acciones}
                jugadoresIds={jugadoresDelEquipo.map((j) => j.id)}
                nombresJugadores={nombresJugadores}
                armadores={armadores}
                contexto={`Suma de todos los partidos · ${partidos.length} partido${
                  partidos.length !== 1 ? "s" : ""
                }`}
              />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}