"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  CalendarDays,
  Boxes,
  LayoutDashboard,
  LogOut,
  Shield,
} from "lucide-react";
import { obtenerSesion, cerrarSesion, type Sesion } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import IconoPelota from "./IconoPelota";
import Dashboard from "./Dashboard";
import MiEquipo from "./MiEquipo";
import Partidos from "./Partidos";
import VisualizacionUnificada from "./VisualizacionUnificada";

type Seccion = "dashboard" | "mi-equipo" | "partidos" | "modelos";

type IconoComponente = React.ComponentType<{
  size?: string | number;
  className?: string;
  style?: React.CSSProperties;
}>;

export default function EquipoPage() {
  const router = useRouter();
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [nombreEquipo, setNombreEquipo] = useState("");
  const [seccion, setSeccion] = useState<Seccion>("dashboard");

  useEffect(() => {
    const s = obtenerSesion();
    if (!s || s.tipo !== "club") {
      router.push("/");
      return;
    }
    setSesion(s);

    if (s.equipo_id) {
      supabase
        .from("equipos")
        .select("nombre")
        .eq("id", s.equipo_id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setNombreEquipo(data.nombre);
        });
    }
  }, [router]);

  const handleCerrar = () => {
    cerrarSesion();
    router.push("/");
  };

  if (!sesion || !sesion.equipo_id) return null;

  const secciones: { id: Seccion; nombre: string; Icono: IconoComponente }[] = [
    { id: "dashboard", nombre: "Principal", Icono: LayoutDashboard },
    { id: "mi-equipo", nombre: "Plantel", Icono: Users },
    { id: "partidos", nombre: "Partidos", Icono: CalendarDays },
    { id: "modelos", nombre: "Modelos 3D", Icono: Boxes },
  ];

  return (
    <main
      className="relative min-h-screen p-3 sm:p-6 md:p-8"
      style={{ background: "var(--sx-bg)" }}
    >
      {/* Textura de fondo: grilla sutil */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto space-y-5">
        {/* ─── HEADER OSCURO ─── */}
        <header
          className="rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          style={{
            background: "var(--sx-surface-1)",
            border: "1px solid var(--sx-border-bright)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
          }}
        >
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Logo con glow */}
            <div
              className="flex items-center justify-center w-11 h-11 rounded-xl shrink-0"
              style={{
                background: "linear-gradient(135deg, #1B3A7A 0%, #2563EB 100%)",
                boxShadow: "0 0 18px rgba(37,99,235,0.5), inset 0 1px 0 rgba(255,255,255,0.15)",
              }}
            >
              <IconoPelota size={26} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-xl sm:text-2xl font-black tracking-tight leading-none"
                  style={{ color: "var(--sx-text-primary)" }}
                >
                  SALIDA<span style={{ color: "var(--sx-coral)" }}>x</span>5
                </span>
                <span className="badge">Club</span>
              </div>
              <p
                className="text-sm font-semibold truncate mt-1 flex items-center gap-1.5"
                style={{ color: "var(--sx-text-secondary)" }}
              >
                <Shield size={14} className="shrink-0" style={{ color: "var(--sx-teal)" }} />
                <span className="truncate">{nombreEquipo || "Panel del Club"}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center">
            <button
              onClick={handleCerrar}
              className="btn-outline"
              style={{ color: "#F87171" }}
            >
              <LogOut size={13} />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </header>

        {/* ─── NAVEGACIÓN SEGMENTADA OSCURA ─── */}
        <nav className="nav-pill max-w-fit">
          <ul className="flex items-center gap-1 overflow-x-auto">
            {secciones.map((s) => {
              const activo = seccion === s.id;
              const Icono = s.Icono;
              return (
                <li key={s.id} className="flex-shrink-0">
                  <button
                    onClick={() => setSeccion(s.id)}
                    className={`inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                      activo ? "tab-active" : ""
                    }`}
                    style={
                      !activo
                        ? { color: "var(--sx-text-secondary)" }
                        : undefined
                    }
                  >
                    <Icono
                      size={15}
                      style={{ color: activo ? "#fff" : "var(--sx-text-muted)" }}
                    />
                    <span>{s.nombre}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* ─── VISTAS DE SECCIÓN ─── */}
        <div className="transition-opacity duration-200">
          {seccion === "dashboard" && (
            <Dashboard equipoId={sesion.equipo_id} nombreEquipo={nombreEquipo} />
          )}

          {seccion === "mi-equipo" && (
            <MiEquipo equipoId={sesion.equipo_id} nombreEquipo={nombreEquipo} />
          )}

          {seccion === "partidos" && (
            <Partidos equipoId={sesion.equipo_id} nombreEquipo={nombreEquipo} />
          )}

          {seccion === "modelos" && (
            <VisualizacionUnificada
              equipoId={sesion.equipo_id}
              nombreEquipo={nombreEquipo}
            />
          )}
        </div>
      </div>
    </main>
  );
}