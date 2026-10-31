// ============================================================
// HANDLERS POPUPS V2 — DataEntryV2
// Factory que devuelve todos los callbacks de los popups.
// ============================================================
//
// v2.1 (FASE 7.1 — armado cruzado + remate de segunda):
//   + handleArmadoCruzadoConfirmar(v: ResultadoArmadoCruzado)
//   + handleVarianteRemateSegundaConfirmar(v)
//
// v1: handlers originales.
// ============================================================

import type { LineaClasificada } from "@/lib/clasificacionV2";
import type { PopupEnCola } from "./tiposV2";
import type {
  ValorRecepcion,
  ResultadoArmadoCruzado,
  VarianteToqueRemateSegunda,
} from "./PopupValoracion";

interface Params {
  popupActivo: PopupEnCola | null;
  lineas: LineaClasificada[];
  contadorId: number;
  equipoId: string;
  equipoRivalId: string | null;
  setLineas: React.Dispatch<React.SetStateAction<LineaClasificada[]>>;
  setColaPopups: React.Dispatch<React.SetStateAction<PopupEnCola[]>>;
  setContadorId: React.Dispatch<React.SetStateAction<number>>;
  setDesviosPendientes: React.Dispatch<
    React.SetStateAction<
      { celda: string; mini: string; jugadorId?: string | null }[]
    >
  >;
}

export function crearHandlersPopups({
  popupActivo,
  lineas,
  contadorId,
  equipoId,
  equipoRivalId,
  setLineas,
  setColaPopups,
  setContadorId,
  setDesviosPendientes,
}: Params) {
  const popupSiguiente = () => setColaPopups((prev) => prev.slice(1));
  const cerrarPopup = () => setColaPopups([]);

  const actualizarLineaPopup = (cambios: Partial<LineaClasificada>) => {
    if (!popupActivo?.lineaId) return;
    setLineas((prev) =>
      prev.map((l) =>
        l.id === popupActivo.lineaId ? { ...l, ...cambios } : l
      )
    );
  };

  const handleSaqueConfirmar = () => {
    popupSiguiente();
  };

  const handleTipoSaqueConfirmar = (v: "potencia" | "flotado") => {
    actualizarLineaPopup({ tipoSaque: v });
    popupSiguiente();
  };

  /**
   * Recepción — sistema nuevo de 5 valores elegidos a mano.
   *
   * Overpass (R/) y error_directo (R=) NO pasan por acá:
   *   - error_directo se genera automático cuando hay ace
   *     (ver helpersEspejoV2.ts / generarRecepcionesAceContra).
   *   - overpass se detecta automático cuando la línea de
   *     recepción cruza la red (ver clasificarLinea).
   *
   * El subtipo se guarda como string ("perfecta", "positiva", …)
   * para que el motor de estadísticas lo reconozca directo.
   */
  const handleRecepcionConfirmar = (v: ValorRecepcion) => {
    actualizarLineaPopup({ subtipo: v });
    popupSiguiente();
  };

  const handleArmadoConfirmar = (v: 1 | 2 | 3 | 4 | 5 | 6 | "R") => {
    if (!popupActivo?.lineaId) {
      popupSiguiente();
      return;
    }
    const lineaId = popupActivo.lineaId;
    const pos = popupActivo.pos;
    setLineas((prev) =>
      prev.map((l) => (l.id === lineaId ? { ...l, subtipo: v } : l))
    );
    setColaPopups((prev) => [
      { tipo: "velocidad", pos, lineaId },
      ...prev.slice(1),
    ]);
  };

  const handleVelocidadConfirmar = (v: 1 | 1.5 | 2 | 3 | 5) => {
    if (!popupActivo?.lineaId) {
      popupSiguiente();
      return;
    }
    setLineas((prev) =>
      prev.map((l) =>
        l.id === popupActivo.lineaId ? { ...l, velocidad: v } : l
      )
    );
    popupSiguiente();
  };

  const handleDefensaX2Change = (x2: boolean) => {
    if (!popupActivo?.lineaId) return;
    setLineas((prev) =>
      prev.map((l) =>
        l.id === popupActivo.lineaId ? { ...l, x2: x2 || undefined } : l
      )
    );
  };

  const handleDefensaConfirmar = (
    subtipo: "toque" | "gran-defensa" | "libre" | null,
    jugadorId: string | null,
    x2: boolean
  ) => {
    if (!popupActivo?.lineaId) {
      popupSiguiente();
      return;
    }
    setLineas((prev) => {
      const idx = prev.findIndex((l) => l.id === popupActivo.lineaId);
      if (idx < 0) return prev;
      const copia = [...prev];
      const lineaActual = copia[idx];
      const jugadorFinal = jugadorId ?? lineaActual.jugadorId ?? null;
      copia[idx] = {
        ...lineaActual,
        subtipo: subtipo ?? lineaActual.subtipo,
        jugadorId: jugadorFinal,
        x2: x2 || undefined,
      };
      return copia;
    });
    popupSiguiente();
  };

  const handleLibreConfirmar = (jugadorId: string | null) => {
    actualizarLineaPopup({ jugadorId });
    popupSiguiente();
  };

  const handleJugadorConfirmar = (jugadorId: string | null) => {
    actualizarLineaPopup({ jugadorId });
    popupSiguiente();
  };

  const handleBloqueoConfirmar = (jugadorId: string | null) => {
    if (!popupActivo) return;
    const idx = popupActivo.indiceDesvio;
    if (idx !== undefined && idx >= 0) {
      setDesviosPendientes((prev) =>
        prev.map((d, i) => (i === idx ? { ...d, jugadorId } : d))
      );
    }
    popupSiguiente();
  };

  const handleRoceRedConfirmar = (
    resultado:
      | "ofensivo-propio"
      | "invasion-zaguero"
      | "invasion-delantero"
      | "roce-red-rival",
    jugadorId: string | null
  ) => {
    if (!popupActivo) return;
    const esRival = resultado === "roce-red-rival";

    if (!popupActivo.lineaId) {
      const ficticia: LineaClasificada = {
        id: `tr-${contadorId}`,
        tipo: "roce-red",
        esRival,
        jugadorId,
        origen: { celda: "RED-C3", mini: "m1-5" },
        destino: { celda: "RED-C3", mini: "m1-5" },
        subtipo: resultado,
        equipoId: esRival ? equipoRivalId : equipoId,
      };
      setLineas((prev) => [...prev, ficticia]);
      setContadorId((c) => c + 1);
    } else {
      actualizarLineaPopup({ subtipo: resultado, jugadorId, esRival });
    }
    popupSiguiente();
  };

  const handleAtaqueToqueLibreConfirmar = (v: "toque" | "libre") => {
    if (!popupActivo) return;
    if (v === "toque") {
      setLineas((prev) =>
        prev.map((l) =>
          l.id === popupActivo.lineaId ? { ...l, variante: "toque" } : l
        )
      );
    } else if (v === "libre") {
      setLineas((prev) =>
        prev.map((l) =>
          l.id === popupActivo.lineaId
            ? { ...l, tipo: "libre", variante: null }
            : l
        )
      );
    }
    popupSiguiente();
  };

  const handleRemateSegundaConfirmar = () => {
    if (!popupActivo?.lineaId) {
      popupSiguiente();
      return;
    }
    const idx = lineas.findIndex((l) => l.id === popupActivo.lineaId);
    if (idx < 0) {
      popupSiguiente();
      return;
    }
    const linea = lineas[idx];

    if (linea.tipo === "libre" && linea.esRival) {
      setLineas((prev) =>
        prev.map((l) =>
          l.id === popupActivo.lineaId
            ? { ...l, tipo: "ataque", subtipo: "toque" }
            : l
        )
      );
    } else if (linea.tipo === "bloqueo" && !linea.esRival) {
      const nuevoId = `l-${contadorId}`;
      const ataqueRival: LineaClasificada = {
        id: nuevoId,
        tipo: "ataque",
        esRival: true,
        jugadorId: null,
        origen: linea.origen,
        destino: linea.destino,
        desvios: linea.desvios,
        subtipo: "toque",
        equipoId: equipoRivalId,
      };
      setLineas((prev) => [...prev, ataqueRival]);
      setContadorId((c) => c + 1);
    }
    popupSiguiente();
  };

  // ============================================================
  // FASE 7.1 — ARMADO CRUZADO
  // ============================================================
  //
  // La línea llega con tipo: "armado", subtipo: "armado-pasado",
  // popup: "armado-cruzado".
  //
  // Las 3 ramas:
  //   - "armado"          → dejar la línea como está (armado-pasado,
  //                          neutro, puntaje 2). Solo avanzar.
  //   - "remate-segunda"  → convertir a tipo: "ataque" con
  //                          variante: "toque-segunda" (default) y
  //                          encolar "variante-remate-segunda" para
  //                          que el usuario elija toque o remate.
  //                          Descartar cualquier "jugador" pendiente
  //                          por estrella (el jugador es el armador).
  //   - "libre"           → convertir a tipo: "libre". Si es propio,
  //                          encolar "jugador" para preguntar quién
  //                          la pasó. Si es rival, no preguntar.
  // ============================================================

  const handleArmadoCruzadoConfirmar = (v: ResultadoArmadoCruzado) => {
    if (!popupActivo) return;
    const lineaId = popupActivo.lineaId;
    const pos = popupActivo.pos;

    // ---------- 1. "armado" ----------
    // La línea ya quedó como armado-pasado al crearse. Solo avanzar.
    if (v === "armado") {
      popupSiguiente();
      return;
    }

    // ---------- 2. "remate-segunda" ----------
    // Convertir a ataque con variante default "toque-segunda" y
    // preguntar la variante en el sub-popup.
    if (v === "remate-segunda") {
      setLineas((prev) =>
        prev.map((l) =>
          l.id === lineaId
            ? {
                ...l,
                tipo: "ataque",
                subtipo: null,
                variante: "toque-segunda",
              }
            : l
        )
      );
      setColaPopups((prev) => {
        const sinActual = prev.slice(1);
        const sinJugador = sinActual.filter((p) => p.tipo !== "jugador");
        return [
          { tipo: "variante-remate-segunda", pos, lineaId },
          ...sinJugador,
        ];
      });
      return;
    }

    // ---------- 3. "libre" ----------
    // Convertir a libre. Preguntar jugador solo si es propio.
    const linea = lineas.find((l) => l.id === lineaId);
    const esRival = linea?.esRival ?? false;

    setLineas((prev) =>
      prev.map((l) =>
        l.id === lineaId
          ? {
              ...l,
              tipo: "libre",
              subtipo: null,
              variante: null,
              jugadorId: null,
            }
          : l
      )
    );

    if (esRival) {
      popupSiguiente();
      return;
    }

    setColaPopups((prev) => {
      const sinActual = prev.slice(1);
      const sinJugador = sinActual.filter((p) => p.tipo !== "jugador");
      return [{ tipo: "jugador", pos, lineaId }, ...sinJugador];
    });
  };

  // ============================================================
  // FASE 7.1 — VARIANTE REMATE DE SEGUNDA
  // ============================================================
  //
  // Sub-popup del armado cruzado.
  // El usuario elige "toque-segunda" (default) o "remate-segunda".
  // Solo se actualiza el campo `variante` de la línea.
  // ============================================================

  const handleVarianteRemateSegundaConfirmar = (
    v: VarianteToqueRemateSegunda
  ) => {
    if (!popupActivo?.lineaId) {
      popupSiguiente();
      return;
    }
    const lineaId = popupActivo.lineaId;
    setLineas((prev) =>
      prev.map((l) => (l.id === lineaId ? { ...l, variante: v } : l))
    );
    popupSiguiente();
  };

  return {
    popupSiguiente,
    cerrarPopup,
    handleSaqueConfirmar,
    handleTipoSaqueConfirmar,
    handleRecepcionConfirmar,
    handleArmadoConfirmar,
    handleVelocidadConfirmar,
    handleDefensaX2Change,
    handleDefensaConfirmar,
    handleLibreConfirmar,
    handleJugadorConfirmar,
    handleBloqueoConfirmar,
    handleRoceRedConfirmar,
    handleAtaqueToqueLibreConfirmar,
    handleRemateSegundaConfirmar,
    handleArmadoCruzadoConfirmar,
    handleVarianteRemateSegundaConfirmar,
  };
}