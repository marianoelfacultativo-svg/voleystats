"use client";

import { useEffect, useMemo, useState } from "react";
import CanchaV2, {
  getRectMiniLayout,
  type CoordsV2,
  type Orientacion,
} from "./CanchaV2";
import LineasV2, { type PuntoV2, type LineaV2 } from "./LineasV2";
import PanelRotacionV2, { type CambioPendiente } from "./PanelRotacionV2";
import {
  PopupArmado,
  PopupDefensa,
  PopupLibre,
  PopupToqueRed,
  type ValorArmado,
  type TipoDefensa,
  type ResultadoToqueRed,
  type JugadorEnCancha,
  type PopupPos,
} from "./PopupValoracion";

import type { Libero, RotacionPunto, Zona } from "@/lib/rotaciones";
import {
  clasificarLinea,
  ganadorDelPunto,
  type EstadoClasificacion,
  type LineaClasificada,
  type PopupRequerido,
  type Situacion,
} from "@/lib/clasificacionV2";
import {
  guardarPuntoV2,
  type AccionV2Data,
  type PuntoV2Data,
} from "@/lib/dbV2";

// ============================================================
// TIPOS LOCALES
// ============================================================

type Lado = "propio" | "rival";

interface Jugador {
  id: string;
  nombre: string;
  numero: number | null;
}

interface PopupActivo {
  tipo: Exclude<PopupRequerido, null>;
  pos: PopupPos;
  lineaId: string;
}

interface Props {
  partidoId: string;
  equipoId: string;
  nombreMiEquipo: string;
  nombreRival: string;
  jugadores: Jugador[];
  rotacionInicial?: RotacionPunto;
}

const CLAVE_V2 = "voleystats_dataentry_v2_";

// ============================================================
// HELPERS
// ============================================================

function centroDePunto(p: PuntoV2): { x: number; y: number } {
  const r = getRectMiniLayout(p.celda, p.mini);
  if (!r) return { x: 0, y: 0 };
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

function posicionPopup(p: PuntoV2): PopupPos {
  const c = centroDePunto(p);
  return { x: c.x, y: c.y - 4 };
}

function aLineaV2(l: LineaClasificada): LineaV2 {
  return {
    id: l.id,
    origen: l.origen,
    destino: l.destino,
    tipo: l.tipo,
    esRival: l.esRival,
    pendiente: false,
  };
}

function aAccionV2(l: LineaClasificada, orden: number): AccionV2Data {
  return {
    orden,
    tipo: l.tipo,
    subtipo: l.subtipo ?? null,
    es_rival: l.esRival,
    jugador_id: l.jugadorId,
    lado: l.esRival ? "rival" : "propio",
    origen_celda: l.origen.celda,
    origen_mini: l.origen.mini,
    destino_celda: l.destino.celda,
    destino_mini: l.destino.mini,
    desvios: (l.desvios ?? []).map((d) => ({ celda: d.celda, mini: d.mini })),
    zona: null,
  };
}

// ============================================================
// COMPONENTE
// ============================================================

export default function DataEntryV2({
  partidoId,
  equipoId,
  nombreMiEquipo,
  nombreRival,
  jugadores,
  rotacionInicial,
}: Props) {
  // ---------- Estado del punto ----------
  const [lineas, setLineas] = useState<LineaClasificada[]>([]);
  const [origenActivo, setOrigenActivo] = useState<PuntoV2 | null>(null);
  const [popupActivo, setPopupActivo] = useState<PopupActivo | null>(null);
  const [contadorId, setContadorId] = useState(1);

  // ---------- Estado del partido ----------
  const [setActivo, setSetActivo] = useState<number>(1);
  const [puntoActual, setPuntoActual] = useState<number>(1);
  const [orientacion, setOrientacion] = useState<Orientacion>("vertical");
  const [guardando, setGuardando] = useState(false);

  // ---------- Setup ----------
  const [setupCompleto, setSetupCompleto] = useState(false);
  const [saqueInicial, setSaqueInicial] = useState<Lado>("propio");

  // ---------- Rotación ----------
  const [rotacion, setRotacion] = useState<RotacionPunto | null>(
    rotacionInicial ?? null
  );
  const [liberos, setLiberos] = useState<Libero[]>([]);
  const [posicionesPunto, setPosicionesPunto] = useState<Record<Zona, string>>(
    () => ({ 1: "", 2: "", 3: "", 4: "", 5: "", 6: "" })
  );
  const [cambiosPendientes, setCambiosPendientes] = useState<CambioPendiente[]>(
    []
  );

  // ---------- Marcador ----------
  const [marcador, setMarcador] = useState({ propio: 0, rival: 0 });

  // ---------- Derivados ----------
  const situacion: Situacion =
    saqueInicial === "propio" ? "saque" : "recepcion";

  const jugadoresEnCancha: JugadorEnCancha[] = useMemo(
    () =>
      jugadores.slice(0, 6).map((j) => ({
        id: j.id,
        nombre: j.nombre + (j.numero !== null ? ` #${j.numero}` : ""),
      })),
    [jugadores]
  );

  const lineasParaUI: LineaV2[] = useMemo(() => lineas.map(aLineaV2), [lineas]);

  // ---------- localStorage ----------
  useEffect(() => {
    if (!partidoId) return;
    try {
      localStorage.setItem(
        CLAVE_V2 + partidoId,
        JSON.stringify({
          ts: Date.now(),
          setActivo,
          puntoActual,
          saqueInicial,
          setupCompleto,
          marcador,
        })
      );
    } catch {
      /* noop */
    }
  }, [partidoId, setActivo, puntoActual, saqueInicial, setupCompleto, marcador]);

  useEffect(() => {
    if (!partidoId) return;
    const raw = localStorage.getItem(CLAVE_V2 + partidoId);
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      if (data.setActivo) setSetActivo(data.setActivo);
      if (data.puntoActual) setPuntoActual(data.puntoActual);
      if (data.saqueInicial) setSaqueInicial(data.saqueInicial);
      if (data.setupCompleto !== undefined) setSetupCompleto(data.setupCompleto);
      if (data.marcador) setMarcador(data.marcador);
    } catch {
      /* noop */
    }
  }, [partidoId]);

  // ============================================================
  // HANDLERS
  // ============================================================

  const handleMiniClick = (coords: CoordsV2) => {
    if (!setupCompleto) return;
    if (popupActivo) return;

    if (coords.zona === "red") {
      setPopupActivo({
        tipo: "toque-red",
        pos: posicionPopup({ celda: coords.celda, mini: coords.mini }),
        lineaId: "",
      });
      return;
    }

    setOrigenActivo({ celda: coords.celda, mini: coords.mini });
  };

  const handleCrearLinea = (destino: PuntoV2) => {
    if (!origenActivo || !rotacion) return;

    const estado: EstadoClasificacion = {
      saqueInicial,
      situacion,
      rotacion,
      lineas,
    };

    const res = clasificarLinea(estado, { origen: origenActivo, destino });

    const nueva: LineaClasificada = {
      id: `l-${contadorId}`,
      tipo: res.tipo,
      esRival: res.esRival,
      jugadorId: res.jugadorId,
      origen: origenActivo,
      destino,
      desvios: res.desvios,
      subtipo: null,
    };

    setLineas((prev) => [...prev, nueva]);
    setContadorId((c) => c + 1);
    setOrigenActivo(destino);

    if (res.popup) {
      setPopupActivo({
        tipo: res.popup,
        pos: posicionPopup(destino),
        lineaId: nueva.id,
      });
    }
  };

  const handleBorrarUltima = () => {
    if (lineas.length === 0) {
      if (origenActivo) setOrigenActivo(null);
      return;
    }
    const ultima = lineas[lineas.length - 1];
    setLineas((prev) => prev.slice(0, -1));
    setOrigenActivo(ultima.origen);
    if (popupActivo?.lineaId === ultima.id) setPopupActivo(null);
  };

  const handleBorrarPunto = () => {
    if (lineas.length > 0 && !confirm("¿Borrar todas las líneas de este punto?"))
      return;
    setLineas([]);
    setOrigenActivo(null);
    setPopupActivo(null);
  };

  const handleCerrarPunto = async () => {
    if (lineas.length === 0) return;
    if (!rotacion) {
      alert("Falta rotación.");
      return;
    }

    const ganador = ganadorDelPunto(lineas);
    if (!ganador) {
      alert(
        "No se puede determinar el ganador todavía.\n" +
          "Revisá que la última línea caiga en cancha rival/propia, fuera, o sea toque-red."
      );
      return;
    }

    const ok = confirm(
      `¿Cerrar el punto? Gana ${
        ganador === "propio" ? nombreMiEquipo : nombreRival
      }`
    );
    if (!ok) return;

    const punto: PuntoV2Data = {
      set_numero: setActivo,
      punto_numero: puntoActual,
      saque_equipo: saqueInicial,
      situacion,
      ganador,
      rotacion: rotacion as unknown as Record<string, unknown>,
      liberos: liberos as unknown as Record<string, unknown>[],
      cambios: cambiosPendientes as unknown as Record<string, unknown>[],
      posiciones_punto: posicionesPunto,
    };

    const acciones: AccionV2Data[] = lineas.map((l, i) =>
      aAccionV2(l, i + 1)
    );

    setGuardando(true);
    const res = await guardarPuntoV2(partidoId, punto, acciones);
    setGuardando(false);

    if (!res.ok) {
      alert("Error guardando punto: " + (res.error ?? "desconocido"));
      return;
    }

    setMarcador((m) => ({ ...m, [ganador]: m[ganador] + 1 }));
    setPuntoActual((p) => p + 1);
    setLineas([]);
    setOrigenActivo(null);
    setPopupActivo(null);
  };

  // ============================================================
  // POPUPS
  // ============================================================

  const actualizarLineaPopup = (cambios: Partial<LineaClasificada>) => {
    if (!popupActivo?.lineaId) return;
    setLineas((prev) =>
      prev.map((l) => (l.id === popupActivo.lineaId ? { ...l, ...cambios } : l))
    );
  };

  const handleArmadoConfirmar = (v: ValorArmado) => {
    actualizarLineaPopup({ subtipo: v });
    setPopupActivo(null);
  };

  const handleDefensaConfirmar = (
    subtipo: TipoDefensa,
    jugadorId: string | null
  ) => {
    actualizarLineaPopup({ subtipo, jugadorId });
    setPopupActivo(null);
  };

  const handleLibreConfirmar = (jugadorId: string | null) => {
    actualizarLineaPopup({ jugadorId });
    setPopupActivo(null);
  };

  const handleToqueRedConfirmar = (
    resultado: ResultadoToqueRed,
    jugadorId: string | null
  ) => {
    if (!popupActivo) return;

    if (!popupActivo.lineaId) {
      // Toque-red sin línea previa: crear línea ficticia en la red
      const ficticia: LineaClasificada = {
        id: `tr-${contadorId}`,
        tipo: "toque-red",
        esRival: false,
        jugadorId,
        origen: { celda: "RED-C3", mini: "m1-5" },
        destino: { celda: "RED-C3", mini: "m1-5" },
        subtipo: resultado,
      };
      setLineas((prev) => [...prev, ficticia]);
      setContadorId((c) => c + 1);
    } else {
      actualizarLineaPopup({ subtipo: resultado, jugadorId });
    }
    setPopupActivo(null);
  };

  const cerrarPopup = () => setPopupActivo(null);

  // ============================================================
  // ROTACIÓN
  // ============================================================

  const handleGuardarCambios = () => {
    if (!rotacion) return;
    const nueva = { ...rotacion };
    for (const c of cambiosPendientes) {
      if (nueva.posiciones[c.zona]) {
        nueva.posiciones[c.zona] = {
          ...nueva.posiciones[c.zona],
          jugador_id: c.jugadorEntra,
        };
      }
    }
    setRotacion(nueva);
    setCambiosPendientes([]);
  };

  // ============================================================
  // ATAJOS
  // ============================================================

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (
        t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.tagName === "SELECT"
      )
        return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "g") {
        e.preventDefault();
        void handleCerrarPunto();
        return;
      }
      if (e.key === "Escape") {
        if (popupActivo) setPopupActivo(null);
        else setOrigenActivo(null);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        void handleCerrarPunto();
        return;
      }
      if (e.key.toLowerCase() === "d" && !e.ctrlKey && !e.metaKey) {
        handleBorrarUltima();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popupActivo, lineas, rotacion, puntoActual, setActivo]);

  // ============================================================
  // SETUP
  // ============================================================

  const necesitaSetup = !setupCompleto;

  const handleComenzar = () => {
    if (!rotacion) {
      alert("Necesitás una rotación antes de comenzar.");
      return;
    }
    setSetupCompleto(true);
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="space-y-3">
      {/* MARCADOR */}
      <div className="flex items-center justify-center gap-6 bg-slate-900 text-white rounded-2xl px-6 py-3">
        <div className="text-center">
          <p className="text-[10px] font-semibold text-slate-400 uppercase">
            {nombreMiEquipo}
          </p>
          <p className="text-3xl font-bold tabular-nums">{marcador.propio}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-semibold text-slate-400 uppercase">
            SET
          </p>
          <p className="text-xl font-bold tabular-nums">{setActivo}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-semibold text-slate-400 uppercase">
            {nombreRival}
          </p>
          <p className="text-3xl font-bold tabular-nums">{marcador.rival}</p>
        </div>
      </div>

      {/* SETUP */}
      {necesitaSetup && (
        <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-4 space-y-3">
          <h2 className="text-lg font-bold text-amber-900">
            🎬 Antes de empezar el partido
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
            <div>
              {rotacion && (
                <PanelRotacionV2
                  rotacion={rotacion}
                  jugadoresEnCancha={jugadores.map((j) => ({
                    id: j.id,
                    nombre: j.nombre,
                    numero: j.numero,
                  }))}
                  jugadoresDisponibles={jugadores.map((j) => ({
                    id: j.id,
                    nombre: j.nombre,
                    numero: j.numero,
                  }))}
                  liberos={liberos}
                  posicionesPunto={posicionesPunto}
                  cambiosPendientes={cambiosPendientes}
                  onSetLiberos={setLiberos}
                  onSetPosicionesPunto={setPosicionesPunto}
                  onSetCambiosPendientes={setCambiosPendientes}
                  onGuardarCambios={handleGuardarCambios}
                />
              )}
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-bold text-amber-800 uppercase mb-1">
                  ¿Quién saca el primer punto?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSaqueInicial("propio")}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                      saqueInicial === "propio"
                        ? "bg-emerald-500 text-white"
                        : "bg-white text-slate-700 border border-slate-300"
                    }`}
                  >
                    {nombreMiEquipo}
                  </button>
                  <button
                    onClick={() => setSaqueInicial("rival")}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                      saqueInicial === "rival"
                        ? "bg-orange-500 text-white"
                        : "bg-white text-slate-700 border border-slate-300"
                    }`}
                  >
                    {nombreRival}
                  </button>
                </div>
              </div>
              <button
                onClick={handleComenzar}
                className="w-full px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg text-lg"
              >
                ✓ Comenzar partido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INFO DEL PUNTO */}
      {!necesitaSetup && (
        <div className="flex items-center justify-between text-sm text-slate-600 bg-white border border-slate-200 rounded-xl px-4 py-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPuntoActual((p) => Math.max(1, p - 1))}
              disabled={puntoActual === 1}
              className="w-7 h-7 flex items-center justify-center rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-30"
            >
              ◀
            </button>
            <span>
              <strong>Set {setActivo}</strong> · Punto <strong>{puntoActual}</strong>{" "}
              · Saca:{" "}
              <strong>
                {saqueInicial === "propio" ? nombreMiEquipo : nombreRival}
              </strong>
            </span>
            <button
              onClick={() => setPuntoActual((p) => p + 1)}
              className="w-7 h-7 flex items-center justify-center rounded border border-slate-300 hover:bg-slate-50"
            >
              ▶
            </button>
          </div>
          <span className="text-xs text-slate-400">
            {lineas.length} línea{lineas.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* LAYOUT */}
      {!necesitaSetup && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-3">
            <div className="space-y-2">
              {rotacion && (
                <PanelRotacionV2
                  rotacion={rotacion}
                  jugadoresEnCancha={jugadores.map((j) => ({
                    id: j.id,
                    nombre: j.nombre,
                    numero: j.numero,
                  }))}
                  jugadoresDisponibles={jugadores.map((j) => ({
                    id: j.id,
                    nombre: j.nombre,
                    numero: j.numero,
                  }))}
                  liberos={liberos}
                  posicionesPunto={posicionesPunto}
                  cambiosPendientes={cambiosPendientes}
                  onSetLiberos={setLiberos}
                  onSetPosicionesPunto={setPosicionesPunto}
                  onSetCambiosPendientes={setCambiosPendientes}
                  onGuardarCambios={handleGuardarCambios}
                />
              )}
              <div className="bg-white border border-slate-200 rounded-lg p-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Secuencia
                </p>
                <ol className="text-[11px] text-slate-700 space-y-0.5">
                  {lineas.map((l, i) => (
                    <li key={l.id} className="flex items-center gap-1">
                      <span className="w-4 text-slate-400 font-mono">
                        {i + 1}.
                      </span>
                      <span className="font-medium">{l.tipo}</span>
                      {l.subtipo !== undefined && l.subtipo !== null && (
                        <span className="text-slate-400">
                          ({String(l.subtipo)})
                        </span>
                      )}
                    </li>
                  ))}
                  {lineas.length === 0 && (
                    <li className="text-slate-400 italic text-[10px]">
                      (sin acciones)
                    </li>
                  )}
                </ol>
              </div>
            </div>

            <div className="relative bg-white rounded-2xl shadow-sm border border-slate-200 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase">
                  Punto {puntoActual} · Set {setActivo}
                </p>
                <button
                  onClick={() =>
                    setOrientacion((o) =>
                      o === "vertical" ? "horizontal" : "vertical"
                    )
                  }
                  className="px-2 py-0.5 text-[10px] rounded border border-slate-300 hover:bg-slate-50 text-slate-600"
                >
                  🔄 {orientacion === "vertical" ? "Horizontal" : "Vertical"}
                </button>
              </div>

              <CanchaV2
                orientacion={orientacion}
                onMiniClick={handleMiniClick}
              >
                <LineasV2
                  lineas={lineasParaUI}
                  origenActivo={origenActivo}
                  orientacion={orientacion}
                  onCrearLinea={handleCrearLinea}
                />

                {popupActivo?.tipo === "armado" && (
                  <PopupArmado
                    pos={popupActivo.pos}
                    onConfirmar={handleArmadoConfirmar}
                    onCancelar={cerrarPopup}
                  />
                )}
                {popupActivo?.tipo === "defensa" && (
                  <PopupDefensa
                    pos={popupActivo.pos}
                    jugadores={jugadoresEnCancha}
                    onConfirmar={handleDefensaConfirmar}
                    onCancelar={cerrarPopup}
                  />
                )}
                {popupActivo?.tipo === "libre" && (
                  <PopupLibre
                    pos={popupActivo.pos}
                    jugadores={jugadoresEnCancha}
                    onConfirmar={handleLibreConfirmar}
                    onCancelar={cerrarPopup}
                  />
                )}
                {popupActivo?.tipo === "toque-red" && (
                  <PopupToqueRed
                    pos={popupActivo.pos}
                    jugadores={jugadoresEnCancha}
                    onConfirmar={handleToqueRedConfirmar}
                    onCancelar={cerrarPopup}
                  />
                )}
              </CanchaV2>
            </div>
          </div>

          {/* BOTONES */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-3">
            <div className="flex gap-2">
              <button
                onClick={handleBorrarUltima}
                disabled={lineas.length === 0 && !origenActivo}
                className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-sm font-medium disabled:opacity-40"
              >
                ↩ Borrar última (D)
              </button>
              <button
                onClick={handleBorrarPunto}
                disabled={lineas.length === 0}
                className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 border border-red-300 rounded-lg text-sm font-medium disabled:opacity-40"
              >
                ✕ Borrar punto
              </button>
            </div>
            <button
              onClick={handleCerrarPunto}
              disabled={lineas.length === 0 || guardando}
              className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg disabled:opacity-40"
            >
              {guardando ? "Guardando..." : "✓ Cerrar punto (Enter)"}
            </button>
          </div>

          <p className="text-xs text-slate-400 text-center">
            Click en mini → círculo. Drag → línea. Popups aparecen solos.
            <br />
            <strong>Atajos:</strong> Esc · Enter (cerrar) · D (borrar última) ·
            Ctrl+G (guardar)
          </p>
        </>
      )}
    </div>
  );
}