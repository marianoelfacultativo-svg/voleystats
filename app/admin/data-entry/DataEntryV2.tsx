"use client";

import { useEffect, useMemo, useState } from "react";
import CanchaV2, {
  CANCHA_V2_DIMS,
  getRectMiniLayout,
  type CoordsV2,
  type Orientacion,
  type ZonaCancha,
} from "./CanchaV2";
import LineasV2, { type PuntoV2, type LineaV2 } from "./LineasV2";
import PanelRotacionV2, {
  type CambioPendiente,
} from "./PanelRotacionV2";
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
import type { Libero, RotacionPunto, Zona, SaqueEquipo } from "@/lib/rotaciones";

// ============================================================
// TIPOS
// ============================================================

type Lado = "propio" | "rival";

type Fase =
  | "saque"
  | "recepcion"
  | "armado"
  | "ataque"
  | "defensa"
  | "libre"
  | "toque-red";

interface AccionCerrada {
  id: string;
  tipo: string;
  subtipo?: string | number | null;
  jugadorId?: string | null;
  origen: PuntoV2;
  destino: PuntoV2;
  lado: Lado;
}

interface PuntoCerrado {
  setNumero: number;
  puntoNumero: number;
  saqueEquipo: Lado;
  ganador: Lado;
  acciones: AccionCerrada[];
  marcadorPropio: number;
  marcadorRival: number;
  ts: number;
}

interface Jugador {
  id: string;
  nombre: string;
  numero: number | null;
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

function ladoDeZona(zona: ZonaCancha): Lado {
  if (zona === "cancha-rival" || zona === "bloqueo-rival") return "rival";
  if (zona === "cancha-propia" || zona === "bloqueo-propio") return "propio";
  return "propio";
}

function centroDePunto(p: PuntoV2): { x: number; y: number } {
  const r = getRectMiniLayout(p.celda, p.mini);
  if (!r) return { x: 0, y: 0 };
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

function posicionPopup(p: PuntoV2): PopupPos {
  const c = centroDePunto(p);
  return { x: c.x, y: c.y - 4 };
}

// Determinar el tipo de acción según el estado actual
function detectarFase(
  lineas: LineaV2[],
  origen: PuntoV2,
  destino: PuntoV2
): Fase {
  // Primera línea = saque
  if (lineas.length === 0) return "saque";
  // Segunda línea = recepción
  if (lineas.length === 1) return "recepcion";
  // Tercera y siguientes: miramos contexto básico
  // Si origen está en bloqueo → defensa
  if (origen.celda.startsWith("BLOQ")) return "defensa";
  // Si destino va a cancha rival desde propia → puede ser armado o ataque
  const ladoO = ladoDeZona(
    origen.celda.startsWith("F4") ||
      origen.celda.startsWith("F5") ||
      origen.celda.startsWith("F6")
      ? "cancha-rival"
      : "cancha-propia"
  );
  const ladoD = ladoDeZona(
    destino.celda.startsWith("F4") ||
      destino.celda.startsWith("F5") ||
      destino.celda.startsWith("F6")
      ? "cancha-rival"
      : "cancha-propia"
  );
  // Si vamos al otro lado → ataque o libre
  if (ladoO !== ladoD) return "ataque";
  // Mismo lado → armado (o recepción si es el 2do toque)
  return "armado";
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
  const [lineas, setLineas] = useState<LineaV2[]>([]);
  const [origenActivo, setOrigenActivo] = useState<PuntoV2 | null>(null);
  const [faseActual, setFaseActual] = useState<Fase>("saque");
  const [accionesCerradas, setAccionesCerradas] = useState<AccionCerrada[]>([]);
  const [contadorId, setContadorId] = useState(1);

  // ---------- Popups ----------
  const [popupArmado, setPopupArmado] = useState<PopupPos | null>(null);
  const [popupDefensa, setPopupDefensa] = useState<PopupPos | null>(null);
  const [popupLibre, setPopupLibre] = useState<PopupPos | null>(null);
  const [popupToqueRed, setPopupToqueRed] = useState<PopupPos | null>(null);

  // ---------- Estado del partido ----------
  const [setActivo, setSetActivo] = useState<number>(1);
  const [puntoActual, setPuntoActual] = useState<number>(1);
  const [saqueEquipo, setSaqueEquipo] = useState<Lado>("propio");
  const [orientacion, setOrientacion] = useState<Orientacion>("vertical");
  const [puntosCerrados, setPuntosCerrados] = useState<PuntoCerrado[]>([]);

  // ---------- Panel rotación ----------
  const [rotacion, setRotacion] = useState<RotacionPunto | null>(
    rotacionInicial ?? null
  );
  const [liberos, setLiberos] = useState<Libero[]>([]);
  const [posicionesPunto, setPosicionesPunto] = useState<Record<Zona, string>>(
    () => ({
      1: "",
      2: "",
      3: "",
      4: "",
      5: "",
      6: "",
    })
  );
  const [cambiosPendientes, setCambiosPendientes] = useState<CambioPendiente[]>(
    []
  );

  // ---------- Marcador ----------
  const marcador = useMemo(() => {
    const delSet = puntosCerrados.filter((p) => p.setNumero === setActivo);
    return {
      propio: delSet.filter((p) => p.ganador === "propio").length,
      rival: delSet.filter((p) => p.ganador === "rival").length,
    };
  }, [puntosCerrados, setActivo]);

  // ---------- Persistencia en localStorage ----------
  useEffect(() => {
    if (!partidoId) return;
    const data = {
      ts: Date.now(),
      puntosCerrados,
      setActivo,
      puntoActual,
      saqueEquipo,
    };
    try {
      localStorage.setItem(CLAVE_V2 + partidoId, JSON.stringify(data));
    } catch {
      /* noop */
    }
  }, [partidoId, puntosCerrados, setActivo, puntoActual, saqueEquipo]);

  // ---------- Cargar desde localStorage al montar ----------
  useEffect(() => {
    if (!partidoId) return;
    const raw = localStorage.getItem(CLAVE_V2 + partidoId);
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      if (data.puntosCerrados) setPuntosCerrados(data.puntosCerrados);
      if (data.setActivo) setSetActivo(data.setActivo);
      if (data.puntoActual) setPuntoActual(data.puntoActual);
      if (data.saqueEquipo) setSaqueEquipo(data.saqueEquipo);
    } catch {
      /* noop */
    }
  }, [partidoId]);

  // ---------- Jugadores en cancha ----------
  const jugadoresEnCancha: JugadorEnCancha[] = useMemo(() => {
    return jugadores.slice(0, 6).map((j) => ({
      id: j.id,
      nombre: j.nombre + (j.numero !== null ? ` #${j.numero}` : ""),
    }));
  }, [jugadores]);

  // ============================================================
  // HANDLERS
  // ============================================================

  // Click en una mini → abre círculo de origen
  const handleMiniClick = (coords: CoordsV2) => {
    // Si hay un popup abierto, no hacemos nada
    if (popupArmado || popupDefensa || popupLibre || popupToqueRed) return;

    // Zona de red → popup de toque de red
    if (coords.zona === "red") {
      setPopupToqueRed(posicionPopup({ celda: coords.celda, mini: coords.mini }));
      return;
    }

    // Abrir círculo en esa mini
    setOrigenActivo({ celda: coords.celda, mini: coords.mini });
  };

  // Crear línea desde el círculo activo al destino
  const handleCrearLinea = (destino: PuntoV2) => {
    if (!origenActivo) return;

    const nuevaLinea: LineaV2 = {
      id: `l-${contadorId}`,
      origen: origenActivo,
      destino,
      pendiente: true,
    };
    setLineas((prev) => [...prev, nuevaLinea]);
    setContadorId((c) => c + 1);
    setOrigenActivo(destino);

    // Detectar qué acción es y actuar en consecuencia
    const fase = detectarFase(lineas, origenActivo, destino);
    setFaseActual(fase);

    // Si es armado → abrir popup
    if (fase === "armado") {
      setPopupArmado(posicionPopup(destino));
      return;
    }

    // Si es ataque → no popup, se calcula al cerrar punto
    if (fase === "ataque") {
      return;
    }

    // Si es saque o recepción → no popup
    if (fase === "saque" || fase === "recepcion") {
      return;
    }
  };

  // Borrar última acción: elimina última línea y abre el círculo anterior
  const handleBorrarUltima = () => {
    if (lineas.length === 0) {
      if (origenActivo) setOrigenActivo(null);
      return;
    }
    const ultima = lineas[lineas.length - 1];
    setLineas((prev) => prev.slice(0, -1));
    setOrigenActivo(ultima.origen);
    // Quitar la última acción cerrada si coincide
    setAccionesCerradas((prev) => prev.slice(0, -1));
  };

  // Borrar punto entero
  const handleBorrarPunto = () => {
    if (
      lineas.length > 0 &&
      !confirm("¿Borrar todas las líneas de este punto?")
    )
      return;
    setLineas([]);
    setOrigenActivo(null);
    setAccionesCerradas([]);
    setFaseActual("saque");
    setPopupArmado(null);
    setPopupDefensa(null);
    setPopupLibre(null);
    setPopupToqueRed(null);
  };

  // Calcular punto: clasifica las líneas, decide ganador, guarda
  const handleCalcularPunto = () => {
    if (lineas.length === 0) return;

    const cerrar = confirm(
      "¿Cerrar el punto con estas líneas?\n\n" +
        `Líneas dibujadas: ${lineas.length}`
    );
    if (!cerrar) return;

    // Clasificación mínima: la primera línea define el saque
    const primera = lineas[0];
    const saqueDePropio = !primera.origen.celda.startsWith("FUERA-ARR");

    // Ganador provisional (después refinamos con la lógica completa):
    // Si el último destino cae en cancha rival y es ataque propio → propio
    // Si cae en propia y es ataque rival → rival
    const ultima = lineas[lineas.length - 1];
    const destinoRival =
      ultima.destino.celda.startsWith("F4") ||
      ultima.destino.celda.startsWith("F5") ||
      ultima.destino.celda.startsWith("F6");
    const ganador: Lado = destinoRival ? "propio" : "rival";

    const punto: PuntoCerrado = {
      setNumero: setActivo,
      puntoNumero: puntoActual,
      saqueEquipo: saqueDePropio ? "propio" : "rival",
      ganador,
      acciones: lineas.map((l, i) => ({
        id: l.id,
        tipo: i === 0 ? "saque" : i === 1 ? "recepcion" : "sin-clasificar",
        origen: l.origen,
        destino: l.destino,
        lado: ladoDeZona("cancha-propia"),
      })),
      marcadorPropio: marcador.propio + (ganador === "propio" ? 1 : 0),
      marcadorRival: marcador.rival + (ganador === "rival" ? 1 : 0),
      ts: Date.now(),
    };

    setPuntosCerrados((prev) => [...prev, punto]);

    // Avanzar al siguiente punto
    setPuntoActual((p) => p + 1);
    // El saque del siguiente punto: si ganó el que sacaba, mantiene; si no, cambia
    setSaqueEquipo(ganador === saqueEquipo ? saqueEquipo : (saqueEquipo === "propio" ? "rival" : "propio"));

    // Limpiar punto actual
    setLineas([]);
    setOrigenActivo(null);
    setAccionesCerradas([]);
    setFaseActual("saque");

    // Cerrar popups
    setPopupArmado(null);
    setPopupDefensa(null);
    setPopupLibre(null);
    setPopupToqueRed(null);
  };

  // ---------- Handlers de popups ----------

  const handleArmadoConfirmar = (v: ValorArmado) => {
    if (!popupArmado) return;
    const destino = lineas[lineas.length - 1]?.destino;
    if (!destino) return;
    setAccionesCerradas((prev) => [
      ...prev,
      {
        id: `a-${contadorId}`,
        tipo: "armado",
        subtipo: v,
        origen: lineas[lineas.length - 1].origen,
        destino,
        lado: "propio",
      },
    ]);
    setContadorId((c) => c + 1);
    setPopupArmado(null);
    setFaseActual("ataque");
  };

  const handleArmadoCancelar = () => {
    setPopupArmado(null);
  };

  const handleDefensaConfirmar = (
    subtipo: TipoDefensa,
    jugadorId: string | null
  ) => {
    if (!popupDefensa) return;
    const ultima = lineas[lineas.length - 1];
    if (ultima) {
      setAccionesCerradas((prev) => [
        ...prev,
        {
          id: `d-${contadorId}`,
          tipo: "defensa",
          subtipo,
          jugadorId,
          origen: ultima.origen,
          destino: ultima.destino,
          lado: "propio",
        },
      ]);
      setContadorId((c) => c + 1);
    }
    setPopupDefensa(null);
  };

  const handleDefensaCancelar = () => {
    setPopupDefensa(null);
  };

  const handleLibreConfirmar = (jugadorId: string | null) => {
    if (!popupLibre) return;
    const ultima = lineas[lineas.length - 1];
    if (ultima) {
      setAccionesCerradas((prev) => [
        ...prev,
        {
          id: `l-${contadorId}`,
          tipo: "libre",
          jugadorId,
          origen: ultima.origen,
          destino: ultima.destino,
          lado: "propio",
        },
      ]);
      setContadorId((c) => c + 1);
    }
    setPopupLibre(null);
  };

  const handleLibreCancelar = () => {
    setPopupLibre(null);
  };

  const handleToqueRedConfirmar = (
    resultado: ResultadoToqueRed,
    jugadorId: string | null
  ) => {
    setAccionesCerradas((prev) => [
      ...prev,
      {
        id: `tr-${contadorId}`,
        tipo: "toque-red",
        subtipo: resultado,
        jugadorId,
        origen: { celda: "", mini: "" },
        destino: { celda: "", mini: "" },
        lado: "propio",
      },
    ]);
    setContadorId((c) => c + 1);
    setPopupToqueRed(null);
  };

  const handleToqueRedCancelar = () => {
    setPopupToqueRed(null);
  };

  // ============================================================
  // HANDLERS DE ROTACIÓN
  // ============================================================

  const handleGuardarCambios = () => {
    if (!rotacion) return;
    // Aplicar cambios pendientes a la rotación
    const nuevaRot = { ...rotacion };
    for (const c of cambiosPendientes) {
      if (nuevaRot.posiciones[c.zona]) {
        nuevaRot.posiciones[c.zona] = {
          ...nuevaRot.posiciones[c.zona],
          jugador_id: c.jugadorEntra,
        };
      }
    }
    setRotacion(nuevaRot);
    setCambiosPendientes([]);
  };

  // ============================================================
  // RENDER
  // ============================================================

  const puntoCerrado = useMemo(
    () => puntosCerrados.length,
    [puntosCerrados.length]
  );

  return (
    <div className="space-y-3">
      {/* ---------- MARCADOR ---------- */}
      <div className="flex items-center justify-center gap-6 bg-slate-900 text-white rounded-2xl px-6 py-3">
        <div className="text-center">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
            {nombreMiEquipo}
          </p>
          <p className="text-3xl font-bold tabular-nums">{marcador.propio}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
            SET
          </p>
          <p className="text-xl font-bold tabular-nums">{setActivo}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
            {nombreRival}
          </p>
          <p className="text-3xl font-bold tabular-nums">{marcador.rival}</p>
        </div>
      </div>

      {/* ---------- INFO DEL PUNTO ---------- */}
      <div className="flex items-center justify-between text-sm text-slate-600 bg-white border border-slate-200 rounded-xl px-4 py-2">
        <span>
          <strong>Set {setActivo}</strong> · Punto <strong>{puntoActual}</strong>{" "}
          · Saca:{" "}
          <strong>
            {saqueEquipo === "propio" ? nombreMiEquipo : nombreRival}
          </strong>
        </span>
        <span className="text-xs text-slate-400">
          {lineas.length} línea{lineas.length !== 1 ? "s" : ""} ·{" "}
          {accionesCerradas.length} acc.
        </span>
      </div>

      {/* ---------- LAYOUT PRINCIPAL ---------- */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-3">
        {/* Columna izquierda: panel rotación */}
        <div className="space-y-2">
          {rotacion && (
            <PanelRotacionV2
              rotacion={rotacion}
              jugadoresEnCancha={jugadores.map((j) => ({
                id: j.id,
                nombre: j.nombre,
                numero: j.numero,
              }))}
              jugadoresDisponibles={[]}
              liberos={liberos}
              posicionesPunto={posicionesPunto}
              cambiosPendientes={cambiosPendientes}
              onSetLiberos={setLiberos}
              onSetPosicionesPunto={setPosicionesPunto}
              onSetCambiosPendientes={setCambiosPendientes}
              onGuardarCambios={handleGuardarCambios}
            />
          )}

          {/* Secuencia del punto */}
          <div className="bg-white border border-slate-200 rounded-lg p-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">
              Secuencia
            </p>
            <ol className="text-[11px] text-slate-700 space-y-0.5">
              {lineas.map((l, i) => (
                <li key={l.id} className="flex items-center gap-1">
                  <span className="w-4 text-slate-400 font-mono">{i + 1}.</span>
                  <span className="font-medium">
                    {i === 0
                      ? "Saque"
                      : i === 1
                      ? "Recepción"
                      : "Acción"}
                  </span>
                  <span className="text-slate-400 text-[10px] truncate">
                    {l.origen.celda} → {l.destino.celda}
                  </span>
                </li>
              ))}
              {lineas.length === 0 && (
                <li className="text-slate-400 italic text-[10px]">
                  (sin acciones)
                </li>
              )}
            </ol>
            {accionesCerradas.length > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-100">
                <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Cerradas
                </p>
                <ul className="text-[11px] text-slate-700 space-y-0.5">
                  {accionesCerradas.map((a) => (
                    <li key={a.id} className="flex items-center gap-1">
                      <span className="font-medium">{a.tipo}</span>
                      {a.subtipo !== undefined && a.subtipo !== null && (
                        <span className="text-slate-400">
                          ({String(a.subtipo)})
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Columna derecha: cancha + popups */}
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
              lineas={lineas}
              origenActivo={origenActivo}
              orientacion={orientacion}
              onCrearLinea={handleCrearLinea}
            />

            {popupArmado && (
              <PopupArmado
                pos={popupArmado}
                onConfirmar={handleArmadoConfirmar}
                onCancelar={handleArmadoCancelar}
              />
            )}
            {popupDefensa && (
              <PopupDefensa
                pos={popupDefensa}
                jugadores={jugadoresEnCancha}
                onConfirmar={handleDefensaConfirmar}
                onCancelar={handleDefensaCancelar}
              />
            )}
            {popupLibre && (
              <PopupLibre
                pos={popupLibre}
                jugadores={jugadoresEnCancha}
                onConfirmar={handleLibreConfirmar}
                onCancelar={handleLibreCancelar}
              />
            )}
            {popupToqueRed && (
              <PopupToqueRed
                pos={popupToqueRed}
                jugadores={jugadoresEnCancha}
                onConfirmar={handleToqueRedConfirmar}
                onCancelar={handleToqueRedCancelar}
              />
            )}
          </CanchaV2>
        </div>
      </div>

      {/* ---------- BOTONES ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-3">
        <div className="flex gap-2">
          <button
            onClick={handleBorrarUltima}
            disabled={lineas.length === 0 && !origenActivo}
            className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-sm font-medium disabled:opacity-40"
          >
            ↩ Borrar última acción
          </button>
          <button
            onClick={handleBorrarPunto}
            disabled={lineas.length === 0 && !origenActivo}
            className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 border border-red-300 rounded-lg text-sm font-medium disabled:opacity-40"
          >
            ✕ Borrar punto
          </button>
        </div>
        <button
          onClick={handleCalcularPunto}
          disabled={lineas.length === 0}
          className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg disabled:opacity-40"
        >
          ✓ Calcular punto
        </button>
      </div>

      <p className="text-xs text-slate-400 text-center">
        Click en una mini para abrir el círculo de origen. Desde ahí,
        arrastrá hasta otra mini para trazar la línea. Repetí para encadenar
        el punto. Al terminar, apretá "Calcular punto".
      </p>
    </div>
  );
}