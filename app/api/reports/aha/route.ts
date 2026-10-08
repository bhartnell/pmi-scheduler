import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { ReportScope } from '@/lib/reports/engine';
import { fetchMegacodeReport, AHA_MEGACODE_VARIANTS } from '@/lib/reports/aha/megacode';
import { renderMegacodeDocument, renderBlankMegacodeDocument, type SignoffInstructor } from '@/lib/reports/aha/megacodeForm';
import { fetchScopeStudents, fetchCourseDate } from '@/lib/reports/roster';
import { SKILLS_FORMS, renderSkillsDocument } from '@/lib/reports/aha/skillsForms';

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

  // BLANK forms for paper rounds: names/group/date filled, nothing scored.
  // [&blank=1][&labGroupId=…][&date=YYYY-MM-DD][&variant=<code e.g. 2/5>] (megacode needs variant)
  if (p.get('blank') === '1') {
    const students = await fetchScopeStudents(scope);
    let roster = students;
    let groupName: string | null = null;
    const labGroupId = p.get('labGroupId');
    if (labGroupId) {
      // Scope to one group; never fall back to the whole cohort if the group can't be resolved.
      const sb = getSupabaseAdmin();
      const { data: members, error: memErr } = await sb.from('lab_group_members').select('student_id').eq('lab_group_id', labGroupId);
      if (memErr) return NextResponse.json({ success: false, error: 'could not read group members' }, { status: 500 });
      const { data: grp } = await sb.from('lab_groups').select('name').eq('id', labGroupId).maybeSingle();
      groupName = grp?.name ?? null;
      const ids = new Set((members || []).map((m: { student_id: string }) => m.student_id));
      roster = students.filter((s) => ids.has(s.id));
    }
    if (roster.length === 0) return NextResponse.json({ success: false, error: 'no students in scope' }, { status: 404 });
    const rawDate = p.get('date');
    const [yy, mm, dd] = (rawDate ?? '').split('-').map(Number);
    const dateStr = yy ? `${mm}/${dd}/${yy}` : '';
    if (template === 'megacode') {
      const variant = Object.values(AHA_MEGACODE_VARIANTS).find((v) => v.code === p.get('variant'));
      if (!variant) return NextResponse.json({ success: false, error: 'variant required for blank megacode (e.g. 2/5)' }, { status: 400 });
      const html = renderBlankMegacodeDocument(roster, variant, { dateStr, groupName });
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    if (SKILLS_FORMS[template]) {
      const html = renderSkillsDocument(SKILLS_FORMS[template], roster, { autoPrint, course, courseDate: rawDate, blank: { groupName } });
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
  }

  // optional sign-off instructor (must have AHA info to be meaningful)
  let instructor: SignoffInstructor | null = null;
  if (instructorId) {
    const { data } = await getSupabaseAdmin()
      .from('lab_users')
      .select('name, aha_instructor_number, signature_data, signature_kind, signature_text, signature_face')
      .eq('id', instructorId)
      .single();
    if (data) {
      instructor = {
        name: data.name, ahaNumber: data.aha_instructor_number,
        signatureData: data.signature_data, signatureKind: data.signature_kind,
        signatureText: data.signature_text, signatureFace: data.signature_face,
      };
    }
  }

  if (template === 'megacode') {
    const report = await fetchMegacodeReport(scope, { course });
    if (instructor) for (const r of report.rows) (r as { instructor?: SignoffInstructor }).instructor = instructor;
    const html = renderMegacodeDocument(report, { autoPrint });
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  // Skills checklists (auto-complete as PASS): airway, adult_bls
  if (SKILLS_FORMS[template]) {
    const students = await fetchScopeStudents(scope);
    const courseDate = await fetchCourseDate(scope, course);
    const html = renderSkillsDocument(SKILLS_FORMS[template], students, { autoPrint, instructor, courseDate, course });
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  return NextResponse.json(
    { success: false, error: `unknown or not-yet-built template "${template}" (available: megacode, ${Object.keys(SKILLS_FORMS).join(', ')})` },
    { status: 400 },
  );
}
