"use client";

// ============================================================
// CONSULTA PANEL LLM — UI del flujo Groq → motor
// ============================================================
// Reemplaza al `ConsultaPanel` viejo (parser de diccionarios).
// Llama a `/api/consultar` en el server, que:
//   1. Carga Supabase.
//   2. Traduce el prompt con Groq.
//   3. Ejecuta la consulta con el motor.
//   4. Devuelve `ResultadoConsultaLLM`.
//
// El render reutiliza `ConsultaResultado` (mapeando a
// `ResultadoConsultaExtendido`), así no duplicamos UI de tablas,
// gráficos, etc.
//
// `partidoId` opcional:
//   · null/undefined → consulta sobre TODOS los partidos del equipo.
//   · string         → consulta sobre ESE partido.
// ============================================================

import { useState } from "react";
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
// EJEMPLOS CONTEXTUALES (para chips debajo del input)
// ------------------------------------------------------------

function obtenerEjemplosContextuales(partidoId?: string | null): string[] {
  if (partidoId) {
    return [
      "cuántos puntos ganamos en k1",
      "kill % por jugador",
      "distribución de ataques por zona destino",
      "cuántos aces y saques positivos",
      "errores de saque por set",
      "efectividad en side-out",
      "puntos por rotación",
      "promedio de puntaje de recepción",
    ];
  }
  return [
    "efectividad en sets ganados vs sets perdidos",
    "cómo atacan en k1 en general",
    "ranking de jugadores por puntos",
    "distribución de errores por rotación",
    "porcentaje de recepciones perfectas por jugador",
    "cuántos aces en total",
    "promedio de ataques por partido",
    "kill % del punta 1",
  ];
}

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

/**
 * El motor devuelve `ResultadoConsultaLLM` (con `respuesta`, `meta`,
 * `debug`). `ConsultaResultado` espera `ResultadoConsultaExtendido`
 * (con `parserInfo`, `accionesFiltradas`, etc.).
 *
 * Los mapeamos para reutilizar toda la UI de render.
 */
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
  titulo = "Consultas analíticas",
}: Props) {
  const [prompt, setPrompt] = useState("");
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoConsultaLLM | null>(
    null
  );

  const hayDatos = !!equipoId;

  const consultar = async () => {
    const p = prompt.trim();
    if (!p || cargando || !hayDatos) return;

    setCargando(true);
    setResultado(null);

    try {
      const res = await fetch("/api/consultar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: p, equipoId, partidoId }),
      });
      const data: ResultadoConsultaLLM = await res.json();
      setResultado(data);
    } catch (e) {
      setResultado({
        tipo: "error",
        mensaje: `Error de red al llamar a /api/consultar: ${
          e instanceof Error ? e.message : "desconocido"
        }`,
        promptOriginal: p,
      });
    } finally {
      setCargando(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
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
      {/* ============ HEADER ============ */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span className="text-base">🔎</span>
            <span>{titulo}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-cyan-400/40 bg-cyan-500/10 text-cyan-200 uppercase tracking-wider">
              LLM
            </span>
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Escribí tu pregunta en español. Groq la traduce a JSON y el
            motor calcula.
          </p>
        </div>
      </div>

      {/* ============ INPUT ============ */}
      <div
        className="rounded-lg border border-white/10 bg-white/[0.02] p-2 space-y-2"
        style={{ background: "rgba(255,255,255,0.02)" }}
      >
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!hayDatos || cargando}
          placeholder={
            hayDatos
              ? "Ej: cómo atacan en k1, cuántos ataques positivos, negativos y neutros"
              : "Falta equipoId."
          }
          rows={2}
          className="w-full bg-slate-900 text-white text-[12px] rounded px-2.5 py-1.5 border border-white/10 focus:outline-none focus:border-cyan-400/60 placeholder:text-slate-600 disabled:opacity-40 resize-none"
        />

        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1 items-center">
            {prompt && (
              <button
                onClick={limpiar}
                disabled={cargando}
                className="text-[10px] px-2 py-0.5 rounded border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-40"
              >
                ✕ Limpiar
              </button>
            )}
            <span className="text-[10px] text-slate-500 italic">
              Enter para consultar · Shift+Enter para nueva línea
            </span>
          </div>
          <button
            onClick={consultar}
            disabled={!hayDatos || !prompt.trim() || cargando}
            className={`text-xs font-bold px-3 py-1 rounded transition ${
              hayDatos && prompt.trim() && !cargando
                ? "bg-cyan-500 hover:bg-cyan-400 text-white shadow"
                : "bg-white/5 text-slate-500 cursor-not-allowed border border-white/10"
            }`}
          >
            {cargando ? "Consultando..." : "Consultar"}
          </button>
        </div>
      </div>

      {/* ============ EJEMPLOS ============ */}
      {!resultado && !cargando && (
        <div>
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">
            Ejemplos {partidoId ? "del partido" : "generales"}
          </p>
          <div className="flex flex-wrap gap-1">
            {obtenerEjemplosContextuales(partidoId).map((sug, i) => (
              <button
                key={`${sug}-${i}`}
                onClick={() => setPrompt(sug)}
                disabled={!hayDatos}
                className="text-[10px] px-2 py-0.5 rounded border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-40"
              >
                {sug}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ============ LOADING ============ */}
      {cargando && (
        <div className="flex items-center gap-2 text-[11px] text-slate-400 py-3">
          <div className="w-3 h-3 border-2 border-cyan-500/40 border-t-cyan-400 rounded-full animate-spin" />
          <span>El LLM está traduciendo tu pedido...</span>
        </div>
      )}

      {/* ============ RESULTADO: OK ============ */}
      {resultado && resultado.tipo === "ok" && (
        <div className="space-y-2">
          {resultado.avisos.length > 0 && (
            <div className="rounded border border-amber-500/40 bg-amber-500/10 p-2 space-y-0.5">
              <p className="text-[10px] font-bold text-amber-200">
                ⚠️ Avisos del motor
              </p>
              {resultado.avisos.map((a, i) => (
                <p key={i} className="text-[10px] text-amber-100">
                  · {a}
                </p>
              ))}
            </div>
          )}

          {/* D.1 — Debug JSON colapsable */}
          {resultado.debug && (
            <details
              data-pdf-ignorar
              className="rounded-lg border border-cyan-500/20 bg-slate-950/40 p-2 text-[11px] text-slate-400 group"
            >
              <summary className="cursor-pointer font-mono font-medium text-cyan-300 hover:text-cyan-200 select-none flex items-center justify-between">
                <span>
                  🔧 Debug del Pipeline ({resultado.debug.accionesFiltradas.length}/
                  {resultado.debug.accionesUniverso.length} filas ·{" "}
                  {resultado.debug.intentos} intento
                  {resultado.debug.intentos !== 1 ? "s" : ""})
                </span>
                <span className="text-[10px] text-slate-500 group-open:rotate-180 transition-transform">
                  ▼
                </span>
              </summary>
              <div className="mt-2 space-y-2">
                <div className="flex flex-wrap gap-4 text-[10px] text-slate-400 font-mono">
                  <span>
                    Filtradas:{" "}
                    <strong className="text-white">
                      {resultado.debug.accionesFiltradas.length}
                    </strong>
                  </span>
                  <span>
                    Universo:{" "}
                    <strong className="text-white">
                      {resultado.debug.accionesUniverso.length}
                    </strong>
                  </span>
                  <span>
                    Intentos:{" "}
                    <strong className="text-white">
                      {resultado.debug.intentos}
                    </strong>
                  </span>
                  {resultado.debug.tiempoMs != null && (
                    <span>
                      Tiempo:{" "}
                      <strong className="text-white">
                        {resultado.debug.tiempoMs}ms
                      </strong>
                    </span>
                  )}
                </div>
                {resultado.debug.consultaLLM && (
                  <pre className="p-2 rounded bg-slate-900 border border-white/5 font-mono text-[10px] text-cyan-200/90 overflow-x-auto">
                    {JSON.stringify(resultado.debug.consultaLLM, null, 2)}
                  </pre>
                )}
              </div>
            </details>
          )}

          <ConsultaResultado
            resultado={aResultadoExtendido(resultado)}
            nombreDeJugador={nombreDeJugador}
          />
        </div>
      )}

      {/* ============ RESULTADO: ACLARACIÓN ============ */}
      {resultado && resultado.tipo === "clarification" && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/[0.08] p-3 space-y-2">
          <p className="text-[11px] font-bold text-amber-200">
            ❓ El LLM necesita una aclaración
          </p>
          <p className="text-[12px] text-amber-100">{resultado.pregunta}</p>
          <p className="text-[10px] text-amber-200/70 italic">
            Reformulá tu pedido con más detalle (qué métrica, qué dimensión,
            qué filtro).
          </p>
        </div>
      )}

      {/* ============ RESULTADO: AMBIGUO ============ */}
      {resultado && resultado.tipo === "ambiguo" && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/[0.08] p-3 space-y-2">
          <p className="text-[11px] font-bold text-rose-200">
            ⚠️ Ambigüedad en el jugador
          </p>
          <p className="text-[12px] text-rose-100">{resultado.aviso}</p>
          <div className="flex flex-wrap gap-1">
            {resultado.candidatos.map((j) => (
              <span
                key={j.id}
                className="text-[10px] px-1.5 py-0.5 rounded border border-rose-500/40 bg-rose-500/10 text-rose-200 font-mono"
              >
                {j.nombre}
                {j.apodo ? ` "${j.apodo}"` : ""}
                {j.numero != null ? ` #${j.numero}` : ""}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-rose-200/70 italic">
            Probá con nombre completo, apodo o #número.
          </p>
        </div>
      )}

      {/* ============ RESULTADO: ERROR (D.3) ============ */}
      {resultado && resultado.tipo === "error" && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/[0.08] p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm">❌</span>
            <p className="text-[11px] font-bold text-rose-200">
              No pude interpretar la consulta
            </p>
          </div>
          <p className="text-[12px] text-rose-100 font-mono bg-rose-950/40 p-2 rounded border border-rose-500/20">
            {resultado.mensaje}
          </p>
          <div className="text-[11px] text-slate-300 space-y-1">
            <p className="font-semibold text-rose-200/90">Tips para reformular:</p>
            <ul className="list-disc list-inside text-[10px] text-slate-400 space-y-0.5">
              <li>Indicá la acción específica: saque, recepción, ataque, bloqueo, defensa o armado.</li>
              <li>Aclará si buscás puntos ganados (desenlace) o calidad (positivo/negativo).</li>
              <li>Si preguntás por un jugador, usá su nombre, apodo o número (#).</li>
              <li>Probá con preguntas más directas como &quot;cuántos aces&quot; o &quot;kill % de Mariano&quot;.</li>
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
