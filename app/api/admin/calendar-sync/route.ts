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
    // Extend lookback 180 days to catch lab assignments that failed to sync at the time
    const lookback = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let synced = 0;
    let failed = 0;
    let skipped = 0;

    // Support per-user sync via optional body parameter
    let targetEmail: string | null = null;
    try {
      const body = await request.json();
      if (body.userEmail) {
        targetEmail = body.userEmail;
      }
    } catch {
      // No body or invalid JSON — proceed with bulk sync
    }

    // Get connected users with 'events' scope
    let userQuery = supabase
      .from('lab_users')
      .select('email, google_calendar_scope')
      .eq('google_calendar_connected', true)
      .eq('google_calendar_scope', 'events');

    if (targetEmail) {
      userQuery = userQuery.ilike('email', targetEmail);
    }

    const { data: connectedUsers } = await userQuery;

    if (!connectedUsers || connectedUsers.length === 0) {
      return NextResponse.json({
        success: true,
        synced: 0,
        failed: 0,
        skipped: 0,
        message: targetEmail
          ? `User ${targetEmail} is not connected or has insufficient scope`
          : 'No users with calendar events scope connected',
      });
    }

    const connectedEmails = new Set(connectedUsers.map((u) => u.email.toLowerCase()));

    // Import calendar functions
    const {
      syncLabStationAssignment,
      syncLabDayRole,
      syncShiftSignup,
      syncLvfrAssignment,
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
      .gte('station.lab_day.date', lookback);

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
    //    Pull cohort_number + program abbreviation so the event
    //    title can read "Lab — PM G14 · {title}" and the time
    //    fallback can pick a per-program default for lab_days
    //    rows with NULL start/end.
    const { data: futureRoles } = await supabase
      .from('lab_day_roles')
      .select(`
        id, lab_day_id, role,
        instructor:instructor_id(id, name, email),
        lab_day:lab_day_id(
          id, title, date, start_time, end_time,
          cohort:cohorts(
            cohort_number,
            program:programs(abbreviation)
          )
        )
      `)
      .gte('lab_day.date', lookback);

    if (futureRoles) {
      const roleNames: Record<string, string> = {
        lab_lead: 'Lab Lead',
        roamer: 'Roamer',
        observer: 'Observer',
        coordinator: 'Coordinator',
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

        // Unpack cohort context for the new title format + program-aware
        // time fallback. Supabase returns either a single object or a
        // single-element array depending on the join shape.
        const cohort = Array.isArray((labDay as any).cohort)
          ? (labDay as any).cohort[0]
          : (labDay as any).cohort;
        const program = cohort?.program
          ? (Array.isArray(cohort.program) ? cohort.program[0] : cohort.program)
          : null;
        const cohortLabel = cohort && program?.abbreviation
          ? `${program.abbreviation} G${cohort.cohort_number}`
          : undefined;

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
            cohortLabel,
            program: program?.abbreviation || undefined,
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

    // 4. Sync recurring class series (pmi_schedule_blocks) per user.
    //    The original three sources above only cover lab stations,
    //    lab day roles, and shift signups — they ignore the
    //    instructor's full class schedule. Without this loop the
    //    "Sync All" button left every instructor's calendar
    //    showing first-occurrence-only events for the schedule
    //    blocks they teach. Calls into the same syncSeriesForUser
    //    helper that the per-user /api/calendar/sync-my-blocks
    //    endpoint and the auto-sync hook use, so the recurrence /
    //    ownership-guard / PATCH-with-RRULE behaviour is shared.
    let seriesSynced = 0;
    let seriesUpdated = 0;
    let seriesFailed = 0;
    const usersTouched = new Set<string>();
    try {
      const { syncSeriesForUser } = await import('@/lib/calendar-auto-sync');
      // Find every distinct recurring_group_id the connected users
      // are assigned to. One round-trip rather than N+1.
      const connectedEmailList = Array.from(connectedEmails);
      if (connectedEmailList.length > 0) {
        // Resolve emails → user_ids in one query.
        const { data: userIdRows } = await supabase
          .from('lab_users')
          .select('id, email')
          .in('email', Array.from(new Set(connectedUsers.map(u => u.email))));
        const idToEmail = new Map<string, string>();
        for (const r of userIdRows ?? []) idToEmail.set(r.id, r.email);
        const userIds = Array.from(idToEmail.keys());

        if (userIds.length > 0) {
          // pmi_block_instructors → schedule_block_ids assigned to them
          const { data: bi } = await supabase
            .from('pmi_block_instructors')
            .select('instructor_id, schedule_block_id')
            .in('instructor_id', userIds);
          // schedule_block_ids → recurring_group_ids
          const blockIds = Array.from(
            new Set((bi ?? []).map(r => r.schedule_block_id).filter(Boolean))
          );
          if (blockIds.length > 0) {
            const { data: blocks } = await supabase
              .from('pmi_schedule_blocks')
              .select('id, recurring_group_id, status')
              .in('id', blockIds)
              .eq('status', 'published');
            const blockToGroup = new Map<string, string | null>();
            for (const b of blocks ?? []) {
              blockToGroup.set(b.id, b.recurring_group_id);
            }
            // Build (instructor_id, group_or_block) pairs to sync.
            const pairs = new Set<string>();
            for (const r of bi ?? []) {
              const gid = blockToGroup.get(r.schedule_block_id);
              if (!blockToGroup.has(r.schedule_block_id)) continue; // dropped above
              const key = gid
                ? `${r.instructor_id}:group:${gid}`
                : `${r.instructor_id}:block:${r.schedule_block_id}`;
              pairs.add(key);
            }
            for (const key of pairs) {
              const [uid, kind, id] = key.split(':');
              const email = idToEmail.get(uid);
              if (!email) continue;
              if (targetEmail && email.toLowerCase() !== targetEmail.toLowerCase()) {
                continue;
              }
              try {
                const result = await syncSeriesForUser({
                  userEmail: email,
                  recurringGroupId: kind === 'group' ? id : null,
                  blockIdForOneOff: kind === 'block' ? id : null,
                });
                if (result.status === 'synced') {
                  if (result.created) seriesSynced++;
                  else seriesUpdated++;
                  usersTouched.add(email.toLowerCase());
                } else if (result.status === 'failed') {
                  seriesFailed++;
                }
              } catch (err) {
                console.error('series sync error', err);
                seriesFailed++;
              }
              // Pace per-user calls — Google quotas are per-user.
              await new Promise(r => setTimeout(r, 200));
            }
          }
        }
      }
    } catch (err) {
      console.error('Series sync block failed:', err);
    }

    // 5. Sync LVFR AEMT instructor assignments (all 30 course days, no date filter)
    let lvfrSynced = 0;
    let lvfrFailed = 0;
    let lvfrSkipped = 0;

    const { data: lvfrAssignments } = await supabase
      .from('lvfr_aemt_instructor_assignments')
      .select('id, day_number, date, primary_instructor_id, secondary_instructor_id, additional_instructors');

    if (lvfrAssignments && lvfrAssignments.length > 0) {
      // Collect all unique instructor IDs
      const allLvfrInstructorIds = new Set<string>();
      for (const a of lvfrAssignments) {
        if (a.primary_instructor_id) allLvfrInstructorIds.add(a.primary_instructor_id);
        if (a.secondary_instructor_id) allLvfrInstructorIds.add(a.secondary_instructor_id);
        for (const id of a.additional_instructors ?? []) allLvfrInstructorIds.add(id);
      }

      if (allLvfrInstructorIds.size > 0) {
        const { data: lvfrUsers } = await supabase
          .from('lab_users')
          .select('id, email')
          .in('id', Array.from(allLvfrInstructorIds));

        const lvfrIdToEmail = new Map<string, string>();
        for (const u of lvfrUsers ?? []) lvfrIdToEmail.set(u.id, u.email);

        // Fetch per-instructor custom times from plan_placements
        const { data: placements } = await supabase
          .from('lvfr_aemt_plan_placements')
          .select('instructor_id, date, start_time, end_time, custom_title');

        const placementMap = new Map<string, { start_time: string; end_time: string; custom_title?: string }>();
        for (const p of placements ?? []) {
          placementMap.set(`${p.instructor_id}:${p.date}`, {
            start_time: p.start_time,
            end_time: p.end_time,
            custom_title: p.custom_title ?? undefined,
          });
        }

        for (const a of lvfrAssignments) {
          const rolePairs: Array<{ instrId: string | null; role: 'primary' | 'secondary' | 'additional' }> = [
            { instrId: a.primary_instructor_id, role: 'primary' },
            { instrId: a.secondary_instructor_id, role: 'secondary' },
            ...(a.additional_instructors ?? []).map((instrId: string) => ({ instrId, role: 'additional' as const })),
          ];
          for (const { instrId, role } of rolePairs) {
            if (!instrId) continue;
            const email = lvfrIdToEmail.get(instrId);
            if (!email || !connectedEmails.has(email.toLowerCase())) {
              lvfrSkipped++;
              continue;
            }
            if (targetEmail && email.toLowerCase() !== targetEmail.toLowerCase()) {
              lvfrSkipped++;
              continue;
            }

            const compositeId = `${a.id}:${role}`;
            const { data: existingLvfrMapping } = await supabase
              .from('google_calendar_events')
              .select('id')
              .ilike('user_email', email)
              .eq('source_type', 'lvfr_assignment')
              .eq('source_id', compositeId)
              .single();

            if (existingLvfrMapping) {
              lvfrSkipped++;
              continue;
            }

            const placement = placementMap.get(`${instrId}:${a.date}`);
            try {
              await syncLvfrAssignment({
                userEmail: email,
                assignmentId: a.id,
                role,
                dayNumber: a.day_number,
                date: a.date,
                startTime: placement?.start_time || undefined,
                endTime: placement?.end_time || undefined,
                customTitle: placement?.custom_title || undefined,
              });
              lvfrSynced++;
            } catch {
              lvfrFailed++;
            }

            await new Promise((r) => setTimeout(r, 200));
          }
        }
      }
    }

    // 6. General-lab-default (Option B + precedence): every active paramedic-tagged
    //    instructor gets a general-lab event on every upcoming paramedic lab day
    //    they don't already have a station/role for. Idempotent.
    let generalLab = { created: 0, removed: 0, skipped: 0, instructors: 0, labDays: 0 };
    try {
      const { syncGeneralLabDefaults } = await import('@/lib/general-lab-sync');
      generalLab = await syncGeneralLabDefaults(supabase, targetEmail ? { targetEmail } : {});
    } catch (err) {
      console.error('General-lab-default sync block failed:', err);
    }

    // 7. PALS all-day events: instructors whose regular class is replaced by
    //    a PALS course day get an all-day "PALS Certification" event.
    //    Idempotent, cohort-scoped/repeatable (not G14/date-hardcoded).
    let palsAllDay = { created: 0, instructors: 0, palsDays: 0 };
    try {
      const { syncPalsAllDayEvents } = await import('@/lib/pals-all-day-sync');
      palsAllDay = await syncPalsAllDayEvents(supabase, targetEmail ? { targetEmail } : {});
    } catch (err) {
      console.error('PALS all-day sync block failed:', err);
    }

    return NextResponse.json({
      success: true,
      synced,
      failed,
      skipped,
      series_synced: seriesSynced,
      series_updated: seriesUpdated,
      series_failed: seriesFailed,
      lvfr_synced: lvfrSynced,
      lvfr_failed: lvfrFailed,
      lvfr_skipped: lvfrSkipped,
      general_lab_created: generalLab.created,
      general_lab_skipped: generalLab.skipped,
      pals_all_day_created: palsAllDay.created,
      users_touched: usersTouched.size,
      message:
        `Bulk sync complete: ${synced} events created, ${seriesSynced} class series ` +
        `created, ${seriesUpdated} series updated, ${lvfrSynced} LVFR events created, ` +
        `${generalLab.created} general-lab events created, ${palsAllDay.created} PALS all-day events created, ` +
        `${failed + seriesFailed + lvfrFailed} failed, ${skipped + lvfrSkipped} skipped`,
    });
  } catch (error) {
    console.error('Error in bulk calendar sync:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to run bulk sync' },
      { status: 500 }
    );
  }
}
