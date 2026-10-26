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
  size?: number;
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
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              🏐 Portal del Equipo
            </h1>
            <p className="text-slate-600 text-sm mt-1">
              {nombreEquipo
                ? `Bienvenido miembro de ${nombreEquipo}`
                : "..."}
            </p>
          </div>
          <button
            onClick={handleCerrar}
            className="px-4 py-2 text-sm bg-slate-200 hover:bg-slate-300 rounded-lg transition w-full sm:w-auto"
          >
            Cerrar sesión
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-6">
          {secciones.map((s) => {
            const activo = seccion === s.id;
            const Icono = s.Icono;
            return (
              <button
                key={s.id}
                onClick={() => setSeccion(s.id)}
                className={`flex flex-col items-center justify-center gap-2 py-4 sm:py-5 px-2 rounded-2xl border-2 transition-all duration-150 ${
                  activo
                    ? "bg-blue-500 border-blue-600 text-white shadow-xl scale-[1.02]"
                    : "bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:shadow-md"
                }`}
              >
                <Icono size={32} />
                <span
                  className={`text-[11px] sm:text-xs font-bold uppercase tracking-wider ${
                    activo ? "text-white" : "text-slate-700"
                  }`}
                >
                  {s.nombre}
                </span>
              </button>
            );
          })}
        </div>

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