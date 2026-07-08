import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canEditLVFR } from '@/lib/permissions';
import { getLvfrCohorts } from '@/lib/lvfr-cohorts';

// ---------------------------------------------------------------------------
// /api/lvfr-aemt/skills/class-completion
//
// Side 1 of skills tracking: CLASS-LEVEL (roster-based) completion.
// Mark a skill "covered for the class" per cohort. Once covered, the skill is
// treated as completed for the whole roster (NOT per-student scored). Rare
// failures are a manual exception off the blank reference sheet, not tracked.
//
// Auth: instructor+ (non-agency) for both read and write — instructor tool.
// ---------------------------------------------------------------------------

// LVFR cohort selection lives in lib/lvfr-cohorts.ts (shared with the
// matrix + summary readers so they can't drift).

// GET /api/lvfr-aemt/skills/class-completion?cohort_id=...
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  if (!canEditLVFR(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const cohorts = await getLvfrCohorts(supabase);

  const requested = request.nextUrl.searchParams.get('cohort_id');
  const selectedCohortId =
    requested && cohorts.some(c => c.id === requested)
      ? requested
      : (cohorts[0]?.id ?? null);

  // All skills with the temporal "needed/when" fields.
  const { data: skills, error: skillsError } = await supabase
    .from('lvfr_aemt_skills')
    .select('id, category, name, description, nremt_tested, introduced_day, practice_days, evaluation_day')
    .order('category')
    .order('name');

  if (skillsError) {
    return NextResponse.json({ error: skillsError.message }, { status: 500 });
  }

  // Completion rows for the selected cohort, keyed by skill_id.
  const completion: Record<string, { completed: boolean; completed_date: string | null; completed_by: string | null; notes: string | null }> = {};
  if (selectedCohortId) {
    const { data: rows } = await supabase
      .from('lvfr_aemt_skill_class_completion')
      .select('skill_id, completed, completed_date, completed_by, notes')
      .eq('cohort_id', selectedCohortId);
    for (const r of rows || []) {
      completion[r.skill_id] = {
        completed: r.completed,
        completed_date: r.completed_date,
        completed_by: r.completed_by,
        notes: r.notes,
      };
    }
  }

  const total = (skills || []).length;
  const completed = (skills || []).filter(s => completion[s.id]?.completed).length;

  return NextResponse.json({
    cohorts,
    selected_cohort_id: selectedCohortId,
    skills: skills || [],
    completion,
    summary: { total, completed, percent: total > 0 ? Math.round((completed / total) * 100) : 0 },
  });
}

// POST /api/lvfr-aemt/skills/class-completion
// Body: { cohort_id, skill_id, completed, notes? }
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  if (!canEditLVFR(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || !body.cohort_id || !body.skill_id) {
    return NextResponse.json({ error: 'cohort_id and skill_id are required' }, { status: 400 });
  }

  const completed = body.completed === true;
  const today = new Date().toISOString().slice(0, 10);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('lvfr_aemt_skill_class_completion')
    .upsert(
      {
        cohort_id: body.cohort_id,
        skill_id: body.skill_id,
        completed,
        completed_date: completed ? today : null,
        completed_by: completed ? user.email : null,
        notes: body.notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'cohort_id,skill_id' }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, record: data });
}
