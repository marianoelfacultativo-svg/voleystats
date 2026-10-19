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

import { supabase } from "@/lib/supabase";

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
  clasificarLinea,
  esCeldaBloqueoPropioConPopup,
  esCanchaPropia,
  esCanchaRival,
  ganadorDelPunto,
  ladoDeCelda,
  resolverJugadorDefensa,
  resolverRolAJugador,
  type EstadoClasificacion,
  type LineaClasificada,
  type PopupRequerido,
  type Situacion,
} from "@/lib/clasificacionV2";
import { jugadorQueAtacaDesdeCelda } from "@/lib/mapeoV2";
import {
  guardarPuntoV2,
  cargarPuntosV2,
  type AccionV2Data,
  type PuntoV2Data,
} from "@/lib/dbV2";
import { borrarPuntoV1DeTablas } from "@/lib/db";

import type { CambioPendiente } from "./PanelRotacionV2";

// ============================================================
// HELPERS MODO ESPEJO
// ============================================================

function invertirCelda(celda: string): string {
  if (celda.startsWith("F1-")) return "F4-" + celda.slice(3);
  if (celda.startsWith("F2-")) return "F5-" + celda.slice(3);
  if (celda.startsWith("F3-")) return "F6-" + celda.slice(3);
  if (celda.startsWith("F4-")) return "F1-" + celda.slice(3);
  if (celda.startsWith("F5-")) return "F2-" + celda.slice(3);
  if (celda.startsWith("F6-")) return "F3-" + celda.slice(3);
  if (celda.startsWith("BLOQ-P-")) return "BLOQ-R-" + celda.slice(7);
  if (celda.startsWith("BLOQ-R-")) return "BLOQ-P-" + celda.slice(7);
  if (celda.startsWith("FUERA-ARR-")) return "FUERA-ABA-" + celda.slice(10);
  if (celda.startsWith("FUERA-ABA-")) return "FUERA-ARR-" + celda.slice(10);
  return celda;
}

function jugadorQueSacaDeRot(rot: RotacionPunto): string | null {
  for (const asig of Object.values(rot.posiciones)) {
    if (asig.zona === 1) return asig.jugador_id;
  }
  return null;
}

function jugadorQueArmaDeRot(rot: RotacionPunto): string | null {
  for (const asig of Object.values(rot.posiciones)) {
    if (asig.tipo === "A") return asig.jugador_id;
  }
  return null;
}

function zonaRecepcionDeCelda(celda: string): 1 | 5 | 6 | null {
  if (!/^F[123]-/.test(celda)) return null;
  const col = celda.split("-")[1];
  if (col === "C1" || col === "C2") return 5;
  if (col === "C3") return 6;
  if (col === "C4" || col === "C5") return 1;
  return null;
}

function jugadorQueRecibeDeRot(
  origen: PuntoV2,
  rot: RotacionPunto,
  situacion: Situacion,
  overrides?: Partial<Record<Zona, string | null>>
): string | null {
  const zonaRec = zonaRecepcionDeCelda(origen.celda);
  if (zonaRec === null) return null;
  if (overrides && zonaRec in overrides) {
    return overrides[zonaRec] ?? null;
  }
  const numRot = numeroRotacionDesdePosiciones(rot);
  const fila = POSICIONES_JUEGO[numRot]?.[situacion];
  if (!fila) return null;
  const rol = fila[zonaRec];
  return resolverRolAJugador(rot, rol);
}

function generarRecepcionesAceContra(params: {
  pc: PuntoCerrado;
  lineas: LineaClasificada[];
  acciones: AccionV2Data[];
  equipoId: string;
  equipoRivalId: string | null;
  posicionesFijas: PosicionesFijasMap;
  posicionesFijasRival: PosicionesFijasMap;
  modoEspejo: boolean;
}): void {
  const {
    pc,
    lineas,
    acciones,
    equipoId,
    equipoRivalId,
    posicionesFijas,
    posicionesFijasRival,
    modoEspejo,
  } = params;

  if (!modoEspejo || !pc.estadoRival || !equipoRivalId) return;

  for (const linea of lineas) {
    if (linea.tipo !== "saque" || linea.oculta) continue;

    const esPropio = !linea.esRival;
    const equipoSacador = esPropio ? equipoId : equipoRivalId;
    if (!equipoSacador) continue;

    let esAce = false;
    if (esPropio) {
      esAce = linea.subtipo === "ace";
    } else {
      const d = linea.destino.celda;
      if (/^F[123]-/.test(d)) {
        const col = d.split("-")[1];
        if (col === "C2" || col === "C3" || col === "C4") {
          const huboRecepcion = lineas.some(
            (l) => l.tipo === "recepcion" && l.equipoId === equipoId
          );
          esAce = !huboRecepcion;
        }
      }
    }
    if (!esAce) continue;

    const equipoReceptor = esPropio ? equipoRivalId : equipoId;

    const yaHay = acciones.some(
      (a) => a.tipo === "recepcion" && a.equipo_id === equipoReceptor
    );
    if (yaHay) continue;

    let rotReceptora: RotacionPunto;
    let situacionReceptora: Situacion;
    let overrides: Partial<Record<Zona, string | null>>;
    let celdaReceptora: string;

    if (esPropio) {
      rotReceptora = pc.estadoRival.rotacion;
      situacionReceptora =
        pc.saqueInicial === "propio" ? "recepcion" : "saque";
      const clave = `${numeroRotacionDesdePosiciones(rotReceptora)}-${situacionReceptora}`;
      const fijas = posicionesFijasRival[clave] ?? POSICIONES_VACIAS;
      overrides = calcularRecepcionOverrides(
        fijas,
        pc.estadoRival.posicionesPunto
      );
      celdaReceptora = invertirCelda(linea.destino.celda);
    } else {
      rotReceptora = pc.rotacion;
      situacionReceptora = pc.situacion;
      const clave = `${numeroRotacionDesdePosiciones(rotReceptora)}-${situacionReceptora}`;
      const fijas = posicionesFijas[clave] ?? POSICIONES_VACIAS;
      overrides = calcularRecepcionOverrides(fijas, pc.posicionesPunto);
      celdaReceptora = linea.destino.celda;
    }

    let jugador = jugadorQueRecibeDeRot(
      { celda: celdaReceptora, mini: linea.destino.mini },
      rotReceptora,
      situacionReceptora,
      overrides
    );

    if (!jugador) {
      const zonaRec = zonaRecepcionDeCelda(celdaReceptora);
      if (zonaRec !== null) {
        const posicionesReceptor = esPropio
          ? pc.estadoRival?.posicionesPunto
          : pc.posicionesPunto;
        jugador =
          overrides?.[zonaRec] ||
          posicionesReceptor?.[zonaRec] ||
          rotReceptora.posiciones[zonaRec as Zona]?.jugador_id ||
          null;
      }
    }
    if (!jugador) continue;

    acciones.push({
      orden: acciones.length + 1,
      tipo: "recepcion",
      subtipo: 1,
      es_rival: !esPropio,
      jugador_id: jugador,
      lado: esPropio ? "rival" : "propio",
      origen_celda: celdaReceptora,
      origen_mini: linea.destino.mini,
      destino_celda: celdaReceptora,
      destino_mini: linea.destino.mini,
      desvios: [],
      zona: null,
      equipo_id: equipoReceptor,
    });
  }
}

// ============================================================
// HELPERS CARGA DESDE DB
// ============================================================

function subtipoPreservado(tipo: string, subtipo: any): any {
  if (tipo === "recepcion") return subtipo;
  if (tipo === "armado") return subtipo;
  if (tipo === "roce-red") return subtipo;
  if (tipo === "defensa") {
    if (
      subtipo === "toque" ||
      subtipo === "gran-defensa" ||
      subtipo === "libre" ||
      subtipo === "cobertura"
    ) {
      return subtipo;
    }
    return null;
  }
  return null;
}

async function cargarPuntosCerradosDesdeDB(
  partidoId: string,
  setActivo: number
): Promise<Record<number, PuntoCerrado>> {
  const res = await cargarPuntosV2(partidoId);
  if (!res.ok || !res.puntos) return {};

  const cerrados: Record<number, PuntoCerrado> = {};

  for (const p of res.puntos) {
    if (p.set_numero !== setActivo) continue;
    if (p.ganador !== "propio" && p.ganador !== "rival") continue;

    const acciones = [...p.acciones].sort((a, b) => a.orden - b.orden);

    const lineas: LineaClasificada[] = acciones.map((a) => {
      let variante: any = a.variante ?? null;
      let subtipoRaw: any = a.subtipo;
      if (typeof subtipoRaw === "string" && subtipoRaw.startsWith("toque:")) {
        variante = variante ?? "toque";
        subtipoRaw = subtipoRaw.slice(6);
      }

      return {
        id: `db-${a.id}`,
        tipo: a.tipo as any,
        esRival: a.es_rival,
        jugadorId: a.jugador_id ?? null,
        origen: {
          celda: a.origen_celda ?? "",
          mini: a.origen_mini ?? "",
        },
        destino: {
          celda: a.destino_celda ?? "",
          mini: a.destino_mini ?? "",
        },
        desvios: (a.desvios ?? []).map((d: any) => ({
          celda: d.celda,
          mini: d.mini,
          jugadorId: d.jugador_id ?? null,
        })),
        subtipo: subtipoPreservado(a.tipo, subtipoRaw),
        variante,
        velocidad: a.velocidad ?? null,
        tipoSaque: (a.tipo_saque as any) ?? null,
        x2: a.x2 ?? undefined,
        oculta: a.oculta ?? undefined,
        posicionInicial: a.posicion_inicial_celda
          ? {
              celda: a.posicion_inicial_celda,
              mini: a.posicion_inicial_mini ?? "",
            }
          : null,
        equipoId: a.equipo_id ?? null,
      };
    });

    cerrados[p.punto_numero] = {
      numero: p.punto_numero,
      lineas,
      saqueInicial: p.saque_equipo as any,
      situacion: p.situacion as any,
      ganador: p.ganador as any,
      rotacion: p.rotacion as any,
      liberos: (p.liberos ?? []) as any,
      posicionesPunto: (p.posiciones_punto ?? {}) as any,
      cambios: (p.cambios ?? []) as any,
      equipoId: p.equipo_id ?? undefined,
      estadoRival: p.estado_rival ? (p.estado_rival as any) : undefined,
    };
  }

  return cerrados;
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
      const override =
        posicionesPunto[z] || posicionesFijasActuales[z];
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

  const delanterosPorZonaRival = useMemo(() => {
    if (!rotacionRivalEfectiva) return [];
    const zonas: (4 | 3 | 2)[] = [4, 3, 2];
    return zonas.map((z) => {
      const asig = rotacionRivalEfectiva.posiciones[z as Zona];
      const id = asig?.jugador_id ?? null;
      const jugador = id ? jugadoresRival.find((j) => j.id === id) : null;
      return {
        zona: z,
        jugadorId: id,
        nombre: jugador ? jugador.nombre : "(vacío)",
      };
    });
  }, [rotacionRivalEfectiva, jugadoresRival]);

  const recepcionOverridesEfectivos = useMemo(() => {
    return calcularRecepcionOverrides(
      posicionesFijasActuales,
      posicionesPunto
    );
  }, [posicionesFijasActuales, posicionesPunto]);

  const recepcionOverridesRival = useMemo(() => {
    return calcularRecepcionOverrides(
      posicionesFijasActualesRival,
      posicionesPuntoRival
    );
  }, [posicionesFijasActualesRival, posicionesPuntoRival]);

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
      supabase
        .from("jugador_equipo")
        .select("jugador_id")
        .eq("equipo_id", equipoRivalId)
        .eq("activo", true),
      supabase.from("jugadores").select("id, nombre, numero"),
    ]).then(([a, j]) => {
      if (!a.data || !j.data) return;
      const ids = a.data.map((x: { jugador_id: string }) => x.jugador_id);
      const jugs = (
        j.data as { id: string; nombre: string; numero: number | null }[]
      ).filter((x) => ids.includes(x.id));
      setJugadoresRival(jugs);
    });
  }, [equipoRivalId]);

  useEffect(() => {
    if (!modoEspejo) return;
    if (!equipoRivalId) return;
    if (rotacionRival) return;
    setRotacionRival({
      ...rotacionVacia(1, setActivo, puntoActual, "rival"),
    });
  }, [modoEspejo, equipoRivalId, rotacionRival, setActivo, puntoActual]);

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
      if (pc.estadoRival) {
        setRotacionRival(pc.estadoRival.rotacion);
        setLiberosRival(pc.estadoRival.liberos);
        setPosicionesPuntoRival(pc.estadoRival.posicionesPunto);
        setCambiosPendientesRival(pc.estadoRival.cambios);
      }
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

      if (modoEspejo && prev.estadoRival?.rotacion) {
        let rotRivalSig: RotacionPunto = prev.estadoRival.rotacion;
        if (prev.ganador === "rival" && prev.saqueInicial === "propio") {
          const { rotacion: rotRG } = girarRotacionPunto(
            prev.estadoRival.rotacion,
            1
          );
          rotRivalSig = rotRG;
        }
        setRotacionRival({
          ...rotRivalSig,
          saque_equipo: saqueSig === "propio" ? "rival" : "propio",
        });
        setLiberosRival(prev.estadoRival.liberos);
        setPosicionesPuntoRival({ ...POSICIONES_VACIAS });
        setCambiosPendientesRival([]);
      }
    } else {
      setSaqueInicial("propio");
      if (rotacionInicial) setRotacion(rotacionInicial);
      setLiberos([]);
      setPosicionesPunto({ ...POSICIONES_VACIAS });
      setCambiosPendientes([]);
    }
  };

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
          modoEspejo,
          equipoRivalId,
          rotacionRival,
          liberosRival,
          posicionesPuntoRival,
          cambiosPendientesRival,
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
    modoEspejo,
    equipoRivalId,
    rotacionRival,
    liberosRival,
    posicionesPuntoRival,
    cambiosPendientesRival,
  ]);

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

    if (raw) {
      try {
        const data = JSON.parse(raw);
        if (data.setupCompleto !== undefined)
          setSetupCompleto(data.setupCompleto);
        if (data.modoEspejo !== undefined) setModoEspejo(data.modoEspejo);
        if (data.equipoRivalId !== undefined)
          setEquipoRivalId(data.equipoRivalId);
        if (data.rotacionRival) setRotacionRival(data.rotacionRival);
        if (data.liberosRival) setLiberosRival(data.liberosRival);
        if (data.posicionesPuntoRival)
          setPosicionesPuntoRival(data.posicionesPuntoRival);
        if (data.cambiosPendientesRival)
          setCambiosPendientesRival(data.cambiosPendientesRival);

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
          if (data.posicionesPunto)
            setPosicionesPunto(data.posicionesPunto);
          if (data.cambiosPendientes)
            setCambiosPendientes(data.cambiosPendientes);
          if (data.lineas) setLineas(data.lineas);
          if (data.contadorId) setContadorId(data.contadorId);
        }
        setHidratado(true);
        return;
      } catch {
        /* fallthrough a DB */
      }
    }

    (async () => {
      try {
        const cerrados = await cargarPuntosCerradosDesdeDB(partidoId, 1);
        setPuntosCerrados(cerrados);

        const numeros = Object.keys(cerrados).map((k) => parseInt(k));
        const siguiente =
          numeros.length > 0 ? Math.max(...numeros) + 1 : 1;

        setPuntoActual(siguiente);
        cargarPuntoDesde(cerrados, siguiente);

        if (numeros.length > 0) {
          setSetupCompleto(true);
        }
      } catch (e) {
        console.error("Error cargando puntos desde Supabase:", e);
      }
      setHidratado(true);
    })();
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
          equipoId: equipoId,
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
          equipoId: equipoId,
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
      modoEspejo,
      equipoPropioId: equipoId,
      equipoRivalId: equipoRivalId,
      rotacionRival: rotacionRivalEfectiva,
      situacionRival,
      recepcionOverridesRival,
    };

    const res = clasificarLinea(estado, {
      origen,
      destino,
      desvios:
        desviosPendientes.length > 0 ? [...desviosPendientes] : undefined,
    });

    let jugadorFinal = res.jugadorId;
    let subtipoFinal = res.subtipoFijo ?? null;
    let tipoSaqueFinal = res.tipoSaqueFijo ?? null;
    let popupFinal: PopupRequerido = res.popup;
    let equipoAccionFinal: string | null = equipoId;

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

    const esLineaDeRivalEspejo =
      modoEspejo && ladoDeCelda(origen.celda) === "rival";

    if (esLineaDeRivalEspejo && equipoRivalId && rotacionRivalEfectiva) {
      equipoAccionFinal = equipoRivalId;
      const origenInv: PuntoV2 = {
        ...origen,
        celda: invertirCelda(origen.celda),
      };

      if (res.tipo === "saque") {
        jugadorFinal = jugadorQueSacaDeRot(rotacionRivalEfectiva);
        tipoSaqueFinal = "flotado";
        popupFinal = "tipo-saque";
      } else if (res.tipo === "recepcion") {
        jugadorFinal = jugadorQueRecibeDeRot(
          origenInv,
          rotacionRivalEfectiva,
          situacionRival,
          recepcionOverridesRival
        );
        popupFinal = "recepcion";
      } else if (res.tipo === "armado") {
        jugadorFinal = jugadorQueArmaDeRot(rotacionRivalEfectiva);
        popupFinal = "armado";
      } else if (res.tipo === "ataque") {
        jugadorFinal = jugadorQueAtacaDesdeCelda(
          origenInv.celda,
          rotacionRivalEfectiva,
          situacionRival
        );
        popupFinal = "ataque-toque-libre";
      } else if (res.tipo === "defensa") {
        jugadorFinal = resolverJugadorDefensa(
          origenInv,
          rotacionRivalEfectiva,
          situacionRival
        );
        if (!subtipoFinal) subtipoFinal = "defensa_normal";
        popupFinal = "defensa";
      } else if (res.tipo === "libre") {
        popupFinal = "libre";
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
      equipoId: equipoAccionFinal,
    };

    setLineas((prev) => [...prev, nueva]);
    setContadorId((c) => c + 1);
    setDesviosPendientes([]);

    setCirculoSinArmar(destino);
    setCirculoArmado(null);

    const cola: PopupEnCola[] = [];
    const pos = posicionPopup(destino);
    if (popupFinal) {
      cola.push({ tipo: popupFinal, pos, lineaId: nueva.id });
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

  const handleBorrarLocal = () => {
    if (
      !confirm(
        "¿Borrar los datos guardados en ESTE navegador para este partido?\n\nNO toca Supabase. Si ya guardaste en Supabase, al recargar se recupera desde ahí."
      )
    )
      return;

    try {
      localStorage.removeItem(CLAVE_V2 + partidoId);
      localStorage.removeItem(CLAVE_POSICIONES_FIJAS + partidoId);
    } catch {
      /* noop */
    }

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
        const siguiente =
          numeros.length > 0 ? Math.max(...numeros) + 1 : 1;
        setPuntoActual(siguiente);
        cargarPuntoDesde(cerrados, siguiente);
        if (numeros.length > 0) setSetupCompleto(true);
      } catch (e) {
        console.error("Error recargando desde Supabase:", e);
      }
    })();
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
        equipo_id:
          pc.equipoId ??
          (pc.saqueInicial === "propio" ? equipoId : equipoRivalId),
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

      generarRecepcionesAceContra({
        pc,
        lineas: lineasConErroresRival,
        acciones,
        equipoId,
        equipoRivalId,
        posicionesFijas,
        posicionesFijasRival,
        modoEspejo,
      });

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

  const handleDefensaX2Change = (x2: boolean) => {
    if (!popupActivo?.lineaId) return;
    setLineas((prev) =>
      prev.map((l) =>
        l.id === popupActivo.lineaId
          ? { ...l, x2: x2 || undefined }
          : l
      )
    );
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
        equipoId: esRival ? equipoRivalId : equipoId,
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
        equipoId: equipoRivalId,
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

  const handleGuardarCambiosRival = () => {
    if (!rotacionRival) return;
    const nueva = { ...rotacionRival };
    for (const c of cambiosPendientesRival) {
      if (nueva.posiciones[c.zona]) {
        nueva.posiciones[c.zona] = {
          ...nueva.posiciones[c.zona],
          jugador_id: c.jugadorEntra,
        };
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
    if (rotacionRival) {
      setRotacionRival({
        ...rotacionRival,
        saque_equipo: equipo === "propio" ? "rival" : "propio",
      });
    }
  };

  const handleCambioSaqueRival = (equipo: SaqueEquipo) => {
    if (rotacionRival)
      setRotacionRival({ ...rotacionRival, saque_equipo: equipo });
    setSaqueInicial(equipo === "propio" ? "rival" : "propio");
    if (rotacion) {
      setRotacion({
        ...rotacion,
        saque_equipo: equipo === "propio" ? "rival" : "propio",
      });
    }
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

  const handleFijarPosicionesRival = (pos: Record<Zona, string>) => {
    if (!clavePosicionesFijasRival) return;
    setPosicionesFijasRival((prev) => ({
      ...prev,
      [clavePosicionesFijasRival]: { ...pos },
    }));
  };

  const handleLimpiarFijadasRival = () => {
    if (!clavePosicionesFijasRival) return;
    setPosicionesFijasRival((prev) => {
      const copia = { ...prev };
      delete copia[clavePosicionesFijasRival];
      return copia;
    });
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
    if (id && !rotacionRival) {
      setRotacionRival(rotacionVacia(1, setActivo, puntoActual, "rival"));
    }
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
    if (modoEspejo && !equipoRivalId) {
      alert("Elegí un equipo rival o desactivá el modo espejo.");
      return;
    }
    if (modoEspejo && !rotacionRival) {
      alert("Falta la rotación del equipo rival.");
      return;
    }
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
        nombreRival={
          modoEspejo && nombreEquipoRivalSeleccionado
            ? nombreEquipoRivalSeleccionado
            : nombreRival
        }
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
              {rotacion &&