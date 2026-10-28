"use client";

// ============================================================
// ANÁLISIS DE CONSECUENCIAS — FORMATO FORMAL Y UNIFORME
// ============================================================
// Visualización formal en formato lista/tabla uniforme.
// Soporta evaluación específica de jugador:
// - Si se evalúa un jugador, por defecto el disparador y la acción
//   observada corresponden a dicho jugador (salvo indicación contraria).
// - Muestra balance de desenlace, métricas de distancia, subtipos
//   y registro cronológico detallado.
// ============================================================

import { useMemo, useState, useEffect } from "react";
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
// PREGUNTAS TÁCTICAS PRECONFIGURADAS
// ------------------------------------------------------------

interface PreguntaRapida {
  id: string;
  titulo: string;
  descripcion: string;
  tipo: TipoDisparador;
  resultado: string;
  tipoObservado: TipoDisparador | "cualquiera";
  alcance: "partido" | "mismo_punto";
  ventana: Ventana;
  mismoJugador: boolean;
}

const PREGUNTAS_RAPIDAS: PreguntaRapida[] = [
  {
    id: "error-ataque-a-ataque",
    titulo: "Tras error de ataque → Siguiente ataque",
    descripcion: "¿Qué desenlace y subtipo tiene el siguiente ataque?",
    tipo: "ataque",
    resultado: "error",
    tipoObservado: "ataque",
    alcance: "partido",
    ventana: 1,
    mismoJugador: true,
  },
  {
    id: "mala-recep-a-ataque",
    titulo: "Tras mala recepción → Siguiente ataque",
    descripcion: "¿Cómo se resuelve el ataque proveniente de recepción negativa?",
    tipo: "recepcion",
    resultado: "negativa",
    tipoObservado: "ataque",
    alcance: "partido",
    ventana: 1,
    mismoJugador: false,
  },
  {
    id: "ace-saque-a-saque",
    titulo: "Tras ace de saque → Siguiente saque",
    descripcion: "¿Se mantiene la presión de saque o se genera error?",
    tipo: "saque",
    resultado: "ace",
    tipoObservado: "saque",
    alcance: "partido",
    ventana: 1,
    mismoJugador: true,
  },
  {
    id: "bloqueo-a-ataque",
    titulo: "Tras bloqueo punto → Siguiente ataque",
    descripcion: "¿En qué concluye el siguiente ataque tras punto de bloqueo?",
    tipo: "bloqueo",
    resultado: "punto",
    tipoObservado: "ataque",
    alcance: "partido",
    ventana: 1,
    mismoJugador: false,
  },
  {
    id: "defensa-a-ataque",
    titulo: "Tras defensa positiva → Siguiente ataque",
    descripcion: "¿Efectividad del contraataque tras salvar el balón?",
    tipo: "defensa",
    resultado: "toque_positiva",
    tipoObservado: "ataque",
    alcance: "partido",
    ventana: 1,
    mismoJugador: false,
  },
  {
    id: "inmediata-siguiente",
    titulo: "Acción inmediata siguiente",
    descripcion: "¿Cuál es el primer toque cronológico siguiente?",
    tipo: "ataque",
    resultado: "cualquiera",
    tipoObservado: "cualquiera",
    alcance: "mismo_punto",
    ventana: 1,
    mismoJugador: false,
  },
];

// ------------------------------------------------------------
// OPCIONES DE CONFIGURACIÓN
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
  { v: "cualquiera", label: "1ª acción siguiente inmediata" },
  { v: "ataque", label: "Siguiente acción de Ataque" },
  { v: "saque", label: "Siguiente acción de Saque" },
  { v: "recepcion", label: "Siguiente acción de Recepción" },
  { v: "bloqueo", label: "Siguiente acción de Bloqueo" },
  { v: "armado", label: "Siguiente acción de Armado" },
  { v: "defensa", label: "Siguiente acción de Defensa" },
];

const ALCANCES: { v: "partido" | "mismo_punto"; label: string }[] = [
  { v: "partido", label: "En el partido (mismo punto o posteriores)" },
  { v: "mismo_punto", label: "Solo dentro del mismo punto (rally)" },
];

interface ComparadorSimple {
  key: keyof CoincidenciaFiltro;
  etiqueta: string;
  detalle: string;
}

const COMPARADORES_ADICIONALES: ComparadorSimple[] = [
  {
    key: "mismaZonaTriggerDestino",
    etiqueta: "Misma zona destino",
    detalle: "Filtra si la acción cae en el mismo sector de la cancha",
  },
  {
    key: "mismaZonaTriggerOrigen",
    etiqueta: "Misma zona origen",
    detalle: "Filtra si la acción sale desde la misma zona",
  },
  {
    key: "mismaVelocidadAnterior",
    etiqueta: "Misma velocidad",
    detalle: "Filtra si se repite la velocidad de armado",
  },
];

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
  /** ID del jugador seleccionado si la vista evalúa a un jugador específico. */
  jugadorId?: string;
}

// ------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ------------------------------------------------------------

export default function AnalisisConsecuencias({
  acciones,
  onIrAPunto,
  nombreDeJugador,
  titulo = "Análisis de consecuencias tácticas",
  jugadorId,
}: Props) {
  // Estado del disparador
  const [disparador, setDisparador] = useState<DisparadorFiltro | null>({
    tipo: "ataque",
    resultado: "error",
  });

  // Filtro por jugador disparador (si hay jugadorId, por defecto se evalúa a él)
  const [jugadorFiltroId, setJugadorFiltroId] = useState<string | null>(
    jugadorId ?? null
  );

  // Acción objetivo a observar
  const [tipoObservado, setTipoObservado] = useState<
    TipoDisparador | "cualquiera"
  >("ataque");

  // Ámbito temporal
  const [alcance, setAlcance] = useState<"partido" | "mismo_punto">("partido");

  // Mismo jugador observado (si hay jugadorId, por defecto es true)
  const [mismoJugadorObservado, setMismoJugadorObservado] = useState<boolean>(
    Boolean(jugadorId)
  );

  const [ventana] = useState<Ventana>(1);
  const [coincidencias, setCoincidencias] = useState<CoincidenciaFiltro>({
    ...COINCIDENCIA_VACIA,
    mismoJugadorTrigger: Boolean(jugadorId),
  });

  const [preguntaActivaId, setPreguntaActivaId] = useState<string | null>(
    "error-ataque-a-ataque"
  );

  // Sincronizar si cambia el prop jugadorId
  useEffect(() => {
    if (jugadorId) {
      setJugadorFiltroId(jugadorId);
      setMismoJugadorObservado(true);
      setCoincidencias((prev) => ({ ...prev, mismoJugadorTrigger: true }));
    }
  }, [jugadorId]);

  // Actualizar coincidencias al cambiar selector de mismo jugador
  const cambiarMismoJugador = (valor: boolean) => {
    setPreguntaActivaId(null);
    setMismoJugadorObservado(valor);
    setCoincidencias((prev) => ({ ...prev, mismoJugadorTrigger: valor }));
  };

  // Lista de jugadores únicos encontrados en las acciones
  const listaJugadores = useMemo(() => {
    const ids = new Set<string>();
    for (const a of acciones) {
      if (a.jugador_id) ids.add(a.jugador_id);
    }
    return Array.from(ids);
  }, [acciones]);

  // Filtros empaquetados para el motor
  const filtros: FiltrosAnalisis = useMemo(
    () => ({
      disparador,
      ventana,
      coincidencias,
      tipoObservado,
      alcance,
      jugadorId: jugadorFiltroId,
    }),
    [disparador, ventana, coincidencias, tipoObservado, alcance, jugadorFiltroId]
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

    // Si estamos evaluando a un jugador particular, el error y la respuesta corresponden a él
    const reqMismoJugador = jugadorId ? true : p.mismoJugador;
    setMismoJugadorObservado(reqMismoJugador);
    setCoincidencias({
      ...COINCIDENCIA_VACIA,
      mismoJugadorTrigger: reqMismoJugador,
    });
  };

  const toggleComparador = (key: keyof CoincidenciaFiltro) => {
    setPreguntaActivaId(null);
    setCoincidencias((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const restablecerFiltros = () => {
    setPreguntaActivaId("error-ataque-a-ataque");
    setDisparador({ tipo: "ataque", resultado: "error" });
    setTipoObservado("ataque");
    setAlcance("partido");
    setJugadorFiltroId(jugadorId ?? null);
    setMismoJugadorObservado(Boolean(jugadorId));
    setCoincidencias({
      ...COINCIDENCIA_VACIA,
      mismoJugadorTrigger: Boolean(jugadorId),
    });
  };

  const estadisticas = resultado?.estadisticasObservadas;
  const evaluacion = estadisticas?.evaluacionResultado;

  return (
    <div
      className="rounded-xl border border-white/10 p-4 sm:p-5 space-y-4"
      style={{ background: "var(--sx-surface-1)" }}
    >
      {/* ============================================================ */}
      {/* 1. ENCABEZADO FORMAL Y UNIFORME */}
      {/* ============================================================ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold uppercase tracking-wider text-slate-100">
              {titulo}
            </span>
            {activo && resultado && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded border border-white/10 text-slate-300 bg-white/5">
                {resultado.totalOcurrencias} caso
                {resultado.totalOcurrencias !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Evaluación sistemática de secuencias causa-efecto en el juego
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={restablecerFiltros}
            className="text-xs px-2.5 py-1 rounded border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 transition"
          >
            Restablecer parámetros
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. PREGUNTAS TÁCTICAS FRECUENTES (LISTA UNIFORME DE ACCESO RÁPIDO) */}
      {/* ============================================================ */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
          Consultas tácticas predeterminadas:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
          {PREGUNTAS_RAPIDAS.map((p) => {
            const activa = preguntaActivaId === p.id;
            return (
              <button
                key={p.id}
                onClick={() => aplicarPreguntaRapida(p)}
                className={`text-left px-3 py-2 rounded-lg border text-xs transition flex flex-col justify-center ${
                  activa
                    ? "bg-white/10 border-slate-300 text-white font-medium"
                    : "bg-white/[0.02] border-white/10 text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="font-semibold">{p.titulo}</span>
                <span className="text-[10px] text-slate-400 truncate mt-0.5">
                  {p.descripcion}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ============================================================ */}
      {/* 3. PARÁMETROS DEL ANÁLISIS (FORMULARIO ESTRUCTURADO Y UNIFORME) */}
      {/* ============================================================ */}
      <div
        className="rounded-lg border border-white/10 p-3 sm:p-4 space-y-3"
        style={{ background: "var(--sx-surface-2)" }}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Parámetros de la condición
          </span>
          {jugadorFiltroId && (
            <span className="text-[11px] text-slate-400">
              Evaluando a:{" "}
              <strong className="text-slate-200">
                {nombre(jugadorFiltroId)}
              </strong>
            </span>
          )}
        </div>

        {disparador && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {/* 1. Tipo de acción disparadora */}
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-medium">
                Acción inicial (disparador)
              </label>
              <select
                value={disparador.tipo}
                onChange={(e) => {
                  setPreguntaActivaId(null);
                  setDisparador({
                    tipo: e.target.value as TipoDisparador,
                    resultado: "cualquiera",
                  });
                }}
                className="w-full bg-slate-900 text-white text-xs rounded-lg px-2.5 py-1.5 border border-white/10 focus:outline-none focus:border-slate-400 cursor-pointer"
              >
                {TIPOS_DISPARADOR.map((t) => (
                  <option key={t.v} value={t.v}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Resultado de la acción disparadora */}
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-medium">
                Resultado inicial requerido
              </label>
              <select
                value={disparador.resultado}
                onChange={(e) => {
                  setPreguntaActivaId(null);
                  setDisparador({ ...disparador, resultado: e.target.value });
                }}
                className="w-full bg-slate-900 text-white text-xs rounded-lg px-2.5 py-1.5 border border-white/10 focus:outline-none focus:border-slate-400 cursor-pointer"
              >
                {resultadosPorTipoAnalisis(disparador.tipo).map((r) => (
                  <option key={r} value={r}>
                    {etiquetaResultado(r)}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Jugador que ejecuta el disparador */}
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-medium">
                Jugador que ejecuta
              </label>
              <select
                value={jugadorFiltroId ?? "todos"}
                onChange={(e) => {
                  setPreguntaActivaId(null);
                  const val = e.target.value === "todos" ? null : e.target.value;
                  setJugadorFiltroId(val);
                  if (val) {
                    setMismoJugadorObservado(true);
                    setCoincidencias((prev) => ({
                      ...prev,
                      mismoJugadorTrigger: true,
                    }));
                  }
                }}
                className="w-full bg-slate-900 text-white text-xs rounded-lg px-2.5 py-1.5 border border-white/10 focus:outline-none focus:border-slate-400 cursor-pointer"
              >
                <option value="todos">Todo el equipo</option>
                {jugadorId && (
                  <option value={jugadorId}>
                    {nombre(jugadorId)} (jugador seleccionado)
                  </option>
                )}
                {listaJugadores
                  .filter((id) => id !== jugadorId)
                  .map((id) => (
                    <option key={id} value={id}>
                      {nombre(id)}
                    </option>
                  ))}
              </select>
            </div>

            {/* 4. Acción a observar */}
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-medium">
                Acción posterior a observar
              </label>
              <select
                value={tipoObservado}
                onChange={(e) => {
                  setPreguntaActivaId(null);
                  setTipoObservado(
                    e.target.value as TipoDisparador | "cualquiera"
                  );
                }}
                className="w-full bg-slate-900 text-white text-xs rounded-lg px-2.5 py-1.5 border border-white/10 focus:outline-none focus:border-slate-400 cursor-pointer"
              >
                {TIPOS_OBSERVADOS.map((t) => (
                  <option key={t.v} value={t.v}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 5. Quién ejecuta la acción observada */}
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-medium">
                Ejecutante de la acción observada
              </label>
              <select
                value={mismoJugadorObservado ? "mismo" : "cualquiera"}
                onChange={(e) => cambiarMismoJugador(e.target.value === "mismo")}
                className="w-full bg-slate-900 text-white text-xs rounded-lg px-2.5 py-1.5 border border-white/10 focus:outline-none focus:border-slate-400 cursor-pointer"
              >
                <option value="mismo">
                  {jugadorFiltroId
                    ? `Mismo jugador (${nombre(jugadorFiltroId)})`
                    : "Mismo jugador que disparó"}
                </option>
                <option value="cualquiera">
                  Cualquier jugador del equipo
                </option>
              </select>
            </div>

            {/* 6. Alcance del análisis */}
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-medium">
                Ámbito de búsqueda
              </label>
              <select
                value={alcance}
                onChange={(e) => {
                  setPreguntaActivaId(null);
                  setAlcance(e.target.value as "partido" | "mismo_punto");
                }}
                className="w-full bg-slate-900 text-white text-xs rounded-lg px-2.5 py-1.5 border border-white/10 focus:outline-none focus:border-slate-400 cursor-pointer"
              >
                {ALCANCES.map((a) => (
                  <option key={a.v} value={a.v}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Comparadores secundarios */}
        <div className="pt-2 border-t border-white/5 flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-slate-400 mr-1">
            Filtros espaciales complementarios:
          </span>
          {COMPARADORES_ADICIONALES.map((c) => {
            const activo = coincidencias[c.key];
            return (
              <button
                key={c.key}
                onClick={() => toggleComparador(c.key)}
                title={c.detalle}
                className={`px-2.5 py-1 text-xs rounded border transition flex items-center gap-1.5 ${
                  activo
                    ? "bg-slate-700 border-slate-400 text-white font-medium"
                    : "bg-white/[0.02] border-white/10 text-slate-400 hover:text-white"
                }`}
              >
                <span>{activo ? "✓" : "+"}</span>
                <span>{c.etiqueta}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ============================================================ */}
      {/* 4. RESULTADOS EN FORMATO FORMAL DE LISTA */}
      {/* ============================================================ */}
      {disparador && resultado && (
        <div className="space-y-4">
          {resultado.totalOcurrencias === 0 || !estadisticas ? (
            <div className="rounded-lg border border-white/10 p-6 text-center text-xs text-slate-400">
              No se hallaron secuencias registradas que cumplan con los criterios especificados.
            </div>
          ) : (
            <>
              {/* SECCIÓN A: BALANCE FORMAL DE RESULTADOS */}
              <div className="rounded-lg border border-white/10 overflow-hidden bg-slate-900/40">
                <div className="px-4 py-2.5 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white/[0.02]">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      Balance de desenlace:{" "}
                      <span className="capitalize text-white">
                        {tipoObservado === "cualquiera"
                          ? "1ª acción siguiente"
                          : `Siguiente ${tipoObservado}`}
                      </span>
                    </span>
                    {mismoJugadorObservado && (
                      <span className="ml-2 text-[11px] text-slate-400">
                        (evaluado en el mismo jugador)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Predominante:</span>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded border ${
                        evaluacion?.masFrecuente === "punto"
                          ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                          : evaluacion?.masFrecuente === "error"
                          ? "bg-rose-500/10 text-rose-300 border-rose-500/30"
                          : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                      }`}
                    >
                      {evaluacion?.masFrecuente === "punto"
                        ? "Punto directo"
                        : evaluacion?.masFrecuente === "error"
                        ? "Error"
                        : "Neutro / Continuó"}
                    </span>
                  </div>
                </div>

                {evaluacion && (
                  <div className="divide-y divide-white/5 text-xs">
                    {/* Fila: Punto */}
                    <div className="px-4 py-2.5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2 w-44 shrink-0">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="font-medium text-slate-200">
                          Punto directo
                        </span>
                      </div>
                      <div className="flex items-center gap-3 flex-1 max-w-sm">
                        <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${evaluacion.pctPuntos}%` }}
                          />
                        </div>
                        <span className="font-mono text-emerald-300 font-semibold w-12 text-right">
                          {evaluacion.pctPuntos}%
                        </span>
                      </div>
                      <span className="font-mono text-slate-400 text-right w-28 shrink-0">
                        {evaluacion.puntos} de {evaluacion.total}
                      </span>
                    </div>

                    {/* Fila: Neutro */}
                    <div className="px-4 py-2.5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2 w-44 shrink-0">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        <span className="font-medium text-slate-200">
                          Neutro / En juego
                        </span>
                      </div>
                      <div className="flex items-center gap-3 flex-1 max-w-sm">
                        <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full"
                            style={{ width: `${evaluacion.pctNeutros}%` }}
                          />
                        </div>
                        <span className="font-mono text-amber-300 font-semibold w-12 text-right">
                          {evaluacion.pctNeutros}%
                        </span>
                      </div>
                      <span className="font-mono text-slate-400 text-right w-28 shrink-0">
                        {evaluacion.neutros} de {evaluacion.total}
                      </span>
                    </div>

                    {/* Fila: Error */}
                    <div className="px-4 py-2.5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2 w-44 shrink-0">
                        <span className="w-2 h-2 rounded-full bg-rose-400" />
                        <span className="font-medium text-slate-200">
                          Error cometido
                        </span>
                      </div>
                      <div className="flex items-center gap-3 flex-1 max-w-sm">
                        <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full bg-rose-500 rounded-full"
                            style={{ width: `${evaluacion.pctErrores}%` }}
                          />
                        </div>
                        <span className="font-mono text-rose-300 font-semibold w-12 text-right">
                          {evaluacion.pctErrores}%
                        </span>
                      </div>
                      <span className="font-mono text-slate-400 text-right w-28 shrink-0">
                        {evaluacion.errores} de {evaluacion.total}
                      </span>
                    </div>

                    {/* Fila: Saldo Neto */}
                    <div className="px-4 py-2.5 flex items-center justify-between bg-white/[0.01]">
                      <span className="text-slate-300 font-medium">
                        Efectividad neta acumulada (Puntos − Errores)
                      </span>
                      <span
                        className={`font-mono font-bold px-2.5 py-0.5 rounded text-xs ${
                          evaluacion.efectividadNeta > 0
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                            : evaluacion.efectividadNeta < 0
                            ? "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                            : "bg-slate-700 text-slate-300"
                        }`}
                      >
                        {evaluacion.efectividadNeta > 0 ? "+" : ""}
                        {evaluacion.efectividadNeta}%
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* SECCIÓN B: LISTA DE MÉTRICAS E INDICADORES TÁCTICOS */}
              <div className="rounded-lg border border-white/10 overflow-hidden bg-slate-900/40">
                <div className="px-4 py-2.5 border-b border-white/10 bg-white/[0.02]">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Indicadores de ejecución y distancia
                  </h5>
                </div>

                <div className="divide-y divide-white/5 text-xs">
                  <div className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="text-slate-400">Subtipo más frecuente:</span>
                    <span className="font-semibold text-white capitalize">
                      {estadisticas.subtipoMasFrecuente || "—"}
                      <span className="text-slate-400 font-normal ml-2">
                        ({estadisticas.subtiposRanking[0]?.pct ?? 0}% ·{" "}
                        {estadisticas.subtiposRanking[0]?.count ?? 0} casos)
                      </span>
                    </span>
                  </div>

                  <div className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="text-slate-400">
                      Intervalo de toques entre acciones:
                    </span>
                    <span className="font-mono font-semibold text-white">
                      ~{estadisticas.promedioAccionesDistancia} toques de juego en promedio
                    </span>
                  </div>

                  <div className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="text-slate-400">
                      Intervalo en puntos de diferencia:
                    </span>
                    <span className="font-mono font-semibold text-white">
                      {estadisticas.promedioPuntosDistancia === 0
                        ? "Mismo punto (0 pts)"
                        : `+${estadisticas.promedioPuntosDistancia} puntos transcurridos`}
                      <span className="text-slate-400 font-normal ml-2">
                        ({estadisticas.pctMismoPunto}% mismo rally ·{" "}
                        {estadisticas.pctPuntosPosteriores}% puntos posteriores)
                      </span>
                    </span>
                  </div>

                  <div className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="text-slate-400">
                      Jugador predominante en la observación:
                    </span>
                    <span className="font-semibold text-white">
                      {nombre(estadisticas.jugadorMasFrecuenteId)}
                      <span className="text-slate-400 font-normal ml-2">
                        ({estadisticas.jugadoresRanking[0]?.pct ?? 0}% de los casos)
                      </span>
                    </span>
                  </div>

                  {estadisticas.zonasRanking.length > 0 && (
                    <div className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <span className="text-slate-400">
                        Zonas de destino más elegidas:
                      </span>
                      <span className="font-medium text-white">
                        {estadisticas.zonasRanking
                          .slice(0, 4)
                          .map((z) => `Zona ${z.zona} (${z.pct}%)`)
                          .join(" · ")}
                      </span>
                    </div>
                  )}

                  {hayComparadoresActivos(coincidencias) && (
                    <div className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 bg-white/[0.01]">
                      <span className="text-slate-400">
                        Coincidencias espaciales con disparador:
                      </span>
                      <span className="text-slate-300 font-medium">
                        {COMPARADORES_ADICIONALES.filter((c) => coincidencias[c.key])
                          .map((c) => {
                            const val = resultado.coincidenciasGlobales[c.key] ?? 0;
                            const pct = Math.round(
                              (val / resultado.totalOcurrencias) * 100
                            );
                            return `${c.etiqueta}: ${pct}% (${val}/${resultado.totalOcurrencias})`;
                          })
                          .join(" · ")}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* SECCIÓN C: DISTRIBUCIÓN DETALLADA DE SUBTIPOS (SI HAY MÁS DE 1) */}
              {estadisticas.subtiposRanking.length > 1 && (
                <div className="rounded-lg border border-white/10 overflow-hidden bg-slate-900/40">
                  <div className="px-4 py-2.5 border-b border-white/10 bg-white/[0.02]">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Desglose por subtipo de la acción observada (
                      {estadisticas.subtiposRanking.length} variantes)
                    </h5>
                  </div>

                  <div className="divide-y divide-white/5 max-h-48 overflow-y-auto text-xs">
                    {estadisticas.subtiposRanking.map((s) => (
                      <div
                        key={s.subtipo}
                        className="px-4 py-2 flex items-center justify-between gap-4"
                      >
                        <span className="font-medium text-slate-200 capitalize w-44 shrink-0 truncate">
                          {s.subtipo}
                        </span>
                        <div className="flex items-center gap-3 flex-1 max-w-sm">
                          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full bg-sky-400 rounded-full"
                              style={{ width: `${s.pct}%` }}
                            />
                          </div>
                          <span className="font-mono text-slate-300 font-semibold w-12 text-right">
                            {s.pct}%
                          </span>
                        </div>
                        <span className="font-mono text-slate-400 text-right w-24 shrink-0">
                          {s.count} veces
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SECCIÓN D: REGISTRO CRONOLÓGICO DE OCURRENCIAS (TABLA FORMAL) */}
              <div className="rounded-lg border border-white/10 overflow-hidden bg-slate-900/40">
                <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Registro de casos cronológicos ({resultado.ocurrencias.length})
                  </h5>
                  <span className="text-[11px] text-slate-400">
                    Orden secuencial de juego
                  </span>
                </div>

                <div className="overflow-x-auto max-h-[340px] overflow-y-auto">
                  <table className="w-full text-xs min-w-[620px]">
                    <thead className="sticky top-0 bg-slate-950 border-b border-white/10 text-slate-400 text-left font-medium">
                      <tr>
                        <th className="py-2.5 px-3">Momento</th>
                        <th className="py-2.5 px-3">Acción Disparadora</th>
                        <th className="py-2.5 px-3">Acción Observada</th>
                        <th className="py-2.5 px-3">Intervalo</th>
                        <th className="py-2.5 px-3">Desenlace</th>
                        {onIrAPunto && (
                          <th className="py-2.5 px-3 text-right">Punto</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {resultado.ocurrencias.map((o) => {
                        const obs = o.accionObservada;
                        return (
                          <tr
                            key={`${o.set_numero}-${o.punto_numero}-${o.triggerId}`}
                            className="hover:bg-white/[0.03] transition"
                          >
                            {/* Momento */}
                            <td className="py-2 px-3 font-mono text-slate-400 whitespace-nowrap">
                              Set {o.set_numero} · P.{o.punto_numero}
                            </td>

                            {/* Disparador */}
                            <td className="py-2 px-3">
                              <span className="font-semibold text-slate-100 capitalize">
                                {o.triggerSubtipo ?? disparador.tipo}
                              </span>
                              <span className="text-[11px] text-slate-400 ml-1.5">
                                ({nombre(o.triggerJugadorId)})
                              </span>
                            </td>

                            {/* Acción observada */}
                            <td className="py-2 px-3">
                              {obs ? (
                                <div>
                                  <span className="font-semibold text-slate-100 capitalize">
                                    {obs.subtipo}
                                  </span>
                                  <span className="text-[11px] text-slate-400 ml-1.5">
                                    ({nombre(obs.accion.jugador_id)})
                                  </span>
                                  {obs.accion.zona_destino !== null && (
                                    <span className="text-[11px] text-slate-400 ml-1">
                                      → Z{obs.accion.zona_destino}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-500 italic">
                                  Sin acción posterior
                                </span>
                              )}
                            </td>

                            {/* Intervalo */}
                            <td className="py-2 px-3 font-mono text-slate-300 whitespace-nowrap">
                              {obs ? (
                                <span>
                                  {obs.distanciaAcciones} toque
                                  {obs.distanciaAcciones !== 1 ? "s" : ""}{" "}
                                  <span className="text-slate-500 text-[11px]">
                                    ({obs.distanciaPuntos === 0
                                      ? "mismo rally"
                                      : `+${obs.distanciaPuntos} pts`})
                                  </span>
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>

                            {/* Desenlace */}
                            <td className="py-2 px-3">
                              {obs ? (
                                <span
                                  className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                                    obs.categoriaResultado === "punto"
                                      ? "bg-emerald-500/15 text-emerald-300"
                                      : obs.categoriaResultado === "error"
                                      ? "bg-rose-500/15 text-rose-300"
                                      : "bg-amber-500/15 text-amber-300"
                                  }`}
                                >
                                  {obs.categoriaResultado === "punto"
                                    ? "Punto"
                                    : obs.categoriaResultado === "error"
                                    ? "Error"
                                    : "Neutro"}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>

                            {/* Ir al punto */}
                            {onIrAPunto && (
                              <td className="py-2 px-3 text-right">
                                <button
                                  onClick={() =>
                                    onIrAPunto(o.set_numero, o.punto_numero)
                                  }
                                  className="text-xs text-sky-400 hover:text-sky-300 underline font-medium"
                                >
                                  Ver
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
  );
}
