"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { guardarSesion, type Rol } from "@/lib/auth";

export default function Home() {
  const router = useRouter();
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
      equipo_id: data.equipo_id ?? undefined,
      jugador_id: data.jugador_id ?? undefined,
    });

    if (data.tipo === "admin") {
      router.push("/admin");
    } else if (data.tipo === "club") {
      router.push("/equipo");
    } else if (data.tipo === "jugador") {
      router.push("/jugador");
    } else {
      setMensaje(`✅ Bienvenido (${data.tipo}). Sesión guardada.`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleIngresar();
    }
  };

  return (
    <main className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center p-4 bg-[#F7F5F0]">
      
      {/* ================= FONDO ================= */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {/* Área Terracota */}
        <div
          className="absolute top-0 right-0 w-full h-[65%] bg-[#E27871]"
          style={{ clipPath: "polygon(0 0, 100% 0, 100% 85%, 0 100%)" }}
        />
        {/* Área Celeste */}
        <div
          className="absolute bottom-0 left-0 w-full h-[45%] bg-[#0EA5B7]"
          style={{ clipPath: "polygon(0 15%, 100% 0, 100% 100%, 0 100%)" }}
        />
        {/* Línea blanca divisoria */}
        <div className="absolute inset-0">
          <svg
            className="w-full h-full"
            preserveAspectRatio="none"
            viewBox="0 0 100 100"
          >
            <line
              x1="0"
              y1="100"
              x2="100"
              y2="85"
              stroke="#ffffff"
              strokeWidth="1.5"
            />
          </svg>
        </div>
      </div>

      {/* Pelota de Vóley */}
      <div className="relative z-10 mb-8 pointer-events-none drop-shadow-2xl">
        <svg
          viewBox="0 0 100 100"
          className="w-24 h-24 sm:w-32 sm:h-32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="50" cy="50" r="46" fill="#ffffff" />
          {/* Gajos inferiores */}
          <path d="M 4 50 A 46 46 0 0 0 50 96 C 50 75 25 50 4 50 Z" fill="#1e3a8a" />
          <path d="M 96 50 A 46 46 0 0 1 50 96 C 50 75 75 50 96 50 Z" fill="#1e3a8a" />
          {/* Gajos superiores */}
          <path d="M 50 4 A 46 46 0 0 1 96 50 C 75 50 50 25 50 4 Z" fill="#FBBF24" />
          <path d="M 50 4 A 46 46 0 0 0 4 50 C 25 50 50 25 50 4 Z" fill="#FBBF24" />
          {/* Líneas negras/grises */}
          <circle cx="50" cy="50" r="46" stroke="#1e3a8a" strokeWidth="3" />
          <path d="M 50 4 C 50 25 25 50 4 50" stroke="#1e3a8a" strokeWidth="3" />
          <path d="M 96 50 C 75 50 50 75 50 96" stroke="#1e3a8a" strokeWidth="3" />
          <path d="M 50 4 C 50 25 75 50 96 50" stroke="#1e3a8a" strokeWidth="3" />
          <path d="M 4 50 C 25 50 50 75 50 96" stroke="#1e3a8a" strokeWidth="3" />
          <path d="M 24 24 Q 50 50 76 76" stroke="#1e3a8a" strokeWidth="3" opacity="0.4" />
          <path d="M 76 24 Q 50 50 24 76" stroke="#1e3a8a" strokeWidth="3" opacity="0.4" />
        </svg>
      </div>

      {/* ================= FORMULARIO LOGIN ================= */}
      <div className="relative z-20 w-full max-w-sm bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-white/40 p-6 sm:p-8">
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-slate-800">Acceso</h2>
          <p className="text-slate-500 text-sm mt-1">
            Ingresá tu código de equipo o jugador
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <input
              type="text"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ej: quilmes-2025"
              disabled={cargando}
              className="w-full px-4 py-3.5 text-center text-lg font-mono border-2 border-slate-200 rounded-xl focus:outline-none focus:border-[#0EA5B7] focus:ring-4 focus:ring-[#0EA5B7]/20 transition-all disabled:bg-slate-100 placeholder:text-slate-300 placeholder:font-sans placeholder:text-base"
            />
          </div>

          <button
            onClick={handleIngresar}
            disabled={cargando}
            className="w-full bg-[#0EA5B7] hover:bg-[#0d96a6] disabled:bg-slate-400 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-[0.98]"
          >
            {cargando ? "Verificando..." : "Ingresar"}
          </button>
        </div>

        {mensaje && (
          <div
            className={`mt-4 text-center text-sm p-3 rounded-lg ${
              mensaje.includes("✅")
                ? "bg-green-50 text-green-700 border border-green-200"
                : mensaje.includes("inválido") || mensaje.includes("Error")
                ? "bg-red-50 text-red-700 border border-red-200"
                : "bg-slate-50 text-slate-600 border border-slate-200"
            }`}
          >
            {mensaje}
          </div>
        )}
      </div>

      {/* ================= TÍTULO INFERIOR ================= */}
      <div className="relative z-10 mt-10 sm:mt-14 text-center">
        <h1 className="text-4xl sm:text-5xl font-black text-[#1e3a8a] tracking-widest uppercase drop-shadow-sm">
          SALIDAx5
        </h1>
        <p className="text-[#1e3a8a]/70 text-xs sm:text-sm mt-2 font-semibold tracking-[0.2em] uppercase">
          Estadísticas de vóley
        </p>
      </div>
    </main>
  );
}