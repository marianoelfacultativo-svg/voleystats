"use client";

import React, { useContext, useState } from "react";
import { CANCHA_V2_DIMS, CanchaStretchContext } from "./CanchaV2";

// ============================================================
// TIPOS
// ============================================================

export type ValorArmado = 1 | 2 | 3 | 4 | 5 | 6 | "R";

export type ValorSaque =
  | "ace"
  | "positivo_mas"
  | "positivo"
  | "neutro"
  | "negativo";

export type ValorTipoSaque = "potencia" | "flotado";

// ============================================================
// RECEPCIÓN — sistema nuevo de 7 valores
// ============================================================
// El popup solo ofrece 5 valores elegidos a mano:
//   perfecta       (R#)
//   positiva       (R+)
//   intermedia     (R!)
//   negativa       (R-)
//   doble_negativa (R--)
//
// Overpass (R/) y error_directo (R=) NO se eligen a mano:
//   - error_directo: se genera automático cuando hay ace (no hay
//                    recepción real).
//   - overpass:      se detecta automático cuando la línea de
//                    recepción cruza la red.
// ------------------------------------------------------------

export type ValorRecepcion =
  | "perfecta"
  | "positiva"
  | "intermedia"
  | "negativa"
  | "doble_negativa";

export type TipoDefensa = "toque" | "gran-defensa" | "libre";

export type ResultadoRoceRed =
  | "ofensivo-propio"
  | "invasion-zaguero"
  | "invasion-delantero"
  | "roce-red-rival";

export type VarianteAtaquePopup = "toque" | "libre";

export type VarianteRemateSegunda = "remate-segunda";

export type ValorVelocidad = 1 | 1.5 | 2 | 3 | 5;

export interface JugadorEnCancha {
  id: string;
  nombre: string;
  rol?: string;
  zona?: number;
}

export interface JugadorZona {
  zona: 4 | 3 | 2;
  jugadorId: string | null;
  nombre: string;
}

export interface PopupPos {
  x: number;
  y: number;
}

// ============================================================
// COLORES Y ETIQUETAS
// ============================================================

const COL_ARMADO: Record<ValorArmado, string> = {
  1: "#dc2626",
  2: "#ea580c",
  3: "#eab308",
  4: "#84cc16",
  5: "#16a34a",
  6: "#059669",
  R: "#334155",
};

const ETIQ_ARMADO: Record<ValorArmado, string> = {
  1: "H",
  2: "M",
  3: "F",
  4: "C",
  5: "P",
  6: "G",
  R: "R",
};

const COL_SAQUE: Record<ValorSaque, string> = {
  ace: "#16a34a",
  positivo_mas: "#65a30d",
  positivo: "#84cc16",
  neutro: "#94a3b8",
  negativo: "#dc2626",
};

const ETIQ_SAQUE: Record<ValorSaque, string> = {
  ace: "Ace",
  positivo_mas: "Pos+",
  positivo: "Pos",
  neutro: "Neu",
  negativo: "Neg",
};

const ORDEN_SAQUE: ValorSaque[] = [
  "ace",
  "positivo_mas",
  "positivo",
  "neutro",
  "negativo",
];

// ============================================================
// RECEPCIÓN — 5 botones a mano (R# R+ R! R- R--)
// ============================================================

const COL_RECEPCION: Record<ValorRecepcion, string> = {
  perfecta: "#16a34a",
  positiva: "#84cc16",
  intermedia: "#eab308",
  negativa: "#f59e0b",
  doble_negativa: "#dc2626",
};

const ETIQ_RECEPCION: Record<ValorRecepcion, string> = {
  perfecta: "R#",
  positiva: "R+",
  intermedia: "R!",
  negativa: "R-",
  doble_negativa: "R--",
};

const ORDEN_RECEPCION: ValorRecepcion[] = [
  "perfecta",
  "positiva",
  "intermedia",
  "negativa",
  "doble_negativa",
];

const COL_DEFENSA: Record<TipoDefensa, string> = {
  toque: "#f59e0b",
  "gran-defensa": "#16a34a",
  libre: "#a16207",
};

const ETIQ_DEFENSA: Record<TipoDefensa, string> = {
  toque: "Toque",
  "gran-defensa": "Gran def.",
  libre: "Libre",
};

const OPCIONES_ATAQUE_TOQUE_LIBRE: {
  id: VarianteAtaquePopup;
  label: string;
  color: string;
}[] = [
  { id: "toque", label: "Toque", color: "#f59e0b" },
  { id: "libre", label: "Libre", color: "#a16207" },
];

const OPCIONES_ROCE_RED: {
  id: ResultadoRoceRed;
  label: string;
  color: string;
}[] = [
  { id: "ofensivo-propio", label: "Ofensivo propio", color: "#dc2626" },
  { id: "invasion-zaguero", label: "Invasión zaguero", color: "#ea580c" },
  { id: "invasion-delantero", label: "Invasión delantero", color: "#f59e0b" },
  { id: "roce-red-rival", label: "Roce red rival", color: "#0284c7" },
];

const ORDEN_VELOCIDAD: ValorVelocidad[] = [1, 1.5, 2, 3, 5];

const ETIQ_VELOCIDAD: Record<ValorVelocidad, string> = {
  1: "1",
  1.5: "1.5",
  2: "2",
  3: "3",
  5: "5",
};

const DESC_VELOCIDAD: Record<ValorVelocidad, string> = {
  1: "Primer tiempo",
  1.5: "Semi",
  2: "Segundo tiempo",
  3: "Tercer tiempo",
  5: "Alta",
};

const COL_VELOCIDAD: Record<ValorVelocidad, string> = {
  1: "#dc2626",
  1.5: "#ea580c",
  2: "#eab308",
  3: "#84cc16",
  5: "#16a34a",
};

// ============================================================
// HELPER: color por rol
// ============================================================

function colorDeRol(rol?: string) {
  switch (rol) {
    case "A":
      return { bg: "#ede9fe", borde: "#a78bfa", texto: "#5b21b6" };
    case "O":
      return { bg: "#ffedd5", borde: "#fb923c", texto: "#9a3412" };
    case "C":
    case "C1":
    case "C2":
      return { bg: "#dbeafe", borde: "#60a5fa", texto: "#1e40af" };
    case "P":
    case "P1":
    case "P2":
      return { bg: "#dcfce7", borde: "#4ade80", texto: "#166534" };
    case "L":
      return { bg: "#fce7f3", borde: "#f472b6", texto: "#9d174d" };
    default:
      return { bg: "#f1f5f9", borde: "#cbd5e1", texto: "#475569" };
  }
}

function textoCortoNombre(nombre: string) {
  const partes = nombre.split(" ");
  return partes.length > 1 ? partes[0] : nombre.slice(0, 10);
}

// ============================================================
// WRAPPER
// ============================================================

interface WrapperProps {
  pos: PopupPos;
  ancho: number;
  alto: number;
  titulo: string;
  children: React.ReactNode;
}

function PopupWrapper({ pos, ancho, alto, titulo, children }: WrapperProps) {
  const { ancho: W, alto: H } = CANCHA_V2_DIMS;
  const { sx, sy, popupZoom } = useContext(CanchaStretchContext);
  const invSx = sx !== 0 ? 1 / sx : 1;
  const invSy = sy !== 0 ? 1 / sy : 1;
  const escX = invSx * popupZoom;
  const escY = invSy * popupZoom;

  let x = pos.x - ancho / 2;
  if (x < 2) x = 2;
  if (x + ancho > W - 2) x = W - ancho - 2;

  let y = pos.y - alto - 6;
  if (y < 2) y = pos.y + 6;
  if (y + alto > H - 2) y = H - alto - 2;

  const cx = x + ancho / 2;
  const cy = y + alto / 2;

  return (
    <g
      style={{ pointerEvents: "auto" }}
      transform={`translate(${cx} ${cy}) scale(${escX} ${escY}) translate(${-cx} ${-cy})`}
    >
      <rect
        x={x + 2}
        y={y + 3}
        width={ancho}
        height={alto}
        rx={6}
        fill="#000000"
        opacity={0.22}
        pointerEvents="none"
      />
      <rect
        x={x}
        y={y}
        width={ancho}
        height={alto}
        rx={6}
        fill="#ffffff"
        stroke="#0f172a"
        strokeWidth={1.5}
        pointerEvents="none"
      />
      <text
        x={x + ancho / 2}
        y={y + 14}
        textAnchor="middle"
        fontSize={10}
        fontWeight={800}
        fill="#0f172a"
        pointerEvents="none"
      >
        {titulo}
      </text>
      <g transform={`translate(${x}, ${y + 20})`}>{children}</g>
    </g>
  );
}

// ============================================================
// BOTÓN SVG
// ============================================================

interface BotonProps {
  x: number;
  y: number;
  w: number;
  h: number;
  texto: string;
  color: string;
  colorTexto?: string;
  fontSize?: number;
  onClick: () => void;
}

function BotonSvg({
  x,
  y,
  w,
  h,
  texto,
  color,
  colorTexto = "#ffffff",
  fontSize = 10,
  onClick,
}: BotonProps) {
  const label = texto.length > 16 ? texto.slice(0, 15) + "…" : texto;
  return (
    <g
      style={{ cursor: "pointer", pointerEvents: "auto" }}
      onPointerDown={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <rect x={x} y={y} width={w} height={h} rx={4} fill={color} />
      <text
        x={x + w / 2}
        y={y + h / 2 + fontSize * 0.35}
        textAnchor="middle"
        fontSize={fontSize}
        fontWeight={700}
        fill={colorTexto}
        pointerEvents="none"
      >
        {label}
      </text>
    </g>
  );
}

// ============================================================
// POPUP SAQUE (calidad)
// ============================================================

interface PopupSaqueProps {
  pos: PopupPos;
  onConfirmar: (v: ValorSaque) => void;
  onCancelar: () => void;
}

export function PopupSaque({ pos, onConfirmar, onCancelar }: PopupSaqueProps) {
  const btnW = 34;
  const gap = 4;
  const pad = 8;
  const ancho =
    ORDEN_SAQUE.length * btnW + (ORDEN_SAQUE.length - 1) * gap + pad * 2;
  const alto = 70;

  return (
    <PopupWrapper pos={pos} ancho={ancho} alto={alto} titulo="SAQUE — Calidad">
      <g>
        {ORDEN_SAQUE.map((v, i) => (
          <BotonSvg
            key={v}
            x={pad + i * (btnW + gap)}
            y={0}
            w={btnW}
            h={24}
            texto={ETIQ_SAQUE[v]}
            color={COL_SAQUE[v]}
            fontSize={10}
            onClick={() => onConfirmar(v)}
          />
        ))}
        <BotonSvg
          x={pad}
          y={32}
          w={ancho - pad * 2}
          h={14}
          texto="Cancelar (Esc)"
          color="#e2e8f0"
          colorTexto="#475569"
          fontSize={9}
          onClick={onCancelar}
        />
      </g>
    </PopupWrapper>
  );
}

// ============================================================
// POPUP TIPO DE SAQUE (solo P — Potencia)
// ============================================================

interface PopupTipoSaqueProps {
  pos: PopupPos;
  onConfirmar: (v: ValorTipoSaque) => void;
  onCancelar: () => void;
}

export function PopupTipoSaque({
  pos,
  onConfirmar,
  onCancelar,
}: PopupTipoSaqueProps) {
  const pad = 8;
  const ancho = 180;
  const alto = 82;

  return (
    <PopupWrapper pos={pos} ancho={ancho} alto={alto} titulo="SAQUE — Tipo">
      <g>
        <BotonSvg
          x={pad}
          y={0}
          w={ancho - pad * 2}
          h={28}
          texto="P — Potencia"
          color="#ea580c"
          fontSize={12}
          onClick={() => onConfirmar("potencia")}
        />

        <BotonSvg
          x={pad}
          y={36}
          w={ancho - pad * 2}
          h={16}
          texto="Flotado (default, Esc)"
          color="#f1f5f9"
          colorTexto="#475569"
          fontSize={9}
          onClick={onCancelar}
        />
      </g>
    </PopupWrapper>
  );
}

// ============================================================
// POPUP RECEPCIÓN — sistema nuevo (5 botones)
// ============================================================

interface PopupRecepcionProps {
  pos: PopupPos;
  onConfirmar: (v: ValorRecepcion) => void;
  onCancelar: () => void;
}

export function PopupRecepcion({
  pos,
  onConfirmar,
  onCancelar,
}: PopupRecepcionProps) {
  const btnW = 40;
  const gap = 4;
  const pad = 8;
  const ancho =
    ORDEN_RECEPCION.length * btnW +
    (ORDEN_RECEPCION.length - 1) * gap +
    pad * 2;
  const alto = 70;

  return (
    <PopupWrapper
      pos={pos}
      ancho={ancho}
      alto={alto}
      titulo="RECEPCIÓN — Calidad"
    >
      <g>
        {ORDEN_RECEPCION.map((v, i) => (
          <BotonSvg
            key={v}
            x={pad + i * (btnW + gap)}
            y={0}
            w={btnW}
            h={24}
            texto={ETIQ_RECEPCION[v]}
            color={COL_RECEPCION[v]}
            fontSize={11}
            onClick={() => onConfirmar(v)}
          />
        ))}
        <BotonSvg
          x={pad}
          y={32}
          w={ancho - pad * 2}
          h={14}
          texto="Cancelar (Esc)"
          color="#e2e8f0"
          colorTexto="#475569"
          fontSize={9}
          onClick={onCancelar}
        />
      </g>
    </PopupWrapper>
  );
}

// ============================================================
// POPUP ARMADO
// ============================================================

interface PopupArmadoProps {
  pos: PopupPos;
  onConfirmar: (v: ValorArmado) => void;
  onCancelar: () => void;
}

export function PopupArmado({ pos, onConfirmar, onCancelar }: PopupArmadoProps) {
  const botones: ValorArmado[] = [1, 2, 3, 4, 5, 6, "R"];
  const btnW = 26;
  const gap = 4;
  const pad = 8;
  const ancho = botones.length * btnW + (botones.length - 1) * gap + pad * 2;
  const alto = 70;

  return (
    <PopupWrapper
      pos={pos}
      ancho={ancho}
      alto={alto}
      titulo="ARMADO — Calidad"
    >
      <g>
        {botones.map((v, i) => (
          <BotonSvg
            key={String(v)}
            x={pad + i * (btnW + gap)}
            y={0}
            w={btnW}
            h={24}
            texto={ETIQ_ARMADO[v]}
            color={COL_ARMADO[v]}
            fontSize={12}
            onClick={() => onConfirmar(v)}
          />
        ))}
        <BotonSvg
          x={pad}
          y={32}
          w={ancho - pad * 2}
          h={14}
          texto="Cancelar (Esc)"
          color="#e2e8f0"
          colorTexto="#475569"
          fontSize={9}
          onClick={onCancelar}
        />
      </g>
    </PopupWrapper>
  );
}

// ============================================================
// POPUP VELOCIDAD
// ============================================================

interface PopupVelocidadProps {
  pos: PopupPos;
  onConfirmar: (v: ValorVelocidad) => void;
  onCancelar: () => void;
}

export function PopupVelocidad({
  pos,
  onConfirmar,
  onCancelar,
}: PopupVelocidadProps) {
  const pad = 8;
  const ancho = 260;
  const alto = 96;
  const btnW = (ancho - pad * 2 - 4 * 4) / 5;

  return (
    <PopupWrapper
      pos={pos}
      ancho={ancho}
      alto={alto}
      titulo="ARMADO — Velocidad (opcional)"
    >
      <g>
        {ORDEN_VELOCIDAD.map((v, i) => (
          <g key={String(v)}>
            <BotonSvg
              x={pad + i * (btnW + 4)}
              y={0}
              w={btnW}
              h={28}
              texto={ETIQ_VELOCIDAD[v]}
              color={COL_VELOCIDAD[v]}
              fontSize={13}
              onClick={() => onConfirmar(v)}
            />
            <text
              x={pad + i * (btnW + 4) + btnW / 2}
              y={42}
              textAnchor="middle"
              fontSize={7}
              fontWeight={600}
              fill="#64748b"
              pointerEvents="none"
            >
              {DESC_VELOCIDAD[v]}
            </text>
          </g>
        ))}

        <BotonSvg
          x={pad}
          y={54}
          w={ancho - pad * 2}
          h={16}
          texto="Saltar (Esc)"
          color="#e2e8f0"
          colorTexto="#475569"
          fontSize={9}
          onClick={onCancelar}
        />
      </g>
    </PopupWrapper>
  );
}

// ============================================================
// POPUP DEFENSA
// ============================================================

interface PopupDefensaProps {
  pos: PopupPos;
  onConfirmar: (
    subtipo: TipoDefensa | null,
    jugadorId: string | null,
    x2: boolean
  ) => void;
  onX2Change?: (x2: boolean) => void;
  onCancelar: () => void;
}

export function PopupDefensa({
  pos,
  onConfirmar,
  onX2Change,
  onCancelar,
}: PopupDefensaProps) {
  const [x2, setX2] = useState(false);
  const tipos: TipoDefensa[] = ["toque", "gran-defensa", "libre"];
  const pad = 8;
  const ancho = 260;
  const alto = 96;
  const btnTipoW = (ancho - pad * 2 - 4 * 2) / 3;

  const toggleX2 = () => {
    const nuevo = !x2;
    setX2(nuevo);
    onX2Change?.(nuevo);
  };

  return (
    <PopupWrapper
      pos={pos}
      ancho={ancho}
      alto={alto}
      titulo="DEFENSA — Tipo (opcional)"
    >
      <g>
        {tipos.map((t, i) => (
          <BotonSvg
            key={t}
            x={pad + i * (btnTipoW + 4)}
            y={0}
            w={btnTipoW}
            h={26}
            texto={ETIQ_DEFENSA[t]}
            color={COL_DEFENSA[t]}
            fontSize={10}
            onClick={() => onConfirmar(t, null, x2)}
          />
        ))}

        <g
          style={{ cursor: "pointer", pointerEvents: "auto" }}
          onPointerDown={(e) => {
            e.stopPropagation();
            toggleX2();
          }}
        >
          <rect
            x={pad}
            y={32}
            width={ancho - pad * 2}
            height={24}
            rx={4}
            fill={x2 ? "#7c3aed" : "#f1f5f9"}
            stroke={x2 ? "#5b21b6" : "#cbd5e1"}
            strokeWidth={1.5}
          />
          <text
            x={ancho / 2}
            y={32 + 16}
            textAnchor="middle"
            fontSize={11}
            fontWeight={800}
            fill={x2 ? "#ffffff" : "#475569"}
            pointerEvents="none"
          >
            {x2
              ? "✓ x2 — la próxima también es defensa"
              : "x2 (dos defensas seguidas)"}
          </text>
        </g>

        <BotonSvg
          x={pad}
          y={62}
          w={ancho - pad * 2}
          h={16}
          texto="Saltar (Esc)"
          color="#e2e8f0"
          colorTexto="#475569"
          fontSize={9}
          onClick={() => onConfirmar(null, null, x2)}
        />
      </g>
    </PopupWrapper>
  );
}

// ============================================================
// POPUP LIBRE
// ============================================================

interface PopupLibreProps {
  pos: PopupPos;
  jugadores: JugadorEnCancha[];
  onConfirmar: (jugadorId: string | null) => void;
  onCancelar: () => void;
}

export function PopupLibre({
  pos,
  jugadores,
  onConfirmar,
  onCancelar,
}: PopupLibreProps) {
  const pad = 8;
  const ancho = 220;
  const maxJugadores = Math.min(jugadores.length, 6);
  const filasJugadores = Math.ceil(maxJugadores / 2);
  const alto = 20 + 12 + filasJugadores * 18 + 6 + 14 + 4 + 14 + 8;

  return (
    <PopupWrapper
      pos={pos}
      ancho={ancho}
      alto={alto}
      titulo="LIBRE — ¿Quién la pasó?"
    >
      <g>
        <g transform="translate(0, 0)">
          {jugadores.slice(0, maxJugadores).map((j, i) => {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const wCol = (ancho - pad * 2 - 4) / 2;
            return (
              <BotonSvg
                key={j.id}
                x={pad + col * (wCol + 4)}
                y={row * 18}
                w={wCol}
                h={16}
                texto={j.nombre}
                color="#fef3c7"
                colorTexto="#78350f"
                fontSize={9}
                onClick={() => onConfirmar(j.id)}
              />
            );
          })}
        </g>

        <BotonSvg
          x={pad}
          y={filasJugadores * 18 + 6}
          w={ancho - pad * 2}
          h={14}
          texto="Sin asignar"
          color="#f1f5f9"
          colorTexto="#475569"
          fontSize={9}
          onClick={() => onConfirmar(null)}
        />

        <BotonSvg
          x={pad}
          y={filasJugadores * 18 + 24}
          w={ancho - pad * 2}
          h={14}
          texto="Cancelar (Esc)"
          color="#e2e8f0"
          colorTexto="#475569"
          fontSize={9}
          onClick={onCancelar}
        />
      </g>
    </PopupWrapper>
  );
}

// ============================================================
// POPUP JUGADOR
// ============================================================

interface PopupJugadorProps {
  pos: PopupPos;
  jugadores: JugadorEnCancha[];
  onConfirmar: (jugadorId: string | null) => void;
  onCancelar: () => void;
}

export function PopupJugador({
  pos,
  jugadores,
  onConfirmar,
  onCancelar,
}: PopupJugadorProps) {
  const pad = 8;
  const ancho = 240;
  const maxJugadores = Math.min(jugadores.length, 6);
  const filasJugadores = Math.ceil(maxJugadores / 2);
  const alto = 20 + 12 + filasJugadores * 22 + 6 + 14 + 4 + 14 + 8;

  return (
    <PopupWrapper
      pos={pos}
      ancho={ancho}
      alto={alto}
      titulo="¿QUIÉN HIZO LA ACCIÓN?"
    >
      <g>
        <g transform="translate(0, 0)">
          {jugadores.slice(0, maxJugadores).map((j, i) => {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const wCol = (ancho - pad * 2 - 4) / 2;
            const c = colorDeRol(j.rol);
            const x = pad + col * (wCol + 4);
            const y = row * 22;

            return (
              <g
                key={j.id}
                style={{ cursor: "pointer", pointerEvents: "auto" }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onConfirmar(j.id);
                }}
              >
                <rect
                  x={x}
                  y={y}
                  width={wCol}
                  height={20}
                  rx={4}
                  fill={c.bg}
                  stroke={c.borde}
                  strokeWidth={1.5}
                />
                <text
                  x={x + 4}
                  y={y + 13}
                  fontSize={9}
                  fontWeight={800}
                  fill={c.texto}
                  pointerEvents="none"
                >
                  {j.rol ?? "?"}
                </text>
                <text
                  x={x + 20}
                  y={y + 13}
                  fontSize={9}
                  fontWeight={600}
                  fill={c.texto}
                  pointerEvents="none"
                >
                  {textoCortoNombre(j.nombre)}
                </text>
              </g>
            );
          })}
        </g>

        <BotonSvg
          x={pad}
          y={filasJugadores * 22 + 6}
          w={ancho - pad * 2}
          h={14}
          texto="Sin asignar"
          color="#f1f5f9"
          colorTexto="#475569"
          fontSize={9}
          onClick={() => onConfirmar(null)}
        />

        <BotonSvg
          x={pad}
          y={filasJugadores * 22 + 24}
          w={ancho - pad * 2}
          h={14}
          texto="Cancelar (Esc)"
          color="#e2e8f0"
          colorTexto="#475569"
          fontSize={9}
          onClick={onCancelar}
        />
      </g>
    </PopupWrapper>
  );
}

// ============================================================
// POPUP ROCE DE RED
// ============================================================

interface PopupRoceRedProps {
  pos: PopupPos;
  jugadores: JugadorEnCancha[];
  onConfirmar: (resultado: ResultadoRoceRed, jugadorId: string | null) => void;
  onCancelar: () => void;
}

export function PopupRoceRed({
  pos,
  jugadores,
  onConfirmar,
  onCancelar,
}: PopupRoceRedProps) {
  const pad = 8;
  const ancho = 260;
  const altoOpcion = 20;
  const gap = 4;

  const maxJugadores = Math.min(jugadores.length, 6);
  const filasJugadores = Math.ceil(maxJugadores / 2);

  const altoTotalOpciones =
    OPCIONES_ROCE_RED.length * altoOpcion +
    (OPCIONES_ROCE_RED.length - 1) * gap;

  const alto =
    20 + altoTotalOpciones + 8 + 12 + filasJugadores * 18 + 6 + 14 + 8;

  return (
    <PopupWrapper
      pos={pos}
      ancho={ancho}
      alto={alto}
      titulo="ROCE DE RED / INVASIÓN"
    >
      <g>
        {OPCIONES_ROCE_RED.map((o, i) => (
          <BotonSvg
            key={o.id}
            x={pad}
            y={i * (altoOpcion + gap)}
            w={ancho - pad * 2}
            h={altoOpcion}
            texto={o.label}
            color={o.color}
            fontSize={10}
            onClick={() => onConfirmar(o.id, null)}
          />
        ))}

        <text
          x={pad}
          y={altoTotalOpciones + 18}
          fontSize={9}
          fontWeight={600}
          fill="#64748b"
          pointerEvents="none"
        >
          ¿Quién? (opcional)
        </text>

        <g transform={`translate(0, ${altoTotalOpciones + 26})`}>
          {jugadores.slice(0, maxJugadores).map((j, i) => {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const wCol = (ancho - pad * 2 - 4) / 2;
            return (
              <BotonSvg
                key={j.id}
                x={pad + col * (wCol + 4)}
                y={row * 18}
                w={wCol}
                h={16}
                texto={j.nombre}
                color="#f1f5f9"
                colorTexto="#334155"
                fontSize={9}
                onClick={() => onConfirmar("ofensivo-propio", j.id)}
              />
            );
          })}
        </g>

        <BotonSvg
          x={pad}
          y={altoTotalOpciones + 26 + filasJugadores * 18 + 6}
          w={ancho - pad * 2}
          h={14}
          texto="Cancelar (Esc)"
          color="#e2e8f0"
          colorTexto="#475569"
          fontSize={9}
          onClick={onCancelar}
        />
      </g>
    </PopupWrapper>
  );
}

// ============================================================
// POPUP ATAQUE — TOQUE / LIBRE
// ============================================================

interface PopupAtaqueToqueLibreProps {
  pos: PopupPos;
  onConfirmar: (v: VarianteAtaquePopup) => void;
  onCancelar: () => void;
}

export function PopupAtaqueToqueLibre({
  pos,
  onConfirmar,
  onCancelar,
}: PopupAtaqueToqueLibreProps) {
  const pad = 8;
  const ancho = 240;
  const alto = 82;
  const btnW = (ancho - pad * 2 - 4) / 2;

  return (
    <PopupWrapper
      pos={pos}
      ancho={ancho}
      alto={alto}
      titulo="ATAQUE — Toque / Libre (opcional)"
    >
      <g>
        {OPCIONES_ATAQUE_TOQUE_LIBRE.map((o, i) => (
          <BotonSvg
            key={o.id}
            x={pad + i * (btnW + 4)}
            y={0}
            w={btnW}
            h={24}
            texto={o.label}
            color={o.color}
            fontSize={11}
            onClick={() => onConfirmar(o.id)}
          />
        ))}

        <BotonSvg
          x={pad}
          y={32}
          w={ancho - pad * 2}
          h={16}
          texto="Remate (default, Esc)"
          color="#f1f5f9"
          colorTexto="#475569"
          fontSize={9}
          onClick={onCancelar}
        />
      </g>
    </PopupWrapper>
  );
}

// ============================================================
// POPUP REMATE DE SEGUNDA
// ============================================================

interface PopupRemateSegundaProps {
  pos: PopupPos;
  onConfirmar: (v: VarianteRemateSegunda) => void;
  onCancelar: () => void;
}

export function PopupRemateSegunda({
  pos,
  onConfirmar,
  onCancelar,
}: PopupRemateSegundaProps) {
  const pad = 8;
  const ancho = 200;
  const alto = 82;

  return (
    <PopupWrapper
      pos={pos}
      ancho={ancho}
      alto={alto}
      titulo="REMATE DE SEGUNDA"
    >
      <g>
        <BotonSvg
          x={pad}
          y={0}
          w={ancho - pad * 2}
          h={26}
          texto="R — Remate de segunda"
          color="#dc2626"
          fontSize={11}
          onClick={() => onConfirmar("remate-segunda")}
        />

        <BotonSvg
          x={pad}
          y={32}
          w={ancho - pad * 2}
          h={16}
          texto="No, es libre (Esc)"
          color="#f1f5f9"
          colorTexto="#475569"
          fontSize={9}
          onClick={onCancelar}
        />
      </g>
    </PopupWrapper>
  );
}

// ============================================================
// POPUP BLOQUEO PROPIO
// ============================================================

interface PopupBloqueoProps {
  pos: PopupPos;
  jugadores: JugadorZona[];
  onConfirmar: (jugadorId: string | null) => void;
  onCancelar: () => void;
}

export function PopupBloqueo({
  pos,
  jugadores,
  onConfirmar,
  onCancelar,
}: PopupBloqueoProps) {
  const pad = 6;
  const btnW = 54;
  const gap = 4;
  const ancho =
    jugadores.length * btnW +
    Math.max(0, jugadores.length - 1) * gap +
    pad * 2;
  const alto = 56;

  return (
    <PopupWrapper
      pos={pos}
      ancho={ancho}
      alto={alto}
      titulo="¿QUIÉN BLOQUEÓ?"
    >
      <g>
        {jugadores.map((j, i) => (
          <BotonSvg
            key={j.zona}
            x={pad + i * (btnW + gap)}
            y={0}
            w={btnW}
            h={22}
            texto={`Z${j.zona} ${j.nombre}`}
            color={j.jugadorId ? "#ea580c" : "#cbd5e1"}
            colorTexto={j.jugadorId ? "#ffffff" : "#475569"}
            fontSize={8}
            onClick={() => onConfirmar(j.jugadorId)}
          />
        ))}
        <BotonSvg
          x={pad}
          y={28}
          w={ancho - pad * 2}
          h={12}
          texto="Cancelar (Esc)"
          color="#e2e8f0"
          colorTexto="#475569"
          fontSize={8}
          onClick={onCancelar}
        />
      </g>
    </PopupWrapper>
  );
}

// ============================================================
// EXPORTS
// ============================================================

export type { PopupPos as PopupPosicion };