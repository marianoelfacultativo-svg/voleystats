"use client";

// ============================================================
// ANÁLISIS DE CONSECUENCIAS — UI
// ============================================================
// Secciones:
//   1. Preguntas tácticas rápidas
//   2. Parámetros
//      a. Trigger + Acción observada
//      b. Contexto del partido (marcador, rally, inicio, ubicación, racha)
//      c. Rachas históricas (lista dinámica con desdeAtras)
//      d. Comparadores
//   3. Comportamiento del trigger (cómo actúa el jugador)
//   4. Consecuencia (qué pasa después)
//
// Consume el motor de lib/analisisConsecuencias.ts.
// ============================================================

import { useMemo, useState, useEffect } from "react";
import {
  analizarConsecuencias,
  etiquetaAmbito,
  etiquetaCierraPunto,
  etiquetaRelacion,
  etiquetaResultado,
  etiquetaTipoDisparador,
  etiquetaUbicacion,
  hayComparadoresActivos,
  hayContextoPartidoActivo,
  hayFiltroAnalisisActivo,
  resultadosPorTipoAnalisis,
  COINCIDENCIA_VACIA,
  CONTEXTO_PARTIDO_VACIO,
  FILTRO_ACCION_HISTORICA_VACIO,
  type AmbitoRacha,
  type CierraPuntoFiltro,
  type CoincidenciaFiltro,
  type ComportamientoTrigger,
  type ContextoPartidoFiltro,
  type DisparadorFiltro,
  type FiltroAccionHistorica,
  type FiltrosAnalisis,
  type MarcadorFiltro,
  type RachaHistorica,
  type RelacionJugador,
  type ResultadoAnalisis,
  type TipoDisparador,
  type UbicacionFiltro,
  type Ventana,
} from "@/lib/analisisConsecuencias";
import type { AccionVisual } from "./adaptadorUnificadoV2";

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
  { v: "cualquiera", label: "1ª acción siguiente" },
  { v: "ataque", label: "Siguiente ataque" },
  { v: "saque", label: "Siguiente saque" },
  { v: "recepcion", label: "Siguiente recepción" },
  { v: "bloqueo", label: "Siguiente bloqueo" },
  { v: "armado", label: "Siguiente armado" },
  { v: "defensa", label: "Siguiente defensa" },
];

const ALCANCES = [
  { v: "partido" as const, label: "En el partido" },
  { v: "mismo_punto" as const, label: "Solo en el mismo punto" },
];

const AMBITOS: { v: AmbitoRacha; label: string }[] = [
  { v: "mismo_punto", label: "Mismo punto" },
  { v: "puntos_del_set", label: "Este set" },
  { v: "partido", label: "Todo el partido" },
];

const UBICACIONES: { v: UbicacionFiltro; label: string }[] = [
  { v: "cualquiera", label: "Cualquier ubicación" },
  { v: "delantero", label: "Delantero (Z2/Z3/Z4)" },
  { v: "zaguero", label: "Zaguero (Z1/Z5/Z6)" },
  { v: "libero", label: "Líbero" },
  { v: "otro", label: "Otro" },
];

const RELACIONES: { v: RelacionJugador; label: string }[] = [
  { v: "cualquiera", label: "Cualquier jugador" },
  { v: "mismo", label: "El mismo jugador" },
  { v: "companero", label: "Un compañero" },
  { v: "rival", label: "Un rival" },
];

const CIERRAS: { v: CierraPuntoFiltro; label: string }[] = [
  { v: "cualquiera", label: "Cualquiera" },
  { v: "si", label: "Solo si cerró el punto" },
  { v: "no", label: "Solo si NO cerró el punto" },
];

const VELOCIDADES: { v: number | null; label: string }[] = [
  { v: null, label: "Cualquiera" },
  { v: 1, label: "1" },
  { v: 1.5, label: "1.5" },
  { v: 2, label: "2" },
  { v: 3, label: "3" },
  { v: 5, label: "5" },
];

const TIPOS_SAQUE: { v: "potencia" | "flotado" | null; label: string }[] = [
  { v: null, label: "Cualquiera" },
  { v: "potencia", label: "Potencia" },
  { v: "flotado", label: "Flotado" },
];

const ZONAS_JUGADOR: { v: number | "cualquiera"; label: string }[] = [
  { v: "cualquiera", label: "Cualquiera" },
  { v: 1, label: "Z1" },
  { v: 2, label: "Z2" },
  { v: 3, label: "Z3" },
  { v: 4, label: "Z4" },
  { v: 5, label: "Z5" },
  { v: 6, label: "Z6" },
];

const ESTADOS_MARCADOR: {
  v: "cualquiera" | "empatado" | "ganando" | "perdiendo";
  label: string;
}[] = [
  { v: "cualquiera", label: "Cualquier estado" },
  { v: "empatado", label: "Empatado" },
  { v: "ganando", label: "Ganando" },
  { v: "perdiendo", label: "Perdiendo" },
];

const DIFERENCIAS_MARCADOR: {
  v: "cualquiera" | "0" | "1-2" | "3-5" | "6+";
  label: string;
}[] = [
  { v: "cualquiera", label: "Cualquier diferencia" },
  { v: "0", label: "Empate (0)" },
  { v: "1-2", label: "1-2 puntos" },
  { v: "3-5", label: "3-5 puntos" },
  { v: "6+", label: "6+ puntos" },
];

const PUNTOS_CERRAR: {
  v: "cualquiera" | "<=1" | "<=3" | "<=5";
  label: string;
}[] = [
  { v: "cualquiera", label: "Cualquiera" },
  { v: "<=1", label: "≤ 1 (match point)" },
  { v: "<=3", label: "≤ 3 (cierre inminente)" },
  { v: "<=5", label: "≤ 5 (crítico)" },
];

const FASES_RALLY: {
  v: "cualquiera" | "side-out" | "contraataque" | "free-ball" | "otro";
  label: string;
}[] = [
  { v: "cualquiera", label: "Cualquier fase" },
  { v: "side-out", label: "Side-out" },
  { v: "contraataque", label: "Contraataque" },
  { v: "free-ball", label: "Free ball" },
  { v: "otro", label: "Otro" },
];

const INICIOS_PUNTO: {
  v:
    | "cualquiera"
    | "ace_propio"
    | "ace_rival"
    | "recepcion_positiva"
    | "recepcion_neutra"
    | "recepcion_negativa"
    | "overpass"
    | "error_directo"
    | "otro";
  label: string;
}[] = [
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

// ------------------------------------------------------------
// PREGUNTAS RÁPIDAS
// ------------------------------------------------------------

interface PreguntaRapida {
  id: string;
  titulo: string;
  descripcion: string;
  tipo: TipoDisparador;
  resultado: string;
  tipoObservado: TipoDisparador | "cualquiera";
  alcance: "partido" | "mismo_punto";
  jugadorObservado: "mismo" | "cualquiera";
  rachas?: RachaHistorica[];
  contextoPartido?: ContextoPartidoFiltro;
}

const PREGUNTAS_RAPIDAS: PreguntaRapida[] = [
  {
    id: "error-ataque-a-ataque",
    titulo: "Tras error de ataque → Siguiente ataque",
    descripcion: "¿Qué desenlace tiene el siguiente ataque?",
    tipo: "ataque",
    resultado: "error",
    tipoObservado: "ataque",
    alcance: "partido",
    jugadorObservado: "mismo",
  },
  {
    id: "mala-recep-a-ataque",
    titulo: "Tras mala recepción → Siguiente ataque",
    descripcion: "¿Cómo se resuelve el ataque?",
    tipo: "recepcion",
    resultado: "negativa",
    tipoObservado: "ataque",
    alcance: "partido",
    jugadorObservado: "cualquiera",
  },
  {
    id: "ace-saque-a-saque",
    titulo: "Tras ace de saque → Siguiente saque",
    descripcion: "¿Se mantiene la presión o hay error?",
    tipo: "saque",
    resultado: "ace",
    tipoObservado: "saque",
    alcance: "partido",
    jugadorObservado: "mismo",
  },
  {
    id: "bloqueo-a-ataque",
    titulo: "Tras bloqueo punto → Siguiente ataque",
    descripcion: "¿En qué concluye el siguiente ataque?",
    tipo: "bloqueo",
    resultado: "punto",
    tipoObservado: "ataque",
    alcance: "partido",
    jugadorObservado: "cualquiera",
  },
  {
    id: "defensa-a-ataque",
    titulo: "Tras defensa positiva → Siguiente ataque",
    descripcion: "¿Efectividad del contraataque?",
    tipo: "defensa",
    resultado: "toque_positiva",
    tipoObservado: "ataque",
    alcance: "partido",
    jugadorObservado: "cualquiera",
  },
  {
    id: "inmediata-siguiente",
    titulo: "Acción inmediata siguiente",
    descripcion: "¿Cuál es el primer toque siguiente?",
    tipo: "ataque",
    resultado: "cualquiera",
    tipoObservado: "cualquiera",
    alcance: "mismo_punto",
    jugadorObservado: "cualquiera",
  },
  {
    id: "cierre-de-set",
    titulo: "Acciones en cierre de set",
    descripcion: "¿Qué hace el equipo en los puntos críticos del set?",
    tipo: "ataque",
    resultado: "cualquiera",
    tipoObservado: "ataque",
    alcance: "partido",
    jugadorObservado: "cualquiera",
    contextoPartido: {
      ...CONTEXTO_PARTIDO_VACIO,
      marcador: {
        ...CONTEXTO_PARTIDO_VACIO.marcador,
        puntosParaCerrar: "<=3",
      },
    },
  },
  {
    id: "en-racha-ganando",
    titulo: "En racha ganadora (3+)",
    descripcion: "¿Cómo juega el equipo cuando ganó 3+ puntos seguidos?",
    tipo: "ataque",
    resultado: "cualquiera",
    tipoObservado: "ataque",
    alcance: "partido",
    jugadorObservado: "cualquiera",
    contextoPartido: {
      ...CONTEXTO_PARTIDO_VACIO,
      rachaPuntos: 3,
    },
  },
];

// ------------------------------------------------------------
// COMPARADORES
// ------------------------------------------------------------

const COMPARADORES: {
  key: keyof CoincidenciaFiltro;
  etiqueta: string;
  detalle: string;
}[] = [
  {
    key: "mismaZonaTriggerDestino",
    etiqueta: "Misma zona destino",
    detalle: "La observada cae en la misma zona destino que el trigger",
  },
  {
    key: "mismaZonaTriggerOrigen",
    etiqueta: "Misma zona origen",
    detalle: "La observada sale de la misma zona origen que el trigger",
  },
  {
    key: "mismaVelocidadAnterior",
    etiqueta: "Misma velocidad",
    detalle: "La observada tiene la misma velocidad que la previa",
  },
];

// ------------------------------------------------------------
// PROPS
// ------------------------------------------------------------

interface Props {
  acciones: AccionVisual[];
  onIrAPunto?: (set: number, punto: number) => void;
  nombreDeJugador?: (id: string | null) => string;
  titulo?: string;
  jugadorId?: string;
  jugadoresDisponibles?: { id: string; nombre: string }[];
}

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

let _rachaCounter = 0;
function generarIdRacha(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `racha-${crypto.randomUUID()}`;
  }
  _rachaCounter += 1;
  return `racha-${Date.now()}-${_rachaCounter}`;
}

function nuevaRacha(): RachaHistorica {
  return {
    id: generarIdRacha(),
    ambito: "mismo_punto",
    desdeAtras: 0,
    minimo: 1,
    filtro: { ...FILTRO_ACCION_HISTORICA_VACIO },
  };
}

function resumenRacha(r: RachaHistorica): string {
  const partes: string[] = [];
  partes.push(etiquetaAmbito(r.ambito));
  partes.push(`≥${r.minimo}`);
  if (r.desdeAtras > 0) partes.push(`saltar ${r.desdeAtras}`);
  if (r.filtro.tipos.length > 0) {
    partes.push(
      r.filtro.tipos.map((t) => etiquetaTipoDisparador(t)).join("|")
    );
  } else {
    partes.push("cualquier acción");
  }
  if (r.filtro.resultados.length > 0) {
    partes.push(r.filtro.resultados[0]);
  }
  if (r.filtro.ubicacion !== "cualquiera") {
    partes.push(etiquetaUbicacion(r.filtro.ubicacion));
  }
  if (r.filtro.cierraPunto !== "cualquiera") {
    partes.push(etiquetaCierraPunto(r.filtro.cierraPunto));
  }
  return partes.join(" · ");
}

const cardBase: React.CSSProperties = {
  background: "var(--sx-surface-1)",
  border: "1px solid var(--sx-border)",
};

// ------------------------------------------------------------
// COMPONENTE PRINCIPAL
// ------------------------------------------------------------

export default function AnalisisConsecuencias({
  acciones,
  onIrAPunto,
  nombreDeJugador,
  titulo = "Análisis de consecuencias",
  jugadorId,
  jugadoresDisponibles,
}: Props) {
  const [disparador, setDisparador] = useState<DisparadorFiltro | null>({
    tipo: "ataque",
    resultado: "error",
  });
  const [jugadorFiltroId, setJugadorFiltroId] = useState<string | null>(
    jugadorId ?? null
  );
  const [rachas, setRachas] = useState<RachaHistorica[]>([]);
  const [contextoPartido, setContextoPartido] =
    useState<ContextoPartidoFiltro>({ ...CONTEXTO_PARTIDO_VACIO });
  const [tipoObservado, setTipoObservado] = useState<
    TipoDisparador | "cualquiera"
  >("ataque");
  const [jugadorObservadoFiltro, setJugadorObservadoFiltro] = useState<string>(
    jugadorId ? "mismo" : "cualquiera"
  );
  const [alcance, setAlcance] = useState<"partido" | "mismo_punto">("partido");
  const [coincidencias, setCoincidencias] = useState<CoincidenciaFiltro>({
    ...COINCIDENCIA_VACIA,
  });
  const [preguntaActivaId, setPreguntaActivaId] = useState<string | null>(null);

  useEffect(() => {
    if (jugadorId) {
      setJugadorFiltroId(jugadorId);
      setJugadorObservadoFiltro("mismo");
    }
  }, [jugadorId]);

  const listaJugadores = useMemo(() => {
    const ids = new Set<string>();
    for (const a of acciones) if (a.jugador_id) ids.add(a.jugador_id);
    if (jugadoresDisponibles) {
      for (const j of jugadoresDisponibles) ids.add(j.id);
    }
    return Array.from(ids);
  }, [acciones, jugadoresDisponibles]);

  const nombre = (id: string | null): string => {
    if (!id) return "—";
    if (nombreDeJugador) return nombreDeJugador(id);
    const j = jugadoresDisponibles?.find((x) => x.id === id);
    if (j) return j.nombre;
    return id.slice(0, 8);
  };

  const jugadoresParaDropdown = useMemo(
    () =>
      listaJugadores
        .map((id) => ({ id, nombre: nombre(id) }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listaJugadores, nombreDeJugador, jugadoresDisponibles]
  );

  const filtros: FiltrosAnalisis = useMemo(() => {
    const esMismo = jugadorObservadoFiltro === "mismo";
    const esCualquiera = jugadorObservadoFiltro === "cualquiera";
    const jugadorObservadoId =
      esMismo || esCualquiera ? null : jugadorObservadoFiltro;

    return {
      disparador,
      jugadorId: jugadorFiltroId,
      rachas,
      contextoPartido: hayContextoPartidoActivo(contextoPartido)
        ? contextoPartido
        : null,
      tipoObservado,
      jugadorObservadoId,
      alcance,
      ventana: 1 as Ventana,
      coincidencias: {
        ...coincidencias,
        mismoJugadorTrigger: esMismo,
      },
    };
  }, [
    disparador,
    jugadorFiltroId,
    rachas,
    contextoPartido,
    tipoObservado,
    jugadorObservadoFiltro,
    alcance,
    coincidencias,
  ]);

  const resultado: ResultadoAnalisis | null = useMemo(() => {
    if (!disparador) return null;
    return analizarConsecuencias(acciones, filtros);
  }, [acciones, filtros, disparador]);

  const activo = hayFiltroAnalisisActivo(filtros);

  // Handlers
  const agregarRacha = () => setRachas((prev) => [...prev, nuevaRacha()]);
  const eliminarRacha = (id: string) =>
    setRachas((prev) => prev.filter((r) => r.id !== id));
  const actualizarRacha = (id: string, cambios: Partial<RachaHistorica>) => {
    setRachas((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...cambios } : r))
    );
  };

  const actualizarContexto = (cambios: Partial<ContextoPartidoFiltro>) => {
    setContextoPartido((prev) => ({ ...prev, ...cambios }));
  };

  const actualizarMarcador = (cambios: Partial<MarcadorFiltro>) => {
    setContextoPartido((prev) => ({
      ...prev,
      marcador: { ...prev.marcador, ...cambios },
    }));
  };

  const aplicarPreguntaRapida = (p: PreguntaRapida) => {
    setPreguntaActivaId(p.id);
    setDisparador({ tipo: p.tipo, resultado: p.resultado });
    setTipoObservado(p.tipoObservado);
    setAlcance(p.alcance);
    setRachas(p.rachas ?? []);
    setContextoPartido(p.contextoPartido ?? { ...CONTEXTO_PARTIDO_VACIO });
    const obs = jugadorId ? "mismo" : p.jugadorObservado;
    setJugadorObservadoFiltro(obs);
    setCoincidencias({
      ...COINCIDENCIA_VACIA,
      mismoJugadorTrigger: obs === "mismo",
    });
  };

  const toggleComparador = (key: keyof CoincidenciaFiltro) => {
    setPreguntaActivaId(null);
    setCoincidencias((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const cambiarJugadorObservado = (valor: string) => {
    setPreguntaActivaId(null);
    setJugadorObservadoFiltro(valor);
    setCoincidencias((prev) => ({
      ...prev,
      mismoJugadorTrigger: valor === "mismo",
    }));
  };

  const restablecer = () => {
    setPreguntaActivaId(null);
    setDisparador({ tipo: "ataque", resultado: "error" });
    setTipoObservado("ataque");
    setAlcance("partido");
    setRachas([]);
    setContextoPartido({ ...CONTEXTO_PARTIDO_VACIO });
    setJugadorFiltroId(jugadorId ?? null);
    setJugadorObservadoFiltro(jugadorId ? "mismo" : "cualquiera");
    setCoincidencias({ ...COINCIDENCIA_VACIA });
  };

  return (
    <div
      className="rounded-xl border border-white/10 p-4 sm:p-5 space-y-4"
      style={cardBase}
    >
      {/* HEADER */}
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
            Análisis de comportamiento y consecuencias en contexto táctico
          </p>
        </div>
        <button
          onClick={restablecer}
          className="text-xs px-2.5 py-1 rounded border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 transition"
        >
          Restablecer
        </button>
      </div>

      {/* PREGUNTAS RÁPIDAS */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
          Consultas tácticas predeterminadas
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
          {PREGUNTAS_RAPIDAS.map((p) => {
            const activa = preguntaActivaId === p.id;
            return (
              <button
                key={p.id}
                onClick={() => aplicarPreguntaRapida(p)}
                className={`text-left px-3 py-2 rounded-lg border text-xs transition ${
                  activa
                    ? "bg-white/10 border-slate-300 text-white font-medium"
                    : "bg-white/[0.02] border-white/10 text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <div className="font-semibold">{p.titulo}</div>
                <div className="text-[10px] text-slate-400 truncate mt-0.5">
                  {p.descripcion}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* PARÁMETROS */}
      <div
        className="rounded-lg border border-white/10 p-3 sm:p-4 space-y-3"
        style={{ background: "var(--sx-surface-2)" }}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Parámetros
          </span>
          {jugadorFiltroId && (
            <span className="text-[11px] text-slate-400">
              Trigger:{" "}
              <strong className="text-slate-200">
                {nombre(jugadorFiltroId)}
              </strong>
            </span>
          )}
        </div>

        {/* Trigger + Acción observada */}
        {disparador && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-medium">
                Trigger · tipo
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
                className="w-full bg-slate-900 text-white text-xs rounded-lg px-2.5 py-1.5 border border-white/10 focus:outline-none"
              >
                {TIPOS_DISPARADOR.map((t) => (
                  <option key={t.v} value={t.v}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-medium">
                Trigger · resultado
              </label>
              <select
                value={disparador.resultado}
                onChange={(e) => {
                  setPreguntaActivaId(null);
                  setDisparador({ ...disparador, resultado: e.target.value });
                }}
                className="w-full bg-slate-900 text-white text-xs rounded-lg px-2.5 py-1.5 border border-white/10 focus:outline-none"
              >
                {resultadosPorTipoAnalisis(disparador.tipo).map((r) => (
                  <option key={r} value={r}>
                    {etiquetaResultado(r)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-medium">
                Trigger · jugador
              </label>
              <select
                value={jugadorFiltroId ?? "todos"}
                onChange={(e) => {
                  setPreguntaActivaId(null);
                  const val =
                    e.target.value === "todos" ? null : e.target.value;
                  setJugadorFiltroId(val);
                  if (val) {
                    setJugadorObservadoFiltro("mismo");
                    setCoincidencias((prev) => ({
                      ...prev,
                      mismoJugadorTrigger: true,
                    }));
                  }
                }}
                className="w-full bg-slate-900 text-white text-xs rounded-lg px-2.5 py-1.5 border border-white/10 focus:outline-none"
              >
                <option value="todos">Todo el equipo</option>
                {jugadorId && (
                  <option value={jugadorId}>
                    {nombre(jugadorId)} (jugador)
                  </option>
                )}
                {jugadoresParaDropdown
                  .filter((j) => j.id !== jugadorId)
                  .map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.nombre}
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-medium">
                Observado · tipo
              </label>
              <select
                value={tipoObservado}
                onChange={(e) => {
                  setPreguntaActivaId(null);
                  setTipoObservado(
                    e.target.value as TipoDisparador | "cualquiera"
                  );
                }}
                className="w-full bg-slate-900 text-white text-xs rounded-lg px-2.5 py-1.5 border border-white/10 focus:outline-none"
              >
                {TIPOS_OBSERVADOS.map((t) => (
                  <option key={t.v} value={t.v}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-medium">
                Observado · jugador
              </label>
              <select
                value={jugadorObservadoFiltro}
                onChange={(e) => cambiarJugadorObservado(e.target.value)}
                className="w-full bg-slate-900 text-white text-xs rounded-lg px-2.5 py-1.5 border border-white/10 focus:outline-none"
              >
                <option value="mismo">
                  {jugadorFiltroId
                    ? `Mismo que el trigger (${nombre(jugadorFiltroId)})`
                    : "Mismo jugador que el trigger"}
                </option>
                <option value="cualquiera">Cualquier jugador</option>
                {jugadoresParaDropdown.length > 0 && (
                  <optgroup label="Jugador específico">
                    {jugadoresParaDropdown.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.nombre}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-medium">
                Observado · alcance
              </label>
              <select
                value={alcance}
                onChange={(e) => {
                  setPreguntaActivaId(null);
                  setAlcance(e.target.value as "partido" | "mismo_punto");
                }}
                className="w-full bg-slate-900 text-white text-xs rounded-lg px-2.5 py-1.5 border border-white/10 focus:outline-none"
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

        {/* CONTEXTO DEL PARTIDO */}
        <ContextoPartidoEditor
          contexto={contextoPartido}
          onCambiar={actualizarContexto}
          onCambiarMarcador={actualizarMarcador}
        />

        {/* RACHAS HISTÓRICAS */}
        <div className="pt-3 border-t border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
              Historia previa al trigger ({rachas.length})
            </span>
            <button
              onClick={agregarRacha}
              className="px-2.5 py-1 text-[11px] font-semibold rounded border border-violet-500/40 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20"
            >
              + Agregar racha
            </button>
          </div>

          {rachas.length === 0 ? (
            <p className="text-[11px] text-slate-500 italic">
              Sin filtro de historia. Se analizan todos los triggers.
            </p>
          ) : (
            <div className="space-y-2">
              {rachas.map((racha, idx) => (
                <RachaEditor
                  key={racha.id}
                  indice={idx + 1}
                  racha={racha}
                  onCambiar={(cambios) => actualizarRacha(racha.id, cambios)}
                  onEliminar={() => eliminarRacha(racha.id)}
                />
              ))}
              <p className="text-[10px] text-slate-500 italic">
                Todas las rachas se combinan con AND (el trigger tiene que
                cumplirlas todas).
              </p>
            </div>
          )}
        </div>

        {/* COMPARADORES */}
        <div className="pt-3 border-t border-white/5">
          <p className="text-[11px] text-slate-400 mb-1.5">
            Comparadores de la acción observada
          </p>
          <div className="flex flex-wrap gap-2">
            {COMPARADORES.map((c) => {
              const act = coincidencias[c.key];
              return (
                <button
                  key={c.key}
                  onClick={() => toggleComparador(c.key)}
                  title={c.detalle}
                  className={`px-2.5 py-1 text-xs rounded border transition flex items-center gap-1.5 ${
                    act
                      ? "bg-slate-700 border-slate-400 text-white font-medium"
                      : "bg-white/[0.02] border-white/10 text-slate-400 hover:text-white"
                  }`}
                >
                  <span>{act ? "✓" : "+"}</span>
                  <span>{c.etiqueta}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* RESULTADOS */}
      {disparador && resultado && (
        <div className="space-y-4">
          {resultado.totalOcurrencias === 0 ? (
            <div className="rounded-lg border border-white/10 p-6 text-center text-xs text-slate-400">
              No hay triggers que cumplan todos los criterios.
            </div>
          ) : (
            <>
              {resultado.comportamientoTrigger && (
                <SeccionComportamiento
                  comportamiento={resultado.comportamientoTrigger}
                  nombreDeJugador={(id) => nombre(id)}
                />
              )}

              {resultado.estadisticasObservadas && (
                <SeccionConsecuencia
                  resultado={resultado}
                  disparador={disparador}
                  tipoObservado={tipoObservado}
                  jugadorObservadoFiltro={jugadorObservadoFiltro}
                  nombre={nombre}
                  coincidencias={coincidencias}
                  onIrAPunto={onIrAPunto}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// SUBCOMPONENTE: CONTEXTO DEL PARTIDO
// ============================================================

function ContextoPartidoEditor({
  contexto,
  onCambiar,
  onCambiarMarcador,
}: {
  contexto: ContextoPartidoFiltro;
  onCambiar: (cambios: Partial<ContextoPartidoFiltro>) => void;
  onCambiarMarcador: (cambios: Partial<MarcadorFiltro>) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const activo = hayContextoPartidoActivo(contexto);

  return (
    <div
      className="pt-3 border-t border-white/5"
      style={{
        background: activo ? "rgba(167,139,250,0.06)" : "transparent",
        borderRadius: 8,
        padding: activo ? 8 : 0,
      }}
    >
      <button
        onClick={() => setAbierto(!abierto)}
        className="w-full flex items-center justify-between text-[11px] font-bold uppercase tracking-wider"
        style={{ color: "var(--sx-text-primary)" }}
      >
        <span className="flex items-center gap-1.5">
          Contexto del partido
          {activo && (
            <span
              className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
              style={{
                background: "rgba(167,139,250,0.2)",
                color: "#C4B5FD",
                border: "1px solid rgba(167,139,250,0.4)",
              }}
            >
              Activo
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
          {/* Marcador */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Marcador
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">Estado</label>
                <select
                  value={contexto.marcador.estado}
                  onChange={(e) =>
                    onCambiarMarcador({
                      estado: e.target.value as MarcadorFiltro["estado"],
                    })
                  }
                  className="w-full bg-slate-900 text-white text-[11px] rounded px-2 py-1 border border-white/10"
                >
                  {ESTADOS_MARCADOR.map((s) => (
                    <option key={s.v} value={s.v}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">
                  Diferencia
                </label>
                <select
                  value={contexto.marcador.diferencia}
                  onChange={(e) =>
                    onCambiarMarcador({
                      diferencia: e.target
                        .value as MarcadorFiltro["diferencia"],
                    })
                  }
                  className="w-full bg-slate-900 text-white text-[11px] rounded px-2 py-1 border border-white/10"
                >
                  {DIFERENCIAS_MARCADOR.map((d) => (
                    <option key={d.v} value={d.v}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">
                  Puntos para cerrar set
                </label>
                <select
                  value={contexto.marcador.puntosParaCerrar}
                  onChange={(e) =>
                    onCambiarMarcador({
                      puntosParaCerrar: e.target
                        .value as MarcadorFiltro["puntosParaCerrar"],
                    })
                  }
                  className="w-full bg-slate-900 text-white text-[11px] rounded px-2 py-1 border border-white/10"
                >
                  {PUNTOS_CERRAR.map((p) => (
                    <option key={p.v} value={p.v}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1 flex items-end">
                <button
                  onClick={() =>
                    onCambiarMarcador({
                      soloCriticos: !contexto.marcador.soloCriticos,
                    })
                  }
                  className={`w-full text-left px-2 py-1 text-[10px] font-medium rounded border transition ${
                    contexto.marcador.soloCriticos
                      ? "bg-amber-500/20 text-amber-200 border-amber-500/50"
                      : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"
                  }`}
                >
                  {contexto.marcador.soloCriticos
                    ? "✓ Solo críticos"
                    : "Solo críticos"}
                </button>
              </div>
            </div>
          </div>

          {/* Rally */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Rally
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">Fase</label>
                <select
                  value={contexto.faseRally}
                  onChange={(e) =>
                    onCambiar({
                      faseRally: e.target
                        .value as ContextoPartidoFiltro["faseRally"],
                    })
                  }
                  className="w-full bg-slate-900 text-white text-[11px] rounded px-2 py-1 border border-white/10"
                >
                  {FASES_RALLY.map((f) => (
                    <option key={f.v} value={f.v}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">
                  ¿Primer toque del equipo?
                </label>
                <select
                  value={contexto.esPrimerToque}
                  onChange={(e) =>
                    onCambiar({
                      esPrimerToque: e.target
                        .value as ContextoPartidoFiltro["esPrimerToque"],
                    })
                  }
                  className="w-full bg-slate-900 text-white text-[11px] rounded px-2 py-1 border border-white/10"
                >
                  <option value="cualquiera">Cualquiera</option>
                  <option value="si">Sí</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">
                  Toques mínimo del equipo
                </label>
                <select
                  value={contexto.toquesMinimo ?? "cualquiera"}
                  onChange={(e) =>
                    onCambiar({
                      toquesMinimo:
                        e.target.value === "cualquiera"
                          ? null
                          : parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full bg-slate-900 text-white text-[11px] rounded px-2 py-1 border border-white/10"
                >
                  <option value="cualquiera">Cualquiera</option>
                  <option value="2">≥ 2</option>
                  <option value="3">≥ 3</option>
                  <option value="4">≥ 4</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">
                  Inicio del punto
                </label>
                <select
                  value={contexto.inicioPunto}
                  onChange={(e) =>
                    onCambiar({
                      inicioPunto: e.target
                        .value as ContextoPartidoFiltro["inicioPunto"],
                    })
                  }
                  className="w-full bg-slate-900 text-white text-[11px] rounded px-2 py-1 border border-white/10"
                >
                  {INICIOS_PUNTO.map((i) => (
                    <option key={i.v} value={i.v}>
                      {i.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Ubicación + Racha */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400">
                Ubicación del trigger
              </label>
              <select
                value={contexto.ubicacionTrigger}
                onChange={(e) =>
                  onCambiar({
                    ubicacionTrigger: e.target
                      .value as ContextoPartidoFiltro["ubicacionTrigger"],
                  })
                }
                className="w-full bg-slate-900 text-white text-[11px] rounded px-2 py-1 border border-white/10"
              >
                {UBICACIONES.map((u) => (
                  <option key={u.v} value={u.v}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400">
                Racha de puntos seguidos
              </label>
              <select
                value={contexto.rachaPuntos ?? "cualquiera"}
                onChange={(e) =>
                  onCambiar({
                    rachaPuntos:
                      e.target.value === "cualquiera"
                        ? null
                        : parseInt(e.target.value, 10),
                  })
                }
                className="w-full bg-slate-900 text-white text-[11px] rounded px-2 py-1 border border-white/10"
              >
                <option value="cualquiera">Cualquiera</option>
                <option value="2">≥ 2 ganados/perdidos</option>
                <option value="3">≥ 3 ganados/perdidos</option>
                <option value="4">≥ 4 ganados/perdidos</option>
                <option value="5">≥ 5 ganados/perdidos</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// SUBCOMPONENTE: RACHA EDITOR
// ============================================================

function RachaEditor({
  indice,
  racha,
  onCambiar,
  onEliminar,
}: {
  indice: number;
  racha: RachaHistorica;
  onCambiar: (cambios: Partial<RachaHistorica>) => void;
  onEliminar: () => void;
}) {
  const [abierto, setAbierto] = useState(true);

  const tipoActual = racha.filtro.tipos[0] ?? "";
  const setTipo = (tipo: string) => {
    onCambiar({
      filtro: {
        ...racha.filtro,
        tipos: tipo ? [tipo as TipoDisparador] : [],
        resultados: [],
      },
    });
  };

  const setResultado = (resultado: string) => {
    onCambiar({
      filtro: {
        ...racha.filtro,
        resultados: resultado ? [resultado] : [],
      },
    });
  };

  const setFiltro = <K extends keyof FiltroAccionHistorica>(
    key: K,
    val: FiltroAccionHistorica[K]
  ) => {
    onCambiar({
      filtro: { ...racha.filtro, [key]: val },
    });
  };

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02]">
      <div className="flex items-center justify-between p-2">
        <button
          onClick={() => setAbierto(!abierto)}
          className="flex-1 text-left text-[11px] text-slate-200 truncate"
        >
          <span className="font-bold text-violet-300">#{indice}</span>{" "}
          <span className="text-slate-300">{resumenRacha(racha)}</span>
        </button>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => setAbierto(!abierto)}
            className="w-5 h-5 rounded text-slate-400 hover:text-white text-[10px]"
          >
            {abierto ? "▲" : "▼"}
          </button>
          <button
            onClick={onEliminar}
            className="w-5 h-5 rounded text-rose-400 hover:text-rose-300 text-[10px]"
          >
            ✕
          </button>
        </div>
      </div>

      {abierto && (
        <div className="grid grid-cols-2 gap-2 p-2 pt-0">
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400">Ámbito</label>
            <select
              value={racha.ambito}
              onChange={(e) =>
                onCambiar({ ambito: e.target.value as AmbitoRacha })
              }
              className="w-full bg-slate-900 text-white text-[11px] rounded px-2 py-1 border border-white/10"
            >
              {AMBITOS.map((a) => (
                <option key={a.v} value={a.v}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-400">
              Mínimo consecutivas
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={racha.minimo}
              onChange={(e) =>
                onCambiar({
                  minimo: Math.max(1, parseInt(e.target.value || "1", 10)),
                })
              }
              className="w-full bg-slate-900 text-white text-[11px] rounded px-2 py-1 border border-white/10"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-400">
              Saltar últimos N del tipo
            </label>
            <input
              type="number"
              min={0}
              max={10}
              value={racha.desdeAtras}
              onChange={(e) =>
                onCambiar({
                  desdeAtras: Math.max(
                    0,
                    parseInt(e.target.value || "0", 10)
                  ),
                })
              }
              className="w-full bg-slate-900 text-white text-[11px] rounded px-2 py-1 border border-white/10"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-400">
              Tipo de acción
            </label>
            <select
              value={tipoActual}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full bg-slate-900 text-white text-[11px] rounded px-2 py-1 border border-white/10"
            >
              <option value="">Cualquier tipo</option>
              {TIPOS_DISPARADOR.map((t) => (
                <option key={t.v} value={t.v}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {tipoActual && (
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400">Resultado</label>
              <select
                value={racha.filtro.resultados[0] ?? ""}
                onChange={(e) => setResultado(e.target.value)}
                className="w-full bg-slate-900 text-white text-[11px] rounded px-2 py-1 border border-white/10"
              >
                <option value="">Cualquier resultado</option>
                {resultadosPorTipoAnalisis(tipoActual as TipoDisparador)
                  .filter((r) => r !== "cualquiera")
                  .map((r) => (
                    <option key={r} value={r}>
                      {etiquetaResultado(r)}
                    </option>
                  ))}
              </select>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] text-slate-400">Ubicación</label>
            <select
              value={racha.filtro.ubicacion}
              onChange={(e) =>
                setFiltro("ubicacion", e.target.value as UbicacionFiltro)
              }
              className="w-full bg-slate-900 text-white text-[11px] rounded px-2 py-1 border border-white/10"
            >
              {UBICACIONES.map((u) => (
                <option key={u.v} value={u.v}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-400">Zona jugador</label>
            <select
              value={String(racha.filtro.zonaJugador)}
              onChange={(e) =>
                setFiltro(
                  "zonaJugador",
                  e.target.value === "cualquiera"
                    ? "cualquiera"
                    : parseInt(e.target.value, 10)
                )
              }
              className="w-full bg-slate-900 text-white text-[11px] rounded px-2 py-1 border border-white/10"
            >
              {ZONAS_JUGADOR.map((z) => (
                <option key={String(z.v)} value={String(z.v)}>
                  {z.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-400">Velocidad</label>
            <select
              value={
                racha.filtro.velocidad === null
                  ? ""
                  : String(racha.filtro.velocidad)
              }
              onChange={(e) =>
                setFiltro(
                  "velocidad",
                  e.target.value === "" ? null : parseFloat(e.target.value)
                )
              }
              className="w-full bg-slate-900 text-white text-[11px] rounded px-2 py-1 border border-white/10"
            >
              {VELOCIDADES.map((v) => (
                <option
                  key={String(v.v)}
                  value={v.v === null ? "" : String(v.v)}
                >
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-400">Tipo saque</label>
            <select
              value={racha.filtro.tipoSaque ?? ""}
              onChange={(e) =>
                setFiltro(
                  "tipoSaque",
                  e.target.value === ""
                    ? null
                    : (e.target.value as "potencia" | "flotado")
                )
              }
              className="w-full bg-slate-900 text-white text-[11px] rounded px-2 py-1 border border-white/10"
            >
              {TIPOS_SAQUE.map((v) => (
                <option key={String(v.v)} value={v.v ?? ""}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-400">
              Relación con trigger
            </label>
            <select
              value={racha.filtro.relacionJugador}
              onChange={(e) =>
                setFiltro(
                  "relacionJugador",
                  e.target.value as RelacionJugador
                )
              }
              className="w-full bg-slate-900 text-white text-[11px] rounded px-2 py-1 border border-white/10"
            >
              {RELACIONES.map((r) => (
                <option key={r.v} value={r.v}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-400">Cierra punto</label>
            <select
              value={racha.filtro.cierraPunto}
              onChange={(e) =>
                setFiltro(
                  "cierraPunto",
                  e.target.value as CierraPuntoFiltro
                )
              }
              className="w-full bg-slate-900 text-white text-[11px] rounded px-2 py-1 border border-white/10"
            >
              {CIERRAS.map((c) => (
                <option key={c.v} value={c.v}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// SUBCOMPONENTE: DISTRIBUCIÓN
// ============================================================

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
      <h6 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
        {titulo}
      </h6>
      <div className="space-y-1">
        {items.map((it) => (
          <div key={it.label} className="flex items-center gap-2 text-[11px]">
            <span className="w-24 truncate text-slate-300">{it.label}</span>
            <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full ${color} rounded-full`}
                style={{ width: `${(it.pct / maxPct) * 100}%` }}
              />
            </div>
            <span className="w-16 text-right font-mono text-slate-300">
              {it.count} ({it.pct}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// SUBCOMPONENTE: COMPORTAMIENTO DEL TRIGGER
// ============================================================

function SeccionComportamiento({
  comportamiento,
  nombreDeJugador,
}: {
  comportamiento: ComportamientoTrigger;
  nombreDeJugador: (id: string) => string;
}) {
  return (
    <div className="rounded-lg border border-white/10 overflow-hidden bg-slate-900/40">
      <div className="px-4 py-2.5 border-b border-white/10 bg-white/[0.02]">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
          Comportamiento del trigger
        </span>
        <p className="text-[10px] text-slate-400 mt-0.5">
          Cómo actúa el jugador en los {comportamiento.totalTriggers} triggers
        </p>
      </div>

      <div className="p-4 space-y-4">
        <DistribucionLista
          titulo="Por subtipo / resultado"
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
    </div>
  );
}

// ============================================================
// SUBCOMPONENTE: CONSECUENCIA
// ============================================================

function SeccionConsecuencia({
  resultado,
  disparador,
  tipoObservado,
  jugadorObservadoFiltro,
  nombre,
  coincidencias,
  onIrAPunto,
}: {
  resultado: ResultadoAnalisis;
  disparador: DisparadorFiltro;
  tipoObservado: TipoDisparador | "cualquiera";
  jugadorObservadoFiltro: string;
  nombre: (id: string | null) => string;
  coincidencias: CoincidenciaFiltro;
  onIrAPunto?: (set: number, punto: number) => void;
}) {
  const est = resultado.estadisticasObservadas;
  if (!est) return null;
  const evalR = est.evaluacionResultado;

  return (
    <>
      <div className="rounded-lg border border-white/10 overflow-hidden bg-slate-900/40">
        <div className="px-4 py-2.5 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white/[0.02]">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Consecuencia:{" "}
              <span className="capitalize text-white">
                {tipoObservado === "cualquiera"
                  ? "1ª acción siguiente"
                  : `Siguiente ${tipoObservado}`}
              </span>
            </span>
            {jugadorObservadoFiltro === "mismo" && (
              <span className="ml-2 text-[11px] text-slate-400">
                (mismo jugador que el trigger)
              </span>
            )}
            {jugadorObservadoFiltro !== "mismo" &&
              jugadorObservadoFiltro !== "cualquiera" && (
                <span className="ml-2 text-[11px] text-slate-400">
                  ({nombre(jugadorObservadoFiltro)})
                </span>
              )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Predominante:</span>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded border ${
                evalR.masFrecuente === "punto"
                  ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                  : evalR.masFrecuente === "error"
                  ? "bg-rose-500/10 text-rose-300 border-rose-500/30"
                  : "bg-amber-500/10 text-amber-300 border-amber-500/30"
              }`}
            >
              {evalR.masFrecuente === "punto"
                ? "Punto directo"
                : evalR.masFrecuente === "error"
                ? "Error"
                : "Neutro"}
            </span>
          </div>
        </div>

        <div className="divide-y divide-white/5 text-xs">
          <div className="px-4 py-2.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 w-44 shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="font-medium text-slate-200">Punto directo</span>
            </div>
            <div className="flex items-center gap-3 flex-1 max-w-sm">
              <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${evalR.pctPuntos}%` }}
                />
              </div>
              <span className="font-mono text-emerald-300 font-semibold w-12 text-right">
                {evalR.pctPuntos}%
              </span>
            </div>
            <span className="font-mono text-slate-400 text-right w-24 shrink-0">
              {evalR.puntos} de {evalR.total}
            </span>
          </div>

          <div className="px-4 py-2.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 w-44 shrink-0">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="font-medium text-slate-200">Neutro</span>
            </div>
            <div className="flex items-center gap-3 flex-1 max-w-sm">
              <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{ width: `${evalR.pctNeutros}%` }}
                />
              </div>
              <span className="font-mono text-amber-300 font-semibold w-12 text-right">
                {evalR.pctNeutros}%
              </span>
            </div>
            <span className="font-mono text-slate-400 text-right w-24 shrink-0">
              {evalR.neutros} de {evalR.total}
            </span>
          </div>

          <div className="px-4 py-2.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 w-44 shrink-0">
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              <span className="font-medium text-slate-200">Error</span>
            </div>
            <div className="flex items-center gap-3 flex-1 max-w-sm">
              <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-rose-500 rounded-full"
                  style={{ width: `${evalR.pctErrores}%` }}
                />
              </div>
              <span className="font-mono text-rose-300 font-semibold w-12 text-right">
                {evalR.pctErrores}%
              </span>
            </div>
            <span className="font-mono text-slate-400 text-right w-24 shrink-0">
              {evalR.errores} de {evalR.total}
            </span>
          </div>

          <div className="px-4 py-2.5 flex items-center justify-between bg-white/[0.01]">
            <span className="text-slate-300 font-medium">
              Efectividad neta (Puntos − Errores)
            </span>
            <span
              className={`font-mono font-bold px-2.5 py-0.5 rounded text-xs ${
                evalR.efectividadNeta > 0
                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                  : evalR.efectividadNeta < 0
                  ? "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                  : "bg-slate-700 text-slate-300"
              }`}
            >
              {evalR.efectividadNeta > 0 ? "+" : ""}
              {evalR.efectividadNeta}%
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 overflow-hidden bg-slate-900/40">
        <div className="px-4 py-2.5 border-b border-white/10 bg-white/[0.02]">
          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Indicadores
          </h5>
        </div>
        <div className="divide-y divide-white/5 text-xs">
          <div className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span className="text-slate-400">Subtipo más frecuente:</span>
            <span className="font-semibold text-white capitalize">
              {est.subtipoMasFrecuente || "—"}
              <span className="text-slate-400 font-normal ml-2">
                ({est.subtiposRanking[0]?.pct ?? 0}% ·{" "}
                {est.subtiposRanking[0]?.count ?? 0} casos)
              </span>
            </span>
          </div>
          <div className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span className="text-slate-400">Distancia promedio:</span>
            <span className="font-mono font-semibold text-white">
              ~{est.promedioAccionesDistancia} toques ·{" "}
              {est.promedioPuntosDistancia === 0
                ? "mismo punto"
                : `+${est.promedioPuntosDistancia} pts`}
            </span>
          </div>
          {hayComparadoresActivos(coincidencias) && (
            <div className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 bg-white/[0.01]">
              <span className="text-slate-400">Coincidencias espaciales:</span>
              <span className="text-slate-300 font-medium">
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
      </div>

      <div className="rounded-lg border border-white/10 overflow-hidden bg-slate-900/40">
        <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Registro ({resultado.ocurrencias.length})
          </h5>
        </div>
        <div className="overflow-x-auto max-h-[340px] overflow-y-auto">
          <table className="w-full text-xs min-w-[620px]">
            <thead className="sticky top-0 bg-slate-950 border-b border-white/10 text-slate-400 text-left font-medium">
              <tr>
                <th className="py-2.5 px-3">Momento</th>
                <th className="py-2.5 px-3">Trigger</th>
                <th className="py-2.5 px-3">Observada</th>
                <th className="py-2.5 px-3">Distancia</th>
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
                    <td className="py-2 px-3 font-mono text-slate-400 whitespace-nowrap">
                      S{o.set_numero} · P.{o.punto_numero}
                    </td>
                    <td className="py-2 px-3">
                      <span className="font-semibold text-slate-100 capitalize">
                        {o.triggerSubtipo ?? disparador.tipo}
                      </span>
                      <span className="text-[11px] text-slate-400 ml-1.5">
                        ({nombre(o.triggerJugadorId)})
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      {obs ? (
                        <>
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
                        </>
                      ) : (
                        <span className="text-slate-500 italic">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-300 whitespace-nowrap">
                      {obs
                        ? `${obs.distanciaAcciones} toques (${
                            obs.distanciaPuntos === 0
                              ? "mismo rally"
                              : `+${obs.distanciaPuntos} pts`
                          })`
                        : "—"}
                    </td>
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
  );
}