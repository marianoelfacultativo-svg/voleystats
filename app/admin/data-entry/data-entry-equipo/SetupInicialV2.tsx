"use client";

// ============================================================
// SETUP INICIAL V2 — pantalla "Antes de empezar el partido"
// modo = "setup"  → título + panel rotación + botón Comenzar
// modo = "carga"  → solo el panel rotación (para usar durante el partido)
// ============================================================

import PanelRotacionV2, {
  type CambioPendiente,
} from "./PanelRotacionV2";
import type { Jugador } from "./tiposV2";
import type { Libero, RotacionPunto, SaqueEquipo, Zona } from "@/lib/rotaciones";

interface Props {
  rotacion: RotacionPunto | null;
  jugadores: Jugador[];
  liberos: Libero[];
  posicionesPunto: Record<Zona, string>;
  posicionesFijasActuales: Record<Zona, string>;
  cambiosPendientes: CambioPendiente[];
  saqueInicial: "propio" | "rival";
  nombreMiEquipo: string;
  nombreRival: string;
  modo?: "setup" | "carga";

  onFijarPosiciones: (pos: Record<Zona, string>) => void;
  onLimpiarFijadas: () => void;
  onSetLiberos: (liberos: Libero[]) => void;
  onSetPosicionesPunto: (pos: Record<Zona, string>) => void;
  onSetCambiosPendientes: (cambios: CambioPendiente[]) => void;
  onGuardarCambios: () => void;
  onCambioRotacion: (dir: 1 | -1) => void;
  onCambioSaque: (equipo: SaqueEquipo) => void;
  onComenzar: () => void;
}

export default function SetupInicialV2({
  rotacion,
  jugadores,
  liberos,
  posicionesPunto,
  posicionesFijasActuales,
  cambiosPendientes,
  saqueInicial,
  nombreMiEquipo,
  nombreRival,
  modo = "setup",
  onFijarPosiciones,
  onLimpiarFijadas,
  onSetLiberos,
  onSetPosicionesPunto,
  onSetCambiosPendientes,
  onGuardarCambios,
  onCambioRotacion,
  onCambioSaque,
  onComenzar,
}: Props) {
  const jugadoresUI = jugadores.map((j) => ({
    id: j.id,
    nombre: j.nombre,
    numero: j.numero,
  }));

  // ----------------------------------------
  // Modo CARGA: solo el panel de rotación
  // ----------------------------------------
  if (modo === "carga") {
    if (!rotacion) return null;
    return (
      <PanelRotacionV2
        rotacion={rotacion}
        jugadoresEnCancha={jugadoresUI}
        jugadoresDisponibles={jugadoresUI}
        liberos={liberos}
        posicionesPunto={posicionesPunto}
        posicionesFijas={posicionesFijasActuales}
        cambiosPendientes={cambiosPendientes}
        onFijarPosiciones={onFijarPosiciones}
        onLimpiarFijadas={onLimpiarFijadas}
        onSetLiberos={onSetLiberos}
        onSetPosicionesPunto={onSetPosicionesPunto}
        onSetCambiosPendientes={onSetCambiosPendientes}
        onGuardarCambios={onGuardarCambios}
        onCambioRotacion={onCambioRotacion}
        onCambioSaque={onCambioSaque}
      />
    );
  }

  // ----------------------------------------
  // Modo SETUP: título + panel + Comenzar
  // ----------------------------------------
  return (
    <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-4 space-y-3">
      <h2 className="text-lg font-bold text-amber-900">
        🎬 Antes de empezar el partido
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
        <div>
          {rotacion && (
            <PanelRotacionV2
              rotacion={rotacion}
              jugadoresEnCancha={jugadoresUI}
              jugadoresDisponibles={jugadoresUI}
              liberos={liberos}
              posicionesPunto={posicionesPunto}
              posicionesFijas={posicionesFijasActuales}
              cambiosPendientes={cambiosPendientes}
              onFijarPosiciones={onFijarPosiciones}
              onLimpiarFijadas={onLimpiarFijadas}
              onSetLiberos={onSetLiberos}
              onSetPosicionesPunto={onSetPosicionesPunto}
              onSetCambiosPendientes={onSetCambiosPendientes}
              onGuardarCambios={onGuardarCambios}
              onCambioRotacion={onCambioRotacion}
              onCambioSaque={onCambioSaque}
            />
          )}
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-bold text-amber-800 uppercase mb-1">
              ¿Quién saca el primer punto?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => onCambioSaque("propio")}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                  saqueInicial === "propio"
                    ? "bg-emerald-500 text-white"
                    : "bg-white text-slate-700 border border-slate-300"
                }`}
              >
                {nombreMiEquipo}
              </button>
              <button
                onClick={() => onCambioSaque("rival")}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                  saqueInicial === "rival"
                    ? "bg-orange-500 text-white"
                    : "bg-white text-slate-700 border border-slate-300"
                }`}
              >
                {nombreRival}
              </button>
            </div>
          </div>
          <button
            onClick={onComenzar}
            className="w-full px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg text-lg"
          >
            ✓ Comenzar partido
          </button>
        </div>
      </div>
    </div>
  );
}