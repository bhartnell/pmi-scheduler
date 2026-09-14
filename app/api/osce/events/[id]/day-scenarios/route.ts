import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

const VALID_SCENARIOS = ['A', 'B', 'C', 'D', 'E', 'F'];

// GET - Admin: current per-day scenario assignment for this event, plus
// which scenarios (if any) are assigned to both days (exam-security warning).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('osce_day_scenarios')
      .select('day_number, scenario')
      .eq('event_id', id);

    if (error) throw error;

    const day1 = (data || []).filter(r => r.day_number === 1).map(r => r.scenario);
    const day2 = (data || []).filter(r => r.day_number === 2).map(r => r.scenario);
    const overlap = day1.filter(s => day2.includes(s));

    return NextResponse.json({ success: true, day1, day2, overlap });
  } catch (error) {
    console.error('Error fetching day scenarios:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch day scenarios' }, { status: 500 });
  }
}

// PUT - Admin: replace the full per-day scenario assignment for this event.
// Body: { day1: string[], day2: string[] }. Overlap between the two days is
// allowed (Ben may have a real reason) but always reported back so the UI
// can warn rather than silently allow it.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();
    const day1: string[] = Array.isArray(body.day1) ? body.day1 : [];
    const day2: string[] = Array.isArray(body.day2) ? body.day2 : [];

    for (const s of [...day1, ...day2]) {
      if (!VALID_SCENARIOS.includes(s)) {
        return NextResponse.json({ success: false, error: `Invalid scenario "${s}"` }, { status: 400 });
      }
    }

    const supabase = getSupabaseAdmin();

    const { error: deleteErr } = await supabase.from('osce_day_scenarios').delete().eq('event_id', id);
    if (deleteErr) throw deleteErr;

    const rows = [
      ...day1.map(scenario => ({ event_id: id, day_number: 1, scenario })),
      ...day2.map(scenario => ({ event_id: id, day_number: 2, scenario })),
    ];

    if (rows.length > 0) {
      const { error: insertErr } = await supabase.from('osce_day_scenarios').insert(rows);
      if (insertErr) throw insertErr;
    }

    const overlap = day1.filter(s => day2.includes(s));

    return NextResponse.json({ success: true, day1, day2, overlap });
  } catch (error) {
    console.error('Error saving day scenarios:', error);
    return NextResponse.json({ success: false, error: 'Failed to save day scenarios' }, { status: 500 });
  }
}
