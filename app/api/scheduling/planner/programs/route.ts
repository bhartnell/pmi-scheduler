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

    const { data, error } = await supabase
      .from('pmi_program_schedules')
      .select(`
        *,
        cohort:cohorts!pmi_program_schedules_cohort_id_fkey(
          id, cohort_number, start_date, expected_end_date, is_active, semester,
          program:programs(id, name, abbreviation)
        )
      `)
      .eq('semester_id', semesterId)
      .order('created_at');

    if (error) throw error;

    return NextResponse.json({ programs: data || [] });
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

    const { data, error } = await supabase
      .from('pmi_program_schedules')
      .insert({
        semester_id,
        cohort_id,
        class_days,
        color: color ?? '#3B82F6',
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
      if (error.code === '23505') {
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
