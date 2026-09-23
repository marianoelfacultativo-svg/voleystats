"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { obtenerSesion, cerrarSesion, type Sesion } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import Dashboard from "./Dashboard";

type Seccion = "dashboard" | "mi-equipo" | "partidos";

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

  const secciones: { id: Seccion; nombre: string; icono: string }[] = [
    { id: "dashboard", nombre: "Dashboard", icono: "📊" },
    { id: "mi-equipo", nombre: "Mi Equipo", icono: "👥" },
    { id: "partidos", nombre: "Partidos", icono: "📅" },
  ];

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              🏐 Portal del Equipo
            </h1>
            <p className="text-slate-600 text-sm mt-1">
              {nombreEquipo ? `Bienvenido miembro de ${nombreEquipo}` : "..."}
            </p>
          </div>
          <button
            onClick={handleCerrar}
            className="px-4 py-2 text-sm bg-slate-200 hover:bg-slate-300 rounded-lg transition"
          >
            Cerrar sesión
          </button>
        </div>

        <div className="flex gap-2 mb-6 border-b border-slate-200">
          {secciones.map((s) => (
            <button
              key={s.id}
              onClick={() => setSeccion(s.id)}
              className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
                seccion === s.id
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {s.icono} {s.nombre}
            </button>
          ))}
        </div>

        {seccion === "dashboard" && (
          <Dashboard
            equipoId={sesion.equipo_id}
            nombreEquipo={nombreEquipo}
          />
        )}

        {seccion === "mi-equipo" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
            <p className="text-4xl mb-3">👥</p>
            <p className="text-slate-600 font-medium">Mi Equipo</p>
            <p className="text-slate-500 text-sm mt-1">
              🚧 En construcción — Sección 2
            </p>
          </div>
        )}

        {seccion === "partidos" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
            <p className="text-4xl mb-3">📅</p>
            <p className="text-slate-600 font-medium">Partidos</p>
            <p className="text-slate-500 text-sm mt-1">
              🚧 En construcción — Sección 3
            </p>
          </div>
        )}
      </div>
    </main>
  );
}