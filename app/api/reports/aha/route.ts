import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { ReportScope } from '@/lib/reports/engine';
import { fetchMegacodeReport } from '@/lib/reports/aha/megacode';
import { renderMegacodeDocument, type SignoffInstructor } from '@/lib/reports/aha/megacodeForm';

/**
 * AHA Results Export — render endpoint (staff). Returns a self-contained styled
 * HTML document (print-to-PDF, NREMT pattern), NOT JSON.
 *
 * GET /api/reports/aha?template=megacode&cohortId=…|studentId=…
 *     [&instructorId=…]  resolve a sign-off instructor (name/AHA#/signature)
 *     [&print=1]         auto-open the browser print dialog
 *     [&course=acls|pals]
 *
 * Other templates (airway, adult_bls, infant_cpr) register as they are built.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  const p = request.nextUrl.searchParams;
  const template = p.get('template') ?? 'megacode';
  const cohortId = p.get('cohortId');
  const studentId = p.get('studentId');
  const instructorId = p.get('instructorId');
  const autoPrint = p.get('print') === '1';
  const course = (p.get('course') === 'pals' ? 'pals' : 'acls') as 'acls' | 'pals';

  if (!cohortId && !studentId) {
    return NextResponse.json({ success: false, error: 'cohortId or studentId required' }, { status: 400 });
  }
  const scope: ReportScope = studentId
    ? { kind: 'student', studentId }
    : { kind: 'cohort', cohortId: cohortId! };

  // optional sign-off instructor (must have AHA info to be meaningful)
  let instructor: SignoffInstructor | null = null;
  if (instructorId) {
    const { data } = await getSupabaseAdmin()
      .from('lab_users')
      .select('name, aha_instructor_number, signature_data, signature_kind')
      .eq('id', instructorId)
      .single();
    if (data) {
      instructor = {
        name: data.name, ahaNumber: data.aha_instructor_number,
        signatureData: data.signature_data, signatureKind: data.signature_kind,
      };
    }
  }

  if (template === 'megacode') {
    const report = await fetchMegacodeReport(scope, { course });
    if (instructor) for (const r of report.rows) (r as { instructor?: SignoffInstructor }).instructor = instructor;
    const html = renderMegacodeDocument(report, { autoPrint });
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  return NextResponse.json({ success: false, error: `unknown or not-yet-built template "${template}"` }, { status: 400 });
}
