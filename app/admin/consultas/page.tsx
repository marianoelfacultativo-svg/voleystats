// ============================================================
// ADMIN — CONSULTAS (historial completo + feedbacks)
// ============================================================
// v49.5 — Muestra el feedback que los usuarios dejan en cada
// consulta ("No era lo que esperaba"). Filtro "Con feedback"
// para revisar patrones y mejorar el SYSTEM_PROMPT.
// ============================================================

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import ConsultaResultado from "@/app/equipo/analisisConsecuencias/ConsultaResultado";
import type { ResultadoConsultaLLM } from "@/lib/consultaAnalitica/ejecutarConsultaLLM";
import type { ResultadoConsultaExtendido } from "@/lib/consultaAnalitica/tipos";
import { BLOQUE_TRIGGER_VACIO } from "@/lib/analisis/tipos";
import { intencionVacia } from "@/lib/consultaAnalitica/intenciones";

type EstadoConsulta = "pendiente" | "procesando" | "completada" | "fallida";

type Consulta = {
  id: string;
  equipo_id: string | null;
  partido_id: string | null;
  prompt: string;
  estado: EstadoConsulta;
  pipeline: Record<string, unknown> | null;
  respuesta: ResultadoConsultaLLM | null;
  error_tecnico: string | null;
  intentos: number | null;
  fecha_creacion: string;
  fecha_completado: string | null;
  feedback_texto: string | null;
  feedback_fecha: string | null;
};

type Filtro = "todas" | "con_feedback" | "completadas" | "fallidas" | "en_curso";

const LIMITE = 200;
const POLLING_MS = 5000;

function aResultadoExtendido(
  data: Extract<ResultadoConsultaLLM, { tipo: "ok" }>
): ResultadoConsultaExtendido {
  return {
    respuesta: data.respuesta,
    meta: data.meta,
    fragmentos: data.fragmentos,
    noReconocidas: [],
    parserInfo: {
      aplicado: true,
      sugerencias: [],
      filtro: data.debug.filtroFinal ?? { ...BLOQUE_TRIGGER_VACIO },
      intencion: data.debug.intencionFinal ?? intencionVacia(),
      jugadorAmbiguo: false,
      jugadorAviso: null,
      jugadorCandidatos: [],
    },
    accionesFiltradas: data.debug.accionesFiltradas,
    accionesUniverso: data.debug.accionesUniverso,
  };
}

function duracionSegundos(
  fechaCreacion: string,
  fechaCompletado: string | null
): number | null {
  if (!fechaCompletado) return null;
  const a = new Date(fechaCreacion).getTime();
  const b = new Date(fechaCompletado).getTime();
  if (!isFinite(a) || !isFinite(b)) return null;
  return Math.round(((b - a) / 1000) * 10) / 10;
}

function badgeEstado(estado: EstadoConsulta): {
  label: string;
  clase: string;
} {
  switch (estado) {
    case "completada":
      return {
        label: "✅ completada",
        clase: "bg-emerald-500/15 text-emerald-200 border-emerald-500/40",
      };
    case "fallida":
      return {
        label: "❌ fallida",
        clase: "bg-rose-500/15 text-rose-200 border-rose-500/40",
      };
    case "procesando":
      return {
        label: "⏳ procesando",
        clase: "bg-cyan-500/15 text-cyan-200 border-cyan-500/40",
      };
    case "pendiente":
      return {
        label: "🕒 pendiente",
        clase: "bg-amber-500/15 text-amber-200 border-amber-500/40",
      };
  }
}

export default function ConsultasAdminPage() {
  const [cargando, setCargando] = useState(true);
  const [filas, setFilas] = useState<Consulta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [busqueda, setBusqueda] = useState("");
  const [expandidaId, setExpandidaId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    const { data, error } = await supabase
      .from("consultas")
      .select("*")
      .order("fecha_creacion", { ascending: false })
      .limit(LIMITE);

    if (error) {
      setError(error.message);
    } else {
      setFilas((data ?? []) as Consulta[]);
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const hayEnCurso = useMemo(
    () =>
      filas.some(
        (f) => f.estado === "pendiente" || f.estado === "procesando"
      ),
    [filas]
  );

  useEffect(() => {
    if (!hayEnCurso) return;
    const interval = setInterval(() => {
      void cargar();
    }, POLLING_MS);
    return () => clearInterval(interval);
  }, [hayEnCurso, cargar]);

  const counts = useMemo(
    () => ({
      todas: filas.length,
      con_feedback: filas.filter((f) => !!f.feedback_texto).length,
      completadas: filas.filter((f) => f.estado === "completada").length,
      fallidas: filas.filter((f) => f.estado === "fallida").length,
      en_curso: filas.filter(
        (f) => f.estado === "pendiente" || f.estado === "procesando"
      ).length,
    }),
    [filas]
  );

  const filasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return filas.filter((f) => {
      if (filtro === "con_feedback" && !f.feedback_texto) return false;
      if (filtro === "completadas" && f.estado !== "completada") return false;
      if (filtro === "fallidas" && f.estado !== "fallida") return false;
      if (
        filtro === "en_curso" &&
        f.estado !== "pendiente" &&
        f.estado !== "procesando"
      )
        return false;
      if (q && !f.prompt.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [filas, filtro, busqueda]);

  const toggle = (id: string) => {
    setExpandidaId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <h1 className="text-2xl font-bold">Consultas LLM</h1>
          <div className="flex items-center gap-2">
            <a
              href="/admin/consultas-fallidas"
              className="text-sm px-3 py-1.5 rounded bg-amber-700/70 hover:bg-amber-600 text-white"
            >
              Ver solo fallidas
            </a>
            <button
              type="button"
              onClick={() => void cargar()}
              disabled={cargando}
              className="text-sm px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50"
            >
              {cargando ? "Cargando..." : "↻ Refrescar"}
            </button>
            <a
              href="/admin"
              className="text-sm px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600"
            >
              ← Volver
            </a>
          </div>
        </div>

        <p className="text-sm text-slate-400 mb-4">
          Historial de consultas (últimas {LIMITE}). Total: {filas.length}
          {hayEnCurso && (
            <span className="ml-2 text-cyan-300">
              · Actualizando automáticamente...
            </span>
          )}
        </p>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          {(
            ["todas", "con_feedback", "completadas", "fallidas", "en_curso"] as const
          ).map((f) => {
            const activo = filtro === f;
            const label =
              f === "todas"
                ? "Todas"
                : f === "con_feedback"
                ? "💬 Con feedback"
                : f === "completadas"
                ? "Completadas"
                : f === "fallidas"
                ? "Fallidas"
                : "En curso";
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFiltro(f)}
                className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                  activo
                    ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-100 font-semibold"
                    : "bg-slate-800/50 border-slate-700/50 text-slate-300 hover:bg-slate-800"
                }`}
              >
                {label}{" "}
                <span className="text-slate-400">({counts[f]})</span>
              </button>
            );
          })}
        </div>

        <div className="mb-4">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar en el prompt..."
            className="w-full sm:w-80 bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50"
          />
        </div>

        {cargando && filas.length === 0 && (
          <p className="text-slate-400">Cargando...</p>
        )}
        {error && <p className="text-red-400">Error cargando: {error}</p>}
        {!cargando && !error && filasFiltradas.length === 0 && (
          <p className="text-slate-400">No hay consultas que coincidan.</p>
        )}

        {filasFiltradas.length > 0 && (
          <ul className="space-y-3">
            {filasFiltradas.map((f) => {
              const badge = badgeEstado(f.estado);
              const segs = duracionSegundos(
                f.fecha_creacion,
                f.fecha_completado
              );
              const expandida = expandidaId === f.id;
              const resultadoOk =
                f.respuesta && f.respuesta.tipo === "ok"
                  ? f.respuesta
                  : null;
              const resultadoAclaracion =
                f.respuesta && f.respuesta.tipo === "clarification"
                  ? f.respuesta
                  : null;
              const resultadoAmbiguo =
                f.respuesta && f.respuesta.tipo === "ambiguo"
                  ? f.respuesta
                  : null;
              const tieneFeedback = !!f.feedback_texto;

              return (
                <li
                  key={f.id}
                  className="rounded-lg bg-slate-800 border border-slate-700 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggle(f.id)}
                    className="w-full text-left p-4 hover:bg-slate-800/80 transition-colors"
                  >
                    <div className="flex justify-between items-start gap-3 mb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badge.clase}`}
                        >
                          {badge.label}
                        </span>
                        {segs !== null && (
                          <span className="text-[10px] text-slate-400 tabular-nums">
                            {segs}s
                          </span>
                        )}
                        {f.intentos !== null && f.intentos > 0 && (
                          <span className="text-[10px] text-slate-500">
                            {f.intentos} intento
                            {f.intentos !== 1 ? "s" : ""}
                          </span>
                        )}
                        {tieneFeedback && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-500/40">
                            💬 feedback
                          </span>
                        )}
                        {f.respuesta?.tipo === "clarification" && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-amber-500/15 text-amber-200 border-amber-500/40">
                            ❓ aclaración
                          </span>
                        )}
                        {f.respuesta?.tipo === "ambiguo" && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-rose-500/15 text-rose-200 border-rose-500/40">
                            ❓ ambiguo
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 tabular-nums shrink-0">
                        {new Date(f.fecha_creacion).toLocaleString("es-AR")}
                      </span>
                    </div>
                    <p className="text-slate-100 text-sm break-words font-mono">
                      {f.prompt}
                    </p>
                    {resultadoOk?.explain && (
                      <p className="text-[11px] text-cyan-300/80 italic mt-1">
                        → {resultadoOk.explain}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-500 mt-2">
                      {expandida ? "▲ Ocultar detalle" : "▼ Ver detalle"}
                    </p>
                  </button>

                  {expandida && (
                    <div className="border-t border-slate-700 p-4 space-y-3 bg-slate-900/40">
                      {/* Feedback destacado primero */}
                      {tieneFeedback && (
                        <div className="rounded-lg border border-fuchsia-500/40 bg-fuchsia-500/[0.06] p-3 space-y-1">
                          <p className="text-[11px] font-bold text-fuchsia-200">
                            💬 El usuario esperaba:
                          </p>
                          <p className="text-xs text-fuchsia-100 whitespace-pre-wrap">
                            {f.feedback_texto}
                          </p>
                          {f.feedback_fecha && (
                            <p className="text-[10px] text-fuchsia-300/60">
                              {new Date(f.feedback_fecha).toLocaleString(
                                "es-AR"
                              )}
                            </p>
                          )}
                        </div>
                      )}

                      {resultadoOk && (
                        <ConsultaResultado
                          resultado={aResultadoExtendido(resultadoOk)}
                        />
                      )}
                      {resultadoAclaracion && (
                        <div className="rounded-lg border border-amber-500/40 bg-amber-500/[0.08] p-3 space-y-2">
                          <p className="text-xs font-bold text-amber-200">
                            Aclaración solicitada al usuario
                          </p>
                          <p className="text-xs text-amber-100">
                            {resultadoAclaracion.pregunta}
                          </p>
                          {resultadoAclaracion.opciones &&
                            resultadoAclaracion.opciones.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-1">
                                <span className="text-[10px] text-amber-200/70 mr-1">
                                  Opciones:
                                </span>
                                {resultadoAclaracion.opciones.map((op, i) => (
                                  <span
                                    key={`${op}-${i}`}
                                    className="text-[10px] px-1.5 py-0.5 rounded border border-amber-500/40 bg-amber-500/10 text-amber-200 font-mono"
                                  >
                                    {op}
                                  </span>
                                ))}
                              </div>
                            )}
                        </div>
                      )}
                      {resultadoAmbiguo && (
                        <div className="rounded-lg border border-rose-500/40 bg-rose-500/[0.08] p-3 space-y-2">
                          <p className="text-xs font-bold text-rose-200">
                            Jugador ambiguo
                          </p>
                          <p className="text-xs text-rose-100">
                            {resultadoAmbiguo.aviso}
                          </p>
                        </div>
                      )}

                      {f.estado === "completada" &&
                        !resultadoOk &&
                        !resultadoAclaracion &&
                        !resultadoAmbiguo && (
                        <p className="text-xs text-amber-300">
                          La fila dice &quot;completada&quot; pero no hay
                          respuesta guardada. Revisar datos.
                        </p>
                      )}

                      {f.estado === "fallida" && (
                        <div className="space-y-2">
                          <p className="text-[11px] font-bold text-rose-200">
                            Error técnico:
                          </p>
                          <pre className="text-xs text-amber-300 font-mono bg-slate-950 p-2 rounded border border-slate-800 whitespace-pre-wrap break-words">
                            {f.error_tecnico ?? "(sin detalle)"}
                          </pre>
                          <a
                            href="/admin/consultas-fallidas"
                            className="inline-block text-[11px] px-2 py-1 rounded bg-amber-700/70 hover:bg-amber-600 text-white"
                          >
                            Ver en panel de fallidas →
                          </a>
                        </div>
                      )}

                      {(f.estado === "pendiente" ||
                        f.estado === "procesando") && (
                        <p className="text-xs text-cyan-200">
                          {f.estado === "pendiente"
                            ? "En cola — el servidor la tomó y todavía no empezó a procesar."
                            : "Procesando — el LLM está trabajando. Se actualiza automáticamente."}
                        </p>
                      )}

                      {Boolean(f.pipeline) && (
                        <details className="text-[10px] text-slate-500">
                          <summary className="cursor-pointer hover:text-slate-400 select-none">
                            Pipeline interpretado
                          </summary>
                          <pre className="mt-2 p-2 rounded bg-slate-950 border border-slate-800 font-mono text-[10px] text-cyan-200/80 overflow-x-auto max-h-60">
                            {JSON.stringify(f.pipeline, null, 2)}
                          </pre>
                        </details>
                      )}

                      <p className="text-[10px] text-slate-500 font-mono pt-2 border-t border-slate-800">
                        id: {f.id}
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}