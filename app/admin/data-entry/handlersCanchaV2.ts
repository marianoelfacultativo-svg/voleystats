// ============================================================
// HANDLERS CANCHA V2 — DataEntryV2
// Factory que devuelve los callbacks de la cancha y crearLinea.
// ============================================================

import type { Dispatch, SetStateAction } from "react";
import type { CoordsV2 } from "./CanchaV2";
import type { PuntoV2 } from "./LineasV2";
import type { PopupEnCola } from "./tiposV2";

import {
  esCeldaBloqueoPropioConPopup,
  esCanchaPropia,
  esCanchaRival,
  clasificarLinea,
  resolverJugadorDefensa,
  ladoDeCelda,
  type LineaClasificada,
  type EstadoClasificacion,
  type PopupRequerido,
  type Situacion,
} from "@/lib/clasificacionV2";
import { jugadorQueAtacaDesdeCelda } from "@/lib/mapeoV2";
import type { RotacionPunto, Zona } from "@/lib/rotaciones";
import {
  esCeldaBloqueo,
  mismaMini,
  posicionPopup,
} from "./helpersV2";
import {
  invertirCelda,
  jugadorQueSacaDeRot,
  jugadorQueArmaDeRot,
  jugadorQueRecibeDeRot,
} from "./helpersEspejoV2";

interface Params {
  setupCompleto: boolean;
  /** Si true, los círculos nuevos nacen armados (naranja ✓). */
  armadoAutomatico: boolean;
  colaPopups: PopupEnCola[];
  circuloSinArmar: PuntoV2 | null;
  circuloArmado: PuntoV2 | null;
  desviosPendientes: PuntoV2[];
  estrella: PuntoV2 | null;
  contadorId: number;
  lineas: LineaClasificada[];
  equipoId: string;
  equipoRivalId: string | null;
  modoEspejo: boolean;
  saqueInicial: "propio" | "rival";
  situacion: Situacion;
  situacionRival: Situacion;
  rotacionEfectiva: RotacionPunto | null;
  rotacionRivalEfectiva: RotacionPunto | null;
  recepcionOverridesEfectivos: Partial<Record<Zona, string | null>>;
  recepcionOverridesRival: Partial<Record<Zona, string | null>>;

  setColaPopups: Dispatch<SetStateAction<PopupEnCola[]>>;
  setCirculoSinArmar: Dispatch<SetStateAction<PuntoV2 | null>>;
  setCirculoArmado: Dispatch<SetStateAction<PuntoV2 | null>>;
  setDesviosPendientes: Dispatch<SetStateAction<PuntoV2[]>>;
  setEstrella: Dispatch<SetStateAction<PuntoV2 | null>>;
  setLineas: Dispatch<SetStateAction<LineaClasificada[]>>;
  setContadorId: Dispatch<SetStateAction<number>>;
}

export function crearHandlersCancha(params: Params) {
  const {
    setupCompleto,
    armadoAutomatico,
    colaPopups,
    circuloSinArmar,
    circuloArmado,
    desviosPendientes,
    estrella,
    contadorId,
    lineas,
    equipoId,
    equipoRivalId,
    modoEspejo,
    saqueInicial,
    situacion,
    situacionRival,
    rotacionEfectiva,
    rotacionRivalEfectiva,
    recepcionOverridesEfectivos,
    recepcionOverridesRival,
    setColaPopups,
    setCirculoSinArmar,
    setCirculoArmado,
    setDesviosPendientes,
    setEstrella,
    setLineas,
    setContadorId,
  } = params;

  // Crea el próximo círculo respetando el toggle de armado automático.
  const ponerCirculo = (punto: PuntoV2) => {
    if (armadoAutomatico) {
      setCirculoArmado(punto);
      setCirculoSinArmar(null);
    } else {
      setCirculoSinArmar(punto);
      setCirculoArmado(null);
    }
  };

  const crearLinea = (origen: PuntoV2, destino: PuntoV2) => {
    if (!rotacionEfectiva) return;

    const estado: EstadoClasificacion = {
      saqueInicial,
      situacion,
      rotacion: rotacionEfectiva,
      lineas,
      recepcionOverrides: recepcionOverridesEfectivos,
      modoEspejo,
      equipoPropioId: equipoId,
      equipoRivalId: equipoRivalId,
      rotacionRival: rotacionRivalEfectiva,
      situacionRival,
      recepcionOverridesRival,
    };

    const res = clasificarLinea(estado, {
      origen,
      destino,
      desvios:
        desviosPendientes.length > 0 ? [...desviosPendientes] : undefined,
    });

    let jugadorFinal = res.jugadorId;
    let subtipoFinal = res.subtipoFijo ?? null;
    let tipoSaqueFinal = res.tipoSaqueFijo ?? null;
    let popupFinal: PopupRequerido = res.popup;
    let equipoAccionFinal: string | null = equipoId;

    if (res.tipo === "defensa" && !res.esRival) {
      if (!jugadorFinal) {
        jugadorFinal = resolverJugadorDefensa(
          origen,
          rotacionEfectiva,
          situacion
        );
      }
      if (!subtipoFinal) subtipoFinal = "defensa_normal";
    }

    const esLineaDeRivalEspejo =
      modoEspejo && ladoDeCelda(origen.celda) === "rival";

    if (esLineaDeRivalEspejo && equipoRivalId && rotacionRivalEfectiva) {
      equipoAccionFinal = equipoRivalId;
      const origenInv: PuntoV2 = {
        ...origen,
        celda: invertirCelda(origen.celda),
      };

      if (res.tipo === "saque") {
        jugadorFinal = jugadorQueSacaDeRot(rotacionRivalEfectiva);
        tipoSaqueFinal = "flotado";
        popupFinal = "tipo-saque";
      } else if (res.tipo === "recepcion") {
        jugadorFinal = jugadorQueRecibeDeRot(
          origenInv,
          rotacionRivalEfectiva,
          situacionRival,
          recepcionOverridesRival
        );
        popupFinal = "recepcion";
      } else if (res.tipo === "armado") {
        jugadorFinal = jugadorQueArmaDeRot(rotacionRivalEfectiva);
        popupFinal = "armado";
      } else if (res.tipo === "ataque") {
        jugadorFinal = jugadorQueAtacaDesdeCelda(
          origenInv.celda,
          rotacionRivalEfectiva,
          situacionRival
        );
        popupFinal = "ataque-toque-libre";
      } else if (res.tipo === "defensa") {
        jugadorFinal = resolverJugadorDefensa(
          origenInv,
          rotacionRivalEfectiva,
          situacionRival
        );
        if (!subtipoFinal) subtipoFinal = "defensa_normal";
        popupFinal = "defensa";
      } else if (res.tipo === "libre") {
        popupFinal = "libre";
      }
    }

    // --- SPLIT: ataque / bloqueo propio con origen rival ---
    //
    // Si la línea viene desde cancha rival, tiene un desvío en bloqueo
    // propio, y se clasifica como "ataque" o "bloqueo" PROPIO, en
    // realidad son DOS acciones: un ataque rival + un bloqueo propio.
    //
    // Antes este SPLIT solo se disparaba con tipo="bloqueo". Eso hacía
    // que cuando `comoAtaque` daba true (destino rival/fuera), la línea
    // se guardara como 1 sola acción de ataque con es_rival=false y el
    // jugador de nuestro bloqueo (BUG: el ataque rival aparecía como
    // propio y en cancha rival).
    //
    // Ahora también se dispara con tipo="ataque", así siempre se separa
    // en las 2 acciones correctas.
    if (
      (res.tipo === "bloqueo" || res.tipo === "ataque") &&
      !res.esRival &&
      /^F[456]-/.test(origen.celda)
    ) {
      const desvioBloqueo = desviosPendientes.find((d) =>
        d.celda.startsWith("BLOQ-P-")
      );

      if (desvioBloqueo) {
        const ataqueRival: LineaClasificada = {
          id: `l-${contadorId}`,
          tipo: "ataque",
          esRival: true,
          jugadorId: null,
          origen: origen,
          destino: { celda: desvioBloqueo.celda, mini: desvioBloqueo.mini },
          desvios: [],
          subtipo: "buena_rival",
          equipoId: equipoRivalId,
        };

        const bloqueoPropio: LineaClasificada = {
          id: `l-${contadorId + 1}`,
          tipo: "bloqueo",
          esRival: false,
          jugadorId: jugadorFinal,
          origen: { celda: desvioBloqueo.celda, mini: desvioBloqueo.mini },
          destino: destino,
          desvios: [],
          subtipo: "positivo",
          equipoId: equipoId,
        };

        setLineas((prev) => [...prev, ataqueRival, bloqueoPropio]);
        setContadorId((c) => c + 2);
        setDesviosPendientes([]);
        ponerCirculo(destino);
        setEstrella(null);
        setColaPopups([]);
        return;
      }
    }

    const nueva: LineaClasificada = {
      id: `l-${contadorId}`,
      tipo: res.tipo,
      esRival: res.esRival,
      jugadorId: jugadorFinal,
      origen,
      destino,
      desvios:
        desviosPendientes.length > 0 ? [...desviosPendientes] : undefined,
      subtipo: subtipoFinal,
      tipoSaque: tipoSaqueFinal,
      posicionInicial: estrella ? { ...estrella } : null,
      equipoId: equipoAccionFinal,
    };

    setLineas((prev) => [...prev, nueva]);
    setContadorId((c) => c + 1);
    setDesviosPendientes([]);
    ponerCirculo(destino);

    const cola: PopupEnCola[] = [];
    const pos = posicionPopup(destino);
    if (popupFinal) cola.push({ tipo: popupFinal, pos, lineaId: nueva.id });
    if (estrella && !res.esRival) {
      cola.push({ tipo: "jugador", pos, lineaId: nueva.id });
    }
    setColaPopups(cola);
    setEstrella(null);
  };

  const handleMiniClick = (coords: CoordsV2) => {
    if (!setupCompleto) return;
    if (colaPopups.length > 0) setColaPopups([]);

    const punto: PuntoV2 = { celda: coords.celda, mini: coords.mini };

    if (circuloSinArmar && mismaMini(circuloSinArmar, punto)) {
      setCirculoArmado(circuloSinArmar);
      setCirculoSinArmar(null);
      return;
    }
    if (circuloArmado && mismaMini(circuloArmado, punto)) {
      setCirculoSinArmar(circuloArmado);
      setCirculoArmado(null);
      setDesviosPendientes([]);
      return;
    }

    if (circuloArmado) {
      if (coords.zona === "red") {
        const linea: LineaClasificada = {
          id: `l-${contadorId}`,
          tipo: "roce-red",
          esRival: false,
          jugadorId: null,
          origen: circuloArmado,
          destino: punto,
          desvios:
            desviosPendientes.length > 0 ? [...desviosPendientes] : undefined,
          subtipo: null,
          posicionInicial: estrella ? { ...estrella } : null,
          equipoId: equipoId,
        };
        setLineas((prev) => [...prev, linea]);
        setContadorId((c) => c + 1);
        setDesviosPendientes([]);
        ponerCirculo(punto);
        setEstrella(null);
        setColaPopups([
          {
            tipo: "roce-red",
            pos: posicionPopup(punto),
            lineaId: linea.id,
          },
        ]);
        return;
      }

      if (esCeldaBloqueo(punto.celda)) {
        const esPropioConPopup = esCeldaBloqueoPropioConPopup(punto.celda);
        const indiceDesvio = desviosPendientes.length;
        setDesviosPendientes((prev) => [
          ...prev,
          { ...punto, jugadorId: null },
        ]);
        if (esPropioConPopup) {
          setColaPopups([
            {
              tipo: "bloqueo",
              pos: posicionPopup(punto),
              lineaId: "",
              indiceDesvio,
            },
          ]);
        }
        return;
      }

      crearLinea(circuloArmado, punto);
      return;
    }

    if (circuloSinArmar) {
      if (coords.zona === "red") {
        setColaPopups([
          {
            tipo: "roce-red",
            pos: posicionPopup(punto),
            lineaId: "",
          },
        ]);
        return;
      }

      if (esCanchaPropia(punto.celda)) {
        setEstrella(punto);
        return;
      }

      if (
        esCanchaRival(punto.celda) ||
        esCeldaBloqueo(punto.celda) ||
        punto.celda.startsWith("FUERA-")
      ) {
        const oculta: LineaClasificada = {
          id: `l-${contadorId}`,
          tipo: "libre",
          esRival: false,
          jugadorId: null,
          origen: circuloSinArmar,
          destino: punto,
          oculta: true,
          subtipo: null,
          posicionInicial: estrella ? { ...estrella } : null,
          equipoId: equipoId,
        };
        setLineas((prev) => [...prev, oculta]);
        setContadorId((c) => c + 1);
        ponerCirculo(punto);
        setEstrella(null);
        setDesviosPendientes([]);
        return;
      }
      return;
    }

    ponerCirculo(punto);
  };

  const handleClickCirculo = () => {
    if (circuloSinArmar) {
      setCirculoArmado(circuloSinArmar);
      setCirculoSinArmar(null);
      return;
    }
    if (circuloArmado) {
      setCirculoSinArmar(circuloArmado);
      setCirculoArmado(null);
      setDesviosPendientes([]);
    }
  };

  return {
    handleMiniClick,
    handleClickCirculo,
    crearLinea,
  };
}