"use client";

// ============================================================
// SETUP INICIAL V2 — pantalla "Antes de empezar el partido"
// modo = "setup"  → título + panel rotación + botón Comenzar
// modo = "carga"  → solo el panel rotación (para usar durante el partido)
// ============================================================

import PanelRotacionV2, {
  type CambioPendiente,
} from "./PanelRotacionV2";
import type { Jugador, EquipoOpcion } from "./tiposV2";
import type { Libero, RotacionPunto, SaqueEquipo, Zona } from "@/lib/rotaciones";

interface Props {
  // ---------- MI EQUIPO ----------
  rotacion: RotacionPunto | null;
  jugadores: Jugador[];
  liberos: Libero[];
  posicionesPunto: Record<Zona, string>;
  posicionesFijasActuales: Record<Zona, string>;
  cambiosPendientes: CambioPendiente[];
  saqueInicial: "propio" | "rival";
  nombreMiEquipo: string;
  nombreRival: string;

  // ---------- MODO ESPEJO ----------
  modoEspejo: boolean;
  equiposDisponibles: EquipoOpcion[];
  equipoRivalId: string | null;
  nombreEquipoRival: string;

  // ---------- EQUIPO RIVAL ----------
  rotacionRival: RotacionPunto | null;
  jugadoresRival: Jugador[];
  liberosRival: Libero[];
  posicionesPuntoRival: Record<Zona, string>;
  posicionesFijasActualesRival: Record<Zona, string>;
  cambiosPendientesRival: CambioPendiente[];

  // ---------- HANDLERS MI EQUIPO ----------
  onFijarPosiciones: (pos: Record<Zona, string>) => void;
  onLimpiarFijadas: () => void;
  onSetLiberos: (liberos: Libero[]) => void;
  onSetPosicionesPunto: (pos: Record<Zona, string>) => void;
  onSetCambiosPendientes: (cambios: CambioPendiente[]) => void;
  onGuardarCambios: () => void;
  onCambioRotacion: (dir: 1 | -1) => void;
  onCambioSaque: (equipo: SaqueEquipo) => void;

  // ---------- HANDLERS MODO ESPEJO ----------
  onToggleModoEspejo: (v: boolean) => void;
  onSetEquipoRivalId: (id: string | null) => void;

  // ---------- HANDLERS EQUIPO RIVAL ----------
  onFijarPosicionesRival: (pos: Record<Zona, string>) => void;
  onLimpiarFijadasRival: () => void;
  onSetLiberosRival: (liberos: Libero[]) => void;
  onSetPosicionesPuntoRival: (pos: Record<Zona, string>) => void;
  onSetCambiosPendientesRival: (cambios: CambioPendiente[]) => void;
  onGuardarCambiosRival: () => void;
  onCambioRotacionRival: (dir: 1 | -1) => void;
  onCambioSaqueRival: (equipo: SaqueEquipo) => void;

  // ---------- COMÚN ----------
  modo?: "setup" | "carga";
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
  modoEspejo,
  equiposDisponibles,
  equipoRivalId,
  nombreEquipoRival,
  rotacionRival,
  jugadoresRival,
  liberosRival,
  posicionesPuntoRival,
  posicionesFijasActualesRival,
  cambiosPendientesRival,
  onFijarPosiciones,
  onLimpiarFijadas,
  onSetLiberos,
  onSetPosicionesPunto,
  onSetCambiosPendientes,
  onGuardarCambios,
  onCambioRotacion,
  onCambioSaque,
  onToggleModoEspejo,
  onSetEquipoRivalId,
  onFijarPosicionesRival,
  onLimpiarFijadasRival,
  onSetLiberosRival,
  onSetPosicionesPuntoRival,
  onSetCambiosPendientesRival,
  onGuardarCambiosRival,
  onCambioRotacionRival,
  onCambioSaqueRival,
  modo = "setup",
  onComenzar,
}: Props) {
  const jugadoresUI = jugadores.map((j) => ({
    id: j.id,
    nombre: j.nombre,
    numero: j.numero,
  }));

  const jugadoresRivalUI = jugadoresRival.map((j) => ({
    id: j.id,
    nombre: j.nombre,
    numero: j.numero,
  }));

  const mostrarPanelRival =
    modoEspejo && !!equipoRivalId && rotacionRival !== null;

  // ----------------------------------------------------------
  // PANELES (reutilizados en ambos modos)
  // ----------------------------------------------------------
  const panelPropio = rotacion ? (
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
  ) : null;

  const panelRival = mostrarPanelRival ? (
    <div className="flex flex-col gap-1">
      <p className="text-[10px] font-bold text-orange-700 uppercase tracking-wide">
        Rotación rival — {nombreEquipoRival || "Equipo rival"}
      </p>
      <PanelRotacionV2
        rotacion={rotacionRival!}
        jugadoresEnCancha={jugadoresRivalUI}
        jugadoresDisponibles={jugadoresRivalUI}
        liberos={liberosRival}
        posicionesPunto={posicionesPuntoRival}
        posicionesFijas={posicionesFijasActualesRival}
        cambiosPendientes={cambiosPendientesRival}
        onFijarPosiciones={onFijarPosicionesRival}
        onLimpiarFijadas={onLimpiarFijadasRival}
        onSetLiberos={onSetLiberosRival}
        onSetPosicionesPunto={onSetPosicionesPuntoRival}
        onSetCambiosPendientes={onSetCambiosPendientesRival}
        onGuardarCambios={onGuardarCambiosRival}
        onCambioRotacion={onCambioRotacionRival}
        onCambioSaque={onCambioSaqueRival}
      />
    </div>
  ) : null;

  // ----------------------------------------------------------
  // MODO CARGA: solo paneles
  // ----------------------------------------------------------
  if (modo === "carga") {
    if (!rotacion) return null;
    return (
      <div className="flex gap-3 flex-wrap items-start">
        {panelPropio}
        {panelRival}
      </div>
    );
  }

  // ----------------------------------------------------------
  // MODO SETUP
  // ----------------------------------------------------------
  return (
    <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-4 space-y-3">
      <h2 className="text-lg font-bold text-amber-900">
        🎬 Antes de empezar el partido
      </h2>

      {/* Toggle modo espejo + selector equipo rival */}
      <div className="flex flex-wrap items-center gap-3 bg-white border border-amber-200 rounded-lg p-3">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={modoEspejo}
            onChange={(e) => onToggleModoEspejo(e.target.checked)}
            className="w-4 h-4 accent-fuchsia-600"
          />
          <span className="text-sm font-semibold text-fuchsia-800">
            🔀 Modo espejo (cargar también al rival)
          </span>
        </label>

        {modoEspejo && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">
              Equipo rival:
            </span>
            <select
              value={equipoRivalId ?? ""}
              onChange={(e) =>
                onSetEquipoRivalId(e.target.value || null)
              }
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-fuchsia-500"
            >
              <option value="">— Elegí equipo rival —</option>
              {equiposDisponibles.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.nombre}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {modoEspejo && !equipoRivalId && (
        <p className="text-xs text-amber-800 bg-amber-100 border border-amber-300 rounded px-3 py-2">
          ⚠️ Elegí un equipo rival para configurar su rotación.
        </p>
      )}

      {modoEspejo &&
        equipoRivalId &&
        jugadoresRival.length === 0 && (
          <p className="text-xs text-amber-800 bg-amber-100 border border-amber-300 rounded px-3 py-2">
            ⚠️ Este equipo rival no tiene jugadores asignados.
          </p>
        )}

      {/* Paneles de rotación */}
      <div className="flex gap-4 flex-wrap items-start">
        {panelPropio}
        {panelRival}
      </div>

      {/* Saque inicial + Comenzar */}
      <div className="space-y-3 pt-2 border-t border-amber-300">
        <div>
          <p className="text-xs font-bold text-amber-800 uppercase mb-1">
            ¿Quién saca el primer punto?
          </p>
          <div className="flex gap-2 flex-wrap">
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
              {modoEspejo && nombreEquipoRival
                ? nombreEquipoRival
                : nombreRival}
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
  );
}