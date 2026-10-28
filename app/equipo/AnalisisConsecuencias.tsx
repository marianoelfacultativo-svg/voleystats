"use client";

// ============================================================
// ANÁLISIS DE CONSECUENCIAS — UI SIMPLIFICADA ("SI PASA X → ¿QUÉ PASA?")
// ============================================================
// Constructor tipo frase en lenguaje natural + preguntas prearmadas de 1 clic.
// Diseñado para entrenadores y analistas sin jerga técnica.
// ============================================================

import { useMemo, useState } from "react";
import {
  analizarConsecuencias,
  etiquetaResultado,
  etiquetaTipoDisparador,
  hayComparadoresActivos,
  hayFiltroAnalisisActivo,
  resultadosPorTipoAnalisis,
  COINCIDENCIA_VACIA,
  type CoincidenciaFiltro,
  type DisparadorFiltro,
  type FiltrosAnalisis,
  type ResultadoAnalisis,
  type TipoDisparador,
  type Ventana,
} from "@/lib/analisisConsecuencias";
import type { AccionVisual } from "./adaptadorUnificadoV2";

// ------------------------------------------------------------
// PREGUNTAS RÁPIDAS PRECONFIGURADAS (1 clic)
// ------------------------------------------------------------

interface PreguntaRapida {
  id: string;
  icono: string;
  titulo: string;
  descripcion: string;
  tipo: TipoDisparador;
  resultado: string;
  ventana: Ventana;
  coincidencias?: Partial<CoincidenciaFiltro>;
}

const PREGUNTAS_RAPIDAS: PreguntaRapida[] = [
  {
    id: "error-ataque",
    icono: "💥",
    titulo: "Tras error de ataque",
    descripcion: "¿Quién ataca luego y si insiste el mismo jugador?",
    tipo: "ataque",
    resultado: "error",
    ventana: 1,
    coincidencias: { mismoJugadorTrigger: true },
  },
  {
    id: "mala-recep",
    icono: "🛡️",
    titulo: "Tras mala recepción",
    descripcion: "¿Cómo resuelve el armador la pelota negativa/overpass?",
    tipo: "recepcion",
    resultado: "negativa",
    ventana: 1,
  },
  {
    id: "ace-saque",
    icono: "🎯",
    titulo: "Tras ace / saque positivo",
    descripcion: "¿El saque siguiente mantiene la presión o repite zona?",
    tipo: "saque",
    resultado: "ace",
    ventana: 1,
    coincidencias: { mismaZonaTriggerDestino: true },
  },
  {
    id: "bloqueo-punto",
    icono: "🧱",
    titulo: "Tras bloqueo punto",
    descripcion: "¿Cómo responde la siguiente jugada del equipo?",
    tipo: "bloqueo",
    resultado: "punto",
    ventana: 1,
  },
  {
    id: "repite-zona",
    icono: "🔄",
    titulo: "¿Insiste en la misma zona?",
    descripcion: "Mide si los ataques consecutivos van al mismo sector",
    tipo: "ataque",
    resultado: "cualquiera",
    ventana: 1,
    coincidencias: { mismaZonaTriggerDestino: true },
  },
];

// ------------------------------------------------------------
// OPCIONES DEL CONSTRUCTOR
// ------------------------------------------------------------

const TIPOS_DISPARADOR: { v: TipoDisparador; label: string }[] = [
  { v: "ataque", label: "Ataque" },
  { v: "saque", label: "Saque" },
  { v: "recepcion", label: "Recepción" },
  { v: "bloqueo", label: "Bloqueo" },
  { v: "armado", label: "Armado" },
  { v: "defensa", label: "Defensa" },
  { v: "libre", label: "Pelota libre" },
  { v: "roce-red", label: "Roce red" },
];

const VENTANAS: { v: Ventana; label: string }[] = [
  { v: 1, label: "la 1ª acción siguiente" },
  { v: 2, label: "las 2 acciones siguientes" },
  { v: 3, label: "las 3 acciones siguientes" },
  { v: "todas", label: "todas las acciones del punto" },
];

interface ComparadorSimple {
  key: keyof CoincidenciaFiltro;
  etiqueta: string;
  detalle: string;
}

const COMPARADORES_AMIGABLES: ComparadorSimple[] = [
  {
    key: "mismoJugadorTrigger",
    etiqueta: "👤 ¿Mismo jugador?",
    detalle: "Si quien hace la acción siguiente es el mismo que disparó la condición",
  },
  {
    key: "mismaZonaTriggerDestino",
    etiqueta: "📍 ¿Misma zona destino?",
    detalle: "Si la siguiente acción cae en la misma zona de la cancha",
  },
  {
    key: "mismaZonaTriggerOrigen",
    etiqueta: "🛫 ¿Misma zona origen?",
    detalle: "Si la siguiente acción sale desde la misma zona",
  },
  {
    key: "mismaVelocidadAnterior",
    etiqueta: "⚡ ¿Misma velocidad de armado?",
    detalle: "Si el armador repite la velocidad previa",
  },
  {
    key: "mismoReceptorAnterior",
    etiqueta: "🎯 ¿Mismo receptor previo?",
    detalle: "Si se vuelve a involucrar al mismo receptor",
  },
];

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
// COMPONENTE PRINCIPAL
// ------------------------------------------------------------

export default function AnalisisConsecuencias({
  acciones,
  onIrAPunto,
  nombreDeJugador,
  titulo = "Análisis de consecuencias",
}: Props) {
  // Estado del disparador ("Si pasa X...")
  const [disparador, setDisparador] = useState<DisparadorFiltro | null>({
    tipo: "ataque",
    resultado: "error",
  });
  const [ventana, setVentana] = useState<Ventana>(1);
  const [coincidencias, setCoincidencias] = useState<CoincidenciaFiltro>({
    ...COINCIDENCIA_VACIA,
  });

  const [preguntaActivaId, setPreguntaActivaId] = useState<string | null>(
    "error-ataque"
  );
  const [abierto, setAbierto] = useState(true);

  // Filtros empaquetados
  const filtros: FiltrosAnalisis = useMemo(
    () => ({ disparador, ventana, coincidencias }),
    [disparador, ventana, coincidencias]
  );

  // Motor de cálculo
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

  // Handlers
  const aplicarPreguntaRapida = (p: PreguntaRapida) => {
    setPreguntaActivaId(p.id);
    setDisparador({ tipo: p.tipo, resultado: p.resultado });
    setVentana(p.ventana);
    setCoincidencias({
      ...COINCIDENCIA_VACIA,
      ...(p.coincidencias ?? {}),
    });
  };

  const cambiarTipoDisparador = (tipo: TipoDisparador) => {
    setPreguntaActivaId(null);
    setDisparador({ tipo, resultado: "cualquiera" });
  };

  const cambiarResultadoDisparador = (resultado: string) => {
    setPreguntaActivaId(null);
    if (!disparador) return;
    setDisparador({ ...disparador, resultado });
  };

  const toggleComparador = (key: keyof CoincidenciaFiltro) => {
    setPreguntaActivaId(null);
    setCoincidencias((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const limpiar = () => {
    setPreguntaActivaId(null);
    setDisparador(null);
    setVentana(1);
    setCoincidencias({ ...COINCIDENCIA_VACIA });
  };

  // Conclusión amigable generada automáticamente
  const conclusionRapida = useMemo(() => {
    if (!resultado || resultado.totalOcurrencias === 0) return null;
    const topSiguiente = resultado.resumenPorTipo[0];
    if (!topSiguiente) return null;

    const pctTop = Math.round(
      (topSiguiente.count / resultado.totalOcurrencias) * 100
    );

    let texto = `En el ${pctTop}% de los casos (${topSiguiente.count} de ${resultado.totalOcurrencias}), la jugada continuó con un ${topSiguiente.tipo}.`;

    if (coincidencias.mismoJugadorTrigger && resultado.coincidenciasGlobales.mismoJugadorTrigger > 0) {
      const pctMismo = Math.round(
        (resultado.coincidenciasGlobales.mismoJugadorTrigger / resultado.totalOcurrencias) * 100
      );
      texto += ` El ${pctMismo}% de las veces volvió a intervenir el mismo jugador.`;
    } else if (coincidencias.mismaZonaTriggerDestino && resultado.coincidenciasGlobales.mismaZonaTriggerDestino > 0) {
      const pctZona = Math.round(
        (resultado.coincidenciasGlobales.mismaZonaTriggerDestino / resultado.totalOcurrencias) * 100
      );
      texto += ` El ${pctZona}% repitió la misma zona.`;
    }

    return texto;
  }, [resultado, coincidencias]);

  return (
    <div className="rounded-2xl p-4 sm:p-5 space-y-4" style={cardBase}>
      {/* ---------- HEADER DEL PANEL ---------- */}
      <div className="flex items-center justify-between gap-2 border-b pb-3 border-white/10">
        <button
          onClick={() => setAbierto((v) => !v)}
          className="flex items-center gap-2 text-left"
        >
          <span className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <span>🎯</span> {titulo}
          </span>
          {activo && resultado && resultado.totalOcurrencias > 0 && (
            <span
              className="text-xs px-2.5 py-0.5 rounded-full font-bold"
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
        </button>

        <div className="flex items-center gap-2">
          {activo && (
            <button
              onClick={limpiar}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg transition hover:bg-rose-500/10"
              style={{ color: "#F87171" }}
            >
              Limpiar
            </button>
          )}
          <button
            onClick={() => setAbierto((v) => !v)}
            className="text-slate-400 hover:text-white transition text-xs p-1"
          >
            {abierto ? "▲" : "▼"}
          </button>
        </div>
      </div>

      {abierto && (
        <div className="space-y-4">
          {/* ---------- PREGUNTAS TÁCTICAS RÁPIDAS (1 clic) ---------- */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Preguntas tácticas frecuentes:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {PREGUNTAS_RAPIDAS.map((p) => {
                const seleccionada = preguntaActivaId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => aplicarPreguntaRapida(p)}
                    className={`text-left p-2.5 rounded-xl border transition flex items-start gap-2.5 ${
                      seleccionada
                        ? "bg-violet-600/25 border-violet-400 text-white shadow-md shadow-violet-900/20"
                        : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span className="text-xl shrink-0 mt-0.5">{p.icono}</span>
                    <div className="min-w-0">
                      <p
                        className={`text-xs font-bold leading-tight ${
                          seleccionada ? "text-violet-200" : "text-white"
                        }`}
                      >
                        {p.titulo}
                      </p>
                      <p className="text-[10px] text-slate-400 leading-snug mt-0.5 line-clamp-2">
                        {p.descripcion}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ---------- CONSTRUCTOR TIPO FRASE EN LENGUAJE NATURAL ---------- */}
          <div
            className="rounded-xl p-3.5 sm:p-4 space-y-3"
            style={{
              background:
                "linear-gradient(135deg, rgba(20,30,55,0.7) 0%, rgba(15,23,42,0.85) 100%)",
              border: "1px solid rgba(167,139,250,0.25)",
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-violet-300 flex items-center gap-1.5">
                <span>💬</span> Constructor de condición
              </span>
              {!disparador && (
                <button
                  onClick={() =>
                    setDisparador({ tipo: "ataque", resultado: "error" })
                  }
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-violet-600 text-white hover:bg-violet-500 transition"
                >
                  Activar constructor
                </button>
              )}
            </div>

            {disparador ? (
              <div className="space-y-3">
                {/* Frase interactiva */}
                <div className="flex flex-wrap items-center gap-2 text-sm sm:text-base text-slate-200 font-medium leading-relaxed bg-black/20 p-3 rounded-xl border border-white/5">
                  <span className="text-violet-400 font-bold">Si ocurre un</span>

                  {/* Selector: Tipo de acción */}
                  <select
                    value={disparador.tipo}
                    onChange={(e) =>
                      cambiarTipoDisparador(e.target.value as TipoDisparador)
                    }
                    className="bg-violet-950/80 text-white text-xs sm:text-sm font-semibold rounded-lg px-2.5 py-1.5 border border-violet-500/40 focus:outline-none focus:border-violet-400 cursor-pointer shadow-sm"
                  >
                    {TIPOS_DISPARADOR.map((t) => (
                      <option key={t.v} value={t.v}>
                        {t.label}
                      </option>
                    ))}
                  </select>

                  <span className="text-violet-400 font-bold">y el resultado es</span>

                  {/* Selector: Resultado */}
                  <select
                    value={disparador.resultado}
                    onChange={(e) => cambiarResultadoDisparador(e.target.value)}
                    className="bg-violet-950/80 text-white text-xs sm:text-sm font-semibold rounded-lg px-2.5 py-1.5 border border-violet-500/40 focus:outline-none focus:border-violet-400 cursor-pointer shadow-sm"
                  >
                    {resultadosPorTipoAnalisis(disparador.tipo).map((r) => (
                      <option key={r} value={r}>
                        {etiquetaResultado(r)}
                      </option>
                    ))}
                  </select>

                  <span className="text-violet-400 font-bold">, observar</span>

                  {/* Selector: Ventana de acciones */}
                  <select
                    value={String(ventana)}
                    onChange={(e) => {
                      setPreguntaActivaId(null);
                      const val = e.target.value;
                      setVentana(val === "todas" ? "todas" : (Number(val) as Ventana));
                    }}
                    className="bg-violet-950/80 text-white text-xs sm:text-sm font-semibold rounded-lg px-2.5 py-1.5 border border-violet-500/40 focus:outline-none focus:border-violet-400 cursor-pointer shadow-sm"
                  >
                    {VENTANAS.map((v) => (
                      <option key={String(v.v)} value={String(v.v)}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Preguntas adicionales / Comparadores como Chips */}
                <div>
                  <p className="text-[11px] font-bold text-slate-400 mb-1.5">
                    ¿Querés verificar si se repite algún patrón en la siguiente jugada?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {COMPARADORES_AMIGABLES.map((c) => {
                      const activo = coincidencias[c.key];
                      return (
                        <button
                          key={c.key}
                          onClick={() => toggleComparador(c.key)}
                          title={c.detalle}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition flex items-center gap-1.5 ${
                            activo
                              ? "bg-emerald-500/20 text-emerald-200 border-emerald-500/60 shadow-sm"
                              : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"
                          }`}
                        >
                          <span>{activo ? "✓" : "+"}</span>
                          <span>{c.etiqueta}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">
                Elegí una pregunta rápida arriba o activá el constructor para formular una condición personalizada.
              </p>
            )}
          </div>

          {/* ---------- RESULTADOS DEL ANÁLISIS ---------- */}
          {disparador && resultado && (
            <div className="space-y-4 pt-1">
              {resultado.totalOcurrencias === 0 ? (
                <div
                  className="rounded-xl p-6 text-center text-xs sm:text-sm"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid var(--sx-border)",
                    color: "var(--sx-text-muted)",
                  }}
                >
                  <p className="text-2xl mb-1">🔍</p>
                  <p className="font-semibold text-slate-300">
                    No se encontraron acciones con esta condición en los datos actuales.
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Probá cambiando el resultado o eligiendo otra acción disparadora.
                  </p>
                </div>
              ) : (
                <>
                  {/* Tarjeta de conclusión táctica */}
                  {conclusionRapida && (
                    <div
                      className="rounded-xl p-3.5 sm:p-4 flex items-start gap-3"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(56,189,248,0.08) 100%)",
                        border: "1px solid rgba(16,185,129,0.3)",
                      }}
                    >
                      <span className="text-2xl shrink-0">💡</span>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                          Conclusión táctica
                        </p>
                        <p className="text-sm font-medium text-slate-100 mt-0.5 leading-relaxed">
                          {conclusionRapida}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Gráficos de distribución de lo que vino después */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* ¿Qué acción vino después? */}
                    <div
                      className="rounded-xl p-3.5 space-y-2.5"
                      style={{
                        background: "var(--sx-surface-2)",
                        border: "1px solid var(--sx-border)",
                      }}
                    >
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center justify-between">
                        <span>¿Qué acción vino después?</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {resultado.totalOcurrencias} casos
                        </span>
                      </p>
                      <div className="space-y-2">
                        {resultado.resumenPorTipo.map((r) => {
                          const pct = Math.round(
                            (r.count / resultado.totalOcurrencias) * 100
                          );
                          return (
                            <div key={r.tipo}>
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="font-semibold text-white capitalize">
                                  {r.tipo}
                                </span>
                                <span className="text-slate-300 font-mono text-[11px]">
                                  {r.count} ({pct}%)
                                </span>
                              </div>
                              <div
                                className="h-2 rounded-full overflow-hidden"
                                style={{ background: "rgba(255,255,255,0.08)" }}
                              >
                                <div
                                  className="h-full rounded-full transition-all duration-300"
                                  style={{
                                    width: `${pct}%`,
                                    background:
                                      "linear-gradient(90deg, #10B981 0%, #38BDF8 100%)",
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Subtipos específicos & Patrones repetidos */}
                    <div
                      className="rounded-xl p-3.5 space-y-3"
                      style={{
                        background: "var(--sx-surface-2)",
                        border: "1px solid var(--sx-border)",
                      }}
                    >
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-2">
                          Subtipos registrados
                        </p>
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                          {Object.entries(resultado.distribucionSubtipo)
                            .sort((a, b) => b[1] - a[1])
                            .map(([k, v]) => {
                              const [tipo, sub] = k.split("|");
                              return (
                                <span
                                  key={k}
                                  className="px-2 py-1 text-[11px] rounded-lg border font-medium flex items-center gap-1"
                                  style={{
                                    background: "rgba(56,189,248,0.1)",
                                    borderColor: "rgba(56,189,248,0.25)",
                                    color: "#7DD3FC",
                                  }}
                                >
                                  <strong className="capitalize">{tipo}</strong>
                                  {sub !== "—" && ` · ${sub}`}
                                  <span className="font-bold text-white ml-0.5">
                                    ×{v}
                                  </span>
                                </span>
                              );
                            })}
                        </div>
                      </div>

                      {hayComparadores && (
                        <div className="pt-2 border-t border-white/10">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-1.5">
                            Patrones de repetición detectados
                          </p>
                          <div className="space-y-1">
                            {COMPARADORES_AMIGABLES.map((c) => {
                              const val =
                                resultado.coincidenciasGlobales[c.key] ?? 0;
                              if (val === 0 && !coincidencias[c.key]) return null;
                              const pct = Math.round(
                                (val / resultado.totalOcurrencias) * 100
                              );
                              return (
                                <div
                                  key={c.key}
                                  className="flex items-center justify-between text-xs py-0.5"
                                >
                                  <span className="text-slate-300">
                                    {c.etiqueta}
                                  </span>
                                  <span className="font-bold text-emerald-400">
                                    {val} de {resultado.totalOcurrencias} ({pct}%)
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tabla de ocurrencias individuales */}
                  <div
                    className="rounded-xl overflow-hidden border border-white/10"
                    style={{ background: "var(--sx-surface-2)" }}
                  >
                    <div className="px-3.5 py-2.5 flex items-center justify-between border-b border-white/10 bg-white/5">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-200">
                        Puntos donde ocurrió ({resultado.ocurrencias.length})
                      </p>
                      <span className="text-[11px] text-slate-400">
                        Orden cronológico
                      </span>
                    </div>

                    <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                      <table className="w-full text-xs min-w-[500px]">
                        <thead
                          style={{
                            position: "sticky",
                            top: 0,
                            background: "rgba(15,29,53,0.98)",
                            borderBottom: "1px solid var(--sx-border)",
                          }}
                        >
                          <tr className="text-left text-slate-400">
                            <th className="py-2 px-3 font-semibold">Set y Punto</th>
                            <th className="py-2 px-3 font-semibold">
                              Acción disparadora
                            </th>
                            <th className="py-2 px-3 font-semibold">
                              ¿Qué pasó después?
                            </th>
                            {onIrAPunto && (
                              <th className="py-2 px-3 text-right font-semibold">
                                Ver
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {resultado.ocurrencias.map((o) => {
                            const s0 = o.siguientes[0] ?? null;
                            return (
                              <tr
                                key={`${o.set_numero}-${o.punto_numero}-${o.triggerId}`}
                                className="border-b border-white/5 hover:bg-white/5 transition"
                              >
                                <td className="py-2 px-3 font-mono font-semibold text-slate-300">
                                  Set {o.set_numero} · Punto {o.punto_numero}
                                </td>
                                <td className="py-2 px-3">
                                  <span className="font-bold text-white capitalize">
                                    {o.triggerSubtipo ?? disparador.tipo}
                                  </span>
                                  <span className="block text-[11px] text-slate-400">
                                    {nombre(o.triggerJugadorId)}
                                  </span>
                                </td>
                                <td className="py-2 px-3">
                                  {s0 ? (
                                    <div>
                                      <span className="font-bold text-emerald-300 capitalize">
                                        {s0.tipo}
                                        {s0.subtipo ? ` · ${String(s0.subtipo)}` : ""}
                                      </span>
                                      <span className="block text-[11px] text-slate-400">
                                        {nombre(s0.jugador_id)}
                                        {s0.zona_destino ? ` · Zona ${s0.zona_destino}` : ""}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-500 italic">
                                      Fin del punto
                                    </span>
                                  )}
                                </td>
                                {onIrAPunto && (
                                  <td className="py-2 px-3 text-right">
                                    <button
                                      onClick={() =>
                                        onIrAPunto(o.set_numero, o.punto_numero)
                                      }
                                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-300 hover:bg-sky-500/25 transition"
                                    >
                                      Ir al punto →
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
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
