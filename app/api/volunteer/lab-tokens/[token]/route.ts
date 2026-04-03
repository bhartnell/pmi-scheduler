import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

// GET /api/volunteer/lab-tokens/[token] — PUBLIC, no auth required
// Validates token and returns limited lab day data for volunteer grading
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const supabase = getSupabaseAdmin();

    // 1. Look up the token
    const { data: tokenData, error: tokenError } = await supabase
      .from('volunteer_lab_tokens')
      .select('*')
      .eq('token', token)
      .single();

    if (tokenError || !tokenData) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired access link' },
        { status: 404 }
      );
    }

    // 2. Check active + validity window
    const now = new Date();
    const validFrom = new Date(tokenData.valid_from);
    const validUntil = new Date(tokenData.valid_until);

    if (!tokenData.is_active) {
      return NextResponse.json(
        { success: false, error: 'This access link has been revoked' },
        { status: 403 }
      );
    }

    if (now < validFrom) {
      return NextResponse.json(
        { success: false, error: 'This access link is not yet active' },
        { status: 403 }
      );
    }

    if (now > validUntil) {
      return NextResponse.json(
        { success: false, error: 'This access link has expired' },
        { status: 403 }
      );
    }

    // 3. Fetch lab day with stations
    const { data: labDay, error: labDayError } = await supabase
      .from('lab_days')
      .select(`
        id,
        date,
        title,
        cohort_id,
        cohort:cohorts(id, cohort_number),
        stations:lab_stations(
          id,
          station_number,
          station_type,
          skill_name,
          custom_title,
          room,
          notes,
          skill_sheet_url,
          metadata
        )
      `)
      .eq('id', tokenData.lab_day_id)
      .single();

    if (labDayError || !labDay) {
      return NextResponse.json(
        { success: false, error: 'Lab day not found' },
        { status: 404 }
      );
    }

    // 4. Fetch skill sheets linked to station skill names
    const stations = (labDay.stations || []) as Array<Record<string, unknown>>;
    const skillNames = stations
      .map((s) => s.skill_name as string)
      .filter(Boolean);

    let skillSheets: Array<Record<string, unknown>> = [];
    if (skillNames.length > 0) {
      const { data: sheets } = await supabase
        .from('skill_sheets')
        .select('id, skill_name, category, source, steps_json')
        .in('skill_name', skillNames);
      skillSheets = sheets || [];
    }

    // Build a map of skill_name -> skill sheet
    const sheetMap: Record<string, Record<string, unknown>> = {};
    for (const sheet of skillSheets) {
      sheetMap[sheet.skill_name as string] = sheet;
    }

    // Enrich stations with skill sheet info
    const enrichedStations = stations.map((s) => ({
      ...s,
      skill_sheet: sheetMap[s.skill_name as string] || null,
    }));

    // 5. Fetch cohort students (names only — no emails, no contact info)
    let students: Array<{ id: string; name: string }> = [];
    if (labDay.cohort_id) {
      const { data: studentData } = await supabase
        .from('students')
        .select('id, name')
        .eq('cohort_id', labDay.cohort_id)
        .eq('is_active', true)
        .order('name');
      students = (studentData || []).map((s: { id: string; name: string }) => ({
        id: s.id,
        name: s.name,
      }));
    }

    return NextResponse.json({
      success: true,
      token: {
        id: tokenData.id,
        volunteer_name: tokenData.volunteer_name,
        role: tokenData.role,
        valid_until: tokenData.valid_until,
      },
      lab_day: {
        id: labDay.id,
        date: labDay.date,
        title: labDay.title,
        cohort: labDay.cohort,
      },
      stations: enrichedStations,
      students,
    });
  } catch (err: unknown) {
    console.error('Token validation error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// DELETE /api/volunteer/lab-tokens/[token] — admin: revoke token
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;

    const { token } = await params;
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('volunteer_lab_tokens')
      .update({ is_active: false })
      .eq('token', token)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
