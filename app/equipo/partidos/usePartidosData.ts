"use client";

// ============================================================
// HOOK: carga de datos para Partidos
// ============================================================
// Un solo useEffect que carga en paralelo:
//   - partidos (donde el equipo es local o rival)
//   - jugadores
//   - equipos
//   - acciones de cada partido (vía cargarAccionesCompatibles)
//   - datos de rival (errores / buenas) por partido
//
// Devuelve todo tipado + helpers de nombres (memoizados).
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  cargarAccionesCompatibles,
  contarPuntosRival,
  type AccionDB,
} from "@/lib/db";
import type { DatosRival, Equipo, Jugador, Partido } from "./types";

// ------------------------------------------------------------
// TIPOS DEL HOOK
// ------------------------------------------------------------

export interface UsePartidosDataResult {
  partidos: Partido[];
  jugadores: Jugador[];
  equipos: Equipo[];
  acciones: AccionDB[];
  datosRival: Record<string, DatosRival>;
  cargando: boolean;
  /** Nombre + #número del jugador (o "?" si no lo encuentra). */
  nombreDe: (id: string) => string;
  /** Nombre del rival visible desde la perspectiva del equipo actual. */
  nombreRivalDe: (p: Partido) => string;
}

// ------------------------------------------------------------
// HOOK
// ------------------------------------------------------------

export function usePartidosData(equipoId: string): UsePartidosDataResult {
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [acciones, setAcciones] = useState<AccionDB[]>([]);
  const [datosRival, setDatosRival] = useState<Record<string, DatosRival>>({});
  const [cargando, setCargando] = useState(true);

  // -------- Carga inicial --------
  useEffect(() => {
    if (!equipoId) return;
    setCargando(true);

    Promise.all([
      supabase
        .from("partidos")
        .select("*")
        .or(`equipo_id.eq.${equipoId},equipo_rival_id.eq.${equipoId}`)
        .order("fecha", { ascending: false }),
      supabase
        .from("jugadores")
        .select("id, nombre, numero, rol")
        .order("nombre"),
      supabase.from("equipos").select("id, nombre"),
    ]).then(async ([partRes, jugRes, eqRes]) => {
      if (!partRes.data || !jugRes.data) {
        setCargando(false);
        return;
      }

      const partidosData = partRes.data as Partido[];
      setPartidos(partidosData);
      setJugadores(jugRes.data as Jugador[]);
      if (eqRes.data) setEquipos(eqRes.data as Equipo[]);

      const ids = partidosData.map((p) => p.id);
      if (ids.length === 0) {
        setAcciones([]);
        setDatosRival({});
        setCargando(false);
        return;
      }

      const [resultadosAcciones, resultadosRival] = await Promise.all([
        Promise.all(
          ids.map((pid) => cargarAccionesCompatibles(pid, equipoId))
        ),
        Promise.all(ids.map((pid) => contarPuntosRival(pid, equipoId))),
      ]);

      const mapaRival: Record<string, DatosRival> = {};
      ids.forEach((pid, idx) => {
        mapaRival[pid] = resultadosRival[idx];
      });

      setAcciones(resultadosAcciones.flat());
      setDatosRival(mapaRival);
      setCargando(false);
    });
  }, [equipoId]);

  // -------- Helpers memoizados --------
  const nombreDe = useCallback(
    (id: string) => {
      const j = jugadores.find((x) => x.id === id);
      return j ? j.nombre + (j.numero !== null ? ` #${j.numero}` : "") : "?";
    },
    [jugadores]
  );

  const nombreRivalDe = useCallback(
    (p: Partido) => {
      // Si el equipo actual es el "rival" del partido, el nombre visible
      // del rival es el del equipo local (equipo_id), no el texto guardado.
      if (p.equipo_rival_id === equipoId) {
        const local = equipos.find((e) => e.id === p.equipo_id);
        if (local) return local.nombre;
      }
      return p.rival;
    },
    [equipoId, equipos]
  );

  return {
    partidos,
    jugadores,
    equipos,
    acciones,
    datosRival,
    cargando,
    nombreDe,
    nombreRivalDe,
  };
}