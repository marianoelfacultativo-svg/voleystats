"use client";

// ============================================================
// CIERRE SET BANNER — banner efímero de set cerrado
// ============================================================
//
// FASE 7.1 — DataEntry con sets y partido.
//
// Se muestra automáticamente cuando un set se cierra
// (detección automática de fin de set). Dura `duracionMs`
// (3 segundos por default) y se oculta solo.
//
// El padre controla el estado `cerrado` y el callback
// `onDismiss`. Cuando `cerrado` pasa de null a un SetCerrado,
// el banner aparece y arranca el timer. Cuando el padre
// llama a `onDismiss` (o el timer expira), vuelve a null
// y el banner se oculta.
//
// El texto y el color dependen del ganador:
//   - ganador === "propio"  → verde, "✓ Set N cerrado X-Y (ganado)"
//   - ganador === "rival"   → rojo,  "✓ Set N cerrado X-Y (perdido)"
// ============================================================

import { useEffect } from "react";
import type { SetCerrado } from "./tiposV2";

interface Props {
  /** Set cerrado a mostrar. null = oculto. */
  cerrado: SetCerrado | null;
  /** Callback que el padre usa para ocultar el banner. */
  onDismiss: () => void;
  /** Cuánto dura visible. Default: 3000 ms. */
  duracionMs?: number;
}

export default function CierreSetBanner({
  cerrado,
  onDismiss,
  duracionMs = 3000,
}: Props) {
  useEffect(() => {
    if (!cerrado) return;
    const timer = setTimeout(onDismiss, duracionMs);
    return () => clearTimeout(timer);
  }, [cerrado, onDismiss, duracionMs]);

  if (!cerrado) return null;

  const ganado = cerrado.ganador === "propio";

  const colorBg = ganado
    ? "bg-emerald-500/15 border-emerald-500/50"
    : "bg-rose-500/15 border-rose-500/50";

  const colorTexto = ganado ? "text-emerald-200" : "text-rose-200";

  const colorIcono = ganado ? "text-emerald-400" : "text-rose-400";

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 shadow-lg ${colorBg}`}
    >
      <span className={`text-lg font-bold ${colorIcono}`}>✓</span>
      <div className="flex-1">
        <p className={`text-sm font-bold ${colorTexto}`}>
          Set {cerrado.numero} cerrado
        </p>
        <p className={`text-[11px] ${colorTexto} opacity-80`}>
          {cerrado.puntosPropios}-{cerrado.puntosRivales} ·{" "}
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