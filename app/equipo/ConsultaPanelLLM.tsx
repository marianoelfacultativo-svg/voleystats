"use client";

// ============================================================
// CONSULTA PANEL LLM — Buscador limpio: "Consulta detallada"
// ============================================================
// Interfaz unificada de consulta en lenguaje natural para VoleyStats.
// Llama a /api/consultar (Groq -> pipelineEngine) y muestra los
// resultados a través de ConsultaResultado (tarjetas, tablas, rankings).
// ============================================================

import { useState } from "react";
import { Search, Sparkles, X, ArrowRight, Loader2 } from "lucide-react";
import ConsultaResultado from "./analisisConsecuencias/ConsultaResultado";
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

// ------------------------------------------------------------
// EJEMPLOS SUGERIDOS
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
  const [resultado, setResultado] = useState<ResultadoConsultaLLM | null>(null);

  const hayDatos = !!equipoId;
  const sugerencias = obtenerSugerencias(partidoId);

  const consultar = async (textoAEnviar?: string) => {
    const texto = (textoAEnviar ?? prompt).trim();
    if (!texto || cargando || !hayDatos) return;

    if (textoAEnviar && textoAEnviar !== prompt) {
      setPrompt(textoAEnviar);
    }

    setCargando(true);
    setResultado(null);

    try {
      const res = await fetch("/api/consultar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: texto, equipoId, partidoId }),
      });
      const data: ResultadoConsultaLLM = await res.json();
      setResultado(data);
    } catch (e) {
      setResultado({
        tipo: "error",
        mensaje: `Error de red al consultar: ${
          e instanceof Error ? e.message : "desconocido"
        }`,
        promptOriginal: texto,
      });
    } finally {
      setCargando(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void consultar();
    }
  };

  const limpiar = () => {
    setPrompt("");
    setResultado(null);
  };

  return (
    <div className="space-y-3">
      {/* ============ HEADER LIMPIO ============ */}
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
              Consultá estadísticas, rendimiento o secuencias tácticas en lenguaje natural.
            </p>
          </div>
        </div>
      </div>

      {/* ============ BUSCADOR LIMPIO ============ */}
      <div className="relative flex items-center w-full rounded-xl bg-slate-900/90 border border-slate-700/60 hover:border-cyan-500/40 focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-500/20 transition-all shadow-inner">
        <Search size={16} className="text-slate-400 ml-3.5 mr-2 shrink-0 pointer-events-none" />
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

      {/* ============ CHIPS DE SUGERENCIAS ============ */}
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

      {/* ============ LOADING ============ */}
      {cargando && (
        <div className="flex items-center gap-2 text-xs text-cyan-300 py-3 px-1">
          <Loader2 size={15} className="animate-spin text-cyan-400 shrink-0" />
          <span>Analizando jugadas y calculando estadísticas...</span>
        </div>
      )}

      {/* ============ RESULTADO: OK ============ */}
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

          {/* Detalles técnicos discretos */}
          {resultado.debug && (
            <div className="flex justify-end pt-1">
              <details
                data-pdf-ignorar
                className="text-[10px] text-slate-500"
              >
                <summary className="cursor-pointer hover:text-slate-400 select-none">
                  Detalles técnicos ({resultado.debug.accionesFiltradas}/{resultado.debug.accionesUniverso} filas)
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

      {/* ============ RESULTADO: ACLARACIÓN ============ */}
      {resultado && resultado.tipo === "clarification" && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/[0.08] p-3 space-y-1.5">
          <p className="text-xs font-bold text-amber-200">
            Aclaración necesaria
          </p>
          <p className="text-xs text-amber-100">{resultado.pregunta}</p>
          <p className="text-[11px] text-amber-200/70 italic">
            Reformulá tu consulta con más detalle (ej: qué fundamento, qué set o qué jugador).
          </p>
        </div>
      )}

      {/* ============ RESULTADO: AMBIGUO ============ */}
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
            Probá escribiendo el nombre completo, su apodo o #número de camiseta.
          </p>
        </div>
      )}

      {/* ============ RESULTADO: ERROR ============ */}
      {resultado && resultado.tipo === "error" && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/[0.08] p-3.5 space-y-2">
          <p className="text-xs font-bold text-rose-200">
            No pude interpretar la consulta
          </p>
          <p className="text-xs text-rose-100 font-mono bg-rose-950/40 p-2 rounded border border-rose-500/20">
            {resultado.mensaje}
          </p>
          <div className="text-[11px] text-slate-300 space-y-1">
            <p className="font-semibold text-rose-200/90">Sugerencias para consultar:</p>
            <ul className="list-disc list-inside text-[11px] text-slate-400 space-y-0.5">
              <li>Indicá la acción: saque, recepción, ataque, bloqueo, defensa o armado.</li>
              <li>Aclará si buscás puntos ganados (desenlace) o calidad (positivo/negativo).</li>
              <li>Si preguntás por un jugador, usá su nombre, apodo o número (#).</li>
              <li>Probá con una de las sugerencias rápidas arriba.</li>
            </ul>
          </div>
          {resultado.promptOriginal && (
            <p className="text-[10px] text-slate-500 italic border-t border-white/5 pt-1.5">
              Consulta enviada: &quot;{resultado.promptOriginal}&quot;
            </p>
          )}
        </div>
      )}
    </div>
  );
}
