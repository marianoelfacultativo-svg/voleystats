"use client";

// ============================================================
// POPUPS V2 — switch que renderiza el popup activo
// ============================================================

import {
  PopupArmado,
  PopupAtaqueToqueLibre,
  PopupBloqueo,
  PopupDefensa,
  PopupJugador,
  PopupLibre,
  PopupRecepcion,
  PopupRemateSegunda,
  PopupRoceRed,
  PopupSaque,
  PopupTipoSaque,
  PopupVelocidad,
  type ValorArmado,
  type ValorRecepcion,
  type ValorSaque,
  type ValorTipoSaque,
  type ValorVelocidad,
  type TipoDefensa,
  type ResultadoRoceRed,
  type VarianteAtaquePopup,
  type VarianteRemateSegunda,
  type JugadorEnCancha,
  type JugadorZona,
} from "./PopupValoracion";
import type { PopupEnCola } from "./tiposV2";

interface Props {
  popupActivo: PopupEnCola | null;

  // Datos
  jugadoresEnCancha: JugadorEnCancha[];
  delanterosPorZona: JugadorZona[];

  // Handlers
  onSaqueConfirmar: (v: ValorSaque) => void;
  onTipoSaqueConfirmar: (v: ValorTipoSaque) => void;
  onRecepcionConfirmar: (v: ValorRecepcion) => void;
  onArmadoConfirmar: (v: ValorArmado) => void;
  onVelocidadConfirmar: (v: ValorVelocidad) => void;
  onDefensaConfirmar: (
    subtipo: TipoDefensa | null,
    jugadorId: string | null,
    x2: boolean
  ) => void;
  onDefensaX2Change?: (x2: boolean) => void;
  onLibreConfirmar: (jugadorId: string | null) => void;
  onJugadorConfirmar: (jugadorId: string | null) => void;
  onBloqueoConfirmar: (jugadorId: string | null) => void;
  onRoceRedConfirmar: (
    resultado: ResultadoRoceRed,
    jugadorId: string | null
  ) => void;
  onAtaqueToqueLibreConfirmar: (v: VarianteAtaquePopup) => void;
  onRemateSegundaConfirmar: (v: VarianteRemateSegunda) => void;
  onCerrar: () => void;
  onSiguiente: () => void;
}

export default function PopupsV2({
  popupActivo,
  jugadoresEnCancha,
  delanterosPorZona,
  onSaqueConfirmar,
  onTipoSaqueConfirmar,
  onRecepcionConfirmar,
  onArmadoConfirmar,
  onVelocidadConfirmar,
  onDefensaConfirmar,
  onDefensaX2Change,
  onLibreConfirmar,
  onJugadorConfirmar,
  onBloqueoConfirmar,
  onRoceRedConfirmar,
  onAtaqueToqueLibreConfirmar,
  onRemateSegundaConfirmar,
  onCerrar,
  onSiguiente,
}: Props) {
  if (!popupActivo) return null;

  if (popupActivo.tipo === "saque") {
    return (
      <PopupSaque
        pos={popupActivo.pos}
        onConfirmar={onSaqueConfirmar}
        onCancelar={onCerrar}
      />
    );
  }
  if (popupActivo.tipo === "tipo-saque") {
    return (
      <PopupTipoSaque
        pos={popupActivo.pos}
        onConfirmar={onTipoSaqueConfirmar}
        onCancelar={onSiguiente}
      />
    );
  }
  if (popupActivo.tipo === "recepcion") {
    return (
      <PopupRecepcion
        pos={popupActivo.pos}
        onConfirmar={onRecepcionConfirmar}
        onCancelar={onCerrar}
      />
    );
  }
  if (popupActivo.tipo === "armado") {
    return (
      <PopupArmado
        pos={popupActivo.pos}
        onConfirmar={onArmadoConfirmar}
        onCancelar={onCerrar}
      />
    );
  }
  if (popupActivo.tipo === "velocidad") {
    return (
      <PopupVelocidad
        pos={popupActivo.pos}
        onConfirmar={onVelocidadConfirmar}
        onCancelar={onCerrar}
      />
    );
  }
  if (popupActivo.tipo === "defensa") {
    return (
      <PopupDefensa
        pos={popupActivo.pos}
        onConfirmar={onDefensaConfirmar}
        onX2Change={onDefensaX2Change}
        onCancelar={onCerrar}
      />
    );
  }
  if (popupActivo.tipo === "libre") {
    return (
      <PopupLibre
        pos={popupActivo.pos}
        jugadores={jugadoresEnCancha}
        onConfirmar={onLibreConfirmar}
        onCancelar={onCerrar}
      />
    );
  }
  if (popupActivo.tipo === "jugador") {
    return (
      <PopupJugador
        pos={popupActivo.pos}
        jugadores={jugadoresEnCancha}
        onConfirmar={onJugadorConfirmar}
        onCancelar={onCerrar}
      />
    );
  }
  if (popupActivo.tipo === "roce-red") {
    return (
      <PopupRoceRed
        pos={popupActivo.pos}
        jugadores={jugadoresEnCancha}
        onConfirmar={onRoceRedConfirmar}
        onCancelar={onCerrar}
      />
    );
  }
  if (popupActivo.tipo === "ataque-toque-libre") {
    return (
      <PopupAtaqueToqueLibre
        pos={popupActivo.pos}
        onConfirmar={onAtaqueToqueLibreConfirmar}
        onCancelar={onCerrar}
      />
    );
  }
  if (popupActivo.tipo === "remate-segunda") {
    return (
      <PopupRemateSegunda
        pos={popupActivo.pos}
        onConfirmar={onRemateSegundaConfirmar}
        onCancelar={onCerrar}
      />
    );
  }
  if (popupActivo.tipo === "bloqueo") {
    return (
      <PopupBloqueo
        pos={popupActivo.pos}
        jugadores={delanterosPorZona}
        onConfirmar={onBloqueoConfirmar}
        onCancelar={onCerrar}
      />
    );
  }
  return null;
}