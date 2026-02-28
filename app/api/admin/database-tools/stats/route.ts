import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isSuperadmin } from '@/lib/permissions';

// ---------------------------------------------------------------------------
// Helper – resolve current user from session email
// ---------------------------------------------------------------------------
async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, role')
    .ilike('email', email)
    .single();
  return data;
}

// ---------------------------------------------------------------------------
// GET /api/admin/database-tools/stats
//
// Returns database statistics using pg_stat_user_tables and relation sizes.
// Results include table name, estimated row count, total size, and index size.
// Requires superadmin role.
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !isSuperadmin(currentUser.role)) {
      return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();

    // Query PostgreSQL system catalog for table statistics
    const { data, error } = await supabase.rpc('get_table_stats');

    if (error) {
      // Fallback: query individual known tables with count
      const knownTables = [
        'lab_users',
        'students',
        'cohorts',
        'lab_days',
        'lab_day_students',
        'scenarios',
        'skill_signoffs',
        'certifications',
        'user_notifications',
        'audit_log',
        'system_alerts',
        'announcements',
        'access_requests',
        'equipment',
      ];

      const tableStats = await Promise.all(
        knownTables.map(async (tableName) => {
          const { count } = await supabase
            .from(tableName)
            .select('id', { count: 'exact', head: true });
          return {
            table_name: tableName,
            row_count: count ?? 0,
            total_size: null as string | null,
            index_size: null as string | null,
            table_size: null as string | null,
          };
        })
      );

      // Sort by row count descending
      tableStats.sort((a, b) => (b.row_count ?? 0) - (a.row_count ?? 0));

      return NextResponse.json({
        success: true,
        tables: tableStats,
        totalSize: null,
        source: 'fallback',
      });
    }

    return NextResponse.json({
      success: true,
      tables: data ?? [],
      source: 'pg_stats',
    });
  } catch (error) {
    console.error('Error fetching database stats:', error);
    return NextResponse.json({ error: 'Failed to fetch database statistics' }, { status: 500 });
  }
}
