import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canAccessAdmin } from '@/lib/permissions';

// ---------------------------------------------------------------------------
// Helper – resolve current user from session email
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
// GET /api/admin/system-alerts
//
// Query params:
//   ?type=     - filter by alert_type (optional)
//   ?severity= - filter by severity (optional)
//   ?resolved= - 'true' | 'false' | omit for all (optional)
//
// Returns system alerts sorted by severity then newest first.
// Requires admin+ role.
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const typeFilter = searchParams.get('type');
    const severityFilter = searchParams.get('severity');
    const resolvedFilter = searchParams.get('resolved');

    let query = supabase
      .from('system_alerts')
      .select('*')
      .order('created_at', { ascending: false });

    if (typeFilter) {
      query = query.eq('alert_type', typeFilter);
    }
    if (severityFilter) {
      query = query.eq('severity', severityFilter);
    }
    if (resolvedFilter === 'true') {
      query = query.eq('is_resolved', true);
    } else if (resolvedFilter === 'false') {
      query = query.eq('is_resolved', false);
    }

    const { data: alerts, error } = await query;
    if (error) throw error;

    // Count stats
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    const { count: resolvedTodayCount } = await supabase
      .from('system_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('is_resolved', true)
      .gte('resolved_at', startOfDay);

    const { data: lastHealthCheck } = await supabase
      .from('system_alerts')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      success: true,
      alerts: alerts ?? [],
      stats: {
        resolvedToday: resolvedTodayCount ?? 0,
        lastHealthCheck: lastHealthCheck?.created_at ?? null,
      },
    });
  } catch (error) {
    console.error('Error fetching system alerts:', error);
    return NextResponse.json({ error: 'Failed to fetch system alerts' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/admin/system-alerts
//
// Body: { id: string, resolved: boolean }
//
// Resolves or unresolves a system alert. Requires admin+ role.
// ---------------------------------------------------------------------------
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await getCurrentUser(session.user.email);
    if (!currentUser || !canAccessAdmin(currentUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json() as { id: string; resolved: boolean };
    const { id, resolved } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    if (typeof resolved !== 'boolean') {
      return NextResponse.json({ error: 'resolved (boolean) is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('system_alerts')
      .update({
        is_resolved: resolved,
        resolved_at: resolved ? new Date().toISOString() : null,
        resolved_by: resolved ? session.user.email : null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Alert not found' }, { status: 404 });

    return NextResponse.json({ success: true, alert: data });
  } catch (error) {
    console.error('Error updating system alert:', error);
    return NextResponse.json({ error: 'Failed to update system alert' }, { status: 500 });
  }
}
