"use client";

import { useEffect, useState } from "react";

interface Props {
  valor: number;
  onCambio: (nuevo: number) => void;
  disabled?: boolean;
}

export default function NumeroEditable({
  valor,
  onCambio,
  disabled = false,
}: Props) {
  const [editando, setEditando] = useState(false);
  const [textoTemp, setTextoTemp] = useState(String(valor));

  useEffect(() => {
    if (!editando) setTextoTemp(String(valor));
  }, [valor, editando]);

  const commit = () => {
    const n = parseInt(textoTemp);
    if (isNaN(n) || n < 0) {
      onCambio(0);
    } else {
      onCambio(n);
    }
    setEditando(false);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      setTextoTemp(String(valor));
      setEditando(false);
      e.currentTarget.blur();
    }
  };

  if (disabled) {
    return (
      <span className="w-10 text-center font-semibold text-slate-800">
        {valor}
      </span>
    );
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={editando ? textoTemp : String(valor)}
      onChange={(e) => {
        setEditando(true);
        setTextoTemp(e.target.value.replace(/[^0-9]/g, ""));
      }}
      onFocus={(e) => {
        setEditando(true);
        setTextoTemp(String(valor));
        setTimeout(() => e.target.select(), 0);
      }}
      onBlur={commit}
      onKeyDown={handleKey}
      className="w-10 text-center font-semibold text-slate-800 bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white rounded outline-none transition cursor-text"
    />
  );
}