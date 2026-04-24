import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

/**
 * POST /api/scheduling/notify-lab-availability
 *
 * Admin setter for lab_users.notify_lab_availability. When true, that
 * user receives an in-app notification every time a new lab day is
 * created (see app/api/lab-management/lab-days/route.ts POST for the
 * fan-out). Default false; flip on per-user (Gannon by default via
 * migration 20260423_lab_availability_notifications.sql).
 *
 * Body: { user_id: string, enabled: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('instructor');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    if (!hasMinRole(user.role, 'lead_instructor')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { user_id, enabled } = body as {
      user_id?: string;
      enabled?: boolean;
    };

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('lab_users')
      .update({ notify_lab_availability: !!enabled })
      .eq('id', user_id)
      .select('id, notify_lab_availability')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
