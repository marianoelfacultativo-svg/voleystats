"use client";

import { useState } from "react";
import {
  numeroRotacionDesdePosiciones,
  type RotacionPunto,
  type Zona,
  type Libero,
  type SaqueEquipo,
} from "@/lib/rotaciones";
import {
  POSICIONES_JUEGO,
  resolverRolAJugador,
  type Situacion,
} from "@/lib/clasificacionV2";

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

export type ZonaRecepcion = 1 | 5 | 6;
export type RecepcionOverrides = Partial<
  Record<ZonaRecepcion, string | null>
>;

interface Props {
  rotacion: RotacionPunto;
  jugadoresEnCancha: Jugador[];
  jugadoresDisponibles: Jugador[];
  liberos: Libero[];
  posicionesPunto: Record<Zona, string>;
  posicionesFijas: Record<Zona, string>;
  cambiosPendientes: CambioPendiente[];

  tieneFijadas?: boolean;

  onFijarPosiciones?: (pos: Record<Zona, string>) => void;
  onLimpiarFijadas?: () => void;

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
  posicionesFijas,
  cambiosPendientes,
  tieneFijadas: tieneFijadasProp,
  onFijarPosiciones,
  onLimpiarFijadas,
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

  const situacion: Situacion =
    rotacion.saque_equipo === "rival" ? "recepcion" : "saque";

  // Rotación efectiva: la que usa resolverRolAJugador para ver los líberos
  // que el usuario cargó (que viven en el state `liberos`, no en rotacion).
  const rotacionConLiberos: RotacionPunto = { ...rotacion, liberos };

  const nombreDe = (id: string | null | undefined) => {
    if (!id) return "—";
    const j =
      jugadoresEnCancha.find((x) => x.id === id) ??
      jugadoresDisponibles.find((x) => x.id === id);
    if (!j) return "?";
    const partes = j.nombre.split(" ");
    return partes.length > 1 ? partes[0] : j.nombre.slice(0, 8);
  };

  const idsLiberos = new Set(liberos.map((l) => l.jugador_id));

  // Panel: solo rotación base + overrides (sin líbero resuelto).
  const jugadorEnZona = (zona: Zona): string | null => {
    const pend = cambiosPendientes.find((c) => c.zona === zona);
    if (pend) return pend.jugadorEntra;
    if (posicionesPunto[zona]) return posicionesPunto[zona];
    if (posicionesFijas[zona]) return posicionesFijas[zona];
    return rotacion.posiciones[zona]?.jugador_id ?? null;
  };

  // Modal Posición: resuelve el líbero y los roles de juego.
  const jugadorParaModal = (zona: Zona): string | null => {
    const pend = cambiosPendientes.find((c) => c.zona === zona);
    if (pend) return pend.jugadorEntra;
    if (posicionesPunto[zona]) return posicionesPunto[zona];
    if (posicionesFijas[zona]) return posicionesFijas[zona];

    const numeroRot = numeroRotacionDesdePosiciones(rotacion);
    const fila = POSICIONES_JUEGO[numeroRot]?.[situacion];
    const rol = fila?.[zona];
    if (rol) {
      const jug = resolverRolAJugador(rotacionConLiberos, rol);
      if (jug) return jug;
    }
    return rotacion.posiciones[zona]?.jugador_id ?? null;
  };

  const rolEnZona = (zona: Zona): string =>
    rotacion.posiciones[zona]?.rol ?? "?";

  const tieneFijadas =
    tieneFijadasProp ??
    Object.values(posicionesFijas).some((v) => v);

  const hayCambios = cambiosPendientes.length > 0;

  const handleAplicarCambio = (jugadorNuevo: Jugador) => {
    if (modalCambio === null) return;
    const zona = modalCambio;
    const jugadorViejo = jugadorEnZona(zona) ?? "";

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

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-2 inline-block relative">
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
          className={`px-1.5 py-0.5 rounded text-[9px] font-medium border flex items-center gap-1 ${
            tieneFijadas
              ? "bg-amber-100 text-amber-800 border-amber-400 hover:bg-amber-200"
              : "bg-cyan-50 text-cyan-800 border-cyan-300 hover:bg-cyan-100"
          }`}
          title={
            tieneFijadas
              ? "Posiciones fijadas para esta rotación + situación"
              : "Ajustar posición del punto"
          }
        >
          📋 Posición
          {tieneFijadas && <span className="text-[10px]">🔒</span>}
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
          jugadorOriginalId={
            rotacion.posiciones[modalCambio]?.jugador_id ?? null
          }
          idsLiberos={idsLiberos}
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
          posicionesFijas={posicionesFijas}
          jugadorEnZona={jugadorParaModal}
          jugadoresEnCancha={jugadoresEnCancha}
          jugadoresDisponibles={jugadoresDisponibles}
          situacion={situacion}
          onSetPosicionesPunto={onSetPosicionesPunto}
          onFijarPosiciones={onFijarPosiciones}
          onLimpiarFijadas={onLimpiarFijadas}
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
// MODAL: CAMBIO EN ZONA (con reglas de líbero)
// ============================================================

function ModalCambio({
  zona,
  jugadorActualId,
  jugadorOriginalId,
  idsLiberos,
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
  jugadorOriginalId: string | null;
  idsLiberos: Set<string>;
  jugadoresEnCancha: Jugador[];
  jugadoresDisponibles: Jugador[];
  liberos: Libero[];
  onAplicar: (j: Jugador) => void;
  onCancelar: () => void;
  onQuitarCambio: () => void;
  tieneCambioPendiente: boolean;
}) {
  const todos = [...jugadoresEnCancha, ...jugadoresDisponibles].filter(
    (j, i, arr) => arr.findIndex((x) => x.id === j.id) === i
  );

  const nombreDe = (id: string | null) => {
    if (!id) return "—";
    const j = todos.find((x) => x.id === id);
    return j ? `${j.nombre}${j.numero !== null ? ` #${j.numero}` : ""}` : "?";
  };

  const esLibero = (id: string) => liberos.some((l) => l.jugador_id === id);

  const zonaActualEsLibero =
    jugadorActualId !== null && idsLiberos.has(jugadorActualId);

  // Candidatos según la regla:
  // - Zona del líbero: solo el líbero actual + el jugador original (central).
  // - Zona normal: todos los no-líberos.
  const candidatos: Jugador[] = (() => {
    if (zonaActualEsLibero) {
      const ids: string[] = [];
      if (jugadorActualId) ids.push(jugadorActualId);
      if (jugadorOriginalId && jugadorOriginalId !== jugadorActualId) {
        ids.push(jugadorOriginalId);
      }
      return todos.filter((j) => ids.includes(j.id));
    }
    return todos.filter((j) => !idsLiberos.has(j.id));
  })();

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onCancelar} />
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
          {jugadorActualId ? (
            <>
              En cancha: <strong>{nombreDe(jugadorActualId)}</strong>
              {zonaActualEsLibero && (
                <span className="ml-1 text-pink-700 font-semibold">
                  (Líbero)
                </span>
              )}
            </>
          ) : (
            <span className="text-slate-400 italic">Zona vacía</span>
          )}
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
          {zonaActualEsLibero
            ? "Solo puede entrar el jugador que reemplaza"
            : "Elegí jugador"}
        </p>

        {candidatos.length === 0 && (
          <p className="text-[10px] text-slate-400 italic">
            No hay jugadores disponibles
          </p>
        )}

        <div className="space-y-0.5">
          {candidatos.map((j) => {
            const esActual = j.id === jugadorActualId;
            return (
              <button
                key={j.id}
                onClick={() => !esActual && onAplicar(j)}
                disabled={esActual}
                className={`w-full text-left px-2 py-1 text-xs rounded flex items-center justify-between ${
                  esActual
                    ? "bg-slate-100 text-slate-400 cursor-default"
                    : "text-slate-700 hover:bg-emerald-50"
                } ${esLibero(j.id) ? "bg-pink-50" : ""}`}
              >
                <span>
                  {j.nombre}
                  {j.numero !== null ? ` #${j.numero}` : ""}
                  {esActual && (
                    <span className="ml-1 text-[9px] text-slate-400">
                      (actual)
                    </span>
                  )}
                </span>
                {esLibero(j.id) && (
                  <span className="text-[8px] text-pink-600 font-bold">L</span>
                )}
              </button>
            );
          })}
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
  posicionesFijas,
  jugadorEnZona,
  jugadoresEnCancha,
  jugadoresDisponibles,
  situacion,
  onSetPosicionesPunto,
  onFijarPosiciones,
  onLimpiarFijadas,
  onCerrar,
}: {
  posicionesPunto: Record<Zona, string>;
  posicionesFijas: Record<Zona, string>;
  jugadorEnZona: (z: Zona) => string | null;
  jugadoresEnCancha: Jugador[];
  jugadoresDisponibles: Jugador[];
  situacion: Situacion;
  onSetPosicionesPunto: (p: Record<Zona, string>) => void;
  onFijarPosiciones?: (p: Record<Zona, string>) => void;
  onLimpiarFijadas?: () => void;
  onCerrar: () => void;
}) {
  const [seleccionado, setSeleccionado] = useState<Zona | null>(null);
  const [local, setLocal] = useState<Record<Zona, string>>(() => ({
    1: jugadorEnZona(1) ?? "",
    2: jugadorEnZona(2) ?? "",
    3: jugadorEnZona(3) ?? "",
    4: jugadorEnZona(4) ?? "",
    5: jugadorEnZona(5) ?? "",
    6: jugadorEnZona(6) ?? "",
  }));

  const todosLosJugadores = [
    ...jugadoresEnCancha,
    ...jugadoresDisponibles,
  ].filter((j, i, arr) => arr.findIndex((x) => x.id === j.id) === i);

  const nombreDe = (id: string) => {
    if (!id) return "—";
    const j = todosLosJugadores.find((x) => x.id === id);
    if (!j) return "?";
    const partes = j.nombre.split(" ");
    return partes.length > 1 ? partes[0] : j.nombre.slice(0, 8);
  };

  const tieneFijadas = Object.values(posicionesFijas).some((v) => v);
  const esRecepcion = situacion === "recepcion";

  const handleClickZona = (zona: Zona) => {
    if (seleccionado === null) {
      setSeleccionado(zona);
      return;
    }
    if (seleccionado === zona) {
      setSeleccionado(null);
      return;
    }
    const copia = { ...local };
    const temp = copia[seleccionado];
    copia[seleccionado] = copia[zona];
    copia[zona] = temp;
    setLocal(copia);
    setSeleccionado(null);
  };

  const handleCambiarReceptor = (
    zona: ZonaRecepcion,
    jugadorId: string | null
  ) => {
    setLocal((prev) => ({ ...prev, [zona]: jugadorId ?? "" }));
  };

  const handleGuardar = () => {
    onSetPosicionesPunto(local);
    onCerrar();
  };

  const handleFijar = () => {
    onSetPosicionesPunto(local);
    onFijarPosiciones?.(local);
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

  const handleLimpiarFijadas = () => {
    if (
      !confirm(
        "¿Desfijar las posiciones para esta rotación + situación?\n\n" +
          "Vuelve a las posiciones de juego automáticas."
      )
    ) {
      return;
    }
    onLimpiarFijadas?.();
    onCerrar();
  };

  const zonaBtn = (zona: Zona) => {
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
      <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white border-2 border-cyan-400 rounded-lg shadow-2xl p-4 w-[360px] max-h-[90vh] overflow-y-auto">
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
          posiciones.
        </p>

        {tieneFijadas && (
          <div className="mb-3 p-2 bg-amber-50 border border-amber-300 rounded text-[10px] text-amber-800 flex items-center justify-between gap-2">
            <span>
              🔒 <strong>Posiciones fijadas</strong> para esta rotación +
              situación.
            </span>
            <button
              onClick={handleLimpiarFijadas}
              className="px-2 py-0.5 rounded border border-amber-400 hover:bg-amber-100 font-semibold whitespace-nowrap"
              title="Volver a las posiciones de juego automáticas"
            >
              Desfijar
            </button>
          </div>
        )}

        <div className="text-center text-[9px] font-bold text-slate-400 mb-0.5">
          ── RED ──
        </div>
        <div className="grid grid-cols-3 gap-1 mb-1">
          {zonaBtn(4)}
          {zonaBtn(3)}
          {zonaBtn(2)}
        </div>
        <div className="grid grid-cols-3 gap-1 mb-3">
          {zonaBtn(5)}
          {zonaBtn(6)}
          {zonaBtn(1)}
        </div>

        {esRecepcion && (
          <div className="mt-3 pt-3 border-t-2 border-cyan-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold text-cyan-800 uppercase">
                📥 Recepción
              </p>
            </div>

            <p className="text-[9px] text-slate-500 mb-2">
              Elegí quién recibe en cada zona.
            </p>

            <div className="space-y-1.5">
              {([5, 6, 1] as ZonaRecepcion[]).map((z) => (
                <div key={z} className="flex items-center gap-1">
                  <span className="w-8 text-[10px] font-bold text-cyan-700">
                    Z{z}
                  </span>
                  <select
                    value={local[z] ?? ""}
                    onChange={(e) =>
                      handleCambiarReceptor(z, e.target.value || null)
                    }
                    className="flex-1 px-2 py-1 text-xs border border-cyan-300 rounded bg-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">— sin asignar —</option>
                    {todosLosJugadores.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.nombre}
                        {j.numero !== null ? ` #${j.numero}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-slate-200 flex-wrap">
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
            {onFijarPosiciones && (
              <button
                onClick={handleFijar}
                className="px-3 py-1.5 text-xs rounded-lg bg-amber-500 text-white font-semibold hover:bg-amber-600"
                title="Mantener estas posiciones para los próximos puntos con la misma rotación + situación"
              >
                🔒 Fijar
              </button>
            )}
            <button
              onClick={handleGuardar}
              className="px-3 py-1.5 text-xs rounded-lg bg-cyan-500 text-white font-semibold hover:bg-cyan-600"
              title="Aplicar solo a este punto"
            >
              Guardar
            </button>
          </div>
        </div>
        <p className="text-[9px] text-slate-400 mt-2 text-center leading-tight">
          <strong>Guardar</strong>: solo este punto. ·{" "}
          <strong>🔒 Fijar</strong>: aplica a los próximos puntos con la misma
          rotación + situación.
        </p>
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
      liberos.map((l) => (l.jugador_id === jugador_id ? { ...l, tipo } : l))
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
          Elegí hasta 2 líberos entre todos los jugadores.
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