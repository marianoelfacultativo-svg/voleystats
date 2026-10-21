// ============================================================
// HANDLERS POPUPS V2 — DataEntryV2
// Factory que devuelve todos los callbacks de los popups.
// ============================================================

import type { LineaClasificada } from "@/lib/clasificacionV2";
import type { PopupEnCola } from "./tiposV2";

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

  const handleRecepcionConfirmar = (v: 1 | 2 | 3 | 4 | 5 | 6) => {
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
  };
}