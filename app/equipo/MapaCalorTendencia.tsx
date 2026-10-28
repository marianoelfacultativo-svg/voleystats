"use client";

import { useMemo, useState } from "react";
import type { DistribucionTendencia } from "@/lib/estadisticas";
import type { AccionDB } from "@/lib/db";

// ============================================================
// MAPA DE CALOR DE TENDENCIA (armado)
// Recibe acciones crudas + jugadorId para poder filtrar.
// Si no vienen, usa `distribucion` legacy sin filtros.
// ============================================================

interface Props {
  distribucion?: DistribucionTendencia;
  acciones?: AccionDB[];
  jugadorId?: string;
}

type Nivel = "todas" | "pos" | "neu" | "neg";

interface Celda {
  key: keyof DistribucionTendencia;
  label: string;
}

const CELDAS: Celda[] = [
  { key: "zona_4", label: "4" },
  { key: "zona_3", label: "3" },
  { key: "zona_2", label: "2" },
  { key: "toque", label: "T" },
  { key: "zona_6", label: "6" },
  { key: "zona_1", label: "1" },
];

// ------------------------------------------------------------
// Helpers de cálculo
// ------------------------------------------------------------

function zonaTendencia(celda: string | null | undefined): number | null {
  if (!celda) return null;
  switch (celda) {
    case "F1-C1":
    case "F1-C2":
      return 4;
    case "F1-C3":
      return 3;
    case "F1-C4":
    case "F1-C5":
      return 2;
    case "F2-C3":
    case "F3-C3":
      return 6;
    case "F2-C4":
    case "F2-C5":
    case "F3-C4":
    case "F3-C5":
      return 2;
    default:
      return null;
  }
}

function zonaOrigenDeCelda(celda: string | null | undefined): number | null {
  if (!celda) return null;
  const partes = celda.split("-");
  if (partes.length !== 2) return null;
  const [fila, col] = partes;
  const f = parseInt(fila.slice(1));
  if (f < 1 || f > 3) return null;
  if (col === "C1" || col === "C2") return f === 1 ? 4 : 5;
  if (col === "C3") return f === 1 ? 3 : 6;
  if (col === "C4" || col === "C5") return f === 1 ? 2 : 1;
  return null;
}

function nivelArmado(valoracion: string): "pos" | "neu" | "neg" {
  if (valoracion === "correcto" || valoracion === "perfecto" || valoracion === "genial")
    return "pos";
  if (valoracion === "malo" || valoracion === "horrible") return "neg";
  return "neu";
}

function nivelToque(valoracion: string): "pos" | "neu" | "neg" {
  if (valoracion === "punto") return "pos";
  if (valoracion === "error") return "neg";
  return "neu";
}

function calcularColor(pct: number) {
  if (pct <= 0) return { r: 30, g: 41, b: 59 };
  if (pct < 20) {
    const t = pct / 20;
    return {
      r: Math.round(30 + t * (14 - 30)),
      g: Math.round(58 + t * (165 - 58)),
      b: Math.round(138 + t * (233 - 138)),
    };
  }
  if (pct < 40) {
    const t = (pct - 20) / 20;
    return {
      r: Math.round(14 + t * (245 - 14)),
      g: Math.round(165 + t * (158 - 165)),
      b: Math.round(233 + t * (11 - 233)),
    };
  }
  if (pct < 65) {
    const t = (pct - 40) / 25;
    return {
      r: Math.round(245 + t * (239 - 245)),
      g: Math.round(158 - t * (158 - 68)),
      b: Math.round(11 + t * (68 - 11)),
    };
  }
  const t = Math.min(1, (pct - 65) / 35);
  return {
    r: Math.round(239 + t * 16),
    g: Math.round(68 - t * 40),
    b: Math.round(68 - t * 40),
  };
}

// ============================================================
// COMPONENTE
// ============================================================

export default function MapaCalorTendencia({
  distribucion,
  acciones,
  jugadorId,
}: Props) {
  const [nivel, setNivel] = useState<Nivel>("todas");
  const [velocidad, setVelocidad] = useState<string>("todas");
  const [zonaOrigen, setZonaOrigen] = useState<string>("todas");
  const [valoracion, setValoracion] = useState<string>("todas");

  const modoFiltrable = !!acciones && !!jugadorId;

  const distFiltrada: DistribucionTendencia = useMemo(() => {
    if (!modoFiltrable) {
      return (
        distribucion ?? {
          zona_4: 0,
          zona_3: 0,
          zona_2: 0,
          zona_6: 0,
          zona_1: 0,
          toque: 0,
          total: 0,
        }
      );
    }

    const acc = acciones!.filter((a) => a.jugador_id === jugadorId);
    const d: DistribucionTendencia = {
      zona_4: 0,
      zona_3: 0,
      zona_2: 0,
      zona_6: 0,
      zona_1: 0,
      toque: 0,
      total: 0,
    };

    const filtrosNoToque =
      velocidad !== "todas" ||
      zonaOrigen !== "todas" ||
      valoracion !== "todas";

    for (const a of acc) {
      // ---- ARMADOS ----
      if (a.fundamento === "armados") {
        if (nivel !== "todas" && nivelArmado(a.valoracion) !== nivel) continue;
        if (velocidad !== "todas") {
          if (velocidad === "sin") {
            if (a.velocidad !== null && a.velocidad !== undefined) continue;
          } else if (a.velocidad !== Number(velocidad)) continue;
        }
        if (zonaOrigen !== "todas") {
          if (zonaOrigenDeCelda(a.origen_celda) !== Number(zonaOrigen)) continue;
        }
        if (valoracion !== "todas" && a.valoracion !== valoracion) continue;

        const z = zonaTendencia(a.destino_celda);
        if (z === 4) d.zona_4 += a.cantidad;
        else if (z === 3) d.zona_3 += a.cantidad;
        else if (z === 2) d.zona_2 += a.cantidad;
        else if (z === 6) d.zona_6 += a.cantidad;
        else if (z === 1) d.zona_1 += a.cantidad;
        continue;
      }

      // ---- TOQUES (remate de segunda del armador) ----
      if (a.fundamento === "toque") {
        if (filtrosNoToque) continue;
        if (nivel !== "todas" && nivelToque(a.valoracion) !== nivel) continue;
        d.toque += a.cantidad;
      }
    }

    d.total =
      d.zona_4 + d.zona_3 + d.zona_2 + d.zona_6 + d.zona_1 + d.toque;
    return d;
  }, [
    modoFiltrable,
    distribucion,
    acciones,
    jugadorId,
    nivel,
    velocidad,
    zonaOrigen,
    valoracion,
  ]);

  const total = distFiltrada.total;

  const pcts = CELDAS.map((c) => {
    const valor = distFiltrada[c.key] as number;
    return total > 0 ? (valor / total) * 100 : 0;
  });
  const maxPct = Math.max(...pcts, 1);

  const tamañoMax = 68;
  const tamañoMin = 22;

  return (
    <div className="space-y-3">
      <h4 className="font-semibold text-white">
        Distribución de tendencia
      </h4>

      {/* Filtros (solo si hay acciones) */}
      {modoFiltrable && (
        <div className="space-y-2 card border border-white/10 rounded-xl p-3">
          {/* Nivel */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[9px] font-semibold text-slate-400 uppercase mr-1">
              Nivel:
            </span>
            {(["todas", "pos", "neu", "neg"] as Nivel[]).map((n) => {
              const labels: Record<Nivel, string> = {
                todas: "Todas",
                pos: "Positivas",
                neu: "Neutras",
                neg: "Negativas",
              };
              const colores: Record<Nivel, string> = {
                todas: "bg-[var(--sx-surface-2)] text-[var(--sx-text-secondary)] border-[var(--sx-border-bright)]",
                pos: "bg-[rgba(16,185,129,0.15)] text-[#6ee7b7] border-[rgba(16,185,129,0.3)]",
                neu: "bg-[var(--sx-surface-2)] text-[var(--sx-text-secondary)] border-[var(--sx-border-bright)]",
                neg: "bg-[rgba(229,62,77,0.15)] text-[#fca5a5] border-[rgba(229,62,77,0.3)]",
              };
              const activo = nivel === n;
              return (
                <button
                  key={n}
                  onClick={() => setNivel(n)}
                  className={`px-1.5 py-0.5 text-[10px] font-semibold rounded border-2 transition ${
                    activo
                      ? "bg-[var(--sx-blue-bright)] text-white border-[var(--sx-blue-bright)] shadow-[0_2px_8px_rgba(37,99,235,0.45)]"
                      : `${colores[n]} hover:brightness-110`
                  }`}
                >
                  {labels[n]}
                </button>
              );
            })}
          </div>

          {/* Velocidad / Zona / Valoración */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[9px] font-semibold text-slate-400 uppercase mb-0.5">
                Velocidad
              </label>
              <select
                value={velocidad}
                onChange={(e) => setVelocidad(e.target.value)}
                className="w-full px-1.5 py-1 text-[10px] border border-white/15 rounded-lg bg-[var(--sx-surface-2)] text-white focus:outline-none focus:border-blue-500"
              >
                <option value="todas">Todas</option>
                <option value="1">1</option>
                <option value="1.5">1.5</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="5">5</option>
                <option value="sin">Sin dato</option>
              </select>
            </div>

            <div>
              <label className="block text-[9px] font-semibold text-slate-400 uppercase mb-0.5">
                Zona origen
              </label>
              <select
                value={zonaOrigen}
                onChange={(e) => setZonaOrigen(e.target.value)}
                className="w-full px-1.5 py-1 text-[10px] border border-white/15 rounded-lg bg-[var(--sx-surface-2)] text-white focus:outline-none focus:border-blue-500"
              >
                <option value="todas">Todas</option>
                {[1, 2, 3, 4, 5, 6].map((z) => (
                  <option key={z} value={String(z)}>
                    Zona {z}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[9px] font-semibold text-slate-400 uppercase mb-0.5">
                Valoración
              </label>
              <select
                value={valoracion}
                onChange={(e) => setValoracion(e.target.value)}
                className="w-full px-1.5 py-1 text-[10px] border border-white/15 rounded-lg bg-[var(--sx-surface-2)] text-white focus:outline-none focus:border-blue-500"
              >
                <option value="todas">Todas</option>
                <option value="horrible">Horrible</option>
                <option value="malo">Malo</option>
                <option value="flojo">Flojo</option>
                <option value="correcto">Correcto</option>
                <option value="perfecto">Perfecto</option>
                <option value="genial">Genial</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {total === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">
          No hay tendencias con los filtros actuales
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            {CELDAS.map((c) => {
              const valor = distFiltrada[c.key] as number;
              const pct = (valor / total) * 100;
              const tamaño =
                valor === 0
                  ? tamañoMin
                  : tamañoMin + (pct / maxPct) * (tamañoMax - tamañoMin);
              const color = calcularColor(pct);
              const rgb = `rgb(${color.r}, ${color.g}, ${color.b})`;
              const esToque = c.key === "toque";

              return (
                <div
                  key={String(c.key)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                    esToque
                      ? "bg-pink-950/20 border-pink-500/30"
                      : "card border-white/10"
                  }`}
                >
                  <div
                    className="flex items-center justify-center rounded-full transition-all shadow-md"
                    style={{
                      width: `${tamaño}px`,
                      height: `${tamaño}px`,
                      backgroundColor: rgb,
                      border: "2px solid rgba(255,255,255,0.18)",
                    }}
                  >
                    <span
                      className="font-bold text-white"
                      style={{ fontSize: `${Math.max(10, tamaño / 4.8)}px` }}
                    >
                      {c.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-2 font-medium">
                    {valor} · {pct.toFixed(0)}%
                  </p>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-400 mt-3 text-center">
            Tamaño y color según % de uso. Azul = poco usado, rojo = muy usado.
            "T" = toques.
          </p>
        </>
      )}
    </div>
  );
}