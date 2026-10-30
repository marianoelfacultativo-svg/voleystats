"use client";

// ============================================================
// PERFIL JUGADOR SECTION (A6) — Análisis de consecuencias
// ============================================================
// "Cómo suele jugar un jugador" — análisis automático por rol.
//
// Roles soportados:
//   - Armador: distribución de llamadas inferidas + filtro por
//     calidad de pelota previa (positiva / negativa).
//   - Atacante / central: distribución por dirección inferida +
//     ratio remate/toque.
//   - Líbero: distribución de subtipos de defensa + con/sin
//     desplazamiento + coberturas.
// ============================================================

import { useMemo, useState } from "react";
import {
  etiquetaDireccionAtaque,
  etiquetaLlamadaInferida,
  inferirDireccionAtaque,
  inferirLlamadaArmado,
} from "@/lib/analisisConsecuencias";
import type { AccionVisual } from "../adaptadorUnificadoV2";
import { selectCls } from "./helpers";

// ============================================================
// TIPOS
// ============================================================

type RolPerfil = "armador" | "atacante" | "central" | "libero" | "otro";

// ============================================================
// HELPERS
// ============================================================

function inferirRolPerfil(
  jugadorId: string,
  acciones: AccionVisual[]
): RolPerfil {
  const conteo: Record<string, number> = {};
  for (const a of acciones) {
    if (a.jugador_id !== jugadorId) continue;
    if (!a.rol_jugador) continue;
    conteo[a.rol_jugador] = (conteo[a.rol_jugador] ?? 0) + 1;
  }
  let mejor = "";
  let max = 0;
  for (const [rol, count] of Object.entries(conteo)) {
    if (count > max) {
      max = count;
      mejor = rol;
    }
  }
  if (mejor === "A") return "armador";
  if (mejor === "C1" || mejor === "C2") return "central";
  if (mejor === "P1" || mejor === "P2" || mejor === "O") return "atacante";
  if (mejor === "L") return "libero";
  return "otro";
}

// ============================================================
// SECCIÓN PRINCIPAL
// ============================================================

interface Props {
  acciones: AccionVisual[];
  nombre: (id: string | null) => string;
  jugadoresParaDropdown: { id: string; nombre: string }[];
  jugadorIdInicial?: string;
}

export default function PerfilJugadorSection({
  acciones,
  nombre,
  jugadoresParaDropdown,
  jugadorIdInicial,
}: Props) {
  const [jugadorId, setJugadorId] = useState<string | null>(
    jugadorIdInicial ?? null
  );
  const [conPelota, setConPelota] = useState<"todas" | "positiva" | "negativa">(
    "todas"
  );

  const rol = jugadorId ? inferirRolPerfil(jugadorId, acciones) : "otro";

  return (
    <div className="mt-2 p-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.03] space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[9px] font-bold uppercase text-amber-300/80 mb-0.5">
            Jugador
          </label>
          <select
            value={jugadorId ?? ""}
            onChange={(e) => setJugadorId(e.target.value || null)}
            className={selectCls}
          >
            <option value="">— Elegí un jugador —</option>
            {jugadoresParaDropdown.map((j) => (
              <option key={j.id} value={j.id}>
                {j.nombre}
              </option>
            ))}
          </select>
        </div>

        {(rol === "armador" || rol === "atacante" || rol === "central") && (
          <div>
            <label className="block text-[9px] font-bold uppercase text-amber-300/80 mb-0.5">
              Con pelota
            </label>
            <select
              value={conPelota}
              onChange={(e) =>
                setConPelota(e.target.value as "todas" | "positiva" | "negativa")
              }
              className={selectCls}
            >
              <option value="todas">Todas</option>
              <option value="positiva">Positiva (+)</option>
              <option value="negativa">Negativa (−)</option>
            </select>
          </div>
        )}
      </div>

      {!jugadorId && (
        <p className="text-[11px] text-amber-200/70 italic text-center py-2">
          Elegí un jugador para ver su perfil automático.
        </p>
      )}

      {jugadorId && (
        <PerfilDetalle
          jugadorId={jugadorId}
          rol={rol}
          conPelota={conPelota}
          acciones={acciones}
          nombre={nombre}
        />
      )}
    </div>
  );
}

// ============================================================
// DETALLE (por rol)
// ============================================================

function PerfilDetalle({
  jugadorId,
  rol,
  conPelota,
  acciones,
  nombre,
}: {
  jugadorId: string;
  rol: RolPerfil;
  conPelota: "todas" | "positiva" | "negativa";
  acciones: AccionVisual[];
  nombre: (id: string | null) => string;
}) {
  // Agrupar acciones por punto para clasificar la recepción previa.
  const accionesPorPunto = useMemo(() => {
    const m = new Map<string, AccionVisual[]>();
    for (const a of acciones) {
      if (a.oculta) continue;
      const k = `${a.partido_id}|${a.set_numero}|${a.punto_numero}`;
      let lista = m.get(k);
      if (!lista) {
        lista = [];
        m.set(k, lista);
      }
      lista.push(a);
    }
    for (const lista of m.values()) {
      lista.sort((a, b) => a.orden - b.orden);
    }
    return m;
  }, [acciones]);

  // Calidad de la recepción previa a un armado.
  const recepcionPreviaDe = (
    a: AccionVisual
  ): "positiva" | "negativa" | "otra" | null => {
    const k = `${a.partido_id}|${a.set_numero}|${a.punto_numero}`;
    const lista = accionesPorPunto.get(k) ?? [];
    const idx = lista.findIndex((x) => x.id === a.id);
    if (idx <= 0) return null;
    for (let i = idx - 1; i >= 0; i--) {
      const prev = lista[i];
      if (prev.oculta) continue;
      if (prev.tipo !== "recepcion") continue;
      const sub = String(prev.subtipo ?? "");
      if (sub === "perfecta" || sub === "positiva") return "positiva";
      if (
        sub === "negativa" ||
        sub === "doble_negativa" ||
        sub === "error_directo" ||
        sub === "overpass"
      ) {
        return "negativa";
      }
      return "otra";
    }
    return null;
  };

  // ---- 1. ARMADOR ----
  if (rol === "armador") {
    const armados = acciones.filter(
      (a) => a.jugador_id === jugadorId && a.tipo === "armado" && !a.oculta
    );
    const filtrados = armados.filter((a) => {
      if (conPelota === "todas") return true;
      const prev = recepcionPreviaDe(a);
      return prev === conPelota;
    });

    const porLlamada: Record<string, number> = {};
    let sinLlamada = 0;
    for (const a of filtrados) {
      const llamada = inferirLlamadaArmado(a);
      if (llamada) {
        porLlamada[llamada] = (porLlamada[llamada] ?? 0) + 1;
      } else {
        sinLlamada += 1;
      }
    }
    const total = filtrados.length;

    const dist = Object.entries(porLlamada)
      .map(([llamada, count]) => ({
        llamada,
        count,
        pct: total > 0 ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return (
      <div className="space-y-2">
        <p className="text-[10px] text-amber-200/80 italic">
          {nombre(jugadorId)} es <strong>armador</strong>. Su tendencia de
          armado se calcula a partir de la velocidad + destino de cada armado
          inferidas en el motor.
          {conPelota !== "todas" && (
            <span>
              {" "}
              Filtrando por pelota previa <strong>{conPelota}</strong>.
            </span>
          )}
        </p>

        {total === 0 ? (
          <p className="text-[11px] text-slate-500 italic text-center py-2">
            No hay armados del jugador con los filtros actuales.
          </p>
        ) : (
          <>
            <div className="space-y-1">
              {dist.map((d) => {
                const maxPct = dist[0]?.pct || 1;
                return (
                  <div
                    key={d.llamada}
                    className="flex items-center gap-2 text-[11px]"
                  >
                    <span className="w-28 truncate text-slate-300">
                      {etiquetaLlamadaInferida(d.llamada)}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full"
                        style={{ width: `${(d.pct / maxPct) * 100}%` }}
                      />
                    </div>
                    <span className="w-16 text-right font-mono text-slate-300">
                      {d.count} ({d.pct}%)
                    </span>
                  </div>
                );
              })}
              {sinLlamada > 0 && (
                <div className="flex items-center gap-2 text-[11px] opacity-60">
                  <span className="w-28 truncate text-slate-500 italic">
                    Sin inferir
                  </span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-slate-500 rounded-full"
                      style={{
                        width: `${
                          total > 0 ? (sinLlamada / total) * 100 : 0
                        }%`,
                      }}
                    />
                  </div>
                  <span className="w-16 text-right font-mono text-slate-400">
                    {sinLlamada} (
                    {total > 0 ? Math.round((sinLlamada / total) * 100) : 0}%)
                  </span>
                </div>
              )}
            </div>
            <p className="text-[9px] text-slate-500 text-center">
              Total: {total} armados
            </p>
          </>
        )}
      </div>
    );
  }

  // ---- ATACANTE / CENTRAL ----
  if (rol === "atacante" || rol === "central") {
    const ataques = acciones.filter(
      (a) => a.jugador_id === jugadorId && a.tipo === "ataque" && !a.oculta
    );

    const porDireccion: Record<string, number> = {};
    let remates = 0;
    let toques = 0;
    for (const a of ataques) {
      const dir = inferirDireccionAtaque(a);
      if (dir) porDireccion[dir] = (porDireccion[dir] ?? 0) + 1;
      if (a.variante === "toque") toques += 1;
      else remates += 1;
    }
    const total = ataques.length;

    const dist = Object.entries(porDireccion)
      .map(([direccion, count]) => ({
        direccion,
        count,
        pct: total > 0 ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return (
      <div className="space-y-2">
        <p className="text-[10px] text-amber-200/80 italic">
          {nombre(jugadorId)} es <strong>{rol}</strong>. Se muestra dónde ataca
          (dirección inferida) y su ratio remate/toque.
        </p>

        {total === 0 ? (
          <p className="text-[11px] text-slate-500 italic text-center py-2">
            No hay ataques del jugador.
          </p>
        ) : (
          <>
            <div className="space-y-1">
              {dist.map((d) => {
                const maxPct = dist[0]?.pct || 1;
                return (
                  <div
                    key={d.direccion}
                    className="flex items-center gap-2 text-[11px]"
                  >
                    <span className="w-28 truncate text-slate-300">
                      {etiquetaDireccionAtaque(d.direccion)}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-rose-400 rounded-full"
                        style={{ width: `${(d.pct / maxPct) * 100}%` }}
                      />
                    </div>
                    <span className="w-16 text-right font-mono text-slate-300">
                      {d.count} ({d.pct}%)
                    </span>
                  </div>
                );
              })}
              {dist.length === 0 && (
                <p className="text-[10px] text-slate-500 italic">
                  No se pudo inferir dirección (faltan zonas origen/destino).
                </p>
              )}
            </div>
            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-amber-500/20">
              <span className="text-slate-300">
                Remate:{" "}
                <span className="font-mono text-slate-100">{remates}</span>
              </span>
              <span className="text-slate-300">
                Toque:{" "}
                <span className="font-mono text-amber-200">{toques}</span>
              </span>
              <span className="text-slate-500 text-[10px]">
                Ratio:{" "}
                {total > 0
                  ? `${Math.round((toques / total) * 100)}% toque`
                  : "—"}
              </span>
            </div>
            <p className="text-[9px] text-slate-500 text-center">
              Total: {total} ataques
            </p>
          </>
        )}
      </div>
    );
  }

  // ---- LÍBERO ----
  if (rol === "libero") {
    const defensas = acciones.filter(
      (a) => a.jugador_id === jugadorId && a.tipo === "defensa" && !a.oculta
    );

    const porSubtipo: Record<string, number> = {};
    let conDesplazamiento = 0;
    let sinDesplazamiento = 0;
    let coberturas = 0;
    for (const a of defensas) {
      const sub = String(a.subtipo ?? "otro");
      porSubtipo[sub] = (porSubtipo[sub] ?? 0) + 1;
      if (a.posicion_inicial_celda !== null) conDesplazamiento += 1;
      else sinDesplazamiento += 1;
      if (
        sub === "cobertura" ||
        sub === "cobertura_positiva" ||
        sub === "cobertura_negativa"
      ) {
        coberturas += 1;
      }
    }
    const total = defensas.length;

    const dist = Object.entries(porSubtipo)
      .map(([subtipo, count]) => ({
        subtipo,
        count,
        pct: total > 0 ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return (
      <div className="space-y-2">
        <p className="text-[10px] text-amber-200/80 italic">
          {nombre(jugadorId)} es <strong>líbero</strong>. Se muestra el tipo de
          defensa, la proporción con/sin desplazamiento y las coberturas.
        </p>

        {total === 0 ? (
          <p className="text-[11px] text-slate-500 italic text-center py-2">
            No hay defensas del jugador.
          </p>
        ) : (
          <>
            <div className="space-y-1">
              {dist.map((d) => {
                const maxPct = dist[0]?.pct || 1;
                return (
                  <div
                    key={d.subtipo}
                    className="flex items-center gap-2 text-[11px]"
                  >
                    <span className="w-32 truncate text-slate-300">
                      {d.subtipo.replace(/_/g, " ")}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-cyan-400 rounded-full"
                        style={{ width: `${(d.pct / maxPct) * 100}%` }}
                      />
                    </div>
                    <span className="w-16 text-right font-mono text-slate-300">
                      {d.count} ({d.pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-3 gap-1 pt-1 border-t border-amber-500/20 text-[10px]">
              <span className="text-emerald-300">
                Con despl.: <strong>{conDesplazamiento}</strong>
              </span>
              <span className="text-slate-300">
                Sin despl.: <strong>{sinDesplazamiento}</strong>
              </span>
              <span className="text-amber-300">
                Coberturas: <strong>{coberturas}</strong>
              </span>
            </div>
            <p className="text-[9px] text-slate-500 text-center">
              Total: {total} defensas
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <p className="text-[11px] text-slate-500 italic text-center py-2">
      No se pudo determinar el rol del jugador (sin datos de rol_jugador).
    </p>
  );
}