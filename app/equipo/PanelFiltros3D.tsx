"use client";

// ============================================================
// PANEL DE FILTROS 3D — controles compartidos para CanchaUnificada3D
// Layout compacto: fila básica + fundamento + tácticos + avanzado.
// ============================================================

import { useMemo, useState } from "react";
import type { AccionVisual } from "./adaptadorUnificadoV2";
import {
  aplicarFiltrosTacticos,
  hayFiltrosTacticos,
  FILTROS_TACTICOS_VACIO,
  type FiltrosTacticos as FiltrosTacticosTipo,
} from "@/lib/filtrosTacticos";
import FiltrosTacticos from "./FiltrosTacticos";

// ------------------------------------------------------------
// TIPO DE FILTROS
// ------------------------------------------------------------

export interface Filtros3D {
  set: number | "todos";
  punto: number | "todos";
  jugador: string | "todos";
  tipos: string[];
  subtipos: string[];
  valoraciones: string[];
  zonasOrigen: string[];
  zonasDestino: string[];
  rotacion: number | "todas";
  rol: string | "todos";
  zonaJugador: number | "todas";
  soloErrores: boolean;
  acciones: "propias" | "rivales" | "ambas";
  tacticos: FiltrosTacticosTipo;
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
  tacticos: { ...FILTROS_TACTICOS_VACIO },
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
    { v: "perfecta", label: "R#" },
    { v: "positiva", label: "R+" },
    { v: "intermedia", label: "R!" },
    { v: "negativa", label: "R-" },
    { v: "doble_negativa", label: "R--" },
    { v: "overpass", label: "R/" },
    { v: "error_directo", label: "R=" },
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
    if (sub === "perfecta" || sub === "positiva") return "pos";
    if (
      sub === "negativa" ||
      sub === "doble_negativa" ||
      sub === "overpass" ||
      sub === "error_directo"
    ) {
      return "neg";
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

const CHIP_INACTIVO: Record<"pos" | "neu" | "neg", string> = {
  pos: "bg-emerald-500/10 text-emerald-300 border-emerald-500/40",
  neu: "bg-slate-500/10 text-slate-300 border-slate-500/40",
  neg: "bg-rose-500/10 text-rose-300 border-rose-500/40",
};

function toggleArrayValue<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

// ------------------------------------------------------------
// APLICAR FILTROS
// ------------------------------------------------------------
//
// `todasLasAcciones` es OPCIONAL. Si no se pasa, se usa `acciones`
// como universo. Es importante pasarlo cuando `acciones` ya viene
// prefiltrado (ej. perfil de jugador), porque el contexto táctico
// necesita ver las acciones vecinas (prev/next) para funcionar.
// ------------------------------------------------------------

export function aplicarFiltros(
  acciones: AccionVisual[],
  filtros: Filtros3D,
  todasLasAcciones?: AccionVisual[]
): AccionVisual[] {
  const filtradas = acciones.filter((a) => {
    if (a.oculta) return false;

    if (filtros.acciones === "propias" && a.es_rival) return false;
    if (filtros.acciones === "rivales" && !a.es_rival) return false;

    if (filtros.set !== "todos" && a.set_numero !== filtros.set) return false;
    if (filtros.punto !== "todos" && a.punto_numero !== filtros.punto)
      return false;
    if (filtros.jugador !== "todos" && a.jugador_id !== filtros.jugador)
      return false;

    if (filtros.tipos.length > 0 && !filtros.tipos.includes(a.tipo))
      return false;

    if (filtros.subtipos.length > 0) {
      const sr = a.subtipo_real ?? "";
      if (!filtros.subtipos.includes(sr)) return false;
    }

    if (filtros.valoraciones.length > 0) {
      const s =
        a.subtipo !== null && a.subtipo !== undefined
          ? String(a.subtipo)
          : "";
      const base = s.startsWith("toque:") ? s.slice(6) : s;
      if (!filtros.valoraciones.includes(base)) return false;
    }

    if (filtros.zonasOrigen.length > 0) {
      if (!filtros.zonasOrigen.includes(a.zona_origen_codigo ?? ""))
        return false;
    }
    if (filtros.zonasDestino.length > 0) {
      if (!filtros.zonasDestino.includes(a.zona_destino_codigo ?? ""))
        return false;
    }

    if (filtros.rotacion !== "todas" && a.rotacion_numero !== filtros.rotacion)
      return false;
    if (filtros.rol !== "todos" && a.rol_jugador !== filtros.rol) return false;
    if (filtros.zonaJugador !== "todas" && a.zona_jugador !== filtros.zonaJugador)
      return false;
    if (filtros.soloErrores && !a.es_error) return false;
    return true;
  });

  // --- Contexto: agregar acción anterior para bloqueos/defensas ---
  const necesitaContexto =
    filtros.tipos.includes("bloqueo") || filtros.tipos.includes("defensa");
  let conContexto: AccionVisual[] = filtradas;

  if (necesitaContexto) {
    const universo = todasLasAcciones ?? acciones;
    const porPunto = new Map<string, AccionVisual[]>();
    for (const a of universo) {
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

    if (extras.length > 0) {
      conContexto = [...filtradas, ...extras];
      conContexto.sort((a, b) => {
        if (a.set_numero !== b.set_numero) return a.set_numero - b.set_numero;
        if (a.punto_numero !== b.punto_numero)
          return a.punto_numero - b.punto_numero;
        return a.orden - b.orden;
      });
    }
  }

  // --- Filtros tácticos (prev/next/repite) ---
  if (!hayFiltrosTacticos(filtros.tacticos)) return conContexto;

  const universo = todasLasAcciones ?? acciones;
  const jugadorFiltradoId =
    filtros.jugador !== "todos" ? filtros.jugador : null;

  return aplicarFiltrosTacticos(
    conContexto,
    universo,
    filtros.tacticos,
    jugadorFiltradoId
  );
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
  valoracionesDisponibles?: string[];
  totalAcciones: number;
  accionesFiltradas: number;
}

const selectCls = "input-dark text-xs";
const labelCls =
  "block text-[10px] font-bold uppercase tracking-wide mb-1";
const labelStyle: React.CSSProperties = {
  color: "var(--sx-text-secondary)",
};

const cardBase: React.CSSProperties = {
  background: "var(--sx-surface-1)",
  border: "1px solid var(--sx-border)",
  boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
};

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

  const cantFiltrosTacticos =
    (filtros.tacticos.contextoPrevio ? 1 : 0) +
    (filtros.tacticos.contextoPosterior ? 1 : 0) +
    (filtros.tacticos.repeticion ? 1 : 0);

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
    (filtros.acciones !== "propias" ? 1 : 0) +
    cantFiltrosTacticos;

  const hayFiltrosActivos = cantFiltros > 0;

  const hayAvanzadosActivos =
    filtros.zonasOrigen.length > 0 ||
    filtros.zonasDestino.length > 0 ||
    filtros.rotacion !== "todas" ||
    filtros.rol !== "todos" ||
    filtros.zonaJugador !== "todas";

  const nombreJugadorFiltrado = useMemo(() => {
    if (filtros.jugador === "todos") return null;
    const j = jugadores.find((x) => x.id === filtros.jugador);
    return j ? j.nombre : null;
  }, [filtros.jugador, jugadores]);

  return (
    <div className="rounded-2xl p-3 space-y-2" style={cardBase}>
      {/* ---------- HEADER ---------- */}
      <div className="flex items-center justify-between">
        <p
          className="text-[11px] font-bold uppercase tracking-wider"
          style={{ color: "var(--sx-text-primary)" }}
        >
          🎛️ Filtros {cantFiltros > 0 && `(${cantFiltros})`}
        </p>
        <div className="flex items-center gap-2">
          <span
            className="text-[10px]"
            style={{ color: "var(--sx-text-muted)" }}
          >
            {accionesFiltradas} de {totalAcciones}
          </span>
          {hayFiltrosActivos && (
            <button
              onClick={limpiar}
              className="text-[10px] font-semibold"
              style={{ color: "#F87171" }}
            >
              ✕ Limpiar
            </button>
          )}
        </div>
      </div>

      {/* ---------- FILA BÁSICA ---------- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div>
          <label className={labelCls} style={labelStyle}>
            Set
          </label>
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
          <label className={labelCls} style={labelStyle}>
            Punto
          </label>
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
          <label className={labelCls} style={labelStyle}>
            Jugador
          </label>
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
          <label className={labelCls} style={labelStyle}>
            Acciones
          </label>
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
          <label className={`${labelCls} mb-0`} style={labelStyle}>
            Fundamento{" "}
            {filtros.tipos.length > 0 && `· ${filtros.tipos.length}`}
          </label>
          <button
            onClick={() => set("soloErrores", !filtros.soloErrores)}
            className={`px-2 py-0.5 text-[10px] font-bold rounded border-2 transition ${
              filtros.soloErrores
                ? "bg-rose-500 text-white border-rose-500"
                : "bg-rose-500/10 text-rose-300 border-rose-500/40 hover:bg-rose-500/20"
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
                    : "bg-white/5 text-slate-300 border-white/15 hover:bg-white/10 hover:text-white"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        {(filtros.tipos.includes("bloqueo") ||
          filtros.tipos.includes("defensa")) && (
          <p
            className="text-[9px] mt-1 italic"
            style={{ color: "#FBBF24" }}
          >
            🔗 Se agrega automáticamente la acción anterior de cada
            bloqueo/defensa para ver la trayectoria entrante.
          </p>
        )}
      </div>

      {/* ---------- SUBTIPOS REALES ---------- */}
      {subtiposDisponibles.length > 0 && (
        <div>
          <label className={labelCls} style={labelStyle}>
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
                      : "bg-white/5 text-slate-300 border-white/15 hover:bg-white/10"
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

      {/* ---------- VALORACIÓN ---------- */}
      {filtros.tipos.length > 0 && valoracionesDisponibles.length > 0 && (
        <div
          className="pt-2"
          style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
        >
          <button
            onClick={() => setValoracionAbierta((v) => !v)}
            className="w-full flex items-center justify-between text-[11px] font-bold uppercase tracking-wider"
            style={{ color: "var(--sx-text-primary)" }}
          >
            <span>
              Valoración{" "}
              {filtros.valoraciones.length > 0 &&
                `· ${filtros.valoraciones.length}`}
            </span>
            <span
              className="transition-transform"
              style={{
                color: "var(--sx-text-muted)",
                transform: valoracionAbierta ? "rotate(180deg)" : "none",
              }}
            >
              ▼
            </span>
          </button>
          {valoracionAbierta && (
            <div className="flex flex-wrap gap-1 mt-2">
              {valoracionesDisponibles.map((s) => {
                const activo = filtros.valoraciones.includes(s.v);
                const nivel = nivelValoracion(s.tipo, s.v);
                const chipCls = CHIP_INACTIVO[nivel];
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
                        : `${chipCls} hover:brightness-125`
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

      {/* ---------- FILTROS TÁCTICOS ---------- */}
      <FiltrosTacticos
        filtros={filtros.tacticos}
        onChange={(t) => set("tacticos", t)}
        jugadorFiltradoNombre={nombreJugadorFiltrado}
      />

      {/* ---------- AVANZADO ---------- */}
      <div
        className="pt-2"
        style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
      >
        <button
          onClick={() => setAvanzadoAbierto((v) => !v)}
          className="w-full flex items-center justify-between text-[11px] font-bold uppercase tracking-wider"
          style={{ color: "var(--sx-text-primary)" }}
        >
          <span>
            Avanzado{" "}
            {hayAvanzadosActivos && (
              <span style={{ color: "#FBBF24" }}>•</span>
            )}
          </span>
          <span
            className="transition-transform"
            style={{
              color: "var(--sx-text-muted)",
              transform: avanzadoAbierto ? "rotate(180deg)" : "none",
            }}
          >
            ▼
          </span>
        </button>

        {avanzadoAbierto && (
          <div className="mt-2 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className={labelCls} style={labelStyle}>
                  Rotación
                </label>
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
                <label className={labelCls} style={labelStyle}>
                  Rol jugador
                </label>
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
                <label className={labelCls} style={labelStyle}>
                  Zona jugador
                </label>
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
      <label className={labelCls} style={labelStyle}>
        {label}
        {seleccionadas.length > 0 && ` · ${seleccionadas.length}`}
      </label>
      <div className="flex flex-wrap gap-1 items-center">
        <span
          className="text-[9px] font-bold mr-1 uppercase tracking-wider"
          style={{ color: "#93C5FD" }}
        >
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
                  ? "bg-blue-500 text-white border-blue-400"
                  : "bg-blue-500/10 text-blue-300 border-blue-500/40 hover:bg-blue-500/20"
              }`}
            >
              {z.slice(1)}
            </button>
          );
        })}
        <span
          className="text-[9px] font-bold mx-2 uppercase tracking-wider"
          style={{ color: "#FCA5A5" }}
        >
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
                  ? "bg-orange-500 text-white border-orange-400"
                  : "bg-orange-500/10 text-orange-300 border-orange-500/40 hover:bg-orange-500/20"
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