/**
 * NREMT skill sheet PDF export.
 *
 * Renders the server-provided HTML inside a hidden iframe so its own <head>
 * styles (Tailwind/print CSS) attach before html2pdf.js snapshots the DOM.
 * Rendering into a plain <div> on the host page loses those styles, which
 * was producing visually-blank pages.
 */
export async function downloadStudentPDF(
  labDayId: string,
  studentId: string,
  studentName: string,
  date: string
): Promise<void> {
  // 1. Fetch full HTML document from the student-pdf endpoint
  const res = await fetch(`/api/lab-management/lab-days/${labDayId}/student-pdf?student_id=${studentId}`);
  if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.statusText}`);
  const html = await res.text();

  // 2. Create a hidden iframe and write the full HTML document into it so
  //    inline <style> blocks and <link> tags are applied before rasterizing.
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.top = '0';
  iframe.style.width = '816px'; // ~8.5in at 96dpi
  iframe.style.height = '1056px'; // ~11in at 96dpi
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument;
    if (!doc) throw new Error('Unable to access iframe document');

    doc.open();
    doc.write(html);
    doc.close();

    // Wait for iframe images/fonts to load so html2canvas sees painted content
    await new Promise<void>((resolve) => {
      if (doc.readyState === 'complete') {
        resolve();
      } else {
        iframe.addEventListener('load', () => resolve(), { once: true });
        // Safety timeout in case the load event never fires
        setTimeout(() => resolve(), 1500);
      }
    });
    // Extra paint tick
    await new Promise((r) => setTimeout(r, 200));

    // 3. Generate PDF via html2pdf.js targeted at the iframe body
    const html2pdf = (await import('html2pdf.js')).default;

    const nameParts = studentName.split(' ');
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : studentName;
    const firstName = nameParts[0];
    const filename = `NREMT_${date}_${lastName}_${firstName}.pdf`;

    const target = doc.body;

    // Belt-and-suspenders: the server HTML explicitly sets body/html
    // background to #ffffff, and html2canvas is also told to use a white
    // backgroundColor. Without the explicit backgroundColor option
    // html2canvas defaults to 'transparent', which jsPDF then renders as
    // black in the saved PDF — that was the "black background rough
    // version" symptom reported on NREMT day.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await html2pdf().set({
      margin: [10, 10, 10, 10],
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      },
      jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'], before: '.page-break-before' },
    } as any).from(target).save();
  } finally {
    // 4. Cleanup
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  }
}
