import React from "react";

export type TipoIconoVoley =
  | "saque"
  | "recepcion"
  | "ataque"
  | "bloqueo"
  | "defensa"
  | "armado"
  | "consistencia";

interface Props {
  tipo: TipoIconoVoley | string;
  className?: string;
  size?: number;
}

export default function IconoVoley({
  tipo,
  className = "w-6 h-6 text-slate-800",
  size,
}: Props) {
  const s = size || 24;

  switch (tipo) {
    case "bloqueo":
      return (
        <svg width={s} height={s} viewBox="0 0 100 100" fill="currentColor" className={className}>
          {/* Red */}
          <path d="M0 65 L100 65 M0 85 L100 85 M15 65 L15 85 M30 65 L30 85 M45 65 L45 85 M60 65 L60 85 M75 65 L75 85 M90 65 L90 85" stroke="currentColor" strokeWidth="2" fill="none" />
          <rect x="0" y="63" width="100" height="4" />
          <rect x="0" y="83" width="100" height="4" />
          {/* Manos */}
          <path d="M25 60 V40 Q25 35 30 35 Q35 35 35 40 V60 Z" />
          <path d="M65 60 V40 Q65 35 70 35 Q75 35 75 40 V60 Z" />
          {/* Pelota */}
          <circle cx="50" cy="15" r="12" fill="none" stroke="currentColor" strokeWidth="4" />
          <path d="M 42 5 Q 50 15 42 25 M 58 5 Q 50 15 58 25" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
      );

    case "recepcion":
      return (
        <svg width={s} height={s} viewBox="0 0 100 100" fill="currentColor" className={className}>
          {/* Jugador agachado */}
          <circle cx="50" cy="25" r="10" />
          <path d="M40 35 L60 35 L70 60 L60 70 L50 50 L40 70 L30 60 Z" />
          <path d="M40 40 L15 50 L20 60 L35 50 Z" />
          <path d="M60 40 L85 50 L80 60 L65 50 Z" />
          {/* Pelota */}
          <circle cx="50" cy="70" r="12" fill="none" stroke="currentColor" strokeWidth="4" />
        </svg>
      );

    case "ataque":
      return (
        <svg width={s} height={s} viewBox="0 0 100 100" fill="currentColor" className={className}>
          {/* Jugador en el aire */}
          <circle cx="40" cy="20" r="10" />
          <path d="M35 30 L50 30 L60 50 L45 60 L30 50 Z" />
          <path d="M45 30 L60 15 L70 20 L55 35 Z" />
          <path d="M45 60 L35 90 L45 95 L55 60 Z" />
          {/* Pelota */}
          <circle cx="80" cy="15" r="12" fill="none" stroke="currentColor" strokeWidth="4" />
        </svg>
      );

    case "saque":
      return (
        <svg width={s} height={s} viewBox="0 0 100 100" fill="currentColor" className={className}>
          {/* Jugador */}
          <circle cx="40" cy="20" r="10" />
          <path d="M35 30 L45 30 L55 60 L45 65 L35 45 Z" />
          <path d="M35 45 L20 55 L25 65 L40 55 Z" />
          <path d="M45 65 L35 90 L45 95 L55 65 Z" />
          {/* Pelota */}
          <circle cx="75" cy="30" r="12" fill="none" stroke="currentColor" strokeWidth="4" />
        </svg>
      );

    case "armado":
      return (
        <svg width={s} height={s} viewBox="0 0 100 100" fill="currentColor" className={className}>
          {/* Jugador */}
          <circle cx="50" cy="25" r="10" />
          <path d="M40 35 L60 35 L65 70 L55 70 L55 90 L45 90 L45 70 L35 70 Z" />
          <path d="M40 35 L30 15 L20 20 L35 40 Z" />
          <path d="M60 35 L70 15 L80 20 L65 40 Z" />
          {/* Pelota */}
          <circle cx="50" cy="5" r="12" fill="none" stroke="currentColor" strokeWidth="4" />
        </svg>
      );

    case "defensa":
      return (
        <svg width={s} height={s} viewBox="0 0 100 100" fill="currentColor" className={className}>
          {/* Jugador zambulléndose */}
          <circle cx="40" cy="40" r="10" />
          <path d="M30 50 L70 60 L80 80 L70 85 L40 70 L20 80 L15 70 Z" />
          <path d="M20 70 L10 85 L15 90 L25 75 Z" />
          {/* Pelota */}
          <circle cx="85" cy="50" r="12" fill="none" stroke="currentColor" strokeWidth="4" />
        </svg>
      );

    case "consistencia":
      return (
        <svg width={s} height={s} viewBox="0 0 100 100" fill="currentColor" className={className}>
          {/* Gráfico de línea */}
          <path d="M10 90 L90 90" stroke="currentColor" strokeWidth="4" />
          <path d="M10 90 L10 10" stroke="currentColor" strokeWidth="4" />
          <path d="M20 80 L40 50 L60 60 L80 20" stroke="currentColor" strokeWidth="6" fill="none" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      );

    default:
      return null;
  }
}