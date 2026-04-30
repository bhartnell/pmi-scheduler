import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const semesterId = searchParams.get('semester_id');

    if (!semesterId) {
      return NextResponse.json({ error: 'semester_id is required' }, { status: 400 });
    }

    // Two-source query so the sidebar shows programs that have
    // EITHER a pmi_program_schedules row for this semester OR a
    // pmi_schedule_blocks row referencing a program_schedule (the
    // sidebar was previously empty for semesters where blocks
    // existed but program_schedules wasn't created — common after
    // bulk imports of legacy data). Merge-deduped on program_schedule.id.
    const [withSchedule, fromBlocks] = await Promise.all([
      supabase
        .from('pmi_program_schedules')
        .select(`
          *,
          cohort:cohorts!pmi_program_schedules_cohort_id_fkey(
            id, cohort_number, start_date, expected_end_date, is_active, semester,
            program:programs(id, name, abbreviation)
          )
        `)
        .eq('semester_id', semesterId)
        .order('created_at'),
      supabase
        .from('pmi_schedule_blocks')
        .select('program_schedule_id')
        .eq('semester_id', semesterId)
        .not('program_schedule_id', 'is', null),
    ]);

    if (withSchedule.error) throw withSchedule.error;
    if (fromBlocks.error) throw fromBlocks.error;

    const knownIds = new Set((withSchedule.data ?? []).map(p => p.id));
    const blockReferenced = new Set(
      ((fromBlocks.data ?? []) as Array<{ program_schedule_id: string | null }>)
        .map(b => b.program_schedule_id)
        .filter((id): id is string => !!id && !knownIds.has(id))
    );

    type ProgramScheduleRow = NonNullable<typeof withSchedule.data>[number];
    let extra: ProgramScheduleRow[] = [];
    if (blockReferenced.size > 0) {
      const { data: extraRows, error: extraErr } = await supabase
        .from('pmi_program_schedules')
        .select(`
          *,
          cohort:cohorts!pmi_program_schedules_cohort_id_fkey(
            id, cohort_number, start_date, expected_end_date, is_active, semester,
            program:programs(id, name, abbreviation)
          )
        `)
        .in('id', Array.from(blockReferenced));
      if (extraErr) throw extraErr;
      extra = (extraRows ?? []) as ProgramScheduleRow[];
    }

    const merged = [...(withSchedule.data ?? []), ...extra];
    return NextResponse.json({ programs: merged });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('List program schedules error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    if (!hasMinRole(user.role, 'lead_instructor')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { semester_id, cohort_id, class_days, color, label, notes } = body;

    if (!semester_id || !cohort_id || !class_days || !Array.isArray(class_days)) {
      return NextResponse.json({ error: 'semester_id, cohort_id, and class_days[] are required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // ── Find-or-create: idempotent against repeat wizard runs.
    //    The Generate Semester Schedule wizard auto-calls this
    //    endpoint every time the user clicks Generate. Without this
    //    short-circuit, a duplicate run would 23505 on the
    //    (semester_id, cohort_id) UNIQUE constraint and the wizard
    //    would silently fall through to "no program_schedule_id" —
    //    producing orphan blocks. Returning the existing row instead
    //    lets repeated runs re-use the same program_schedule.
    //    Filtering by is_active=true matches the user spec.
    const { data: existing } = await supabase
      .from('pmi_program_schedules')
      .select(`
        *,
        cohort:cohorts!pmi_program_schedules_cohort_id_fkey(
          id, cohort_number, start_date, expected_end_date, is_active, semester,
          program:programs(id, name, abbreviation)
        )
      `)
      .eq('semester_id', semester_id)
      .eq('cohort_id', cohort_id)
      .eq('is_active', true)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ program: existing, reused: true });
    }

    // If no explicit color provided, look up the cohort's program to assign the right default
    let resolvedColor = color;
    if (!resolvedColor) {
      const { data: cohortData } = await supabase
        .from('cohorts')
        .select('program:programs(abbreviation)')
        .eq('id', cohort_id)
        .single();
      const abbr = ((cohortData?.program as { abbreviation?: string } | null)?.abbreviation || '').toLowerCase();
      const PROGRAM_COLORS: Record<string, string> = {
        emt: '#22C55E',
        aemt: '#EAB308',
        paramedic: '#3B82F6',
        pm: '#3B82F6',
      };
      resolvedColor = PROGRAM_COLORS[abbr] || '#3B82F6';
    }

    const { data, error } = await supabase
      .from('pmi_program_schedules')
      .insert({
        semester_id,
        cohort_id,
        class_days,
        color: resolvedColor,
        label: label ?? null,
        notes: notes ?? null,
      })
      .select(`
        *,
        cohort:cohorts!pmi_program_schedules_cohort_id_fkey(
          id, cohort_number, start_date, expected_end_date, is_active, semester,
          program:programs(id, name, abbreviation)
        )
      `)
      .single();

    if (error) {
      // Race-condition fallback — if a concurrent request created
      // the row between our SELECT and INSERT, fetch + return it.
      if (error.code === '23505') {
        const { data: raceWinner } = await supabase
          .from('pmi_program_schedules')
          .select(`
            *,
            cohort:cohorts!pmi_program_schedules_cohort_id_fkey(
              id, cohort_number, start_date, expected_end_date, is_active, semester,
              program:programs(id, name, abbreviation)
            )
          `)
          .eq('semester_id', semester_id)
          .eq('cohort_id', cohort_id)
          .maybeSingle();
        if (raceWinner) {
          return NextResponse.json({ program: raceWinner, reused: true });
        }
        return NextResponse.json({ error: 'This cohort is already scheduled in this semester' }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ program: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Create program schedule error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
