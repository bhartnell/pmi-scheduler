import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const semesterId = searchParams.get('semester_id');

    let query = supabase
      .from('pmi_room_availability')
      .select('*')
      .eq('room_id', id)
      .order('day_of_week')
      .order('start_time');

    if (semesterId) {
      query = query.or(`semester_id.eq.${semesterId},semester_id.is.null`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ rules: data || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('List room availability error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    if (!hasMinRole(user.role, 'lead_instructor')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { day_of_week, start_time, end_time, rule_type, label, semester_id } = body;

    if (!rule_type) {
      return NextResponse.json({ error: 'rule_type is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('pmi_room_availability')
      .insert({
        room_id: id,
        day_of_week: day_of_week ?? null,
        start_time: start_time ?? null,
        end_time: end_time ?? null,
        rule_type,
        label: label ?? null,
        semester_id: semester_id ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ rule: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Create room availability error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    if (!hasMinRole(user.role, 'lead_instructor')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { rule_id } = body;

    if (!rule_id) {
      return NextResponse.json({ error: 'rule_id is required' }, { status: 400 });
    }

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('pmi_room_availability')
      .delete()
      .eq('id', rule_id)
      .eq('room_id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Delete room availability error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
