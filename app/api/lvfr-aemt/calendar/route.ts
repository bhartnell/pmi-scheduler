import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';
import { logRecordAccess } from '@/lib/ferpa';

// ---------------------------------------------------------------------------
// GET /api/lvfr-aemt/calendar
//
// List all 30 course days with status, module info, chapter coverage.
// Filterable by week, day_type, status.
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  // LVFR access check: instructor+, agency roles, or LVFR student
  if (!hasMinRole(user.role, 'instructor') &&
      user.role !== 'agency_liaison' &&
      user.role !== 'agency_observer' &&
      user.role !== 'student') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const week = request.nextUrl.searchParams.get('week');
  const dayType = request.nextUrl.searchParams.get('day_type');
  const status = request.nextUrl.searchParams.get('status');

  let query = supabase
    .from('lvfr_aemt_course_days')
    .select('*, module:lvfr_aemt_modules!lvfr_aemt_course_days_module_id_fkey(id, name, number)')
    .order('day_number', { ascending: true });

  if (week) query = query.eq('week_number', parseInt(week));
  if (dayType) query = query.eq('day_type', dayType);
  if (status) query = query.eq('status', status);

  const { data: days, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also fetch supplementary days
  const { data: supplementaryDays } = await supabase
    .from('lvfr_aemt_supplementary_days')
    .select('*')
    .order('date', { ascending: true });

  // Calculate pace info for instructors
  let paceInfo = null;
  if (hasMinRole(user.role, 'instructor') || user.role === 'agency_liaison') {
    const completedChapters = (days || [])
      .filter(d => d.status === 'completed')
      .reduce((sum: number, d: Record<string, unknown>) => sum + ((d.chapters_covered as string[])?.length || 0), 0);

    const today = new Date().toISOString().split('T')[0];
    const scheduledThroughToday = (days || [])
      .filter(d => d.date <= today)
      .reduce((sum: number, d: Record<string, unknown>) => sum + ((d.chapters_covered as string[])?.length || 0), 0);

    const totalChapters = (days || [])
      .reduce((sum: number, d: Record<string, unknown>) => sum + ((d.chapters_covered as string[])?.length || 0), 0);

    paceInfo = {
      completedChapters,
      scheduledThroughToday,
      totalChapters,
      status: completedChapters >= scheduledThroughToday ? 'on_track' :
              completedChapters >= scheduledThroughToday * 0.8 ? 'slightly_behind' : 'behind',
    };
  }

  return NextResponse.json({
    days: days || [],
    supplementaryDays: supplementaryDays || [],
    paceInfo,
  });
}

// ---------------------------------------------------------------------------
// PATCH /api/lvfr-aemt/calendar
//
// Update day status — instructor marks chapters completed, adds notes.
// Body: { day_number, status?, completion_notes?, chapters_completed?: string[] }
// ---------------------------------------------------------------------------
export async function PATCH(request: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const body = await request.json();
  const { day_number, status, completion_notes, chapters_completed } = body;

  if (!day_number) {
    return NextResponse.json({ error: 'day_number is required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const updateData: Record<string, unknown> = {};

  if (status) updateData.status = status;
  if (completion_notes !== undefined) updateData.completion_notes = completion_notes;
  if (status === 'completed') {
    updateData.completed_by = user.email;
    updateData.completed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('lvfr_aemt_course_days')
    .update(updateData)
    .eq('day_number', day_number)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If chapters were completed, update chapter status too
  if (chapters_completed && Array.isArray(chapters_completed)) {
    for (const chapterId of chapters_completed) {
      await supabase
        .from('lvfr_aemt_chapters')
        .update({
          status: 'completed',
          completed_date: new Date().toISOString().split('T')[0],
        })
        .eq('id', chapterId);
    }
  }

  logRecordAccess({
    userEmail: user.email,
    userRole: user.role,
    dataType: 'attendance',
    action: 'modify',
    route: '/api/lvfr-aemt/calendar',
    details: { day_number, status },
  }).catch(() => {});

  return NextResponse.json({ success: true, day: data });
}
