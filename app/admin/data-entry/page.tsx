"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { obtenerSesion, cerrarSesion, type Sesion } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import ContadorSaque from "./ContadorSaque";
import ContadorRecepcion from "./ContadorRecepcion";
import ContadorAtaque from "./ContadorAtaque";
import ContadorBloqueo from "./ContadorBloqueo";
import ContadorDefensa from "./ContadorDefensa";
import ContadorToque from "./ContadorToque";
import ResumenPartido from "./ResumenPartido";
import TableroArmador, {
  type PuntoArmador,
  calcularZonaTendencia,
} from "./TableroArmador";

interface Equipo {
  id: string;
  nombre: string;
}

interface Jugador {
  id: string;
  nombre: string;
  numero: number | null;
  rol: string;
}

interface JugadorEquipo {
  id: string;
  jugador_id: string;
  equipo_id: string;
  activo: boolean;
}

interface Partido {
  id: string;
  equipo_id: string;
  rival: string;
  fecha: string;
}

interface AccionDB {
  jugador_id: string;
  partido_id?: string;
  set_numero: number;
  fundamento: string;
  valoracion: string;
  cantidad: number;
}

type SetActivo = 1 | 2 | 3 | 4 | 5 | "partido";

type Datos = Record<
  string,
  Record<string, Record<string, Record<string, number>>>
>;

const FUNDAMENTOS_NORMAL = [
  "saque",
  "recepcion",
  "ataque",
  "bloqueo",
  "defensa",
] as const;

const FUNDAMENTOS_ARMADOR = ["saque", "bloqueo", "defensa", "tablero"] as const;

const FUNDAMENTOS_TOQUE = ["toque"] as const;

type FundamentoNormal = (typeof FUNDAMENTOS_NORMAL)[number];
type FundamentoArmador = (typeof FUNDAMENTOS_ARMADOR)[number];
type FundamentoToque = (typeof FUNDAMENTOS_TOQUE)[number];
type Fundamento = FundamentoNormal | FundamentoArmador | FundamentoToque;

const NOMBRES_FUNDAMENTO: Record<string, string> = {
  saque: "Saque",
  recepcion: "Recepción",
  ataque: "Ataque",
  bloqueo: "Bloqueo",
  defensa: "Defensa",
  tablero: "Tablero + Toque",
  toque: "Toque",
};

const MAPA_CALIDAD: Record<number, string> = {
  1: "horrible",
  2: "malo",
  3: "flojo",
  4: "correcto",
  5: "perfecto",
  6: "genial",
};

export default function DataEntryPage() {
  const router = useRouter();
  const [sesion, setSesion] = useState<Sesion | null>(null);

  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [asignaciones, setAsignaciones] = useState<JugadorEquipo[]>([]);

  const [equipoId, setEquipoId] = useState("");
  const [partidoId, setPartidoId] = useState("");
  const [jugadorId, setJugadorId] = useState("");
  const [setActivo, setSetActivo] = useState<SetActivo>(1);
  const [fundamentoActivo, setFundamentoActivo] =
    useState<Fundamento>("saque");

  const [datos, setDatos] = useState<Datos>({});
  const [armadosPorJugador, setArmadosPorJugador] = useState<
    Record<string, PuntoArmador[]>
  >({});

  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensajeGuardado, setMensajeGuardado] = useState("");

  const [ordenLocal, setOrdenLocal] = useState<string[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  useEffect(() => {
    const s = obtenerSesion();
    if (!s || s.tipo !== "admin") {
      router.push("/");
      return;
    }
    setSesion(s);
  }, [router]);

  useEffect(() => {
    if (!sesion) return;
    supabase
      .from("equipos")
      .select("id, nombre")
      .order("nombre")
      .then(({ data }) => {
        if (data) setEquipos(data);
      });
  }, [sesion]);

  useEffect(() => {
    if (!equipoId) {
      setPartidos([]);
      setPartidoId("");
      return;
    }
    supabase
      .from("partidos")
      .select("id, equipo_id, rival, fecha")
      .eq("equipo_id", equipoId)
      .order("fecha", { ascending: false })
      .then(({ data }) => {
        if (data) setPartidos(data);
      });
    setPartidoId("");
    setJugadorId("");
  }, [equipoId]);

  useEffect(() => {
    if (!equipoId) {
      setJugadores([]);
      setAsignaciones([]);
      setOrdenLocal([]);
      return;
    }
    setCargando(true);
    Promise.all([
      supabase
        .from("jugador_equipo")
        .select("*")
        .eq("equipo_id", equipoId)
        .eq("activo", true),
      supabase.from("jugadores").select("*").order("nombre"),
    ]).then(([asigRes, jugRes]) => {
      setCargando(false);
      if (asigRes.data) {
        setAsignaciones(asigRes.data);
        setOrdenLocal(
          asigRes.data.map((a: JugadorEquipo) => a.jugador_id)
        );
      }
      if (jugRes.data) setJugadores(jugRes.data);
    });
    setJugadorId("");
  }, [equipoId]);

  useEffect(() => {
    if (!partidoId) {
      setDatos({});
      setArmadosPorJugador({});
      return;
    }
    setCargando(true);
    Promise.all([
      supabase
        .from("acciones")
        .select(
          "jugador_id, partido_id, set_numero, fundamento, valoracion, cantidad"
        )
        .eq("partido_id", partidoId),
      supabase
        .from("armados_detalle")
        .select("*")
        .eq("partido_id", partidoId)
        .order("created_at", { ascending: true }),
    ]).then(([accRes, armRes]) => {
      setCargando(false);

      if (accRes.data) {
        const nuevo: Datos = {};
        (accRes.data as AccionDB[]).forEach((a) => {
          const setStr = String(a.set_numero);
          nuevo[a.jugador_id] = nuevo[a.jugador_id] ?? {};
          nuevo[a.jugador_id][setStr] = nuevo[a.jugador_id][setStr] ?? {};
          nuevo[a.jugador_id][setStr][a.fundamento] =
            nuevo[a.jugador_id][setStr][a.fundamento] ?? {};
          nuevo[a.jugador_id][setStr][a.fundamento][a.valoracion] = a.cantidad;
        });
        setDatos(nuevo);
      }

      if (armRes.data) {
        const agrupados: Record<string, Record<number, PuntoArmador>> = {};
        armRes.data.forEach((a: any) => {
          const jid = a.jugador_id;
          const pnum = a.punto_numero;
          agrupados[jid] = agrupados[jid] ?? {};
          if (!agrupados[jid][pnum]) {
            agrupados[jid][pnum] = {
              numero: pnum,
              lineas: [],
              atacanteDerecho: a.atacante_derecho,
              armadorNumero: a.armador_numero,
            };
          }
          agrupados[jid][pnum].lineas.push({
            origen: { celda: a.origen_celda, mini: a.origen_mini },
            destino: { celda: a.destino_celda, mini: a.destino_mini },
            calidad: a.calidad,
          });
        });

        const porJugador: Record<string, PuntoArmador[]> = {};
        for (const jid of Object.keys(agrupados)) {
          const pts = Object.values(agrupados[jid]).sort(
            (a, b) => a.numero - b.numero
          );
          porJugador[jid] = pts;
        }
        setArmadosPorJugador(porJugador);
      }
    });
  }, [partidoId]);

  const jugadoresDelEquipo = ordenLocal
    .map((jugId) => jugadores.find((j) => j.id === jugId))
    .filter((j): j is Jugador => j !== undefined);

  const jugadorActual = jugadoresDelEquipo.find((j) => j.id === jugadorId);
  const esArmador = jugadorActual?.rol === "armador";

  const jugadoresRef = useRef<Jugador[]>([]);
  useEffect(() => {
    jugadoresRef.current = jugadoresDelEquipo;
  }, [jugadoresDelEquipo]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const num = parseInt(e.key);
      if (isNaN(num) || num < 1 || num > 9) return;

      const idx = num - 1;
      const arr = jugadoresRef.current;
      if (idx < arr.length) {
        setJugadorId(arr[idx].id);
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (esArmador) {
      if (
        !FUNDAMENTOS_ARMADOR.includes(fundamentoActivo as FundamentoArmador) &&
        !FUNDAMENTOS_TOQUE.includes(fundamentoActivo as FundamentoToque)
      ) {
        setFundamentoActivo("saque");
      }
    } else {
      if (
        !FUNDAMENTOS_NORMAL.includes(fundamentoActivo as FundamentoNormal)
      ) {
        setFundamentoActivo("saque");
      }
    }
  }, [jugadorId, esArmador, fundamentoActivo]);

  const handleCerrar = () => {
    cerrarSesion();
    router.push("/");
  };

  const volverAlPanel = () => {
    router.push("/admin");
  };

  const handleDrop = (targetJugadorId: string) => {
    if (!draggedId || draggedId === targetJugadorId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }
    const fromIdx = ordenLocal.indexOf(draggedId);
    const toIdx = ordenLocal.indexOf(targetJugadorId);
    if (fromIdx === -1 || toIdx === -1) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }
    const nuevo = [...ordenLocal];
    const [movido] = nuevo.splice(fromIdx, 1);
    nuevo.splice(toIdx, 0, movido);
    setOrdenLocal(nuevo);
    setDraggedId(null);
    setDragOverId(null);
  };

  const setValor = (
    jugId: string,
    set: string,
    fundamento: string,
    valoracion: string,
    cantidad: number
  ) => {
    setDatos((prev) => {
      const copia = { ...prev };
      copia[jugId] = { ...(copia[jugId] ?? {}) };
      copia[jugId][set] = { ...(copia[jugId][set] ?? {}) };
      copia[jugId][set][fundamento] = {
        ...(copia[jugId][set][fundamento] ?? {}),
      };
      copia[jugId][set][fundamento][valoracion] = cantidad;
      return copia;
    });
  };

  const getValores = (
    jugId: string,
    set: string,
    fundamento: string
  ): Record<string, number> => {
    return datos[jugId]?.[set]?.[fundamento] ?? {};
  };

  const getValoresTotales = (
    jugId: string,
    fundamento: string
  ): Record<string, number> => {
    const totales: Record<string, number> = {};
    for (let s = 1; s <= 5; s++) {
      const vals = datos[jugId]?.[String(s)]?.[fundamento] ?? {};
      for (const [k, v] of Object.entries(vals)) {
        totales[k] = (totales[k] ?? 0) + v;
      }
    }
    return totales;
  };

  const guardarTodo = async () => {
    if (!partidoId) return;
    if (!confirm("¿Guardar los datos de este partido en la base?")) return;

    setGuardando(true);
    setMensajeGuardado("");

    const { error: errBorrar } = await supabase
      .from("acciones")
      .delete()
      .eq("partido_id", partidoId);

    if (errBorrar) {
      setGuardando(false);
      setMensajeGuardado(
        "❌ Error al preparar el guardado: " + errBorrar.message
      );
      return;
    }

    await supabase
      .from("armados_detalle")
      .delete()
      .eq("partido_id", partidoId);

    const filas: {
      partido_id: string;
      jugador_id: string;
      set_numero: number;
      fundamento: string;
      valoracion: string;
      cantidad: number;
    }[] = [];

    Object.entries(datos).forEach(([jugId, sets]) => {
      Object.entries(sets).forEach(([setStr, fundos]) => {
        const setNum = parseInt(setStr);
        if (isNaN(setNum) || setNum < 1 || setNum > 5) return;
        Object.entries(fundos).forEach(([fund, vals]) => {
          Object.entries(vals).forEach(([valor, cantidad]) => {
            if (cantidad > 0) {
              filas.push({
                partido_id: partidoId,
                jugador_id: jugId,
                set_numero: setNum,
                fundamento: fund,
                valoracion: valor,
                cantidad,
              });
            }
          });
        });
      });
    });

    const detallesArmados: any[] = [];
    for (const [jugId, pts] of Object.entries(armadosPorJugador)) {
      const conteoTendencia: Record<string, number> = {};
      const conteoArmados: Record<number, number> = {};

      pts.forEach((punto, pIdx) => {
        punto.lineas.forEach((linea) => {
          const zona = calcularZonaTendencia(
            linea.destino.celda,
            punto.atacanteDerecho
          );

          detallesArmados.push({
            partido_id: partidoId,
            jugador_id: jugId,
            set_numero: setActivo === "partido" ? 1 : setActivo,
            punto_numero: pIdx + 1,
            origen_celda: linea.origen.celda,
            origen_mini: linea.origen.mini,
            destino_celda: linea.destino.celda,
            destino_mini: linea.destino.mini,
            zona_tendencia: zona,
            calidad: linea.calidad,
            atacante_derecho: punto.atacanteDerecho,
            armador_numero: punto.armadorNumero,
          });

          if (zona !== null) {
            const key = `zona_${zona}`;
            conteoTendencia[key] = (conteoTendencia[key] ?? 0) + 1;
          }
          conteoArmados[linea.calidad] =
            (conteoArmados[linea.calidad] ?? 0) + 1;
        });
      });

      const setNum = setActivo === "partido" ? 1 : setActivo;
      for (const [valor, cant] of Object.entries(conteoTendencia)) {
        if (cant > 0) {
          filas.push({
            partido_id: partidoId,
            jugador_id: jugId,
            set_numero: setNum,
            fundamento: "tendencia",
            valoracion: valor,
            cantidad: cant,
          });
        }
      }

      for (const [nStr, cant] of Object.entries(conteoArmados)) {
        const valor = MAPA_CALIDAD[parseInt(nStr)];
        if (valor && cant > 0) {
          filas.push({
            partido_id: partidoId,
            jugador_id: jugId,
            set_numero: setNum,
            fundamento: "armados",
            valoracion: valor,
            cantidad: cant,
          });
        }
      }
    }

    if (detallesArmados.length > 0) {
      const { error: errDet } = await supabase
        .from("armados_detalle")
        .insert(detallesArmados);
      if (errDet) {
        setGuardando(false);
        setMensajeGuardado(
          "❌ Error al guardar armados detallados: " + errDet.message
        );
        return;
      }
    }

    if (filas.length === 0) {
      setGuardando(false);
      setMensajeGuardado("✅ Guardado (no había datos para subir)");
      return;
    }

    const { error: errInsert } = await supabase.from("acciones").insert(filas);

    setGuardando(false);

    if (errInsert) {
      setMensajeGuardado("❌ Error al guardar: " + errInsert.message);
      return;
    }

    setMensajeGuardado("✅ Datos guardados correctamente");
  };

  if (!sesion) return null;

  const setActual = setActivo === "partido" ? "partido" : String(setActivo);
  const soloLectura = setActivo === "partido";

  const valoresDe = (fundamento: Fundamento) =>
    setActivo === "partido"
      ? getValoresTotales(jugadorId, fundamento)
      : getValores(jugadorId, setActual, fundamento);

  const onCambioDe = (fundamento: Fundamento) => (
    valoracion: string,
    cantidad: number
  ) => {
    setValor(jugadorId, setActual, fundamento, valoracion, cantidad);
  };

  const fundamentosDisponibles = esArmador
    ? FUNDAMENTOS_ARMADOR
    : FUNDAMENTOS_NORMAL;

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <button
              onClick={volverAlPanel}
              className="text-sm text-slate-500 hover:text-slate-700 mb-1"
            >
              ← Volver al panel
            </button>
            <h1 className="text-3xl font-bold text-slate-900">
              🎯 Consola de Data Entry
            </h1>
          </div>
          <button
            onClick={handleCerrar}
            className="px-4 py-2 text-sm bg-slate-200 hover:bg-slate-300 rounded-lg transition"
          >
            Cerrar sesión
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Equipo
              </label>
              <select
                value={equipoId}
                onChange={(e) => setEquipoId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500"
              >
                <option value="">Elegí un equipo</option>
                {equipos.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Partido
              </label>
              <select
                value={partidoId}
                onChange={(e) => setPartidoId(e.target.value)}
                disabled={!equipoId}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-slate-100"
              >
                <option value="">
                  {equipoId ? "Elegí un partido" : "Primero elegí un equipo"}
                </option>
                {partidos.map((p) => (
                  <option key={p.id} value={p.id}>
                    vs {p.rival} · {p.fecha}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {!partidoId && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
            <p className="text-5xl mb-4">🎯</p>
            <p className="text-slate-600 font-medium mb-2">
              Elegí un equipo y un partido arriba
            </p>
            <p className="text-slate-500 text-sm">
              Ahí se habilita la carga de datos
            </p>
          </div>
        )}

        {partidoId && (
          <>
            <div className="flex gap-2 mb-4 border-b border-slate-200">
              {([1, 2, 3, 4, 5, "partido"] as const).map((s) => (
                <button
                  key={String(s)}
                  onClick={() => setSetActivo(s)}
                  className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
                    setActivo === s
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {s === "partido" ? "📊 Partido" : `Set ${s}`}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 col-span-1">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-800">Jugadores</h3>
                  <span className="text-[10px] text-slate-400 text-right leading-tight">
                    Arrastrá para reordenar
                    <br />
                    Teclas 1-9 para elegir
                  </span>
                </div>
                {cargando ? (
                  <p className="text-sm text-slate-500">Cargando...</p>
                ) : jugadoresDelEquipo.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Este equipo no tiene jugadores asignados.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {jugadoresDelEquipo.map((j, idx) => {
                      const esDrag = draggedId === j.id;
                      const esOver =
                        dragOverId === j.id && draggedId !== j.id;
                      const seleccionado = jugadorId === j.id;
                      const muestraTecla = idx < 9;
                      return (
                        <div
                          key={j.id}
                          draggable
                          onDragStart={() => setDraggedId(j.id)}
                          onDragEnd={() => {
                            setDraggedId(null);
                            setDragOverId(null);
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            if (dragOverId !== j.id) setDragOverId(j.id);
                          }}
                          onDragLeave={() => {
                            if (dragOverId === j.id) setDragOverId(null);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            handleDrop(j.id);
                          }}
                          onClick={() => setJugadorId(j.id)}
                          className={`relative w-full text-left pl-3 pr-10 py-2 rounded-lg transition text-sm cursor-grab active:cursor-grabbing select-none ${
                            seleccionado
                              ? "bg-blue-500 text-white"
                              : "bg-slate-50 hover:bg-slate-100 text-slate-700"
                          } ${esDrag ? "opacity-40" : ""} ${
                            esOver ? "ring-2 ring-blue-400 ring-offset-1" : ""
                          }`}
                        >
                          <span className="font-medium block truncate">
                            {j.nombre}
                            {j.numero !== null && ` #${j.numero}`}
                          </span>
                          {j.rol === "armador" && (
                            <span
                              className={`block text-xs ${
                                seleccionado
                                  ? "text-blue-100"
                                  : "text-violet-600"
                              }`}
                            >
                              Armador
                            </span>
                          )}
                          {muestraTecla && (
                            <span
                              className={`absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded text-[11px] font-bold border ${
                                seleccionado
                                  ? "bg-white/20 text-white border-white/30"
                                  : "bg-white text-slate-500 border-slate-300"
                              }`}
                              title={`Tecla ${idx + 1}`}
                            >
                              {idx + 1}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 col-span-2">
                {setActivo === "partido" ? (
                  <ResumenPartido
                    partidoId={partidoId}
                    jugadoresIds={jugadoresDelEquipo.map((j) => j.id)}
                    nombresJugadores={Object.fromEntries(
                      jugadoresDelEquipo.map((j) => [
                        j.id,
                        j.nombre + (j.numero !== null ? ` #${j.numero}` : ""),
                      ])
                    )}
                  />
                ) : !jugadorId ? (
                  <div className="text-center py-16">
                    <p className="text-4xl mb-3">👈</p>
                    <p className="text-slate-600 font-medium">
                      Elegí un jugador de la izquierda
                    </p>
                    <p className="text-slate-500 text-sm mt-1">
                      O apretá una tecla del 1 al 9
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="mb-4 pb-4 border-b border-slate-200">
                      <p className="text-sm text-slate-500">Jugador</p>
                      <p className="font-semibold text-slate-800">
                        {jugadorActual?.nombre}
                        {jugadorActual?.rol === "armador" && (
                          <span className="ml-2 text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">
                            Armador
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-slate-500 mt-2">
                        Set activo:{" "}
                        <span className="font-medium text-slate-700">
                          Set {setActivo}
                        </span>
                      </p>
                    </div>

                    <div className="flex gap-2 mb-6 flex-wrap">
                      {fundamentosDisponibles.map((f) => (
                        <button
                          key={f}
                          onClick={() => setFundamentoActivo(f)}
                          className={`px-4 py-2 text-sm font-medium rounded-lg transition border ${
                            fundamentoActivo === f
                              ? "bg-slate-800 text-white border-slate-800"
                              : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          {NOMBRES_FUNDAMENTO[f]}
                        </button>
                      ))}
                    </div>

                    {fundamentoActivo === "saque" && (
                      <ContadorSaque
                        valores={valoresDe("saque")}
                        onCambio={onCambioDe("saque")}
                        soloLectura={soloLectura}
                      />
                    )}
                    {fundamentoActivo === "recepcion" && (
                      <ContadorRecepcion
                        valores={valoresDe("recepcion")}
                        onCambio={onCambioDe("recepcion")}
                        soloLectura={soloLectura}
                      />
                    )}
                    {fundamentoActivo === "ataque" && (
                      <ContadorAtaque
                        valores={valoresDe("ataque")}
                        onCambio={onCambioDe("ataque")}
                        soloLectura={soloLectura}
                      />
                    )}
                    {fundamentoActivo === "bloqueo" && (
                      <ContadorBloqueo
                        valores={valoresDe("bloqueo")}
                        onCambio={onCambioDe("bloqueo")}
                        soloLectura={soloLectura}
                      />
                    )}
                    {fundamentoActivo === "defensa" && (
                      <ContadorDefensa
                        valores={valoresDe("defensa")}
                        onCambio={onCambioDe("defensa")}
                        soloLectura={soloLectura}
                      />
                    )}
                    {fundamentoActivo === "tablero" && (
                      <div className="space-y-6">
                        <div>
                          <div className="flex items-center gap-2 mb-4">
                            <div className="w-1 h-6 rounded-full bg-cyan-500" />
                            <h3 className="text-lg font-semibold text-slate-800">
                              Tablero de armador
                            </h3>
                          </div>
                          <TableroArmador
                            puntos={
                              armadosPorJugador[jugadorId] ?? [
                                {
                                  numero: 1,
                                  lineas: [],
                                  atacanteDerecho: "arriba",
                                  armadorNumero: 1,
                                },
                              ]
                            }
                            onPuntosChange={(nuevos) =>
                              setArmadosPorJugador((prev) => ({
                                ...prev,
                                [jugadorId]: nuevos,
                              }))
                            }
                          />
                        </div>
                        <div className="pt-4 border-t border-slate-200">
                          <ContadorToque
                            valores={valoresDe("toque")}
                            onCambio={onCambioDe("toque")}
                            soloLectura={soloLectura}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex items-center justify-between">
              <p className="text-sm text-slate-600">
                {mensajeGuardado ||
                  "Los cambios no se guardan hasta que aprietes el botón"}
              </p>
              <button
                onClick={guardarTodo}
                disabled={guardando}
                className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 text-white font-medium rounded-lg transition"
              >
                {guardando ? "Guardando..." : "💾 Guardar Datos"}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}