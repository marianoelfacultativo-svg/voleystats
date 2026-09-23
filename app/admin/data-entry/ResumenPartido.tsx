"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  calcularEstadisticasEquipo,
  top3,
  type AccionDB,
  type EstadisticasJugador,
} from "@/lib/estadisticas";

interface Props {
  partidoId: string;
  jugadoresIds: string[];
  nombresJugadores: Record<string, string>;
}

const FUNDAMENTOS = ["saque", "recepcion", "ataque", "bloqueo", "defensa"];
const NOMBRES: Record<string, string> = {
  saque: "Saque",
  recepcion: "Recepción",
  ataque: "Ataque",
  bloqueo: "Bloqueo",
  defensa: "Defensa",
};

export default function ResumenPartido({
  partidoId,
  jugadoresIds,
  nombresJugadores,
}: Props) {
  const [acciones, setAcciones] = useState<AccionDB[]>([]);
  const [armadores, setArmadores] = useState<Set<string>>(new Set());
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!partidoId) return;
    setCargando(true);
    Promise.all([
      supabase
        .from("acciones")
        .select(
          "jugador_id, partido_id, set_numero, fundamento, valoracion, cantidad"
        )
        .eq("partido_id", partidoId),
      jugadoresIds.length > 0
        ? supabase
            .from("jugadores")
            .select("id, rol")
            .in("id", jugadoresIds)
        : Promise.resolve({ data: [] }),
    ]).then(([accRes, jugRes]) => {
      setCargando(false);
      if (accRes.data) setAcciones(accRes.data as AccionDB[]);
      if (jugRes.data) {
        setArmadores(
          new Set(
            (jugRes.data as { id: string; rol: string }[])
              .filter((j) => j.rol === "armador")
              .map((j) => j.id)
          )
        );
      }
    });
  }, [partidoId, jugadoresIds]);

  if (cargando) {
    return <p className="text-slate-500 text-center py-8">Calculando...</p>;
  }

  if (acciones.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-4xl mb-3">📊</p>
        <p className="text-slate-600 font-medium">
          Todavía no hay datos guardados para este partido
        </p>
        <p className="text-slate-500 text-sm mt-1">
          Cargá datos y apretá "Guardar Datos"
        </p>
      </div>
    );
  }

  const { porJugador, totales } = calcularEstadisticasEquipo(
    jugadoresIds,
    acciones,
    armadores
  );

  const nombreDe = (id: string) => nombresJugadores[id] ?? "(sin nombre)";

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-slate-800 mb-3">
          Totales del equipo
        </h3>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <p className="text-xs text-slate-500 uppercase">Acciones</p>
            <p className="text-2xl font-bold text-slate-800">
              {totales.totalAcciones}
            </p>
          </div>
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-xs text-green-700 uppercase">Puntos</p>
            <p className="text-2xl font-bold text-green-800">
              {totales.totalPuntos}
            </p>
          </div>
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-xs text-red-700 uppercase">Errores</p>
            <p className="text-2xl font-bold text-red-800">
              {totales.totalErrores}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2 px-3">Fundamento</th>
                <th className="py-2 px-3 text-right">Total</th>
                <th className="py-2 px-3 text-right">Pos</th>
                <th className="py-2 px-3 text-right">Neg</th>
                <th className="py-2 px-3 text-right">Puntos</th>
                <th className="py-2 px-3 text-right">Errores</th>
                <th className="py-2 px-3 text-right">Saldo</th>
                <th className="py-2 px-3 text-right">Efect.</th>
              </tr>
            </thead>
            <tbody>
              {FUNDAMENTOS.map((f) => {
                const e = totales.porFundamento[f];
                if (!e || e.total === 0) return null;
                return (
                  <tr key={f} className="border-b border-slate-100">
                    <td className="py-2 px-3 font-medium text-slate-700">
                      {NOMBRES[f]}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-600">
                      {e.total}
                    </td>
                    <td className="py-2 px-3 text-right text-green-700">
                      {e.positivos}
                    </td>
                    <td className="py-2 px-3 text-right text-red-700">
                      {e.negativos}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-600">
                      {e.puntos}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-600">
                      {e.errores}
                    </td>
                    <td
                      className={`py-2 px-3 text-right font-semibold ${
                        e.saldo > 0
                          ? "text-green-700"
                          : e.saldo < 0
                          ? "text-red-700"
                          : "text-slate-600"
                      }`}
                    >
                      {e.saldo > 0 ? "+" : ""}
                      {e.saldo}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-600">
                      {e.efectividad.toFixed(0)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-slate-800 mb-3">
          🏆 Rankings del plantel
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <RankingCard
            titulo="Más puntos"
            items={top3(porJugador, (e) => e.totalPuntos)}
            nombreDe={nombreDe}
            color="green"
          />
          <RankingCard
            titulo="Más acciones positivas"
            items={top3(porJugador, (e) => e.totalPositivos)}
            nombreDe={nombreDe}
            color="blue"
          />
          <RankingCard
            titulo="Mejor saldo"
            items={top3(porJugador, (e) => e.saldoTotal)}
            nombreDe={nombreDe}
            color="violet"
          />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-slate-800 mb-3">
          Estadísticas por jugador
        </h3>
        <div className="space-y-3">
          {jugadoresIds.map((id) => {
            const est = porJugador[id];
            if (!est || est.totalAcciones === 0) return null;
            return (
              <JugadorCard
                key={id}
                nombre={nombreDe(id)}
                est={est}
                esArmador={armadores.has(id)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RankingCard({
  titulo,
  items,
  nombreDe,
  color,
}: {
  titulo: string;
  items: { jugador_id: string; valor: number }[];
  nombreDe: (id: string) => string;
  color: "green" | "blue" | "violet";
}) {
  const colores = {
    green: "bg-green-50 border-green-200",
    blue: "bg-blue-50 border-blue-200",
    violet: "bg-violet-50 border-violet-200",
  };
  return (
    <div className={`p-4 rounded-lg border ${colores[color]}`}>
      <p className="text-sm font-medium text-slate-700 mb-2">{titulo}</p>
      {items.length === 0 ? (
        <p className="text-xs text-slate-500">Sin datos</p>
      ) : (
        <ol className="space-y-1">
          {items.map((it, i) => (
            <li key={it.jugador_id} className="text-sm text-slate-800">
              <span className="font-bold text-slate-500 mr-2">{i + 1}.</span>
              {nombreDe(it.jugador_id)}
              <span className="text-slate-500 ml-2">({it.valor})</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function JugadorCard({
  nombre,
  est,
  esArmador,
}: {
  nombre: string;
  est: EstadisticasJugador;
  esArmador: boolean;
}) {
  const fundamentos = esArmador
    ? ["saque", "bloqueo", "defensa"]
    : ["saque", "recepcion", "ataque", "bloqueo", "defensa"];

  const NOMBRES_F: Record<string, string> = {
    saque: "Saque",
    recepcion: "Recepción",
    ataque: "Ataque",
    bloqueo: "Bloqueo",
    defensa: "Defensa",
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
      <div className="flex justify-between items-start mb-3">
        <p className="font-semibold text-slate-800">
          👤 {nombre}
          {esArmador && (
            <span className="ml-2 text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
              Armador
            </span>
          )}
        </p>
        <div className="text-right text-sm">
          <p className="text-slate-500">
            Acciones:{" "}
            <span className="font-semibold text-slate-700">
              {est.totalAcciones}
            </span>
          </p>
          <p className="text-slate-500">
            Saldo:{" "}
            <span
              className={`font-semibold ${
                est.saldoTotal > 0
                  ? "text-green-700"
                  : est.saldoTotal < 0
                  ? "text-red-700"
                  : "text-slate-700"
              }`}
            >
              {est.saldoTotal > 0 ? "+" : ""}
              {est.saldoTotal}
            </span>
          </p>
        </div>
      </div>

      <div
        className={`grid gap-2 text-xs ${
          esArmador ? "grid-cols-3" : "grid-cols-5"
        }`}
      >
        {fundamentos.map((f) => {
          const e = est.porFundamento[f];
          if (!e || e.total === 0) return null;
          return (
            <div
              key={f}
              className="p-2 bg-white border border-slate-200 rounded"
            >
              <p className="text-slate-500">{NOMBRES_F[f]}</p>
              <p className="font-semibold text-slate-800">
                {e.saldo > 0 ? "+" : ""}
                {e.saldo}
              </p>
              <p className="text-slate-400 text-[10px]">{e.total} acc.</p>
            </div>
          );
        })}
      </div>

      {esArmador && est.armador && (
        <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-3 gap-2 text-xs">
          <div className="p-2 bg-white border border-slate-200 rounded">
            <p className="text-slate-500">Prom. armados</p>
            <p className="font-semibold text-slate-800">
              {est.armador.promedioArmadosGlobal.toFixed(1)}
            </p>
          </div>
          <div className="p-2 bg-white border border-slate-200 rounded">
            <p className="text-slate-500">Toques punto</p>
            <p className="font-semibold text-green-700">
              {est.armador.toquesPunto}
            </p>
          </div>
          <div className="p-2 bg-white border border-slate-200 rounded">
            <p className="text-slate-500">Toques error</p>
            <p className="font-semibold text-red-700">
              {est.armador.toquesError}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}