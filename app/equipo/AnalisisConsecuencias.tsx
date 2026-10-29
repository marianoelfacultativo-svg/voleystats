"use client";

// ============================================================
// ANÁLISIS DE CONSECUENCIAS — UI v3 con OR/AND/NOT + comparar
// ============================================================
// Estructura:
//   [Header] resumen + casos + reset + toggle "comparar"
//   [Chips]  preguntas rápidas
//   [Panel A] y [Panel B] (si comparación activa):
//     - Bloques CUANDO (lista con AND/OR/NOT entre ellos)
//     - MIRAR (acción observada + relación jugador)
//     - Filtros avanzados (alcance + comparadores)
//     - Resultados (comportamiento + consecuencia)
// ============================================================

import { useMemo, useState, useEffect } from "react";
import {
  analizarConsecuencias,
  etiquetaAmbito,
  etiquetaCierraPunto,
  etiquetaOperador,
  etiquetaRelacion,
  etiquetaRelacionObservado,
  etiquetaResultado,
  etiquetaTipoDisparador,
  etiquetaUbicacion,
  hayComparadoresActivos,
  hayContextoPartidoActivo,
  hayFiltrosAvanzadosEnBloque,
  resultadosPorTipoAnalisis,
  BLOQUE_TRIGGER_VACIO,
  COINCIDENCIA_VACIA,
  CONTEXTO_PARTIDO_VACIO,
  FILTRO_ACCION_HISTORICA_VACIO,
  type AmbitoRacha,
  type BloqueTrigger,
  type BloqueTriggerFiltro,
  type CierraPuntoFiltro,
  type CoincidenciaFiltro,
  type ComportamientoTrigger,
  type ContextoPartidoFiltro,
  type FiltroAccionHistorica,
  type FiltrosAnalisis,
  type ItemPatron,
  type MarcadorFiltro,
  type OperadorBloque,
  type PatronPrevioFiltro,
  type PosicionEnSet,
  type RachaHistorica,
  type RachaJugadorFiltro,
  type RelacionJugador,
  type RelacionJugadorObservado,
  type ResultadoAnalisis,
  type TipoDisparador,
  type TipoRachaJugador,
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
  { v: "ataque", label: "Sig. ataque" },
  { v: "saque", label: "Sig. saque" },
  { v: "recepcion", label: "Sig. recepción" },
  { v: "bloqueo", label: "Sig. bloqueo" },
  { v: "armado", label: "Sig. armado" },
  { v: "defensa", label: "Sig. defensa" },
];

const RELACIONES_OBSERVADO: { v: RelacionJugadorObservado; label: string }[] = [
  { v: "cualquiera", label: "Cualquier jugador" },
  { v: "mismo", label: "Mismo que el trigger" },
  { v: "companero", label: "Un compañero" },
  { v: "rival", label: "Un rival" },
];

const ALANCES = [
  { v: "partido" as const, label: "En el partido" },
  { v: "mismo_punto" as const, label: "Solo en el mismo punto" },
];

const OPERADORES: { v: OperadorBloque; label: string }[] = [
  { v: "AND", label: "Y" },
  { v: "OR", label: "O" },
  { v: "NOT", label: "Y NO" },
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

const RELACIONES_PREVIA: { v: RelacionJugador; label: string }[] = [
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

const ZONAS_JUGADOR: { v: number; label: string }[] = [
  { v: 1, label: "Z1" },
  { v: 2, label: "Z2" },
  { v: 3, label: "Z3" },
  { v: 4, label: "Z4" },
  { v: 5, label: "Z5" },
  { v: 6, label: "Z6" },
];

const ROLES = ["A", "O", "C1", "C2", "P1", "P2", "L"];

const ROTACIONES = [1, 2, 3, 4, 5, 6];

const ESTADOS_MARCADOR = [
  { v: "cualquiera" as const, label: "Cualquier estado" },
  { v: "empatado" as const, label: "Empatado" },
  { v: "ganando" as const, label: "Ganando" },
  { v: "perdiendo" as const, label: "Perdiendo" },
];

const DIFERENCIAS_MARCADOR = [
  { v: "cualquiera" as const, label: "Cualquiera" },
  { v: "0" as const, label: "Empate (0)" },
  { v: "1-2" as const, label: "1-2 pts" },
  { v: "3-5" as const, label: "3-5 pts" },
  { v: "6+" as const, label: "6+ pts" },
];

const PUNTOS_CERRAR = [
  { v: "cualquiera" as const, label: "Cualquiera" },
  { v: "<=1" as const, label: "≤ 1 (match)" },
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
  { v: "recepcion_positiva" as const, label: "Recepción +" },
  { v: "recepcion_neutra" as const, label: "Recepción !" },
  { v: "recepcion_negativa" as const, label: "Recepción -" },
  { v: "overpass" as const, label: "Overpass" },
  { v: "error_directo" as const, label: "Error directo" },
  { v: "otro" as const, label: "Otro" },
];

const POSICIONES_SET: { v: PosicionEnSet; label: string }[] = [
  { v: "cualquiera", label: "Cualquiera" },
  { v: "primero", label: "Primer punto del set" },
  { v: "ultimo", label: "Último punto del set" },
];

const TIPOS_RACHA_JUGADOR: { v: TipoRachaJugador; label: string }[] = [
  { v: "puntos_ganados", label: "Puntos ganados seguidos" },
  { v: "puntos_perdidos", label: "Puntos perdidos seguidos" },
  { v: "errores_seguidos", label: "Errores seguidos" },
  { v: "aciertos_seguidos", label: "Aciertos seguidos" },
];

const COMPARADORES: {
  key: keyof CoincidenciaFiltro;
  etiqueta: string;
}[] = [
  { key: "mismaZonaTriggerDestino", etiqueta: "Misma zona destino" },
  { key: "mismaZonaTriggerOrigen", etiqueta: "Misma zona origen" },
  { key: "mismaVelocidadAnterior", etiqueta: "Misma velocidad" },
];

// ------------------------------------------------------------
// CONFIGURACIÓN DE UN PANEL
// ------------------------------------------------------------

interface ConfiguracionPanel {
  bloques: BloqueTrigger[];
  tipoObservado: TipoDisparador | "cualquiera";
  jugadorObservadoFiltro: string;
  alcance: "partido" | "mismo_punto";
  coincidencias: CoincidenciaFiltro;
}

let _blockCounter = 0;
function generarIdBloque(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `b-${crypto.randomUUID()}`;
  }
  _blockCounter += 1;
  return `b-${Date.now()}-${_blockCounter}`;
}

function bloqueVacio(operador: OperadorBloque = "AND"): BloqueTrigger {
  return {
    id: generarIdBloque(),
    operador,
    filtro: { ...BLOQUE_TRIGGER_VACIO },
  };
}

function panelInicial(): ConfiguracionPanel {
  return {
    bloques: [bloqueVacio("AND")],
    tipoObservado: "ataque",
    jugadorObservadoFiltro: "cualquiera",
    alcance: "partido",
    coincidencias: { ...COINCIDENCIA_VACIA },
  };
}

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
  partidosDisponibles?: { id: string; nombre: string }[];
}

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

const selectCls =
  "w-full bg-slate-900 text-white text-[11px] rounded px-2 py-1.5 border border-white/10 focus:outline-none focus:border-slate-400 cursor-pointer";
const inputCls = selectCls;

const cardBase: React.CSSProperties = {
  background: "var(--sx-surface-1)",
  border: "1px solid var(--sx-border)",
};

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
  if (r.filtro.resultados.length > 0) partes.push(r.filtro.resultados[0]);
  return partes.join(" · ");
}

function resumenPrevia(p: FiltroAccionHistorica): string {
  const partes: string[] = [];
  if (p.tipos.length > 0) {
    partes.push(p.tipos.map((t) => etiquetaTipoDisparador(t)).join("|"));
  } else {
    partes.push("cualquier acción");
  }
  if (p.resultados.length > 0) partes.push(p.resultados[0]);
  if (p.relacionJugador !== "cualquiera") {
    partes.push(etiquetaRelacion(p.relacionJugador));
  }
  return partes.join(" · ");
}

function resumenBloque(b: BloqueTriggerFiltro): string {
  const partes: string[] = [];
  partes.push(etiquetaTipoDisparador(b.tipo));
  if (b.resultado !== "cualquiera") partes.push(b.resultado);
  if (b.jugadorId) partes.push(`jugador:${b.jugadorId.slice(0, 6)}…`);
  return partes.join(" · ");
}

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
  partidosDisponibles,
}: Props) {
  const [modoComparacion, setModoComparacion] = useState(false);
  const [panelA, setPanelA] = useState<ConfiguracionPanel>(() => {
    const p = panelInicial();
    if (jugadorId) {
      p.bloques[0].filtro.jugadorId = jugadorId;
      p.jugadorObservadoFiltro = "mismo";
    }
    return p;
  });
  const [panelB, setPanelB] = useState<ConfiguracionPanel>(panelInicial);
  const [preguntaActivaId, setPreguntaActivaId] = useState<string | null>(null);

  // Lista de jugadores únicos (para dropdowns)
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

  // Sets y puntos únicos (para filtros de scope)
  const { setsUnicos, puntosUnicos } = useMemo(() => {
    const sets = new Set<number>();
    const puntos = new Set<number>();
    for (const a of acciones) {
      sets.add(a.set_numero);
      puntos.add(a.punto_numero);
    }
    return {
      setsUnicos: Array.from(sets).sort(),
      puntosUnicos: Array.from(puntos).sort(),
    };
  }, [acciones]);

  // Handlers de panel
  const setPanel = (cual: "A" | "B") => (nuevo: ConfiguracionPanel) => {
    if (cual === "A") setPanelA(nuevo);
    else setPanelB(nuevo);
  };

  const restablecerTodo = () => {
    setPreguntaActivaId(null);
    const baseA = panelInicial();
    if (jugadorId) {
      baseA.bloques[0].filtro.jugadorId = jugadorId;
      baseA.jugadorObservadoFiltro = "mismo";
    }
    setPanelA(baseA);
    setPanelB(panelInicial());
    setModoComparacion(false);
  };

  // Aplicar pregunta rápida solo al panel A (o a ambos en modo comparar?)
  // Por simplicidad: al A. El usuario puede duplicar.
  const aplicarPreguntaRapida = (p: PreguntaRapida) => {
    setPreguntaActivaId(p.id);
    const nuevo: ConfiguracionPanel = {
      bloques: [p.bloque],
      tipoObservado: p.tipoObservado,
      jugadorObservadoFiltro: p.jugadorObservadoRelacion,
      alcance: p.alcance,
      coincidencias: { ...COINCIDENCIA_VACIA },
    };
    setPanelA(nuevo);
  };

  const duplicarAenB = () => {
    setPanelB(JSON.parse(JSON.stringify(panelA)));
  };

  const cantCasosA = useMemo(
    () => evaluarPanel(acciones, panelA, jugadoresParaDropdown.length).totalOcurrencias,
    [acciones, panelA, jugadoresParaDropdown.length]
  );
  const cantCasosB = useMemo(
    () =>
      modoComparacion
        ? evaluarPanel(acciones, panelB, jugadoresParaDropdown.length)
            .totalOcurrencias
        : 0,
    [acciones, panelB, modoComparacion, jugadoresParaDropdown.length]
  );

  return (
    <div className="space-y-3" style={cardBase}>
      {/* ====== HEADER ====== */}
      <div className="p-4 border-b border-white/10 flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-sm font-bold uppercase tracking-wider text-slate-100">
              {titulo}
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-white/10 text-slate-300 bg-white/5">
              A: {cantCasosA} caso{cantCasosA !== 1 ? "s" : ""}
            </span>
            {modoComparacion && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-violet-500/30 text-violet-300 bg-violet-500/10">
                B: {cantCasosB} caso{cantCasosB !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400">
            Filtrá acciones con OR/AND/NOT y analizá qué pasa después.
          </p>
        </div>
        <div className="flex flex-col gap-1 items-end shrink-0">
          <button
            onClick={() => setModoComparacion((v) => !v)}
            className={`text-xs px-2.5 py-1 rounded border transition ${
              modoComparacion
                ? "bg-violet-500/20 text-violet-200 border-violet-400/60"
                : "border-white/10 text-slate-300 hover:text-white hover:bg-white/5"
            }`}
          >
            {modoComparacion ? "✕ Comparar" : "⇄ Comparar"}
          </button>
          <button
            onClick={restablecerTodo}
            className="text-xs px-2 py-1 rounded border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 transition"
            title="Restablecer todo"
          >
            ↻
          </button>
        </div>
      </div>

      {/* ====== PREGUNTAS RÁPIDAS ====== */}
      <div className="px-4 flex flex-wrap gap-1">
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

      {/* ====== PANELES ====== */}
      <div
        className={`px-4 pb-4 ${
          modoComparacion
            ? "grid grid-cols-1 xl:grid-cols-2 gap-3"
            : "space-y-3"
        }`}
      >
        <PanelAnalisis
          acciones={acciones}
          config={panelA}
          setConfig={setPanel("A")}
          nombre={nombre}
          jugadoresParaDropdown={jugadoresParaDropdown}
          setsUnicos={setsUnicos}
          puntosUnicos={puntosUnicos}
          partidosDisponibles={partidosDisponibles}
          onIrAPunto={onIrAPunto}
          etiqueta="A"
          onDuplicar={modoComparacion ? undefined : duplicarAenB}
          onRestablecer={() => setPanelA(panelInicial())}
        />

        {modoComparacion && (
          <PanelAnalisis
            acciones={acciones}
            config={panelB}
            setConfig={setPanel("B")}
            nombre={nombre}
            jugadoresParaDropdown={jugadoresParaDropdown}
            setsUnicos={setsUnicos}
            puntosUnicos={puntosUnicos}
            partidosDisponibles={partidosDisponibles}
            onIrAPunto={onIrAPunto}
            etiqueta="B"
            onRestablecer={() => setPanelB(panelInicial())}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================
// EVALUACIÓN DE UN PANEL (para contadores en el header)
// ============================================================

function evaluarPanel(
  acciones: AccionVisual[],
  config: ConfiguracionPanel,
  _lenJugadores: number
): ResultadoAnalisis {
  return analizarConsecuencias(acciones, construirFiltros(config));
}

function construirFiltros(config: ConfiguracionPanel): FiltrosAnalisis {
  const esRelacion =
    config.jugadorObservadoFiltro === "cualquiera" ||
    config.jugadorObservadoFiltro === "mismo" ||
    config.jugadorObservadoFiltro === "companero" ||
    config.jugadorObservadoFiltro === "rival";

  const jugadorObservadoRelacion: RelacionJugadorObservado = esRelacion
    ? (config.jugadorObservadoFiltro as RelacionJugadorObservado)
    : "cualquiera";

  const jugadorObservadoId = esRelacion
    ? null
    : config.jugadorObservadoFiltro;

  return {
    bloques: config.bloques,
    tipoObservado: config.tipoObservado,
    jugadorObservadoRelacion,
    jugadorObservadoId,
    alcance: config.alcance,
    ventana: 1 as Ventana,
    coincidencias: config.coincidencias,
  };
}

// ============================================================
// PREGUNTAS RÁPIDAS (definidas después por simplicidad)
// ============================================================

interface PreguntaRapida {
  id: string;
  titulo: string;
  bloque: BloqueTrigger;
  tipoObservado: TipoDisparador | "cualquiera";
  jugadorObservadoRelacion: RelacionJugadorObservado;
  alcance: "partido" | "mismo_punto";
}

const PREGUNTAS_RAPIDAS: PreguntaRapida[] = [
  {
    id: "error-ataque",
    titulo: "Error ataque → sig. ataque",
    bloque: {
      id: "qr-1",
      operador: "AND",
      filtro: {
        ...BLOQUE_TRIGGER_VACIO,
        tipo: "ataque",
        resultado: "error",
      },
    },
    tipoObservado: "ataque",
    jugadorObservadoRelacion: "mismo",
    alcance: "partido",
  },
  {
    id: "mala-recep",
    titulo: "Recep. negativa → sig. ataque",
    bloque: {
      id: "qr-2",
      operador: "AND",
      filtro: {
        ...BLOQUE_TRIGGER_VACIO,
        tipo: "recepcion",
        resultado: "negativa",
      },
    },
    tipoObservado: "ataque",
    jugadorObservadoRelacion: "cualquiera",
    alcance: "partido",
  },
  {
    id: "ace-saque",
    titulo: "Ace → sig. saque",
    bloque: {
      id: "qr-3",
      operador: "AND",
      filtro: {
        ...BLOQUE_TRIGGER_VACIO,
        tipo: "saque",
        resultado: "ace",
      },
    },
    tipoObservado: "saque",
    jugadorObservadoRelacion: "mismo",
    alcance: "partido",
  },
  {
    id: "punto-ataque-o-bloqueo",
    titulo: "Punto por ataque O bloqueo",
    bloque: {
      id: "qr-4a",
      operador: "AND",
      filtro: {
        ...BLOQUE_TRIGGER_VACIO,
        tipo: "ataque",
        resultado: "punto",
      },
    },
    tipoObservado: "cualquiera",
    jugadorObservadoRelacion: "cualquiera",
    alcance: "partido",
  },
  {
    id: "cierre-set",
    titulo: "Cierre de set",
    bloque: {
      id: "qr-5",
      operador: "AND",
      filtro: {
        ...BLOQUE_TRIGGER_VACIO,
        tipo: "ataque",
        contextoPartido: {
          ...CONTEXTO_PARTIDO_VACIO,
          marcador: {
            ...CONTEXTO_PARTIDO_VACIO.marcador,
            puntosParaCerrar: "<=3",
          },
        },
      },
    },
    tipoObservado: "ataque",
    jugadorObservadoRelacion: "cualquiera",
    alcance: "partido",
  },
  {
    id: "racha-ganando",
    titulo: "Racha 3+ ganando",
    bloque: {
      id: "qr-6",
      operador: "AND",
      filtro: {
        ...BLOQUE_TRIGGER_VACIO,
        tipo: "ataque",
        contextoPartido: {
          ...CONTEXTO_PARTIDO_VACIO,
          rachaPuntos: 3,
        },
      },
    },
    tipoObservado: "ataque",
    jugadorObservadoRelacion: "cualquiera",
    alcance: "partido",
  },
  {
    id: "inmediata",
    titulo: "Acción inmediata siguiente",
    bloque: {
      id: "qr-7",
      operador: "AND",
      filtro: { ...BLOQUE_TRIGGER_VACIO, tipo: "ataque" },
    },
    tipoObservado: "cualquiera",
    jugadorObservadoRelacion: "cualquiera",
    alcance: "mismo_punto",
  },
];

// ============================================================
// PANEL DE ANÁLISIS (A o B)
// ============================================================

function PanelAnalisis({
  acciones,
  config,
  setConfig,
  nombre,
  jugadoresParaDropdown,
  setsUnicos,
  puntosUnicos,
  partidosDisponibles,
  onIrAPunto,
  etiqueta,
  onDuplicar,
  onRestablecer,
}: {
  acciones: AccionVisual[];
  config: ConfiguracionPanel;
  setConfig: (c: ConfiguracionPanel) => void;
  nombre: (id: string | null) => string;
  jugadoresParaDropdown: { id: string; nombre: string }[];
  setsUnicos: number[];
  puntosUnicos: number[];
  partidosDisponibles?: { id: string; nombre: string }[];
  onIrAPunto?: (set: number, punto: number) => void;
  etiqueta: string;
  onDuplicar?: () => void;
  onRestablecer?: () => void;
}) {
  const resultado = useMemo(
    () => analizarConsecuencias(acciones, construirFiltros(config)),
    [acciones, config]
  );

  const esRelacion =
    config.jugadorObservadoFiltro === "cualquiera" ||
    config.jugadorObservadoFiltro === "mismo" ||
    config.jugadorObservadoFiltro === "companero" ||
    config.jugadorObservadoFiltro === "rival";

  const receta = useMemo(() => {
    const partes: string[] = [];
    config.bloques.forEach((b, i) => {
      if (i > 0) partes.push(etiquetaOperador(b.operador).toUpperCase());
      partes.push(resumenBloque(b.filtro));
    });
    partes.push("→");
    const tipoObs =
      config.tipoObservado === "cualquiera"
        ? "siguiente acción"
        : `sig. ${etiquetaTipoDisparador(config.tipoObservado)}`;
    const jugObs = esRelacion
      ? etiquetaRelacionObservado(config.jugadorObservadoFiltro as RelacionJugadorObservado)
      : nombre(config.jugadorObservadoFiltro);
    partes.push(`${tipoObs} · ${jugObs}`);
    return partes.join(" ");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  // Handlers
  const agregarBloque = () => {
    setConfig({
      ...config,
      bloques: [...config.bloques, bloqueVacio("AND")],
    });
  };
  const eliminarBloque = (id: string) => {
    if (config.bloques.length <= 1) return;
    setConfig({
      ...config,
      bloques: config.bloques.filter((b) => b.id !== id),
    });
  };
  const actualizarBloque = (id: string, cambios: Partial<BloqueTrigger>) => {
    setConfig({
      ...config,
      bloques: config.bloques.map((b) =>
        b.id === id ? { ...b, ...cambios } : b
      ),
    });
  };
  const actualizarFiltroBloque = (
    id: string,
    cambios: Partial<BloqueTriggerFiltro>
  ) => {
    setConfig({
      ...config,
      bloques: config.bloques.map((b) =>
        b.id === id ? { ...b, filtro: { ...b.filtro, ...cambios } } : b
      ),
    });
  };

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/40">
      {/* ====== HEADER DEL PANEL ====== */}
      <div className="px-3 py-2 border-b border-white/10 flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-700 text-slate-100 border border-white/10">
              {etiqueta}
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-white/10 text-slate-300 bg-white/5">
              {resultado.totalOcurrencias} caso
              {resultado.totalOcurrencias !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 truncate" title={receta}>
            {receta}
          </p>
        </div>
        <div className="flex gap-1 shrink-0">
          {onDuplicar && (
            <button
              onClick={onDuplicar}
              className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 text-slate-300 hover:text-white hover:bg-white/5"
              title="Duplicar a B"
            >
              ⇄
            </button>
          )}
          {onRestablecer && (
            <button
              onClick={onRestablecer}
              className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 text-slate-300 hover:text-white hover:bg-white/5"
              title="Restablecer"
            >
              ↻
            </button>
          )}
        </div>
      </div>

      <div className="p-3 space-y-2">
        {/* ====== BLOQUES CUANDO ====== */}
        <div className="space-y-1.5">
          {config.bloques.map((b, idx) => (
            <div key={b.id}>
              {/* Operador (excepto primero) */}
              {idx > 0 && (
                <div className="flex items-center gap-1 mb-1 ml-2">
                  <span className="text-slate-500 text-[10px]">└</span>
                  <select
                    value={b.operador}
                    onChange={(e) =>
                      actualizarBloque(b.id, {
                        operador: e.target.value as OperadorBloque,
                      })
                    }
                    className="bg-slate-900 text-white text-[10px] font-bold uppercase rounded px-1.5 py-0.5 border border-white/10 cursor-pointer"
                  >
                    {OPERADORES.map((op) => (
                      <option key={op.v} value={op.v}>
                        {op.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <BloqueEditor
                bloque={b}
                idx={idx}
                totalBloques={config.bloques.length}
                nombre={nombre}
                jugadoresParaDropdown={jugadoresParaDropdown}
                setsUnicos={setsUnicos}
                puntosUnicos={puntosUnicos}
                partidosDisponibles={partidosDisponibles}
                onCambiarFiltro={(cambios) =>
                  actualizarFiltroBloque(b.id, cambios)
                }
                onEliminar={() => eliminarBloque(b.id)}
              />
            </div>
          ))}

          <button
            onClick={agregarBloque}
            className="w-full px-2 py-1 text-[10px] font-semibold rounded border border-dashed border-violet-500/40 bg-violet-500/5 text-violet-300 hover:bg-violet-500/15"
          >
            + Añadir otro CUANDO
          </button>
        </div>

        {/* ====== MIRAR ====== */}
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
              Mirar
            </span>
            <span className="text-[10px] text-slate-400">qué pasa después</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <select
              value={config.tipoObservado}
              onChange={(e) =>
                setConfig({
                  ...config,
                  tipoObservado: e.target.value as
                    | TipoDisparador
                    | "cualquiera",
                })
              }
              className={selectCls}
            >
              {TIPOS_OBSERVADOS.map((t) => (
                <option key={t.v} value={t.v}>
                  {t.label}
                </option>
              ))}
            </select>

            <select
              value={config.jugadorObservadoFiltro}
              onChange={(e) =>
                setConfig({
                  ...config,
                  jugadorObservadoFiltro: e.target.value,
                })
              }
              className={selectCls}
            >
              {RELACIONES_OBSERVADO.map((r) => (
                <option key={r.v} value={r.v}>
                  {r.label}
                </option>
              ))}
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

        {/* ====== AVANZADO (alcance + comparadores) ====== */}
        <details className="rounded-lg border border-white/10 bg-white/[0.02]">
          <summary className="px-2 py-1.5 cursor-pointer text-[11px] font-bold uppercase text-slate-300 flex items-center justify-between">
            <span>⚙️ Avanzado del análisis</span>
            <span className="text-slate-500 text-[10px]">▼</span>
          </summary>
          <div className="p-2 pt-0 space-y-2">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                Alcance
              </label>
              <select
                value={config.alcance}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    alcance: e.target.value as "partido" | "mismo_punto",
                  })
                }
                className={selectCls}
              >
                {ALANCES.map((a) => (
                  <option key={a.v} value={a.v}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>

            <ComparadoresSection
              coincidencias={config.coincidencias}
              setCoincidencias={(c) =>
                setConfig({ ...config, coincidencias: c })
              }
            />
          </div>
        </details>

        {/* ====== RESULTADOS ====== */}
        {resultado.totalOcurrencias === 0 ? (
          <div className="rounded-lg border border-white/10 p-4 text-center text-xs text-slate-400">
            No hay casos que cumplan los criterios.
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
                tipoObservado={config.tipoObservado}
                jugadorObservadoFiltro={config.jugadorObservadoFiltro}
                nombre={nombre}
                coincidencias={config.coincidencias}
                onIrAPunto={onIrAPunto}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// BLOQUE EDITOR
// ============================================================

function BloqueEditor({
  bloque,
  idx,
  totalBloques,
  nombre,
  jugadoresParaDropdown,
  setsUnicos,
  puntosUnicos,
  partidosDisponibles,
  onCambiarFiltro,
  onEliminar,
}: {
  bloque: BloqueTrigger;
  idx: number;
  totalBloques: number;
  nombre: (id: string | null) => string;
  jugadoresParaDropdown: { id: string; nombre: string }[];
  setsUnicos: number[];
  puntosUnicos: number[];
  partidosDisponibles?: { id: string; nombre: string }[];
  onCambiarFiltro: (cambios: Partial<BloqueTriggerFiltro>) => void;
  onEliminar: () => void;
}) {
  const f = bloque.filtro;
  const avanzadoActivo = hayFiltrosAvanzadosEnBloque(f);

  return (
    <div className="rounded-lg border border-white/10 bg-slate-900/30 p-2 space-y-1.5">
      {/* Header del bloque */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
            Cuando #{idx + 1}
          </span>
          {avanzadoActivo && (
            <span className="text-[8px] px-1 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/40">
              ⚙️
            </span>
          )}
        </div>
        {totalBloques > 1 && (
          <button
            onClick={onEliminar}
            className="text-[10px] text-rose-400 hover:text-rose-300"
          >
            ✕
          </button>
        )}
      </div>

      {/* Mínimo esencial: tipo + jugador */}
      <div className="grid grid-cols-2 gap-1">
        <select
          value={f.tipo}
          onChange={(e) =>
            onCambiarFiltro({
              tipo: e.target.value as TipoDisparador,
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

        <select
          value={f.jugadorId ?? "todos"}
          onChange={(e) =>
            onCambiarFiltro({
              jugadorId: e.target.value === "todos" ? null : e.target.value,
            })
          }
          className={selectCls}
        >
          <option value="todos">Todo el equipo</option>
          {jugadoresParaDropdown.map((j) => (
            <option key={j.id} value={j.id}>
              {j.nombre}
            </option>
          ))}
        </select>
      </div>

      {/* Scope y avanzado del bloque */}
      <details
        className={`rounded border ${
          avanzadoActivo
            ? "border-violet-500/40 bg-violet-500/[0.04]"
            : "border-white/10 bg-white/[0.02]"
        }`}
      >
        <summary className="px-2 py-1 cursor-pointer text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
          <span>Filtros del bloque {avanzadoActivo && "✓"}</span>
          <span className="text-slate-500 text-[9px]">▼</span>
        </summary>
        <div className="p-2 pt-0 space-y-2">
          {/* Resultado */}
          <div>
            <label className="block text-[9px] font-bold uppercase text-slate-500 mb-0.5">
              Resultado del trigger
            </label>
            <select
              value={f.resultado}
              onChange={(e) => onCambiarFiltro({ resultado: e.target.value })}
              className={selectCls}
            >
              {resultadosPorTipoAnalisis(f.tipo).map((r) => (
                <option key={r} value={r}>
                  {etiquetaResultado(r)}
                </option>
              ))}
            </select>
          </div>

          {/* Scope */}
          <ScopeSection
            filtro={f}
            onChange={onCambiarFiltro}
            setsUnicos={setsUnicos}
            puntosUnicos={puntosUnicos}
            partidosDisponibles={partidosDisponibles}
          />

          {/* Acción previa directa */}
          <AccionPreviaSection
            previa={f.accionPreviaDirecta}
            onCambiar={(p) => onCambiarFiltro({ accionPreviaDirecta: p })}
          />

          {/* Racha de jugador */}
          <RachaJugadorSection
            racha={f.rachaJugador}
            onCambiar={(r) => onCambiarFiltro({ rachaJugador: r })}
            jugadoresParaDropdown={jugadoresParaDropdown}
          />

          {/* Patrón previo */}
          <PatronSection
            patron={f.patronPrevio}
            onCambiar={(p) => onCambiarFiltro({ patronPrevio: p })}
          />

          {/* Top % y Vs promedio */}
          <div className="grid grid-cols-2 gap-1">
            <div>
              <label className="block text-[9px] font-bold uppercase text-slate-500 mb-0.5">
                Top % del tipo
              </label>
              <select
                value={f.topPorcentaje === null ? "" : String(f.topPorcentaje)}
                onChange={(e) =>
                  onCambiarFiltro({
                    topPorcentaje:
                      e.target.value === ""
                        ? null
                        : parseInt(e.target.value, 10),
                  })
                }
                className={selectCls}
              >
                <option value="">Sin filtro</option>
                <option value="10">Top 10%</option>
                <option value="20">Top 20%</option>
                <option value="30">Top 30%</option>
                <option value="50">Top 50%</option>
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-bold uppercase text-slate-500 mb-0.5">
                Vs promedio
              </label>
              <select
                value={f.vsPromedio ?? ""}
                onChange={(e) =>
                  onCambiarFiltro({
                    vsPromedio:
                      e.target.value === ""
                        ? null
                        : (e.target.value as "por_encima" | "por_debajo"),
                  })
                }
                className={selectCls}
              >
                <option value="">Sin filtro</option>
                <option value="por_encima">Por encima</option>
                <option value="por_debajo">Por debajo</option>
              </select>
            </div>
          </div>

          {/* Rachas históricas */}
          <RachasSection
            rachas={f.rachas}
            onCambiar={(rachas) => onCambiarFiltro({ rachas })}
          />

          {/* Contexto del partido */}
          <ContextoSection
            contexto={f.contextoPartido}
            onCambiar={(c) => onCambiarFiltro({ contextoPartido: c })}
          />
        </div>
      </details>
    </div>
  );
}

// ============================================================
// SCOPE (sets, puntos, partidos, roles, zonas, rotaciones)
// ============================================================

function ScopeSection({
  filtro,
  onChange,
  setsUnicos,
  puntosUnicos,
  partidosDisponibles,
}: {
  filtro: BloqueTriggerFiltro;
  onChange: (cambios: Partial<BloqueTriggerFiltro>) => void;
  setsUnicos: number[];
  puntosUnicos: number[];
  partidosDisponibles?: { id: string; nombre: string }[];
}) {
  const activo =
    filtro.sets.length > 0 ||
    filtro.puntos.length > 0 ||
    filtro.partidos.length > 0 ||
    filtro.roles.length > 0 ||
    filtro.zonasJugador.length > 0 ||
    filtro.rotaciones.length > 0;

  return (
    <details
      className={`rounded border ${
        activo
          ? "border-violet-500/40 bg-violet-500/[0.04]"
          : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <summary className="px-2 py-1 cursor-pointer text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
        <span>
          Scope {activo && "✓"}
        </span>
        <span className="text-slate-500 text-[9px]">▼</span>
      </summary>
      <div className="p-2 pt-0 space-y-1.5">
        <MultiChip
          label="Sets"
          opciones={setsUnicos.map((s) => ({ v: String(s), label: `S${s}` }))}
          seleccionados={filtro.sets.map(String)}
          onChange={(vals) =>
            onChange({ sets: vals.map((v) => parseInt(v, 10)) })
          }
        />
        <MultiChip
          label="Puntos"
          opciones={puntosUnicos.map((p) => ({
            v: String(p),
            label: `P${p}`,
          }))}
          seleccionados={filtro.puntos.map(String)}
          onChange={(vals) =>
            onChange({ puntos: vals.map((v) => parseInt(v, 10)) })
          }
        />
        {partidosDisponibles && partidosDisponibles.length > 0 && (
          <MultiChip
            label="Partidos"
            opciones={partidosDisponibles.map((p) => ({
              v: p.id,
              label: p.nombre,
            }))}
            seleccionados={filtro.partidos}
            onChange={(vals) => onChange({ partidos: vals })}
          />
        )}
        <MultiChip
          label="Roles"
          opciones={ROLES.map((r) => ({ v: r, label: r }))}
          seleccionados={filtro.roles}
          onChange={(vals) => onChange({ roles: vals })}
        />
        <MultiChip
          label="Zonas jugador"
          opciones={ZONAS_JUGADOR.map((z) => ({
            v: String(z.v),
            label: z.label,
          }))}
          seleccionados={filtro.zonasJugador.map(String)}
          onChange={(vals) =>
            onChange({ zonasJugador: vals.map((v) => parseInt(v, 10)) })
          }
        />
        <MultiChip
          label="Rotaciones"
          opciones={ROTACIONES.map((r) => ({
            v: String(r),
            label: `R${r}`,
          }))}
          seleccionados={filtro.rotaciones.map(String)}
          onChange={(vals) =>
            onChange({ rotaciones: vals.map((v) => parseInt(v, 10)) })
          }
        />
      </div>
    </details>
  );
}

function MultiChip({
  label,
  opciones,
  seleccionados,
  onChange,
}: {
  label: string;
  opciones: { v: string; label: string }[];
  seleccionados: string[];
  onChange: (vals: string[]) => void;
}) {
  const toggle = (v: string) => {
    if (seleccionados.includes(v)) {
      onChange(seleccionados.filter((x) => x !== v));
    } else {
      onChange([...seleccionados, v]);
    }
  };
  return (
    <div>
      <label className="block text-[9px] font-bold uppercase text-slate-500 mb-0.5">
        {label}
        {seleccionados.length > 0 && ` (${seleccionados.length})`}
      </label>
      <div className="flex flex-wrap gap-0.5">
        {opciones.map((o) => {
          const sel = seleccionados.includes(o.v);
          return (
            <button
              key={o.v}
              onClick={() => toggle(o.v)}
              className={`px-1.5 py-0.5 text-[9px] font-semibold rounded border transition ${
                sel
                  ? "bg-violet-500/30 border-violet-400/60 text-violet-200"
                  : "bg-white/[0.02] border-white/10 text-slate-400 hover:text-white"
              }`}
              title={o.label}
            >
              {o.label}
            </button>
          );
        })}
        {opciones.length === 0 && (
          <span className="text-[9px] text-slate-500 italic">Sin opciones</span>
        )}
      </div>
    </div>
  );
}

// ============================================================
// ACCIÓN PREVIA DIRECTA
// ============================================================

function AccionPreviaSection({
  previa,
  onCambiar,
}: {
  previa: FiltroAccionHistorica | null;
  onCambiar: (p: FiltroAccionHistorica | null) => void;
}) {
  const activo = !!previa;

  return (
    <details
      className={`rounded border ${
        activo
          ? "border-violet-500/40 bg-violet-500/[0.04]"
          : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <summary className="px-2 py-1 cursor-pointer text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
        <span>
          ⏮️ Acción previa {activo && "✓"}
        </span>
        <span className="text-slate-500 text-[9px]">▼</span>
      </summary>
      <div className="p-2 pt-0 space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-[9px] text-slate-500 italic">
            Filtra la acción inmediatamente anterior.
          </p>
          <button
            onClick={() =>
              onCambiar(
                activo ? null : { ...FILTRO_ACCION_HISTORICA_VACIO }
              )
            }
            className={`shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded border ${
              activo
                ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                : "bg-violet-500/20 text-violet-300 border-violet-500/40"
            }`}
          >
            {activo ? "✕" : "+"}
          </button>
        </div>

        {previa && (
          <div className="grid grid-cols-2 gap-1">
            <select
              value={previa.tipos[0] ?? ""}
              onChange={(e) =>
                onCambiar({
                  ...previa,
                  tipos: e.target.value
                    ? [e.target.value as TipoDisparador]
                    : [],
                  resultados: [],
                })
              }
              className={selectCls}
            >
              <option value="">Cualquier tipo</option>
              {TIPOS.map((t) => (
                <option key={t.v} value={t.v}>
                  {t.label}
                </option>
              ))}
            </select>
            {previa.tipos.length > 0 ? (
              <select
                value={previa.resultados[0] ?? ""}
                onChange={(e) =>
                  onCambiar({
                    ...previa,
                    resultados: e.target.value ? [e.target.value] : [],
                  })
                }
                className={selectCls}
              >
                <option value="">Cualquier resultado</option>
                {resultadosPorTipoAnalisis(previa.tipos[0])
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
            <select
              value={previa.relacionJugador}
              onChange={(e) =>
                onCambiar({
                  ...previa,
                  relacionJugador: e.target.value as RelacionJugador,
                })
              }
              className={`${selectCls} col-span-2`}
            >
              {RELACIONES_PREVIA.map((r) => (
                <option key={r.v} value={r.v}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </details>
  );
}

// ============================================================
// RACHA JUGADOR
// ============================================================

function RachaJugadorSection({
  racha,
  onCambiar,
  jugadoresParaDropdown,
}: {
  racha: RachaJugadorFiltro | null;
  onCambiar: (r: RachaJugadorFiltro | null) => void;
  jugadoresParaDropdown: { id: string; nombre: string }[];
}) {
  const activo = !!racha;

  return (
    <details
      className={`rounded border ${
        activo
          ? "border-violet-500/40 bg-violet-500/[0.04]"
          : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <summary className="px-2 py-1 cursor-pointer text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
        <span>
          🔥 Racha de jugador {activo && "✓"}
        </span>
        <span className="text-slate-500 text-[9px]">▼</span>
      </summary>
      <div className="p-2 pt-0 space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-[9px] text-slate-500 italic">
            Ej: "después de 2 errores seguidos"
          </p>
          <button
            onClick={() =>
              onCambiar(
                activo
                  ? null
                  : {
                      jugadorId: null,
                      tipo: "errores_seguidos",
                      minimo: 2,
                      ambito: "puntos_del_set",
                    }
              )
            }
            className={`shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded border ${
              activo
                ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                : "bg-violet-500/20 text-violet-300 border-violet-500/40"
            }`}
          >
            {activo ? "✕" : "+"}
          </button>
        </div>

        {racha && (
          <div className="grid grid-cols-2 gap-1">
            <select
              value={racha.tipo}
              onChange={(e) =>
                onCambiar({
                  ...racha,
                  tipo: e.target.value as TipoRachaJugador,
                })
              }
              className={`${selectCls} col-span-2`}
            >
              {TIPOS_RACHA_JUGADOR.map((t) => (
                <option key={t.v} value={t.v}>
                  {t.label}
                </option>
              ))}
            </select>
            <select
              value={racha.ambito}
              onChange={(e) =>
                onCambiar({
                  ...racha,
                  ambito: e.target.value as AmbitoRacha,
                })
              }
              className={selectCls}
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
                  ...racha,
                  minimo: Math.max(1, parseInt(e.target.value || "1", 10)),
                })
              }
              className={inputCls}
              placeholder="Mínimo"
            />
            <select
              value={racha.jugadorId ?? "trigger"}
              onChange={(e) =>
                onCambiar({
                  ...racha,
                  jugadorId:
                    e.target.value === "trigger" ? null : e.target.value,
                })
              }
              className={`${selectCls} col-span-2`}
            >
              <option value="trigger">Jugador del trigger</option>
              {jugadoresParaDropdown.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.nombre}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </details>
  );
}

// ============================================================
// PATRÓN PREVIO
// ============================================================

function PatronSection({
  patron,
  onCambiar,
}: {
  patron: PatronPrevioFiltro | null;
  onCambiar: (p: PatronPrevioFiltro | null) => void;
}) {
  const activo = !!patron;

  const agregar = () => {
    if (!patron) {
      onCambiar({ acciones: [{ tipo: "recepcion", resultado: "cualquiera" }] });
      return;
    }
    if (patron.acciones.length >= 3) return;
    onCambiar({
      acciones: [...patron.acciones, { tipo: "armado", resultado: "cualquiera" }],
    });
  };

  const eliminar = (i: number) => {
    if (!patron) return;
    if (patron.acciones.length <= 1) {
      onCambiar(null);
      return;
    }
    onCambiar({
      acciones: patron.acciones.filter((_, idx) => idx !== i),
    });
  };

  const actualizar = (i: number, cambios: Partial<ItemPatron>) => {
    if (!patron) return;
    onCambiar({
      acciones: patron.acciones.map((a, idx) =>
        idx === i ? { ...a, ...cambios } : a
      ),
    });
  };

  return (
    <details
      className={`rounded border ${
        activo
          ? "border-violet-500/40 bg-violet-500/[0.04]"
          : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <summary className="px-2 py-1 cursor-pointer text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
        <span>
          🎯 Patrón previo {activo && `(${patron!.acciones.length})`}
        </span>
        <span className="text-slate-500 text-[9px]">▼</span>
      </summary>
      <div className="p-2 pt-0 space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-[9px] text-slate-500 italic">
            Secuencia exacta de hasta 3 acciones previas.
          </p>
          <div className="flex gap-1">
            {activo && (
              <button
                onClick={() => onCambiar(null)}
                className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded border bg-rose-500/20 text-rose-300 border-rose-500/40"
              >
                ✕
              </button>
            )}
            <button
              onClick={agregar}
              disabled={activo && patron!.acciones.length >= 3}
              className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded border bg-violet-500/20 text-violet-300 border-violet-500/40 disabled:opacity-40"
            >
              + Acción
            </button>
          </div>
        </div>

        {patron && patron.acciones.length > 0 && (
          <div className="space-y-1">
            {patron.acciones.map((item, i) => (
              <div
                key={i}
                className="grid grid-cols-[auto_1fr_auto] gap-1 items-center"
              >
                <span className="text-[9px] text-slate-500">
                  {i + 1}.
                </span>
                <div className="grid grid-cols-2 gap-1">
                  <select
                    value={item.tipo}
                    onChange={(e) =>
                      actualizar(i, {
                        tipo: e.target.value as TipoDisparador,
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
                  <select
                    value={item.resultado}
                    onChange={(e) =>
                      actualizar(i, { resultado: e.target.value })
                    }
                    className={selectCls}
                  >
                    {resultadosPorTipoAnalisis(item.tipo).map((r) => (
                      <option key={r} value={r}>
                        {etiquetaResultado(r)}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => eliminar(i)}
                  className="text-rose-400 hover:text-rose-300 text-[10px]"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

// ============================================================
// RACHAS HISTÓRICAS
// ============================================================

function RachasSection({
  rachas,
  onCambiar,
}: {
  rachas: RachaHistorica[];
  onCambiar: (r: RachaHistorica[]) => void;
}) {
  let _c = 0;
  const nuevo = (): RachaHistorica => {
    _c += 1;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? `r-${crypto.randomUUID()}`
        : `r-${Date.now()}-${_c}`;
    return {
      id,
      ambito: "mismo_punto",
      desdeAtras: 0,
      minimo: 1,
      filtro: { ...FILTRO_ACCION_HISTORICA_VACIO },
    };
  };

  return (
    <details
      className={`rounded border ${
        rachas.length > 0
          ? "border-violet-500/40 bg-violet-500/[0.04]"
          : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <summary className="px-2 py-1 cursor-pointer text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
        <span>📜 Historia previa ({rachas.length})</span>
        <span className="text-slate-500 text-[9px]">▼</span>
      </summary>
      <div className="p-2 pt-0 space-y-1">
        {rachas.map((r, i) => (
          <RachaFila
            key={r.id}
            idx={i}
            racha={r}
            onCambiar={(c) =>
              onCambiar(
                rachas.map((x) => (x.id === r.id ? { ...x, ...c } : x))
              )
            }
            onEliminar={() =>
              onCambiar(rachas.filter((x) => x.id !== r.id))
            }
          />
        ))}
        <button
          onClick={() => onCambiar([...rachas, nuevo()])}
          className="w-full px-2 py-1 text-[9px] font-semibold rounded border border-violet-500/40 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20"
        >
          + Añadir racha
        </button>
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
  onCambiar: (c: Partial<RachaHistorica>) => void;
  onEliminar: () => void;
}) {
  const tipoActual = racha.filtro.tipos[0] ?? "";
  return (
    <div className="rounded border border-white/10 bg-slate-900/40 p-1 space-y-1">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[9px] font-bold text-violet-300">
          #{idx + 1}
        </span>
        <span className="text-[8px] text-slate-400 truncate flex-1">
          {resumenRacha(racha)}
        </span>
        <button
          onClick={onEliminar}
          className="text-rose-400 hover:text-rose-300 text-[9px]"
        >
          ✕
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1">
        <select
          value={racha.ambito}
          onChange={(e) =>
            onCambiar({ ambito: e.target.value as AmbitoRacha })
          }
          className={selectCls}
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
          className={inputCls}
          placeholder="Mínimo"
        />
        <select
          value={tipoActual}
          onChange={(e) =>
            onCambiar({
              filtro: {
                ...racha.filtro,
                tipos: e.target.value
                  ? [e.target.value as TipoDisparador]
                  : [],
                resultados: [],
              },
            })
          }
          className={selectCls}
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
          className={`${inputCls} col-span-2`}
          placeholder="Saltar N del tipo"
        />
      </div>
    </div>
  );
}

// ============================================================
// CONTEXTO DEL PARTIDO
// ============================================================

function ContextoSection({
  contexto,
  onCambiar,
}: {
  contexto: ContextoPartidoFiltro | null;
  onCambiar: (c: ContextoPartidoFiltro | null) => void;
}) {
  const activo = !!contexto && hayContextoPartidoActivo(contexto);

  return (
    <details
      className={`rounded border ${
        activo
          ? "border-violet-500/40 bg-violet-500/[0.04]"
          : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <summary className="px-2 py-1 cursor-pointer text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
        <span>
          📊 Contexto del partido {activo && "✓"}
        </span>
        <span className="text-slate-500 text-[9px]">▼</span>
      </summary>
      <div className="p-2 pt-0 space-y-1.5">
        <div className="flex justify-end">
          <button
            onClick={() =>
              onCambiar(
                contexto ? null : { ...CONTEXTO_PARTIDO_VACIO }
              )
            }
            className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${
              contexto
                ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                : "bg-violet-500/20 text-violet-300 border-violet-500/40"
            }`}
          >
            {contexto ? "✕ Quitar" : "+ Activar"}
          </button>
        </div>

        {contexto && (
          <>
            {/* Marcador */}
            <div>
              <p className="text-[9px] font-bold uppercase text-slate-500 mb-0.5">
                Marcador
              </p>
              <div className="grid grid-cols-2 gap-1">
                <select
                  value={contexto.marcador.estado}
                  onChange={(e) =>
                    onCambiar({
                      ...contexto,
                      marcador: {
                        ...contexto.marcador,
                        estado: e.target
                          .value as MarcadorFiltro["estado"],
                      },
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
                    onCambiar({
                      ...contexto,
                      marcador: {
                        ...contexto.marcador,
                        diferencia: e.target
                          .value as MarcadorFiltro["diferencia"],
                      },
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
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={
                    contexto.marcador.diferenciaExacta === null
                      ? ""
                      : contexto.marcador.diferenciaExacta
                  }
                  onChange={(e) =>
                    onCambiar({
                      ...contexto,
                      marcador: {
                        ...contexto.marcador,
                        diferenciaExacta:
                          e.target.value === ""
                            ? null
                            : parseInt(e.target.value, 10),
                      },
                    })
                  }
                  placeholder="Diff exacta"
                  className={inputCls}
                />
                <select
                  value={contexto.marcador.puntosParaCerrar}
                  onChange={(e) =>
                    onCambiar({
                      ...contexto,
                      marcador: {
                        ...contexto.marcador,
                        puntosParaCerrar: e.target
                          .value as MarcadorFiltro["puntosParaCerrar"],
                      },
                    })
                  }
                  className={selectCls}
                >
                  {PUNTOS_CERRAR.map((p) => (
                    <option key={p.v} value={p.v}>
                      {p.v === "cualquiera"
                        ? "Sin filtro de cierre"
                        : p.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() =>
                    onCambiar({
                      ...contexto,
                      marcador: {
                        ...contexto.marcador,
                        soloCriticos: !contexto.marcador.soloCriticos,
                      },
                    })
                  }
                  className={`px-2 py-1 text-[10px] font-semibold rounded border transition col-span-2 ${
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

            {/* Rally */}
            <div>
              <p className="text-[9px] font-bold uppercase text-slate-500 mb-0.5">
                Rally
              </p>
              <div className="grid grid-cols-2 gap-1">
                <select
                  value={contexto.faseRally}
                  onChange={(e) =>
                    onCambiar({
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
                    onCambiar({
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
                    onCambiar({
                      ...contexto,
                      esPrimerToque: e.target
                        .value as ContextoPartidoFiltro["esPrimerToque"],
                    })
                  }
                  className={selectCls}
                >
                  <option value="cualquiera">Primer toque: cualq.</option>
                  <option value="si">Sí (primer toque)</option>
                  <option value="no">No (2° o 3er)</option>
                </select>
                <select
                  value={contexto.toquesMinimo ?? "cualquiera"}
                  onChange={(e) =>
                    onCambiar({
                      ...contexto,
                      toquesMinimo:
                        e.target.value === "cualquiera"
                          ? null
                          : parseInt(e.target.value, 10),
                    })
                  }
                  className={selectCls}
                >
                  <option value="cualquiera">Toques: cualq.</option>
                  <option value="2">≥ 2</option>
                  <option value="3">≥ 3</option>
                  <option value="4">≥ 4</option>
                </select>
              </div>
            </div>

            {/* Jugador / set */}
            <div>
              <p className="text-[9px] font-bold uppercase text-slate-500 mb-0.5">
                Jugador / set
              </p>
              <div className="grid grid-cols-2 gap-1">
                <select
                  value={contexto.ubicacionTrigger}
                  onChange={(e) =>
                    onCambiar({
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
                    onCambiar({
                      ...contexto,
                      rachaPuntos:
                        e.target.value === "cualquiera"
                          ? null
                          : parseInt(e.target.value, 10),
                    })
                  }
                  className={selectCls}
                >
                  <option value="cualquiera">Racha: cualq.</option>
                  <option value="2">≥ 2 seguidos</option>
                  <option value="3">≥ 3 seguidos</option>
                  <option value="4">≥ 4 seguidos</option>
                  <option value="5">≥ 5 seguidos</option>
                </select>
                <select
                  value={contexto.posicionEnSet}
                  onChange={(e) =>
                    onCambiar({
                      ...contexto,
                      posicionEnSet: e.target
                        .value as PosicionEnSet,
                    })
                  }
                  className={`${selectCls} col-span-2`}
                >
                  {POSICIONES_SET.map((p) => (
                    <option key={p.v} value={p.v}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}
      </div>
    </details>
  );
}

// ============================================================
// COMPARADORES
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
      className={`rounded border ${
        cantActivos > 0
          ? "border-violet-500/40 bg-violet-500/[0.04]"
          : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <summary className="px-2 py-1 cursor-pointer text-[10px] font-bold uppercase text-slate-400 flex items-center justify-between">
        <span>🔗 Comparadores ({cantActivos})</span>
        <span className="text-slate-500 text-[9px]">▼</span>
      </summary>
      <div className="p-2 pt-0 flex flex-wrap gap-1">
        {COMPARADORES.map((c) => {
          const act = coincidencias[c.key];
          return (
            <button
              key={c.key}
              onClick={() => toggle(c.key)}
              className={`px-2 py-0.5 text-[10px] font-semibold rounded border transition flex items-center gap-1 ${
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
// DISTRIBUCIÓN
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

// ============================================================
// SECCIÓN: COMPORTAMIENTO
// ============================================================

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
// SECCIÓN: CONSECUENCIA
// ============================================================

function SeccionConsecuencia({
  resultado,
  tipoObservado,
  jugadorObservadoFiltro,
  nombre,
  coincidencias,
  onIrAPunto,
}: {
  resultado: ResultadoAnalisis;
  tipoObservado: TipoDisparador | "cualquiera";
  jugadorObservadoFiltro: string;
  nombre: (id: string | null) => string;
  coincidencias: CoincidenciaFiltro;
  onIrAPunto?: (set: number, punto: number) => void;
}) {
  const est = resultado.estadisticasObservadas;
  if (!est) return null;
  const evalR = est.evaluacionResultado;

  const esRelacion =
    jugadorObservadoFiltro === "cualquiera" ||
    jugadorObservadoFiltro === "mismo" ||
    jugadorObservadoFiltro === "companero" ||
    jugadorObservadoFiltro === "rival";

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
          {evalR.total} casos ·{" "}
          {evalR.masFrecuente === "punto"
            ? "punto"
            : evalR.masFrecuente === "error"
            ? "error"
            : "neutro"}
        </span>
      </summary>

      <div className="p-3 space-y-2 border-t border-white/10">
        <p className="text-[10px] text-slate-400 -mt-1">
          {esRelacion
            ? etiquetaRelacionObservado(
                jugadorObservadoFiltro as RelacionJugadorObservado
              )
            : `Jugador específico: ${nombre(jugadorObservadoFiltro)}`}
        </p>

        {/* Balance */}
        <div className="space-y-1">
          <BalanceFila
            color="bg-emerald-400"
            label="Puntos"
            pct={evalR.pctPuntos}
            count={evalR.puntos}
            total={evalR.total}
            colorTexto="text-emerald-300"
            colorBarra="bg-emerald-500"
          />
          <BalanceFila
            color="bg-amber-400"
            label="Neutro"
            pct={evalR.pctNeutros}
            count={evalR.neutros}
            total={evalR.total}
            colorTexto="text-amber-300"
            colorBarra="bg-amber-500"
          />
          <BalanceFila
            color="bg-rose-400"
            label="Error"
            pct={evalR.pctErrores}
            count={evalR.errores}
            total={evalR.total}
            colorTexto="text-rose-300"
            colorBarra="bg-rose-500"
          />
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
        <div className="pt-2 border-t border-white/5 space-y-0.5 text-[11px]">
          <div className="flex justify-between gap-2">
            <span className="text-slate-400">Subtipo más frecuente:</span>
            <span className="font-semibold text-white capitalize truncate">
              {est.subtipoMasFrecuente || "—"}{" "}
              <span className="text-slate-400 font-normal">
                ({est.subtiposRanking[0]?.pct ?? 0}%)
              </span>
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-400">Distancia promedio:</span>
            <span className="font-mono text-white">
              ~{est.promedioAccionesDistancia}t ·{" "}
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
          <div className="mt-2 overflow-x-auto max-h-[280px] overflow-y-auto rounded border border-white/10">
            <table className="w-full text-[10px] min-w-[560px]">
              <thead className="sticky top-0 bg-slate-950 border-b border-white/10 text-slate-400 text-left">
                <tr>
                  <th className="py-1.5 px-2">Momento</th>
                  <th className="py-1.5 px-2">Trigger</th>
                  <th className="py-1.5 px-2">Observada</th>
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
                    >
                      <td className="py-1.5 px-2 font-mono text-slate-400 whitespace-nowrap">
                        S{o.set_numero}·P{o.punto_numero}
                      </td>
                      <td className="py-1.5 px-2">
                        <span className="text-slate-100 capitalize">
                          {o.triggerSubtipo}
                        </span>{" "}
                        <span className="text-slate-500">
                          ({nombre(o.triggerJugadorId)})
                        </span>
                      </td>
                      <td className="py-1.5 px-2">
                        {obs ? (
                          <>
                            <span className="text-slate-100 capitalize">
                              {obs.subtipo}
                            </span>{" "}
                            <span className="text-slate-500">
                              ({nombre(obs.accion.jugador_id)})
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-500 italic">—</span>
                        )}
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
                              ? "P"
                              : obs.categoriaResultado === "error"
                              ? "E"
                              : "N"}
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

function BalanceFila({
  color,
  label,
  pct,
  count,
  total,
  colorTexto,
  colorBarra,
}: {
  color: string;
  label: string;
  pct: number;
  count: number;
  total: number;
  colorTexto: string;
  colorBarra: string;
}) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${color}`} />
        <span className="text-slate-300">{label}</span>
      </div>
      <div className="flex items-center gap-2 flex-1 max-w-xs ml-2">
        <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full ${colorBarra} rounded-full`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className={`font-mono font-semibold text-[10px] w-12 text-right ${colorTexto}`}>
          {pct}%
        </span>
      </div>
      <span className="font-mono text-slate-500 text-[10px] w-14 text-right">
        {count}/{total}
      </span>
    </div>
  );
}