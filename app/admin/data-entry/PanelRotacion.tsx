"use client";

import { useState } from "react";
import {
  girarRotacion,
  rotacionVacia,
  asignarJugador,
  ETIQUETA_TIPO,
  type RotacionPunto,
  type Zona,
  type SaqueEquipo,
} from "@/lib/rotaciones";

interface Jugador {
  id: string;
  nombre: string;
  numero: number | null;
}

interface Props {
  rotacion: RotacionPunto;
  jugadores: Jugador[];
  onChange: (rot: RotacionPunto) => void;
  numeroRotacion: number;
  onCambioRotacion: (n: number) => void;
}

const LAYOUT: { zona: Zona; label: string; fila: "frente" | "fondo" }[] = [
  { zona: 4, label: "4", fila: "frente" },
  { zona: 3, label: "3", fila: "frente" },
  { zona: 2, label: "2", fila: "frente" },
  { zona: 5, label: "5", fila: "fondo" },
  { zona: 6, label: "6", fila: "fondo" },
  { zona: 1, label: "1", fila: "fondo" },
];

export default function PanelRotacion({
  rotacion,
  jugadores,
  onChange,
  numeroRotacion,
  onCambioRotacion,
}: Props) {
  const [editandoZona, setEditandoZona] = useState<Zona | null>(null);

  const nombreDe = (id: string | null) => {
    if (!id) return null;
    const j = jugadores.find((x) => x.id === id);
    return j ? `${j.nombre}${j.numero !== null ? ` #${j.numero}` : ""}` : "?";
  };

  const handleGirar = (dir: 1 | -1) => {
    const nuevo = girarRotacion(numeroRotacion, dir);
    onCambioRotacion(nuevo);
    onChange(
      rotacionVacia(nuevo, rotacion.set_numero, rotacion.punto_numero, rotacion.saque_equipo)
    );
  };

  const handleAsignar = (zona: Zona, jugador_id: string) => {
    onChange(asignarJugador(rotacion, zona, jugador_id || null));
    setEditandoZona(null);
  };

  const handleToggleSaque = (equipo: SaqueEquipo) => {
    onChange({ ...rotacion, saque_equipo: equipo });
  };

  const frente = LAYOUT.filter((l) => l.fila === "frente");
  const fondo = LAYOUT.filter((l) => l.fila === "fondo");

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-800">
          Rotación {numeroRotacion}
        </h3>
        <div className="flex gap-1">
          <button
            onClick={() => handleGirar(-1)}
            className="px-3 py-1 bg-white border border-slate-300 rounded-lg text-sm hover:bg-slate-50"
            title="Girar a la izquierda"
          >
            ◀
          </button>
          <button
            onClick={() => handleGirar(1)}
            className="px-3 py-1 bg-white border border-slate-300 rounded-lg text-sm hover:bg-slate-50"
            title="Girar a la derecha"
          >
            ▶
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs font-semibold text-slate-500 uppercase">
          Saque:
        </span>
        <div className="flex rounded-lg overflow-hidden border border-slate-300">
          <button
            onClick={() => handleToggleSaque("propio")}
            className={`px-3 py-1 text-xs font-medium transition ${
              rotacion.saque_equipo === "propio"
                ? "bg-emerald-500 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            Propio
          </button>
          <button
            onClick={() => handleToggleSaque("rival")}
            className={`px-3 py-1 text-xs font-medium transition ${
              rotacion.saque_equipo === "rival"
                ? "bg-orange-500 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            Rival
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-center text-[10px] font-bold text-slate-400 mb-1">
          ─── RED ───
        </div>
        <div className="grid grid-cols-3 gap-2">
          {frente.map((l) => (
            <CeldaZona
              key={l.zona}
              zona={l.zona}
              rotacion={rotacion}
              nombreDe={nombreDe}
              jugadores={jugadores}
              editando={editandoZona === l.zona}
              onAbrir={() => setEditandoZona(l.zona)}
              onCerrar={() => setEditandoZona(null)}
              onAsignar={(id) => handleAsignar(l.zona, id)}
            />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {fondo.map((l) => (
            <CeldaZona
              key={l.zona}
              zona={l.zona}
              rotacion={rotacion}
              nombreDe={nombreDe}
              jugadores={jugadores}
              editando={editandoZona === l.zona}
              onAbrir={() => setEditandoZona(l.zona)}
              onCerrar={() => setEditandoZona(null)}
              onAsignar={(id) => handleAsignar(l.zona, id)}
            />
          ))}
        </div>
      </div>

      <p className="text-[11px] text-slate-400 mt-3 text-center">
        Click en una zona para asignar jugador. Flechas para girar.
      </p>
    </div>
  );
}

function CeldaZona({
  zona,
  rotacion,
  nombreDe,
  jugadores,
  editando,
  onAbrir,
  onCerrar,
  onAsignar,
}: {
  zona: Zona;
  rotacion: RotacionPunto;
  nombreDe: (id: string | null) => string | null;
  jugadores: Jugador[];
  editando: boolean;
  onAbrir: () => void;
  onCerrar: () => void;
  onAsignar: (id: string) => void;
}) {
  const asig = rotacion.posiciones[zona];
  const nombre = nombreDe(asig?.jugador_id ?? null);

  const coloresRol: Record<string, string> = {
    A: "border-violet-400 bg-violet-50",
    O: "border-orange-400 bg-orange-50",
    C: "border-blue-400 bg-blue-50",
    P: "border-emerald-400 bg-emerald-50",
    L: "border-pink-400 bg-pink-50",
  };

  const color = asig
    ? coloresRol[asig.rol] ?? "border-slate-300 bg-slate-50"
    : "border-slate-300 bg-slate-50";

  return (
    <div className="relative">
      <button
        onClick={onAbrir}
        className={`w-full aspect-square border-2 rounded-lg p-1 flex flex-col items-center justify-center transition hover:shadow-md ${color}`}
      >
        <span className="text-[10px] font-bold text-slate-500 absolute top-0.5 left-1.5">
          {zona}
        </span>
        <span className="text-lg font-bold text-slate-800">
          {asig?.rol ?? "?"}
        </span>
        <span className="text-[9px] text-slate-500 text-center leading-tight px-1 truncate w-full">
          {nombre ?? ETIQUETA_TIPO[asig?.tipo ?? "A"]}
        </span>
      </button>

      {editando && (
        <>
          <div className="fixed inset-0 z-40" onClick={onCerrar} />
          <div className="absolute z-50 top-full mt-1 left-1/2 -translate-x-1/2 bg-white border-2 border-slate-300 rounded-lg shadow-lg p-2 w-48 max-h-60 overflow-y-auto">
            <button
              onClick={() => onAsignar("")}
              className="w-full text-left px-2 py-1 text-xs text-slate-400 hover:bg-slate-50 rounded"
            >
              (vaciar)
            </button>
            {jugadores.map((j) => (
              <button
                key={j.id}
                onClick={() => onAsignar(j.id)}
                className="w-full text-left px-2 py-1 text-xs text-slate-700 hover:bg-emerald-50 rounded"
              >
                {j.nombre}
                {j.numero !== null && ` #${j.numero}`}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
