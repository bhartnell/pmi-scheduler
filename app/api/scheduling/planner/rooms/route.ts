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
    const typeFilter = searchParams.get('type');
    const activeOnly = searchParams.get('active_only') !== 'false';

    let query = supabase
      .from('pmi_rooms')
      .select('*')
      .order('display_order')
      .order('name');

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    if (typeFilter) {
      query = query.eq('room_type', typeFilter);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ rooms: data || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('List rooms error:', err);
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
    const { name, room_type, capacity, notes, display_order } = body;

    if (!name || !room_type) {
      return NextResponse.json({ error: 'name and room_type are required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('pmi_rooms')
      .insert({
        name,
        room_type,
        capacity: capacity ?? null,
        notes: notes ?? null,
        display_order: display_order ?? 0,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A room with that name already exists' }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ room: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Create room error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
