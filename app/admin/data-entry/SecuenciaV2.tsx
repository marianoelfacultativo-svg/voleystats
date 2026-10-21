"use client";

// ============================================================
// SECUENCIA V2 — panel con la lista de acciones del punto
// ============================================================

import type { LineaClasificada } from "@/lib/clasificacionV2";

interface Props {
  lineas: LineaClasificada[];
  nombreDeJugador: (id: string | null) => string;
}

export default function SecuenciaV2({ lineas, nombreDeJugador }: Props) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-2">
      <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">
        Secuencia
      </p>
      <div className="max-h-[420px] overflow-y-auto pr-1">
        <ol className="text-[11px] text-slate-700 space-y-1.5">
          {lineas.length === 0 && (
            <li className="text-slate-400 italic text-[10px]">
              (sin acciones)
            </li>
          )}
          {lineas.map((l, i) => {
            const partes: string[] = [];
            if (l.posicionInicial) {
              partes.push(
                `⭐${l.posicionInicial.celda}${
                  l.posicionInicial.mini ? `-${l.posicionInicial.mini}` : ""
                }`
              );
            }
            partes.push(
              `${l.origen.celda}${l.origen.mini ? `-${l.origen.mini}` : ""}`
            );
            for (const d of l.desvios ?? []) {
              partes.push(`${d.celda}${d.mini ? `-${d.mini}` : ""}`);
            }
            partes.push(
              `${l.destino.celda}${l.destino.mini ? `-${l.destino.mini}` : ""}`
            );
            const coord = partes.join(" → ");

            const val =
              l.subtipo !== undefined && l.subtipo !== null
                ? String(l.subtipo)
                : "";
            const esToqueAtaque =
              l.tipo === "ataque" && l.variante === "toque";
            return (
              <li key={l.id} className="border-l-2 border-slate-300 pl-2">
                <div className="font-semibold text-slate-800 flex items-center gap-1 flex-wrap">
                  <span>{i + 1}.</span>
                  <span>{l.tipo}</span>
                  {val && (
                    <span className="text-emerald-700 bg-emerald-50 px-1 rounded text-[10px] font-bold uppercase">
                      {val}
                    </span>
                  )}
                  {l.tipoSaque && (
                    <span className="text-orange-700 bg-orange-50 px-1 rounded text-[10px] font-bold uppercase">
                      {l.tipoSaque === "potencia" ? "P" : "F"}
                    </span>
                  )}
                  {l.velocidad !== undefined && l.velocidad !== null && (
                    <span className="text-sky-700 bg-sky-50 px-1 rounded text-[10px] font-bold">
                      v{l.velocidad}
                    </span>
                  )}
                  {l.x2 && (
                    <span className="text-violet-700 bg-violet-50 px-1 rounded text-[10px] font-bold uppercase">
                      x2
                    </span>
                  )}
                  {esToqueAtaque && (
                    <span className="text-amber-700 bg-amber-50 px-1 rounded text-[10px] font-bold uppercase">
                      toque
                    </span>
                  )}
                  {l.esRival && (
                    <span className="text-[9px] text-slate-400 italic">
                      (rival)
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-600 truncate">
                  👤{" "}
                  {l.jugadorId
                    ? nombreDeJugador(l.jugadorId)
                    : l.esRival
                    ? "—"
                    : "(sin asignar)"}
                </div>
                <div className="text-[10px] text-slate-400 font-mono truncate">
                  {coord}
                </div>
                {l.desvios && l.desvios.length > 0 && (
                  <div className="text-[10px] text-orange-600">
                    ↳ {l.desvios.length} desvío
                    {l.desvios.length !== 1 ? "s" : ""}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}