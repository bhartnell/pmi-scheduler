import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // Require lead_instructor minimum role to view outcomes
  const { data: callerUser } = await supabase
    .from('lab_users')
    .select('role')
    .ilike('email', session.user.email)
    .single();

  if (!callerUser || !hasMinRole(callerUser.role, 'lead_instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get('year');
    const cohortId = searchParams.get('cohort_id');

    let query = supabase
      .from('program_outcomes')
      .select(`
        *,
        cohort:cohorts(id, cohort_number, program:programs(id, name, abbreviation))
      `)
      .order('year', { ascending: false })
      .order('created_at', { ascending: false });

    if (year) {
      query = query.eq('year', parseInt(year, 10));
    }

    if (cohortId) {
      query = query.eq('cohort_id', cohortId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, outcomes: data || [] });
  } catch (error) {
    console.error('Error fetching program outcomes:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch program outcomes' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // Require admin minimum role to create/edit outcomes
  const { data: callerUser } = await supabase
    .from('lab_users')
    .select('role')
    .ilike('email', session.user.email)
    .single();

  if (!callerUser || !hasMinRole(callerUser.role, 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: {
    id?: string;
    cohort_id?: string | null;
    year: number;
    graduation_rate?: number | null;
    cert_pass_rate?: number | null;
    job_placement_rate?: number | null;
    employer_satisfaction?: number | null;
    avg_completion_months?: number | null;
    notes?: string | null;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!body.year || typeof body.year !== 'number') {
    return NextResponse.json({ error: 'year is required and must be a number' }, { status: 400 });
  }

  try {
    const payload = {
      cohort_id: body.cohort_id || null,
      year: body.year,
      graduation_rate: body.graduation_rate ?? null,
      cert_pass_rate: body.cert_pass_rate ?? null,
      job_placement_rate: body.job_placement_rate ?? null,
      employer_satisfaction: body.employer_satisfaction ?? null,
      avg_completion_months: body.avg_completion_months ?? null,
      notes: body.notes || null,
      created_by: session.user.email,
      updated_at: new Date().toISOString(),
    };

    let data, error;

    if (body.id) {
      // Update existing record
      ({ data, error } = await supabase
        .from('program_outcomes')
        .update(payload)
        .eq('id', body.id)
        .select(`
          *,
          cohort:cohorts(id, cohort_number, program:programs(id, name, abbreviation))
        `)
        .single());
    } else {
      // Create new record
      ({ data, error } = await supabase
        .from('program_outcomes')
        .insert(payload)
        .select(`
          *,
          cohort:cohorts(id, cohort_number, program:programs(id, name, abbreviation))
        `)
        .single());
    }

    if (error) throw error;

    return NextResponse.json({ success: true, outcome: data });
  } catch (error) {
    console.error('Error saving program outcome:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save program outcome' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // Require admin minimum role to delete
  const { data: callerUser } = await supabase
    .from('lab_users')
    .select('role')
    .ilike('email', session.user.email)
    .single();

  if (!callerUser || !hasMinRole(callerUser.role, 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  try {
    const { error } = await supabase
      .from('program_outcomes')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting program outcome:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete program outcome' },
      { status: 500 }
    );
  }
}
