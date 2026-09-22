"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { guardarSesion, type Rol } from "@/lib/auth";

export default function Home() {
  const [codigo, setCodigo] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);

  const handleIngresar = async () => {
    const limpio = codigo.trim();
    if (!limpio) {
      setMensaje("Ingresá un código");
      return;
    }

    setCargando(true);
    setMensaje("Verificando...");

    const { data, error } = await supabase
      .from("accesos")
      .select("*")
      .eq("codigo", limpio)
      .eq("activo", true)
      .maybeSingle();

    setCargando(false);

    if (error) {
      setMensaje("Error de conexión. Probá de nuevo.");
      return;
    }

    if (!data) {
      setMensaje("Código inválido. Verificá y probá de nuevo.");
      return;
    }

    guardarSesion({
      codigo: data.codigo,
      tipo: data.tipo as Rol,
      club_id: data.club_id ?? undefined,
      jugador_id: data.jugador_id ?? undefined,
    });

    setMensaje(`✅ Bienvenido (${data.tipo}). Sesión guardada.`);
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            🏐 VoleyStats
          </h1>
          <p className="text-slate-500 text-sm">
            Ingresá tu código de acceso
          </p>
        </div>

        <input
          type="text"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="Tu código"
          disabled={cargando}
          className="w-full px-4 py-3 border border-slate-300 rounded-lg mb-4 focus:outline-none focus:border-blue-500 disabled:bg-slate-100"
        />

        <button
          onClick={handleIngresar}
          disabled={cargando}
          className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-slate-400 text-white font-medium py-3 rounded-lg transition"
        >
          {cargando ? "Verificando..." : "Ingresar"}
        </button>

        {mensaje && (
          <p className="mt-4 text-center text-sm text-slate-600">
            {mensaje}
          </p>
        )}
      </div>
    </main>
  );
}