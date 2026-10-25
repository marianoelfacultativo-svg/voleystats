import React from "react";

export type TipoIconoVoley =
  | "saque"
  | "recepcion"
  | "ataque"
  | "bloqueo"
  | "defensa"
  | "armado"
  | "consistencia"
  | "dashboard"
  | "equipo"
  | "jugador"
  | "partido"
  | "visualizacion"
  | "comparar"
  | "crudas";

interface Props {
  tipo: TipoIconoVoley | string;
  className?: string;
  size?: number;
}

const ROJO = "#EF4444"; // Rojo brillante (Tailwind Red 500)

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
          <path d="M0 65 L100 65 M0 85 L100 85 M15 65 L15 85 M30 65 L30 85 M45 65 L45 85 M60 65 L60 85 M75 65 L75 85 M90 65 L90 85" stroke="currentColor" strokeWidth="2" fill="none" />
          <rect x="0" y="63" width="100" height="4" />
          <rect x="0" y="83" width="100" height="4" />
          <path d="M25 60 V40 Q25 35 30 35 Q35 35 35 40 V60 Z" />
          <path d="M65 60 V40 Q65 35 70 35 Q75 35 75 40 V60 Z" />
          <circle cx="50" cy="15" r="12" fill="none" stroke={ROJO} strokeWidth="4" />
          <path d="M 42 5 Q 50 15 42 25 M 58 5 Q 50 15 58 25" stroke={ROJO} strokeWidth="2" fill="none" />
        </svg>
      );

    case "recepcion":
      return (
        <svg width={s} height={s} viewBox="0 0 100 100" fill="currentColor" className={className}>
          <circle cx="50" cy="25" r="10" />
          <path d="M40 35 L60 35 L70 60 L60 70 L50 50 L40 70 L30 60 Z" />
          <path d="M40 40 L15 50 L20 60 L35 50 Z" />
          <path d="M60 40 L85 50 L80 60 L65 50 Z" />
          <circle cx="50" cy="70" r="12" fill="none" stroke={ROJO} strokeWidth="4" />
        </svg>
      );

    case "ataque":
      return (
        <svg width={s} height={s} viewBox="0 0 100 100" fill="currentColor" className={className}>
          <circle cx="40" cy="20" r="10" />
          <path d="M35 30 L50 30 L60 50 L45 60 L30 50 Z" />
          <path d="M45 30 L60 15 L70 20 L55 35 Z" />
          <path d="M45 60 L35 90 L45 95 L55 60 Z" />
          <circle cx="80" cy="15" r="12" fill="none" stroke={ROJO} strokeWidth="4" />
        </svg>
      );

    case "saque":
      return (
        <svg width={s} height={s} viewBox="0 0 100 100" fill="currentColor" className={className}>
          <circle cx="40" cy="20" r="10" />
          <path d="M35 30 L45 30 L55 60 L45 65 L35 45 Z" />
          <path d="M35 45 L20 55 L25 65 L40 55 Z" />
          <path d="M45 65 L35 90 L45 95 L55 65 Z" />
          <circle cx="75" cy="30" r="12" fill="none" stroke={ROJO} strokeWidth="4" />
        </svg>
      );

    case "armado":
      return (
        <svg width={s} height={s} viewBox="0 0 100 100" fill="currentColor" className={className}>
          <circle cx="50" cy="25" r="10" />
          <path d="M40 35 L60 35 L65 70 L55 70 L55 90 L45 90 L45 70 L35 70 Z" />
          <path d="M40 35 L30 15 L20 20 L35 40 Z" />
          <path d="M60 35 L70 15 L80 20 L65 40 Z" />
          <circle cx="50" cy="5" r="12" fill="none" stroke={ROJO} strokeWidth="4" />
        </svg>
      );

    case "defensa":
      return (
        <svg width={s} height={s} viewBox="0 0 100 100" fill="currentColor" className={className}>
          <circle cx="40" cy="40" r="10" />
          <path d="M30 50 L70 60 L80 80 L70 85 L40 70 L20 80 L15 70 Z" />
          <path d="M20 70 L10 85 L15 90 L25 75 Z" />
          <circle cx="85" cy="50" r="12" fill="none" stroke={ROJO} strokeWidth="4" />
        </svg>
      );

    case "consistencia":
      return (
        <svg width={s} height={s} viewBox="0 0 100 100" fill="currentColor" className={className}>
          <path d="M10 90 L90 90" stroke="currentColor" strokeWidth="4" />
          <path d="M10 90 L10 10" stroke="currentColor" strokeWidth="4" />
          <path d="M20 80 L40 50 L60 60 L80 20" stroke="currentColor" strokeWidth="6" fill="none" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx="80" cy="20" r="8" fill={ROJO} />
        </svg>
      );

    case "dashboard":
      return (
        <svg width={s} height={s} viewBox="0 0 100 100" fill="currentColor" className={className}>
          <rect x="10" y="10" width="35" height="35" rx="4" />
          <rect x="55" y="10" width="35" height="35" rx="4" fill={ROJO} />
          <rect x="10" y="55" width="35" height="35" rx="4" />
          <rect x="55" y="55" width="35" height="35" rx="4" />
        </svg>
      );

    case "equipo":
      return (
        <svg width={s} height={s} viewBox="0 0 100 100" fill="currentColor" className={className}>
          <circle cx="50" cy="30" r="16" />
          <path d="M15 90 Q 50 35 85 90" stroke="currentColor" strokeWidth="12" fill="none" />
          <circle cx="20" cy="40" r="10" fill={ROJO} />
        </svg>
      );

    case "jugador":
      return (
        <svg width={s} height={s} viewBox="0 0 100 100" fill="currentColor" className={className}>
          <circle cx="50" cy="25" r="14" fill={ROJO} />
          <path d="M25 90 Q 50 45 75 90" stroke="currentColor" strokeWidth="16" fill="none" />
        </svg>
      );

    case "partido":
      return (
        <svg width={s} height={s} viewBox="0 0 100 100" fill="currentColor" className={className}>
          <rect x="15" y="20" width="70" height="70" rx="6" />
          <path d="M15 40 L85 40" stroke="currentColor" strokeWidth="6" />
          <rect x="15" y="20" width="70" height="20" rx="6" fill={ROJO} />
          <rect x="25" y="50" width="10" height="10" fill="currentColor" />
          <rect x="45" y="50" width="10" height="10" fill="currentColor" />
          <rect x="65" y="50" width="10" height="10" fill="currentColor" />
        </svg>
      );

    case "visualizacion":
      return (
        <svg width={s} height={s} viewBox="0 0 100 100" fill="currentColor" className={className}>
          <rect x="10" y="20" width="80" height="55" rx="6" />
          <rect x="20" y="30" width="60" height="35" rx="2" fill={ROJO} />
          <rect x="40" y="80" width="20" height="6" rx="2" />
        </svg>
      );

    case "comparar":
      return (
        <svg width={s} height={s} viewBox="0 0 100 100" fill="currentColor" className={className}>
          <path d="M50 10 L50 85" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
          <path d="M20 30 L80 30" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
          <circle cx="50" cy="30" r="12" fill={ROJO} />
        </svg>
      );

    case "crudas":
      return (
        <svg width={s} height={s} viewBox="0 0 100 100" fill="currentColor" className={className}>
          <rect x="10" y="20" width="80" height="60" rx="4" stroke="currentColor" strokeWidth="8" fill="none" />
          <path d="M10 40 L90 40" stroke="currentColor" strokeWidth="8" />
          <rect x="10" y="20" width="80" height="20" rx="4" fill={ROJO} />
          <path d="M40 40 L40 80 M70 40 L70 80" stroke="currentColor" strokeWidth="8" />
        </svg>
      );

    default:
      return null;
  }
}