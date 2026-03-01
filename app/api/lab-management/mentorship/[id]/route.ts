import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

async function getCallerRole(email: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('role')
    .ilike('email', email)
    .single();
  return data?.role ?? null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const callerRole = await getCallerRole(session.user.email);
  if (!callerRole || !hasMinRole(callerRole, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const supabase = getSupabaseAdmin();

    const { data: pair, error } = await supabase
      .from('mentorship_pairs')
      .select(`
        id,
        mentor_id,
        mentee_id,
        start_date,
        end_date,
        status,
        goals,
        created_by,
        created_at,
        mentor:students!mentorship_pairs_mentor_id_fkey(id, first_name, last_name),
        mentee:students!mentorship_pairs_mentee_id_fkey(id, first_name, last_name)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!pair) {
      return NextResponse.json({ error: 'Pair not found' }, { status: 404 });
    }

    const { data: logs, error: logsError } = await supabase
      .from('mentorship_logs')
      .select('id, pair_id, log_date, notes, logged_by, created_at')
      .eq('pair_id', id)
      .order('log_date', { ascending: false });

    if (logsError) throw logsError;

    return NextResponse.json({ success: true, pair, logs: logs || [] });
  } catch (error) {
    console.error('Error fetching mentorship pair:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch mentorship pair' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const callerRole = await getCallerRole(session.user.email);
  if (!callerRole || !hasMinRole(callerRole, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const updates: Record<string, unknown> = {};
    if (body.status !== undefined) {
      const validStatuses = ['active', 'completed', 'paused'];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
      }
      updates.status = body.status;
    }
    if (body.goals !== undefined) updates.goals = body.goals;
    if (body.end_date !== undefined) updates.end_date = body.end_date;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('mentorship_pairs')
      .update(updates)
      .eq('id', id)
      .select(`
        id,
        mentor_id,
        mentee_id,
        start_date,
        end_date,
        status,
        goals,
        created_by,
        created_at,
        mentor:students!mentorship_pairs_mentor_id_fkey(id, first_name, last_name),
        mentee:students!mentorship_pairs_mentee_id_fkey(id, first_name, last_name)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, pair: data });
  } catch (error) {
    console.error('Error updating mentorship pair:', error);
    return NextResponse.json({ success: false, error: 'Failed to update mentorship pair' }, { status: 500 });
  }
}
