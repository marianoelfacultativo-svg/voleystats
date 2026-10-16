"use client";

import { useEffect, useMemo, useState } from "react";
import CanchaV2, {
  getRectMiniLayout,
  type CoordsV2,
  type Orientacion,
} from "./CanchaV2";
import LineasV2, { type PuntoV2, type LineaV2 } from "./LineasV2";
import PanelRotacionV2, {
  type CambioPendiente,
} from "./PanelRotacionV2";
import {
  PopupArmado,
  PopupAtaqueToqueLibre,
  PopupBloqueo,
  PopupDefensa,
  PopupJugador,
  PopupLibre,
  PopupRecepcion,
  PopupRemateSegunda,
  PopupRoceRed,
  PopupSaque,
  PopupVelocidad,
  type ValorArmado,
  type ValorRecepcion,
  type ValorSaque,
  type ValorVelocidad,
  type TipoDefensa,
  type ResultadoRoceRed,
  type VarianteAtaquePopup,
  type VarianteRemateSegunda,
  type JugadorEnCancha,
  type JugadorZona,
  type PopupPos,
} from "./PopupValoracion";

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
  type PopupRequerido,
  type Situacion,
} from "@/lib/clasificacionV2";
import {
  guardarPuntoV2,
  type AccionV2Data,
  type PuntoV2Data,
} from "@/lib/dbV2";
import { borrarPuntoV1DeTablas } from "@/lib/db";

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
  tipo: Exclude<PopupRequerido, null> | "velocidad";
  pos: PopupPos;
  lineaId: string;
  indiceDesvio?: number;
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
const CLAVE_POSICIONES_FIJAS = "voleystats_posiciones_fijas_";

const POSICIONES_VACIAS: Record<Zona, string> = {
  1: "",
  2: "",
  3: "",
  4: "",
  5: "",
  6: "",
};

type PosicionesFijasMap = Record<string, Record<Zona, string>>;

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

function aAccionV2(
  l: LineaClasificada,
  orden: number,
  override?: { jugadorId?: string | null; subtipo?: string | null }
): AccionV2Data {
  let subtipoFinal =
    override?.subtipo !== undefined ? override.subtipo : l.subtipo ?? null;

  if (
    override?.subtipo === undefined &&
    l.tipo === "ataque" &&
    l.variante === "toque" &&
    subtipoFinal !== null
  ) {
    subtipoFinal = `toque:${subtipoFinal}`;
  }

  const jugadorFinal =
    override?.jugadorId !== undefined ? override.jugadorId : l.jugadorId;
  return {
    orden,
    tipo: l.tipo,
    subtipo: subtipoFinal,
    es_rival: l.esRival,
    jugador_id: jugadorFinal,
    lado: l.esRival ? "rival" : "propio",
    origen_celda: l.origen.celda,
    origen_mini: l.origen.mini,
    destino_celda: l.destino.celda,
    destino_mini: l.destino.mini,
    desvios: (l.desvios ?? []).map((d) => ({ celda: d.celda, mini: d.mini })),
    zona: null,
    posicion_inicial_celda: l.posicionInicial?.celda ?? null,
    posicion_inicial_mini: l.posicionInicial?.mini ?? null,
    velocidad: l.velocidad ?? null,
  };
}

function lineasAAcciones(lineas: LineaClasificada[]): AccionV2Data[] {
  const acciones: AccionV2Data[] = [];
  let orden = 1;
  for (const l of lineas) {
    if (l.tipo === "bloqueo" && !l.esRival) {
      const desviosBLOQP = (l.desvios ?? []).filter((d) =>
        d.celda.startsWith("BLOQ-P-")
      );
      if (desviosBLOQP.length > 1) {
        const base = (l.subtipo ?? "positivo") as string;
        const esPositiva =
          base === "punto" || base === "positivo_mas" || base === "positivo";
        const sub = esPositiva ? "positivo" : "neutro";
        for (const d of desviosBLOQP) {
          acciones.push(
            aAccionV2(l, orden++, {
              jugadorId: d.jugadorId ?? null,
              subtipo: sub,
            })
          );
        }
        continue;
      }
    }
    acciones.push(aAccionV2(l, orden++));
  }
  return acciones;
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

function calcularRecepcionOverrides(
  posicionesFijas: Record<Zona, string>,
  posicionesPunto: Record<Zona, string>
): Partial<Record<Zona, string | null>> {
  const out: Partial<Record<Zona, string | null>> = {};
  for (const z of [5, 6, 1] as Zona[]) {
    const fijo = posicionesFijas[z];
    if (fijo) out[z] = fijo;
  }
  for (const z of [5, 6, 1] as Zona[]) {
    const pto = posicionesPunto[z];
    if (pto) out[z] = pto;
  }
  return out;
}

function rolCortoParaUI(rol: string): string {
  if (rol === "C1" || rol === "C2") return "C";
  if (rol === "P1" || rol === "P2") return "P";
  return rol;
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

  const [posicionesFijas, setPosicionesFijas] = useState<PosicionesFijasMap>(
    {}
  );

  const [setActivo, setSetActivo] = useState<number>(1);
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

  const jugadoresEnCancha: JugadorEnCancha[] = useMemo(() => {
    if (!rotacion) return [];

    const numeroRot = numeroRotacionDesdePosiciones(rotacion);
    const fila = POSICIONES_JUEGO[numeroRot]?.[situacion];
    const rotConLib: RotacionPunto = { ...rotacion, liberos };

    const zonasOrden: Zona[] = [1, 2, 3, 4, 5, 6];
    const out: JugadorEnCancha[] = [];

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

  const delanterosPorZona: JugadorZona[] = useMemo(() => {
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

  const lineasParaUI: LineaV2[] = useMemo(() => lineas.map(aLineaV2), [lineas]);
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
      const saqueSig: Lado = prev.ganador;
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

  // ---------- GUARDADO (bloqueado hasta hidratar) ----------
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
      if (data.setActivo) setSetActivo(data.setActivo);
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

  const handleSaqueConfirmar = (_v: ValorSaque) => {
    popupSiguiente();
  };

  const handleRecepcionConfirmar = (v: ValorRecepcion) => {
    actualizarLineaPopup({ subtipo: v });
    popupSiguiente();
  };

  const handleArmadoConfirmar = (v: ValorArmado) => {
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

  const handleVelocidadConfirmar = (v: ValorVelocidad) => {
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
    subtipo: TipoDefensa | null,
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
    resultado: ResultadoRoceRed,
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

  const handleAtaqueToqueLibreConfirmar = (v: VarianteAtaquePopup) => {
    if (!popupActivo) return;

    if (v === "toque") {
      setLineas((prev) =>
        prev.map((l) =>
          l.id === popupActivo.lineaId
            ? { ...l, variante: "toque" }
            : l
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

  const handleRemateSegundaConfirmar = (_v: VarianteRemateSegunda) => {
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

  return (
    <div className="space-y-3">
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
                  posicionesFijas={posicionesFijasActuales}
                  cambiosPendientes={cambiosPendientes}
                  onFijarPosiciones={handleFijarPosiciones}
                  onLimpiarFijadas={handleLimpiarFijadas}
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
                  posicionesFijas={posicionesFijasActuales}
                  cambiosPendientes={cambiosPendientes}
                  onFijarPosiciones={handleFijarPosiciones}
                  onLimpiarFijadas={handleLimpiarFijadas}
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
                <div className="max-h-[420px] overflow-y-auto pr-1">
                  <ol className="text-[11px] text-slate-700 space-y-1.5">
                    {secuenciaConValores.length === 0 && (
                      <li className="text-slate-400 italic text-[10px]">
                        (sin acciones)
                      </li>
                    )}
                    {secuenciaConValores.map((l, i) => {
                      const partes: string[] = [];
                      if (l.posicionInicial) {
                        partes.push(
                          `⭐${l.posicionInicial.celda}${
                            l.posicionInicial.mini
                              ? `-${l.posicionInicial.mini}`
                              : ""
                          }`
                        );
                      }
                      partes.push(
                        `${l.origen.celda}${
                          l.origen.mini ? `-${l.origen.mini}` : ""
                        }`
                      );
                      for (const d of l.desvios ?? []) {
                        partes.push(
                          `${d.celda}${d.mini ? `-${d.mini}` : ""}`
                        );
                      }
                      partes.push(
                        `${l.destino.celda}${
                          l.destino.mini ? `-${l.destino.mini}` : ""
                        }`
                      );
                      const coord = partes.join(" → ");

                      const val =
                        l.subtipo !== undefined && l.subtipo !== null
                          ? String(l.subtipo)
                          : "";
                      const esToqueAtaque =
                        l.tipo === "ataque" && l.variante === "toque";
                      return (
                        <li
                          key={l.id}
                          className="border-l-2 border-slate-300 pl-2"
                        >
                          <div className="font-semibold text-slate-800 flex items-center gap-1 flex-wrap">
                            <span>{i + 1}.</span>
                            <span>{l.tipo}</span>
                            {val && (
                              <span className="text-emerald-700 bg-emerald-50 px-1 rounded text-[10px] font-bold uppercase">
                                {val}
                              </span>
                            )}
                            {l.velocidad !== undefined &&
                              l.velocidad !== null && (
                                <span className="text-sky-700 bg-sky-50 px-1 rounded text-[10px] font-bold">
                                  v{l.velocidad}
                                </span>
                              )}
                            {l.x2 && (
                              <span className="text-violet-700 bg-violet-50 px-1 rounded text-[10px] font-bold uppercase">
                                x2
                              </span>
                            )}
                            {esToqueAtaque && (
                              <span className="text-amber-700 bg-amber-50 px-1 rounded text-[10px] font-bold uppercase">
                                toque
                              </span>
                            )}
                            {l.esRival && (
                              <span className="text-[9px] text-slate-400 italic">
                                (rival)
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-600 truncate">
                            👤{" "}
                            {l.jugadorId
                              ? nombreDeJugador(l.jugadorId)
                              : l.esRival
                              ? "—"
                              : "(sin asignar)"}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono truncate">
                            {coord}
                          </div>
                          {l.desvios && l.desvios.length > 0 && (
                            <div className="text-[10px] text-orange-600">
                              ↳ {l.desvios.length} desvío
                              {l.desvios.length !== 1 ? "s" : ""}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </div>
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
                onCerrarPunto={handleCerrarPunto}
                onPuntoSiguiente={() => irAPunto(puntoActual + 1)}
                onBorrarPunto={handleBorrarPunto}
                onBorrarLinea={handleBorrarUltima}
                puedeCerrarPunto={lineas.length > 0}
                puedeIrSiguiente={puntoActual + 1 <= maxNavegable}
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
                {popupActivo?.tipo === "velocidad" && (
                  <PopupVelocidad
                    pos={popupActivo.pos}
                    onConfirmar={handleVelocidadConfirmar}
                    onCancelar={cerrarPopup}
                  />
                )}
                {popupActivo?.tipo === "defensa" && (
                  <PopupDefensa
                    pos={popupActivo.pos}
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
                {popupActivo?.tipo === "roce-red" && (
                  <PopupRoceRed
                    pos={popupActivo.pos}
                    jugadores={jugadoresEnCancha}
                    onConfirmar={handleRoceRedConfirmar}
                    onCancelar={cerrarPopup}
                  />
                )}
                {popupActivo?.tipo === "ataque-toque-libre" && (
                  <PopupAtaqueToqueLibre
                    pos={popupActivo.pos}
                    onConfirmar={handleAtaqueToqueLibreConfirmar}
                    onCancelar={cerrarPopup}
                  />
                )}
                {popupActivo?.tipo === "remate-segunda" && (
                  <PopupRemateSegunda
                    pos={popupActivo.pos}
                    onConfirmar={handleRemateSegundaConfirmar}
                    onCancelar={cerrarPopup}
                  />
                )}
                {popupActivo?.tipo === "bloqueo" && (
                  <PopupBloqueo
                    pos={popupActivo.pos}
                    jugadores={delanterosPorZona}
                    onConfirmar={handleBloqueoConfirmar}
                    onCancelar={cerrarPopup}
                  />
                )}
              </CanchaV2>
            </div>
          </div>

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