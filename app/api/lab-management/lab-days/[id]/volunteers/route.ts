import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/lab-management/lab-days/[id]/volunteers
// Returns confirmed/registered volunteers linked to this lab day via volunteer_events
export async function GET(request: NextRequest, { params }: RouteContext) {
  // Allow volunteer_instructor+ to view volunteers for a lab day
  const auth = await requireAuth('volunteer_instructor');
  if (auth instanceof NextResponse) return auth;

  const { id: labDayId } = await params;
  const supabase = getSupabaseAdmin();

  try {
    // Step 1: Find volunteer_events linked to this lab day
    const { data: events, error: eventsError } = await supabase
      .from('volunteer_events')
      .select('id')
      .eq('linked_lab_day_id', labDayId);

    if (eventsError) throw eventsError;

    const eventIds = (events || []).map((e: { id: string }) => e.id);

    if (eventIds.length === 0) {
      return NextResponse.json({ success: true, volunteers: [] });
    }

    // Step 2: Fetch registrations for those events
    const { data: volunteers, error: volError } = await supabase
      .from('volunteer_registrations')
      .select('id, name, email, phone, volunteer_type, agency_affiliation, needs_evaluation, evaluation_skill, evaluation_status, status, notes')
      .in('event_id', eventIds)
      .in('status', ['registered', 'confirmed'])
      .order('volunteer_type', { ascending: true })
      .order('name', { ascending: true });

    if (volError) throw volError;

    return NextResponse.json({ success: true, volunteers: volunteers || [] });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
