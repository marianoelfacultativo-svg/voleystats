// ============================================================
// GUARDAR EN SUPABASE V2 — DataEntryV2
// Lógica para guardar los puntos cerrados, calcular subtipos,
// generar aces en contra (modo espejo) y limpiar V1.
// ============================================================

import {
  calcularErroresRival,
  calcularSubtiposAtaque,
  calcularSubtiposAtaqueRival,
  calcularSubtiposBloqueo,
  calcularSubtiposDefensa,
  calcularSubtiposSaque,
} from "@/lib/clasificacionV2";
import { guardarPuntoV2, type PuntoV2Data } from "@/lib/dbV2";
import { borrarPuntoV1DeTablas } from "@/lib/db";

import { lineasAAcciones } from "./helpersV2";
import { generarRecepcionesAceContra } from "./helpersEspejoV2";
import type { PuntoCerrado, PosicionesFijasMap } from "./tiposV2";

interface ParametrosGuardado {
  partidoId: string;
  setActivo: number;
  listaPuntos: PuntoCerrado[];
  equipoId: string;
  equipoRivalId: string | null;
  posicionesFijas: PosicionesFijasMap;
  posicionesFijasRival: PosicionesFijasMap;
  modoEspejo: boolean;
}

export async function guardarPuntosEnSupabase({
  partidoId,
  setActivo,
  listaPuntos,
  equipoId,
  equipoRivalId,
  posicionesFijas,
  posicionesFijasRival,
  modoEspejo,
}: ParametrosGuardado): Promise<{
  ok: boolean;
  errores: number;
  primerError: string;
}> {
  let errores = 0;
  let primerError = "";

  for (const pc of listaPuntos) {
    const puntoData: PuntoV2Data = {
      set_numero: setActivo,
      punto_numero: pc.numero,
      saque_equipo: pc.saqueInicial,
      situacion: pc.situacion,
      ganador: pc.ganador,
      rotacion: pc.rotacion as unknown as Record<string, unknown>,
      liberos: pc.liberos as unknown as Record<string, unknown>[],
      cambios: pc.cambios as unknown as Record<string, unknown>[],
      posiciones_punto: pc.posicionesPunto,
      equipo_id:
        pc.equipoId ??
        (pc.saqueInicial === "propio" ? equipoId : equipoRivalId),
    };

    const lineasConSaque = calcularSubtiposSaque(pc.lineas);
    const lineasConAtaqueRival = calcularSubtiposAtaqueRival(lineasConSaque);
    const lineasConBloqueo = calcularSubtiposBloqueo(lineasConAtaqueRival);
    const lineasConDefensa = calcularSubtiposDefensa(lineasConBloqueo);
    const lineasConAtaque = calcularSubtiposAtaque(
      lineasConDefensa,
      pc.ganador
    );
    const lineasConErroresRival = calcularErroresRival(lineasConAtaque);
    const acciones = lineasAAcciones(lineasConErroresRival);

    // ---------- MODO ESPEJO: recepciones sintéticas de ace_contra ----------
    generarRecepcionesAceContra({
      pc,
      lineas: lineasConErroresRival,
      acciones,
      equipoId,
      equipoRivalId,
      posicionesFijas,
      posicionesFijasRival,
      modoEspejo,
    });

    const res = await guardarPuntoV2(partidoId, puntoData, acciones);
    if (!res.ok) {
      errores++;
      if (!primerError) primerError = res.error ?? "desconocido";
      continue;
    }

    const resV1 = await borrarPuntoV1DeTablas(partidoId, setActivo, pc.numero);
    if (!resV1.ok) {
      errores++;
      if (!primerError)
        primerError = `borrando V1: ${resV1.error ?? "desconocido"}`;
    }
  }

  return {
    ok: errores === 0,
    errores,
    primerError,
  };
}