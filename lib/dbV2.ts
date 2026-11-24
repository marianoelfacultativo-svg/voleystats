// ============================================================
// ACCESO A DATOS V2 — puntos_v2 + acciones_v2
// ============================================================
// v50.2: AccionV2Data gana 11 campos ortogonales (desenlace,
// valoracion, puntaje, toca_bloqueo, hubo_defensa, hubo_cobertura,
// error_tipo, use_rival, acciones_en_rally, calidad_recepcion_previa,
// calidad_armado_previa) y guardarPuntoV2 los persiste.
// ============================================================

import { supabase } from "./supabase";

export type LadoV2 = "propio" | "rival";
export type SituacionV2 = "saque" | "recepcion";

export interface DesvioV2 {
  celda: string;
  mini: string | null;
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
  equipo_id?: string | null;
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
  posicion_inicial_celda?: string | null;
  posicion_inicial_mini?: string | null;
  velocidad?: number | null;
  tipo_saque?: string | null;
  variante?: string | null;
  x2?: boolean | null;
  oculta?: boolean | null;
  equipo_id?: string | null;

  // Analíticos
  es_error?: boolean | null;
  zona_origen?: number | null;
  zona_destino?: number | null;
  rotacion_numero?: number | null;
  rol_jugador?: string | null;
  zona_jugador?: number | null;
  origen_x?: number | null;
  origen_y?: number | null;
  destino_x?: number | null;
  destino_y?: number | null;
  posicion_inicial_x?: number | null;
  posicion_inicial_y?: number | null;

  // ---- v50.2: descomposición ortogonal ----
  desenlace?: "punto" | "error" | "en_juego" | null;
  valoracion?: "pos" | "neu" | "neg" | null;
  puntaje?: number | null;
  toca_bloqueo?: boolean | null;
  hubo_defensa?: boolean | null;
  hubo_cobertura?: boolean | null;
  error_tipo?: "red" | "afuera" | "gorro" | "filtrada" | null;
  use_rival?: boolean | null;
  acciones_en_rally?: number | null;
  calidad_recepcion_previa?: string | null;
  calidad_armado_previa?: number | null;
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
    return { ok: false, error: `buscando punto existente: ${errBuscar.message}` };
  }

  if (existente?.id) {
    const { error: errBorrarAcc } = await supabase
      .from("acciones_v2")
      .delete()
      .eq("punto_id", existente.id);
    if (errBorrarAcc) {
      return { ok: false, error: `borrando acciones viejas: ${errBorrarAcc.message}` };
    }
    const { error: errBorrarPunto } = await supabase
      .from("puntos_v2")
      .delete()
      .eq("id", existente.id);
    if (errBorrarPunto) {
      return { ok: false, error: `borrando punto viejo: ${errBorrarPunto.message}` };
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
    return { ok: false, error: `puntos_v2: ${errPunto?.message ?? "sin id devuelto"}` };
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
      // Analíticos
      es_error: a.es_error ?? false,
      zona_origen: a.zona_origen ?? null,
      zona_destino: a.zona_destino ?? null,
      rotacion_numero: a.rotacion_numero ?? null,
      rol_jugador: a.rol_jugador ?? null,
      zona_jugador: a.zona_jugador ?? null,
      origen_x: a.origen_x ?? null,
      origen_y: a.origen_y ?? null,
      destino_x: a.destino_x ?? null,
      destino_y: a.destino_y ?? null,
      posicion_inicial_x: a.posicion_inicial_x ?? null,
      posicion_inicial_y: a.posicion_inicial_y ?? null,
      // v50.2 flags
      desenlace: a.desenlace ?? null,
      valoracion: a.valoracion ?? null,
      puntaje: a.puntaje ?? null,
      toca_bloqueo: a.toca_bloqueo ?? null,
      hubo_defensa: a.hubo_defensa ?? null,
      hubo_cobertura: a.hubo_cobertura ?? null,
      error_tipo: a.error_tipo ?? null,
      use_rival: a.use_rival ?? null,
      acciones_en_rally: a.acciones_en_rally ?? null,
      calidad_recepcion_previa: a.calidad_recepcion_previa ?? null,
      calidad_armado_previa: a.calidad_armado_previa ?? null,
      // zona_caida: mismo valor que zona_destino (placeholder Fase 5.3)
      zona_caida: a.zona_destino ?? null,
    }));

    const { error: errAcc } = await supabase.from("acciones_v2").insert(filasAcciones);
    if (errAcc) {
      await supabase.from("puntos_v2").delete().eq("id", puntoId);
      return { ok: false, error: `acciones_v2: ${errAcc.message}` };
    }
  }

  return { ok: true, puntoId };
}

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

  if (errPuntos) return { ok: false, error: `puntos_v2: ${errPuntos.message}` };

  const { data: acciones, error: errAcciones } = await supabase
    .from("acciones_v2")
    .select("*")
    .eq("partido_id", partidoId)
    .order("orden", { ascending: true });

  if (errAcciones) return { ok: false, error: `acciones_v2: ${errAcciones.message}` };

  const accionesPorPunto = new Map<string, AccionV2Row[]>();
  for (const a of (acciones ?? []) as AccionV2Row[]) {
    const lista = accionesPorPunto.get(a.punto_id) ?? [];
    lista.push(a);
    accionesPorPunto.set(a.punto_id, lista);
  }

  const resultado: PuntoV2Completo[] = ((puntos ?? []) as PuntoV2Row[]).map((p) => ({
    ...p,
    acciones: accionesPorPunto.get(p.id) ?? [],
  }));

  return { ok: true, puntos: resultado };
}

export async function borrarPuntoV2(
  puntoId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!puntoId) return { ok: false, error: "Falta puntoId" };
  const { error: errAcc } = await supabase
    .from("acciones_v2")
    .delete()
    .eq("punto_id", puntoId);
  if (errAcc) return { ok: false, error: `acciones_v2: ${errAcc.message}` };
  const { error: errPunto } = await supabase.from("puntos_v2").delete().eq("id", puntoId);
  if (errPunto) return { ok: false, error: `puntos_v2: ${errPunto.message}` };
  return { ok: true };
}

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
  const { error: errAcc } = await supabase.from("acciones_v2").delete().in("punto_id", ids);
  if (errAcc) return { ok: false, error: errAcc.message };
  const { error: errPunto } = await supabase.from("puntos_v2").delete().in("id", ids);
  if (errPunto) return { ok: false, error: errPunto.message };
  return { ok: true };
}

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
  if (errPuntos) return { ok: false, error: `puntos_v2: ${errPuntos.message}` };
  return { ok: true };
}
