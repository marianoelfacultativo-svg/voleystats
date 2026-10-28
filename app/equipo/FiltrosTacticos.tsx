"use client";

// ============================================================
// PANEL DE FILTROS TÁCTICOS — "conducta / secuencia"
// ============================================================
// Componente compartido por:
//   - PanelFiltros3D (3D)
//   - Partidos (detalle de partido)
//   - MiEquipo (ficha de jugador)
//   - TablaEstadisticasCrudas (bloques de tabla)
//
// Filtros:
//   - Contexto PREVIO: qué acción hubo antes (mismo punto)
//   - Contexto POSTERIOR: qué acción vino después (mismo punto)
//   - Repetición: puntos donde el jugador tocó 2+ veces
//
// La lógica pura vive en lib/filtrosTacticos.ts.
// ============================================================

import { useMemo, useState } from "react";
import {
  hayFiltrosTacticos,
  resultadosPorTipo,
  type ContextoFiltro,
  type FiltrosTacticos,
  type RelacionJugador,
  type TipoContexto,
} from "@/lib/filtrosTacticos";

// ------------------------------------------------------------
// OPCIONES
// ------------------------------------------------------------

const TIPOS: { v: TipoContexto; label: string }[] = [
  { v: "cualquiera", label: "Cualquier tipo" },
  { v: "saque", label: "Saque" },
  { v: "recepcion", label: "Recepción" },
  { v: "armado", label: "Armado" },
  { v: "ataque", label: "Ataque" },
  { v: "bloqueo", label: "Bloqueo" },
  { v: "defensa", label: "Defensa" },
  { v: "libre", label: "Libre" },
  { v: "roce-red", label: "Roce red" },
];

const RELACIONES: { v: RelacionJugador; label: string }[] = [
  { v: "cualquiera", label: "Cualquier jugador" },
  { v: "mismo", label: "El mismo jugador" },
  { v: "companero", label: "Un compañero" },
  { v: "rival", label: "Un rival" },
];

const CONTEXTO_INICIAL: ContextoFiltro = {
  tipo: "cualquiera",
  resultado: "cualquiera",
  relacionJugador: "cualquiera",
};

// ------------------------------------------------------------
// HELPERS UI
// ------------------------------------------------------------

function labelResultado(s: string): string {
  if (s === "cualquiera") return "Cualquier resultado";
  return s
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const labelCls =
  "block text-[10px] font-bold uppercase tracking-wide mb-1";
const labelStyle: React.CSSProperties = {
  color: "var(--sx-text-secondary)",
};
const selectCls = "input-dark text-xs";

// ------------------------------------------------------------
// PROPS
// ------------------------------------------------------------

interface Props {
  filtros: FiltrosTacticos;
  onChange: (f: FiltrosTacticos) => void;
  /**
   * Nombre del jugador filtrado (si ya hay un filtro `jugador` activo).
   * Solo se usa como texto de ayuda en la sección Repetición.
   */
  jugadorFiltradoNombre?: string | null;
  /** Texto opcional para el header (default: "Conducta / Secuencia"). */
  titulo?: string;
}

// ------------------------------------------------------------
// COMPONENTE
// ------------------------------------------------------------

export default function FiltrosTacticos({
  filtros,
  onChange,
  jugadorFiltradoNombre,
  titulo = "Conducta / Secuencia",
}: Props) {
  const [abierto, setAbierto] = useState(false);

  const cantActivos = useMemo(() => {
    let n = 0;
    if (filtros.contextoPrevio) n++;
    if (filtros.contextoPosterior) n++;
    if (filtros.repeticion) n++;
    return n;
  }, [filtros]);

  const activoAlguno = hayFiltrosTacticos(filtros);

  const limpiar = () =>
    onChange({
      contextoPrevio: null,
      contextoPosterior: null,
      repeticion: null,
    });

  const togglePrevio = () => {
    onChange({
      ...filtros,
      contextoPrevio: filtros.contextoPrevio ? null : { ...CONTEXTO_INICIAL },
    });
  };

  const togglePosterior = () => {
    onChange({
      ...filtros,
      contextoPosterior: filtros.contextoPosterior
        ? null
        : { ...CONTEXTO_INICIAL },
    });
  };

  const toggleRepeticion = () => {
    onChange({
      ...filtros,
      repeticion: filtros.repeticion
        ? null
        : { veces: "2+", porJugador: "mismo" },
    });
  };

  const actualizarPrevio = (parcial: Partial<ContextoFiltro>) => {
    if (!filtros.contextoPrevio) return;
    onChange({
      ...filtros,
      contextoPrevio: { ...filtros.contextoPrevio, ...parcial },
    });
  };

  const actualizarPosterior = (parcial: Partial<ContextoFiltro>) => {
    if (!filtros.contextoPosterior) return;
    onChange({
      ...filtros,
      contextoPosterior: { ...filtros.contextoPosterior, ...parcial },
    });
  };

  return (
    <div
      className="pt-2"
      style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
    >
      {/* ---------- HEADER ---------- */}
      <button
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center justify-between text-[11px] font-bold uppercase tracking-wider"
        style={{ color: "var(--sx-text-primary)" }}
      >
        <span className="flex items-center gap-1.5">
          {titulo}
          {cantActivos > 0 && (
            <span
              className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
              style={{
                background: "rgba(167,139,250,0.2)",
                color: "#C4B5FD",
                border: "1px solid rgba(167,139,250,0.4)",
              }}
            >
              {cantActivos}
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
        <div className="mt-2 space-y-3">
          {/* AYUDA GENERAL */}
          <p
            className="text-[10px] leading-relaxed italic"
            style={{ color: "var(--sx-text-muted)" }}
          >
            Los filtros miran la acción anterior / posterior <strong>dentro
            del mismo punto</strong>. Sirven para consultas tipo
            &quot;armados después de un error de recepción&quot; o
            &quot;puntos donde el armador tocó 2+ veces&quot;.
          </p>

          {activoAlguno && (
            <div className="flex justify-end">
              <button
                onClick={limpiar}
                className="text-[10px] font-semibold"
                style={{ color: "#F87171" }}
              >
                ✕ Limpiar filtros tácticos
              </button>
            </div>
          )}

          {/* ---------- CONTEXTO PREVIO ---------- */}
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
                ↶ Antes de esta acción
              </span>
              <button
                onClick={togglePrevio}
                className={`px-2 py-0.5 text-[10px] font-bold rounded border-2 transition ${
                  filtros.contextoPrevio
                    ? "bg-violet-500 text-white border-violet-500 hover:bg-violet-600"
                    : "bg-white/5 text-slate-300 border-white/15 hover:bg-white/10"
                }`}
              >
                {filtros.contextoPrevio ? "✓ Activo" : "Activar"}
              </button>
            </div>

            {filtros.contextoPrevio && (
              <div className="grid grid-cols-3 gap-1.5 mt-2">
                <div>
                  <label className={labelCls} style={labelStyle}>
                    Tipo
                  </label>
                  <select
                    value={filtros.contextoPrevio.tipo}
                    onChange={(e) =>
                      actualizarPrevio({
                        tipo: e.target.value as TipoContexto,
                        // Al cambiar tipo, reseteamos resultado
                        resultado: "cualquiera",
                      })
                    }
                    className={selectCls}
                  >
                    {TIPOS.map((t) => (
                      <option key={t.v} value={t.v}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelCls} style={labelStyle}>
                    Resultado
                  </label>
                  <select
                    value={filtros.contextoPrevio.resultado}
                    onChange={(e) =>
                      actualizarPrevio({ resultado: e.target.value })
                    }
                    disabled={filtros.contextoPrevio.tipo === "cualquiera"}
                    className={`${selectCls} disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    {resultadosPorTipo(filtros.contextoPrevio.tipo).map(
                      (r) => (
                        <option key={r} value={r}>
                          {labelResultado(r)}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className={labelCls} style={labelStyle}>
                    Jugador
                  </label>
                  <select
                    value={filtros.contextoPrevio.relacionJugador}
                    onChange={(e) =>
                      actualizarPrevio({
                        relacionJugador: e.target.value as RelacionJugador,
                      })
                    }
                    className={selectCls}
                  >
                    {RELACIONES.map((r) => (
                      <option key={r.v} value={r.v}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {filtros.contextoPrevio && (
              <p
                className="text-[9px] mt-1.5 leading-snug"
                style={{ color: "var(--sx-text-muted)" }}
              >
                Ej: tipo <strong>Recepción</strong> + resultado{" "}
                <strong>Negativa</strong> → solo acciones que vinieron
                después de una recepción negativa.
              </p>
            )}
          </div>

          {/* ---------- CONTEXTO POSTERIOR ---------- */}
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
                ↷ Después de esta acción
              </span>
              <button
                onClick={togglePosterior}
                className={`px-2 py-0.5 text-[10px] font-bold rounded border-2 transition ${
                  filtros.contextoPosterior
                    ? "bg-violet-500 text-white border-violet-500 hover:bg-violet-600"
                    : "bg-white/5 text-slate-300 border-white/15 hover:bg-white/10"
                }`}
              >
                {filtros.contextoPosterior ? "✓ Activo" : "Activar"}
              </button>
            </div>

            {filtros.contextoPosterior && (
              <div className="grid grid-cols-3 gap-1.5 mt-2">
                <div>
                  <label className={labelCls} style={labelStyle}>
                    Tipo
                  </label>
                  <select
                    value={filtros.contextoPosterior.tipo}
                    onChange={(e) =>
                      actualizarPosterior({
                        tipo: e.target.value as TipoContexto,
                        resultado: "cualquiera",
                      })
                    }
                    className={selectCls}
                  >
                    {TIPOS.map((t) => (
                      <option key={t.v} value={t.v}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelCls} style={labelStyle}>
                    Resultado
                  </label>
                  <select
                    value={filtros.contextoPosterior.resultado}
                    onChange={(e) =>
                      actualizarPosterior({ resultado: e.target.value })
                    }
                    disabled={filtros.contextoPosterior.tipo === "cualquiera"}
                    className={`${selectCls} disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    {resultadosPorTipo(filtros.contextoPosterior.tipo).map(
                      (r) => (
                        <option key={r} value={r}>
                          {labelResultado(r)}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className={labelCls} style={labelStyle}>
                    Jugador
                  </label>
                  <select
                    value={filtros.contextoPosterior.relacionJugador}
                    onChange={(e) =>
                      actualizarPosterior({
                        relacionJugador: e.target.value as RelacionJugador,
                      })
                    }
                    className={selectCls}
                  >
                    {RELACIONES.map((r) => (
                      <option key={r.v} value={r.v}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {filtros.contextoPosterior && (
              <p
                className="text-[9px] mt-1.5 leading-snug"
                style={{ color: "var(--sx-text-muted)" }}
              >
                Ej: tipo <strong>Ataque</strong> + resultado{" "}
                <strong>Error</strong> → solo acciones cuyo ataque siguiente
                terminó en error.
              </p>
            )}
          </div>

          {/* ---------- REPETICIÓN ---------- */}
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
                ↻ Repetición en el punto
              </span>
              <button
                onClick={toggleRepeticion}
                className={`px-2 py-0.5 text-[10px] font-bold rounded border-2 transition ${
                  filtros.repeticion
                    ? "bg-violet-500 text-white border-violet-500 hover:bg-violet-600"
                    : "bg-white/5 text-slate-300 border-white/15 hover:bg-white/10"
                }`}
              >
                {filtros.repeticion ? "✓ Activo" : "Activar"}
              </button>
            </div>

            {filtros.repeticion && (
              <div className="grid grid-cols-2 gap-1.5 mt-2">
                <div>
                  <label className={labelCls} style={labelStyle}>
                    Mínimo
                  </label>
                  <select
                    value={filtros.repeticion.veces}
                    onChange={(e) =>
                      onChange({
                        ...filtros,
                        repeticion: {
                          ...filtros.repeticion!,
                          veces: e.target.value as "2+" | "3+",
                        },
                      })
                    }
                    className={selectCls}
                  >
                    <option value="2+">2 o más veces</option>
                    <option value="3+">3 o más veces</option>
                  </select>
                </div>

                <div>
                  <label className={labelCls} style={labelStyle}>
                    De quién
                  </label>
                  <select
                    value={filtros.repeticion.porJugador}
                    onChange={(e) =>
                      onChange({
                        ...filtros,
                        repeticion: {
                          ...filtros.repeticion!,
                          porJugador: e.target.value as "mismo" | "cualquiera",
                        },
                      })
                    }
                    className={selectCls}
                  >
                    <option value="mismo">
                      {jugadorFiltradoNombre
                        ? `El mismo jugador (${jugadorFiltradoNombre})`
                        : "El mismo jugador (filtrado)"}
                    </option>
                    <option value="cualquiera">Cualquier jugador</option>
                  </select>
                </div>
              </div>
            )}

            {filtros.repeticion && (
              <p
                className="text-[9px] mt-1.5 leading-snug"
                style={{ color: "var(--sx-text-muted)" }}
              >
                {filtros.repeticion.porJugador === "mismo" ? (
                  <>
                    Muestra solo los puntos donde{" "}
                    <strong>
                      {jugadorFiltradoNombre ?? "el jugador filtrado"}
                    </strong>{" "}
                    tocó {filtros.repeticion.veces === "2+" ? "2" : "3"}+
                    veces.
                    {!jugadorFiltradoNombre && (
                      <>
                        {" "}
                        (activá un filtro de jugador para que sea útil)
                      </>
                    )}
                  </>
                ) : (
                  <>
                    Muestra solo los puntos donde{" "}
                    <strong>algún jugador</strong> tocó{" "}
                    {filtros.repeticion.veces === "2+" ? "2" : "3"}+ veces.
                  </>
                )}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}