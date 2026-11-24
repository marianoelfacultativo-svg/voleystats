"use client";

// ============================================================
// CONSULTA PANEL LLM — Buscador limpio: "Consulta detallada"
// ============================================================
// v3.1 (v49.5) — Feedback del usuario
//
// Además del flujo background + Realtime, ahora cada resultado
// (OK o error) tiene un botón "¿No era lo que esperabas?" que
// abre un textarea para que el usuario escriba qué esperaba ver.
// Se guarda en `consultas.feedback_texto`.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Search,
  Sparkles,
  X,
  ArrowRight,
  Loader2,
  Clock,
  MessageSquare,
} from "lucide-react";
import ConsultaResultado from "./analisisConsecuencias/ConsultaResultado";
import { supabase } from "@/lib/supabase";
import type { ResultadoConsultaLLM } from "@/lib/consultaAnalitica/ejecutarConsultaLLM";
import type { ResultadoConsultaExtendido } from "@/lib/consultaAnalitica/tipos";
import { BLOQUE_TRIGGER_VACIO } from "@/lib/analisis/tipos";
import { intencionVacia } from "@/lib/consultaAnalitica/intenciones";

// ------------------------------------------------------------
// TIPOS
// ------------------------------------------------------------

interface Props {
  equipoId: string;
  partidoId?: string | null;
  nombreDeJugador?: (id: string) => string;
  titulo?: string;
}

type RespuestaPOST =
  | { tipo: "pendiente"; consultaId: string }
  | { tipo: "error"; mensaje: string };

interface ConsultaFila {
  id: string;
  estado: "pendiente" | "procesando" | "completada" | "fallida";
  respuesta: ResultadoConsultaLLM | null;
  error_tecnico: string | null;
  intentos: number;
}

const TIMEOUT_MS = 5 * 60 * 1000;
const POLLING_MS = 3000;
const REALTIME_FALLBACK_MS = 8000;

// ------------------------------------------------------------
// SUGERENCIAS
// ------------------------------------------------------------

function obtenerSugerencias(partidoId?: string | null): string[] {
  if (partidoId) {
    return [
      "kill % por jugador",
      "aces y saques positivos",
      "puntos ganados en k1",
      "errores de saque por set",
      "errores de bloqueo",
      "defensas positivas por jugador",
      "distribución de ataques por zona",
      "efectividad en side-out",
    ];
  }
  return [
    "kill % por jugador",
    "aces en total",
    "efectividad en sets ganados vs perdidos",
    "cómo atacan en k1",
    "ranking de jugadores por puntos",
    "errores de bloqueo por jugador",
    "porcentaje de recepciones perfectas",
    "defensas de toque vs remate",
  ];
}

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

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

function filaAError(
  fila: ConsultaFila,
  prompt: string
): ResultadoConsultaLLM {
  return {
    tipo: "error",
    mensaje:
      "No pude interpretar la consulta. Probá reformularla o hacela más específica.",
    errorTecnico: fila.error_tecnico ?? "Error desconocido",
    promptOriginal: prompt,
    intentos: fila.intentos ?? 0,
    pipelineIntentos: [],
  };
}

function claveStorage(equipoId: string, partidoId?: string | null): string {
  return `consultaEnCurso_${equipoId}${partidoId ? `_${partidoId}` : ""}`;
}

// ------------------------------------------------------------
// FEEDBACK FORM
// ------------------------------------------------------------

function FeedbackForm({
  consultaId,
  tipo,
}: {
  consultaId: string;
  tipo: "ok" | "error";
}) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (enviado) {
    return (
      <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/[0.06] p-2.5 text-[11px] text-emerald-200">
        ✓ Gracias, guardamos tu comentario para mejorar el buscador.
      </div>
    );
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-cyan-300 underline underline-offset-2 transition-colors"
      >
        <MessageSquare size={11} />
        {tipo === "ok"
          ? "¿No era lo que esperabas?"
          : "¿Qué querías ver en vez de esto?"}
      </button>
    );
  }

  const enviar = async () => {
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch(`/api/consultas/${consultaId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: t }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "No se pudo guardar.");
        setEnviando(false);
        return;
      }
      setEnviado(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red.");
      setEnviando(false);
    }
  };

  return (
    <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/[0.04] p-3 space-y-2">
      <p className="text-[11px] font-semibold text-cyan-100">
        {tipo === "ok"
          ? "¿Qué esperabas ver en vez de esto?"
          : "¿Qué querías que apareciera?"}
      </p>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        disabled={enviando}
        placeholder={
          tipo === "ok"
            ? "Ej: quería el detalle por jugador, no el total."
            : "Ej: quería ver los errores agrupados por fundamento."
        }
        rows={3}
        maxLength={2000}
        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 resize-none disabled:opacity-50"
      />
      {error && <p className="text-[11px] text-rose-300">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setAbierto(false);
            setTexto("");
            setError(null);
          }}
          disabled={enviando}
          className="text-[11px] px-2.5 py-1 rounded border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void enviar()}
          disabled={!texto.trim() || enviando}
          className="text-[11px] px-2.5 py-1 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        >
          {enviando ? (
            <>
              <Loader2 size={11} className="animate-spin" />
              Enviando...
            </>
          ) : (
            "Enviar comentario"
          )}
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// COMPONENTE
// ------------------------------------------------------------

export default function ConsultaPanelLLM({
  equipoId,
  partidoId = null,
  nombreDeJugador,
  titulo = "Consulta detallada",
}: Props) {
  const [prompt, setPrompt] = useState("");
  const [cargando, setCargando] = useState(false);
  const [estadoFila, setEstadoFila] = useState<
    "pendiente" | "procesando" | null
  >(null);
  const [resultado, setResultado] = useState<ResultadoConsultaLLM | null>(null);
  const [consultaId, setConsultaId] = useState<string | null>(null);
  const [lastConsultaId, setLastConsultaId] = useState<string | null>(null);

  const canalRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const realtimeFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const promptRef = useRef<string>("");

  const hayDatos = !!equipoId;
  const sugerencias = obtenerSugerencias(partidoId);

  const limpiarSuscripcion = useCallback(() => {
    if (canalRef.current) {
      supabase.removeChannel(canalRef.current);
      canalRef.current = null;
    }
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (realtimeFallbackRef.current) {
      clearTimeout(realtimeFallbackRef.current);
      realtimeFallbackRef.current = null;
    }
  }, []);

  const aplicarFila = useCallback(
    (fila: ConsultaFila, promptUsado: string) => {
      if (fila.estado === "pendiente" || fila.estado === "procesando") {
        setEstadoFila(fila.estado);
        return false;
      }

      // Terminal: guardamos el id para que el FeedbackForm sepa
      // a qué consulta atarse.
      setLastConsultaId(fila.id);

      if (fila.estado === "completada" && fila.respuesta) {
        setResultado(fila.respuesta);
      } else if (fila.estado === "fallida") {
        setResultado(filaAError(fila, promptUsado));
      } else {
        setResultado({
          tipo: "error",
          mensaje: "La consulta terminó en un estado inesperado.",
          errorTecnico: `Estado: ${fila.estado}`,
          promptOriginal: promptUsado,
          intentos: fila.intentos ?? 0,
          pipelineIntentos: [],
        });
      }

      setCargando(false);
      setEstadoFila(null);
      setConsultaId(null);
      limpiarSuscripcion();
      try {
        localStorage.removeItem(claveStorage(equipoId, partidoId));
      } catch {
        // ignore
      }
      return true;
    },
    [equipoId, partidoId, limpiarSuscripcion]
  );

  const fetchFila = useCallback(
    async (id: string): Promise<ConsultaFila | null> => {
      const { data, error } = await supabase
        .from("consultas")
        .select("id, estado, respuesta, error_tecnico, intentos")
        .eq("id", id)
        .single();
      if (error || !data) return null;
      return data as ConsultaFila;
    },
    []
  );

  const suscribirse = useCallback(
    (id: string, promptUsado: string) => {
      limpiarSuscripcion();
      setConsultaId(id);
      setCargando(true);
      setEstadoFila("pendiente");
      promptRef.current = promptUsado;

      try {
        localStorage.setItem(
          claveStorage(equipoId, partidoId),
          JSON.stringify({ id, prompt: promptUsado })
        );
      } catch {
        // ignore
      }

      const canal = supabase
        .channel(`consulta-${id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "consultas",
            filter: `id=eq.${id}`,
          },
          (payload) => {
            const fila = payload.new as ConsultaFila;
            aplicarFila(fila, promptRef.current);
          }
        )
        .subscribe();
      canalRef.current = canal;

      realtimeFallbackRef.current = setTimeout(() => {
        if (!pollingRef.current) {
          pollingRef.current = setInterval(async () => {
            const fila = await fetchFila(id);
            if (!fila) return;
            if (
              fila.estado === "completada" ||
              fila.estado === "fallida"
            ) {
              aplicarFila(fila, promptRef.current);
            }
          }, POLLING_MS);
        }
      }, REALTIME_FALLBACK_MS);

      void (async () => {
        const fila = await fetchFila(id);
        if (!fila) return;
        if (fila.estado === "completada" || fila.estado === "fallida") {
          aplicarFila(fila, promptRef.current);
        }
      })();

      timeoutRef.current = setTimeout(() => {
        if (!cargandoRef.current) return;
        limpiarSuscripcion();
        setCargando(false);
        setEstadoFila(null);
        setConsultaId(null);
        setLastConsultaId(id);
        setResultado({
          tipo: "error",
          mensaje:
            "La consulta tardó demasiado y no se completó a tiempo. Probá de nuevo o reformulala. (Quedó guardada en el panel de consultas.)",
          errorTecnico: `Timeout ${TIMEOUT_MS}ms en cliente. Consulta ${id} sigue en Supabase.`,
          promptOriginal: promptUsado,
          intentos: 0,
          pipelineIntentos: [],
        });
      }, TIMEOUT_MS);
    },
    [aplicarFila, fetchFila, limpiarSuscripcion, equipoId, partidoId]
  );

  const cargandoRef = useRef(cargando);
  useEffect(() => {
    cargandoRef.current = cargando;
  }, [cargando]);

  useEffect(() => {
    if (!hayDatos) return;
    let cancelado = false;

    const recuperar = async () => {
      let id: string | null = null;
      let promptGuardado = "";
      try {
        const raw = localStorage.getItem(claveStorage(equipoId, partidoId));
        if (raw) {
          const parsed = JSON.parse(raw) as { id: string; prompt: string };
          id = parsed.id;
          promptGuardado = parsed.prompt ?? "";
        }
      } catch {
        // ignore
      }
      if (!id) return;

      const fila = await fetchFila(id);
      if (cancelado || !fila) {
        if (!fila) {
          try {
            localStorage.removeItem(claveStorage(equipoId, partidoId));
          } catch {
            // ignore
          }
        }
        return;
      }

      if (fila.estado === "completada" || fila.estado === "fallida") {
        promptRef.current = promptGuardado;
        aplicarFila(fila, promptGuardado);
      } else {
        setPrompt(promptGuardado);
        suscribirse(id, promptGuardado);
      }
    };
    void recuperar();

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipoId, partidoId, hayDatos]);

  useEffect(() => {
    return () => {
      limpiarSuscripcion();
    };
  }, [limpiarSuscripcion]);

  const consultar = async (textoAEnviar?: string) => {
    const texto = (textoAEnviar ?? prompt).trim();
    if (!texto || cargando || !hayDatos) return;

    if (textoAEnviar && textoAEnviar !== prompt) {
      setPrompt(textoAEnviar);
    }

    limpiarSuscripcion();
    setResultado(null);
    setLastConsultaId(null);
    setCargando(true);
    setEstadoFila("pendiente");

    try {
      const res = await fetch("/api/consultar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: texto, equipoId, partidoId }),
      });
      const data: RespuestaPOST = await res.json();

      if (data.tipo === "error") {
        setCargando(false);
        setEstadoFila(null);
        setResultado({
          tipo: "error",
          mensaje: data.mensaje,
          errorTecnico: data.mensaje,
          promptOriginal: texto,
          intentos: 0,
          pipelineIntentos: [],
        });
        return;
      }

      suscribirse(data.consultaId, texto);
    } catch (e) {
      setCargando(false);
      setEstadoFila(null);
      setResultado({
        tipo: "error",
        mensaje: `Error de red al consultar: ${
          e instanceof Error ? e.message : "desconocido"
        }`,
        errorTecnico:
          e instanceof Error ? e.stack ?? e.message : "desconocido",
        promptOriginal: texto,
        intentos: 0,
        pipelineIntentos: [],
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void consultar();
    }
  };

  const limpiar = () => {
    limpiarSuscripcion();
    setPrompt("");
    setResultado(null);
    setCargando(false);
    setEstadoFila(null);
    setConsultaId(null);
    setLastConsultaId(null);
    try {
      localStorage.removeItem(claveStorage(equipoId, partidoId));
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-3">
      {/* HEADER */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
            <Search size={15} />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
              {titulo}
            </h3>
            <p className="text-[11px] text-slate-400">
              Consultá estadísticas, rendimiento o secuencias tácticas en
              lenguaje natural.
            </p>
          </div>
        </div>
      </div>

      {/* INPUT */}
      <div className="relative flex items-center w-full rounded-xl bg-slate-900/90 border border-slate-700/60 hover:border-cyan-500/40 focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-500/20 transition-all shadow-inner">
        <Search
          size={16}
          className="text-slate-400 ml-3.5 mr-2 shrink-0 pointer-events-none"
        />
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!hayDatos || cargando}
          placeholder={
            hayDatos
              ? "Ej: kill % por jugador, efectividad en K1, errores de saque por set..."
              : "Cargando datos del equipo..."
          }
          className="w-full bg-transparent text-white text-xs sm:text-sm py-2.5 pr-28 outline-none placeholder:text-slate-500 disabled:opacity-50"
        />

        <div className="absolute right-1.5 flex items-center gap-1.5">
          {prompt && !cargando && (
            <button
              type="button"
              onClick={limpiar}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition"
              title="Limpiar"
            >
              <X size={14} />
            </button>
          )}

          <button
            type="button"
            onClick={() => void consultar()}
            disabled={!hayDatos || !prompt.trim() || cargando}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shadow-sm ${
              hayDatos && prompt.trim() && !cargando
                ? "bg-cyan-500 hover:bg-cyan-400 text-slate-950 active:scale-95"
                : "bg-white/5 text-slate-500 cursor-not-allowed border border-white/5"
            }`}
          >
            {cargando ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span className="hidden sm:inline">Buscando...</span>
              </>
            ) : (
              <>
                <span>Buscar</span>
                <ArrowRight size={13} />
              </>
            )}
          </button>
        </div>
      </div>

      {/* SUGERENCIAS */}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <span className="text-[11px] text-slate-400 font-medium mr-1 flex items-center gap-1">
          <Sparkles size={11} className="text-cyan-400/80" />
          Sugerencias:
        </span>
        {sugerencias.slice(0, 5).map((sug, i) => (
          <button
            key={`${sug}-${i}`}
            type="button"
            onClick={() => void consultar(sug)}
            disabled={!hayDatos || cargando}
            className="text-[11px] px-2.5 py-0.5 rounded-full border border-slate-700/50 bg-slate-800/40 text-slate-300 hover:text-cyan-200 hover:border-cyan-500/40 hover:bg-cyan-500/10 transition-colors disabled:opacity-40"
          >
            {sug}
          </button>
        ))}
      </div>

      {/* LOADING */}
      {cargando && (
        <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/[0.05] p-3 flex items-center gap-3">
          <Loader2
            size={16}
            className="animate-spin text-cyan-400 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-cyan-100 font-semibold">
              {estadoFila === "pendiente"
                ? "Consulta en cola..."
                : "Procesando consulta..."}
            </p>
            <p className="text-[11px] text-cyan-200/70 mt-0.5 flex items-center gap-1.5">
              <Clock size={11} />
              {estadoFila === "pendiente"
                ? "El servidor la tomó y la está procesando."
                : "Consultas complejas pueden tardar hasta 5 minutos. Podés navegar mientras tanto."}
            </p>
          </div>
          {consultaId && (
            <span className="text-[10px] text-cyan-300/60 font-mono shrink-0 hidden sm:inline">
              #{consultaId.slice(0, 8)}
            </span>
          )}
        </div>
      )}

      {/* RESULTADO OK */}
      {resultado && resultado.tipo === "ok" && (
        <div className="space-y-3 pt-1">
          {resultado.avisos.length > 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 space-y-0.5">
              <p className="text-[11px] font-bold text-amber-200">
                Avisos del análisis
              </p>
              {resultado.avisos.map((a, i) => (
                <p key={i} className="text-[11px] text-amber-100">
                  • {a}
                </p>
              ))}
            </div>
          )}

          <ConsultaResultado
            resultado={aResultadoExtendido(resultado)}
            nombreDeJugador={nombreDeJugador}
          />

          {lastConsultaId && (
            <FeedbackForm
              key={lastConsultaId}
              consultaId={lastConsultaId}
              tipo="ok"
            />
          )}

          {resultado.debug && (
            <div className="flex justify-end pt-1">
              <details
                data-pdf-ignorar
                className="text-[10px] text-slate-500"
              >
                <summary className="cursor-pointer hover:text-slate-400 select-none">
                  Detalles técnicos ({resultado.debug.accionesFiltradas}/
                  {resultado.debug.accionesUniverso} filas)
                </summary>
                <div className="mt-2 p-2 rounded-lg bg-slate-950/60 border border-white/5 space-y-1">
                  <pre className="p-2 rounded bg-slate-900 border border-white/5 font-mono text-[9px] text-cyan-200/80 overflow-x-auto max-h-40">
                    {JSON.stringify(resultado.debug.consultaLLM, null, 2)}
                  </pre>
                </div>
              </details>
            </div>
          )}
        </div>
      )}

      {/* RESULTADO ACLARACIÓN */}
      {resultado && resultado.tipo === "clarification" && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/[0.08] p-3 space-y-1.5">
          <p className="text-xs font-bold text-amber-200">
            Aclaración necesaria
          </p>
          <p className="text-xs text-amber-100">{resultado.pregunta}</p>
          <p className="text-[11px] text-amber-200/70 italic">
            Reformulá tu consulta con más detalle (ej: qué fundamento, qué set
            o qué jugador).
          </p>
        </div>
      )}

      {/* RESULTADO AMBIGUO */}
      {resultado && resultado.tipo === "ambiguo" && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/[0.08] p-3 space-y-2">
          <p className="text-xs font-bold text-rose-200">
            Múltiples jugadores coinciden
          </p>
          <p className="text-xs text-rose-100">{resultado.aviso}</p>
          <div className="flex flex-wrap gap-1">
            {resultado.candidatos.map((j) => (
              <span
                key={j.id}
                className="text-[10px] px-2 py-0.5 rounded border border-rose-500/40 bg-rose-500/10 text-rose-200 font-mono"
              >
                {j.nombre}
                {j.apodo ? ` "${j.apodo}"` : ""}
                {j.numero != null ? ` #${j.numero}` : ""}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-rose-200/70 italic">
            Probá escribiendo el nombre completo, su apodo o #número de
            camiseta.
          </p>
        </div>
      )}

      {/* RESULTADO ERROR */}
      {resultado && resultado.tipo === "error" && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/[0.08] p-3.5 space-y-2">
          <p className="text-xs font-bold text-rose-200">
            No pude interpretar la consulta
          </p>
          <p className="text-xs text-rose-100 font-mono bg-rose-950/40 p-2 rounded border border-rose-500/20">
            {resultado.mensaje}
          </p>
          <div className="text-[11px] text-slate-300 space-y-1">
            <p className="font-semibold text-rose-200/90">
              Sugerencias para consultar:
            </p>
            <ul className="list-disc list-inside text-[11px] text-slate-400 space-y-0.5">
              <li>
                Indicá la acción: saque, recepción, ataque, bloqueo, defensa o
                armado.
              </li>
              <li>
                Aclará si buscás puntos ganados (desenlace) o calidad
                (positivo/negativo).
              </li>
              <li>
                Si preguntás por un jugador, usá su nombre, apodo o número (#).
              </li>
              <li>Probá con una de las sugerencias rápidas arriba.</li>
            </ul>
          </div>
          {resultado.promptOriginal && (
            <p className="text-[10px] text-slate-500 italic border-t border-white/5 pt-1.5">
              Consulta enviada: &quot;{resultado.promptOriginal}&quot;
            </p>
          )}

          {lastConsultaId && (
            <FeedbackForm
              key={lastConsultaId}
              consultaId={lastConsultaId}
              tipo="error"
            />
          )}
        </div>
      )}
    </div>
  );
}