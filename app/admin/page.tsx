"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { obtenerSesion, cerrarSesion, type Sesion } from "@/lib/auth";

type Seccion = "equipos" | "jugadores" | "partidos" | "codigos";

export default function AdminPage() {
  const router = useRouter();
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [seccion, setSeccion] = useState<Seccion>("equipos");

  useEffect(() => {
    const s = obtenerSesion();
    if (!s || s.tipo !== "admin") {
      router.push("/");
      return;
    }
    setSesion(s);
  }, [router]);

  const handleCerrar = () => {
    cerrarSesion();
    router.push("/");
  };

  if (!sesion) return null;

  const secciones: { id: Seccion; nombre: string; icono: string }[] = [
    { id: "equipos", nombre: "Equipos", icono: "🏐" },
    { id: "jugadores", nombre: "Jugadores", icono: "👤" },
    { id: "partidos", nombre: "Partidos", icono: "📅" },
    { id: "codigos", nombre: "Códigos", icono: "🔑" },
  ];

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              🏐 Panel de Admin
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Bienvenido admin
            </p>
          </div>
          <button
            onClick={handleCerrar}
            className="px-4 py-2 text-sm bg-slate-200 hover:bg-slate-300 rounded-lg transition"
          >
            Cerrar sesión
          </button>
        </div>

        {/* Pestañas */}
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

        {/* Contenido de cada sección */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          {seccion === "equipos" && (
            <div className="text-center py-12">
              <p className="text-4xl mb-4">🏐</p>
              <p className="text-slate-600 font-medium mb-2">
                Gestión de Equipos
              </p>
              <p className="text-slate-500 text-sm">
                🚧 En construcción — Sección 2
              </p>
            </div>
          )}

          {seccion === "jugadores" && (
            <div className="text-center py-12">
              <p className="text-4xl mb-4">👤</p>
              <p className="text-slate-600 font-medium mb-2">
                Gestión de Jugadores
              </p>
              <p className="text-slate-500 text-sm">
                🚧 En construcción — Sección 3
              </p>
            </div>
          )}

          {seccion === "partidos" && (
            <div className="text-center py-12">
              <p className="text-4xl mb-4">📅</p>
              <p className="text-slate-600 font-medium mb-2">
                Gestión de Partidos
              </p>
              <p className="text-slate-500 text-sm">
                🚧 En construcción — Sección 4
              </p>
            </div>
          )}

          {seccion === "codigos" && (
            <div className="text-center py-12">
              <p className="text-4xl mb-4">🔑</p>
              <p className="text-slate-600 font-medium mb-2">
                Gestión de Códigos
              </p>
              <p className="text-slate-500 text-sm">
                🚧 En construcción — Sección 5
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}