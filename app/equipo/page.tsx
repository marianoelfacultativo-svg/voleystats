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
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
              <IconoPelota size={34} />
              Portal del Equipo
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

        <div className="flex gap-1 sm:gap-2 mb-6 border-b-2 border-slate-300 overflow-x-auto">
          {secciones.map((s) => {
            const activo = seccion === s.id;
            const Icono = s.Icono;
            return (
              <button
                key={s.id}
                onClick={() => setSeccion(s.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold whitespace-nowrap rounded-t-lg transition border-b-[3px] -mb-[2px] ${
                  activo
                    ? "bg-blue-500 text-white border-blue-700 shadow-md"
                    : "bg-transparent text-slate-500 border-transparent hover:bg-white/60 hover:text-slate-800"
                }`}
              >
                <Icono size={18} />
                {s.nombre}
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