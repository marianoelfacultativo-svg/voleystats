"use client";

// ============================================================
// PANEL DE PRESETS DEL ANÁLISIS
// ============================================================
// Lista de presets disponibles (predefinidos + guardados por el
// usuario) para configurar un panel de análisis de un solo golpe.
//
// Funcionalidad:
//   - Aplicar un preset (click en la card).
//   - Guardar la config actual como un preset nuevo.
//   - Borrar un preset del usuario.
//   - Buscar por nombre/descripción.
//   - Borrar TODOS los presets del usuario (botón "Mis presets").
//
// Persistencia en localStorage vía lib/presetsAnalisis.ts.
//
// Uso típico en AnalisisConsecuencias.tsx:
//
//   <PanelPresetsAnalisis
//     configActual={config}
//     onAplicar={(nuevaConfig) => setConfig(nuevaConfig)}
//   />
//
// No hay "preset activo persistente": aplicar un preset reemplaza
// la config. Si el usuario después cambia algo, es una nueva config
// que no se guarda hasta que él lo decida.
// ============================================================

import { useEffect, useMemo, useState } from "react";
import {
  aplicarPresetAnalisis,
  borrarPreset,
  borrarTodosLosPresetsUsuario,
  cargarPresetsUsuario,
  crearPresetDesdeConfig,
  esPredefinido,
  guardarPreset,
  resumenPreset,
  todosLosPresets,
  type PresetAnalisis,
  type PresetTargetConfig,
} from "@/lib/presetsAnalisis";

// ------------------------------------------------------------
// PROPS
// ------------------------------------------------------------

interface Props<T extends PresetTargetConfig> {
  /** Configuración actual (para guardar como preset nuevo). */
  configActual: T;
  /** Callback que recibe la config del preset aplicado. */
  onAplicar: (nuevaConfig: T, presetId: string) => void;
  /** Título del panel (default: "Presets de análisis"). */
  titulo?: string;
  /** Abierto por defecto (default: false). */
  abiertoInicial?: boolean;
}

// ------------------------------------------------------------
// COMPONENTE
// ------------------------------------------------------------

export default function PanelPresetsAnalisis<T extends PresetTargetConfig>({
  configActual,
  onAplicar,
  titulo = "Presets de análisis",
  abiertoInicial = false,
}: Props<T>) {
  const [abierto, setAbierto] = useState(abiertoInicial);
  const [presets, setPresets] = useState<PresetAnalisis[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);

  // Cargar presets desde localStorage al montar.
  useEffect(() => {
    setPresets(todosLosPresets());
  }, []);

  const recargarPresets = () => {
    setPresets(todosLosPresets());
  };

  // Filtrado por búsqueda.
  const presetsFiltrados = useMemo(() => {
    if (!busqueda.trim()) return presets;
    const b = busqueda.toLowerCase();
    return presets.filter(
      (p) =>
        p.nombre.toLowerCase().includes(b) ||
        p.descripcion.toLowerCase().includes(b)
    );
  }, [presets, busqueda]);

  const hayUsuario = useMemo(
    () => presets.some((p) => !esPredefinido(p)),
    [presets]
  );

  // Handlers
  const handleAplicar = (preset: PresetAnalisis) => {
    const nuevaConfig = aplicarPresetAnalisis(configActual, preset);
    onAplicar(nuevaConfig, preset.id);
  };

  const handleGuardar = () => {
    const nombre = nombreNuevo.trim();
    if (!nombre) {
      setErrorGuardado("Poné un nombre al preset.");
      return;
    }
    if (
      presets.some(
        (p) => p.nombre.toLowerCase() === nombre.toLowerCase()
      )
    ) {
      setErrorGuardado("Ya existe un preset con ese nombre.");
      return;
    }
    const nuevo = crearPresetDesdeConfig(nombre, configActual);
    const ok = guardarPreset(nuevo);
    if (!ok) {
      setErrorGuardado(
        "No se pudo guardar. Revisá el almacenamiento del navegador."
      );
      return;
    }
    setNombreNuevo("");
    setGuardando(false);
    setErrorGuardado(null);
    recargarPresets();
  };

  const handleBorrar = (id: string) => {
    const ok = borrarPreset(id);
    if (ok) recargarPresets();
  };

  const handleBorrarTodosUsuario = () => {
    const ok = borrarTodosLosPresetsUsuario();
    if (ok) recargarPresets();
  };

  const handleCancelarGuardado = () => {
    setGuardando(false);
    setNombreNuevo("");
    setErrorGuardado(null);
  };

  return (
    <div
      className="rounded-xl border border-white/10 p-3"
      style={{
        background: "var(--sx-surface-1)",
      }}
    >
      {/* ---------- HEADER ---------- */}
      <button
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center justify-between"
      >
        <span
          className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-2"
          style={{ color: "var(--sx-text-primary)" }}
        >
          ⚡ {titulo}
          {presets.length > 0 && (
            <span
              className="text-[9px] px-1.5 py-0.5 rounded-full font-bold normal-case tracking-normal"
              style={{
                background: "rgba(56,189,248,0.15)",
                color: "#7DD3FC",
                border: "1px solid rgba(56,189,248,0.35)",
              }}
            >
              {presets.length}
            </span>
          )}
        </span>
        <span
          className="transition-transform"
          style={{
            color: "var(--sx-text-muted)",
            transform: abierto ? "rotate(180deg)" : "none",
          }}
        >
          ▼
        </span>
      </button>

      {abierto && (
        <div className="mt-3 space-y-2">
          <p
            className="text-[10px] leading-relaxed italic"
            style={{ color: "var(--sx-text-muted)" }}
          >
            Aplicá un preset para configurar el análisis de una vez.
            También podés guardar tu configuración actual como un preset
            nuevo.
          </p>

          {/* ---------- BÚSQUEDA + GUARDAR ---------- */}
          <div className="flex gap-1.5 flex-wrap">
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar preset..."
              className="input-dark text-xs flex-1 min-w-[140px]"
            />
            <button
              onClick={() => {
                setGuardando((v) => !v);
                setErrorGuardado(null);
              }}
              className={`px-2.5 py-1 text-[10px] font-semibold rounded border-2 transition whitespace-nowrap ${
                guardando
                  ? "bg-violet-500 text-white border-violet-500"
                  : "bg-white/5 text-violet-300 border-violet-500/40 hover:bg-violet-500/10"
              }`}
            >
              {guardando ? "Cancelar" : "💾 Guardar actual"}
            </button>
            {hayUsuario && !guardando && (
              <button
                onClick={handleBorrarTodosUsuario}
                className="px-2.5 py-1 text-[10px] font-semibold rounded border-2 transition whitespace-nowrap"
                style={{
                  background: "rgba(229,62,77,0.08)",
                  color: "#F87171",
                  borderColor: "rgba(229,62,77,0.35)",
                }}
                title="Borrar todos los presets guardados por el usuario (no toca los predefinidos)"
              >
                🗑️ Mis presets
              </button>
            )}
          </div>

          {/* ---------- FORM GUARDAR ---------- */}
          {guardando && (
            <div
              className="rounded-xl p-2 space-y-1.5"
              style={{
                background: "rgba(167,139,250,0.06)",
                border: "1px solid rgba(167,139,250,0.3)",
              }}
            >
              <input
                type="text"
                value={nombreNuevo}
                onChange={(e) => {
                  setNombreNuevo(e.target.value);
                  setErrorGuardado(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleGuardar();
                  if (e.key === "Escape") handleCancelarGuardado();
                }}
                placeholder="Nombre del preset..."
                autoFocus
                maxLength={60}
                className="input-dark text-xs w-full"
              />
              {errorGuardado && (
                <p className="text-[10px]" style={{ color: "#F87171" }}>
                  ⚠️ {errorGuardado}
                </p>
              )}
              <div className="flex gap-1.5 justify-end">
                <button
                  onClick={handleCancelarGuardado}
                  className="px-2 py-0.5 text-[10px] font-semibold rounded border border-white/15 bg-white/5 text-slate-300 hover:bg-white/10"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleGuardar}
                  className="px-2 py-0.5 text-[10px] font-bold rounded bg-violet-500 text-white border border-violet-500 hover:bg-violet-600"
                >
                  Guardar
                </button>
              </div>
            </div>
          )}

          {/* ---------- LISTA ---------- */}
          {presetsFiltrados.length === 0 ? (
            <p
              className="text-[10px] text-center py-3"
              style={{ color: "var(--sx-text-muted)" }}
            >
              {busqueda
                ? "No hay presets que coincidan con la búsqueda."
                : "No hay presets disponibles."}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {presetsFiltrados.map((preset) => {
                const esUser = !esPredefinido(preset);
                return (
                  <div
                    key={preset.id}
                    className="relative rounded-xl p-2 transition border bg-white/[0.02] border-white/10 hover:bg-white/[0.05] hover:border-white/20"
                  >
                    <button
                      onClick={() => handleAplicar(preset)}
                      className="w-full text-left flex items-start gap-2"
                      title={preset.descripcion}
                    >
                      <span className="text-base shrink-0 mt-0.5">
                        {preset.icono}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-[11px] font-bold truncate text-white">
                            {preset.nombre}
                          </p>
                          {esUser && (
                            <span
                              className="text-[8px] px-1 py-0.5 rounded font-bold uppercase tracking-wider"
                              style={{
                                background: "rgba(56,189,248,0.15)",
                                color: "#7DD3FC",
                              }}
                            >
                              mío
                            </span>
                          )}
                        </div>
                        <p
                          className="text-[9px] leading-snug line-clamp-2 mt-0.5"
                          style={{ color: "var(--sx-text-secondary)" }}
                        >
                          {preset.descripcion}
                        </p>
                        <p
                          className="text-[8px] font-mono mt-0.5 truncate"
                          style={{ color: "var(--sx-text-muted)" }}
                        >
                          {resumenPreset(preset)}
                        </p>
                      </div>
                    </button>

                    {/* Botón borrar solo para presets del usuario */}
                    {esUser && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBorrar(preset.id);
                        }}
                        className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition"
                        style={{
                          background: "rgba(229,62,77,0.15)",
                          color: "#F87171",
                          border: "1px solid rgba(229,62,77,0.35)",
                        }}
                        title="Borrar este preset"
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ---------- FOOTER ---------- */}
          {presets.length > 0 && (
            <p
              className="text-[9px] text-center italic"
              style={{ color: "var(--sx-text-muted)" }}
            >
              {presets.filter((p) => esPredefinido(p)).length} predefinidos ·{" "}
              {presets.filter((p) => !esPredefinido(p)).length} del usuario
            </p>
          )}
        </div>
      )}
    </div>
  );
}