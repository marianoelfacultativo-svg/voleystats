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
    <main className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center p-6 bg-[#F7F5F0]">
      
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
          <path d="M 4 50 A 46 46 0 0 0 50 96 C 50 75 25 50 4 50 Z" fill="#1e3a8a" />
          <path d="M 96 50 A 46 46 0 0 1 50 96 C 50 75 75 50 96 50 Z" fill="#1e3a8a" />
          <path d="M 50 4 A 46 46 0 0 1 96 50 C 75 50 50 25 50 4 Z" fill="#FBBF24" />
          <path d="M 50 4 A 46 46 0 0 0 4 50 C 25 50 50 25 50 4 Z" fill="#FBBF24" />
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
      <div className="relative z-20 w-full max-w-[340px] bg-white/70 backdrop-blur-xl rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/60 p-6 sm:p-8">
        <div className="space-y-4">
          <div>
            <input
              type="text"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={cargando}
              autoFocus
              className="w-full px-4 py-4 text-center text-lg font-mono bg-white border border-slate-200 rounded-2xl focus:outline-none focus:border-[#0EA5B7] focus:ring-4 focus:ring-[#0EA5B7]/10 transition-all disabled:opacity-50 shadow-inner"
            />
          </div>

          <button
            onClick={handleIngresar}
            disabled={cargando}
            className="w-full bg-[#1e3a8a] hover:bg-[#152d6b] disabled:bg-slate-400 text-white font-bold py-3.5 rounded-2xl transition-all shadow-lg hover:shadow-xl active:scale-[0.98]"
          >
            {cargando ? "Verificando..." : "Ingresar"}
          </button>
        </div>

        {mensaje && (
          <div
            className={`mt-4 text-center text-xs font-medium p-3 rounded-xl ${
              mensaje.includes("✅")
                ? "bg-green-100 text-green-800"
                : mensaje.includes("inválido") || mensaje.includes("Error")
                ? "bg-red-100 text-red-800"
                : "bg-white/50 text-slate-700"
            }`}
          >
            {mensaje}
          </div>
        )}
      </div>

      {/* ================= TÍTULO INFERIOR ================= */}
      <div className="relative z-10 mt-10 sm:mt-12 text-center flex items-center justify-center">
        <h1 className="text-4xl sm:text-5xl font-black text-black tracking-tight flex items-center drop-shadow-sm">
          SALIDA
          <span className="text-red-600 text-2xl sm:text-3xl font-black mx-[1px] sm:mx-[2px]">
            x
          </span>
          5
        </h1>
      </div>
    </main>
  );
}