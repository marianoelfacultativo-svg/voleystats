"use client";

// ============================================================
// CONSULTA RESULTADO — render de un ResultadoConsultaExtendido
// ============================================================
// FASE 5 del plan "Consultas Analíticas Libres".
//
// v1.1 (FASE 7.4):
//   + Muestra un aviso destacado si `parserInfo.jugadorAmbiguo`
//     es true, listando los candidatos para que el usuario
//     reformule con nombre completo, apodo o #número.
// ============================================================

import type { ResultadoConsultaExtendido } from "@/lib/consultaAnalitica/ejecutor";
import type {
  RespuestaConsulta,
  FilaTabla,
  ItemDistribucion,
  PuntoSerie,
} from "@/lib/consultaAnalitica/tipos";

// ------------------------------------------------------------
// PROPS
// ------------------------------------------------------------

interface Props {
  resultado: ResultadoConsultaExtendido;
  nombreDeJugador?: (id: string) => string;
}

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

function fmt(n: number, decimales = 2): string {
  if (!isFinite(n)) return "0";
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimales,
  });
}

function fmtPct(n: number, decimales = 1): string {
  return `${fmt(n, decimales)}%`;
}

const cardBase: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "0.75rem",
};

// ------------------------------------------------------------
// SUBCOMPONENTES: TARJETAS
// ------------------------------------------------------------

function TarjetaNumero({
  valor,
  unidad,
  detalle,
}: {
  valor: number;
  unidad: string | null;
  detalle: string | null;
}) {
  return (
    <div style={cardBase} className="p-4">
      <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
        Resultado
      </p>
      <p className="text-3xl font-black text-white tabular-nums">
        {fmt(valor)}
        {unidad && (
          <span className="text-base text-slate-400 font-medium ml-2">
            {unidad}
          </span>
        )}
      </p>
      {detalle && (
        <p className="text-[11px] text-slate-400 mt-1">{detalle}</p>
      )}
    </div>
  );
}

function TarjetaPorcentaje({
  valor,
  count,
  base,
  detalle,
}: {
  valor: number;
  count: number;
  base: number;
  detalle: string | null;
}) {
  return (
    <div style={cardBase} className="p-4">
      <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
        Porcentaje
      </p>
      <p className="text-3xl font-black text-cyan-300 tabular-nums">
        {fmtPct(valor)}
      </p>
      <p className="text-xs text-slate-400 mt-1 tabular-nums">
        {count} de {base}
      </p>
      {detalle && (
        <p className="text-[11px] text-slate-500 mt-1 italic">{detalle}</p>
      )}
      <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full bg-cyan-500 rounded-full"
          style={{ width: `${Math.min(100, Math.max(0, valor))}%` }}
        />
      </div>
    </div>
  );
}

function TarjetaPromedio({
  valor,
  n,
  detalle,
}: {
  valor: number;
  n: number;
  detalle: string | null;
}) {
  return (
    <div style={cardBase} className="p-4">
      <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
        Promedio
      </p>
      <p className="text-3xl font-black text-emerald-300 tabular-nums">
        {fmt(valor)}
      </p>
      <p className="text-xs text-slate-400 mt-1">
        Sobre {n} acciones
      </p>
      {detalle && (
        <p className="text-[11px] text-slate-500 mt-1 italic">{detalle}</p>
      )}
    </div>
  );
}

function TarjetaFrecuencia({
  valor,
  base,
  count,
  detalle,
}: {
  valor: number;
  base: number;
  count: number;
  detalle: string | null;
}) {
  return (
    <div style={cardBase} className="p-4">
      <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
        Frecuencia
      </p>
      <p className="text-2xl font-black text-amber-300 tabular-nums">
        {valor > 0 ? `Cada ${fmt(valor, 1)}` : "—"}
      </p>
      <p className="text-xs text-slate-400 mt-1 tabular-nums">
        {count} eventos en {base} acciones
      </p>
      {detalle && (
        <p className="text-[11px] text-slate-500 mt-1 italic">{detalle}</p>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// SUBCOMPONENTE: TABLA
// ------------------------------------------------------------

function TablaFilas({
  filas,
  mostrarTotal = false,
  total = null,
}: {
  filas: FilaTabla[];
  mostrarTotal?: boolean;
  total?: FilaTabla | null;
  nombreDeJugador?: (id: string) => string;
}) {
  if (filas.length === 0) {
    return (
      <p className="text-xs text-slate-500 italic py-3 text-center">
        Sin filas para mostrar.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-left text-slate-400 border-b border-white/10">
            <th className="py-1.5 px-2 font-bold uppercase tracking-wider">
              Grupo
            </th>
            <th className="py-1.5 px-2 text-right font-bold uppercase tracking-wider">
              Valor
            </th>
            <th className="py-1.5 px-2 text-right font-bold uppercase tracking-wider">
              Cantidad
            </th>
            <th className="py-1.5 px-2 text-right font-bold uppercase tracking-wider">
              %
            </th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr
              key={f.key}
              className="border-b border-white/[0.04] hover:bg-white/[0.03]"
            >
              <td className="py-1.5 px-2 text-slate-200 font-medium">
                {f.label}
              </td>
              <td className="py-1.5 px-2 text-right text-cyan-300 font-bold tabular-nums">
                {fmt(f.valor)}
              </td>
              <td className="py-1.5 px-2 text-right text-slate-300 tabular-nums">
                {f.count}
              </td>
              <td className="py-1.5 px-2 text-right text-slate-400 tabular-nums">
                {f.porcentaje !== null ? fmtPct(f.porcentaje) : "—"}
              </td>
            </tr>
          ))}
          {mostrarTotal && total && (
            <tr className="bg-white/[0.05] border-t-2 border-white/10">
              <td className="py-1.5 px-2 text-white font-bold">
                {total.label}
              </td>
              <td className="py-1.5 px-2 text-right text-white font-bold tabular-nums">
                {fmt(total.valor)}
              </td>
              <td className="py-1.5 px-2 text-right text-white font-bold tabular-nums">
                {total.count}
              </td>
              <td className="py-1.5 px-2 text-right text-white font-bold tabular-nums">
                {total.porcentaje !== null ? fmtPct(total.porcentaje) : "—"}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------
// SUBCOMPONENTE: DISTRIBUCIÓN (barras horizontales)
// ------------------------------------------------------------

function BarrasDistribucion({
  items,
  total,
}: {
  items: ItemDistribucion[];
  total: number;
}) {
  if (items.length === 0) {
    return (
      <p className="text-xs text-slate-500 italic py-3 text-center">
        Sin datos para distribuir.
      </p>
    );
  }
  const maxCount = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="space-y-1">
      {items.map((it) => (
        <div key={it.key} className="flex items-center gap-2 text-[11px]">
          <span className="w-28 truncate text-slate-300">{it.label}</span>
          <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-cyan-500 rounded-full"
              style={{ width: `${(it.count / maxCount) * 100}%` }}
            />
          </div>
          <span className="w-20 text-right text-slate-300 tabular-nums font-mono">
            {it.count} · {fmtPct(it.porcentaje)}
          </span>
        </div>
      ))}
      <p className="text-[10px] text-slate-500 text-center pt-1">
        Total: {total}
      </p>
    </div>
  );
}

// ------------------------------------------------------------
// SUBCOMPONENTE: SERIE (mini gráfico de barras)
// ------------------------------------------------------------

function MiniSerie({ puntos }: { puntos: PuntoSerie[] }) {
  if (puntos.length === 0) {
    return (
      <p className="text-xs text-slate-500 italic py-3 text-center">
        Sin puntos en la serie.
      </p>
    );
  }
  const maxY = Math.max(...puntos.map((p) => p.y), 1);
  return (
    <div>
      <div className="flex items-end gap-1.5 h-24">
        {puntos.map((p, i) => (
          <div
            key={`${p.x}-${i}`}
            className="flex-1 flex flex-col items-center gap-1"
            title={`${p.label}: ${fmt(p.y)}`}
          >
            <span className="text-[9px] text-slate-400 font-mono tabular-nums">
              {fmt(p.y, 1)}
            </span>
            <div
              className="w-full bg-violet-500 rounded-t"
              style={{
                height: `${Math.max(2, (p.y / maxY) * 70)}px`,
              }}
            />
            <span className="text-[9px] text-slate-500 truncate max-w-full">
              {p.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// RENDER PRINCIPAL
// ------------------------------------------------------------

function renderRespuesta(
  r: RespuestaConsulta,
  nombreDeJugador?: (id: string) => string
): React.ReactNode {
  switch (r.tipo) {
    case "numero":
      return (
        <TarjetaNumero
          valor={r.valor}
          unidad={r.unidad}
          detalle={r.detalle}
        />
      );

    case "porcentaje":
      return (
        <TarjetaPorcentaje
          valor={r.valor}
          count={r.count}
          base={r.base}
          detalle={r.detalle}
        />
      );

    case "promedio":
      return (
        <TarjetaPromedio
          valor={r.valor}
          n={r.n}
          detalle={r.detalle}
        />
      );

    case "frecuencia":
      return (
        <TarjetaFrecuencia
          valor={r.valor}
          base={r.base}
          count={r.count}
          detalle={r.detalle}
        />
      );

    case "max":
    case "min": {
      if (!r.fila) {
        return (
          <p className="text-xs text-slate-500 italic py-3 text-center">
            Sin resultado.
          </p>
        );
      }
      return (
        <div style={cardBase} className="p-4">
          <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
            {r.tipo === "max" ? "Máximo" : "Mínimo"}
          </p>
          <p className="text-lg font-bold text-white">{r.fila.label}</p>
          <p className="text-2xl font-black text-cyan-300 tabular-nums">
            {fmt(r.fila.valor)}
          </p>
          <p className="text-xs text-slate-400 tabular-nums">
            {r.fila.count} acciones
          </p>
          {r.detalle && (
            <p className="text-[11px] text-slate-500 mt-1 italic">
              {r.detalle}
            </p>
          )}
        </div>
      );
    }

    case "ranking":
      return (
        <div style={cardBase} className="p-3">
          <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">
            Ranking ({r.orden === "desc" ? "mayor a menor" : "menor a mayor"})
          </p>
          <TablaFilas filas={r.filas} nombreDeJugador={nombreDeJugador} />
        </div>
      );

    case "tabla":
      return (
        <div style={cardBase} className="p-3">
          <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">
            Tabla{r.groupBy ? ` por ${r.groupBy}` : ""}
          </p>
          <TablaFilas
            filas={r.filas}
            mostrarTotal
            total={r.total}
            nombreDeJugador={nombreDeJugador}
          />
        </div>
      );

    case "distribucion":
      return (
        <div style={cardBase} className="p-3">
          <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">
            Distribución{r.groupBy ? ` por ${r.groupBy}` : ""}
          </p>
          <BarrasDistribucion items={r.items} total={r.total} />
        </div>
      );

    case "serie":
      return (
        <div style={cardBase} className="p-3">
          <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">
            Serie por {r.eje}
          </p>
          <MiniSerie puntos={r.puntos} />
          {r.detalle && (
            <p className="text-[11px] text-slate-400 mt-2 italic">
              {r.detalle}
            </p>
          )}
        </div>
      );

    case "habit":
      return (
        <div style={cardBase} className="p-3">
          <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">
            Lo más frecuente
          </p>
          {r.etiqueta && (
            <p className="text-base font-bold text-amber-200 mb-2">
              {r.etiqueta}{" "}
              <span className="text-xs text-slate-400 font-medium">
                ({fmtPct(r.porcentaje)} de {r.total})
              </span>
            </p>
          )}
          <BarrasDistribucion items={r.items} total={r.total} />
        </div>
      );

    case "comparacion":
      return (
        <div style={cardBase} className="p-3">
          <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">
            Comparación
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-blue-500/10 border border-blue-400/30 p-2">
              <p className="text-[11px] font-bold text-blue-200">
                {r.a.etiqueta}
              </p>
              <p className="text-2xl font-black text-white tabular-nums">
                {fmt(r.a.valor)}
              </p>
              <p className="text-[10px] text-slate-400 tabular-nums">
                {r.a.count} de {r.a.base}
              </p>
            </div>
            <div className="rounded-lg bg-violet-500/10 border border-violet-400/30 p-2">
              <p className="text-[11px] font-bold text-violet-200">
                {r.b.etiqueta}
              </p>
              <p className="text-2xl font-black text-white tabular-nums">
                {fmt(r.b.valor)}
              </p>
              <p className="text-[10px] text-slate-400 tabular-nums">
                {r.b.count} de {r.b.base}
              </p>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 text-center">
            Diferencia:{" "}
            <span
              className={
                r.diferencia > 0
                  ? "text-emerald-300 font-bold"
                  : r.diferencia < 0
                  ? "text-rose-300 font-bold"
                  : "text-slate-300 font-bold"
              }
            >
              {r.diferencia > 0 ? "+" : ""}
              {fmt(r.diferencia)}
            </span>
          </p>
        </div>
      );

    case "texto":
      return (
        <div style={cardBase} className="p-3">
          <p className="text-sm text-white">{r.texto}</p>
          {r.detalle && (
            <p className="text-[11px] text-slate-400 mt-1 italic">
              {r.detalle}
            </p>
          )}
        </div>
      );

    case "vacio":
      return (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.08] p-3">
          <p className="text-xs text-amber-200">{r.mensaje}</p>
        </div>
      );

    default:
      return null;
  }
}

// ------------------------------------------------------------
// COMPONENTE
// ------------------------------------------------------------

export default function ConsultaResultado({
  resultado,
  nombreDeJugador,
}: Props) {
  const { respuesta, meta, parserInfo, accionesFiltradas, accionesUniverso } =
    resultado;

  const esVacia =
    respuesta.tipo === "vacio" || accionesFiltradas === 0;

  return (
    <div className="space-y-2">
      {/* Cabecera con el resumen de la consulta */}
      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
        <span className="px-1.5 py-0.5 rounded border border-cyan-400/50 bg-cyan-500/15 text-cyan-200 font-bold uppercase tracking-wider">
          {meta.intencion}
        </span>
        {meta.groupBy && (
          <span className="px-1.5 py-0.5 rounded border border-violet-400/50 bg-violet-500/15 text-violet-200 font-semibold">
            por {meta.groupBy}
          </span>
        )}
        {meta.metrica && (
          <span className="px-1.5 py-0.5 rounded border border-emerald-400/50 bg-emerald-500/15 text-emerald-200 font-semibold">
            {meta.metrica}
          </span>
        )}
        <span className="ml-auto text-slate-500 tabular-nums">
          {accionesFiltradas} / {accionesUniverso} acciones
        </span>
      </div>

      {/* FASE 7.4 — Aviso de ambigüedad de jugador */}
      {parserInfo.jugadorAmbiguo && parserInfo.jugadorAviso && (
        <div className="rounded border border-rose-500/40 bg-rose-500/10 p-2.5 space-y-1">
          <p className="text-[11px] font-bold text-rose-200">
            ⚠️ Jugador ambiguo
          </p>
          <p className="text-[11px] text-rose-100">{parserInfo.jugadorAviso}</p>
          {parserInfo.jugadorCandidatos.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {parserInfo.jugadorCandidatos.map((j) => (
                <span
                  key={j.id}
                  className="text-[10px] px-1.5 py-0.5 rounded border border-rose-500/40 bg-rose-500/10 text-rose-200 font-mono"
                >
                  {j.nombre}
                  {j.apodo ? ` "${j.apodo}"` : ""}
                  {j.numero !== null && j.numero !== undefined
                    ? ` #${j.numero}`
                    : ""}
                </span>
              ))}
            </div>
          )}
          <p className="text-[10px] text-rose-200/70 italic">
            Probá con nombre completo, apodo o #número.
          </p>
        </div>
      )}

      {/* Parser info si no se aplicó */}
      {!parserInfo.aplicado && parserInfo.sugerencias.length > 0 && (
        <div className="rounded border border-amber-500/30 bg-amber-500/[0.08] p-2 space-y-1">
          <p className="text-[10px] font-bold text-amber-200">
            No se pudo interpretar bien la consulta. Probá con:
          </p>
          <div className="flex flex-wrap gap-1">
            {parserInfo.sugerencias.slice(0, 4).map((sug, i) => (
              <span
                key={`${sug}-${i}`}
                className="text-[10px] px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-200"
              >
                {sug}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Respuesta principal */}
      {esVacia && respuesta.tipo !== "vacio" ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.08] p-3">
          <p className="text-xs text-amber-200">
            No hay acciones que cumplan con los filtros de la consulta.
          </p>
        </div>
      ) : (
        renderRespuesta(respuesta, nombreDeJugador)
      )}
    </div>
  );
}