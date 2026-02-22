import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { canAccessData } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

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

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const userEmail = searchParams.get('userEmail');
    const action = searchParams.get('action');
    const resourceType = searchParams.get('resourceType');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('audit_log')
      .select('id, user_email, action, resource_type, resource_id, description, ip_address, created_at', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (userEmail) {
      query = query.ilike('user_email', `%${userEmail}%`);
    }

    if (action) {
      query = query.eq('action', action);
    }

    if (resourceType) {
      query = query.eq('resource_type', resourceType);
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    } else {
      // Default to last 30 days if no start date specified
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      query = query.gte('created_at', thirtyDaysAgo.toISOString());
    }

    if (endDate) {
      query = query.lte('created_at', `${endDate}T23:59:59`);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      logs: data,
      total: count,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch audit logs' }, { status: 500 });
  }
}
