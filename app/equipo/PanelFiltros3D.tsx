"use client";

// ============================================================
// PANEL DE FILTROS 3D — controles compartidos para CanchaUnificada3D
// Layout compacto: fila básica + fundamento + secciones colapsables.
// ============================================================

import { useMemo, useState } from "react";
import type { AccionVisual } from "./adaptadorUnificadoV2";

// ------------------------------------------------------------
// TIPO DE FILTROS
// ------------------------------------------------------------

export interface Filtros3D {
  set: number | "todos";
  punto: number | "todos";
  jugador: string | "todos";
  /** Multi-select de fundamentos (vacío = todos). */
  tipos: string[];
  /** Multi-select de subtipos reales (potencia/flotado, remate/toque). */
  subtipos: string[];
  /** Multi-select de valoraciones. */
  valoraciones: string[];
  /** Multi-select de zonas de origen. */
  zonasOrigen: string[];
  /** Multi-select de zonas de destino. */
  zonasDestino: string[];
  rotacion: number | "todas";
  rol: string | "todos";
  zonaJugador: number | "todas";
  soloErrores: boolean;
  acciones: "propias" | "rivales" | "ambas";
}

export const FILTROS3D_VACIO: Filtros3D = {
  set: "todos",
  punto: "todos",
  jugador: "todos",
  tipos: [],
  subtipos: [],
  valoraciones: [],
  zonasOrigen: [],
  zonasDestino: [],
  rotacion: "todas",
  rol: "todos",
  zonaJugador: "todas",
  soloErrores: false,
  acciones: "propias",
};

// ------------------------------------------------------------
// OPCIONES
// ------------------------------------------------------------

interface Opcion {
  v: string;
  label: string;
}

const SUBTIPOS_REALES_POR_TIPO: Record<string, Opcion[]> = {
  saque: [
    { v: "potencia", label: "Potencia" },
    { v: "flotado", label: "Flotado" },
  ],
  ataque: [
    { v: "remate", label: "Remate" },
    { v: "toque", label: "Toque" },
  ],
};

const VALORACIONES_POR_TIPO: Record<string, Opcion[]> = {
  saque: [
    { v: "ace", label: "Ace" },
    { v: "positivo_mas", label: "Pos+" },
    { v: "positivo", label: "Pos" },
    { v: "neutro", label: "Neu" },
    { v: "negativo", label: "Neg" },
    { v: "error_rival", label: "Error (rival)" },
  ],
  recepcion: [
    { v: "1", label: "1 (Ace c/)" },
    { v: "2", label: "2 (3x Neg)" },
    { v: "3", label: "3 (2x Neg)" },
    { v: "4", label: "4 (Neg)" },
    { v: "5", label: "5 (Pos)" },
    { v: "6", label: "6 (2x Pos)" },
  ],
  armado: [
    { v: "1", label: "1" },
    { v: "2", label: "2" },
    { v: "3", label: "3" },
    { v: "4", label: "4" },
    { v: "5", label: "5" },
    { v: "6", label: "6" },
    { v: "R", label: "R" },
  ],
  ataque: [
    { v: "punto", label: "Punto (viejo)" },
    { v: "neutro", label: "Neutro (viejo)" },
    { v: "error", label: "Error (viejo)" },
    { v: "punto_directo_ataque", label: "Punto directo" },
    { v: "punto_desviado_ataque", label: "Punto desviado" },
    { v: "use_rival_ataque", label: "Use rival" },
    { v: "error_red_ataque", label: "Error red" },
    { v: "error_afuera_ataque", label: "Error afuera" },
    { v: "gorro_ataque", label: "Gorro" },
    { v: "neutro_bloqueo_cobertura_ataque", label: "Neu bloqueo+cob" },
    { v: "neutro_desvio_bloqueo_defensa_ataque", label: "Neu desvío+def" },
    { v: "neutro_defensa_ataque", label: "Neu defensa" },
    { v: "buena_rival", label: "Buena rival" },
    { v: "simple", label: "Simple (rival)" },
    { v: "peligroso", label: "Peligroso (rival)" },
    { v: "toque", label: "Toque (rival)" },
    { v: "libre", label: "Libre (rival)" },
    { v: "error_rival", label: "Error (rival)" },
  ],
  bloqueo: [
    { v: "punto", label: "Punto" },
    { v: "positivo_mas", label: "Pos+" },
    { v: "positivo", label: "Pos" },
    { v: "neutro", label: "Neu" },
    { v: "use_rival", label: "Use Rival" },
    { v: "red", label: "Red" },
    { v: "filtrada", label: "Filtrada" },
  ],
  defensa: [
    { v: "toque_positiva", label: "Toque +" },
    { v: "toque_negativa", label: "Toque -" },
    { v: "gran_def", label: "Gran Def" },
    { v: "error_def", label: "Error Def" },
    { v: "mala_libre", label: "Mala Libre" },
    { v: "cobertura_positiva", label: "Cob +" },
    { v: "cobertura_negativa", label: "Cob -" },
    { v: "errores_graves", label: "Err Graves" },
    { v: "neutro", label: "Neutro" },
  ],
  libre: [
    { v: "toque", label: "Toque" },
    { v: "libre", label: "Libre" },
  ],
  "roce-red": [
    { v: "ofensivo-propio", label: "Ofensivo propio" },
    { v: "invasion-zaguero", label: "Invasión zaguero" },
    { v: "invasion-delantero", label: "Invasión delantero" },
    { v: "roce-red-rival", label: "Roce red rival" },
    { v: "error_rival", label: "Error (rival)" },
  ],
};

const TIPOS = [
  { v: "saque", label: "Saque" },
  { v: "recepcion", label: "Recepción" },
  { v: "armado", label: "Armado" },
  { v: "ataque", label: "Ataque" },
  { v: "bloqueo", label: "Bloqueo" },
  { v: "defensa", label: "Defensa" },
  { v: "libre", label: "Libre" },
  { v: "roce-red", label: "Roce red" },
];

const ROLES = [
  { v: "A", label: "Armador" },
  { v: "O", label: "Opuesto" },
  { v: "C1", label: "Central 1" },
  { v: "C2", label: "Central 2" },
  { v: "P1", label: "Punta 1" },
  { v: "P2", label: "Punta 2" },
  { v: "L", label: "Líbero" },
];

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

function nivelValoracion(
  tipo: string,
  sub: string
): "pos" | "neu" | "neg" {
  if (tipo === "saque") {
    if (sub === "ace" || sub === "positivo_mas" || sub === "positivo")
      return "pos";
    if (sub === "negativo" || sub === "error_rival") return "neg";
    return "neu";
  }
  if (tipo === "recepcion") {
    const n = parseInt(sub, 10);
    if (!isNaN(n)) {
      if (n >= 5) return "pos";
      if (n <= 3) return "neg";
    }
    return "neu";
  }
  if (tipo === "armado") {
    if (sub === "R") return "neu";
    const n = parseInt(sub, 10);
    if (!isNaN(n)) {
      if (n >= 5) return "pos";
      if (n <= 3) return "neg";
    }
    return "neu";
  }
  if (tipo === "ataque") {
    if (
      sub === "punto" ||
      sub === "punto_directo_ataque" ||
      sub === "punto_desviado_ataque" ||
      sub === "use_rival_ataque" ||
      sub === "buena_rival" ||
      sub === "peligroso"
    ) {
      return "pos";
    }
    if (
      sub === "error" ||
      sub === "error_red_ataque" ||
      sub === "error_afuera_ataque" ||
      sub === "gorro_ataque" ||
      sub === "error_rival"
    ) {
      return "neg";
    }
    return "neu";
  }
  if (tipo === "bloqueo") {
    if (sub === "punto" || sub === "positivo_mas" || sub === "positivo")
      return "pos";
    if (sub === "red" || sub === "filtrada" || sub === "use_rival")
      return "neg";
    return "neu";
  }
  if (tipo === "defensa") {
    if (sub.includes("positiva") || sub === "gran_def") return "pos";
    if (
      sub.includes("negativa") ||
      sub === "error_def" ||
      sub === "mala_libre" ||
      sub === "errores_graves"
    )
      return "neg";
    return "neu";
  }
  if (tipo === "roce-red") {
    if (sub === "roce-red-rival") return "pos";
    return "neg";
  }
  return "neu";
}

const COLOR_NIVEL = {
  pos: "bg-green-100 text-green-800 border-green-400",
  neu: "bg-slate-100 text-slate-700 border-slate-400",
  neg: "bg-red-100 text-red-800 border-red-400",
};

function toggleArrayValue<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

// ------------------------------------------------------------
// APLICAR FILTROS
// ------------------------------------------------------------

export function aplicarFiltros(
  acciones: AccionVisual[],
  f: Filtros3D
): AccionVisual[] {
  const filtradas = acciones.filter((a) => {
    if (a.oculta) return false;

    if (f.acciones === "propias" && a.es_rival) return false;
    if (f.acciones === "rivales" && !a.es_rival) return false;

    if (f.set !== "todos" && a.set_numero !== f.set) return false;
    if (f.punto !== "todos" && a.punto_numero !== f.punto) return false;
    if (f.jugador !== "todos" && a.jugador_id !== f.jugador) return false;

    if (f.tipos.length > 0 && !f.tipos.includes(a.tipo)) return false;

    if (f.subtipos.length > 0) {
      const sr = a.subtipo_real ?? "";
      if (!f.subtipos.includes(sr)) return false;
    }

    if (f.valoraciones.length > 0) {
      const s =
        a.subtipo !== null && a.subtipo !== undefined
          ? String(a.subtipo)
          : "";
      const base = s.startsWith("toque:") ? s.slice(6) : s;
      if (!f.valoraciones.includes(base)) return false;
    }

    if (f.zonasOrigen.length > 0) {
      if (!f.zonasOrigen.includes(a.zona_origen_codigo ?? "")) return false;
    }
    if (f.zonasDestino.length > 0) {
      if (!f.zonasDestino.includes(a.zona_destino_codigo ?? "")) return false;
    }

    if (f.rotacion !== "todas" && a.rotacion_numero !== f.rotacion)
      return false;
    if (f.rol !== "todos" && a.rol_jugador !== f.rol) return false;
    if (f.zonaJugador !== "todas" && a.zona_jugador !== f.zonaJugador)
      return false;
    if (f.soloErrores && !a.es_error) return false;
    return true;
  });

  const necesitaContexto =
    f.tipos.includes("bloqueo") || f.tipos.includes("defensa");
  if (!necesitaContexto) return filtradas;

  const porPunto = new Map<string, AccionVisual[]>();
  for (const a of acciones) {
    if (a.oculta) continue;
    const k = `${a.set_numero}-${a.punto_numero}`;
    let lista = porPunto.get(k);
    if (!lista) {
      lista = [];
      porPunto.set(k, lista);
    }
    lista.push(a);
  }
  for (const lista of porPunto.values()) {
    lista.sort((x, y) => x.orden - y.orden);
  }

  const ids = new Set(filtradas.map((a) => a.id));
  const extras: AccionVisual[] = [];

  for (const a of filtradas) {
    if (a.tipo !== "bloqueo" && a.tipo !== "defensa") continue;
    const k = `${a.set_numero}-${a.punto_numero}`;
    const lista = porPunto.get(k) ?? [];
    const idx = lista.findIndex((x) => x.id === a.id);
    if (idx <= 0) continue;
    const anterior = lista[idx - 1];
    if (!ids.has(anterior.id)) {
      ids.add(anterior.id);
      extras.push(anterior);
    }
  }

  if (extras.length === 0) return filtradas;

  const resultado = [...filtradas, ...extras];
  resultado.sort((a, b) => {
    if (a.set_numero !== b.set_numero) return a.set_numero - b.set_numero;
    if (a.punto_numero !== b.punto_numero)
      return a.punto_numero - b.punto_numero;
    return a.orden - b.orden;
  });
  return resultado;
}

// ------------------------------------------------------------
// PROPS
// ------------------------------------------------------------

interface Props {
  filtros: Filtros3D;
  onChange: (f: Filtros3D) => void;
  setsDisponibles: number[];
  puntosDisponibles: number[];
  jugadores: { id: string; nombre: string }[];
  /** @deprecated */
  valoracionesDisponibles?: string[];
  totalAcciones: number;
  accionesFiltradas: number;
}

const selectCls =
  "w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-emerald-500";
const labelCls =
  "block text-[10px] font-semibold text-slate-500 uppercase mb-1 tracking-wide";

// ------------------------------------------------------------
// COMPONENTE
// ------------------------------------------------------------

export default function PanelFiltros3D({
  filtros,
  onChange,
  setsDisponibles,
  puntosDisponibles,
  jugadores,
  totalAcciones,
  accionesFiltradas,
}: Props) {
  const [avanzadoAbierto, setAvanzadoAbierto] = useState(false);
  const [valoracionAbierta, setValoracionAbierta] = useState(false);

  const set = <K extends keyof Filtros3D>(k: K, v: Filtros3D[K]) =>
    onChange({ ...filtros, [k]: v });

  const limpiar = () => onChange({ ...FILTROS3D_VACIO });

  const subtiposDisponibles = useMemo(() => {
    if (filtros.tipos.length === 0) return [];
    const out: { tipo: string; v: string; label: string }[] = [];
    for (const tipo of filtros.tipos) {
      for (const s of SUBTIPOS_REALES_POR_TIPO[tipo] ?? []) {
        out.push({ tipo, v: s.v, label: s.label });
      }
    }
    return out;
  }, [filtros.tipos]);

  const valoracionesDisponibles = useMemo(() => {
    if (filtros.tipos.length === 0) return [];
    const out: { tipo: string; v: string; label: string }[] = [];
    for (const tipo of filtros.tipos) {
      for (const s of VALORACIONES_POR_TIPO[tipo] ?? []) {
        out.push({ tipo, v: s.v, label: s.label });
      }
    }
    return out;
  }, [filtros.tipos]);

  const cantFiltros =
    (filtros.set !== "todos" ? 1 : 0) +
    (filtros.punto !== "todos" ? 1 : 0) +
    (filtros.jugador !== "todos" ? 1 : 0) +
    filtros.tipos.length +
    filtros.subtipos.length +
    filtros.valoraciones.length +
    filtros.zonasOrigen.length +
    filtros.zonasDestino.length +
    (filtros.rotacion !== "todas" ? 1 : 0) +
    (filtros.rol !== "todos" ? 1 : 0) +
    (filtros.zonaJugador !== "todas" ? 1 : 0) +
    (filtros.soloErrores ? 1 : 0) +
    (filtros.acciones !== "propias" ? 1 : 0);

  const hayFiltrosActivos = cantFiltros > 0;

  const hayAvanzadosActivos =
    filtros.zonasOrigen.length > 0 ||
    filtros.zonasDestino.length > 0 ||
    filtros.rotacion !== "todas" ||
    filtros.rol !== "todos" ||
    filtros.zonaJugador !== "todas";

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-3 space-y-2">
      {/* ---------- HEADER ---------- */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
          🎛️ Filtros {cantFiltros > 0 && `(${cantFiltros})`}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400">
            {accionesFiltradas} de {totalAcciones}
          </span>
          {hayFiltrosActivos && (
            <button
              onClick={limpiar}
              className="text-[10px] text-red-600 hover:text-red-800 font-semibold"
            >
              ✕ Limpiar
            </button>
          )}
        </div>
      </div>

      {/* ---------- FILA BÁSICA ---------- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div>
          <label className={labelCls}>Set</label>
          <select
            value={filtros.set === "todos" ? "todos" : String(filtros.set)}
            onChange={(e) =>
              set(
                "set",
                e.target.value === "todos"
                  ? "todos"
                  : parseInt(e.target.value)
              )
            }
            className={selectCls}
          >
            <option value="todos">Todos</option>
            {setsDisponibles.map((s) => (
              <option key={s} value={String(s)}>
                Set {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>Punto</label>
          <select
            value={
              filtros.punto === "todos" ? "todos" : String(filtros.punto)
            }
            onChange={(e) =>
              set(
                "punto",
                e.target.value === "todos"
                  ? "todos"
                  : parseInt(e.target.value)
              )
            }
            className={selectCls}
          >
            <option value="todos">Todos</option>
            {puntosDisponibles.map((p) => (
              <option key={p} value={String(p)}>
                P{p}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>Jugador</label>
          <select
            value={filtros.jugador}
            onChange={(e) => set("jugador", e.target.value)}
            className={selectCls}
          >
            <option value="todos">Todos</option>
            {jugadores.map((j) => (
              <option key={j.id} value={j.id}>
                {j.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>Acciones</label>
          <select
            value={filtros.acciones}
            onChange={(e) =>
              set(
                "acciones",
                e.target.value as "propias" | "rivales" | "ambas"
              )
            }
            className={`${selectCls} font-semibold`}
          >
            <option value="propias">👤 Solo propias</option>
            <option value="rivales">👥 Solo rivales</option>
            <option value="ambas">👥 Ambas</option>
          </select>
        </div>
      </div>

      {/* ---------- FUNDAMENTOS + SOLO ERRORES ---------- */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className={`${labelCls} mb-0`}>
            Fundamento{" "}
            {filtros.tipos.length > 0 && `· ${filtros.tipos.length}`}
          </label>
          <button
            onClick={() => set("soloErrores", !filtros.soloErrores)}
            className={`px-2 py-0.5 text-[10px] font-semibold rounded border-2 transition ${
              filtros.soloErrores
                ? "bg-red-500 text-white border-red-500"
                : "bg-white text-red-600 border-red-300 hover:bg-red-50"
            }`}
          >
            {filtros.soloErrores ? "✓ Solo errores" : "⚠️ Solo errores"}
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {TIPOS.map((t) => {
            const activo = filtros.tipos.includes(t.v);
            return (
              <button
                key={t.v}
                onClick={() => {
                  const nuevos = toggleArrayValue(filtros.tipos, t.v);
                  const subsValidos = new Set(
                    nuevos.flatMap((ti) =>
                      (SUBTIPOS_REALES_POR_TIPO[ti] ?? []).map((s) => s.v)
                    )
                  );
                  const valsValidas = new Set(
                    nuevos.flatMap((ti) =>
                      (VALORACIONES_POR_TIPO[ti] ?? []).map((s) => s.v)
                    )
                  );
                  onChange({
                    ...filtros,
                    tipos: nuevos,
                    subtipos: filtros.subtipos.filter((s) =>
                      subsValidos.has(s)
                    ),
                    valoraciones: filtros.valoraciones.filter((s) =>
                      valsValidas.has(s)
                    ),
                  });
                }}
                className={`px-2 py-1 text-[11px] font-semibold rounded border-2 transition ${
                  activo
                    ? "bg-emerald-500 text-white border-emerald-600"
                    : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        {(filtros.tipos.includes("bloqueo") ||
          filtros.tipos.includes("defensa")) && (
          <p className="text-[9px] text-amber-700 mt-1 italic">
            🔗 Se agrega automáticamente la acción anterior de cada
            bloqueo/defensa para ver la trayectoria entrante.
          </p>
        )}
      </div>

      {/* ---------- SUBTIPOS REALES (si hay tipos compatibles) ---------- */}
      {subtiposDisponibles.length > 0 && (
        <div>
          <label className={labelCls}>
            Subtipo{" "}
            {filtros.subtipos.length > 0 && `· ${filtros.subtipos.length}`}
          </label>
          <div className="flex flex-wrap gap-1">
            {subtiposDisponibles.map((s) => {
              const activo = filtros.subtipos.includes(s.v);
              return (
                <button
                  key={`sub-${s.tipo}-${s.v}`}
                  onClick={() =>
                    set("subtipos", toggleArrayValue(filtros.subtipos, s.v))
                  }
                  className={`px-1.5 py-0.5 text-[10px] font-semibold rounded border-2 transition ${
                    activo
                      ? "bg-emerald-500 text-white border-emerald-600"
                      : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                  }`}
                  title={`${s.tipo} · ${s.label}`}
                >
                  {`${s.tipo.slice(0, 3)}·${s.label}`}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------- VALORACIÓN (colapsable) ---------- */}
      {filtros.tipos.length > 0 && valoracionesDisponibles.length > 0 && (
        <div className="border-t border-slate-200 pt-2">
          <button
            onClick={() => setValoracionAbierta((v) => !v)}
            className="w-full flex items-center justify-between text-[11px] font-semibold text-slate-600 uppercase tracking-wider"
          >
            <span>
              Valoración{" "}
              {filtros.valoraciones.length > 0 &&
                `· ${filtros.valoraciones.length}`}
            </span>
            <span
              className={`text-slate-400 transition-transform ${
                valoracionAbierta ? "rotate-180" : ""
              }`}
            >
              ▼
            </span>
          </button>
          {valoracionAbierta && (
            <div className="flex flex-wrap gap-1 mt-2">
              {valoracionesDisponibles.map((s) => {
                const activo = filtros.valoraciones.includes(s.v);
                const nivel = nivelValoracion(s.tipo, s.v);
                const colCls = COLOR_NIVEL[nivel];
                return (
                  <button
                    key={`val-${s.tipo}-${s.v}`}
                    onClick={() =>
                      set(
                        "valoraciones",
                        toggleArrayValue(filtros.valoraciones, s.v)
                      )
                    }
                    className={`px-1.5 py-0.5 text-[10px] font-semibold rounded border-2 transition ${
                      activo
                        ? "bg-emerald-500 text-white border-emerald-600"
                        : `${colCls} hover:brightness-95`
                    }`}
                    title={`${s.tipo} · ${s.label}`}
                  >
                    {s.tipo === "armado" ||
                    s.tipo === "recepcion" ||
                    s.tipo === "roce-red"
                      ? s.label
                      : `${s.tipo.slice(0, 3)}·${s.label}`}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ---------- AVANZADO (colapsable) ---------- */}
      <div className="border-t border-slate-200 pt-2">
        <button
          onClick={() => setAvanzadoAbierto((v) => !v)}
          className="w-full flex items-center justify-between text-[11px] font-semibold text-slate-600 uppercase tracking-wider"
        >
          <span>
            Avanzado{" "}
            {hayAvanzadosActivos && (
              <span className="text-amber-700">•</span>
            )}
          </span>
          <span
            className={`text-slate-400 transition-transform ${
              avanzadoAbierto ? "rotate-180" : ""
            }`}
          >
            ▼
          </span>
        </button>

        {avanzadoAbierto && (
          <div className="mt-2 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className={labelCls}>Rotación</label>
                <select
                  value={
                    filtros.rotacion === "todas"
                      ? "todas"
                      : String(filtros.rotacion)
                  }
                  onChange={(e) =>
                    set(
                      "rotacion",
                      e.target.value === "todas"
                        ? "todas"
                        : parseInt(e.target.value)
                    )
                  }
                  className={selectCls}
                >
                  <option value="todas">Todas</option>
                  {[1, 2, 3, 4, 5, 6].map((r) => (
                    <option key={r} value={String(r)}>
                      R{r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>Rol jugador</label>
                <select
                  value={filtros.rol}
                  onChange={(e) => set("rol", e.target.value)}
                  className={selectCls}
                >
                  <option value="todos">Todos</option>
                  {ROLES.map((r) => (
                    <option key={r.v} value={r.v}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>Zona jugador</label>
                <select
                  value={
                    filtros.zonaJugador === "todas"
                      ? "todas"
                      : String(filtros.zonaJugador)
                  }
                  onChange={(e) =>
                    set(
                      "zonaJugador",
                      e.target.value === "todas"
                        ? "todas"
                        : parseInt(e.target.value)
                    )
                  }
                  className={selectCls}
                >
                  <option value="todas">Todas</option>
                  {[1, 2, 3, 4, 5, 6].map((z) => (
                    <option key={z} value={String(z)}>
                      Z{z}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <ZonasMultiSelector
              label="Zona origen"
              seleccionadas={filtros.zonasOrigen}
              onChange={(z) => set("zonasOrigen", z)}
            />

            <ZonasMultiSelector
              label="Zona destino"
              seleccionadas={filtros.zonasDestino}
              onChange={(z) => set("zonasDestino", z)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// SUBCOMPONENTE: selector múltiple de zonas P/R
// ============================================================

const ZONAS_PROPIAS = ["P1", "P2", "P3", "P4", "P5", "P6"];
const ZONAS_RIVALES = ["R1", "R2", "R3", "R4", "R5", "R6"];

function ZonasMultiSelector({
  label,
  seleccionadas,
  onChange,
}: {
  label: string;
  seleccionadas: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div>
      <label className={labelCls}>
        {label}
        {seleccionadas.length > 0 && ` · ${seleccionadas.length}`}
      </label>
      <div className="flex flex-wrap gap-1 items-center">
        <span className="text-[9px] font-bold text-blue-700 mr-1 uppercase tracking-wider">
          Propia
        </span>
        {ZONAS_PROPIAS.map((z) => {
          const activo = seleccionadas.includes(z);
          return (
            <button
              key={z}
              onClick={() => onChange(toggleArrayValue(seleccionadas, z))}
              className={`px-2 py-0.5 text-[10px] font-bold rounded border transition ${
                activo
                  ? "bg-blue-500 text-white border-blue-600"
                  : "bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100"
              }`}
            >
              {z.slice(1)}
            </button>
          );
        })}
        <span className="text-[9px] font-bold text-orange-700 mx-2 uppercase tracking-wider">
          Rival
        </span>
        {ZONAS_RIVALES.map((z) => {
          const activo = seleccionadas.includes(z);
          return (
            <button
              key={z}
              onClick={() => onChange(toggleArrayValue(seleccionadas, z))}
              className={`px-2 py-0.5 text-[10px] font-bold rounded border transition ${
                activo
                  ? "bg-orange-500 text-white border-orange-600"
                  : "bg-orange-50 text-orange-700 border-orange-300 hover:bg-orange-100"
              }`}
            >
              {z.slice(1)}
            </button>
          );
        })}
      </div>
    </div>
  );
}