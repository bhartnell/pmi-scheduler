import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAuth } from '@/lib/api-auth';

/**
 * POST /api/admin/calendar-sync
 * Bulk sync existing lab assignments and shift signups to Google Calendar
 * for connected users who don't yet have calendar events.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = getSupabaseAdmin();
    const today = new Date().toISOString().split('T')[0];

    let synced = 0;
    let failed = 0;
    let skipped = 0;

    // Get all connected users with 'events' scope
    const { data: connectedUsers } = await supabase
      .from('lab_users')
      .select('email, google_calendar_scope')
      .eq('google_calendar_connected', true)
      .eq('google_calendar_scope', 'events');

    if (!connectedUsers || connectedUsers.length === 0) {
      return NextResponse.json({
        success: true,
        synced: 0,
        failed: 0,
        skipped: 0,
        message: 'No users with calendar events scope connected',
      });
    }

    const connectedEmails = new Set(connectedUsers.map((u) => u.email.toLowerCase()));

    // Import calendar functions
    const {
      syncLabStationAssignment,
      syncLabDayRole,
      syncShiftSignup,
    } = await import('@/lib/google-calendar');

    // 1. Sync station assignments for future lab days
    const { data: futureStations } = await supabase
      .from('station_instructors')
      .select(`
        id, station_id, user_email,
        station:station_id(
          id, station_number, lab_day_id,
          scenario:scenario_id(title),
          lab_day:lab_day_id(id, title, date, start_time, end_time)
        )
      `)
      .gte('station.lab_day.date', today);

    if (futureStations) {
      for (const si of futureStations) {
        const station = si.station as any;
        const labDay = station?.lab_day;
        if (!labDay || !connectedEmails.has(si.user_email.toLowerCase())) {
          skipped++;
          continue;
        }

        // Check if mapping already exists
        const { data: existingMapping } = await supabase
          .from('google_calendar_events')
          .select('id')
          .ilike('user_email', si.user_email)
          .eq('source_type', 'station_assignment')
          .eq('source_id', si.station_id)
          .single();

        if (existingMapping) {
          skipped++;
          continue;
        }

        try {
          await syncLabStationAssignment({
            userEmail: si.user_email,
            stationId: si.station_id,
            stationNumber: station.station_number,
            labDayId: labDay.id,
            labDayTitle: labDay.title || 'Lab Day',
            labDayDate: labDay.date,
            startTime: labDay.start_time || undefined,
            endTime: labDay.end_time || undefined,
            scenarioTitle: station.scenario?.title || undefined,
          });
          synced++;
        } catch {
          failed++;
        }

        // Rate limit: 200ms between API calls
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    // 2. Sync lab day roles for future lab days
    const { data: futureRoles } = await supabase
      .from('lab_day_roles')
      .select(`
        id, lab_day_id, role,
        instructor:instructor_id(id, name, email),
        lab_day:lab_day_id(id, title, date, start_time, end_time)
      `)
      .gte('lab_day.date', today);

    if (futureRoles) {
      const roleNames: Record<string, string> = {
        lab_lead: 'Lab Lead',
        roamer: 'Roamer',
        observer: 'Observer',
      };

      for (const role of futureRoles) {
        const instructor = Array.isArray(role.instructor) ? role.instructor[0] : role.instructor;
        const labDay = Array.isArray(role.lab_day) ? role.lab_day[0] : role.lab_day;
        if (!labDay || !instructor?.email || !connectedEmails.has(instructor.email.toLowerCase())) {
          skipped++;
          continue;
        }

        // Check if mapping already exists
        const { data: existingMapping } = await supabase
          .from('google_calendar_events')
          .select('id')
          .ilike('user_email', instructor.email)
          .eq('source_type', 'lab_day_role')
          .eq('source_id', role.id)
          .single();

        if (existingMapping) {
          skipped++;
          continue;
        }

        try {
          await syncLabDayRole({
            userEmail: instructor.email,
            roleId: role.id,
            roleName: roleNames[role.role] || role.role,
            labDayId: labDay.id,
            labDayTitle: labDay.title || 'Lab Day',
            labDayDate: labDay.date,
            startTime: labDay.start_time || undefined,
            endTime: labDay.end_time || undefined,
          });
          synced++;
        } catch {
          failed++;
        }

        await new Promise((r) => setTimeout(r, 200));
      }
    }

    // 3. Sync confirmed shift signups for future shifts
    const { data: futureSignups } = await supabase
      .from('shift_signups')
      .select(`
        id, shift_id,
        instructor:instructor_id(id, name, email),
        shift:shift_id(id, title, date, start_time, end_time, department, location)
      `)
      .eq('status', 'confirmed')
      .gte('shift.date', today);

    if (futureSignups) {
      for (const signup of futureSignups) {
        const instructor = Array.isArray(signup.instructor) ? signup.instructor[0] : signup.instructor;
        const shift = Array.isArray(signup.shift) ? signup.shift[0] : signup.shift;
        if (!shift || !instructor?.email || !connectedEmails.has(instructor.email.toLowerCase())) {
          skipped++;
          continue;
        }

        // Check if mapping already exists
        const { data: existingMapping } = await supabase
          .from('google_calendar_events')
          .select('id')
          .ilike('user_email', instructor.email)
          .eq('source_type', 'shift_signup')
          .eq('source_id', signup.id)
          .single();

        if (existingMapping) {
          skipped++;
          continue;
        }

        try {
          await syncShiftSignup({
            userEmail: instructor.email,
            signupId: signup.id,
            shiftId: signup.shift_id,
            shiftTitle: shift.title || 'Shift',
            shiftDate: shift.date,
            startTime: shift.start_time || undefined,
            endTime: shift.end_time || undefined,
            department: shift.department || undefined,
            location: shift.location || undefined,
          });
          synced++;
        } catch {
          failed++;
        }

        await new Promise((r) => setTimeout(r, 200));
      }
    }

    return NextResponse.json({
      success: true,
      synced,
      failed,
      skipped,
      message: `Bulk sync complete: ${synced} created, ${failed} failed, ${skipped} skipped`,
    });
  } catch (error) {
    console.error('Error in bulk calendar sync:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to run bulk sync' },
      { status: 500 }
    );
  }
}
