"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, CalendarDays, Boxes } from "lucide-react";
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
    { id: "dashboard", nombre: "Principal", Icono: IconoPelota },
    { id: "mi-equipo", nombre: "Mi Equipo", Icono: Users },
    { id: "partidos", nombre: "Partidos", Icono: CalendarDays },
    { id: "modelos", nombre: "Modelos", Icono: Boxes },
  ];

  return (
    <main className="min-h-screen p-4 sm:p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* ─── HEADER ─── */}
        <header className="flex items-start justify-between gap-4 flex-wrap mb-6">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.25em] text-[#A54A44] font-bold">
              Panel del club
            </p>
            <h1 className="mt-1 flex items-baseline gap-x-2 flex-wrap text-slate-900">
              <span className="inline-flex items-center gap-2">
                <IconoPelota size={28} />
                <span className="text-2xl sm:text-3xl font-black tracking-tight">
                  SALIDA<span className="text-red-600">x</span>5
                </span>
              </span>
              {nombreEquipo && (
                <span className="text-base sm:text-lg font-medium text-slate-500 truncate">
                  {nombreEquipo}
                </span>
              )}
            </h1>
          </div>
          <button
            onClick={handleCerrar}
            className="text-xs font-medium text-slate-500 hover:text-slate-800 underline underline-offset-4 decoration-slate-300 hover:decoration-slate-600 transition self-center"
          >
            Cerrar sesión
          </button>
        </header>

        {/* ─── NAV ─── */}
        <nav className="mb-6 border-b border-slate-300">
          <ul className="flex gap-0 overflow-x-auto">
            {secciones.map((s) => {
              const activo = seccion === s.id;
              const Icono = s.Icono;
              return (
                <li key={s.id} className="flex-shrink-0">
                  <button
                    onClick={() => setSeccion(s.id)}
                    className={`group flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition border-b-2 -mb-px ${
                      activo
                        ? "border-[#11B7B8] text-slate-900"
                        : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-400"
                    }`}
                  >
                    <Icono
                      size={16}
                      className={
                        activo
                          ? "text-[#11B7B8]"
                          : "opacity-60 group-hover:opacity-90"
                      }
                    />
                    <span>{s.nombre}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

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
    </main>
  );
}