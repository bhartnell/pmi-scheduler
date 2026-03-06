import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canAccessAdmin } from '@/lib/permissions';
import { requireAuth } from '@/lib/api-auth';

// ---------------------------------------------------------------------------
// Helper – resolve current user
// ---------------------------------------------------------------------------
async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

// ---------------------------------------------------------------------------
// GET /api/admin/skill-sheets/counts
//
// Returns row counts for all skill sheet tables.
// Requires admin+ role.
// ---------------------------------------------------------------------------
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const currentUser = await getCurrentUser(user.email);
  if (!currentUser || !canAccessAdmin(user.role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

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
