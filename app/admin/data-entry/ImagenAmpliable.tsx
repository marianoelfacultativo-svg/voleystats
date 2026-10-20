"use client";

import { useState } from "react";

interface Props {
  src: string | null;
  alt: string;
  inicial: string;
  tamaño?: "sm" | "md" | "lg";
}

export default function ImagenAmpliable({
  src,
  alt,
  inicial,
  tamaño = "md",
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [errorImg, setErrorImg] = useState(false);

  const tamaños = {
    sm: "w-12 h-12 text-base",
    md: "w-20 h-20 text-2xl",
    lg: "w-24 h-24 text-3xl",
  };

  const tieneImagen = !!src && !errorImg;

  return (
    <>
      <button
        type="button"
        onClick={() => tieneImagen && setAbierto(true)}
        className={`${tamaños[tamaño]} rounded-full overflow-hidden border-2 flex items-center justify-center flex-shrink-0 transition ${
          tieneImagen
            ? "border-slate-200 cursor-zoom-in hover:border-blue-400"
            : "bg-blue-100 border-blue-200"
        }`}
        title={tieneImagen ? "Click para ampliar" : alt}
      >
        {tieneImagen ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt}
            onError={() => setErrorImg(true)}
            className="w-full h-full object-cover object-center"
          />
        ) : (
          <span className="font-bold text-blue-600">{inicial}</span>
        )}
      </button>

      {abierto && tieneImagen && (
        <div
          onClick={() => setAbierto(false)}
          className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4 cursor-zoom-out"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
          <button
            onClick={() => setAbierto(false)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 text-white text-2xl font-bold flex items-center justify-center transition"
          >
            ×
          </button>
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">
            Click en cualquier lado para cerrar
          </p>
        </div>
      )}
    </>
  );
}