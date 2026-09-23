"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { obtenerSesion, cerrarSesion, type Sesion } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import ContadorSaque from "./ContadorSaque";
import ContadorRecepcion from "./ContadorRecepcion";
import ContadorAtaque from "./ContadorAtaque";
import ContadorBloqueo from "./ContadorBloqueo";
import ContadorDefensa from "./ContadorDefensa";
import ContadorTendencia from "./ContadorTendencia";
import ContadorToque from "./ContadorToque";
import ContadorArmados from "./ContadorArmados";
import ResumenPartido from "./ResumenPartido";

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

type Datos = Record<string, Record<string, Record<string, Record<string, number>>>>;

const FUNDAMENTOS_NORMAL = [
  "saque",
  "recepcion",
  "ataque",
  "bloqueo",
  "defensa",
] as const;
const FUNDAMENTOS_ARMADOR = [
  "saque",
  "bloqueo",
  "defensa",
  "tendencia",
  "toque",
  "armados",
] as const;

type FundamentoNormal = typeof FUNDAMENTOS_NORMAL[number];
type FundamentoArmador = typeof FUNDAMENTOS_ARMADOR[number];
type Fundamento = FundamentoNormal | FundamentoArmador;

const NOMBRES_FUNDAMENTO: Record<string, string> = {
  saque: "Saque",
  recepcion: "Recepción",
  ataque: "Ataque",
  bloqueo: "Bloqueo",
  defensa: "Defensa",
  tendencia: "Tendencia",
  toque: "Toque",
  armados: "Armados",
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
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensajeGuardado, setMensajeGuardado] = useState("");

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
      if (asigRes.data) setAsignaciones(asigRes.data);
      if (jugRes.data) setJugadores(jugRes.data);
    });
    setJugadorId("");
  }, [equipoId]);

  useEffect(() => {
    if (!partidoId) {
      setDatos({});
      return;
    }
    setCargando(true);
    supabase
      .from("acciones")
      .select(
        "jugador_id, partido_id, set_numero, fundamento, valoracion, cantidad"
      )
      .eq("partido_id", partidoId)
      .then(({ data, error }) => {
        setCargando(false);
        if (error || !data) {
          setDatos({});
          return;
        }
        const nuevo: Datos = {};
        (data as AccionDB[]).forEach((a) => {
          const setStr = String(a.set_numero);
          nuevo[a.jugador_id] = nuevo[a.jugador_id] ?? {};
          nuevo[a.jugador_id][setStr] = nuevo[a.jugador_id][setStr] ?? {};
          nuevo[a.jugador_id][setStr][a.fundamento] =
            nuevo[a.jugador_id][setStr][a.fundamento] ?? {};
          nuevo[a.jugador_id][setStr][a.fundamento][a.valoracion] = a.cantidad;
        });
        setDatos(nuevo);
      });
  }, [partidoId]);

  const jugadoresDelEquipo = asignaciones
    .map((a) => jugadores.find((j) => j.id === a.jugador_id))
    .filter((j): j is Jugador => j !== undefined);

  const jugadorActual = jugadoresDelEquipo.find((j) => j.id === jugadorId);
  const esArmador = jugadorActual?.rol === "armador";

  useEffect(() => {
    if (esArmador) {
      if (
        !FUNDAMENTOS_ARMADOR.includes(fundamentoActivo as FundamentoArmador)
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

  // Total de toques = punto + error + neutro
  const valoresToque = valoresDe("toque" as Fundamento);
  const toquesTotal =
    (valoresToque.punto ?? 0) +
    (valoresToque.error ?? 0) +
    (valoresToque.neutro ?? 0);

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
                <h3 className="font-semibold text-slate-800 mb-3">
                  Jugadores
                </h3>
                {cargando ? (
                  <p className="text-sm text-slate-500">Cargando...</p>
                ) : jugadoresDelEquipo.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Este equipo no tiene jugadores asignados.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {jugadoresDelEquipo.map((j) => (
                      <button
                        key={j.id}
                        onClick={() => setJugadorId(j.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg transition text-sm ${
                          jugadorId === j.id
                            ? "bg-blue-500 text-white"
                            : "bg-slate-50 hover:bg-slate-100 text-slate-700"
                        }`}
                      >
                        <span className="font-medium">
                          {j.nombre}
                          {j.numero !== null && ` #${j.numero}`}
                        </span>
                        {j.rol === "armador" && (
                          <span
                            className={`block text-xs ${
                              jugadorId === j.id
                                ? "text-blue-100"
                                : "text-violet-600"
                            }`}
                          >
                            Armador
                          </span>
                        )}
                      </button>
                    ))}
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
                      Después vas a ver los contadores acá
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
                    {fundamentoActivo === "tendencia" && (
                      <ContadorTendencia
                        valores={valoresDe("tendencia")}
                        onCambio={onCambioDe("tendencia")}
                        soloLectura={soloLectura}
                        toquesTotal={toquesTotal}
                      />
                    )}
                    {fundamentoActivo === "toque" && (
                      <ContadorToque
                        valores={valoresDe("toque")}
                        onCambio={onCambioDe("toque")}
                        soloLectura={soloLectura}
                      />
                    )}
                    {fundamentoActivo === "armados" && (
                      <ContadorArmados
                        valores={valoresDe("armados")}
                        onCambio={onCambioDe("armados")}
                        soloLectura={soloLectura}
                      />
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