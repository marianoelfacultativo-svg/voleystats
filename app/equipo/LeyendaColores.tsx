"use client";

export default function LeyendaColores() {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
      <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-4 text-center">
        🏐 Niveles de rendimiento
      </p>

      <div className="flex flex-col items-center gap-1.5">
        {/* Destaca - el más angosto, arriba */}
        <div className="w-[45%] bg-sky-100 border-2 border-sky-400 rounded-md px-3 py-2 text-center shadow-sm">
          <p className="text-sky-700 font-bold text-sm leading-none">
            🔵 Destaca
          </p>
        </div>

        {/* Bien */}
        <div className="w-[65%] bg-emerald-100 border-2 border-emerald-400 rounded-md px-3 py-2 text-center shadow-sm">
          <p className="text-emerald-700 font-bold text-sm leading-none">
            🟢 Bien
          </p>
        </div>

        {/* Cumple */}
        <div className="w-[82%] bg-yellow-100 border-2 border-yellow-400 rounded-md px-3 py-2 text-center shadow-sm">
          <p className="text-yellow-700 font-bold text-sm leading-none">
            🟡 Cumple
          </p>
        </div>

        {/* Bajo - el más ancho, abajo */}
        <div className="w-full bg-red-100 border-2 border-red-400 rounded-md px-3 py-2 text-center shadow-sm">
          <p className="text-red-700 font-bold text-sm leading-none">
            🔴 Bajo
          </p>
        </div>
      </div>

      <p className="text-[10px] text-slate-500 text-center mt-4 leading-relaxed">
        Los cortes varían por fundamento (ataque y bloqueo son más
        exigentes). Mirá los números de cada fundamento abajo del radar.
      </p>
    </div>
  );
}