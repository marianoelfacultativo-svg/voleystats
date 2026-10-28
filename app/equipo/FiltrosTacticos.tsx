"use client";

// ============================================================
// PANEL DE FILTROS TÁCTICOS — "conducta / secuencia / contexto"
// ============================================================
// Secciones colapsables:
//   - Rally (fase, primer toque, mínimo de toques, inicio de punto)
//   - Ubicación (delantero / zaguero / líbero)
//   - Marcador (estado, diferencia, punto crítico)
//   - Racha (mínima de ganados/perdidos)
//   - Vs promedio (por encima / por debajo)
//   - Antes de esta acción
//   - Después de esta acción
//   - Repetición en el punto
//   - Comparadores (contra trigger / anterior)
//
// La lógica pura vive en lib/filtrosTacticos.ts.
// ============================================================

import { useMemo, useState } from "react";
import {
  hayFiltrosTacticos,
  resultadosPorTipo,
  type ContextoFiltro,
  type FiltrosTacticos as FiltrosTacticosTipo,
  type RallyFiltro,
  type MarcadorFiltro,
  type UbicacionFiltro,
  type VsPromedioFiltro,
  type RelacionJugador,
  type TipoContexto,
  type FaseRallyFiltro,
} from "@/lib/filtrosTacticos";
import type {
  InicioPunto,
  UbicacionJugador,
  EstadoMarcador,
  DiferenciaMarcador,
} from "@/lib/contextoRally";

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

const FASES: { v: FaseRallyFiltro; label: string }[] = [
  { v: "cualquiera", label: "Cualquier fase" },
  { v: "side-out", label: "Side-out (recepción → ataque)" },
  { v: "contraataque", label: "Contraataque (def/bloq → ataque)" },
  { v: "free-ball", label: "Free ball (libre rival → ataque)" },
  { v: "otro", label: "Otro / sin clasificar" },
];

const INICIOS: { v: InicioPunto | "cualquiera"; label: string }[] = [
  { v: "cualquiera", label: "Cualquier inicio" },
  { v: "ace_propio", label: "Ace propio" },
  { v: "ace_rival", label: "Ace rival" },
  { v: "recepcion_positiva", label: "Recepción positiva" },
  { v: "recepcion_neutra", label: "Recepción neutra" },
  { v: "recepcion_negativa", label: "Recepción negativa" },
  { v: "overpass", label: "Overpass" },
  { v: "error_directo", label: "Error directo" },
  { v: "otro", label: "Otro" },
];

const UBICACIONES: { v: UbicacionFiltro; label: string }[] = [
  { v: "cualquiera", label: "Cualquier ubicación" },
  { v: "delantero", label: "Delantero (Z2, Z3, Z4)" },
  { v: "zaguero", label: "Zaguero (Z1, Z5, Z6)" },
  { v: "libero", label: "Líbero" },
  { v: "otro", label: "Otro / sin zona" },
];

const ESTADOS: { v: EstadoMarcador | "cualquiera"; label: string }[] = [
  { v: "cualquiera", label: "Cualquier estado" },
  { v: "empatado", label: "Empatados" },
  { v: "ganando", label: "Ganando" },
  { v: "perdiendo", label: "Perdiendo" },
];

const DIFERENCIAS: { v: DiferenciaMarcador | "cualquiera"; label: string }[] = [
  { v: "cualquiera", label: "Cualquier diferencia" },
  { v: "0", label: "Empate (0)" },
  { v: "1-2", label: "1-2 puntos" },
  { v: "3-5", label: "3-5 puntos" },
  { v: "6+", label: "6+ puntos" },
];

const VS_PROMEDIO: { v: VsPromedioFiltro; label: string }[] = [
  { v: null, label: "Cualquier valor" },
  { v: "por_encima", label: "Por encima del promedio" },
  { v: "por_debajo", label: "Por debajo del promedio" },
];

const CONTEXTO_INICIAL: ContextoFiltro = {
  tipo: "cualquiera",
  resultado: "cualquiera",
  relacionJugador: "cualquiera",
};

const RALLY_INICIAL: RallyFiltro = {
  fase: "cualquiera",
  esPrimerToque: "cualquiera",
  toquesMinimo: null,
  inicioPunto: "cualquiera",
};

const MARCADOR_INICIAL: MarcadorFiltro = {
  estado: "cualquiera",
  diferencia: "cualquiera",
  soloCriticos: false,
};

const RACHA_INICIAL = 2;

// ------------------------------------------------------------
// HELPERS UI
// ------------------------------------------------------------

function labelResultado(s: string): string {
  if (s === "cualquiera") return "Cualquier resultado";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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
  filtros: FiltrosTacticosTipo;
  onChange: (f: FiltrosTacticosTipo) => void;
  jugadorFiltradoNombre?: string | null;
  titulo?: string;
}

// ------------------------------------------------------------
// COMPONENTE
// ------------------------------------------------------------

export default function FiltrosTacticos({
  filtros,
  onChange,
  jugadorFiltradoNombre,
  titulo = "Conducta / Secuencia / Contexto",
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [seccionesAbiertas, setSeccionesAbiertas] = useState<
    Record<string, boolean>
  >({
    rally: true,
    ubicacion: false,
    marcador: false,
    racha: false,
    promedio: false,
    previo: false,
    posterior: false,
    repeticion: false,
  });

  const cantActivos = useMemo(() => {
    let n = 0;
    if (filtros.contextoPrevio) n++;
    if (filtros.contextoPosterior) n++;
    if (filtros.repeticion) n++;
    if (filtros.rally) n++;
    if (filtros.ubicacion !== "cualquiera") n++;
    if (filtros.marcador) n++;
    if (filtros.vsPromedio) n++;
    if (filtros.rachaMinima !== null) n++;
    return n;
  }, [filtros]);

  const activoAlguno = hayFiltrosTacticos(filtros);

  const toggleSec = (id: string) => {
    setSeccionesAbiertas((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const limpiar = () =>
    onChange({
      contextoPrevio: null,
      contextoPosterior: null,
      repeticion: null,
      rally: null,
      ubicacion: "cualquiera",
      marcador: null,
      vsPromedio: null,
      rachaMinima: null,
      presetActivoId: null,
    });

  // ----- Handlers secciones existentes -----
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

  // ----- Handlers secciones nuevas -----
  const toggleRally = () => {
    onChange({
      ...filtros,
      rally: filtros.rally ? null : { ...RALLY_INICIAL },
    });
  };
  const actualizarRally = (parcial: Partial<RallyFiltro>) => {
    if (!filtros.rally) return;
    onChange({
      ...filtros,
      rally: { ...filtros.rally, ...parcial },
    });
  };

  const toggleMarcador = () => {
    onChange({
      ...filtros,
      marcador: filtros.marcador ? null : { ...MARCADOR_INICIAL },
    });
  };
  const actualizarMarcador = (parcial: Partial<MarcadorFiltro>) => {
    if (!filtros.marcador) return;
    onChange({
      ...filtros,
      marcador: { ...filtros.marcador, ...parcial },
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
          <p
            className="text-[10px] leading-relaxed italic"
            style={{ color: "var(--sx-text-muted)" }}
          >
            Los filtros de <strong>rally</strong>, <strong>ubicación</strong>,{" "}
            <strong>marcador</strong> y <strong>racha</strong> se calculan sobre
            el universo completo del partido (no sobre el subset filtrado), así
            que son consistentes.
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

          {/* ============================================ */}
          {/* SECCIÓN: RALLY                                */}
          {/* ============================================ */}
          <Seccion
            id="rally"
            titulo="🎯 Rally (fase, primer toque, inicio)"
            activo={!!filtros.rally}
            abierto={seccionesAbiertas.rally}
            onToggleAbierto={() => toggleSec("rally")}
            onToggleActivo={toggleRally}
            hint="Clasifica cada acción según el momento del rally: side-out, contraataque, free ball, si es el primer toque del equipo, o cómo empezó el punto."
          >
            {filtros.rally && (
              <div className="space-y-2">
                <div>
                  <label className={labelCls} style={labelStyle}>
                    Fase del rally
                  </label>
                  <select
                    value={filtros.rally.fase}
                    onChange={(e) =>
                      actualizarRally({
                        fase: e.target.value as FaseRallyFiltro,
                      })
                    }
                    className={selectCls}
                  >
                    {FASES.map((f) => (
                      <option key={f.v} value={f.v}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelCls} style={labelStyle}>
                    ¿Primer toque del equipo?
                  </label>
                  <select
                    value={filtros.rally.esPrimerToque}
                    onChange={(e) =>
                      actualizarRally({
                        esPrimerToque: e.target.value as "cualquiera" | "si" | "no",
                      })
                    }
                    className={selectCls}
                  >
                    <option value="cualquiera">Cualquiera</option>
                    <option value="si">Sí (primer toque)</option>
                    <option value="no">No (toques 2, 3, ...)</option>
                  </select>
                </div>

                <div>
                  <label className={labelCls} style={labelStyle}>
                    Mínimo de toques del equipo (hasta esta acción)
                  </label>
                  <select
                    value={
                      filtros.rally.toquesMinimo === null
                        ? "cualquiera"
                        : String(filtros.rally.toquesMinimo)
                    }
                    onChange={(e) =>
                      actualizarRally({
                        toquesMinimo:
                          e.target.value === "cualquiera"
                            ? null
                            : parseInt(e.target.value),
                      })
                    }
                    className={selectCls}
                  >
                    <option value="cualquiera">Cualquiera</option>
                    <option value="2">≥ 2</option>
                    <option value="3">≥ 3</option>
                    <option value="4">≥ 4</option>
                  </select>
                </div>

                <div>
                  <label className={labelCls} style={labelStyle}>
                    Inicio del punto
                  </label>
                  <select
                    value={filtros.rally.inicioPunto}
                    onChange={(e) =>
                      actualizarRally({
                        inicioPunto: e.target.value as InicioPunto | "cualquiera",
                      })
                    }
                    className={selectCls}
                  >
                    {INICIOS.map((i) => (
                      <option key={i.v} value={i.v}>
                        {i.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </Seccion>

          {/* ============================================ */}
          {/* SECCIÓN: UBICACIÓN                            */}
          {/* ============================================ */}
          <Seccion
            id="ubicacion"
            titulo="📍 Ubicación del jugador"
            activo={filtros.ubicacion !== "cualquiera"}
            abierto={seccionesAbiertas.ubicacion}
            onToggleAbierto={() => toggleSec("ubicacion")}
            onToggleActivo={() =>
              onChange({
                ...filtros,
                ubicacion:
                  filtros.ubicacion === "cualquiera"
                    ? "delantero"
                    : "cualquiera",
              })
            }
            hint="Filtra por zona del jugador al momento de la acción: delanteros (Z2, Z3, Z4), zagueros (Z1, Z5, Z6) o líbero."
          >
            {filtros.ubicacion !== "cualquiera" && (
              <div>
                <label className={labelCls} style={labelStyle}>
                  Ubicación
                </label>
                <select
                  value={filtros.ubicacion}
                  onChange={(e) =>
                    onChange({
                      ...filtros,
                      ubicacion: e.target.value as UbicacionFiltro,
                    })
                  }
                  className={selectCls}
                >
                  {UBICACIONES.map((u) => (
                    <option key={u.v} value={u.v}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </Seccion>

          {/* ============================================ */}
          {/* SECCIÓN: MARCADOR                             */}
          {/* ============================================ */}
          <Seccion
            id="marcador"
            titulo="📊 Marcador al momento"
            activo={!!filtros.marcador}
            abierto={seccionesAbiertas.marcador}
            onToggleAbierto={() => toggleSec("marcador")}
            onToggleActivo={toggleMarcador}
            hint="Estado del set al momento de la acción: empatados/ganando/perdiendo, diferencia, y si es punto crítico (≤5 puntos para cerrar)."
          >
            {filtros.marcador && (
              <div className="space-y-2">
                <div>
                  <label className={labelCls} style={labelStyle}>
                    Estado
                  </label>
                  <select
                    value={filtros.marcador.estado}
                    onChange={(e) =>
                      actualizarMarcador({
                        estado: e.target.value as EstadoMarcador | "cualquiera",
                      })
                    }
                    className={selectCls}
                  >
                    {ESTADOS.map((s) => (
                      <option key={s.v} value={s.v}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelCls} style={labelStyle}>
                    Diferencia
                  </label>
                  <select
                    value={filtros.marcador.diferencia}
                    onChange={(e) =>
                      actualizarMarcador({
                        diferencia: e.target.value as
                          | DiferenciaMarcador
                          | "cualquiera",
                      })
                    }
                    className={selectCls}
                  >
                    {DIFERENCIAS.map((d) => (
                      <option key={d.v} value={d.v}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() =>
                    actualizarMarcador({
                      soloCriticos: !filtros.marcador!.soloCriticos,
                    })
                  }
                  className={`w-full text-left px-2 py-1.5 text-[10px] font-medium rounded border transition flex items-center gap-1.5 ${
                    filtros.marcador.soloCriticos
                      ? "bg-amber-500/20 text-amber-200 border-amber-500/50"
                      : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-sm border flex items-center justify-center shrink-0"
                    style={{
                      borderColor: filtros.marcador.soloCriticos
                        ? "#FBBF24"
                        : "rgba(255,255,255,0.3)",
                      background: filtros.marcador.soloCriticos
                        ? "#F59E0B"
                        : "transparent",
                    }}
                  >
                    {filtros.marcador.soloCriticos && (
                      <span className="text-[8px] text-white font-bold">✓</span>
                    )}
                  </span>
                  <span>Solo puntos críticos (≤5 para cerrar)</span>
                </button>
              </div>
            )}
          </Seccion>

          {/* ============================================ */}
          {/* SECCIÓN: RACHA                                */}
          {/* ============================================ */}
          <Seccion
            id="racha"
            titulo="🔥 Racha (momentum)"
            activo={filtros.rachaMinima !== null}
            abierto={seccionesAbiertas.racha}
            onToggleAbierto={() => toggleSec("racha")}
            onToggleActivo={() =>
              onChange({
                ...filtros,
                rachaMinima:
                  filtros.rachaMinima === null ? RACHA_INICIAL : null,
              })
            }
            hint="Solo acciones que ocurren durante o después de una racha de puntos ganados o perdidos consecutivos."
          >
            {filtros.rachaMinima !== null && (
              <div>
                <label className={labelCls} style={labelStyle}>
                  Racha mínima (ganados o perdidos)
                </label>
                <select
                  value={String(filtros.rachaMinima)}
                  onChange={(e) =>
                    onChange({
                      ...filtros,
                      rachaMinima: parseInt(e.target.value),
                    })
                  }
                  className={selectCls}
                >
                  <option value="2">≥ 2 consecutivos</option>
                  <option value="3">≥ 3 consecutivos</option>
                  <option value="4">≥ 4 consecutivos</option>
                  <option value="5">≥ 5 consecutivos</option>
                </select>
              </div>
            )}
          </Seccion>

          {/* ============================================ */}
          {/* SECCIÓN: VS PROMEDIO                          */}
          {/* ============================================ */}
          <Seccion
            id="promedio"
            titulo="📈 Vs promedio del equipo"
            activo={!!filtros.vsPromedio}
            abierto={seccionesAbiertas.promedio}
            onToggleAbierto={() => toggleSec("promedio")}
            onToggleActivo={() =>
              onChange({
                ...filtros,
                vsPromedio: filtros.vsPromedio ? null : "por_encima",
              })
            }
            hint="Muestra solo acciones por encima (o por debajo) del promedio del equipo en ese fundamento. El promedio se calcula sobre el universo completo."
          >
            {filtros.vsPromedio && (
              <div>
                <label className={labelCls} style={labelStyle}>
                  Modo
                </label>
                <select
                  value={filtros.vsPromedio ?? "por_encima"}
                  onChange={(e) =>
                    onChange({
                      ...filtros,
                      vsPromedio: e.target.value as VsPromedioFiltro,
                    })
                  }
                  className={selectCls}
                >
                  {VS_PROMEDIO.map((v) => (
                    <option key={String(v.v)} value={String(v.v)}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </Seccion>

          {/* ============================================ */}
          {/* SECCIONES EXISTENTES                          */}
          {/* ============================================ */}
          <Seccion
            id="previo"
            titulo="↶ Antes de esta acción"
            activo={!!filtros.contextoPrevio}
            abierto={seccionesAbiertas.previo}
            onToggleAbierto={() => toggleSec("previo")}
            onToggleActivo={togglePrevio}
            hint="La acción inmediatamente anterior, dentro del mismo punto."
          >
            {filtros.contextoPrevio && (
              <div className="grid grid-cols-3 gap-1.5">
                <div>
                  <label className={labelCls} style={labelStyle}>
                    Tipo
                  </label>
                  <select
                    value={filtros.contextoPrevio.tipo}
                    onChange={(e) =>
                      actualizarPrevio({
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
                    value={filtros.contextoPrevio.resultado}
                    onChange={(e) =>
                      actualizarPrevio({ resultado: e.target.value })
                    }
                    disabled={filtros.contextoPrevio.tipo === "cualquiera"}
                    className={`${selectCls} disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    {resultadosPorTipo(filtros.contextoPrevio.tipo).map((r) => (
                      <option key={r} value={r}>
                        {labelResultado(r)}
                      </option>
                    ))}
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
          </Seccion>

          <Seccion
            id="posterior"
            titulo="↷ Después de esta acción"
            activo={!!filtros.contextoPosterior}
            abierto={seccionesAbiertas.posterior}
            onToggleAbierto={() => toggleSec("posterior")}
            onToggleActivo={togglePosterior}
            hint="La acción inmediatamente posterior, dentro del mismo punto."
          >
            {filtros.contextoPosterior && (
              <div className="grid grid-cols-3 gap-1.5">
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
          </Seccion>

          <Seccion
            id="repeticion"
            titulo="↻ Repetición en el punto"
            activo={!!filtros.repeticion}
            abierto={seccionesAbiertas.repeticion}
            onToggleAbierto={() => toggleSec("repeticion")}
            onToggleActivo={toggleRepeticion}
            hint="Solo puntos donde el jugador filtrado (o cualquier jugador) tocó 2+ veces."
          >
            {filtros.repeticion && (
              <div className="grid grid-cols-2 gap-1.5">
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
          </Seccion>
        </div>
      )}
    </div>
  );
}

// ============================================================
// SUBCOMPONENTE: sección colapsable
// ============================================================

function Seccion({
  id,
  titulo,
  activo,
  abierto,
  onToggleAbierto,
  onToggleActivo,
  hint,
  children,
}: {
  id: string;
  titulo: string;
  activo: boolean;
  abierto: boolean;
  onToggleAbierto: () => void;
  onToggleActivo: () => void;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      key={id}
      className="rounded-xl p-2.5"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: activo
          ? "1px solid rgba(167,139,250,0.4)"
          : "1px solid var(--sx-border)",
      }}
    >
      <div className="flex items-center justify-between mb-1 gap-2">
        <button
          onClick={onToggleAbierto}
          className="flex-1 flex items-center justify-between gap-2 text-left"
        >
          <span
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color: "var(--sx-text-primary)" }}
          >
            {titulo}
          </span>
          <span
            className="transition-transform shrink-0"
            style={{
              color: "var(--sx-text-muted)",
              transform: abierto ? "rotate(180deg)" : "none",
              fontSize: "9px",
            }}
          >
            ▼
          </span>
        </button>
        <button
          onClick={onToggleActivo}
          className={`px-2 py-0.5 text-[10px] font-bold rounded border-2 transition shrink-0 ${
            activo
              ? "bg-violet-500 text-white border-violet-500 hover:bg-violet-600"
              : "bg-white/5 text-slate-300 border-white/15 hover:bg-white/10"
          }`}
        >
          {activo ? "✓ Activo" : "Activar"}
        </button>
      </div>

      {abierto && (
        <div className="mt-2 space-y-2">
          {hint && (
            <p
              className="text-[9px] leading-relaxed italic"
              style={{ color: "var(--sx-text-muted)" }}
            >
              {hint}
            </p>
          )}
          {children}
        </div>
      )}
    </div>
  );
}