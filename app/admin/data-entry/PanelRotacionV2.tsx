"use client";

import { useMemo, useState } from "react";
import type {
  RotacionPunto,
  Zona,
  Libero,
  SaqueEquipo,
} from "@/lib/rotaciones";

// ============================================================
// TIPOS
// ============================================================

interface Jugador {
  id: string;
  nombre: string;
  numero: number | null;
  rol?: string;
}

export interface CambioPendiente {
  zona: Zona;
  jugadorSale: string;
  jugadorEntra: string;
}

interface Props {
  rotacion: RotacionPunto;
  jugadoresEnCancha: Jugador[];
  jugadoresDisponibles: Jugador[];
  liberos: Libero[];
  posicionesPunto: Record<Zona, string>;
  cambiosPendientes: CambioPendiente[];
  onSetLiberos: (liberos: Libero[]) => void;
  onSetPosicionesPunto: (pos: Record<Zona, string>) => void;
  onSetCambiosPendientes: (cambios: CambioPendiente[]) => void;
  onGuardarCambios: () => void;
  onCambioRotacion?: (dir: 1 | -1) => void;
  onCambioSaque?: (equipo: SaqueEquipo) => void;
}

// ============================================================
// LAYOUT DE ZONAS
// ============================================================

const LAYOUT: { zona: Zona; fila: "frente" | "fondo" }[] = [
  { zona: 4, fila: "frente" },
  { zona: 3, fila: "frente" },
  { zona: 2, fila: "frente" },
  { zona: 5, fila: "fondo" },
  { zona: 6, fila: "fondo" },
  { zona: 1, fila: "fondo" },
];

const ROL_COLOR: Record<string, string> = {
  A: "border-violet-400 bg-violet-50 text-violet-800",
  O: "border-orange-400 bg-orange-50 text-orange-800",
  C1: "border-blue-400 bg-blue-50 text-blue-800",
  C2: "border-blue-400 bg-blue-50 text-blue-800",
  P1: "border-emerald-400 bg-emerald-50 text-emerald-800",
  P2: "border-emerald-400 bg-emerald-50 text-emerald-800",
  L: "border-pink-400 bg-pink-50 text-pink-800",
};

// ============================================================
// PANEL PRINCIPAL
// ============================================================

export default function PanelRotacionV2({
  rotacion,
  jugadoresEnCancha,
  jugadoresDisponibles,
  liberos,
  posicionesPunto,
  cambiosPendientes,
  onSetLiberos,
  onSetPosicionesPunto,
  onSetCambiosPendientes,
  onGuardarCambios,
  onCambioRotacion,
  onCambioSaque,
}: Props) {
  const [modalCambio, setModalCambio] = useState<Zona | null>(null);
  const [modalPosicion, setModalPosicion] = useState(false);
  const [modalLibero, setModalLibero] = useState(false);

  const nombreDe = (id: string | null | undefined) => {
    if (!id) return "—";
    const j = jugadoresEnCancha.find((x) => x.id === id) ??
      jugadoresDisponibles.find((x) => x.id === id);
    if (!j) return "?";
    const partes = j.nombre.split(" ");
    return partes.length > 1 ? partes[0] : j.nombre.slice(0, 8);
  };

  // Jugadores efectivos por zona (aplicando cambios pendientes)
  const jugadorEnZona = (zona: Zona): string | null => {
    const base = rotacion.posiciones[zona]?.jugador_id ?? null;
    if (!base) return null;
    const pend = cambiosPendientes.find((c) => c.zona === zona);
    return pend ? pend.jugadorEntra : base;
  };

  const rolEnZona = (zona: Zona): string => {
    const base = rotacion.posiciones[zona];
    return base?.rol ?? "?";
  };

  // ¿Hay cambios pendientes sin guardar?
  const hayCambios = cambiosPendientes.length > 0;

  const handleAplicarCambio = (jugadorNuevo: Jugador) => {
    if (modalCambio === null) return;
    const zona = modalCambio;
    const jugadorViejo = jugadorEnZona(zona);
    if (!jugadorViejo) return;

    // Sacar cualquier cambio previo para esa zona
    const sinPrev = cambiosPendientes.filter((c) => c.zona !== zona);
    onSetCambiosPendientes([
      ...sinPrev,
      {
        zona,
        jugadorSale: jugadorViejo,
        jugadorEntra: jugadorNuevo.id,
      },
    ]);
    setModalCambio(null);
  };

  const handleCancelarCambio = (zona: Zona) => {
    onSetCambiosPendientes(cambiosPendientes.filter((c) => c.zona !== zona));
  };

  const frente = LAYOUT.filter((l) => l.fila === "frente");
  const fondo = LAYOUT.filter((l) => l.fila === "fondo");

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-2 inline-block relative">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-xs font-semibold text-slate-700">
          Rotación actual
        </span>
        <div className="flex gap-0.5">
          <button
            onClick={() => onCambioRotacion?.(-1)}
            disabled={!onCambioRotacion}
            className="w-5 h-5 flex items-center justify-center bg-white border border-slate-300 rounded text-[10px] hover:bg-slate-50 disabled:opacity-40"
          >
            ◀
          </button>
          <button
            onClick={() => onCambioRotacion?.(1)}
            disabled={!onCambioRotacion}
            className="w-5 h-5 flex items-center justify-center bg-white border border-slate-300 rounded text-[10px] hover:bg-slate-50 disabled:opacity-40"
          >
            ▶
          </button>
        </div>
      </div>

      {/* Saque + Líberos */}
      <div className="flex items-center gap-1 mb-1.5">
        <div className="flex rounded overflow-hidden border border-slate-300 text-[9px]">
          <button
            onClick={() => onCambioSaque?.("propio")}
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
            onClick={() => onCambioSaque?.("rival")}
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
          onClick={() => setModalLibero(true)}
          className={`px-1.5 py-0.5 rounded text-[9px] font-medium border ${
            liberos.length > 0
              ? "bg-pink-500 text-white border-pink-500"
              : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
          }`}
        >
          Líberos ({liberos.length})
        </button>

        <button
          onClick={() => setModalPosicion(true)}
          className="px-1.5 py-0.5 rounded text-[9px] font-medium border bg-cyan-50 text-cyan-800 border-cyan-300 hover:bg-cyan-100"
          title="Ajustar posición del punto"
        >
          📋 Posición
        </button>
      </div>

      <div className="text-center text-[8px] font-bold text-slate-400 leading-none mb-0.5">
        ── RED ──
      </div>

      {/* Grid de zonas */}
      <div className="grid grid-cols-3 gap-0.5">
        {frente.map((l) => (
          <CeldaZona
            key={l.zona}
            zona={l.zona}
            jugadorNombre={nombreDe(jugadorEnZona(l.zona))}
            rol={rolEnZona(l.zona)}
            tieneCambio={cambiosPendientes.some((c) => c.zona === l.zona)}
            onClick={() => setModalCambio(l.zona)}
          />
        ))}
        {fondo.map((l) => (
          <CeldaZona
            key={l.zona}
            zona={l.zona}
            jugadorNombre={nombreDe(jugadorEnZona(l.zona))}
            rol={rolEnZona(l.zona)}
            tieneCambio={cambiosPendientes.some((c) => c.zona === l.zona)}
            onClick={() => setModalCambio(l.zona)}
          />
        ))}
      </div>

      {/* Footer con cambios pendientes y botón de guardar */}
      <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between gap-1">
        <div className="text-[9px] text-slate-500">
          {hayCambios ? (
            <span className="text-amber-700 font-semibold">
              {cambiosPendientes.length} cambio
              {cambiosPendientes.length !== 1 ? "s" : ""} pendiente
              {cambiosPendientes.length !== 1 ? "s" : ""}
            </span>
          ) : (
            <span>Sin cambios</span>
          )}
        </div>
        <div className="flex gap-1">
          {hayCambios && (
            <button
              onClick={() => onSetCambiosPendientes([])}
              className="px-2 py-0.5 text-[9px] rounded border border-slate-300 hover:bg-slate-50 text-slate-600"
            >
              Descartar
            </button>
          )}
          <button
            onClick={onGuardarCambios}
            disabled={!hayCambios}
            className="px-2 py-0.5 text-[9px] rounded bg-emerald-500 text-white font-semibold hover:bg-emerald-600 disabled:opacity-40"
          >
            Guardar cambios
          </button>
        </div>
      </div>

      {/* ---------- MODAL: CAMBIO EN ZONA ---------- */}
      {modalCambio !== null && (
        <ModalCambio
          zona={modalCambio}
          jugadorActualId={jugadorEnZona(modalCambio)}
          jugadoresEnCancha={jugadoresEnCancha}
          jugadoresDisponibles={jugadoresDisponibles}
          liberos={liberos}
          onAplicar={handleAplicarCambio}
          onCancelar={() => setModalCambio(null)}
          onQuitarCambio={() => {
            handleCancelarCambio(modalCambio);
            setModalCambio(null);
          }}
          tieneCambioPendiente={cambiosPendientes.some(
            (c) => c.zona === modalCambio
          )}
        />
      )}

      {/* ---------- MODAL: POSICIÓN DEL PUNTO ---------- */}
      {modalPosicion && (
        <ModalPosicion
          posicionesPunto={posicionesPunto}
          jugadoresEnCancha={jugadoresEnCancha}
          jugadorEnZona={jugadorEnZona}
          onSetPosicionesPunto={onSetPosicionesPunto}
          onCerrar={() => setModalPosicion(false)}
        />
      )}

      {/* ---------- MODAL: LÍBEROS ---------- */}
      {modalLibero && (
        <ModalLibero
          todosLosJugadores={[...jugadoresEnCancha, ...jugadoresDisponibles]}
          liberos={liberos}
          onSetLiberos={onSetLiberos}
          onCerrar={() => setModalLibero(false)}
        />
      )}
    </div>
  );
}

// ============================================================
// CELDA DE ZONA
// ============================================================

function CeldaZona({
  zona,
  jugadorNombre,
  rol,
  tieneCambio,
  onClick,
}: {
  zona: Zona;
  jugadorNombre: string;
  rol: string;
  tieneCambio: boolean;
  onClick: () => void;
}) {
  const colorRol =
    ROL_COLOR[rol] ?? "border-slate-300 bg-slate-50 text-slate-700";

  return (
    <button
      onClick={onClick}
      className={`w-14 h-11 border-2 rounded p-0.5 flex flex-col items-center justify-center transition hover:shadow-sm relative ${colorRol} ${
        tieneCambio ? "ring-2 ring-amber-400" : ""
      }`}
    >
      <span className="text-[7px] font-bold text-slate-400 absolute top-0 left-0.5">
        {zona}
      </span>
      {tieneCambio && (
        <span className="absolute top-0 right-0.5 text-[8px] text-amber-600 font-bold">
          ↻
        </span>
      )}
      <span className="text-[10px] font-bold leading-none">{rol}</span>
      <span className="text-[7px] leading-tight truncate w-full px-0.5">
        {jugadorNombre}
      </span>
    </button>
  );
}

// ============================================================
// MODAL: CAMBIO EN ZONA
// ============================================================

function ModalCambio({
  zona,
  jugadorActualId,
  jugadoresEnCancha,
  jugadoresDisponibles,
  liberos,
  onAplicar,
  onCancelar,
  onQuitarCambio,
  tieneCambioPendiente,
}: {
  zona: Zona;
  jugadorActualId: string | null;
  jugadoresEnCancha: Jugador[];
  jugadoresDisponibles: Jugador[];
  liberos: Libero[];
  onAplicar: (j: Jugador) => void;
  onCancelar: () => void;
  onQuitarCambio: () => void;
  tieneCambioPendiente: boolean;
}) {
  const nombreDe = (id: string | null) => {
    if (!id) return "—";
    const j = jugadoresEnCancha.find((x) => x.id === id) ??
      jugadoresDisponibles.find((x) => x.id === id);
    return j ? `${j.nombre}${j.numero !== null ? ` #${j.numero}` : ""}` : "?";
  };

  const esLibero = (id: string) => liberos.some((l) => l.jugador_id === id);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onCancelar}
      />
      <div className="absolute z-50 top-full mt-1 left-0 bg-white border-2 border-slate-300 rounded-lg shadow-lg p-2 w-64 max-h-80 overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold text-slate-600 uppercase">
            Cambio en Z{zona}
          </p>
          <button
            onClick={onCancelar}
            className="text-slate-400 hover:text-slate-700 text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="mb-2 p-1.5 bg-slate-100 rounded text-[10px] text-slate-700">
          En cancha: <strong>{nombreDe(jugadorActualId)}</strong>
        </div>

        {tieneCambioPendiente && (
          <button
            onClick={onQuitarCambio}
            className="w-full mb-2 py-1 text-[10px] rounded bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300"
          >
            ↩ Deshacer cambio pendiente
          </button>
        )}

        <p className="text-[9px] text-slate-500 uppercase mb-1">
          Disponibles
        </p>

        {jugadoresDisponibles.length === 0 && (
          <p className="text-[10px] text-slate-400 italic">
            No hay jugadores disponibles
          </p>
        )}

        <div className="space-y-0.5">
          {jugadoresDisponibles.map((j) => (
            <button
              key={j.id}
              onClick={() => onAplicar(j)}
              className={`w-full text-left px-2 py-1 text-xs rounded hover:bg-emerald-50 flex items-center justify-between ${
                esLibero(j.id) ? "bg-pink-50" : ""
              }`}
            >
              <span className="text-slate-700">
                {j.nombre}
                {j.numero !== null ? ` #${j.numero}` : ""}
              </span>
              {esLibero(j.id) && (
                <span className="text-[8px] text-pink-600 font-bold">L</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// ============================================================
// MODAL: POSICIÓN DEL PUNTO
// ============================================================

function ModalPosicion({
  posicionesPunto,
  jugadoresEnCancha,
  jugadorEnZona,
  onSetPosicionesPunto,
  onCerrar,
}: {
  posicionesPunto: Record<Zona, string>;
  jugadoresEnCancha: Jugador[];
  jugadorEnZona: (z: Zona) => string | null;
  onSetPosicionesPunto: (p: Record<Zona, string>) => void;
  onCerrar: () => void;
}) {
  const [seleccionado, setSeleccionado] = useState<Zona | null>(null);
  // Copia local para editar antes de confirmar
  const [local, setLocal] = useState<Record<Zona, string>>(() => ({
    1: jugadorEnZona(1) ?? "",
    2: jugadorEnZona(2) ?? "",
    3: jugadorEnZona(3) ?? "",
    4: jugadorEnZona(4) ?? "",
    5: jugadorEnZona(5) ?? "",
    6: jugadorEnZona(6) ?? "",
  }));

  const nombreDe = (id: string) => {
    if (!id) return "—";
    const j = jugadoresEnCancha.find((x) => x.id === id);
    if (!j) return "?";
    const partes = j.nombre.split(" ");
    return partes.length > 1 ? partes[0] : j.nombre.slice(0, 8);
  };

  const handleClickZona = (zona: Zona) => {
    if (seleccionado === null) {
      setSeleccionado(zona);
      return;
    }
    if (seleccionado === zona) {
      setSeleccionado(null);
      return;
    }
    // Intercambiar
    const copia = { ...local };
    const temp = copia[seleccionado];
    copia[seleccionado] = copia[zona];
    copia[zona] = temp;
    setLocal(copia);
    setSeleccionado(null);
  };

  const handleGuardar = () => {
    onSetPosicionesPunto(local);
    onCerrar();
  };

  const handleReset = () => {
    setLocal({
      1: jugadorEnZona(1) ?? "",
      2: jugadorEnZona(2) ?? "",
      3: jugadorEnZona(3) ?? "",
      4: jugadorEnZona(4) ?? "",
      5: jugadorEnZona(5) ?? "",
      6: jugadorEnZona(6) ?? "",
    });
    setSeleccionado(null);
  };

  const zonaBtn = (zona: Zona, esFrente: boolean) => {
    const id = local[zona];
    const sel = seleccionado === zona;
    return (
      <button
        key={zona}
        onClick={() => handleClickZona(zona)}
        className={`w-16 h-14 border-2 rounded p-1 flex flex-col items-center justify-center transition ${
          sel
            ? "border-cyan-500 bg-cyan-100 ring-2 ring-cyan-300"
            : "border-slate-300 bg-slate-50 hover:bg-cyan-50"
        }`}
      >
        <span className="text-[8px] font-bold text-slate-400">Z{zona}</span>
        <span className="text-[10px] font-semibold text-slate-800 truncate w-full text-center">
          {nombreDe(id)}
        </span>
      </button>
    );
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onCerrar} />
      <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white border-2 border-cyan-400 rounded-lg shadow-2xl p-4 w-[340px]">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-cyan-800">
            📋 Posición del punto
          </p>
          <button
            onClick={onCerrar}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <p className="text-[10px] text-slate-500 mb-3">
          Click en un jugador, después en otro, para intercambiar sus
          posiciones. Solo aplica a este punto.
        </p>

        <div className="text-center text-[9px] font-bold text-slate-400 mb-0.5">
          ── RED ──
        </div>
        <div className="grid grid-cols-3 gap-1 mb-1">
          {zonaBtn(4, true)}
          {zonaBtn(3, true)}
          {zonaBtn(2, true)}
        </div>
        <div className="grid grid-cols-3 gap-1 mb-3">
          {zonaBtn(5, false)}
          {zonaBtn(6, false)}
          {zonaBtn(1, false)}
        </div>

        <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200">
          <button
            onClick={handleReset}
            className="text-[10px] text-slate-500 hover:text-slate-700"
          >
            Restablecer
          </button>
          <div className="flex gap-2">
            <button
              onClick={onCerrar}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-600"
            >
              Cancelar
            </button>
            <button
              onClick={handleGuardar}
              className="px-3 py-1.5 text-xs rounded-lg bg-cyan-500 text-white font-semibold hover:bg-cyan-600"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================================
// MODAL: LÍBEROS
// ============================================================

function ModalLibero({
  todosLosJugadores,
  liberos,
  onSetLiberos,
  onCerrar,
}: {
  todosLosJugadores: Jugador[];
  liberos: Libero[];
  onSetLiberos: (l: Libero[]) => void;
  onCerrar: () => void;
}) {
  const toggleLibero = (jugador_id: string) => {
    const yaEsta = liberos.find((l) => l.jugador_id === jugador_id);
    if (yaEsta) {
      onSetLiberos(liberos.filter((l) => l.jugador_id !== jugador_id));
    } else {
      if (liberos.length >= 2) return;
      const tipo: Libero["tipo"] =
        liberos.length === 0 ? "defensa" : "recepcion";
      onSetLiberos([...liberos, { jugador_id, tipo }]);
    }
  };

  const cambiarTipo = (jugador_id: string, tipo: Libero["tipo"]) => {
    onSetLiberos(
      liberos.map((l) =>
        l.jugador_id === jugador_id ? { ...l, tipo } : l
      )
    );
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onCerrar} />
      <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white border-2 border-pink-400 rounded-lg shadow-2xl p-4 w-[300px] max-h-[70vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-pink-800">
            🦺 Líberos ({liberos.length}/2)
          </p>
          <button
            onClick={onCerrar}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <p className="text-[10px] text-slate-500 mb-3">
          Elegí hasta 2 líberos entre todos los jugadores. Los líberos se
          intercambian entre sí pero no reemplazan a un tercero.
        </p>

        <div className="space-y-1">
          {todosLosJugadores.map((j) => {
            const lib = liberos.find((l) => l.jugador_id === j.id);
            const activo = !!lib;
            const puedeAgregar = activo || liberos.length < 2;
            return (
              <div key={j.id} className="flex items-center gap-1">
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
                      onClick={() => cambiarTipo(j.id, "defensa")}
                      className={`px-1.5 py-0.5 ${
                        lib.tipo === "defensa"
                          ? "bg-pink-500 text-white"
                          : "bg-white text-slate-500"
                      }`}
                      title="Defensa"
                    >
                      D
                    </button>
                    <button
                      onClick={() => cambiarTipo(j.id, "recepcion")}
                      className={`px-1.5 py-0.5 ${
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
        </div>

        <button
          onClick={onCerrar}
          className="w-full mt-3 py-1.5 text-xs rounded-lg bg-pink-500 text-white font-semibold hover:bg-pink-600"
        >
          Listo
        </button>
      </div>
    </>
  );
}