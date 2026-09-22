"use client";

import { useState } from "react";

export default function Home() {
  const [codigo, setCodigo] = useState("");
  const [mensaje, setMensaje] = useState("");

  const handleIngresar = () => {
    if (!codigo.trim()) {
      setMensaje("Ingresá un código");
      return;
    }
    setMensaje(`Probando código: ${codigo}`);
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            🏐 VoleyStats
          </h1>
          <p className="text-slate-500 text-sm">
            Ingresá tu código de acceso
          </p>
        </div>

        <input
          type="text"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="Tu código"
          className="w-full px-4 py-3 border border-slate-300 rounded-lg mb-4 focus:outline-none focus:border-blue-500"
        />

        <button
          onClick={handleIngresar}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 rounded-lg transition"
        >
          Ingresar
        </button>

        {mensaje && (
          <p className="mt-4 text-center text-sm text-slate-600">
            {mensaje}
          </p>
        )}
      </div>
    </main>
  );
}