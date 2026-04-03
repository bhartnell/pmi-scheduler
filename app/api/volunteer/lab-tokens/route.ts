import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET /api/volunteer/lab-tokens — list tokens (admin)
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');
    const labDayId = searchParams.get('lab_day_id');

    let query = supabase
      .from('volunteer_lab_tokens')
      .select('*')
      .order('created_at', { ascending: false });

    if (eventId) query = query.eq('event_id', eventId);
    if (labDayId) query = query.eq('lab_day_id', labDayId);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, data: data || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/volunteer/lab-tokens — create a single token (admin)
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const {
      registration_id,
      volunteer_name,
      volunteer_email,
      lab_day_id,
      event_id,
      role,
      valid_hours,
    } = body;

    if (!volunteer_name) {
      return NextResponse.json(
        { success: false, error: 'volunteer_name is required' },
        { status: 400 }
      );
    }

    if (!lab_day_id) {
      return NextResponse.json(
        { success: false, error: 'lab_day_id is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Build insert — let DB generate token and defaults
    const insertData: Record<string, unknown> = {
      volunteer_name,
      volunteer_email: volunteer_email || null,
      lab_day_id,
      event_id: event_id || null,
      registration_id: registration_id || null,
      role: role || 'volunteer_grader',
    };

    // Allow custom validity window
    if (valid_hours && typeof valid_hours === 'number') {
      // We set valid_until explicitly; valid_from defaults to NOW() in DB
      insertData.valid_until = new Date(
        Date.now() + valid_hours * 60 * 60 * 1000
      ).toISOString();
    }

    const { data, error } = await supabase
      .from('volunteer_lab_tokens')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
