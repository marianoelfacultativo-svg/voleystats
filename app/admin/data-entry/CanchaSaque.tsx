"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  celdasDeContexto,
  keyPunto,
  minisDeCelda,
  SAQUE_DESTINO,
  SAQUE_ORIGEN,
  type Celda,
} from "@/lib/cancha";
import type { SaqueRow } from "@/lib/db";

type Valoracion = "ace" | "positivo_mas" | "positivo" | "neutro" | "negativo";
type Tipo = "flotado" | "potencia";

const VALORACIONES: { id: Valoracion; label: string; color: string; tecla: number }[] = [
  { id: "negativo", label: "Negativo", color: "#dc2626", tecla: 1 },
  { id: "neutro", label: "Neutro", color: "#64748b", tecla: 2 },
  { id: "positivo", label: "Positivo", color: "#84cc16", tecla: 3 },
  { id: "positivo_mas", label: "Positivo +", color: "#65a30d", tecla: 4 },
  { id: "ace", label: "Ace", color: "#16a34a", tecla: 5 },
];

const COLOR_VAL: Record<Valoracion, string> = VALORACIONES.reduce(
  (acc, v) => ({ ...acc, [v.id]: v.color }),
  {} as Record<Valoracion, string>
);

interface Punto {
  celda: string;
  mini: string | null;
}

type Fase = "origen" | "destino" | "valoracion";

interface Props {
  saquesDelPunto: SaqueRow[];
  onAgregar: (
    s: Omit<
      SaqueRow,
      "id" | "partido_id" | "jugador_id" | "set_numero" | "punto_numero"
    >
  ) => void;
  onBorrarUltimo: () => void;
}

export default function CanchaSaque({
  saquesDelPunto,
  onAgregar,
  onBorrarUltimo,
}: Props) {
  const [fase, setFase] = useState<Fase>("origen");
  const [tipo, setTipo] = useState<Tipo>("flotado");
  const [origen, setOrigen] = useState<Punto | null>(null);
  const [destino, setDestino] = useState<Punto | null>(null);
  const [preview, setPreview] = useState<{ x: number; y: number } | null>(null);
  const [tick, setTick] = useState(0);

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

  useLayoutEffect(() => {
    setTick((t) => t + 1);
  }, [saquesDelPunto.length]);

  useLayoutEffect(() => {
    const t = setTimeout(() => setTick((x) => x + 1), 0);
    const t2 = setTimeout(() => setTick((x) => x + 1), 150);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
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

  const elegir = (v: Valoracion) => {
    if (!origen || !destino) return;
    onAgregar({
      origen_celda: origen.celda,
      destino_celda: destino.celda,
      destino_mini: destino.mini,
      tipo,
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
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT") return;
      if (e.key === "Escape") reset();
      if (fase === "valoracion") {
        const n = parseInt(e.key);
        const item = VALORACIONES.find((v) => v.tecla === n);
        if (item) elegir(item.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fase, origen, destino, tipo]);

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

  const celdasRival = useMemo(() => {
    const all = celdasDeContexto("ataque");
    const f4 = all.slice(15, 20);
    const f5 = all.slice(20, 25);
    const f6 = all.slice(25, 30);
    return [...f6, ...f5, ...f4];
  }, []);

  const esColumnaMedia = (celda: string) => {
    const col = celda.split("-")[1];
    return col === "C2" || col === "C3" || col === "C4";
  };

  const lineasGuardadas = useMemo(() => {
    return saquesDelPunto
      .map((s) => {
        const o = posicion(s.origen_celda);
        const d = posicion(keyPunto(s.destino_celda, s.destino_mini));
        if (!o || !d) return null;
        return {
          o,
          d,
          color: COLOR_VAL[s.valoracion as Valoracion] ?? "#64748b",
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [saquesDelPunto, posicion, tick]);

  const origenPos = origen ? posicion(origen.celda) : null;
  const destinoPos = destino ? posicion(keyPunto(destino.celda, destino.mini)) : null;

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-2 text-[10px] flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          <span className={`px-1.5 py-0.5 rounded ${fase === "origen" ? "bg-emerald-500 text-white" : "bg-slate-200"}`}>
            1. Origen
          </span>
          <span className={`px-1.5 py-0.5 rounded ${fase === "destino" ? "bg-emerald-500 text-white" : "bg-slate-200"}`}>
            2. Destino
          </span>
          <span className={`px-1.5 py-0.5 rounded ${fase === "valoracion" ? "bg-emerald-500 text-white" : "bg-slate-200"}`}>
            3. Valoración
          </span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setTipo("flotado")}
            className={`px-2 py-0.5 rounded text-[10px] font-medium ${
              tipo === "flotado" ? "bg-blue-500 text-white" : "bg-slate-200 hover:bg-slate-300"
            }`}
          >
            Flotado
          </button>
          <button
            onClick={() => setTipo("potencia")}
            className={`px-2 py-0.5 rounded text-[10px] font-medium ${
              tipo === "potencia" ? "bg-orange-500 text-white" : "bg-slate-200 hover:bg-slate-300"
            }`}
          >
            Potencia
          </button>
          <button
            onClick={reset}
            disabled={fase === "origen"}
            className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 rounded disabled:opacity-40"
          >
            Esc
          </button>
          <button
            onClick={onBorrarUltimo}
            disabled={saquesDelPunto.length === 0}
            className="px-2 py-0.5 bg-red-100 hover:bg-red-200 text-red-700 rounded disabled:opacity-40"
          >
            🗑
          </button>
        </div>
      </div>

      <div ref={containerRef} className="relative select-none">
        <div>
          <p className="text-[9px] font-bold text-orange-700 mb-0.5 text-center tracking-wide">
            ▼ CANCHA RIVAL ▼
          </p>
          <div className="grid grid-cols-5 gap-0.5">
            {celdasRival.map(({ celda, tipo: tipoCelda }) => {
              const minis = tipoCelda === "single" ? [] : minisDeCelda(celda, "ataque");
              const cols = tipoCelda === "mini32" ? 2 : 3;
              const esMedia = esColumnaMedia(celda);
              const bgBase = esMedia ? "bg-orange-100 border-orange-400" : "bg-orange-50 border-orange-300";
              const bgMini = esMedia ? "bg-orange-300 hover:bg-orange-400" : "bg-orange-200 hover:bg-orange-300";

              if (tipoCelda === "single") {
                return (
                  <div
                    key={celda}
                    ref={(el) => registrar(celda, el)}
                    onClick={() => clickPunto({ celda, mini: null })}
                    className={`rounded-md cursor-pointer border-2 min-h-[36px] ${bgBase} hover:brightness-95`}
                  />
                );
              }

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
            })}
          </div>
        </div>

        <div className="my-1">
          <p className="text-[9px] text-slate-400 mb-0.5 text-center">
            Red (destino)
          </p>
          <div className="grid grid-cols-9 gap-0.5">
            {SAQUE_DESTINO.map((d) => (
              <div
                key={d}
                ref={(el) => registrar(d, el)}
                onClick={() => clickPunto({ celda: d, mini: null })}
                className="aspect-[2/1] bg-slate-700 hover:bg-slate-600 rounded cursor-pointer flex items-center justify-center text-[8px] text-white font-bold"
              >
                {d}
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[9px] text-slate-400 mb-0.5 text-center">
            Origen
          </p>
          <div className="grid grid-cols-9 gap-0.5">
            {SAQUE_ORIGEN.map((s) => (
              <div
                key={s}
                ref={(el) => registrar(s, el)}
                onClick={() => clickPunto({ celda: s, mini: null })}
                className="aspect-square bg-emerald-200 hover:bg-emerald-300 rounded cursor-pointer border border-emerald-400 flex items-center justify-center text-[8px] text-emerald-800 font-bold"
              >
                {s}
              </div>
            ))}
          </div>
        </div>

        <svg className="absolute inset-0 pointer-events-none" style={{ width: "100%", height: "100%" }}>
          {lineasGuardadas.map((l, i) => (
            <g key={`${i}-${tick}`}>
              <line x1={l.o.x} y1={l.o.y} x2={l.d.x} y2={l.d.y} stroke={l.color} strokeWidth={2} strokeLinecap="round" opacity={0.85} />
              <circle cx={l.o.x} cy={l.o.y} r={3.5} fill={l.color} stroke="white" strokeWidth={1} />
              <circle cx={l.d.x} cy={l.d.y} r={5} fill={l.color} stroke="white" strokeWidth={1.5} />
            </g>
          ))}
          {origenPos && (
            <>
              {destinoPos && (
                <line x1={origenPos.x} y1={origenPos.y} x2={destinoPos.x} y2={destinoPos.y} stroke="#10b981" strokeWidth={2} />
              )}
              {!destinoPos && preview && (
                <line x1={origenPos.x} y1={origenPos.y} x2={preview.x} y2={preview.y} stroke="#10b981" strokeWidth={1.5} strokeDasharray="5 3" opacity={0.7} />
              )}
              <circle cx={origenPos.x} cy={origenPos.y} r={4} fill="#10b981" stroke="white" strokeWidth={1.5} />
            </>
          )}
        </svg>

        {fase === "valoracion" && destinoPos && (
          <div
            data-popup
            className="absolute z-50 bg-white border-2 border-slate-300 rounded-lg shadow-lg p-1.5 flex gap-1 flex-wrap max-w-[260px]"
            style={{
              left: destinoPos.x,
              top: destinoPos.y,
              transform: "translate(-50%, calc(-100% - 8px))",
            }}
          >
            {VALORACIONES.map((v) => (
              <button
                key={v.id}
                onClick={() => elegir(v.id)}
                className="px-1.5 py-1 rounded text-white text-[9px] font-semibold flex flex-col items-center"
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
        Teclas: 1 (Neg), 2 (Neu), 3 (Pos), 4 (Pos+), 5 (Ace). Esc cancela.
      </p>

      {saquesDelPunto.length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-200">
          <p className="text-[10px] text-slate-500 mb-1">
            Saques del punto ({saquesDelPunto.length}):
          </p>
          <div className="flex flex-wrap gap-1">
            {saquesDelPunto.map((s, i) => (
              <div
                key={i}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px]"
                style={{ borderColor: COLOR_VAL[s.valoracion as Valoracion], color: COLOR_VAL[s.valoracion as Valoracion] }}
              >
                <span className="font-semibold">{s.valoracion}</span>
                <span className="text-slate-500">
                  {s.origen_celda} → {s.destino_celda}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}