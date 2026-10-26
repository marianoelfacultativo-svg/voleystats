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
      
      {/* PANTALLA DE LA TV (Mantiene el tamaño original) */}
      <div className="relative flex-1 flex flex-col bg-[#F8F5EC] shadow-[inset_0_0_30px_rgba(0,0,0,0.5)] border-t-[2px] border-l-[2px] border-r-[2px] border-[#94a3b8]">
        
        {/* ================= FONDO: ESQUINA DE CANCHA ================= */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <svg
            className="w-full h-full"
            preserveAspectRatio="none"
            viewBox="0 0 100 100"
          >
            {/* Fondo Terracota */}
            <rect width="100" height="100" fill="#E0827B" />

            {/* 1. Triángulo Celeste Superior */}
            <polygon points="-10,22 40,-8 -10,-10" fill="#11B7B8" />

            {/* 2. Área Celeste Inferior */}
            <polygon points="-10,31 120,101.2 120,120 -10,120" fill="#11B7B8" />

            {/* 3. Línea Superior Blanca */}
            <line 
              x1="-10" 
              y1="22" 
              x2="40" 
              y2="-8" 
              stroke="#ffffff" 
              strokeWidth="2" 
            />
            
            {/* 4. Línea Central Blanca */}
            <line 
              x1="-10" 
              y1="31" 
              x2="120" 
              y2="101.2" 
              stroke="#ffffff" 
              strokeWidth="2" 
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
            
            {/* SOMBRA DEL PISO */}
            <div
              className="absolute z-0 w-[120%] h-[45%] bg-[#0F2E69] rounded-[100%] blur-sm"
              style={{
                bottom: "-20%",
                left: "10%",
                transform: "rotate(28.3deg)",
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

        {/* ================= FRANJA INFERIOR (Controles de TV vieja) ================= */}
        <div className="absolute -bottom-3 -left-3 -right-3 sm:-bottom-5 sm:-left-5 sm:-right-5 h-[calc(15%+12px)] sm:h-[calc(15%+20px)] bg-[#CBD5E1] border-t-[3px] border-[#94A3B8] z-40 flex items-center justify-center px-6 sm:px-12">
          
          {/* Parlante (Izquierda) - Oculto en celulares muy chicos */}
          <div className="hidden sm:flex absolute left-6 top-1/2 -translate-y-1/2 gap-1.5 opacity-40">
            <div className="w-1.5 h-10 bg-[#64748B] rounded-full shadow-inner"></div>
            <div className="w-1.5 h-10 bg-[#64748B] rounded-full shadow-inner"></div>
            <div className="w-1.5 h-10 bg-[#64748B] rounded-full shadow-inner"></div>
            <div className="w-1.5 h-10 bg-[#64748B] rounded-full shadow-inner"></div>
            <div className="w-1.5 h-10 bg-[#64748B] rounded-full shadow-inner"></div>
          </div>

          {/* Logo Central */}
          <div className="flex flex-col items-center justify-center pb-2 sm:pb-4 z-10">
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

          {/* Perillas y Botón (Derecha) */}
          <div className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 flex items-center gap-3 sm:gap-4">
            
            {/* Perilla 1 (Volumen) */}
            <div className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-[#F1F5F9] to-[#94A3B8] border-[2px] border-[#64748B] shadow-[2px_2px_5px_rgba(0,0,0,0.3),inset_-2px_-2px_5px_rgba(0,0,0,0.1)] flex items-center justify-center">
              <div className="w-1 h-3 sm:h-4 bg-[#334155] rounded-full absolute top-1 sm:top-1.5"></div>
            </div>

            {/* Perilla 2 (Canal) */}
            <div className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-[#F1F5F9] to-[#94A3B8] border-[2px] border-[#64748B] shadow-[2px_2px_5px_rgba(0,0,0,0.3),inset_-2px_-2px_5px_rgba(0,0,0,0.1)] flex items-center justify-center">
              <div className="w-1 h-3 sm:h-4 bg-[#334155] rounded-full absolute bottom-1 sm:bottom-1.5"></div>
            </div>

            {/* Botón de Encendido */}
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded bg-gradient-to-br from-[#EF4444] to-[#B91C1C] border-[2px] border-[#7F1D1D] shadow-[2px_2px_4px_rgba(0,0,0,0.4),inset_1px_1px_2px_rgba(255,255,255,0.4)] flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-[#FCA5A5] shadow-inner"></div>
            </div>

          </div>

        </div>

      </div>
    </main>
  );
}