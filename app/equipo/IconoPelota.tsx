"use client";

import { useId } from "react";

export default function IconoPelota({
  size = 24,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const gradId = `ball-grad-${useId().replace(/:/g, "")}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={gradId} cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="60%" stopColor="#F1F5F9" />
          <stop offset="100%" stopColor="#94A3B8" />
        </radialGradient>
      </defs>

      <circle cx="50" cy="50" r="46" fill={`url(#${gradId})`} />

      <path d="M 5 60 Q 25 55 45 80 Q 25 95 5 60 Z" fill="#163A85" />
      <path d="M 95 60 Q 75 55 55 80 Q 75 95 95 60 Z" fill="#163A85" />

      <path d="M 15 25 Q 35 35 25 65 Q 5 55 15 25 Z" fill="#F7C32C" />
      <path d="M 85 25 Q 65 35 75 65 Q 95 55 85 25 Z" fill="#F7C32C" />

      <circle cx="50" cy="50" r="46" stroke="#163A85" strokeWidth="4" />
      <path
        d="M 50 4 Q 50 25 40 45"
        stroke="#163A85"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M 50 4 Q 50 25 60 45"
        stroke="#163A85"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M 4 50 Q 30 50 40 45"
        stroke="#163A85"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M 96 50 Q 70 50 60 45"
        stroke="#163A85"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M 4 50 Q 30 70 50 96"
        stroke="#163A85"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M 96 50 Q 70 70 50 96"
        stroke="#163A85"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}