"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { cargarAccionesCompatibles, type AccionDB } from "@/lib/db";
import {
  calcularEstadisticasEquipo,
  calcularPodios,
  rankingDeJugador,
  calcularPromedioPonderadoPorSet,
  calcularPromedioArmadosPonderadoPorSet,
  VALORES_SAQUE,
  VALORES_RECEPCION,
  VALORES_BLOQUEO,
  nivelDeValoracion,
  COLORES_NIVEL_CLASES,
  type EstadisticasJugador,
} from "@/lib/estadisticas";
import RadarJugador from "./RadarJugador";
import GraficoArmadosPorSet from "./GraficoArmadosPorSet";
import GraficoRecepcionPorSet from "./GraficoRecepcionPorSet";
import GraficoSaquePorSet from "./GraficoSaquePorSet";
import GraficoBloqueoPorSet from "./GraficoBloqueoPorSet";
import MapaCalorTendencia from "./MapaCalorTendencia";
import ImagenAmpliable from "./ImagenAmpliable";
import GraficoBarrasFundamento from "./GraficoBarrasFundamento";
import MapaCalorJugador from "./MapaCalorJugador";
import IconoVoley from "./IconoVoley";
import { descargarComoPDF } from "@/lib/exportarPDF";

interface Jugador {
  id: string;
  nombre: string;
  numero: number | null;
  imagen_url: string | null;
  rol: string;
}

interface Props {
  equipoId: string;
  nombreEquipo: string;
}

const NOMBRES_FUNDAMENTO: Record<string, string> = {
  saque: "Saque",
  recepcion: "Recepción",
  ataque: "Ataque",
  bloqueo: "Bloqueo",
  defensa: "Defensa",
  armados: "Armados",
  toque: "Toque",
};

const FUNDAMENTOS_BARRAS = [
  "saque",
  "recepcion",
  "ataque",
  "bloqueo",
  "defensa",
] as const;

const ORDEN_RANKINGS: {
  id: string;
  titulo: string;
}[] = [
  { id: "recepcion", titulo: "Recepción" },
  { id: "ataque", titulo: "Ataque" },
  { id: "bloqueo", titulo: "Bloqueo" },
  { id: "saque", titulo: "Saque" },
  { id: "defensa", titulo: "Defensa" },
  { id: "consistencia", titulo: "Consistencia" },
];

const COLORES_COMPARACION = ["#EF4444", "#8B5CF6", "#3B82F6"];

function colorPodio(puesto: number): string {
  if (puesto === 1) return "bg-yellow-400 text-yellow-900";
  if (puesto === 2) return "bg-slate-300 text-slate-800";
  return "bg-amber-700 text-amber-100";
}

function calcularBarrasPorFundamento(
  acciones: AccionDB[],
  jugadorId?: string
): Record<
  string,
  { positivas: number; neutras: number; negativas: number }
> {
  const out: Record<
    string,
    { positivas: number; neutras: number; negativas: number }
  > = {};
  for (const f of FUNDAMENTOS_BARRAS) {
    out[f] = { positivas: 0, neutras: 0, negativas: 0 };
  }

  for (const a of acciones) {
    if (jugadorId && a.jugador_id !== jugadorId) continue;
    const fund = a.fundamento;
    if (!out[fund]) continue;

    let cat: "positivas" | "neutras" | "negativas" = "neutras";
    const v = a.valoracion;

    if (fund === "saque") {
      if (v === "ace") cat = "positivas";
      else if (v === "negativo") cat = "negativas";
    } else if (fund === "ataque") {
      if (v === "punto") cat = "positivas";
      else if (v === "error") cat = "negativas";
    } else if (fund === "recepcion") {
      if (v === "positiva" || v === "2x_positiva") cat = "positivas";
      else if (
        v === "negativa" ||
        v === "2x_negativa" ||
        v === "3x_negativa" ||
        v === "ace_contra"
      )
        cat = "negativas";
    } else if (fund === "bloqueo") {
      if (v === "punto" || v === "positivo_mas" || v === "positivo")
        cat = "positivas";
      else if (v === "use_rival" || v === "red" || v === "filtrada")
        cat = "negativas";
    } else if (fund === "defensa") {
      if (
        v === "gran_def" ||
        v === "toque_positiva" ||
        v === "cobertura_positiva"
      )
        cat = "positivas";
      else if (
        v === "toque_negativa" ||
        v === "mala_libre" ||
        v === "error_def" ||
        v === "errores_graves" ||
        v === "cobertura_negativa"
      )
        cat = "negativas";
    }

    out[fund][cat] += a.cantidad;
  }

  return out;
}

export default function MiEquipo({ equipoId, nombreEquipo }: Props) {
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [acciones, setAcciones] = useState<AccionDB[]>([]);
  const [jugadorSeleccionado, setJugadorSeleccionado] = useState<string | null>(
    null
  );
  const [modo, setModo] = useState<"individual" | "comparar">("individual");
  const [comparados, setComparados] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);
  const [descargando, setDescargando] = useState(false);

  const refPDF = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!equipoId) return;
    setCargando(true);

    Promise.all([
      supabase
        .from("jugador_equipo")
        .select("jugador_id")
        .eq("equipo_id", equipoId)
        .eq("activo", true),
      supabase
        .from("partidos")
        .select("id, equipo_id, equipo_rival_id")
        .or(`equipo_id.eq.${equipoId},equipo_rival_id.eq.${equipoId}`),
    ]).then(async ([jeRes, partRes]) => {
      if (!jeRes.data || !partRes.data) {
        setCargando(false);
        return;
      }

      const idsJugadores = jeRes.data.map((x) => x.jugador_id);
      let jugadoresData: Jugador[] = [];

      if (idsJugadores.length > 0) {
        const { data: jugRes } = await supabase
          .from("jugadores")
          .select("*")
          .in("id", idsJugadores)
          .order("nombre");
        if (jugRes) jugadoresData = jugRes;
      }

      const idsPartidos = partRes.data.map((p) => p.id);
      if (idsPartidos.length === 0) {
        setJugadores(jugadoresData);
        setAcciones([]);
        setCargando(false);
        return;
      }

      const resultados = await Promise.all(
        idsPartidos.map((pid) => cargarAccionesCompatibles(pid, equipoId))
      );

      setJugadores(jugadoresData);
      setAcciones(resultados.flat());
      setCargando(false);
    });
  }, [equipoId]);

  if (cargando) {
    return <p className="text-slate-500 text-center py-12">Cargando...</p>;
  }

  const idsJugadores = jugadores.map((j) => j.id);
  const armadores = new Set(
    jugadores.filter((j) => j.rol === "armador").map((j) => j.id)
  );

  const { porJugador } = calcularEstadisticasEquipo(
    idsJugadores,
    acciones,
    armadores
  );

  const podios = calcularPodios(porJugador, acciones);

  const jugadorActual: EstadisticasJugador | null = jugadorSeleccionado
    ? porJugador[jugadorSeleccionado] ?? null
    : null;
  const datosJugador = jugadores.find((j) => j.id === jugadorSeleccionado);
  const esArmador = datosJugador?.rol === "armador";

  const textosRanking = jugadorSeleccionado
    ? rankingDeJugador(jugadorSeleccionado, porJugador, acciones)
    : {};

  const barrasJugadorActual = jugadorSeleccionado
    ? calcularBarrasPorFundamento(acciones, jugadorSeleccionado)
    : null;

  const handleToggleModo = (nuevo: "individual" | "comparar") => {
    setModo(nuevo);
    if (nuevo === "individual") {
      setComparados([]);
    }
  };

  const handleClickComparar = (jugadorId: string) => {
    const jugador = jugadores.find((j) => j.id === jugadorId);
    if (!jugador) return;

    const yaSeleccionado = comparados.includes(jugadorId);

    if (yaSeleccionado) {
      setComparados(comparados.filter((id) => id !== jugadorId));
      return;
    }

    if (comparados.length >= 3) return;

    if (comparados.length > 0) {
      const primerSel = jugadores.find((j) => j.id === comparados[0]);
      const ambosArmadores =
        primerSel?.rol === "armador" && jugador.rol === "armador";
      const ambosNormales =
        primerSel?.rol !== "armador" && jugador.rol !== "armador";
      if (!ambosArmadores && !ambosNormales) return;
    }

    setComparados([...comparados, jugadorId]);
  };

  const comparadosData = comparados
    .map((id, idx) => ({
      id,
      nombre: jugadores.find((j) => j.id === id)?.nombre ?? "?",
      color: COLORES_COMPARACION[idx] ?? "#94a3b8",
      jugador: porJugador[id],
    }))
    .filter((s) => s.jugador);

  const esComparacionArmador =
    comparadosData.length > 0 && armadores.has(comparadosData[0].id);

  const seriesRadar = comparadosData.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    color: s.color,
    jugador: s.jugador,
  }));

  const seriesSaque = comparadosData.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    color: s.color,
    promedios: calcularPromedioPonderadoPorSet(
      s.id,
      acciones,
      idsJugadores,
      "saque",
      VALORES_SAQUE
    ),
  }));

  const seriesRecepcion = comparadosData.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    color: s.color,
    promedios: calcularPromedioPonderadoPorSet(
      s.id,
      acciones,
      idsJugadores,
      "recepcion",
      VALORES_RECEPCION
    ),
  }));

  const seriesBloqueo = comparadosData.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    color: s.color,
    promedios: calcularPromedioPonderadoPorSet(
      s.id,
      acciones,
      idsJugadores,
      "bloqueo",
      VALORES_BLOQUEO
    ),
  }));

  const seriesArmados = comparadosData.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    color: s.color,
    promedios: calcularPromedioArmadosPonderadoPorSet(
      s.id,
      acciones,
      idsJugadores
    ),
  }));

  const handleDescargarPDF = async () => {
    if (modo === "individual" && !jugadorSeleccionado) {
      alert("Elegí un jugador antes de descargar el PDF.");
      return;
    }
    if (modo === "comparar" && comparadosData.length === 0) {
      alert("Elegí al menos un jugador para comparar antes de descargar.");
      return;
    }
    if (!refPDF.current) return;

    setDescargando(true);
    try {
      const nombre =
        modo === "individual" && datosJugador
          ? `jugador-${datosJugador.nombre}-${nombreEquipo}`
          : `comparacion-${nombreEquipo}`;
      const titulo =
        modo === "individual" && datosJugador
          ? `${datosJugador.nombre} · ${nombreEquipo}`
          : `Comparación · ${nombreEquipo}`;
      await descargarComoPDF(refPDF.current, nombre, titulo);
    } finally {
      setDescargando(false);
    }
  };

  if (jugadores.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 sm:p-12 text-center">
        <p className="text-4xl mb-3">👥</p>
        <p className="text-slate-600 font-medium">
          {nombreEquipo} todavía no tiene jugadores cargados
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <button
            onClick={() => handleToggleModo("individual")}
            className={`flex-1 sm:flex-none px-4 py-2 text-sm font-medium rounded-lg transition border ${
              modo === "individual"
                ? "bg-emerald-500 text-white border-emerald-500"
                : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
            }`}
          >
            👤 Ver jugador
          </button>
          <button
            onClick={() => handleToggleModo("comparar")}
            className={`flex-1 sm:flex-none px-4 py-2 text-sm font-medium rounded-lg transition border ${
              modo === "comparar"
                ? "bg-emerald-500 text-white border-emerald-500"
                : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
            }`}
          >
            ⚖️ Comparar ({comparados.length}/3)
          </button>
        </div>
        <button
          onClick={handleDescargarPDF}
          disabled={descargando}
          className="px-4 py-2 text-sm bg-fuchsia-500 hover:bg-fuchsia-600 text-white font-medium rounded-lg transition disabled:opacity-50 w-full sm:w-auto"
          data-pdf-ignorar
        >
          {descargando ? "Generando PDF..." : "📄 Descargar PDF"}
        </button>
      </div>

      <div
        ref={refPDF}
        className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4"
      >
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-3 sm:p-4 col-span-1">
          <h3 className="font-semibold text-slate-800 mb-3">
            {modo === "individual" ? "Plantel" : "Elegí hasta 3 jugadores"}
          </h3>
          {modo === "comparar" && (
            <p className="text-xs text-slate-500 mb-3">
              Armadores con armadores, jugadores de cancha con jugadores de
              cancha.
            </p>
          )}
          <div className="space-y-1">
            {jugadores.map((j) => {
              const est = porJugador[j.id];
              const accionesJ = est?.totalAcciones ?? 0;
              const colorIdx = comparados.indexOf(j.id);
              const seleccionadoIndividual =
                modo === "individual" && jugadorSeleccionado === j.id;

              let bloqueado = false;
              if (
                modo === "comparar" &&
                comparados.length > 0 &&
                colorIdx === -1
              ) {
                const primerSel = jugadores.find(
                  (x) => x.id === comparados[0]
                );
                const ambosArm =
                  primerSel?.rol === "armador" && j.rol === "armador";
                const ambosNorm =
                  primerSel?.rol !== "armador" && j.rol !== "armador";
                bloqueado = !ambosArm && !ambosNorm;
              }
              const puedeAgregarMas =
                modo === "comparar" &&
                comparados.length >= 3 &&
                colorIdx === -1;

              return (
                <button
                  key={j.id}
                  onClick={() =>
                    modo === "individual"
                      ? setJugadorSeleccionado(j.id)
                      : handleClickComparar(j.id)
                  }
                  disabled={bloqueado || puedeAgregarMas}
                  className={`w-full flex items-center gap-3 text-left px-3 py-2 rounded-lg transition text-sm ${
                    seleccionadoIndividual
                      ? "bg-emerald-500 text-white"
                      : colorIdx !== -1
                      ? "text-white"
                      : bloqueado || puedeAgregarMas
                      ? "bg-slate-50 text-slate-300 cursor-not-allowed opacity-50"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-700"
                  }`}
                  style={
                    colorIdx !== -1
                      ? { backgroundColor: COLORES_COMPARACION[colorIdx] }
                      : undefined
                  }
                >
                  <span className="relative">
                    <ImagenAmpliable
                      src={j.imagen_url}
                      alt={j.nombre}
                      inicial={j.nombre.charAt(0).toUpperCase()}
                      tamaño="sm"
                    />
                    {colorIdx !== -1 && (
                      <span
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center border-2 border-white"
                        style={{
                          backgroundColor: COLORES_COMPARACION[colorIdx],
                        }}
                      >
                        {colorIdx + 1}
                      </span>
                    )}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="font-medium block truncate">
                      {j.nombre}
                      {j.numero !== null && ` #${j.numero}`}
                    </span>
                    {j.rol === "armador" && (
                      <span
                        className={`block text-xs ${
                          seleccionadoIndividual || colorIdx !== -1
                            ? "text-white/90"
                            : "text-violet-600"
                        }`}
                      >
                        Armador
                      </span>
                    )}
                    <span
                      className={`block text-xs ${
                        seleccionadoIndividual || colorIdx !== -1
                          ? "text-white/80"
                          : "text-slate-400"
                      }`}
                    >
                      {accionesJ} acciones
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="col-span-1 lg:col-span-2">
          {modo === "individual" ? (
            !jugadorSeleccionado || !jugadorActual || !datosJugador ? (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 sm:p-12 text-center h-full flex items-center justify-center">
                <div>
                  <p className="text-4xl mb-3">👈</p>
                  <p className="text-slate-600 font-medium">
                    Elegí un jugador para ver su perfil
                  </p>
                </div>
              </div>
            ) : (
              <div className="card-terracota rounded-2xl border p-4 sm:p-6">
                <div className="flex items-center gap-3 sm:gap-4 mb-6 pb-6 border-b border-slate-300">
                  <ImagenAmpliable
                    src={datosJugador.imagen_url}
                    alt={datosJugador.nombre}
                    inicial={datosJugador.nombre.charAt(0).toUpperCase()}
                    tamaño="lg"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">
                      {datosJugador.nombre}
                    </h3>
                    {datosJugador.numero !== null && (
                      <p className="text-slate-600">
                        #{datosJugador.numero}
                      </p>
                    )}
                    <p className="text-sm text-slate-600 mt-1">
                      {nombreEquipo}
                    </p>
                    {esArmador && (
                      <span className="inline-block mt-1 text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
                        Armador
                      </span>
                    )}
                  </div>
                </div>

                <div className="mb-6">
                  <h4 className="font-semibold text-slate-800 mb-3">
                    Perfil de rendimiento
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                    <div className="bg-white border border-slate-200 rounded-lg p-2 flex flex-col">
                      <RadarJugador
                        jugador={jugadorActual}
                        esArmador={esArmador}
                      />
                    </div>
                    {barrasJugadorActual &&
                      FUNDAMENTOS_BARRAS.map((f) => (
                        <GraficoBarrasFundamento
                          key={f}
                          fundamento={f}
                          positivas={barrasJugadorActual[f].positivas}
                          neutras={barrasJugadorActual[f].neutras}
                          negativas={barrasJugadorActual[f].negativas}
                        />
                      ))}
                  </div>
                </div>

                <div className="mb-6">
                  <h4 className="font-semibold text-slate-800 mb-3">
                    Mapa de calor
                  </h4>
                  <div className="bg-white border border-slate-200 rounded-lg p-3 sm:p-4">
                    <MapaCalorJugador
                      acciones={acciones}
                      jugadorId={jugadorActual.jugador_id}
                    />
                  </div>
                </div>

                {Object.keys(jugadorActual.valoracionPonderadaPorFundamento)
                  .length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-semibold text-slate-800 mb-3">
                      Valoración ponderada por fundamento
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                      {Object.entries(
                        jugadorActual.valoracionPonderadaPorFundamento
                      ).map(([fund, val]) => {
                        const puesto =
                          podios[jugadorActual.jugador_id]?.[fund];
                        const nivel = nivelDeValoracion(fund, val);
                        const col = COLORES_NIVEL_CLASES[nivel];
                        return (
                          <div
                            key={fund}
                            className={`p-3 rounded-lg text-center relative border-2 ${col.bg} ${col.border}`}
                          >
                            {puesto !== undefined && (
                              <span
                                className={`absolute -top-2 -right-2 inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shadow-sm border-2 border-white ${colorPodio(
                                  puesto
                                )}`}
                                title={`${puesto}° puesto del plantel`}
                              >
                                ⭐{puesto}
                              </span>
                            )}
                            <p className="text-xs text-slate-600 font-medium">
                              {NOMBRES_FUNDAMENTO[fund] ?? fund}
                            </p>
                            <p className={`text-lg font-bold ${col.text}`}>
                              {val > 0 ? "+" : ""}
                              {val.toFixed(2)}
                            </p>
                            <p
                              className={`text-[9px] uppercase font-semibold ${col.text} opacity-70`}
                            >
                              {col.nombre}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {Object.keys(textosRanking).length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-semibold text-slate-800 mb-3">
                      Sus números en el plantel
                    </h4>
                    <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-200">
                      {ORDEN_RANKINGS.map((r) => {
                        const texto = textosRanking[r.id];
                        const puesto =
                          podios[jugadorActual.jugador_id]?.[r.id];
                        return (
                          <div
                            key={r.id}
                            className="flex items-start gap-3 px-3 sm:px-4 py-3"
                          >
                            <div className="mt-0.5 shrink-0">
                              <IconoVoley
                                tipo={r.id}
                                size={20}
                                className="text-slate-800"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <p className="text-sm font-semibold text-slate-700">
                                  {r.titulo}
                                </p>
                                {puesto !== undefined && (
                                  <span
                                    className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${colorPodio(
                                      puesto
                                    )}`}
                                    title={`${puesto}° puesto`}
                                  >
                                    {puesto}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 break-words">
                                {texto ?? "Sin datos en este fundamento"}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {esArmador && jugadorActual.armador && (
                  <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    <div className="p-3 sm:p-4 bg-white border border-slate-200 rounded-lg">
                      <GraficoSaquePorSet
                        promedios={calcularPromedioPonderadoPorSet(
                          jugadorActual.jugador_id,
                          acciones,
                          idsJugadores,
                          "saque",
                          VALORES_SAQUE
                        )}
                      />
                    </div>
                    <div className="p-3 sm:p-4 bg-white border border-slate-200 rounded-lg">
                      <GraficoBloqueoPorSet
                        promedios={calcularPromedioPonderadoPorSet(
                          jugadorActual.jugador_id,
                          acciones,
                          idsJugadores,
                          "bloqueo",
                          VALORES_BLOQUEO
                        )}
                      />
                    </div>
                    <div className="p-3 sm:p-4 bg-white border border-slate-200 rounded-lg">
                      <GraficoArmadosPorSet
                        promedios={calcularPromedioArmadosPonderadoPorSet(
                          jugadorActual.jugador_id,
                          acciones,
                          idsJugadores
                        )}
                      />
                    </div>
                    <div className="p-3 sm:p-4 bg-white border border-slate-200 rounded-lg">
                      <MapaCalorTendencia
                        distribucion={
                          jugadorActual.armador.distribucionTendencia
                        }
                        acciones={acciones}
                        jugadorId={jugadorActual.jugador_id}
                      />
                    </div>
                  </div>
                )}

                {!esArmador && (
                  <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    <div className="p-3 sm:p-4 bg-white border border-slate-200 rounded-lg">
                      <GraficoSaquePorSet
                        promedios={calcularPromedioPonderadoPorSet(
                          jugadorActual.jugador_id,
                          acciones,
                          idsJugadores,
                          "saque",
                          VALORES_SAQUE
                        )}
                      />
                    </div>
                    <div className="p-3 sm:p-4 bg-white border border-slate-200 rounded-lg">
                      <GraficoRecepcionPorSet
                        promedios={calcularPromedioPonderadoPorSet(
                          jugadorActual.jugador_id,
                          acciones,
                          idsJugadores,
                          "recepcion",
                          VALORES_RECEPCION
                        )}
                      />
                    </div>
                    <div className="md:col-span-2 p-3 sm:p-4 bg-white border border-slate-200 rounded-lg">
                      <GraficoBloqueoPorSet
                        promedios={calcularPromedioPonderadoPorSet(
                          jugadorActual.jugador_id,
                          acciones,
                          idsJugadores,
                          "bloqueo",
                          VALORES_BLOQUEO
                        )}
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                  <div className="p-3 bg-white border border-slate-200 rounded-lg text-center">
                    <p className="text-xs text-slate-500 uppercase">Saldo</p>
                    <p
                      className={`text-xl sm:text-2xl font-bold ${
                        jugadorActual.saldoTotal > 0
                          ? "text-green-700"
                          : jugadorActual.saldoTotal < 0
                          ? "text-red-700"
                          : "text-slate-700"
                      }`}
                    >
                      {jugadorActual.saldoTotal > 0 ? "+" : ""}
                      {jugadorActual.saldoTotal}
                    </p>
                  </div>
                  <div className="p-3 bg-white border border-slate-200 rounded-lg text-center">
                    <p className="text-xs text-slate-500 uppercase">
                      Saldo Defensivo
                    </p>
                    <p
                      className={`text-xl sm:text-2xl font-bold ${
                        jugadorActual.saldoDefensivo > 0
                          ? "text-green-700"
                          : jugadorActual.saldoDefensivo < 0
                          ? "text-red-700"
                          : "text-slate-700"
                      }`}
                    >
                      {jugadorActual.saldoDefensivo > 0 ? "+" : ""}
                      {jugadorActual.saldoDefensivo}
                    </p>
                  </div>
                  <div className="p-3 bg-white border border-slate-200 rounded-lg text-center">
                    <p className="text-xs text-slate-500 uppercase">
                      Valoración Media
                    </p>
                    <p
                      className={`text-xl sm:text-2xl font-bold ${
                        jugadorActual.valoracionMediaNormalizada > 0
                          ? "text-green-700"
                          : jugadorActual.valoracionMediaNormalizada < 0
                          ? "text-red-700"
                          : "text-slate-700"
                      }`}
                    >
                      {jugadorActual.valoracionMediaNormalizada > 0 ? "+" : ""}
                      {jugadorActual.valoracionMediaNormalizada.toFixed(2)}
                    </p>
                  </div>

                  <div className="p-3 bg-white border border-slate-200 rounded-lg text-center">
                    <p className="text-xs text-slate-500 uppercase">
                      Acciones
                    </p>
                    <p className="text-xl sm:text-2xl font-bold text-slate-800">
                      {jugadorActual.totalAcciones}
                    </p>
                  </div>
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                    <p className="text-xs text-green-700 uppercase">Puntos</p>
                    <p className="text-xl sm:text-2xl font-bold text-green-800">
                      {jugadorActual.totalPuntos}
                    </p>
                  </div>
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-center">
                    <p className="text-xs text-red-700 uppercase">Errores</p>
                    <p className="text-xl sm:text-2xl font-bold text-red-800">
                      {jugadorActual.totalErrores}
                    </p>
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6">
              {comparadosData.length === 0 ? (
                <div className="p-8 sm:p-12 text-center h-full flex items-center justify-center">
                  <div>
                    <p className="text-4xl mb-3">⚖️</p>
                    <p className="text-slate-600 font-medium">
                      Elegí hasta 3 jugadores del plantel para comparar
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-6 pb-4 border-b border-slate-200">
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-3">
                      Comparando{" "}
                      {comparadosData.length === 1
                        ? "1 jugador"
                        : `${comparadosData.length} jugadores`}
                    </h3>
                    <div className="flex flex-wrap gap-2 sm:gap-3">
                      {comparadosData.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50"
                        >
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: s.color }}
                          />
                          <span className="text-sm font-medium text-slate-700">
                            {s.nombre}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mb-6">
                    <h4 className="font-semibold text-slate-800 mb-3">
                      Radar comparativo
                    </h4>
                    <RadarJugador
                      series={seriesRadar}
                      esArmador={esComparacionArmador}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    <div className="p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-lg">
                      <GraficoSaquePorSet series={seriesSaque} />
                    </div>

                    {!esComparacionArmador && (
                      <div className="p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-lg">
                        <GraficoRecepcionPorSet series={seriesRecepcion} />
                      </div>
                    )}

                    {esComparacionArmador && (
                      <div className="p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-lg">
                        <GraficoArmadosPorSet series={seriesArmados} />
                      </div>
                    )}

                    <div
                      className={`p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-lg ${
                        esComparacionArmador ? "" : "md:col-span-2"
                      }`}
                    >
                      <GraficoBloqueoPorSet series={seriesBloqueo} />
                    </div>
                  </div>

                  <div className="mt-6 overflow-x-auto">
                    <table className="w-full text-sm min-w-[500px]">
                      <thead>
                        <tr className="text-left text-slate-500 border-b border-slate-200">
                          <th className="py-2 px-3">Jugador</th>
                          <th className="py-2 px-3 text-right">Acciones</th>
                          <th className="py-2 px-3 text-right">Puntos</th>
                          <th className="py-2 px-3 text-right">Errores</th>
                          <th className="py-2 px-3 text-right">Saldo</th>
                          <th className="py-2 px-3 text-right">Val. Media</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparadosData.map((s) => {
                          const est = s.jugador;
                          return (
                            <tr
                              key={s.id}
                              className="border-b border-slate-100"
                            >
                              <td className="py-2 px-3 font-medium">
                                <span
                                  className="inline-block w-3 h-3 rounded-full mr-2 align-middle"
                                  style={{ backgroundColor: s.color }}
                                />
                                <span className="text-slate-800">
                                  {s.nombre}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right text-slate-600">
                                {est.totalAcciones}
                              </td>
                              <td className="py-2 px-3 text-right text-green-700">
                                {est.totalPuntos}
                              </td>
                              <td className="py-2 px-3 text-right text-red-700">
                                {est.totalErrores}
                              </td>
                              <td
                                className={`py-2 px-3 text-right font-semibold ${
                                  est.saldoTotal > 0
                                    ? "text-green-700"
                                    : est.saldoTotal < 0
                                    ? "text-red-700"
                                    : "text-slate-600"
                                }`}
                              >
                                {est.saldoTotal > 0 ? "+" : ""}
                                {est.saldoTotal}
                              </td>
                              <td
                                className={`py-2 px-3 text-right font-semibold ${
                                  est.valoracionMediaNormalizada > 0
                                    ? "text-green-700"
                                    : est.valoracionMediaNormalizada < 0
                                    ? "text-red-700"
                                    : "text-slate-600"
                                }`}
                              >
                                {est.valoracionMediaNormalizada > 0 ? "+" : ""}
                                {est.valoracionMediaNormalizada.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}