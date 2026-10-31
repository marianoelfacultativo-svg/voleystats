"use client";

// ============================================================
// PANEL DE BÚSQUEDA — Análisis de consecuencias
// ============================================================
// Buscador en lenguaje natural + parser + chips de coincidencias.
//
// v5 (FASE 7.4):
//   + `jugadoresParaDropdown` acepta `apodo?` y `numero?` para
//     que el parser pueda resolver apodos / apellidos / pila.
//   + Si `parseResult.jugadorAmbiguo === true`:
//       · Se muestra un bloque rojo con los candidatos y la
//         sugerencia ("usá nombre completo, apodo o #número").
//       · El botón "Aplicar" queda deshabilitado (no se puede
//         ejecutar una consulta con un jugador ambiguo).
//   + `jugadorDetectadoId` sigue siendo `null` en ese caso
//     (el parser no asigna `filtro.jugadorId` cuando hay
//     ambigüedad), así que la consulta NO filtra por jugador
//     accidentalmente.
//
// v4 (FASE 1): agrega un bloque "Intención analítica" que
// muestra los chips de la intención detectada por
// `parsearIntencion` (tipo, groupBy, métrica, tiempo,
// condición). Es solo informativo: NO se aplica al filtro.
//
// v3: narrow del tipo `"cualquiera"` antes de llamar a
// `etiquetaTipoDisparador` (fix build TS).
//
// v2: aplica `tipoObservadoSugerido` y `relacionObservadoSugerido`
// que devuelve el parser cuando detecta frases del tipo
// "ataques que defiende el rival" → tipoObservado=defensa,
// relacion=rival.
// ============================================================

import { useMemo, useState } from "react";
import {
  etiquetaLlamadaInferida,
  etiquetaResultado,
  etiquetaTipoDisparador,
  type RelacionJugadorObservado,
  type TipoDisparador,
} from "@/lib/analisisConsecuencias";
import {
  parsearBusqueda,
  type ResultadoParser,
} from "@/lib/parserBusqueda";
import type { AccionVisual } from "../adaptadorUnificadoV2";
import { CATEGORIA_COLOR } from "./constantes";
import { generarIdBloque, type ConfiguracionPanel } from "./types";

// ------------------------------------------------------------
// PROPS
// ------------------------------------------------------------

interface Props {
  acciones: AccionVisual[];
  config: ConfiguracionPanel;
  setConfig: (c: ConfiguracionPanel) => void;
  jugadoresParaDropdown: {
    id: string;
    nombre: string;
    apodo?: string | null;
    numero?: number | null;
  }[];
  partidosDisponibles?: { id: string; nombre: string }[];
}

// ------------------------------------------------------------
// ETIQUETAS DE INTENCIÓN (para los chips)
// ------------------------------------------------------------

const ETIQ_TIPO_INTENCION: Record<string, string> = {
  count: "cuántos",
  percentage: "porcentaje",
  average: "promedio",
  frequency: "cada cuánto",
  max: "máximo",
  min: "mínimo",
  ranking: "ranking",
  comparison: "comparación",
  distribution: "distribución",
  trend: "evolución",
  habit: "suele",
  unknown: "",
};

const ETIQ_GROUPBY: Record<string, string> = {
  set: "por set",
  partido: "por partido",
  jugador: "por jugador",
  zona_origen: "por zona origen",
  zona_destino: "por zona destino",
  zona_jugador: "por zona jugador",
  rotacion: "por rotación",
  rol: "por rol",
  ubicacion: "por ubicación",
  fase: "por fase",
  rival: "por rival",
  resultado_partido: "por resultado",
  tipo: "por tipo",
  subtipo: "por subtipo",
  velocidad: "por velocidad",
  tipo_saque: "por tipo de saque",
  variante: "por variante",
  cambio: "por cambio",
};

const ETIQ_METRICA: Record<string, string> = {
  kill_pct: "kill %",
  attack_efficiency: "eficiencia de ataque",
  hitting_pct: "hitting %",
  sideout_pct: "side-out %",
  break_point_pct: "break point %",
  reception_pct: "calidad de recepción",
  ace_pct: "ace %",
  serve_error_pct: "error de saque %",
  block_efficiency: "eficiencia de bloqueo",
  dig_efficiency: "eficiencia de defensa",
  puntos_por_set: "puntos por set",
  puntos_por_rotacion: "puntos por rotación",
};

const ETIQ_TIEMPO: Record<string, string> = {
  ultimos_n_partidos: "últimos partidos",
  ultimos_n_sets: "últimos sets",
  ultimos_n_jugadas: "últimas jugadas",
  esta_temporada: "esta temporada",
  esta_semana: "esta semana",
  este_mes: "este mes",
  este_ano: "este año",
  temporada_pasada: "temporada pasada",
  dia_semana: "día de la semana",
  partido_especifico: "partido específico",
  set_especifico: "set específico",
  punto_especifico: "punto específico",
};

// ------------------------------------------------------------
// COMPONENTE
// ------------------------------------------------------------

export default function PanelBusqueda({
  acciones,
  config,
  setConfig,
  jugadoresParaDropdown,
  partidosDisponibles,
}: Props) {
  const [texto, setTexto] = useState("");
  const [verDatosDelJugador, setVerDatosDelJugador] = useState(true);

  void acciones;

  const parseResult: ResultadoParser = useMemo(
    () =>
      parsearBusqueda(texto, {
        jugadores: jugadoresParaDropdown,
        partidos: partidosDisponibles,
      }),
    [texto, jugadoresParaDropdown, partidosDisponibles]
  );

  // FASE 7.4 — si es ambiguo, `filtro.jugadorId` ya viene null
  // (el parser no asigna un jugador único). Lo dejamos explícito
  // para que el checkbox de "Ver datos del mismo jugador" no
  // aparezca y para no filtrar por jugador por accidente.
  const jugadorDetectadoId = parseResult.jugadorAmbiguo
    ? null
    : parseResult.filtro.jugadorId ?? null;

  const aplicar = () => {
    if (!parseResult.aplicado) return;
    if (parseResult.jugadorAmbiguo) return; // defensa extra: no aplicar si es ambiguo

    const nuevoBloque = {
      id: generarIdBloque(),
      operador: "AND" as const,
      filtro: parseResult.filtro,
    };

    let nuevoJugadorObservadoFiltro = config.jugadorObservadoFiltro;
    if (jugadorDetectadoId && verDatosDelJugador) {
      nuevoJugadorObservadoFiltro = "mismo";
    } else if (parseResult.relacionObservadoSugerido) {
      nuevoJugadorObservadoFiltro = parseResult.relacionObservadoSugerido;
    }

    const nuevoTipoObservado =
      parseResult.tipoObservadoSugerido ?? config.tipoObservado;

    setConfig({
      ...config,
      bloques: [nuevoBloque],
      jugadorObservadoFiltro: nuevoJugadorObservadoFiltro,
      tipoObservado: nuevoTipoObservado,
    });
  };

  const limpiar = () => setTexto("");

  // v3: narrow explícito para que TS sepa que no es "cualquiera"
  const tipoObservadoSugeridoSeguro: TipoDisparador | null =
    parseResult.tipoObservadoSugerido !== null &&
    parseResult.tipoObservadoSugerido !== "cualquiera"
      ? parseResult.tipoObservadoSugerido
      : null;

  const relacionObservadoSugeridoSeguro: RelacionJugadorObservado | null =
    parseResult.relacionObservadoSugerido;

  const haySecuencia =
    tipoObservadoSugeridoSeguro !== null ||
    relacionObservadoSugeridoSeguro !== null ||
    parseResult.faseRallySugerida !== null;

  // v4: chips de intención analítica
  const intencion = parseResult.intencion;
  const hayIntencion = intencion.tipo !== "unknown";
  const hayGroupBy = intencion.groupBy !== null;
  const hayMetrica = intencion.metrica !== null;
  const hayTiempo = intencion.tiempo !== null;
  const hayCondicion =
    intencion.condicion !== null &&
    Object.keys(intencion.condicion).length > 0;

  // Botón "Aplicar": además de requerir `aplicado`, no se puede
  // apretar si el jugador es ambiguo.
  const puedeAplicar =
    parseResult.aplicado && !parseResult.jugadorAmbiguo;

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30">
          🔍 Buscar
        </span>
        <span className="text-[10px] text-slate-400">
          escribí la jugada en lenguaje natural
        </span>
      </div>

      <div className="flex gap-1.5">
        <input
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") aplicar();
          }}
          placeholder='Ej: "ataques de Juan después de errar", "porcentaje de recepciones perfectas por set esta temporada"'
          className="flex-1 bg-slate-900 text-white text-[11px] rounded px-2.5 py-1.5 border border-white/10 focus:outline-none focus:border-slate-400 placeholder:text-slate-600"
        />
        {texto && (
          <button
            onClick={limpiar}
            className="text-[10px] px-2 py-1 rounded border border-white/10 text-slate-300 hover:text-white hover:bg-white/5"
            title="Limpiar"
          >
            ✕
          </button>
        )}
        <button
          onClick={aplicar}
          disabled={!puedeAplicar}
          className={`text-[10px] font-bold px-2.5 py-1 rounded border transition shrink-0 ${
            puedeAplicar
              ? "bg-emerald-500/20 text-emerald-200 border-emerald-400/60 hover:bg-emerald-500/30"
              : "bg-white/5 text-slate-500 border-white/10 cursor-not-allowed"
          }`}
          title={
            parseResult.jugadorAmbiguo
              ? "Desambiguá el jugador antes de aplicar"
              : !parseResult.aplicado
              ? "La consulta no está lista"
              : "Aplicar filtro"
          }
        >
          Aplicar
        </button>
      </div>

      {/* ============================================ */}
      {/* FASE 7.4 — JUGADOR AMBIGUO                    */}
      {/* ============================================ */}
      {parseResult.jugadorAmbiguo && parseResult.jugadorAviso && (
        <div className="rounded border border-rose-500/40 bg-rose-500/10 p-2 space-y-1">
          <p className="text-[10px] font-bold text-rose-200">
            ⚠️ Jugador ambiguo
          </p>
          <p className="text-[10px] text-rose-100 leading-snug">
            {parseResult.jugadorAviso}
          </p>
          {parseResult.jugadorCandidatos.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {parseResult.jugadorCandidatos.map((j) => (
                <span
                  key={j.id}
                  className="text-[10px] px-1.5 py-0.5 rounded border border-rose-500/40 bg-rose-500/10 text-rose-200 font-mono"
                  title={`ID: ${j.id}`}
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
          <p className="text-[9px] text-rose-200/70 italic">
            Probá con nombre completo, apodo o #número (ej: &quot;Joaco&quot;,
            &quot;Joaquín Pérez&quot;, &quot;#7&quot;).
          </p>
        </div>
      )}

      {parseResult.matches.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {parseResult.matches.map((m, i) => (
            <span
              key={`${m.clave}-${i}`}
              className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${CATEGORIA_COLOR[m.categoria]}`}
              title={m.fragmento}
            >
              {m.clave === "tipo"
                ? etiquetaTipoDisparador(m.valor as TipoDisparador)
                : m.clave === "resultado"
                ? etiquetaResultado(m.valor)
                : m.clave === "jugador"
                ? m.valor
                : m.clave === "contexto.cierre"
                ? `cierre ${m.valor}`
                : m.clave === "contexto.critico"
                ? "crítico"
                : m.clave === "contexto.fase"
                ? m.valor
                : m.clave === "contexto.posicion"
                ? `${m.valor} punto`
                : m.clave === "previa"
                ? `previa ${m.valor}`
                : m.clave === "top"
                ? m.valor
                : m.clave === "vs-promedio"
                ? m.valor === "por_encima"
                  ? "sobre promedio"
                  : "bajo promedio"
                : m.clave === "velocidad"
                ? `v${m.valor}`
                : m.clave === "tipo-saque"
                ? `saque ${m.valor}`
                : m.clave === "rol"
                ? `rol ${m.valor}`
                : m.clave === "racha-jugador"
                ? m.valor
                : m.clave === "llamada"
                ? `llamada: ${etiquetaLlamadaInferida(m.valor)}`
                : m.clave === "toque-segunda"
                ? `toque 2ª: ${m.valor}`
                : m.clave === "recepcion.zonaDestino"
                ? `destino Z${m.valor}`
                : m.clave === "recepcion.zonaOrigen"
                ? `origen Z${m.valor}`
                : m.clave === "recepcion.columna"
                ? `col: ${m.valor}`
                : m.clave === "secuencia.tipoObservado"
                ? `sig.: ${etiquetaTipoDisparador(
                    m.valor as TipoDisparador
                  )}`
                : m.clave === "secuencia.relacionObservado"
                ? `sujeto: ${
                    m.valor === "rival"
                      ? "rival"
                      : m.valor === "companero"
                      ? "compañero"
                      : "mismo"
                  }`
                : m.clave === "secuencia.faseRally"
                ? `fase: ${m.valor}`
                : `${m.clave}: ${m.valor}`}
            </span>
          ))}
        </div>
      )}

      {/* ============================================ */}
      {/* v4: INTENCIÓN ANALÍTICA DETECTADA             */}
      {/* ============================================ */}
      {hayIntencion && (
        <div className="rounded border border-cyan-500/30 bg-cyan-500/[0.08] p-2 space-y-1">
          <p className="text-[10px] font-bold text-cyan-200">
            📊 Intención analítica detectada
          </p>
          <div className="flex flex-wrap gap-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded border font-semibold bg-cyan-500/25 text-cyan-100 border-cyan-400/60">
              {ETIQ_TIPO_INTENCION[intencion.tipo] ?? intencion.tipo}
            </span>
            {hayMetrica && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded border font-semibold bg-emerald-500/20 text-emerald-200 border-emerald-400/50"
                title="Métrica de vóley detectada"
              >
                {ETIQ_METRICA[intencion.metrica!] ?? intencion.metrica}
              </span>
            )}
            {hayGroupBy && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded border font-semibold bg-violet-500/20 text-violet-200 border-violet-400/50"
                title="Agrupación detectada"
              >
                {ETIQ_GROUPBY[intencion.groupBy!] ?? intencion.groupBy}
              </span>
            )}
            {hayTiempo && intencion.tiempo && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded border font-semibold bg-amber-500/20 text-amber-200 border-amber-400/50"
                title="Ventana temporal detectada"
              >
                {ETIQ_TIEMPO[intencion.tiempo.tipo] ?? intencion.tiempo.tipo}
                {intencion.tiempo.n ? ` (${intencion.tiempo.n})` : ""}
                {intencion.tiempo.diaSemana
                  ? ` (${intencion.tiempo.diaSemana})`
                  : ""}
                {intencion.tiempo.set ? ` · set ${intencion.tiempo.set}` : ""}
                {intencion.tiempo.punto
                  ? ` · punto ${intencion.tiempo.punto}`
                  : ""}
              </span>
            )}
            {intencion.ordenamiento && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded border font-semibold bg-slate-500/20 text-slate-200 border-slate-400/50"
                title="Orden detectado"
              >
                {intencion.ordenamiento === "asc" ? "↑ asc" : "↓ desc"}
              </span>
            )}
            {intencion.limite !== null && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded border font-semibold bg-slate-500/20 text-slate-200 border-slate-400/50"
                title="Límite detectado"
              >
                top {intencion.limite}
              </span>
            )}
            {intencion.comparacion && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded border font-semibold bg-pink-500/20 text-pink-200 border-pink-400/50"
                title="Comparación detectada"
              >
                {intencion.comparacion.a} vs {intencion.comparacion.b}
              </span>
            )}
            {hayCondicion && intencion.condicion && (
              <>
                {intencion.condicion.marcador && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded border font-semibold bg-slate-500/20 text-slate-200 border-slate-400/50"
                    title="Marcador detectado"
                  >
                    {intencion.condicion.marcador}
                  </span>
                )}
                {intencion.condicion.diferencia !== undefined && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded border font-semibold bg-slate-500/20 text-slate-200 border-slate-400/50"
                    title="Diferencia detectada"
                  >
                    dif {intencion.condicion.diferencia}
                  </span>
                )}
                {intencion.condicion.puntoCritico && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded border font-semibold bg-amber-500/20 text-amber-200 border-amber-400/50"
                  >
                    crítico
                  </span>
                )}
                {intencion.condicion.rachaMinima !== undefined && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded border font-semibold bg-rose-500/20 text-rose-200 border-rose-400/50"
                  >
                    racha ≥ {intencion.condicion.rachaMinima}
                  </span>
                )}
                {intencion.condicion.fase && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded border font-semibold bg-violet-500/20 text-violet-200 border-violet-400/50"
                  >
                    {intencion.condicion.fase}
                  </span>
                )}
                {intencion.condicion.toquesMinimos !== undefined && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded border font-semibold bg-slate-500/20 text-slate-200 border-slate-400/50"
                  >
                    ≥ {intencion.condicion.toquesMinimos} toques
                  </span>
                )}
                {intencion.condicion.calidadArmado !== undefined && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded border font-semibold bg-slate-500/20 text-slate-200 border-slate-400/50"
                  >
                    armado {intencion.condicion.calidadArmado}
                  </span>
                )}
                {intencion.condicion.conErrorPrevio && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded border font-semibold bg-rose-500/20 text-rose-200 border-rose-400/50">
                    tras error
                  </span>
                )}
                {intencion.condicion.conAciertoPrevio && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded border font-semibold bg-emerald-500/20 text-emerald-200 border-emerald-400/50">
                    tras acierto
                  </span>
                )}
                {intencion.condicion.ubicacion && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded border font-semibold bg-cyan-500/20 text-cyan-200 border-cyan-400/50">
                    {intencion.condicion.ubicacion}
                  </span>
                )}
                {intencion.condicion.zonaJugador &&
                  intencion.condicion.zonaJugador.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded border font-semibold bg-cyan-500/20 text-cyan-200 border-cyan-400/50">
                      zona{" "}
                      {intencion.condicion.zonaJugador
                        .map((z) => `Z${z}`)
                        .join("|")}
                    </span>
                  )}
                {intencion.condicion.cambioEnPunto === true && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded border font-semibold bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-400/50">
                    con cambio
                  </span>
                )}
                {intencion.condicion.cambioEnPunto === false && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded border font-semibold bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-400/50">
                    sin cambio
                  </span>
                )}
                {intencion.condicion.despuesDeCambio === true && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded border font-semibold bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-400/50">
                    tras cambio
                  </span>
                )}
              </>
            )}
          </div>
          <p className="text-[9px] text-cyan-200/70 italic leading-tight">
            Solo informativo. El motor de FASE 3 usará esta intención para
            decidir qué cálculo hacer (contar, %, promedio, etc.).
          </p>
        </div>
      )}

      {haySecuencia && (
        <div className="rounded border border-pink-500/30 bg-pink-500/10 p-2 space-y-0.5">
          <p className="text-[10px] font-bold text-pink-200">
            🎯 Secuencia detectada
          </p>
          <p className="text-[10px] text-pink-200/80">
            {tipoObservadoSugeridoSeguro && (
              <>
                Se va a mirar la siguiente{" "}
                <strong>
                  {etiquetaTipoDisparador(tipoObservadoSugeridoSeguro)}
                </strong>
                {relacionObservadoSugeridoSeguro && (
                  <>
                    {" "}
                    del{" "}
                    <strong>
                      {relacionObservadoSugeridoSeguro === "rival"
                        ? "rival"
                        : relacionObservadoSugeridoSeguro === "companero"
                        ? "compañero"
                        : "mismo jugador"}
                    </strong>
                  </>
                )}
                .
              </>
            )}
            {parseResult.faseRallySugerida && (
              <>
                {" "}
                Fase del rally sugerida:{" "}
                <strong>{parseResult.faseRallySugerida}</strong>{" "}
                <span className="text-pink-200/60 italic">
                  (no se aplica automáticamente)
                </span>
                .
              </>
            )}
          </p>
        </div>
      )}

      {parseResult.noReconocidas.length > 0 && (
        <div className="flex flex-wrap gap-1 items-center">
          <span className="text-[9px] text-amber-400">⚠️ No reconocí:</span>
          {parseResult.noReconocidas.slice(0, 8).map((w, i) => (
            <span
              key={`${w}-${i}`}
              className="text-[9px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 font-mono"
            >
              {w}
            </span>
          ))}
          {parseResult.noReconocidas.length > 8 && (
            <span className="text-[9px] text-amber-400">
              +{parseResult.noReconocidas.length - 8}
            </span>
          )}
        </div>
      )}

      {jugadorDetectadoId && (
        <label className="flex items-center gap-1.5 text-[10px] text-slate-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={verDatosDelJugador}
            onChange={(e) => setVerDatosDelJugador(e.target.checked)}
            className="w-3 h-3 accent-emerald-500"
          />
          <span>
            Ver datos del mismo jugador buscado (
            {jugadoresParaDropdown.find((j) => j.id === jugadorDetectadoId)
              ?.nombre ?? "?"}
            )
          </span>
        </label>
      )}

      {!texto && (
        <div className="flex flex-wrap gap-1">
          <span className="text-[9px] text-slate-500 italic">Ejemplos:</span>
          {parseResult.sugerencias.slice(0, 4).map((sug, i) => (
            <button
              key={`${sug}-${i}`}
              onClick={() => setTexto(sug)}
              className="text-[9px] px-1.5 py-0.5 rounded border border-white/10 text-slate-400 hover:text-white hover:bg-white/5"
            >
              {sug}
            </button>
          ))}
        </div>
      )}

      {texto && !parseResult.aplicado && !parseResult.jugadorAmbiguo && (
        <div className="rounded border border-amber-500/30 bg-amber-500/10 p-2 space-y-1">
          <p className="text-[10px] font-bold text-amber-200">
            No encontrado. Reformulá o probá con:
          </p>
          <ol className="text-[10px] text-amber-200/80 list-decimal pl-4 space-y-0.5">
            {parseResult.sugerencias.slice(0, 3).map((s, i) => (
              <li key={`${s}-${i}`}>
                <button
                  onClick={() => setTexto(s)}
                  className="hover:text-white underline-offset-2 hover:underline"
                >
                  {s}
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}