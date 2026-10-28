"use client";

import { useMemo, useState } from "react";
import type { AccionDB } from "@/lib/db";
import {
  VALORES_POR_FUNDAMENTO,
  calcularEstadisticasEquipo,
} from "@/lib/estadisticas";
import { zonaCrudaDeCelda } from "@/lib/mapeoV2";
import type { AccionVisual } from "./adaptadorUnificadoV2";
import AnalisisConsecuencias from "./AnalisisConsecuencias";

// ============================================================
// TIPOS DE COLUMNA / BLOQUE
// ============================================================

interface Columna {
  key: string;
  label: string;
  tipo: "pos" | "neg" | "neu";
  detalle?: string;
}

interface Bloque {
  id: string;
  titulo: string;
  subtitulo?: string;
  columnas: Columna[];
  valores: Record<string, number>;
  incluye: (a: AccionDB) => boolean;
  columnaDe: (a: AccionDB) => string | null;
}

// ============================================================
// ADAPTER: AccionDB[] → AccionVisual[]
// (para el panel de Análisis de consecuencias)
// ============================================================

function accionesDBaVisualParaAnalisis(
  acciones: AccionDB[]
): AccionVisual[] {
  const contadorPorPunto = new Map<string, number>();
  return acciones.map((a) => {
    const k = `${a.set_numero}-${a.punto_numero ?? 0}`;
    const orden = (contadorPorPunto.get(k) ?? 0) + 1;
    contadorPorPunto.set(k, orden);

    const tipo = a.fundamento === "armados" ? "armado" : a.fundamento;

    const zonaOrigen =
      a.origen_celda && /^F[1-3]-/.test(a.origen_celda)
        ? zonaCrudaDeCelda(a.origen_celda)
        : null;
    const zonaDestino =
      a.destino_celda && /^F[1-3]-/.test(a.destino_celda)
        ? zonaCrudaDeCelda(a.destino_celda)
        : null;

    return {
      id: `${a.jugador_id}|${a.set_numero}|${a.punto_numero ?? 0}|${orden}`,
      partido_id: a.partido_id ?? "",
      set_numero: a.set_numero,
      punto_numero: a.punto_numero ?? 0,
      orden,
      tipo,
      subtipo: a.subtipo_original ?? a.valoracion,
      es_rival: false,
      jugador_id: a.jugador_id,
      lado: "propio",
      equipo_id: null,
      origen_celda: a.origen_celda ?? null,
      origen_mini: a.origen_mini ?? null,
      destino_celda: a.destino_celda ?? null,
      destino_mini: a.destino_mini ?? null,
      desvios: [],
      variante: a.variante ?? null,
      tipo_saque: a.tipo_saque ?? null,
      velocidad: a.velocidad ?? null,
      x2: false,
      oculta: false,
      posicion_inicial_celda: a.posicion_inicial_celda ?? null,
      posicion_inicial_mini: a.posicion_inicial_mini ?? null,
      es_error: false,
      zona_origen: zonaOrigen,
      zona_destino: zonaDestino,
      rotacion_numero: null,
      rol_jugador: null,
      zona_jugador: null,
      origen_x: null,
      origen_y: null,
      destino_x: null,
      destino_y: null,
      posicion_inicial_x: null,
      posicion_inicial_y: null,
      zona_origen_codigo: null,
      zona_destino_codigo: null,
      subtipo_real: null,
      es_ultima_del_punto: false,
      calidad_armado_previo: null,
    };
  });
}

// ============================================================
// COLUMNAS POR FUNDAMENTO
// ============================================================

const COLS_SAQUE: Columna[] = [
  { key: "ace", label: "Ace", tipo: "pos" },
  { key: "positivo_mas", label: "Pos+", tipo: "pos" },
  { key: "positivo", label: "Pos", tipo: "pos" },
  { key: "neutro", label: "Neu", tipo: "neu" },
  { key: "negativo", label: "Neg", tipo: "neg" },
];

// Recepción — sistema nuevo de 7 valores
const COLS_RECEPCION: Columna[] = [
  { key: "perfecta", label: "R#", tipo: "pos", detalle: "Doble positiva / perfecta" },
  { key: "positiva", label: "R+", tipo: "pos", detalle: "Positiva" },
  { key: "intermedia", label: "R!", tipo: "neu", detalle: "Exclamación (anula ataque central)" },
  { key: "negativa", label: "R-", tipo: "neg", detalle: "Negativa" },
  { key: "doble_negativa", label: "R--", tipo: "neg", detalle: "Doble negativa (free ball)" },
  { key: "overpass", label: "R/", tipo: "neg", detalle: "Overpass (pasa al rival)" },
  { key: "error_directo", label: "R=", tipo: "neg", detalle: "Ace / error directo" },
];

const COLS_ATAQUE: Columna[] = [
  { key: "punto", label: "Punto", tipo: "pos" },
  { key: "neutro", label: "Neu", tipo: "neu" },
  { key: "error", label: "Error", tipo: "neg" },
];

const COLS_BLOQUEO_NORMAL: Columna[] = [
  { key: "punto", label: "Punto", tipo: "pos" },
  { key: "positivo_mas", label: "Pos+", tipo: "pos" },
  { key: "positivo", label: "Pos", tipo: "pos" },
  { key: "use_rival", label: "UseR", tipo: "neg" },
  { key: "red", label: "Red", tipo: "neg" },
  { key: "filtrada", label: "Filt", tipo: "neg" },
];

const COLS_BLOQUEO_AMPLIADO: Columna[] = [
  { key: "punto", label: "Pto", tipo: "pos", detalle: "Cae en cancha rival, directo" },
  { key: "pos_mas_r", label: "Pos+R", tipo: "pos", detalle: "Cae en cancha rival, con libre después" },
  { key: "pos_r", label: "Pos R", tipo: "pos", detalle: "Cae en cancha rival, sin libre" },
  { key: "pos_mas_p", label: "Pos+P", tipo: "pos", detalle: "Cae en cancha propia, con libre después" },
  { key: "neu_p", label: "Neu P", tipo: "neu", detalle: "Cae en cancha propia, sin libre" },
  { key: "use_rival", label: "UseR", tipo: "neg", detalle: "Desviada afuera" },
  { key: "red", label: "Red", tipo: "neg", detalle: "Toca la red" },
  { key: "filtrada", label: "Filt", tipo: "neg", detalle: "Cae en bloqueo lateral" },
];

const VALORES_BLOQUEO_AMPLIADO: Record<string, number> = {
  punto: 10,
  pos_mas_r: 8,
  pos_r: 6,
  pos_mas_p: 8,
  neu_p: 5,
  use_rival: 3,
  red: 0,
  filtrada: 2,
};

const COLS_DEFENSA: Columna[] = [
  { key: "toque_positiva", label: "Toq+", tipo: "pos" },
  { key: "gran_def", label: "GranD", tipo: "pos" },
  { key: "cobertura_positiva", label: "Cob+", tipo: "pos" },
  { key: "toque_negativa", label: "Toq-", tipo: "neg" },
  { key: "cobertura_negativa", label: "Cob-", tipo: "neg" },
  { key: "error_def", label: "ErrD", tipo: "neg" },
  { key: "errores_graves", label: "ErrG", tipo: "neg" },
  { key: "mala_libre", label: "MalaL", tipo: "neg" },
];

const COLS_ARMADOS: Columna[] = [
  { key: "perfecto", label: "Perf", tipo: "pos" },
  { key: "correcto", label: "Corr", tipo: "pos" },
  { key: "flojo", label: "Flojo", tipo: "neu" },
  { key: "malo", label: "Malo", tipo: "neg" },
  { key: "horrible", label: "Horr", tipo: "neg" },
];

const COLS_TOQUE: Columna[] = [
  { key: "punto", label: "Punto", tipo: "pos" },
  { key: "neutro", label: "Neu", tipo: "neu" },
  { key: "error", label: "Error", tipo: "neg" },
];

const COLS_ATAQUE_AMPLIADO: Columna[] = [
  { key: "punto_directo_ataque", label: "Pto dir", tipo: "pos", detalle: "Punto directo, sin toque rival" },
  { key: "punto_desviado_ataque", label: "Pto desv", tipo: "pos", detalle: "Punto con desvío (bloqueo rival)" },
  { key: "use_rival_ataque", label: "UseRiv", tipo: "pos", detalle: "Use rival (cae afuera)" },
  { key: "gorro_ataque", label: "Gorro", tipo: "neg", detalle: "Gorro (bloqueo rival devuelve)" },
  { key: "error_afuera_ataque", label: "Err af", tipo: "neg", detalle: "Error afuera" },
  { key: "error_red_ataque", label: "Err red", tipo: "neg", detalle: "Error red" },
  { key: "neutro_bloqueo_cobertura_ataque", label: "Neu b+c", tipo: "neu", detalle: "Neutro: bloqueo + cobertura" },
  { key: "neutro_desvio_bloqueo_defensa_ataque", label: "Neu d+d", tipo: "neu", detalle: "Neutro: desvío + defensa" },
  { key: "neutro_defensa_ataque", label: "Neu def", tipo: "neu", detalle: "Neutro: defensa rival" },
  { key: "punto", label: "Punto (v)", tipo: "pos", detalle: "Punto (formato viejo)" },
  { key: "neutro", label: "Neu (v)", tipo: "neu", detalle: "Neutro (formato viejo)" },
  { key: "error", label: "Err (v)", tipo: "neg", detalle: "Error (formato viejo)" },
];

// ============================================================
// NOMBRES Y HELPERS
// ============================================================

const NOMBRES_FUNDAMENTO: Record<string, string> = {
  saque: "Saque",
  recepcion: "Recepción",
  ataque: "Ataque",
  bloqueo: "Bloqueo",
  defensa: "Defensa",
  armados: "Armados",
  toque: "Toque",
};

const ORDEN_FUNDAMENTOS = [
  "saque",
  "recepcion",
  "ataque",
  "bloqueo",
  "defensa",
  "armados",
  "toque",
];

function obtenerColumnas(fund: string): Columna[] {
  switch (fund) {
    case "saque":
      return COLS_SAQUE;
    case "recepcion":
      return COLS_RECEPCION;
    case "ataque":
      return COLS_ATAQUE;
    case "bloqueo":
      return COLS_BLOQUEO_NORMAL;
    case "defensa":
      return COLS_DEFENSA;
    case "armados":
      return COLS_ARMADOS;
    case "toque":
      return COLS_TOQUE;
    default:
      return [];
  }
}

function colorHeaderTipo(tipo: "pos" | "neg" | "neu"): string {
  if (tipo === "pos") return "#34D399";
  if (tipo === "neg") return "#F87171";
  return "var(--sx-text-secondary)";
}

function claseValorCelda(tipo: "pos" | "neg" | "neu", valor: number): string {
  if (valor === 0) return "text-slate-700";
  if (tipo === "pos") return "text-emerald-400 font-semibold";
  if (tipo === "neg") return "text-rose-400 font-semibold";
  return "text-slate-300";
}

function zonaDeCelda(celda: string | null | undefined): number | null {
  if (!celda) return null;
  switch (celda) {
    case "F1-C1":
    case "F1-C2":
      return 4;
    case "F1-C3":
      return 3;
    case "F1-C4":
    case "F1-C5":
      return 2;
    case "F2-C3":
    case "F3-C3":
      return 6;
    case "F2-C4":
    case "F2-C5":
    case "F3-C4":
    case "F3-C5":
      return 2;
    default:
      return null;
  }
}

const labelCls =
  "block text-[10px] font-semibold uppercase mb-1 tracking-wide";

// ============================================================
// CONSTRUCCIÓN DE BLOQUES
// ============================================================

function construirBloques(
  fundamentosVisibles: string[],
  ampliado: boolean
): Bloque[] {
  const bloques: Bloque[] = [];

  for (const fund of fundamentosVisibles) {
    if (fund === "saque") {
      if (!ampliado) {
        bloques.push({
          id: "saque",
          titulo: "Saque",
          columnas: COLS_SAQUE,
          valores: VALORES_POR_FUNDAMENTO.saque ?? {},
          incluye: (a) => a.fundamento === "saque",
          columnaDe: (a) => a.valoracion,
        });
      } else {
        bloques.push({
          id: "saque-flotado",
          titulo: "Saque — Flotado",
          columnas: COLS_SAQUE,
          valores: VALORES_POR_FUNDAMENTO.saque ?? {},
          incluye: (a) =>
            a.fundamento === "saque" && a.tipo_saque === "flotado",
          columnaDe: (a) => a.valoracion,
        });
        bloques.push({
          id: "saque-potencia",
          titulo: "Saque — Potencia",
          columnas: COLS_SAQUE,
          valores: VALORES_POR_FUNDAMENTO.saque ?? {},
          incluye: (a) =>
            a.fundamento === "saque" && a.tipo_saque === "potencia",
          columnaDe: (a) => a.valoracion,
        });
      }
      continue;
    }

    if (fund === "ataque") {
      if (!ampliado) {
        bloques.push({
          id: "ataque",
          titulo: "Ataque",
          columnas: COLS_ATAQUE,
          valores: VALORES_POR_FUNDAMENTO.ataque ?? {},
          incluye: (a) => a.fundamento === "ataque",
          columnaDe: (a) => a.valoracion,
        });
      } else {
        const columnasAtaque = COLS_ATAQUE_AMPLIADO;
        const esRemate = (a: AccionDB) =>
          a.fundamento === "ataque" && a.variante !== "toque";
        const esToque = (a: AccionDB) =>
          a.fundamento === "ataque" && a.variante === "toque";

        const columnaAtaqueDe = (a: AccionDB): string | null => {
          const s = a.subtipo_original ?? a.valoracion;
          if (columnasAtaque.some((c) => c.key === s)) return s;
          return null;
        };

        bloques.push({
          id: "ataque-remate",
          titulo: "Ataque — Remate",
          columnas: columnasAtaque,
          valores: VALORES_POR_FUNDAMENTO.ataque ?? {},
          incluye: esRemate,
          columnaDe: columnaAtaqueDe,
        });
        bloques.push({
          id: "ataque-toque",
          titulo: "Ataque — Toque",
          columnas: columnasAtaque,
          valores: VALORES_POR_FUNDAMENTO.ataque ?? {},
          incluye: esToque,
          columnaDe: columnaAtaqueDe,
        });
      }
      continue;
    }

    if (fund === "bloqueo") {
      if (!ampliado) {
        bloques.push({
          id: "bloqueo",
          titulo: "Bloqueo",
          columnas: COLS_BLOQUEO_NORMAL,
          valores: VALORES_POR_FUNDAMENTO.bloqueo ?? {},
          incluye: (a) => a.fundamento === "bloqueo",
          columnaDe: (a) => a.valoracion,
        });
      } else {
        bloques.push({
          id: "bloqueo-ampliado",
          titulo: "Bloqueo — desglosado",
          subtitulo: "Según dónde cae el balón",
          columnas: COLS_BLOQUEO_AMPLIADO,
          valores: VALORES_BLOQUEO_AMPLIADO,
          incluye: (a) => a.fundamento === "bloqueo",
          columnaDe: (a) => {
            const val = a.valoracion;
            const dest = a.destino_celda ?? "";
            if (val === "punto") return "punto";
            if (val === "use_rival") return "use_rival";
            if (val === "red") return "red";
            if (val === "filtrada") return "filtrada";
            if (val === "positivo_mas")
              return /^F[123]-/.test(dest) ? "pos_mas_p" : "pos_mas_r";
            if (val === "positivo") return "pos_r";
            if (val === "neutro") return "neu_p";
            return null;
          },
        });
      }
      continue;
    }

    if (fund === "armados") {
      if (!ampliado) {
        bloques.push({
          id: "armados",
          titulo: "Armados",
          columnas: COLS_ARMADOS,
          valores: VALORES_POR_FUNDAMENTO.armados ?? {},
          incluye: (a) => a.fundamento === "armados",
          columnaDe: (a) => a.valoracion,
        });
      } else {
        const zonas: { zona: number; label: string }[] = [
          { zona: 4, label: "Zona 4" },
          { zona: 3, label: "Zona 3" },
          { zona: 2, label: "Zona 2" },
          { zona: 6, label: "Zona 6" },
          { zona: 1, label: "Zona 1" },
        ];
        for (const z of zonas) {
          bloques.push({
            id: `armados-zona-${z.zona}`,
            titulo: `Armados — ${z.label}`,
            subtitulo: "Agrupado por zona de destino",
            columnas: COLS_ARMADOS,
            valores: VALORES_POR_FUNDAMENTO.armados ?? {},
            incluye: (a) =>
              a.fundamento === "armados" &&
              zonaDeCelda(a.destino_celda) === z.zona,
            columnaDe: (a) => a.valoracion,
          });
        }
        const velocidades: { v: number | null; label: string }[] = [
          { v: 1, label: "Velocidad 1" },
          { v: 1.5, label: "Velocidad 1.5" },
          { v: 2, label: "Velocidad 2" },
          { v: 3, label: "Velocidad 3" },
          { v: 5, label: "Velocidad 5" },
          { v: null, label: "Sin velocidad" },
        ];
        for (const ve of velocidades) {
          bloques.push({
            id: `armados-vel-${ve.v ?? "sin"}`,
            titulo: `Armados — ${ve.label}`,
            subtitulo: "Agrupado por velocidad elegida",
            columnas: COLS_ARMADOS,
            valores: VALORES_POR_FUNDAMENTO.armados ?? {},
            incluye: (a) =>
              a.fundamento === "armados" &&
              (ve.v === null
                ? a.velocidad === null || a.velocidad === undefined
                : a.velocidad === ve.v),
            columnaDe: (a) => a.valoracion,
          });
        }
      }
      continue;
    }

    const columnas =
      fund === "recepcion"
        ? COLS_RECEPCION
        : fund === "defensa"
        ? COLS_DEFENSA
        : COLS_TOQUE;

    bloques.push({
      id: fund,
      titulo: NOMBRES_FUNDAMENTO[fund] ?? fund,
      columnas,
      valores: VALORES_POR_FUNDAMENTO[fund] ?? {},
      incluye: (a) => a.fundamento === fund,
      columnaDe: (a) => a.valoracion,
    });
  }

  return bloques;
}

// ============================================================
// PROPS
// ============================================================

interface Props {
  acciones: AccionDB[];
  jugadoresIds: string[];
  nombresJugadores: Record<string, string>;
  armadores?: Set<string>;
  soloJugadorId?: string;
  contexto?: string;
}

// ============================================================
// COMPONENTE
// ============================================================

export default function TablaEstadisticasCrudas({
  acciones,
  jugadoresIds,
  nombresJugadores,
  armadores,
  soloJugadorId,
  contexto,
}: Props) {
  const [filtroJugador, setFiltroJugador] = useState<string>("todos");
  const [filtroFundamento, setFiltroFundamento] = useState<string>("todos");
  const [ampliado, setAmpliado] = useState(false);
  const [verConsecuencias, setVerConsecuencias] = useState(false);

  const armadoresSet = armadores ?? new Set<string>();
  const jugadoresAMostrar = soloJugadorId ? [soloJugadorId] : jugadoresIds;
  const jugadorEfectivo = soloJugadorId ? soloJugadorId : filtroJugador;

  const nombreDe = (id: string) => nombresJugadores[id] ?? id;
  const esArmadorId = (id: string) => armadoresSet.has(id);

  const accionesDetalle = useMemo(() => {
    return acciones.filter((a) => {
      if (jugadorEfectivo !== "todos" && a.jugador_id !== jugadorEfectivo)
        return false;
      if (filtroFundamento !== "todos" && a.fundamento !== filtroFundamento)
        return false;
      return true;
    });
  }, [acciones, jugadorEfectivo, filtroFundamento]);

  const accionesResumen = useMemo(() => {
    return acciones.filter((a) => {
      if (filtroFundamento !== "todos" && a.fundamento !== filtroFundamento)
        return false;
      return true;
    });
  }, [acciones, filtroFundamento]);

  const totales = useMemo(() => {
    if (jugadoresAMostrar.length === 0) return null;
    return calcularEstadisticasEquipo(
      jugadoresAMostrar,
      accionesResumen,
      armadoresSet
    ).totales;
  }, [jugadoresAMostrar, accionesResumen, armadoresSet]);

  const fundamentosVisibles = ORDEN_FUNDAMENTOS.filter((f) =>
    accionesDetalle.some(
      (a) => a.fundamento === f && jugadoresAMostrar.includes(a.jugador_id)
    )
  );

  const bloques = useMemo(
    () => construirBloques(fundamentosVisibles, ampliado),
    [fundamentosVisibles, ampliado]
  );

  // Universo para el análisis: TODAS las acciones (sin filtros locales)
  // así los comparadores prev/next ven la secuencia completa del punto.
  const accionesParaAnalisis = verConsecuencias
    ? accionesDBaVisualParaAnalisis(acciones)
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h4 className="font-semibold text-white mb-1">
            📋 Estadísticas crudas
          </h4>
          {contexto && (
            <p
              className="text-[11px] font-semibold mb-1"
              style={{ color: "#C4B5FD" }}
            >
              {contexto}
            </p>
          )}
          <p className="text-xs" style={{ color: "var(--sx-text-secondary)" }}>
            Cantidad exacta de cada valoración por jugador y promedio
            crudo (sin ponderar).
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setVerConsecuencias((v) => !v)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border-2 transition whitespace-nowrap ${
              verConsecuencias
                ? "bg-violet-500 text-white border-violet-600 hover:bg-violet-600"
                : "bg-white/5 text-violet-300 border-violet-500/40 hover:bg-violet-500/10"
            }`}
          >
            {verConsecuencias ? "🔍 Cerrar consecuencias" : "🔍 Consecuencias"}
          </button>
          <button
            onClick={() => setAmpliado((v) => !v)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border-2 transition whitespace-nowrap ${
              ampliado
                ? "bg-fuchsia-500 text-white border-fuchsia-600 hover:bg-fuchsia-600"
                : "bg-white/5 text-fuchsia-300 border-fuchsia-500/40 hover:bg-fuchsia-500/10"
            }`}
          >
            {ampliado ? "🔍 Ver resumido" : "🔍 Ver ampliado"}
          </button>
        </div>
      </div>

      {ampliado && (
        <div
          className="rounded-lg px-3 py-2 text-xs"
          style={{
            background: "rgba(124,58,237,0.12)",
            border: "1px solid rgba(124,58,237,0.3)",
            color: "#C4B5FD",
          }}
        >
          Vista ampliada: saque separado por flotado/potencia, ataque por
          remate/toque, bloqueo desglosado por dónde cae el balón, y armado
          separado por zona y por velocidad.
        </div>
      )}

      {/* ANÁLISIS DE CONSECUENCIAS */}
      {verConsecuencias && (
        <AnalisisConsecuencias
          acciones={accionesParaAnalisis}
          nombreDeJugador={(id) => (id ? nombreDe(id) : "—")}
          titulo="Análisis de consecuencias"
        />
      )}

      {/* Filtros */}
      <div
        className="rounded-xl p-3"
        style={{
          background: "var(--sx-surface-1)",
          border: "1px solid var(--sx-border)",
        }}
      >
        <div className="grid grid-cols-2 gap-2">
          {!soloJugadorId && (
            <div>
              <label
                className={labelCls}
                style={{ color: "var(--sx-text-secondary)" }}
              >
                Jugador
              </label>
              <select
                value={filtroJugador}
                onChange={(e) => setFiltroJugador(e.target.value)}
                className="input-dark text-xs"
              >
                <option value="todos">Todos</option>
                {jugadoresIds.map((id) => (
                  <option key={id} value={id}>
                    {nombreDe(id)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label
              className={labelCls}
              style={{ color: "var(--sx-text-secondary)" }}
            >
              Fundamento
            </label>
            <select
              value={filtroFundamento}
              onChange={(e) => setFiltroFundamento(e.target.value)}
              className="input-dark text-xs"
            >
              <option value="todos">Todos</option>
              {ORDEN_FUNDAMENTOS.map((f) => (
                <option key={f} value={f}>
                  {NOMBRES_FUNDAMENTO[f]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-[10px] mt-2" style={{ color: "var(--sx-text-muted)" }}>
          {accionesDetalle.length} acción
          {accionesDetalle.length !== 1 ? "es" : ""} con los filtros
          actuales
        </p>
      </div>

      {totales && (
        <div
          className="rounded-2xl p-3 sm:p-5 overflow-x-auto"
          style={{
            background: "var(--sx-surface-1)",
            border: "1px solid var(--sx-border)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
          }}
        >
          <h5 className="font-semibold text-white mb-3 text-sm">
            Resumen del equipo (sin filtro de jugador)
          </h5>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr
                className="text-left text-[11px] font-bold uppercase tracking-wider"
                style={{
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  color: "var(--sx-text-secondary)",
                }}
              >
                <th className="py-2.5 px-3">Fundamento</th>
                <th className="py-2.5 px-3 text-right">Total</th>
                <th
                  className="py-2.5 px-3 text-right"
                  style={{ color: "#34D399" }}
                >
                  Pos
                </th>
                <th
                  className="py-2.5 px-3 text-right"
                  style={{ color: "#F87171" }}
                >
                  Neg
                </th>
                <th className="py-2.5 px-3 text-right">Puntos</th>
                <th className="py-2.5 px-3 text-right">Errores</th>
                <th className="py-2.5 px-3 text-right">Saldo</th>
                <th className="py-2.5 px-3 text-right">Efect.</th>
              </tr>
            </thead>
            <tbody>
              {ORDEN_FUNDAMENTOS.map((f) => {
                const e = totales.porFundamento[f];
                if (!e || e.total === 0) return null;
                return (
                  <tr
                    key={f}
                    className="hover:bg-white/[0.02] transition-colors"
                    style={{
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                    }}
                  >
                    <td className="py-2.5 px-3 font-bold text-white">
                      {NOMBRES_FUNDAMENTO[f]}
                    </td>
                    <td
                      className="py-2.5 px-3 text-right tabular-nums font-semibold"
                      style={{ color: "var(--sx-text-primary)" }}
                    >
                      {e.total}
                    </td>
                    <td
                      className="py-2.5 px-3 text-right tabular-nums font-bold"
                      style={{ color: "#34D399" }}
                    >
                      {e.positivos}
                    </td>
                    <td
                      className="py-2.5 px-3 text-right tabular-nums font-bold"
                      style={{ color: "#F87171" }}
                    >
                      {e.negativos}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-slate-200 font-medium">
                      {e.puntos}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-slate-200 font-medium">
                      {e.errores}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right tabular-nums font-black ${
                        e.saldo > 0
                          ? "text-emerald-400"
                          : e.saldo < 0
                          ? "text-rose-400"
                          : "text-slate-400"
                      }`}
                    >
                      {e.saldo > 0 ? "+" : ""}
                      {e.saldo}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-bold text-white">
                      <span
                        className="inline-block px-2 py-0.5 rounded text-xs"
                        style={{
                          background:
                            e.efectividad >= 50
                              ? "rgba(16,185,129,0.15)"
                              : "rgba(255,255,255,0.06)",
                          color:
                            e.efectividad >= 50 ? "#34D399" : "#F0F4FF",
                        }}
                      >
                        {e.efectividad.toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
              {ORDEN_FUNDAMENTOS.every(
                (f) =>
                  !totales.porFundamento[f] ||
                  totales.porFundamento[f].total === 0
              ) && (
                <tr>
                  <td
                    colSpan={8}
                    className="py-3 text-center text-xs"
                    style={{ color: "var(--sx-text-muted)" }}
                  >
                    No hay acciones con los filtros actuales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {bloques.length === 0 ? (
        <div
          className="p-6 text-center text-sm"
          style={{ color: "var(--sx-text-secondary)" }}
        >
          No hay acciones para mostrar
        </div>
      ) : (
        <div className="space-y-4">
          {bloques.map((bloque) => {
            const cols = bloque.columnas;

            const porJugador: Record<string, Record<string, number>> = {};
            for (const jid of jugadoresAMostrar) {
              const fila: Record<string, number> = {};
              for (const c of cols) fila[c.key] = 0;
              porJugador[jid] = fila;
            }
            const totalesBloque: Record<string, number> = {};
            for (const c of cols) totalesBloque[c.key] = 0;

            let totalAccionesBloque = 0;

            for (const a of accionesDetalle) {
              if (!bloque.incluye(a)) continue;
              if (!jugadoresAMostrar.includes(a.jugador_id)) continue;
              const colKey = bloque.columnaDe(a);
              if (!colKey) continue;
              if (!(colKey in porJugador[a.jugador_id])) continue;
              porJugador[a.jugador_id][colKey] += a.cantidad;
              totalesBloque[colKey] += a.cantidad;
              totalAccionesBloque += a.cantidad;
            }

            if (totalAccionesBloque === 0) return null;

            const jugadoresConDatos = jugadoresAMostrar.filter((jid) =>
              cols.some((c) => porJugador[jid][c.key] > 0)
            );

            const calcularTotal = (fila: Record<string, number>) =>
              cols.reduce((s, c) => s + fila[c.key], 0);

            const calcularPromedioCrudo = (fila: Record<string, number>) => {
              const total = calcularTotal(fila);
              if (total === 0) return 0;
              let suma = 0;
              for (const c of cols) {
                const v = bloque.valores[c.key] ?? 0;
                suma += v * fila[c.key];
              }
              return suma / total;
            };

            const totalTodas = calcularTotal(totalesBloque);
            const promTotal = calcularPromedioCrudo(totalesBloque);

            return (
              <div
                key={bloque.id}
                className="overflow-hidden"
                style={{
                  background: "var(--sx-surface-1)",
                  border: "1px solid var(--sx-border)",
                  borderRadius: "1rem",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                }}
              >
                <div
                  className="px-4 py-3 flex items-center justify-between"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    borderBottom: "1px solid var(--sx-border)",
                  }}
                >
                  <div>
                    <h5 className="font-semibold text-white">
                      {bloque.titulo}
                    </h5>
                    {bloque.subtitulo && (
                      <p
                        className="text-[10px] italic"
                        style={{ color: "var(--sx-text-muted)" }}
                      >
                        {bloque.subtitulo}
                      </p>
                    )}
                  </div>
                  <span
                    className="text-xs"
                    style={{ color: "var(--sx-text-secondary)" }}
                  >
                    {totalTodas} acción{totalTodas !== 1 ? "es" : ""}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr
                        className="text-left text-[11px] font-bold uppercase tracking-wider"
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.08)",
                          color: "var(--sx-text-secondary)",
                        }}
                      >
                        <th className="py-2.5 px-3">Jugador</th>
                        {cols.map((c) => (
                          <th
                            key={c.key}
                            className="py-2.5 px-2 text-center"
                            style={{ color: colorHeaderTipo(c.tipo) }}
                            title={c.detalle}
                          >
                            {c.label}
                          </th>
                        ))}
                        <th className="py-2.5 px-3 text-right">Total</th>
                        <th className="py-2.5 px-3 text-right">Prom. crudo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jugadoresConDatos.map((jid) => {
                        const fila = porJugador[jid];
                        const total = calcularTotal(fila);
                        const prom = calcularPromedioCrudo(fila);
                        return (
                          <tr
                            key={jid}
                            className="hover:bg-white/[0.02] transition-colors"
                            style={{
                              borderBottom: "1px solid rgba(255,255,255,0.04)",
                            }}
                          >
                            <td className="py-2 px-3 font-bold text-white">
                              {nombreDe(jid)}
                              {esArmadorId(jid) && (
                                <span
                                  className="ml-1 text-[10px] font-medium"
                                  style={{ color: "#C4B5FD" }}
                                >
                                  (Arm)
                                </span>
                              )}
                            </td>
                            {cols.map((c) => {
                              const val = fila[c.key];
                              return (
                                <td
                                  key={c.key}
                                  className={`py-2 px-2 text-center font-mono tabular-nums ${claseValorCelda(
                                    c.tipo,
                                    val
                                  )}`}
                                  style={
                                    val === 0
                                      ? { color: "rgba(255,255,255,0.15)" }
                                      : undefined
                                  }
                                >
                                  {val}
                                </td>
                              );
                            })}
                            <td className="py-2 px-3 text-right font-semibold text-white tabular-nums">
                              {total}
                            </td>
                            <td
                              className={`py-2 px-3 text-right font-semibold tabular-nums ${
                                prom > 0
                                  ? "text-emerald-400"
                                  : prom < 0
                                  ? "text-rose-400"
                                  : "text-slate-400"
                              }`}
                            >
                              {prom > 0 ? "+" : ""}
                              {prom.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                      {jugadoresConDatos.length > 1 && (
                        <tr
                          className="font-semibold"
                          style={{
                            background: "rgba(255,255,255,0.06)",
                            borderTop: "2px solid rgba(255,255,255,0.12)",
                          }}
                        >
                          <td className="py-2 px-3 text-white">TOTAL</td>
                          {cols.map((c) => (
                            <td
                              key={c.key}
                              className={`py-2 px-2 text-center font-mono tabular-nums ${
                                c.tipo === "pos"
                                  ? "text-emerald-400 font-bold"
                                  : c.tipo === "neg"
                                  ? "text-rose-400 font-bold"
                                  : "text-slate-300"
                              }`}
                            >
                              {totalesBloque[c.key]}
                            </td>
                          ))}
                          <td className="py-2 px-3 text-right text-white tabular-nums">
                            {totalTodas}
                          </td>
                          <td
                            className={`py-2 px-3 text-right tabular-nums ${
                              promTotal > 0
                                ? "text-emerald-400"
                                : promTotal < 0
                                ? "text-rose-400"
                                : "text-slate-400"
                            }`}
                          >
                            {promTotal > 0 ? "+" : ""}
                            {promTotal.toFixed(2)}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}