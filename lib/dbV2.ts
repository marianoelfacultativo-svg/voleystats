// ============================================================
// ACCESO A DATOS V2 — puntos_v2 + acciones_v2
// Puente entre la consola V2 y Supabase
// ============================================================

import { supabase } from "./supabase";

// ------------------------------------------------------------
// TIPOS
// ------------------------------------------------------------

export type LadoV2 = "propio" | "rival";
export type SituacionV2 = "saque" | "recepcion";

export interface DesvioV2 {
  celda: string;
  mini: string | null;
  // Jugador que hizo el desvío (bloqueador), si se conoce.
  jugador_id?: string | null;
}

export interface PuntoV2Data {
  set_numero: number;
  punto_numero: number;
  saque_equipo: LadoV2;
  situacion: SituacionV2;
  ganador: LadoV2 | null;
  rotacion: Record<string, unknown> | null;
  liberos: Record<string, unknown>[];
  cambios: Record<string, unknown>[];
  posiciones_punto: Record<string, string>;
  // Equipo dueño del punto (modo espejo). null = comportamiento clásico.
  equipo_id?: string | null;
  // Estado del equipo rival al cerrar el punto (solo modo espejo).
  // Guarda rotación, liberos, posiciones del punto y cambios pendientes.
  estado_rival?: Record<string, unknown> | null;
}

export interface AccionV2Data {
  orden: number;
  tipo: string;
  subtipo?: string | number | null;
  es_rival: boolean;
  jugador_id?: string | null;
  lado: LadoV2;
  origen_celda: string | null;
  origen_mini: string | null;
  destino_celda: string | null;
  destino_mini: string | null;
  desvios: DesvioV2[];
  zona: number | null;
  // Posición previa del jugador (estrella). null si no hubo desplazamiento.
  posicion_inicial_celda?: string | null;
  posicion_inicial_mini?: string | null;
  // Velocidad del armado (opcional). null si no se eligió.
  velocidad?: number | null;
  // Tipo de saque (potencia / flotado). Solo en saques propios.
  tipo_saque?: string | null;
  // Variante del ataque: "toque" | null (null = remate por defecto).
  variante?: string | null;
  // Defensa doble (x2): la próxima acción del mismo lado también es defensa.
  x2?: boolean | null;
  // Línea interna que rompe flujo (libre oculta). Para filtrar en analítica.
  oculta?: boolean | null;
  // Equipo dueño de la acción (modo espejo). null = comportamiento clásico.
  equipo_id?: string | null;
}

export interface PuntoV2Row extends PuntoV2Data {
  id: string;
  partido_id: string;
  created_at: string;
}

export interface AccionV2Row extends AccionV2Data {
  id: string;
  punto_id: string;
  partido_id: string;
  set_numero: number;
  punto_numero: number;
  created_at: string;
}

export interface PuntoV2Completo extends PuntoV2Row {
  acciones: AccionV2Row[];
}

// ------------------------------------------------------------
// 1. GUARDAR PUNTO + ACCIONES
// ------------------------------------------------------------

export async function guardarPuntoV2(
  partidoId: string,
  punto: PuntoV2Data,
  acciones: AccionV2Data[]
): Promise<{ ok: boolean; puntoId?: string; error?: string }> {
  if (!partidoId) return { ok: false, error: "Falta partidoId" };

  const { data: existente, error: errBuscar } = await supabase
    .from("puntos_v2")
    .select("id")
    .eq("partido_id", partidoId)
    .eq("set_numero", punto.set_numero)
    .eq("punto_numero", punto.punto_numero)
    .maybeSingle();

  if (errBuscar) {
    return {
      ok: false,
      error: `buscando punto existente: ${errBuscar.message}`,
    };
  }

  if (existente?.id) {
    const { error: errBorrarAcc } = await supabase
      .from("acciones_v2")
      .delete()
      .eq("punto_id", existente.id);
    if (errBorrarAcc) {
      return {
        ok: false,
        error: `borrando acciones viejas: ${errBorrarAcc.message}`,
      };
    }

    const { error: errBorrarPunto } = await supabase
      .from("puntos_v2")
      .delete()
      .eq("id", existente.id);
    if (errBorrarPunto) {
      return {
        ok: false,
        error: `borrando punto viejo: ${errBorrarPunto.message}`,
      };
    }
  }

  const filaPunto = {
    partido_id: partidoId,
    set_numero: punto.set_numero,
    punto_numero: punto.punto_numero,
    saque_equipo: punto.saque_equipo,
    situacion: punto.situacion,
    ganador: punto.ganador,
    rotacion: punto.rotacion,
    liberos: punto.liberos,
    cambios: punto.cambios,
    posiciones_punto: punto.posiciones_punto,
    equipo_id: punto.equipo_id ?? null,
    estado_rival: punto.estado_rival ?? null,
  };

  const { data: inserted, error: errPunto } = await supabase
    .from("puntos_v2")
    .insert([filaPunto])
    .select("id")
    .single();

  if (errPunto || !inserted) {
    return {
      ok: false,
      error: `puntos_v2: ${errPunto?.message ?? "sin id devuelto"}`,
    };
  }

  const puntoId = inserted.id as string;

  if (acciones.length > 0) {
    const filasAcciones = acciones.map((a) => ({
      punto_id: puntoId,
      partido_id: partidoId,
      set_numero: punto.set_numero,
      punto_numero: punto.punto_numero,
      orden: a.orden,
      tipo: a.tipo,
      subtipo: a.subtipo ?? null,
      es_rival: a.es_rival,
      jugador_id: a.jugador_id ?? null,
      lado: a.lado,
      origen_celda: a.origen_celda,
      origen_mini: a.origen_mini,
      destino_celda: a.destino_celda,
      destino_mini: a.destino_mini,
      desvios: a.desvios ?? [],
      zona: a.zona ?? null,
      posicion_inicial_celda: a.posicion_inicial_celda ?? null,
      posicion_inicial_mini: a.posicion_inicial_mini ?? null,
      velocidad: a.velocidad ?? null,
      tipo_saque: a.tipo_saque ?? null,
      variante: a.variante ?? null,
      x2: a.x2 ?? false,
      oculta: a.oculta ?? false,
      equipo_id: a.equipo_id ?? null,
    }));

    const { error: errAcc } = await supabase
      .from("acciones_v2")
      .insert(filasAcciones);

    if (errAcc) {
      await supabase.from("puntos_v2").delete().eq("id", puntoId);
      return { ok: false, error: `acciones_v2: ${errAcc.message}` };
    }
  }

  return { ok: true, puntoId };
}

// ------------------------------------------------------------
// 2. CARGAR TODOS LOS PUNTOS DEL PARTIDO
// ------------------------------------------------------------

export async function cargarPuntosV2(
  partidoId: string
): Promise<{ ok: boolean; puntos?: PuntoV2Completo[]; error?: string }> {
  if (!partidoId) return { ok: false, error: "Falta partidoId" };

  const { data: puntos, error: errPuntos } = await supabase
    .from("puntos_v2")
    .select("*")
    .eq("partido_id", partidoId)
    .order("set_numero", { ascending: true })
    .order("punto_numero", { ascending: true });

  if (errPuntos) {
    return { ok: false, error: `puntos_v2: ${errPuntos.message}` };
  }

  const { data: acciones, error: errAcciones } = await supabase
    .from("acciones_v2")
    .select("*")
    .eq("partido_id", partidoId)
    .order("orden", { ascending: true });

  if (errAcciones) {
    return { ok: false, error: `acciones_v2: ${errAcciones.message}` };
  }

  const accionesPorPunto = new Map<string, AccionV2Row[]>();
  for (const a of (acciones ?? []) as AccionV2Row[]) {
    const lista = accionesPorPunto.get(a.punto_id) ?? [];
    lista.push(a);
    accionesPorPunto.set(a.punto_id, lista);
  }

  const resultado: PuntoV2Completo[] = ((puntos ?? []) as PuntoV2Row[]).map(
    (p) => ({
      ...p,
      acciones: accionesPorPunto.get(p.id) ?? [],
    })
  );

  return { ok: true, puntos: resultado };
}

// ------------------------------------------------------------
// 3. BORRAR UN PUNTO POR ID
// ------------------------------------------------------------

export async function borrarPuntoV2(
  puntoId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!puntoId) return { ok: false, error: "Falta puntoId" };

  const { error: errAcc } = await supabase
    .from("acciones_v2")
    .delete()
    .eq("punto_id", puntoId);
  if (errAcc) return { ok: false, error: `acciones_v2: ${errAcc.message}` };

  const { error: errPunto } = await supabase
    .from("puntos_v2")
    .delete()
    .eq("id", puntoId);
  if (errPunto) return { ok: false, error: `puntos_v2: ${errPunto.message}` };

  return { ok: true };
}

// ------------------------------------------------------------
// 4. BORRAR UN PUNTO POR COORDENADAS
// ------------------------------------------------------------

export async function borrarPuntoV2PorCoordenadas(
  partidoId: string,
  setNumero: number,
  puntoNumero: number
): Promise<{ ok: boolean; error?: string }> {
  if (!partidoId) return { ok: false, error: "Falta partidoId" };

  const { data: existentes, error: errBuscar } = await supabase
    .from("puntos_v2")
    .select("id")
    .eq("partido_id", partidoId)
    .eq("set_numero", setNumero)
    .eq("punto_numero", puntoNumero);

  if (errBuscar) return { ok: false, error: errBuscar.message };

  const ids = (existentes ?? []).map((r: { id: string }) => r.id);
  if (ids.length === 0) return { ok: true };

  const { error: errAcc } = await supabase
    .from("acciones_v2")
    .delete()
    .in("punto_id", ids);
  if (errAcc) return { ok: false, error: errAcc.message };

  const { error: errPunto } = await supabase
    .from("puntos_v2")
    .delete()
    .in("id", ids);
  if (errPunto) return { ok: false, error: errPunto.message };

  return { ok: true };
}

// ------------------------------------------------------------
// 5. LIMPIAR TODO EL PARTIDO
// ------------------------------------------------------------

export async function borrarTodosV2(
  partidoId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!partidoId) return { ok: false, error: "Falta partidoId" };

  const { error: errAcc } = await supabase
    .from("acciones_v2")
    .delete()
    .eq("partido_id", partidoId);
  if (errAcc) return { ok: false, error: `acciones_v2: ${errAcc.message}` };

  const { error: errPuntos } = await supabase
    .from("puntos_v2")
    .delete()
    .eq("partido_id", partidoId);
  if (errPuntos) {
    return { ok: false, error: `puntos_v2: ${errPuntos.message}` };
  }

  const { error: errRot } = await supabase
    .from("rotaciones_v2")
    .delete()
    .eq("partido_id", partidoId);
  if (errRot) {
    return { ok: false, error: `rotaciones_v2: ${errRot.message}` };
  }

  return { ok: true };
}