"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { obtenerSesion, cerrarSesion, type Sesion } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export default function JugadorPage() {
  const router = useRouter();
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [nombre, setNombre] = useState("");

  useEffect(() => {
    const s = obtenerSesion();
    if (!s || s.tipo !== "jugador") {
      router.push("/");
      return;
    }
    setSesion(s);

    if (s.jugador_id) {
      supabase
        .from("jugadores")
        .select("nombre")
        .eq("id", s.jugador_id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setNombre(data.nombre);
        });
    }
  }, [router]);

  const handleCerrar = () => {
    cerrarSesion();
    router.push("/");
  };

  if (!sesion) return null;

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">
            🏐 Mi Perfil
          </h1>
          <button
            onClick={handleCerrar}
            className="px-4 py-2 text-sm bg-slate-200 hover:bg-slate-300 rounded-lg transition"
          >
            Cerrar sesión
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <p className="text-slate-600 text-lg">
            Bienvenido{" "}
            <span className="font-semibold">
              {nombre || "(jugador sin nombre)"}
            </span>
          </p>

          <div className="mt-8 p-6 bg-slate-50 rounded-lg border border-dashed border-slate-300 text-center">
            <p className="text-slate-500 text-sm">
              🚧 Perfil en construcción — se llena en la Fase 6
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}