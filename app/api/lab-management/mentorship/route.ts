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

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const callerRole = await getCallerRole(session.user.email);
  if (!callerRole || !hasMinRole(callerRole, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get('status');

  try {
    const supabase = getSupabaseAdmin();

    let query = supabase
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
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Get log counts per pair
    const pairIds = (data || []).map((p: any) => p.id);
    let logCounts: Record<string, number> = {};

    if (pairIds.length > 0) {
      const { data: logs } = await supabase
        .from('mentorship_logs')
        .select('pair_id')
        .in('pair_id', pairIds);

      (logs || []).forEach((log: any) => {
        logCounts[log.pair_id] = (logCounts[log.pair_id] || 0) + 1;
      });
    }

    const pairs = (data || []).map((pair: any) => ({
      ...pair,
      log_count: logCounts[pair.id] || 0,
    }));

    // Summary stats
    const active = pairs.filter((p: any) => p.status === 'active').length;
    const completed = pairs.filter((p: any) => p.status === 'completed').length;
    const totalMeetings = Object.values(logCounts).reduce((sum: number, n: number) => sum + n, 0);

    return NextResponse.json({
      success: true,
      pairs,
      stats: { active, completed, total_meetings: totalMeetings },
    });
  } catch (error) {
    console.error('Error fetching mentorship pairs:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch mentorship pairs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const callerRole = await getCallerRole(session.user.email);
  if (!callerRole || !hasMinRole(callerRole, 'instructor')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    if (!body.mentor_id || !body.mentee_id) {
      return NextResponse.json({ error: 'mentor_id and mentee_id are required' }, { status: 400 });
    }

    if (body.mentor_id === body.mentee_id) {
      return NextResponse.json({ error: 'Mentor and mentee must be different students' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('mentorship_pairs')
      .insert({
        mentor_id: body.mentor_id,
        mentee_id: body.mentee_id,
        start_date: body.start_date || new Date().toISOString().split('T')[0],
        goals: body.goals || null,
        status: 'active',
        created_by: session.user.email,
      })
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

    return NextResponse.json({ success: true, pair: data }, { status: 201 });
  } catch (error) {
    console.error('Error creating mentorship pair:', error);
    return NextResponse.json({ success: false, error: 'Failed to create mentorship pair' }, { status: 500 });
  }
}
