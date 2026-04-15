/**
 * NREMT skill sheet packet export.
 *
 * Simpler approach (replaces the prior html2pdf.js / hidden-iframe
 * pipeline): the server now returns a fully-styled HTML document built
 * from lib/skillSheetPrintTemplate.ts — the same template the
 * single-skill Print Score Sheet uses. That document has a
 * `window.print()` auto-trigger and a top Print/Save as PDF button, so
 * all we need to do on the client is open it in a new tab.
 *
 * This removes an entire class of bugs we fought on NREMT day:
 *   - black boxes on half-full pages (JPEG alpha flattening)
 *   - blank pages (iframe styles not loading before raster)
 *   - font/SVG clipping under html2canvas
 *
 * Browser's native print-to-PDF handles page breaks, fonts, SVGs,
 * sub-pixel rendering, and filename selection via Content-Disposition.
 */
export async function downloadStudentPDF(
  labDayId: string,
  studentId: string,
  _studentName: string,
  _date: string
): Promise<void> {
  // `print=1` tells the endpoint to append an auto-print script so the
  // browser's print dialog opens automatically in the new tab. The user
  // can cancel and use the top Print button instead if they want.
  const url = `/api/lab-management/lab-days/${labDayId}/student-pdf?student_id=${studentId}&print=1`;
  const win = window.open(url, '_blank');
  if (!win) {
    // Popup blocked — fall back to same-tab navigation
    window.location.href = url;
  }
}
