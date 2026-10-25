// ============================================================
// EXPORT / IMPORT — Backup JSON
// ============================================================
//
// Formatos:
//   - BackupEquipo:  equipo + jugadores + asignaciones + todos
//                    sus partidos + puntos V2 + acciones V2 + V1 legacy.
//   - BackupPartido: 1 partido + puntos V2 + acciones V2 + V1 legacy.
//
// Cada backup incluye "version" para poder migrar en el futuro.
//
// Modos de import:
//   - "nuevo"      → genera IDs nuevos para todo. Nunca pisa nada.
//   - "reemplazar" → borra lo existente con ese ID y reinserta con
//                    los MISMOS IDs del JSON. Solo si el ID existe.
//
// V1 legacy: se guarda en las tablas rotaciones, ataques_detalle,
// defensa_detalle, bloqueo_detalle, saque_detalle, recepcion_detalle,
// cambios_jugador, armados_detalle. Es opcional, sirve para no perder
// compatibilidad con la consola vieja.
// ============================================================

import { supabase } from "./supabase";

// ------------------------------------------------------------
// TIPOS
// ------------------------------------------------------------

export const VERSION_BACKUP = 1;

export interface BackupEquipo {
  version: number;
  tipo: "equipo";
  exportadoEl: string;
  equipo: Record<string, any>;
  jugadores: Record<string, any>[];
  asignaciones: Record<string, any>[];
  partidos: Record<string, any>[];
  puntosV2: Record<string, any>[];
  accionesV2: Record<string, any>[];
  v1: {
    rotaciones: Record<string, any>[];
    ataques_detalle: Record<string, any>[];
    defensa_detalle: Record<string, any>[];
    bloqueo_detalle: Record<string, any>[];
    saque_detalle: Record<string, any>[];
    recepcion_detalle: Record<string, any>[];
    cambios_jugador: Record<string, any>[];
    armados_detalle: Record<string, any>[];
  };
}

export interface BackupPartido {
  version: number;
  tipo: "partido";
  exportadoEl: string;
  partido: Record<string, any>;
  puntosV2: Record<string, any>[];
  accionesV2: Record<string, any>[];
  v1: {
    rotaciones: Record<string, any>[];
    ataques_detalle: Record<string, any>[];
    defensa_detalle: Record<string, any>[];
    bloqueo_detalle: Record<string, any>[];
    saque_detalle: Record<string, any>[];
    recepcion_detalle: Record<string, any>[];
    cambios_jugador: Record<string, any>[];
    armados_detalle: Record<string, any>[];
  };
}

export type Backup = BackupEquipo | BackupPartido;

const TABLAS_V1 = [
  "rotaciones",
  "ataques_detalle",
  "defensa_detalle",
  "bloqueo_detalle",
  "saque_detalle",
  "recepcion_detalle",
  "cambios_jugador",
  "armados_detalle",
] as const;

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function stripTimestamps<T extends Record<string, any>>(row: T): T {
  const { created_at, updated_at, ...rest } = row;
  void created_at;
  void updated_at;
  return rest as T;
}

function bajarV1Vacio() {
  return {
    rotaciones: [],
    ataques_detalle: [],
    defensa_detalle: [],
    bloqueo_detalle: [],
    saque_detalle: [],
    recepcion_detalle: [],
    cambios_jugador: [],
    armados_detalle: [],
  };
}

// ------------------------------------------------------------
// EXPORTAR
// ------------------------------------------------------------

export async function exportarEquipo(
  equipoId: string
): Promise<{ ok: boolean; data?: BackupEquipo; error?: string }> {
  // 1. Equipo
  const { data: equipo, error: errEq } = await supabase
    .from("equipos")
    .select("*")
    .eq("id", equipoId)
    .maybeSingle();
  if (errEq || !equipo) {
    return { ok: false, error: errEq?.message ?? "Equipo no encontrado" };
  }

  // 2. Asignaciones activas del equipo
  const { data: asignaciones } = await supabase
    .from("jugador_equipo")
    .select("*")
    .eq("equipo_id", equipoId);
  const asigs = asignaciones ?? [];

  // 3. Jugadores de esas asignaciones
  const idsJugadores = Array.from(
    new Set(asigs.map((a: any) => a.jugador_id))
  );
  let jugadores: Record<string, any>[] = [];
  if (idsJugadores.length > 0) {
    const { data: jugs } = await supabase
      .from("jugadores")
      .select("*")
      .in("id", idsJugadores);
    jugadores = jugs ?? [];
  }

  // 4. Partidos donde ESTE equipo cargó los datos (equipo_id = equipoId)
  const { data: partidos } = await supabase
    .from("partidos")
    .select("*")
    .eq("equipo_id", equipoId)
    .order("fecha", { ascending: false });
  const parts = partidos ?? [];
  const idsPartidos = parts.map((p: any) => p.id);

  // 5. Puntos V2 + acciones V2 de esos partidos
  let puntosV2: Record<string, any>[] = [];
  let accionesV2: Record<string, any>[] = [];
  if (idsPartidos.length > 0) {
    const { data: pv2 } = await supabase
      .from("puntos_v2")
      .select("*")
      .in("partido_id", idsPartidos);
    puntosV2 = pv2 ?? [];
    const { data: av2 } = await supabase
      .from("acciones_v2")
      .select("*")
      .in("partido_id", idsPartidos);
    accionesV2 = av2 ?? [];
  }

  // 6. V1 legacy
  const v1 = bajarV1Vacio();
  if (idsPartidos.length > 0) {
    for (const tabla of TABLAS_V1) {
      const { data } = await supabase
        .from(tabla)
        .select("*")
        .in("partido_id", idsPartidos);
      (v1 as any)[tabla] = data ?? [];
    }
  }

  return {
    ok: true,
    data: {
      version: VERSION_BACKUP,
      tipo: "equipo",
      exportadoEl: new Date().toISOString(),
      equipo: stripTimestamps(equipo),
      jugadores: jugadores.map(stripTimestamps),
      asignaciones: asigs.map(stripTimestamps),
      partidos: parts.map(stripTimestamps),
      puntosV2: puntosV2.map(stripTimestamps),
      accionesV2: accionesV2.map(stripTimestamps),
      v1: {
        rotaciones: v1.rotaciones.map(stripTimestamps),
        ataques_detalle: v1.ataques_detalle.map(stripTimestamps),
        defensa_detalle: v1.defensa_detalle.map(stripTimestamps),
        bloqueo_detalle: v1.bloqueo_detalle.map(stripTimestamps),
        saque_detalle: v1.saque_detalle.map(stripTimestamps),
        recepcion_detalle: v1.recepcion_detalle.map(stripTimestamps),
        cambios_jugador: v1.cambios_jugador.map(stripTimestamps),
        armados_detalle: v1.armados_detalle.map(stripTimestamps),
      },
    },
  };
}

export async function exportarPartido(
  partidoId: string
): Promise<{ ok: boolean; data?: BackupPartido; error?: string }> {
  const { data: partido, error: errP } = await supabase
    .from("partidos")
    .select("*")
    .eq("id", partidoId)
    .maybeSingle();
  if (errP || !partido) {
    return { ok: false, error: errP?.message ?? "Partido no encontrado" };
  }

  const { data: puntosV2 } = await supabase
    .from("puntos_v2")
    .select("*")
    .eq("partido_id", partidoId);
  const { data: accionesV2 } = await supabase
    .from("acciones_v2")
    .select("*")
    .eq("partido_id", partidoId);

  const v1 = bajarV1Vacio();
  for (const tabla of TABLAS_V1) {
    const { data } = await supabase
      .from(tabla)
      .select("*")
      .eq("partido_id", partidoId);
    (v1 as any)[tabla] = data ?? [];
  }

  return {
    ok: true,
    data: {
      version: VERSION_BACKUP,
      tipo: "partido",
      exportadoEl: new Date().toISOString(),
      partido: stripTimestamps(partido),
      puntosV2: (puntosV2 ?? []).map(stripTimestamps),
      accionesV2: (accionesV2 ?? []).map(stripTimestamps),
      v1: {
        rotaciones: v1.rotaciones.map(stripTimestamps),
        ataques_detalle: v1.ataques_detalle.map(stripTimestamps),
        defensa_detalle: v1.defensa_detalle.map(stripTimestamps),
        bloqueo_detalle: v1.bloqueo_detalle.map(stripTimestamps),
        saque_detalle: v1.saque_detalle.map(stripTimestamps),
        recepcion_detalle: v1.recepcion_detalle.map(stripTimestamps),
        cambios_jugador: v1.cambios_jugador.map(stripTimestamps),
        armados_detalle: v1.armados_detalle.map(stripTimestamps),
      },
    },
  };
}

// ------------------------------------------------------------
// DESCARGA
// ------------------------------------------------------------

export function descargarJSON(data: unknown, nombreBase: string): void {
  const limpio = nombreBase
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
  const fecha = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const sello = `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(
    fecha.getDate()
  )}_${pad(fecha.getHours())}${pad(fecha.getMinutes())}`;

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${limpio}-${sello}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ------------------------------------------------------------
// LEER ARCHIVO
// ------------------------------------------------------------

export async function leerArchivoJSON(
  file: File
): Promise<{ ok: boolean; data?: Backup; error?: string }> {
  try {
    const texto = await file.text();
    const json = JSON.parse(texto);

    if (!json || typeof json !== "object") {
      return { ok: false, error: "El archivo no es un JSON válido." };
    }
    if (json.tipo !== "equipo" && json.tipo !== "partido") {
      return {
        ok: false,
        error: "El archivo no es un backup de VoleyStats (falta 'tipo').",
      };
    }
    if (typeof json.version !== "number") {
      return {
        ok: false,
        error: "El archivo no tiene número de versión. Puede ser viejo.",
      };
    }
    return { ok: true, data: json as Backup };
  } catch (e: any) {
    return {
      ok: false,
      error: `No se pudo leer el archivo: ${e?.message ?? "desconocido"}`,
    };
  }
}

// ------------------------------------------------------------
// ANALIZAR (para la preview)
// ------------------------------------------------------------

export interface AnalisisBackup {
  tipo: "equipo" | "partido";
  exportadoEl: string;
  resumen: {
    equipo?: string;
    rival?: string;
    fecha?: string;
    jugadores?: number;
    partidos?: number;
    puntos?: number;
    acciones?: number;
    accionesV1?: number;
  };
  idsEnConflicto: {
    equipoId?: string;
    partidoId?: string;
    existeEquipo?: boolean;
    existePartido?: boolean;
  };
}

export async function analizarBackup(
  data: Backup
): Promise<AnalisisBackup> {
  const accionesV1 = TABLAS_V1.reduce(
    (sum, t) => sum + ((data.v1 as any)?.[t]?.length ?? 0),
    0
  );

  if (data.tipo === "equipo") {
    const existe = await supabase
      .from("equipos")
      .select("id")
      .eq("id", data.equipo.id)
      .maybeSingle();
    return {
      tipo: "equipo",
      exportadoEl: data.exportadoEl,
      resumen: {
        equipo: data.equipo?.nombre,
        jugadores: data.jugadores?.length ?? 0,
        partidos: data.partidos?.length ?? 0,
        puntos: data.puntosV2?.length ?? 0,
        acciones: data.accionesV2?.length ?? 0,
        accionesV1,
      },
      idsEnConflicto: {
        equipoId: data.equipo.id,
        existeEquipo: !!existe.data,
      },
    };
  }

  const existe = await supabase
    .from("partidos")
    .select("id")
    .eq("id", data.partido.id)
    .maybeSingle();
  return {
    tipo: "partido",
    exportadoEl: data.exportadoEl,
    resumen: {
      rival: data.partido?.rival,
      fecha: data.partido?.fecha,
      puntos: data.puntosV2?.length ?? 0,
      acciones: data.accionesV2?.length ?? 0,
      accionesV1,
    },
    idsEnConflicto: {
      partidoId: data.partido.id,
      existePartido: !!existe.data,
    },
  };
}

// ------------------------------------------------------------
// BORRAR (para modo "reemplazar")
// ------------------------------------------------------------

async function borrarEquipoCompleto(
  equipoId: string
): Promise<{ ok: boolean; error?: string }> {
  const { data: partidos } = await supabase
    .from("partidos")
    .select("id")
    .eq("equipo_id", equipoId);
  const idsPartidos = (partidos ?? []).map((p: any) => p.id);

  if (idsPartidos.length > 0) {
    await supabase.from("acciones_v2").delete().in("partido_id", idsPartidos);
    await supabase.from("puntos_v2").delete().in("partido_id", idsPartidos);
    for (const tabla of TABLAS_V1) {
      await supabase.from(tabla).delete().in("partido_id", idsPartidos);
    }
    const { error: errP } = await supabase
      .from("partidos")
      .delete()
      .in("id", idsPartidos);
    if (errP) return { ok: false, error: errP.message };
  }

  await supabase.from("jugador_equipo").delete().eq("equipo_id", equipoId);

  const { error: errEq } = await supabase
    .from("equipos")
    .delete()
    .eq("id", equipoId);
  if (errEq) return { ok: false, error: errEq.message };

  return { ok: true };
}

async function borrarPartidoCompleto(
  partidoId: string
): Promise<{ ok: boolean; error?: string }> {
  await supabase.from("acciones_v2").delete().eq("partido_id", partidoId);
  await supabase.from("puntos_v2").delete().eq("partido_id", partidoId);
  for (const tabla of TABLAS_V1) {
    await supabase.from(tabla).delete().eq("partido_id", partidoId);
  }
  const { error } = await supabase
    .from("partidos")
    .delete()
    .eq("id", partidoId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ------------------------------------------------------------
// INSERTAR V1
// ------------------------------------------------------------

async function insertarV1(
  v1: Backup["v1"],
  mapaPartidos: Record<string, string>
): Promise<{ ok: boolean; error?: string }> {
  for (const tabla of TABLAS_V1) {
    const filas = (v1 as any)?.[tabla] ?? [];
    if (filas.length === 0) continue;

    const filasNuevas = filas
      .map((f: any) => {
        const partidoNuevo = mapaPartidos[f.partido_id];
        if (!partidoNuevo) return null;
        return {
          ...stripTimestamps(f),
          partido_id: partidoNuevo,
        };
      })
      .filter(Boolean);

    if (filasNuevas.length === 0) continue;

    const { error } = await supabase.from(tabla).insert(filasNuevas);
    if (error) {
      return { ok: false, error: `${tabla}: ${error.message}` };
    }
  }
  return { ok: true };
}

// ------------------------------------------------------------
// IMPORTAR — PARTIDO
// ------------------------------------------------------------

async function importarPartido(
  data: BackupPartido,
  modo: "nuevo" | "reemplazar"
): Promise<{ ok: boolean; error?: string }> {
  const partidoViejo = data.partido;

  if (modo === "reemplazar") {
    const { ok, error } = await borrarPartidoCompleto(partidoViejo.id);
    if (!ok) return { ok: false, error };
  }

  const partidoNuevoId = modo === "nuevo" ? uuid() : partidoViejo.id;

  const { error: errP } = await supabase.from("partidos").insert({
    ...stripTimestamps(partidoViejo),
    id: partidoNuevoId,
  });
  if (errP) return { ok: false, error: `partidos: ${errP.message}` };

  const mapaPartidos: Record<string, string> = {
    [partidoViejo.id]: partidoNuevoId,
  };

  const mapaPuntos: Record<string, string> = {};
  if (data.puntosV2.length > 0) {
    const filas = data.puntosV2.map((p) => {
      const nuevoId = uuid();
      mapaPuntos[p.id] = nuevoId;
      return {
        ...stripTimestamps(p),
        id: nuevoId,
        partido_id: partidoNuevoId,
      };
    });
    const { error } = await supabase.from("puntos_v2").insert(filas);
    if (error) return { ok: false, error: `puntos_v2: ${error.message}` };
  }

  if (data.accionesV2.length > 0) {
    const filas = data.accionesV2
      .map((a) => {
        const puntoNuevo = mapaPuntos[a.punto_id];
        if (!puntoNuevo) return null;
        return {
          ...stripTimestamps(a),
          id: uuid(),
          punto_id: puntoNuevo,
          partido_id: partidoNuevoId,
        };
      })
      .filter(Boolean);

    if (filas.length > 0) {
      const { error } = await supabase.from("acciones_v2").insert(filas);
      if (error) return { ok: false, error: `acciones_v2: ${error.message}` };
    }
  }

  const v1Res = await insertarV1(data.v1, mapaPartidos);
  if (!v1Res.ok) return v1Res;

  return { ok: true };
}

// ------------------------------------------------------------
// IMPORTAR — EQUIPO
// ------------------------------------------------------------

async function importarEquipo(
  data: BackupEquipo,
  modo: "nuevo" | "reemplazar"
): Promise<{ ok: boolean; error?: string }> {
  const equipoViejo = data.equipo;

  if (modo === "reemplazar") {
    const { ok, error } = await borrarEquipoCompleto(equipoViejo.id);
    if (!ok) return { ok: false, error };
  }

  const equipoNuevoId = modo === "nuevo" ? uuid() : equipoViejo.id;

  const { error: errEq } = await supabase.from("equipos").insert({
    ...stripTimestamps(equipoViejo),
    id: equipoNuevoId,
  });
  if (errEq) return { ok: false, error: `equipos: ${errEq.message}` };

  const mapaJugadores: Record<string, string> = {};

  if (modo === "nuevo") {
    if (data.jugadores.length > 0) {
      const filas = data.jugadores.map((j) => {
        const nuevoId = uuid();
        mapaJugadores[j.id] = nuevoId;
        return { ...stripTimestamps(j), id: nuevoId };
      });
      const { error } = await supabase.from("jugadores").insert(filas);
      if (error) return { ok: false, error: `jugadores: ${error.message}` };
    }
  } else {
    const idsViejos = data.jugadores.map((j) => j.id);
    const { data: existentes } = await supabase
      .from("jugadores")
      .select("id")
      .in("id", idsViejos);
    const existentesSet = new Set(
      (existentes ?? []).map((j: any) => j.id)
    );

    for (const j of data.jugadores) {
      if (existentesSet.has(j.id)) {
        mapaJugadores[j.id] = j.id;
      } else {
        mapaJugadores[j.id] = j.id;
        const { error } = await supabase
          .from("jugadores")
          .insert({ ...stripTimestamps(j), id: j.id });
        if (error)
          return { ok: false, error: `jugadores: ${error.message}` };
      }
    }
  }

  if (data.asignaciones.length > 0) {
    const filas = data.asignaciones
      .map((a) => {
        const jugNuevo = mapaJugadores[a.jugador_id];
        if (!jugNuevo) return null;
        return {
          ...stripTimestamps(a),
          id: uuid(),
          jugador_id: jugNuevo,
          equipo_id: equipoNuevoId,
        };
      })
      .filter(Boolean);
    if (filas.length > 0) {
      const { error } = await supabase
        .from("jugador_equipo")
        .insert(filas);
      if (error)
        return { ok: false, error: `jugador_equipo: ${error.message}` };
    }
  }

  const mapaPartidos: Record<string, string> = {};
  if (data.partidos.length > 0) {
    const filas = data.partidos.map((p) => {
      const nuevoId = uuid();
      mapaPartidos[p.id] = nuevoId;
      return {
        ...stripTimestamps(p),
        id: nuevoId,
        equipo_id: equipoNuevoId,
      };
    });
    const { error } = await supabase.from("partidos").insert(filas);
    if (error) return { ok: false, error: `partidos: ${error.message}` };
  }

  const mapaPuntos: Record<string, string> = {};
  const puntosFiltrados = data.puntosV2.filter((p) => mapaPartidos[p.partido_id]);
  if (puntosFiltrados.length > 0) {
    const filas = puntosFiltrados.map((p) => {
      const nuevoId = uuid();
      mapaPuntos[p.id] = nuevoId;
      return {
        ...stripTimestamps(p),
        id: nuevoId,
        partido_id: mapaPartidos[p.partido_id],
      };
    });
    const { error } = await supabase.from("puntos_v2").insert(filas);
    if (error) return { ok: false, error: `puntos_v2: ${error.message}` };
  }

  const accionesFiltradas = data.accionesV2.filter(
    (a) => mapaPuntos[a.punto_id] && mapaPartidos[a.partido_id]
  );
  if (accionesFiltradas.length > 0) {
    const filas = accionesFiltradas.map((a) => ({
      ...stripTimestamps(a),
      id: uuid(),
      punto_id: mapaPuntos[a.punto_id],
      partido_id: mapaPartidos[a.partido_id],
    }));
    const { error } = await supabase.from("acciones_v2").insert(filas);
    if (error) return { ok: false, error: `acciones_v2: ${error.message}` };
  }

  const v1Res = await insertarV1(data.v1, mapaPartidos);
  if (!v1Res.ok) return v1Res;

  return { ok: true };
}

// ------------------------------------------------------------
// IMPORTAR — PUNTO DE ENTRADA
// ------------------------------------------------------------

export async function importarBackup(
  data: Backup,
  modo: "nuevo" | "reemplazar"
): Promise<{ ok: boolean; error?: string }> {
  if (data.tipo === "partido") return importarPartido(data, modo);
  return importarEquipo(data, modo);
}