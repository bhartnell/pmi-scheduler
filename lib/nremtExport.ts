export async function downloadStudentPDF(
  labDayId: string,
  studentId: string,
  studentName: string,
  date: string
): Promise<void> {
  // 1. Fetch HTML from the student-pdf endpoint
  const res = await fetch(`/api/lab-management/lab-days/${labDayId}/student-pdf?student_id=${studentId}`);
  if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.statusText}`);
  const html = await res.text();

  // 2. Create a hidden container, inject HTML
  const container = document.createElement('div');
  // Strip the <html><head><body> wrapper if present — extract body content
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) {
    container.innerHTML = bodyMatch[1];
  } else {
    container.innerHTML = html;
  }
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  document.body.appendChild(container);

  // 3. Generate PDF with html2pdf.js (dynamic import matching existing pattern)
  const html2pdf = (await import('html2pdf.js')).default;

  const nameParts = studentName.split(' ');
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : studentName;
  const firstName = nameParts[0];
  const filename = `NREMT_${date}_${lastName}_${firstName}.pdf`;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await html2pdf().set({
      margin: [10, 10, 10, 10],
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'], before: '.page-break-before' },
    } as any).from(container).save();
  } finally {
    // 4. Cleanup
    document.body.removeChild(container);
  }
}

export async function downloadAllStudentPDFs(
  labDayId: string,
  students: Array<{ id: string; name: string }>,
  date: string,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  for (let i = 0; i < students.length; i++) {
    onProgress?.(i + 1, students.length);
    await downloadStudentPDF(labDayId, students[i].id, students[i].name, date);
    // Delay between downloads to avoid browser blocking
    if (i < students.length - 1) {
      await new Promise(r => setTimeout(r, 1500));
    }
  }
}
