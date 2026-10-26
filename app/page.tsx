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
    <main className="relative min-h-[100dvh] flex flex-col overflow-hidden bg-[#F8F5EC]">
      
      {/* ================= FONDO: ESQUINA DE CANCHA ================= */}
      <div className="absolute inset-0 z-0">
        <svg
          className="w-full h-full"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          {/* Fondo base claro */}
          <rect width="100" height="100" fill="#F8F5EC" />

          {/* 1. Triángulo Celeste Superior (Línea lateral) */}
          <polygon points="0,0 32,0 0,20" fill="#11B7B8" />

          {/* 2. Área Terracota (Relleno completo hasta la línea) */}
          <polygon points="32,0 100,0 100,85 0,28 0,20 32,0" fill="#E0827B" />

          {/* 3. Área Celeste Inferior */}
          <polygon points="0,28 100,85 100,92 0,92" fill="#11B7B8" />

          {/* 4. Líneas Blancas Divisorias */}
          {/* Línea lateral superior */}
          <line x1="0" y1="20" x2="32" y2="0" stroke="#ffffff" strokeWidth="2" />
          {/* Línea central (La Red) - Muy empinada */}
          <line x1="0" y1="28" x2="100" y2="85" stroke="#ffffff" strokeWidth="2.5" />

          {/* 5. SOMBRA DE LA PELOTA (Sólida y direccional) */}
          {/* Va para abajo a la derecha, sin desenfoque para que sea idéntica a la foto */}
          <ellipse
            cx="68"
            cy="68"
            rx="18"
            ry="7"
            fill="#0F2E69"
            transform="rotate(32 68 68)"
          />

          {/* 6. Franja Clara (Pie de página) */}
          <rect x="0" y="92" width="100" height="8" fill="#F8F5EC" />
        </svg>
      </div>

      {/* ================= FORMULARIO LOGIN ================= */}
      <div className="relative z-20 w-full max-w-sm mx-auto px-6 pt-[15vh] sm:pt-[18vh] flex flex-col items-center">
        <div className="w-full space-y-4">
          <div className="relative">
            <input
              type="text"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={cargando}
              autoFocus
              className="w-full px-5 py-4 text-center text-lg font-mono bg-white/95 backdrop-blur-sm border-0 rounded-2xl focus:outline-none focus:ring-4 focus:ring-white/50 transition-all placeholder:text-slate-300 shadow-xl"
            />
          </div>

          <button
            onClick={handleIngresar}
            disabled={cargando}
            className="w-full bg-[#163A85] hover:bg-[#0f285e] disabled:bg-slate-400 text-white font-bold py-4 rounded-2xl transition-all shadow-xl active:scale-[0.98]"
          >
            {cargando ? "Verificando..." : "Ingresar"}
          </button>
        </div>

        {mensaje && (
          <div
            className={`mt-4 w-full text-center text-xs font-semibold p-3 rounded-xl backdrop-blur-md shadow-sm ${
              mensaje.includes("✅")
                ? "bg-green-100/90 text-green-800"
                : mensaje.includes("inválido") || mensaje.includes("Error")
                ? "bg-red-100/90 text-red-800"
                : "bg-white/60 text-slate-700"
            }`}
          >
            {mensaje}
          </div>
        )}
      </div>

      {/* ================= PELOTA ================= */}
      {/* Posicionada justo en el cruce de la línea (x=50%, y=56.5%) */}
      <div className="absolute z-30 top-[56.5%] left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <svg
          viewBox="0 0 100 100"
          className="w-24 h-24 sm:w-32 sm:h-32 relative z-10 drop-shadow-sm"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Base Blanca */}
          <circle cx="50" cy="50" r="46" fill="#F4F4F4" />
          
          {/* Gajos Azules */}
          <path d="M 5 60 Q 25 55 45 80 Q 25 95 5 60 Z" fill="#163A85" />
          <path d="M 95 60 Q 75 55 55 80 Q 75 95 95 60 Z" fill="#163A85" />
          
          {/* Gajos Amarillos */}
          <path d="M 15 25 Q 35 35 25 65 Q 5 55 15 25 Z" fill="#F7C32C" />
          <path d="M 85 25 Q 65 35 75 65 Q 95 55 85 25 Z" fill="#F7C32C" />
          
          {/* Costuras */}
          <circle cx="50" cy="50" r="46" stroke="#163A85" strokeWidth="4" />
          <path d="M 50 4 Q 50 25 40 45" stroke="#163A85" strokeWidth="4" strokeLinecap="round" />
          <path d="M 50 4 Q 50 25 60 45" stroke="#163A85" strokeWidth="4" strokeLinecap="round" />
          <path d="M 4 50 Q 30 50 40 45" stroke="#163A85" strokeWidth="4" strokeLinecap="round" />
          <path d="M 96 50 Q 70 50 60 45" stroke="#163A85" strokeWidth="4" strokeLinecap="round" />
          <path d="M 4 50 Q 30 70 50 96" stroke="#163A85" strokeWidth="4" strokeLinecap="round" />
          <path d="M 96 50 Q 70 70 50 96" stroke="#163A85" strokeWidth="4" strokeLinecap="round" />
        </svg>
      </div>

      {/* ================= TÍTULO INFERIOR ================= */}
      <div className="absolute bottom-0 left-0 w-full h-[8%] z-20 flex flex-col items-center justify-center pb-2 sm:pb-4">
        <h1 className="text-3xl sm:text-4xl font-black text-black tracking-tight flex items-center drop-shadow-sm">
          SALIDA
          <span className="text-red-600 text-xl sm:text-2xl font-black mx-[1px] sm:mx-[2px] mt-0.5">
            x
          </span>
          5
        </h1>
        <p className="text-[#163A85] text-[9px] sm:text-[10px] mt-0.5 font-bold tracking-[0.3em] uppercase opacity-70">
          Estadísticas de vóley
        </p>
      </div>
    </main>
  );
}