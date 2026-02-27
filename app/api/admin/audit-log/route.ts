import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { canAccessData, isSuperadmin } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

// ─── GET: Fetch audit logs with filters and pagination ───────────────────────

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    // Verify authentication
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Get current user's role
    const { data: currentUser } = await supabase
      .from('lab_users')
      .select('id, role')
      .ilike('email', session.user.email)
      .single();

    if (!currentUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // FERPA: Only superadmins can view audit logs
    if (!canAccessData(currentUser.role, 'auditLogs')) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const mode = searchParams.get('mode');

    // ── Stats mode: return summary counts ─────────────────────────────────────
    if (mode === 'stats') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [totalResult, todayResult, topUserResult, topActionResult] = await Promise.all([
        // Total count
        supabase.from('audit_log').select('id', { count: 'exact', head: true }),
        // Today's count
        supabase
          .from('audit_log')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', todayStart.toISOString()),
        // Most active user (last 30 days)
        supabase
          .from('audit_log')
          .select('user_email')
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .not('user_email', 'is', null),
        // Most common action (last 30 days)
        supabase
          .from('audit_log')
          .select('action')
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

      // Tally user_email occurrences
      const userEmailCounts: Record<string, number> = {};
      for (const row of topUserResult.data ?? []) {
        const email = row.user_email as string;
        userEmailCounts[email] = (userEmailCounts[email] || 0) + 1;
      }
      const topUser = Object.entries(userEmailCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      // Tally action occurrences
      const actionCounts: Record<string, number> = {};
      for (const row of topActionResult.data ?? []) {
        const a = row.action as string;
        actionCounts[a] = (actionCounts[a] || 0) + 1;
      }
      const topAction = Object.entries(actionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      return NextResponse.json({
        success: true,
        total: totalResult.count ?? 0,
        today: todayResult.count ?? 0,
        topUser,
        topAction,
      });
    }

    // ── CSV export mode ───────────────────────────────────────────────────────
    if (mode === 'export') {
      const userEmail = searchParams.get('userEmail');
      const action = searchParams.get('action');
      const resourceType = searchParams.get('resourceType');
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');
      const search = searchParams.get('search');

      let query = supabase
        .from('audit_log')
        .select('id, user_email, user_role, action, resource_type, resource_id, resource_description, ip_address, created_at, metadata')
        .order('created_at', { ascending: false })
        .limit(5000);

      if (userEmail) query = query.ilike('user_email', `%${userEmail}%`);
      if (action) query = query.eq('action', action);
      if (resourceType) query = query.eq('resource_type', resourceType);
      if (startDate) query = query.gte('created_at', startDate);
      if (endDate) query = query.lte('created_at', `${endDate}T23:59:59`);
      if (search) query = query.ilike('resource_description', `%${search}%`);

      const { data, error } = await query;
      if (error) throw error;

      // Build CSV
      const header = ['Timestamp', 'User Email', 'Role', 'Action', 'Resource Type', 'Resource ID', 'Description', 'IP Address', 'Metadata'].join(',');
      const rows = (data ?? []).map((row) => {
        const fields = [
          new Date(row.created_at).toLocaleString('en-US'),
          row.user_email ?? '',
          row.user_role ?? '',
          row.action ?? '',
          row.resource_type ?? '',
          row.resource_id ?? '',
          (row.resource_description ?? '').replace(/"/g, '""'),
          row.ip_address ?? '',
          row.metadata ? JSON.stringify(row.metadata).replace(/"/g, '""') : '',
        ];
        return fields.map((f) => `"${f}"`).join(',');
      });

      const csv = [header, ...rows].join('\n');
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    // ── Default: paginated listing ────────────────────────────────────────────
    const userEmail = searchParams.get('userEmail');
    const action = searchParams.get('action');
    const resourceType = searchParams.get('resourceType');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = (page - 1) * limit;

    let query = supabase
      .from('audit_log')
      .select(
        'id, user_id, user_email, user_role, action, resource_type, resource_id, resource_description, ip_address, user_agent, metadata, created_at',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false });

    if (userEmail) query = query.ilike('user_email', `%${userEmail}%`);
    if (action) query = query.eq('action', action);
    if (resourceType) query = query.eq('resource_type', resourceType);
    if (startDate) {
      query = query.gte('created_at', startDate);
    } else {
      // Default to last 30 days when no start date specified
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      query = query.gte('created_at', thirtyDaysAgo.toISOString());
    }
    if (endDate) query = query.lte('created_at', `${endDate}T23:59:59`);
    if (search) query = query.ilike('resource_description', `%${search}%`);

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({
      success: true,
      logs: data ?? [],
      total: count ?? 0,
      page,
      limit,
      totalPages: Math.ceil((count ?? 0) / limit),
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch audit logs' }, { status: 500 });
  }
}

// ─── DELETE: Purge logs older than N days (superadmin only) ──────────────────

export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: currentUser } = await supabase
      .from('lab_users')
      .select('id, role')
      .ilike('email', session.user.email)
      .single();

    if (!currentUser || !isSuperadmin(currentUser.role)) {
      return NextResponse.json({ success: false, error: 'Superadmin required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '365');

    if (days < 30) {
      return NextResponse.json(
        { success: false, error: 'Retention period must be at least 30 days' },
        { status: 400 }
      );
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const { error, count } = await supabase
      .from('audit_log')
      .delete({ count: 'exact' })
      .lt('created_at', cutoff.toISOString());

    if (error) throw error;

    return NextResponse.json({
      success: true,
      deleted: count ?? 0,
      cutoffDate: cutoff.toISOString(),
    });
  } catch (error) {
    console.error('Error purging audit logs:', error);
    return NextResponse.json({ success: false, error: 'Failed to purge audit logs' }, { status: 500 });
  }
}
