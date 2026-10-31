"use client";

// ============================================================
// BOTONES ACCIÓN V2 — barra inferior + texto de ayuda
// ============================================================
//
// v2 (FASE 7.1 — DataEntry con sets y partido):
//   + Nueva prop `setCerrado: boolean` y `onReabrirSet`.
//   + Cuando el set activo está cerrado:
//       · El botón "Cerrar punto" se reemplaza por "Reabrir set".
//       · Los botones de edición (borrar última / borrar punto)
//         quedan deshabilitados.
//       · El botón "Guardar en Supabase" sigue habilitado.
//   + El texto de ayuda inferior se adapta al estado.
//
// v1: barra original.
// ============================================================

interface Props {
  // ---------- Estado general ----------
  guardando: boolean;
  setCerrado: boolean;

  // ---------- Habilitación de botones ----------
  puedeBorrarUltima: boolean;
  puedeBorrarPunto: boolean;
  puedeGuardar: boolean;
  puedeCerrarPunto: boolean;

  // ---------- Callbacks existentes ----------
  onBorrarUltima: () => void;
  onBorrarPunto: () => void;
  onGuardar: () => void;
  onCerrarPunto: () => void;
  onBorrarLocal: () => void;

  // ---------- Callback nuevo (FASE 7.1) ----------
  onReabrirSet: () => void;
}

export default function BotonesAccionV2({
  guardando,
  setCerrado,
  puedeBorrarUltima,
  puedeBorrarPunto,
  puedeGuardar,
  puedeCerrarPunto,
  onBorrarUltima,
  onBorrarPunto,
  onGuardar,
  onCerrarPunto,
  onBorrarLocal,
  onReabrirSet,
}: Props) {
  const edicionDeshabilitada = setCerrado;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-3">
        {/* ---------- Grupo izquierdo: borrar ---------- */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={onBorrarUltima}
            disabled={!puedeBorrarUltima || edicionDeshabilitada}
            className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            title={
              edicionDeshabilitada
                ? "Reabrí el set para editar"
                : "Borrar la última línea del punto actual"
            }
          >
            ↩ Borrar última (D)
          </button>
          <button
            onClick={onBorrarPunto}
            disabled={!puedeBorrarPunto || edicionDeshabilitada}
            className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 border border-red-300 rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            title={
              edicionDeshabilitada
                ? "Reabrí el set para editar"
                : "Borrar todas las líneas del punto actual"
            }
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

        {/* ---------- Grupo derecho: guardar / cerrar / reabrir ---------- */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={onGuardar}
            disabled={guardando || !puedeGuardar}
            className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {guardando ? "Guardando..." : "💾 Guardar en Supabase"}
          </button>

          {setCerrado ? (
            <button
              onClick={onReabrirSet}
              className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg shadow"
              title="Volver a poner el set como activo para editarlo"
            >
              🔓 Reabrir set
            </button>
          ) : (
            <button
              onClick={onCerrarPunto}
              disabled={!puedeCerrarPunto}
              className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ✓ Cerrar punto (Enter)
            </button>
          )}
        </div>
      </div>

      {/* ---------- Texto de ayuda ---------- */}
      {setCerrado ? (
        <p className="text-xs text-amber-600 text-center">
          🔒 Estás mirando el <strong>Set cerrado</strong>. Para
          editarlo, apretá <strong>Reabrir set</strong>. Los sets
          posteriores no se recalculan automáticamente.
        </p>
      ) : (
        <p className="text-xs text-slate-400 text-center">
          Click en mini → círculo blanco. Click en el círculo → armado
          (naranja ✓).
          <br />
          Sin armar: click propia = ⭐, click rival = rompe línea (libre).
          Armado: click en bloqueo = desvío, click en cualquier otra =
          línea.
          <br />
          <strong>Atajos:</strong> Esc (desarmar/borrar desvío) · Enter
          (cerrar) · D (borrar última) · Ctrl+G (guardar en Supabase)
        </p>
      )}
    </>
  );
}