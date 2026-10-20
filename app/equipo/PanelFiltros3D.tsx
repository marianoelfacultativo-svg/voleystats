"use client";

// ============================================================
// PANEL DE FILTROS 3D — controles compartidos para CanchaUnificada3D
// ============================================================

import type { AccionVisual } from "./adaptadorUnificadoV2";

// ------------------------------------------------------------
// TIPO DE FILTROS
// ------------------------------------------------------------

export interface Filtros3D {
  set: number | "todos";
  punto: number | "todos";
  jugador: string | "todos";
  tipo: string | "todos";
  zonaOrigen: number | "todas";
  zonaDestino: number | "todas";
  rotacion: number | "todas";
  rol: string | "todos";
  zonaJugador: number | "todas";
  soloErrores: boolean;
  valoracion: string | "todas";
}

export const FILTROS3D_VACIO: Filtros3D = {
  set: "todos",
  punto: "todos",
  jugador: "todos",
  tipo: "todos",
  zonaOrigen: "todas",
  zonaDestino: "todas",
  rotacion: "todas",
  rol: "todos",
  zonaJugador: "todas",
  soloErrores: false,
  valoracion: "todas",
};

// ------------------------------------------------------------
// APLICAR FILTROS
// ------------------------------------------------------------

export function aplicarFiltros(
  acciones: AccionVisual[],
  f: Filtros3D
): AccionVisual[] {
  return acciones.filter((a) => {
    if (a.oculta) return false;
    if (f.set !== "todos" && a.set_numero !== f.set) return false;
    if (f.punto !== "todos" && a.punto_numero !== f.punto) return false;
    if (f.jugador !== "todos" && a.jugador_id !== f.jugador) return false;
    if (f.tipo !== "todos" && a.tipo !== f.tipo) return false;
    if (f.zonaOrigen !== "todas" && a.zona_origen !== f.zonaOrigen)
      return false;
    if (f.zonaDestino !== "todas" && a.zona_destino !== f.zonaDestino)
      return false;
    if (f.rotacion !== "todas" && a.rotacion_numero !== f.rotacion)
      return false;
    if (f.rol !== "todos" && a.rol_jugador !== f.rol) return false;
    if (f.zonaJugador !== "todas" && a.zona_jugador !== f.zonaJugador)
      return false;
    if (f.soloErrores && !a.es_error) return false;
    if (f.valoracion !== "todas") {
      const s =
        a.subtipo !== null && a.subtipo !== undefined
          ? String(a.subtipo)
          : "";
      const base = s.startsWith("toque:") ? s.slice(6) : s;
      if (base !== f.valoracion) return false;
    }
    return true;
  });
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
  valoracionesDisponibles: string[];

  totalAcciones: number;
  accionesFiltradas: number;
}

const TIPOS = [
  { v: "saque", label: "Saque" },
  { v: "recepcion", label: "Recepción" },
  { v: "armado", label: "Armado" },
  { v: "ataque", label: "Ataque" },
  { v: "bloqueo", label: "Bloqueo" },
  { v: "defensa", label: "Defensa" },
  { v: "libre", label: "Libre" },
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

const selectCls =
  "w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-emerald-500";
const labelCls =
  "block text-[10px] font-semibold text-slate-500 uppercase mb-1 tracking-wide";

export default function PanelFiltros3D({
  filtros,
  onChange,
  setsDisponibles,
  puntosDisponibles,
  jugadores,
  valoracionesDisponibles,
  totalAcciones,
  accionesFiltradas,
}: Props) {
  const set = <K extends keyof Filtros3D>(k: K, v: Filtros3D[K]) =>
    onChange({ ...filtros, [k]: v });

  const limpiar = () => onChange({ ...FILTROS3D_VACIO });

  const hayFiltrosActivos =
    filtros.set !== "todos" ||
    filtros.punto !== "todos" ||
    filtros.jugador !== "todos" ||
    filtros.tipo !== "todos" ||
    filtros.zonaOrigen !== "todas" ||
    filtros.zonaDestino !== "todas" ||
    filtros.rotacion !== "todas" ||
    filtros.rol !== "todos" ||
    filtros.zonaJugador !== "todas" ||
    filtros.soloErrores ||
    filtros.valoracion !== "todas";

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-3 space-y-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
          🎛️ Filtros
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
          <label className={labelCls}>Fundamento</label>
          <select
            value={filtros.tipo}
            onChange={(e) => set("tipo", e.target.value)}
            className={selectCls}
          >
            <option value="todos">Todos</option>
            {TIPOS.map((t) => (
              <option key={t.v} value={t.v}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <div>
          <label className={labelCls}>Zona origen</label>
          <select
            value={
              filtros.zonaOrigen === "todas"
                ? "todas"
                : String(filtros.zonaOrigen)
            }
            onChange={(e) =>
              set(
                "zonaOrigen",
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

        <div>
          <label className={labelCls}>Zona destino</label>
          <select
            value={
              filtros.zonaDestino === "todas"
                ? "todas"
                : String(filtros.zonaDestino)
            }
            onChange={(e) =>
              set(
                "zonaDestino",
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

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[140px]">
          <label className={labelCls}>Valoración</label>
          <select
            value={filtros.valoracion}
            onChange={(e) => set("valoracion", e.target.value)}
            className={selectCls}
          >
            <option value="todas">Todas</option>
            {valoracionesDisponibles.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => set("soloErrores", !filtros.soloErrores)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border-2 transition ${
            filtros.soloErrores
              ? "bg-red-500 text-white border-red-500"
              : "bg-white text-red-600 border-red-300 hover:bg-red-50"
          }`}
          title="Mostrar solo acciones que terminaron en error"
        >
          {filtros.soloErrores ? "✓ Solo errores" : "⚠️ Solo errores"}
        </button>
      </div>
    </div>
  );
}