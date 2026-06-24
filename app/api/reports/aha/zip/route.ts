import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { formatCohortNumber } from '@/lib/format-cohort';
import { fetchMegacodeReport } from '@/lib/reports/aha/megacode';
import { renderMegacodeDocument, type SignoffInstructor } from '@/lib/reports/aha/megacodeForm';
import { renderSkillsDocument, SKILLS_FORMS } from '@/lib/reports/aha/skillsForms';
import { composeStudentPacketHTML, packetFilename } from '@/lib/reports/aha/packet';
import type { RosterStudent } from '@/lib/reports/roster';
import JSZip from 'jszip';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

// Headless-Chrome PDF rendering for a whole cohort takes time; allow headroom.
export const maxDuration = 180;

/**
 * GET /api/reports/aha/zip  (staff)
 *
 * Bundles the AHA results as a .zip of REAL PDFs (server-rendered via headless
 * Chrome), so files come PRE-SEPARATED — no Adobe extraction.
 *
 *   ?cohortId=…            required
 *   &grouping=student      (default) one combined PDF per student
 *                          (megacode + airway + adult BLS + infant CPR),
 *                          named LastName_FirstName_ACLS_Results.pdf
 *   &grouping=section      one PDF per form type (all students), for AHA records
 *   &instructorId=…        sign-off instructor (name/AHA#/signature)
 *   &course=acls|pals
 *
 * Excused / no-attempt students are omitted from the per-student ZIP.
 */
export async function GET(request: NextRequest) {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const p = request.nextUrl.searchParams;
    const cohortId = p.get('cohortId');
    const grouping = p.get('grouping') === 'section' ? 'section' : 'student';
    const instructorId = p.get('instructorId');
    const course = (p.get('course') === 'pals' ? 'pals' : 'acls') as 'acls' | 'pals';
    if (!cohortId) return NextResponse.json({ success: false, error: 'cohortId required' }, { status: 400 });

    const supabase = getSupabaseAdmin();

    // sign-off instructor (optional)
    let instructor: SignoffInstructor | null = null;
    if (instructorId) {
      const { data } = await supabase.from('lab_users')
        .select('name, aha_instructor_number, signature_data, signature_kind').eq('id', instructorId).single();
      if (data) instructor = { name: data.name, ahaNumber: data.aha_instructor_number, signatureData: data.signature_data, signatureKind: data.signature_kind };
    }

    const { data: cohort } = await supabase.from('cohorts').select('cohort_number').eq('id', cohortId).single();
    const cohortLabel = cohort?.cohort_number ? `Cohort${formatCohortNumber(cohort.cohort_number)}` : 'Cohort';

    const report = await fetchMegacodeReport({ kind: 'cohort', cohortId }, { course });
    if (report.rows.length === 0) return NextResponse.json({ success: false, error: 'no students in cohort' }, { status: 404 });

    // Build the list of (filename, html) docs to render.
    const docs: Array<{ filename: string; html: string }> = [];
    if (grouping === 'student') {
      for (const row of report.rows) {
        if (!row.best) continue; // skip excused / no scorable attempt — no student file
        docs.push({
          filename: packetFilename(row.student.lastName, row.student.firstName),
          html: composeStudentPacketHTML(row, instructor),
        });
      }
    } else {
      // by section: one PDF per form type (all students)
      const students: RosterStudent[] = report.rows.map((r) => r.student);
      if (instructor) for (const r of report.rows) (r as { instructor?: SignoffInstructor }).instructor = instructor;
      docs.push({ filename: 'Megacode_Testing_AllStudents.pdf', html: renderMegacodeDocument(report) });
      docs.push({ filename: 'Airway_Skills_AllStudents.pdf', html: renderSkillsDocument(SKILLS_FORMS.airway, students, { instructor }) });
      docs.push({ filename: 'Adult_BLS_Skills_AllStudents.pdf', html: renderSkillsDocument(SKILLS_FORMS.adult_bls, students, { instructor }) });
      docs.push({ filename: 'Infant_CPR_Skills_AllStudents.pdf', html: renderSkillsDocument(SKILLS_FORMS.infant_cpr, students, { instructor }) });
    }
    if (docs.length === 0) return NextResponse.json({ success: false, error: 'nothing to export (no eligible students)' }, { status: 404 });

    // Render each HTML → PDF and zip.
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
    const zip = new JSZip();
    for (const { filename, html } of docs) {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBytes = await page.pdf({
        format: 'letter', printBackground: true,
        margin: { top: '0.4in', bottom: '0.4in', left: '0.4in', right: '0.4in' },
      });
      await page.close();
      zip.file(filename, pdfBytes);
    }
    await browser.close();
    browser = null;

    const zipFilename = grouping === 'student'
      ? `ACLS_${cohortLabel}_StudentResults.zip`
      : `ACLS_${cohortLabel}_BySection.zip`;
    const zipArrayBuffer = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });

    return new Response(zipArrayBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFilename}"`,
        'Content-Length': String(zipArrayBuffer.byteLength),
      },
    });
  } catch (error) {
    console.error('[aha-zip] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate ZIP' }, { status: 500 });
  } finally {
    if (browser) { try { await browser.close(); } catch { /* ignore */ } }
  }
}
