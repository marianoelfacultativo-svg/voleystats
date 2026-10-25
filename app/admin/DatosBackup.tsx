"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  exportarEquipo,
  exportarPartido,
  descargarJSON,
  leerArchivoJSON,
  analizarBackup,
  importarBackup,
  type Backup,
  type AnalisisBackup,
} from "@/lib/exportImport";

interface Equipo {
  id: string;
  nombre: string;
}

interface Partido {
  id: string;
  rival: string;
  fecha: string;
}

export default function DatosBackup() {
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [cargandoEquipos, setCargandoEquipos] = useState(false);

  // ---- Export equipo ----
  const [equipoExportId, setEquipoExportId] = useState("");
  const [exportandoEquipo, setExportandoEquipo] = useState(false);

  // ---- Export partido ----
  const [equipoPartidoId, setEquipoPartidoId] = useState("");
  const [partidoExportId, setPartidoExportId] = useState("");
  const [exportandoPartido, setExportandoPartido] = useState(false);

  // ---- Import ----
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [archivoNombre, setArchivoNombre] = useState("");
  const [backupCargado, setBackupCargado] = useState<Backup | null>(null);
  const [analisis, setAnalisis] = useState<AnalisisBackup | null>(null);
  const [errorArchivo, setErrorArchivo] = useState("");
  const [importando, setImportando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState("");

  // Cargar equipos
  useEffect(() => {
    setCargandoEquipos(true);
    supabase
      .from("equipos")
      .select("id, nombre")
      .order("nombre")
      .then(({ data }) => {
        setCargandoEquipos(false);
        if (data) setEquipos(data);
      });
  }, []);

  // Cargar partidos del equipo elegido para exportar un partido
  useEffect(() => {
    if (!equipoPartidoId) {
      setPartidos([]);
      setPartidoExportId("");
      return;
    }
    supabase
      .from("partidos")
      .select("id, rival, fecha")
      .eq("equipo_id", equipoPartidoId)
      .order("fecha", { ascending: false })
      .then(({ data }) => {
        if (data) setPartidos(data);
        setPartidoExportId("");
      });
  }, [equipoPartidoId]);

  // ---- Handlers export ----
  const handleExportarEquipo = async () => {
    if (!equipoExportId) {
      alert("Elegí un equipo.");
      return;
    }
    setExportandoEquipo(true);
    const res = await exportarEquipo(equipoExportId);
    setExportandoEquipo(false);
    if (!res.ok || !res.data) {
      alert(`Error exportando: ${res.error ?? "desconocido"}`);
      return;
    }
    const nombre = equipos.find((e) => e.id === equipoExportId)?.nombre ??
      "equipo";
    descargarJSON(res.data, `equipo-${nombre}`);
  };

  const handleExportarPartido = async () => {
    if (!partidoExportId) {
      alert("Elegí un partido.");
      return;
    }
    setExportandoPartido(true);
    const res = await exportarPartido(partidoExportId);
    setExportandoPartido(false);
    if (!res.ok || !res.data) {
      alert(`Error exportando: ${res.error ?? "desconocido"}`);
      return;
    }
    const p = partidos.find((x) => x.id === partidoExportId);
    const nombre = p ? `partido-${p.rival}-${p.fecha}` : "partido";
    descargarJSON(res.data, nombre);
  };

  // ---- Handlers import ----
  const handleElegirArchivo = async (file: File) => {
    setArchivoNombre(file.name);
    setBackupCargado(null);
    setAnalisis(null);
    setErrorArchivo("");
    setMensajeExito("");

    const res = await leerArchivoJSON(file);
    if (!res.ok || !res.data) {
      setErrorArchivo(res.error ?? "No se pudo leer el archivo.");
      return;
    }

    const analisisRes = await analizarBackup(res.data);
    setBackupCargado(res.data);
    setAnalisis(analisisRes);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleElegirArchivo(file);
  };

  const handleLimpiarImport = () => {
    setArchivoNombre("");
    setBackupCargado(null);
    setAnalisis(null);
    setErrorArchivo("");
    setMensajeExito("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImportar = async (modo: "nuevo" | "reemplazar") => {
    if (!backupCargado) return;

    if (modo === "reemplazar") {
      const texto = prompt(
        'Esta acción BORRA y REEMPLAZA lo existente. Escribí "CONFIRMO" (todo en mayúsculas) para continuar:'
      );
      if (texto !== "CONFIRMO") {
        alert("Cancelado. No se importó nada.");
        return;
      }
    }

    setImportando(true);
    const res = await importarBackup(backupCargado, modo);
    setImportando(false);

    if (!res.ok) {
      alert(`Error importando: ${res.error ?? "desconocido"}`);
      return;
    }

    setMensajeExito(
      modo === "nuevo"
        ? "✅ Importado como nuevo."
        : "✅ Reemplazado correctamente."
    );

    // Refrescar lista de equipos
    const { data } = await supabase
      .from("equipos")
      .select("id, nombre")
      .order("nombre");
    if (data) setEquipos(data);

    // Limpiar después de 2 segundos
    setTimeout(() => {
      handleLimpiarImport();
    }, 2200);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          💾 Backup de datos
        </h2>
        <p className="text-sm text-slate-500">
          Exportá un equipo o un partido a un archivo JSON. Importá ese
          archivo en otra base o en otro navegador para recuperarlo.
        </p>
      </div>

      {/* ============ EXPORTAR EQUIPO ============ */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-800 mb-1">
          📦 Exportar un equipo completo
        </h3>
        <p className="text-xs text-slate-500 mb-3">
          Incluye jugadores, asignaciones, todos los partidos, puntos,
          acciones y datos legacy.
        </p>
        <div className="flex gap-2 flex-wrap items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Equipo
            </label>
            <select
              value={equipoExportId}
              onChange={(e) => setEquipoExportId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500"
              disabled={cargandoEquipos}
            >
              <option value="">— Elegí un equipo —</option>
              {equipos.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.nombre}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleExportarEquipo}
            disabled={!equipoExportId || exportandoEquipo}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white font-medium rounded-lg text-sm"
          >
            {exportandoEquipo ? "Exportando..." : "⬇️ Exportar equipo"}
          </button>
        </div>
      </div>

      {/* ============ EXPORTAR PARTIDO ============ */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-800 mb-1">
          📄 Exportar un solo partido
        </h3>
        <p className="text-xs text-slate-500 mb-3">
          Incluye datos del partido, puntos, acciones y legacy.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Equipo
            </label>
            <select
              value={equipoPartidoId}
              onChange={(e) => setEquipoPartidoId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500"
            >
              <option value="">— Elegí un equipo —</option>
              {equipos.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Partido
            </label>
            <select
              value={partidoExportId}
              onChange={(e) => setPartidoExportId(e.target.value)}
              disabled={!equipoPartidoId}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-500 disabled:bg-slate-100"
            >
              <option value="">
                {equipoPartidoId
                  ? "— Elegí un partido —"
                  : "Primero elegí equipo"}
              </option>
              {partidos.map((p) => (
                <option key={p.id} value={p.id}>
                  vs {p.rival} · {p.fecha}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 text-right">
          <button
            onClick={handleExportarPartido}
            disabled={!partidoExportId || exportandoPartido}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white font-medium rounded-lg text-sm"
          >
            {exportandoPartido ? "Exportando..." : "⬇️ Exportar partido"}
          </button>
        </div>
      </div>

      {/* ============ IMPORTAR ============ */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-800 mb-1">
          ⬆️ Importar un backup
        </h3>
        <p className="text-xs text-slate-500 mb-3">
          Elegí un archivo <code className="bg-slate-100 px-1 rounded">.json</code>{" "}
          que hayas exportado antes.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleInputChange}
          className="block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-fuchsia-100 file:text-fuchsia-700 hover:file:bg-fuchsia-200 file:cursor-pointer"
        />

        {archivoNombre && (
          <p className="mt-2 text-xs text-slate-500">
            Archivo: <span className="font-mono">{archivoNombre}</span>
          </p>
        )}

        {errorArchivo && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
            ❌ {errorArchivo}
          </div>
        )}

        {analisis && backupCargado && (
          <div className="mt-4 border border-slate-200 rounded-lg p-4 bg-slate-50">
            <h4 className="font-semibold text-slate-800 mb-2">
              Vista previa del archivo
            </h4>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-slate-500">Tipo:</span>{" "}
                <span className="font-medium text-slate-800">
                  {analisis.tipo === "equipo" ? "Equipo completo" : "Partido"}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Exportado el:</span>{" "}
                <span className="font-medium text-slate-800">
                  {new Date(analisis.exportadoEl).toLocaleString()}
                </span>
              </div>

              {analisis.tipo === "equipo" && (
                <>
                  <div>
                    <span className="text-slate-500">Equipo:</span>{" "}
                    <span className="font-medium text-slate-800">
                      {analisis.resumen.equipo ?? "?"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Jugadores:</span>{" "}
                    <span className="font-medium text-slate-800">
                      {analisis.resumen.jugadores ?? 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Partidos:</span>{" "}
                    <span className="font-medium text-slate-800">
                      {analisis.resumen.partidos ?? 0}
                    </span>
                  </div>
                </>
              )}

              {analisis.tipo === "partido" && (
                <>
                  <div>
                    <span className="text-slate-500">Rival:</span>{" "}
                    <span className="font-medium text-slate-800">
                      {analisis.resumen.rival ?? "?"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Fecha:</span>{" "}
                    <span className="font-medium text-slate-800">
                      {analisis.resumen.fecha ?? "?"}
                    </span>
                  </div>
                </>
              )}

              <div>
                <span className="text-slate-500">Puntos:</span>{" "}
                <span className="font-medium text-slate-800">
                  {analisis.resumen.puntos ?? 0}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Acciones V2:</span>{" "}
                <span className="font-medium text-slate-800">
                  {analisis.resumen.acciones ?? 0}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500">Acciones V1 (legacy):</span>{" "}
                <span className="font-medium text-slate-800">
                  {analisis.resumen.accionesV1 ?? 0}
                </span>
              </div>
            </div>

            <div className="mt-4">
              {analisis.tipo === "equipo" &&
                (analisis.idsEnConflicto.existeEquipo ? (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-900">
                    ⚠️ Ya existe un equipo con este ID. Elegí qué hacer:
                  </div>
                ) : (
                  <div className="p-3 bg-green-50 border border-green-300 rounded-lg text-sm text-green-900">
                    ✅ No hay conflicto. Se puede importar como nuevo.
                  </div>
                ))}

              {analisis.tipo === "partido" &&
                (analisis.idsEnConflicto.existePartido ? (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-900">
                    ⚠️ Ya existe un partido con este ID. Elegí qué hacer:
                  </div>
                ) : (
                  <div className="p-3 bg-green-50 border border-green-300 rounded-lg text-sm text-green-900">
                    ✅ No hay conflicto. Se puede importar como nuevo.
                  </div>
                ))}
            </div>

            {mensajeExito && (
              <div className="mt-3 p-3 bg-green-100 border border-green-300 rounded-lg text-sm text-green-900">
                {mensajeExito}
              </div>
            )}

            {!mensajeExito && (
              <div className="mt-4 flex gap-2 flex-wrap">
                <button
                  onClick={() => handleImportar("nuevo")}
                  disabled={importando}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white font-medium rounded-lg text-sm"
                >
                  {importando ? "Importando..." : "✅ Importar como nuevo"}
                </button>

                {((analisis.tipo === "equipo" &&
                  analisis.idsEnConflicto.existeEquipo) ||
                  (analisis.tipo === "partido" &&
                    analisis.idsEnConflicto.existePartido)) && (
                  <button
                    onClick={() => handleImportar("reemplazar")}
                    disabled={importando}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-slate-300 text-white font-medium rounded-lg text-sm"
                  >
                    {importando
                      ? "Reemplazando..."
                      : "⚠️ Reemplazar existente"}
                  </button>
                )}

                <button
                  onClick={handleLimpiarImport}
                  disabled={importando}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-lg text-sm"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}