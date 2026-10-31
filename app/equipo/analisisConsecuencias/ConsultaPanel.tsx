"use client";

// ============================================================
// CONSULTA PANEL — input + ejecutar + render
// ============================================================
// FASE 5 del plan "Consultas Analíticas Libres".
//
// v1.1 (FASE 7.4):
//   + `jugadores` acepta `apodo?` y `numero?` para que el
//     ejecutor pueda resolver apodos / apellidos / nombre de
//     pila y desambiguar.
// ============================================================

import { useMemo, useState } from "react";
import type {
  AccionVisual,
  PuntoConAcciones,
} from "../adaptadorUnificadoV2";
import {
  ejecutarConsulta,
  type ContextoEjecutor,
  type ResultadoConsultaExtendido,
} from "@/lib/consultaAnalitica/ejecutor";
import ConsultaResultado from "./ConsultaResultado";

// ------------------------------------------------------------
// PROPS
// ------------------------------------------------------------

interface Props {
  acciones: AccionVisual[];
  puntos?: PuntoConAcciones[];
  jugadores?: {
    id: string;
    nombre: string;
    apodo?: string | null;
    numero?: number | null;
  }[];
  partidos?: { id: string; nombre: string; fecha?: string }[];
  /** Nombre amigable del jugador (opcional; si no viene, usa el id). */
  nombreDeJugador?: (id: string) => string;
}

// ------------------------------------------------------------
// EJEMPLOS
// ------------------------------------------------------------

const EJEMPLOS = [
  "¿cuántos ataques erró Juan?",
  "porcentaje de recepciones perfectas por set",
  "kill % de los últimos 3 partidos",
  "distribución de ataques por zona destino",
  "evolución de puntos por set",
  "¿qué suele hacer cuando está 20-18?",
  "promedio de puntos por rotación",
  "cada cuántos saques hace un ace",
  "el jugador que más puntos hizo",
  "recepción % por ubicación",
  "top 5 mejores atacantes por kill %",
  "¿cuántas defensas por cambio?",
];

// ------------------------------------------------------------
// COMPONENTE
// ------------------------------------------------------------

export default function ConsultaPanel({
  acciones,
  puntos,
  jugadores,
  partidos,
  nombreDeJugador,
}: Props) {
  const [texto, setTexto] = useState("");
  const [resultado, setResultado] =
    useState<ResultadoConsultaExtendido | null>(null);

  const hayDatos = acciones.length > 0;

  const totalAcciones = useMemo(
    () => acciones.filter((a) => !a.oculta).length,
    [acciones]
  );
  const totalPuntos = useMemo(() => puntos?.length ?? 0, [puntos]);

  const handleConsultar = () => {
    const consulta = texto.trim();
    if (!consulta) return;

    const contexto: ContextoEjecutor = {
      acciones,
      puntos,
      jugadores,
      partidos,
    };

    const res = ejecutarConsulta(consulta, contexto);
    setResultado(res);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleConsultar();
    }
  };

  const handleEjemplo = (sug: string) => {
    setTexto(sug);
  };

  return (
    <div className="space-y-3">
      {/* ============ HEADER ============ */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span className="text-base">🔎</span>
            <span>Consultas analíticas</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-cyan-400/40 bg-cyan-500/10 text-cyan-200 uppercase tracking-wider">
              beta
            </span>
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Escribí tu pregunta en lenguaje natural. Ej:{" "}
            <em>&ldquo;¿cuántos ataques erró Juan en los últimos 3 partidos?&rdquo;</em>
          </p>
        </div>
        <p className="text-[10px] text-slate-500 tabular-nums">
          {totalAcciones} acciones
          {totalPuntos > 0 && ` · ${totalPuntos} puntos`}
        </p>
      </div>

      {/* ============ INPUT ============ */}
      <div
        className="rounded-lg border border-white/10 bg-white/[0.02] p-2 space-y-2"
        style={{
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!hayDatos}
          placeholder={
            hayDatos
              ? "Ej: porcentaje de recepciones perfectas por set esta temporada"
              : "Cargá acciones primero para consultar."
          }
          rows={2}
          className="w-full bg-slate-900 text-white text-[12px] rounded px-2.5 py-1.5 border border-white/10 focus:outline-none focus:border-cyan-400/60 placeholder:text-slate-600 disabled:opacity-40 resize-none"
        />

        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            {texto && (
              <button
                onClick={() => {
                  setTexto("");
                  setResultado(null);
                }}
                className="text-[10px] px-2 py-0.5 rounded border border-white/10 text-slate-400 hover:text-white hover:bg-white/5"
              >
                ✕ Limpiar
              </button>
            )}
            <span className="text-[10px] text-slate-500 italic">
              Enter para consultar · Shift+Enter para salto de línea
            </span>
          </div>
          <button
            onClick={handleConsultar}
            disabled={!hayDatos || !texto.trim()}
            className={`text-xs font-bold px-3 py-1 rounded transition ${
              hayDatos && texto.trim()
                ? "bg-cyan-500 hover:bg-cyan-400 text-white shadow"
                : "bg-white/5 text-slate-500 cursor-not-allowed border border-white/10"
            }`}
          >
            Consultar
          </button>
        </div>
      </div>

      {/* ============ EJEMPLOS ============ */}
      {!resultado && (
        <div>
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">
            Ejemplos
          </p>
          <div className="flex flex-wrap gap-1">
            {EJEMPLOS.map((sug, i) => (
              <button
                key={`${sug}-${i}`}
                onClick={() => handleEjemplo(sug)}
                disabled={!hayDatos}
                className="text-[10px] px-2 py-0.5 rounded border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-40"
              >
                {sug}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ============ RESULTADO ============ */}
      {resultado && (
        <ConsultaResultado
          resultado={resultado}
          nombreDeJugador={nombreDeJugador}
        />
      )}
    </div>
  );
}