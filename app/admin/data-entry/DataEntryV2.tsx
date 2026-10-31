"use client";

import { useEffect, useMemo, useState } from "react";
import CanchaV2, {
  type Orientacion,
} from "./CanchaV2";
import LineasV2, { type PuntoV2 } from "./LineasV2";

import BarraMarcadorV2 from "./BarraMarcadorV2";
import BotonesAccionV2 from "./BotonesAccionV2";
import PopupsV2 from "./PopupsV2";
import SecuenciaV2 from "./SecuenciaV2";
import SetupInicialV2 from "./SetupInicialV2";
import CierreSetBanner from "./CierreSetBanner";
import CierrePartidoBanner from "./CierrePartidoBanner";
import ReabrirSetConfirm from "./ReabrirSetConfirm";

import { supabase } from "@/lib/supabase";

import {
  aLineaV2,
  calcularRecepcionOverrides,
  rolCortoParaUI,
} from "./helpersV2";
import {
  CLAVE_POSICIONES_FIJAS,
  CLAVE_V2,
  POSICIONES_VACIAS,
  VERSION_SCHEMA_LOCAL,
  clavePunto,
  esTieBreak,
  maxSetsDeFormato,
  puntosParaGanarSet,
  setTerminado,
  setsNecesariosParaGanar,
  type FormatoPartido,
  type Jugador,
  type PartidoCerrado,
  type PopupEnCola,
  type PosicionesFijasMap,
  type Props,
  type PuntoCerrado,
  type PuntosPorSet,
  type SetCerrado,
  type SetsCerrados,
} from "./tiposV2";

import {
  girarRotacionPunto,
  numeroRotacionDesdePosiciones,
  rotacionVacia,
  type Libero,
  type RotacionPunto,
  type SaqueEquipo,
  type Zona,
} from "@/lib/rotaciones";
import {
  POSICIONES_JUEGO,
  calcularErroresRival,
  calcularSubtiposAtaque,
  calcularSubtiposAtaqueRival,
  calcularSubtiposBloqueo,
  calcularSubtiposDefensa,
  calcularSubtiposSaque,
  ganadorDelPunto,
  resolverRolAJugador,
  type LineaClasificada,
  type Situacion,
} from "@/lib/clasificacionV2";

import type { CambioPendiente } from "./PanelRotacionV2";

// Archivos extraídos
import { cargarPuntoDesde as cargarPuntoDesdeHelper } from "./cargarPuntoV2";
import { cargarEstadoDesdeDB } from "./cargaDBV2";
import { guardarPuntosEnSupabase } from "./guardarSupabaseV2";
import { crearHandlersPopups } from "./handlersPopupsV2";
import { crearHandlersCancha } from "./handlersCanchaV2";

// ============================================================
// HELPERS DE MIGRACIÓN LOCALSTORAGE v1 → v2
// ============================================================

interface LocalStorageV2Data {
  version: number;
  setActivo: number;
  puntoActual: number;
  setupCompleto: boolean;
  formatoPartido: FormatoPartido;
  puntosCerrados: PuntosPorSet;
  setsCerrados: SetsCerrados;
  partidoCerrado: PartidoCerrado | null;
  rotacion: RotacionPunto | null;
  saqueInicial: "propio" | "rival";
  liberos: Libero[];
  posicionesPunto: Record<Zona, string>;
  cambiosPendientes: CambioPendiente[];
  lineas: LineaClasificada[];
  contadorId: number;
  modoEspejo: boolean;
  equipoRivalId: string | null;
  rotacionRival: RotacionPunto | null;
  liberosRival: Libero[];
  posicionesPuntoRival: Record<Zona, string>;
  cambiosPendientesRival: CambioPendiente[];
}

/**
 * Migra data vieja (v1) a v2:
 *   - Asigna set_numero = 1 a todos los puntos.
 *   - Cambia la clave de "punto" a "1-punto".
 *   - Inicializa setsCerrados = {}, partidoCerrado = null,
 *     formatoPartido = "bo3".
 */
function migrarV1aV2(raw: any): any {
  const puntosCerradosViejos: Record<number, any> = raw.puntosCerrados ?? {};
  const puntosCerradosNuevos: PuntosPorSet = {};
  for (const [numStr, pc] of Object.entries(puntosCerradosViejos)) {
    const num = parseInt(numStr, 10);
    if (isNaN(num)) continue;
    const pcMigrado = {
      ...pc,
      numero: num,
      set_numero: pc.set_numero ?? 1,
    };
    puntosCerradosNuevos[clavePunto(pcMigrado.set_numero, num)] = pcMigrado;
  }
  return {
    ...raw,
    puntosCerrados: puntosCerradosNuevos,
    setsCerrados: raw.setsCerrados ?? {},
    partidoCerrado: raw.partidoCerrado ?? null,
    formatoPartido: raw.formatoPartido ?? "bo3",
    version: VERSION_SCHEMA_LOCAL,
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
  equiposDisponibles,
}: Props) {
  // ===== Estado principal =====
  const [puntosCerrados, setPuntosCerrados] = useState<PuntosPorSet>({});
  const [setsCerrados, setSetsCerrados] = useState<SetsCerrados>({});
  const [partidoCerrado, setPartidoCerrado] =
    useState<PartidoCerrado | null>(null);

  const [setActivo, setSetActivo] = useState<number>(1);
  const [puntoActual, setPuntoActual] = useState<number>(1);

  const [formatoPartido, setFormatoPartido] =
    useState<FormatoPartido>("bo3");

  // ===== Estado del punto en edición =====
  const [lineas, setLineas] = useState<LineaClasificada[]>([]);
  const [circuloSinArmar, setCirculoSinArmar] = useState<PuntoV2 | null>(null);
  const [circuloArmado, setCirculoArmado] = useState<PuntoV2 | null>(null);
  const [desviosPendientes, setDesviosPendientes] = useState<PuntoV2[]>([]);
  const [estrella, setEstrella] = useState<PuntoV2 | null>(null);
  const [colaPopups, setColaPopups] = useState<PopupEnCola[]>([]);
  const [contadorId, setContadorId] = useState(1);

  const [saqueInicial, setSaqueInicial] = useState<"propio" | "rival">("propio");
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

  const [posicionesFijas, setPosicionesFijas] = useState<PosicionesFijasMap>(
    {}
  );

  // ===== Modo espejo =====
  const [modoEspejo, setModoEspejo] = useState(false);
  const [equipoRivalId, setEquipoRivalId] = useState<string | null>(null);
  const [jugadoresRival, setJugadoresRival] = useState<Jugador[]>([]);
  const [rotacionRival, setRotacionRival] = useState<RotacionPunto | null>(null);
  const [liberosRival, setLiberosRival] = useState<Libero[]>([]);
  const [posicionesPuntoRival, setPosicionesPuntoRival] = useState<
    Record<Zona, string>
  >(() => ({ ...POSICIONES_VACIAS }));
  const [cambiosPendientesRival, setCambiosPendientesRival] = useState<
    CambioPendiente[]
  >([]);
  const [posicionesFijasRival, setPosicionesFijasRival] =
    useState<PosicionesFijasMap>({});

  // ===== UI =====
  const [orientacion, setOrientacion] = useState<Orientacion>("vertical");
  const [guardando, setGuardando] = useState(false);
  const [setupCompleto, setSetupCompleto] = useState(false);
  const [hidratado, setHidratado] = useState(false);

  // ===== Banners y modales =====
  const [bannerSet, setBannerSet] = useState<SetCerrado | null>(null);
  const [bannerPartido, setBannerPartido] =
    useState<PartidoCerrado | null>(null);
  const [setAReabrir, setSetAReabrir] = useState<SetCerrado | null>(null);

  // ===== Armado automático =====
  const [armadoAutomatico, setArmadoAutomatico] = useState<boolean>(true);

  // ===== Derivados =====
  const claveActual = clavePunto(setActivo, puntoActual);
  const puntoActualCerrado = !!puntosCerrados[claveActual];
  const setCerradoActual = !!setsCerrados[setActivo];

  const setsPropios = useMemo(
    () =>
      Object.values(setsCerrados).filter((s) => s.ganador === "propio")
        .length,
    [setsCerrados]
  );
  const setsRivales = useMemo(
    () =>
      Object.values(setsCerrados).filter((s) => s.ganador === "rival")
        .length,
    [setsCerrados]
  );

  const maxSets = maxSetsDeFormato(formatoPartido);

  /** Todos los puntos cerrados del set activo. */
  const puntosDelSetActivo = useMemo(() => {
    return Object.values(puntosCerrados)
      .filter((p) => p.set_numero === setActivo)
      .sort((a, b) => a.numero - b.numero);
  }, [puntosCerrados, setActivo]);

  /** Marcador del set activo. */
  const marcadorSetActivo = useMemo(() => {
    let propios = 0;
    let rivales = 0;
    for (const p of puntosDelSetActivo) {
      if (p.ganador === "propio") propios++;
      else rivales++;
    }
    return { propios, rivales };
  }, [puntosDelSetActivo]);

  /** Máximo navegable en el set activo. */
  const maxNavegable = useMemo(() => {
    const ultimo =
      puntosDelSetActivo.length > 0
        ? puntosDelSetActivo[puntosDelSetActivo.length - 1].numero
        : 0;
    return ultimo + 1;
  }, [puntosDelSetActivo]);

  const situacion: Situacion =
    saqueInicial === "propio" ? "saque" : "recepcion";

  const situacionRival: Situacion =
    saqueInicial === "rival" ? "saque" : "recepcion";

  const popupActivo = colaPopups[0] ?? null;

  const clavePosicionesFijas = useMemo(() => {
    if (!rotacion) return "";
    const numRot = numeroRotacionDesdePosiciones(rotacion);
    return `${numRot}-${situacion}`;
  }, [rotacion, situacion]);

  const clavePosicionesFijasRival = useMemo(() => {
    if (!rotacionRival) return "";
    const numRot = numeroRotacionDesdePosiciones(rotacionRival);
    return `${numRot}-${situacionRival}`;
  }, [rotacionRival, situacionRival]);

  const posicionesFijasActuales: Record<Zona, string> = useMemo(() => {
    if (!clavePosicionesFijas) return { ...POSICIONES_VACIAS };
    return posicionesFijas[clavePosicionesFijas] ?? { ...POSICIONES_VACIAS };
  }, [posicionesFijas, clavePosicionesFijas]);

  const posicionesFijasActualesRival: Record<Zona, string> = useMemo(() => {
    if (!clavePosicionesFijasRival) return { ...POSICIONES_VACIAS };
    return (
      posicionesFijasRival[clavePosicionesFijasRival] ?? {
        ...POSICIONES_VACIAS,
      }
    );
  }, [posicionesFijasRival, clavePosicionesFijasRival]);

  const rotacionEfectiva = useMemo<RotacionPunto | null>(() => {
    if (!rotacion) return null;
    const zonas: Zona[] = [1, 2, 3, 4, 5, 6];
    let cambio = false;
    const nuevas = { ...rotacion.posiciones };
    for (const z of zonas) {
      const override = posicionesPunto[z] || posicionesFijasActuales[z];
      if (override && override !== nuevas[z]?.jugador_id) {
        nuevas[z] = { ...nuevas[z], jugador_id: override };
        cambio = true;
      }
    }
    return {
      ...(cambio ? { ...rotacion, posiciones: nuevas } : rotacion),
      liberos,
    };
  }, [rotacion, posicionesPunto, liberos, posicionesFijasActuales]);

  const rotacionRivalEfectiva = useMemo<RotacionPunto | null>(() => {
    if (!rotacionRival) return null;
    const zonas: Zona[] = [1, 2, 3, 4, 5, 6];
    let cambio = false;
    const nuevas = { ...rotacionRival.posiciones };
    for (const z of zonas) {
      const override =
        posicionesPuntoRival[z] || posicionesFijasActualesRival[z];
      if (override && override !== nuevas[z]?.jugador_id) {
        nuevas[z] = { ...nuevas[z], jugador_id: override };
        cambio = true;
      }
    }
    return {
      ...(cambio ? { ...rotacionRival, posiciones: nuevas } : rotacionRival),
      liberos: liberosRival,
    };
  }, [
    rotacionRival,
    posicionesPuntoRival,
    liberosRival,
    posicionesFijasActualesRival,
  ]);

  const jugadoresEnCancha = useMemo(() => {
    if (!rotacion) return [];
    const numeroRot = numeroRotacionDesdePosiciones(rotacion);
    const fila = POSICIONES_JUEGO[numeroRot]?.[situacion];
    const rotConLib: RotacionPunto = { ...rotacion, liberos };

    const zonasOrden: Zona[] = [1, 2, 3, 4, 5, 6];
    const out: { id: string; nombre: string; rol: string; zona: number }[] = [];

    for (const z of zonasOrden) {
      const rol = fila?.[z];
      if (!rol) continue;
      let id: string | null = null;
      if (posicionesPunto[z]) {
        id = posicionesPunto[z];
      } else {
        id = resolverRolAJugador(rotConLib, rol);
      }
      if (!id) continue;
      const j = jugadores.find((x) => x.id === id);
      const nombre = j
        ? j.nombre + (j.numero !== null ? ` #${j.numero}` : "")
        : "?";
      out.push({ id, nombre, rol: rolCortoParaUI(rol), zona: z });
    }
    return out;
  }, [rotacion, situacion, liberos, posicionesPunto, jugadores]);

  const delanterosPorZona = useMemo(() => {
    if (!rotacionEfectiva) return [];
    return ([4, 3, 2] as const).map((z) => {
      const asig = rotacionEfectiva.posiciones[z as Zona];
      const id = asig?.jugador_id ?? null;
      const jugador = id ? jugadores.find((j) => j.id === id) : null;
      return { zona: z, jugadorId: id, nombre: jugador ? jugador.nombre : "(vacío)" };
    });
  }, [rotacionEfectiva, jugadores]);

  const delanterosPorZonaRival = useMemo(() => {
    if (!rotacionRivalEfectiva) return [];
    return ([4, 3, 2] as const).map((z) => {
      const asig = rotacionRivalEfectiva.posiciones[z as Zona];
      const id = asig?.jugador_id ?? null;
      const jugador = id ? jugadoresRival.find((j) => j.id === id) : null;
      return { zona: z, jugadorId: id, nombre: jugador ? jugador.nombre : "(vacío)" };
    });
  }, [rotacionRivalEfectiva, jugadoresRival]);

  const recepcionOverridesEfectivos = useMemo(
    () => calcularRecepcionOverrides(posicionesFijasActuales, posicionesPunto),
    [posicionesFijasActuales, posicionesPunto]
  );

  const recepcionOverridesRival = useMemo(
    () => calcularRecepcionOverrides(posicionesFijasActualesRival, posicionesPuntoRival),
    [posicionesFijasActualesRival, posicionesPuntoRival]
  );

  const lineasParaUI = useMemo(() => lineas.map(aLineaV2), [lineas]);
  const origenActivoParaUI: PuntoV2 | null = circuloSinArmar ?? circuloArmado;

  const marcador = {
    propio: marcadorSetActivo.propios,
    rival: marcadorSetActivo.rivales,
  };

  const secuenciaConValores = useMemo(() => {
    const conSaque = calcularSubtiposSaque(lineas);
    const ganadorActual = ganadorDelPunto(conSaque);
    const conAtaqueRival = calcularSubtiposAtaqueRival(conSaque);
    const conBloqueo = calcularSubtiposBloqueo(conAtaqueRival);
    const conDefensa = calcularSubtiposDefensa(conBloqueo);
    const conAtaque = ganadorActual
      ? calcularSubtiposAtaque(conDefensa, ganadorActual)
      : conDefensa;
    const conErroresRival = calcularErroresRival(conAtaque);
    return conErroresRival.filter((l) => !l.oculta);
  }, [lineas]);

  const nombreDeJugador = (id: string | null): string => {
    if (!id) return "—";
    const j = jugadores.find((x) => x.id === id);
    if (j) return j.nombre + (j.numero !== null ? ` #${j.numero}` : "");
    const jr = jugadoresRival.find((x) => x.id === id);
    if (jr) return jr.nombre + (jr.numero !== null ? ` #${jr.numero}` : "");
    return "?";
  };

  // ============================================================
  // EFECTOS
  // ============================================================

  useEffect(() => {
    if (!equipoRivalId) {
      setJugadoresRival([]);
      return;
    }
    Promise.all([
      supabase.from("jugador_equipo").select("jugador_id").eq("equipo_id", equipoRivalId).eq("activo", true),
      supabase.from("jugadores").select("id, nombre, numero"),
    ]).then(([a, j]) => {
      if (!a.data || !j.data) return;
      const ids = a.data.map((x: { jugador_id: string }) => x.jugador_id);
      const jugs = (j.data as { id: string; nombre: string; numero: number | null }[]).filter((x) => ids.includes(x.id));
      setJugadoresRival(jugs);
    });
  }, [equipoRivalId]);

  useEffect(() => {
    if (!modoEspejo || !equipoRivalId || rotacionRival) return;
    setRotacionRival(rotacionVacia(1, setActivo, puntoActual, "rival"));
  }, [modoEspejo, equipoRivalId, rotacionRival, setActivo, puntoActual]);

  // Persistencia de posiciones fijas
  useEffect(() => {
    if (!partidoId || !hidratado) return;
    try {
      localStorage.setItem(CLAVE_POSICIONES_FIJAS + partidoId, JSON.stringify(posicionesFijas));
    } catch {}
  }, [partidoId, hidratado, posicionesFijas]);

  // Persistencia del estado completo
  useEffect(() => {
    if (!partidoId || !hidratado) return;
    try {
      const data: LocalStorageV2Data = {
        version: VERSION_SCHEMA_LOCAL,
        setActivo,
        puntoActual,
        setupCompleto,
        formatoPartido,
        puntosCerrados,
        setsCerrados,
        partidoCerrado,
        rotacion,
        saqueInicial,
        liberos,
        posicionesPunto,
        cambiosPendientes,
        lineas,
        contadorId,
        modoEspejo,
        equipoRivalId,
        rotacionRival,
        liberosRival,
        posicionesPuntoRival,
        cambiosPendientesRival,
      };
      localStorage.setItem(CLAVE_V2 + partidoId, JSON.stringify(data));
    } catch {}
  }, [
    partidoId, hidratado, setActivo, puntoActual, setupCompleto, formatoPartido,
    puntosCerrados, setsCerrados, partidoCerrado, rotacion, saqueInicial,
    liberos, posicionesPunto, cambiosPendientes, lineas, contadorId,
    modoEspejo, equipoRivalId, rotacionRival, liberosRival,
    posicionesPuntoRival, cambiosPendientesRival,
  ]);

  // Hidratación inicial
  useEffect(() => {
    if (!partidoId) return;

    const rawFijas = localStorage.getItem(CLAVE_POSICIONES_FIJAS + partidoId);
    if (rawFijas) { try { setPosicionesFijas(JSON.parse(rawFijas)); } catch {} }

    const raw = localStorage.getItem(CLAVE_V2 + partidoId);
    if (raw) {
      try {
        let data = JSON.parse(raw);
        // Migrar v1 → v2 si hace falta
        if (!data.version || data.version < VERSION_SCHEMA_LOCAL) {
          data = migrarV1aV2(data);
        }
        if (data.setupCompleto !== undefined) setSetupCompleto(data.setupCompleto);
        if (data.modoEspejo !== undefined) setModoEspejo(data.modoEspejo);
        if (data.equipoRivalId !== undefined) setEquipoRivalId(data.equipoRivalId);
        if (data.rotacionRival) setRotacionRival(data.rotacionRival);
        if (data.liberosRival) setLiberosRival(data.liberosRival);
        if (data.posicionesPuntoRival) setPosicionesPuntoRival(data.posicionesPuntoRival);
        if (data.cambiosPendientesRival) setCambiosPendientesRival(data.cambiosPendientesRival);
        if (data.formatoPartido) setFormatoPartido(data.formatoPartido);

        const cerrados: PuntosPorSet = data.puntosCerrados ?? {};
        const sets: SetsCerrados = data.setsCerrados ?? {};
        const partido: PartidoCerrado | null = data.partidoCerrado ?? null;

        setPuntosCerrados(cerrados);
        setSetsCerrados(sets);
        setPartidoCerrado(partido);

        const setPto = data.setActivo ?? 1;
        const pto = data.puntoActual ?? 1;
        setSetActivo(setPto);
        setPuntoActual(pto);

        ejecutarCargarPunto(cerrados, sets, setPto, pto);

        const claveAct = clavePunto(setPto, pto);
        if (!cerrados[claveAct]) {
          if (data.rotacion) setRotacion(data.rotacion);
          if (data.saqueInicial) setSaqueInicial(data.saqueInicial);
          if (data.liberos) setLiberos(data.liberos);
          if (data.posicionesPunto) setPosicionesPunto(data.posicionesPunto);
          if (data.cambiosPendientes) setCambiosPendientes(data.cambiosPendientes);
          if (data.lineas) setLineas(data.lineas);
          if (data.contadorId) setContadorId(data.contadorId);
        }
        setHidratado(true);
        return;
      } catch (e) {
        console.error("Error leyendo localStorage:", e);
      }
    }

    // Fallback: cargar desde Supabase
    (async () => {
      try {
        const estado = await cargarEstadoDesdeDB(
          partidoId,
          equipoId,
          formatoPartido
        );
        setPuntosCerrados(estado.puntosCerrados);
        setSetsCerrados(estado.setsCerrados);
        setPartidoCerrado(estado.partidoCerrado);
        setSetActivo(estado.setActivoRecomendado);
        setPuntoActual(estado.puntoActivoRecomendado);

        ejecutarCargarPunto(
          estado.puntosCerrados,
          estado.setsCerrados,
          estado.setActivoRecomendado,
          estado.puntoActivoRecomendado
        );

        if (Object.keys(estado.puntosCerrados).length > 0) {
          setSetupCompleto(true);
        }
      } catch (e) {
        console.error("Error cargando desde Supabase:", e);
      }
      setHidratado(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partidoId]);

  // ============================================================
  // CARGA DE PUNTO
  // ============================================================

  const ejecutarCargarPunto = (
    puntos: PuntosPorSet,
    sets: SetsCerrados,
    setNum: number,
    ptoNum: number
  ) => {
    cargarPuntoDesdeHelper(
      puntos,
      sets,
      setNum,
      ptoNum,
      modoEspejo,
      rotacionInicial,
      {
        setLineas,
        setCirculoSinArmar,
        setCirculoArmado,
        setDesviosPendientes,
        setEstrella,
        setColaPopups,
        setContadorId,
        setSaqueInicial,
        setRotacion,
        setLiberos,
        setPosicionesPunto,
        setCambiosPendientes,
        setRotacionRival,
        setLiberosRival,
        setPosicionesPuntoRival,
        setCambiosPendientesRival,
      }
    );
  };

  // ============================================================
  // HANDLERS DE CANCHA Y POPUPS
  // ============================================================

  const { handleMiniClick, handleClickCirculo } = crearHandlersCancha({
    setupCompleto,
    armadoAutomatico,
    colaPopups, circuloSinArmar, circuloArmado,
    desviosPendientes, estrella, contadorId, lineas, equipoId,
    equipoRivalId, modoEspejo, saqueInicial, situacion, situacionRival,
    rotacionEfectiva, rotacionRivalEfectiva, recepcionOverridesEfectivos,
    recepcionOverridesRival, setColaPopups, setCirculoSinArmar,
    setCirculoArmado, setDesviosPendientes, setEstrella, setLineas, setContadorId,
  });

  const {
    popupSiguiente, cerrarPopup, handleSaqueConfirmar, handleTipoSaqueConfirmar,
    handleRecepcionConfirmar, handleArmadoConfirmar, handleVelocidadConfirmar,
    handleDefensaX2Change, handleDefensaConfirmar, handleLibreConfirmar,
    handleJugadorConfirmar, handleBloqueoConfirmar, handleRoceRedConfirmar,
    handleAtaqueToqueLibreConfirmar, handleRemateSegundaConfirmar,
    handleArmadoCruzadoConfirmar, handleVarianteRemateSegundaConfirmar,
  } = crearHandlersPopups({
    popupActivo, lineas, contadorId, equipoId, equipoRivalId,
    setLineas, setColaPopups, setContadorId, setDesviosPendientes,
  });

  // ============================================================
  // HANDLERS DE CIERRE DE SET / PARTIDO
  // ============================================================

  const cerrarSet = (
    ganador: "propio" | "rival",
    propios: number,
    rivales: number,
    nuevosCerrados: PuntosPorSet
  ) => {
    if (!rotacion) {
      alert("Falta la rotación para cerrar el set.");
      return;
    }

    const setCerradoNuevo: SetCerrado = {
      numero: setActivo,
      ganador,
      puntosPropios: propios,
      puntosRivales: rivales,
      rotacionAlCerrar: rotacion,
      liberosAlCerrar: liberos,
    };

    const nuevosSets: SetsCerrados = {
      ...setsCerrados,
      [setActivo]: setCerradoNuevo,
    };
    setSetsCerrados(nuevosSets);
    setBannerSet(setCerradoNuevo);

    const needed = setsNecesariosParaGanar(formatoPartido);
    const setsProp = Object.values(nuevosSets).filter(
      (s) => s.ganador === "propio"
    ).length;
    const setsRiv = Object.values(nuevosSets).filter(
      (s) => s.ganador === "rival"
    ).length;

    if (setsProp >= needed || setsRiv >= needed) {
      const ganadorPartido: "propio" | "rival" =
        setsProp > setsRiv ? "propio" : "rival";
      const pc: PartidoCerrado = {
        ganador: ganadorPartido,
        setsPropios: setsProp,
        setsRivales: setsRiv,
      };
      setPartidoCerrado(pc);
      setBannerPartido(pc);
      return;
    }

    const siguienteSet = setActivo + 1;
    if (siguienteSet <= maxSets) {
      navegarASetInterno(nuevosCerrados, nuevosSets, siguienteSet);
    }
  };

  const navegarASetInterno = (
    puntos: PuntosPorSet,
    sets: SetsCerrados,
    nuevoSet: number
  ) => {
    const puntosDelSet = Object.values(puntos)
      .filter((p) => p.set_numero === nuevoSet)
      .sort((a, b) => a.numero - b.numero);
    const ultimo =
      puntosDelSet.length > 0
        ? puntosDelSet[puntosDelSet.length - 1].numero
        : 0;
    const ptoTarget = ultimo + 1;

    setSetActivo(nuevoSet);
    setPuntoActual(ptoTarget);
    ejecutarCargarPunto(puntos, sets, nuevoSet, ptoTarget);

    if (ptoTarget === 1 && nuevoSet > 1) {
      const clavePrimeroAnterior = clavePunto(nuevoSet - 1, 1);
      const primerAnterior = puntos[clavePrimeroAnterior];
      if (primerAnterior) {
        const saqueOpuesto: "propio" | "rival" =
          primerAnterior.saqueInicial === "propio" ? "rival" : "propio";
        setSaqueInicial(saqueOpuesto);
        setRotacion((prev) =>
          prev ? { ...prev, saque_equipo: saqueOpuesto } : prev
        );
        if (modoEspejo && rotacionRival) {
          setRotacionRival((prev) =>
            prev
              ? {
                  ...prev,
                  saque_equipo: saqueOpuesto === "propio" ? "rival" : "propio",
                }
              : prev
          );
        }
      }
    }
  };

  // ============================================================
  // HANDLERS DE BORRADO Y EDICIÓN
  // ============================================================

  const handleBorrarUltima = () => {
    if (setCerradoActual) return;
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
    if (setCerradoActual) return;
    const enFullscreen = !!document.fullscreenElement;
    if (
      lineas.length > 0 &&
      !enFullscreen &&
      !confirm("¿Borrar todas las líneas de este punto?")
    ) {
      return;
    }
    setLineas([]);
    setCirculoSinArmar(null);
    setCirculoArmado(null);
    setDesviosPendientes([]);
    setEstrella(null);
    setColaPopups([]);
    setContadorId(1);

    if (puntoActualCerrado) {
      const copia = { ...puntosCerrados };
      delete copia[claveActual];
      setPuntosCerrados(copia);
    }
  };

  const handleBorrarLocal = () => {
    const enFullscreen = !!document.fullscreenElement;
    if (
      !enFullscreen &&
      !confirm(
        "¿Borrar los datos guardados en ESTE navegador para este partido?\n\nNO toca Supabase. Si ya guardaste en Supabase, al recargar se recupera desde ahí."
      )
    ) {
      return;
    }
    try {
      localStorage.removeItem(CLAVE_V2 + partidoId);
      localStorage.removeItem(CLAVE_POSICIONES_FIJAS + partidoId);
    } catch {}

    setPuntosCerrados({});
    setSetsCerrados({});
    setPartidoCerrado(null);
    setSetActivo(1);
    setPuntoActual(1);
    setLineas([]);
    setCirculoSinArmar(null);
    setCirculoArmado(null);
    setDesviosPendientes([]);
    setEstrella(null);
    setColaPopups([]);
    setContadorId(1);
    setSaqueInicial("propio");
    setRotacion(rotacionInicial ?? null);
    setLiberos([]);
    setPosicionesPunto({ ...POSICIONES_VACIAS });
    setCambiosPendientes([]);
    setPosicionesFijas({});
    setModoEspejo(false);
    setEquipoRivalId(null);
    setJugadoresRival([]);
    setRotacionRival(null);
    setLiberosRival([]);
    setPosicionesPuntoRival({ ...POSICIONES_VACIAS });
    setCambiosPendientesRival([]);
    setPosicionesFijasRival({});
    setSetupCompleto(false);
    setBannerSet(null);
    setBannerPartido(null);

    (async () => {
      try {
        const estado = await cargarEstadoDesdeDB(
          partidoId,
          equipoId,
          formatoPartido
        );
        setPuntosCerrados(estado.puntosCerrados);
        setSetsCerrados(estado.setsCerrados);
        setPartidoCerrado(estado.partidoCerrado);
        setSetActivo(estado.setActivoRecomendado);
        setPuntoActual(estado.puntoActivoRecomendado);
        ejecutarCargarPunto(
          estado.puntosCerrados,
          estado.setsCerrados,
          estado.setActivoRecomendado,
          estado.puntoActivoRecomendado
        );
        if (Object.keys(estado.puntosCerrados).length > 0) {
          setSetupCompleto(true);
        }
      } catch (e) {
        console.error("Error recargando desde Supabase:", e);
      }
    })();
  };

  // ============================================================
  // HANDLERS DE CIERRE DE PUNTO
  // ============================================================

  const handleCerrarPunto = () => {
    if (setCerradoActual) return;
    if (lineas.length === 0) return;
    if (!rotacion) { alert("Falta rotación."); return; }
    const ganador = ganadorDelPunto(lineas);
    if (!ganador) { alert("No se puede determinar el ganador todavía."); return; }

    const punto: PuntoCerrado = {
      numero: puntoActual,
      set_numero: setActivo,
      lineas,
      saqueInicial,
      situacion,
      ganador,
      rotacion,
      liberos,
      posicionesPunto,
      cambios: cambiosPendientes,
      equipoId:
        saqueInicial === "propio" ? equipoId : equipoRivalId ?? undefined,
      estadoRival:
        modoEspejo && rotacionRival
          ? {
              rotacion: rotacionRival,
              liberos: liberosRival,
              posicionesPunto: posicionesPuntoRival,
              cambios: cambiosPendientesRival,
            }
          : undefined,
    };

    const clave = clavePunto(setActivo, puntoActual);
    const nuevosCerrados: PuntosPorSet = {
      ...puntosCerrados,
      [clave]: punto,
    };
    setPuntosCerrados(nuevosCerrados);

    let propios = 0;
    let rivales = 0;
    for (const p of Object.values(nuevosCerrados)) {
      if (p.set_numero !== setActivo) continue;
      if (p.ganador === "propio") propios++;
      else rivales++;
    }
    const target = puntosParaGanarSet(formatoPartido, setActivo);
    if (setTerminado(propios, rivales, target)) {
      const ganadorSet: "propio" | "rival" = propios > rivales ? "propio" : "rival";
      cerrarSet(ganadorSet, propios, rivales, nuevosCerrados);
      return;
    }

    if (partidoCerrado) return;

    const siguiente = puntoActual + 1;
    setPuntoActual(siguiente);
    ejecutarCargarPunto(
      nuevosCerrados,
      setsCerrados,
      setActivo,
      siguiente
    );
  };

  // ============================================================
  // HANDLERS DE REABRIR SET
  // ============================================================

  const handleSolicitarReabrir = () => {
    const sc = setsCerrados[setActivo];
    if (sc) setSetAReabrir(sc);
  };

  const handleConfirmarReabrir = () => {
    if (!setAReabrir) return;

    const nuevosSets = { ...setsCerrados };
    delete nuevosSets[setAReabrir.numero];
    setSetsCerrados(nuevosSets);

    setPartidoCerrado(null);

    setSetActivo(setAReabrir.numero);
    const puntosDelSet = Object.values(puntosCerrados)
      .filter((p) => p.set_numero === setAReabrir.numero)
      .sort((a, b) => a.numero - b.numero);
    const ultimo =
      puntosDelSet.length > 0
        ? puntosDelSet[puntosDelSet.length - 1].numero
        : 0;
    const ptoTarget = ultimo + 1;
    setPuntoActual(ptoTarget);
    ejecutarCargarPunto(
      puntosCerrados,
      nuevosSets,
      setAReabrir.numero,
      ptoTarget
    );

    setSetAReabrir(null);
  };

  const handleCancelarReabrir = () => {
    setSetAReabrir(null);
  };

  // ============================================================
  // HANDLERS DE GUARDADO
  // ============================================================

  const handleGuardarSupabase = async () => {
    const lista = Object.values(puntosCerrados).sort((a, b) => {
      if (a.set_numero !== b.set_numero) return a.set_numero - b.set_numero;
      return a.numero - b.numero;
    });
    if (lista.length === 0) { alert("No hay puntos cerrados para guardar."); return; }
    const enFullscreen = !!document.fullscreenElement;
    if (
      !enFullscreen &&
      !confirm(
        `¿Guardar ${lista.length} punto${lista.length !== 1 ? "s" : ""} en Supabase?\n\nTambién se actualizará el resultado del partido y los sets ganados.\n\nLos mismos puntos se borrarán de las tablas V1 (reemplazo).`
      )
    ) {
      return;
    }

    setGuardando(true);
    const res = await guardarPuntosEnSupabase({
      partidoId,
      setActivo,
      listaPuntos: lista,
      equipoId,
      equipoRivalId,
      posicionesFijas,
      posicionesFijasRival,
      modoEspejo,
      setsCerrados,
      partidoCerrado,
    });
    setGuardando(false);

    if (res.errores > 0) {
      alert(`⚠️ ${res.errores} error(es). Primer error: ${res.primerError}`);
    } else {
      alert("✅ Puntos y resultado del partido guardados en Supabase");
    }
  };

  // ============================================================
  // HANDLERS DE ROTACIÓN / SAQUE / POSICIONES
  // ============================================================

  const handleGuardarCambios = () => {
    if (!rotacion) return;
    const nueva = { ...rotacion };
    for (const c of cambiosPendientes) {
      if (nueva.posiciones[c.zona]) {
        nueva.posiciones[c.zona] = { ...nueva.posiciones[c.zona], jugador_id: c.jugadorEntra };
      }
    }
    setRotacion(nueva);
    setCambiosPendientes([]);
  };

  const handleGuardarCambiosRival = () => {
    if (!rotacionRival) return;
    const nueva = { ...rotacionRival };
    for (const c of cambiosPendientesRival) {
      if (nueva.posiciones[c.zona]) {
        nueva.posiciones[c.zona] = { ...nueva.posiciones[c.zona], jugador_id: c.jugadorEntra };
      }
    }
    setRotacionRival(nueva);
    setCambiosPendientesRival([]);
  };

  const handleCambioRotacion = (dir: 1 | -1) => {
    if (!rotacion) return;
    const { rotacion: nueva } = girarRotacionPunto(rotacion, dir);
    setRotacion(nueva);
  };

  const handleCambioRotacionRival = (dir: 1 | -1) => {
    if (!rotacionRival) return;
    const { rotacion: nueva } = girarRotacionPunto(rotacionRival, dir);
    setRotacionRival(nueva);
  };

  const handleCambioSaque = (equipo: SaqueEquipo) => {
    setSaqueInicial(equipo);
    if (rotacion) setRotacion({ ...rotacion, saque_equipo: equipo });
    if (rotacionRival) setRotacionRival({ ...rotacionRival, saque_equipo: equipo === "propio" ? "rival" : "propio" });
  };

  const handleCambioSaqueRival = (equipo: SaqueEquipo) => {
    if (rotacionRival) setRotacionRival({ ...rotacionRival, saque_equipo: equipo });
    setSaqueInicial(equipo === "propio" ? "rival" : "propio");
    if (rotacion) setRotacion({ ...rotacion, saque_equipo: equipo === "propio" ? "rival" : "propio" });
  };

  const handleFijarPosiciones = (pos: Record<Zona, string>) => {
    if (!clavePosicionesFijas) return;
    setPosicionesFijas((prev) => ({ ...prev, [clavePosicionesFijas]: { ...pos } }));
  };

  const handleLimpiarFijadas = () => {
    if (!clavePosicionesFijas) return;
    setPosicionesFijas((prev) => { const copia = { ...prev }; delete copia[clavePosicionesFijas]; return copia; });
  };

  const handleFijarPosicionesRival = (pos: Record<Zona, string>) => {
    if (!clavePosicionesFijasRival) return;
    setPosicionesFijasRival((prev) => ({ ...prev, [clavePosicionesFijasRival]: { ...pos } }));
  };

  const handleLimpiarFijadasRival = () => {
    if (!clavePosicionesFijasRival) return;
    setPosicionesFijasRival((prev) => { const copia = { ...prev }; delete copia[clavePosicionesFijasRival]; return copia; });
  };

  const handleToggleModoEspejo = (v: boolean) => {
    setModoEspejo(v);
    if (!v) {
      setEquipoRivalId(null);
      setJugadoresRival([]);
      setRotacionRival(null);
      setLiberosRival([]);
      setPosicionesPuntoRival({ ...POSICIONES_VACIAS });
      setCambiosPendientesRival([]);
      setPosicionesFijasRival({});
    }
  };

  const handleSetEquipoRivalId = (id: string | null) => {
    setEquipoRivalId(id);
    if (id && !rotacionRival) setRotacionRival(rotacionVacia(1, setActivo, puntoActual, "rival"));
  };

  // ============================================================
  // NAVEGACIÓN
  // ============================================================

  const irAPunto = (n: number) => {
    if (n < 1 || n > maxNavegable) return;
    if (setCerradoActual) return;
    setPuntoActual(n);
    ejecutarCargarPunto(puntosCerrados, setsCerrados, setActivo, n);
  };

  const irASet = (n: number) => {
    if (n < 1 || n > maxSets) return;
    navegarASetInterno(puntosCerrados, setsCerrados, n);
  };

  // ============================================================
  // TECLADO
  // ============================================================

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT") return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "g") {
        e.preventDefault();
        void handleGuardarSupabase();
        return;
      }
      if (e.key === "Escape") {
        if (colaPopups.length > 0) setColaPopups([]);
        else if (desviosPendientes.length > 0) setDesviosPendientes((prev) => prev.slice(0, -1));
        else if (circuloArmado) { setCirculoSinArmar(circuloArmado); setCirculoArmado(null); }
        else if (circuloSinArmar) { setCirculoSinArmar(null); setEstrella(null); }
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (!setCerradoActual) handleCerrarPunto();
        return;
      }
      if (e.key.toLowerCase() === "d" && !e.ctrlKey && !e.metaKey) {
        if (!setCerradoActual) handleBorrarUltima();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colaPopups, lineas, rotacion, setActivo, puntoActual, circuloArmado, circuloSinArmar, desviosPendientes, puntosCerrados, setsCerrados, saqueInicial, situacion, liberos, posicionesPunto, cambiosPendientes, setCerradoActual]);

  // ============================================================
  // SETUP
  // ============================================================

  const necesitaSetup = !setupCompleto;

  const handleComenzar = () => {
    if (!rotacion) { alert("Necesitás una rotación antes de comenzar."); return; }
    if (modoEspejo && !equipoRivalId) { alert("Elegí un equipo rival o desactivá el modo espejo."); return; }
    if (modoEspejo && !rotacionRival) { alert("Falta la rotación del equipo rival."); return; }
    setSetupCompleto(true);
  };

  const lineasVisibles = lineas.filter((l) => !l.oculta).length;

  const nombreEquipoRivalSeleccionado = useMemo(() => {
    if (!equipoRivalId) return "";
    return equiposDisponibles.find((e) => e.id === equipoRivalId)?.nombre ?? "";
  }, [equipoRivalId, equiposDisponibles]);

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="space-y-3">
      {/* ===== BANNERS ===== */}
      <CierreSetBanner
        cerrado={bannerSet}
        onDismiss={() => setBannerSet(null)}
      />
      <CierrePartidoBanner
        cerrado={bannerPartido}
        onDismiss={() => setBannerPartido(null)}
      />

      {/* ===== MARCADOR ===== */}
      <BarraMarcadorV2
        nombreMiEquipo={nombreMiEquipo}
        nombreRival={
          modoEspejo && nombreEquipoRivalSeleccionado
            ? nombreEquipoRivalSeleccionado
            : nombreRival
        }
        setActivo={setActivo}
        marcador={marcador}
        setsPropios={setsPropios}
        setsRivales={setsRivales}
        setsCerrados={setsCerrados}
        formatoPartido={formatoPartido}
        onIrSet={irASet}
        setCerrado={setCerradoActual}
        visibleNavegacion={!necesitaSetup}
        puntoActual={puntoActual}
        puntoActualCerrado={puntoActualCerrado}
        saqueInicial={saqueInicial}
        lineasVisibles={lineasVisibles}
        circuloArmado={!!circuloArmado}
        circuloSinArmar={!!circuloSinArmar}
        puedeIrAnterior={puntoActual > 1}
        puedeIrSiguiente={puntoActual + 1 <= maxNavegable}
        onIrPunto={irAPunto}
      />

      {/* ===== SETUP ===== */}
      {necesitaSetup && (
        <SetupInicialV2
          rotacion={rotacion}
          jugadores={jugadores}
          liberos={liberos}
          posicionesPunto={posicionesPunto}
          posicionesFijasActuales={posicionesFijasActuales}
          cambiosPendientes={cambiosPendientes}
          saqueInicial={saqueInicial}
          nombreMiEquipo={nombreMiEquipo}
          nombreRival={nombreRival}
          modoEspejo={modoEspejo}
          equiposDisponibles={equiposDisponibles}
          equipoRivalId={equipoRivalId}
          nombreEquipoRival={nombreEquipoRivalSeleccionado}
          rotacionRival={rotacionRival}
          jugadoresRival={jugadoresRival}
          liberosRival={liberosRival}
          posicionesPuntoRival={posicionesPuntoRival}
          posicionesFijasActualesRival={posicionesFijasActualesRival}
          cambiosPendientesRival={cambiosPendientesRival}
          formatoPartido={formatoPartido}
          onCambioFormatoPartido={setFormatoPartido}
          onFijarPosiciones={handleFijarPosiciones}
          onLimpiarFijadas={handleLimpiarFijadas}
          onSetLiberos={setLiberos}
          onSetPosicionesPunto={setPosicionesPunto}
          onSetCambiosPendientes={setCambiosPendientes}
          onGuardarCambios={handleGuardarCambios}
          onCambioRotacion={handleCambioRotacion}
          onCambioSaque={handleCambioSaque}
          onToggleModoEspejo={handleToggleModoEspejo}
          onSetEquipoRivalId={handleSetEquipoRivalId}
          onFijarPosicionesRival={handleFijarPosicionesRival}
          onLimpiarFijadasRival={handleLimpiarFijadasRival}
          onSetLiberosRival={setLiberosRival}
          onSetPosicionesPuntoRival={setPosicionesPuntoRival}
          onSetCambiosPendientesRival={setCambiosPendientesRival}
          onGuardarCambiosRival={handleGuardarCambiosRival}
          onCambioRotacionRival={handleCambioRotacionRival}
          onCambioSaqueRival={handleCambioSaqueRival}
          onComenzar={handleComenzar}
        />
      )}

      {/* ===== CONSOLA ===== */}
      {!necesitaSetup && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-3">
            <div className="space-y-2">
              {rotacion && (
                <SetupInicialV2
                  modo="carga"
                  rotacion={rotacion}
                  jugadores={jugadores}
                  liberos={liberos}
                  posicionesPunto={posicionesPunto}
                  posicionesFijasActuales={posicionesFijasActuales}
                  cambiosPendientes={cambiosPendientes}
                  saqueInicial={saqueInicial}
                  nombreMiEquipo={nombreMiEquipo}
                  nombreRival={nombreRival}
                  modoEspejo={modoEspejo}
                  equiposDisponibles={equiposDisponibles}
                  equipoRivalId={equipoRivalId}
                  nombreEquipoRival={nombreEquipoRivalSeleccionado}
                  rotacionRival={rotacionRival}
                  jugadoresRival={jugadoresRival}
                  liberosRival={liberosRival}
                  posicionesPuntoRival={posicionesPuntoRival}
                  posicionesFijasActualesRival={posicionesFijasActualesRival}
                  cambiosPendientesRival={cambiosPendientesRival}
                  formatoPartido={formatoPartido}
                  onCambioFormatoPartido={setFormatoPartido}
                  onFijarPosiciones={handleFijarPosiciones}
                  onLimpiarFijadas={handleLimpiarFijadas}
                  onSetLiberos={setLiberos}
                  onSetPosicionesPunto={setPosicionesPunto}
                  onSetCambiosPendientes={setCambiosPendientes}
                  onGuardarCambios={handleGuardarCambios}
                  onCambioRotacion={handleCambioRotacion}
                  onCambioSaque={handleCambioSaque}
                  onToggleModoEspejo={handleToggleModoEspejo}
                  onSetEquipoRivalId={handleSetEquipoRivalId}
                  onFijarPosicionesRival={handleFijarPosicionesRival}
                  onLimpiarFijadasRival={handleLimpiarFijadasRival}
                  onSetLiberosRival={setLiberosRival}
                  onSetPosicionesPuntoRival={setPosicionesPuntoRival}
                  onSetCambiosPendientesRival={setCambiosPendientesRival}
                  onGuardarCambiosRival={handleGuardarCambiosRival}
                  onCambioRotacionRival={handleCambioRotacionRival}
                  onCambioSaqueRival={handleCambioSaqueRival}
                  onComenzar={handleComenzar}
                />
              )}
              <SecuenciaV2 lineas={secuenciaConValores} nombreDeJugador={nombreDeJugador} />
            </div>

            <div className="relative bg-white rounded-2xl shadow-sm border border-slate-200 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase">
                  Set {setActivo} · Punto {puntoActual}
                  {esTieBreak(formatoPartido, setActivo) && (
                    <span className="ml-1 text-amber-600">(tie-break)</span>
                  )}
                </p>
                <button
                  onClick={() => setOrientacion((o) => o === "vertical" ? "horizontal" : "vertical")}
                  className="px-2 py-0.5 text-[10px] rounded border border-slate-300 hover:bg-slate-50 text-slate-600"
                >
                  🔄 {orientacion === "vertical" ? "Horizontal" : "Vertical"}
                </button>
              </div>

              <CanchaV2
                orientacion={orientacion}
                onMiniClick={setCerradoActual ? undefined : handleMiniClick}
                onCerrarPunto={handleCerrarPunto}
                onPuntoSiguiente={() => irAPunto(puntoActual + 1)}
                onPuntoAnterior={() => irAPunto(puntoActual - 1)}
                onBorrarPunto={handleBorrarPunto}
                onBorrarLinea={handleBorrarUltima}
                puedeCerrarPunto={lineas.length > 0 && !setCerradoActual}
                puedeIrSiguiente={puntoActual + 1 <= maxNavegable && !setCerradoActual}
                puedeIrAnterior={puntoActual > 1 && !setCerradoActual}
                puedeBorrarPunto={lineas.length > 0 && !setCerradoActual}
                puedeBorrarLinea={!setCerradoActual && (lineas.length > 0 || !!circuloArmado || !!circuloSinArmar)}
                armadoAutomatico={armadoAutomatico}
                onToggleArmadoAutomatico={() => setArmadoAutomatico((v) => !v)}
              >
                <LineasV2
                  lineas={lineasParaUI}
                  origenActivo={origenActivoParaUI}
                  armado={!!circuloArmado}
                  desviosPendientes={desviosPendientes}
                  estrella={estrella}
                  orientacion={orientacion}
                  onClickCirculo={setCerradoActual ? undefined : handleClickCirculo}
                />

                {!setCerradoActual && (
                  <PopupsV2
                    popupActivo={popupActivo}
                    jugadoresEnCancha={jugadoresEnCancha}
                    delanterosPorZona={
                      popupActivo && lineas.find((l) => l.id === popupActivo.lineaId)?.equipoId === equipoRivalId
                        ? delanterosPorZonaRival
                        : delanterosPorZona
                    }
                    onSaqueConfirmar={handleSaqueConfirmar}
                    onTipoSaqueConfirmar={handleTipoSaqueConfirmar}
                    onRecepcionConfirmar={handleRecepcionConfirmar}
                    onArmadoConfirmar={handleArmadoConfirmar}
                    onVelocidadConfirmar={handleVelocidadConfirmar}
                    onDefensaConfirmar={handleDefensaConfirmar}
                    onDefensaX2Change={handleDefensaX2Change}
                    onLibreConfirmar={handleLibreConfirmar}
                    onJugadorConfirmar={handleJugadorConfirmar}
                    onBloqueoConfirmar={handleBloqueoConfirmar}
                    onRoceRedConfirmar={handleRoceRedConfirmar}
                    onAtaqueToqueLibreConfirmar={handleAtaqueToqueLibreConfirmar}
                    onRemateSegundaConfirmar={handleRemateSegundaConfirmar}
                    onArmadoCruzadoConfirmar={handleArmadoCruzadoConfirmar}
                    onVarianteRemateSegundaConfirmar={handleVarianteRemateSegundaConfirmar}
                    onCerrar={cerrarPopup}
                    onSiguiente={popupSiguiente}
                  />
                )}
              </CanchaV2>
            </div>
          </div>

          <BotonesAccionV2
            guardando={guardando}
            setCerrado={setCerradoActual}
            puedeBorrarUltima={lineas.length > 0 || !!circuloArmado || !!circuloSinArmar}
            puedeBorrarPunto={lineas.length > 0}
            puedeGuardar={Object.keys(puntosCerrados).length > 0}
            puedeCerrarPunto={lineas.length > 0}
            onBorrarUltima={handleBorrarUltima}
            onBorrarPunto={handleBorrarPunto}
            onGuardar={handleGuardarSupabase}
            onCerrarPunto={handleCerrarPunto}
            onBorrarLocal={handleBorrarLocal}
            onReabrirSet={handleSolicitarReabrir}
          />
        </>
      )}

      {/* ===== MODAL REABRIR SET ===== */}
      <ReabrirSetConfirm
        setAReabrir={setAReabrir}
        setsPosterioresCargados={
          setAReabrir
            ? Object.values(setsCerrados).filter(
                (s) => s.numero > setAReabrir.numero
              ).length
            : 0
        }
        onConfirmar={handleConfirmarReabrir}
        onCancelar={handleCancelarReabrir}
      />
    </div>
  );
}