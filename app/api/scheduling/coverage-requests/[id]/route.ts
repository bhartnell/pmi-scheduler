import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import { createNotification } from '@/lib/notifications';

/**
 * PATCH /api/scheduling/coverage-requests/[id]
 *
 * Lifecycle transitions:
 *   action='approve'  (admin+) → sets status=approved, creates an
 *                                 open_shifts row covering the request,
 *                                 notifies all active part-timers that a
 *                                 new shift is open.
 *   action='decline'  (admin+) → sets status=cancelled.
 *   action='cancel'   (requester or admin+) → requester pulls their own
 *                                              ticket.
 *
 * The split between "decline" and "cancel" is who did it, but they both
 * land at status=cancelled — the distinction lives in approved_by (NULL
 * for self-cancel, populated for admin decline).
 */

async function getPartTimerEmails(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const { data } = await supabase
    .from('lab_users')
    .select('email')
    .eq('is_part_time', true)
    .eq('is_active', true);
  return (data ?? [])
    .map((r: { email: string }) => r.email)
    .filter(Boolean);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const { id } = await params;
    const body = await request.json();
    const action = String(body?.action || '').toLowerCase();

    if (!['approve', 'decline', 'cancel'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be approve, decline, or cancel' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Load the request
    const { data: req, error: fetchErr } = await supabase
      .from('coverage_requests')
      .select(
        `id, requested_by, lab_day_id, date, start_time, end_time,
         request_type, urgency, status, notes,
         requester:lab_users!coverage_requests_requested_by_fkey(id, name, email),
         lab_day:lab_days(id, title, cohort:cohorts(cohort_number, program:programs(abbreviation)))`
      )
      .eq('id', id)
      .single();

    if (fetchErr || !req) {
      return NextResponse.json(
        { error: 'Coverage request not found' },
        { status: 404 }
      );
    }

    if (req.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot ${action} — request is already ${req.status}` },
        { status: 409 }
      );
    }

    // Auth gate per action.
    if (action === 'cancel') {
      const isOwner = req.requested_by === user.id;
      const isAdmin = hasMinRole(user.role, 'admin');
      if (!isOwner && !isAdmin) {
        return NextResponse.json(
          { error: 'Only the requester or an admin can cancel' },
          { status: 403 }
        );
      }
    } else {
      // approve / decline
      if (!hasMinRole(user.role, 'admin')) {
        return NextResponse.json(
          { error: 'Admin role required to approve or decline' },
          { status: 403 }
        );
      }
    }

    if (action === 'decline' || action === 'cancel') {
      const { data: updated, error: updErr } = await supabase
        .from('coverage_requests')
        .update({
          status: 'cancelled',
          approved_by: action === 'decline' ? user.id : null,
          approved_at: action === 'decline' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('id, status')
        .single();

      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 500 });
      }

      // Notify the requester that their ticket was declined (cancel by
      // self is obvious — skip that notification).
      if (action === 'decline' && (req.requester as any)?.email) {
        await createNotification({
          userEmail: (req.requester as any).email,
          title: 'Coverage request declined',
          message: `Your coverage request for ${req.date} ${req.start_time.slice(0, 5)}–${req.end_time.slice(0, 5)} was declined.`,
          type: 'general',
          category: 'scheduling',
          linkUrl: '/scheduling?tab=coverage',
          referenceType: 'coverage_request',
          referenceId: id,
        }).catch((e) => console.error('[coverage-requests] requester notify', e));
      }

      return NextResponse.json({ success: true, request: updated });
    }

    // ── approve: create an open_shifts row, link it back, notify part-timers ──
    const labDay = (req.lab_day as any) || null;
    const cohortLabel = labDay?.cohort
      ? `${labDay.cohort.program?.abbreviation ?? ''} ${labDay.cohort.cohort_number}`.trim()
      : null;
    const shiftTitle =
      labDay?.title ||
      cohortLabel ||
      (req.request_type === 'class' ? 'Class coverage' : 'Coverage needed');
    const shiftDescription = [
      `Spawned from coverage request (${req.urgency}).`,
      req.notes ? `Notes: ${req.notes}` : null,
      `Requested by ${(req.requester as any)?.name || '(unknown)'}.`,
    ]
      .filter(Boolean)
      .join(' ');

    const { data: shift, error: shiftErr } = await supabase
      .from('open_shifts')
      .insert({
        title: shiftTitle,
        description: shiftDescription,
        date: req.date,
        start_time: req.start_time,
        end_time: req.end_time,
        lab_day_id: req.lab_day_id,
        created_by: user.id,
        min_instructors: 1,
        max_instructors: 1,
      })
      .select('id, title, date, start_time, end_time')
      .single();

    if (shiftErr || !shift) {
      console.error('[coverage-requests] shift create', shiftErr);
      return NextResponse.json(
        { error: shiftErr?.message || 'Failed to create shift' },
        { status: 500 }
      );
    }

    const { data: updated, error: updErr } = await supabase
      .from('coverage_requests')
      .update({
        status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        created_shift_id: shift.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, status, created_shift_id')
      .single();

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    // Notify part-timers of the new shift, plus the requester that it
    // was approved. Failures are logged, not fatal.
    const prettyDate = (() => {
      try {
        return new Date(req.date + 'T12:00:00').toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });
      } catch {
        return req.date;
      }
    })();
    const timeRange = `${req.start_time.slice(0, 5)}–${req.end_time.slice(0, 5)}`;

    const ptEmails = await getPartTimerEmails(supabase);
    await Promise.all(
      ptEmails.map((email) =>
        createNotification({
          userEmail: email,
          title: 'New open shift',
          message: `${shiftTitle} — ${prettyDate} ${timeRange}. Sign up if available.`,
          type: 'general',
          category: 'scheduling',
          linkUrl: '/scheduling/shifts',
          referenceType: 'open_shift',
          referenceId: shift.id,
        }).catch((e) => console.error('[coverage-requests] pt notify', email, e))
      )
    );

    if ((req.requester as any)?.email) {
      await createNotification({
        userEmail: (req.requester as any).email,
        title: 'Coverage request approved',
        message: `Your request for ${prettyDate} ${timeRange} was approved. Open shift posted to part-timers.`,
        type: 'general',
        category: 'scheduling',
        linkUrl: '/scheduling?tab=coverage',
        referenceType: 'coverage_request',
        referenceId: id,
      }).catch((e) => console.error('[coverage-requests] requester notify', e));
    }

    return NextResponse.json({
      success: true,
      request: updated,
      shift,
      notified: ptEmails.length,
    });
  } catch (e) {
    console.error('[coverage-requests PATCH] error', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
