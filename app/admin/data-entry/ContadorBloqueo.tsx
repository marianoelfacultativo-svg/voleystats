"use client";

interface Props {
  valores: Record<string, number>;
  onCambio: (valoracion: string, cantidad: number) => void;
  soloLectura?: boolean;
}

const VALORACIONES = [
  { key: "punto", label: "Punto" },
  { key: "positivo_mas", label: "Positivo +" },
  { key: "positivo", label: "Positivo" },
  { key: "use_rival", label: "Use Rival" },
  { key: "red", label: "Red" },
  { key: "filtrada", label: "Filtrada" },
];

export default function ContadorBloqueo({
  valores,
  onCambio,
  soloLectura = false,
}: Props) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1 h-6 rounded-full bg-violet-500" />
        <h3 className="text-lg font-semibold text-slate-800">Bloqueo</h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {VALORACIONES.map((v) => {
          const cantidad = valores[v.key] ?? 0;
          return (
            <div
              key={v.key}
              className="flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg"
            >
              <span className="text-sm font-medium text-slate-700">
                {v.label}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onCambio(v.key, Math.max(0, cantidad - 1))}
                  disabled={soloLectura || cantidad === 0}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 font-bold"
                >
                  −
                </button>
                <span className="w-8 text-center font-semibold text-slate-800">
                  {cantidad}
                </span>
                <button
                  onClick={() => onCambio(v.key, cantidad + 1)}
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
    </div>
  );
}