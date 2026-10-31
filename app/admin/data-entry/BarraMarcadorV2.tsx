"use client";

// ============================================================
// BARRA MARCADOR V2 — marcador + navegación de sets y puntos
// ============================================================
//
// v2.1 (corrección FASE 7.1 — tie-break en BO3):
//   + El badge "TB" ahora aparece en BO3 set 3 y en BO5 set 5,
//     usando el helper `esTieBreak` de tiposV2.
//   + Se importa `maxSetsDeFormato` en lugar de calcularlo a mano.
//
// v2 (FASE 7.1 — DataEntry con sets y partido):
//   + Muestra los sets ganados por cada equipo al lado del
//     marcador del set activo.
//   + Chips de sets (S1, S2, S3, ...) con estado visual:
//       · activo     → azul
//       · ganado     → verde
//       · perdido    → rojo
//       · no empezó  → gris
//   + Flechas ◀ ▶ para navegar entre sets.
//   + Si el set activo está cerrado, muestra un cartel de
//     "🔒 Set cerrado" y oculta la navegación de puntos
//     (hay que reabrirlo primero).
// ============================================================

import type { FormatoPartido, SetsCerrados } from "./tiposV2";
import { esTieBreak, maxSetsDeFormato } from "./tiposV2";

interface Props {
  // ---------- Equipos ----------
  nombreMiEquipo: string;
  nombreRival: string;

  // ---------- Marcador del set activo ----------
  setActivo: number;
  marcador: { propio: number; rival: number };

  // ---------- Sets (FASE 7.1) ----------
  setsPropios: number;
  setsRivales: number;
  setsCerrados: SetsCerrados;
  formatoPartido: FormatoPartido;
  onIrSet: (n: number) => void;
  /** ¿El set activo está cerrado? */
  setCerrado: boolean;

  // ---------- Navegación de puntos (existente) ----------
  visibleNavegacion: boolean;
  puntoActual: number;
  puntoActualCerrado: boolean;
  saqueInicial: "propio" | "rival";
  lineasVisibles: number;
  circuloArmado: boolean;
  circuloSinArmar: boolean;
  puedeIrAnterior: boolean;
  puedeIrSiguiente: boolean;
  onIrPunto: (n: number) => void;
}

export default function BarraMarcadorV2({
  nombreMiEquipo,
  nombreRival,
  setActivo,
  marcador,
  setsPropios,
  setsRivales,
  setsCerrados,
  formatoPartido,
  onIrSet,
  setCerrado,
  visibleNavegacion,
  puntoActual,
  puntoActualCerrado,
  saqueInicial,
  lineasVisibles,
  circuloArmado,
  circuloSinArmar,
  puedeIrAnterior,
  puedeIrSiguiente,
  onIrPunto,
}: Props) {
  const maxSets = maxSetsDeFormato(formatoPartido);
  const sets = Array.from({ length: maxSets }, (_, i) => i + 1);
  const setEsTieBreak = esTieBreak(formatoPartido, setActivo);

  const puedeIrSetAnterior = setActivo > 1;
  const puedeIrSetSiguiente = setActivo < maxSets;

  return (
    <>
      {/* ============================================ */}
      {/* MARCADOR PRINCIPAL CON SETS GANADOS            */}
      {/* ============================================ */}
      <div className="flex items-center justify-center gap-6 bg-[#0F1D35] text-white border border-white/10 rounded-2xl px-6 py-3 shadow-lg">
        {/* Mi equipo */}
        <div className="text-center">
          <p className="text-[10px] font-semibold text-slate-400 uppercase">
            {nombreMiEquipo}
          </p>
          <p className="text-3xl font-bold tabular-nums text-white">
            {marcador.propio}
          </p>
          <p className="text-[10px] text-emerald-300 font-semibold tabular-nums">
            Sets: {setsPropios}
          </p>
        </div>

        {/* Set activo */}
        <div className="text-center">
          <p className="text-[10px] font-semibold text-slate-400 uppercase">
            SET
          </p>
          <p className="text-xl font-bold tabular-nums text-amber-400">
            {setActivo}
            {setEsTieBreak && (
              <span className="text-[9px] text-amber-300 ml-0.5">TB</span>
            )}
          </p>
          <p className="text-[10px] text-slate-400 font-semibold tabular-nums">
            {setsPropios}-{setsRivales}
          </p>
        </div>

        {/* Rival */}
        <div className="text-center">
          <p className="text-[10px] font-semibold text-slate-400 uppercase">
            {nombreRival}
          </p>
          <p className="text-3xl font-bold tabular-nums text-white">
            {marcador.rival}
          </p>
          <p className="text-[10px] text-rose-300 font-semibold tabular-nums">
            Sets: {setsRivales}
          </p>
        </div>
      </div>

      {/* ============================================ */}
      {/* NAVEGACIÓN ENTRE SETS (chips + flechas)       */}
      {/* ============================================ */}
      <div className="flex items-center justify-center gap-2 bg-[#0F1D35] border border-white/10 rounded-xl px-3 py-2 shadow-sm">
        <button
          onClick={() => puedeIrSetAnterior && onIrSet(setActivo - 1)}
          disabled={!puedeIrSetAnterior}
          className="w-7 h-7 flex items-center justify-center rounded border border-white/15 hover:bg-white/10 text-slate-200 disabled:opacity-30"
          title="Set anterior"
        >
          ◀
        </button>

        <div className="flex gap-1">
          {sets.map((n) => {
            const cerrado = setsCerrados[n];
            const activo = n === setActivo;
            const tb = esTieBreak(formatoPartido, n);
            let cls =
              "px-3 py-1 text-xs font-bold rounded border transition ";
            let title = `Set ${n}${tb ? " (tie-break a 15)" : ""}`;

            if (activo) {
              cls +=
                "bg-blue-500 text-white border-blue-400 shadow ring-2 ring-blue-400/40";
            } else if (cerrado) {
              if (cerrado.ganador === "propio") {
                cls +=
                  "bg-emerald-500/30 text-emerald-200 border-emerald-500/50 hover:bg-emerald-500/40";
                title += ` · ${cerrado.puntosPropios}-${cerrado.puntosRivales} (ganado)`;
              } else {
                cls +=
                  "bg-rose-500/30 text-rose-200 border-rose-500/50 hover:bg-rose-500/40";
                title += ` · ${cerrado.puntosPropios}-${cerrado.puntosRivales} (perdido)`;
              }
            } else {
              cls +=
                "bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-white";
            }

            return (
              <button
                key={n}
                onClick={() => onIrSet(n)}
                className={cls}
                title={title}
              >
                S{n}
                {tb && (
                  <span className="ml-0.5 text-[8px] opacity-70">TB</span>
                )}
                {cerrado && !activo && (
                  <span className="ml-1 text-[9px]">✓</span>
                )}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => puedeIrSetSiguiente && onIrSet(setActivo + 1)}
          disabled={!puedeIrSetSiguiente}
          className="w-7 h-7 flex items-center justify-center rounded border border-white/15 hover:bg-white/10 text-slate-200 disabled:opacity-30"
          title="Set siguiente"
        >
          ▶
        </button>
      </div>

      {/* ============================================ */}
      {/* CARTEL: SET CERRADO (bloquea navegación)      */}
      {/* ============================================ */}
      {setCerrado && (
        <div className="flex items-center justify-between gap-2 bg-amber-950/40 border border-amber-500/40 rounded-xl px-4 py-2">
          <span className="text-sm text-amber-200">
            🔒 <strong>Set {setActivo}</strong> cerrado
            {setsCerrados[setActivo] && (
              <span className="ml-1 text-xs text-amber-300">
                ({setsCerrados[setActivo].puntosPropios}-
                {setsCerrados[setActivo].puntosRivales},{" "}
                {setsCerrados[setActivo].ganador === "propio"
                  ? "ganado"
                  : "perdido"}
                )
              </span>
            )}
          </span>
          <span className="text-[10px] text-amber-400 italic">
            Para editarlo, usá "Reabrir set"
          </span>
        </div>
      )}

      {/* ============================================ */}
      {/* NAVEGACIÓN DE PUNTOS (solo si el set está    */}
      {/* en curso)                                     */}
      {/* ============================================ */}
      {visibleNavegacion && !setCerrado && (
        <div className="flex items-center justify-between text-sm text-slate-200 bg-[#0F1D35] border border-white/10 rounded-xl px-4 py-2 shadow-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onIrPunto(puntoActual - 1)}
              disabled={!puedeIrAnterior}
              className="w-7 h-7 flex items-center justify-center rounded border border-white/15 hover:bg-white/10 text-slate-200 disabled:opacity-30"
            >
              ◀
            </button>
            <span>
              <strong>Set {setActivo}</strong> · Punto{" "}
              <strong>{puntoActual}</strong>
              {puntoActualCerrado && (
                <span className="ml-1 text-emerald-400 text-xs font-semibold">
                  ✓ cerrado
                </span>
              )}
              {" · "}Saca:{" "}
              <strong className="text-blue-300">
                {saqueInicial === "propio" ? nombreMiEquipo : nombreRival}
              </strong>
            </span>
            <button
              onClick={() => onIrPunto(puntoActual + 1)}
              disabled={!puedeIrSiguiente}
              className="w-7 h-7 flex items-center justify-center rounded border border-white/15 hover:bg-white/10 text-slate-200 disabled:opacity-30"
            >
              ▶
            </button>
          </div>
          <span className="text-xs text-slate-400">
            {lineasVisibles} línea{lineasVisibles !== 1 ? "s" : ""}
            {circuloArmado
              ? " · armado (naranja)"
              : circuloSinArmar
              ? " · click en el círculo"
              : ""}
          </span>
        </div>
      )}
    </>
  );
}