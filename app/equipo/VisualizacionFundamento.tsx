"use client";

import { useMemo, useState } from "react";
import CanchaVisualizacion, {
  type ItemVisual,
  type TipoFundamento,
  type Vista,
} from "./CanchaVisualizacion";
import type { SaqueRow, RecepcionRow, AtaqueRow } from "@/lib/db";

type Accion = SaqueRow | RecepcionRow | AtaqueRow;

interface Props {
  tipo: TipoFundamento;
  acciones: Accion[];
  jugadoresIds: string[];
  nombresJugadores: Record<string, string>;
}

const VISTAS: { id: Vista; label: string }[] = [
  { id: "iso", label: "Isométrica" },
  { id: "iso-opuesta", label: "Isométrica opuesta" },
  { id: "top", label: "Superior" },
  { id: "front", label: "Frontal" },
  { id: "paralela-izq", label: "Paralela izq." },
  { id: "paralela-der", label: "Paralela der." },
];

// ============================================================
// Colores por valoración
// ============================================================
const COLORES_SAQUE: Record<string, string> = {
  ace: "#2563eb",
  positivo_mas: "#16a34a",
  positivo: "#eab308",
  neutro: "#94a3b8",
  negativo: "#dc2626",
};

const ETIQUETAS_SAQUE: Record<string, string> = {
  ace: "Ace",
  positivo_mas: "Positivo +",
  positivo: "Positivo",
  neutro: "Neutro",
  negativo: "Negativo",
};

const COLORES_RECEPCION: Record<number, string> = {
  6: "#2563eb",
  5: "#16a34a",
  4: "#eab308",
  3: "#f59e0b",
  2: "#dc2626",
  1: "#991b1b",
};

const ETIQUETAS_RECEPCION: Record<number, string> = {
  6: "2x Positiva",
  5: "Positiva",
  4: "Negativa",
  3: "2x Negativa",
  2: "3x Negativa",
  1: "Ace en contra",
};

const COLORES_ATAQUE: Record<string, string> = {
  punto: "#16a34a",
  neutro: "#94a3b8",
  error: "#dc2626",
};

const ETIQUETAS_ATAQUE: Record<string, string> = {
  punto: "Punto",
  neutro: "Neutro",
  error: "Error",
};

// ============================================================
// Adaptador: Accion → ItemVisual
// ============================================================
function accionToItem(
  tipo: TipoFundamento,
  a: Accion
): ItemVisual | null {
  if (tipo === "saque") {
    const s = a as SaqueRow;
    if (!s.origen_celda || !s.destino_celda) return null;
    return {
      id: s.id ?? `${s.origen_celda}-${s.destino_celda}-${Math.random()}`,
      origen: { celda: s.origen_celda, mini: null },
      destino: { celda: s.destino_celda, mini: s.destino_mini },
      color: COLORES_SAQUE[s.valoracion] ?? "#64748b",
      calidad: s.tipo ?? "flotado",
      randomizar: true,
    };
  }

  if (tipo === "recepcion") {
    const r = a as RecepcionRow;
    if (!r.origen_celda || !r.destino_celda) return null;
    const esDoblePositiva = r.valoracion === 6;
    return {
      id: r.id ?? `${r.origen_celda}-${r.destino_celda}-${Math.random()}`,
      origen: { celda: r.origen_celda, mini: r.origen_mini },
      destino: { celda: r.destino_celda, mini: r.destino_mini },
      color: COLORES_RECEPCION[r.valoracion] ?? "#64748b",
      calidad: r.valoracion,
      randomizar: !esDoblePositiva,
    };
  }

  // ataque
  const at = a as AtaqueRow;
  if (!at.origen_celda || !at.destino_celda) return null;
  return {
    id: at.id ?? `${at.origen_celda}-${at.destino_celda}-${Math.random()}`,
    origen: { celda: at.origen_celda, mini: at.origen_mini },
    desvios: at.desvios.map((d) => ({ celda: d.celda, mini: d.mini })),
    destino: { celda: at.destino_celda, mini: at.destino_mini },
    color: COLORES_ATAQUE[at.valoracion] ?? "#64748b",
    randomizar: true,
  };
}

// ============================================================
// Componente
// ============================================================
export default function VisualizacionFundamento({
  tipo,
  acciones,
  jugadoresIds,
  nombresJugadores,
}: Props) {
  const [vista, setVista] = useState<Vista>("iso");
  const [mostrarEstelas, setMostrarEstelas] = useState(true);
  const [filtroSet, setFiltroSet] = useState<number | "todos">("todos");
  const [filtroPunto, setFiltroPunto] = useState<number | "todos">("todos");
  const [filtroJugador, setFiltroJugador] = useState<string | "todos">(
    "todos"
  );
  const [filtroValoracion, setFiltroValoracion] = useState<
    string | number | "todas"
  >("todas");

  const setsDisponibles = useMemo(() => {
    const s = new Set<number>();
    acciones.forEach((a) => s.add(a.set_numero));
    return Array.from(s).sort();
  }, [acciones]);

  const puntosDisponibles = useMemo(() => {
    const p = new Set<number>();
    acciones
      .filter((a) => filtroSet === "todos" || a.set_numero === filtroSet)
      .forEach((a) => p.add(a.punto_numero));
    return Array.from(p).sort((x, y) => x - y);
  }, [acciones, filtroSet]);

  const valoracionesDisponibles = useMemo(() => {
    const vals = new Set<string | number>();
    acciones.forEach((a) => {
      if (tipo === "saque") vals.add((a as SaqueRow).valoracion);
      else if (tipo === "recepcion")
        vals.add((a as RecepcionRow).valoracion);
      else vals.add((a as AtaqueRow).valoracion);
    });
    return Array.from(vals);
  }, [acciones, tipo]);

  const accionesFiltradas = useMemo(() => {
    return acciones.filter((a) => {
      if (filtroSet !== "todos" && a.set_numero !== filtroSet) return false;
      if (filtroPunto !== "todos" && a.punto_numero !== filtroPunto)
        return false;
      if (filtroJugador !== "todos" && a.jugador_id !== filtroJugador)
        return false;

      if (filtroValoracion !== "todas") {
        if (tipo === "saque") {
          if ((a as SaqueRow).valoracion !== filtroValoracion) return false;
        } else if (tipo === "recepcion") {
          if ((a as RecepcionRow).valoracion !== filtroValoracion)
            return false;
        } else {
          if ((a as AtaqueRow).valoracion !== filtroValoracion)
            return false;
        }
      }
      return true;
    });
  }, [
    acciones,
    filtroSet,
    filtroPunto,
    filtroJugador,
    filtroValoracion,
    tipo,
  ]);

  const items = useMemo(() => {
    return accionesFiltradas
      .map((a) => accionToItem(tipo, a))
      .filter((i): i is ItemVisual => i !== null);
  }, [accionesFiltradas, tipo]);

  const jugadoresDisponibles = useMemo(() => {
    return jugadoresIds.filter((id) =>
      acciones.some((a) => a.jugador_id === id)
    );
  }, [jugadoresIds, acciones]);

  const etiquetaTipo =
    tipo === "saque"
      ? "Saque"
      : tipo === "recepcion"
      ? "Recepción"
      : "Ataque";

  if (acciones.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
        <p className="text-4xl mb-3">🏐</p>
        <p className="text-slate-600 font-medium">
          Todavía no hay acciones de {etiquetaTipo.toLowerCase()} cargadas
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Set
            </label>
            <select
              value={filtroSet === "todos" ? "todos" : String(filtroSet)}
              onChange={(e) => {
                setFiltroSet(
                  e.target.value === "todos"
                    ? "todos"
                    : parseInt(e.target.value)
                );
                setFiltroPunto("todos");
              }}
              className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500"
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
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Punto
            </label>
            <select
              value={
                filtroPunto === "todos" ? "todos" : String(filtroPunto)
              }
              onChange={(e) =>
                setFiltroPunto(
                  e.target.value === "todos"
                    ? "todos"
                    : parseInt(e.target.value)
                )
              }
              className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500"
            >
              <option value="todos">Todos</option>
              {puntosDisponibles.map((p) => (
                <option key={p} value={String(p)}>
                  Punto {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Jugador
            </label>
            <select
              value={filtroJugador}
              onChange={(e) => setFiltroJugador(e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500"
            >
              <option value="todos">Todos</option>
              {jugadoresDisponibles.map((id) => (
                <option key={id} value={id}>
                  {nombresJugadores[id] ?? id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Valoración
            </label>
            <select
              value={String(filtroValoracion)}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "todas") setFiltroValoracion("todas");
                else if (tipo === "recepcion")
                  setFiltroValoracion(parseInt(v));
                else setFiltroValoracion(v);
              }}
              className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500"
            >
              <option value="todas">Todas</option>
              {tipo === "saque" &&
                valoracionesDisponibles.map((v) => (
                  <option key={String(v)} value={String(v)}>
                    {ETIQUETAS_SAQUE[String(v)] ?? String(v)}
                  </option>
                ))}
              {tipo === "recepcion" &&
                valoracionesDisponibles.map((v) => (
                  <option key={String(v)} value={String(v)}>
                    {ETIQUETAS_RECEPCION[Number(v)] ?? String(v)}
                  </option>
                ))}
              {tipo === "ataque" &&
                valoracionesDisponibles.map((v) => (
                  <option key={String(v)} value={String(v)}>
                    {ETIQUETAS_ATAQUE[String(v)] ?? String(v)}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Vista */}
        <div className="flex flex-wrap items-center gap-1 mb-2">
          <span className="text-xs font-medium text-slate-500 mr-1">
            Vista:
          </span>
          {VISTAS.map((v) => (
            <button
              key={v.id}
              onClick={() => setVista(v.id)}
              className={`px-2.5 py-1 text-xs rounded-lg border transition ${
                vista === v.id
                  ? "bg-slate-800 text-white border-slate-800"
                  : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
              }`}
            >
              {v.label}
            </button>
          ))}
          <span className="mx-2 border-l border-slate-300 h-4" />
          <button
            onClick={() => setMostrarEstelas(!mostrarEstelas)}
            className={`px-2.5 py-1 text-xs rounded-lg border transition ${
              mostrarEstelas
                ? "bg-emerald-500 text-white border-emerald-500"
                : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
            }`}
          >
            {mostrarEstelas ? "✓ Estelas" : "Estelas ocultas"}
          </button>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>
            Mostrando {items.length} de {acciones.length}{" "}
            {etiquetaTipo.toLowerCase()}
            {acciones.length !== 1 ? "s" : ""}
          </span>
          {(filtroSet !== "todos" ||
            filtroPunto !== "todos" ||
            filtroJugador !== "todos" ||
            filtroValoracion !== "todas") && (
            <button
              onClick={() => {
                setFiltroSet("todos");
                setFiltroPunto("todos");
                setFiltroJugador("todos");
                setFiltroValoracion("todas");
              }}
              className="text-emerald-600 hover:text-emerald-800 font-medium"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Leyenda */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-3">
        <div className="flex flex-wrap gap-3 items-center justify-center text-xs">
          <span className="font-semibold text-slate-600">Colores:</span>
          {tipo === "saque" &&
            Object.entries(COLORES_SAQUE).map(([k, color]) => (
              <span key={k} className="flex items-center gap-1">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-slate-600">{ETIQUETAS_SAQUE[k]}</span>
              </span>
            ))}
          {tipo === "recepcion" &&
            [6, 5, 4, 3, 2, 1].map((n) => (
              <span key={n} className="flex items-center gap-1">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: COLORES_RECEPCION[n] }}
                />
                <span className="text-slate-600">
                  {ETIQUETAS_RECEPCION[n]}
                </span>
              </span>
            ))}
          {tipo === "ataque" &&
            Object.entries(COLORES_ATAQUE).map(([k, color]) => (
              <span key={k} className="flex items-center gap-1">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-slate-600">{ETIQUETAS_ATAQUE[k]}</span>
              </span>
            ))}
        </div>
      </div>

      {/* Cancha */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex items-center justify-center">
        {items.length === 0 ? (
          <p className="text-sm text-slate-500 py-12">
            No hay acciones que cumplan los filtros
          </p>
        ) : (
          <CanchaVisualizacion
            tipo={tipo}
            items={items}
            vista={vista}
            width={1000}
            height={760}
            mostrarEstelas={mostrarEstelas}
          />
        )}
      </div>
    </div>
  );
}