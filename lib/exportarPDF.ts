// ============================================================
// EXPORTAR A PDF — helper compartido
// ============================================================
//
// Uso típico desde una pantalla:
//
//   import { useRef } from "react";
//   import { descargarComoPDF } from "@/lib/exportarPDF";
//
//   const ref = useRef<HTMLDivElement>(null);
//   ...
//   <div ref={ref}> ...contenido... </div>
//   <button onClick={() => ref.current && descargarComoPDF(ref.current, "dashboard")}>
//     Descargar PDF
//   </button>
//
// Qué hace:
//   1. Abre TODOS los acordeones cerrados dentro del contenedor.
//      Lo hace en varias PASADAS, porque al abrir un acordeón pueden
//      aparecer nuevos acordeones internos (ej. "Ver detalle" de un
//      jugador muestra botones "Valoraciones" que también son
//      acordeones). Sigue hasta que no haya más o llegue al límite.
//   2. Espera un tick para que React re-renderice.
//   3. Saca una "foto" con html2canvas.
//   4. Cierra los acordeones en el orden inverso al que los abrió
//      (así vuelven a quedar como estaban).
//   5. Genera el PDF A4 paginado y lo descarga.
//
// Para marcar un acordeón, agregá en el botón que abre/cierra:
//
//     data-pdf-acordeon
//
// y cuando esté cerrado, además:
//
//     data-pdf-cerrado="true"
//
// El helper solo actúa sobre los que estén marcados como cerrados.
// ============================================================

import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

// ------------------------------------------------------------
// CONFIGURACIÓN
// ------------------------------------------------------------

const A4_ANCHO_MM = 210;
const A4_ALTO_MM = 297;
const MARGEN_MM = 8;

const ANCHO_UTIL_MM = A4_ANCHO_MM - MARGEN_MM * 2;
const ALTO_UTIL_MM = A4_ALTO_MM - MARGEN_MM * 2;

/** Resolución de captura. 2 = el doble (más nítido, más pesado). */
const ESCALA_CAPTURA = 2;

/** Cuánto esperar entre abrir acordeones y capturar (ms). */
const ESPERA_RENDER_MS = 350;

/** Cuántas pasadas máximo hacemos abriendo acordeones en cascada. */
const MAX_PASADAS = 4;

// ------------------------------------------------------------
// HELPERS INTERNOS
// ------------------------------------------------------------

function esperar(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

function limpiarNombreArchivo(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // sin tildes
    .replace(/[^\w\s-]/g, "") // sin caracteres raros
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
}

function fechaCorta(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

// ------------------------------------------------------------
// CONTROL DE ACORDEONES
// ------------------------------------------------------------

function buscarAcordeonesCerrados(contenedor: HTMLElement): HTMLElement[] {
  return Array.from(
    contenedor.querySelectorAll<HTMLElement>(
      '[data-pdf-acordeon][data-pdf-cerrado="true"]'
    )
  );
}

/**
 * Abre todos los acordeones cerrados, en varias pasadas. Devuelve el
 * registro de los que abrió, por pasada, para poder cerrarlos después
 * en el orden inverso.
 */
async function abrirAcordeonesEnCascada(
  contenedor: HTMLElement
): Promise<HTMLElement[][]> {
  const cerradosPorPasada: HTMLElement[][] = [];

  for (let i = 0; i < MAX_PASADAS; i++) {
    const cerrados = buscarAcordeonesCerrados(contenedor);
    if (cerrados.length === 0) break;
    cerradosPorPasada.push(cerrados);
    for (const el of cerrados) el.click();
    await esperar(ESPERA_RENDER_MS);
  }

  return cerradosPorPasada;
}

/**
 * Cierra los acordeones en el orden inverso al que se abrieron:
 * primero los internos (los de la última pasada), después los de
 * afuera. Así vuelven a su estado original.
 */
function cerrarAcordeonesEnOrdenInverso(
  cerradosPorPasada: HTMLElement[][]
): void {
  for (let i = cerradosPorPasada.length - 1; i >= 0; i--) {
    for (const el of cerradosPorPasada[i]) {
      el.click();
    }
  }
}

// ------------------------------------------------------------
// CAPTURA
// ------------------------------------------------------------

async function capturarElemento(
  elemento: HTMLElement
): Promise<HTMLCanvasElement> {
  return html2canvas(elemento, {
    scale: ESCALA_CAPTURA,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    ignoreElements: (el) => el.hasAttribute("data-pdf-ignorar"),
  });
}

// ------------------------------------------------------------
// ARMADO DEL PDF
// ------------------------------------------------------------

function agregarCanvasAlPDF(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  anchoUtil: number,
  altoUtil: number
): void {
  const anchoImg = canvas.width;
  const altoImg = canvas.height;

  const anchoEscalado = anchoUtil;
  const altoEscalado = (altoImg * anchoUtil) / anchoImg;

  if (altoEscalado <= altoUtil) {
    pdf.addImage(
      canvas.toDataURL("image/jpeg", 0.92),
      "JPEG",
      MARGEN_MM,
      MARGEN_MM,
      anchoEscalado,
      altoEscalado
    );
    return;
  }

  // Paginado por franjas
  const pxPorMm = anchoImg / anchoUtil;
  const altoPaginaPx = altoUtil * pxPorMm;

  let yPx = 0;
  let primeraPagina = true;

  while (yPx < altoImg) {
    const altoFranjaPx = Math.min(altoPaginaPx, altoImg - yPx);

    const franjaCanvas = document.createElement("canvas");
    franjaCanvas.width = anchoImg;
    franjaCanvas.height = altoFranjaPx;

    const ctx = franjaCanvas.getContext("2d");
    if (!ctx) break;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, anchoImg, altoFranjaPx);
    ctx.drawImage(
      canvas,
      0,
      yPx,
      anchoImg,
      altoFranjaPx,
      0,
      0,
      anchoImg,
      altoFranjaPx
    );

    if (!primeraPagina) pdf.addPage();
    primeraPagina = false;

    const altoFranjaMm = (altoFranjaPx * anchoUtil) / anchoImg;

    pdf.addImage(
      franjaCanvas.toDataURL("image/jpeg", 0.92),
      "JPEG",
      MARGEN_MM,
      MARGEN_MM,
      anchoUtil,
      altoFranjaMm
    );

    yPx += altoFranjaPx;
  }
}

// ------------------------------------------------------------
// FUNCIÓN PRINCIPAL
// ------------------------------------------------------------

/**
 * Captura el contenido del elemento y descarga un PDF A4 paginado.
 * Abre todos los acordeones cerrados (en cascada) y los vuelve a
 * dejar como estaban después de capturar.
 */
export async function descargarComoPDF(
  elemento: HTMLElement,
  nombreBase: string,
  titulo?: string
): Promise<void> {
  // 1. Abrir acordeones cerrados (en varias pasadas)
  const cerradosPorPasada = await abrirAcordeonesEnCascada(elemento);

  try {
    // 2. Capturar
    const canvas = await capturarElemento(elemento);

    // 3. Cerrar en orden inverso
    cerrarAcordeonesEnOrdenInverso(cerradosPorPasada);

    // 4. Armar PDF
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    pdf.setProperties({
      title: titulo ?? nombreBase,
      creator: "VoleyStats",
    });

    agregarCanvasAlPDF(pdf, canvas, ANCHO_UTIL_MM, ALTO_UTIL_MM);

    // 5. Descargar
    const archivo = `${limpiarNombreArchivo(nombreBase)}-${fechaCorta()}.pdf`;
    pdf.save(archivo);
  } catch (err) {
    // Si falla algo, igual intentamos dejar los acordeones como estaban
    cerrarAcordeonesEnOrdenInverso(cerradosPorPasada);
    // eslint-disable-next-line no-console
    console.error("Error generando PDF:", err);
    alert(
      "No se pudo generar el PDF. Probá de nuevo o achicá el zoom del navegador."
    );
  }
}