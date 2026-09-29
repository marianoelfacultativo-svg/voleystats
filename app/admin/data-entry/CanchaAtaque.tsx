"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  celdasDeContexto,
  esCanchaRival,
  keyPunto,
  minisDeCelda,
  zonaDeOrigenAtaque,
  type Celda,
} from "@/lib/cancha";
import type { AtaqueRow } from "@/lib/db";

type Valoracion = "punto" | "neutro" | "error";
type Fase = "origen" | "navegando" | "valoracion";

const VALORACIONES_ORDEN: { id: Valoracion; label: string; color: string; tecla: number }[] = [
  { id: "error", label: "Error", color: "#dc2626", tecla: 1 },
  { id: "neutro", label: "Neutro", color: "#64748b", tecla: 2 },
  { id: "punto", label: "Punto", color: "#16a34a", tecla: 3 },
];

const COLORES: Record<Valoracion, string> = {
  punto: "#16a34a",
  neutro: "#64748b",
  error: "#dc2626",
};

interface Punto {
  celda: string;
  mini: string | null;
}

interface Props {
  ataquesDelPunto: AtaqueRow[];
  onAgregar: (
    a: Omit<
      AtaqueRow,
      "id" | "partido_id" | "jugador_id" | "set_numero" | "punto_numero"
    >
  ) => void;
  onBorrarUltimo: () => void;
  atacanteSugerido: string | null;
}

export default function CanchaAtaque({
  ataquesDelPunto,
  onAgregar,
  onBorrarUltimo,
  atacanteSugerido,
}: Props) {
  const [fase, setFase] = useState<Fase>("origen");
  const [origen, setOrigen] = useState<Punto | null>(null);
  const [desvios, setDesvios] = useState<Punto[]>([]);
  const [destinoTemp, setDestinoTemp] = useState<Punto | null>(null);
  const [esperaDesvio, setEsperaDesvio] = useState(false);
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
      setFase("navegando");
      return;
    }
    if (fase === "navegando") {
      if (esperaDesvio) {
        setDesvios((prev) => [...prev, p]);
        setEsperaDesvio(false);
        return;
      }
      setDestinoTemp(p);
      setFase("valoracion");
    }
  };

  const elegirValoracion = (v: Valoracion) => {
    if (!origen || !destinoTemp) return;
    const zona = zonaDeOrigenAtaque(origen.celda);
    onAgregar({
      origen_celda: origen.celda,
      origen_mini: origen.mini,
      destino_celda: destinoTemp.celda,
      destino_mini: destinoTemp.mini,
      desvios: desvios.map((d) => ({ celda: d.celda, mini: d.mini })),
      zona,
      valoracion: v,
    });
    reset();
  };

  const reset = () => {
    setFase("origen");
    setOrigen(null);
    setDesvios([]);
    setDestinoTemp(null);
    setEsperaDesvio(false);
    setPreview(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT") return;
      if (e.key === "Escape") {
        reset();
        return;
      }
      if (fase === "navegando" && e.key.toLowerCase() === "d" && !esperaDesvio) {
        setEsperaDesvio(true);
      }
      if (fase === "valoracion") {
        const n = parseInt(e.key);
        const item = VALORACIONES_ORDEN.find((v) => v.tecla === n);
        if (item) elegirValoracion(item.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fase, esperaDesvio, origen, destinoTemp, desvios]);

  useEffect(() => {
    if (fase !== "navegando" || !origen) {
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

  const celdas = useMemo(() => celdasDeContexto("ataque"), []);

  // Rival arriba: F6 → F5 → F4
  const celdasRival = useMemo(() => {
    const f4 = celdas.slice(15, 20);
    const f5 = celdas.slice(20, 25);
    const f6 = celdas.slice(25, 30);
    return [...f6, ...f5, ...f4];
  }, [celdas]);

  // Propias abajo: F1 → F2 → F3
  const celdasPropias = useMemo(() => celdas.slice(0, 15), [celdas]);

  const esColumnaMedia = (celda: string) => {
    const col = celda.split("-")[1];
    return col === "C2" || col === "C3" || col === "C4";
  };

  const renderCelda = (celda: Celda, tipo: "mini33" | "mini32" | "single") => {
    const minis = tipo === "single" ? [] : minisDeCelda(celda, "ataque");
    const esRival = esCanchaRival(celda.split("-")[0] as any);
    const esMedia = esColumnaMedia(celda);

    const bgBase = esRival
      ? esMedia
        ? "bg-orange-100 border-orange-400"
        : "bg-orange-50 border-orange-300"
      : esMedia
      ? "bg-emerald-100 border-emerald-500"
      : "bg-emerald-50 border-emerald-400";

    const bgMini = esRival
      ? esMedia
        ? "bg-orange-300 hover:bg-orange-400"
        : "bg-orange-200 hover:bg-orange-300"
      : esMedia
      ? "bg-emerald-300 hover:bg-emerald-400"
      : "bg-emerald-200 hover:bg-emerald-300";

    if (tipo === "single") {
      const k = celda;
      return (
        <div
          key={celda}
          ref={(el) => registrar(k, el)}
          onClick={() => clickPunto({ celda, mini: null })}
          className={`rounded-md cursor-pointer border-2 min-h-[36px] ${bgBase} hover:brightness-95`}
        />
      );
    }

    const cols = tipo === "mini32" ? 2 : 3;

    return (
      <div
        key={celda}
        className={`rounded-md border-2 p-0.5 ${bgBase}`}
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: 1,
        }}
      >
        {minis.map((m) => {
          const k = `${celda}-${m}`;
          return (
            <div
              key={m}
              ref={(el) => registrar(k, el)}
              onClick={() => clickPunto({ celda, mini: m })}
              className={`min-h-[12px] rounded-sm cursor-pointer ${bgMini}`}
            />
          );
        })}
      </div>
    );
  };

  const lineasGuardadas = useMemo(() => {
    return ataquesDelPunto
      .map((a) => {
        const oKey = keyPunto(a.origen_celda, a.origen_mini);
        const dKey = keyPunto(a.destino_celda, a.destino_mini);
        const posO = posicion(oKey);
        const posD = posicion(dKey);
        if (!posO || !posD) return null;
        return {
          o: posO,
          d: posD,
          color: COLORES[a.valoracion as Valoracion] ?? "#64748b",
          desvios: a.desvios
            .map((dv) => posicion(keyPunto(dv.celda, dv.mini)))
            .filter((p): p is { x: number; y: number } => p !== null),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [ataquesDelPunto, posicion]);

  const origenPos = origen ? posicion(keyPunto(origen.celda, origen.mini)) : null;
  const desviosPos = desvios
    .map((d) => posicion(keyPunto(d.celda, d.mini)))
    .filter((p): p is { x: number; y: number } => p !== null);
  const destinoPos = destinoTemp
    ? posicion(keyPunto(destinoTemp.celda, destinoTemp.mini))
    : null;

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-2 text-[10px] flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          <span className={`px-1.5 py-0.5 rounded ${fase === "origen" ? "bg-emerald-500 text-white" : "bg-slate-200"}`}>
            1. Origen
          </span>
          <span className={`px-1.5 py-0.5 rounded ${fase === "navegando" ? "bg-emerald-500 text-white" : "bg-slate-200"}`}>
            2. Desvíos (D) → Destino
          </span>
          <span className={`px-1.5 py-0.5 rounded ${fase === "valoracion" ? "bg-emerald-500 text-white" : "bg-slate-200"}`}>
            3. Valoración
          </span>
          {esperaDesvio && (
            <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white font-semibold">
              D activo
            </span>
          )}
        </div>
        <div className="flex gap-1">
          <button
            onClick={reset}
            disabled={fase === "origen"}
            className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 rounded disabled:opacity-40"
          >
            Cancelar (Esc)
          </button>
          <button
            onClick={onBorrarUltimo}
            disabled={ataquesDelPunto.length === 0}
            className="px-2 py-0.5 bg-red-100 hover:bg-red-200 text-red-700 rounded disabled:opacity-40"
          >
            🗑 Borrar último
          </button>
        </div>
      </div>

      {atacanteSugerido && (
        <div className="mb-1 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
          Atacante sugerido: <strong>{atacanteSugerido}</strong>
        </div>
      )}

      <div ref={containerRef} className="relative select-none">
        <div className="text-[9px] font-bold text-orange-700 text-center mb-0.5 tracking-wide">
          ▼ CANCHA RIVAL ▼
        </div>

        <div className="grid grid-cols-5 gap-0.5">
          {celdasRival.map(({ celda, tipo }) => renderCelda(celda, tipo))}
        </div>

        <div className="flex items-center justify-center my-1 gap-2">
          <div className="flex-1 h-0.5 bg-slate-300" />
          <div className="px-1.5 py-0.5 bg-slate-800 text-white text-[8px] font-bold rounded">
            RED
          </div>
          <div className="flex-1 h-0.5 bg-slate-300" />
        </div>

        <div className="text-[9px] font-bold text-emerald-700 text-center mb-0.5 tracking-wide">
          ▲ TU CANCHA ▲
        </div>

        <div className="grid grid-cols-5 gap-0.5">
          {celdasPropias.map(({ celda, tipo }) => renderCelda(celda, tipo))}
        </div>

        <svg className="absolute inset-0 pointer-events-none" style={{ width: "100%", height: "100%" }}>
          {lineasGuardadas.map((l, i) => (
            <g key={i}>
              <line x1={l.o.x} y1={l.o.y} x2={l.d.x} y2={l.d.y} stroke={l.color} strokeWidth={2} strokeLinecap="round" opacity={0.85} />
              {l.desvios.map((dv, j) => (
                <circle key={j} cx={dv.x} cy={dv.y} r={2.5} fill={l.color} />
              ))}
              <circle cx={l.o.x} cy={l.o.y} r={3.5} fill={l.color} stroke="white" strokeWidth={1} />
              <circle cx={l.d.x} cy={l.d.y} r={5} fill={l.color} stroke="white" strokeWidth={1.5} />
            </g>
          ))}

          {origenPos && (
            <>
              {desviosPos.map((dv, i) => (
                <circle key={i} cx={dv.x} cy={dv.y} r={2.5} fill="#10b981" stroke="white" strokeWidth={1} />
              ))}
              {destinoPos && (
                <line
                  x1={desviosPos.length > 0 ? desviosPos[desviosPos.length - 1].x : origenPos.x}
                  y1={desviosPos.length > 0 ? desviosPos[desviosPos.length - 1].y : origenPos.y}
                  x2={destinoPos.x}
                  y2={destinoPos.y}
                  stroke="#10b981"
                  strokeWidth={2}
                />
              )}
              {!destinoPos && preview && (
                <line
                  x1={desviosPos.length > 0 ? desviosPos[desviosPos.length - 1].x : origenPos.x}
                  y1={desviosPos.length > 0 ? desviosPos[desviosPos.length - 1].y : origenPos.y}
                  x2={preview.x}
                  y2={preview.y}
                  stroke="#10b981"
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                  opacity={0.7}
                />
              )}
              <circle cx={origenPos.x} cy={origenPos.y} r={4} fill="#10b981" stroke="white" strokeWidth={1.5} />
            </>
          )}
        </svg>

        {fase === "valoracion" && destinoPos && (
          <div
            data-popup
            className="absolute z-50 bg-white border-2 border-slate-300 rounded-lg shadow-lg p-1.5 flex gap-1"
            style={{
              left: destinoPos.x,
              top: destinoPos.y,
              transform: "translate(-50%, calc(-100% - 8px))",
            }}
          >
            {VALORACIONES_ORDEN.map((v) => (
              <button
                key={v.id}
                onClick={() => elegirValoracion(v.id)}
                className="px-2 py-1 rounded text-white text-[10px] font-bold flex flex-col items-center"
                style={{ backgroundColor: v.color }}
              >
                <span>{v.label}</span>
                <span className="text-[8px] opacity-80">{v.tecla}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="text-[10px] text-slate-400 mt-2 text-center">
        Clic origen → D opcional para desvíos → clic destino → 1 (Error), 2 (Neutro), 3 (Punto). Esc cancela.
      </p>

      {ataquesDelPunto.length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-200">
          <p className="text-[10px] text-slate-500 mb-1">
            Ataques del punto ({ataquesDelPunto.length}):
          </p>
          <div className="flex flex-wrap gap-1">
            {ataquesDelPunto.map((a, i) => (
              <div
                key={i}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px]"
                style={{ borderColor: COLORES[a.valoracion as Valoracion], color: COLORES[a.valoracion as Valoracion] }}
              >
                <span className="font-semibold">{a.valoracion.toUpperCase()}</span>
                <span className="text-slate-500">
                  {a.origen_celda}
                  {a.origen_mini ? `-${a.origen_mini}` : ""} → {a.destino_celda}
                  {a.destino_mini ? `-${a.destino_mini}` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}