import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// GET /api/admin/skill-sheets/counts
//
// Returns row counts for all skill sheet tables.
// Requires admin+ role.
// ---------------------------------------------------------------------------
export async function GET() {
  const auth = await requireAuth('admin');
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const supabase = getSupabaseAdmin();

  try {
    const tables = [
      'canonical_skills',
      'skill_sheets',
      'skill_sheet_steps',
      'skill_sheet_assignments',
      'student_skill_evaluations',
    ];

    const counts: Record<string, number> = {};

    for (const table of tables) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        // Table might not exist yet
        counts[table] = 0;
      } else {
        counts[table] = count ?? 0;
      }
    }

    return NextResponse.json({
      success: true,
      counts,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
