"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  Phone,
  Instagram,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Activity,
  BarChart3,
  Flame,
  FileText,
  Zap,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { guardarSesion, type Rol } from "@/lib/auth";

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
    setMensaje("Verificando...");
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
      setMensaje("Código no encontrado o inactivo.");
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
    setMensaje("Acceso concedido. Redirigiendo...");

    setTimeout(() => {
      if (data.tipo === "admin") router.push("/admin");
      else if (data.tipo === "club") router.push("/equipo");
      else if (data.tipo === "jugador") router.push("/jugador");
    }, 400);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleIngresar();
  };

  return (
    <main className="relative min-h-screen overflow-hidden flex flex-col" style={{ background: "#0B1629" }}>

      {/* ── FONDO CANCHA CON TEXTURA ──────────────────────────── */}
      <div className="absolute inset-0 z-0 pointer-events-none select-none overflow-hidden">
        {/* Gradiente base atmosférico */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 90% 60% at 50% 0%, #1E3A7A 0%, #0B1629 55%, #060D1A 100%)",
          }}
        />

        {/* SVG cancha de vóley estilizada */}
        <svg
          className="absolute bottom-0 left-0 right-0 w-full"
          viewBox="0 0 1200 500"
          preserveAspectRatio="none"
          style={{ opacity: 0.18 }}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Piso de cancha */}
          <rect x="80" y="120" width="1040" height="340" rx="6" fill="none" stroke="#7DD3FC" strokeWidth="2.5" />
          {/* Línea del medio */}
          <line x1="600" y1="120" x2="600" y2="460" stroke="#7DD3FC" strokeWidth="2" />
          {/* Líneas de ataque */}
          <line x1="80" y1="240" x2="600" y2="240" stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="8 5" />
          <line x1="600" y1="240" x2="1120" y2="240" stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="8 5" />
          {/* Red */}
          <line x1="600" y1="80" x2="600" y2="120" stroke="#E2E8F0" strokeWidth="3" />
          <rect x="595" y="78" width="10" height="4" rx="2" fill="#E2E8F0" />
          {/* Postes */}
          <line x1="600" y1="50" x2="600" y2="130" stroke="#E2E8F0" strokeWidth="2.5" />
          {/* Posiciones de jugadores (círculos fantasma) */}
          {[
            [220, 300], [460, 300], [220, 180], [460, 180], [340, 300], [340, 180],
            [760, 300], [980, 300], [760, 180], [980, 180], [870, 300], [870, 180],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="18" fill="none" stroke="#7DD3FC" strokeWidth="1" opacity="0.6" />
          ))}
          {/* Números de zona */}
          {[
            [220, 350, "5"], [460, 350, "6"], [460, 165, "1"],
            [760, 350, "1"], [980, 350, "6"], [760, 165, "5"],
          ].map(([x, y, txt], i) => (
            <text key={i} x={x} y={y} textAnchor="middle" fill="#93C5FD" fontSize="20" fontFamily="monospace" opacity="0.5">{txt}</text>
          ))}
        </svg>

        {/* Luz cenital sobre la cancha */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px]"
          style={{
            background: "radial-gradient(ellipse at 50% 0%, rgba(56,189,248,0.15) 0%, transparent 70%)",
          }}
        />

        {/* Puntos de luz lateral izquierda */}
        <div
          className="absolute top-1/3 left-0 w-[400px] h-[400px]"
          style={{
            background: "radial-gradient(ellipse at 0% 50%, rgba(213,80,42,0.12) 0%, transparent 65%)",
          }}
        />
        {/* Punto de luz lateral derecha */}
        <div
          className="absolute top-1/3 right-0 w-[400px] h-[400px]"
          style={{
            background: "radial-gradient(ellipse at 100% 50%, rgba(30,79,189,0.15) 0%, transparent 65%)",
          }}
        />

        {/* Grilla de puntos sutil */}
        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="rgba(255,255,255,0.06)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>
      </div>

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-5 sm:px-8 pt-5 pb-4 flex items-center justify-between gap-4 flex-wrap">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: "linear-gradient(135deg, #1E4FBD 0%, #1A3A7A 100%)",
              boxShadow: "0 0 0 1px rgba(255,255,255,0.1), 0 4px 12px rgba(26,58,122,0.5)",
            }}
          >
            {/* Pelota SVG inline */}
            <svg width="22" height="22" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="46" fill="white" fillOpacity="0.92" />
              <path d="M 5 60 Q 25 55 45 80 Q 25 95 5 60 Z" fill="#1A3A7A" />
              <path d="M 95 60 Q 75 55 55 80 Q 75 95 95 60 Z" fill="#1A3A7A" />
              <path d="M 15 25 Q 35 35 25 65 Q 5 55 15 25 Z" fill="#F59E0B" />
              <path d="M 85 25 Q 65 35 75 65 Q 95 55 85 25 Z" fill="#F59E0B" />
              <circle cx="50" cy="50" r="46" stroke="#1A3A7A" strokeWidth="3.5" />
              <path d="M 50 4 Q 50 25 40 45" stroke="#1A3A7A" strokeWidth="3.5" strokeLinecap="round" />
              <path d="M 50 4 Q 50 25 60 45" stroke="#1A3A7A" strokeWidth="3.5" strokeLinecap="round" />
              <path d="M 4 50 Q 30 50 40 45" stroke="#1A3A7A" strokeWidth="3.5" strokeLinecap="round" />
              <path d="M 96 50 Q 70 50 60 45" stroke="#1A3A7A" strokeWidth="3.5" strokeLinecap="round" />
              <path d="M 4 50 Q 30 70 50 96" stroke="#1A3A7A" strokeWidth="3.5" strokeLinecap="round" />
              <path d="M 96 50 Q 70 70 50 96" stroke="#1A3A7A" strokeWidth="3.5" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight leading-none" style={{ color: "#FFFFFF" }}>
              SALIDA<span style={{ color: "#E53E4D" }}>x</span>5
            </h1>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
              Estadísticas de Vóley
            </p>
          </div>
        </div>

        {/* Contacto */}
        <nav className="flex items-center gap-2 flex-wrap">
          {[
            { href: "https://instagram.com/SALIDAx5.data", icon: <Instagram size={13} />, label: "@SALIDAx5.data", target: "_blank" },
            { href: "mailto:salidax5.data@gmail.com", icon: <Mail size={13} />, label: "Email", target: undefined },
            { href: "tel:+5492235753821", icon: <Phone size={13} />, label: "223-575 3821", target: undefined },
          ].map((item, i) => (
            <a
              key={i}
              href={item.href}
              target={item.target}
              rel={item.target ? "noopener noreferrer" : undefined}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.7)",
              }}
            >
              {item.icon}
              <span className="hidden sm:inline">{item.label}</span>
            </a>
          ))}
        </nav>
      </header>

      {/* ── CONTENIDO PRINCIPAL ────────────────────────────────── */}
      <section className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12">

        {/* Columna central */}
        <div className="w-full max-w-sm mx-auto flex flex-col items-center">

          {/* Tag superior */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest mb-7"
            style={{
              background: "rgba(14,165,201,0.12)",
              border: "1px solid rgba(14,165,201,0.3)",
              color: "#38BDF8",
            }}
          >
            <Zap size={12} />
            <span>Sistema de Análisis Táctico</span>
          </div>

          {/* Headline */}
          <div className="text-center mb-7">
            <h2
              className="text-3xl sm:text-4xl font-black tracking-tight leading-[1.1]"
              style={{ color: "#FFFFFF" }}
            >
              Tu rendimiento,
              <br />
              <span style={{
                background: "linear-gradient(90deg, #38BDF8, #818CF8)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>en datos reales</span>
            </h2>
            <p className="text-sm mt-3 leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
              Ingresá el código de tu club o equipo para acceder a tus estadísticas.
            </p>
          </div>

          {/* Tarjeta de acceso */}
          <div
            className="w-full rounded-2xl overflow-hidden"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              backdropFilter: "blur(12px)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            <div className="p-6 sm:p-7 space-y-4">
              <div>
                <label
                  htmlFor="codigo-acceso"
                  className="block text-xs font-bold uppercase tracking-widest mb-2"
                  style={{ color: "rgba(255,255,255,0.45)" }}
                >
                  Código de Acceso
                </label>
                <input
                  id="codigo-acceso"
                  type="text"
                  value={codigo}
                  onChange={(e) => { setCodigo(e.target.value); if (mensaje) setMensaje(""); }}
                  onKeyDown={handleKeyDown}
                  disabled={cargando}
                  autoFocus
                  placeholder="EJ: CLUB-2026"
                  className="w-full px-4 py-3.5 text-center text-lg font-mono font-bold tracking-[0.2em] rounded-xl transition-all outline-none"
                  style={{
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "#FFFFFF",
                    caretColor: "#38BDF8",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.border = "1px solid rgba(56,189,248,0.5)";
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(56,189,248,0.1)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.border = "1px solid rgba(255,255,255,0.12)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>

              <button
                onClick={handleIngresar}
                disabled={cargando}
                className="w-full py-3.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all text-sm sm:text-base group"
                style={{
                  background: cargando
                    ? "rgba(30,79,189,0.5)"
                    : "linear-gradient(135deg, #1A3A7A 0%, #1E4FBD 100%)",
                  boxShadow: cargando ? "none" : "0 4px 20px rgba(26,58,122,0.5), inset 0 1px 0 rgba(255,255,255,0.1)",
                }}
              >
                {cargando ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Verificando...</span>
                  </>
                ) : (
                  <>
                    <span>Ingresar</span>
                    <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </div>

            {/* Alerta */}
            {mensaje && (
              <div
                className="mx-4 mb-4 p-3 rounded-xl text-xs font-semibold flex items-start gap-2.5"
                style={{
                  background: tipoMensaje === "ok"
                    ? "rgba(16,185,129,0.12)"
                    : tipoMensaje === "error"
                    ? "rgba(239,68,68,0.12)"
                    : "rgba(255,255,255,0.06)",
                  border: `1px solid ${tipoMensaje === "ok" ? "rgba(16,185,129,0.3)" : tipoMensaje === "error" ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.1)"}`,
                  color: tipoMensaje === "ok" ? "#6EE7B7" : tipoMensaje === "error" ? "#FCA5A5" : "rgba(255,255,255,0.6)",
                }}
              >
                {tipoMensaje === "ok" ? (
                  <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
                ) : tipoMensaje === "error" ? (
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                ) : (
                  <Activity size={15} className="shrink-0 mt-0.5" />
                )}
                <span>{mensaje}</span>
              </div>
            )}
          </div>

          {/* Módulos */}
          <div className="grid grid-cols-2 gap-2.5 w-full mt-6">
            {[
              { icon: <BarChart3 size={16} />, label: "Métricas por Set", sub: "Eficiencia y saldo", color: "#38BDF8", bg: "rgba(56,189,248,0.1)" },
              { icon: <Flame size={16} />, label: "Mapas de Calor", sub: "Zonas de juego", color: "#F59E0B", bg: "rgba(245,158,11,0.1)" },
              { icon: <Activity size={16} />, label: "Armados & Toque", sub: "Distribución táctica", color: "#A78BFA", bg: "rgba(167,139,250,0.1)" },
              { icon: <FileText size={16} />, label: "Informes PDF", sub: "Exportación directa", color: "#6EE7B7", bg: "rgba(110,231,183,0.1)" },
            ].map((m, i) => (
              <div
                key={i}
                className="p-3 rounded-xl flex items-center gap-2.5"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: m.bg, color: m.color }}
                >
                  {m.icon}
                </div>
                <div>
                  <p className="text-[11px] font-bold leading-tight" style={{ color: "rgba(255,255,255,0.85)" }}>
                    {m.label}
                  </p>
                  <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                    {m.sub}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────── */}
      <footer
        className="relative z-10 py-4 px-4 text-center text-[11px] font-medium"
        style={{
          color: "rgba(255,255,255,0.22)",
          borderTop: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        SALIDA<span style={{ color: "#E53E4D" }}>x</span>5 · Sistema de Inteligencia y Estadística de Vóley
      </footer>
    </main>
  );
}
