"use client";

interface Props {
  valores: Record<string, number>;
  onCambio: (valoracion: string, cantidad: number) => void;
  soloLectura?: boolean;
}

const ZONAS = [
  { key: "zona_4", label: "Zona 4" },
  { key: "zona_3", label: "Zona 3" },
  { key: "zona_2", label: "Zona 2" },
  { key: "zona_6", label: "Zona 6" },
  { key: "zona_1", label: "Zona 1" },
];

export default function ContadorTendencia({
  valores,
  onCambio,
  soloLectura = false,
}: Props) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1 h-6 rounded-full bg-cyan-500" />
        <h3 className="text-lg font-semibold text-slate-800">Tendencia</h3>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {ZONAS.map((z) => {
          const cantidad = valores[z.key] ?? 0;
          return (
            <div
              key={z.key}
              className="flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg"
            >
              <span className="text-sm font-medium text-slate-700">
                {z.label}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onCambio(z.key, Math.max(0, cantidad - 1))}
                  disabled={soloLectura || cantidad === 0}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 font-bold"
                >
                  −
                </button>
                <span className="w-8 text-center font-semibold text-slate-800">
                  {cantidad}
                </span>
                <button
                  onClick={() => onCambio(z.key, cantidad + 1)}
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