import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

// GET /api/lab-management/lab-days/[id]/assistance-alerts
// Returns all alerts for a lab day, optionally filtered by unresolved only
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  const { id: labDayId } = await params;
  const supabase = getSupabaseAdmin();

  try {
    const { searchParams } = new URL(request.url);
    const unresolvedOnly = searchParams.get('unresolved') === 'true';

    let query = supabase
      .from('station_assistance_alerts')
      .select(`
        id,
        lab_day_id,
        station_id,
        station_name,
        notes,
        requested_at,
        requested_by,
        resolved_at,
        resolved_by
      `)
      .eq('lab_day_id', labDayId)
      .order('requested_at', { ascending: false });

    if (unresolvedOnly) {
      query = query.is('resolved_at', null);
    }

    const { data: alerts, error } = await query;

    if (error) throw error;

    return NextResponse.json({ alerts: alerts || [] });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('does not exist')) {
      return NextResponse.json({ alerts: [] });
    }
    console.error('Error fetching assistance alerts:', error);
    return NextResponse.json({ error: 'Failed to fetch assistance alerts' }, { status: 500 });
  }
}

// POST /api/lab-management/lab-days/[id]/assistance-alerts
// Create a new assistance alert
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  const { user } = auth;
  const { id: labDayId } = await params;
  const supabase = getSupabaseAdmin();

  try {
    const body = await request.json();
    const { station_id, station_name, notes } = body;

    if (!station_id || !station_name) {
      return NextResponse.json(
        { error: 'station_id and station_name are required' },
        { status: 400 }
      );
    }

    const { data: alert, error } = await supabase
      .from('station_assistance_alerts')
      .insert({
        lab_day_id: labDayId,
        station_id,
        station_name,
        notes: notes || null,
        requested_by: user.id,
        requested_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, alert });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('does not exist')) {
      return NextResponse.json(
        { error: 'Assistance alerts table not available. Please run database migrations.' },
        { status: 503 }
      );
    }
    console.error('Error creating assistance alert:', error);
    return NextResponse.json({ error: 'Failed to create assistance alert' }, { status: 500 });
  }
}

// PATCH /api/lab-management/lab-days/[id]/assistance-alerts
// Resolve an existing alert
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  const { user } = auth;
  const { id: labDayId } = await params;
  const supabase = getSupabaseAdmin();

  try {
    const body = await request.json();
    const { alert_id, notes } = body;

    if (!alert_id) {
      return NextResponse.json(
        { error: 'alert_id is required' },
        { status: 400 }
      );
    }

    // Verify the alert belongs to this lab day
    const { data: existing, error: fetchError } = await supabase
      .from('station_assistance_alerts')
      .select('id, resolved_at')
      .eq('id', alert_id)
      .eq('lab_day_id', labDayId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Alert not found for this lab day' },
        { status: 404 }
      );
    }

    if (existing.resolved_at) {
      return NextResponse.json(
        { error: 'Alert is already resolved' },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
    };

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    const { data: alert, error } = await supabase
      .from('station_assistance_alerts')
      .update(updateData)
      .eq('id', alert_id)
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, alert });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('does not exist')) {
      return NextResponse.json(
        { error: 'Assistance alerts table not available. Please run database migrations.' },
        { status: 503 }
      );
    }
    console.error('Error resolving assistance alert:', error);
    return NextResponse.json({ error: 'Failed to resolve assistance alert' }, { status: 500 });
  }
}
