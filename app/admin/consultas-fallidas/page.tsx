// ============================================================
// ADMIN — CONSULTAS FALLIDAS
// ============================================================
// Lista de consultas LLM que fallaron, con detalle técnico
// y opción de borrar cada fila.
// Ruta: /admin/consultas-fallidas
//
// v49.1: se quita la verificación de rol con getSesion() porque
//   `lib/auth.ts` no exporta esa función. La página queda
//   accesible con la URL.
// v49.2: se agrega botón 🗑️ para borrar filas (delete + refetch).
// ============================================================

"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type ConsultaFallida = {
  id: string;
  equipo_id: string | null;
  partido_id: string | null;
  prompt: string;
  mensaje_usuario: string;
  error_tecnico: string;
  intentos: number;
  fecha_creacion: string;
  revisada: boolean;
};

export default function ConsultasFallidasPage() {
  const [cargando, setCargando] = useState(true);
  const [filas, setFilas] = useState<ConsultaFallida[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [borrandoId, setBorrandoId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    const { data, error } = await supabase
      .from("consultas_fallidas")
      .select("*")
      .order("fecha_creacion", { ascending: false })
      .limit(200);

    if (error) {
      setError(error.message);
    } else {
      setFilas((data ?? []) as ConsultaFallida[]);
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const handleBorrar = async (id: string) => {
    if (!window.confirm("¿Borrar esta consulta fallida? No se puede deshacer.")) {
      return;
    }
    setBorrandoId(id);
    const { error } = await supabase
      .from("consultas_fallidas")
      .delete()
      .eq("id", id);

    if (error) {
      window.alert(`No se pudo borrar: ${error.message}`);
      setBorrandoId(null);
      return;
    }

    // Actualización optimista: sacar la fila de la lista sin refetch
    setFilas((prev) => prev.filter((f) => f.id !== id));
    setBorrandoId(null);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Consultas fallidas</h1>
          <a
            href="/admin"
            className="text-sm px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600"
          >
            ← Volver al panel
          </a>
        </div>

        <p className="text-sm text-slate-400 mb-4">
          Consultas que la IA no pudo interpretar (después del retry).
          Total: {filas.length}.
        </p>

        {cargando && <p className="text-slate-400">Cargando...</p>}

        {error && (
          <p className="text-red-400">Error cargando: {error}</p>
        )}

        {!cargando && !error && filas.length === 0 && (
          <p className="text-slate-400">
            No hay consultas fallidas. Todo en orden. 🎉
          </p>
        )}

        {!cargando && !error && filas.length > 0 && (
          <ul className="space-y-3">
            {filas.map((f) => {
              const borrando = borrandoId === f.id;
              return (
                <li
                  key={f.id}
                  className="rounded-lg bg-slate-800 border border-slate-700 p-4"
                >
                  <div className="flex justify-between items-start text-xs text-slate-400 mb-2 gap-3">
                    <span>
                      {new Date(f.fecha_creacion).toLocaleString("es-AR")}
                    </span>
                    <div className="flex items-center gap-3">
                      <span>
                        intentos: {f.intentos}
                        {f.revisada && (
                          <span className="ml-2 text-emerald-400">
                            ✓ revisada
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleBorrar(f.id)}
                        disabled={borrando}
                        className="px-2 py-1 rounded bg-red-600/80 hover:bg-red-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Borrar esta consulta"
                      >
                        {borrando ? "Borrando..." : "🗑️ Borrar"}
                      </button>
                    </div>
                  </div>
                  <div className="mb-2">
                    <span className="text-xs text-slate-500">Prompt:</span>
                    <p className="text-slate-100 font-mono text-sm break-words">
                      {f.prompt}
                    </p>
                  </div>
                  <div className="mb-2">
                    <span className="text-xs text-slate-500">
                      Mensaje al usuario:
                    </span>
                    <p className="text-slate-300 text-sm">
                      {f.mensaje_usuario}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">
                      Detalle técnico:
                    </span>
                    <p className="text-amber-300 font-mono text-xs break-words">
                      {f.error_tecnico}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}