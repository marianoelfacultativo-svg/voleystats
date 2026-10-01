"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { obtenerSesion, cerrarSesion, type Sesion } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  cargarDetalles,
  guardarDetalles,
  type AtaqueRow,
  type DefensaRow,
  type BloqueoRow,
  type SaqueRow,
  type RecepcionRow,
  type CambioRow,
} from "@/lib/db";
import {
  rotacionVacia,
  jugadorDeTipo,
  girarRotacionPunto,
  type RotacionPunto,
  type Libero,
  type Zona,
} from "@/lib/rotaciones";
import { zonaDeOrigenAtaque } from "@/lib/cancha";

import PanelRotacion from "./PanelRotacion";
import TableroArmadorPunto, {
  type ArmadoLinea,
  type ValoracionToque,
  calcularZonaTendencia,
} from "./TableroArmadorPunto";
import CanchaAtaque from "./CanchaAtaque";
import CanchaDefensa from "./CanchaDefensa";
import CanchaBloqueo from "./CanchaBloqueo";
import CanchaSaque from "./CanchaSaque";
import CanchaRecepcion from "./CanchaRecepcion";

interface Equipo { id: string; nombre: string }
interface Jugador { id: string; nombre: string; numero: number | null; rol: string }
interface Partido { id: string; equipo_id: string; rival: string; fecha: string }
interface JugadorEquipo { id: string; jugador_id: string; equipo_id: string; activo: boolean }

interface ArmadoEntry {
  jugador_id: string;
  lineas: ArmadoLinea[];
  toques: ValoracionToque[];
}

type Pestana = "armado" | "ataque" | "defensa" | "bloqueo" | "saque" | "recepcion";

interface EstadoLocal {
  ts: number;
  rotaciones: Record<string, RotacionPunto>;
  armados: Record<string, ArmadoEntry[]>;
  ataques: AtaqueRow[];
  defensas: DefensaRow[];
  bloqueos: BloqueoRow[];
  saques: SaqueRow[];
  saquesTipo: Record<string, "flotado" | "potencia">;
  recepciones: RecepcionRow[];
  cambios: CambioRow[];
}

const CLAVE_LOCAL = "voleystats_dataentry_";
const TTL_MS = 3 * 24 * 60 * 60 * 1000;

const PESTANAS: { id: Pestana; nombre: string; icono: string }[] = [
  { id: "armado", nombre: "Armado", icono: "🎯" },
  { id: "ataque", nombre: "Ataque", icono: "⚡" },
  { id: "defensa", nombre: "Defensa", icono: "🛡️" },
  { id: "bloqueo", nombre: "Bloqueo", icono: "🧱" },
  { id: "saque", nombre: "Saque", icono: "🎯" },
  { id: "recepcion", nombre: "Recepción", icono: "🙌" },
];

const ZONAS_DELANTERAS: Zona[] = [4, 3, 2];
const ZONAS_TRASERAS: Zona[] = [5, 6, 1];

// ------------------------------------------------------------
// Helpers generales
// ------------------------------------------------------------
function buscarCentral(
  rot: RotacionPunto,
  ubicacion: "delantera" | "trasera"
): string | null {
  const zonas = ubicacion === "delantera" ? ZONAS_DELANTERAS : ZONAS_TRASERAS;
  for (const z of Object.values(rot.posiciones)) {
    if (
      (z.tipo === "C1" || z.tipo === "C2") &&
      zonas.includes(z.zona) &&
      z.jugador_id
    ) {
      return z.jugador_id;
    }
  }
  return null;
}

function buscarCentralCualquiera(rot: RotacionPunto): string | null {
  for (const z of Object.values(rot.posiciones)) {
    if ((z.tipo === "C1" || z.tipo === "C2") && z.jugador_id) {
      return z.jugador_id;
    }
  }
  return null;
}

function buscarPunta(
  rot: RotacionPunto,
  ubicacion: "delantera" | "trasera"
): string | null {
  const zonas = ubicacion === "delantera" ? ZONAS_DELANTERAS : ZONAS_TRASERAS;
  for (const z of Object.values(rot.posiciones)) {
    if (
      (z.tipo === "P1" || z.tipo === "P2") &&
      zonas.includes(z.zona) &&
      z.jugador_id
    ) {
      return z.jugador_id;
    }
  }
  return null;
}

function buscarOpuesto(rot: RotacionPunto): string | null {
  for (const z of Object.values(rot.posiciones)) {
    if (z.tipo === "O" && z.jugador_id) return z.jugador_id;
  }
  return null;
}

function buscarLibero(
  rot: RotacionPunto,
  liberos: Libero[]
): string | null {
  const tipoEsperado =
    rot.saque_equipo === "rival" ? "recepcion" : "defensa";
  const lib = liberos.find((l) => l.tipo === tipoEsperado);
  if (lib?.jugador_id) return lib.jugador_id;
  const libAlt = liberos[0];
  if (libAlt?.jugador_id) return libAlt.jugador_id;
  return null;
}

// ------------------------------------------------------------
// Defensa / recepción por rol
// ------------------------------------------------------------
function resolverJugadorPorRol(
  rol: "L" | "A" | "O" | "C" | "Pd" | "Pz",
  rot: RotacionPunto,
  liberos: Libero[],
  celda?: string
): string | null {
  if (rol === "L") {
    const lib = buscarLibero(rot, liberos);
    if (lib) return lib;
    return buscarCentral(rot, "trasera");
  }

  if (rol === "C") {
    if (celda) {
      const fila = celda.split("-")[0];
      if (fila === "F1") {
        const c = buscarCentral(rot, "delantera");
        if (c) return c;
      } else if (fila === "F2" || fila === "F3") {
        const c = buscarCentral(rot, "trasera");
        if (c) return c;
      }
    }
    return buscarCentralCualquiera(rot);
  }

  if (rol === "Pd") {
    return buscarPunta(rot, "delantera");
  }
  if (rol === "Pz") {
    return buscarPunta(rot, "trasera");
  }

  const tipoBuscado = rol === "A" ? "A" : "O";
  for (const z of Object.values(rot.posiciones)) {
    if (z.tipo === tipoBuscado && z.jugador_id) {
      return z.jugador_id;
    }
  }
  return null;
}

// ------------------------------------------------------------
// Recepción: mapeo por columna + zona del armador
// C1,C2 → zona 5 | C3 → zona 6 | C4,C5 → zona 1
// Excepción: F1-C3 → central delantero
// ------------------------------------------------------------
type RolRecep = "PD" | "PZ" | "L";

function resolverJugadorRecepcion(
  celda: string,
  rot: RotacionPunto,
  fallback?: string | null
): string | null {
  const partes = celda.split("-");
  if (partes.length < 2) return fallback ?? null;
  const fila = partes[0];
  const col = partes[1];

  const buscarCentralTraseroR = () => buscarCentral(rot, "trasera");
  const buscarCentralDelanteroR = () => buscarCentral(rot, "delantera");

  const buscarLiberoR = (): string | null => {
    const lib = buscarLibero(rot, rot.liberos);
    if (lib) return lib;
    return buscarCentralTraseroR();
  };

  // Excepción: F1-C3 → central delantero
  if (fila === "F1" && col === "C3") {
    return buscarCentralDelanteroR() ?? buscarLiberoR() ?? fallback ?? null;
  }

  // Mapeo columna → zona de recepción
  let zonaRecepcion: 1 | 5 | 6;
  if (col === "C1" || col === "C2") zonaRecepcion = 5;
  else if (col === "C3") zonaRecepcion = 6;
  else zonaRecepcion = 1; // C4, C5

  // Zona del armador
  let zonaArmador: Zona | null = null;
  for (const z of Object.values(rot.posiciones)) {
    if (z.tipo === "A" && z.jugador_id) {
      zonaArmador = z.zona;
      break;
    }
  }
  if (!zonaArmador) return fallback ?? null;

  const TABLA: Record<Zona, { z1: RolRecep; z6: RolRecep; z5: RolRecep }> = {
    1: { z1: "PD", z6: "L", z5: "PZ" },
    6: { z1: "PZ", z6: "L", z5: "PD" },
    5: { z1: "L", z6: "PZ", z5: "PD" },
    4: { z1: "L", z6: "PZ", z5: "PD" },
    3: { z1: "PZ", z6: "L", z5: "PD" },
    2: { z1: "PZ", z6: "L", z5: "PD" },
  };

  const filaTabla = TABLA[zonaArmador];
  let rol: RolRecep;
  if (zonaRecepcion === 1) rol = filaTabla.z1;
  else if (zonaRecepcion === 6) rol = filaTabla.z6;
  else rol = filaTabla.z5;

  if (rol === "L") {
    return buscarLiberoR() ?? fallback ?? null;
  }
  return (
    buscarPunta(rot, rol === "PD" ? "delantera" : "trasera") ??
    buscarLiberoR() ??
    fallback ??
    null
  );
}

// ------------------------------------------------------------
// Ataque: según celda origen + si es recepción con armador en 1
// - C1, C2 → punta delantero (o opuesto si invertir)
// - C3 F1  → central
// - C3 F2/F3 → punta zaguero
// - C4, C5 → opuesto (o punta delantero si invertir)
// ------------------------------------------------------------
function esRecepcionArmadorEn1(rot: RotacionPunto): boolean {
  if (rot.saque_equipo !== "rival") return false;
  for (const z of Object.values(rot.posiciones)) {
    if (z.tipo === "A" && z.zona === 1) return true;
  }
  return false;
}

function resolverJugadorAtaque(
  celda: string,
  rot: RotacionPunto
): string | null {
  const zona = zonaDeOrigenAtaque(celda);
  if (zona === null) return null;

  const invertir = esRecepcionArmadorEn1(rot);

  if (zona === 3) {
    return buscarCentral(rot, "delantera");
  }

  if (zona === 6) {
    return buscarPunta(rot, "trasera");
  }

  if (zona === 4) {
    return invertir
      ? buscarOpuesto(rot) ?? buscarPunta(rot, "delantera")
      : buscarPunta(rot, "delantera");
  }

  if (zona === 2) {
    return invertir
      ? buscarPunta(rot, "delantera") ?? buscarOpuesto(rot)
      : buscarOpuesto(rot);
  }

  return null;
}

// Ajuste de zona: si atacó el opuesto desde C4/C5 y está zaguero → zona 1 en vez de 2
function ajustarZonaAtaque(
  zonaOriginal: number | null,
  celda: string,
  rot: RotacionPunto
): number | null {
  if (zonaOriginal !== 2) return zonaOriginal;
  if (esRecepcionArmadorEn1(rot)) return zonaOriginal; // invertido: atacó el punta → sigue siendo 2
  // Atacó el opuesto. ¿Está delantero o zaguero?
  for (const z of Object.values(rot.posiciones)) {
    if (z.tipo === "O") {
      return ZONAS_TRASERAS.includes(z.zona) ? 1 : 2;
    }
  }
  return zonaOriginal;
}

// ============================================================
// COMPONENTE
// ============================================================
export default function DataEntryPage() {
  const router = useRouter();
  const [sesion, setSesion] = useState<Sesion | null>(null);

  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [asignaciones, setAsignaciones] = useState<JugadorEquipo[]>([]);

  const [equipoId, setEquipoId] = useState("");
  const [partidoId, setPartidoId] = useState("");
  const [setActivo, setSetActivo] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [puntoActual, setPuntoActual] = useState(1);
  const [pestana, setPestana] = useState<Pestana>("armado");

  const [rotaciones, setRotaciones] = useState<Record<string, RotacionPunto>>({});
  const [armados, setArmados] = useState<Record<string, ArmadoEntry[]>>({});
  const [armadoIdx, setArmadoIdx] = useState(0);
  const [ataques, setAtaques] = useState<AtaqueRow[]>([]);
  const [defensas, setDefensas] = useState<DefensaRow[]>([]);
  const [bloqueos, setBloqueos] = useState<BloqueoRow[]>([]);
  const [saques, setSaques] = useState<SaqueRow[]>([]);
  const [saquesTipo, setSaquesTipo] = useState<
    Record<string, "flotado" | "potencia">
  >({});
  const [recepciones, setRecepciones] = useState<RecepcionRow[]>([]);
  const [cambios, setCambios] = useState<CambioRow[]>([]);

  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const keyPuntoActual = `${setActivo}-${puntoActual}`;

  useEffect(() => {
    const s = obtenerSesion();
    if (!s || s.tipo !== "admin") {
      router.push("/");
      return;
    }
    setSesion(s);
  }, [router]);

  useEffect(() => {
    if (!sesion) return;
    supabase
      .from("equipos")
      .select("id, nombre")
      .order("nombre")
      .then(({ data }) => data && setEquipos(data));
  }, [sesion]);

  useEffect(() => {
    if (!equipoId) {
      setPartidos([]);
      setPartidoId("");
      return;
    }
    supabase
      .from("partidos")
      .select("id, equipo_id, rival, fecha")
      .eq("equipo_id", equipoId)
      .order("fecha", { ascending: false })
      .then(({ data }) => data && setPartidos(data));
    setPartidoId("");
  }, [equipoId]);

  useEffect(() => {
    if (!equipoId) {
      setJugadores([]);
      setAsignaciones([]);
      return;
    }
    setCargando(true);
    Promise.all([
      supabase
        .from("jugador_equipo")
        .select("*")
        .eq("equipo_id", equipoId)
        .eq("activo", true),
      supabase.from("jugadores").select("*").order("nombre"),
    ]).then(([a, j]) => {
      setCargando(false);
      if (a.data) setAsignaciones(a.data);
      if (j.data) setJugadores(j.data);
    });
  }, [equipoId]);

  useEffect(() => {
    if (!partidoId) return;
    setCargando(true);
    limpiarTodo();

    const raw =
      typeof window !== "undefined"
        ? localStorage.getItem(CLAVE_LOCAL + partidoId)
        : null;
    if (raw) {
      try {
        const data: EstadoLocal = JSON.parse(raw);
        if (Date.now() - data.ts < TTL_MS) {
          if (confirm("Hay datos sin guardar de este partido. ¿Recuperarlos?")) {
            setRotaciones(data.rotaciones ?? {});
            setArmados(data.armados ?? {});
            setAtaques(data.ataques ?? []);
            setDefensas(data.defensas ?? []);
            setBloqueos(data.bloqueos ?? []);
            setSaques(data.saques ?? []);
            setSaquesTipo(data.saquesTipo ?? {});
            setRecepciones(data.recepciones ?? []);
            setCambios(data.cambios ?? []);
            setCargando(false);
            return;
          } else {
            localStorage.removeItem(CLAVE_LOCAL + partidoId);
          }
        } else {
          localStorage.removeItem(CLAVE_LOCAL + partidoId);
        }
      } catch {
        localStorage.removeItem(CLAVE_LOCAL + partidoId);
      }
    }

    cargarDetalles(partidoId).then((d) => {
      setCargando(false);

      const rot: Record<string, RotacionPunto> = {};
      (d.rotaciones as any[]).forEach((r) => {
        rot[`${r.set_numero}-${r.punto_numero}`] = {
          set_numero: r.set_numero,
          punto_numero: r.punto_numero,
          saque_equipo: r.saque_equipo,
          posiciones: r.posiciones,
          liberos: r.liberos,
        };
      });
      setRotaciones(rot);

      supabase
        .from("armados_detalle")
        .select("*")
        .eq("partido_id", partidoId)
        .order("created_at")
        .then(({ data }) => {
          if (!data) return;
          const porPunto: Record<string, ArmadoEntry[]> = {};
          data.forEach((a: any) => {
            const k = `${a.set_numero}-${a.punto_numero}`;
            if (!porPunto[k]) porPunto[k] = [];
            let entry = porPunto[k].find((x) => x.jugador_id === a.jugador_id);
            if (!entry) {
              entry = { jugador_id: a.jugador_id, lineas: [], toques: [] };
              porPunto[k].push(entry);
            }
            if (a.tipo === "toque") {
              if (!a.valoracion_toque) return;
              entry.toques.push(a.valoracion_toque as ValoracionToque);
            } else {
              entry.lineas.push({
                origen: { celda: a.origen_celda, mini: a.origen_mini },
                destino: { celda: a.destino_celda, mini: a.destino_mini },
                calidad: a.calidad,
              });
            }
          });
          setArmados(porPunto);
        });

      setAtaques(d.ataques);
      setDefensas(d.defensas);
      setBloqueos(d.bloqueos);
      setSaques(d.saques);
      setSaquesTipo({});
      setRecepciones(d.recepciones);
      setCambios(d.cambios);

      const puntos = new Set<number>();
      [...d.ataques, ...d.defensas, ...d.bloqueos, ...d.saques, ...d.recepciones].forEach(
        (x: any) => {
          if (x.set_numero === setActivo) puntos.add(x.punto_numero);
        }
      );
      const maxP = puntos.size > 0 ? Math.max(...puntos) : 1;
      setPuntoActual(maxP);
    });
  }, [partidoId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!partidoId) return;
    if (rotaciones[keyPuntoActual]) return;

    let heredada: RotacionPunto | null = null;

    for (let p = puntoActual - 1; p >= 1; p--) {
      const k = `${setActivo}-${p}`;
      if (rotaciones[k]) {
        heredada = rotaciones[k];
        break;
      }
    }

    if (!heredada) {
      for (let s = setActivo - 1; s >= 1; s--) {
        const keys = Object.keys(rotaciones)
          .filter((k) => k.startsWith(`${s}-`))
          .sort((a, b) => {
            const pa = parseInt(a.split("-")[1]);
            const pb = parseInt(b.split("-")[1]);
            return pb - pa;
          });
        if (keys.length > 0) {
          heredada = rotaciones[keys[0]];
          break;
        }
      }
    }

    const nueva: RotacionPunto = heredada
      ? { ...heredada, set_numero: setActivo, punto_numero: puntoActual }
      : rotacionVacia(1, setActivo, puntoActual, "propio");

    setRotaciones((prev) => ({ ...prev, [keyPuntoActual]: nueva }));
  }, [keyPuntoActual, partidoId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!partidoId) return;
    const t = setTimeout(() => {
      const data: EstadoLocal = {
        ts: Date.now(),
        rotaciones,
        armados,
        ataques,
        defensas,
        bloqueos,
        saques,
        saquesTipo,
        recepciones,
        cambios,
      };
      try {
        localStorage.setItem(CLAVE_LOCAL + partidoId, JSON.stringify(data));
      } catch {
        /* noop */
      }
    }, 800);
    return () => clearTimeout(t);
  }, [
    partidoId,
    rotaciones,
    armados,
    ataques,
    defensas,
    bloqueos,
    saques,
    saquesTipo,
    recepciones,
    cambios,
  ]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (
        t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.tagName === "SELECT"
      )
        return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (typeof document !== "undefined" && document.querySelector("[data-popup]"))
        return;
      const n = parseInt(e.key);
      if (n >= 1 && n <= 6) {
        setPestana(PESTANAS[n - 1].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const guardarRef = useRef<() => void>(() => {});
  guardarRef.current = guardarTodo;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "g") {
        e.preventDefault();
        guardarRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const limpiarTodo = () => {
    setRotaciones({});
    setArmados({});
    setAtaques([]);
    setDefensas([]);
    setBloqueos([]);
    setSaques([]);
    setSaquesTipo({});
    setRecepciones([]);
    setCambios([]);
    setPuntoActual(1);
    setArmadoIdx(0);
  };

  const jugadoresDelEquipo = asignaciones
    .map((a) => jugadores.find((j) => j.id === a.jugador_id))
    .filter((j): j is Jugador => !!j);

  const nombreDe = (id: string | null) => {
    if (!id) return null;
    const j = jugadores.find((x) => x.id === id);
    return j ? `${j.nombre}${j.numero !== null ? ` #${j.numero}` : ""}` : "?";
  };

  const rotActual: RotacionPunto =
    rotaciones[keyPuntoActual] ??
    rotacionVacia(1, setActivo, puntoActual, "propio");

  const setRotActual = (r: RotacionPunto) =>
    setRotaciones((prev) => ({ ...prev, [keyPuntoActual]: r }));

  const filtrar = <
    T extends { set_numero: number; punto_numero: number }
  >(
    arr: T[]
  ) =>
    arr.filter(
      (x) => x.set_numero === setActivo && x.punto_numero === puntoActual
    );

  const atacanteSugerido: string | null = null;
  const sacadorActual = rotActual.posiciones[1]?.jugador_id ?? null;
  const armadorDelPunto = jugadorDeTipo(rotActual, "A");

  const armadosDelPunto = armados[keyPuntoActual] ?? [];
  const armadoActual = armadosDelPunto[armadoIdx] ?? {
    jugador_id: armadorDelPunto ?? "",
    lineas: [],
    toques: [],
  };

  useEffect(() => {
    setArmadoIdx(0);
  }, [keyPuntoActual]);

  const agregarArmado = () => {
    setArmados((prev) => {
      const actuales = prev[keyPuntoActual] ?? [];
      return {
        ...prev,
        [keyPuntoActual]: [
          ...actuales,
          { jugador_id: armadorDelPunto ?? "", lineas: [], toques: [] },
        ],
      };
    });
    setArmadoIdx(armadosDelPunto.length);
  };

  const setContenidoArmadoActual = (
    lineas: ArmadoLinea[],
    toques: ValoracionToque[]
  ) => {
    setArmados((prev) => {
      const actuales = [...(prev[keyPuntoActual] ?? [])];
      if (actuales.length === 0) {
        actuales.push({ jugador_id: armadorDelPunto ?? "", lineas, toques });
      } else {
        actuales[armadoIdx] = { ...actuales[armadoIdx], lineas, toques };
      }
      return { ...prev, [keyPuntoActual]: actuales };
    });
  };

  const setJugadorArmadoActual = (jugador_id: string) => {
    setArmados((prev) => {
      const actuales = [...(prev[keyPuntoActual] ?? [])];
      if (actuales.length === 0) {
        actuales.push({ jugador_id, lineas: [], toques: [] });
      } else {
        actuales[armadoIdx] = { ...actuales[armadoIdx], jugador_id };
      }
      return { ...prev, [keyPuntoActual]: actuales };
    });
  };

  const borrarArmadoActual = () => {
    setArmados((prev) => {
      const actuales = [...(prev[keyPuntoActual] ?? [])];
      actuales.splice(armadoIdx, 1);
      return { ...prev, [keyPuntoActual]: actuales };
    });
    setArmadoIdx((prev) => Math.max(0, prev - 1));
  };

  const rePropagarRotacion = () => {
    if (!partidoId) return;
    const rotBase = rotaciones[keyPuntoActual];
    if (!rotBase) {
      alert("No hay rotación en este punto para propagar.");
      return;
    }

    const puntosDelSet = new Set<number>();
    Object.keys(rotaciones).forEach((k) => {
      const [sStr, pStr] = k.split("-");
      if (parseInt(sStr) === setActivo) puntosDelSet.add(parseInt(pStr));
    });
    [...ataques, ...defensas, ...bloqueos, ...saques, ...recepciones].forEach(
      (x) => {
        if (x.set_numero === setActivo) puntosDelSet.add(x.punto_numero);
      }
    );

    const ultimoPunto =
      puntosDelSet.size > 0 ? Math.max(...Array.from(puntosDelSet)) : puntoActual;

    if (ultimoPunto <= puntoActual) {
      alert("No hay puntos siguientes en este set para re-propagar.");
      return;
    }

    const ok = confirm(
      `Esto va a sobreescribir la rotación de los puntos ${puntoActual + 1} al ${ultimoPunto} del set ${setActivo}. ¿Continuar?`
    );
    if (!ok) return;

    const nuevasRots = { ...rotaciones };
    let rotPrevia = rotBase;
    for (let p = puntoActual + 1; p <= ultimoPunto; p++) {
      const { rotacion: rotNueva } = girarRotacionPunto(rotPrevia, 1);
      const rotAjustada: RotacionPunto = {
        ...rotNueva,
        set_numero: setActivo,
        punto_numero: p,
      };
      nuevasRots[`${setActivo}-${p}`] = rotAjustada;
      rotPrevia = rotAjustada;
    }
    setRotaciones(nuevasRots);
    setMensaje(
      `✅ Rotación re-propagada al set ${setActivo} (puntos ${puntoActual + 1}-${ultimoPunto})`
    );
  };

  const agregarAtaque = (
    a: Omit<
      AtaqueRow,
      "id" | "partido_id" | "jugador_id" | "set_numero" | "punto_numero"
    >
  ) => {
    const jugId = resolverJugadorAtaque(a.origen_celda, rotActual);
    if (!jugId) return;

    const zonaAjustada = ajustarZonaAtaque(a.zona, a.origen_celda, rotActual);

    const row: AtaqueRow = {
      ...a,
      zona: zonaAjustada,
      partido_id: partidoId,
      jugador_id: jugId,
      set_numero: setActivo,
      punto_numero: puntoActual,
    };
    setAtaques((prev) => [...prev, row]);
  };

  const agregarDefensa = (
    d: Omit<
      DefensaRow,
      "id" | "partido_id" | "jugador_id" | "set_numero" | "punto_numero"
    >
  ) => {
    const jugId =
      resolverJugadorPorRol(d.rol, rotActual, rotActual.liberos, d.celda) ??
      jugadoresDelEquipo[0]?.id;
    if (!jugId) return;
    const row: DefensaRow = {
      ...d,
      partido_id: partidoId,
      jugador_id: jugId,
      set_numero: setActivo,
      punto_numero: puntoActual,
    };
    setDefensas((prev) => [...prev, row]);
  };

  const agregarBloqueo = (
    b: Omit<BloqueoRow, "id" | "partido_id" | "set_numero" | "punto_numero">
  ) => {
    const row: BloqueoRow = {
      ...b,
      partido_id: partidoId,
      set_numero: setActivo,
      punto_numero: puntoActual,
    };
    setBloqueos((prev) => [...prev, row]);
  };

  const agregarSaque = (
    s: Omit<
      SaqueRow,
      "id" | "partido_id" | "jugador_id" | "set_numero" | "punto_numero" | "tipo"
    >
  ) => {
    const jugId =
      rotActual.posiciones[1]?.jugador_id ?? jugadoresDelEquipo[0]?.id;
    if (!jugId) return;
    const row: SaqueRow = {
      ...s,
      tipo: saquesTipo[keyPuntoActual] ?? "flotado",
      partido_id: partidoId,
      jugador_id: jugId,
      set_numero: setActivo,
      punto_numero: puntoActual,
    };
    setSaques((prev) => [...prev, row]);
  };

  const agregarRecepcion = (
    r: Omit<
      RecepcionRow,
      "id" | "partido_id" | "jugador_id" | "set_numero" | "punto_numero"
    >
  ) => {
    const fallback =
      rotActual.liberos[0]?.jugador_id ??
      jugadoresDelEquipo[0]?.id ??
      null;
    const jugId = resolverJugadorRecepcion(
      r.origen_celda,
      rotActual,
      fallback
    );
    if (!jugId) return;
    const row: RecepcionRow = {
      ...r,
      partido_id: partidoId,
      jugador_id: jugId,
      set_numero: setActivo,
      punto_numero: puntoActual,
    };
    setRecepciones((prev) => [...prev, row]);
  };

  async function guardarTodo() {
    if (!partidoId) return;
    if (!confirm("¿Guardar los datos de este partido en la base?")) return;

    setGuardando(true);
    setMensaje("");

    const filasArmados: any[] = [];
    for (const [k, listaArmados] of Object.entries(armados)) {
      const [sStr, pStr] = k.split("-");
      const s = parseInt(sStr);
      const p = parseInt(pStr);
      listaArmados.forEach((armado) => {
        if (!armado.jugador_id) return;

        armado.lineas.forEach((l) => {
          const zona = calcularZonaTendencia(l.destino.celda);
          filasArmados.push({
            partido_id: partidoId,
            jugador_id: armado.jugador_id,
            set_numero: s,
            punto_numero: p,
            origen_celda: l.origen.celda,
            origen_mini: l.origen.mini,
            destino_celda: l.destino.celda,
            destino_mini: l.destino.mini,
            zona_tendencia: zona,
            calidad: l.calidad,
            atacante_derecho: "arriba",
            armador_numero: 1,
            tipo: "armado",
            valoracion_toque: null,
          });
        });

        (armado.toques ?? []).forEach((v) => {
          filasArmados.push({
            partido_id: partidoId,
            jugador_id: armado.jugador_id,
            set_numero: s,
            punto_numero: p,
            origen_celda: "-",
            origen_mini: null,
            destino_celda: "-",
            destino_mini: null,
            zona_tendencia: null,
            calidad: null,
            atacante_derecho: "arriba",
            armador_numero: 1,
            tipo: "toque",
            valoracion_toque: v,
          });
        });
      });
    }

    await supabase.from("armados_detalle").delete().eq("partido_id", partidoId);

    if (filasArmados.length > 0) {
      const { error } = await supabase
        .from("armados_detalle")
        .insert(filasArmados);
      if (error) {
        setGuardando(false);
        setMensaje("❌ Error armados: " + error.message);
        return;
      }
    }

    const rots = Object.values(rotaciones).map((r) => ({
      ...r,
      partido_id: partidoId,
    }));

    const res = await guardarDetalles(partidoId, {
      rotaciones: rots,
      ataques,
      defensas,
      bloqueos,
      saques,
      recepciones,
      cambios,
    });

    setGuardando(false);

    if (!res.ok) {
      setMensaje("❌ " + res.error);
      return;
    }

    localStorage.removeItem(CLAVE_LOCAL + partidoId);
    setMensaje("✅ Datos guardados");
  }

  const handleCerrar = () => {
    cerrarSesion();
    router.push("/");
  };

  if (!sesion) return null;

  const noHayPartido = !partidoId;

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <button
              onClick={() => router.push("/admin")}
              className="text-sm text-slate-500 hover:text-slate-700 mb-1"
            >
              ← Volver al panel
            </button>
            <h1 className="text-3xl font-bold text-slate-900">
              🎯 Consola de Data Entry
            </h1>
          </div>
          <button
            onClick={handleCerrar}
            className="px-4 py-2 text-sm bg-slate-200 hover:bg-slate-300 rounded-lg transition"
          >
            Cerrar sesión
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Equipo
              </label>
              <select
                value={equipoId}
                onChange={(e) => setEquipoId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value="">Elegí un equipo</option>
                {equipos.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Partido
              </label>
              <select
                value={partidoId}
                onChange={(e) => setPartidoId(e.target.value)}
                disabled={!equipoId}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg disabled:bg-slate-100"
              >
                <option value="">
                  {equipoId ? "Elegí un partido" : "Primero elegí un equipo"}
                </option>
                {partidos.map((p) => (
                  <option key={p.id} value={p.id}>
                    vs {p.rival} · {p.fecha}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {noHayPartido && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
            <p className="text-5xl mb-4">🎯</p>
            <p className="text-slate-600 font-medium">
              Elegí un equipo y un partido arriba
            </p>
          </div>
        )}

        {!noHayPartido && (
          <>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold text-slate-500 uppercase mr-2">
                    Set:
                  </span>
                  {([1, 2, 3, 4, 5] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setSetActivo(s);
                        setPuntoActual(1);
                      }}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                        setActivo === s
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold text-slate-500 uppercase mr-2">
                    Punto:
                  </span>
                  <button
                    onClick={() => setPuntoActual((p) => Math.max(1, p - 1))}
                    disabled={puntoActual === 1}
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm disabled:opacity-40"
                  >
                    ◀
                  </button>
                  <input
                    type="number"
                    value={puntoActual}
                    onChange={(e) =>
                      setPuntoActual(Math.max(1, parseInt(e.target.value) || 1))
                    }
                    className="w-16 px-2 py-1.5 text-center border border-slate-300 rounded-lg text-sm"
                  />
                  <button
                    onClick={() => setPuntoActual((p) => p + 1)}
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm"
                  >
                    ▶
                  </button>
                </div>
              </div>
            </div>

            <div className="mb-4 flex items-start gap-2">
              <PanelRotacion
                rotacion={rotActual}
                jugadores={jugadoresDelEquipo}
                onChange={setRotActual}
                numeroRotacion={1}
                onCambioRotacion={() => {}}
              />
              <button
                onClick={rePropagarRotacion}
                className="px-3 py-2 text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 rounded-lg transition"
                title="Re-propagar esta rotación a los puntos siguientes del set"
              >
                🔄 Re-propagar a siguientes
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mb-4 border-b border-slate-200">
              {PESTANAS.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => setPestana(p.id)}
                  className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px flex items-center gap-2 ${
                    pestana === p.id
                      ? "border-emerald-500 text-emerald-600"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <span className="w-5 h-5 rounded bg-slate-200 text-slate-600 text-[10px] font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span>
                    {p.icono} {p.nombre}
                  </span>
                </button>
              ))}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
              {pestana === "armado" && (
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase">
                      Armados del punto:
                    </span>
                    {armadosDelPunto.length === 0 && (
                      <span className="text-[10px] text-slate-400 italic">
                        (ninguno todavía)
                      </span>
                    )}
                    {armadosDelPunto.map((a, i) => (
                      <button
                        key={i}
                        onClick={() => setArmadoIdx(i)}
                        className={`px-2 py-0.5 text-[10px] rounded border ${
                          armadoIdx === i
                            ? "bg-emerald-500 text-white border-emerald-500"
                            : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        #{i + 1} {nombreDe(a.jugador_id) ?? "(sin dueño)"}
                      </button>
                    ))}
                    <button
                      onClick={agregarArmado}
                      className="px-2 py-0.5 text-[10px] rounded border border-dashed border-slate-400 text-slate-600 hover:bg-slate-50"
                    >
                      + Nuevo armado
                    </button>
                    {armadosDelPunto.length > 0 && (
                      <button
                        onClick={borrarArmadoActual}
                        className="px-2 py-0.5 text-[10px] rounded bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                      >
                        🗑 Borrar armado #{armadoIdx + 1}
                      </button>
                    )}
                  </div>

                  {armadosDelPunto.length > 0 && (
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase">
                        Armó:
                      </span>
                      <select
                        value={armadoActual.jugador_id}
                        onChange={(e) => setJugadorArmadoActual(e.target.value)}
                        className="px-2 py-1 text-xs border border-slate-300 rounded-lg"
                      >
                        <option value="">(sin asignar)</option>
                        {jugadoresDelEquipo.map((j) => (
                          <option key={j.id} value={j.id}>
                            {j.nombre}
                            {j.numero !== null ? ` #${j.numero}` : ""}
                            {j.id === armadorDelPunto ? " · armador" : ""}
                          </option>
                        ))}
                      </select>
                      <span className="text-[10px] text-slate-400">
                        (cambialo para armado de emergencia)
                      </span>
                    </div>
                  )}

                  <TableroArmadorPunto
                    punto={{
                      numero: puntoActual,
                      lineas: armadoActual.lineas,
                      toques: armadoActual.toques ?? [],
                      armadorNumero: 1,
                    }}
                    onChange={(p) => setContenidoArmadoActual(p.lineas, p.toques)}
                  />
                </div>
              )}

              {pestana === "ataque" && (
                <CanchaAtaque
                  ataquesDelPunto={filtrar(ataques)}
                  armadosPendientes={Math.max(
                    0,
                    armadosDelPunto.length - filtrar(ataques).length
                  )}
                  onAgregar={agregarAtaque}
                  onBorrarUltimo={() => {
                    const idx = ataques.findLastIndex(
                      (x) =>
                        x.set_numero === setActivo &&
                        x.punto_numero === puntoActual
                    );
                    if (idx >= 0)
                      setAtaques((prev) => prev.filter((_, i) => i !== idx));
                  }}
                  atacanteSugerido={atacanteSugerido}
                />
              )}

              {pestana === "defensa" && (
                <CanchaDefensa
                  defensasDelPunto={filtrar(defensas)}
                  onAgregar={agregarDefensa}
                  onBorrarUltimo={() => {
                    const idx = defensas.findLastIndex(
                      (x) =>
                        x.set_numero === setActivo &&
                        x.punto_numero === puntoActual
                    );
                    if (idx >= 0)
                      setDefensas((prev) => prev.filter((_, i) => i !== idx));
                  }}
                  onLimpiarPunto={() =>
                    setDefensas((prev) =>
                      prev.filter(
                        (x) =>
                          !(
                            x.set_numero === setActivo &&
                            x.punto_numero === puntoActual
                          )
                      )
                    )
                  }
                />
              )}

              {pestana === "bloqueo" && (
                <CanchaBloqueo
                  bloqueosDelPunto={filtrar(bloqueos)}
                  jugadoresRed={[
                    {
                      zona: 4 as const,
                      jugador_id: rotActual.posiciones[4]?.jugador_id ?? "",
                      nombre:
                        nombreDe(rotActual.posiciones[4]?.jugador_id ?? null) ??
                        "Z4",
                    },
                    {
                      zona: 3 as const,
                      jugador_id: rotActual.posiciones[3]?.jugador_id ?? "",
                      nombre:
                        nombreDe(rotActual.posiciones[3]?.jugador_id ?? null) ??
                        "Z3",
                    },
                    {
                      zona: 2 as const,
                      jugador_id: rotActual.posiciones[2]?.jugador_id ?? "",
                      nombre:
                        nombreDe(rotActual.posiciones[2]?.jugador_id ?? null) ??
                        "Z2",
                    },
                  ].filter((j) => j.jugador_id)}
                  onAgregar={agregarBloqueo}
                  onBorrarUltimo={() => {
                    const idx = bloqueos.findLastIndex(
                      (x) =>
                        x.set_numero === setActivo &&
                        x.punto_numero === puntoActual
                    );
                    if (idx >= 0)
                      setBloqueos((prev) => prev.filter((_, i) => i !== idx));
                  }}
                />
              )}

              {pestana === "saque" && (
                <>
                  {sacadorActual && (
                    <div className="mb-2 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1 text-center">
                      Sacador (zona 1): <strong>{nombreDe(sacadorActual)}</strong>
                    </div>
                  )}
                  <CanchaSaque
                    saquesDelPunto={filtrar(saques)}
                    tipo={saquesTipo[keyPuntoActual] ?? "flotado"}
                    onCambiarTipo={(t) =>
                      setSaquesTipo((prev) => ({
                        ...prev,
                        [keyPuntoActual]: t,
                      }))
                    }
                    onAgregar={agregarSaque}
                    onBorrarUltimo={() => {
                      const idx = saques.findLastIndex(
                        (x) =>
                          x.set_numero === setActivo &&
                          x.punto_numero === puntoActual
                      );
                      if (idx >= 0)
                        setSaques((prev) => prev.filter((_, i) => i !== idx));
                    }}
                  />
                </>
              )}

              {pestana === "recepcion" && (
                <CanchaRecepcion
                  recepcionesDelPunto={filtrar(recepciones)}
                  onAgregar={agregarRecepcion}
                  onBorrarUltimo={() => {
                    const idx = recepciones.findLastIndex(
                      (x) =>
                        x.set_numero === setActivo &&
                        x.punto_numero === puntoActual
                    );
                    if (idx >= 0)
                      setRecepciones((prev) => prev.filter((_, i) => i !== idx));
                  }}
                  nombreDe={nombreDe}
                />
              )}
            </div>

            <div className="sticky bottom-4 bg-white rounded-2xl shadow-lg border border-slate-200 p-4 flex items-center justify-between">
              <p className="text-sm text-slate-600">
                {mensaje ||
                  "Ctrl+G para guardar. Teclas 1-6 cambian de pestaña. Autoguardado local."}
              </p>
              <button
                onClick={guardarTodo}
                disabled={guardando}
                className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white font-medium rounded-lg transition"
              >
                {guardando ? "Guardando..." : "💾 Guardar Datos (Ctrl+G)"}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}