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
    <main className="min-h-[100dvh] bg-[#CBD5E1] p-3 sm:p-5 flex flex-col">
      
      <div className="relative flex-1 flex flex-col overflow-hidden bg-[#F8F5EC] shadow-[inset_0_0_30px_rgba(0,0,0,0.5)] border-[2px] border-[#94a3b8]">
        
        {/* ================= FONDO: ESQUINA DE CANCHA ================= */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <svg
            className="w-full h-full"
            preserveAspectRatio="none"
            viewBox="0 0 100 100"
          >
            {/* Fondo Terracota (Cubre toda la pantalla) */}
            <rect width="100" height="100" fill="#E0827B" />

            {/* 1. Triángulo Celeste Superior (Se extiende hacia arriba) */}
            <polygon points="-10,21 40,-9 -10,-10" fill="#11B7B8" />

            {/* 2. Área Celeste Inferior (Choca exactamente con la línea central) */}
            <polygon points="-10,30 100,85 100,100 -10,100" fill="#11B7B8" />

            {/* 3. Línea Superior Blanca (Se pasa de largo para que el marco tape el corte) */}
            <line 
              x1="-10" 
              y1="21" 
              x2="40" 
              y2="-9" 
              stroke="#ffffff" 
              strokeWidth="4" 
            />
            
            {/* 4. Línea Central Blanca (Coordenadas originales) */}
            <line 
              x1="-10" 
              y1="30" 
              x2="100" 
              y2="85" 
              stroke="#ffffff" 
              strokeWidth="4" 
            />
          </svg>
        </div>

        {/* ================= FORMULARIO LOGIN ================= */}
        <div className="relative z-20 w-full max-w-sm mx-auto px-6 pt-[12vh] sm:pt-[15vh] flex flex-col items-center">
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

        {/* ================= PELOTA Y SOMBRA ================= */}
        <div className="absolute z-30 top-[50%] left-[35%] -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          
          <div className="relative flex items-center justify-center w-24 h-24 sm:w-32 sm:h-32">
            
            {/* SOMBRA DEL PISO (Ángulo exacto de tu línea original) */}
            <div
              className="absolute z-0 w-[120%] h-[45%] bg-[#0F2E69] rounded-[100%] blur-sm"
              style={{
                bottom: "-20%",
                left: "10%",
                transform: "rotate(26.56deg)",
              }}
            ></div>

            {/* PELOTA CON VOLUMEN */}
            <svg
              viewBox="0 0 100 100"
              className="w-full h-full relative z-10"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <radialGradient id="ball-light" cx="30%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="#FFFFFF" />
                  <stop offset="60%" stopColor="#F1F5F9" />
                  <stop offset="100%" stopColor="#94A3B8" />
                </radialGradient>
              </defs>

              <circle cx="50" cy="50" r="46" fill="url(#ball-light)" />
              
              <path d="M 5 60 Q 25 55 45 80 Q 25 95 5 60 Z" fill="#163A85" />
              <path d="M 95 60 Q 75 55 55 80 Q 75 95 95 60 Z" fill="#163A85" />
              
              <path d="M 15 25 Q 35 35 25 65 Q 5 55 15 25 Z" fill="#F7C32C" />
              <path d="M 85 25 Q 65 35 75 65 Q 95 55 85 25 Z" fill="#F7C32C" />
              
              <circle cx="50" cy="50" r="46" stroke="#163A85" strokeWidth="4" />
              <path d="M 50 4 Q 50 25 40 45" stroke="#163A85" strokeWidth="4" strokeLinecap="round" />
              <path d="M 50 4 Q 50 25 60 45" stroke="#163A85" strokeWidth="4" strokeLinecap="round" />
              <path d="M 4 50 Q 30 50 40 45" stroke="#163A85" strokeWidth="4" strokeLinecap="round" />
              <path d="M 96 50 Q 70 50 60 45" stroke="#163A85" strokeWidth="4" strokeLinecap="round" />
              <path d="M 4 50 Q 30 70 50 96" stroke="#163A85" strokeWidth="4" strokeLinecap="round" />
              <path d="M 96 50 Q 70 70 50 96" stroke="#163A85" strokeWidth="4" strokeLinecap="round" />
            </svg>

          </div>
        </div>

        {/* ================= FRANJA INFERIOR (Gris plateado) ================= */}
        <div className="absolute bottom-0 left-0 w-full h-[15%] z-40 bg-[#CBD5E1] border-t-[3px] border-[#94A3B8] flex flex-col items-center justify-center pb-2 sm:pb-4">
          <h1 className="text-4xl sm:text-5xl font-black text-black tracking-tight flex items-center drop-shadow-md">
            SALIDA
            <span className="text-red-600 text-2xl sm:text-3xl font-black mx-[1px] sm:mx-[2px] mt-1">
              x
            </span>
            5
          </h1>
          <p className="text-[#163A85] text-[10px] sm:text-xs mt-1 font-bold tracking-[0.3em] uppercase opacity-90">
            Estadísticas de vóley
          </p>
        </div>

      </div>
    </main>
  );
}