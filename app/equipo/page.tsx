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
    <main className="relative min-h-screen bg-slate-50/70 p-3 sm:p-6 md:p-8">
      <div className="relative z-10 max-w-6xl mx-auto space-y-6">
        {/* ─── HEADER PRO ATHLETIC ─── */}
        <header className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-slate-50 border border-slate-200/80 shadow-sm shrink-0">
              <IconoPelota size={26} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 leading-none">
                  SALIDA<span className="text-rose-600 font-black">x</span>5
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/60">
                  Club
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-700 truncate mt-1 flex items-center gap-1.5">
                <Shield size={14} className="text-[#163A85] shrink-0" />
                <span className="truncate">{nombreEquipo || "Panel del Club"}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center">
            <button
              onClick={handleCerrar}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg transition-all"
            >
              <LogOut size={13} />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </header>

        {/* ─── NAVEGACIÓN POR PESTAÑAS ATLÉTICAS ─── */}
        <nav className="bg-slate-200/60 p-1.5 rounded-xl max-w-fit">
          <ul className="flex items-center gap-1 overflow-x-auto">
            {secciones.map((s) => {
              const activo = seccion === s.id;
              const Icono = s.Icono;
              return (
                <li key={s.id} className="flex-shrink-0">
                  <button
                    onClick={() => setSeccion(s.id)}
                    className={`inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                      activo
                        ? "bg-white text-slate-900 shadow-sm border border-slate-200/80"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                    }`}
                  >
                    <Icono
                      size={15}
                      className={activo ? "text-[#163A85]" : "text-slate-400"}
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
