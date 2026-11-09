import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAccessTokenForUser } from '@/lib/google-calendar';
import { OSCE_CAL_HOST_EMAIL, osceEventLabel } from '@/lib/osce-calendar';
import {
  buildOsceStudentEventBody,
  computeSlotTime,
  resolveOsceStudent,
  upsertOsceStudentEvent,
  type RosterStudent,
  type SlotTime,
} from '@/lib/osce-student-invites';

/**
 * Per-student OSCE slot invites.
 *
 * GET  - preview only: resolved email, computed times (offset 0, 15 and the
 *        saved offset), per-row invite state. No Google calls, no writes.
 * POST - the ONLY send path. Admin clicks the button + confirm dialog. Creates
 *        or updates one event per student on the host calendar. Never touches
 *        the evaluator block events or their attendees.
 */

interface ScheduleRow {
  id: string;
  student_name: string;
  slot_number: number;
  time_block_id: string;
  google_event_id?: string | null;
  invite_sent_at?: string | null;
  invite_error?: string | null;
}

async function loadContext(supabase: SupabaseClient, eventId: string) {
  const { data: event } = await supabase.from('osce_events').select('*').eq('id', eventId).single();
  if (!event) return { error: 'Event not found', status: 404 as const };

  const { data: blocks } = await supabase.from('osce_time_blocks').select('id, label, date, start_time, end_time, day_number').eq('event_id', eventId);
  const { data: rowsRaw } = await supabase
    .from('osce_student_schedule')
    .select('*')
    .eq('event_id', eventId)
    .order('time_block_id')
    .order('slot_number');
  const rows = (rowsRaw ?? []) as ScheduleRow[];
  // select('*') omits columns that do not exist yet: tells us whether the migration is applied.
  const migrated = rows.length === 0 || 'invite_sent_at' in rows[0];

  let roster: RosterStudent[] = [];
  if (event.cohort_id) {
    const { data: students } = await supabase
      .from('students')
      .select('id, first_name, last_name, email')
      .eq('cohort_id', event.cohort_id)
      .eq('status', 'active');
    roster = (students ?? []) as RosterStudent[];
  }
  return { event, blocks: blocks ?? [], rows, roster, migrated };
}

const offsetOf = (event: { first_slot_offset_min?: number | null }) =>
  typeof event.first_slot_offset_min === 'number' ? event.first_slot_offset_min : null;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;
  try {
    const { id: eventId } = await params;
    const ctx = await loadContext(getSupabaseAdmin(), eventId);
    if ('error' in ctx) return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status });
    const { event, blocks, rows, roster, migrated } = ctx;
    const mps: number = event.minutes_per_student;
    const saved = offsetOf(event);

    const preview = rows.map((r) => {
      const block = blocks.find((b) => b.id === r.time_block_id);
      const res = resolveOsceStudent(r.student_name, roster);
      const at = (off: number): SlotTime | null =>
        block ? computeSlotTime({ blockStart: block.start_time, offsetMin: off, slotNumber: r.slot_number, minutesPerStudent: mps }) : null;
      return {
        id: r.id,
        student_name: r.student_name,
        slot_number: r.slot_number,
        block_label: block?.label ?? null,
        date: block?.date ?? null,
        email: res.status === 'resolved' ? res.email : null,
        resolved_as: res.status === 'resolved' ? `${res.student.first_name} ${res.student.last_name}` : null,
        unresolved_reason: res.status === 'unresolved' ? res.reason : null,
        time_offset_0: at(0),
        time_offset_15: at(15),
        time_saved: saved === null ? null : at(saved),
        state: r.invite_sent_at ? 'sent' : r.invite_error ? 'failed' : 'pending',
        invite_error: r.invite_error ?? null,
      };
    });

    return NextResponse.json({
      success: true,
      migrated,
      cohort_set: !!event.cohort_id,
      first_slot_offset_min: saved,
      minutes_per_student: mps,
      rows: preview,
      counts: {
        total: preview.length,
        resolved: preview.filter((p) => p.email).length,
        unresolved: preview.filter((p) => !p.email).length,
        sent: preview.filter((p) => p.state === 'sent').length,
      },
    });
  } catch (err) {
    console.error('[osce student-invites] preview failed:', err);
    return NextResponse.json({ success: false, error: 'Failed to build preview' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;
  try {
    const { id: eventId } = await params;
    const body = await request.json().catch(() => ({}));
    if (body?.confirm !== true) {
      return NextResponse.json({ success: false, error: 'Confirmation required. Use the Send student slot invites button.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const ctx = await loadContext(supabase, eventId);
    if ('error' in ctx) return NextResponse.json({ success: false, error: ctx.error }, { status: ctx.status });
    const { event, blocks, rows, roster, migrated } = ctx;

    if (!migrated) {
      return NextResponse.json({ success: false, error: 'The student-invite database columns are not applied yet. Nothing was sent.' }, { status: 409 });
    }
    const offset = offsetOf(event);
    if (offset === null) {
      return NextResponse.json({ success: false, error: 'Set the first-slot offset in Settings first. Nothing was sent.' }, { status: 400 });
    }
    if (!event.cohort_id) {
      return NextResponse.json({ success: false, error: 'Set a cohort for this event in Settings first. Nothing was sent.' }, { status: 400 });
    }
    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'No student schedule rows for this event.' }, { status: 400 });
    }

    const token = await getAccessTokenForUser(OSCE_CAL_HOST_EMAIL);
    if (!token) {
      return NextResponse.json({ success: false, error: 'Calendar token for the OSCE host is unavailable. Nothing was sent.' }, { status: 502 });
    }

    const label = osceEventLabel(event);
    const results: Array<{
      id: string;
      student_name: string;
      email: string | null;
      time: string | null;
      result: 'sent' | 'updated' | 'unchanged' | 'failed' | 'unresolved';
      detail?: string;
    }> = [];

    for (const r of rows) {
      const block = blocks.find((b) => b.id === r.time_block_id);
      const res = resolveOsceStudent(r.student_name, roster);
      if (!block) {
        results.push({ id: r.id, student_name: r.student_name, email: null, time: null, result: 'failed', detail: 'Time block not found' });
        continue;
      }
      if (res.status === 'unresolved') {
        results.push({ id: r.id, student_name: r.student_name, email: null, time: null, result: 'unresolved', detail: res.reason });
        continue;
      }
      const slot = computeSlotTime({ blockStart: block.start_time, offsetMin: offset, slotNumber: r.slot_number, minutesPerStudent: event.minutes_per_student });
      const evBody = buildOsceStudentEventBody({
        eventLabel: label,
        eventLocation: event.location,
        blockLabel: block.label,
        date: block.date,
        slot,
        firstName: res.student.first_name,
        lastName: res.student.last_name,
        email: res.email,
      });
      const out = await upsertOsceStudentEvent({ accessToken: token, scheduleRowId: r.id, existingEventId: r.google_event_id, body: evBody });
      const time = `${block.date} ${slot.start}-${slot.end}`;

      if (out.status === 'error') {
        await supabase.from('osce_student_schedule').update({ invite_error: out.error }).eq('id', r.id);
        results.push({ id: r.id, student_name: r.student_name, email: res.email, time, result: 'failed', detail: out.error });
        continue;
      }
      const stamp = out.status === 'sent' || out.status === 'updated'
        ? { google_event_id: out.eventId, invite_sent_at: new Date().toISOString(), invite_error: null }
        : { google_event_id: out.eventId, invite_error: null };
      const { error: stampErr } = await supabase
        .from('osce_student_schedule')
        .update(r.invite_sent_at && out.status === 'unchanged' ? { invite_error: null } : stamp)
        .eq('id', r.id);
      if (stampErr) console.error('[osce student-invites] stamp failed for row', r.id, stampErr.message);
      results.push({
        id: r.id,
        student_name: r.student_name,
        email: res.email,
        time,
        result: out.status,
        detail: out.status === 'updated' ? `Changed: ${out.changed.join(', ')}${out.notified ? ' (student notified)' : ' (no email)'}` : undefined,
      });
    }

    const count = (k: string) => results.filter((x) => x.result === k).length;
    return NextResponse.json({
      success: true,
      counts: { sent: count('sent'), updated: count('updated'), unchanged: count('unchanged'), failed: count('failed'), unresolved: count('unresolved') },
      results,
    });
  } catch (err) {
    console.error('[osce student-invites] send failed:', err);
    return NextResponse.json({ success: false, error: 'Send failed unexpectedly' }, { status: 500 });
  }
}
