"use client";

// ============================================================
// CIERRE PARTIDO BANNER — banner efímero de partido cerrado
// ============================================================
//
// FASE 7.1 — DataEntry con sets y partido.
//
// Se muestra automáticamente cuando el partido se cierra
// (un equipo alcanzó los sets necesarios para ganar). Dura
// `duracionMs` (4 segundos por default, un poco más que el
// de set porque es más importante) y se oculta solo.
//
// El padre controla el estado `cerrado` y el callback
// `onDismiss`. Cuando `cerrado` pasa de null a un
// PartidoCerrado, el banner aparece y arranca el timer.
//
// El texto y el color dependen del ganador:
//   - ganador === "propio"  → verde, "✓ Partido cerrado X-Y (ganado)"
//   - ganador === "rival"   → rojo,  "✓ Partido cerrado X-Y (perdido)"
// ============================================================

import { useEffect } from "react";
import type { PartidoCerrado } from "./tiposV2";

interface Props {
  /** Partido cerrado a mostrar. null = oculto. */
  cerrado: PartidoCerrado | null;
  /** Callback que el padre usa para ocultar el banner. */
  onDismiss: () => void;
  /** Cuánto dura visible. Default: 4000 ms. */
  duracionMs?: number;
}

export default function CierrePartidoBanner({
  cerrado,
  onDismiss,
  duracionMs = 4000,
}: Props) {
  useEffect(() => {
    if (!cerrado) return;
    const timer = setTimeout(onDismiss, duracionMs);
    return () => clearTimeout(timer);
  }, [cerrado, onDismiss, duracionMs]);

  if (!cerrado) return null;

  const ganado = cerrado.ganador === "propio";

  const colorBg = ganado
    ? "bg-emerald-500/20 border-emerald-400/60"
    : "bg-rose-500/20 border-rose-400/60";

  const colorTexto = ganado ? "text-emerald-100" : "text-rose-100";

  const colorIcono = ganado ? "text-emerald-300" : "text-rose-300";

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 shadow-2xl ${colorBg}`}
    >
      <span className={`text-2xl font-bold ${colorIcono}`}>🏆</span>
      <div className="flex-1">
        <p className={`text-base font-bold ${colorTexto}`}>
          Partido cerrado
        </p>
        <p className={`text-xs ${colorTexto} opacity-80`}>
          Sets: {cerrado.setsPropios}-{cerrado.setsRivales} ·{" "}
          {ganado ? "ganado" : "perdido"}
        </p>
      </div>
      <button
        onClick={onDismiss}
        className={`text-xs opacity-60 hover:opacity-100 ${colorTexto} font-bold px-1`}
        title="Cerrar"
      >
        ×
      </button>
    </div>
  );
}