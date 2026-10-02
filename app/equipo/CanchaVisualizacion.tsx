"use client";

import { useMemo } from "react";

export type TipoFundamento = "saque" | "recepcion" | "ataque";

export type Vista =
  | "top"
  | "front"
  | "iso"
  | "iso-opuesta"
  | "paralela-izq"
  | "paralela-der";

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
  /** calidad: 1-6 para recepción, "flotado"|"potencia" para saque */
  calidad?: number | string;
  /** si false, no randomiza (útil para recepción doble positiva) */
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
// Coordenadas de celdas (en "unidades" del grid, 1 unidad ≈ 1 metro)
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

function obtenerCoords(
  celda: string,
  mini: string | null
): { x: number; z: number } | null {
  if (celda.startsWith("S")) return servicioPos(celda);

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

  // En cancha rival, invertimos la fila para que f1 esté cerca de la red
  const esRival = parseInt(fila.slice(1)) >= 4;
  const mfFinal = esRival ? numFils - 1 - mf : mf;

  return {
    x: rangoX[0] + (mc + 0.5) * anchoCelda,
    z: rangoZ[0] + (mfFinal + 0.5) * altoCelda,
  };
}

// ============================================================
// Hash determinístico para randomización estable
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

/** Randomiza ±0.3m (30cm) alrededor del centro de la celda */
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
// Proyección
// ============================================================
const ALTURA_RED = 2.43;
const RADIO_PELOTA = 10;

const ISO_ANGLE_DEG = 22;
const ISO_COS = Math.cos((ISO_ANGLE_DEG * Math.PI) / 180);
const ISO_SIN = Math.sin((ISO_ANGLE_DEG * Math.PI) / 180);

const FRONT_Z_FACTOR = 0.12;
const PARALELA_X_FACTOR = 0.15;

const RED_X1 = 2;
const RED_X2 = 11;
const RED_Y_TOP = 2.43;
const RED_Y_BOTTOM = 1.43;
const ALTURA_VARILLA = 1.0;

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

const OFFSET = {
  top: { x: 150, y: 300 },
  front: { x: 150, y: 520 },
  iso: { x: 400, y: 400 },
  isoOpuesta: { x: 590, y: 400 },
  paralelaIzq: { x: 80, y: 400 },
  paralelaDer: { x: 920, y: 400 },
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
    case "iso":
      return {
        sx: (x - z) * ISO_COS * escala + OFFSET.iso.x,
        sy: (x + z) * ISO_SIN * escala - y * escala + OFFSET.iso.y,
      };
    case "iso-opuesta": {
      const xr = 13 - x;
      const zr = 9 - z;
      return {
        sx: (xr - zr) * ISO_COS * escala + OFFSET.isoOpuesta.x,
        sy: (xr + zr) * ISO_SIN * escala - y * escala + OFFSET.isoOpuesta.y,
      };
    }
    case "paralela-izq":
      return {
        sx:
          z * escala +
          x * escala * PARALELA_X_FACTOR +
          OFFSET.paralelaIzq.x,
        sy: -y * escala + OFFSET.paralelaIzq.y,
      };
    case "paralela-der":
      return {
        sx:
          (9 - z) * escala +
          (13 - x) * escala * PARALELA_X_FACTOR +
          OFFSET.paralelaDer.x -
          9 * escala -
          13 * escala * PARALELA_X_FACTOR,
        sy: -y * escala + OFFSET.paralelaDer.y,
      };
  }
}

// ============================================================
// Parámetros de trayectoria según tipo
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
      hApex: esPotencia ? 2.9 : 3.2,
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
  // recepción
  const cal = typeof item.calidad === "number" ? item.calidad : 4;
  return {
    hOrigen: 0.3,
    hDestino: 2.2,
    hApex: APEX_RECEPCION[cal] ?? 2.8,
    esRecto: false,
  };
}

// ============================================================
// Curva entre dos puntos 3D
// ============================================================
function generarCurvaSegmento(
  a: { x: number; z: number },
  b: { x: number; z: number },
  params: ParametrosTrayectoria,
  vista: Vista,
  escala: number
): string {
  const { hOrigen, hDestino, hApex, esRecto } = params;
  const pasos = 24;
  let path = "";
  for (let i = 0; i <= pasos; i++) {
    const t = i / pasos;
    const x = a.x + t * (b.x - a.x);
    const z = a.z + t * (b.z - a.z);
    const hBase = hOrigen + t * (hDestino - hOrigen);
    let altura = hBase;
    if (!esRecto) {
      const apexCentrado = (hOrigen + hDestino) / 2;
      altura =
        hBase + 4 * t * (1 - t) * (hApex - apexCentrado);
    }
    // Si cruza la red y está por debajo, subimos a 2.43
    const cruzandoRed = (a.z >= 0 && b.z < 0) || (a.z < 0 && b.z >= 0);
    if (cruzandoRed && altura < ALTURA_RED) {
      altura = ALTURA_RED + 0.05;
    }
    const p = proyectar(x, z, altura, vista, escala);
    path += i === 0 ? `M ${p.sx} ${p.sy}` : ` L ${p.sx} ${p.sy}`;
  }
  return path;
}

// ============================================================
// Componente
// ============================================================
export default function CanchaVisualizacion({
  tipo,
  items,
  vista = "iso",
  width = 1000,
  height = 800,
  mostrarEstelas = true,
}: Props) {
  const escala = ESCALA;
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

        // ¿Randomizamos?
        const debeRandomizar = it.randomizar !== false;
        const origen = debeRandomizar
          ? randomizar(origenBase, it.id, "-origen")
          : origenBase;
        const destino = debeRandomizar
          ? randomizar(destinoBase, it.id, "-destino")
          : destinoBase;
        const desvios = debeRandomizar
          ? desviosBase.map((d, i) =>
              randomizar(d, it.id, `-desvio-${i}`)
            )
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
              escala
            )
          );
        }

        return {
          item: it,
          puntos,
          paths,
          color: it.color,
          params,
        };
      })
      .filter((t): t is NonNullable<typeof t> => t !== null);
  }, [items, tipo, vista, escala]);

  // Contornos
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
    const pasos = 27;
    for (let i = 0; i <= pasos; i++) {
      const x = RED_X1 + ((RED_X2 - RED_X1) * i) / pasos;
      const abajo = proyectar(x, 0, RED_Y_BOTTOM, vista, escala);
      const arriba = proyectar(x, 0, RED_Y_TOP, vista, escala);
      lineas.push({ p1: abajo, p2: arriba });
    }
    const filasRed = 6;
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

  const redVarillas = useMemo(() => {
    const varillas: {
      p1: { sx: number; sy: number };
      p2: { sx: number; sy: number };
      color: string;
    }[] = [];
    const segmentos = 4;
    const alturaSeg = ALTURA_VARILLA / segmentos;
    for (const x of [RED_X1, RED_X2]) {
      for (let i = 0; i < segmentos; i++) {
        const y1 = RED_Y_TOP + i * alturaSeg;
        const y2 = RED_Y_TOP + (i + 1) * alturaSeg;
        varillas.push({
          p1: proyectar(x, 0, y1, vista, escala),
          p2: proyectar(x, 0, y2, vista, escala),
          color: i % 2 === 0 ? "#dc2626" : "#ffffff",
        });
      }
    }
    return varillas;
  }, [vista, escala]);

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
          fill="#f97316"
          stroke="#c2410c"
          strokeWidth={2}
          opacity={0.35}
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
              const pPos = proyectar(p.x, p.z, 0, vista, escala);
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
              const pos = proyectar(
                p.x,
                p.z,
                t.params.hOrigen,
                vista,
                escala
              );
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
              const pos = proyectar(
                p.x,
                p.z,
                t.params.hDestino,
                vista,
                escala
              );
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
          <stop
            offset="55%"
            stopColor={mezclarConBlanco(colorCalidad, 0.68)}
          />
          <stop
            offset="100%"
            stopColor={mezclarConBlanco(colorCalidad, 0.4)}
          />
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