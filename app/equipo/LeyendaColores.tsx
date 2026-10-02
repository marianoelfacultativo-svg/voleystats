"use client";

interface NivelInfo {
  id: "destaca" | "bien" | "cumple" | "bajo";
  label: string;
  ancho: string;
  bg: string;
  border: string;
  text: string;
  // Cortes por fundamento
  saque: string;
  recepcion: string;
  ataque: string;
  bloqueo: string;
  defensa: string;
}

const NIVELES: NivelInfo[] = [
  {
    id: "destaca",
    label: "Destaca",
    ancho: "100%",
    bg: "bg-sky-100",
    border: "border-sky-400",
    text: "text-sky-800",
    saque: "≥ 7.5",
    recepcion: "≥ 8.0",
    ataque: "≥ 7.5",
    bloqueo: "≥ 7.5",
    defensa: "≥ 7.5",
  },
  {
    id: "bien",
    label: "Bien",
    ancho: "100%",
    bg: "bg-emerald-100",
    border: "border-emerald-400",
    text: "text-emerald-800",
    saque: "6.0 – 7.4",
    recepcion: "6.5 – 7.9",
    ataque: "5.5 – 7.4",
    bloqueo: "5.5 – 7.4",
    defensa: "6.0 – 7.4",
  },
  {
    id: "cumple",
    label: "Cumple",
    ancho: "100%",
    bg: "bg-yellow-100",
    border: "border-yellow-400",
    text: "text-yellow-800",
    saque: "4.0 – 5.9",
    recepcion: "4.0 – 6.4",
    ataque: "3.5 – 5.4",
    bloqueo: "3.5 – 5.4",
    defensa: "4.0 – 5.9",
  },
  {
    id: "bajo",
    label: "Bajo",
    ancho: "100%",
    bg: "bg-red-100",
    border: "border-red-400",
    text: "text-red-800",
    saque: "< 4.0",
    recepcion: "< 4.0",
    ataque: "< 3.5",
    bloqueo: "< 3.5",
    defensa: "< 4.0",
  },
];

const FUNDAMENTOS: { key: keyof NivelInfo; label: string; short: string }[] = [
  { key: "saque", label: "Saque", short: "SAQ" },
  { key: "recepcion", label: "Recepción", short: "REC" },
  { key: "ataque", label: "Ataque", short: "ATK" },
  { key: "bloqueo", label: "Bloqueo", short: "BLQ" },
  { key: "defensa", label: "Defensa", short: "DEF" },
];

export default function LeyendaColores() {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
      <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-4 text-center">
        🏐 Niveles de rendimiento
      </p>

      {/* Tabla compacta: filas = niveles, columnas = fundamentos */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="text-left px-2 py-1 text-slate-500 font-medium text-[10px] uppercase tracking-wider">
                Nivel
              </th>
              {FUNDAMENTOS.map((f) => (
                <th
                  key={String(f.key)}
                  className="text-center px-2 py-1 text-slate-500 font-medium text-[10px] uppercase tracking-wider"
                  title={f.label}
                >
                  {f.short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {NIVELES.map((n) => (
              <tr key={n.id}>
                <td
                  className={`px-3 py-2 font-bold text-xs rounded-l-md border-l-2 border-y-2 ${n.bg} ${n.border} ${n.text}`}
                >
                  {n.label}
                </td>
                {FUNDAMENTOS.map((f, idx) => (
                  <td
                    key={String(f.key)}
                    className={`px-2 py-2 text-center font-mono text-[11px] ${n.bg} ${n.text} ${
                      idx === FUNDAMENTOS.length - 1
                        ? "rounded-r-md border-r-2"
                        : ""
                    } border-y-2 ${n.border}`}
                  >
                    {n[f.key] as string}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-slate-500 text-center mt-3 leading-relaxed">
        Valoración ponderada por fundamento. <br />
        SAQ = Saque · REC = Recepción · ATK = Ataque · BLQ = Bloqueo · DEF = Defensa
      </p>
    </div>
  );
}