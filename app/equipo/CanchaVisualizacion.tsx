"use client";

import { useMemo } from "react";

export type TipoFundamento = "saque" | "recepcion" | "ataque";

export type Vista = "top" | "front" | "front-rival" | "iso-izq" | "iso-der";

export interface PuntoVisual {
  celda: string;
  mini: string | null;
}

export interface ItemVisual {
  id: string;
  origen: PuntoVisual;
  desvios?: PuntoVisual[];
  destino: PuntoVisual;
  color: string;
  calidad?: number | string;
  randomizar?: boolean;
  esError?: boolean;
}

interface Props {
  tipo?: TipoFundamento;
  items: ItemVisual[];
  vista?: Vista;
  width?: number;
  height?: number;
  mostrarEstelas?: boolean;
}

const COL_X: Record<string, [number, number]> = {
  C1: [0, 2],
  C2: [2, 5],
  C3: [5, 8],
  C4: [8, 11],
  C5: [11, 13],
};

const FILA_Z: Record<string, [number, number]> = {
  F1: [0, 3],
  F2: [3, 6],
  F3: [6, 9],
  F4: [-3, 0],
  F5: [-6, -3],
  F6: [-9, -6],
};

function servicioPos(s: string): { x: number; z: number } | null {
  const m = s.match(/^S(\d)$/);
  if (!m) return null;
  const idx = parseInt(m[1]);
  if (idx < 1 || idx > 9) return null;
  const x = 2 + (idx - 1) * (9 / 8);
  return { x, z: 9.5 };
}

function destinoSaquePos(d: string): { x: number; z: number } | null {
  const m = d.match(/^D(\d)$/);
  if (!m) return null;
  const idx = parseInt(m[1]);
  if (idx < 1 || idx > 9) return null;
  const x = 2 + (idx - 1) * (9 / 8);
  return { x, z: -1.5 };
}

function obtenerCoords(
  celda: string,
  mini: string | null
): { x: number; z: number } | null {
  if (celda.startsWith("S")) return servicioPos(celda);
  if (celda.startsWith("D")) return destinoSaquePos(celda);

  const partes = celda.split("-");
  if (partes.length !== 2) return null;
  const [fila, col] = partes;
  const rangoX = COL_X[col];
  const rangoZ = FILA_Z[fila];
  if (!rangoX || !rangoZ) return null;

  if (!mini) {
    return {
      x: (rangoX[0] + rangoX[1]) / 2,
      z: (rangoZ[0] + rangoZ[1]) / 2,
    };
  }

  const match = mini.match(/^f(\d)c(\d)$/);
  if (!match) return null;
  const mf = parseInt(match[1]) - 1;
  const mc = parseInt(match[2]) - 1;

  const numCols = col === "C1" || col === "C5" ? 2 : 3;
  const numFils = 3;
  const anchoCelda = (rangoX[1] - rangoX[0]) / numCols;
  const altoCelda = (rangoZ[1] - rangoZ[0]) / numFils;

  const esRival = parseInt(fila.slice(1)) >= 4;
  const mfFinal = esRival ? numFils - 1 - mf : mf;

  return {
    x: rangoX[0] + (mc + 0.5) * anchoCelda,
    z: rangoZ[0] + (mfFinal + 0.5) * altoCelda,
  };
}

function extensionPorBorde(
  celda: string,
  _mini: string | null
): { dx: number; dz: number } | null {
  const partes = celda.split("-");
  if (partes.length !== 2) return null;
  const [fila, col] = partes;

  let dx = 0;
  let dz = 0;

  if (fila === "F6") dz = -3.0;
  else if (fila === "F3") dz = 3.0;

  if (col === "C1") dx = -3.0;
  else if (col === "C5") dx = 3.0;

  if (dx === 0 && dz === 0) return null;
  return { dx, dz };
}

function hashSeed(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) + h + str.charCodeAt(i);
    h = h & h;
  }
  return Math.abs(h);
}

function prand(seed: string, key: string): number {
  const h = hashSeed(seed + key);
  return (h % 100000) / 100000;
}

function randomizar(
  coords: { x: number; z: number },
  id: string,
  key: string
): { x: number; z: number } {
  const rx = prand(id, key + "-x");
  const rz = prand(id, key + "-z");
  return {
    x: coords.x + (rx - 0.5) * 0.6,
    z: coords.z + (rz - 0.5) * 0.6,
  };
}

const ALTURA_RED = 2.43;
const GRAVEDAD = 9.8;
const RADIO_PELOTA = 10;
const ALTURA_MAX_ARCO = 3.4;

const ISO_ANGLE_DEG = 22;
const ISO_COS = Math.cos((ISO_ANGLE_DEG * Math.PI) / 180);
const ISO_SIN = Math.sin((ISO_ANGLE_DEG * Math.PI) / 180);
const FRONT_Z_FACTOR = 0.12;

const RED_X1 = 2;
const RED_X2 = 11;
const RED_Y_TOP = 2.43;
const RED_Y_BOTTOM = 1.43;

function mezclarConBlanco(hex: string, cantidad: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const nr = Math.round(r + (255 - r) * cantidad);
  const ng = Math.round(g + (255 - g) * cantidad);
  const nb = Math.round(b + (255 - b) * cantidad);
  return `rgb(${nr}, ${ng}, ${nb})`;
}

const ESCALA = 45;

const OFFSET: Record<Vista, { x: number; y: number }> = {
  top: { x: 150, y: 300 },
  front: { x: 150, y: 520 },
  "front-rival": { x: 150, y: 520 },
  "iso-izq": { x: 400, y: 400 },
  "iso-der": { x: 590, y: 400 },
};

function proyectar(
  x: number,
  z: number,
  y: number,
  vista: Vista,
  escala: number
): { sx: number; sy: number } {
  switch (vista) {
    case "top":
      return {
        sx: x * escala + OFFSET.top.x,
        sy: z * escala + OFFSET.top.y,
      };
    case "front":
      return {
        sx: x * escala + OFFSET.front.x,
        sy: -y * escala + z * escala * FRONT_Z_FACTOR + OFFSET.front.y,
      };
    case "front-rival":
      return {
        sx: (13 - x) * escala + OFFSET["front-rival"].x,
        sy:
          -y * escala -
          z * escala * FRONT_Z_FACTOR +
          OFFSET["front-rival"].y,
      };
    case "iso-izq":
      return {
        sx: (x - z) * ISO_COS * escala + OFFSET["iso-izq"].x,
        sy: (x + z) * ISO_SIN * escala - y * escala + OFFSET["iso-izq"].y,
      };
    case "iso-der": {
      const xr = 13 - x;
      const zr = 9 - z;
      return {
        sx: (xr - zr) * ISO_COS * escala + OFFSET["iso-der"].x,
        sy: (xr + zr) * ISO_SIN * escala - y * escala + OFFSET["iso-der"].y,
      };
    }
  }
}

interface ParametrosTrayectoria {
  hOrigen: number;
  hDestino: number;
  esRecto: boolean;
}

function getParametros(
  tipo: TipoFundamento | undefined,
  item: ItemVisual
): ParametrosTrayectoria {
  if (tipo === "saque") {
    const esPotencia = item.calidad === "potencia";
    return {
      hOrigen: 2.8,
      hDestino: 0,
      esRecto: esPotencia,
    };
  }
  if (tipo === "ataque") {
    return { hOrigen: 2.8, hDestino: 0, esRecto: false };
  }
  return { hOrigen: 0.3, hDestino: 2.2, esRecto: false };
}

function limitarAltura(
  pts: [number, number, number][]
): [number, number, number][] {
  return pts.map((p) => {
    if (p[1] > ALTURA_MAX_ARCO) {
      return [p[0], ALTURA_MAX_ARCO, p[2]];
    }
    return p;
  });
}

function generarSegmento(
  a: { x: number; z: number },
  b: { x: number; z: number },
  params: ParametrosTrayectoria,
  vista: Vista,
  escala: number,
  necesitaPasarRed: boolean,
  limitar: boolean
): { path: string; puntos3D: [number, number, number][] } {
  const { hOrigen, hDestino, esRecto } = params;

  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const distH = Math.sqrt(dx * dx + dz * dz);

  if (distH < 0.001) {
    return {
      path: "",
      puntos3D: [
        [a.x, hOrigen, a.z],
        [b.x, hDestino, b.z],
      ],
    };
  }

  if (esRecto) {
    const pasos = 30;
    let path = "";
    const puntos3D: [number, number, number][] = [];
    for (let i = 0; i <= pasos; i++) {
      const t = i / pasos;
      const x = a.x + t * dx;
      const z = a.z + t * dz;
      const y = Math.max(0, hOrigen + t * (hDestino - hOrigen));
      puntos3D.push([x, y, z]);
      const p = proyectar(x, z, y, vista, escala);
      path += i === 0 ? `M ${p.sx} ${p.sy}` : ` L ${p.sx} ${p.sy}`;
    }
    return { path, puntos3D };
  }

  const cruzandoRed = (a.z >= 0 && b.z < 0) || (a.z < 0 && b.z >= 0);

  let T: number;
  if (necesitaPasarRed && cruzandoRed) {
    const tRedRatio = -a.z / (b.z - a.z);
    if (tRedRatio > 0.05 && tRedRatio < 0.95) {
      const hRedMin = ALTURA_RED + 0.05;
      const num = (hDestino - hOrigen) - (hRedMin - hOrigen) / tRedRatio;
      const den = 0.5 * GRAVEDAD * (tRedRatio - 1);
      if (Math.abs(den) > 0.001) {
        const T2 = num / den;
        T = T2 > 0 ? Math.sqrt(T2) : distH / 8;
      } else {
        T = distH / 8;
      }
    } else {
      T = distH / 8;
    }
  } else {
    T = distH / 8;
  }

  const vy = (hDestino - hOrigen + 0.5 * GRAVEDAD * T * T) / T;
  const vx = dx / T;
  const vz = dz / T;

  const pasos = 30;
  let path = "";
  const puntos3D: [number, number, number][] = [];
  for (let i = 0; i <= pasos; i++) {
    const t = (i / pasos) * T;
    const x = a.x + vx * t;
    const z = a.z + vz * t;
    const y = Math.max(0, hOrigen + vy * t - 0.5 * GRAVEDAD * t * t);
    puntos3D.push([x, y, z]);
    const p = proyectar(x, z, y, vista, escala);
    path += i === 0 ? `M ${p.sx} ${p.sy}` : ` L ${p.sx} ${p.sy}`;
  }

  if (limitar) {
    const limitados = limitarAltura(puntos3D);
    let pathL = "";
    limitados.forEach((p3, i) => {
      const p = proyectar(p3[0], p3[2], p3[1], vista, escala);
      pathL += i === 0 ? `M ${p.sx} ${p.sy}` : ` L ${p.sx} ${p.sy}`;
    });
    return { path: pathL, puntos3D: limitados };
  }

  return { path, puntos3D };
}

function generarCurvaAtaque(
  a: [number, number, number],
  b: [number, number, number],
  vista: Vista,
  escala: number
): { path: string; puntos3D: [number, number, number][] } {
  const pasos = 40;
  const pts: [number, number, number][] = [];
  const hOrigen = a[1];
  const hDestino = b[1];
  const zOrigen = a[2];
  const zDestino = b[2];
  const cruzaRed =
    (zOrigen > 0 && zDestino < 0) || (zOrigen < 0 && zDestino > 0);

  let tRef: number;
  let hRef: number;

  if (cruzaRed) {
    tRef = Math.abs(zOrigen) / Math.abs(zDestino - zOrigen);
    hRef = ALTURA_RED + 0.05;
  } else {
    tRef = 0.5;
    hRef = hOrigen + 0.5 * (hDestino - hOrigen) + 0.05;
  }

  if (tRef < 0.05) tRef = 0.05;
  if (tRef > 0.95) tRef = 0.95;

  const D = hDestino - hOrigen;
  const E = hRef - hOrigen;
  const denom = tRef * (1 - tRef);
  const c = denom > 0.0001 ? (D * tRef - E) / denom : 0;
  const bCoef = D - c;

  let path = "";
  for (let i = 0; i <= pasos; i++) {
    const t = i / pasos;
    const x = a[0] + t * (b[0] - a[0]);
    const z = a[2] + t * (b[2] - a[2]);
    const y = Math.max(0, hOrigen + bCoef * t + c * t * t);
    pts.push([x, y, z]);
    const p = proyectar(x, z, y, vista, escala);
    path += i === 0 ? `M ${p.sx} ${p.sy}` : ` L ${p.sx} ${p.sy}`;
  }
  return { path, puntos3D: pts };
}

function generarPuntosAtaque(
  origen: { x: number; z: number },
  destino: { x: number; z: number },
  desvios: { x: number; z: number }[],
  vista: Vista,
  escala: number
): { paths: string[]; puntos3D: [number, number, number][] } {
  const origenPropio = origen.z >= 0;
  const destinoPropio = destino.z >= 0;

  const paths: string[] = [];
  const puntos3D: [number, number, number][] = [];

  const agregarSegmento = (
    seg: { path: string; puntos3D: [number, number, number][] }
  ) => {
    paths.push(seg.path);
    if (puntos3D.length === 0) {
      puntos3D.push(...seg.puntos3D);
    } else {
      puntos3D.push(...seg.puntos3D.slice(1));
    }
  };

  const proyectarSegmento = (pts: [number, number, number][]): string => {
    let p = "";
    pts.forEach((p3, i) => {
      const pr = proyectar(p3[0], p3[2], p3[1], vista, escala);
      p += i === 0 ? `M ${pr.sx} ${pr.sy}` : ` L ${pr.sx} ${pr.sy}`;
    });
    return p;
  };

  // CASO A: ataque a la red (origen y destino propio, sin desvíos)
  if (origenPropio && destinoPropio && desvios.length === 0) {
    const puntoRed: [number, number, number] = [
      origen.x,
      ALTURA_RED - 0.3,
      0,
    ];
    const puntoCaida: [number, number, number] = [
      destino.x,
      0,
      Math.max(2.0, destino.z),
    ];

    const seg1: [number, number, number][] = [];
    const pasos1 = 30;
    for (let i = 0; i <= pasos1; i++) {
      const t = i / pasos1;
      const x = origen.x + t * (puntoRed[0] - origen.x);
      const z = origen.z + t * (puntoRed[2] - origen.z);
      const hBase = 2.8 + t * (puntoRed[1] - 2.8);
      const y = Math.max(0, hBase + 4 * t * (1 - t) * 0.15);
      seg1.push([x, y, z]);
    }

    const seg2: [number, number, number][] = [];
    const pasos2 = 20;
    for (let i = 0; i <= pasos2; i++) {
      const t = i / pasos2;
      const x = puntoRed[0] + t * (puntoCaida[0] - puntoRed[0]);
      const z = puntoRed[2] + t * (puntoCaida[2] - puntoRed[2]);
      const hBase = puntoRed[1] + t * (puntoCaida[1] - puntoRed[1]);
      const y = Math.max(0, hBase - 4 * t * (1 - t) * 0.1);
      seg2.push([x, y, z]);
    }

    paths.push(proyectarSegmento(seg1));
    puntos3D.push(...seg1);
    paths.push(proyectarSegmento(seg2));
    puntos3D.push(...seg2.slice(1));

    return { paths, puntos3D };
  }

  // CASO B: bloqueo rival.
  // Cualquier desvío en la fila pegada a la red del lado rival (F4, z entre -3 y 0)
  // se considera toque de bloqueo. El punto de bloqueo queda pegado a la red
  // (z=-0.2) y a la MISMA altura del origen del ataque (2.8m).
  // El tramo origen → bloqueo es RECTO y no toca el piso.
  const desvioBloqueo = desvios.find((d) => d.z >= -3 && d.z <= 0);
  if (desvioBloqueo) {
    const puntoBloqueo: [number, number, number] = [
      desvioBloqueo.x,
      2.8,
      -0.2,
    ];
    const puntoCaida: [number, number, number] = [
      destino.x,
      0,
      destino.z,
    ];

    const seg1: [number, number, number][] = [];
    const pasos1 = 30;
    for (let i = 0; i <= pasos1; i++) {
      const t = i / pasos1;
      seg1.push([
        origen.x + t * (puntoBloqueo[0] - origen.x),
        2.8 + t * (puntoBloqueo[1] - 2.8),
        origen.z + t * (puntoBloqueo[2] - origen.z),
      ]);
    }

    paths.push(proyectarSegmento(seg1));
    puntos3D.push(...seg1);

    const seg2 = generarCurvaAtaque(
      puntoBloqueo,
      puntoCaida,
      vista,
      escala
    );
    paths.push(seg2.path);
    puntos3D.push(...seg2.puntos3D.slice(1));

    return { paths, puntos3D };
  }

  // CASO C: ataque normal
  const waypoints: { x: number; z: number; y: number }[] = [
    { x: origen.x, z: origen.z, y: 2.8 },
    ...desvios.map((d) => ({
      x: d.x,
      z: d.z,
      y: d.z >= -3 && d.z <= 0 ? 2.8 : 0,
    })),
    { x: destino.x, z: destino.z, y: 0 },
  ];

  for (let i = 0; i < waypoints.length - 1; i++) {
    const seg = generarCurvaAtaque(
      [waypoints[i].x, waypoints[i].y, waypoints[i].z],
      [waypoints[i + 1].x, waypoints[i + 1].y, waypoints[i + 1].z],
      vista,
      escala
    );
    agregarSegmento(seg);
  }
  return { paths, puntos3D };
}

export default function CanchaVisualizacion({
  tipo,
  items,
  vista = "top",
  width = 1000,
  height = 760,
  mostrarEstelas = true,
}: Props) {
  const escala = ESCALA;
  const mostrarRival = tipo === "saque" || tipo === "ataque" || !tipo;

  const trayectorias = useMemo(() => {
    return items
      .map((it) => {
        const origenBase = obtenerCoords(it.origen.celda, it.origen.mini);
        const destinoBase = obtenerCoords(it.destino.celda, it.destino.mini);
        if (!origenBase || !destinoBase) return null;

        const desviosBase =
          it.desvios
            ?.map((d) => obtenerCoords(d.celda, d.mini))
            .filter((p): p is { x: number; z: number } => p !== null) ?? [];

        const debeRandomizar = it.randomizar !== false;
        let origen = debeRandomizar
          ? randomizar(origenBase, it.id, "-origen")
          : origenBase;

        if (tipo === "saque") {
          origen = { x: origen.x, z: 9.5 };
          if (origen.x < 2 || origen.x > 11) {
            origen = { x: 6.5, z: 9.5 };
          }
        }

        let destino = debeRandomizar
          ? randomizar(destinoBase, it.id, "-destino")
          : destinoBase;

        const ext = it.esError
          ? extensionPorBorde(it.destino.celda, it.destino.mini)
          : null;
        if (ext) {
          destino = { x: destino.x + ext.dx, z: destino.z + ext.dz };
        }

        const desvios = debeRandomizar
          ? desviosBase.map((d, i) =>
              randomizar(d, it.id, `-desvio-${i}`)
            )
          : desviosBase;

        if (tipo === "ataque" || (!tipo && desvios.length > 0)) {
          const res = generarPuntosAtaque(
            origen,
            destino,
            desvios,
            vista,
            escala
          );
          return {
            item: it,
            paths: res.paths,
            puntos3D: res.puntos3D,
            color: it.color,
          };
        }

        const params = getParametros(tipo, it);
        const necesitaPasarRed = tipo === "saque";
        const limitarAlturaSaque = tipo === "saque";

        const quedoEnRed =
          tipo === "saque" &&
          (destino.z > -0.5 ||
            (destino.z >= -2.5 && it.esError === true));

        const paths: string[] = [];
        const puntos3D: [number, number, number][] = [];

        if (quedoEnRed) {
          const puntoRed: [number, number, number] = [
            destino.x,
            ALTURA_RED - 0.5,
            0,
          ];
          const puntoCaida: [number, number, number] = [destino.x, 0, 2.5];

          const seg1: [number, number, number][] = [];
          const pasos1 = 30;
          for (let i = 0; i <= pasos1; i++) {
            const t = i / pasos1;
            const x = origen.x + t * (puntoRed[0] - origen.x);
            const z = origen.z + t * (puntoRed[2] - origen.z);
            const hBase = 2.8 + t * (puntoRed[1] - 2.8);
            const y = Math.max(0, hBase + 4 * t * (1 - t) * 0.15);
            seg1.push([x, y, z]);
          }

          const seg2: [number, number, number][] = [];
          const pasos2 = 20;
          for (let i = 0; i <= pasos2; i++) {
            const t = i / pasos2;
            const x = puntoRed[0] + t * (puntoCaida[0] - puntoRed[0]);
            const z = puntoRed[2] + t * (puntoCaida[2] - puntoRed[2]);
            const hBase = puntoRed[1] + t * (puntoCaida[1] - puntoRed[1]);
            const y = Math.max(0, hBase - 4 * t * (1 - t) * 0.1);
            seg2.push([x, y, z]);
          }

          let path1 = "";
          seg1.forEach((p3, i) => {
            const p = proyectar(p3[0], p3[2], p3[1], vista, escala);
            path1 += i === 0 ? `M ${p.sx} ${p.sy}` : ` L ${p.sx} ${p.sy}`;
          });
          paths.push(path1);
          puntos3D.push(...seg1);

          let path2 = "";
          seg2.forEach((p3, i) => {
            const p = proyectar(p3[0], p3[2], p3[1], vista, escala);
            path2 += i === 0 ? `M ${p.sx} ${p.sy}` : ` L ${p.sx} ${p.sy}`;
          });
          paths.push(path2);
          puntos3D.push(...seg2.slice(1));
        } else {
          const waypoints = [origen, ...desvios, destino];
          for (let i = 0; i < waypoints.length - 1; i++) {
            const seg = generarSegmento(
              waypoints[i],
              waypoints[i + 1],
              params,
              vista,
              escala,
              necesitaPasarRed,
              limitarAlturaSaque
            );
            paths.push(seg.path);
            if (i > 0) {
              puntos3D.push(...seg.puntos3D.slice(1));
            } else {
              puntos3D.push(...seg.puntos3D);
            }
          }
        }

        return {
          item: it,
          paths,
          puntos3D,
          color: it.color,
        };
      })
      .filter((t): t is NonNullable<typeof t> => t !== null);
  }, [items, tipo, vista, escala]);

  const contornoPropio = useMemo(() => {
    const esquinas = [
      proyectar(2, 0, 0, vista, escala),
      proyectar(11, 0, 0, vista, escala),
      proyectar(11, 9, 0, vista, escala),
      proyectar(2, 9, 0, vista, escala),
    ];
    return esquinas.map((p) => `${p.sx},${p.sy}`).join(" ");
  }, [vista, escala]);

  const contornoRival = useMemo(() => {
    if (!mostrarRival) return "";
    const esquinas = [
      proyectar(2, 0, 0, vista, escala),
      proyectar(11, 0, 0, vista, escala),
      proyectar(11, -9, 0, vista, escala),
      proyectar(2, -9, 0, vista, escala),
    ];
    return esquinas.map((p) => `${p.sx},${p.sy}`).join(" ");
  }, [vista, escala, mostrarRival]);

  const lineaMedio = useMemo(
    () => ({
      p1: proyectar(2, 0, 0, vista, escala),
      p2: proyectar(11, 0, 0, vista, escala),
    }),
    [vista, escala]
  );

  const lineaAtaquePropia = useMemo(
    () => ({
      p1: proyectar(2, 3, 0, vista, escala),
      p2: proyectar(11, 3, 0, vista, escala),
    }),
    [vista, escala]
  );

  const lineaAtaqueRival = useMemo(() => {
    if (!mostrarRival) return null;
    return {
      p1: proyectar(2, -3, 0, vista, escala),
      p2: proyectar(11, -3, 0, vista, escala),
    };
  }, [vista, escala, mostrarRival]);

  const red = useMemo(
    () => ({
      p1: proyectar(RED_X1, 0, RED_Y_TOP, vista, escala),
      p2: proyectar(RED_X2, 0, RED_Y_TOP, vista, escala),
    }),
    [vista, escala]
  );

  const redMalla = useMemo(() => {
    const lineas: {
      p1: { sx: number; sy: number };
      p2: { sx: number; sy: number };
    }[] = [];
    const pasos = 20;
    for (let i = 0; i <= pasos; i++) {
      const x = RED_X1 + ((RED_X2 - RED_X1) * i) / pasos;
      const abajo = proyectar(x, 0, RED_Y_BOTTOM, vista, escala);
      const arriba = proyectar(x, 0, RED_Y_TOP, vista, escala);
      lineas.push({ p1: abajo, p2: arriba });
    }
    const filasRed = 4;
    for (let j = 0; j <= filasRed; j++) {
      const h = RED_Y_BOTTOM + ((RED_Y_TOP - RED_Y_BOTTOM) * j) / filasRed;
      const izq = proyectar(RED_X1, 0, h, vista, escala);
      const der = proyectar(RED_X2, 0, h, vista, escala);
      lineas.push({ p1: izq, p2: der });
    }
    return lineas;
  }, [vista, escala]);

  const redPostes = useMemo(
    () => [
      {
        p1: proyectar(RED_X1, 0, 0, vista, escala),
        p2: proyectar(RED_X1, 0, RED_Y_TOP, vista, escala),
      },
      {
        p1: proyectar(RED_X2, 0, 0, vista, escala),
        p2: proyectar(RED_X2, 0, RED_Y_TOP, vista, escala),
      },
    ],
    [vista, escala]
  );

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="rounded-xl"
      style={{
        background:
          "linear-gradient(180deg, #cfe4f7 0%, #b8d8f0 50%, #a8cbe8 100%)",
      }}
    >
      {mostrarRival && (
        <polygon
          points={contornoRival}
          fill="#3b82f6"
          stroke="#ffffff"
          strokeWidth={3}
          strokeLinejoin="round"
        />
      )}

      <polygon
        points={contornoPropio}
        fill="#3b82f6"
        stroke="#ffffff"
        strokeWidth={3}
        strokeLinejoin="round"
      />

      <line
        x1={lineaMedio.p1.sx}
        y1={lineaMedio.p1.sy}
        x2={lineaMedio.p2.sx}
        y2={lineaMedio.p2.sy}
        stroke="#ffffff"
        strokeWidth={2}
        opacity={0.9}
      />
      <line
        x1={lineaAtaquePropia.p1.sx}
        y1={lineaAtaquePropia.p1.sy}
        x2={lineaAtaquePropia.p2.sx}
        y2={lineaAtaquePropia.p2.sy}
        stroke="#ffffff"
        strokeWidth={2}
        opacity={0.85}
      />

      {lineaAtaqueRival && (
        <line
          x1={lineaAtaqueRival.p1.sx}
          y1={lineaAtaqueRival.p1.sy}
          x2={lineaAtaqueRival.p2.sx}
          y2={lineaAtaqueRival.p2.sy}
          stroke="#ffffff"
          strokeWidth={2}
          opacity={0.85}
        />
      )}

      {redMalla.map((l, i) => (
        <line
          key={`malla-${i}`}
          x1={l.p1.sx}
          y1={l.p1.sy}
          x2={l.p2.sx}
          y2={l.p2.sy}
          stroke="#ffffff"
          strokeWidth={0.7}
          opacity={0.5}
        />
      ))}

      <line
        x1={red.p1.sx}
        y1={red.p1.sy}
        x2={red.p2.sx}
        y2={red.p2.sy}
        stroke="#ffffff"
        strokeWidth={2.5}
      />

      {redPostes.map((p, i) => (
        <line
          key={`poste-${i}`}
          x1={p.p1.sx}
          y1={p.p1.sy}
          x2={p.p2.sx}
          y2={p.p2.sy}
          stroke="#ffffff"
          strokeWidth={4}
          strokeLinecap="round"
        />
      ))}

      {trayectorias.map((t, i) => {
        const inicio = t.puntos3D[0];
        const fin = t.puntos3D[t.puntos3D.length - 1];

        const inicioGround: [number, number, number] = [
          inicio[0],
          0.05,
          inicio[2],
        ];
        const finBall: [number, number, number] = [
          fin[0],
          Math.max(0.15, fin[1]),
          fin[2],
        ];

        const inicioGroundPos = proyectar(
          inicioGround[0],
          inicioGround[2],
          inicioGround[1],
          vista,
          escala
        );
        const inicioPos = proyectar(
          inicio[0],
          inicio[2],
          inicio[1],
          vista,
          escala
        );
        const finPos = proyectar(
          finBall[0],
          finBall[2],
          finBall[1],
          vista,
          escala
        );

        return (
          <g key={i}>
            {mostrarEstelas &&
              t.paths.map((path, j) => (
                <path
                  key={`path-${j}`}
                  d={path}
                  fill="none"
                  stroke={t.color}
                  strokeWidth={2}
                  strokeOpacity={0.85}
                  strokeLinecap="round"
                />
              ))}

            {inicio[1] > 0.2 && (
              <line
                x1={inicioGroundPos.sx}
                y1={inicioGroundPos.sy}
                x2={inicioPos.sx}
                y2={inicioPos.sy}
                stroke={t.color}
                strokeWidth={1}
                opacity={0.45}
                strokeDasharray="4 3"
              />
            )}

            <polygon
              points={estrella(
                inicioGroundPos.sx,
                inicioGroundPos.sy,
                7,
                3.5
              )}
              fill={t.color}
              stroke="white"
              strokeWidth={1.5}
              strokeLinejoin="round"
            />

            <circle
              cx={finPos.sx}
              cy={finPos.sy}
              r={RADIO_PELOTA}
              fill={mezclarConBlanco(t.color, 0.6)}
              stroke="white"
              strokeWidth={1.5}
            />
          </g>
        );
      })}
    </svg>
  );
}

function estrella(cx: number, cy: number, rExt: number, rInt: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? rExt : rInt;
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${cx + r * Math.cos(ang)},${cy + r * Math.sin(ang)}`);
  }
  return pts.join(" ");
}