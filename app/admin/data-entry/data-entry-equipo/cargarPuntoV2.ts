// ============================================================
// CARGAR PUNTO V2 — DataEntryV2
// Lógica para inicializar el estado de un punto (vacío o cerrado).
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
  type PopupEnCola,
  type PuntoCerrado,
} from "./tiposV2";
import type { PuntoV2 } from "./LineasV2";
import type { CambioPendiente } from "./PanelRotacionV2";

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

export function cargarPuntoDesde(
  cerrados: Record<number, PuntoCerrado>,
  n: number,
  modoEspejo: boolean,
  rotacionInicial: RotacionPunto | null | undefined,
  setters: SetStates
) {
  setters.setLineas([]);
  setters.setCirculoSinArmar(null);
  setters.setCirculoArmado(null);
  setters.setDesviosPendientes([]);
  setters.setEstrella(null);
  setters.setColaPopups([]);
  setters.setContadorId(1);

  const pc = cerrados[n];
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
    setters.setSaqueInicial(saqueSig);
    setters.setRotacion({ ...rotSig, saque_equipo: saqueSig });
    setters.setLiberos(prev.liberos);
    setters.setPosicionesPunto({ ...POSICIONES_VACIAS });
    setters.setCambiosPendientes([]);

    if (modoEspejo && prev.estadoRival?.rotacion) {
      let rotRivalSig: RotacionPunto = prev.estadoRival.rotacion;
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
    }
  } else {
    setters.setSaqueInicial("propio");
    if (rotacionInicial) setters.setRotacion(rotacionInicial);
    setters.setLiberos([]);
    setters.setPosicionesPunto({ ...POSICIONES_VACIAS });
    setters.setCambiosPendientes([]);
  }
}