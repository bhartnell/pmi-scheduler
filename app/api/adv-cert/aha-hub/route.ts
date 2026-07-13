import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

/**
 * GET /api/adv-cert/aha-hub
 *
 * READ-ONLY aggregator for the top-level AHA hub (AHA HUB + ACLS REPEATABLE
 * Phase 1, Task Handoff Queue). Lists every cohort that has ACLS and/or PALS
 * lab_days, one row per (cohort, cert_course), plus how many "certification"
 * lab_day_templates exist per course so the hub can surface the known
 * cert_course-template gap instead of silently looking empty.
 *
 * Purely additive read: no writes, does not replace /labs/acls-hub or
 * /labs/pals/grade.
 */
export async function GET() {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  const supabase = getSupabaseAdmin();

  try {
    const { data: labDaysRaw, error: ldErr } = await supabase
      .from('lab_days')
      .select(
        `cohort_id, cert_course, date, is_adv_cert_testing,
         cohort:cohorts(id, cohort_number, program:programs(abbreviation, name))`
      )
      .in('cert_course', ['acls', 'pals'])
      .eq('is_archived', false)
      .order('date', { ascending: true });
    if (ldErr) throw ldErr;

    const { data: templateRows, error: tplErr } = await supabase
      .from('lab_day_templates')
      .select('cert_course')
      .eq('category', 'certification');
    if (tplErr) throw tplErr;

    const templatesAvailable: Record<string, number> = { acls: 0, pals: 0 };
    for (const row of templateRows || []) {
      const course = (row as { cert_course: string | null }).cert_course;
      if (course === 'acls' || course === 'pals') templatesAvailable[course]++;
    }

    type CourseGroup = {
      cohort: { id: string; cohort_number: string | number; program: { abbreviation: string; name: string } | null } | null;
      dayCount: number;
      testingDayCount: number;
      dates: string[];
    };
    const groups: Record<string, Record<string, CourseGroup>> = { acls: {}, pals: {} };

    for (const row of labDaysRaw || []) {
      const r = row as unknown as {
        cohort_id: string;
        cert_course: 'acls' | 'pals';
        date: string;
        is_adv_cert_testing: boolean;
        cohort: CourseGroup['cohort'];
      };
      const bucket = groups[r.cert_course];
      if (!bucket) continue;
      if (!bucket[r.cohort_id]) {
        bucket[r.cohort_id] = { cohort: r.cohort, dayCount: 0, testingDayCount: 0, dates: [] };
      }
      const g = bucket[r.cohort_id];
      g.dayCount++;
      if (r.is_adv_cert_testing) g.testingDayCount++;
      if (!g.dates.includes(r.date)) g.dates.push(r.date);
    }

    const toList = (bucket: Record<string, CourseGroup>) =>
      Object.values(bucket)
        .filter((g) => g.cohort)
        .sort((a, b) => (a.dates[0] || '').localeCompare(b.dates[0] || ''));

    return NextResponse.json({
      success: true,
      templatesAvailable,
      courses: {
        acls: toList(groups.acls),
        pals: toList(groups.pals),
      },
    });
  } catch (error) {
    console.error('Error loading AHA hub:', error);
    return NextResponse.json({ success: false, error: 'Failed to load AHA hub' }, { status: 500 });
  }
}
