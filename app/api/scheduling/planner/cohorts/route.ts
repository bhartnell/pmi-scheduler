import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/scheduling/planner/cohorts?program_type=emt&semester_id=...
 * Returns cohorts for a program type, indicating which ones already have
 * a pmi_program_schedule entry for the given semester.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const programType = searchParams.get('program_type');
    const semesterId = searchParams.get('semester_id');

    if (!programType) {
      return NextResponse.json({ error: 'program_type is required' }, { status: 400 });
    }

    // Map program_type string to program name for matching
    // programs.name is 'EMT', 'AEMT', or 'Paramedic'
    const programNameMap: Record<string, string> = {
      emt: 'EMT',
      aemt: 'AEMT',
      paramedic: 'Paramedic',
    };
    const programName = programNameMap[programType.toLowerCase()];
    if (!programName) {
      return NextResponse.json({ error: `Unknown program type: ${programType}` }, { status: 400 });
    }

    // 1. Find the program ID
    const { data: programs, error: progError } = await supabase
      .from('programs')
      .select('id, name, abbreviation')
      .ilike('name', programName);

    if (progError) throw progError;
    if (!programs || programs.length === 0) {
      return NextResponse.json({ cohorts: [] });
    }

    const programIds = programs.map(p => p.id);

    // 2. Get all active cohorts for this program
    const { data: cohorts, error: cohortError } = await supabase
      .from('cohorts')
      .select('id, cohort_number, start_date, expected_end_date, is_active, program_id, semester, program:programs(id, name, abbreviation)')
      .in('program_id', programIds)
      .eq('is_active', true)
      .order('cohort_number', { ascending: false });

    if (cohortError) throw cohortError;

    // 3. If semester_id provided, check which cohorts already have program_schedules
    let linkedCohortIds: Set<string> = new Set();
    let existingSchedules: Record<string, string> = {}; // cohort_id → program_schedule_id

    if (semesterId) {
      const { data: schedules, error: schedError } = await supabase
        .from('pmi_program_schedules')
        .select('id, cohort_id')
        .eq('semester_id', semesterId);

      if (schedError) throw schedError;

      if (schedules) {
        for (const s of schedules) {
          linkedCohortIds.add(s.cohort_id);
          existingSchedules[s.cohort_id] = s.id;
        }
      }
    }

    // 4. Return cohorts with linked status
    const result = (cohorts || []).map(c => ({
      ...c,
      has_program_schedule: linkedCohortIds.has(c.id),
      program_schedule_id: existingSchedules[c.id] || null,
    }));

    return NextResponse.json({ cohorts: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('List cohorts for planner error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
