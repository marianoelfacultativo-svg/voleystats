"use client";

// ============================================================
// ANÁLISIS DE CONSECUENCIAS — panel de UI
// ============================================================
// "Si pasa X, ¿qué pasa después?"
//
// Responde preguntas tipo:
//   - "Si el ataque fue error → ¿quién ataca después?"
//   - "¿El mismo jugador que erró vuelve a atacar?"
//   - "¿El armador le armó a la misma zona que antes?"
//   - "¿Con la misma velocidad? ¿Al mismo receptor?"
//
// La lógica pura vive en lib/analisisConsecuencias.ts.
// ============================================================

import { useMemo, useState } from "react";
import {
  analizarConsecuencias,
  etiquetaResultado,
  etiquetaTipoDisparador,
  hayComparadoresActivos,
  hayFiltroAnalisisActivo,
  resultadosPorTipoAnalisis,
  type CoincidenciaFiltro,
  type DisparadorFiltro,
  type FiltrosAnalisis,
  type ResultadoAnalisis,
  type TipoDisparador,
  type Ventana,
} from "@/lib/analisisConsecuencias";
import type { AccionVisual } from "./adaptadorUnificadoV2";

// ------------------------------------------------------------
// OPCIONES
// ------------------------------------------------------------

const TIPOS: { v: TipoDisparador; label: string }[] = [
  { v: "saque", label: "Saque" },
  { v: "recepcion", label: "Recepción" },
  { v: "armado", label: "Armado" },
  { v: "ataque", label: "Ataque" },
  { v: "bloqueo", label: "Bloqueo" },
  { v: "defensa", label: "Defensa" },
  { v: "libre", label: "Libre" },
  { v: "roce-red", label: "Roce red" },
];

const VENTANAS: { v: Ventana; label: string }[] = [
  { v: 1, label: "1 siguiente" },
  { v: 2, label: "2 siguientes" },
  { v: 3, label: "3 siguientes" },
  { v: "todas", label: "Todas" },
];

const COMPARADORES: {
  key: keyof CoincidenciaFiltro;
  label: string;
  grupo: "trigger" | "anterior";
}[] = [
  {
    key: "mismoJugadorTrigger",
    label: "Mismo jugador que el disparador",
    grupo: "trigger",
  },
  {
    key: "mismaZonaTriggerDestino",
    label: "Misma zona destino que el disparador",
    grupo: "trigger",
  },
  {
    key: "mismaZonaTriggerOrigen",
    label: "Misma zona origen que el disparador",
    grupo: "trigger",
  },
  {
    key: "mismaZonaAnteriorOrigen",
    label: "Misma zona origen que la acción anterior",
    grupo: "anterior",
  },
  {
    key: "mismaZonaAnteriorDestino",
    label: "Misma zona destino que la acción anterior",
    grupo: "anterior",
  },
  {
    key: "mismaVelocidadAnterior",
    label: "Misma velocidad de armado que la anterior",
    grupo: "anterior",
  },
  {
    key: "mismoTipoSaqueAnterior",
    label: "Mismo tipo de saque que la anterior",
    grupo: "anterior",
  },
  {
    key: "mismoReceptorAnterior",
    label: "Mismo jugador que la acción anterior",
    grupo: "anterior",
  },
];

const labelCls =
  "block text-[10px] font-bold uppercase tracking-wide mb-1";
const labelStyle: React.CSSProperties = {
  color: "var(--sx-text-secondary)",
};
const selectCls = "input-dark text-xs";

const cardBase: React.CSSProperties = {
  background: "var(--sx-surface-1)",
  border: "1px solid var(--sx-border)",
  boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
};

// ------------------------------------------------------------
// PROPS
// ------------------------------------------------------------

interface Props {
  acciones: AccionVisual[];
  /** Callback opcional para llevar al usuario al punto de una ocurrencia. */
  onIrAPunto?: (set: number, punto: number) => void;
  nombreDeJugador?: (id: string | null) => string;
  /** Título (default: "Análisis de consecuencias"). */
  titulo?: string;
}

// ------------------------------------------------------------
// COMPONENTE
// ------------------------------------------------------------

export default function AnalisisConsecuencias({
  acciones,
  onIrAPunto,
  nombreDeJugador,
  titulo = "Análisis de consecuencias",
}: Props) {
  const [disparador, setDisparador] = useState<DisparadorFiltro | null>(null);
  const [ventana, setVentana] = useState<Ventana>(1);
  const [coincidencias, setCoincidencias] = useState<CoincidenciaFiltro>({
    mismoJugadorTrigger: false,
    mismaZonaTriggerDestino: false,
    mismaZonaTriggerOrigen: false,
    mismaZonaAnteriorOrigen: false,
    mismaZonaAnteriorDestino: false,
    mismaVelocidadAnterior: false,
    mismoTipoSaqueAnterior: false,
    mismoReceptorAnterior: false,
  });
  const [abierto, setAbierto] = useState(true);

  const filtros: FiltrosAnalisis = useMemo(
    () => ({ disparador, ventana, coincidencias }),
    [disparador, ventana, coincidencias]
  );

  const resultado: ResultadoAnalisis | null = useMemo(() => {
    if (!disparador) return null;
    return analizarConsecuencias(acciones, filtros);
  }, [acciones, filtros, disparador]);

  const hayComparadores = hayComparadoresActivos(coincidencias);
  const activo = hayFiltroAnalisisActivo(filtros);

  const nombre = (id: string | null) => {
    if (!id) return "—";
    if (nombreDeJugador) return nombreDeJugador(id);
    return id.slice(0, 8);
  };

  const activarDisparador = () => {
    setDisparador(
      disparador ? null : { tipo: "ataque", resultado: "error" }
    );
  };

  const toggleComparador = (key: keyof CoincidenciaFiltro) => {
    setCoincidencias((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const limpiar = () => {
    setDisparador(null);
    setVentana(1);
    setCoincidencias({
      mismoJugadorTrigger: false,
      mismaZonaTriggerDestino: false,
      mismaZonaTriggerOrigen: false,
      mismaZonaAnteriorOrigen: false,
      mismaZonaAnteriorDestino: false,
      mismaVelocidadAnterior: false,
      mismoTipoSaqueAnterior: false,
      mismoReceptorAnterior: false,
    });
  };

  const pct = (num: number, den: number) => {
    if (den === 0) return "0%";
    return `${Math.round((num / den) * 100)}%`;
  };

  return (
    <div className="rounded-2xl p-3 space-y-3" style={cardBase}>
      {/* Header colapsable */}
      <button
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center justify-between"
      >
        <span
          className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-2"
          style={{ color: "var(--sx-text-primary)" }}
        >
          🔍 {titulo}
          {activo && resultado && (
            <span
              className="text-[9px] px-1.5 py-0.5 rounded-full font-bold normal-case tracking-normal"
              style={{
                background: "rgba(167,139,250,0.2)",
                color: "#C4B5FD",
                border: "1px solid rgba(167,139,250,0.4)",
              }}
            >
              {resultado.totalOcurrencias} caso
              {resultado.totalOcurrencias !== 1 ? "s" : ""}
            </span>
          )}
        </span>
        <span
          className="transition-transform"
          style={{
            color: "var(--sx-text-muted)",
            transform: abierto ? "rotate(180deg)" : "none",
          }}
        >
          ▼
        </span>
      </button>

      {abierto && (
        <div className="space-y-3">
          <p
            className="text-[10px] leading-relaxed italic"
            style={{ color: "var(--sx-text-muted)" }}
          >
            Elegí un <strong>disparador</strong> (ej. ataque con error) y
            el sistema te muestra <strong>qué vino después</strong> en cada
            punto. Podés filtrar por comparadores para responder
            preguntas como &quot;¿el mismo jugador que erró volvió a
            atacar?&quot; o &quot;¿el armador le armó a la misma zona?&quot;.
          </p>

          {/* ---------- DISPARADOR ---------- */}
          <div
            className="rounded-xl p-2.5"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid var(--sx-border)",
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <span
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: "var(--sx-text-primary)" }}
              >
                🎯 Disparador — &quot;si pasa...&quot;
              </span>
              <button
                onClick={activarDisparador}
                className={`px-2 py-0.5 text-[10px] font-bold rounded border-2 transition ${
                  disparador
                    ? "bg-violet-500 text-white border-violet-500 hover:bg-violet-600"
                    : "bg-white/5 text-slate-300 border-white/15 hover:bg-white/10"
                }`}
              >
                {disparador ? "✓ Activo" : "Activar"}
              </button>
            </div>

            {disparador && (
              <div className="grid grid-cols-2 gap-1.5 mt-2">
                <div>
                  <label className={labelCls} style={labelStyle}>
                    Tipo
                  </label>
                  <select
                    value={disparador.tipo}
                    onChange={(e) =>
                      setDisparador({
                        tipo: e.target.value as TipoDisparador,
                        resultado: "cualquiera",
                      })
                    }
                    className={selectCls}
                  >
                    {TIPOS.map((t) => (
                      <option key={t.v} value={t.v}>
                        {etiquetaTipoDisparador(t.v)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls} style={labelStyle}>
                    Resultado
                  </label>
                  <select
                    value={disparador.resultado}
                    onChange={(e) =>
                      setDisparador({
                        ...disparador,
                        resultado: e.target.value,
                      })
                    }
                    className={selectCls}
                  >
                    {resultadosPorTipoAnalisis(disparador.tipo).map((r) => (
                      <option key={r} value={r}>
                        {etiquetaResultado(r)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {disparador && (
              <div className="mt-2">
                <label className={labelCls} style={labelStyle}>
                  Ventana (cuántas acciones después mirar)
                </label>
                <div className="flex flex-wrap gap-1">
                  {VENTANAS.map((v) => {
                    const act = ventana === v.v;
                    return (
                      <button
                        key={String(v.v)}
                        onClick={() => setVentana(v.v)}
                        className={`px-2 py-0.5 text-[10px] font-semibold rounded border transition ${
                          act
                            ? "bg-violet-500 text-white border-violet-500"
                            : "bg-white/5 text-slate-300 border-white/15 hover:bg-white/10"
                        }`}
                      >
                        {v.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ---------- COMPARADORES ---------- */}
          {disparador && (
            <div
              className="rounded-xl p-2.5"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid var(--sx-border)",
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: "var(--sx-text-primary)" }}
                >
                  ⚖️ Comparadores (opcional)
                </span>
                {hayComparadores && (
                  <button
                    onClick={() =>
                      setCoincidencias({
                        mismoJugadorTrigger: false,
                        mismaZonaTriggerDestino: false,
                        mismaZonaTriggerOrigen: false,
                        mismaZonaAnteriorOrigen: false,
                        mismaZonaAnteriorDestino: false,
                        mismaVelocidadAnterior: false,
                        mismoTipoSaqueAnterior: false,
                        mismoReceptorAnterior: false,
                      })
                    }
                    className="text-[10px] font-semibold"
                    style={{ color: "#F87171" }}
                  >
                    ✕ Quitar todos
                  </button>
                )}
              </div>

              <p
                className="text-[9px] mb-2"
                style={{ color: "var(--sx-text-muted)" }}
              >
                Sirven para medir cuántas veces la <strong>próxima
                acción</strong> repite algo del disparador o de la acción
                anterior (ej. mismo jugador, misma zona, misma velocidad).
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                {(["trigger", "anterior"] as const).map((grupo) => (
                  <div key={grupo} className="space-y-1">
                    <p
                      className="text-[9px] font-bold uppercase tracking-wider"
                      style={{
                        color: grupo === "trigger" ? "#93C5FD" : "#FBBF24",
                      }}
                    >
                      {grupo === "trigger"
                        ? "Respecto al disparador"
                        : "Respecto a la acción anterior"}
                    </p>
                    {COMPARADORES.filter((c) => c.grupo === grupo).map(
                      (c) => {
                        const act = coincidencias[c.key];
                        return (
                          <button
                            key={c.key}
                            onClick={() => toggleComparador(c.key)}
                            className={`w-full text-left px-2 py-1 text-[10px] font-medium rounded border transition flex items-center gap-1.5 ${
                              act
                                ? "bg-violet-500/20 text-violet-200 border-violet-500/50"
                                : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"
                            }`}
                          >
                            <span
                              className="w-3 h-3 rounded-sm border flex items-center justify-center shrink-0"
                              style={{
                                borderColor: act ? "#A78BFA" : "rgba(255,255,255,0.3)",
                                background: act ? "#7C3AED" : "transparent",
                              }}
                            >
                              {act && (
                                <span className="text-[8px] text-white font-bold">
                                  ✓
                                </span>
                              )}
                            </span>
                            <span className="truncate">{c.label}</span>
                          </button>
                        );
                      }
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activo && (
            <div className="flex justify-end">
              <button
                onClick={limpiar}
                className="text-[10px] font-semibold"
                style={{ color: "#F87171" }}
              >
                ✕ Limpiar análisis
              </button>
            </div>
          )}

          {/* ---------- RESULTADOS ---------- */}
          {resultado && (
            <ResultadosPanel
              resultado={resultado}
              ventana={ventana}
              hayComparadores={hayComparadores}
              nombreDe={nombre}
              onIrAPunto={onIrAPunto}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// SUBCOMPONENTE: panel de resultados
// ============================================================

function ResultadosPanel({
  resultado,
  ventana,
  hayComparadores,
  nombreDe,
  onIrAPunto,
}: {
  resultado: ResultadoAnalisis;
  ventana: Ventana;
  hayComparadores: boolean;
  nombreDe: (id: string | null) => string;
  onIrAPunto?: (set: number, punto: number) => void;
}) {
  const {
    totalOcurrencias,
    ocurrencias,
    distribucionSiguiente,
    distribucionSubtipo,
    resumenPorTipo,
    coincidenciasGlobales,
  } = resultado;

  if (totalOcurrencias === 0) {
    return (
      <div
        className="rounded-xl p-3 text-center text-xs"
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid var(--sx-border)",
          color: "var(--sx-text-muted)",
        }}
      >
        Ningún punto dispara esta condición en las acciones actuales.
      </div>
    );
  }

  const totalesTipos = Object.values(distribucionSiguiente).reduce(
    (s, v) => s + v,
    0
  );

  const comparadores: {
    key: keyof typeof coincidenciasGlobales;
    label: string;
  }[] = [
    { key: "mismoJugadorTrigger", label: "Mismo jugador que el disparador" },
    { key: "mismaZonaTriggerDestino", label: "Misma zona destino que el disparador" },
    { key: "mismaZonaTriggerOrigen", label: "Misma zona origen que el disparador" },
    { key: "mismaZonaAnteriorOrigen", label: "Misma zona origen que la anterior" },
    { key: "mismaZonaAnteriorDestino", label: "Misma zona destino que la anterior" },
    { key: "mismaVelocidadAnterior", label: "Misma velocidad de armado" },
    { key: "mismoTipoSaqueAnterior", label: "Mismo tipo de saque" },
    { key: "mismoReceptorAnterior", label: "Mismo jugador que la anterior" },
  ];

  return (
    <div className="space-y-3">
      {/* Resumen total */}
      <div
        className="rounded-xl p-3"
        style={{
          background: "rgba(167,139,250,0.08)",
          border: "1px solid rgba(167,139,250,0.3)",
        }}
      >
        <p
          className="text-[10px] font-bold uppercase tracking-wider"
          style={{ color: "#C4B5FD" }}
        >
          {totalOcurrencias} ocurrencia{totalOcurrencias !== 1 ? "s" : ""} del
          disparador
        </p>
        <p
          className="text-[10px] mt-1 leading-relaxed"
          style={{ color: "var(--sx-text-secondary)" }}
        >
          Cada ocurrencia cuenta como 1. Los porcentajes de abajo se
          calculan sobre las que tuvieron al menos una acción siguiente
          dentro de la ventana elegida ({ventana === "todas" ? "todas" : ventana}).
        </p>
      </div>

      {/* Distribución del siguiente tipo */}
      <div
        className="rounded-xl p-3"
        style={{
          background: "var(--sx-surface-2)",
          border: "1px solid var(--sx-border)",
        }}
      >
        <p
          className="text-[10px] font-bold uppercase tracking-wider mb-2"
          style={{ color: "var(--sx-text-primary)" }}
        >
          ¿Qué vino después?
        </p>
        {totalesTipos === 0 ? (
          <p
            className="text-[10px] italic"
            style={{ color: "var(--sx-text-muted)" }}
          >
            Ninguna ocurrencia tiene acciones siguientes en la ventana
            actual.
          </p>
        ) : (
          <div className="space-y-1.5">
            {resumenPorTipo.map((r) => {
              const p = (r.count / totalesTipos) * 100;
              return (
                <div key={r.tipo}>
                  <div className="flex items-center justify-between text-[11px] mb-0.5">
                    <span className="font-semibold text-white capitalize">
                      {r.tipo}
                    </span>
                    <span
                      className="tabular-nums"
                      style={{ color: "var(--sx-text-secondary)" }}
                    >
                      {r.count} · {Math.round(p)}%
                    </span>
                  </div>
                  <div
                    className="h-1.5 rounded overflow-hidden"
                    style={{ background: "rgba(255,255,255,0.06)" }}
                  >
                    <div
                      className="h-full rounded"
                      style={{
                        width: `${p}%`,
                        background:
                          "linear-gradient(90deg, #A78BFA 0%, #38BDF8 100%)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Distribución por subtipo */}
      {Object.keys(distribucionSubtipo).length > 0 && (
        <div
          className="rounded-xl p-3"
          style={{
            background: "var(--sx-surface-2)",
            border: "1px solid var(--sx-border)",
          }}
        >
          <p
            className="text-[10px] font-bold uppercase tracking-wider mb-2"
            style={{ color: "var(--sx-text-primary)" }}
          >
            Subtipos específicos
          </p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(distribucionSubtipo)
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => {
                const [tipo, sub] = k.split("|");
                return (
                  <span
                    key={k}
                    className="px-2 py-0.5 text-[10px] rounded-md"
                    style={{
                      background: "rgba(56,189,248,0.12)",
                      border: "1px solid rgba(56,189,248,0.3)",
                      color: "#7DD3FC",
                    }}
                  >
                    <strong className="capitalize">{tipo}</strong>
                    {sub !== "—" && ` · ${sub}`}{" "}
                    <span className="tabular-nums">×{v}</span>
                  </span>
                );
              })}
          </div>
        </div>
      )}

      {/* Comparadores globales */}
      {hayComparadores && (
        <div
          className="rounded-xl p-3"
          style={{
            background: "var(--sx-surface-2)",
            border: "1px solid var(--sx-border)",
          }}
        >
          <p
            className="text-[10px] font-bold uppercase tracking-wider mb-2"
            style={{ color: "var(--sx-text-primary)" }}
          >
            Coincidencias con la 1ª acción siguiente
          </p>
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  color: "var(--sx-text-secondary)",
                }}
              >
                <th className="text-left py-1.5 px-2 font-semibold uppercase text-[9px] tracking-wider">
                  Comparador
                </th>
                <th className="text-right py-1.5 px-2 font-semibold uppercase text-[9px] tracking-wider">
                  Cuenta
                </th>
                <th className="text-right py-1.5 px-2 font-semibold uppercase text-[9px] tracking-wider">
                  %
                </th>
              </tr>
            </thead>
            <tbody>
              {comparadores.map((c) => {
                const val = coincidenciasGlobales[c.key];
                if (val === 0 && !hayComparadores) return null;
                return (
                  <tr
                    key={c.key}
                    style={{
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                    }}
                  >
                    <td
                      className="py-1.5 px-2"
                      style={{ color: "var(--sx-text-secondary)" }}
                    >
                      {c.label}
                    </td>
                    <td className="py-1.5 px-2 text-right text-white font-semibold tabular-nums">
                      {val}
                    </td>
                    <td
                      className="py-1.5 px-2 text-right tabular-nums"
                      style={{
                        color: val > 0 ? "#34D399" : "var(--sx-text-muted)",
                      }}
                    >
                      {totalOcurrencias > 0
                        ? `${Math.round((val / totalOcurrencias) * 100)}%`
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Tabla de ocurrencias */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: "var(--sx-surface-2)",
          border: "1px solid var(--sx-border)",
        }}
      >
        <div
          className="px-3 py-2 flex items-center justify-between"
          style={{
            borderBottom: "1px solid var(--sx-border)",
            background: "rgba(255,255,255,0.03)",
          }}
        >
          <p
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color: "var(--sx-text-primary)" }}
          >
            Detalle de ocurrencias
          </p>
          <span
            className="text-[10px]"
            style={{ color: "var(--sx-text-muted)" }}
          >
            {ocurrencias.length} punto{ocurrencias.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="w-full text-[11px] border-collapse min-w-[520px]">
            <thead
              style={{
                position: "sticky",
                top: 0,
                background: "rgba(15,29,53,0.98)",
                borderBottom: "1px solid var(--sx-border)",
              }}
            >
              <tr
                style={{
                  color: "var(--sx-text-secondary)",
                }}
              >
                <th className="text-left py-2 px-2 font-semibold uppercase text-[9px] tracking-wider">
                  Set-P
                </th>
                <th className="text-left py-2 px-2 font-semibold uppercase text-[9px] tracking-wider">
                  Disparador
                </th>
                <th className="text-left py-2 px-2 font-semibold uppercase text-[9px] tracking-wider">
                  Siguiente
                </th>
                {onIrAPunto && (
                  <th className="text-right py-2 px-2 font-semibold uppercase text-[9px] tracking-wider">
                    Ir
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {ocurrencias.map((o) => {
                const s0 = o.siguientes[0] ?? null;
                return (
                  <tr
                    key={`${o.set_numero}-${o.punto_numero}-${o.triggerId}`}
                    style={{
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                    }}
                  >
                    <td
                      className="py-1.5 px-2 font-mono text-[10px] tabular-nums"
                      style={{ color: "var(--sx-text-muted)" }}
                    >
                      S{o.set_numero}·P{o.punto_numero}
                    </td>
                    <td className="py-1.5 px-2">
                      <div className="flex flex-col">
                        <span className="text-white font-semibold capitalize">
                          {o.triggerSubtipo
                            ? `${o.triggerSubtipo}`
                            : "—"}
                        </span>
                        <span
                          className="text-[10px]"
                          style={{ color: "var(--sx-text-secondary)" }}
                        >
                          {nombreDe(o.triggerJugadorId)}
                        </span>
                      </div>
                    </td>
                    <td className="py-1.5 px-2">
                      {s0 ? (
                        <div className="flex flex-col">
                          <span className="text-white font-semibold capitalize">
                            {s0.tipo}
                            {s0.subtipo !== null &&
                              s0.subtipo !== undefined &&
                              ` · ${String(s0.subtipo)}`}
                          </span>
                          <span
                            className="text-[10px]"
                            style={{ color: "var(--sx-text-secondary)" }}
                          >
                            {nombreDe(s0.jugador_id)}
                            {s0.zona_destino !== null &&
                              ` · Z${s0.zona_destino}`}
                          </span>
                        </div>
                      ) : (
                        <span
                          className="italic"
                          style={{ color: "var(--sx-text-muted)" }}
                        >
                          fin del punto
                        </span>
                      )}
                    </td>
                    {onIrAPunto && (
                      <td className="py-1.5 px-2 text-right">
                        <button
                          onClick={() =>
                            onIrAPunto(o.set_numero, o.punto_numero)
                          }
                          className="px-2 py-0.5 text-[10px] font-semibold rounded border"
                          style={{
                            background: "rgba(56,189,248,0.12)",
                            borderColor: "rgba(56,189,248,0.35)",
                            color: "#7DD3FC",
                          }}
                        >
                          →
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}