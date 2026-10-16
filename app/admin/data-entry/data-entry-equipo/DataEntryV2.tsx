"use client";

import { useEffect, useMemo, useState } from "react";
import CanchaV2, {
  type CoordsV2,
  type Orientacion,
} from "./CanchaV2";
import LineasV2, { type PuntoV2 } from "./LineasV2";

import BarraMarcadorV2 from "./BarraMarcadorV2";
import BotonesAccionV2 from "./BotonesAccionV2";
import PopupsV2 from "./PopupsV2";
import SecuenciaV2 from "./SecuenciaV2";
import SetupInicialV2 from "./SetupInicialV2";

import {
  aLineaV2,
  calcularRecepcionOverrides,
  esCeldaBloqueo,
  lineasAAcciones,
  maxIdLineas,
  mismaMini,
  posicionPopup,
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
  clasificarLinea,
  esCeldaBloqueoPropioConPopup,
  esCanchaPropia,
  esCanchaRival,
  ganadorDelPunto,
  resolverJugadorDefensa,
  resolverRolAJugador,
  type EstadoClasificacion,
  type LineaClasificada,
  type Situacion,
} from "@/lib/clasificacionV2";
import {
  guardarPuntoV2,
  type AccionV2Data,
  type PuntoV2Data,
} from "@/lib/dbV2";
import { borrarPuntoV1DeTablas } from "@/lib/db";

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
  const [cambiosPendientes, setCambiosPendientes] = useState<
    import("./PanelRotacionV2").CambioPendiente[]
  >([]);

  const [posicionesFijas, setPosicionesFijas] = useState<PosicionesFijasMap>(
    {}
  );

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
    return {
      ...(cambio ? { ...rotacion, posiciones: nuevas } : rotacion),
      liberos,
    };
  }, [rotacion, posicionesPunto, liberos]);

  const jugadoresEnCancha = useMemo(() => {
    if (!rotacion) return [];

    const numeroRot = numeroRotacionDesdePosiciones(rotacion);
    const fila = POSICIONES_JUEGO[numeroRot]?.[situacion];
    const rotConLib: RotacionPunto = { ...rotacion, liberos };

    const zonasOrden: Zona[] = [1, 2, 3, 4, 5, 6];
    const out: {
      id: string;
      nombre: string;
      rol: string;
      zona: number;
    }[] = [];

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

      out.push({
        id,
        nombre,
        rol: rolCortoParaUI(rol),
        zona: z,
      });
    }

    return out;
  }, [rotacion, situacion, liberos, posicionesPunto, jugadores]);

  const delanterosPorZona = useMemo(() => {
    if (!rotacionEfectiva) return [];
    const zonas: (4 | 3 | 2)[] = [4, 3, 2];
    return zonas.map((z) => {
      const asig = rotacionEfectiva.posiciones[z as Zona];
      const id = asig?.jugador_id ?? null;
      const jugador = id ? jugadores.find((j) => j.id === id) : null;
      return {
        zona: z,
        jugadorId: id,
        nombre: jugador ? jugador.nombre : "(vacío)",
      };
    });
  }, [rotacionEfectiva, jugadores]);

  const clavePosicionesFijas = useMemo(() => {
    if (!rotacion) return "";
    const numRot = numeroRotacionDesdePosiciones(rotacion);
    return `${numRot}-${situacion}`;
  }, [rotacion, situacion]);

  const posicionesFijasActuales: Record<Zona, string> = useMemo(() => {
    if (!clavePosicionesFijas) return { ...POSICIONES_VACIAS };
    return posicionesFijas[clavePosicionesFijas] ?? { ...POSICIONES_VACIAS };
  }, [posicionesFijas, clavePosicionesFijas]);

  const recepcionOverridesEfectivos = useMemo(() => {
    return calcularRecepcionOverrides(
      posicionesFijasActuales,
      posicionesPunto
    );
  }, [posicionesFijasActuales, posicionesPunto]);

  const lineasParaUI = useMemo(() => lineas.map(aLineaV2), [lineas]);
  const origenActivoParaUI: PuntoV2 | null =
    circuloSinArmar ?? circuloArmado;

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
    if (!j) return "?";
    return j.nombre + (j.numero !== null ? ` #${j.numero}` : "");
  };

  const cargarPuntoDesde = (
    cerrados: Record<number, PuntoCerrado>,
    n: number
  ) => {
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

    const anteriores = Object.values(cerrados)
      .filter((x) => x.numero < n)
      .sort((a, b) => b.numero - a.numero);
    const prev = anteriores[0] ?? null;

    if (prev) {
      let rotSig: RotacionPunto = prev.rotacion;
      const saqueSig: "propio" | "rival" = prev.ganador;
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

  // ---------- GUARDADO LOCAL (bloqueado hasta hidratar) ----------
  useEffect(() => {
    if (!partidoId || !hidratado) return;
    try {
      localStorage.setItem(
        CLAVE_POSICIONES_FIJAS + partidoId,
        JSON.stringify(posicionesFijas)
      );
    } catch {
      /* noop */
    }
  }, [partidoId, hidratado, posicionesFijas]);

  useEffect(() => {
    if (!partidoId || !hidratado) return;
    try {
      localStorage.setItem(
        CLAVE_V2 + partidoId,
        JSON.stringify({
          ts: Date.now(),
          setActivo,
          puntoActual,
          setupCompleto,
          puntosCerrados,
          rotacion,
          saqueInicial,
          liberos,
          posicionesPunto,
          cambiosPendientes,
          lineas,
          contadorId,
        })
      );
    } catch {
      /* noop */
    }
  }, [
    partidoId,
    hidratado,
    setActivo,
    puntoActual,
    setupCompleto,
    puntosCerrados,
    rotacion,
    saqueInicial,
    liberos,
    posicionesPunto,
    cambiosPendientes,
    lineas,
    contadorId,
  ]);

  // ---------- CARGA ----------
  useEffect(() => {
    if (!partidoId) return;

    const rawFijas = localStorage.getItem(CLAVE_POSICIONES_FIJAS + partidoId);
    if (rawFijas) {
      try {
        setPosicionesFijas(JSON.parse(rawFijas));
      } catch {
        /* noop */
      }
    }

    const raw = localStorage.getItem(CLAVE_V2 + partidoId);
    if (!raw) {
      setHidratado(true);
      return;
    }
    try {
      const data = JSON.parse(raw);
      if (data.setupCompleto !== undefined)
        setSetupCompleto(data.setupCompleto);
      const cerrados: Record<number, PuntoCerrado> =
        data.puntosCerrados ?? {};
      setPuntosCerrados(cerrados);
      const pto = data.puntoActual ?? 1;
      setPuntoActual(pto);
      cargarPuntoDesde(cerrados, pto);

      if (!cerrados[pto]) {
        if (data.rotacion) setRotacion(data.rotacion);
        if (data.saqueInicial) setSaqueInicial(data.saqueInicial);
        if (data.liberos) setLiberos(data.liberos);
        if (data.posicionesPunto) setPosicionesPunto(data.posicionesPunto);
        if (data.cambiosPendientes)
          setCambiosPendientes(data.cambiosPendientes);
        if (data.lineas) setLineas(data.lineas);
        if (data.contadorId) setContadorId(data.contadorId);
      }
    } catch {
      /* noop */
    }
    setHidratado(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partidoId]);

  // ------------------------------------------------------------
  // CLICKS EN CANCHA
  // ------------------------------------------------------------

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

    if (circuloArmado) {
      if (coords.zona === "red") {
        const linea: LineaClasificada = {
          id: `l-${contadorId}`,
          tipo: "roce-red",
          esRival: false,
          jugadorId: null,
          origen: circuloArmado,
          destino: punto,
          desvios:
            desviosPendientes.length > 0 ? [...desviosPendientes] : undefined,
          subtipo: null,
          posicionInicial: estrella ? { ...estrella } : null,
        };
        setLineas((prev) => [...prev, linea]);
        setContadorId((c) => c + 1);
        setDesviosPendientes([]);
        setCirculoSinArmar(punto);
        setCirculoArmado(null);
        setEstrella(null);
        setColaPopups([
          {
            tipo: "roce-red",
            pos: posicionPopup(punto),
            lineaId: linea.id,
          },
        ]);
        return;
      }

      if (esCeldaBloqueo(punto.celda)) {
        const esPropioConPopup = esCeldaBloqueoPropioConPopup(punto.celda);
        const indiceDesvio = desviosPendientes.length;
        setDesviosPendientes((prev) => [
          ...prev,
          { ...punto, jugadorId: null },
        ]);
        if (esPropioConPopup) {
          setColaPopups([
            {
              tipo: "bloqueo",
              pos: posicionPopup(punto),
              lineaId: "",
              indiceDesvio,
            },
          ]);
        }
        return;
      }

      crearLinea(circuloArmado, punto);
      return;
    }

    if (circuloSinArmar) {
      if (coords.zona === "red") {
        setColaPopups([
          {
            tipo: "roce-red",
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
          posicionInicial: estrella ? { ...estrella } : null,
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
      recepcionOverrides: recepcionOverridesEfectivos,
    };

    const res = clasificarLinea(estado, {
      origen,
      destino,
      desvios:
        desviosPendientes.length > 0 ? [...desviosPendientes] : undefined,
    });

    let jugadorFinal = res.jugadorId;
    let subtipoFinal = res.subtipoFijo ?? null;
    const tipoSaqueFinal = res.tipoSaqueFijo ?? null;

    if (res.tipo === "defensa" && !res.esRival) {
      if (!jugadorFinal) {
        jugadorFinal = resolverJugadorDefensa(
          origen,
          rotacionEfectiva,
          situacion
        );
      }
      if (!subtipoFinal) {
        subtipoFinal = "defensa_normal";
      }
    }

    const nueva: LineaClasificada = {
      id: `l-${contadorId}`,
      tipo: res.tipo,
      esRival: res.esRival,
      jugadorId: jugadorFinal,
      origen,
      destino,
      desvios:
        desviosPendientes.length > 0 ? [...desviosPendientes] : undefined,
      subtipo: subtipoFinal,
      tipoSaque: tipoSaqueFinal,
      posicionInicial: estrella ? { ...estrella } : null,
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
    if (estrella && !res.esRival) {
      cola.push({ tipo: "jugador", pos, lineaId: nueva.id });
    }
    setColaPopups(cola);

    setEstrella(null);
  };

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

    if (puntoActualCerrado) {
      const copia = { ...puntosCerrados };
      delete copia[puntoActual];
      setPuntosCerrados(copia);
    }
  };

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
      setPuntosCerrados((prev) => ({ ...prev, [puntoActual]: punto }));
      return;
    }

    const nuevosCerrados: Record<number, PuntoCerrado> = {
      ...puntosCerrados,
      [puntoActual]: punto,
    };
    setPuntosCerrados(nuevosCerrados);

    const siguiente = puntoActual + 1;
    setPuntoActual(siguiente);
    cargarPuntoDesde(nuevosCerrados, siguiente);
  };

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
        } en Supabase?\n\nLos mismos puntos se borrarán de las tablas V1 (reemplazo).`
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

      const lineasConSaque = calcularSubtiposSaque(pc.lineas);
      const lineasConAtaqueRival =
        calcularSubtiposAtaqueRival(lineasConSaque);
      const lineasConBloqueo = calcularSubtiposBloqueo(lineasConAtaqueRival);
      const lineasConDefensa = calcularSubtiposDefensa(lineasConBloqueo);
      const lineasConAtaque = calcularSubtiposAtaque(
        lineasConDefensa,
        pc.ganador
      );
      const lineasConErroresRival = calcularErroresRival(lineasConAtaque);
      const acciones = lineasAAcciones(lineasConErroresRival);

      const res = await guardarPuntoV2(partidoId, puntoData, acciones);
      if (!res.ok) {
        errores++;
        if (!primerError) primerError = res.error ?? "desconocido";
        continue;
      }

      const resV1 = await borrarPuntoV1DeTablas(
        partidoId,
        setActivo,
        pc.numero
      );
      if (!resV1.ok) {
        errores++;
        if (!primerError)
          primerError = `borrando V1: ${resV1.error ?? "desconocido"}`;
      }
    }

    setGuardando(false);

    if (errores > 0) {
      alert(
        `⚠️ ${errores} punto(s) con error. Primer error: ${primerError}`
      );
    } else {
      alert("✅ Puntos guardados en Supabase (V1 limpiado en esos puntos)");
    }
  };

  const popupSiguiente = () => setColaPopups((prev) => prev.slice(1));

  const actualizarLineaPopup = (cambios: Partial<LineaClasificada>) => {
    if (!popupActivo?.lineaId) return;
    setLineas((prev) =>
      prev.map((l) =>
        l.id === popupActivo.lineaId ? { ...l, ...cambios } : l
      )
    );
  };

  const handleSaqueConfirmar = () => {
    popupSiguiente();
  };

  const handleTipoSaqueConfirmar = (v: "potencia" | "flotado") => {
    actualizarLineaPopup({ tipoSaque: v });
    popupSiguiente();
  };

  const handleRecepcionConfirmar = (v: 1 | 2 | 3 | 4 | 5 | 6) => {
    actualizarLineaPopup({ subtipo: v });
    popupSiguiente();
  };

  const handleArmadoConfirmar = (v: 1 | 2 | 3 | 4 | 5 | 6 | "R") => {
    if (!popupActivo?.lineaId) {
      popupSiguiente();
      return;
    }

    const lineaId = popupActivo.lineaId;
    const pos = popupActivo.pos;

    setLineas((prev) =>
      prev.map((l) => (l.id === lineaId ? { ...l, subtipo: v } : l))
    );

    setColaPopups((prev) => [
      { tipo: "velocidad", pos, lineaId },
      ...prev.slice(1),
    ]);
  };

  const handleVelocidadConfirmar = (v: 1 | 1.5 | 2 | 3 | 5) => {
    if (!popupActivo?.lineaId) {
      popupSiguiente();
      return;
    }
    setLineas((prev) =>
      prev.map((l) =>
        l.id === popupActivo.lineaId ? { ...l, velocidad: v } : l
      )
    );
    popupSiguiente();
  };

  const handleDefensaConfirmar = (
    subtipo: "toque" | "gran-defensa" | "libre" | null,
    jugadorId: string | null,
    x2: boolean
  ) => {
    if (!popupActivo?.lineaId) {
      popupSiguiente();
      return;
    }
    setLineas((prev) => {
      const idx = prev.findIndex((l) => l.id === popupActivo.lineaId);
      if (idx < 0) return prev;
      const copia = [...prev];

      const lineaActual = copia[idx];
      const jugadorFinal = jugadorId ?? lineaActual.jugadorId ?? null;

      copia[idx] = {
        ...lineaActual,
        subtipo: subtipo ?? lineaActual.subtipo,
        jugadorId: jugadorFinal,
        x2: x2 || undefined,
      };

      return copia;
    });
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

  const handleBloqueoConfirmar = (jugadorId: string | null) => {
    if (!popupActivo) return;
    const idx = popupActivo.indiceDesvio;
    if (idx !== undefined && idx >= 0) {
      setDesviosPendientes((prev) =>
        prev.map((d, i) => (i === idx ? { ...d, jugadorId } : d))
      );
    }
    popupSiguiente();
  };

  const handleRoceRedConfirmar = (
    resultado:
      | "ofensivo-propio"
      | "invasion-zaguero"
      | "invasion-delantero"
      | "roce-red-rival",
    jugadorId: string | null
  ) => {
    if (!popupActivo) return;

    const esRival = resultado === "roce-red-rival";

    if (!popupActivo.lineaId) {
      const ficticia: LineaClasificada = {
        id: `tr-${contadorId}`,
        tipo: "roce-red",
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

  const handleAtaqueToqueLibreConfirmar = (v: "toque" | "libre") => {
    if (!popupActivo) return;

    if (v === "toque") {
      setLineas((prev) =>
        prev.map((l) =>
          l.id === popupActivo.lineaId ? { ...l, variante: "toque" } : l
        )
      );
    } else if (v === "libre") {
      setLineas((prev) =>
        prev.map((l) =>
          l.id === popupActivo.lineaId
            ? { ...l, tipo: "libre", variante: null }
            : l
        )
      );
    }
    popupSiguiente();
  };

  const handleRemateSegundaConfirmar = () => {
    if (!popupActivo?.lineaId) {
      popupSiguiente();
      return;
    }

    const idx = lineas.findIndex((l) => l.id === popupActivo.lineaId);
    if (idx < 0) {
      popupSiguiente();
      return;
    }

    const linea = lineas[idx];

    if (linea.tipo === "libre" && linea.esRival) {
      setLineas((prev) =>
        prev.map((l) =>
          l.id === popupActivo.lineaId
            ? { ...l, tipo: "ataque", subtipo: "toque" }
            : l
        )
      );
    } else if (linea.tipo === "bloqueo" && !linea.esRival) {
      const nuevoId = `l-${contadorId}`;
      const ataqueRival: LineaClasificada = {
        id: nuevoId,
        tipo: "ataque",
        esRival: true,
        jugadorId: null,
        origen: linea.origen,
        destino: linea.destino,
        desvios: linea.desvios,
        subtipo: "toque",
      };
      setLineas((prev) => [...prev, ataqueRival]);
      setContadorId((c) => c + 1);
    }

    popupSiguiente();
  };

  const cerrarPopup = () => setColaPopups([]);

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

  const handleFijarPosiciones = (pos: Record<Zona, string>) => {
    if (!clavePosicionesFijas) return;
    setPosicionesFijas((prev) => ({
      ...prev,
      [clavePosicionesFijas]: { ...pos },
    }));
  };

  const handleLimpiarFijadas = () => {
    if (!clavePosicionesFijas) return;
    setPosicionesFijas((prev) => {
      const copia = { ...prev };
      delete copia[clavePosicionesFijas];
      return copia;
    });
  };

  const irAPunto = (n: number) => {
    if (n < 1 || n > maxNavegable) return;
    setPuntoActual(n);
    cargarPuntoDesde(puntosCerrados, n);
  };

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

  const necesitaSetup = !setupCompleto;

  const handleComenzar = () => {
    if (!rotacion) {
      alert("Necesitás una rotación antes de comenzar.");
      return;
    }
    setSetupCompleto(true);
  };

  const lineasVisibles = lineas.filter((l) => !l.oculta).length;

  return (
    <div className="space-y-3">
      <BarraMarcadorV2
        nombreMiEquipo={nombreMiEquipo}
        nombreRival={nombreRival}
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
          onFijarPosiciones={handleFijarPosiciones}
          onLimpiarFijadas={handleLimpiarFijadas}
          onSetLiberos={setLiberos}
          onSetPosicionesPunto={setPosicionesPunto}
          onSetCambiosPendientes={setCambiosPendientes}
          onGuardarCambios={handleGuardarCambios}
          onCambioRotacion={handleCambioRotacion}
          onCambioSaque={handleCambioSaque}
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
                  onFijarPosiciones={handleFijarPosiciones}
                  onLimpiarFijadas={handleLimpiarFijadas}
                  onSetLiberos={setLiberos}
                  onSetPosicionesPunto={setPosicionesPunto}
                  onSetCambiosPendientes={setCambiosPendientes}
                  onGuardarCambios={handleGuardarCambios}
                  onCambioRotacion={handleCambioRotacion}
                  onCambioSaque={handleCambioSaque}
                  onComenzar={handleComenzar}
                />
              )}
              <SecuenciaV2
                lineas={secuenciaConValores}
                nombreDeJugador={nombreDeJugador}
              />
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
                onCerrarPunto={handleCerrarPunto}
                onPuntoSiguiente={() => irAPunto(puntoActual + 1)}
                onPuntoAnterior={() => irAPunto(puntoActual - 1)}
                onBorrarPunto={handleBorrarPunto}
                onBorrarLinea={handleBorrarUltima}
                puedeCerrarPunto={lineas.length > 0}
                puedeIrSiguiente={puntoActual + 1 <= maxNavegable}
                puedeIrAnterior={puntoActual > 1}
                puedeBorrarPunto={lineas.length > 0}
                puedeBorrarLinea={
                  lineas.length > 0 || !!circuloArmado || !!circuloSinArmar
                }
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
                  delanterosPorZona={delanterosPorZona}
                  onSaqueConfirmar={handleSaqueConfirmar}
                  onTipoSaqueConfirmar={handleTipoSaqueConfirmar}
                  onRecepcionConfirmar={handleRecepcionConfirmar}
                  onArmadoConfirmar={handleArmadoConfirmar}
                  onVelocidadConfirmar={handleVelocidadConfirmar}
                  onDefensaConfirmar={handleDefensaConfirmar}
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
            puedeBorrarUltima={
              lineas.length > 0 || !!circuloArmado || !!circuloSinArmar
            }
            puedeBorrarPunto={lineas.length > 0}
            puedeGuardar={Object.keys(puntosCerrados).length > 0}
            puedeCerrarPunto={lineas.length > 0}
            onBorrarUltima={handleBorrarUltima}
            onBorrarPunto={handleBorrarPunto}
            onGuardar={handleGuardarSupabase}
            onCerrarPunto={handleCerrarPunto}
          />
        </>
      )}
    </div>
  );
}