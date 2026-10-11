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
  PopupJugador,
  PopupLibre,
  PopupRecepcion,
  PopupSaque,
  PopupToqueRed,
  type ValorArmado,
  type ValorRecepcion,
  type ValorSaque,
  type TipoDefensa,
  type ResultadoToqueRed,
  type JugadorEnCancha,
  type PopupPos,
} from "./PopupValoracion";

import {
  girarRotacionPunto,
  type Libero,
  type RotacionPunto,
  type SaqueEquipo,
  type Zona,
} from "@/lib/rotaciones";
import {
  calcularSubtiposAtaque,
  clasificarLinea,
  esCanchaPropia,
  esCanchaRival,
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
// TIPOS
// ============================================================

type Lado = "propio" | "rival";

interface Jugador {
  id: string;
  nombre: string;
  numero: number | null;
}

interface PopupEnCola {
  tipo: Exclude<PopupRequerido, null>;
  pos: PopupPos;
  lineaId: string;
}

interface PuntoCerrado {
  numero: number;
  lineas: LineaClasificada[];
  saqueInicial: Lado;
  situacion: Situacion;
  ganador: Lado;
  rotacion: RotacionPunto;
  liberos: Libero[];
  posicionesPunto: Record<Zona, string>;
  cambios: CambioPendiente[];
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

const POSICIONES_VACIAS: Record<Zona, string> = {
  1: "",
  2: "",
  3: "",
  4: "",
  5: "",
  6: "",
};

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
    desvios: l.desvios,
    tipo: l.tipo,
    esRival: l.esRival,
    oculta: l.oculta,
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

function esCeldaBloqueo(celda: string): boolean {
  return celda.startsWith("BLOQ-P-") || celda.startsWith("BLOQ-R-");
}

function mismaMini(a: PuntoV2, b: PuntoV2): boolean {
  return a.celda === b.celda && a.mini === b.mini;
}

function maxIdLineas(lineas: LineaClasificada[]): number {
  let max = 0;
  for (const l of lineas) {
    const m = l.id.match(/^l-(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1]));
  }
  return max;
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
  // ---------- Fuente de verdad ----------
  const [puntosCerrados, setPuntosCerrados] = useState<
    Record<number, PuntoCerrado>
  >({});
  const [puntoActual, setPuntoActual] = useState<number>(1);

  // ---------- Estado activo del punto actual ----------
  const [lineas, setLineas] = useState<LineaClasificada[]>([]);
  const [circuloSinArmar, setCirculoSinArmar] = useState<PuntoV2 | null>(null);
  const [circuloArmado, setCirculoArmado] = useState<PuntoV2 | null>(null);
  const [desviosPendientes, setDesviosPendientes] = useState<PuntoV2[]>([]);
  const [estrella, setEstrella] = useState<PuntoV2 | null>(null);
  const [colaPopups, setColaPopups] = useState<PopupEnCola[]>([]);
  const [contadorId, setContadorId] = useState(1);

  // ---------- Estado del punto actual (saque/rotación/etc) ----------
  const [saqueInicial, setSaqueInicial] = useState<Lado>("propio");
  const [rotacion, setRotacion] = useState<RotacionPunto | null>(
    rotacionInicial ?? null
  );
  const [liberos, setLiberos] = useState<Libero[]>([]);
  const [posicionesPunto, setPosicionesPunto] = useState<Record<Zona, string>>(
    () => ({ ...POSICIONES_VACIAS })
  );
  const [cambiosPendientes, setCambiosPendientes] = useState<CambioPendiente[]>(
    []
  );

  // ---------- UI ----------
  const [setActivo, setSetActivo] = useState<number>(1);
  const [orientacion, setOrientacion] = useState<Orientacion>("vertical");
  const [guardando, setGuardando] = useState(false);
  const [setupCompleto, setSetupCompleto] = useState(false);

  const puntoActualCerrado = !!puntosCerrados[puntoActual];

  // ---------- Límite de navegación ----------
  // Máximo navegable = último cerrado + 1 (o 1 si no hay cerrados)
  const maxNavegable = useMemo(() => {
    const nums = Object.keys(puntosCerrados).map((n) => parseInt(n));
    const ultimo = nums.length > 0 ? Math.max(...nums) : 0;
    return ultimo + 1;
  }, [puntosCerrados]);

  // ---------- Derivados ----------
  const situacion: Situacion =
    saqueInicial === "propio" ? "saque" : "recepcion";

  const popupActivo = colaPopups[0] ?? null;

  const rotacionEfectiva = useMemo<RotacionPunto | null>(() => {
    if (!rotacion) return null;
    const zonas: Zona[] = [1, 2, 3, 4, 5, 6];
    let cambio = false;
    const nuevas = { ...rotacion.posiciones };
    for (const z of zonas) {
      const override = posicionesPunto[z];
      if (override && override !== nuevas[z]?.jugador_id) {
        nuevas[z] = { ...nuevas[z], jugador_id: override };
        cambio = true;
      }
    }
    return cambio ? { ...rotacion, posiciones: nuevas } : rotacion;
  }, [rotacion, posicionesPunto]);

  const jugadoresEnCancha: JugadorEnCancha[] = useMemo(() => {
    if (!rotacion) return [];
    const ids = new Set<string>();
    const zonasOrden: Zona[] = [1, 2, 3, 4, 5, 6];
    for (const z of zonasOrden) {
      const pend = cambiosPendientes.find((c) => c.zona === z);
      const override = posicionesPunto[z];
      const rot = rotacion.posiciones[z];
      const id = pend?.jugadorEntra || override || rot?.jugador_id;
      if (id) ids.add(id);
    }
    return Array.from(ids).map((id) => {
      const j = jugadores.find((x) => x.id === id);
      if (!j) return { id, nombre: "?" };
      return {
        id,
        nombre: j.nombre + (j.numero !== null ? ` #${j.numero}` : ""),
      };
    });
  }, [rotacion, posicionesPunto, cambiosPendientes, jugadores]);

  const lineasParaUI: LineaV2[] = useMemo(() => lineas.map(aLineaV2), [lineas]);
  const origenActivoParaUI: PuntoV2 | null =
    circuloSinArmar ?? circuloArmado;

  // Marcador: suma de ganadores de todos los puntos cerrados
  const marcador = useMemo(() => {
    let p = 0;
    let r = 0;
    for (const pc of Object.values(puntosCerrados)) {
      if (pc.ganador === "propio") p++;
      else r++;
    }
    return { propio: p, rival: r };
  }, [puntosCerrados]);

  // ============================================================
  // CARGAR PUNTO (desde cerrados o derivar nuevo)
  // ============================================================

  const cargarPuntoDesde = (
    cerrados: Record<number, PuntoCerrado>,
    n: number
  ) => {
    // Reset estado activo
    setLineas([]);
    setCirculoSinArmar(null);
    setCirculoArmado(null);
    setDesviosPendientes([]);
    setEstrella(null);
    setColaPopups([]);
    setContadorId(1);

    const pc = cerrados[n];
    if (pc) {
      setLineas(pc.lineas);
      setSaqueInicial(pc.saqueInicial);
      setRotacion(pc.rotacion);
      setLiberos(pc.liberos);
      setPosicionesPunto(pc.posicionesPunto);
      setCambiosPendientes(pc.cambios);
      setContadorId(maxIdLineas(pc.lineas) + 1);
      return;
    }

    // Punto nuevo: derivar del último cerrado anterior
    const anteriores = Object.values(cerrados)
      .filter((x) => x.numero < n)
      .sort((a, b) => b.numero - a.numero);
    const prev = anteriores[0] ?? null;

    if (prev) {
      let rotSig: RotacionPunto = prev.rotacion;
      const saqueSig: Lado = prev.ganador; // gana saca
      if (prev.ganador === "propio" && prev.saqueInicial === "rival") {
        const { rotacion: rotG } = girarRotacionPunto(prev.rotacion, 1);
        rotSig = rotG;
      }
      setSaqueInicial(saqueSig);
      setRotacion({ ...rotSig, saque_equipo: saqueSig });
      setLiberos(prev.liberos);
      setPosicionesPunto({ ...POSICIONES_VACIAS });
      setCambiosPendientes([]);
    } else {
      setSaqueInicial("propio");
      if (rotacionInicial) setRotacion(rotacionInicial);
      setLiberos([]);
      setPosicionesPunto({ ...POSICIONES_VACIAS });
      setCambiosPendientes([]);
    }
  };

  // ============================================================
  // LOCALSTORAGE
  // ============================================================

  useEffect(() => {
    if (!partidoId) return;
    try {
      localStorage.setItem(
        CLAVE_V2 + partidoId,
        JSON.stringify({
          ts: Date.now(),
          setActivo,
          puntoActual,
          setupCompleto,
          puntosCerrados,
        })
      );
    } catch {
      /* noop */
    }
  }, [partidoId, setActivo, puntoActual, setupCompleto, puntosCerrados]);

  useEffect(() => {
    if (!partidoId) return;
    const raw = localStorage.getItem(CLAVE_V2 + partidoId);
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      if (data.setActivo) setSetActivo(data.setActivo);
      if (data.setupCompleto !== undefined)
        setSetupCompleto(data.setupCompleto);
      const cerrados: Record<number, PuntoCerrado> =
        data.puntosCerrados ?? {};
      setPuntosCerrados(cerrados);
      const pto = data.puntoActual ?? 1;
      setPuntoActual(pto);
      cargarPuntoDesde(cerrados, pto);
    } catch {
      /* noop */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partidoId]);

  // ============================================================
  // HANDLERS DE CLICK EN CANCHA
  // ============================================================

  const handleMiniClick = (coords: CoordsV2) => {
    if (!setupCompleto) return;
    if (colaPopups.length > 0) setColaPopups([]);

    const punto: PuntoV2 = { celda: coords.celda, mini: coords.mini };

    if (circuloSinArmar && mismaMini(circuloSinArmar, punto)) {
      setCirculoArmado(circuloSinArmar);
      setCirculoSinArmar(null);
      return;
    }
    if (circuloArmado && mismaMini(circuloArmado, punto)) {
      setCirculoSinArmar(circuloArmado);
      setCirculoArmado(null);
      setDesviosPendientes([]);
      return;
    }

    // ---------- CÍRCULO ARMADO ----------
    if (circuloArmado) {
      if (coords.zona === "red") {
        const linea: LineaClasificada = {
          id: `l-${contadorId}`,
          tipo: "toque-red",
          esRival: false,
          jugadorId: null,
          origen: circuloArmado,
          destino: punto,
          desvios:
            desviosPendientes.length > 0 ? [...desviosPendientes] : undefined,
          subtipo: null,
        };
        setLineas((prev) => [...prev, linea]);
        setContadorId((c) => c + 1);
        setDesviosPendientes([]);
        setCirculoSinArmar(punto);
        setCirculoArmado(null);
        setEstrella(null);
        setColaPopups([
          {
            tipo: "toque-red",
            pos: posicionPopup(punto),
            lineaId: linea.id,
          },
        ]);
        return;
      }

      if (esCeldaBloqueo(punto.celda)) {
        setDesviosPendientes((prev) => [...prev, punto]);
        return;
      }

      crearLinea(circuloArmado, punto);
      return;
    }

    // ---------- CÍRCULO SIN ARMAR ----------
    if (circuloSinArmar) {
      if (coords.zona === "red") {
        setColaPopups([
          {
            tipo: "toque-red",
            pos: posicionPopup(punto),
            lineaId: "",
          },
        ]);
        return;
      }

      if (esCanchaPropia(punto.celda)) {
        setEstrella(punto);
        return;
      }

      if (
        esCanchaRival(punto.celda) ||
        esCeldaBloqueo(punto.celda) ||
        punto.celda.startsWith("FUERA-")
      ) {
        const oculta: LineaClasificada = {
          id: `l-${contadorId}`,
          tipo: "libre",
          esRival: false,
          jugadorId: null,
          origen: circuloSinArmar,
          destino: punto,
          oculta: true,
          subtipo: null,
        };
        setLineas((prev) => [...prev, oculta]);
        setContadorId((c) => c + 1);
        setCirculoSinArmar(punto);
        setCirculoArmado(null);
        setEstrella(null);
        setDesviosPendientes([]);
        return;
      }

      return;
    }

    setCirculoSinArmar(punto);
  };

  const handleClickCirculo = () => {
    if (circuloSinArmar) {
      setCirculoArmado(circuloSinArmar);
      setCirculoSinArmar(null);
      return;
    }
    if (circuloArmado) {
      setCirculoSinArmar(circuloArmado);
      setCirculoArmado(null);
      setDesviosPendientes([]);
    }
  };

  const crearLinea = (origen: PuntoV2, destino: PuntoV2) => {
    if (!rotacionEfectiva) return;

    const estado: EstadoClasificacion = {
      saqueInicial,
      situacion,
      rotacion: rotacionEfectiva,
      lineas,
    };

    const res = clasificarLinea(estado, { origen, destino });

    const nueva: LineaClasificada = {
      id: `l-${contadorId}`,
      tipo: res.tipo,
      esRival: res.esRival,
      jugadorId: res.jugadorId,
      origen,
      destino,
      desvios:
        desviosPendientes.length > 0 ? [...desviosPendientes] : undefined,
      subtipo: null,
    };

    setLineas((prev) => [...prev, nueva]);
    setContadorId((c) => c + 1);
    setDesviosPendientes([]);

    setCirculoSinArmar(destino);
    setCirculoArmado(null);

    const cola: PopupEnCola[] = [];
    const pos = posicionPopup(destino);
    if (res.popup) {
      cola.push({ tipo: res.popup, pos, lineaId: nueva.id });
    }
    if (estrella) {
      cola.push({ tipo: "jugador", pos, lineaId: nueva.id });
    }
    setColaPopups(cola);

    setEstrella(null);
  };

  // ============================================================
  // BORRAR
  // ============================================================

  const handleBorrarUltima = () => {
    if (lineas.length === 0) {
      if (circuloArmado || circuloSinArmar) {
        setCirculoArmado(null);
        setCirculoSinArmar(null);
        setDesviosPendientes([]);
        setEstrella(null);
      }
      return;
    }
    const ultima = lineas[lineas.length - 1];
    setLineas((prev) => prev.slice(0, -1));
    setCirculoSinArmar(ultima.origen);
    setCirculoArmado(null);
    setDesviosPendientes([]);
    setEstrella(null);
    setColaPopups([]);
  };

  const handleBorrarPunto = () => {
    if (
      lineas.length > 0 &&
      !confirm("¿Borrar todas las líneas de este punto?")
    )
      return;
    setLineas([]);
    setCirculoSinArmar(null);
    setCirculoArmado(null);
    setDesviosPendientes([]);
    setEstrella(null);
    setColaPopups([]);
    setContadorId(1);

    // Si estaba cerrado, lo des-cerramos
    if (puntoActualCerrado) {
      const copia = { ...puntosCerrados };
      delete copia[puntoActual];
      setPuntosCerrados(copia);
    }
  };

  // ============================================================
  // CERRAR PUNTO (solo memoria + localStorage)
  // ============================================================

  const handleCerrarPunto = () => {
    if (lineas.length === 0) return;
    if (!rotacion) {
      alert("Falta rotación.");
      return;
    }

    const ganador = ganadorDelPunto(lineas);
    if (!ganador) {
      alert("No se puede determinar el ganador todavía.");
      return;
    }

    const punto: PuntoCerrado = {
      numero: puntoActual,
      lineas,
      saqueInicial,
      situacion,
      ganador,
      rotacion,
      liberos,
      posicionesPunto,
      cambios: cambiosPendientes,
    };

    const eraCerrado = puntoActualCerrado;

    if (eraCerrado) {
      // Sobreescribir sin avanzar
      setPuntosCerrados((prev) => ({ ...prev, [puntoActual]: punto }));
      return;
    }

    // Nuevo: guardar + avanzar
    const nuevosCerrados: Record<number, PuntoCerrado> = {
      ...puntosCerrados,
      [puntoActual]: punto,
    };
    setPuntosCerrados(nuevosCerrados);

    const siguiente = puntoActual + 1;
    setPuntoActual(siguiente);
    cargarPuntoDesde(nuevosCerrados, siguiente);
  };

  // ============================================================
  // GUARDAR EN SUPABASE
  // ============================================================

  const handleGuardarSupabase = async () => {
    const lista = Object.values(puntosCerrados).sort(
      (a, b) => a.numero - b.numero
    );
    if (lista.length === 0) {
      alert("No hay puntos cerrados para guardar.");
      return;
    }
    if (
      !confirm(
        `¿Guardar ${lista.length} punto${
          lista.length !== 1 ? "s" : ""
        } en Supabase?`
      )
    )
      return;

    setGuardando(true);
    let errores = 0;
    let primerError = "";

    for (const pc of lista) {
      const puntoData: PuntoV2Data = {
        set_numero: setActivo,
        punto_numero: pc.numero,
        saque_equipo: pc.saqueInicial,
        situacion: pc.situacion,
        ganador: pc.ganador,
        rotacion: pc.rotacion as unknown as Record<string, unknown>,
        liberos: pc.liberos as unknown as Record<string, unknown>[],
        cambios: pc.cambios as unknown as Record<string, unknown>[],
        posiciones_punto: pc.posicionesPunto,
      };

      const lineasConSubtipo = calcularSubtiposAtaque(pc.lineas, pc.ganador);
      const acciones = lineasConSubtipo.map((l, i) => aAccionV2(l, i + 1));

      const res = await guardarPuntoV2(partidoId, puntoData, acciones);
      if (!res.ok) {
        errores++;
        if (!primerError) primerError = res.error ?? "desconocido";
      }
    }

    setGuardando(false);

    if (errores > 0) {
      alert(
        `⚠️ ${errores} punto(s) con error. Primer error: ${primerError}`
      );
    } else {
      alert("✅ Puntos guardados en Supabase");
    }
  };

  // ============================================================
  // POPUPS
  // ============================================================

  const popupSiguiente = () => setColaPopups((prev) => prev.slice(1));

  const actualizarLineaPopup = (cambios: Partial<LineaClasificada>) => {
    if (!popupActivo?.lineaId) return;
    setLineas((prev) =>
      prev.map((l) =>
        l.id === popupActivo.lineaId ? { ...l, ...cambios } : l
      )
    );
  };

  const handleSaqueConfirmar = (v: ValorSaque) => {
    actualizarLineaPopup({ subtipo: v });
    popupSiguiente();
  };

  const handleRecepcionConfirmar = (v: ValorRecepcion) => {
    actualizarLineaPopup({ subtipo: v });
    popupSiguiente();
  };

  const handleArmadoConfirmar = (v: ValorArmado) => {
    actualizarLineaPopup({ subtipo: v });
    popupSiguiente();
  };

  const handleDefensaConfirmar = (
    subtipo: TipoDefensa,
    jugadorId: string | null
  ) => {
    actualizarLineaPopup({ subtipo, jugadorId });
    popupSiguiente();
  };

  const handleLibreConfirmar = (jugadorId: string | null) => {
    actualizarLineaPopup({ jugadorId });
    popupSiguiente();
  };

  const handleJugadorConfirmar = (jugadorId: string | null) => {
    actualizarLineaPopup({ jugadorId });
    popupSiguiente();
  };

  const handleToqueRedConfirmar = (
    resultado: ResultadoToqueRed,
    jugadorId: string | null
  ) => {
    if (!popupActivo) return;

    const esRival = resultado === "toque-red-rival";

    if (!popupActivo.lineaId) {
      const ficticia: LineaClasificada = {
        id: `tr-${contadorId}`,
        tipo: "toque-red",
        esRival,
        jugadorId,
        origen: { celda: "RED-C3", mini: "m1-5" },
        destino: { celda: "RED-C3", mini: "m1-5" },
        subtipo: resultado,
      };
      setLineas((prev) => [...prev, ficticia]);
      setContadorId((c) => c + 1);
    } else {
      actualizarLineaPopup({ subtipo: resultado, jugadorId, esRival });
    }
    popupSiguiente();
  };

  const cerrarPopup = () => setColaPopups([]);

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

  const handleCambioRotacion = (dir: 1 | -1) => {
    if (!rotacion) return;
    const { rotacion: nueva } = girarRotacionPunto(rotacion, dir);
    setRotacion(nueva);
  };

  const handleCambioSaque = (equipo: SaqueEquipo) => {
    setSaqueInicial(equipo);
    if (rotacion) setRotacion({ ...rotacion, saque_equipo: equipo });
  };

  // ============================================================
  // NAVEGACIÓN
  // ============================================================

  const irAPunto = (n: number) => {
    if (n < 1 || n > maxNavegable) return;
    setPuntoActual(n);
    cargarPuntoDesde(puntosCerrados, n);
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
        void handleGuardarSupabase();
        return;
      }
      if (e.key === "Escape") {
        if (colaPopups.length > 0) setColaPopups([]);
        else if (desviosPendientes.length > 0)
          setDesviosPendientes((prev) => prev.slice(0, -1));
        else if (circuloArmado) {
          setCirculoSinArmar(circuloArmado);
          setCirculoArmado(null);
        } else if (circuloSinArmar) {
          setCirculoSinArmar(null);
          setEstrella(null);
        }
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        handleCerrarPunto();
        return;
      }
      if (e.key.toLowerCase() === "d" && !e.ctrlKey && !e.metaKey) {
        handleBorrarUltima();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    colaPopups,
    lineas,
    rotacion,
    puntoActual,
    circuloArmado,
    circuloSinArmar,
    desviosPendientes,
    puntosCerrados,
    saqueInicial,
    situacion,
    liberos,
    posicionesPunto,
    cambiosPendientes,
  ]);

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
                  onCambioRotacion={handleCambioRotacion}
                  onCambioSaque={handleCambioSaque}
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
                    onClick={() => handleCambioSaque("propio")}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                      saqueInicial === "propio"
                        ? "bg-emerald-500 text-white"
                        : "bg-white text-slate-700 border border-slate-300"
                    }`}
                  >
                    {nombreMiEquipo}
                  </button>
                  <button
                    onClick={() => handleCambioSaque("rival")}
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
              onClick={() => irAPunto(puntoActual - 1)}
              disabled={puntoActual === 1}
              className="w-7 h-7 flex items-center justify-center rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-30"
            >
              ◀
            </button>
            <span>
              <strong>Set {setActivo}</strong> · Punto{" "}
              <strong>{puntoActual}</strong>
              {puntoActualCerrado && (
                <span className="ml-1 text-emerald-600 text-xs">✓ cerrado</span>
              )}
              {" · "}Saca:{" "}
              <strong>
                {saqueInicial === "propio" ? nombreMiEquipo : nombreRival}
              </strong>
            </span>
            <button
              onClick={() => irAPunto(puntoActual + 1)}
              disabled={puntoActual + 1 > maxNavegable}
              className="w-7 h-7 flex items-center justify-center rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-30"
            >
              ▶
            </button>
          </div>
          <span className="text-xs text-slate-400">
            {lineas.filter((l) => !l.oculta).length} línea
            {lineas.filter((l) => !l.oculta).length !== 1 ? "s" : ""}
            {circuloArmado
              ? " · armado (naranja)"
              : circuloSinArmar
              ? " · click en el círculo"
              : ""}
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
                  onCambioRotacion={handleCambioRotacion}
                  onCambioSaque={handleCambioSaque}
                />
              )}
              <div className="bg-white border border-slate-200 rounded-lg p-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Secuencia
                </p>
                <ol className="text-[11px] text-slate-700 space-y-0.5">
                  {lineas
                    .filter((l) => !l.oculta)
                    .map((l, i) => (
                      <li key={l.id} className="flex items-center gap-1">
                        <span className="w-4 text-slate-400 font-mono">
                          {i + 1}.
                        </span>
                        <span className="font-medium">{l.tipo}</span>
                        {l.desvios && l.desvios.length > 0 && (
                          <span className="text-orange-600 text-[10px]">
                            ({l.desvios.length} desvío
                            {l.desvios.length !== 1 ? "s" : ""})
                          </span>
                        )}
                        {l.subtipo !== undefined && l.subtipo !== null && (
                          <span className="text-slate-400">
                            ({String(l.subtipo)})
                          </span>
                        )}
                      </li>
                    ))}
                  {lineas.filter((l) => !l.oculta).length === 0 && (
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

              <CanchaV2 orientacion={orientacion} onMiniClick={handleMiniClick}>
                <LineasV2
                  lineas={lineasParaUI}
                  origenActivo={origenActivoParaUI}
                  armado={!!circuloArmado}
                  desviosPendientes={desviosPendientes}
                  estrella={estrella}
                  orientacion={orientacion}
                  onClickCirculo={handleClickCirculo}
                />

                {popupActivo?.tipo === "saque" && (
                  <PopupSaque
                    pos={popupActivo.pos}
                    onConfirmar={handleSaqueConfirmar}
                    onCancelar={cerrarPopup}
                  />
                )}
                {popupActivo?.tipo === "recepcion" && (
                  <PopupRecepcion
                    pos={popupActivo.pos}
                    onConfirmar={handleRecepcionConfirmar}
                    onCancelar={cerrarPopup}
                  />
                )}
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
                {popupActivo?.tipo === "jugador" && (
                  <PopupJugador
                    pos={popupActivo.pos}
                    jugadores={jugadoresEnCancha}
                    onConfirmar={handleJugadorConfirmar}
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
                disabled={
                  lineas.length === 0 && !circuloArmado && !circuloSinArmar
                }
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
            <div className="flex gap-2">
              <button
                onClick={handleGuardarSupabase}
                disabled={
                  guardando || Object.keys(puntosCerrados).length === 0
                }
                className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg disabled:opacity-40"
              >
                {guardando ? "Guardando..." : "💾 Guardar en Supabase"}
              </button>
              <button
                onClick={handleCerrarPunto}
                disabled={lineas.length === 0}
                className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg disabled:opacity-40"
              >
                ✓ Cerrar punto (Enter)
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-400 text-center">
            Click en mini → círculo blanco. Click en el círculo → armado
            (naranja ✓).
            <br />
            Sin armar: click propia = ⭐, click rival = rompe línea (libre).
            Armado: click en bloqueo = desvío, click en cualquier otra = línea.
            <br />
            <strong>Atajos:</strong> Esc (desarmar/borrar desvío) · Enter
            (cerrar) · D (borrar última) · Ctrl+G (guardar en Supabase)
          </p>
        </>
      )}
    </div>
  );
}