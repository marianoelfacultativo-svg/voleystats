"use client";

interface Props {
  valores: Record<string, number>;
  onCambio: (valoracion: string, cantidad: number) => void;
  soloLectura?: boolean;
}

const RESULTADOS = [
  { key: "punto", label: "Punto" },
  { key: "error", label: "Error" },
  { key: "neutro", label: "Neutro" },
];

export default function ContadorToque({
  valores,
  onCambio,
  soloLectura = false,
}: Props) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1 h-6 rounded-full bg-pink-500" />
        <h3 className="text-lg font-semibold text-slate-800">Toque</h3>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {RESULTADOS.map((r) => {
          const cantidad = valores[r.key] ?? 0;
          return (
            <div
              key={r.key}
              className="flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg"
            >
              <span className="text-sm font-medium text-slate-700">
                {r.label}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onCambio(r.key, Math.max(0, cantidad - 1))}
                  disabled={soloLectura || cantidad === 0}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 font-bold"
                >
                  −
                </button>
                <span className="w-8 text-center font-semibold text-slate-800">
                  {cantidad}
                </span>
                <button
                  onClick={() => onCambio(r.key, cantidad + 1)}
                  disabled={soloLectura}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 font-bold"
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-400 mt-3 text-center">
        Cada toque cuenta automáticamente como una tendencia "Toque".
      </p>
    </div>
  );
}