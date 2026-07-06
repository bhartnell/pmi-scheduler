/**
 * One-off backfill: push unsynced station assignments, lab-day roles,
 * shift signups, class-schedule series, and LVFR assignments onto
 * instructors' Google Calendars.
 *
 * Mirrors POST /api/admin/calendar-sync exactly (same lib functions,
 * same lookback, same pacing) — run locally because that endpoint
 * requires an interactive admin session. Safe to re-run: every sync
 * function checks its google_calendar_events mapping before creating
 * (idempotency hardened in commit 0a98e539).
 *
 * Usage: npx tsx scripts/backfill-calendar-sync.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local before importing anything that reads process.env.
for (const line of readFileSync(resolve(__dirname, '../.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

async function main() {
  const { getSupabaseAdmin } = await import('../lib/supabase');
  const {
    syncLabStationAssignment,
    syncLabDayRole,
    syncShiftSignup,
    syncLvfrAssignment,
  } = await import('../lib/google-calendar');
  const { syncSeriesForUser } = await import('../lib/calendar-auto-sync');

  const supabase = getSupabaseAdmin();
  const today = new Date().toISOString().split('T')[0];
  const lookback = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const pace = () => new Promise((r) => setTimeout(r, 200));

  const counts = {
    stations: { synced: 0, skipped: 0, failed: 0 },
    roles: { synced: 0, skipped: 0, failed: 0 },
    shifts: { synced: 0, skipped: 0, failed: 0 },
    series: { created: 0, updated: 0, failed: 0 },
    lvfr: { synced: 0, skipped: 0, failed: 0 },
  };

  const { data: connectedUsers } = await supabase
    .from('lab_users')
    .select('id, email')
    .eq('google_calendar_connected', true)
    .eq('google_calendar_scope', 'events');
  const connectedEmails = new Set((connectedUsers ?? []).map((u) => u.email.toLowerCase()));
  console.log(`Connected users (events scope): ${connectedEmails.size}`);
  if (connectedEmails.size === 0) {
    console.log('No connected users — nothing to do.');
    return;
  }

  // CANARY: verify OUR OAuth client credentials against ONE user's token
  // before looping. On 2026-07-06 this script ran with a stale local
  // GOOGLE_CLIENT_SECRET — Google returned invalid_client for every user
  // and (via the then-unguarded getAccessTokenForUser) wiped all 8
  // instructors' stored connections. A client_error here means the env
  // this script is running in has the wrong secret: ABORT, fix the env.
  {
    const { refreshAccessTokenWithReason } = await import('../lib/calendar-availability');
    const { data: canaryUser } = await supabase
      .from('lab_users')
      .select('email, google_refresh_token')
      .eq('google_calendar_connected', true)
      .eq('google_calendar_scope', 'events')
      .not('google_refresh_token', 'is', null)
      .limit(1)
      .single();
    if (!canaryUser?.google_refresh_token) {
      console.error('ABORT: no user with a stored refresh token to canary-test against.');
      process.exit(1);
    }
    const canary = await refreshAccessTokenWithReason(canaryUser.google_refresh_token);
    if (canary.failure === 'client_error') {
      console.error(
        'ABORT: Google rejected OUR client credentials (invalid_client). ' +
        'The GOOGLE_CLIENT_SECRET in this environment is wrong/stale — ' +
        'update it before running. No sync was attempted.'
      );
      process.exit(1);
    }
    if (!canary.token) {
      console.error(
        `ABORT: canary token refresh failed (${canary.failure}) for ${canaryUser.email}. ` +
        'Not proceeding against all users on an unproven credential setup.'
      );
      process.exit(1);
    }
    console.log('Canary token refresh OK — credentials valid, proceeding.');
  }

  // 1. Station assignments (the 180-row backlog)
  const { data: stations } = await supabase
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
  for (const si of stations ?? []) {
    const station = si.station as any;
    const labDay = station?.lab_day;
    if (!labDay || !connectedEmails.has(si.user_email.toLowerCase())) {
      counts.stations.skipped++;
      continue;
    }
    const { data: existing } = await supabase
      .from('google_calendar_events')
      .select('id')
      .ilike('user_email', si.user_email)
      .eq('source_type', 'station_assignment')
      .eq('source_id', si.station_id)
      .maybeSingle();
    if (existing) {
      counts.stations.skipped++;
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
      counts.stations.synced++;
    } catch {
      counts.stations.failed++;
    }
    await pace();
  }
  console.log('Stations:', counts.stations);

  // 2. Lab day roles
  const { data: roles } = await supabase
    .from('lab_day_roles')
    .select(`
      id, lab_day_id, role,
      instructor:instructor_id(id, name, email),
      lab_day:lab_day_id(
        id, title, date, start_time, end_time,
        cohort:cohorts(cohort_number, program:programs(abbreviation))
      )
    `)
    .gte('lab_day.date', lookback);
  const roleNames: Record<string, string> = {
    lab_lead: 'Lab Lead', roamer: 'Roamer', observer: 'Observer', coordinator: 'Coordinator',
  };
  for (const role of roles ?? []) {
    const instructor = Array.isArray(role.instructor) ? role.instructor[0] : role.instructor;
    const labDay = Array.isArray(role.lab_day) ? role.lab_day[0] : (role.lab_day as any);
    if (!labDay || !instructor?.email || !connectedEmails.has(instructor.email.toLowerCase())) {
      counts.roles.skipped++;
      continue;
    }
    const { data: existing } = await supabase
      .from('google_calendar_events')
      .select('id')
      .ilike('user_email', instructor.email)
      .eq('source_type', 'lab_day_role')
      .eq('source_id', role.id)
      .maybeSingle();
    if (existing) {
      counts.roles.skipped++;
      continue;
    }
    const cohort = Array.isArray(labDay.cohort) ? labDay.cohort[0] : labDay.cohort;
    const program = cohort?.program
      ? (Array.isArray(cohort.program) ? cohort.program[0] : cohort.program)
      : null;
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
        cohortLabel: cohort && program?.abbreviation
          ? `${program.abbreviation} G${cohort.cohort_number}`
          : undefined,
        program: program?.abbreviation || undefined,
      });
      counts.roles.synced++;
    } catch {
      counts.roles.failed++;
    }
    await pace();
  }
  console.log('Roles:', counts.roles);

  // 3. Confirmed shift signups
  const { data: signups } = await supabase
    .from('shift_signups')
    .select(`
      id, shift_id,
      instructor:instructor_id(id, name, email),
      shift:shift_id(id, title, date, start_time, end_time, department, location)
    `)
    .eq('status', 'confirmed')
    .gte('shift.date', today);
  for (const signup of signups ?? []) {
    const instructor = Array.isArray(signup.instructor) ? signup.instructor[0] : signup.instructor;
    const shift = Array.isArray(signup.shift) ? signup.shift[0] : (signup.shift as any);
    if (!shift || !instructor?.email || !connectedEmails.has(instructor.email.toLowerCase())) {
      counts.shifts.skipped++;
      continue;
    }
    const { data: existing } = await supabase
      .from('google_calendar_events')
      .select('id')
      .ilike('user_email', instructor.email)
      .eq('source_type', 'shift_signup')
      .eq('source_id', signup.id)
      .maybeSingle();
    if (existing) {
      counts.shifts.skipped++;
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
      counts.shifts.synced++;
    } catch {
      counts.shifts.failed++;
    }
    await pace();
  }
  console.log('Shifts:', counts.shifts);

  // 4. Class-schedule series (pmi_schedule_blocks) per connected user
  const idToEmail = new Map<string, string>();
  for (const u of connectedUsers ?? []) idToEmail.set(u.id, u.email);
  const userIds = Array.from(idToEmail.keys());
  if (userIds.length > 0) {
    const { data: bi } = await supabase
      .from('pmi_block_instructors')
      .select('instructor_id, schedule_block_id')
      .in('instructor_id', userIds);
    const blockIds = Array.from(new Set((bi ?? []).map((r) => r.schedule_block_id).filter(Boolean)));
    if (blockIds.length > 0) {
      const { data: blocks } = await supabase
        .from('pmi_schedule_blocks')
        .select('id, recurring_group_id, status')
        .in('id', blockIds)
        .eq('status', 'published');
      const blockToGroup = new Map<string, string | null>();
      for (const b of blocks ?? []) blockToGroup.set(b.id, b.recurring_group_id);
      const pairs = new Set<string>();
      for (const r of bi ?? []) {
        if (!blockToGroup.has(r.schedule_block_id)) continue;
        const gid = blockToGroup.get(r.schedule_block_id);
        pairs.add(gid ? `${r.instructor_id}:group:${gid}` : `${r.instructor_id}:block:${r.schedule_block_id}`);
      }
      console.log(`Series pairs to sync: ${pairs.size}`);
      for (const key of pairs) {
        const [uid, kind, id] = key.split(':');
        const email = idToEmail.get(uid);
        if (!email) continue;
        try {
          const result = await syncSeriesForUser({
            userEmail: email,
            recurringGroupId: kind === 'group' ? id : null,
            blockIdForOneOff: kind === 'block' ? id : null,
          });
          if (result.status === 'synced') {
            if (result.created) counts.series.created++;
            else counts.series.updated++;
          } else if (result.status === 'failed') {
            counts.series.failed++;
          }
        } catch {
          counts.series.failed++;
        }
        await pace();
      }
    }
  }
  console.log('Series:', counts.series);

  // 5. LVFR assignments (expected no-op today: no instructors assigned yet)
  const { data: lvfr } = await supabase
    .from('lvfr_aemt_instructor_assignments')
    .select('id, day_number, date, primary_instructor_id, secondary_instructor_id');
  for (const a of lvfr ?? []) {
    for (const { instrId, role } of [
      { instrId: a.primary_instructor_id, role: 'primary' as const },
      { instrId: a.secondary_instructor_id, role: 'secondary' as const },
    ]) {
      if (!instrId) continue;
      const email = idToEmail.get(instrId);
      if (!email || !connectedEmails.has(email.toLowerCase())) {
        counts.lvfr.skipped++;
        continue;
      }
      try {
        await syncLvfrAssignment({
          userEmail: email,
          assignmentId: a.id,
          role,
          dayNumber: a.day_number,
          date: a.date,
        });
        counts.lvfr.synced++;
      } catch {
        counts.lvfr.failed++;
      }
      await pace();
    }
  }
  console.log('LVFR:', counts.lvfr);

  console.log('\n=== BACKFILL COMPLETE ===');
  console.log(JSON.stringify(counts, null, 2));
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  }
);
