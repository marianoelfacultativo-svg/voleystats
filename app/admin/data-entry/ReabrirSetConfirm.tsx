"use client";

// ============================================================
// REABRIR SET CONFIRM — modal de confirmación para reabrir
// ============================================================
//
// FASE 7.1 — DataEntry con sets y partido.
//
// Cuando el usuario quiere editar un set que ya está cerrado,
// primero tiene que reabrirlo. Este modal explica las
// consecuencias y pide confirmación.
//
// Consecuencias de reabrir:
//   - El set vuelve a estado "activo" (editable).
//   - El set se marca como "no cerrado" (deja de contar en
//     setsPropios / setsRivales).
//   - El partido deja de estar cerrado (si lo estaba).
//   - Los sets POSTERIORES no se borran ni se recalculan.
//     Si el usuario cambia el ganador del set reabierto,
//     tiene que revisar manualmente los sets posteriores.
//
// El modal muestra un aviso más fuerte si hay sets
// posteriores cargados (`setsPosterioresCargados > 0`).
// ============================================================

import type { SetCerrado } from "./tiposV2";

interface Props {
  /** Si es null, el modal no se renderiza. */
  setAReabrir: SetCerrado | null;
  /** Cuántos sets posteriores tienen al menos un punto cargado. */
  setsPosterioresCargados: number;
  /** Callback al confirmar. */
  onConfirmar: () => void;
  /** Callback al cancelar. */
  onCancelar: () => void;
}

export default function ReabrirSetConfirm({
  setAReabrir,
  setsPosterioresCargados,
  onConfirmar,
  onCancelar,
}: Props) {
  if (!setAReabrir) return null;

  const ganado = setAReabrir.ganador === "propio";
  const hayPosteriores = setsPosterioresCargados > 0;

  return (
    <>
      {/* Fondo oscuro clickeable para cancelar */}
      <div
        className="fixed inset-0 z-40 bg-black/60"
        onClick={onCancelar}
      />

      {/* Modal centrado */}
      <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white border-2 border-amber-400 rounded-2xl shadow-2xl p-5 w-[420px] max-w-[92vw]">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔓</span>
            <div>
              <h3 className="text-base font-bold text-amber-900">
                Reabrir Set {setAReabrir.numero}
              </h3>
              <p className="text-[11px] text-slate-500">
                Marcador al cierre: {setAReabrir.puntosPropios}-
                {setAReabrir.puntosRivales} ·{" "}
                <span
                  className={
                    ganado ? "text-emerald-700" : "text-rose-700"
                  }
                >
                  {ganado ? "ganado" : "perdido"}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={onCancelar}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
            title="Cancelar"
          >
            ×
          </button>
        </div>

        {/* Explicación base */}
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 mb-3 space-y-1.5 text-[12px] text-slate-700">
          <p className="font-semibold text-slate-800">
            Al reabrir este set:
          </p>
          <ul className="list-disc pl-5 space-y-0.5">
            <li>
              El set vuelve a estar <strong>editable</strong>.
            </li>
            <li>
              Deja de contar en el marcador de sets
              (setsPropios / setsRivales).
            </li>
            <li>
              El partido deja de estar cerrado (si lo estaba).
            </li>
            {hayPosteriores && (
              <li>
                Los sets posteriores{" "}
                <strong>no se recalculan automáticamente</strong>.
              </li>
            )}
          </ul>
        </div>

        {/* Aviso fuerte si hay sets posteriores cargados */}
        {hayPosteriores && (
          <div className="rounded-lg bg-amber-50 border border-amber-300 p-3 mb-3 text-[12px] text-amber-900">
            <p className="font-semibold mb-1">
              ⚠️ Hay {setsPosterioresCargados} set
              {setsPosterioresCargados !== 1 ? "s" : ""} posterior
              {setsPosterioresCargados !== 1 ? "es" : ""} con datos
              cargados.
            </p>
            <p className="text-[11px] leading-relaxed">
              Si cambiás el ganador de este set, revisá manualmente
              los sets siguientes. La rotación y el saque inicial
              de esos sets no se ajustarán solos.
            </p>
          </div>
        )}

        {/* Botones */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancelar}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            className="px-4 py-2 text-sm font-bold rounded-lg bg-amber-500 text-white hover:bg-amber-600 shadow"
          >
            🔓 Sí, reabrir
          </button>
        </div>
      </div>
    </>
  );
}