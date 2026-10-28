"use client";

// ============================================================
// ANÁLISIS DE CONSECUENCIAS — UI INTUITIVA CON ACCIÓN OBSERVADA
// ============================================================
// Constructor tipo frase en lenguaje natural + preguntas prearmadas de 1 clic.
// Incluye:
//   - Tipo de acción a observar (inmediata o siguiente específica, ej. ataque)
//   - Evaluación de resultado más frecuente (Punto, Error o Neutro)
//   - Subtipo más frecuente y ranking
//   - Promedio de acciones y puntos de distancia entre ambas acciones
//   - Jugador y zona predominante
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
  tipoObservado: TipoDisparador | "cualquiera";
  alcance: "partido" | "mismo_punto";
  ventana: Ventana;
  coincidencias?: Partial<CoincidenciaFiltro>;
}

const PREGUNTAS_RAPIDAS: PreguntaRapida[] = [
  {
    id: "error-ataque-a-ataque",
    icono: "💥",
    titulo: "Tras error de ataque → Siguiente Ataque",
    descripcion: "¿Cómo rinde el siguiente ataque? ¿Es punto, error o se insiste con el mismo jugador?",
    tipo: "ataque",
    resultado: "error",
    tipoObservado: "ataque",
    alcance: "partido",
    ventana: 1,
    coincidencias: { mismoJugadorTrigger: true },
  },
  {
    id: "mala-recep-a-ataque",
    icono: "🛡️",
    titulo: "Tras mala recepción → Siguiente Ataque",
    descripcion: "¿Qué efectividad y subtipo tiene el ataque resultante de una pelota incómoda?",
    tipo: "recepcion",
    resultado: "negativa",
    tipoObservado: "ataque",
    alcance: "partido",
    ventana: 1,
  },
  {
    id: "ace-saque-a-saque",
    icono: "🎯",
    titulo: "Tras ace de saque → Siguiente Saque",
    descripcion: "¿El siguiente saque mantiene el punto/presión o se comete error?",
    tipo: "saque",
    resultado: "ace",
    tipoObservado: "saque",
    alcance: "partido",
    ventana: 1,
    coincidencias: { mismaZonaTriggerDestino: true },
  },
  {
    id: "bloqueo-a-ataque",
    icono: "🧱",
    titulo: "Tras bloqueo punto → Siguiente Ataque",
    descripcion: "¿Cómo se resuelve el siguiente ataque del equipo?",
    tipo: "bloqueo",
    resultado: "punto",
    tipoObservado: "ataque",
    alcance: "partido",
    ventana: 1,
  },
  {
    id: "defensa-a-ataque",
    icono: "⚡",
    titulo: "Tras gran defensa → Siguiente Ataque",
    descripcion: "¿En qué termina el contraataque generado tras salvar la pelota?",
    tipo: "defensa",
    resultado: "toque_positiva",
    tipoObservado: "ataque",
    alcance: "partido",
    ventana: 1,
  },
  {
    id: "inmediata-siguiente",
    icono: "🔄",
    titulo: "Acción inmediata siguiente",
    descripcion: "¿Cuál es el primer toque que ocurre exactamente después?",
    tipo: "ataque",
    resultado: "cualquiera",
    tipoObservado: "cualquiera",
    alcance: "mismo_punto",
    ventana: 1,
  },
];

// ------------------------------------------------------------
// OPCIONES
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

const TIPOS_OBSERVADOS: { v: TipoDisparador | "cualquiera"; label: string }[] = [
  { v: "cualquiera", label: "la 1ª acción siguiente inmediata" },
  { v: "ataque", label: "la siguiente acción de Ataque" },
  { v: "saque", label: "la siguiente acción de Saque" },
  { v: "recepcion", label: "la siguiente acción de Recepción" },
  { v: "bloqueo", label: "la siguiente acción de Bloqueo" },
  { v: "armado", label: "la siguiente acción de Armado" },
  { v: "defensa", label: "la siguiente acción de Defensa" },
];

const ALCANCES: { v: "partido" | "mismo_punto"; label: string }[] = [
  { v: "partido", label: "en el partido (mismo punto o posteriores)" },
  { v: "mismo_punto", label: "solo dentro del mismo punto" },
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
    detalle: "Si quien realiza la acción observada es el mismo que disparó la condición",
  },
  {
    key: "mismaZonaTriggerDestino",
    etiqueta: "📍 ¿Misma zona destino?",
    detalle: "Si la acción cae en el mismo sector de la cancha",
  },
  {
    key: "mismaZonaTriggerOrigen",
    etiqueta: "🛫 ¿Misma zona origen?",
    detalle: "Si la acción sale desde la misma zona",
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

  // Tipo específico de acción a observar
  const [tipoObservado, setTipoObservado] = useState<
    TipoDisparador | "cualquiera"
  >("ataque");

  // Alcance
  const [alcance, setAlcance] = useState<"partido" | "mismo_punto">("partido");

  const [ventana] = useState<Ventana>(1);
  const [coincidencias, setCoincidencias] = useState<CoincidenciaFiltro>({
    ...COINCIDENCIA_VACIA,
    mismoJugadorTrigger: true,
  });

  const [preguntaActivaId, setPreguntaActivaId] = useState<string | null>(
    "error-ataque-a-ataque"
  );
  const [abierto, setAbierto] = useState(true);

  // Filtros empaquetados
  const filtros: FiltrosAnalisis = useMemo(
    () => ({
      disparador,
      ventana,
      coincidencias,
      tipoObservado,
      alcance,
    }),
    [disparador, ventana, coincidencias, tipoObservado, alcance]
  );

  // Motor de cálculo
  const resultado: ResultadoAnalisis | null = useMemo(() => {
    if (!disparador) return null;
    return analizarConsecuencias(acciones, filtros);
  }, [acciones, filtros, disparador]);

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
    setTipoObservado(p.tipoObservado);
    setAlcance(p.alcance);
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
    setTipoObservado("cualquiera");
    setAlcance("partido");
    setCoincidencias({ ...COINCIDENCIA_VACIA });
  };

  // Evaluación destacada
  const estadisticas = resultado?.estadisticasObservadas;
  const evaluacion = estadisticas?.evaluacionResultado;

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
              Preguntas tácticas sugeridas:
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
                "linear-gradient(135deg, rgba(20,30,55,0.75) 0%, rgba(15,23,42,0.9) 100%)",
              border: "1px solid rgba(167,139,250,0.3)",
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
                {/* Frase interactiva con selectores */}
                <div className="flex flex-wrap items-center gap-2 text-sm sm:text-base text-slate-200 font-medium leading-relaxed bg-black/25 p-3 sm:p-3.5 rounded-xl border border-white/5">
                  <span className="text-violet-400 font-bold">Si ocurre un</span>

                  {/* 1. Selector: Tipo de disparador */}
                  <select
                    value={disparador.tipo}
                    onChange={(e) =>
                      cambiarTipoDisparador(e.target.value as TipoDisparador)
                    }
                    className="bg-violet-950/90 text-white text-xs sm:text-sm font-semibold rounded-lg px-2.5 py-1.5 border border-violet-500/40 focus:outline-none focus:border-violet-400 cursor-pointer shadow-sm"
                  >
                    {TIPOS_DISPARADOR.map((t) => (
                      <option key={t.v} value={t.v}>
                        {t.label}
                      </option>
                    ))}
                  </select>

                  <span className="text-violet-400 font-bold">con resultado</span>

                  {/* 2. Selector: Resultado del disparador */}
                  <select
                    value={disparador.resultado}
                    onChange={(e) => cambiarResultadoDisparador(e.target.value)}
                    className="bg-violet-950/90 text-white text-xs sm:text-sm font-semibold rounded-lg px-2.5 py-1.5 border border-violet-500/40 focus:outline-none focus:border-violet-400 cursor-pointer shadow-sm"
                  >
                    {resultadosPorTipoAnalisis(disparador.tipo).map((r) => (
                      <option key={r} value={r}>
                        {etiquetaResultado(r)}
                      </option>
                    ))}
                  </select>

                  <span className="text-violet-400 font-bold">→ observar</span>

                  {/* 3. Selector: Acción objetivo a observar */}
                  <select
                    value={tipoObservado}
                    onChange={(e) => {
                      setPreguntaActivaId(null);
                      setTipoObservado(
                        e.target.value as TipoDisparador | "cualquiera"
                      );
                    }}
                    className="bg-emerald-950/90 text-emerald-200 text-xs sm:text-sm font-bold rounded-lg px-2.5 py-1.5 border border-emerald-500/50 focus:outline-none focus:border-emerald-400 cursor-pointer shadow-sm"
                  >
                    {TIPOS_OBSERVADOS.map((t) => (
                      <option key={t.v} value={t.v}>
                        {t.label}
                      </option>
                    ))}
                  </select>

                  <span className="text-slate-400 text-xs sm:text-sm font-normal">
                    en
                  </span>

                  {/* 4. Selector: Alcance */}
                  <select
                    value={alcance}
                    onChange={(e) => {
                      setPreguntaActivaId(null);
                      setAlcance(e.target.value as "partido" | "mismo_punto");
                    }}
                    className="bg-slate-800 text-slate-300 text-xs sm:text-sm font-medium rounded-lg px-2.5 py-1.5 border border-slate-600 focus:outline-none cursor-pointer"
                  >
                    {ALCANCES.map((a) => (
                      <option key={a.v} value={a.v}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Preguntas adicionales / Comparadores como Chips */}
                <div>
                  <p className="text-[11px] font-bold text-slate-400 mb-1.5">
                    Patrones y comparaciones sobre la acción observada:
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

          {/* ---------- RESULTADOS DETALLADOS ---------- */}
          {disparador && resultado && (
            <div className="space-y-4 pt-1">
              {resultado.totalOcurrencias === 0 || !estadisticas ? (
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
                    No se encontraron acciones con esta condición en los datos seleccionados.
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Probá cambiando el resultado del disparador o seleccionando otro tipo de acción a observar.
                  </p>
                </div>
              ) : (
                <>
                  {/* ---------- 1. TARJETA DE CONCLUSIÓN Y EVALUACIÓN DE RESULTADO ---------- */}
                  <div
                    className="rounded-xl p-4 sm:p-5 space-y-4"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(16,185,129,0.14) 0%, rgba(56,189,248,0.1) 100%)",
                      border: "1px solid rgba(16,185,129,0.35)",
                    }}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">📊</span>
                          <div>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                              Evaluación de la acción observada
                            </span>
                            <h3 className="text-base sm:text-lg font-black text-white capitalize">
                              {tipoObservado === "cualquiera"
                                ? "Primera acción siguiente"
                                : `Siguiente ${tipoObservado}`}
                            </h3>
                          </div>
                        </div>
                      </div>

                      {/* Badge resultado dominante */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-300">Resultado dominante:</span>
                        <span
                          className={`px-3 py-1 text-xs font-black rounded-lg uppercase tracking-wider ${
                            evaluacion?.masFrecuente === "punto"
                              ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                              : evaluacion?.masFrecuente === "error"
                              ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20"
                              : "bg-amber-500 text-slate-950 font-bold"
                          }`}
                        >
                          {evaluacion?.masFrecuente === "punto"
                            ? "🟢 Mayormente Punto"
                            : evaluacion?.masFrecuente === "error"
                            ? "🔴 Mayormente Error"
                            : "🟡 Mayormente Neutro / En juego"}
                        </span>
                      </div>
                    </div>

                    {/* Desglose de Punto / Neutro / Error con barras */}
                    {evaluacion && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                        {/* PUNTOS */}
                        <div className="p-3 rounded-xl bg-black/30 border border-emerald-500/30">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-400" />
                              Punto
                            </span>
                            <span className="text-sm font-black text-white font-mono">
                              {evaluacion.pctPuntos}%
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">
                            {evaluacion.puntos} de {evaluacion.total} ocurrencias
                          </p>
                          <div className="h-1.5 rounded-full bg-white/10 mt-2 overflow-hidden">
                            <div
                              className="h-full bg-emerald-400 rounded-full"
                              style={{ width: `${evaluacion.pctPuntos}%` }}
                            />
                          </div>
                        </div>

                        {/* NEUTROS / CONTINUIDAD */}
                        <div className="p-3 rounded-xl bg-black/30 border border-amber-500/30">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-amber-400" />
                              Neutro / Continuó
                            </span>
                            <span className="text-sm font-black text-white font-mono">
                              {evaluacion.pctNeutros}%
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">
                            {evaluacion.neutros} de {evaluacion.total} ocurrencias
                          </p>
                          <div className="h-1.5 rounded-full bg-white/10 mt-2 overflow-hidden">
                            <div
                              className="h-full bg-amber-400 rounded-full"
                              style={{ width: `${evaluacion.pctNeutros}%` }}
                            />
                          </div>
                        </div>

                        {/* ERRORES */}
                        <div className="p-3 rounded-xl bg-black/30 border border-rose-500/30">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-rose-400" />
                              Error
                            </span>
                            <span className="text-sm font-black text-white font-mono">
                              {evaluacion.pctErrores}%
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">
                            {evaluacion.errores} de {evaluacion.total} ocurrencias
                          </p>
                          <div className="h-1.5 rounded-full bg-white/10 mt-2 overflow-hidden">
                            <div
                              className="h-full bg-rose-400 rounded-full"
                              style={{ width: `${evaluacion.pctErrores}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Efectividad neta de la acción */}
                    {evaluacion && (
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 border-t border-white/10">
                        <span className="text-slate-300">
                          Saldo de efectividad neta (Puntos − Errores):
                        </span>
                        <span
                          className={`font-mono font-bold text-sm px-2 py-0.5 rounded ${
                            evaluacion.efectividadNeta > 0
                              ? "bg-emerald-500/20 text-emerald-300"
                              : evaluacion.efectividadNeta < 0
                              ? "bg-rose-500/20 text-rose-300"
                              : "bg-slate-700 text-slate-300"
                          }`}
                        >
                          {evaluacion.efectividadNeta > 0 ? "+" : ""}
                          {evaluacion.efectividadNeta}%
                        </span>
                      </div>
                    )}
                  </div>

                  {/* ---------- 2. MÉTRICAS CLAVE: DISTANCIA Y SUBTIPO MÁS FRECUENTE ---------- */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* SUBTIPO MÁS FRECUENTE */}
                    <div
                      className="rounded-xl p-3.5 space-y-1"
                      style={{
                        background: "var(--sx-surface-2)",
                        border: "1px solid var(--sx-border)",
                      }}
                    >
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Subtipo dominante
                      </span>
                      <p className="text-base font-black text-white capitalize truncate">
                        {estadisticas.subtipoMasFrecuente || "—"}
                      </p>
                      <p className="text-xs text-sky-400 font-medium">
                        {estadisticas.subtiposRanking[0]?.pct ?? 0}% de los casos
                        ({estadisticas.subtiposRanking[0]?.count ?? 0} veces)
                      </p>
                    </div>

                    {/* DISTANCIA EN ACCIONES */}
                    <div
                      className="rounded-xl p-3.5 space-y-1"
                      style={{
                        background: "var(--sx-surface-2)",
                        border: "1px solid var(--sx-border)",
                      }}
                    >
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Toques de distancia
                      </span>
                      <p className="text-base font-black text-white font-mono">
                        ~{estadisticas.promedioAccionesDistancia} toques
                      </p>
                      <p className="text-xs text-slate-400">
                        en promedio entre disparador y observación
                      </p>
                    </div>

                    {/* DISTANCIA EN PUNTOS */}
                    <div
                      className="rounded-xl p-3.5 space-y-1"
                      style={{
                        background: "var(--sx-surface-2)",
                        border: "1px solid var(--sx-border)",
                      }}
                    >
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Puntos de distancia
                      </span>
                      <p className="text-base font-black text-white font-mono">
                        {estadisticas.promedioPuntosDistancia === 0
                          ? "Mismo punto (0 pts)"
                          : `+${estadisticas.promedioPuntosDistancia} puntos`}
                      </p>
                      <p className="text-xs text-slate-400">
                        {estadisticas.pctMismoPunto}% mismo rally · {estadisticas.pctPuntosPosteriores}% después
                      </p>
                    </div>

                    {/* JUGADOR MÁS FRECUENTE */}
                    <div
                      className="rounded-xl p-3.5 space-y-1"
                      style={{
                        background: "var(--sx-surface-2)",
                        border: "1px solid var(--sx-border)",
                      }}
                    >
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Jugador predominante
                      </span>
                      <p className="text-base font-black text-white truncate">
                        {nombre(estadisticas.jugadorMasFrecuenteId)}
                      </p>
                      <p className="text-xs text-emerald-400 font-medium">
                        {estadisticas.jugadoresRanking[0]?.pct ?? 0}% de participación
                        ({estadisticas.jugadoresRanking[0]?.count ?? 0} veces)
                      </p>
                    </div>
                  </div>

                  {/* ---------- 3. DETALLE DE SUBTIPOS Y PATRONES DETECTADOS ---------- */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Ranking de Subtipos */}
                    <div
                      className="rounded-xl p-3.5 space-y-2.5"
                      style={{
                        background: "var(--sx-surface-2)",
                        border: "1px solid var(--sx-border)",
                      }}
                    >
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-200">
                        Distribución de subtipos de la acción observada
                      </p>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {estadisticas.subtiposRanking.map((s) => (
                          <div key={s.subtipo}>
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="font-semibold text-white capitalize truncate">
                                {s.subtipo}
                              </span>
                              <span className="text-slate-300 font-mono text-[11px] tabular-nums">
                                {s.count} ({s.pct}%)
                              </span>
                            </div>
                            <div
                              className="h-1.5 rounded-full overflow-hidden"
                              style={{ background: "rgba(255,255,255,0.08)" }}
                            >
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{
                                  width: `${s.pct}%`,
                                  background:
                                    "linear-gradient(90deg, #38BDF8 0%, #818CF8 100%)",
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Zonas y Jugadores */}
                    <div
                      className="rounded-xl p-3.5 space-y-3"
                      style={{
                        background: "var(--sx-surface-2)",
                        border: "1px solid var(--sx-border)",
                      }}
                    >
                      {/* Zonas destino preferidas */}
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-2">
                          Zonas destino más buscadas
                        </p>
                        {estadisticas.zonasRanking.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {estadisticas.zonasRanking.slice(0, 5).map((z) => (
                              <span
                                key={z.zona}
                                className="px-2.5 py-1 text-xs rounded-lg border font-semibold flex items-center gap-1.5"
                                style={{
                                  background: "rgba(167,139,250,0.12)",
                                  borderColor: "rgba(167,139,250,0.3)",
                                  color: "#C4B5FD",
                                }}
                              >
                                <span>Zona {z.zona}</span>
                                <span className="font-mono text-white text-[11px]">
                                  {z.pct}% ({z.count})
                                </span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 italic">
                            Sin registro de zonas para esta acción.
                          </p>
                        )}
                      </div>

                      {/* Patrones de coincidencia si hay comparadores activos */}
                      {hayComparadoresActivos(coincidencias) && (
                        <div className="pt-2 border-t border-white/10">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-1.5">
                            Comparaciones con la acción disparadora
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

                  {/* ---------- 4. TABLA DETALLADA DE OCURRENCIAS ---------- */}
                  <div
                    className="rounded-xl overflow-hidden border border-white/10"
                    style={{ background: "var(--sx-surface-2)" }}
                  >
                    <div className="px-3.5 py-2.5 flex items-center justify-between border-b border-white/10 bg-white/5">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-200">
                        Ocurrencias analizadas ({resultado.ocurrencias.length})
                      </p>
                      <span className="text-[11px] text-slate-400">
                        Orden cronológico del partido
                      </span>
                    </div>

                    <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                      <table className="w-full text-xs min-w-[620px]">
                        <thead
                          style={{
                            position: "sticky",
                            top: 0,
                            background: "rgba(15,29,53,0.98)",
                            borderBottom: "1px solid var(--sx-border)",
                          }}
                        >
                          <tr className="text-left text-slate-400">
                            <th className="py-2 px-3 font-semibold">Disparador</th>
                            <th className="py-2 px-3 font-semibold">
                              Acción Observada
                            </th>
                            <th className="py-2 px-3 font-semibold">
                              Distancia
                            </th>
                            <th className="py-2 px-3 font-semibold">
                              Resultado
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
                            const obs = o.accionObservada;
                            return (
                              <tr
                                key={`${o.set_numero}-${o.punto_numero}-${o.triggerId}`}
                                className="border-b border-white/5 hover:bg-white/5 transition"
                              >
                                {/* Disparador */}
                                <td className="py-2 px-3">
                                  <span className="font-mono text-slate-400 font-semibold block text-[11px]">
                                    Set {o.set_numero} · Punto {o.punto_numero}
                                  </span>
                                  <span className="font-bold text-white capitalize">
                                    {o.triggerSubtipo ?? disparador.tipo}
                                  </span>
                                  <span className="block text-[11px] text-slate-400">
                                    {nombre(o.triggerJugadorId)}
                                  </span>
                                </td>

                                {/* Acción Observada */}
                                <td className="py-2 px-3">
                                  {obs ? (
                                    <div>
                                      <span className="font-bold text-white capitalize">
                                        {obs.accion.tipo} · {obs.subtipo}
                                      </span>
                                      <span className="block text-[11px] text-slate-400">
                                        {nombre(obs.accion.jugador_id)}
                                        {obs.accion.zona_destino ? ` (Zona ${obs.accion.zona_destino})` : ""}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-500 italic">
                                      No hubo acción objetivo posterior
                                    </span>
                                  )}
                                </td>

                                {/* Distancia */}
                                <td className="py-2 px-3">
                                  {obs ? (
                                    <div className="text-[11px]">
                                      <span className="font-mono text-slate-300 font-medium block">
                                        {obs.distanciaPuntos === 0
                                          ? "Mismo punto"
                                          : `+${obs.distanciaPuntos} pts después`}
                                      </span>
                                      <span className="text-slate-400">
                                        +{obs.distanciaAcciones} toques después
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-600">—</span>
                                  )}
                                </td>

                                {/* Resultado */}
                                <td className="py-2 px-3">
                                  {obs ? (
                                    <span
                                      className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase inline-block ${
                                        obs.categoriaResultado === "punto"
                                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                          : obs.categoriaResultado === "error"
                                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                                          : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                      }`}
                                    >
                                      {obs.categoriaResultado === "punto"
                                        ? "Punto"
                                        : obs.categoriaResultado === "error"
                                        ? "Error"
                                        : "Neutro"}
                                    </span>
                                  ) : (
                                    <span className="text-slate-600">—</span>
                                  )}
                                </td>

                                {/* Botón Ir */}
                                {onIrAPunto && (
                                  <td className="py-2 px-3 text-right">
                                    <button
                                      onClick={() =>
                                        onIrAPunto(
                                          obs ? obs.accion.set_numero : o.set_numero,
                                          obs ? obs.accion.punto_numero : o.punto_numero
                                        )
                                      }
                                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-300 hover:bg-sky-500/25 transition"
                                    >
                                      Ir →
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
