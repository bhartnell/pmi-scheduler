import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { configureExistingCohortDay } from '@/lib/aha-course-generator';

// GET /api/admin/aha-courses/configure-day?cert_course=pals  -> candidate templates
// GET /api/admin/aha-courses/configure-day?cohort_id=...     -> that cohort's lab_days (picker)
export async function GET(request: NextRequest) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  const certCourse = request.nextUrl.searchParams.get('cert_course');
  const cohortId = request.nextUrl.searchParams.get('cohort_id');
  const supabase = getSupabaseAdmin();

  try {
    if (certCourse) {
      const { data, error } = await supabase
        .from('lab_day_templates')
        .select('id, name, day_number, section_number, section_label')
        .eq('category', 'certification')
        .eq('cert_course', certCourse)
        .order('day_number', { ascending: true });
      if (error) throw error;
      return NextResponse.json({ success: true, templates: data || [] });
    }
    if (cohortId) {
      const { data, error } = await supabase
        .from('lab_days')
        .select('id, date, section_number, section_label, cert_course, is_adv_cert_testing, source_template_id')
        .eq('cohort_id', cohortId)
        .order('date', { ascending: true });
      if (error) throw error;
      return NextResponse.json({ success: true, lab_days: data || [] });
    }
    return NextResponse.json({ error: 'cert_course or cohort_id is required' }, { status: 400 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/aha-courses/configure-day
//
// Task Handoff Queue Checkpoint B: "configure existing day" mode. Attaches an
// AHA course template's structure onto a lab_days row that already exists —
// the gap the Checkpoint A generator (INSERT-only) deliberately doesn't fill.
// Gap-fill only: never overwrites a field/station that already has a real
// value; anything that would require that is reported as a conflict and left
// untouched. See lib/aha-course-generator.ts for the full guardrail rationale.
//
// Body: { lab_day_id: string, template_id: string,
//         dry_run?: boolean (default true — callers must explicitly opt out) }
//
// Requires admin+ role.
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    const body = (await request.json()) as {
      lab_day_id?: string;
      template_id?: string;
      dry_run?: boolean;
    };
    const { lab_day_id, template_id } = body;
    const dryRun = body.dry_run !== false; // default true — explicit opt-out required to write

    if (!lab_day_id || !template_id) {
      return NextResponse.json({ error: 'lab_day_id and template_id are required' }, { status: 400 });
    }

    const result = await configureExistingCohortDay({ labDayId: lab_day_id, templateId: template_id, dryRun });
    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error configuring existing AHA day:', msg, error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
