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
//   1. Busca todos los elementos con [data-pdf-cerrado="true"] dentro
//      del contenedor y guarda una lista de los que hay que reabrir
//      después. Después les hace click (para abrir acordeones).
//   2. Espera un tick para que React re-renderice y terminen las
//      animaciones.
//   3. Saca una "foto" con html2canvas.
//   4. Vuelve a clickear los que estaban cerrados (para dejarlos
//      como estaban).
//   5. Genera el PDF A4 paginado y lo descarga.
//
// Para marcar un acordeón que debe abrirse en el PDF, agregá en el
// botón que abre/cierra el acordeón el atributo:
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

/**
 * Devuelve los elementos acordeón que están cerrados dentro del
 * contenedor. Filtra por [data-pdf-acordeon][data-pdf-cerrado="true"].
 */
function buscarAcordeonesCerrados(contenedor: HTMLElement): HTMLElement[] {
  const todos = Array.from(
    contenedor.querySelectorAll<HTMLElement>(
      '[data-pdf-acordeon][data-pdf-cerrado="true"]'
    )
  );
  return todos;
}

function abrirAcordeones(elementos: HTMLElement[]): void {
  for (const el of elementos) {
    el.click();
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
    // Ignorar la toolbar que puede haber quedado en pantalla
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

  // Tamaño que ocuparía la imagen entera escalada al ancho útil del PDF
  const anchoEscalado = anchoUtil;
  const altoEscalado = (altoImg * anchoUtil) / anchoImg;

  // Si entra en una sola página, la metemos directo.
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

  // Si no entra, paginamos por franjas.
  // Cuántos px de la imagen equivalen a un alto de página útil:
  const pxPorMm = anchoImg / anchoUtil;
  const altoPaginaPx = altoUtil * pxPorMm;

  let yPx = 0;
  let primeraPagina = true;

  while (yPx < altoImg) {
    const altoFranjaPx = Math.min(altoPaginaPx, altoImg - yPx);

    // Recortamos la franja del canvas original
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
 *
 * @param elemento  El nodo raíz a capturar (con useRef).
 * @param nombreBase Nombre del archivo sin extensión (se sanitiza).
 * @param titulo    Título que aparece arriba del PDF. Opcional.
 */
export async function descargarComoPDF(
  elemento: HTMLElement,
  nombreBase: string,
  titulo?: string
): Promise<void> {
  // 1. Abrir acordeones cerrados
  const cerrados = buscarAcordeonesCerrados(elemento);
  abrirAcordeones(cerrados);
  await esperar(ESPERA_RENDER_MS);

  try {
    // 2. Capturar
    const canvas = await capturarElemento(elemento);

    // 3. Volver a cerrar los que estaban cerrados (dejarlos como antes)
    //    Lo hacemos después de capturar pero antes de armar el PDF,
    //    para que el usuario no vea el cambio por mucho tiempo.
    abrirAcordeones(cerrados); // volver a clickear cierra si estaba cerrado

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
    // eslint-disable-next-line no-console
    console.error("Error generando PDF:", err);
    alert(
      "No se pudo generar el PDF. Probá de nuevo o achicá el zoom del navegador."
    );
  }
}