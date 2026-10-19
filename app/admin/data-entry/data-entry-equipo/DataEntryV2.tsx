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
  type Jugador,
  type PopupEnCola,
  type PosicionesFijasMap,
  type Props,
  type PuntoCerrado,
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
import { cargarPuntosCerradosDesdeDB } from "./cargaDBV2";
import { guardarPuntosEnSupabase } from "./guardarSupabaseV2";
import { crearHandlersPopups } from "./handlersPopupsV2";
import { crearHandlersCancha } from "./handlersCanchaV2";

export default function DataEntryV2({
  partidoId,
  equipoId,
  nombreMiEquipo,
  nombreRival,
  jugadores,
  rotacionInicial,
  equiposDisponibles,
}: Props) {
  const [puntosCerrados, setPuntosCerrados] = useState<
    Record<number, PuntoCerrado>
  >({});
  const [puntoActual, setPuntoActual] = useState<number>(1);

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

  const [setActivo] = useState<number>(1);
  const [orientacion, setOrientacion] = useState<Orientacion>("vertical");
  const [guardando, setGuardando] = useState(false);
  const [setupCompleto, setSetupCompleto] = useState(false);
  const [hidratado, setHidratado] = useState(false);

  const puntoActualCerrado = !!puntosCerrados[puntoActual];

  const maxNavegable = useMemo(() => {
    const nums = Object.keys(puntosCerrados).map((n) => parseInt(n));
    const ultimo = nums.length > 0 ? Math.max(...nums) : 0;
    return ultimo + 1;
  }, [puntosCerrados]);

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

  const marcador = useMemo(() => {
    let p = 0;
    let r = 0;
    for (const pc of Object.values(puntosCerrados)) {
      if (pc.ganador === "propio") p++;
      else r++;
    }
    return { propio: p, rival: r };
  }, [puntosCerrados]);

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

  const ejecutarCargarPunto = (cerrados: Record<number, PuntoCerrado>, n: number) => {
    cargarPuntoDesdeHelper(cerrados, n, modoEspejo, rotacionInicial, {
      setLineas, setCirculoSinArmar, setCirculoArmado, setDesviosPendientes,
      setEstrella, setColaPopups, setContadorId, setSaqueInicial, setRotacion,
      setLiberos, setPosicionesPunto, setCambiosPendientes, setRotacionRival,
      setLiberosRival, setPosicionesPuntoRival, setCambiosPendientesRival,
    });
  };

  useEffect(() => {
    if (!partidoId || !hidratado) return;
    try {
      localStorage.setItem(CLAVE_POSICIONES_FIJAS + partidoId, JSON.stringify(posicionesFijas));
    } catch {}
  }, [partidoId, hidratado, posicionesFijas]);

  useEffect(() => {
    if (!partidoId || !hidratado) return;
    try {
      localStorage.setItem(CLAVE_V2 + partidoId, JSON.stringify({
        ts: Date.now(), setActivo, puntoActual, setupCompleto, puntosCerrados,
        rotacion, saqueInicial, liberos, posicionesPunto, cambiosPendientes,
        lineas, contadorId, modoEspejo, equipoRivalId, rotacionRival,
        liberosRival, posicionesPuntoRival, cambiosPendientesRival,
      }));
    } catch {}
  }, [
    partidoId, hidratado, setActivo, puntoActual, setupCompleto, puntosCerrados,
    rotacion, saqueInicial, liberos, posicionesPunto, cambiosPendientes, lineas,
    contadorId, modoEspejo, equipoRivalId, rotacionRival, liberosRival,
    posicionesPuntoRival, cambiosPendientesRival,
  ]);

  useEffect(() => {
    if (!partidoId) return;

    const rawFijas = localStorage.getItem(CLAVE_POSICIONES_FIJAS + partidoId);
    if (rawFijas) { try { setPosicionesFijas(JSON.parse(rawFijas)); } catch {} }

    const raw = localStorage.getItem(CLAVE_V2 + partidoId);
    if (raw) {
      try {
        const data = JSON.parse(raw);
        if (data.setupCompleto !== undefined) setSetupCompleto(data.setupCompleto);
        if (data.modoEspejo !== undefined) setModoEspejo(data.modoEspejo);
        if (data.equipoRivalId !== undefined) setEquipoRivalId(data.equipoRivalId);
        if (data.rotacionRival) setRotacionRival(data.rotacionRival);
        if (data.liberosRival) setLiberosRival(data.liberosRival);
        if (data.posicionesPuntoRival) setPosicionesPuntoRival(data.posicionesPuntoRival);
        if (data.cambiosPendientesRival) setCambiosPendientesRival(data.cambiosPendientesRival);

        const cerrados: Record<number, PuntoCerrado> = data.puntosCerrados ?? {};
        setPuntosCerrados(cerrados);
        const pto = data.puntoActual ?? 1;
        setPuntoActual(pto);
        ejecutarCargarPunto(cerrados, pto);

        if (!cerrados[pto]) {
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
      } catch {}
    }

    (async () => {
      try {
        const cerrados = await cargarPuntosCerradosDesdeDB(partidoId, 1);
        setPuntosCerrados(cerrados);
        const numeros = Object.keys(cerrados).map((k) => parseInt(k));
        const siguiente = numeros.length > 0 ? Math.max(...numeros) + 1 : 1;
        setPuntoActual(siguiente);
        ejecutarCargarPunto(cerrados, siguiente);
        if (numeros.length > 0) setSetupCompleto(true);
      } catch (e) {
        console.error("Error cargando puntos desde Supabase:", e);
      }
      setHidratado(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partidoId]);

  const { handleMiniClick, handleClickCirculo } = crearHandlersCancha({
    setupCompleto, colaPopups, circuloSinArmar, circuloArmado,
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
  } = crearHandlersPopups({
    popupActivo, lineas, contadorId, equipoId, equipoRivalId,
    setLineas, setColaPopups, setContadorId, setDesviosPendientes,
  });

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
    if (lineas.length > 0 && !confirm("¿Borrar todas las líneas de este punto?")) return;
    setLineas([]);
    setCirculoSinArmar(null);
    setCirculoArmado(null);
    setDesviosPendientes([]);
    setEstrella(null);
    setColaPopups([]);
    setContadorId(1);
    if (puntoActualCerrado) {
      const copia = { ...puntosCerrados };
      delete copia[puntoActual];
      setPuntosCerrados(copia);
    }
  };

  const handleBorrarLocal = () => {
    if (!confirm("¿Borrar los datos guardados en ESTE navegador para este partido?\n\nNO toca Supabase. Si ya guardaste en Supabase, al recargar se recupera desde ahí.")) return;
    try {
      localStorage.removeItem(CLAVE_V2 + partidoId);
      localStorage.removeItem(CLAVE_POSICIONES_FIJAS + partidoId);
    } catch {}
    setPuntosCerrados({});
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

    (async () => {
      try {
        const cerrados = await cargarPuntosCerradosDesdeDB(partidoId, 1);
        setPuntosCerrados(cerrados);
        const numeros = Object.keys(cerrados).map((k) => parseInt(k));
        const siguiente = numeros.length > 0 ? Math.max(...numeros) + 1 : 1;
        setPuntoActual(siguiente);
        ejecutarCargarPunto(cerrados, siguiente);
        if (numeros.length > 0) setSetupCompleto(true);
      } catch (e) {
        console.error("Error recargando desde Supabase:", e);
      }
    })();
  };

  const handleCerrarPunto = () => {
    if (lineas.length === 0) return;
    if (!rotacion) { alert("Falta rotación."); return; }
    const ganador = ganadorDelPunto(lineas);
    if (!ganador) { alert("No se puede determinar el ganador todavía."); return; }

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
      equipoId: saqueInicial === "propio" ? equipoId : equipoRivalId ?? undefined,
      estadoRival: modoEspejo && rotacionRival ? {
        rotacion: rotacionRival,
        liberos: liberosRival,
        posicionesPunto: posicionesPuntoRival,
        cambios: cambiosPendientesRival,
      } : undefined,
    };

    if (puntoActualCerrado) {
      setPuntosCerrados((prev) => ({ ...prev, [puntoActual]: punto }));
      return;
    }

    const nuevosCerrados: Record<number, PuntoCerrado> = { ...puntosCerrados, [puntoActual]: punto };
    setPuntosCerrados(nuevosCerrados);
    const siguiente = puntoActual + 1;
    setPuntoActual(siguiente);
    ejecutarCargarPunto(nuevosCerrados, siguiente);
  };

  const handleGuardarSupabase = async () => {
    const lista = Object.values(puntosCerrados).sort((a, b) => a.numero - b.numero);
    if (lista.length === 0) { alert("No hay puntos cerrados para guardar."); return; }
    if (!confirm(`¿Guardar ${lista.length} punto${lista.length !== 1 ? "s" : ""} en Supabase?\n\nLos mismos puntos se borrarán de las tablas V1 (reemplazo).`)) return;

    setGuardando(true);
    const res = await guardarPuntosEnSupabase({
      partidoId, setActivo, listaPuntos: lista, equipoId,
      equipoRivalId, posicionesFijas, posicionesFijasRival, modoEspejo,
    });
    setGuardando(false);

    if (res.errores > 0) {
      alert(`⚠️ ${res.errores} punto(s) con error. Primer error: ${res.primerError}`);
    } else {
      alert("✅ Puntos guardados en Supabase (V1 limpiado en esos puntos)");
    }
  };

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

  const irAPunto = (n: number) => {
    if (n < 1 || n > maxNavegable) return;
    setPuntoActual(n);
    ejecutarCargarPunto(puntosCerrados, n);
  };

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
      if (e.key === "Enter") { e.preventDefault(); handleCerrarPunto(); return; }
      if (e.key.toLowerCase() === "d" && !e.ctrlKey && !e.metaKey) handleBorrarUltima();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colaPopups, lineas, rotacion, puntoActual, circuloArmado, circuloSinArmar, desviosPendientes, puntosCerrados, saqueInicial, situacion, liberos, posicionesPunto, cambiosPendientes]);

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

  return (
    <div className="space-y-3">
      <BarraMarcadorV2
        nombreMiEquipo={nombreMiEquipo}
        nombreRival={modoEspejo && nombreEquipoRivalSeleccionado ? nombreEquipoRivalSeleccionado : nombreRival}
        setActivo={setActivo}
        marcador={marcador}
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
                <p className="text-[10px] font-bold text-slate-500 uppercase">Punto {puntoActual} · Set {setActivo}</p>
                <button
                  onClick={() => setOrientacion((o) => o === "vertical" ? "horizontal" : "vertical")}
                  className="px-2 py-0.5 text-[10px] rounded border border-slate-300 hover:bg-slate-50 text-slate-600"
                >
                  🔄 {orientacion === "vertical" ? "Horizontal" : "Vertical"}
                </button>
              </div>

              <CanchaV2
                orientacion={orientacion}
                onMiniClick={handleMiniClick}
                onCerrarPunto={handleCerrarPunto}
                onPuntoSiguiente={() => irAPunto(puntoActual + 1)}
                onPuntoAnterior={() => irAPunto(puntoActual - 1)}
                onBorrarPunto={handleBorrarPunto}
                onBorrarLinea={handleBorrarUltima}
                puedeCerrarPunto={lineas.length > 0}
                puedeIrSiguiente={puntoActual + 1 <= maxNavegable}
                puedeIrAnterior={puntoActual > 1}
                puedeBorrarPunto={lineas.length > 0}
                puedeBorrarLinea={lineas.length > 0 || !!circuloArmado || !!circuloSinArmar}
              >
                <LineasV2
                  lineas={lineasParaUI}
                  origenActivo={origenActivoParaUI}
                  armado={!!circuloArmado}
                  desviosPendientes={desviosPendientes}
                  estrella={estrella}
                  orientacion={orientacion}
                  onClickCirculo={handleClickCirculo}
                />

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
                  onCerrar={cerrarPopup}
                  onSiguiente={popupSiguiente}
                />
              </CanchaV2>
            </div>
          </div>

          <BotonesAccionV2
            guardando={guardando}
            puedeBorrarUltima={lineas.length > 0 || !!circuloArmado || !!circuloSinArmar}
            puedeBorrarPunto={lineas.length > 0}
            puedeGuardar={Object.keys(puntosCerrados).length > 0}
            puedeCerrarPunto={lineas.length > 0}
            onBorrarUltima={handleBorrarUltima}
            onBorrarPunto={handleBorrarPunto}
            onGuardar={handleGuardarSupabase}
            onCerrarPunto={handleCerrarPunto}
            onBorrarLocal={handleBorrarLocal}
          />
        </>
      )}
    </div>
  );
}