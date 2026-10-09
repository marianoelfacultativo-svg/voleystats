"use client";

import React from "react";
import { CANCHA_V2_DIMS } from "./CanchaV2";

// ============================================================
// TIPOS
// ============================================================

export type ValorArmado = 1 | 2 | 3 | 4 | 5 | 6 | "T";

export type ValorSaque =
  | "ace"
  | "positivo_mas"
  | "positivo"
  | "neutro"
  | "negativo";

export type TipoDefensa = "toque" | "gran-defensa" | "libre";

export type ResultadoToqueRed =
  | "ofensivo-propio"
  | "invasion-zaguero"
  | "invasion-delantero"
  | "toque-red-rival";

export interface JugadorEnCancha {
  id: string;
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
  T: "#334155",
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

const OPCIONES_TOQUE_RED: {
  id: ResultadoToqueRed;
  label: string;
  color: string;
}[] = [
  { id: "ofensivo-propio", label: "Ofensivo propio", color: "#dc2626" },
  { id: "invasion-zaguero", label: "Invasión zaguero", color: "#ea580c" },
  { id: "invasion-delantero", label: "Invasión delantero", color: "#f59e0b" },
  { id: "toque-red-rival", label: "Toque red rival", color: "#0284c7" },
];

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

  let x = pos.x - ancho / 2;
  if (x < 2) x = 2;
  if (x + ancho > W - 2) x = W - ancho - 2;

  let y = pos.y - alto - 6;
  if (y < 2) y = pos.y + 6;
  if (y + alto > H - 2) y = H - alto - 2;

  return (
    <g style={{ pointerEvents: "auto" }}>
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
// POPUP SAQUE
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
// POPUP ARMADO
// ============================================================

interface PopupArmadoProps {
  pos: PopupPos;
  onConfirmar: (v: ValorArmado) => void;
  onCancelar: () => void;
}

export function PopupArmado({ pos, onConfirmar, onCancelar }: PopupArmadoProps) {
  const botones: ValorArmado[] = [1, 2, 3, 4, 5, 6, "T"];
  const btnW = 24;
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
            texto={String(v)}
            color={COL_ARMADO[v]}
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
// POPUP DEFENSA
// ============================================================

interface PopupDefensaProps {
  pos: PopupPos;
  jugadores: JugadorEnCancha[];
  onConfirmar: (subtipo: TipoDefensa, jugadorId: string | null) => void;
  onCancelar: () => void;
}

export function PopupDefensa({
  pos,
  jugadores,
  onConfirmar,
  onCancelar,
}: PopupDefensaProps) {
  const tipos: TipoDefensa[] = ["toque", "gran-defensa", "libre"];
  const pad = 8;
  const ancho = 260;
  const btnW = (ancho - pad * 2 - 4 * 2) / 3;

  const maxJugadores = Math.min(jugadores.length, 6);
  const filasJugadores = Math.ceil(maxJugadores / 2);
  const alto = 20 + 20 + 8 + 12 + filasJugadores * 18 + 6 + 14 + 8;

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
            x={pad + i * (btnW + 4)}
            y={0}
            w={btnW}
            h={20}
            texto={ETIQ_DEFENSA[t]}
            color={COL_DEFENSA[t]}
            fontSize={9}
            onClick={() => onConfirmar(t, null)}
          />
        ))}

        <text
          x={pad}
          y={36}
          fontSize={9}
          fontWeight={600}
          fill="#64748b"
          pointerEvents="none"
        >
          ¿Quién la hizo? (opcional)
        </text>

        <g transform="translate(0, 44)">
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
                onClick={() => onConfirmar("toque", j.id)}
              />
            );
          })}
        </g>

        <BotonSvg
          x={pad}
          y={44 + filasJugadores * 18}
          w={ancho - pad * 2}
          h={14}
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
// POPUP JUGADOR (solo lista)
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
  const ancho = 220;
  const maxJugadores = Math.min(jugadores.length, 6);
  const filasJugadores = Math.ceil(maxJugadores / 2);
  const alto = 20 + 12 + filasJugadores * 18 + 6 + 14 + 4 + 14 + 8;

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
            return (
              <BotonSvg
                key={j.id}
                x={pad + col * (wCol + 4)}
                y={row * 18}
                w={wCol}
                h={16}
                texto={j.nombre}
                color="#dbeafe"
                colorTexto="#1e3a8a"
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
// POPUP TOQUE DE RED / INVASIÓN
// ============================================================

interface PopupToqueRedProps {
  pos: PopupPos;
  jugadores: JugadorEnCancha[];
  onConfirmar: (resultado: ResultadoToqueRed, jugadorId: string | null) => void;
  onCancelar: () => void;
}

export function PopupToqueRed({
  pos,
  jugadores,
  onConfirmar,
  onCancelar,
}: PopupToqueRedProps) {
  const pad = 8;
  const ancho = 260;
  const altoOpcion = 20;
  const gap = 4;

  const maxJugadores = Math.min(jugadores.length, 6);
  const filasJugadores = Math.ceil(maxJugadores / 2);

  const altoTotalOpciones =
    OPCIONES_TOQUE_RED.length * altoOpcion +
    (OPCIONES_TOQUE_RED.length - 1) * gap;

  const alto =
    20 + altoTotalOpciones + 8 + 12 + filasJugadores * 18 + 6 + 14 + 8;

  return (
    <PopupWrapper
      pos={pos}
      ancho={ancho}
      alto={alto}
      titulo="TOQUE DE RED / INVASIÓN"
    >
      <g>
        {OPCIONES_TOQUE_RED.map((o, i) => (
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