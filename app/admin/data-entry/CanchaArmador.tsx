"use client";

import { useMemo } from "react";

export interface ArmadoDetalle {
  id: string;
  jugador_id: string;
  set_numero: number;
  punto_numero: number;
  origen_celda: string;
  origen_mini: string | null;
  destino_celda: string;
  destino_mini: string | null;
  zona_tendencia: number | null;
  calidad: number;
  atacante_derecho: "arriba" | "abajo";
  armador_numero: number;
}

export type Vista =
  | "top"
  | "front"
  | "iso"
  | "iso-opuesta"
  | "paralela-izq"
  | "paralela-der";

interface Props {
  armados: ArmadoDetalle[];
  vista?: Vista;
  width?: number;
  height?: number;
  mostrarEstelas?: boolean;
}

const COLORES_CALIDAD: Record<number, string> = {
  1: "#dc2626",
  2: "#ea580c",
  3: "#eab308",
  4: "#84cc16",
  5: "#16a34a",
  6: "#059669",
};

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
};

const ALTURA_RED = 2.43;
const ALTURA_MIN_BIEN_ARMADO = 2.64;
const ALTURA_TOP_ARMADO = 2.7;
const ALTURA_DESTINO_MEDIA = 2.65;
const ALTURA_ORIGEN_ARMADO = 2.35;
const VARIANZA_GENERAL = 0.24;

const RADIO_PELOTA = 9;

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

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function mezclarConBlanco(hex: string, cantidad: number): string {
  const [r, g, b] = hexToRgb(hex);
  const nr = Math.round(r + (255 - r) * cantidad);
  const ng = Math.round(g + (255 - g) * cantidad);
  const nb = Math.round(b + (255 - b) * cantidad);
  return `rgb(${nr}, ${ng}, ${nb})`;
}

function obtenerCoords(
  celda: string,
  mini: string | null
): { x: number; z: number } | null {
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

  return {
    x: rangoX[0] + (mc + 0.5) * anchoCelda,
    z: rangoZ[0] + (mf + 0.5) * altoCelda,
  };
}

function esColumnaExterior(
  celda: string,
  mini: string | null,
  zona: number | null
): boolean {
  if (!mini || zona === null) return false;
  const match = mini.match(/^f(\d)c(\d)$/);
  if (!match) return false;
  const miniCol = parseInt(match[2]);

  if (zona === 4 && miniCol === 1) return true;
  if ((zona === 2 || zona === 1) && miniCol === 3) return true;
  return false;
}

function calcularDestinoYAltura(
  a: ArmadoDetalle,
  origen: { x: number; z: number },
  destinoBase: { x: number; z: number }
): { destino: { x: number; z: number }; hDestino: number } {
  const pegadaVarilla =
    a.calidad >= 5 &&
    esColumnaExterior(a.destino_celda, a.destino_mini, a.zona_tendencia);

  if (pegadaVarilla) {
    const rx = prand(a.id, "-varx");
    const rz = prand(a.id, "-varz");
    const distVarilla = 0.10 + rx * 0.20;

    let zVar: number;
    if (a.destino_celda.startsWith("F1")) {
      zVar = 0.10 + rz * 1.10;
    } else if (a.destino_celda.startsWith("F2")) {
      zVar = 3.10 + rz * 2.70;
    } else {
      zVar = 6.10 + rz * 2.70;
    }

    if (a.zona_tendencia === 4) {
      return {
        destino: { x: 2 + distVarilla, z: zVar },
        hDestino: ALTURA_TOP_ARMADO,
      };
    }
    return {
      destino: { x: 11 - distVarilla, z: zVar },
      hDestino: ALTURA_TOP_ARMADO,
    };
  }

  const rx = prand(a.id, "-varx");
  const rz = prand(a.id, "-varz");
  const ry = prand(a.id, "-vary");

  const destino = {
    x: destinoBase.x + (rx - 0.5) * VARIANZA_GENERAL,
    z: destinoBase.z + (rz - 0.5) * VARIANZA_GENERAL,
  };
  const hDestino = ALTURA_DESTINO_MEDIA + (ry - 0.5) * VARIANZA_GENERAL;

  return { destino, hDestino };
}

function calcularApex(
  origen: { x: number; z: number },
  destino: { x: number; z: number },
  celda: string,
  mini: string | null,
  calidad: number,
  seed: string
): number {
  const distancia = Math.sqrt(
    (destino.x - origen.x) ** 2 + (destino.z - origen.z) ** 2
  );
  const [fila, col] = celda.split("-");
  const r = prand(seed, "-apex");

  let base: number;

  if (calidad >= 5) {
    base = ALTURA_TOP_ARMADO;
  } else if (distancia > 5) base = 4.5 + r * 0.5;
  else if (fila === "F3") base = 4.5 + r * 0.5;
  else if (fila === "F1" && mini && mini.startsWith("f1")) {
    if (calidad === 1 || calidad === 2) base = 2.4;
    else if (calidad === 3) {
      if (col === "C3" && mini === "f1c1") base = 3.5;
      else if (col === "C2" || col === "C4") base = 2.55;
      else base = 2.4;
    } else base = 3.0 + r * 0.5;
  } else if (fila === "F1") {
    if (calidad === 1 || calidad === 2) base = 2.4;
    else if (calidad === 3) base = 2.55;
    else base = 3.0 + r * 0.5;
  } else if (calidad >= 4) base = 3.5 + r * 1.0;
  else base = 2.4;

  if (base > ALTURA_TOP_ARMADO) {
    base = base * 0.85;
  }

  base = base * 1.05;

  if (base <= 2.75) {
    base = base + 0.55;
  }

  if (calidad >= 5 && base < ALTURA_RED) base = ALTURA_RED + 0.3;

  return base;
}

const ESCALA = 45;

const OFFSET = {
  top: { x: 150, y: 100 },
  front: { x: 150, y: 520 },
  iso: { x: 400, y: 270 },
  isoOpuesta: { x: 590, y: 270 },
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

function generarCurva(
  origen: { x: number; z: number },
  destino: { x: number; z: number },
  hApex: number,
  hDestino: number,
  vista: Vista,
  escala: number,
  calidad: number
): string {
  const hOrigen = ALTURA_ORIGEN_ARMADO;
  const pasos = 24;
  let path = "";
  for (let i = 0; i <= pasos; i++) {
    const t = i / pasos;
    const x = origen.x + t * (destino.x - origen.x);
    const z = origen.z + t * (destino.z - origen.z);
    const hBase = hOrigen + t * (hDestino - hOrigen);
    let altura =
      hBase + 4 * t * (1 - t) * (hApex - (hOrigen + hDestino) / 2);

    if (calidad >= 5 && altura < ALTURA_RED && t > 0.4) {
      altura = ALTURA_RED;
    }

    const p = proyectar(x, z, altura, vista, escala);
    path += i === 0 ? `M ${p.sx} ${p.sy}` : ` L ${p.sx} ${p.sy}`;
  }
  return path;
}

export default function CanchaArmador({
  armados,
  vista = "iso",
  width = 1000,
  height = 800,
  mostrarEstelas = true,
}: Props) {
  const escala = ESCALA;

  const trayectorias = useMemo(() => {
    return armados
      .map((a) => {
        const origen = obtenerCoords(a.origen_celda, a.origen_mini);
        const destinoBase = obtenerCoords(a.destino_celda, a.destino_mini);
        if (!origen || !destinoBase) return null;

        const { destino, hDestino } = calcularDestinoYAltura(
          a,
          origen,
          destinoBase
        );

        const hApex = calcularApex(
          origen,
          destino,
          a.origen_celda,
          a.origen_mini,
          a.calidad,
          a.id
        );

        return {
          armado: a,
          origen,
          destino,
          hApex,
          hDestino,
          color: COLORES_CALIDAD[a.calidad] ?? "#64748b",
        };
      })
      .filter((t): t is NonNullable<typeof t> => t !== null);
  }, [armados]);

  const contornoExt = useMemo(() => {
    const esquinas = [
      proyectar(0, 0, 0, vista, escala),
      proyectar(13, 0, 0, vista, escala),
      proyectar(13, 9, 0, vista, escala),
      proyectar(0, 9, 0, vista, escala),
    ];
    return esquinas.map((p) => `${p.sx},${p.sy}`).join(" ");
  }, [vista, escala]);

  const contornoCancha = useMemo(() => {
    const esquinas = [
      proyectar(2, 0, 0, vista, escala),
      proyectar(11, 0, 0, vista, escala),
      proyectar(11, 9, 0, vista, escala),
      proyectar(2, 9, 0, vista, escala),
    ];
    return esquinas.map((p) => `${p.sx},${p.sy}`).join(" ");
  }, [vista, escala]);

  const lineaAtaque = useMemo(() => {
    return {
      p1: proyectar(2, 3, 0, vista, escala),
      p2: proyectar(11, 3, 0, vista, escala),
    };
  }, [vista, escala]);

  const lineaMedio = useMemo(() => {
    return {
      p1: proyectar(2, 0, 0, vista, escala),
      p2: proyectar(11, 0, 0, vista, escala),
    };
  }, [vista, escala]);

  const red = useMemo(() => {
    return {
      p1: proyectar(RED_X1, 0, RED_Y_TOP, vista, escala),
      p2: proyectar(RED_X2, 0, RED_Y_TOP, vista, escala),
    };
  }, [vista, escala]);

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
      const h =
        RED_Y_BOTTOM + ((RED_Y_TOP - RED_Y_BOTTOM) * j) / filasRed;
      const izq = proyectar(RED_X1, 0, h, vista, escala);
      const der = proyectar(RED_X2, 0, h, vista, escala);
      lineas.push({ p1: izq, p2: der });
    }
    return lineas;
  }, [vista, escala]);

  const redPostes = useMemo(() => {
    return [
      {
        p1: proyectar(RED_X1, 0, 0, vista, escala),
        p2: proyectar(RED_X1, 0, RED_Y_TOP, vista, escala),
      },
      {
        p1: proyectar(RED_X2, 0, 0, vista, escala),
        p2: proyectar(RED_X2, 0, RED_Y_TOP, vista, escala),
      },
    ];
  }, [vista, escala]);

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
      <polygon
        points={contornoExt}
        fill="#2563eb"
        stroke="#1e40af"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <polygon
        points={contornoCancha}
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
        x1={lineaAtaque.p1.sx}
        y1={lineaAtaque.p1.sy}
        x2={lineaAtaque.p2.sx}
        y2={lineaAtaque.p2.sy}
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
        const path = generarCurva(
          t.origen,
          t.destino,
          t.hApex,
          t.hDestino,
          vista,
          escala,
          t.armado.calidad
        );
        const origenAlturaPos = proyectar(
          t.origen.x,
          t.origen.z,
          ALTURA_ORIGEN_ARMADO,
          vista,
          escala
        );
        const destinoPos = proyectar(
          t.destino.x,
          t.destino.z,
          0,
          vista,
          escala
        );
        const destinoAlturaPos = proyectar(
          t.destino.x,
          t.destino.z,
          t.hDestino,
          vista,
          escala
        );

        return (
          <g key={i}>
            <circle
              cx={destinoPos.sx}
              cy={destinoPos.sy}
              r={5}
              fill={t.color}
              opacity={0.35}
            />
            {mostrarEstelas && (
              <path
                d={path}
                fill="none"
                stroke={t.color}
                strokeWidth={3}
                strokeOpacity={0.75}
                strokeLinecap="round"
              />
            )}
            <EstrellaValor
              cx={origenAlturaPos.sx}
              cy={origenAlturaPos.sy}
              radio={10}
              colorCalidad={t.color}
              valor={t.armado.calidad}
            />
            <VolleyballPelota
              cx={destinoAlturaPos.sx}
              cy={destinoAlturaPos.sy}
              radio={RADIO_PELOTA}
              colorCalidad={t.color}
            />
          </g>
        );
      })}
    </svg>
  );
}

function EstrellaValor({
  cx,
  cy,
  radio,
  colorCalidad,
  valor,
}: {
  cx: number;
  cy: number;
  radio: number;
  colorCalidad: string;
  valor: number;
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
    <g>
      <polygon
        points={pts.join(" ")}
        fill={colorCalidad}
        stroke="white"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <text
        x={cx}
        y={cy + radio * 0.05}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={radio * 1.05}
        fontWeight="bold"
        fill="white"
      >
        {valor}
      </text>
    </g>
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