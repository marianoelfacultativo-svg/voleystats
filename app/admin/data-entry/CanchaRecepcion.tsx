"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  celdasDeContexto,
  centroDeMini,
  keyPunto,
  minisDeCelda,
  type Celda,
} from "@/lib/cancha";
import type { RecepcionRow } from "@/lib/db";

interface Punto {
  celda: string;
  mini: string | null;
}

const COLORES: Record<number, string> = {
  1: "#dc2626",
  2: "#ea580c",
  3: "#f59e0b",
  4: "#eab308",
  5: "#84cc16",
  6: "#16a34a",
};

const ETIQUETAS: Record<number, string> = {
  1: "Ace en contra",
  2: "3x Negativa",
  3: "2x Negativa",
  4: "Negativa",
  5: "Positiva",
  6: "2x Positiva",
};

type Fase = "origen" | "destino" | "valoracion";

interface Props {
  recepcionesDelPunto: RecepcionRow[];
  onAgregar: (
    r: Omit<
      RecepcionRow,
      "id" | "partido_id" | "jugador_id" | "set_numero" | "punto_numero"
    >
  ) => void;
  onBorrarUltimo: () => void;
}

export default function CanchaRecepcion({
  recepcionesDelPunto,
  onAgregar,
  onBorrarUltimo,
}: Props) {
  const [fase, setFase] = useState<Fase>("origen");
  const [origen, setOrigen] = useState<Punto | null>(null);
  const [destino, setDestino] = useState<Punto | null>(null);
  const [preview, setPreview] = useState<{ x: number; y: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const refs = useRef<Record<string, HTMLDivElement | null>>({});

  const registrar = useCallback((key: string, el: HTMLDivElement | null) => {
    refs.current[key] = el;
  }, []);

  const posicion = useCallback((key: string) => {
    const el = refs.current[key];
    const cont = containerRef.current;
    if (!el || !cont) return null;
    const rEl = el.getBoundingClientRect();
    const rCont = cont.getBoundingClientRect();
    return {
      x: rEl.left + rEl.width / 2 - rCont.left,
      y: rEl.top + rEl.height / 2 - rCont.top,
    };
  }, []);

  const clickPunto = (p: Punto) => {
    if (fase === "origen") {
      setOrigen(p);
      setFase("destino");
      return;
    }
    if (fase === "destino") {
      setDestino(p);
      setFase("valoracion");
    }
  };

  const elegirValoracion = (v: number) => {
    if (!origen || !destino) return;
    onAgregar({
      origen_celda: origen.celda,
      origen_mini: origen.mini,
      destino_celda: destino.celda,
      destino_mini: destino.mini,
      valoracion: v,
    });
    reset();
  };

  const reset = () => {
    setFase("origen");
    setOrigen(null);
    setDestino(null);
    setPreview(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (
        t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.tagName === "SELECT"
      )
        return;
      if (e.key === "Escape") reset();
      if (fase === "valoracion") {
        const n = parseInt(e.key);
        if (n >= 1 && n <= 6) elegirValoracion(n);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fase, origen, destino]);

  useEffect(() => {
    if (fase !== "destino" || !origen) {
      setPreview(null);
      return;
    }
    const onMove = (e: MouseEvent) => {
      const cont = containerRef.current;
      if (!cont) return;
      const r = cont.getBoundingClientRect();
      setPreview({ x: e.clientX - r.left, y: e.clientY - r.top });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [fase, origen]);

  const celdas = useMemo(
    () => celdasDeContexto("defensa"), // solo F1, F2, F3
    []
  );

  const renderCelda = (
    celda: Celda,
    tipo: "mini33" | "mini32" | "single"
  ) => {
    const minis = tipo === "single" ? [] : minisDeCelda(celda, "defensa");
    const bgBase = "bg-emerald-50 border-emerald-400";
    const bgMini = "bg-emerald-200 hover:bg-emerald-300";

    if (tipo === "single") {
      return (
        <div
          key={celda}
          ref={(el) => registrar(celda, el)}
          onClick={() => clickPunto({ celda, mini: null })}
          className={`rounded-lg cursor-pointer border-2 min-h-[80px] ${bgBase} hover:brightness-95`}
        />
      );
    }

    const cols = tipo === "mini32" ? 2 : 3;

    return (
      <div
        key={celda}
        className={`rounded-lg border-2 p-1 ${bgBase}`}
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: 2,
        }}
      >
        {minis.map((m) => {
          const k = `${celda}-${m}`;
          return (
            <div
              key={m}
              ref={(el) => registrar(k, el)}
              onClick={() => clickPunto({ celda, mini: m })}
              className={`min-h-[24px] rounded-sm cursor-pointer ${bgMini}`}
            />
          );
        })}
      </div>
    );
  };

  const lineasGuardadas = useMemo(() => {
    return recepcionesDelPunto
      .map((r) => {
        const oKey = keyPunto(r.origen_celda, r.origen_mini);
        const dKey = keyPunto(r.destino_celda, r.destino_mini);
        const o = posicion(oKey);
        const d = posicion(dKey);
        if (!o || !d) return null;
        return {
          o,
          d,
          color: COLORES[r.valoracion] ?? "#64748b",
          valor: r.valoracion,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [recepcionesDelPunto, posicion]);

  const origenPos = origen ? posicion(keyPunto(origen.celda, origen.mini)) : null;
  const destinoPos = destino
    ? posicion(keyPunto(destino.celda, destino.mini))
    : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-600">Recepción:</span>
          <span
            className={`px-2 py-1 rounded ${
              fase === "origen" ? "bg-emerald-500 text-white" : "bg-slate-200"
            }`}
          >
            1. Dónde recibe
          </span>
          <span
            className={`px-2 py-1 rounded ${
              fase === "destino" ? "bg-emerald-500 text-white" : "bg-slate-200"
            }`}
          >
            2. Dónde cae el pase
          </span>
          <span
            className={`px-2 py-1 rounded ${
              fase === "valoracion"
                ? "bg-emerald-500 text-white"
                : "bg-slate-200"
            }`}
          >
            3. Valoración (1-6)
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={reset}
            disabled={fase === "origen"}
            className="px-3 py-1 bg-slate-200 hover:bg-slate-300 rounded disabled:opacity-40"
          >
            Cancelar (Esc)
          </button>
          <button
            onClick={onBorrarUltimo}
            disabled={recepcionesDelPunto.length === 0}
            className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded disabled:opacity-40"
          >
            🗑 Borrar último
          </button>
        </div>
      </div>

      <div ref={containerRef} className="relative select-none">
        <div className="grid grid-cols-5 gap-1.5">
          {celdas.map(({ celda, tipo }) => renderCelda(celda, tipo))}
        </div>

        <svg
          className="absolute inset-0 pointer-events-none"
          style={{ width: "100%", height: "100%" }}
        >
          {lineasGuardadas.map((l, i) => (
            <g key={i}>
              <line
                x1={l.o.x}
                y1={l.o.y}
                x2={l.d.x}
                y2={l.d.y}
                stroke={l.color}
                strokeWidth={3}
                strokeLinecap="round"
                opacity={0.85}
              />
              <circle
                cx={l.o.x}
                cy={l.o.y}
                r={5}
                fill={l.color}
                stroke="white"
                strokeWidth={1.5}
              />
              <circle
                cx={l.d.x}
                cy={l.d.y}
                r={7}
                fill={l.color}
                stroke="white"
                strokeWidth={2}
              />
              <text
                x={l.d.x}
                y={l.d.y + 3}
                textAnchor="middle"
                fontSize={9}
                fontWeight="bold"
                fill="white"
              >
                {l.valor}
              </text>
            </g>
          ))}

          {origenPos && (
            <>
              {destinoPos && (
                <line
                  x1={origenPos.x}
                  y1={origenPos.y}
                  x2={destinoPos.x}
                  y2={destinoPos.y}
                  stroke="#10b981"
                  strokeWidth={3}
                />
              )}
              {!destinoPos && preview && (
                <line
                  x1={origenPos.x}
                  y1={origenPos.y}
                  x2={preview.x}
                  y2={preview.y}
                  stroke="#10b981"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  opacity={0.7}
                />
              )}
              <circle
                cx={origenPos.x}
                cy={origenPos.y}
                r={6}
                fill="#10b981"
                stroke="white"
                strokeWidth={2}
              />
            </>
          )}
        </svg>

        {fase === "valoracion" && destinoPos && (
          <div
            className="absolute z-50 bg-white border-2 border-slate-300 rounded-xl shadow-lg p-2 flex gap-1 flex-wrap max-w-[260px]"
            style={{
              left: destinoPos.x,
              top: destinoPos.y,
              transform: "translate(-50%, calc(-100% - 10px))",
            }}
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                onClick={() => elegirValoracion(n)}
                className="w-9 h-9 rounded-lg text-white font-bold text-sm transition hover:scale-110"
                style={{ backgroundColor: COLORES[n] }}
                title={ETIQUETAS[n]}
              >
                {n}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-400 mt-3 text-center">
        Clic 1: dónde se recibe → Clic 2: dónde cae el pase → 1-6 o click en la
        valoración. Esc cancela.
      </p>

      {recepcionesDelPunto.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-200">
          <p className="text-xs text-slate-500 mb-2">
            Recepciones del punto ({recepcionesDelPunto.length}):
          </p>
          <div className="flex flex-wrap gap-2">
            {recepcionesDelPunto.map((r, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-2 py-1 rounded border text-xs"
                style={{
                  borderColor: COLORES[r.valoracion],
                  color: COLORES[r.valoracion],
                }}
              >
                <span className="font-semibold">{r.valoracion}</span>
                <span className="text-slate-500">
                  {r.origen_celda}
                  {r.origen_mini ? `-${r.origen_mini}` : ""} → {r.destino_celda}
                  {r.destino_mini ? `-${r.destino_mini}` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
