import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole, type Role } from '@/lib/permissions';

/**
 * GET /api/dashboard/program-snapshot
 *
 * Returns active student counts grouped by program + semester, plus
 * (when applicable) a PM Sem 4 internship phase breakdown. Powers the
 * Program Snapshot dashboard widget — the at-a-glance "who do we
 * currently have in the building" view.
 *
 * Rows with count = 0 are omitted; EMT/AEMT programs collapse to a
 * single row (no semester split). Gated to lead_instructor+.
 */

interface SnapshotRow {
  program: string;                 // abbreviation (EMT, AEMT, PM, PMD)
  program_name: string | null;     // full name
  semester: number | null;         // null = no split (EMT, AEMT)
  count: number;
  href: string;                    // deep-link to filtered cohort list
}

export async function GET() {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    if (!hasMinRole(user.role as Role, 'lead_instructor')) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Pull every active student with their cohort + program via embeds. The
    // join is cheap and lets us aggregate in JS without needing a custom
    // Postgres view / SQL function. Filter to active cohorts so archived
    // cohorts' remaining roster isn't lumped in.
    const { data: students, error: stuErr } = await supabase
      .from('students')
      .select(
        `id, status,
         cohorts!students_cohort_id_fkey(
           id, current_semester, is_active, is_archived,
           programs(id, name, abbreviation)
         )`
      )
      .eq('status', 'active');

    if (stuErr) {
      console.error('[program-snapshot] students query', stuErr);
      return NextResponse.json({ error: stuErr.message }, { status: 500 });
    }

    // Aggregate
    const rowMap = new Map<string, SnapshotRow>();
    for (const s of (students ?? []) as any[]) {
      const cohort = s.cohorts;
      if (!cohort || cohort.is_archived === true) continue;
      const program = cohort.programs;
      if (!program) continue;
      const abbr: string = (program.abbreviation || '').toUpperCase();

      // EMT/AEMT: single row per program (no semester split — their
      // programs are shorter and semester is less meaningful in the UI).
      // PM/PMD: one row per semester.
      const splitBySemester = abbr === 'PM' || abbr === 'PMD';
      const sem: number | null = splitBySemester
        ? (cohort.current_semester ?? null)
        : null;
      const key = `${abbr}|${sem ?? ''}`;
      const existing = rowMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        rowMap.set(key, {
          program: abbr,
          program_name: program.name ?? null,
          semester: sem,
          count: 1,
          href: buildHref(abbr, sem),
        });
      }
    }

    // Order: EMT, AEMT, PM/PMD (sem 1 → 4 → null last)
    const PROGRAM_ORDER: Record<string, number> = {
      EMT: 0,
      AEMT: 1,
      PM: 2,
      PMD: 3,
    };
    const rows = Array.from(rowMap.values())
      .filter((r) => r.count > 0)
      .sort((a, b) => {
        const pa = PROGRAM_ORDER[a.program] ?? 99;
        const pb = PROGRAM_ORDER[b.program] ?? 99;
        if (pa !== pb) return pa - pb;
        const sa = a.semester ?? 99;
        const sb = b.semester ?? 99;
        return sa - sb;
      });

    // PM Sem 4 internship phase breakdown. Only meaningful when PM Sem 4
    // students exist — otherwise omit the section entirely so the widget
    // doesn't render an empty pane.
    const hasSem4 = rows.some(
      (r) => (r.program === 'PM' || r.program === 'PMD') && r.semester === 4
    );

    let internshipPhases: Record<string, number> | null = null;
    if (hasSem4) {
      const { data: internships } = await supabase
        .from('student_internships')
        .select(
          `current_phase,
           students!inner(status),
           cohorts!inner(
             current_semester, is_archived,
             programs!inner(abbreviation)
           )`
        )
        .neq('students.status', 'withdrawn')
        .eq('cohorts.is_archived', false)
        .eq('cohorts.current_semester', 4)
        .in('cohorts.programs.abbreviation', ['PM', 'PMD']);

      internshipPhases = {};
      for (const row of (internships ?? []) as any[]) {
        const phase = row.current_phase || 'unknown';
        internshipPhases[phase] = (internshipPhases[phase] ?? 0) + 1;
      }
    }

    return NextResponse.json({
      success: true,
      rows,
      internship_phases: internshipPhases,
    });
  } catch (e) {
    console.error('[program-snapshot] error', e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function buildHref(abbr: string, semester: number | null): string {
  const params = new URLSearchParams({ program: abbr });
  if (semester != null) params.set('semester', String(semester));
  return `/academics/cohorts?${params.toString()}`;
}
