"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import CanchaArmador, {
  type ArmadoDetalle,
  type Vista,
} from "./CanchaArmador";

interface Props {
  equipoId: string;
  jugadorId?: string | null;
}

const COLORES_CALIDAD: Record<number, string> = {
  1: "#dc2626",
  2: "#ea580c",
  3: "#eab308",
  4: "#84cc16",
  5: "#16a34a",
  6: "#059669",
};

const VISTAS: { id: Vista; label: string }[] = [
  { id: "iso", label: "Isométrica" },
  { id: "top", label: "Superior" },
  { id: "front", label: "Frontal" },
];

export default function VisualizacionArmador({ equipoId, jugadorId }: Props) {
  const [armados, setArmados] = useState<ArmadoDetalle[]>([]);
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState<Vista>("iso");

  const [filtroSet, setFiltroSet] = useState<number | "todos">("todos");
  const [filtroZona, setFiltroZona] = useState<number | null>(null);
  const [filtroPunto, setFiltroPunto] = useState<number | "todos">("todos");
  const [filtrosCalidad, setFiltrosCalidad] = useState<number[]>([]);
  const [puntoActual, setPuntoActual] = useState(1);

  useEffect(() => {
    if (!equipoId) return;
    setCargando(true);

    supabase
      .from("partidos")
      .select("id")
      .eq("equipo_id", equipoId)
      .then(async ({ data: partRes }) => {
        if (!partRes || partRes.length === 0) {
          setArmados([]);
          setCargando(false);
          return;
        }
        const ids = partRes.map((p) => p.id);

        let query = supabase
          .from("armados_detalle")
          .select("*")
          .in("partido_id", ids)
          .order("set_numero")
          .order("punto_numero")
          .order("created_at");

        if (jugadorId) {
          query = query.eq("jugador_id", jugadorId);
        }

        const { data: armRes } = await query;

        setArmados((armRes ?? []) as ArmadoDetalle[]);
        setCargando(false);
      });
  }, [equipoId, jugadorId]);

  const setsDisponibles = useMemo(() => {
    const sets = new Set<number>();
    armados.forEach((a) => sets.add(a.set_numero));
    return Array.from(sets).sort();
  }, [armados]);

  const puntosDelSet = useMemo(() => {
    const pts = new Set<number>();
    armados
      .filter((a) => filtroSet === "todos" || a.set_numero === filtroSet)
      .forEach((a) => pts.add(a.punto_numero));
    return Array.from(pts).sort((x, y) => x - y);
  }, [armados, filtroSet]);

  useEffect(() => {
    setPuntoActual(puntosDelSet[0] ?? 1);
  }, [puntosDelSet]);

  const armadosFiltrados = useMemo(() => {
    return armados.filter((a) => {
      if (filtroSet !== "todos" && a.set_numero !== filtroSet) return false;
      if (filtroZona !== null && a.zona_tendencia !== filtroZona) return false;
      if (filtroPunto !== "todos" && a.punto_numero !== filtroPunto)
        return false;
      if (filtrosCalidad.length > 0 && !filtrosCalidad.includes(a.calidad))
        return false;
      return true;
    });
  }, [armados, filtroSet, filtroZona, filtroPunto, filtrosCalidad]);

  const totalArmados = armados.length;

  if (cargando) {
    return (
      <p className="text-slate-500 text-center py-12">Cargando armados...</p>
    );
  }

  if (totalArmados === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
        <p className="text-4xl mb-3">🏐</p>
        <p className="text-slate-600 font-medium">
          Todavía no hay armados cargados
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
        <div className="grid grid-cols-3 gap-4 mb-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Set
            </label>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setFiltroSet("todos")}
                className={`px-2.5 py-1 text-xs rounded-lg border transition ${
                  filtroSet === "todos"
                    ? "bg-emerald-500 text-white border-emerald-500"
                    : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                }`}
              >
                Todos
              </button>
              {setsDisponibles.map((s) => (
                <button
                  key={s}
                  onClick={() => setFiltroSet(s)}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition ${
                    filtroSet === s
                      ? "bg-emerald-500 text-white border-emerald-500"
                      : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  S{s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Punto
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFiltroPunto("todos")}
                className={`px-2.5 py-1 text-xs rounded-lg border transition ${
                  filtroPunto === "todos"
                    ? "bg-emerald-500 text-white border-emerald-500"
                    : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => {
                  const idx = puntosDelSet.indexOf(puntoActual);
                  if (idx > 0) {
                    setPuntoActual(puntosDelSet[idx - 1]);
                    setFiltroPunto(puntosDelSet[idx - 1]);
                  }
                }}
                className="px-2 py-1 text-xs bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                ◀
              </button>
              <select
                value={typeof filtroPunto === "number" ? filtroPunto : ""}
                onChange={(e) =>
                  setFiltroPunto(
                    e.target.value === "" ? "todos" : parseInt(e.target.value)
                  )
                }
                className="px-2 py-1 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500"
              >
                <option value="">Todos</option>
                {puntosDelSet.map((p) => (
                  <option key={p} value={p}>
                    Punto {p}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  const idx = puntosDelSet.indexOf(puntoActual);
                  if (idx < puntosDelSet.length - 1) {
                    setPuntoActual(puntosDelSet[idx + 1]);
                    setFiltroPunto(puntosDelSet[idx + 1]);
                  }
                }}
                className="px-2 py-1 text-xs bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                ▶
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Vista
            </label>
            <div className="flex gap-1">
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
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Zona
          </label>
          <div className="flex flex-wrap gap-1">
            {[1, 2, 3, 4, 5, 6].map((z) => (
              <button
                key={z}
                onClick={() => setFiltroZona(filtroZona === z ? null : z)}
                className={`px-3 py-1 text-xs rounded-lg border transition ${
                  filtroZona === z
                    ? "bg-cyan-500 text-white border-cyan-500"
                    : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                }`}
              >
                Zona {z}
              </button>
            ))}
            {filtroZona !== null && (
              <button
                onClick={() => setFiltroZona(null)}
                className="px-3 py-1 text-xs rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
              >
                ✕ Quitar zona
              </button>
            )}
          </div>
        </div>

        <div className="mt-3">
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Calidad (click para filtrar, múltiples)
          </label>
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setFiltrosCalidad([])}
              className={`px-2.5 py-1 text-xs rounded-lg border transition ${
                filtrosCalidad.length === 0
                  ? "bg-slate-800 text-white border-slate-800"
                  : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setFiltrosCalidad([1, 2])}
              className={`px-2.5 py-1 text-xs rounded-lg border transition ${
                filtrosCalidad.length === 2 &&
                filtrosCalidad.includes(1) &&
                filtrosCalidad.includes(2)
                  ? "bg-red-500 text-white border-red-500"
                  : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
              }`}
            >
              Malas (1-2)
            </button>
            <button
              onClick={() => setFiltrosCalidad([3, 4])}
              className={`px-2.5 py-1 text-xs rounded-lg border transition ${
                filtrosCalidad.length === 2 &&
                filtrosCalidad.includes(3) &&
                filtrosCalidad.includes(4)
                  ? "bg-yellow-500 text-white border-yellow-500"
                  : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
              }`}
            >
              Medias (3-4)
            </button>
            <button
              onClick={() => setFiltrosCalidad([5, 6])}
              className={`px-2.5 py-1 text-xs rounded-lg border transition ${
                filtrosCalidad.length === 2 &&
                filtrosCalidad.includes(5) &&
                filtrosCalidad.includes(6)
                  ? "bg-green-600 text-white border-green-600"
                  : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
              }`}
            >
              Buenas (5-6)
            </button>
            {[1, 2, 3, 4, 5, 6].map((c) => {
              const color = COLORES_CALIDAD[c];
              const activo = filtrosCalidad.includes(c);
              return (
                <button
                  key={c}
                  onClick={() => {
                    if (activo) {
                      setFiltrosCalidad(
                        filtrosCalidad.filter((x) => x !== c)
                      );
                    } else {
                      setFiltrosCalidad([...filtrosCalidad, c]);
                    }
                  }}
                  className={`w-8 h-7 text-xs rounded-lg border-2 font-bold transition ${
                    activo ? "text-white" : "bg-white text-slate-600"
                  }`}
                  style={
                    activo
                      ? { backgroundColor: color, borderColor: color }
                      : { borderColor: color }
                  }
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>
            Mostrando {armadosFiltrados.length} de {totalArmados} armados
          </span>
          <div className="flex items-center gap-3">
            <span className="font-medium text-slate-600">Calidad:</span>
            {[1, 2, 3, 4, 5, 6].map((c) => (
              <span key={c} className="flex items-center gap-1">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: COLORES_CALIDAD[c] }}
                />
                <span>{c}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex items-center justify-center">
        <CanchaArmador
          armados={armadosFiltrados}
          vista={vista}
          width={1000}
          height={760}
        />
      </div>
    </div>
  );
}