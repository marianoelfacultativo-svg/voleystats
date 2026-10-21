"use client";

// ============================================================
// BOTONES ACCIÓN V2 — barra inferior + texto de ayuda
// ============================================================

interface Props {
  guardando: boolean;
  puedeBorrarUltima: boolean;
  puedeBorrarPunto: boolean;
  puedeGuardar: boolean;
  puedeCerrarPunto: boolean;
  onBorrarUltima: () => void;
  onBorrarPunto: () => void;
  onGuardar: () => void;
  onCerrarPunto: () => void;
  onBorrarLocal: () => void;
}

export default function BotonesAccionV2({
  guardando,
  puedeBorrarUltima,
  puedeBorrarPunto,
  puedeGuardar,
  puedeCerrarPunto,
  onBorrarUltima,
  onBorrarPunto,
  onGuardar,
  onCerrarPunto,
  onBorrarLocal,
}: Props) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-3">
        <div className="flex gap-2">
          <button
            onClick={onBorrarUltima}
            disabled={!puedeBorrarUltima}
            className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-sm font-medium disabled:opacity-40"
          >
            ↩ Borrar última (D)
          </button>
          <button
            onClick={onBorrarPunto}
            disabled={!puedeBorrarPunto}
            className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 border border-red-300 rounded-lg text-sm font-medium disabled:opacity-40"
          >
            ✕ Borrar punto
          </button>
          <button
            onClick={onBorrarLocal}
            className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-sm font-medium"
            title="Borra los datos guardados en este navegador para este partido (NO toca Supabase)"
          >
            🧹 Borrar local
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onGuardar}
            disabled={guardando || !puedeGuardar}
            className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg disabled:opacity-40"
          >
            {guardando ? "Guardando..." : "💾 Guardar en Supabase"}
          </button>
          <button
            onClick={onCerrarPunto}
            disabled={!puedeCerrarPunto}
            className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg disabled:opacity-40"
          >
            ✓ Cerrar punto (Enter)
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-400 text-center">
        Click en mini → círculo blanco. Click en el círculo → armado (naranja
        ✓).
        <br />
        Sin armar: click propia = ⭐, click rival = rompe línea (libre). Armado:
        click en bloqueo = desvío, click en cualquier otra = línea.
        <br />
        <strong>Atajos:</strong> Esc (desarmar/borrar desvío) · Enter (cerrar) ·
        D (borrar última) · Ctrl+G (guardar en Supabase)
      </p>
    </>
  );
}