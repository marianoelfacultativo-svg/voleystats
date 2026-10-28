"use client";

// ============================================================
// BARRA MARCADOR V2 — marcador + navegación de puntos
// ============================================================

interface Props {
  nombreMiEquipo: string;
  nombreRival: string;
  setActivo: number;
  marcador: { propio: number; rival: number };
  // Navegación
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
  return (
    <>
      <div className="flex items-center justify-center gap-6 bg-white text-gray-800 shadow-md rounded-2xl px-6 py-3">
        <div className="text-center">
          <p className="text-[10px] font-semibold text-slate-400 uppercase">
            {nombreMiEquipo}
          </p>
          <p className="text-3xl font-bold tabular-nums">{marcador.propio}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-semibold text-slate-400 uppercase">
            SET
          </p>
          <p className="text-xl font-bold tabular-nums">{setActivo}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-semibold text-slate-400 uppercase">
            {nombreRival}
          </p>
          <p className="text-3xl font-bold tabular-nums">{marcador.rival}</p>
        </div>
      </div>

      {visibleNavegacion && (
        <div className="flex items-center justify-between text-sm text-slate-600 bg-white border border-slate-200 rounded-xl px-4 py-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onIrPunto(puntoActual - 1)}
              disabled={!puedeIrAnterior}
              className="w-7 h-7 flex items-center justify-center rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-30"
            >
              ◀
            </button>
            <span>
              <strong>Set {setActivo}</strong> · Punto{" "}
              <strong>{puntoActual}</strong>
              {puntoActualCerrado && (
                <span className="ml-1 text-emerald-600 text-xs">
                  ✓ cerrado
                </span>
              )}
              {" · "}Saca:{" "}
              <strong>
                {saqueInicial === "propio" ? nombreMiEquipo : nombreRival}
              </strong>
            </span>
            <button
              onClick={() => onIrPunto(puntoActual + 1)}
              disabled={!puedeIrSiguiente}
              className="w-7 h-7 flex items-center justify-center rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-30"
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