import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Today's active checklists across ALL cohorts — powers the quick
 * attendance page (/attendance) so it's usually zero taps to the
 * right list: default to what's happening today, fall back to a
 * cohort picker only when nothing matches.
 */

type DbChecklistWithCohort = {
  id: string;
  cohort_id: string;
  title: string;
  destination: string | null;
  trip_date: string;
  description: string | null;
  notes: string | null;
  is_active: boolean | null;
  cohort: {
    id: string;
    cohort_number: number;
    display_name: string | null;
    program: { name: string; abbreviation: string } | null;
  } | null;
};

function cohortLabel(cohort: DbChecklistWithCohort['cohort']): string {
  if (!cohort) return 'Unknown cohort';
  if (cohort.display_name) return cohort.display_name;
  const abbr = cohort.program?.abbreviation;
  return abbr ? `${abbr} Group ${cohort.cohort_number}` : `Cohort ${cohort.cohort_number}`;
}

function dbToClient(row: DbChecklistWithCohort) {
  return {
    id: row.id,
    cohort_id: row.cohort_id,
    cohort_label: cohortLabel(row.cohort),
    name: row.title,
    date: row.trip_date,
    location: row.destination,
    description: row.description ?? row.notes,
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const searchParams = request.nextUrl.searchParams;
    // Consistent with the rest of the codebase's UTC-date convention
    // (see e.g. app/api/instructor/upcoming-labs/route.ts).
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    const selectWithCohort = `
      *,
      cohort:cohorts!checklists_cohort_id_fkey(
        id, cohort_number, display_name,
        program:programs(name, abbreviation)
      )
    `;

    let checklists: any[] | null = null;
    let error: any = null;

    const result = await supabase
      .from('checklists')
      .select(selectWithCohort)
      .eq('trip_date', date)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    checklists = result.data;
    error = result.error;

    if (error && (error.message?.includes('is_active') || error.code === '42703')) {
      const fallback = await supabase
        .from('checklists')
        .select(selectWithCohort)
        .eq('trip_date', date)
        .order('created_at', { ascending: false });
      checklists = fallback.data;
      error = fallback.error;
    }

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({ success: true, checklists: [] });
      }
      throw error;
    }

    const mapped = (checklists || []).map((r) => dbToClient(r as DbChecklistWithCohort));
    return NextResponse.json({ success: true, checklists: mapped, date });
  } catch (error) {
    console.error('Error fetching today\'s checklists:', error);
    return NextResponse.json(
      { success: false, error: (error as Error)?.message || "Failed to fetch today's checklists" },
      { status: 500 }
    );
  }
}
