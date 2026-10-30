"use client";

// ============================================================
// PANEL DE BÚSQUEDA — Análisis de consecuencias
// ============================================================
// Buscador en lenguaje natural + parser + chips de coincidencias.
//
// v2: aplica `tipoObservadoSugerido` y `relacionObservadoSugerido`
// que devuelve el parser v3.8 cuando detecta frases del tipo
// "ataques que defiende el rival" → tipoObservado=defensa,
// relacion=rival.
//
// v3: narrow del tipo `"cualquiera"` antes de llamar a
// `etiquetaTipoDisparador` (fix build TS).
// ============================================================

import { useMemo, useState } from "react";
import {
  etiquetaLlamadaInferida,
  etiquetaResultado,
  etiquetaTipoDisparador,
  type RelacionJugadorObservado,
  type TipoDisparador,
} from "@/lib/analisisConsecuencias";
import {
  parsearBusqueda,
  type ResultadoParser,
} from "@/lib/parserBusqueda";
import type { AccionVisual } from "../adaptadorUnificadoV2";
import { CATEGORIA_COLOR } from "./constantes";
import { generarIdBloque, type ConfiguracionPanel } from "./types";

// ------------------------------------------------------------
// PROPS
// ------------------------------------------------------------

interface Props {
  acciones: AccionVisual[];
  config: ConfiguracionPanel;
  setConfig: (c: ConfiguracionPanel) => void;
  jugadoresParaDropdown: { id: string; nombre: string }[];
  partidosDisponibles?: { id: string; nombre: string }[];
}

// ------------------------------------------------------------
// COMPONENTE
// ------------------------------------------------------------

export default function PanelBusqueda({
  acciones,
  config,
  setConfig,
  jugadoresParaDropdown,
  partidosDisponibles,
}: Props) {
  const [texto, setTexto] = useState("");
  const [verDatosDelJugador, setVerDatosDelJugador] = useState(true);

  void acciones;

  const parseResult: ResultadoParser = useMemo(
    () =>
      parsearBusqueda(texto, {
        jugadores: jugadoresParaDropdown,
        partidos: partidosDisponibles,
      }),
    [texto, jugadoresParaDropdown, partidosDisponibles]
  );

  const jugadorDetectadoId = parseResult.filtro.jugadorId ?? null;

  const aplicar = () => {
    if (!parseResult.aplicado) return;

    const nuevoBloque = {
      id: generarIdBloque(),
      operador: "AND" as const,
      filtro: parseResult.filtro,
    };

    let nuevoJugadorObservadoFiltro = config.jugadorObservadoFiltro;
    if (jugadorDetectadoId && verDatosDelJugador) {
      nuevoJugadorObservadoFiltro = "mismo";
    } else if (parseResult.relacionObservadoSugerido) {
      nuevoJugadorObservadoFiltro = parseResult.relacionObservadoSugerido;
    }

    const nuevoTipoObservado =
      parseResult.tipoObservadoSugerido ?? config.tipoObservado;

    setConfig({
      ...config,
      bloques: [nuevoBloque],
      jugadorObservadoFiltro: nuevoJugadorObservadoFiltro,
      tipoObservado: nuevoTipoObservado,
    });
  };

  const limpiar = () => setTexto("");

  // v3: narrow explícito para que TS sepa que no es "cualquiera"
  const tipoObservadoSugeridoSeguro: TipoDisparador | null =
    parseResult.tipoObservadoSugerido !== null &&
    parseResult.tipoObservadoSugerido !== "cualquiera"
      ? parseResult.tipoObservadoSugerido
      : null;

  const relacionObservadoSugeridoSeguro: RelacionJugadorObservado | null =
    parseResult.relacionObservadoSugerido;

  const haySecuencia =
    tipoObservadoSugeridoSeguro !== null ||
    relacionObservadoSugeridoSeguro !== null ||
    parseResult.faseRallySugerida !== null;

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30">
          🔍 Buscar
        </span>
        <span className="text-[10px] text-slate-400">
          escribí la jugada en lenguaje natural
        </span>
      </div>

      <div className="flex gap-1.5">
        <input
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") aplicar();
          }}
          placeholder='Ej: "ataques de Juan después de errar", "ataques que defiende el rival"'
          className="flex-1 bg-slate-900 text-white text-[11px] rounded px-2.5 py-1.5 border border-white/10 focus:outline-none focus:border-slate-400 placeholder:text-slate-600"
        />
        {texto && (
          <button
            onClick={limpiar}
            className="text-[10px] px-2 py-1 rounded border border-white/10 text-slate-300 hover:text-white hover:bg-white/5"
            title="Limpiar"
          >
            ✕
          </button>
        )}
        <button
          onClick={aplicar}
          disabled={!parseResult.aplicado}
          className={`text-[10px] font-bold px-2.5 py-1 rounded border transition shrink-0 ${
            parseResult.aplicado
              ? "bg-emerald-500/20 text-emerald-200 border-emerald-400/60 hover:bg-emerald-500/30"
              : "bg-white/5 text-slate-500 border-white/10 cursor-not-allowed"
          }`}
        >
          Aplicar
        </button>
      </div>

      {parseResult.matches.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {parseResult.matches.map((m, i) => (
            <span
              key={`${m.clave}-${i}`}
              className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${CATEGORIA_COLOR[m.categoria]}`}
              title={m.fragmento}
            >
              {m.clave === "tipo"
                ? etiquetaTipoDisparador(m.valor as TipoDisparador)
                : m.clave === "resultado"
                ? etiquetaResultado(m.valor)
                : m.clave === "jugador"
                ? m.valor
                : m.clave === "contexto.cierre"
                ? `cierre ${m.valor}`
                : m.clave === "contexto.critico"
                ? "crítico"
                : m.clave === "contexto.fase"
                ? m.valor
                : m.clave === "contexto.posicion"
                ? `${m.valor} punto`
                : m.clave === "previa"
                ? `previa ${m.valor}`
                : m.clave === "top"
                ? m.valor
                : m.clave === "vs-promedio"
                ? m.valor === "por_encima"
                  ? "sobre promedio"
                  : "bajo promedio"
                : m.clave === "velocidad"
                ? `v${m.valor}`
                : m.clave === "tipo-saque"
                ? `saque ${m.valor}`
                : m.clave === "rol"
                ? `rol ${m.valor}`
                : m.clave === "racha-jugador"
                ? m.valor
                : m.clave === "llamada"
                ? `llamada: ${etiquetaLlamadaInferida(m.valor)}`
                : m.clave === "toque-segunda"
                ? `toque 2ª: ${m.valor}`
                : m.clave === "recepcion.zonaDestino"
                ? `destino Z${m.valor}`
                : m.clave === "recepcion.zonaOrigen"
                ? `origen Z${m.valor}`
                : m.clave === "recepcion.columna"
                ? `col: ${m.valor}`
                : m.clave === "secuencia.tipoObservado"
                ? `sig.: ${etiquetaTipoDisparador(
                    m.valor as TipoDisparador
                  )}`
                : m.clave === "secuencia.relacionObservado"
                ? `sujeto: ${
                    m.valor === "rival"
                      ? "rival"
                      : m.valor === "companero"
                      ? "compañero"
                      : "mismo"
                  }`
                : m.clave === "secuencia.faseRally"
                ? `fase: ${m.valor}`
                : `${m.clave}: ${m.valor}`}
            </span>
          ))}
        </div>
      )}

      {haySecuencia && (
        <div className="rounded border border-pink-500/30 bg-pink-500/10 p-2 space-y-0.5">
          <p className="text-[10px] font-bold text-pink-200">
            🎯 Secuencia detectada
          </p>
          <p className="text-[10px] text-pink-200/80">
            {tipoObservadoSugeridoSeguro && (
              <>
                Se va a mirar la siguiente{" "}
                <strong>
                  {etiquetaTipoDisparador(tipoObservadoSugeridoSeguro)}
                </strong>
                {relacionObservadoSugeridoSeguro && (
                  <>
                    {" "}
                    del{" "}
                    <strong>
                      {relacionObservadoSugeridoSeguro === "rival"
                        ? "rival"
                        : relacionObservadoSugeridoSeguro === "companero"
                        ? "compañero"
                        : "mismo jugador"}
                    </strong>
                  </>
                )}
                .
              </>
            )}
            {parseResult.faseRallySugerida && (
              <>
                {" "}
                Fase del rally sugerida:{" "}
                <strong>{parseResult.faseRallySugerida}</strong>{" "}
                <span className="text-pink-200/60 italic">
                  (no se aplica automáticamente)
                </span>
                .
              </>
            )}
          </p>
        </div>
      )}

      {parseResult.noReconocidas.length > 0 && (
        <div className="flex flex-wrap gap-1 items-center">
          <span className="text-[9px] text-amber-400">⚠️ No reconocí:</span>
          {parseResult.noReconocidas.slice(0, 8).map((w, i) => (
            <span
              key={`${w}-${i}`}
              className="text-[9px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 font-mono"
            >
              {w}
            </span>
          ))}
          {parseResult.noReconocidas.length > 8 && (
            <span className="text-[9px] text-amber-400">
              +{parseResult.noReconocidas.length - 8}
            </span>
          )}
        </div>
      )}

      {jugadorDetectadoId && (
        <label className="flex items-center gap-1.5 text-[10px] text-slate-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={verDatosDelJugador}
            onChange={(e) => setVerDatosDelJugador(e.target.checked)}
            className="w-3 h-3 accent-emerald-500"
          />
          <span>
            Ver datos del mismo jugador buscado (
            {jugadoresParaDropdown.find((j) => j.id === jugadorDetectadoId)
              ?.nombre ?? "?"}
            )
          </span>
        </label>
      )}

      {!texto && (
        <div className="flex flex-wrap gap-1">
          <span className="text-[9px] text-slate-500 italic">Ejemplos:</span>
          {parseResult.sugerencias.slice(0, 4).map((sug, i) => (
            <button
              key={`${sug}-${i}`}
              onClick={() => setTexto(sug)}
              className="text-[9px] px-1.5 py-0.5 rounded border border-white/10 text-slate-400 hover:text-white hover:bg-white/5"
            >
              {sug}
            </button>
          ))}
        </div>
      )}

      {texto && !parseResult.aplicado && (
        <div className="rounded border border-amber-500/30 bg-amber-500/10 p-2 space-y-1">
          <p className="text-[10px] font-bold text-amber-200">
            No encontrado. Reformulá o probá con:
          </p>
          <ol className="text-[10px] text-amber-200/80 list-decimal pl-4 space-y-0.5">
            {parseResult.sugerencias.slice(0, 3).map((s, i) => (
              <li key={`${s}-${i}`}>
                <button
                  onClick={() => setTexto(s)}
                  className="hover:text-white underline-offset-2 hover:underline"
                >
                  {s}
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}