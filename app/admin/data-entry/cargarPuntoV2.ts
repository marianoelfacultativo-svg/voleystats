// ============================================================
// CARGAR PUNTO V2 — DataEntryV2
// Lógica para inicializar el estado de un punto (vacío o cerrado).
// ============================================================
//
// v2 (FASE 7.1 — DataEntry con sets y partido):
//   + `puntosCerrados` ahora es `PuntosPorSet` (clave "set-punto").
//   + `cargarPuntoDesde` recibe `setActivo` y `puntoNumero` en
//     lugar de un único `n`.
//   + Recibe `setsCerrados` para saber si el set activo está
//     cerrado:
//       · Si el set está cerrado, se carga el último punto del
//         set (por seguridad, nunca debería pedirse un punto
//         inexistente de un set cerrado).
//       · Si el set no está cerrado, se busca el punto anterior
//         más cercano (por set, luego por número) y se calcula
//         la continuación (rotación, saque, liberos, cambios).
//   + Los setters de estado rival se resetean siempre.
// ============================================================

import {
  girarRotacionPunto,
  type Libero,
  type RotacionPunto,
  type Zona,
} from "@/lib/rotaciones";
import type { LineaClasificada } from "@/lib/clasificacionV2";

import { maxIdLineas } from "./helpersV2";
import {
  POSICIONES_VACIAS,
  clavePunto,
  type PopupEnCola,
  type PuntoCerrado,
  type PuntosPorSet,
  type SetsCerrados,
} from "./tiposV2";
import type { PuntoV2 } from "./LineasV2";
import type { CambioPendiente } from "./PanelRotacionV2";

// ------------------------------------------------------------
// SETTERS
// ------------------------------------------------------------

interface SetStates {
  setLineas: (l: LineaClasificada[]) => void;
  setCirculoSinArmar: (p: PuntoV2 | null) => void;
  setCirculoArmado: (p: PuntoV2 | null) => void;
  setDesviosPendientes: (p: PuntoV2[]) => void;
  setEstrella: (p: PuntoV2 | null) => void;
  setColaPopups: (p: PopupEnCola[]) => void;
  setContadorId: (id: number) => void;
  setSaqueInicial: (s: "propio" | "rival") => void;
  setRotacion: (r: RotacionPunto | null) => void;
  setLiberos: (l: Libero[]) => void;
  setPosicionesPunto: (p: Record<Zona, string>) => void;
  setCambiosPendientes: (c: CambioPendiente[]) => void;
  setRotacionRival: (r: RotacionPunto | null) => void;
  setLiberosRival: (l: Libero[]) => void;
  setPosicionesPuntoRival: (p: Record<Zona, string>) => void;
  setCambiosPendientesRival: (c: CambioPendiente[]) => void;
}

// ------------------------------------------------------------
// HELPERS INTERNOS
// ------------------------------------------------------------

/** Devuelve todos los puntos cerrados de un set, ordenados por numero. */
function puntosDelSet(
  puntosCerrados: PuntosPorSet,
  setNumero: number
): PuntoCerrado[] {
  return Object.values(puntosCerrados)
    .filter((p) => p.set_numero === setNumero)
    .sort((a, b) => a.numero - b.numero);
}

/**
 * Devuelve el `PuntoCerrado` anterior más cercano a (setActivo,
 * puntoNumero). Prioriza el mismo set; si no hay, busca en sets
 * anteriores empezando por el más cercano.
 */
function puntoAnteriorMasCercano(
  puntosCerrados: PuntosPorSet,
  setActivo: number,
  puntoNumero: number
): PuntoCerrado | null {
  // 1. Mismo set, número menor.
  const mismoSet = puntosDelSet(puntosCerrados, setActivo).filter(
    (p) => p.numero < puntoNumero
  );
  if (mismoSet.length > 0) {
    return mismoSet[mismoSet.length - 1];
  }

  // 2. Sets anteriores (del más cercano al más lejano).
  for (let s = setActivo - 1; s >= 1; s--) {
    const delSet = puntosDelSet(puntosCerrados, s);
    if (delSet.length > 0) {
      return delSet[delSet.length - 1];
    }
  }

  return null;
}

/**
 * Calcula la rotación y el saque del "siguiente punto" a partir
 * del punto anterior, aplicando la regla de continuación:
 *   - Si el punto anterior lo ganó el equipo propio y el saque
 *     era rival, se gira la rotación (recuperamos el saque).
 *   - En cualquier otro caso, la rotación se mantiene.
 *
 * Esta lógica es la misma que ya existía y se mantiene para no
 * cambiar el comportamiento actual.
 */
function calcularContinuacion(prev: PuntoCerrado): {
  rotacion: RotacionPunto;
  saqueInicial: "propio" | "rival";
} {
  let rotSig: RotacionPunto = prev.rotacion;
  const saqueSig: "propio" | "rival" = prev.ganador;

  if (prev.ganador === "propio" && prev.saqueInicial === "rival") {
    const { rotacion: rotG } = girarRotacionPunto(prev.rotacion, 1);
    rotSig = rotG;
  }

  return {
    rotacion: { ...rotSig, saque_equipo: saqueSig },
    saqueInicial: saqueSig,
  };
}

// ------------------------------------------------------------
// CARGA PRINCIPAL
// ------------------------------------------------------------

export function cargarPuntoDesde(
  puntosCerrados: PuntosPorSet,
  setsCerrados: SetsCerrados,
  setActivo: number,
  puntoNumero: number,
  modoEspejo: boolean,
  rotacionInicial: RotacionPunto | null | undefined,
  setters: SetStates
) {
  // 1. Reset total del estado del punto.
  setters.setLineas([]);
  setters.setCirculoSinArmar(null);
  setters.setCirculoArmado(null);
  setters.setDesviosPendientes([]);
  setters.setEstrella(null);
  setters.setColaPopups([]);
  setters.setContadorId(1);

  // 2. ¿El punto existe ya cargado?
  const clave = clavePunto(setActivo, puntoNumero);
  const pc = puntosCerrados[clave];

  if (pc) {
    setters.setLineas(pc.lineas);
    setters.setSaqueInicial(pc.saqueInicial);
    setters.setRotacion(pc.rotacion);
    setters.setLiberos(pc.liberos);
    setters.setPosicionesPunto(pc.posicionesPunto);
    setters.setCambiosPendientes(pc.cambios);
    setters.setContadorId(maxIdLineas(pc.lineas) + 1);

    if (pc.estadoRival) {
      setters.setRotacionRival(pc.estadoRival.rotacion);
      setters.setLiberosRival(pc.estadoRival.liberos);
      setters.setPosicionesPuntoRival(pc.estadoRival.posicionesPunto);
      setters.setCambiosPendientesRival(pc.estadoRival.cambios);
    } else {
      setters.setRotacionRival(null);
      setters.setLiberosRival([]);
      setters.setPosicionesPuntoRival({ ...POSICIONES_VACIAS });
      setters.setCambiosPendientesRival([]);
    }
    return;
  }

  // 3. El punto no existe.

  // 3a. Si el set activo está cerrado, cargar el último punto
  //     del set (por seguridad). Nunca debería pedirse un punto
  //     inexistente de un set cerrado, pero por las dudas.
  if (setsCerrados[setActivo]) {
    const delSet = puntosDelSet(puntosCerrados, setActivo);
    const ultimo = delSet[delSet.length - 1];
    if (ultimo) {
      setters.setLineas(ultimo.lineas);
      setters.setSaqueInicial(ultimo.saqueInicial);
      setters.setRotacion(ultimo.rotacion);
      setters.setLiberos(ultimo.liberos);
      setters.setPosicionesPunto(ultimo.posicionesPunto);
      setters.setCambiosPendientes(ultimo.cambios);
      setters.setContadorId(maxIdLineas(ultimo.lineas) + 1);

      if (ultimo.estadoRival) {
        setters.setRotacionRival(ultimo.estadoRival.rotacion);
        setters.setLiberosRival(ultimo.estadoRival.liberos);
        setters.setPosicionesPuntoRival(ultimo.estadoRival.posicionesPunto);
        setters.setCambiosPendientesRival(ultimo.estadoRival.cambios);
      } else {
        setters.setRotacionRival(null);
        setters.setLiberosRival([]);
        setters.setPosicionesPuntoRival({ ...POSICIONES_VACIAS });
        setters.setCambiosPendientesRival([]);
      }
      return;
    }
    // Si el set está cerrado pero no hay puntos (caso raro),
    // caemos al flujo normal.
  }

  // 3b. Buscar el punto anterior más cercano.
  const prev = puntoAnteriorMasCercano(
    puntosCerrados,
    setActivo,
    puntoNumero
  );

  if (prev) {
    const { rotacion: rotSig, saqueInicial: saqueSig } =
      calcularContinuacion(prev);

    setters.setSaqueInicial(saqueSig);
    setters.setRotacion(rotSig);
    setters.setLiberos(prev.liberos);
    setters.setPosicionesPunto({ ...POSICIONES_VACIAS });
    setters.setCambiosPendientes([]);

    if (modoEspejo && prev.estadoRival?.rotacion) {
      let rotRivalSig: RotacionPunto = prev.estadoRival.rotacion;

      // Misma regla de continuación para el rival:
      // si el punto lo ganó el equipo rival y el saque era propio,
      // el rival recupera el saque y gira.
      if (prev.ganador === "rival" && prev.saqueInicial === "propio") {
        const { rotacion: rotRG } = girarRotacionPunto(
          prev.estadoRival.rotacion,
          1
        );
        rotRivalSig = rotRG;
      }

      setters.setRotacionRival({
        ...rotRivalSig,
        saque_equipo: saqueSig === "propio" ? "rival" : "propio",
      });
      setters.setLiberosRival(prev.estadoRival.liberos);
      setters.setPosicionesPuntoRival({ ...POSICIONES_VACIAS });
      setters.setCambiosPendientesRival([]);
    } else {
      setters.setRotacionRival(null);
      setters.setLiberosRival([]);
      setters.setPosicionesPuntoRival({ ...POSICIONES_VACIAS });
      setters.setCambiosPendientesRival([]);
    }

    return;
  }

  // 4. No hay punto anterior: primer punto del partido.
  setters.setSaqueInicial("propio");
  if (rotacionInicial) setters.setRotacion(rotacionInicial);
  else setters.setRotacion(null);
  setters.setLiberos([]);
  setters.setPosicionesPunto({ ...POSICIONES_VACIAS });
  setters.setCambiosPendientes([]);
  setters.setRotacionRival(null);
  setters.setLiberosRival([]);
  setters.setPosicionesPuntoRival({ ...POSICIONES_VACIAS });
  setters.setCambiosPendientesRival([]);
}