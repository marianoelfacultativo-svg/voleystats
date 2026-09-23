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

const RESULTADOS = [
  { sufijo: "punto", label: "Punto" },
  { sufijo: "error", label: "Error" },
  { sufijo: "neutro", label: "Neutro" },
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

      <div className="space-y-2">
        {ZONAS.map((z) => (
          <div
            key={z.key}
            className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg"
          >
            <span className="w-20 text-sm font-medium text-slate-700">
              {z.label}
            </span>
            <div className="flex-1 grid grid-cols-3 gap-2">
              {RESULTADOS.map((r) => {
                const key = `${z.key}_${r.sufijo}`;
                const cantidad = valores[key] ?? 0;
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between px-3 py-2 bg-white border border-slate-200 rounded"
                  >
                    <span className="text-xs text-slate-500">
                      {r.label}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          onCambio(key, Math.max(0, cantidad - 1))
                        }
                        disabled={soloLectura || cantidad === 0}
                        className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 text-xs font-bold"
                      >
                        −
                      </button>
                      <span className="w-6 text-center font-semibold text-slate-800 text-sm">
                        {cantidad}
                      </span>
                      <button
                        onClick={() => onCambio(key, cantidad + 1)}
                        disabled={soloLectura}
                        className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 text-xs font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}