import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/lvfr-aemt/runsheet/progress
 *
 * Course-wide Tier-1 coverage roll-up for the LVFR runsheet (H2 3-tier model).
 * Aggregates TRACKED items (requirement='required' = chapters / quizzes / labs /
 * exams / skills) across every runsheet day so instructors can see at a glance
 * what's covered, what's outstanding, and where the gaps are — even when days
 * run out of order.
 *
 * Tier 2 (optional/activities) and Tier 3 (info/breaks) are intentionally
 * excluded from the completion meter; Tier 2 is reported separately as a count
 * for context.
 *
 * The lvfr_* tables are single-cohort (one active LVFR cohort), so this rolls up
 * across all runsheet days without per-cohort filtering. Read-only.
 */
export async function GET() {
  const auth = await requireAuth('instructor');
  if (auth instanceof NextResponse) return auth;

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('lvfr_schedule_items')
    .select('title, item_type, requirement, is_completed, day:lvfr_day_schedule!inner(date, session)')
    .in('requirement', ['required', 'optional']);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  type Row = {
    title: string;
    item_type: string | null;
    requirement: string | null;
    is_completed: boolean;
    day: { date: string; session: string } | { date: string; session: string }[] | null;
  };

  const rows = (data ?? []) as Row[];
  const dateOf = (r: Row): string => {
    const d = Array.isArray(r.day) ? r.day[0] : r.day;
    return d?.date ?? '';
  };

  // Per-day Tier-1 (required) aggregation.
  const dayMap = new Map<string, { date: string; total: number; completed: number; outstanding: Array<{ title: string; item_type: string | null }> }>();
  const byType = new Map<string, { total: number; completed: number }>();
  let tier1Total = 0, tier1Done = 0, tier2Count = 0;

  for (const r of rows) {
    if (r.requirement === 'optional') { tier2Count++; continue; } // Tier 2 — counted, not metered
    const date = dateOf(r);
    if (!date) continue;
    tier1Total++;
    if (r.is_completed) tier1Done++;

    if (!dayMap.has(date)) dayMap.set(date, { date, total: 0, completed: 0, outstanding: [] });
    const d = dayMap.get(date)!;
    d.total++;
    if (r.is_completed) d.completed++;
    else d.outstanding.push({ title: r.title, item_type: r.item_type });

    const t = r.item_type || 'other';
    if (!byType.has(t)) byType.set(t, { total: 0, completed: 0 });
    const tt = byType.get(t)!;
    tt.total++;
    if (r.is_completed) tt.completed++;
  }

  const days = Array.from(dayMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(d => ({ ...d, pct: d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0 }));

  return NextResponse.json({
    success: true,
    summary: {
      tier1Total,
      tier1Done,
      tier1Outstanding: tier1Total - tier1Done,
      pct: tier1Total > 0 ? Math.round((tier1Done / tier1Total) * 100) : 0,
      daysWithTracked: days.length,
      tier2Count,
    },
    byType: Object.fromEntries(
      Array.from(byType.entries()).map(([k, v]) => [k, { ...v, pct: v.total > 0 ? Math.round((v.completed / v.total) * 100) : 0 }]),
    ),
    days,
  });
}
