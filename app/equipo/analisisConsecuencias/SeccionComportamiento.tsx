"use client";

// ============================================================
// SECCIÓN: COMPORTAMIENTO DEL TRIGGER — Análisis de consecuencias
// ============================================================
// Distribuciones del conjunto de triggers:
//   - Cumplimiento por bloque
//   - Por subtipo
//   - Por zona destino
//   - Por velocidad
//   - Por llamada (inferida)
//   - Por dirección de ataque (legacy)
//   - Por jugador
//   - Por set
//
// (porSectorAtaque se sumará en la UI v6.)
// ============================================================

import {
  etiquetaDireccionAtaque,
  etiquetaLlamadaInferida,
  type ComportamientoTrigger,
} from "@/lib/analisisConsecuencias";

// ------------------------------------------------------------
// PROPS
// ------------------------------------------------------------

interface Props {
  comportamiento: ComportamientoTrigger;
  nombreDeJugador: (id: string) => string;
}

// ------------------------------------------------------------
// SUBCOMPONENTE: DistribucionLista
// ------------------------------------------------------------

function DistribucionLista({
  titulo,
  items,
  color = "bg-sky-400",
}: {
  titulo: string;
  items: { label: string; count: number; pct: number }[];
  color?: string;
}) {
  if (items.length === 0) return null;
  const maxPct = Math.max(...items.map((i) => i.pct), 1);
  return (
    <div>
      <h6 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
        {titulo}
      </h6>
      <div className="space-y-0.5">
        {items.map((it) => (
          <div key={it.label} className="flex items-center gap-2 text-[10px]">
            <span className="w-24 truncate text-slate-300">{it.label}</span>
            <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full ${color} rounded-full`}
                style={{ width: `${(it.pct / maxPct) * 100}%` }}
              />
            </div>
            <span className="w-14 text-right font-mono text-slate-300">
              {it.count} ({it.pct}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ------------------------------------------------------------

export default function SeccionComportamiento({
  comportamiento,
  nombreDeJugador,
}: Props) {
  return (
    <details
      open
      className="rounded-lg border border-white/10 overflow-hidden bg-slate-900/40"
    >
      <summary className="px-3 py-2 cursor-pointer text-xs font-bold uppercase tracking-wider text-slate-200 bg-white/[0.02] flex items-center justify-between">
        <span>📊 Comportamiento del trigger</span>
        <span className="text-[10px] text-slate-400 font-normal">
          {comportamiento.totalTriggers} triggers
        </span>
      </summary>
      <div className="p-3 space-y-2 border-t border-white/10">
        {comportamiento.porBloque.length > 0 && (
          <DistribucionLista
            titulo="Cumplimiento por bloque"
            items={comportamiento.porBloque.map((x) => ({
              label: `#${x.bloqueId.slice(0, 5)} ${x.tipo}`,
              count: x.count,
              pct: x.pct,
            }))}
            color="bg-fuchsia-400"
          />
        )}
        <DistribucionLista
          titulo="Por subtipo"
          items={comportamiento.porSubtipo.map((x) => ({
            label: x.subtipo,
            count: x.count,
            pct: x.pct,
          }))}
          color="bg-sky-400"
        />
        <DistribucionLista
          titulo="Por zona destino"
          items={comportamiento.porZonaDestino.map((x) => ({
            label: x.zona === null ? "Sin dato" : `Zona ${x.zona}`,
            count: x.count,
            pct: x.pct,
          }))}
          color="bg-violet-400"
        />
        <DistribucionLista
          titulo="Por velocidad"
          items={comportamiento.porVelocidad.map((x) => ({
            label: x.velocidad === null ? "Sin dato" : `v${x.velocidad}`,
            count: x.count,
            pct: x.pct,
          }))}
          color="bg-emerald-400"
        />
        {comportamiento.porLlamada.length > 0 && (
          <DistribucionLista
            titulo="Por llamada del armado"
            items={comportamiento.porLlamada.map((x) => ({
              label: etiquetaLlamadaInferida(x.llamada),
              count: x.count,
              pct: x.pct,
            }))}
            color="bg-amber-400"
          />
        )}
        {comportamiento.porDireccionAtaque.length > 0 && (
          <DistribucionLista
            titulo="Por dirección de ataque"
            items={comportamiento.porDireccionAtaque.map((x) => ({
              label: etiquetaDireccionAtaque(x.direccion),
              count: x.count,
              pct: x.pct,
            }))}
            color="bg-rose-400"
          />
        )}
        <DistribucionLista
          titulo="Por jugador"
          items={comportamiento.porJugador.map((x) => ({
            label: nombreDeJugador(x.jugadorId),
            count: x.count,
            pct: x.pct,
          }))}
          color="bg-amber-400"
        />
        <DistribucionLista
          titulo="Por set"
          items={comportamiento.porSet.map((x) => ({
            label: `Set ${x.set}`,
            count: x.count,
            pct: x.pct,
          }))}
          color="bg-rose-400"
        />
      </div>
    </details>
  );
}