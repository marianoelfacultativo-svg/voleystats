"use client";

import { useMemo } from "react";

export type TipoFundamento = "saque" | "recepcion" | "ataque";

export type Vista =
  | "top"
  | "front"
  | "front-rival"
  | "iso-izq"
  | "iso-der";

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
}

interface Props {
  tipo: TipoFundamento;
  items: ItemVisual[];
  vista?: Vista;
  width?: number;
  height?: number;
  mostrarEstelas?: boolean;
}

// ============================================================
// Coordenadas de celdas (1 unidad ≈ 1 metro)
// ============================================================
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

// ============================================================
// Extensión por borde (si la pelota salió del court)
// ============================================================
function extensionPorBorde(
  celda: string,
  mini: string | null
): { dx: number; dz: number } | null {
  if (!mini) return null;
  const partes = celda.split("-");
  if (partes.length !== 2) return null;
  const [fila, col] = partes;
  const m = mini.match(/^f(\d)c(\d)$/);
  if (!m) return null;
  const mf = parseInt(m[1]);
  const mc = parseInt(m[2]);
  const numCols = col === "C1" || col === "C5" ? 2 : 3;
  const numFils = 3;
  const numFila = parseInt(fila.slice(1));

  let dx = 0;
  let dz = 0;

  if (col === "C1" && mc === 1) dx = -1.5;
  else if (col === "C5" && mc === numCols) dx = 1.5;

  if (numFila === 6 && mf === numFils) dz = -1.5;
  else if (numFila === 3 && mf === numFils) dz = 1.5;

  if (dx === 0 && dz === 0) return null;
  return { dx, dz };
}

// ============================================================
// Hash determinístico
// ============================================================
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

// ============================================================
// Parámetros de vista
// ============================================================
interface VistaParams {
  mode: "ortho" | "iso";
  // ortho
  escalaX?: number;
  escalaY?: number;
  escalaZ?: number;
  offsetX?: number;
  offsetY?: number;
  centerX?: number;
  centerZ?: number;
  invertX?: boolean;
  invertZ?: boolean;
  // iso
  escala?: number;
  isoOffsetX?: number;
  isoOffsetY?: number;
  altFactor?: number;
}

const VISTA_PARAMS: Record<Vista, VistaParams> = {
  top: {
    mode: "ortho",
    escalaX: 35,
    escalaY: 0,
    escalaZ: 35,
    offsetX: 500,
    offsetY: 425,
    centerX: 6.5,
    centerZ: 0,
    invertX: false,
    invertZ: false,
  },
  front: {
    mode: "ortho",
    escalaX: 50,
    escalaY: 50,
    escalaZ: 35,
    offsetX: 500,
    offsetY: 425,
    centerX: 6.5,
    centerZ: 0,
    invertX: false,
    invertZ: false,
  },
  "front-rival": {
    mode: "ortho",
    escalaX: 50,
    escalaY: 50,
    escalaZ: 35,
    offsetX: 500,
    offsetY: 425,
    centerX: 6.5,
    centerZ: 0,
    invertX: true,
    invertZ: true,
  },
  "iso-izq": {
    mode: "iso",
    escala: 20,
    isoOffsetX: 500,
    isoOffsetY: 400,
    altFactor: 40,
  },
  "iso-der": {
    mode: "iso",
    escala: -20,
    isoOffsetX: 500,
    isoOffsetY: 400,
    altFactor: 40,
  },
};

function proyectar(
  x: number,
  z: number,
  y: number,
  vista: Vista
): { sx: number; sy: number } {
  const p = VISTA_PARAMS[vista];
  const cx = p.centerX ?? 6.5;
  const cz = p.centerZ ?? 0;
  const dx = x - cx;
  const dz = z - cz;

  if (p.mode === "ortho") {
    const sxDir = p.invertX ? -1 : 1;
    const szDir = p.invertZ ? -1 : 1;
    return {
      sx: (p.offsetX ?? 500) + sxDir * dx * (p.escalaX ?? 35),
      sy:
        (p.offsetY ?? 425) -
        y * (p.escalaY ?? 0) +
        szDir * dz * (p.escalaZ ?? 0),
    };
  }

  // iso
  const S = p.escala ?? 20;
  return {
    sx: (p.isoOffsetX ?? 500) + (dx - dz) * S,
    sy: (p.isoOffsetY ?? 400) + (dx + dz) * Math.abs(S) * 0.75 - y * (p.altFactor ?? 40),
  };
}

// ============================================================
// Parámetros de trayectoria
// ============================================================
interface ParametrosTrayectoria {
  hOrigen: number;
  hDestino: number;
  hApex: number;
  esRecto: boolean;
}

const APEX_RECEPCION: Record<number, number> = {
  1: 1.5,
  2: 2.0,
  3: 2.4,
  4: 2.8,
  5: 3.5,
  6: 4.0,
};

function getParametros(
  tipo: TipoFundamento,
  item: ItemVisual
): ParametrosTrayectoria {
  if (tipo === "saque") {
    const esPotencia = item.calidad === "potencia";
    return {
      hOrigen: 2.8,
      hDestino: 0,
      hApex: esPotencia ? 2.9 : 3.3,
      esRecto: esPotencia,
    };
  }
  if (tipo === "ataque") {
    return {
      hOrigen: 2.8,
      hDestino: 0,
      hApex: 2.9,
      esRecto: false,
    };
  }
  const cal = typeof item.calidad === "number" ? item.calidad : 4;
  return {
    hOrigen: 0.3,
    hDestino: 2.2,
    hApex: APEX_RECEPCION[cal] ?? 2.8,
    esRecto: false,
  };
}

// ============================================================
// Curva
// ============================================================
const ALTURA_RED = 2.43;

function generarCurvaSegmento(
  a: { x: number; z: number },
  b: { x: number; z: number },
  params: ParametrosTrayectoria,
  vista: Vista,
  forzarDentroDeRed: boolean
): string {
  const { hOrigen, hDestino, hApex, esRecto } = params;

  // Bend de x si cruza la red fuera de [2, 11]
  let ctrlX: number | null = null;
  if (forzarDentroDeRed) {
    const cruzandoRed = (a.z > 0 && b.z < 0) || (a.z < 0 && b.z > 0);
    if (cruzandoRed) {
      const t = -a.z / (b.z - a.z);
      const xCross = a.x + t * (b.x - a.x);
      const minX = 2.2;
      const maxX = 10.8;
      if (xCross < minX || xCross > maxX) {
        const xTarget = xCross < minX ? minX : maxX;
        const denom = 2 * (1 - t) * t;
        if (denom !== 0) {
          ctrlX = (xTarget - (1 - t) ** 2 * a.x - t ** 2 * b.x) / denom;
        }
      }
    }
  }

  const pasos = 30;
  let path = "";
  for (let i = 0; i <= pasos; i++) {
    const t = i / pasos;
    let x: number;
    if (ctrlX !== null) {
      x = (1 - t) ** 2 * a.x + 2 * (1 - t) * t * ctrlX + t ** 2 * b.x;
    } else {
      x = a.x + t * (b.x - a.x);
    }
    const z = a.z + t * (b.z - a.z);
    const hBase = hOrigen + t * (hDestino - hOrigen);
    let altura = hBase;
    if (!esRecto) {
      const apexCentrado = (hOrigen + hDestino) / 2;
      altura = hBase + 4 * t * (1 - t) * (hApex - apexCentrado);
    }
    const cruzandoRed = (a.z >= 0 && b.z < 0) || (a.z < 0 && b.z >= 0);
    if (cruzandoRed && altura < ALTURA_RED) {
      altura = ALTURA_RED + 0.05;
    }
    const p = proyectar(x, z, altura, vista);
    path += i === 0 ? `M ${p.sx} ${p.sy}` : ` L ${p.sx} ${p.sy}`;
  }
  return path;
}

// ============================================================
// Renderizado cancha / red
// ============================================================
const RED_X1 = 2;
const RED_X2 = 11;
const RED_Y_TOP = 2.43;
const RED_Y_BOTTOM = 1.43;
const ALTURA_VARILLA = 1.0;
const RADIO_PELOTA = 10;

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

// ============================================================
// Componente
// ============================================================
export default function CanchaVisualizacion({
  tipo,
  items,
  vista = "top",
  width = 1000,
  height = 760,
  mostrarEstelas = true,
}: Props) {
  const mostrarRival = tipo === "saque" || tipo === "ataque";

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
        const origen = debeRandomizar
          ? randomizar(origenBase, it.id, "-origen")
          : origenBase;
        let destino = debeRandomizar
          ? randomizar(destinoBase, it.id, "-destino")
          : destinoBase;

        const extension = extensionPorBorde(it.destino.celda, it.destino.mini);
        if (extension) {
          destino = {
            x: destino.x + extension.dx,
            z: destino.z + extension.dz,
          };
        }

        const desvios = debeRandomizar
          ? desviosBase.map((d, i) => randomizar(d, it.id, `-desvio-${i}`))
          : desviosBase;

        const puntos = [origen, ...desvios, destino];
        const params = getParametros(tipo, it);

        const paths: string[] = [];
        for (let i = 0; i < puntos.length - 1; i++) {
          paths.push(
            generarCurvaSegmento(
              puntos[i],
              puntos[i + 1],
              params,
              vista,
              tipo === "saque" || tipo === "ataque"
            )
          );
        }

        return { item: it, puntos, paths, color: it.color, params };
      })
      .filter((t): t is NonNullable<typeof t> => t !== null);
  }, [items, tipo, vista]);

  const contornoPropio = useMemo(() => {
    const esquinas = [
      proyectar(2, 0, 0, vista),
      proyectar(11, 0, 0, vista),
      proyectar(11, 9, 0, vista),
      proyectar(2, 9, 0, vista),
    ];
    return esquinas.map((p) => `${p.sx},${p.sy}`).join(" ");
  }, [vista]);

  const contornoRival = useMemo(() => {
    if (!mostrarRival) return "";
    const esquinas = [
      proyectar(2, 0, 0, vista),
      proyectar(11, 0, 0, vista),
      proyectar(11, -9, 0, vista),
      proyectar(2, -9, 0, vista),
    ];
    return esquinas.map((p) => `${p.sx},${p.sy}`).join(" ");
  }, [vista, mostrarRival]);

  const lineaMedio = useMemo(
    () => ({
      p1: proyectar(2, 0, 0, vista),
      p2: proyectar(11, 0, 0, vista),
    }),
    [vista]
  );

  const lineaAtaquePropia = useMemo(
    () => ({
      p1: proyectar(2, 3, 0, vista),
      p2: proyectar(11, 3, 0, vista),
    }),
    [vista]
  );

  const lineaAtaqueRival = useMemo(() => {
    if (!mostrarRival) return null;
    return {
      p1: proyectar(2, -3, 0, vista),
      p2: proyectar(11, -3, 0, vista),
    };
  }, [vista, mostrarRival]);

  const red = useMemo(
    () => ({
      p1: proyectar(RED_X1, 0, RED_Y_TOP, vista),
      p2: proyectar(RED_X2, 0, RED_Y_TOP, vista),
    }),
    [vista]
  );

  const redMalla = useMemo(() => {
    const lineas: { p1: { sx: number; sy: number }; p2: { sx: number; sy: number } }[] = [];
    const pasos = 27;
    for (let i = 0; i <= pasos; i++) {
      const x = RED_X1 + ((RED_X2 - RED_X1) * i) / pasos;
      const abajo = proyectar(x, 0, RED_Y_BOTTOM, vista);
      const arriba = proyectar(x, 0, RED_Y_TOP, vista);
      lineas.push({ p1: abajo, p2: arriba });
    }
    const filasRed = 6;
    for (let j = 0; j <= filasRed; j++) {
      const h = RED_Y_BOTTOM + ((RED_Y_TOP - RED_Y_BOTTOM) * j) / filasRed;
      const izq = proyectar(RED_X1, 0, h, vista);
      const der = proyectar(RED_X2, 0, h, vista);
      lineas.push({ p1: izq, p2: der });
    }
    return lineas;
  }, [vista]);

  const redPostes = useMemo(
    () => [
      {
        p1: proyectar(RED_X1, 0, 0, vista),
        p2: proyectar(RED_X1, 0, RED_Y_TOP, vista),
      },
      {
        p1: proyectar(RED_X2, 0, 0, vista),
        p2: proyectar(RED_X2, 0, RED_Y_TOP, vista),
      },
    ],
    [vista]
  );

  const redVarillas = useMemo(() => {
    const varillas: { p1: { sx: number; sy: number }; p2: { sx: number; sy: number }; color: string }[] = [];
    const segmentos = 4;
    const alturaSeg = ALTURA_VARILLA / segmentos;
    for (const x of [RED_X1, RED_X2]) {
      for (let i = 0; i < segmentos; i++) {
        const y1 = RED_Y_TOP + i * alturaSeg;
        const y2 = RED_Y_TOP + (i + 1) * alturaSeg;
        varillas.push({
          p1: proyectar(x, 0, y1, vista),
          p2: proyectar(x, 0, y2, vista),
          color: i % 2 === 0 ? "#dc2626" : "#ffffff",
        });
      }
    }
    return varillas;
  }, [vista]);

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

      {redVarillas.map((v, i) => (
        <line
          key={`varilla-${i}`}
          x1={v.p1.sx}
          y1={v.p1.sy}
          x2={v.p2.sx}
          y2={v.p2.sy}
          stroke={v.color}
          strokeWidth={3}
          strokeLinecap="butt"
        />
      ))}

      {trayectorias.map((t, i) => {
        return (
          <g key={i}>
            {t.puntos.slice(1, -1).map((p, j) => {
              const pPos = proyectar(p.x, p.z, 0, vista);
              return (
                <circle
                  key={`desvio-${j}`}
                  cx={pPos.sx}
                  cy={pPos.sy}
                  r={4}
                  fill={t.color}
                  stroke="white"
                  strokeWidth={1.5}
                  opacity={0.85}
                />
              );
            })}

            {mostrarEstelas &&
              t.paths.map((path, j) => (
                <path
                  key={`path-${j}`}
                  d={path}
                  fill="none"
                  stroke={t.color}
                  strokeWidth={3}
                  strokeOpacity={0.75}
                  strokeLinecap="round"
                />
              ))}

            {(() => {
              const p = t.puntos[0];
              const pos = proyectar(p.x, p.z, t.params.hOrigen, vista);
              return (
                <EstrellaOrigen
                  cx={pos.sx}
                  cy={pos.sy}
                  radio={10}
                  color={t.color}
                />
              );
            })()}

            {(() => {
              const p = t.puntos[t.puntos.length - 1];
              const pos = proyectar(p.x, p.z, t.params.hDestino, vista);
              return (
                <VolleyballPelota
                  cx={pos.sx}
                  cy={pos.sy}
                  radio={RADIO_PELOTA}
                  colorCalidad={t.color}
                />
              );
            })()}
          </g>
        );
      })}
    </svg>
  );
}

function EstrellaOrigen({
  cx,
  cy,
  radio,
  color,
}: {
  cx: number;
  cy: number;
  radio: number;
  color: string;
}) {
  const pts: string[] = [];
  const puntoInterno = radio * 0.42;
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? radio : puntoInterno;
    const angulo = (Math.PI / 5) * i - Math.PI / 2;
    const x = cx + r * Math.cos(angulo);
    const y = cy + r * Math.sin(angulo);
    pts.push(`${x},${y}`);
  }
  return (
    <polygon
      points={pts.join(" ")}
      fill={color}
      stroke="white"
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
  );
}

function VolleyballPelota({
  cx,
  cy,
  radio,
  colorCalidad,
}: {
  cx: number;
  cy: number;
  radio: number;
  colorCalidad: string;
}) {
  const id = `pelota-${Math.round(cx)}-${Math.round(cy)}`;
  return (
    <g
      style={{
        filter: `drop-shadow(0 0 ${radio * 0.5}px ${colorCalidad}aa)`,
      }}
    >
      <defs>
        <radialGradient id={`${id}-base`} cx="35%" cy="30%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor={mezclarConBlanco(colorCalidad, 0.68)} />
          <stop offset="100%" stopColor={mezclarConBlanco(colorCalidad, 0.4)} />
        </radialGradient>
        <clipPath id={`${id}-clip`}>
          <circle cx={cx} cy={cy} r={radio} />
        </clipPath>
      </defs>

      <circle
        cx={cx}
        cy={cy}
        r={radio}
        fill={`url(#${id}-base)`}
        stroke="#94a3b8"
        strokeWidth={0.6}
      />

      <g clipPath={`url(#${id}-clip)`}>
        <path
          d={`M ${cx - radio} ${cy - radio * 0.4}
              Q ${cx - radio * 0.3} ${cy - radio * 1.1}
                ${cx + radio * 0.3} ${cy - radio * 0.8}
              Q ${cx + radio * 0.6} ${cy - radio * 0.6}
                ${cx + radio * 0.7} ${cy - radio * 0.2}`}
          fill="none"
          stroke="#1e3a8a"
          strokeWidth={radio * 0.5}
          strokeLinecap="round"
          opacity={0.9}
        />
        <path
          d={`M ${cx + radio * 0.9} ${cy + radio * 0.2}
              Q ${cx + radio * 0.4} ${cy + radio * 0.7}
                ${cx - radio * 0.3} ${cy + radio * 0.9}`}
          fill="none"
          stroke="#1e3a8a"
          strokeWidth={radio * 0.45}
          strokeLinecap="round"
          opacity={0.9}
        />
        <path
          d={`M ${cx - radio * 0.2} ${cy - radio * 1.1}
              Q ${cx - radio * 0.1} ${cy}
                ${cx - radio * 0.5} ${cy + radio * 1.1}`}
          fill="none"
          stroke={colorCalidad}
          strokeWidth={radio * 0.42}
          strokeLinecap="round"
          opacity={0.95}
        />
        <path
          d={`M ${cx - radio * 1.1} ${cy + radio * 0.3}
              Q ${cx - radio * 0.6} ${cy + radio * 0.5}
                ${cx - radio * 0.3} ${cy + radio * 1.1}`}
          fill="none"
          stroke={colorCalidad}
          strokeWidth={radio * 0.38}
          strokeLinecap="round"
          opacity={0.95}
        />
      </g>

      <ellipse
        cx={cx - radio * 0.35}
        cy={cy - radio * 0.4}
        rx={radio * 0.3}
        ry={radio * 0.18}
        fill="white"
        opacity={0.55}
      />
      <ellipse
        cx={cx + radio * 0.2}
        cy={cy + radio * 0.55}
        rx={radio * 0.45}
        ry={radio * 0.12}
        fill="black"
        opacity={0.12}
      />
    </g>
  );
}