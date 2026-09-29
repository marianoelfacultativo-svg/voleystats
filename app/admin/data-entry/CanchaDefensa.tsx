"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { celdasDeContexto, keyPunto, minisDeCelda, type Celda } from "@/lib/cancha";
import type { DefensaRow } from "@/lib/db";

type Rol = "L" | "A" | "O" | "Pd" | "Pz" | "C";
type TipoAccion = "defensa" | "toque" | "cobertura";
type Resultado = "salvada" | "error";
type Paso = "parado" | "tipo" | "accion" | "resultado";

const ROLES: { id: Rol; label: string; tecla: string }[] = [
  { id: "L", label: "Líbero", tecla: "L" },
  { id: "A", label: "Armador", tecla: "A" },
  { id: "O", label: "Opuesto", tecla: "O" },
  { id: "C", label: "Central", tecla: "C" },
  { id: "Pz", label: "Punta zaguero", tecla: "Z" },
  { id: "Pd", label: "Punta delantero", tecla: "D" },
];

const TIPOS: { id: TipoAccion; label: string; color: string; tecla: string }[] = [
  { id: "defensa", label: "Defensa", color: "#3b82f6", tecla: "D" },
  { id: "toque", label: "Toque", color: "#f59e0b", tecla: "T" },
  { id: "cobertura", label: "Cobertura", color: "#8b5cf6", tecla: "C" },
];

const RESULTADOS: { id: Resultado; label: string; color: string; tecla: string }[] = [
  { id: "error", label: "Pique / Error", color: "#dc2626", tecla: "1" },
  { id: "salvada", label: "Salvada", color: "#16a34a", tecla: "2" },
];

const COLOR_TIPO: Record<TipoAccion, string> = TIPOS.reduce(
  (acc, t) => ({ ...acc, [t.id]: t.color }),
  {} as Record<TipoAccion, string>
);

interface Punto {
  celda: string;
  mini: string | null;
}

interface Props {
  defensasDelPunto: DefensaRow[];
  onAgregar: (
    d: Omit<DefensaRow, "id" | "partido_id" | "jugador_id" | "set_numero" | "punto_numero">
  ) => void;
  onBorrarUltimo: () => void;
  onLimpiarPunto: () => void;
}

export default function CanchaDefensa({
  defensasDelPunto,
  onAgregar,
  onBorrarUltimo,
  onLimpiarPunto,
}: Props) {
  const [rolActivo, setRolActivo] = useState<Rol>("L");
  const [paso, setPaso] = useState<Paso>("parado");
  const [puntoParado, setPuntoParado] = useState<Punto | null>(null);
  const [tipoAccion, setTipoAccion] = useState<TipoAccion | null>(null);
  const [puntoAccion, setPuntoAccion] = useState<Punto | null>(null);

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
    if (paso === "parado") {
      setPuntoParado(p);
      setPaso("tipo");
      return;
    }
    if (paso === "accion") {
      setPuntoAccion(p);
      setPaso("resultado");
      return;
    }
  };

  const elegirTipo = (t: TipoAccion) => {
    setTipoAccion(t);
    setPaso("accion");
  };

  const elegirResultado = (r: Resultado) => {
    if (!puntoParado || !puntoAccion || !tipoAccion) return;
    onAgregar({
      celda: puntoParado.celda,
      mini: puntoParado.mini,
      rol: rolActivo,
      tipo: "parado",
      celda_accion: puntoAccion.celda,
      mini_accion: puntoAccion.mini,
      tipo_accion: tipoAccion,
      resultado: r,
    });
    reset();
  };

  const reset = () => {
    setPaso("parado");
    setPuntoParado(null);
    setTipoAccion(null);
    setPuntoAccion(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT") return;
      const k = e.key.toUpperCase();

      if (e.key === "Escape") {
        reset();
        return;
      }

      if (paso === "parado") {
        const r = ROLES.find((x) => x.tecla === k);
        if (r) setRolActivo(r.id);
      } else if (paso === "tipo") {
        const tp = TIPOS.find((x) => x.tecla === k);
        if (tp) elegirTipo(tp.id);
      } else if (paso === "resultado") {
        const res = RESULTADOS.find((x) => x.tecla === k);
        if (res) elegirResultado(res.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paso, puntoParado, puntoAccion, tipoAccion, rolActivo]);

  const celdas = useMemo(() => celdasDeContexto("defensa"), []);

  const esColumnaMedia = (celda: string) => {
    const col = celda.split("-")[1];
    return col === "C2" || col === "C3" || col === "C4";
  };

  const renderCelda = (celda: Celda, tipo: "mini33" | "mini32" | "single") => {
    const minis = tipo === "single" ? [] : minisDeCelda(celda, "defensa");
    const esMedia = esColumnaMedia(celda);
    const bgBase = esMedia ? "bg-blue-100 border-blue-500" : "bg-blue-50 border-blue-300";
    const bgMini = esMedia ? "bg-blue-300 hover:bg-blue-400" : "bg-blue-200 hover:bg-blue-300";

    if (tipo === "single") {
      return (
        <div
          key={celda}
          ref={(el) => registrar(celda, el)}
          onClick={() => clickPunto({ celda, mini: null })}
          className={`rounded-md cursor-pointer border-2 min-h-[60px] ${bgBase} hover:brightness-95`}
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
              className={`min-h-[18px] rounded-sm cursor-pointer ${bgMini}`}
            />
          );
        })}
      </div>
    );
  };

  const guardadas = useMemo(() => {
    return defensasDelPunto
      .map((d) => {
        const kParado = keyPunto(d.celda, d.mini);
        const kAccion = d.celda_accion
          ? keyPunto(d.celda_accion, d.mini_accion)
          : null;
        return {
          d,
          kParado,
          kAccion,
          colorTipo: d.tipo_accion ? COLOR_TIPO[d.tipo_accion] : "#64748b",
        };
      })
      .filter((x) => !!x);
  }, [defensasDelPunto]);

  const puntoParadoPos = puntoParado ? posicion(keyPunto(puntoParado.celda, puntoParado.mini)) : null;
  const puntoAccionPos = puntoAccion ? posicion(keyPunto(puntoAccion.celda, puntoAccion.mini)) : null;

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-2 text-[10px] flex-wrap gap-1">
        <div className="flex items-center gap-1">
          <span className={`px-1.5 py-0.5 rounded font-semibold ${paso === "parado" ? "bg-slate-700 text-white" : "bg-slate-200"}`}>
            1. Posición
          </span>
          <span className={`px-1.5 py-0.5 rounded font-semibold ${paso === "tipo" ? "bg-blue-500 text-white" : "bg-slate-200"}`}>
            2. D / T / C
          </span>
          <span className={`px-1.5 py-0.5 rounded font-semibold ${paso === "accion" ? "bg-slate-700 text-white" : "bg-slate-200"}`}>
            3. Acción
          </span>
          <span className={`px-1.5 py-0.5 rounded font-semibold ${paso === "resultado" ? "bg-emerald-600 text-white" : "bg-slate-200"}`}>
            4. 1/2
          </span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={onLimpiarPunto}
            className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 rounded"
            title="Limpiar todo el punto"
          >
            🧹
          </button>
          <button
            onClick={onBorrarUltimo}
            disabled={defensasDelPunto.length === 0}
            className="px-2 py-0.5 bg-red-100 hover:bg-red-200 text-red-700 rounded disabled:opacity-40"
          >
            🗑
          </button>
        </div>
      </div>

      <div className="mb-2 p-1.5 bg-slate-50 border border-slate-200 rounded-md">
        <p className="text-[9px] font-semibold text-slate-500 uppercase mb-1">
          Rol activo (teclas L, A, O, C, Z, D):
        </p>
        <div className="flex flex-wrap gap-1">
          {ROLES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRolActivo(r.id)}
              className={`px-2 py-0.5 text-[10px] font-semibold rounded border transition ${
                rolActivo === r.id
                  ? "bg-slate-800 text-white border-slate-800"
                  : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span className="font-bold">{r.id}</span>
              <span className="text-[8px] opacity-60 ml-1">{r.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div ref={containerRef} className="relative select-none">
        <div className="grid grid-cols-5 gap-0.5">
          {celdas.map(({ celda, tipo }) => renderCelda(celda, tipo))}
        </div>

        <svg className="absolute inset-0 pointer-events-none" style={{ width: "100%", height: "100%" }}>
          {guardadas.map((g, i) => {
            const pPos = posicion(g.kParado);
            if (!pPos) return null;
            const aPos = g.kAccion ? posicion(g.kAccion) : null;
            const color = g.colorTipo;
            const esSalvada = g.d.resultado === "salvada";

            return (
              <g key={i}>
                {aPos && (aPos.x !== pPos.x || aPos.y !== pPos.y) && (
                  <line
                    x1={pPos.x}
                    y1={pPos.y}
                    x2={aPos.x}
                    y2={aPos.y}
                    stroke={color}
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    opacity={0.7}
                  />
                )}

                <polygon
                  points={estrella(pPos.x, pPos.y - 4, 6, 3.5)}
                  fill={color}
                  stroke="white"
                  strokeWidth={1}
                />
                <text
                  x={pPos.x}
                  y={pPos.y - 1.5}
                  textAnchor="middle"
                  fontSize={5}
                  fontWeight="bold"
                  fill="white"
                >
                  {g.d.rol}
                </text>

                {aPos && (
                  <>
                    {esSalvada ? (
                      <circle
                        cx={aPos.x}
                        cy={aPos.y + 4}
                        r={4.5}
                        fill="#16a34a"
                        stroke="white"
                        strokeWidth={1.2}
                      />
                    ) : (
                      <g transform={`translate(${aPos.x}, ${aPos.y + 4})`}>
                        <line x1={-3.5} y1={-3.5} x2={3.5} y2={3.5} stroke="#dc2626" strokeWidth={2.2} strokeLinecap="round" />
                        <line x1={3.5} y1={-3.5} x2={-3.5} y2={3.5} stroke="#dc2626" strokeWidth={2.2} strokeLinecap="round" />
                      </g>
                    )}
                  </>
                )}
              </g>
            );
          })}

          {puntoParadoPos && paso !== "parado" && (
            <polygon
              points={estrella(puntoParadoPos.x, puntoParadoPos.y - 4, 6, 3.5)}
              fill={tipoAccion ? COLOR_TIPO[tipoAccion] : "#10b981"}
              stroke="white"
              strokeWidth={1}
            />
          )}

          {puntoAccionPos && paso === "resultado" && (
            <circle
              cx={puntoAccionPos.x}
              cy={puntoAccionPos.y + 4}
              r={4.5}
              fill="#10b981"
              stroke="white"
              strokeWidth={1.2}
            />
          )}
        </svg>

        {paso === "tipo" && puntoParadoPos && (
          <div
            className="absolute z-50 bg-white border-2 border-blue-400 rounded-lg shadow-lg p-2 w-[240px]"
            style={{
              left: puntoParadoPos.x,
              top: puntoParadoPos.y,
              transform: "translate(-50%, calc(-100% - 8px))",
            }}
          >
            <p className="text-[10px] font-bold text-slate-600 uppercase mb-1 text-center">
              Tipo de acción
            </p>
            <div className="grid grid-cols-3 gap-1">
              {TIPOS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => elegirTipo(t.id)}
                  className="py-1.5 rounded text-white text-[10px] font-semibold flex flex-col items-center"
                  style={{ backgroundColor: t.color }}
                >
                  <span>{t.label}</span>
                  <span className="text-[8px] opacity-80">({t.tecla})</span>
                </button>
              ))}
            </div>
            <button
              onClick={reset}
              className="w-full mt-1 py-0.5 text-[9px] text-slate-400 hover:text-slate-600"
            >
              Cancelar (Esc)
            </button>
          </div>
        )}

        {paso === "resultado" && puntoAccionPos && (
          <div
            className="absolute z-50 bg-white border-2 border-emerald-400 rounded-lg shadow-lg p-2 w-[220px]"
            style={{
              left: puntoAccionPos.x,
              top: puntoAccionPos.y,
              transform: "translate(-50%, calc(-100% - 8px))",
            }}
          >
            <p className="text-[10px] font-bold text-emerald-700 uppercase mb-1 text-center">
              ¿Resultado?
            </p>
            <div className="grid grid-cols-2 gap-1">
              {RESULTADOS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => elegirResultado(r.id)}
                  className="py-1.5 rounded text-white text-[10px] font-semibold flex flex-col items-center"
                  style={{ backgroundColor: r.color }}
                >
                  <span>{r.label}</span>
                  <span className="text-[8px] opacity-80">({r.tecla})</span>
                </button>
              ))}
            </div>
            <button
              onClick={reset}
              className="w-full mt-1 py-0.5 text-[9px] text-slate-400 hover:text-slate-600"
            >
              Cancelar (Esc)
            </button>
          </div>
        )}
      </div>

      <p className="text-[10px] text-slate-400 mt-2 text-center">
        Rol → clic posición → D/T/C → clic acción → 1 (error) o 2 (salvada). Esc cancela.
      </p>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#3b82f6" }} />
          Defensa
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#f59e0b" }} />
          Toque
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#8b5cf6" }} />
          Cobertura
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-green-600" />
          Salvada
        </span>
        <span className="flex items-center gap-1 text-red-600 font-bold">✗ Error</span>
      </div>

      {defensasDelPunto.length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-200">
          <p className="text-[10px] text-slate-500 mb-1">
            Acciones ({defensasDelPunto.length}):
          </p>
          <div className="flex flex-wrap gap-1">
            {defensasDelPunto.map((d, i) => (
              <div
                key={i}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px]"
                style={{
                  borderColor: d.tipo_accion ? COLOR_TIPO[d.tipo_accion] : "#64748b",
                  color: d.tipo_accion ? COLOR_TIPO[d.tipo_accion] : "#64748b",
                }}
              >
                <span className="font-semibold">
                  {d.rol}·{d.tipo_accion?.[0].toUpperCase()}
                </span>
                <span className="text-slate-500">
                  {d.celda}
                  {d.mini ? `-${d.mini}` : ""}
                  {d.celda_accion && ` → ${d.celda_accion}`}
                </span>
                <span
                  className="font-bold"
                  style={{ color: d.resultado === "salvada" ? "#16a34a" : "#dc2626" }}
                >
                  {d.resultado === "salvada" ? "✓" : "✗"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function estrella(cx: number, cy: number, rExt: number, rInt: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? rExt : rInt;
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${cx + r * Math.cos(ang)},${cy + r * Math.sin(ang)}`);
  }
  return pts.join(" ");
}
