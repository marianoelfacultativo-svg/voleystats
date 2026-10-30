"use client";

// ============================================================
// ANÁLISIS DE CONSECUENCIAS — Componente principal (UI v5)
// ============================================================
// Orquesta:
//   - Header con conteo A/B y botón comparar
//   - Sección A6 "Cómo suele jugar un jugador" (colapsable)
//   - Panel A (siempre)
//   - Panel B (solo en modo comparación)
//
// El estado de configuración de cada panel vive acá. Los hijos
// son presentacionales.
//
// v5.1 (FASE 5):
//   + Reexporta como exports nombrados `ConsultaPanel` y
//     `ConsultaResultado` para que se puedan importar así:
//       import { ConsultaPanel } from "@/app/equipo/analisisConsecuencias";
//   + No cambia nada del componente principal.
// ============================================================

import { useMemo, useState } from "react";
import { analizarConsecuencias } from "@/lib/analisisConsecuencias";
import type { AccionVisual } from "../adaptadorUnificadoV2";
import { cardBase, construirFiltros } from "./helpers";
import { panelInicial, type ConfiguracionPanel } from "./types";
import PanelAnalisis from "./PanelAnalisis";
import PerfilJugadorSection from "./PerfilJugadorSection";

// ------------------------------------------------------------
// PROPS
// ------------------------------------------------------------

interface Props {
  acciones: AccionVisual[];
  onIrAPunto?: (set: number, punto: number) => void;
  nombreDeJugador?: (id: string | null) => string;
  titulo?: string;
  jugadorId?: string;
  jugadoresDisponibles?: { id: string; nombre: string }[];
  partidosDisponibles?: { id: string; nombre: string }[];
}

// ------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ------------------------------------------------------------

export default function AnalisisConsecuencias({
  acciones,
  onIrAPunto,
  nombreDeJugador,
  titulo = "Análisis de consecuencias",
  jugadorId,
  jugadoresDisponibles,
  partidosDisponibles,
}: Props) {
  const [modoComparacion, setModoComparacion] = useState(false);
  const [perfilAbierto, setPerfilAbierto] = useState(false);

  const [panelA, setPanelA] = useState<ConfiguracionPanel>(() => {
    const p = panelInicial();
    if (jugadorId) {
      p.bloques[0].filtro.jugadorId = jugadorId;
      p.jugadorObservadoFiltro = "mismo";
    }
    return p;
  });

  const [panelB, setPanelB] = useState<ConfiguracionPanel>(panelInicial);

  // ----------------------------------------------------------
  // Jugadores / nombre helper
  // ----------------------------------------------------------

  const listaJugadores = useMemo(() => {
    const ids = new Set<string>();
    for (const a of acciones) if (a.jugador_id) ids.add(a.jugador_id);
    if (jugadoresDisponibles) {
      for (const j of jugadoresDisponibles) ids.add(j.id);
    }
    return Array.from(ids);
  }, [acciones, jugadoresDisponibles]);

  const nombre = (id: string | null): string => {
    if (!id) return "—";
    if (nombreDeJugador) return nombreDeJugador(id);
    const j = jugadoresDisponibles?.find((x) => x.id === id);
    if (j) return j.nombre;
    return id.slice(0, 8);
  };

  const jugadoresParaDropdown = useMemo(
    () =>
      listaJugadores
        .map((id) => ({ id, nombre: nombre(id) }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listaJugadores, nombreDeJugador, jugadoresDisponibles]
  );

  // ----------------------------------------------------------
  // Sets / puntos únicos
  // ----------------------------------------------------------

  const { setsUnicos, puntosUnicos } = useMemo(() => {
    const sets = new Set<number>();
    const puntos = new Set<number>();
    for (const a of acciones) {
      sets.add(a.set_numero);
      puntos.add(a.punto_numero);
    }
    return {
      setsUnicos: Array.from(sets).sort(),
      puntosUnicos: Array.from(puntos).sort(),
    };
  }, [acciones]);

  // ----------------------------------------------------------
  // Conteo de casos por panel
  // ----------------------------------------------------------

  const cantCasosA = useMemo(() => {
    return analizarConsecuencias(acciones, construirFiltros(panelA))
      .totalOcurrencias;
  }, [acciones, panelA]);

  const cantCasosB = useMemo(() => {
    if (!modoComparacion) return 0;
    return analizarConsecuencias(acciones, construirFiltros(panelB))
      .totalOcurrencias;
  }, [acciones, panelB, modoComparacion]);

  // ----------------------------------------------------------
  // Restablecer todo
  // ----------------------------------------------------------

  const restablecerTodo = () => {
    const baseA = panelInicial();
    if (jugadorId) {
      baseA.bloques[0].filtro.jugadorId = jugadorId;
      baseA.jugadorObservadoFiltro = "mismo";
    }
    setPanelA(baseA);
    setPanelB(panelInicial());
    setModoComparacion(false);
  };

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  return (
    <div className="space-y-3" style={cardBase}>
      {/* ====== HEADER ====== */}
      <div className="p-4 border-b border-white/10 flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-sm font-bold uppercase tracking-wider text-slate-100">
              {titulo}
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-white/10 text-slate-300 bg-white/5">
              A: {cantCasosA}
            </span>
            {modoComparacion && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-violet-500/30 text-violet-300 bg-violet-500/10">
                B: {cantCasosB}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400">
            Buscá una jugada en lenguaje natural y mirá qué pasa después.
          </p>
        </div>
        <div className="flex flex-col gap-1 items-end shrink-0">
          <button
            onClick={() => setModoComparacion((v) => !v)}
            className={`text-xs px-2.5 py-1 rounded border transition ${
              modoComparacion
                ? "bg-violet-500/20 text-violet-200 border-violet-400/60"
                : "border-white/10 text-slate-300 hover:text-white hover:bg-white/5"
            }`}
          >
            {modoComparacion ? "✕ Comparar" : "⇄ Comparar"}
          </button>
          <button
            onClick={restablecerTodo}
            className="text-xs px-2 py-1 rounded border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 transition"
            title="Restablecer todo"
          >
            ↻
          </button>
        </div>
      </div>

      {/* ====== SECCIÓN A6: CÓMO SUELE JUGAR UN JUGADOR ====== */}
      <div className="px-4 pt-3">
        <button
          onClick={() => setPerfilAbierto((v) => !v)}
          className={`w-full flex items-center justify-between text-[11px] font-bold uppercase tracking-wider px-3 py-2 rounded-lg border transition ${
            perfilAbierto
              ? "bg-amber-500/10 border-amber-500/40 text-amber-200"
              : "border-white/10 text-slate-300 hover:text-white hover:bg-white/5"
          }`}
        >
          <span className="flex items-center gap-2">
            <span>👤 Cómo suele jugar un jugador</span>
            <span className="text-[9px] font-normal text-slate-500 normal-case">
              (análisis automático por rol)
            </span>
          </span>
          <span
            className="transition-transform"
            style={{ transform: perfilAbierto ? "rotate(180deg)" : "none" }}
          >
            ▼
          </span>
        </button>

        {perfilAbierto && (
          <PerfilJugadorSection
            acciones={acciones}
            nombre={nombre}
            jugadoresParaDropdown={jugadoresParaDropdown}
            jugadorIdInicial={jugadorId}
          />
        )}
      </div>

      {/* ====== PANELES A / B ====== */}
      <div
        className={`px-4 pb-4 pt-3 ${
          modoComparacion
            ? "grid grid-cols-1 xl:grid-cols-2 gap-3"
            : "space-y-3"
        }`}
      >
        <PanelAnalisis
          acciones={acciones}
          config={panelA}
          setConfig={setPanelA}
          nombre={nombre}
          jugadoresParaDropdown={jugadoresParaDropdown}
          setsUnicos={setsUnicos}
          puntosUnicos={puntosUnicos}
          partidosDisponibles={partidosDisponibles}
          onIrAPunto={onIrAPunto}
          etiqueta="A"
          onRestablecer={() => {
            const base = panelInicial();
            if (jugadorId) {
              base.bloques[0].filtro.jugadorId = jugadorId;
              base.jugadorObservadoFiltro = "mismo";
            }
            setPanelA(base);
          }}
        />

        {modoComparacion && (
          <PanelAnalisis
            acciones={acciones}
            config={panelB}
            setConfig={setPanelB}
            nombre={nombre}
            jugadoresParaDropdown={jugadoresParaDropdown}
            setsUnicos={setsUnicos}
            puntosUnicos={puntosUnicos}
            partidosDisponibles={partidosDisponibles}
            onIrAPunto={onIrAPunto}
            etiqueta="B"
            onRestablecer={() => setPanelB(panelInicial())}
          />
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// FASE 5: reexports de los paneles de consulta analítica
// ------------------------------------------------------------
// Para que se puedan importar así desde cualquier lado:
//   import { ConsultaPanel, ConsultaResultado } from "@/app/equipo/analisisConsecuencias";
// ------------------------------------------------------------

export { default as ConsultaPanel } from "./ConsultaPanel";
export { default as ConsultaResultado } from "./ConsultaResultado";