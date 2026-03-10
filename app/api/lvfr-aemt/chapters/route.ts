import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasMinRole } from '@/lib/permissions';

// ---------------------------------------------------------------------------
// GET /api/lvfr-aemt/chapters
//
// List all chapters with status, grouped by module.
// ---------------------------------------------------------------------------
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  if (!hasMinRole(user.role, 'instructor') &&
      user.role !== 'agency_liaison' &&
      user.role !== 'agency_observer' &&
      user.role !== 'student') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  const { data: chapters, error } = await supabase
    .from('lvfr_aemt_chapters')
    .select('*, module:lvfr_aemt_modules!lvfr_aemt_chapters_module_id_fkey(id, name, number)')
    .order('number', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group by module
  const byModule: Record<string, unknown[]> = {};
  for (const ch of chapters || []) {
    const modId = ch.module_id || 'unassigned';
    if (!byModule[modId]) byModule[modId] = [];
    byModule[modId].push(ch);
  }

  const completed = (chapters || []).filter(c => c.status === 'completed').length;
  const total = (chapters || []).length;

  return NextResponse.json({
    chapters: chapters || [],
    byModule,
    progress: { completed, total, percent: total > 0 ? Math.round((completed / total) * 100) : 0 },
  });
}

// ---------------------------------------------------------------------------
// PATCH /api/lvfr-aemt/chapters
//
// Mark chapter completed/in-progress.
// Body: { chapter_id, status }
// ---------------------------------------------------------------------------
export async function PATCH(request: NextRequest) {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();
  const { chapter_id, status } = body;

  if (!chapter_id || !status) {
    return NextResponse.json({ error: 'chapter_id and status are required' }, { status: 400 });
  }

  const validStatuses = ['not_started', 'in_progress', 'completed'];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const updateData: Record<string, unknown> = { status };
  if (status === 'completed') {
    updateData.completed_date = new Date().toISOString().split('T')[0];
  } else {
    updateData.completed_date = null;
  }

  const { data, error } = await supabase
    .from('lvfr_aemt_chapters')
    .update(updateData)
    .eq('id', chapter_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, chapter: data });
}
