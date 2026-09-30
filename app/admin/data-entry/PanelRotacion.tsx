"use client";

import { useState } from "react";
import {
  girarRotacion,
  asignarJugador,
  ROTACION_BASE,
  ROL_DE_TIPO,
  type RotacionPunto,
  type Zona,
  type SaqueEquipo,
  type Libero,
  type TipoLogico,
  type AsignacionZona,
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

const LAYOUT: { zona: Zona; fila: "frente" | "fondo" }[] = [
  { zona: 4, fila: "frente" },
  { zona: 3, fila: "frente" },
  { zona: 2, fila: "frente" },
  { zona: 5, fila: "fondo" },
  { zona: 6, fila: "fondo" },
  { zona: 1, fila: "fondo" },
];

export default function PanelRotacion({
  rotacion,
  jugadores,
  onChange,
  numeroRotacion,
  onCambioRotacion,
}: Props) {
  const [editandoZona, setEditandoZona] = useState<Zona | null>(null);
  const [editandoLiberos, setEditandoLiberos] = useState(false);

  const nombreDe = (id: string | null) => {
    if (!id) return null;
    const j = jugadores.find((x) => x.id === id);
    if (!j) return "?";
    const partes = j.nombre.split(" ");
    return partes.length > 1 ? partes[0] : j.nombre.slice(0, 8);
  };

  const handleGirar = (dir: 1 | -1) => {
    const nuevoNumero = girarRotacion(numeroRotacion, dir);

    // Mapear tipo → jugador_id de la rotación actual
    const jugadorPorTipo: Partial<Record<TipoLogico, string | null>> = {};
    Object.values(rotacion.posiciones).forEach((p) => {
      jugadorPorTipo[p.tipo] = p.jugador_id;
    });

    // Construir la nueva rotación manteniendo los jugadores en sus tipos
    const base = ROTACION_BASE[nuevoNumero] ?? ROTACION_BASE[1];
    const nuevasPosiciones: Partial<Record<Zona, AsignacionZona>> = {};
    (Object.keys(base) as unknown as Zona[]).forEach((z) => {
      const zona = Number(z) as Zona;
      const tipo = base[zona];
      nuevasPosiciones[zona] = {
        zona,
        jugador_id: jugadorPorTipo[tipo] ?? null,
        rol: ROL_DE_TIPO[tipo],
        tipo,
      };
    });

    onCambioRotacion(nuevoNumero);
    onChange({
      ...rotacion,
      posiciones: nuevasPosiciones as Record<Zona, AsignacionZona>,
    });
  };

  const handleAsignar = (zona: Zona, jugador_id: string) => {
    onChange(asignarJugador(rotacion, zona, jugador_id || null));
    setEditandoZona(null);
  };

  const handleToggleSaque = (equipo: SaqueEquipo) => {
    onChange({ ...rotacion, saque_equipo: equipo });
  };

  const toggleLibero = (jugador_id: string) => {
    const existentes = rotacion.liberos;
    const yaEsta = existentes.find((l) => l.jugador_id === jugador_id);
    let nuevos: Libero[];
    if (yaEsta) {
      nuevos = existentes.filter((l) => l.jugador_id !== jugador_id);
    } else {
      if (existentes.length >= 2) return;
      const tipo: Libero["tipo"] =
        existentes.length === 0 ? "defensa" : "recepcion";
      nuevos = [...existentes, { jugador_id, tipo }];
    }
    onChange({ ...rotacion, liberos: nuevos });
  };

  const cambiarTipoLibero = (jugador_id: string, tipo: Libero["tipo"]) => {
    onChange({
      ...rotacion,
      liberos: rotacion.liberos.map((l) =>
        l.jugador_id === jugador_id ? { ...l, tipo } : l
      ),
    });
  };

  const frente = LAYOUT.filter((l) => l.fila === "frente");
  const fondo = LAYOUT.filter((l) => l.fila === "fondo");
  const liberos = rotacion.liberos ?? [];

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-2 inline-block relative">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-xs font-semibold text-slate-700">
          Rot {numeroRotacion}
        </span>
        <div className="flex gap-0.5">
          <button
            onClick={() => handleGirar(-1)}
            className="w-5 h-5 flex items-center justify-center bg-white border border-slate-300 rounded text-[10px] hover:bg-slate-50"
          >
            ◀
          </button>
          <button
            onClick={() => handleGirar(1)}
            className="w-5 h-5 flex items-center justify-center bg-white border border-slate-300 rounded text-[10px] hover:bg-slate-50"
          >
            ▶
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 mb-1.5">
        <div className="flex rounded overflow-hidden border border-slate-300 text-[9px]">
          <button
            onClick={() => handleToggleSaque("propio")}
            className={`px-1.5 py-0.5 font-medium transition ${
              rotacion.saque_equipo === "propio"
                ? "bg-emerald-500 text-white"
                : "bg-white text-slate-600"
            }`}
            title="Mi equipo saca"
          >
            S
          </button>
          <button
            onClick={() => handleToggleSaque("rival")}
            className={`px-1.5 py-0.5 font-medium transition ${
              rotacion.saque_equipo === "rival"
                ? "bg-orange-500 text-white"
                : "bg-white text-slate-600"
            }`}
            title="Rival saca"
          >
            R
          </button>
        </div>

        <button
          onClick={() => setEditandoLiberos((v) => !v)}
          className={`px-1.5 py-0.5 rounded text-[9px] font-medium border ${
            liberos.length > 0
              ? "bg-pink-500 text-white border-pink-500"
              : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
          }`}
          title="Líberos"
        >
          Líberos ({liberos.length})
        </button>
      </div>

      <div className="text-center text-[8px] font-bold text-slate-400 leading-none mb-0.5">
        ── RED ──
      </div>

      <div className="grid grid-cols-3 gap-0.5">
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

      {editandoLiberos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setEditandoLiberos(false)} />
          <div className="absolute z-50 top-full mt-1 left-0 bg-white border-2 border-slate-300 rounded-lg shadow-lg p-2 w-60 max-h-72 overflow-y-auto">
            <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">
              Elegí hasta 2 líberos
            </p>
            <p className="text-[9px] text-slate-400 mb-2">
              Si hay 1 solo, cumple defensa y recepción.
            </p>
            {jugadores.map((j) => {
              const lib = liberos.find((l) => l.jugador_id === j.id);
              const activo = !!lib;
              const puedeAgregar = activo || liberos.length < 2;
              return (
                <div key={j.id} className="flex items-center gap-1 mb-1">
                  <button
                    onClick={() => puedeAgregar && toggleLibero(j.id)}
                    disabled={!puedeAgregar}
                    className={`flex-1 text-left px-2 py-1 text-xs rounded ${
                      activo
                        ? "bg-pink-500 text-white font-semibold"
                        : puedeAgregar
                        ? "text-slate-700 hover:bg-pink-50"
                        : "text-slate-300 cursor-not-allowed"
                    }`}
                  >
                    {j.nombre}
                    {j.numero !== null && ` #${j.numero}`}
                  </button>
                  {activo && (
                    <div className="flex rounded overflow-hidden border border-pink-300 text-[9px]">
                      <button
                        onClick={() => cambiarTipoLibero(j.id, "defensa")}
                        className={`px-1 py-0.5 ${
                          lib.tipo === "defensa"
                            ? "bg-pink-500 text-white"
                            : "bg-white text-slate-500"
                        }`}
                        title="Defensa"
                      >
                        D
                      </button>
                      <button
                        onClick={() => cambiarTipoLibero(j.id, "recepcion")}
                        className={`px-1 py-0.5 ${
                          lib.tipo === "recepcion"
                            ? "bg-pink-500 text-white"
                            : "bg-white text-slate-500"
                        }`}
                        title="Recepción"
                      >
                        R
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            <button
              onClick={() => setEditandoLiberos(false)}
              className="w-full mt-2 py-1 text-[10px] text-slate-500 hover:text-slate-700"
            >
              Cerrar
            </button>
          </div>
        </>
      )}
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
        className={`w-12 h-10 border rounded p-0.5 flex flex-col items-center justify-center transition hover:shadow-sm ${color}`}
      >
        <span className="text-[7px] font-bold text-slate-400 absolute top-0 left-0.5">
          {zona}
        </span>
        <span className="text-[10px] font-bold text-slate-800 leading-none">
          {asig?.rol ?? "?"}
        </span>
        <span className="text-[7px] text-slate-500 leading-tight truncate w-full px-0.5">
          {nombre ?? "—"}
        </span>
      </button>

      {editando && (
        <>
          <div className="fixed inset-0 z-40" onClick={onCerrar} />
          <div className="absolute z-50 top-full mt-1 left-1/2 -translate-x-1/2 bg-white border-2 border-slate-300 rounded-lg shadow-lg p-2 w-44 max-h-56 overflow-y-auto">
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