"use client";

// ============================================================
// ANÁLISIS DE CONSECUENCIAS — UI simplificada
// ============================================================
// Estructura:
//   1. Header con resumen tipo "receta" + casos + reset
//   2. Chips de preguntas rápidas
//   3. Bloque integrado CUANDO → MIRAR
//      (trigger + observado en un solo flujo visual)
//   4. Filtros avanzados (colapsados)
//      - Alcance
//      - Historia previa (rachas)
//      - Contexto del partido
//      - Comparadores
//   5. Resultados:
//      - Comportamiento del trigger
//      - Consecuencia
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

const TIPOS: { v: TipoDisparador; label: string }[] = [
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
  { v: "cualquiera", label: "Cualquiera" },
  { v: "delantero", label: "Delantero" },
  { v: "zaguero", label: "Zaguero" },
  { v: "libero", label: "Líbero" },
  { v: "otro", label: "Otro" },
];

const RELACIONES: { v: RelacionJugador; label: string }[] = [
  { v: "cualquiera", label: "Cualquier jugador" },
  { v: "mismo", label: "Mismo jugador" },
  { v: "companero", label: "Compañero" },
  { v: "rival", label: "Rival" },
];

const CIERRAS: { v: CierraPuntoFiltro; label: string }[] = [
  { v: "cualquiera", label: "Cualquiera" },
  { v: "si", label: "Cerró el punto" },
  { v: "no", label: "NO cerró el punto" },
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

const ESTADOS_MARCADOR = [
  { v: "cualquiera" as const, label: "Cualquier estado" },
  { v: "empatado" as const, label: "Empatado" },
  { v: "ganando" as const, label: "Ganando" },
  { v: "perdiendo" as const, label: "Perdiendo" },
];

const DIFERENCIAS_MARCADOR = [
  { v: "cualquiera" as const, label: "Cualquiera" },
  { v: "0" as const, label: "Empate (0)" },
  { v: "1-2" as const, label: "1-2 puntos" },
  { v: "3-5" as const, label: "3-5 puntos" },
  { v: "6+" as const, label: "6+ puntos" },
];

const PUNTOS_CERRAR = [
  { v: "cualquiera" as const, label: "Cualquiera" },
  { v: "<=1" as const, label: "≤ 1 (match point)" },
  { v: "<=3" as const, label: "≤ 3" },
  { v: "<=5" as const, label: "≤ 5" },
];

const FASES_RALLY = [
  { v: "cualquiera" as const, label: "Cualquier fase" },
  { v: "side-out" as const, label: "Side-out" },
  { v: "contraataque" as const, label: "Contraataque" },
  { v: "free-ball" as const, label: "Free ball" },
  { v: "otro" as const, label: "Otro" },
];

const INICIOS_PUNTO = [
  { v: "cualquiera" as const, label: "Cualquiera" },
  { v: "ace_propio" as const, label: "Ace propio" },
  { v: "ace_rival" as const, label: "Ace rival" },
  { v: "recepcion_positiva" as const, label: "Recepción positiva" },
  { v: "recepcion_neutra" as const, label: "Recepción neutra" },
  { v: "recepcion_negativa" as const, label: "Recepción negativa" },
  { v: "overpass" as const, label: "Overpass" },
  { v: "error_directo" as const, label: "Error directo" },
  { v: "otro" as const, label: "Otro" },
];

// ------------------------------------------------------------
// PREGUNTAS RÁPIDAS
// ------------------------------------------------------------

interface PreguntaRapida {
  id: string;
  titulo: string;
  tipo: TipoDisparador;
  resultado: string;
  tipoObservado: TipoDisparador | "cualquiera";
  alcance: "partido" | "mismo_punto";
  jugadorObservado: "mismo" | "cualquiera";
  contextoPartido?: ContextoPartidoFiltro;
}

const PREGUNTAS_RAPIDAS: PreguntaRapida[] = [
  {
    id: "error-ataque",
    titulo: "Error ataque → sig. ataque",
    tipo: "ataque",
    resultado: "error",
    tipoObservado: "ataque",
    alcance: "partido",
    jugadorObservado: "mismo",
  },
  {
    id: "mala-recep",
    titulo: "Recep. negativa → sig. ataque",
    tipo: "recepcion",
    resultado: "negativa",
    tipoObservado: "ataque",
    alcance: "partido",
    jugadorObservado: "cualquiera",
  },
  {
    id: "ace-saque",
    titulo: "Ace → sig. saque",
    tipo: "saque",
    resultado: "ace",
    tipoObservado: "saque",
    alcance: "partido",
    jugadorObservado: "mismo",
  },
  {
    id: "bloqueo-punto",
    titulo: "Bloqueo punto → sig. ataque",
    tipo: "bloqueo",
    resultado: "punto",
    tipoObservado: "ataque",
    alcance: "partido",
    jugadorObservado: "cualquiera",
  },
  {
    id: "defensa-pos",
    titulo: "Defensa positiva → sig. ataque",
    tipo: "defensa",
    resultado: "toque_positiva",
    tipoObservado: "ataque",
    alcance: "partido",
    jugadorObservado: "cualquiera",
  },
  {
    id: "cierre-set",
    titulo: "Cierre de set",
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
    id: "racha-ganando",
    titulo: "Racha 3+ ganando",
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
  {
    id: "inmediata",
    titulo: "Acción inmediata siguiente",
    tipo: "ataque",
    resultado: "cualquiera",
    tipoObservado: "cualquiera",
    alcance: "mismo_punto",
    jugadorObservado: "cualquiera",
  },
];

// ------------------------------------------------------------
// COMPARADORES
// ------------------------------------------------------------

const COMPARADORES: {
  key: keyof CoincidenciaFiltro;
  etiqueta: string;
}[] = [
  { key: "mismaZonaTriggerDestino", etiqueta: "Misma zona destino" },
  { key: "mismaZonaTriggerOrigen", etiqueta: "Misma zona origen" },
  { key: "mismaVelocidadAnterior", etiqueta: "Misma velocidad" },
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
    partes.push(r.filtro.tipos.map((t) => etiquetaTipoDisparador(t)).join("|"));
  } else {
    partes.push("cualquier acción");
  }
  if (r.filtro.resultados.length > 0) {
    partes.push(r.filtro.resultados[0]);
  }
  return partes.join(" · ");
}

const cardBase: React.CSSProperties = {
  background: "var(--sx-surface-1)",
  border: "1px solid var(--sx-border)",
};

// Estilos compartidos para selects compactos
const selectCls =
  "w-full bg-slate-900 text-white text-[11px] rounded px-2 py-1.5 border border-white/10 focus:outline-none focus:border-slate-400 cursor-pointer";

// ------------------------------------------------------------
// COMPONENTE
// ------------------------------------------------------------

export default function AnalisisConsecuencias({
  acciones,
  onIrAPunto,
  nombreDeJugador,
  titulo = "Análisis de consecuencias",
  jugadorId,
  jugadoresDisponibles,
}: Props) {
  const [disparador, setDisparador] = useState<DisparadorFiltro>({
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

  const resultado: ResultadoAnalisis | null = useMemo(
    () => analizarConsecuencias(acciones, filtros),
    [acciones, filtros]
  );

  // Cantidad de filtros avanzados activos
  const cantAvanzados = useMemo(() => {
    let n = 0;
    if (alcance !== "partido") n++;
    n += rachas.length;
    if (hayContextoPartidoActivo(contextoPartido)) n++;
    n += Object.values(coincidencias).filter(Boolean).length;
    return n;
  }, [alcance, rachas, contextoPartido, coincidencias]);

  // Receta resumen
  const receta = useMemo(() => {
    const partes: string[] = [];
    const tipoTrig = etiquetaTipoDisparador(disparador.tipo);
    const resTrig =
      disparador.resultado !== "cualquiera"
        ? ` · ${etiquetaResultado(disparador.resultado)}`
        : "";
    const jugTrig = jugadorFiltroId ? ` · ${nombre(jugadorFiltroId)}` : "";
    partes.push(`${tipoTrig}${resTrig}${jugTrig}`);

    partes.push("→");

    const tipoObs =
      tipoObservado === "cualquiera"
        ? "siguiente acción"
        : `siguiente ${etiquetaTipoDisparador(tipoObservado)}`;
    const jugObs =
      jugadorObservadoFiltro === "mismo"
        ? "mismo jugador"
        : jugadorObservadoFiltro === "cualquiera"
        ? "cualquier jugador"
        : nombre(jugadorObservadoFiltro);
    partes.push(`${tipoObs} de ${jugObs}`);

    return partes.join(" ");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    disparador,
    jugadorFiltroId,
    tipoObservado,
    jugadorObservadoFiltro,
  ]);

  // Handlers
  const agregarRacha = () => setRachas((prev) => [...prev, nuevaRacha()]);
  const eliminarRacha = (id: string) =>
    setRachas((prev) => prev.filter((r) => r.id !== id));
  const actualizarRacha = (id: string, cambios: Partial<RachaHistorica>) => {
    setRachas((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...cambios } : r))
    );
  };

  const aplicarPreguntaRapida = (p: PreguntaRapida) => {
    setPreguntaActivaId(p.id);
    setDisparador({ tipo: p.tipo, resultado: p.resultado });
    setTipoObservado(p.tipoObservado);
    setAlcance(p.alcance);
    setRachas([]);
    setContextoPartido(p.contextoPartido ?? { ...CONTEXTO_PARTIDO_VACIO });
    const obs = jugadorId ? "mismo" : p.jugadorObservado;
    setJugadorObservadoFiltro(obs);
    setCoincidencias({
      ...COINCIDENCIA_VACIA,
      mismoJugadorTrigger: obs === "mismo",
    });
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

  const cantCasos = resultado?.totalOcurrencias ?? 0;

  return (
    <div
      className="rounded-xl border border-white/10 p-4 space-y-3"
      style={cardBase}
    >
      {/* ====== HEADER ====== */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-sm font-bold uppercase tracking-wider text-slate-100">
              {titulo}
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-white/10 text-slate-300 bg-white/5">
              {cantCasos} caso{cantCasos !== 1 ? "s" : ""}
            </span>
          </div>
          <p
            className="text-[11px] text-slate-400 truncate"
            title={receta}
          >
            {receta}
          </p>
        </div>
        <button
          onClick={restablecer}
          className="shrink-0 text-xs px-2 py-1 rounded border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 transition"
          title="Restablecer"
        >
          ↻
        </button>
      </div>

      {/* ====== PREGUNTAS RÁPIDAS ====== */}
      <div className="flex flex-wrap gap-1">
        {PREGUNTAS_RAPIDAS.map((p) => {
          const activa = preguntaActivaId === p.id;
          return (
            <button
              key={p.id}
              onClick={() => aplicarPreguntaRapida(p)}
              className={`px-2 py-1 text-[10px] font-semibold rounded border transition ${
                activa
                  ? "bg-violet-500/20 border-violet-400/60 text-violet-200"
                  : "bg-white/[0.02] border-white/10 text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              {p.titulo}
            </button>
          );
        })}
      </div>

      {/* ====== BLOQUE INTEGRADO CUANDO → MIRAR ====== */}
      <div className="rounded-xl border border-white/10 bg-slate-900/40 p-3 space-y-1.5">
        {/* CUANDO (trigger) */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
              Cuando
            </span>
            <span className="text-[10px] text-slate-400">
              la acción disparadora
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <select
              value={disparador.tipo}
              onChange={(e) => {
                setPreguntaActivaId(null);
                setDisparador({
                  tipo: e.target.value as TipoDisparador,
                  resultado: "cualquiera",
                });
              }}
              className={selectCls}
              title="Tipo de acción"
            >
              {TIPOS.map((t) => (
                <option key={t.v} value={t.v}>
                  {t.label}
                </option>
              ))}
            </select>

            <select
              value={disparador.resultado}
              onChange={(e) => {
                setPreguntaActivaId(null);
                setDisparador({ ...disparador, resultado: e.target.value });
              }}
              className={selectCls}
              title="Resultado"
            >
              {resultadosPorTipoAnalisis(disparador.tipo).map((r) => (
                <option key={r} value={r}>
                  {etiquetaResultado(r)}
                </option>
              ))}
            </select>

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
              className={selectCls}
              title="Jugador"
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
        </div>

        {/* ARROW */}
        <div className="flex items-center justify-center py-1 text-slate-500">
          <span className="text-base leading-none">⬇</span>
        </div>

        {/* MIRAR (observado) */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
              Mirar
            </span>
            <span className="text-[10px] text-slate-400">
              qué pasa después
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <select
              value={tipoObservado}
              onChange={(e) => {
                setPreguntaActivaId(null);
                setTipoObservado(
                  e.target.value as TipoDisparador | "cualquiera"
                );
              }}
              className={selectCls}
              title="Acción observada"
            >
              {TIPOS_OBSERVADOS.map((t) => (
                <option key={t.v} value={t.v}>
                  {t.label}
                </option>
              ))}
            </select>

            <select
              value={jugadorObservadoFiltro}
              onChange={(e) => cambiarJugadorObservado(e.target.value)}
              className={selectCls}
              title="Jugador observado"
            >
              <option value="mismo">
                {jugadorFiltroId
                  ? `Mismo (${nombre(jugadorFiltroId)})`
                  : "Mismo jugador"}
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
        </div>
      </div>

      {/* ====== FILTROS AVANZADOS ====== */}
      <details className="rounded-xl border border-white/10 bg-white/[0.02]">
        <summary className="px-3 py-2 cursor-pointer text-xs font-bold text-slate-300 hover:bg-white/5 rounded-xl flex items-center justify-between">
          <span>⚙️ Filtros avanzados</span>
          {cantAvanzados > 0 ? (
            <span className="bg-violet-500/20 text-violet-200 border border-violet-500/40 px-1.5 py-0.5 rounded text-[10px]">
              {cantAvanzados}
            </span>
          ) : (
            <span className="text-[10px] text-slate-500">sin filtros</span>
          )}
        </summary>

        <div className="p-3 pt-2 space-y-3 border-t border-white/10">
          {/* Alcance */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
              Alcance de búsqueda
            </label>
            <select
              value={alcance}
              onChange={(e) =>
                setAlcance(e.target.value as "partido" | "mismo_punto")
              }
              className={selectCls}
            >
              {ALCANCES.map((a) => (
                <option key={a.v} value={a.v}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          {/* Rachas */}
          <RachasSection
            rachas={rachas}
            onAgregar={agregarRacha}
            onEliminar={eliminarRacha}
            onActualizar={actualizarRacha}
          />

          {/* Contexto del partido */}
          <ContextoSection
            contexto={contextoPartido}
            setContexto={setContextoPartido}
          />

          {/* Comparadores */}
          <ComparadoresSection
            coincidencias={coincidencias}
            setCoincidencias={setCoincidencias}
          />
        </div>
      </details>

      {/* ====== RESULTADOS ====== */}
      {resultado && (
        <div className="space-y-3">
          {resultado.totalOcurrencias === 0 ? (
            <div className="rounded-lg border border-white/10 p-6 text-center text-xs text-slate-400">
              No hay casos que cumplan todos los criterios.
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
// RACHAS SECTION
// ============================================================

function RachasSection({
  rachas,
  onAgregar,
  onEliminar,
  onActualizar,
}: {
  rachas: RachaHistorica[];
  onAgregar: () => void;
  onEliminar: (id: string) => void;
  onActualizar: (id: string, cambios: Partial<RachaHistorica>) => void;
}) {
  return (
    <details className="rounded-lg border border-white/10 bg-white/[0.02]">
      <summary className="px-2 py-1.5 cursor-pointer text-[11px] font-bold uppercase text-slate-300 flex items-center justify-between">
        <span>📜 Historia previa ({rachas.length})</span>
        <span className="text-slate-500 text-[10px]">▼</span>
      </summary>
      <div className="p-2 pt-0 space-y-1.5">
        {rachas.map((r, i) => (
          <RachaFila
            key={r.id}
            idx={i}
            racha={r}
            onCambiar={(c) => onActualizar(r.id, c)}
            onEliminar={() => onEliminar(r.id)}
          />
        ))}
        <button
          onClick={onAgregar}
          className="w-full px-2 py-1 text-[10px] font-semibold rounded border border-violet-500/40 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20"
        >
          + Añadir racha
        </button>
        {rachas.length === 0 && (
          <p className="text-[10px] text-slate-500 italic text-center py-1">
            Sin filtro de historia.
          </p>
        )}
      </div>
    </details>
  );
}

function RachaFila({
  idx,
  racha,
  onCambiar,
  onEliminar,
}: {
  idx: number;
  racha: RachaHistorica;
  onCambiar: (cambios: Partial<RachaHistorica>) => void;
  onEliminar: () => void;
}) {
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

  const setFiltro = <K extends keyof FiltroAccionHistorica>(
    key: K,
    val: FiltroAccionHistorica[K]
  ) => {
    onCambiar({ filtro: { ...racha.filtro, [key]: val } });
  };

  return (
    <div className="rounded border border-white/10 bg-slate-900/40 p-1.5 space-y-1.5">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold text-violet-300">
          #{idx + 1}
        </span>
        <span className="text-[9px] text-slate-400 truncate flex-1">
          {resumenRacha(racha)}
        </span>
        <button
          onClick={onEliminar}
          className="text-rose-400 hover:text-rose-300 text-[10px] shrink-0"
        >
          ✕
        </button>
      </div>

      {/* Fila básica */}
      <div className="grid grid-cols-2 gap-1">
        <select
          value={racha.ambito}
          onChange={(e) =>
            onCambiar({ ambito: e.target.value as AmbitoRacha })
          }
          className={selectCls}
          title="Ámbito"
        >
          {AMBITOS.map((a) => (
            <option key={a.v} value={a.v}>
              {a.label}
            </option>
          ))}
        </select>

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
          className={selectCls}
          placeholder="Mínimo"
          title="Mínimo consecutivas"
        />

        <select
          value={tipoActual}
          onChange={(e) => setTipo(e.target.value)}
          className={selectCls}
          title="Tipo de acción"
        >
          <option value="">Cualquier tipo</option>
          {TIPOS.map((t) => (
            <option key={t.v} value={t.v}>
              {t.label}
            </option>
          ))}
        </select>

        {tipoActual ? (
          <select
            value={racha.filtro.resultados[0] ?? ""}
            onChange={(e) =>
              onCambiar({
                filtro: {
                  ...racha.filtro,
                  resultados: e.target.value ? [e.target.value] : [],
                },
              })
            }
            className={selectCls}
            title="Resultado"
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
        ) : (
          <div />
        )}
      </div>

      {/* Avanzado */}
      <details>
        <summary className="text-[9px] text-slate-500 cursor-pointer hover:text-slate-300">
          Más opciones
        </summary>
        <div className="grid grid-cols-2 gap-1 mt-1">
          <input
            type="number"
            min={0}
            max={10}
            value={racha.desdeAtras}
            onChange={(e) =>
              onCambiar({
                desdeAtras: Math.max(0, parseInt(e.target.value || "0", 10)),
              })
            }
            className={selectCls}
            placeholder="Saltar N"
            title="Saltar los últimos N del tipo"
          />

          <select
            value={racha.filtro.ubicacion}
            onChange={(e) =>
              setFiltro("ubicacion", e.target.value as UbicacionFiltro)
            }
            className={selectCls}
            title="Ubicación"
          >
            {UBICACIONES.map((u) => (
              <option key={u.v} value={u.v}>
                {u.label}
              </option>
            ))}
          </select>

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
            className={selectCls}
            title="Zona"
          >
            {ZONAS_JUGADOR.map((z) => (
              <option key={String(z.v)} value={String(z.v)}>
                {z.label}
              </option>
            ))}
          </select>

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
            className={selectCls}
            title="Velocidad"
          >
            {VELOCIDADES.map((v) => (
              <option key={String(v.v)} value={v.v === null ? "" : String(v.v)}>
                {v.label === "Cualquiera" ? "Vel. cualquiera" : `v${v.label}`}
              </option>
            ))}
          </select>

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
            className={selectCls}
            title="Tipo saque"
          >
            {TIPOS_SAQUE.map((v) => (
              <option key={String(v.v)} value={v.v ?? ""}>
                {v.label === "Cualquiera" ? "Saque cualquiera" : v.label}
              </option>
            ))}
          </select>

          <select
            value={racha.filtro.relacionJugador}
            onChange={(e) =>
              setFiltro(
                "relacionJugador",
                e.target.value as RelacionJugador
              )
            }
            className={selectCls}
            title="Relación"
          >
            {RELACIONES.map((r) => (
              <option key={r.v} value={r.v}>
                {r.label}
              </option>
            ))}
          </select>

          <select
            value={racha.filtro.cierraPunto}
            onChange={(e) =>
              setFiltro("cierraPunto", e.target.value as CierraPuntoFiltro)
            }
            className={`${selectCls} col-span-2`}
            title="Cierra punto"
          >
            {CIERRAS.map((c) => (
              <option key={c.v} value={c.v}>
                {etiquetaCierraPunto(c.v)}
              </option>
            ))}
          </select>
        </div>
      </details>
    </div>
  );
}

// ============================================================
// CONTEXTO SECTION
// ============================================================

function ContextoSection({
  contexto,
  setContexto,
}: {
  contexto: ContextoPartidoFiltro;
  setContexto: (c: ContextoPartidoFiltro) => void;
}) {
  const activo = hayContextoPartidoActivo(contexto);

  const setMarcador = (cambios: Partial<MarcadorFiltro>) => {
    setContexto({ ...contexto, marcador: { ...contexto.marcador, ...cambios } });
  };

  return (
    <details
      className={`rounded-lg border ${
        activo
          ? "border-violet-500/40 bg-violet-500/[0.04]"
          : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <summary className="px-2 py-1.5 cursor-pointer text-[11px] font-bold uppercase text-slate-300 flex items-center justify-between">
        <span>
          📊 Contexto del partido{" "}
          {activo && <span className="text-violet-300">✓</span>}
        </span>
        <span className="text-slate-500 text-[10px]">▼</span>
      </summary>
      <div className="p-2 pt-0 space-y-2">
        {/* Marcador */}
        <div>
          <p className="text-[9px] font-bold uppercase text-slate-500 mb-1">
            Marcador
          </p>
          <div className="grid grid-cols-2 gap-1">
            <select
              value={contexto.marcador.estado}
              onChange={(e) =>
                setMarcador({
                  estado: e.target.value as MarcadorFiltro["estado"],
                })
              }
              className={selectCls}
            >
              {ESTADOS_MARCADOR.map((s) => (
                <option key={s.v} value={s.v}>
                  {s.label}
                </option>
              ))}
            </select>

            <select
              value={contexto.marcador.diferencia}
              onChange={(e) =>
                setMarcador({
                  diferencia: e.target.value as MarcadorFiltro["diferencia"],
                })
              }
              className={selectCls}
            >
              {DIFERENCIAS_MARCADOR.map((d) => (
                <option key={d.v} value={d.v}>
                  {d.label}
                </option>
              ))}
            </select>

            <select
              value={contexto.marcador.puntosParaCerrar}
              onChange={(e) =>
                setMarcador({
                  puntosParaCerrar: e.target
                    .value as MarcadorFiltro["puntosParaCerrar"],
                })
              }
              className={selectCls}
            >
              {PUNTOS_CERRAR.map((p) => (
                <option key={p.v} value={p.v}>
                  {p.v === "cualquiera" ? "Sin filtro de cierre" : p.label}
                </option>
              ))}
            </select>

            <button
              onClick={() =>
                setMarcador({ soloCriticos: !contexto.marcador.soloCriticos })
              }
              className={`px-2 py-1 text-[10px] font-semibold rounded border transition ${
                contexto.marcador.soloCriticos
                  ? "bg-amber-500/20 text-amber-200 border-amber-500/50"
                  : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"
              }`}
            >
              {contexto.marcador.soloCriticos ? "✓ Solo críticos" : "Solo críticos"}
            </button>
          </div>
        </div>

        {/* Rally */}
        <div>
          <p className="text-[9px] font-bold uppercase text-slate-500 mb-1">
            Rally
          </p>
          <div className="grid grid-cols-2 gap-1">
            <select
              value={contexto.faseRally}
              onChange={(e) =>
                setContexto({
                  ...contexto,
                  faseRally: e.target
                    .value as ContextoPartidoFiltro["faseRally"],
                })
              }
              className={selectCls}
            >
              {FASES_RALLY.map((f) => (
                <option key={f.v} value={f.v}>
                  {f.label}
                </option>
              ))}
            </select>

            <select
              value={contexto.inicioPunto}
              onChange={(e) =>
                setContexto({
                  ...contexto,
                  inicioPunto: e.target
                    .value as ContextoPartidoFiltro["inicioPunto"],
                })
              }
              className={selectCls}
            >
              {INICIOS_PUNTO.map((i) => (
                <option key={i.v} value={i.v}>
                  {i.label}
                </option>
              ))}
            </select>

            <select
              value={contexto.esPrimerToque}
              onChange={(e) =>
                setContexto({
                  ...contexto,
                  esPrimerToque: e.target
                    .value as ContextoPartidoFiltro["esPrimerToque"],
                })
              }
              className={selectCls}
            >
              <option value="cualquiera">Primer toque: cualquiera</option>
              <option value="si">Sí (primer toque)</option>
              <option value="no">No (2° o 3er toque)</option>
            </select>

            <select
              value={contexto.toquesMinimo ?? "cualquiera"}
              onChange={(e) =>
                setContexto({
                  ...contexto,
                  toquesMinimo:
                    e.target.value === "cualquiera"
                      ? null
                      : parseInt(e.target.value, 10),
                })
              }
              className={selectCls}
            >
              <option value="cualquiera">Toques mín: cualquiera</option>
              <option value="2">≥ 2 toques</option>
              <option value="3">≥ 3 toques</option>
              <option value="4">≥ 4 toques</option>
            </select>
          </div>
        </div>

        {/* Jugador */}
        <div>
          <p className="text-[9px] font-bold uppercase text-slate-500 mb-1">
            Jugador
          </p>
          <div className="grid grid-cols-2 gap-1">
            <select
              value={contexto.ubicacionTrigger}
              onChange={(e) =>
                setContexto({
                  ...contexto,
                  ubicacionTrigger: e.target
                    .value as ContextoPartidoFiltro["ubicacionTrigger"],
                })
              }
              className={selectCls}
            >
              {UBICACIONES.map((u) => (
                <option key={u.v} value={u.v}>
                  {u.v === "cualquiera"
                    ? "Cualquier ubicación"
                    : u.label}
                </option>
              ))}
            </select>

            <select
              value={contexto.rachaPuntos ?? "cualquiera"}
              onChange={(e) =>
                setContexto({
                  ...contexto,
                  rachaPuntos:
                    e.target.value === "cualquiera"
                      ? null
                      : parseInt(e.target.value, 10),
                })
              }
              className={selectCls}
            >
              <option value="cualquiera">Racha: cualquiera</option>
              <option value="2">≥ 2 seguidos</option>
              <option value="3">≥ 3 seguidos</option>
              <option value="4">≥ 4 seguidos</option>
              <option value="5">≥ 5 seguidos</option>
            </select>
          </div>
        </div>
      </div>
    </details>
  );
}

// ============================================================
// COMPARADORES SECTION
// ============================================================

function ComparadoresSection({
  coincidencias,
  setCoincidencias,
}: {
  coincidencias: CoincidenciaFiltro;
  setCoincidencias: (c: CoincidenciaFiltro) => void;
}) {
  const cantActivos = Object.values(coincidencias).filter(Boolean).length;

  const toggle = (key: keyof CoincidenciaFiltro) => {
    setCoincidencias({ ...coincidencias, [key]: !coincidencias[key] });
  };

  return (
    <details
      className={`rounded-lg border ${
        cantActivos > 0
          ? "border-violet-500/40 bg-violet-500/[0.04]"
          : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <summary className="px-2 py-1.5 cursor-pointer text-[11px] font-bold uppercase text-slate-300 flex items-center justify-between">
        <span>
          🔗 Comparadores ({cantActivos})
        </span>
        <span className="text-slate-500 text-[10px]">▼</span>
      </summary>
      <div className="p-2 pt-0 flex flex-wrap gap-1">
        {COMPARADORES.map((c) => {
          const act = coincidencias[c.key];
          return (
            <button
              key={c.key}
              onClick={() => toggle(c.key)}
              className={`px-2 py-1 text-[10px] font-semibold rounded border transition flex items-center gap-1 ${
                act
                  ? "bg-violet-500/30 border-violet-400/60 text-violet-200"
                  : "bg-white/[0.02] border-white/10 text-slate-400 hover:text-white"
              }`}
            >
              <span>{act ? "✓" : "+"}</span>
              <span>{c.etiqueta}</span>
            </button>
          );
        })}
      </div>
    </details>
  );
}

// ============================================================
// COMPORTAMIENTO DEL TRIGGER
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
      <h6 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
        {titulo}
      </h6>
      <div className="space-y-0.5">
        {items.map((it) => (
          <div key={it.label} className="flex items-center gap-2 text-[10px]">
            <span className="w-20 truncate text-slate-300">{it.label}</span>
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

function SeccionComportamiento({
  comportamiento,
  nombreDeJugador,
}: {
  comportamiento: ComportamientoTrigger;
  nombreDeJugador: (id: string) => string;
}) {
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

// ============================================================
// CONSECUENCIA
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
          {evalR.total} casos · {evalR.masFrecuente === "punto"
            ? "predominante: punto"
            : evalR.masFrecuente === "error"
            ? "predominante: error"
            : "predominante: neutro"}
        </span>
      </summary>

      <div className="p-3 space-y-3 border-t border-white/10">
        {/* Balance */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-slate-300">Puntos</span>
            </div>
            <div className="flex items-center gap-2 flex-1 max-w-xs ml-2">
              <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${evalR.pctPuntos}%` }}
                />
              </div>
              <span className="font-mono text-emerald-300 font-semibold text-[10px] w-12 text-right">
                {evalR.pctPuntos}%
              </span>
            </div>
            <span className="font-mono text-slate-500 text-[10px] w-14 text-right">
              {evalR.puntos}/{evalR.total}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-slate-300">Neutro</span>
            </div>
            <div className="flex items-center gap-2 flex-1 max-w-xs ml-2">
              <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{ width: `${evalR.pctNeutros}%` }}
                />
              </div>
              <span className="font-mono text-amber-300 font-semibold text-[10px] w-12 text-right">
                {evalR.pctNeutros}%
              </span>
            </div>
            <span className="font-mono text-slate-500 text-[10px] w-14 text-right">
              {evalR.neutros}/{evalR.total}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              <span className="text-slate-300">Error</span>
            </div>
            <div className="flex items-center gap-2 flex-1 max-w-xs ml-2">
              <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-rose-500 rounded-full"
                  style={{ width: `${evalR.pctErrores}%` }}
                />
              </div>
              <span className="font-mono text-rose-300 font-semibold text-[10px] w-12 text-right">
                {evalR.pctErrores}%
              </span>
            </div>
            <span className="font-mono text-slate-500 text-[10px] w-14 text-right">
              {evalR.errores}/{evalR.total}
            </span>
          </div>

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

        {/* Indicadores */}
        <div className="pt-2 border-t border-white/5 space-y-1 text-[11px]">
          <div className="flex justify-between gap-2">
            <span className="text-slate-400">Subtipo más frecuente:</span>
            <span className="font-semibold text-white capitalize truncate">
              {est.subtipoMasFrecuente || "—"}
              <span className="text-slate-400 font-normal ml-1">
                ({est.subtiposRanking[0]?.pct ?? 0}%)
              </span>
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-400">Distancia promedio:</span>
            <span className="font-mono text-white">
              ~{est.promedioAccionesDistancia} toques ·{" "}
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

        {/* Registro */}
        <details className="pt-2 border-t border-white/5">
          <summary className="text-[10px] font-bold uppercase text-slate-400 cursor-pointer">
            Registro ({resultado.ocurrencias.length})
          </summary>
          <div className="mt-2 overflow-x-auto max-h-[340px] overflow-y-auto rounded border border-white/10">
            <table className="w-full text-[10px] min-w-[600px]">
              <thead className="sticky top-0 bg-slate-950 border-b border-white/10 text-slate-400 text-left">
                <tr>
                  <th className="py-1.5 px-2">Momento</th>
                  <th className="py-1.5 px-2">Trigger</th>
                  <th className="py-1.5 px-2">Observada</th>
                  <th className="py-1.5 px-2">Dist.</th>
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
                      className="hover:bg-white/[0.03]"
                    >
                      <td className="py-1.5 px-2 font-mono text-slate-400 whitespace-nowrap">
                        S{o.set_numero}·P{o.punto_numero}
                      </td>
                      <td className="py-1.5 px-2">
                        <span className="text-slate-100 capitalize">
                          {o.triggerSubtipo ?? disparador.tipo}
                        </span>
                        <span className="text-slate-500 ml-1">
                          ({nombre(o.triggerJugadorId)})
                        </span>
                      </td>
                      <td className="py-1.5 px-2">
                        {obs ? (
                          <>
                            <span className="text-slate-100 capitalize">
                              {obs.subtipo}
                            </span>
                            <span className="text-slate-500 ml-1">
                              ({nombre(obs.accion.jugador_id)})
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-500 italic">—</span>
                        )}
                      </td>
                      <td className="py-1.5 px-2 font-mono text-slate-400">
                        {obs ? `${obs.distanciaAcciones}t` : "—"}
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