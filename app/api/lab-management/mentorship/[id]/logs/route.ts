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

    const { data, error } = await supabase
      .from('mentorship_logs')
      .select('id, pair_id, log_date, notes, logged_by, created_at')
      .eq('pair_id', id)
      .order('log_date', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, logs: data || [] });
  } catch (error) {
    console.error('Error fetching mentorship logs:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch logs' }, { status: 500 });
  }
}

export async function POST(
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

    if (!body.notes?.trim()) {
      return NextResponse.json({ error: 'Notes are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('mentorship_logs')
      .insert({
        pair_id: id,
        log_date: body.log_date || new Date().toISOString().split('T')[0],
        notes: body.notes.trim(),
        logged_by: session.user.email,
      })
      .select('id, pair_id, log_date, notes, logged_by, created_at')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, log: data }, { status: 201 });
  } catch (error) {
    console.error('Error creating mentorship log:', error);
    return NextResponse.json({ success: false, error: 'Failed to create log' }, { status: 500 });
  }
}
