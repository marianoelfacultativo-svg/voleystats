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
import TablaEstadisticasCrudas from "./TablaEstadisticasCrudas";
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
        setCargando(false);
        return;
      }

      const resultados = await Promise.all(
        ids.map((pid) => cargarAccionesCompatibles(pid, equipoId))
      );

      setAcciones(resultados.flat());
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
        <div className="flex items-center gap-2.5 text-slate-500 font-medium text-sm">
          <div className="w-4 h-4 border-2 border-slate-300 border-t-[#163A85] rounded-full animate-spin" />
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

  if (partidos.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 p-8 sm:p-12 text-center max-w-lg mx-auto">
        <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
          <BarChart2 size={24} />
        </div>
        <h3 className="text-slate-800 font-bold text-base">
          Sin partidos registrados
        </h3>
        <p className="text-slate-500 text-xs mt-1">
          Todavía no hay partidos cargados para {nombreEquipo}. Cuando el analista cargue el primer encuentro, aparecerán aquí las métricas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Botón de exportación */}
      <div className="flex justify-end" data-pdf-ignorar>
        <button
          onClick={handleDescargarPDF}
          disabled={descargando}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-200/90 hover:border-slate-300 rounded-xl shadow-sm transition-all disabled:opacity-50 w-full sm:w-auto"
        >
          <FileDown size={14} className="text-slate-500" />
          <span>{descargando ? "Generando PDF..." : "Exportar Informe PDF"}</span>
        </button>
      </div>

      <div ref={refPDF} className="space-y-6">
        {/* ─── CARD ÚLTIMO PARTIDO ─── */}
        {ultimoPartido && statsUltimo && (
          <section className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200/60">
                    Último Partido
                  </span>
                  <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                    <Calendar size={13} className="text-slate-400" />
                    {ultimoPartido.fecha}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
                  <span>{nombreEquipo}</span>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1.5 py-0.5 bg-slate-100 rounded">
                    vs
                  </span>
                  <span className="text-slate-700">{nombreRivalDe(ultimoPartido)}</span>
                </h3>
              </div>

              <div className="self-start sm:self-center">
                <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-700">
                  {scoreDe(ultimoPartido)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
              <div className="p-3.5 bg-slate-50/80 border border-slate-200/80 rounded-xl text-center">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Total Acciones
                </p>
                <p className="text-2xl sm:text-3xl font-black tabular-nums text-slate-800 mt-0.5">
                  {statsUltimo.totales.totalAcciones}
                </p>
              </div>

              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-center">
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                  Puntos
                </p>
                <p className="text-2xl sm:text-3xl font-black tabular-nums text-emerald-700 mt-0.5">
                  {statsUltimo.totales.totalPuntos}
                </p>
              </div>

              <div className="p-3.5 bg-rose-50/70 border border-rose-200/80 rounded-xl text-center">
                <p className="text-[11px] font-bold uppercase tracking-wider text-rose-800">
                  Errores
                </p>
                <p className="text-2xl sm:text-3xl font-black tabular-nums text-rose-700 mt-0.5">
                  {statsUltimo.totales.totalErrores}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ─── TOTALES ACUMULADOS ─── */}
        {totales && (
          <section className="space-y-3">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <TrendingUp size={17} className="text-[#163A85]" />
              <span>Totales Acumulados</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
              <div className="p-3.5 bg-white border border-slate-200/90 rounded-xl shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Partidos
                </p>
                <p className="text-xl sm:text-2xl font-black tabular-nums text-slate-900 mt-0.5">
                  {partidos.length}
                </p>
              </div>

              <div className="p-3.5 bg-white border border-slate-200/90 rounded-xl shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Acciones
                </p>
                <p className="text-xl sm:text-2xl font-black tabular-nums text-slate-900 mt-0.5">
                  {totales.totalAcciones}
                </p>
              </div>

              <div className="p-3.5 bg-emerald-50/50 border border-emerald-200/70 rounded-xl shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                  Puntos
                </p>
                <p className="text-xl sm:text-2xl font-black tabular-nums text-emerald-700 mt-0.5">
                  {totales.totalPuntos}
                </p>
              </div>

              <div className="p-3.5 bg-rose-50/50 border border-rose-200/70 rounded-xl shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-rose-800">
                  Errores
                </p>
                <p className="text-xl sm:text-2xl font-black tabular-nums text-rose-700 mt-0.5">
                  {totales.totalErrores}
                </p>
              </div>
            </div>

            {/* Tabla de Fundamentos */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 p-3 sm:p-5 overflow-x-auto">
              <table className="w-full text-sm min-w-[600px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 px-3">Fundamento</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                    <th className="py-2.5 px-3 text-right text-emerald-700">Pos</th>
                    <th className="py-2.5 px-3 text-right text-rose-700">Neg</th>
                    <th className="py-2.5 px-3 text-right">Puntos</th>
                    <th className="py-2.5 px-3 text-right">Errores</th>
                    <th className="py-2.5 px-3 text-right">Saldo</th>
                    <th className="py-2.5 px-3 text-right">Efectividad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {FUNDAMENTOS.map((f) => {
                    const e = totales.porFundamento[f];
                    if (!e || e.total === 0) return null;
                    return (
                      <tr key={f} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          {NOMBRES[f]}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-slate-600 font-medium">
                          {e.total}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-emerald-700 font-semibold">
                          {e.positivos}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-rose-700 font-semibold">
                          {e.negativos}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-slate-700 font-medium">
                          {e.puntos}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-slate-700 font-medium">
                          {e.errores}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right tabular-nums font-bold ${
                            e.saldo > 0
                              ? "text-emerald-700"
                              : e.saldo < 0
                              ? "text-rose-700"
                              : "text-slate-600"
                          }`}
                        >
                          {e.saldo > 0 ? "+" : ""}
                          {e.saldo}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-slate-800">
                          {e.efectividad.toFixed(0)}%
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
              <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Trophy size={18} className="text-amber-500" />
                <span>Rankings de Rendimiento</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Líderes por fundamento estadístico. Clic para ver desglose completo.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3">
            {RANKINGS.map((r) => {
              const items = rankings[r.id];
              const abierto = rankingsAbiertos.has(r.id);
              const top1 = items[0];

              return (
                <div
                  key={r.id}
                  className="bg-white rounded-xl shadow-sm border border-slate-200/90 overflow-hidden transition-all hover:border-slate-300"
                >
                  <button
                    onClick={() => toggleRanking(r.id)}
                    className="w-full text-left p-3.5 sm:p-4 hover:bg-slate-50/70 transition flex flex-col justify-between"
                    data-pdf-acordeon
                    data-pdf-cerrado={abierto ? undefined : "true"}
                  >
                    <div className="flex items-center justify-between gap-2 w-full mb-2">
                      <div className="flex items-center gap-2">
                        <IconoVoley
                          tipo={r.id}
                          size={20}
                          className="text-[#163A85]"
                        />
                        <span className="font-bold text-slate-800 text-sm">
                          {r.titulo}
                        </span>
                      </div>
                      <ChevronDown
                        size={15}
                        className={`text-slate-400 transition-transform ${
                          abierto ? "rotate-180 text-slate-800" : ""
                        }`}
                      />
                    </div>

                    {top1 ? (
                      <div className="flex items-baseline justify-between gap-2 w-full pt-1">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {nombreDe(top1.jugador_id)}
                          {esArmadorId(top1.jugador_id) && (
                            <span className="ml-1.5 text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200/60 px-1.5 py-0.5 rounded">
                              Armador
                            </span>
                          )}
                        </p>
                        <p className="text-xs font-mono font-medium text-slate-500 shrink-0">
                          {top1.texto}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">Sin datos registrados</p>
                    )}
                  </button>

                  {abierto && items.length > 0 && (
                    <div className="border-t border-slate-100 bg-slate-50/60 p-2 sm:p-3 overflow-x-auto">
                      <table className="w-full text-xs min-w-[380px]">
                        <thead>
                          <tr className="text-left text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                            <th className="py-1.5 px-2 w-8">#</th>
                            <th className="py-1.5 px-2">Jugador</th>
                            {r.id === "defensa" ? (
                              <>
                                <th className="py-1.5 px-2 text-right">Pos</th>
                                <th className="py-1.5 px-2 text-right">Neg</th>
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
                        <tbody className="divide-y divide-slate-100">
                          {items.map((it, i) => (
                            <tr
                              key={it.jugador_id}
                              className="hover:bg-white/80 transition-colors"
                            >
                              <td className="py-1.5 px-2">
                                <span
                                  className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                                    i === 0
                                      ? "bg-amber-100 text-amber-800 border border-amber-300"
                                      : i === 1
                                      ? "bg-slate-200 text-slate-700"
                                      : i === 2
                                      ? "bg-amber-900/15 text-amber-900"
                                      : "text-slate-400"
                                  }`}
                                >
                                  {i + 1}
                                </span>
                              </td>
                              <td className="py-1.5 px-2 font-medium text-slate-800">
                                {nombreDe(it.jugador_id)}
                                {esArmadorId(it.jugador_id) && (
                                  <span className="ml-1 text-[10px] text-violet-600 font-medium">
                                    (Armador)
                                  </span>
                                )}
                              </td>
                              {r.id === "defensa" ? (
                                <>
                                  <td className="py-1.5 px-2 text-right tabular-nums text-emerald-700 font-medium">
                                    {it.positivas ?? 0}
                                  </td>
                                  <td className="py-1.5 px-2 text-right tabular-nums text-rose-700 font-medium">
                                    {it.negativas ?? 0}
                                  </td>
                                  <td
                                    className={`py-1.5 px-2 text-right tabular-nums font-bold ${
                                      (it.balance ?? 0) > 0
                                        ? "text-emerald-700"
                                        : (it.balance ?? 0) < 0
                                        ? "text-rose-700"
                                        : "text-slate-500"
                                    }`}
                                  >
                                    {(it.balance ?? 0) > 0 ? "+" : ""}
                                    {it.balance ?? 0}
                                  </td>
                                  <td className="py-1.5 px-2 text-right tabular-nums font-bold text-slate-900">
                                    {it.valor.toFixed(2)}
                                  </td>
                                </>
                              ) : (
                                <td className="py-1.5 px-2 text-right tabular-nums font-medium text-slate-700">
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
              <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <FileSpreadsheet size={18} className="text-slate-600" />
                <span>Registro Detallado de Acciones</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Suma acumulada de todos los partidos registrados de {nombreEquipo}.
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 p-3 sm:p-5">
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
