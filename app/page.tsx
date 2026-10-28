"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  Phone,
  Instagram,
  KeyRound,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Activity,
  BarChart3,
  Flame,
  FileText,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { guardarSesion, type Rol } from "@/lib/auth";
import IconoPelota from "./equipo/IconoPelota";

export default function Home() {
  const router = useRouter();
  const [codigo, setCodigo] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState<"info" | "error" | "ok">("info");
  const [cargando, setCargando] = useState(false);

  const handleIngresar = async () => {
    const limpio = codigo.trim();
    if (!limpio) {
      setMensaje("Ingresá un código para continuar");
      setTipoMensaje("error");
      return;
    }

    setCargando(true);
    setMensaje("Verificando credenciales...");
    setTipoMensaje("info");

    const { data, error } = await supabase
      .from("accesos")
      .select("*")
      .eq("codigo", limpio)
      .eq("activo", true)
      .maybeSingle();

    setCargando(false);

    if (error) {
      setMensaje("Error de conexión. Intentá de nuevo.");
      setTipoMensaje("error");
      return;
    }

    if (!data) {
      setMensaje("Código no encontrado o inactivo. Verificá e intentá nuevamente.");
      setTipoMensaje("error");
      return;
    }

    guardarSesion({
      codigo: data.codigo,
      tipo: data.tipo as Rol,
      equipo_id: data.equipo_id ?? undefined,
      jugador_id: data.jugador_id ?? undefined,
    });

    setTipoMensaje("ok");
    setMensaje(`Acceso concedido. Redirigiendo a panel ${data.tipo}...`);

    setTimeout(() => {
      if (data.tipo === "admin") {
        router.push("/admin");
      } else if (data.tipo === "club") {
        router.push("/equipo");
      } else if (data.tipo === "jugador") {
        router.push("/jugador");
      }
    }, 450);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleIngresar();
    }
  };

  return (
    <main className="relative min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between selection:bg-blue-100 selection:text-blue-900 overflow-x-hidden">
      {/* ─── FONDO DE CANCHA TÉCNICA (Geometría editorial sutil) ─── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      >
        {/* Iluminación cenital deportiva */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-blue-100/60 via-slate-100/30 to-transparent blur-3xl" />

        {/* Líneas de cancha vectoriales sutiles */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.35]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern
              id="court-grid"
              width="80"
              height="80"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 80 0 L 0 0 0 80"
                fill="none"
                stroke="#CBD5E1"
                strokeWidth="0.75"
                strokeDasharray="4 4"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#court-grid)" />
          {/* Línea lateral y de ataque estilizada */}
          <line
            x1="0"
            y1="35%"
            x2="100%"
            y2="35%"
            stroke="#94A3B8"
            strokeWidth="1.5"
            strokeDasharray="8 6"
          />
          <line
            x1="0"
            y1="65%"
            x2="100%"
            y2="65%"
            stroke="#94A3B8"
            strokeWidth="1.5"
          />
        </svg>
      </div>

      {/* ─── HEADER SUPERIOR ─── */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-sm">
            <IconoPelota size={24} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 leading-none">
              SALIDA<span className="text-rose-600 font-black">x</span>5
            </h1>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mt-1">
              Data & Análisis de Vóley
            </p>
          </div>
        </div>

        {/* Contacto directo en pills modernas */}
        <nav className="flex items-center gap-2 flex-wrap">
          <a
            href="https://instagram.com/SALIDAx5.data"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 hover:bg-white text-slate-600 hover:text-slate-900 text-xs font-semibold border border-slate-200/80 shadow-sm transition-all hover:border-slate-300"
            title="Instagram: @SALIDAx5.data"
          >
            <Instagram size={13} className="text-pink-600 shrink-0" />
            <span className="hidden sm:inline">SALIDAx5.data</span>
          </a>
          <a
            href="mailto:salidax5.data@gmail.com"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 hover:bg-white text-slate-600 hover:text-slate-900 text-xs font-semibold border border-slate-200/80 shadow-sm transition-all hover:border-slate-300"
            title="salidax5.data@gmail.com"
          >
            <Mail size={13} className="text-blue-600 shrink-0" />
            <span className="hidden md:inline">salidax5.data@gmail.com</span>
          </a>
          <a
            href="tel:+5492235753821"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 hover:bg-white text-slate-600 hover:text-slate-900 text-xs font-semibold border border-slate-200/80 shadow-sm transition-all hover:border-slate-300"
            title="223-575 3821"
          >
            <Phone size={13} className="text-emerald-600 shrink-0" />
            <span className="hidden lg:inline">223-575 3821</span>
          </a>
        </nav>
      </header>

      {/* ─── CONTENEDOR HERO & FORMULARIO ─── */}
      <section className="relative z-10 w-full max-w-md mx-auto px-4 py-8 sm:py-12 flex flex-col items-center">
        {/* Badge superior */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-blue-900 text-[11px] font-bold uppercase tracking-wider mb-5 shadow-sm">
          <Activity size={13} className="text-blue-600" />
          <span>Gestión Táctica y Rendimiento</span>
        </div>

        {/* Título de bienvenida */}
        <div className="text-center mb-6">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Acceso a la Plataforma
          </h2>
          <p className="text-slate-500 text-sm mt-1.5 max-w-xs mx-auto">
            Ingresá el código asignado a tu club, jugador o equipo técnico
          </p>
        </div>

        {/* Tarjeta de Acceso */}
        <div className="w-full bg-white border border-slate-200/90 rounded-2xl shadow-xl shadow-slate-200/50 p-6 sm:p-8">
          <div className="space-y-4">
            <div>
              <label
                htmlFor="codigo-acceso"
                className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-700 mb-2"
              >
                <span className="flex items-center gap-1.5">
                  <KeyRound size={13} className="text-slate-400" />
                  Código de Acceso
                </span>
                <span className="text-[10px] text-slate-400 font-normal">
                  Sensible a mayúsculas
                </span>
              </label>

              <div className="relative">
                <input
                  id="codigo-acceso"
                  type="text"
                  value={codigo}
                  onChange={(e) => {
                    setCodigo(e.target.value);
                    if (mensaje) setMensaje("");
                  }}
                  onKeyDown={handleKeyDown}
                  disabled={cargando}
                  autoFocus
                  placeholder="EJ: CLUB-2026"
                  className="w-full px-4 py-3.5 text-center text-lg sm:text-xl font-mono font-bold tracking-[0.2em] bg-slate-50 hover:bg-slate-50/80 focus:bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#163A85]/20 focus:border-[#163A85] transition-all placeholder:text-slate-300 placeholder:font-normal placeholder:tracking-normal placeholder:text-sm shadow-inner"
                />
              </div>
            </div>

            <button
              onClick={handleIngresar}
              disabled={cargando}
              className="w-full bg-[#163A85] hover:bg-[#0F285E] active:scale-[0.99] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3.5 px-5 rounded-xl transition-all shadow-md shadow-blue-950/15 flex items-center justify-center gap-2 text-sm sm:text-base group"
            >
              {cargando ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verificando...</span>
                </div>
              ) : (
                <>
                  <span>Ingresar al Sistema</span>
                  <ArrowRight
                    size={16}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </>
              )}
            </button>
          </div>

          {/* Estado / Alerta */}
          {mensaje && (
            <div
              className={`mt-4 p-3 rounded-xl text-xs font-semibold flex items-start gap-2.5 transition-all ${
                tipoMensaje === "ok"
                  ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                  : tipoMensaje === "error"
                  ? "bg-rose-50 border border-rose-200 text-rose-800"
                  : "bg-slate-100 border border-slate-200 text-slate-700"
              }`}
            >
              {tipoMensaje === "ok" ? (
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              ) : tipoMensaje === "error" ? (
                <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
              ) : (
                <Activity size={16} className="text-slate-500 shrink-0 mt-0.5" />
              )}
              <span className="leading-snug">{mensaje}</span>
            </div>
          )}
        </div>

        {/* ─── PILARES / CAPACIDADES DE LA PLATAFORMA ─── */}
        <div className="mt-8 grid grid-cols-2 gap-2 sm:gap-3 w-full">
          <div className="p-3 bg-white/80 border border-slate-200/70 rounded-xl flex items-center gap-2.5 shadow-sm">
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
              <BarChart3 size={15} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-800 leading-tight">
                Métricas por Set
              </p>
              <p className="text-[10px] text-slate-400">Eficiencia y saldo</p>
            </div>
          </div>

          <div className="p-3 bg-white/80 border border-slate-200/70 rounded-xl flex items-center gap-2.5 shadow-sm">
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <Flame size={15} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-800 leading-tight">
                Mapas de Calor
              </p>
              <p className="text-[10px] text-slate-400">Dirección y zonas</p>
            </div>
          </div>

          <div className="p-3 bg-white/80 border border-slate-200/70 rounded-xl flex items-center gap-2.5 shadow-sm">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <Activity size={15} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-800 leading-tight">
                Armados & Toque
              </p>
              <p className="text-[10px] text-slate-400">Distribución táctica</p>
            </div>
          </div>

          <div className="p-3 bg-white/80 border border-slate-200/70 rounded-xl flex items-center gap-2.5 shadow-sm">
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center shrink-0">
              <FileText size={15} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-800 leading-tight">
                Informes PDF
              </p>
              <p className="text-[10px] text-slate-400">Exportación directa</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER EDITORIAL ─── */}
      <footer className="relative z-10 w-full border-t border-slate-200/80 bg-white/60 backdrop-blur-sm py-4 px-4 text-center">
        <p className="text-[11px] text-slate-500 font-medium">
          SALIDA<span className="text-rose-600 font-bold">x</span>5 · Sistema de Inteligencia y Estadística de Vóley
        </p>
      </footer>
    </main>
  );
}
