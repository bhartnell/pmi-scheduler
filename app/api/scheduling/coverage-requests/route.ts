import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import { createNotification } from '@/lib/notifications';

/**
 * /api/scheduling/coverage-requests
 *
 * GET  → list requests, filter by ?status=pending (etc.) or ?mine=1 to
 *        return only the caller's own tickets.
 * POST → create a new coverage request. Lead_instructor+. Fires
 *        in-app notifications to Ryan + Ben so they see it on their
 *        dashboard next time they open /notifications.
 *
 * Approval (PATCH) lives in the [id] subroute because approval spawns
 * an open_shifts row + additional notifications.
 */

const VALID_TYPES = new Set(['lab', 'class', 'other']);
const VALID_URGENCY = new Set(['normal', 'urgent']);

const APPROVER_EMAILS = ['ryyoung@pmi.edu', 'bhartnell@pmi.edu'];

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const sp = request.nextUrl.searchParams;
    const status = sp.get('status');
    const mine = sp.get('mine') === '1';

    const supabase = getSupabaseAdmin();

    let q = supabase
      .from('coverage_requests')
      .select(
        `id, requested_by, lab_day_id, date, start_time, end_time,
         request_type, notes, urgency, status,
         approved_by, approved_at, created_shift_id, created_at, updated_at,
         requester:lab_users!coverage_requests_requested_by_fkey(id, name, email),
         approver:lab_users!coverage_requests_approved_by_fkey(id, name, email),
         lab_day:lab_days(id, date, title, cohort:cohorts(id, cohort_number, program:programs(abbreviation)))`
      )
      .order('urgency', { ascending: false }) // urgent before normal
      .order('date', { ascending: true })
      .order('created_at', { ascending: false });

    if (status) q = q.eq('status', status);
    if (mine) q = q.eq('requested_by', user.id);

    const { data, error } = await q;
    if (error) {
      console.error('[coverage-requests GET] error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, requests: data ?? [] });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    if (!hasMinRole(user.role, 'lead_instructor')) {
      return NextResponse.json(
        { error: 'Lead instructor or above required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      lab_day_id,
      date,
      start_time,
      end_time,
      request_type,
      notes,
      urgency,
    } = body as {
      lab_day_id?: string | null;
      date?: string;
      start_time?: string;
      end_time?: string;
      request_type?: string;
      notes?: string;
      urgency?: string;
    };

    if (!date || !start_time || !end_time) {
      return NextResponse.json(
        { error: 'date, start_time, and end_time are required' },
        { status: 400 }
      );
    }
    if (start_time >= end_time) {
      return NextResponse.json(
        { error: 'end_time must be after start_time' },
        { status: 400 }
      );
    }
    const type = (request_type ?? 'lab').toLowerCase();
    if (!VALID_TYPES.has(type)) {
      return NextResponse.json(
        { error: 'request_type must be lab, class, or other' },
        { status: 400 }
      );
    }
    const urg = (urgency ?? 'normal').toLowerCase();
    if (!VALID_URGENCY.has(urg)) {
      return NextResponse.json(
        { error: 'urgency must be normal or urgent' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data: inserted, error } = await supabase
      .from('coverage_requests')
      .insert({
        requested_by: user.id,
        lab_day_id: lab_day_id || null,
        date,
        start_time,
        end_time,
        request_type: type,
        notes: notes?.trim() || null,
        urgency: urg,
      })
      .select(
        `id, date, start_time, end_time, request_type, urgency, status, notes, created_at`
      )
      .single();

    if (error) {
      console.error('[coverage-requests POST] insert error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fire-and-forget notifications to approvers. Not awaited beyond
    // the try/catch — notification failures shouldn't bounce the request.
    const urgencyTag = urg === 'urgent' ? '[URGENT] ' : '';
    const typeLabel =
      type === 'class' ? 'class' : type === 'other' ? 'coverage' : 'lab';
    const formattedDate = (() => {
      try {
        return new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });
      } catch {
        return date;
      }
    })();
    const timeRange = `${start_time.slice(0, 5)}–${end_time.slice(0, 5)}`;
    await Promise.all(
      APPROVER_EMAILS.map((email) =>
        createNotification({
          userEmail: email,
          title: `${urgencyTag}Coverage request — ${typeLabel}`,
          message: `${user.name} needs coverage ${formattedDate} ${timeRange}. Review to approve or decline.`,
          type: 'general',
          category: 'scheduling',
          linkUrl: '/scheduling?tab=coverage',
          referenceType: 'coverage_request',
          referenceId: inserted.id,
        }).catch((e) => console.error('[coverage-requests] notify', email, e))
      )
    );

    return NextResponse.json({ success: true, request: inserted });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
