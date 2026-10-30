"use client";

// ============================================================
// SECCIÓN: CONSECUENCIA — Análisis de consecuencias
// ============================================================
// Resultado observado después del trigger: balance puntos/neutro/
// error, efectividad neta, subtipo más frecuente, distancias y
// registro detallado.
// ============================================================

import {
  etiquetaRelacionObservado,
  hayComparadoresActivos,
  type CoincidenciaFiltro,
  type RelacionJugadorObservado,
  type ResultadoAnalisis,
  type TipoDisparador,
} from "@/lib/analisisConsecuencias";
import { COMPARADORES } from "./constantes";

// ------------------------------------------------------------
// PROPS
// ------------------------------------------------------------

interface Props {
  resultado: ResultadoAnalisis;
  tipoObservado: TipoDisparador | "cualquiera";
  jugadorObservadoFiltro: string;
  nombre: (id: string | null) => string;
  coincidencias: CoincidenciaFiltro;
  onIrAPunto?: (set: number, punto: number) => void;
}

// ------------------------------------------------------------
// SUBCOMPONENTE: BalanceFila
// ------------------------------------------------------------

function BalanceFila({
  color,
  label,
  pct,
  count,
  total,
  colorTexto,
  colorBarra,
}: {
  color: string;
  label: string;
  pct: number;
  count: number;
  total: number;
  colorTexto: string;
  colorBarra: string;
}) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${color}`} />
        <span className="text-slate-300">{label}</span>
      </div>
      <div className="flex items-center gap-2 flex-1 max-w-xs ml-2">
        <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full ${colorBarra} rounded-full`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span
          className={`font-mono font-semibold text-[10px] w-12 text-right ${colorTexto}`}
        >
          {pct}%
        </span>
      </div>
      <span className="font-mono text-slate-500 text-[10px] w-14 text-right">
        {count}/{total}
      </span>
    </div>
  );
}

// ------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ------------------------------------------------------------

export default function SeccionConsecuencia({
  resultado,
  tipoObservado,
  jugadorObservadoFiltro,
  nombre,
  coincidencias,
  onIrAPunto,
}: Props) {
  const est = resultado.estadisticasObservadas;
  if (!est) return null;
  const evalR = est.evaluacionResultado;

  const esRelacion =
    jugadorObservadoFiltro === "cualquiera" ||
    jugadorObservadoFiltro === "mismo" ||
    jugadorObservadoFiltro === "companero" ||
    jugadorObservadoFiltro === "rival";

  return (
    <details
      open
      className="rounded-lg border border-white/10 overflow-hidden bg-slate-900/40"
    >
      <summary className="px-3 py-2 cursor-pointer text-xs font-bold uppercase tracking-wider text-slate-200 bg-white/[0.02] flex items-center justify-between">
        <span>
          🎯 Consecuencia:{" "}
          {tipoObservado === "cualquiera"
            ? "1ª acción siguiente"
            : `sig. ${tipoObservado}`}
        </span>
        <span className="text-[10px] text-slate-400 font-normal">
          {evalR.total} casos ·{" "}
          {evalR.masFrecuente === "punto"
            ? "punto"
            : evalR.masFrecuente === "error"
            ? "error"
            : "neutro"}
        </span>
      </summary>

      <div className="p-3 space-y-2 border-t border-white/10">
        <p className="text-[10px] text-slate-400 -mt-1">
          {esRelacion
            ? etiquetaRelacionObservado(
                jugadorObservadoFiltro as RelacionJugadorObservado
              )
            : `Jugador específico: ${nombre(jugadorObservadoFiltro)}`}
        </p>

        <div className="space-y-1">
          <BalanceFila
            color="bg-emerald-400"
            label="Puntos"
            pct={evalR.pctPuntos}
            count={evalR.puntos}
            total={evalR.total}
            colorTexto="text-emerald-300"
            colorBarra="bg-emerald-500"
          />
          <BalanceFila
            color="bg-amber-400"
            label="Neutro"
            pct={evalR.pctNeutros}
            count={evalR.neutros}
            total={evalR.total}
            colorTexto="text-amber-300"
            colorBarra="bg-amber-500"
          />
          <BalanceFila
            color="bg-rose-400"
            label="Error"
            pct={evalR.pctErrores}
            count={evalR.errores}
            total={evalR.total}
            colorTexto="text-rose-300"
            colorBarra="bg-rose-500"
          />
          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-white/5">
            <span className="text-slate-300 font-medium">
              Efectividad neta
            </span>
            <span
              className={`font-mono font-bold px-2 py-0.5 rounded text-[10px] ${
                evalR.efectividadNeta > 0
                  ? "bg-emerald-500/15 text-emerald-300"
                  : evalR.efectividadNeta < 0
                  ? "bg-rose-500/15 text-rose-300"
                  : "bg-slate-700 text-slate-300"
              }`}
            >
              {evalR.efectividadNeta > 0 ? "+" : ""}
              {evalR.efectividadNeta}%
            </span>
          </div>
        </div>

        <div className="pt-2 border-t border-white/5 space-y-0.5 text-[11px]">
          <div className="flex justify-between gap-2">
            <span className="text-slate-400">Subtipo más frecuente:</span>
            <span className="font-semibold text-white capitalize truncate">
              {est.subtipoMasFrecuente || "—"}{" "}
              <span className="text-slate-400 font-normal">
                ({est.subtiposRanking[0]?.pct ?? 0}%)
              </span>
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-400">Distancia promedio:</span>
            <span className="font-mono text-white">
              ~{est.promedioAccionesDistancia}t ·{" "}
              {est.promedioPuntosDistancia === 0
                ? "mismo punto"
                : `+${est.promedioPuntosDistancia} pts`}
            </span>
          </div>
          {hayComparadoresActivos(coincidencias) && (
            <div className="flex justify-between gap-2">
              <span className="text-slate-400">Coincidencias:</span>
              <span className="text-slate-300">
                {COMPARADORES.filter((c) => coincidencias[c.key])
                  .map((c) => {
                    const val = resultado.coincidenciasGlobales[c.key] ?? 0;
                    const pct = Math.round(
                      (val / Math.max(1, resultado.totalOcurrencias)) * 100
                    );
                    return `${c.etiqueta}: ${pct}%`;
                  })
                  .join(" · ")}
              </span>
            </div>
          )}
        </div>

        <details className="pt-2 border-t border-white/5">
          <summary className="text-[10px] font-bold uppercase text-slate-400 cursor-pointer">
            Registro ({resultado.ocurrencias.length})
          </summary>
          <div className="mt-2 overflow-x-auto max-h-[280px] overflow-y-auto rounded border border-white/10">
            <table className="w-full text-[10px] min-w-[560px]">
              <thead className="sticky top-0 bg-slate-950 border-b border-white/10 text-slate-400 text-left">
                <tr>
                  <th className="py-1.5 px-2">Momento</th>
                  <th className="py-1.5 px-2">Trigger</th>
                  <th className="py-1.5 px-2">Observada</th>
                  <th className="py-1.5 px-2">Desenlace</th>
                  {onIrAPunto && <th className="py-1.5 px-2" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {resultado.ocurrencias.map((o) => {
                  const obs = o.accionObservada;
                  return (
                    <tr
                      key={`${o.set_numero}-${o.punto_numero}-${o.triggerId}`}
                    >
                      <td className="py-1.5 px-2 font-mono text-slate-400 whitespace-nowrap">
                        S{o.set_numero}·P{o.punto_numero}
                      </td>
                      <td className="py-1.5 px-2">
                        <span className="text-slate-100 capitalize">
                          {o.triggerSubtipo}
                        </span>{" "}
                        <span className="text-slate-500">
                          ({nombre(o.triggerJugadorId)})
                        </span>
                      </td>
                      <td className="py-1.5 px-2">
                        {obs ? (
                          <>
                            <span className="text-slate-100 capitalize">
                              {obs.subtipo}
                            </span>{" "}
                            <span className="text-slate-500">
                              ({nombre(obs.accion.jugador_id)})
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-500 italic">—</span>
                        )}
                      </td>
                      <td className="py-1.5 px-2">
                        {obs ? (
                          <span
                            className={`px-1.5 py-0.5 rounded font-semibold ${
                              obs.categoriaResultado === "punto"
                                ? "bg-emerald-500/15 text-emerald-300"
                                : obs.categoriaResultado === "error"
                                ? "bg-rose-500/15 text-rose-300"
                                : "bg-amber-500/15 text-amber-300"
                            }`}
                          >
                            {obs.categoriaResultado === "punto"
                              ? "P"
                              : obs.categoriaResultado === "error"
                              ? "E"
                              : "N"}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      {onIrAPunto && (
                        <td className="py-1.5 px-2 text-right">
                          <button
                            onClick={() =>
                              onIrAPunto(o.set_numero, o.punto_numero)
                            }
                            className="text-sky-400 hover:text-sky-300 underline"
                          >
                            ver
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </details>
  );
}