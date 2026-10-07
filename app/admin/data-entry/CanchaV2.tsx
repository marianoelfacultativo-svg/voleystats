"use client";

import { useState } from "react";
import CanchaV2, { type CoordsV2, type LineaV2 } from "./CanchaV2";

interface Props {
  partidoId: string;
  setActivo: number;
  puntoActual: number;
  marcadorPropio: number;
  marcadorRival: number;
  nombreMiEquipo?: string;
  nombreRival?: string;
  onPuntoCerrado?: (payload: {
    lineas: LineaV2[];
    ganador: "propio" | "rival";
  }) => void;
  onEstadoCambia?: (lineas: LineaV2[]) => void;
}

export default function DataEntryV2({
  setActivo,
  puntoActual,
  marcadorPropio,
  marcadorRival,
  nombreMiEquipo = "Mi equipo",
  nombreRival = "Rival",
  onPuntoCerrado,
  onEstadoCambia,
}: Props) {
  const [lineas, setLineas] = useState<LineaV2[]>([]);
  const [origenActivo, setOrigenActivo] = useState<{
    celda: string;
    mini: string;
  } | null>(null);
  const [contadorId, setContadorId] = useState(1);

  const handleClickMini = (coords: CoordsV2) => {
    const punto = { celda: coords.celda, mini: coords.mini };

    // Sin círculo abierto → abrir círculo acá
    if (!origenActivo) {
      setOrigenActivo(punto);
      return;
    }

    // Click en el mismo lugar → no hace nada
    if (
      origenActivo.celda === punto.celda &&
      origenActivo.mini === punto.mini
    ) {
      return;
    }

    // Crear línea desde el círculo abierto al nuevo punto
    const nueva: LineaV2 = {
      id: `linea-${contadorId}`,
      origen: origenActivo,
      destino: punto,
      color: "#475569",
      pendiente: true,
      esRival: false,
    };
    const nuevas = [...lineas, nueva];
    setLineas(nuevas);
    setOrigenActivo(punto);
    setContadorId((c) => c + 1);
    if (onEstadoCambia) onEstadoCambia(nuevas);
  };

  const borrarUltimaLinea = () => {
    if (lineas.length === 0) {
      // No hay líneas: cerramos el círculo abierto
      if (origenActivo) setOrigenActivo(null);
      return;
    }
    const nuevas = lineas.slice(0, -1);
    const ultima = lineas[lineas.length - 1];
    setLineas(nuevas);
    // El origen activo vuelve al destino de la última línea borrada
    setOrigenActivo(ultima.destino);
    if (onEstadoCambia) onEstadoCambia(nuevas);
  };

  const borrarPunto = () => {
    if (
      lineas.length > 0 &&
      !confirm("¿Borrar todas las líneas de este punto?")
    )
      return;
    setLineas([]);
    setOrigenActivo(null);
    if (onEstadoCambia) onEstadoCambia([]);
  };

  const calcularPunto = () => {
    // Placeholder: en la próxima iteración clasificamos las acciones y
    // decidimos quién ganó el punto automáticamente.
    const confirmar = confirm(
      "¿Cerrar el punto?\n\nEsto va a guardar las líneas y calcular el ganador (próximamente)."
    );
    if (!confirmar) return;
    if (onPuntoCerrado) {
      onPuntoCerrado({
        lineas,
        ganador: "propio", // provisional
      });
    }
  };

  return (
    <div className="space-y-3">
      {/* Marcador */}
      <div className="flex items-center justify-center gap-6 bg-slate-900 text-white rounded-2xl px-6 py-3">
        <div className="text-center">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
            {nombreMiEquipo}
          </p>
          <p className="text-3xl font-bold tabular-nums">
            {marcadorPropio}
          </p>
        </div>
        <div className="text-slate-500 text-2xl font-bold">—</div>
        <div className="text-center">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
            {nombreRival}
          </p>
          <p className="text-3xl font-bold tabular-nums">
            {marcadorRival}
          </p>
        </div>
      </div>

      {/* Info del punto */}
      <div className="flex items-center justify-between text-sm text-slate-600 bg-white border border-slate-200 rounded-xl px-4 py-2">
        <span>
          <strong>Set {setActivo}</strong> · Punto{" "}
          <strong>{puntoActual}</strong>
        </span>
        <span className="text-xs text-slate-400">
          {lineas.length} línea{lineas.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Cancha */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-3">
        <CanchaV2
          orientacion="vertical"
          lineas={lineas}
          origenActivo={origenActivo}
          onClickMini={handleClickMini}
        />
      </div>

      {/* Botones */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            onClick={borrarUltimaLinea}
            disabled={lineas.length === 0 && !origenActivo}
            className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-sm font-medium disabled:opacity-40"
          >
            ↩ Borrar última
          </button>
          <button
            onClick={borrarPunto}
            disabled={lineas.length === 0 && !origenActivo}
            className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 border border-red-300 rounded-lg text-sm font-medium disabled:opacity-40"
          >
            ✕ Borrar punto
          </button>
        </div>
        <button
          onClick={calcularPunto}
          disabled={lineas.length === 0}
          className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg disabled:opacity-40"
        >
          ✓ Calcular punto
        </button>
      </div>

      <p className="text-xs text-slate-400 text-center">
        Click en una mini → abre círculo. Click en otra mini → traza línea.
        Repetí para seguir el punto. Todavía sin clasificación automática.
      </p>
    </div>
  );
}