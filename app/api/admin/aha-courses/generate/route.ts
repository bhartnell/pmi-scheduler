import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import {
  generateAhaCourseForCohort,
  listAhaCourseTemplateDayNumbers,
  type CertCourse,
} from '@/lib/aha-course-generator';

// ---------------------------------------------------------------------------
// POST /api/admin/aha-courses/generate
//
// Task Handoff Queue Checkpoint A: "create AHA course for cohort" generator.
// Expands the AHA-generic (ACLS|PALS) course template into a cohort's own
// lab_days/lab_stations. Additive only — see lib/aha-course-generator.ts
// for the full guardrail rationale (never updates an existing lab_days row).
//
// Body: { cohort_id: string, cert_course: 'acls' | 'pals',
//         day_dates: Record<string, string> (day_number -> YYYY-MM-DD),
//         dry_run?: boolean (default true — callers must explicitly opt
//         out of dry-run to write) }
//
// Requires admin+ role.
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    const body = (await request.json()) as {
      cohort_id?: string;
      cert_course?: string;
      day_dates?: Record<string, string>;
      dry_run?: boolean;
    };

    const { cohort_id, cert_course, day_dates } = body;
    const dryRun = body.dry_run !== false; // default true — explicit opt-out required to write

    if (!cohort_id || !cert_course || !day_dates) {
      return NextResponse.json(
        { error: 'cohort_id, cert_course, and day_dates are required' },
        { status: 400 }
      );
    }
    if (cert_course !== 'acls' && cert_course !== 'pals') {
      return NextResponse.json({ error: 'cert_course must be "acls" or "pals"' }, { status: 400 });
    }

    const dayDates: Record<number, string> = {};
    for (const [k, v] of Object.entries(day_dates)) {
      const n = Number(k);
      if (Number.isFinite(n) && typeof v === 'string') dayDates[n] = v;
    }

    const result = await generateAhaCourseForCohort({
      cohortId: cohort_id,
      certCourse: cert_course as CertCourse,
      dayDates,
      dryRun,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error generating AHA course for cohort:', msg, error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET /api/admin/aha-courses/generate?cert_course=acls
// Returns the distinct day_numbers defined by that course's templates, so
// the UI can render one date input per day without hardcoding "2 days".
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    const certCourse = request.nextUrl.searchParams.get('cert_course');
    if (certCourse !== 'acls' && certCourse !== 'pals') {
      return NextResponse.json({ error: 'cert_course must be "acls" or "pals"' }, { status: 400 });
    }
    const dayNumbers = await listAhaCourseTemplateDayNumbers(certCourse);
    return NextResponse.json({ success: true, cert_course: certCourse, day_numbers: dayNumbers });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
